# Plateforme Stages & Carrières — École Ducasse

Document de handoff pour une autre IA / un autre développeur.

---

## 1. Contexte métier

**Organisation :** École Ducasse (écoles de cuisine et pâtisserie haut de gamme — campus Paris & Yssingeaux).

**Service concerné :** Département Stages & Carrières.

**Utilisateur final :** équipe carrière interne + étudiants + entreprises partenaires.

**Profil du commanditaire :** Audrey, ingénieure data au sein du service. Elle développe le backend en local elle-même (Python/Node — non décidé) ; le livrable initial côté interface et schéma de données est pensé séparément du backend.

---

## 2. Cycle métier

L'école a **2 rentrées par an** :

- **Février** (intake `FEB-YYYY`)
- **Septembre** (intake `SEP-YYYY`)

Pour chaque rentrée, chaque étudiant doit faire un stage. Deux flux d'information convergent :

```
        ÉTUDIANT                          ENTREPRISE
            │                                  │
            ▼                                  ▼
   remplit son formulaire           remplit le formulaire
   (coordonnées + stage)            "stagiaires que j'accueille"
            │                                  │
            ▼                                  ▼
   équipe carrière valide                     │
   (workflow approuvé /                       │
    modifications demandées /                 │
    rejeté)                                   │
            │                                  │
            └──────────► JOINTURE ◄────────────┘
                  via student_id + intake
                          │
                          ▼
              merged_internship (table consolidée)
                          │
                          ▼
              équipe carrière administre & exporte
```

---

## 3. Acteurs & espaces

| Acteur | Espace | Authentification | Visibilité |
|--------|--------|------------------|------------|
| Étudiant | `/student/:token` | Magic link (token unique par formulaire, pas de compte) | Uniquement son propre formulaire |
| Entreprise | `/company/:token` | Magic link | Uniquement son propre formulaire de déclaration |
| Équipe carrière | `/admin/*` | Mot de passe simple (mock : `ducasse2026`) — à remplacer par JWT côté back | Tout : étudiants, entreprises, validations, données fusionnées |

---

## 4. Workflow de validation (étudiant)

```
        soumis
          │
          ▼
       pending  ──────► approved ──┐
          │                        │
          ▼                        ├─► déclenche tentative de merge
   changes_requested               │   (si déclaration entreprise existe pour
          │                        │    le même student_id + intake)
   (étudiant corrige)              │
          │                        ▼
          └────► pending ──► merged_internship
          │
          ▼
       rejected
```

L'admin peut commenter (`reviewerComment`) lors d'une demande de modification.

---

## 5. Logique de jointure (cœur du système)

La table **`merged_internship`** est la sortie consolidée. Elle est alimentée automatiquement par un trigger PostgreSQL **`try_merge_internship()`** qui se déclenche à chaque `INSERT`/`UPDATE` sur :

- `student_submission` (passage à `approved`)
- `declared_intern` (entreprise déclare un étudiant)

**Clé de jointure :** `student_id` (`TEXT`, identifiant École Ducasse stable) + `intake` (saison + année).

**3 statuts possibles dans `merged_internship` :**

| Statut | Signification |
|--------|-----------------|
| `matched` | Étudiant approuvé **et** déclaré par son entreprise |
| `student_only` | Étudiant approuvé mais pas encore déclaré par l'entreprise |
| `company_only` | Entreprise a déclaré l'étudiant mais sa soumission n'est pas (encore) approuvée |

Cela permet à l'équipe carrière d'identifier les incohérences rapidement.

---

## 6. Ce qui a été construit (front + DB)

### 6.1 Front-end (livré)

**Stack :** TanStack Start v1 (React 19 + Vite 7), Tailwind v4, shadcn/ui, TanStack Query, TanStack Router (file-based routing), TypeScript strict.

**Routes :**

- `/` — landing simple (3 entrées)
- `/student/:token` — formulaire étudiant
- `/company/:token` — formulaire entreprise (déclaration multi-stagiaires)
- `/admin` — login admin (mock)
- `/admin/` — dashboard KPIs
- `/admin/students` — liste étudiants
- `/admin/companies` — liste entreprises
- `/admin/companies/:id` — fiche entreprise
- `/admin/validations` — file d'attente des soumissions à valider
- `/admin/validations/:id` — détail soumission + actions (approuver / demander modif / rejeter)
- `/admin/merged` — vue consolidée (`matched` / `student_only` / `company_only`)
- `/admin/links` — génération de magic links

**Couche services (`src/services/`) :** 100 % mock, données en `localStorage` via `src/mock/store.ts`.

- `students.ts`, `companies.ts`, `declarations.ts`, `merged.ts`, `tokens.ts`, `admin-auth.ts`

**Signatures stables :** à remplacer par des appels HTTP, **sans toucher aux composants UI**.

**Types partagés :** `src/lib/types.ts` (`Student`, `StudentSubmission`, `Company`, `CompanyDeclaration`, `DeclaredIntern`, `MergedInternship`, `LinkToken`).

**Données de démo :** `src/mock/seed.ts` — 5 étudiants, 3 entreprises, 2 soumissions, 1 déclaration, 4 tokens magic link.

### 6.2 Schéma PostgreSQL (livré : `ducasse_careers_schema.sql`)

**Tables :**

