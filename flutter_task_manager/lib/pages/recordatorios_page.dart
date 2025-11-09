import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/task.dart';
import '../providers/task_providers.dart';

class RecordatoriosPage extends ConsumerWidget {
  const RecordatoriosPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasks = ref.watch(taskListProvider).tasks;
    final reminderTasks = tasks
        .where(
          (task) =>
              task.reminder != null &&
              task.category != TaskCategory.archivadas &&
              !task.completed,
        )
        .toList();

    final now = DateTime.now();
    final overdue =
        reminderTasks.where((task) => task.reminder!.isBefore(now)).toList()
          ..sort((a, b) => a.reminder!.compareTo(b.reminder!));
    final upcoming =
        reminderTasks.where((task) => !task.reminder!.isBefore(now)).toList()
          ..sort((a, b) => a.reminder!.compareTo(b.reminder!));

    return Scaffold(
      appBar: AppBar(title: const Text('Recordatoris')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: reminderTasks.isEmpty
            ? const Center(
                child: Text(
                  'No hi ha tasques amb recordatoris pendents.',
                  textAlign: TextAlign.center,
                ),
              )
            : ListView(
                children: [
                  if (overdue.isNotEmpty)
                    _ReminderSection(
                      title: 'Vençuts',
                      tasks: overdue,
                      accentColor: Theme.of(context).colorScheme.error,
                    ),
                  if (upcoming.isNotEmpty)
                    _ReminderSection(
                      title: 'Propers',
                      tasks: upcoming,
                      accentColor: Theme.of(context).colorScheme.primary,
                    ),
                ],
              ),
      ),
    );
  }
}

class _ReminderSection extends ConsumerWidget {
  const _ReminderSection({
    required this.title,
    required this.tasks,
    required this.accentColor,
  });

  final String title;
  final List<Task> tasks;
  final Color accentColor;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(taskListProvider.notifier);
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(color: accentColor),
            ),
            const SizedBox(height: 12),
            for (final task in tasks)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Checkbox(
                  value: false,
                  onChanged: (_) => notifier.toggleTask(task.id),
                ),
                title: Text(task.title),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (task.tags.isNotEmpty)
                      Wrap(
                        spacing: 4,
                        runSpacing: 4,
                        children: task.tags
                            .map(
                              (tag) => Chip(
                                label: Text('#$tag'),
                                visualDensity: VisualDensity.compact,
                              ),
                            )
                            .toList(),
                      ),
                    Text(
                      '⏰ ${_formatReminder(context, task)} · ${task.category.label}',
                    ),
                  ],
                ),
                trailing: IconButton(
                  tooltip: 'Marca com a completada i arxiva-la',
                  icon: const Icon(Icons.check_circle_outline),
                  onPressed: () => notifier.toggleTask(task.id),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _formatReminder(BuildContext context, Task task) {
    final reminder = task.reminder;
    if (reminder == null) return '';
    final date = MaterialLocalizations.of(
      context,
    ).formatMediumDate(reminder.toLocal());
    final time = MaterialLocalizations.of(
      context,
    ).formatTimeOfDay(TimeOfDay.fromDateTime(reminder.toLocal()));
    return '$date · $time';
  }
}
