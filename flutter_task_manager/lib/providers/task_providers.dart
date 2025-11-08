import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/task.dart';
import '../models/task_state.dart';
import '../repositories/task_repository.dart';

final tagFilterProvider = StateProvider<String?>((ref) => null);

final taskRepositoryProvider = Provider<TaskRepository>((ref) {
  return TaskRepository();
});

final taskListProvider = StateNotifierProvider<TaskListNotifier, TaskState>((
  ref,
) {
  final repository = ref.watch(taskRepositoryProvider);
  return TaskListNotifier(repository);
});

final activeTasksProvider = Provider<List<Task>>((ref) {
  final state = ref.watch(taskListProvider);
  return state.tasks
      .where((task) => task.category != TaskCategory.archivadas)
      .toList();
});

final archivedTasksProvider = Provider<List<Task>>((ref) {
  final state = ref.watch(taskListProvider);
  final archived = state.tasks
      .where((task) => task.category == TaskCategory.archivadas)
      .toList();
  archived.sort(
    (a, b) =>
        (b.archivedOn ??
                b.lastModified ??
                DateTime.fromMillisecondsSinceEpoch(0))
            .compareTo(
              a.archivedOn ??
                  a.lastModified ??
                  DateTime.fromMillisecondsSinceEpoch(0),
            ),
  );
  return archived;
});

final deletedTasksProvider = Provider<List<Task>>((ref) {
  final state = ref.watch(taskListProvider);
  return state.deletedTasks;
});

final filteredTasksProvider = Provider<List<Task>>((ref) {
  final tasks = ref.watch(activeTasksProvider);
  final filter = ref.watch(tagFilterProvider);
  if (filter == null || filter.isEmpty) {
    return tasks;
  }
  return tasks
      .where(
        (task) => task.tags
            .map((tag) => tag.toLowerCase())
            .contains(filter.toLowerCase()),
      )
      .toList();
});

final availableTagsProvider = Provider<List<String>>((ref) {
  final tasks = ref.watch(activeTasksProvider);
  final tags = tasks.expand((task) => task.tags).toSet().toList();
  tags.sort();
  return tags;
});

class TaskListNotifier extends StateNotifier<TaskState> {
  TaskListNotifier(this._repository) : super(const TaskState()) {
    _loadInitial();
  }

  final TaskRepository _repository;

  Future<void> _loadInitial() async {
    final storedState = await _repository.loadState();
    state = storedState;
  }

  void addTask(Task task) {
    final now = DateTime.now();
    final tasks = [
      ...state.tasks,
      task.copyWith(
        lastModified: now,
        archivedOn: task.category == TaskCategory.archivadas
            ? (task.archivedOn ?? now)
            : null,
      ),
    ];
    state = state.copyWith(tasks: tasks);
    _persist();
  }

  void toggleTask(String id) {
    final now = DateTime.now();
    final tasks = state.tasks.map((task) {
      if (task.id != id) return task;
      if (task.category == TaskCategory.archivadas) {
        return task.copyWith(
          completed: false,
          category: task.previousCategory ?? TaskCategory.bandejaDeEntrada,
          previousCategory: null,
          archivedOn: null,
          reminderDone: task.reminder == null ? task.reminderDone : false,
          lastModified: now,
        );
      }
      return task.copyWith(
        completed: true,
        category: TaskCategory.archivadas,
        previousCategory: task.category,
        archivedOn: now,
        reminderDone: true,
        lastModified: now,
      );
    }).toList();
    state = state.copyWith(tasks: tasks);
    _persist();
  }

  void moveTask(String id, TaskCategory newCategory) {
    final now = DateTime.now();
    final tasks = state.tasks.map((task) {
      if (task.id != id) return task;
      if (newCategory == TaskCategory.archivadas) {
        return task.copyWith(
          completed: true,
          category: TaskCategory.archivadas,
          previousCategory: task.category,
          archivedOn: now,
          reminderDone: true,
          lastModified: now,
        );
      }
      return task.copyWith(
        completed: false,
        category: newCategory,
        previousCategory: null,
        archivedOn: null,
        reminderDone: task.reminder == null ? task.reminderDone : false,
        lastModified: now,
      );
    }).toList();
    state = state.copyWith(tasks: tasks);
    _persist();
  }

  void removeTask(String id) {
    final now = DateTime.now();
    final tasks = <Task>[];
    Task? removed;
    for (final task in state.tasks) {
      if (task.id == id) {
        removed = task.copyWith(deletedOn: now, lastModified: now);
      } else {
        tasks.add(task);
      }
    }
    if (removed != null) {
      state = state.copyWith(
        tasks: tasks,
        deletedTasks: [...state.deletedTasks, removed],
      );
      _persist();
    }
  }

  void unarchiveTask(String id) {
    final now = DateTime.now();
    final tasks = state.tasks.map((task) {
      if (task.id != id) return task;
      return task.copyWith(
        completed: false,
        category: task.previousCategory ?? TaskCategory.bandejaDeEntrada,
        previousCategory: null,
        archivedOn: null,
        lastModified: now,
      );
    }).toList();
    state = state.copyWith(tasks: tasks);
    _persist();
  }

  void deleteTaskPermanently(String id) {
    final now = DateTime.now();
    final tasks = <Task>[];
    Task? removed;
    for (final task in state.tasks) {
      if (task.id == id) {
        removed = task.copyWith(deletedOn: now, lastModified: now);
      } else {
        tasks.add(task);
      }
    }
    if (removed != null) {
      state = state.copyWith(
        tasks: tasks,
        deletedTasks: [...state.deletedTasks, removed],
      );
      _persist();
    }
  }

  void clearDeletedHistory() {
    state = state.copyWith(deletedTasks: const []);
    _persist();
  }

  void updateTask(String id, Task Function(Task task) transform) {
    final now = DateTime.now();
    final tasks = state.tasks.map((task) {
      if (task.id != id) return task;
      return transform(task).copyWith(lastModified: now);
    }).toList();
    state = state.copyWith(tasks: tasks);
    _persist();
  }

  void clearReminder(String id) {
    final now = DateTime.now();
    final tasks = state.tasks.map((task) {
      if (task.id != id) return task;
      return task.copyWith(
        reminder: null,
        reminderDone: true,
        lastModified: now,
      );
    }).toList();
    state = state.copyWith(tasks: tasks);
    _persist();
  }

  void replaceAll(TaskState newState) {
    state = newState;
    _persist();
  }

  void _persist() {
    unawaited(_repository.saveState(state));
  }
}
