import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';

class PkcePair {
  const PkcePair({required this.verifier, required this.challenge});

  final String verifier;
  final String challenge;
}

PkcePair generatePkcePair({int length = 64}) {
  final random = Random.secure();
  final bytes = List<int>.generate(length, (_) => random.nextInt(256));
  final verifier = base64UrlEncode(
    bytes,
  ).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  final digest = sha256.convert(utf8.encode(verifier));
  final challenge = base64UrlEncode(
    digest.bytes,
  ).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return PkcePair(verifier: verifier, challenge: challenge);
}
