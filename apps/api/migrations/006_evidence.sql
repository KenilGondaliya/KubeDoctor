CREATE TABLE IF NOT EXISTS incident_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    incident_id UUID NOT NULL
        REFERENCES incidents(id)
        ON DELETE CASCADE,

    cluster_id UUID NOT NULL
        REFERENCES clusters(id)
        ON DELETE CASCADE,

    evidence_type VARCHAR(100) NOT NULL,

    source_type VARCHAR(100) NOT NULL,

    source_uid TEXT,

    source_kind VARCHAR(100),

    source_name TEXT,

    namespace TEXT,

    summary TEXT NOT NULL,

    data JSONB NOT NULL DEFAULT '{}',

    confidence NUMERIC(5,4) NOT NULL DEFAULT 1.0,

    supports BOOLEAN NOT NULL DEFAULT TRUE,

    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS
idx_incident_evidence_incident
ON incident_evidence(incident_id);


CREATE INDEX IF NOT EXISTS
idx_incident_evidence_cluster
ON incident_evidence(cluster_id);


CREATE INDEX IF NOT EXISTS
idx_incident_evidence_type
ON incident_evidence(
    incident_id,
    evidence_type
);


CREATE INDEX IF NOT EXISTS
idx_incident_evidence_source
ON incident_evidence(
    cluster_id,
    source_uid
);