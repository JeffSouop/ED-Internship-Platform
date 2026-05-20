-- Offres de stage / emploi publiées par les entreprises partenaires
CREATE TABLE IF NOT EXISTS careers.internship_offer (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES careers.company(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL,
    offer_type      TEXT NOT NULL DEFAULT 'stage'
        CHECK (offer_type IN ('stage', 'alternance', 'emploi', 'vie')),
    location        TEXT,
    contract_label  TEXT,
    duration        TEXT,
    start_date      DATE,
    contact_email   TEXT,
    published_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_email TEXT
);

CREATE INDEX IF NOT EXISTS idx_internship_offer_company_id
    ON careers.internship_offer(company_id);

CREATE INDEX IF NOT EXISTS idx_internship_offer_published_at
    ON careers.internship_offer(published_at DESC);
