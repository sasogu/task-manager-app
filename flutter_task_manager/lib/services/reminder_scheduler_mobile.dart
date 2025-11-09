import 'package:awesome_notifications/awesome_notifications.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../models/task.dart';
import 'reminder_scheduler_base.dart';

const _channelKey = 'task_reminders';

class AwesomeReminderScheduler implements ReminderScheduler {
  final AwesomeNotifications _notifications = AwesomeNotifications();

  @override
  Future<void> initialize() async {
    await _notifications.initialize(
      null,
      [
        NotificationChannel(
          channelKey: _channelKey,
          channelName: 'Recordatorios de tareas',
          channelDescription:
              'Notificaciones para recordarte las tareas pendientes',
          defaultColor: const Color(0xFF35424A),
          ledColor: const Color(0xFFFFFFFF),
          importance: NotificationImportance.Max,
          channelShowBadge: true,
        ),
      ],
      debug: kDebugMode,
    );
    final allowed = await _notifications.isNotificationAllowed();
    if (!allowed) {
      await _notifications.requestPermissionToSendNotifications();
    }
  }

  @override
  Future<void> syncFromState(List<Task> tasks) async {
    await _notifications.cancelNotificationsByChannelKey(_channelKey);
    final now = DateTime.now();
    for (final task in tasks) {
      final reminder = task.reminder;
      final shouldNotify = reminder != null &&
          reminder.isAfter(now) &&
          !task.reminderDone &&
          task.category != TaskCategory.archivadas;
      if (!shouldNotify) continue;
      await _notifications.createNotification(
        content: NotificationContent(
          id: _notificationId(task.id),
          channelKey: _channelKey,
          title: task.title,
          body: _buildBody(task),
          payload: {'taskId': task.id},
          category: NotificationCategory.Reminder,
        ),
        schedule: NotificationCalendar.fromDate(
          date: reminder.toLocal(),
          preciseAlarm: true,
          allowWhileIdle: true,
        ),
      );
    }
  }

  int _notificationId(String taskId) =>
      taskId.hashCode & 0x7FFFFFFF; // keep it positive

  String _buildBody(Task task) {
    if (task.tags.isNotEmpty) {
      return 'Etiquetas: ${task.tags.join(', ')}';
    }
    return 'No olvides completar esta tarea.';
  }
}

ReminderScheduler buildReminderScheduler() => AwesomeReminderScheduler();
