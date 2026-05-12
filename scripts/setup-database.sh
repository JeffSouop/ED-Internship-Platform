#!/usr/bin/env bash
# Construit la base PostgreSQL (Docker) et injecte le jeu de données de démo.
# Prérequis : Docker.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ Démarrage PostgreSQL (docker compose)..."
docker compose up -d

echo "→ Attente du service..."
until docker exec ed-internship-postgres pg_isready -U ducasse -d ducasse_careers >/dev/null 2>&1; do
  sleep 1
done

echo "→ Injection seed_demo.sql (idempotent sur une base déjà initialisée)..."
docker exec -i ed-internship-postgres psql -U ducasse -d ducasse_careers -v ON_ERROR_STOP=1 < "$ROOT/backend/db/seed_demo.sql"

echo "Terminé. Connexion : postgresql://ducasse:ducasse_local_dev@localhost:5433/ducasse_careers"
