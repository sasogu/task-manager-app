import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/dropbox_config.dart';
import '../models/task.dart';
import '../models/task_state.dart';
import '../services/dropbox_service.dart';
import '../utils/pkce.dart';
import 'task_providers.dart';

class DropboxState {
  const DropboxState({
    this.isConnected = false,
    this.isConnecting = false,
    this.isSyncing = false,
    this.lastSync,
    this.errorMessage,
  });

  final bool isConnected;
  final bool isConnecting;
  final bool isSyncing;
  final DateTime? lastSync;
  final String? errorMessage;

  DropboxState copyWith({
    bool? isConnected,
    bool? isConnecting,
    bool? isSyncing,
    DateTime? lastSync,
    String? errorMessage,
    bool clearError = false,
  }) {
    return DropboxState(
      isConnected: isConnected ?? this.isConnected,
      isConnecting: isConnecting ?? this.isConnecting,
      isSyncing: isSyncing ?? this.isSyncing,
      lastSync: lastSync ?? this.lastSync,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

final dropboxServiceProvider = Provider<DropboxService>((ref) {
  return DropboxService();
});

final dropboxControllerProvider =
    StateNotifierProvider<DropboxController, DropboxState>((ref) {
      final service = ref.watch(dropboxServiceProvider);
      return DropboxController(ref, service);
    });

class DropboxController extends StateNotifier<DropboxState> {
  DropboxController(this._ref, this._service) : super(const DropboxState()) {
    _restoreCredentials();
  }

  final Ref _ref;
  final DropboxService _service;
  SharedPreferences? _prefs;
  DropboxCredentials? _credentials;

  static const _legacyTokenKey = 'dropbox_access_token';
  static const _credentialsKey = 'dropbox_credentials';

  Future<void> connect() async {
    final appKey = dropboxAppKey;
    final redirectUri = dropboxRedirectUri;
    if (appKey.isEmpty || redirectUri.isEmpty) {
      state = state.copyWith(
        errorMessage:
            'Configura DROPBOX_APP_KEY y DROPBOX_REDIRECT_URI antes de conectar.',
      );
      return;
    }
    if (state.isConnecting) return;

    state = state.copyWith(isConnecting: true, clearError: true);
    try {
      final creds = await _performOAuth(appKey, redirectUri);
      await _saveCredentials(creds);
      state = state.copyWith(
        isConnecting: false,
        isConnected: true,
        clearError: true,
      );
    } catch (error) {
      state = state.copyWith(
        isConnecting: false,
        errorMessage: 'No se pudo conectar: $error',
      );
    }
  }

  Future<void> disconnect() async {
    _credentials = null;
    await _ensurePrefs();
    await _prefs!.remove(_credentialsKey);
    await _prefs!.remove(_legacyTokenKey);
    state = state.copyWith(isConnected: false);
  }

  Future<void> sync() async {
    final appKey = dropboxAppKey;
    if (appKey.isEmpty) {
      state = state.copyWith(
        errorMessage: 'Configura DROPBOX_APP_KEY para sincronizar.',
      );
      return;
    }

    final creds = await _ensureValidCredentials(appKey);
    if (creds == null) {
      state = state.copyWith(
        errorMessage: 'Conéctate a Dropbox antes de sincronizar.',
      );
      return;
    }
    if (state.isSyncing) return;

    state = state.copyWith(isSyncing: true, clearError: true);
    try {
      final localState = _ref.read(taskListProvider);
      final remoteSnapshot = await _service.downloadSnapshot(
        accessToken: creds.accessToken,
      );
      final merged = _mergeStates(localState, remoteSnapshot?.toTaskState());
      _ref.read(taskListProvider.notifier).replaceAll(merged);

      final snapshot = DropboxSnapshot(
        tasks: merged.tasks,
        deletedTasks: merged.deletedTasks,
        lastSync: DateTime.now(),
      );
      await _service.uploadSnapshot(
        accessToken: creds.accessToken,
        snapshot: snapshot,
      );
      state = state.copyWith(
        isSyncing: false,
        isConnected: true,
        lastSync: snapshot.lastSync,
        clearError: true,
      );
    } catch (error) {
      state = state.copyWith(
        isSyncing: false,
        errorMessage: 'Error al sincronizar: $error',
      );
    }
  }

  Future<void> _restoreCredentials() async {
    await _ensurePrefs();
    final stored = _prefs!.getString(_credentialsKey);
    if (stored != null) {
      try {
        final decoded = jsonDecode(stored) as Map<String, dynamic>;
        _credentials = DropboxCredentials.fromJson(decoded);
        state = state.copyWith(isConnected: true);
        return;
      } catch (_) {}
    }

    final legacy = _prefs!.getString(_legacyTokenKey);
    if (legacy != null && legacy.isNotEmpty) {
      _credentials = DropboxCredentials(
        accessToken: legacy,
        refreshToken: '',
        expiresAt: DateTime.now().add(const Duration(days: 7)),
      );
      state = state.copyWith(isConnected: true);
    }
  }

  Future<void> _saveCredentials(DropboxCredentials credentials) async {
    _credentials = credentials;
    await _ensurePrefs();
    await _prefs!.setString(_credentialsKey, jsonEncode(credentials.toJson()));
    await _prefs!.remove(_legacyTokenKey);
  }

  Future<DropboxCredentials?> _ensureValidCredentials(String appKey) async {
    var creds = _credentials;
    if (creds == null) return null;

    final soon = DateTime.now().add(const Duration(minutes: 1));
    if (creds.expiresAt.isAfter(soon)) {
      return creds;
    }

    if (creds.refreshToken.isEmpty) {
      return null;
    }

    try {
      final refreshed = await _service.refreshAccessToken(
        clientId: appKey,
        refreshToken: creds.refreshToken,
      );
      await _saveCredentials(refreshed);
      return refreshed;
    } catch (error) {
      state = state.copyWith(errorMessage: '$error');
      return null;
    }
  }

  Future<DropboxCredentials> _performOAuth(
    String appKey,
    String redirectUri,
  ) async {
    final pkce = generatePkcePair();
    final scope = dropboxScopes.join(' ');
    final authUri = Uri.https('www.dropbox.com', '/oauth2/authorize', {
      'response_type': 'code',
      'client_id': appKey,
      'redirect_uri': redirectUri,
      'token_access_type': 'offline',
      'code_challenge': pkce.challenge,
      'code_challenge_method': 'S256',
      'scope': scope,
    });

    final callbackScheme = Uri.parse(redirectUri).scheme;
    final result = await FlutterWebAuth2.authenticate(
      url: authUri.toString(),
      callbackUrlScheme: callbackScheme,
    );

    final code = _extractCode(result);
    final creds = await _service.exchangeCodeForToken(
      clientId: appKey,
      redirectUri: redirectUri,
      code: code,
      codeVerifier: pkce.verifier,
    );
    return creds;
  }

  String _extractCode(String callbackUrl) {
    final uri = Uri.parse(callbackUrl);
    final queryCode = uri.queryParameters['code'];
    if (queryCode != null && queryCode.isNotEmpty) {
      return queryCode;
    }
    if (uri.fragment.isNotEmpty) {
      final fragmentParams = Uri.splitQueryString(uri.fragment);
      final fragmentCode = fragmentParams['code'];
      if (fragmentCode != null && fragmentCode.isNotEmpty) {
        return fragmentCode;
      }
    }
    throw DropboxException('La autorización no devolvió un código válido.');
  }

  TaskState _mergeStates(TaskState local, TaskState? remote) {
    if (remote == null) return local;

    final localMap = {for (final task in local.tasks) task.id: task};
    final remoteMap = {for (final task in remote.tasks) task.id: task};

    final mergedTasks = <Task>[];
    final allIds = {...localMap.keys, ...remoteMap.keys};
    for (final id in allIds) {
      final localTask = localMap[id];
      final remoteTask = remoteMap[id];
      Task? chosen;
      if (localTask == null) {
        chosen = remoteTask;
      } else if (remoteTask == null) {
        chosen = localTask;
      } else {
        final localTime =
            localTask.lastModified ?? DateTime.fromMillisecondsSinceEpoch(0);
        final remoteTime =
            remoteTask.lastModified ?? DateTime.fromMillisecondsSinceEpoch(0);
        chosen =
            localTime.isAfter(remoteTime) ||
                localTime.isAtSameMomentAs(remoteTime)
            ? localTask
            : remoteTask;
      }
      if (chosen != null) mergedTasks.add(chosen);
    }

    final mergedDeleted = _mergeDeleted(
      local.deletedTasks,
      remote.deletedTasks,
    );
    final deletionMap = {
      for (final task in mergedDeleted)
        task.id: task.deletedOn ?? DateTime.fromMillisecondsSinceEpoch(0),
    };
    final filteredTasks = mergedTasks.where((task) {
      final deletionTime = deletionMap[task.id];
      if (deletionTime == null) return true;
      final taskTime =
          task.lastModified ?? DateTime.fromMillisecondsSinceEpoch(0);
      return taskTime.isAfter(deletionTime);
    }).toList();

    return TaskState(tasks: filteredTasks, deletedTasks: mergedDeleted);
  }

  List<Task> _mergeDeleted(List<Task> local, List<Task> remote) {
    final map = <String, Task>{};
    void add(Task task) {
      final existing = map[task.id];
      final existingTime =
          existing?.deletedOn ?? DateTime.fromMillisecondsSinceEpoch(0);
      final currentTime =
          task.deletedOn ?? DateTime.fromMillisecondsSinceEpoch(0);
      if (existing == null || currentTime.isAfter(existingTime)) {
        map[task.id] = task;
      }
    }

    for (final task in local) {
      add(task);
    }
    for (final task in remote) {
      add(task);
    }
    return map.values.toList();
  }

  Future<void> _ensurePrefs() async {
    _prefs ??= await SharedPreferences.getInstance();
  }
}
