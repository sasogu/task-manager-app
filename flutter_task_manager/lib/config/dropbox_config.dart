const String dropboxAppKey = String.fromEnvironment(
  'DROPBOX_APP_KEY',
  defaultValue: '',
);

const String dropboxRedirectUri = String.fromEnvironment(
  'DROPBOX_REDIRECT_URI',
  defaultValue: 'flutter-task-manager://auth',
);

const List<String> dropboxScopes = <String>[
  'files.content.read',
  'files.content.write',
  'files.metadata.read',
  'files.metadata.write',
  'account_info.read',
];
