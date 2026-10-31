#!/usr/bin/env bash
# Starts the Tripzee backend in dev mode on http://localhost:8085.
# Behind a TLS-inspecting corporate proxy on macOS, run with TRUST_MACOS_KEYCHAIN=1 so the JVM
# trusts the proxy's root CA from the macOS keychain (otherwise outbound HTTPS calls fail with PKIX errors).
set -euo pipefail
cd "$(dirname "$0")"
JVM_ARGS=""
if [[ "${TRUST_MACOS_KEYCHAIN:-0}" == "1" ]]; then
  JVM_ARGS="-Djavax.net.ssl.trustStoreType=KeychainStore -Djavax.net.ssl.trustStore=NONE"
fi
exec mvn -q spring-boot:run -Dspring-boot.run.jvmArguments="$JVM_ARGS"