- `staff_user` (équipe carrière, rôles : `admin` / `reviewer` / `viewer`)
- `campus`, `programme`, `promotion` (référentiels)
- `student` (`student_id` `TEXT` pivot + `id` UUID technique)
- `student_submission` (formulaire + workflow `pending` | `changes_requested` | `approved` | `rejected`)
- `submission_review_history` (audit des décisions)
- `company` (recherche fuzzy via extension `pg_trgm`)
- `company_declaration` (1 par entreprise et par intake)
- `declared_intern` (les stagiaires listés par l'entreprise)
- `merged_internship` (table consolidée — alimentée par trigger)
- `access_token` (magic links, `kind` = `student` | `company`)

**Enums :** `intake_season` (`FEB` | `SEP`), `submission_status`, `token_kind`, `staff_role`.

**Automatismes :**

- Trigger `try_merge_internship()` → maintient `merged_internship` à jour en temps réel
- Triggers `updated_at` sur 5 tables

**Vues utilitaires :** `v_student_full`, `v_submission_dashboard`, `v_merged_overview`

**Index :** `student_id`, `intake`, `status`, trigram sur `company.name`

**Seed :** campus (`PARIS`, `YSSI`), programmes (`BACH-CUL`, `BACH-PAS`, `MBA-CUL`), promotions (`FEB/2026`, `SEP/2026`).

---

## 7. Ce qui reste à faire (backend)

### 7.1 API REST/GraphQL à construire en local

L'autre IA doit produire une API qui expose ces endpoints, mappés sur les services front existants :

| Service front | Endpoints attendus |
|---------------|-------------------|
| `tokens.ts` → `resolveToken(token)` | `GET /api/tokens/:token` → renvoie `{ kind, refId, label }` |
| `students.ts` → `getSubmissionByStudentId`, `upsertSubmission`, `listSubmissions`, `decideSubmission` | `GET`/`POST /api/submissions`, `GET /api/submissions/:id`, `POST /api/submissions/:id/decision` |
| `companies.ts` → `listCompanies`, `getCompany`, `searchCompanies`, `upsertCompany` | `GET`/`POST /api/companies`, `GET /api/companies/:id`, `GET /api/companies/search?q=` |
| `declarations.ts` → `upsertDeclaration`, `listDeclarations` | `GET`/`POST /api/declarations` |
| `merged.ts` → `listMerged` | `GET /api/merged` (lit la table `merged_internship` ou la vue `v_merged_overview`) |
| `admin-auth.ts` → `login`, `logout`, `isAuthed` | `POST /api/auth/login`, `POST /api/auth/logout`, JWT httpOnly |

### 7.2 Auth à durcir

- **Magic link :** générer un token (UUID v4 ou JWT court), l'insérer dans `access_token`, l'envoyer par email (SMTP / Resend / SendGrid). Vérifier expiration + usage unique côté API.
- **Admin :** remplacer le mot de passe en dur par `staff_user` + bcrypt + JWT httpOnly. Middleware par route.

### 7.3 Sécurité & RGPD

- Rate-limit sur `/api/tokens/:token` (anti brute-force)
- HTTPS obligatoire en prod
- Logs d'audit (déjà préparé via `submission_review_history`)
- Politique de rétention des données étudiants

### 7.4 Branchement front ↔ back

Côté front, ajouter `VITE_API_URL` dans `.env`, puis remplacer dans chaque fichier de `src/services/` les appels à `getStore()` par `fetch(\`${import.meta.env.VITE_API_URL}/...\`)`. **Aucun composant React à modifier.**

### 7.5 Fonctionnalités à venir (non implémentées)

- Export CSV/Excel des données fusionnées
- Notifications email (soumission reçue, modification demandée, validation)
- Upload de pièces jointes (convention de stage signée)
- Statistiques par campus / programme / pays
- Multilangue (FR/EN — école internationale)

---

## 8. Décisions clés à respecter

| Décision | Raison |
|----------|--------|
| `student_id` (`TEXT`) comme pivot, pas l'UUID | Identifiant École Ducasse stable, partagé entre LMS et entreprise |
| Pas de comptes étudiants/entreprises, magic links uniquement | UX simple, pas de gestion de mots de passe oubliés |
| Workflow avec `changes_requested` | L'étudiant peut corriger sans repartir de zéro |
| Merge via trigger SQL (pas dans l'API) | Cohérence garantie même si l'API plante ; logique métier dans la DB |
| Front 100 % découplé via `src/services/` | Permet de brancher n'importe quel back sans refactor |
| Tailwind + shadcn + design tokens sémantiques (`src/styles.css`) | Thème cohérent, pas de couleurs en dur |

---

## 9. Arborescence projet

```
ED Internship Platform/
├── src/
│   ├── routes/              ← pages (TanStack file-based)
│   ├── services/            ← couche API (mock → à brancher au back)
│   ├── mock/                ← store localStorage + seed
│   ├── lib/types.ts         ← types partagés
│   ├── components/          ← StatusBadge + shadcn/ui
│   └── styles.css           ← design tokens (oklch)
├── backend/                 ← À créer côté local
│   └── db/schema.sql        ← le fichier ducasse_careers_schema.sql
└── package.json
```

---

*Document généré pour handoff — École Ducasse, plateforme Stages & Carrières.*
