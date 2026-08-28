CREATE TABLE IF NOT EXISTS resource_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    cluster_id UUID NOT NULL
        REFERENCES clusters(id)
        ON DELETE CASCADE,

    source_uid TEXT NOT NULL,

    target_uid TEXT NOT NULL,

    relationship_type VARCHAR(50) NOT NULL,

    confidence NUMERIC(5,4) NOT NULL DEFAULT 1.0,

    metadata JSONB NOT NULL DEFAULT '{}',

    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        cluster_id,
        source_uid,
        target_uid,
        relationship_type
    )
);


CREATE INDEX IF NOT EXISTS
idx_relationships_cluster
ON resource_relationships(cluster_id);


CREATE INDEX IF NOT EXISTS
idx_relationships_source
ON resource_relationships(
    cluster_id,
    source_uid
);


CREATE INDEX IF NOT EXISTS
idx_relationships_target
ON resource_relationships(
    cluster_id,
    target_uid
);


CREATE INDEX IF NOT EXISTS
idx_relationships_type
ON resource_relationships(
    cluster_id,
    relationship_type
);