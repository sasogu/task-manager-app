import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/task_state.dart';
import '../models/task.dart';

class TaskRepository {
  static const _storageKey = 'task_manager_state';

  Future<TaskState> loadState() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_storageKey);
    if (raw == null || raw.isEmpty) {
      return const TaskState();
    }
    try {
      final decoded = jsonDecode(raw);
      if (decoded is List) {
        final tasks = decoded
            .whereType<Map<String, dynamic>>()
            .map(Task.fromJson)
            .toList();
        return TaskState(tasks: tasks);
      }
      if (decoded is Map<String, dynamic>) {
        return TaskState.fromJson(decoded);
      }
      return const TaskState();
    } catch (_) {
      return const TaskState();
    }
  }

  Future<void> saveState(TaskState state) async {
    final prefs = await SharedPreferences.getInstance();
    final payload = jsonEncode(state.toJson());
    await prefs.setString(_storageKey, payload);
  }
}
