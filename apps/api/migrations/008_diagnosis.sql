CREATE TABLE IF NOT EXISTS diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    incident_id UUID NOT NULL
        REFERENCES incidents(id)
        ON DELETE CASCADE,

    cluster_id UUID NOT NULL
        REFERENCES clusters(id)
        ON DELETE CASCADE,

    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',

    primary_cause VARCHAR(150) NOT NULL,

    confidence NUMERIC(5,4) NOT NULL DEFAULT 0,

    summary TEXT NOT NULL,

    reasoning JSONB NOT NULL DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        confidence >= 0
        AND confidence <= 1
    ),

    CHECK (
        status IN (
            'RUNNING',
            'COMPLETED',
            'FAILED'
        )
    )
);


CREATE INDEX IF NOT EXISTS
idx_diagnoses_incident
ON diagnoses(incident_id);


CREATE INDEX IF NOT EXISTS
idx_diagnoses_cluster
ON diagnoses(cluster_id);


CREATE INDEX IF NOT EXISTS
idx_diagnoses_created
ON diagnoses(
    cluster_id,
    created_at
);