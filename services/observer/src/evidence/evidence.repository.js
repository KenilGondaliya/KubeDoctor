import { db } from "../config/database.js";


export async function createEvidence({
  incidentId,
  clusterId,
  evidence,
}) {
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
      observed_at
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
      $13
    )
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
    ],
  );

  return result.rows[0];
}


export async function findIncidentEvidence(
  incidentId,
) {
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


export async function deleteIncidentEvidence(
  incidentId,
) {
  await db.query(
    `
    DELETE FROM incident_evidence
    WHERE incident_id = $1
    `,
    [incidentId],
  );
}