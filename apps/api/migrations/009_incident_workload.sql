ALTER TABLE incidents
ADD COLUMN IF NOT EXISTS workload_uid TEXT;

ALTER TABLE incidents
ADD COLUMN IF NOT EXISTS workload_kind VARCHAR(100);

ALTER TABLE incidents
ADD COLUMN IF NOT EXISTS workload_name TEXT;


CREATE INDEX IF NOT EXISTS
idx_incidents_workload
ON incidents(
    cluster_id,
    workload_uid
);
