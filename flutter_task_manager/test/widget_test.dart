// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:flutter_task_manager/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('Renderiza la pantalla principal y abre el modal', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const ProviderScope(child: TaskManagerApp()));
    await tester.pumpAndSettle();

    expect(find.text('Gestor de Tareas'), findsOneWidget);
    expect(find.text('Nueva Tarea'), findsOneWidget);

    await tester.tap(find.text('Nueva Tarea'));
    await tester.pumpAndSettle();

    expect(find.text('Nueva tarea'), findsWidgets);

    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();

    expect(find.text('Nueva tarea'), findsOneWidget);
  });
}
