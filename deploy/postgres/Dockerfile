# Postgres avec schéma initial (pas de montage ./backend depuis l'hôte).
FROM postgres:16-alpine
COPY backend/db/schema.sql /docker-entrypoint-initdb.d/01_schema.sql
