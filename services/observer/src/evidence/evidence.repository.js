import { db } from "../config/database.js";
import crypto from "node:crypto";

export async function createEvidence({ incidentId, clusterId, evidence }) {
  const fingerprint = createEvidenceFingerprint(evidence);

  const result = await db.query(
    `
    INSERT INTO incident_evidence (
      incident_id,
      cluster_id,
      evidence_type,
      source_type,
      source_uid,
      source_kind,
      source_name,
      namespace,
      summary,
      data,
      confidence,
      supports,
      observed_at,
      fingerprint
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12,
      $13,
      $14
    )
    ON CONFLICT (
      incident_id,
      fingerprint
    )
    DO UPDATE SET
      data =
        EXCLUDED.data,

      confidence =
        EXCLUDED.confidence,

      observed_at =
        EXCLUDED.observed_at
    RETURNING *
    `,
    [
      incidentId,
      clusterId,
      evidence.evidenceType,
      evidence.sourceType,
      evidence.sourceUid || null,
      evidence.sourceKind || null,
      evidence.sourceName || null,
      evidence.namespace || null,
      evidence.summary,
      JSON.stringify(evidence.data || {}),
      evidence.confidence ?? 1.0,
      evidence.supports ?? true,
      evidence.observedAt || new Date(),
      fingerprint,
    ],
  );

  return result.rows[0];
}

export async function findIncidentEvidence(incidentId) {
  const result = await db.query(
    `
    SELECT *
    FROM incident_evidence
    WHERE incident_id = $1
    ORDER BY observed_at DESC
    `,
    [incidentId],
  );

  return result.rows;
}

export async function deleteIncidentEvidence(incidentId) {
  await db.query(
    `
    DELETE FROM incident_evidence
    WHERE incident_id = $1
    `,
    [incidentId],
  );
}

export async function findRelatedKubernetesEvents({ clusterId, resourceUid }) {
  const result = await db.query(
    `
    SELECT
      uid,
      kind,
      name,
      namespace,
      resource
    FROM resource_snapshots
    WHERE
      cluster_id = $1
      AND kind = 'Event'
    ORDER BY updated_at DESC
    LIMIT 500
    `,
    [clusterId],
  );

  return result.rows.filter((row) => {
    const rawEvent = row.resource?.raw || row.resource || {};

    const involvedObject = rawEvent.involvedObject || {};

    return involvedObject.uid === resourceUid;
  });
}

function createEvidenceFingerprint(evidence) {
  const input = JSON.stringify({
    evidenceType: evidence.evidenceType,

    sourceType: evidence.sourceType,

    sourceUid: evidence.sourceUid,

    sourceName: evidence.sourceName,

    summary: evidence.summary,

    data: evidence.data,
  });

  return crypto.createHash("sha256").update(input).digest("hex");
}
