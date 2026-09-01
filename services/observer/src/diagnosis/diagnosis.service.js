import { findIncidentEvidence } from "../evidence/evidence.repository.js";

import { diagnose } from "./diagnosis.engine.js";

import {
  findDiagnosisByIncident,
  createDiagnosis,
  updateDiagnosis,
} from "./diagnosis.repository.js";

export async function runDiagnosis(incident) {
  if (!incident?.id) {
    throw new Error("Incident is required");
  }

  /*
   * =========================================
   * Load incident evidence
   * =========================================
   */
  const evidence = await findIncidentEvidence(incident.id);

  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new Error("Cannot diagnose incident without evidence");
  }

  /*
   * =========================================
   * Run diagnosis
   * =========================================
   *
   * diagnose() is async because Deployment
   * diagnosis may query child incidents.
   *
   * IMPORTANT: await it.
   */
  const diagnosis = await diagnose({
    incident,

    evidence,
  });

  if (!diagnosis) {
    throw new Error("Diagnosis engine returned no result");
  }

  if (!diagnosis.primaryCause) {
    throw new Error("Diagnosis engine returned no primary cause");
  }

  if (diagnosis.confidence === undefined || diagnosis.confidence === null) {
    throw new Error("Diagnosis engine returned no confidence");
  }

  /*
   * =========================================
   * Existing diagnosis
   * =========================================
   */
  const existing = await findDiagnosisByIncident(incident.id);

  if (existing) {
    return updateDiagnosis({
      diagnosisId: existing.id,

      diagnosis,
    });
  }

  /*
   * =========================================
   * New diagnosis
   * =========================================
   */
  return createDiagnosis({
    incident,

    diagnosis,
  });
}
