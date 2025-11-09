# Tasques

Aplicación Flutter para gestionar tareas con sincronización opcional a Dropbox y compatibilidad web/mobile.

## Requisitos

- Flutter 3.35+
- SDK de Android/iOS si quieres compilar para móvil
- Una app de Dropbox (Console > App Console) para obtener el `App key`

## Configuración de Dropbox OAuth

1. En la consola de Dropbox crea una app con los scopes:
   - `files.content.read`
   - `files.content.write`
   - `files.metadata.read`
   - `files.metadata.write`
   - `account_info.read`
2. Configura los redirect URIs en Dropbox:
   - `flutter-task-manager://auth` (por defecto para Android/iOS/macOS)
   - Para Web/desktop añade el dominio donde hospedes la app, por ejemplo `https://localhost:7357/`
3. Al ejecutar Flutter pasa los valores con `--dart-define`:
   ```bash
   flutter run -d chrome \
     --dart-define=DROPBOX_APP_KEY=<TU_APP_KEY> \
     --dart-define=DROPBOX_REDIRECT_URI=flutter-task-manager://auth
   ```
   Para Web usa un redirect HTTPS que coincida con el configurado en Dropbox.

### Android/iOS
Los archivos del proyecto ya incluyen el intent-filter (Android) y `CFBundleURLTypes` (iOS) para el esquema `flutter-task-manager`. Si decides usar otro esquema actualiza:

- `android/app/src/main/AndroidManifest.xml`
- `ios/Runner/Info.plist`

## Recordatorios y notificaciones

- Android usa `awesome_notifications` para programar alarmas locales incluso cuando la app está cerrada. En Android 13+ se solicitará el permiso de notificaciones la primera vez que abras la app.
- En Web se emplea la API de notificaciones del navegador. Debes aceptar el permiso cuando se solicite y mantener abierta la PWA (o instalada como app) para que los recordatorios puedan dispararse; los navegadores no permiten programar alarmas puramente locales si la página está completamente cerrada.
- Cada vez que creas, editas o eliminas un recordatorio, la app vuelve a programar todas las notificaciones para mantenerlas sincronizadas con el estado actual de tus tareas.

## Ejecutar

```bash
cd flutter_task_manager
flutter pub get
flutter run -d web-server --web-port 8000 \
  --dart-define=DROPBOX_APP_KEY=f21fzdjtng58vcg \
  --dart-define=DROPBOX_REDIRECT_URI=http://localhost:8000/
```

## Build Web

```bash
flutter build web \
  --dart-define=DROPBOX_APP_KEY=f21fzdjtng58vcg \
  --dart-define=DROPBOX_REDIRECT_URI=http://localhost:8000/
```

La carpeta `build/web` contiene la PWA lista para desplegar.


## Android Build

Desde flutter_task_manager/ ejecuta 

flutter build apk --release --dart-define=DROPBOX_APP_KEY=… --dart-define=DROPBOX_REDIRECT_URI=flutter-task-manager://auth 

flutter build apk --release --dart-define=DROPBOX_APP_KEY=f21fzdjtng58vcg --dart-define=DROPBOX_REDIRECT_URI=flutter-task-manager://auth 

para generar 

    build/app/outputs/flutter-apk/app-release.apk.

Si necesitas App Bundle para Play Store usa flutter build appbundle --release …; 

obtendrás 

    build/app/outputs/bundle/release/app-release.aab.

Antes de compilar release asegúrate de configurar una keystore (key.properties, build.gradle) y, si planeas habilitar OAuth en producción, registra el mismo esquema flutter-task-manager://auth en la consola de Dropbox.

El `applicationId`/`bundle identifier` oficial de Tasques es `com.sasogu.tasques` (y las pruebas usan `com.sasogu.tasques.RunnerTests`). Usa esos valores cuando configures servicios externos (Firebase, notificaciones push, etc.).

Para pruebas rápidas puedes usar flutter run -d <dispositivo_android> --release --dart-define=… o --profile; 
recuerda activar el modo desarrollador y la depuración USB en tu dispositivo.
