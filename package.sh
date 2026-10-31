#!/usr/bin/env bash
# Compiles the React app and packages it inside the Spring Boot jar (single deployable artifact).
set -euo pipefail
cd "$(dirname "$0")"

(cd web && npm ci && npm run build)

STATIC=backend/src/main/resources/static
rm -rf "$STATIC" && mkdir -p "$STATIC"
cp -R web/dist/. "$STATIC/"

(cd backend && mvn -q -DskipTests package)
echo "Packaged backend/target/tripzee-backend-0.1.0-SNAPSHOT.jar"
echo "Run: java -jar backend/target/tripzee-backend-0.1.0-SNAPSHOT.jar  (then open http://localhost:8085)"
