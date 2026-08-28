import { detectIncident } from "./incident.detector.js";

import {
  findOpenIncident,
  createIncident,
  updateIncident,
} from "./incident.repository.js";

import { collectIncidentEvidence } from "../evidence/evidence.service.js";

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

  /*
   * Existing incident:
   *
   * Update the current incident instead
   * of creating another incident.
   */
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

  /*
   * New incident.
   */
  const created = await createIncident({
    clusterId: event.clusterId,

    incident,
  });

  /*
   * Collect initial evidence only when
   * the incident is first created.
   *
   * This prevents duplicate evidence on
   * every repeated Kubernetes event.
   */
  try {
    await collectIncidentEvidence({
      incident: created,

      snapshot: {
        uid: event.resource.uid,

        kind: event.resource.kind,

        name: event.resource.name,

        namespace: event.resource.namespace,

        labels: event.resource.labels,

        resource_version: event.resource.resourceVersion,

        resource: event.resource,
      },
    });
  } catch (error) {
    /*
     * Incident creation should not fail merely
     * because evidence collection failed.
     *
     * The incident remains available for
     * later evidence collection/retry.
     */
    console.error(
      `[Incident] Evidence collection failed for ${created.id}:`,
      error,
    );
  }

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
