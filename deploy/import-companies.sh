#!/usr/bin/env bash
# Import COMPANY DATABASE.xlsx via l’image API (serveur sans code source).
#
# Prérequis : stack déjà up (docker compose up -d), fichier Excel dans ./data/
#   cp "/chemin/COMPANY DATABASE.xlsx" ./data/companies.xlsx
#
# Usage :
#   chmod +x import-companies.sh
#   ./import-companies.sh
#   ./import-companies.sh ./data/mon-fichier.xlsx

set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
XLSX="$(cd "$(dirname "${1:-$DIR/data/companies.xlsx}")" && pwd)/$(basename "${1:-$DIR/data/companies.xlsx}")"
COMPOSE="${COMPOSE_FILE:-$DIR/docker-compose.yml}"
if [[ ! -f "$COMPOSE" && -f "$DIR/docker-compose.dist.yml" ]]; then
  COMPOSE="$DIR/docker-compose.dist.yml"
fi

if [[ ! -f "$XLSX" ]]; then
  echo "Fichier introuvable : $XLSX"
  echo "Copiez l’Excel : cp \"COMPANY DATABASE.xlsx\" $DIR/data/companies.xlsx"
  exit 1
fi

echo "→ Import entreprises…"
docker compose -f "$COMPOSE" run --rm \
  -v "$XLSX:/data/companies.xlsx:ro" \
  api node dist/import-companies-cli.js /data/companies.xlsx

echo ""
echo "→ Géocodage (carte, ~1 entreprise/seconde, peut être long)…"
docker compose -f "$COMPOSE" run --rm api node dist/geocode-companies-cli.js

echo "Terminé."
