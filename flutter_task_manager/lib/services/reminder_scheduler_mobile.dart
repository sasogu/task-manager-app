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
    print('[TaskManager][ReminderScheduler] Inicializando AwesomeNotifications...');
    await _notifications.initialize(
      null,
      [
        NotificationChannel(
          channelKey: _channelKey,
          channelName: 'Recordatoris de tasques',
          channelDescription:
              'Notificacions per a recordar-te les tasques pendents',
          defaultColor: const Color(0xFF35424A),
          ledColor: const Color(0xFFFFFFFF),
          importance: NotificationImportance.Max,
          channelShowBadge: true,
        ),
      ],
      debug: kDebugMode,
    );
    final allowed = await _notifications.isNotificationAllowed();
    print('[TaskManager][ReminderScheduler] Permisos de notificación permitidos: $allowed');
    if (!allowed) {
      print('[TaskManager][ReminderScheduler] Solicitando permisos...');
      await _notifications.requestPermissionToSendNotifications();
      final newAllowed = await _notifications.isNotificationAllowed();
      print('[TaskManager][ReminderScheduler] Permisos después de solicitar: $newAllowed');
    }
  }

  @override
  Future<void> syncFromState(List<Task> tasks) async {
    print('[TaskManager][ReminderScheduler] Sincronizando notificaciones para ${tasks.length} tareas...');
    await _notifications.cancelNotificationsByChannelKey(_channelKey);
    print('[TaskManager][ReminderScheduler] Notificaciones anteriores canceladas.');
    final now = DateTime.now();
    int scheduledCount = 0;
    for (final task in tasks) {
      final reminder = task.reminder;
      final shouldNotify = reminder != null &&
          reminder.isAfter(now) &&
          !task.reminderDone &&
          task.category != TaskCategory.archivadas;
      if (!shouldNotify) {
        print('[TaskManager][ReminderScheduler] Tarea ${task.id} (${task.title}) no requiere notificación.');
        continue;
      }
      print('[TaskManager][ReminderScheduler] Programando notificación para tarea ${task.id} (${task.title}) en ${reminder.toLocal()}');
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
      scheduledCount++;
    }
    print('[TaskManager][ReminderScheduler] Notificaciones programadas: $scheduledCount');
  }

  int _notificationId(String taskId) =>
      taskId.hashCode & 0x7FFFFFFF; // keep it positive

  String _buildBody(Task task) {
    if (task.tags.isNotEmpty) {
      return 'Etiquetes: ${task.tags.join(', ')}';
    }
    return 'No oblides completar aquesta tasca.';
  }
}

ReminderScheduler buildReminderScheduler() => AwesomeReminderScheduler();
