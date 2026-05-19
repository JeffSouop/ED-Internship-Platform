#!/usr/bin/env bash
# Import COMPANY DATABASE.xlsx via l’image API (serveur sans code source).
#
# Prérequis : stack déjà up, COMPANY DATABASE.xlsx à la racine du dépôt (ou chemin en argument).
#
# Usage :
#   chmod +x deploy/import-companies.sh
#   ./deploy/import-companies.sh

set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
DEFAULT_XLSX="$ROOT/COMPANY DATABASE.xlsx"
XLSX_INPUT="${1:-$DEFAULT_XLSX}"
XLSX="$(cd "$(dirname "$XLSX_INPUT")" && pwd)/$(basename "$XLSX_INPUT")"
COMPOSE="${COMPOSE_FILE:-$ROOT/docker-compose.yml}"
if [[ ! -f "$COMPOSE" && -f "$ROOT/docker-compose.dist.yml" ]]; then
  COMPOSE="$ROOT/docker-compose.dist.yml"
fi

if [[ ! -f "$XLSX" ]]; then
  echo "Fichier introuvable : $XLSX"
  echo "Placez COMPANY DATABASE.xlsx à la racine : $DEFAULT_XLSX"
  exit 1
fi

echo "→ Import entreprises…"
docker compose -f "$COMPOSE" exec api node dist/import-companies-cli.js "/workspace/COMPANY DATABASE.xlsx"

echo ""
echo "→ Géocodage (carte, ~1 entreprise/seconde, peut être long)…"
docker compose -f "$COMPOSE" run --rm api node dist/geocode-companies-cli.js

echo "Terminé."
