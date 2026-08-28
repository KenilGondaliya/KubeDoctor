CREATE TABLE resource_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    cluster_id UUID NOT NULL
        REFERENCES clusters(id)
        ON DELETE CASCADE,

    uid TEXT NOT NULL,

    api_version TEXT NOT NULL,

    kind TEXT NOT NULL,

    name TEXT NOT NULL,

    namespace TEXT,

    resource_version TEXT,

    labels JSONB NOT NULL DEFAULT '{}',

    annotations JSONB NOT NULL DEFAULT '{}',

    resource JSONB NOT NULL,

    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(cluster_id, uid)
);


CREATE INDEX idx_resource_snapshots_cluster
ON resource_snapshots(cluster_id);


CREATE INDEX idx_resource_snapshots_kind
ON resource_snapshots(cluster_id, kind);


CREATE INDEX idx_resource_snapshots_namespace
ON resource_snapshots(
    cluster_id,
    namespace
);