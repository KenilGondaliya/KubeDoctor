CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    cluster_id UUID NOT NULL
        REFERENCES clusters(id)
        ON DELETE CASCADE,

    resource_uid TEXT NOT NULL,

    resource_kind VARCHAR(100) NOT NULL,

    resource_name TEXT NOT NULL,

    namespace TEXT,

    incident_type VARCHAR(100) NOT NULL,

    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',

    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',

    title TEXT NOT NULL,

    description TEXT,

    evidence JSONB NOT NULL DEFAULT '{}',

    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    resolved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        severity IN (
            'LOW',
            'MEDIUM',
            'HIGH',
            'CRITICAL'
        )
    ),

    CHECK (
        status IN (
            'OPEN',
            'ACKNOWLEDGED',
            'RESOLVED'
        )
    )
);


CREATE INDEX IF NOT EXISTS
idx_incidents_cluster
ON incidents(cluster_id);


CREATE INDEX IF NOT EXISTS
idx_incidents_resource
ON incidents(
    cluster_id,
    resource_uid
);


CREATE INDEX IF NOT EXISTS
idx_incidents_status
ON incidents(
    cluster_id,
    status
);


CREATE INDEX IF NOT EXISTS
idx_incidents_severity
ON incidents(
    cluster_id,
    severity
);


CREATE INDEX IF NOT EXISTS
idx_incidents_type
ON incidents(
    cluster_id,
    incident_type
);


CREATE INDEX IF NOT EXISTS
idx_incidents_last_seen
ON incidents(
    cluster_id,
    last_seen_at
);