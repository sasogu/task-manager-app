import '../models/task.dart';

abstract class ReminderScheduler {
  Future<void> initialize();
  Future<void> syncFromState(List<Task> tasks);
}
