import 'task.dart';

class TaskState {
  const TaskState({this.tasks = const [], this.deletedTasks = const []});

  final List<Task> tasks;
  final List<Task> deletedTasks;

  TaskState copyWith({List<Task>? tasks, List<Task>? deletedTasks}) {
    return TaskState(
      tasks: tasks ?? this.tasks,
      deletedTasks: deletedTasks ?? this.deletedTasks,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'tasks': tasks.map((task) => task.toJson()).toList(),
      'deletedTasks': deletedTasks.map((task) => task.toJson()).toList(),
    };
  }

  factory TaskState.fromJson(Map<String, dynamic> json) {
    final tasksJson = json['tasks'];
    final deletedJson = json['deletedTasks'];
    final tasks = tasksJson is List
        ? tasksJson
              .whereType<Map<String, dynamic>>()
              .map(Task.fromJson)
              .toList()
        : const <Task>[];
    final deleted = deletedJson is List
        ? deletedJson
              .whereType<Map<String, dynamic>>()
              .map(Task.fromJson)
              .toList()
        : const <Task>[];
    return TaskState(tasks: tasks, deletedTasks: deleted);
  }
}
