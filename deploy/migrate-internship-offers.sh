#!/usr/bin/env bash
# Table internship_offer + rebuild API
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ Migration 020 (internship_offer)…"
docker compose exec -T postgres psql -U ducasse -d ducasse_careers -f - < backend/db/migrations/020_internship_offer.sql

echo "→ Rebuild API + UI…"
docker compose up -d --build api ui

echo "✓ Offres de stage : /job-board (public) · /espace-entreprise (publication)"
