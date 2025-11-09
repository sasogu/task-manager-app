import 'package:uuid/uuid.dart';

enum TaskCategory {
  bandejaDeEntrada('Safata d\'entrada'),
  prioritaria('Prioritària'),
  proximas('Pròximes'),
  algunDia('Algun dia'),
  archivadas('Arxivades');

  const TaskCategory(this.label);
  final String label;

  static TaskCategory fromValue(String value) {
    return TaskCategory.values.firstWhere(
      (category) => category.name == value,
      orElse: () => TaskCategory.bandejaDeEntrada,
    );
  }
}

class Task {
  Task({
    String? id,
    required this.title,
    required this.category,
    this.tags = const [],
    this.description = '',
    this.reminder,
    this.completed = false,
    this.previousCategory,
    this.reminderDone = false,
    this.archivedOn,
    this.lastModified,
    this.deletedOn,
  }) : id = id ?? const Uuid().v4();

  final String id;
  final String title;
  final TaskCategory category;
  final List<String> tags;
  final String description;
  final DateTime? reminder;
  final bool completed;
  final TaskCategory? previousCategory;
  final bool reminderDone;
  final DateTime? archivedOn;
  final DateTime? lastModified;
  final DateTime? deletedOn;

  static const _undefined = Object();

  Task copyWith({
    String? title,
    TaskCategory? category,
    List<String>? tags,
    String? description,
    Object? reminder = _undefined,
    bool? completed,
    Object? previousCategory = _undefined,
    bool? reminderDone,
    Object? archivedOn = _undefined,
    DateTime? lastModified,
    Object? deletedOn = _undefined,
  }) {
    return Task(
      id: id,
      title: title ?? this.title,
      category: category ?? this.category,
      tags: tags ?? this.tags,
      description: description ?? this.description,
      reminder: identical(reminder, _undefined)
          ? this.reminder
          : reminder as DateTime?,
      completed: completed ?? this.completed,
      previousCategory: identical(previousCategory, _undefined)
          ? this.previousCategory
          : previousCategory as TaskCategory?,
      reminderDone: reminderDone ?? this.reminderDone,
      archivedOn: identical(archivedOn, _undefined)
          ? this.archivedOn
          : archivedOn as DateTime?,
      lastModified: lastModified ?? this.lastModified,
      deletedOn: identical(deletedOn, _undefined)
          ? this.deletedOn
          : deletedOn as DateTime?,
    );
  }

  factory Task.fromJson(Map<String, dynamic> json) {
    final categoryValue = json['category'] as String?;
    return Task(
      id: json['id'] as String?,
      title: json['title'] as String? ?? '',
      category: TaskCategory.values.firstWhere(
        (category) => category.name == categoryValue,
        orElse: () => TaskCategory.bandejaDeEntrada,
      ),
      tags: (json['tags'] as List<dynamic>? ?? [])
          .map((tag) => tag.toString())
          .toList(),
      description: json['description'] as String? ?? '',
      reminder: json['reminder'] != null
          ? DateTime.tryParse(json['reminder'])
          : null,
      completed: json['completed'] as bool? ?? false,
      previousCategory: _TaskCategoryParsing.fromNullableValue(
        json['previousCategory'] as String?,
      ),
      reminderDone: json['reminderDone'] as bool? ?? false,
      archivedOn: json['archivedOn'] != null
          ? DateTime.tryParse(json['archivedOn'])
          : null,
      lastModified: json['lastModified'] != null
          ? DateTime.tryParse(json['lastModified'])
          : null,
      deletedOn: json['deletedOn'] != null
          ? DateTime.tryParse(json['deletedOn'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'category': category.name,
      'tags': tags,
      'description': description,
      'reminder': reminder?.toIso8601String(),
      'completed': completed,
      'previousCategory': previousCategory?.name,
      'reminderDone': reminderDone,
      'archivedOn': archivedOn?.toIso8601String(),
      'lastModified': lastModified?.toIso8601String(),
      'deletedOn': deletedOn?.toIso8601String(),
    };
  }
}

extension _TaskCategoryParsing on TaskCategory {
  static TaskCategory? fromNullableValue(String? value) {
    if (value == null) return null;
    for (final category in TaskCategory.values) {
      if (category.name == value) {
        return category;
      }
    }
    return null;
  }
}
