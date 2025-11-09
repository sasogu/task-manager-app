import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/dropbox_config.dart';
import '../models/task.dart';
import '../providers/dropbox_providers.dart';
import '../providers/task_providers.dart';

class TaskManagerPage extends ConsumerWidget {
  const TaskManagerPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasks = ref.watch(filteredTasksProvider);
    final tags = ref.watch(availableTagsProvider);
    final filterTag = ref.watch(tagFilterProvider);

    final visibleCategories = TaskCategory.values
        .where((category) => category != TaskCategory.archivadas)
        .toList();
    final groupedTasks = <TaskCategory, List<Task>>{
      for (final category in visibleCategories) category: [],
    };
    for (final task in tasks) {
      groupedTasks[task.category]?.add(task);
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tasques'),
        actions: [
          IconButton(
            tooltip: 'Tema clar',
            icon: const Icon(Icons.light_mode_outlined),
            onPressed: () =>
                ref.read(themeModeProvider.notifier).state = ThemeMode.light,
          ),
          IconButton(
            tooltip: 'Tema fosc',
            icon: const Icon(Icons.dark_mode_outlined),
            onPressed: () =>
                ref.read(themeModeProvider.notifier).state = ThemeMode.dark,
          ),
          IconButton(
            tooltip: 'Tema del sistema',
            icon: const Icon(Icons.brightness_auto_outlined),
            onPressed: () =>
                ref.read(themeModeProvider.notifier).state = ThemeMode.system,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddTaskDialog(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Tasca nova'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _ActionsHeader(),
            const SizedBox(height: 16),
            _DropboxPanel(),
            const SizedBox(height: 16),
            InputDecorator(
              decoration: const InputDecoration(
                labelText: 'Filtra per etiqueta',
                border: OutlineInputBorder(),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String?>(
                  value: filterTag,
                  isExpanded: true,
                  hint: const Text('-- Totes les etiquetes --'),
                  items: [
                    const DropdownMenuItem<String?>(
                      value: null,
                      child: Text('-- Totes les etiquetes --'),
                    ),
                    ...tags.map(
                      (tag) => DropdownMenuItem<String?>(
                        value: tag,
                        child: Text(tag),
                      ),
                    ),
                  ],
                  onChanged: (value) =>
                      ref.read(tagFilterProvider.notifier).state = value,
                ),
              ),
            ),
            const SizedBox(height: 16),
            for (final entry in groupedTasks.entries)
              if (entry.value.isNotEmpty)
                _CategorySection(
                  category: entry.key,
                  tasks: entry.value,
                  onToggle: (id) =>
                      ref.read(taskListProvider.notifier).toggleTask(id),
                  onDelete: (id) =>
                      ref.read(taskListProvider.notifier).removeTask(id),
                  onEdit: (task) => _showEditTaskDialog(context, ref, task),
                  onMove: (id, category) => ref
                      .read(taskListProvider.notifier)
                      .moveTask(id, category),
                  onClearReminder: (id) =>
                      ref.read(taskListProvider.notifier).clearReminder(id),
                )
              else
                const SizedBox.shrink(),
            if (tasks.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Center(
                  child: Text(
                    'Aún no hay tareas.\nCrea la primera con el botón "Nueva tarea".',
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _showAddTaskDialog(BuildContext context, WidgetRef ref) async {
    final result = await showDialog<_TaskFormResult>(
      context: context,
      builder: (context) => const _TaskDialog(),
    );
    if (result != null) {
      ref
          .read(taskListProvider.notifier)
          .addTask(
            Task(
              title: result.title,
              category: result.category,
              tags: result.tags,
              description: result.description,
              reminder: result.reminder,
            ),
          );
    }
  }

  Future<void> _showEditTaskDialog(
    BuildContext context,
    WidgetRef ref,
    Task task,
  ) async {
    final result = await showDialog<_TaskFormResult>(
      context: context,
      builder: (context) => _TaskDialog(initialTask: task),
    );
    if (result == null) return;

    final notifier = ref.read(taskListProvider.notifier);
    notifier.updateTask(
      task.id,
      (current) => current.copyWith(
        title: result.title,
        tags: result.tags,
        description: result.description,
        reminder: result.reminder,
        reminderDone: false,
      ),
    );
    if (result.category != task.category) {
      notifier.moveTask(task.id, result.category);
    }
  }
}

class _ActionsHeader extends StatelessWidget {
  const _ActionsHeader();

  @override
  Widget build(BuildContext context) {
    return Wrap(
      alignment: WrapAlignment.spaceBetween,
      runSpacing: 8,
      spacing: 8,
      children: [
        OutlinedButton.icon(
          onPressed: () => Navigator.pushNamed(context, '/recordatorios'),
          icon: const Icon(Icons.access_time),
          label: const Text('Ver Recordatorios'),
        ),
        OutlinedButton.icon(
          onPressed: () => Navigator.pushNamed(context, '/archivo'),
          icon: const Icon(Icons.archive_outlined),
          label: const Text('Ver Archivo'),
        ),
      ],
    );
  }
}

class _DropboxPanel extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dropboxState = ref.watch(dropboxControllerProvider);
    final dropboxController = ref.read(dropboxControllerProvider.notifier);
    final isConfigured =
        dropboxAppKey.isNotEmpty && dropboxRedirectUri.isNotEmpty;
    final canSync = dropboxState.isConnected && !dropboxState.isSyncing;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Sincronización',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                ElevatedButton(
                  onPressed: !isConfigured
                      ? null
                      : dropboxState.isConnecting
                      ? null
                      : dropboxState.isConnected
                      ? () => dropboxController.disconnect()
                      : () => dropboxController.connect(),
                  child: dropboxState.isConnecting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(
                          dropboxState.isConnected
                              ? 'Desconectar'
                              : 'Conectar con Dropbox',
                        ),
                ),
                OutlinedButton(
                  onPressed: canSync ? () => dropboxController.sync() : null,
                  child: dropboxState.isSyncing
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Sincronizar'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (!isConfigured)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  'Define DROPBOX_APP_KEY y DROPBOX_REDIRECT_URI usando --dart-define '
                  'para habilitar la conexión OAuth.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.error,
                  ),
                ),
              ),
            if (dropboxState.lastSync != null)
              Builder(
                builder: (context) {
                  final local = dropboxState.lastSync!.toLocal();
                  final date = MaterialLocalizations.of(
                    context,
                  ).formatMediumDate(local);
                  final time = MaterialLocalizations.of(
                    context,
                  ).formatTimeOfDay(TimeOfDay.fromDateTime(local));
                  return Text(
                    'Última sincronización: $date · $time',
                    style: Theme.of(context).textTheme.bodySmall,
                  );
                },
              ),
            if (dropboxState.errorMessage != null)
              Text(
                dropboxState.errorMessage!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.error,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _CategorySection extends StatelessWidget {
  const _CategorySection({
    required this.category,
    required this.tasks,
    required this.onToggle,
    required this.onDelete,
    required this.onEdit,
    required this.onMove,
    required this.onClearReminder,
  });

  final TaskCategory category;
  final List<Task> tasks;
  final ValueChanged<String> onToggle;
  final ValueChanged<String> onDelete;
  final ValueChanged<Task> onEdit;
  final void Function(String id, TaskCategory category) onMove;
  final ValueChanged<String> onClearReminder;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              category.label,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            for (final task in tasks)
              _TaskTile(
                key: ValueKey(task.id),
                task: task,
                onToggle: () => onToggle(task.id),
                onDelete: () => onDelete(task.id),
                onEdit: () => onEdit(task),
                onMove: (category) => onMove(task.id, category),
                onClearReminder: task.reminder != null
                    ? () => onClearReminder(task.id)
                    : null,
              ),
          ],
        ),
      ),
    );
  }
}

