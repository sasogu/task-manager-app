import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/task.dart';
import '../models/task_state.dart';

class DropboxException implements Exception {
  DropboxException(this.message);
  final String message;

  @override
  String toString() => 'DropboxException: $message';
}

class DropboxCredentials {
  DropboxCredentials({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresAt,
  });

  final String accessToken;
  final String refreshToken;
  final DateTime expiresAt;

  DropboxCredentials copyWith({
    String? accessToken,
    String? refreshToken,
    DateTime? expiresAt,
  }) {
    return DropboxCredentials(
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
      expiresAt: expiresAt ?? this.expiresAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'accessToken': accessToken,
      'refreshToken': refreshToken,
      'expiresAt': expiresAt.toIso8601String(),
    };
  }

  factory DropboxCredentials.fromJson(Map<String, dynamic> json) {
    return DropboxCredentials(
      accessToken: json['accessToken'] as String? ?? '',
      refreshToken: json['refreshToken'] as String? ?? '',
      expiresAt:
          DateTime.tryParse(json['expiresAt'] as String? ?? '') ??
          DateTime.now(),
    );
  }
}

class DropboxSnapshot {
  DropboxSnapshot({
    required this.tasks,
    required this.deletedTasks,
    this.lastSync,
  });

  final List<Task> tasks;
  final List<Task> deletedTasks;
  final DateTime? lastSync;

  Map<String, dynamic> toJson() {
    return {
      'tasks': tasks.map((task) => task.toJson()).toList(),
      'deletedTasks': deletedTasks.map((task) => task.toJson()).toList(),
      'lastSync': lastSync?.toIso8601String(),
    };
  }

  factory DropboxSnapshot.fromJson(Map<String, dynamic> json) {
    final tasksJson = json['tasks'] as List<dynamic>? ?? const [];
    final deletedJson = json['deletedTasks'] as List<dynamic>? ?? const [];
    return DropboxSnapshot(
      tasks: tasksJson
          .whereType<Map<String, dynamic>>()
          .map(Task.fromJson)
          .toList(),
      deletedTasks: deletedJson
          .whereType<Map<String, dynamic>>()
          .map(Task.fromJson)
          .toList(),
      lastSync: json['lastSync'] != null
          ? DateTime.tryParse(json['lastSync'])
          : null,
    );
  }

  TaskState toTaskState() {
    return TaskState(tasks: tasks, deletedTasks: deletedTasks);
  }
}

class DropboxService {
  DropboxService({this.remotePath = '/task-manager/state.json'});

  final String remotePath;

  static const _uploadUrl = 'https://content.dropboxapi.com/2/files/upload';
  static const _downloadUrl = 'https://content.dropboxapi.com/2/files/download';
  static const _usersGetCurrentAccount =
      'https://api.dropboxapi.com/2/users/get_current_account';
  static const _tokenUrl = 'https://api.dropboxapi.com/oauth2/token';

  Future<void> validateToken(String accessToken) async {
    final response = await http.post(
      Uri.parse(_usersGetCurrentAccount),
      headers: {
        'Authorization': 'Bearer $accessToken',
        'Content-Type': 'application/json',
      },
    );
    if (response.statusCode != 200) {
      throw DropboxException(
        'Token de Dropbox no vàlid (status ${response.statusCode}).',
      );
    }
  }

  Future<DropboxCredentials> exchangeCodeForToken({
    required String clientId,
    required String redirectUri,
    required String code,
    required String codeVerifier,
  }) async {
    print('[Dropbox OAuth] Intercanviant el codi per un token...');
    print('[Dropbox OAuth] clientId: $clientId');
    print('[Dropbox OAuth] redirectUri: $redirectUri');
    print('[Dropbox OAuth] code: $code');
    print('[Dropbox OAuth] codeVerifier: $codeVerifier');
    final response = await http.post(
      Uri.parse(_tokenUrl),
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: {
        'grant_type': 'authorization_code',
        'code': code,
        'code_verifier': codeVerifier,
        'client_id': clientId,
        'redirect_uri': redirectUri,
      },
    );

    print('[Dropbox OAuth] Resposta del token: status=${response.statusCode} body=${response.body}');

    if (response.statusCode != 200) {
      print('[Dropbox OAuth] ERROR en intercanviar el codi: ${response.body}');
      throw DropboxException(
        'Error en intercanviar el codi (${response.statusCode}): ${response.body}',
      );
    }

    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    print('[Dropbox OAuth] Payload rebut: $payload');
    final creds = _parseCredentialsFromTokenPayload(payload);
    print('[Dropbox OAuth] Credencials obtingudes: accessToken=${creds.accessToken}, refreshToken=${creds.refreshToken}, expiresAt=${creds.expiresAt}');
    return creds;
  }

  Future<DropboxCredentials> refreshAccessToken({
    required String clientId,
    required String refreshToken,
  }) async {
    final response = await http.post(
      Uri.parse(_tokenUrl),
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: {
        'grant_type': 'refresh_token',
        'refresh_token': refreshToken,
        'client_id': clientId,
      },
    );

    if (response.statusCode != 200) {
      throw DropboxException(
        'No s\'ha pogut refrescar el token (${response.statusCode}): ${response.body}',
      );
    }

    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    return _parseCredentialsFromTokenPayload(
      payload,
      refreshTokenFallback: refreshToken,
    );
  }

  DropboxCredentials _parseCredentialsFromTokenPayload(
    Map<String, dynamic> payload, {
    String? refreshTokenFallback,
  }) {
    final accessToken = payload['access_token'] as String? ?? '';
    final expiresIn = payload['expires_in'] as int? ?? 3600;
    final refreshToken =
        payload['refresh_token'] as String? ?? refreshTokenFallback ?? '';
    final safeSeconds = (expiresIn - 30).clamp(60, 86400);
    final expiresAt = DateTime.now().add(Duration(seconds: safeSeconds));
    return DropboxCredentials(
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresAt: expiresAt,
    );
  }

  Future<void> uploadSnapshot({
    required String accessToken,
    required DropboxSnapshot snapshot,
  }) async {
    final response = await http.post(
      Uri.parse(_uploadUrl),
      headers: {
        'Authorization': 'Bearer $accessToken',
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': jsonEncode({
          'path': remotePath,
          'mode': 'overwrite',
          'mute': true,
        }),
      },
      body: utf8.encode(jsonEncode(snapshot.toJson())),
    );
    if (response.statusCode != 200) {
      throw DropboxException(
        'No s\'ha pogut pujar el fitxer (${response.statusCode}): ${response.body}',
      );
    }
  }

  Future<DropboxSnapshot?> downloadSnapshot({
    required String accessToken,
  }) async {
    final response = await http.post(
      Uri.parse(_downloadUrl),
      headers: {
        'Authorization': 'Bearer $accessToken',
        'Dropbox-API-Arg': jsonEncode({'path': remotePath}),
      },
    );

    if (response.statusCode == 409) {
      return null;
    }

    if (response.statusCode != 200) {
      throw DropboxException(
        'No s\'ha pogut descarregar el fitxer (${response.statusCode}): ${response.body}',
      );
    }

    final jsonBody = jsonDecode(utf8.decode(response.bodyBytes));
    if (jsonBody is Map<String, dynamic>) {
      return DropboxSnapshot.fromJson(jsonBody);
    }
    return null;
  }
}
