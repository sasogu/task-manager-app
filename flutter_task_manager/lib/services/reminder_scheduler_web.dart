import 'dart:async';
import 'dart:html' as html;

import '../models/task.dart';
import 'reminder_scheduler_base.dart';

class WebReminderScheduler implements ReminderScheduler {
  final Map<String, Timer> _timers = {};
  bool _permissionGranted = false;

  @override
  Future<void> initialize() async {
    if (!html.Notification.supported) {
      return;
    }
    final status = html.Notification.permission;
    if (status == 'granted') {
      _permissionGranted = true;
      return;
    }
    if (status == 'denied') {
      _permissionGranted = false;
      return;
    }
    final result = await html.Notification.requestPermission();
    _permissionGranted = result == 'granted';
  }

  @override
  Future<void> syncFromState(List<Task> tasks) async {
    if (!_permissionGranted || !html.Notification.supported) {
      _clearTimers();
      return;
    }
    _clearTimers();
    final now = DateTime.now();
    for (final task in tasks) {
      final reminder = task.reminder;
      final shouldNotify = reminder != null &&
          reminder.isAfter(now) &&
          !task.reminderDone &&
          task.category != TaskCategory.archivadas;
      if (!shouldNotify) continue;
      final delay = reminder.difference(now);
      _timers[task.id] = Timer(delay, () {
        html.Notification(
          task.title,
          body: _buildBody(task),
        );
      });
    }
  }

  void _clearTimers() {
    for (final timer in _timers.values) {
      timer.cancel();
    }
    _timers.clear();
  }

  String _buildBody(Task task) {
    if (task.tags.isNotEmpty) {
      return 'Etiquetes: ${task.tags.join(', ')}';
    }
    return 'No oblides completar aquesta tasca.';
  }
}

ReminderScheduler buildReminderScheduler() => WebReminderScheduler();