class _TaskTile extends StatelessWidget {
  const _TaskTile({
    super.key,
    required this.task,
    required this.onToggle,
    required this.onDelete,
    required this.onEdit,
    required this.onMove,
    this.onClearReminder,
  });

  final Task task;
  final VoidCallback onToggle;
  final VoidCallback onDelete;
  final VoidCallback onEdit;
  final ValueChanged<TaskCategory> onMove;
  final VoidCallback? onClearReminder;

  @override
  Widget build(BuildContext context) {
    final reminder = task.reminder;
    final reminderText = reminder != null
        ? _formatReminder(context, reminder.toLocal())
        : null;
    final description = task.description.trim();
    final moveTargets = TaskCategory.values
        .where((category) => category != task.category)
        .toList();

    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Checkbox(value: task.completed, onChanged: (_) => onToggle()),
      title: Text(
        task.title,
        style: TextStyle(
          decoration: task.completed ? TextDecoration.lineThrough : null,
        ),
      ),
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
          if (description.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8.0),
              child: MarkdownBody(
                data: description,
                styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context))
                    .copyWith(textScaleFactor: 0.95),
              ),
            ),
          if (reminderText != null)
            Row(
              children: [
                Icon(
                  task.reminderDone ? Icons.alarm_on : Icons.alarm,
                  size: 16,
                  color: task.reminderDone
                      ? Theme.of(context).colorScheme.primary
                      : null,
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    'Recordatorio: $reminderText',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
            ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 4,
            runSpacing: 4,
            children: [
              if (reminder != null)
                IconButton.filledTonal(
                  tooltip: task.reminderDone
                      ? 'Recordatorio completado'
                      : 'Marcar recordatorio como completado',
                  icon: Icon(
                    task.reminderDone
                        ? Icons.check_circle
                        : Icons.alarm_add_outlined,
                  ),
                  onPressed: task.reminderDone ? null : onClearReminder,
                  style: IconButton.styleFrom(
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
              IconButton.filledTonal(
                icon: const Icon(Icons.edit_outlined),
                tooltip: 'Editar tarea',
                onPressed: onEdit,
                style: IconButton.styleFrom(
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
              PopupMenuButton<TaskCategory>(
                tooltip: 'Mover tarea',
                icon: const Icon(Icons.drive_file_move_outlined),
                onSelected: onMove,
                itemBuilder: (context) => [
                  for (final category in moveTargets)
                    PopupMenuItem(
                      value: category,
                      child: Text(category.label),
                    ),
                ],
              ),
              IconButton.filledTonal(
                icon: const Icon(Icons.delete_outline),
                tooltip: 'Eliminar tarea',
                onPressed: onDelete,
                style: IconButton.styleFrom(
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  foregroundColor: Theme.of(context).colorScheme.error,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatReminder(BuildContext context, DateTime reminder) {
    final date = MaterialLocalizations.of(context).formatMediumDate(reminder);
    final time = MaterialLocalizations.of(
      context,
    ).formatTimeOfDay(TimeOfDay.fromDateTime(reminder));
    return '$date · $time';
  }
}

class _TaskDialog extends StatefulWidget {
  const _TaskDialog({this.initialTask});

  final Task? initialTask;

  @override
  State<_TaskDialog> createState() => _TaskDialogState();
}

class _TaskDialogState extends State<_TaskDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _titleController;
  late final TextEditingController _tagsController;
  late final TextEditingController _descriptionController;
  late TaskCategory _category;
  DateTime? _reminder;

  bool get _isEditing => widget.initialTask != null;

  @override
  void initState() {
    super.initState();
    final task = widget.initialTask;
    _titleController = TextEditingController(text: task?.title ?? '');
    _tagsController = TextEditingController(
      text: (task?.tags ?? const []).join(', '),
    );
    _descriptionController =
        TextEditingController(text: task?.description ?? '');
    _category = task?.category ?? TaskCategory.bandejaDeEntrada;
    _reminder = task?.reminder;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _tagsController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(_isEditing ? 'Editar tarea' : 'Nueva tarea'),
      content: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _titleController,
                decoration: const InputDecoration(
                  labelText: 'Nombre de la tarea',
                ),
                validator: (value) =>
                    value == null || value.isEmpty ? 'Ingresa un nombre' : null,
              ),
              const SizedBox(height: 12),
              InputDecorator(
                decoration: const InputDecoration(labelText: 'Categoría'),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<TaskCategory>(
                    value: _category,
                    isExpanded: true,
                    items: [
                      for (final category in TaskCategory.values)
                        DropdownMenuItem(
                          value: category,
                          child: Text(category.label),
                        ),
                    ],
                    onChanged: (value) {
                      if (value != null) {
                        setState(() => _category = value);
                      }
                    },
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _tagsController,
                decoration: const InputDecoration(
                  labelText: 'Etiquetas (separadas por comas)',
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _descriptionController,
                decoration: const InputDecoration(
                  labelText: 'Descripción (Markdown)',
                  alignLabelWithHint: true,
                ),
                keyboardType: TextInputType.multiline,
                maxLines: 6,
                minLines: 3,
              ),
              const SizedBox(height: 8),
              ValueListenableBuilder<TextEditingValue>(
                valueListenable: _descriptionController,
                builder: (context, value, _) {
                  final text = value.text.trim();
                  if (text.isEmpty) return const SizedBox.shrink();
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Vista previa',
                        style: Theme.of(context).textTheme.labelMedium,
                      ),
                      const SizedBox(height: 4),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: Theme.of(context).dividerColor,
                          ),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: MarkdownBody(data: text),
                      ),
                    ],
                  );
                },
              ),
              const SizedBox(height: 12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(
                  _reminder != null
                      ? 'Recordatorio: ${MaterialLocalizations.of(context).formatFullDate(_reminder!)}'
                      : 'Sin recordatorio',
                ),
                trailing: IconButton(
                  icon: const Icon(Icons.calendar_month),
                  onPressed: () async {
                    final date = await showDatePicker(
                      context: context,
                      initialDate: DateTime.now(),
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (!context.mounted || date == null) return;
                    final time = await showTimePicker(
                      context: context,
                      initialTime: TimeOfDay.now(),
                    );
                    if (!context.mounted) return;
                    setState(() {
                      _reminder = DateTime(
                        date.year,
                        date.month,
                        date.day,
                        time?.hour ?? 0,
                        time?.minute ?? 0,
                      );
                    });
                  },
                ),
              ),
              if (_reminder != null)
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => setState(() => _reminder = null),
                    child: const Text('Quitar recordatorio'),
                  ),
                ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        ElevatedButton(
          onPressed: () {
            if (!_formKey.currentState!.validate()) return;
            Navigator.of(context).pop(
              _TaskFormResult(
                title: _titleController.text.trim(),
                category: _category,
                tags: _parseTags(_tagsController.text),
                reminder: _reminder,
                description: _descriptionController.text.trim(),
              ),
            );
          },
          child: Text(_isEditing ? 'Guardar' : 'Añadir'),
        ),
      ],
    );
  }

  List<String> _parseTags(String input) {
    return input
        .split(',')
        .map((tag) => tag.trim())
        .where((tag) => tag.isNotEmpty)
        .toList();
  }
}

class _TaskFormResult {
  const _TaskFormResult({
    required this.title,
    required this.category,
    required this.tags,
    required this.reminder,
    required this.description,
  });

  final String title;
  final TaskCategory category;
  final List<String> tags;
  final DateTime? reminder;
  final String description;
}
