import {
  collectPodEvidence,
  collectKubernetesEventEvidence,
} from "./evidence.collector.js";

import {
  createEvidence,
  findRelatedKubernetesEvents,
} from "./evidence.repository.js";

export async function collectIncidentEvidence({ incident, snapshot }) {
  if (!incident || !snapshot) {
    throw new Error("Incident and snapshot are required");
  }

  let evidence = [];

  /*
   * Resource-specific evidence
   */
  if (snapshot.kind === "Pod") {
    evidence = collectPodEvidence({
      incident,
      snapshot,
    });
  }

  /*
   * Kubernetes Event evidence
   */
  const events = await findRelatedKubernetesEvents({
    clusterId: incident.cluster_id,

    resourceUid: snapshot.uid,
  });

  const eventEvidence = collectKubernetesEventEvidence({
    events,
  });

  evidence.push(...eventEvidence);

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
    `[Evidence] Collected ${saved.length} evidence items ` +
      `for incident ${incident.id}`,
  );

  return saved;
}
