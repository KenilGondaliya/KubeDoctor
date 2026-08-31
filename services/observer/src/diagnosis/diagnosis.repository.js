import { db } from "../config/database.js";

export async function findDiagnosisByIncident(incidentId) {
  const result = await db.query(
    `
      SELECT *
      FROM diagnoses
      WHERE incident_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
    [incidentId],
  );

  return result.rows[0] || null;
}

export async function createDiagnosis({ incident, diagnosis }) {
  const result = await db.query(
    `
      INSERT INTO diagnoses (
        incident_id,
        cluster_id,
        status,
        primary_cause,
        confidence,
        summary,
        reasoning
      )
      VALUES (
        $1,
        $2,
        'COMPLETED',
        $3,
        $4,
        $5,
        $6
      )
      RETURNING *
      `,
    [
      incident.id,

      incident.cluster_id,

      diagnosis.primaryCause,

      diagnosis.confidence,

      diagnosis.summary,

      JSON.stringify(diagnosis.reasoning),
    ],
  );

  return result.rows[0];
}

export async function updateDiagnosis({ diagnosisId, diagnosis }) {
  const result = await db.query(
    `
      UPDATE diagnoses
      SET
        primary_cause = $1,
        confidence = $2,
        summary = $3,
        reasoning = $4,
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
      `,
    [
      diagnosis.primaryCause,

      diagnosis.confidence,

      diagnosis.summary,

      JSON.stringify(diagnosis.reasoning),

      diagnosisId,
    ],
  );

  return result.rows[0];
}
