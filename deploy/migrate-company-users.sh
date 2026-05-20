#!/usr/bin/env bash
# Applique la migration company_user et provisionne les comptes RH.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ Migration 019 (company_user)…"
docker compose exec -T postgres psql -U ducasse -d ducasse_careers -f - < backend/db/migrations/019_company_user.sql

echo "→ Rebuild API (nouveaux modules)…"
docker compose up -d --build api

echo "→ Création des comptes entreprise (e-mail RH, mot de passe ducasse2026)…"
docker compose exec api node dist/seed-company-users-cli.js

echo "✓ Comptes entreprise prêts. Connexion : /espace-entreprise"
