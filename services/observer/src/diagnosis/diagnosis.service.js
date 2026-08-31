import { findIncidentEvidence } from "../evidence/evidence.repository.js";

import { diagnose } from "./diagnosis.engine.js";

import {
  findDiagnosisByIncident,
  createDiagnosis,
  updateDiagnosis,
} from "./diagnosis.repository.js";

export async function runDiagnosis(incident) {
  const evidence = await findIncidentEvidence(incident.id);

  if (evidence.length === 0) {
    throw new Error("Cannot diagnose incident without evidence");
  }

  const diagnosis = diagnose({
    incident,

    evidence,
  });

  const existing = await findDiagnosisByIncident(incident.id);

  if (existing) {
    return updateDiagnosis({
      diagnosisId: existing.id,

      diagnosis,
    });
  }

  return createDiagnosis({
    incident,

    diagnosis,
  });
}
