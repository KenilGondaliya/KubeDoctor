import { detectIncident } from "./incident.detector.js";

import {
  findOpenIncident,
  createIncident,
  updateIncident,
} from "./incident.repository.js";

export async function processResourceEvent(event) {
  const incident = detectIncident(event);

  /*
   * This Kubernetes resource does not
   * currently match any incident rule.
   */
  if (!incident) {
    return {
      detected: false,
      incident: null,
    };
  }

  const existing = await findOpenIncident({
    clusterId: event.clusterId,

    resourceUid: incident.resourceUid,

    incidentType: incident.incidentType,
  });

  if (existing) {
    const updated = await updateIncident({
      incidentId: existing.id,

      incident,
    });

    console.log(
      `[Incident] Updated ` +
        `${incident.incidentType} ` +
        `${incident.resourceKind}/` +
        `${incident.resourceName}`,
    );

    return {
      detected: true,

      created: false,

      updated: true,

      incident: updated,
    };
  }

  const created = await createIncident({
    clusterId: event.clusterId,

    incident,
  });

  console.log(
    `[Incident] CREATED ` +
      `${created.incident_type} ` +
      `${created.resource_kind}/` +
      `${created.resource_name}`,
  );

  return {
    detected: true,

    created: true,

    updated: false,

    incident: created,
  };
}
