import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
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

class TaskManagerApp extends ConsumerWidget {
  const TaskManagerApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    return MaterialApp(
      title: 'Tasques',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF35424A)),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF8BC34A),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      themeMode: themeMode,
      locale: const Locale('ca', 'ES'),
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('ca', 'ES'),
        Locale('es', 'ES'),
        Locale('en', 'US'),
      ],
      routes: {
        '/': (context) => const TaskManagerPage(),
        '/recordatorios': (context) => const RecordatoriosPage(),
        '/archivo': (context) => const ArchivePage(),
      },
      initialRoute: '/',
    );
  }
}
