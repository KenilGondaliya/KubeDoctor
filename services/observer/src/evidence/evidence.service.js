import { collectPodEvidence } from "./evidence.collector.js";

import { createEvidence } from "./evidence.repository.js";

import {
  collectIncidentEvidence,
} from "../evidence/evidence.service.js";

export async function collectIncidentEvidence({ incident, snapshot }) {
  if (!incident || !snapshot) {
    throw new Error("Incident and snapshot are required");
  }

  let evidence = [];

  if (snapshot.kind === "Pod") {
    evidence = collectPodEvidence({
      incident,

      snapshot,
    });
  }

  const saved = [];

  for (const item of evidence) {
    const row = await createEvidence({
      incidentId: incident.id,

      clusterId: incident.cluster_id,

      evidence: item,
    });

    saved.push(row);
  }

  console.log(
    `[Evidence] Collected ${saved.length} evidence items for incident ${incident.id}`,
  );

  return saved;
}
