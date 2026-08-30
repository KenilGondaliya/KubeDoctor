ALTER TABLE incident_evidence
ADD COLUMN IF NOT EXISTS fingerprint TEXT;


CREATE UNIQUE INDEX IF NOT EXISTS
idx_incident_evidence_fingerprint
ON incident_evidence(
    incident_id,
    fingerprint
);