import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/task.dart';
import '../providers/task_providers.dart';

class ArchivePage extends ConsumerWidget {
  const ArchivePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final archivedTasks = ref.watch(archivedTasksProvider);
    final notifier = ref.read(taskListProvider.notifier);

    return Scaffold(
      appBar: AppBar(title: const Text('Archivo')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: archivedTasks.isEmpty
            ? const Center(
                child: Text(
                  'No hay tareas archivadas todavía.',
                  textAlign: TextAlign.center,
                ),
              )
            : ListView.separated(
                itemBuilder: (context, index) {
                  final task = archivedTasks[index];
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  task.title,
                                  style: Theme.of(context).textTheme.titleMedium
                                      ?.copyWith(
                                        decoration: TextDecoration.lineThrough,
                                      ),
                                ),
                              ),
                              IconButton(
                                tooltip: 'Desarchivar',
                                icon: const Icon(Icons.unarchive_outlined),
                                onPressed: () =>
                                    notifier.unarchiveTask(task.id),
                              ),
                              IconButton(
                                tooltip: 'Eliminar permanentemente',
                                color: Theme.of(context).colorScheme.error,
                                icon: const Icon(Icons.delete_outline),
                                onPressed: () async {
                                  final confirmed = await _confirmDeletion(
                                    context,
                                  );
                                  if (confirmed) {
                                    notifier.deleteTaskPermanently(task.id);
                                  }
                                },
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
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
                          const SizedBox(height: 8),
                          Text(
                            'Archivada: ${_formatArchivedDate(context, task)}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  );
                },
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemCount: archivedTasks.length,
              ),
      ),
    );
  }

  String _formatArchivedDate(BuildContext context, Task task) {
    final reference = task.archivedOn ?? task.lastModified;
    if (reference == null) return 'Sin fecha registrada';
    final date = MaterialLocalizations.of(
      context,
    ).formatMediumDate(reference.toLocal());
    final time = MaterialLocalizations.of(
      context,
    ).formatTimeOfDay(TimeOfDay.fromDateTime(reference.toLocal()));
    return '$date · $time';
  }
}

Future<bool> _confirmDeletion(BuildContext context) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Eliminar tarea'),
      content: const Text(
        '¿Quieres eliminar esta tarea de forma permanente? Esta acción no se puede deshacer.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancelar'),
        ),
        ElevatedButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('Eliminar'),
        ),
      ],
    ),
  );
  return result ?? false;
}
