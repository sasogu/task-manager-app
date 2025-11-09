import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'pages/archive_page.dart';
import 'pages/recordatorios_page.dart';
import 'pages/task_manager_page.dart';
import 'providers/task_providers.dart';
import 'services/reminder_scheduler.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final reminderScheduler = createReminderScheduler();
  await reminderScheduler.initialize();
  runApp(
    ProviderScope(
      overrides: [
        reminderSchedulerProvider.overrideWithValue(reminderScheduler),
      ],
      child: const TaskManagerApp(),
    ),
  );
}

class TaskManagerApp extends StatelessWidget {
  const TaskManagerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Tasques',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF35424A)),
        useMaterial3: true,
      ),
      routes: {
        '/': (context) => const TaskManagerPage(),
        '/recordatorios': (context) => const RecordatoriosPage(),
        '/archivo': (context) => const ArchivePage(),
      },
      initialRoute: '/',
    );
  }
}
