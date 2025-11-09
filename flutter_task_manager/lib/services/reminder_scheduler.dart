import 'reminder_scheduler_base.dart';
import 'reminder_scheduler_mobile.dart'
    if (dart.library.html) 'reminder_scheduler_web.dart';

ReminderScheduler createReminderScheduler() {
  return buildReminderScheduler();
}
