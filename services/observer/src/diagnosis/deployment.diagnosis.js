import {
  findChildIncidents,
} from "./deployment.context.js";


const CAUSE_BY_INCIDENT = {
  POD_CRASH_LOOP:
    "POD_FAILURE",

  OOM_KILLED:
    "RESOURCE_EXHAUSTION",

  IMAGE_PULL_FAILURE:
    "IMAGE_PULL_FAILURE",

  FAILED_SCHEDULING:
    "SCHEDULING_FAILURE",

  READINESS_FAILURE:
    "READINESS_FAILURE",

  LIVENESS_FAILURE:
    "LIVENESS_FAILURE",
};


export async function diagnoseDeployment({
  incident,
}) {
  if (
    incident.incident_type !==
    "DEPLOYMENT_UNAVAILABLE"
  ) {
    return null;
  }


  const children =
    await findChildIncidents({
      clusterId:
        incident.cluster_id,

      workloadUid:
        incident.workload_uid,
    });


  const activeChildren =
    children.filter(
      (child) =>
        child.status !==
        "RESOLVED",
    );


  if (
    activeChildren.length === 0
  ) {
    return {
      primaryCause:
        "NO_AVAILABLE_REPLICAS",

      confidence:
        0.30,

      summary:
        "The Deployment has unavailable replicas, but no active child incident explains the failure.",

      evidence: [],
    };
  }


  /*
   * Pick the highest-severity active
   * child incident as the strongest
   * available causal signal.
   */
  const selected =
    activeChildren[0];


  const primaryCause =
    CAUSE_BY_INCIDENT[
      selected.incident_type
    ] ||
    "POD_FAILURE";


  return {
    primaryCause,

    confidence:
      selected.severity ===
      "CRITICAL"
        ? 0.95
        : selected.severity ===
          "HIGH"
          ? 0.90
          : 0.75,

    summary:
      `Deployment ${incident.workload_name} ` +
      `is unavailable because of ` +
      `${selected.incident_type} ` +
      `on ${selected.resource_kind}/` +
      `${selected.resource_name}.`,

    evidence: activeChildren.map(
      (child) => ({
        incidentId:
          child.id,

        incidentType:
          child.incident_type,

        resourceKind:
          child.resource_kind,

        resourceName:
          child.resource_name,

        severity:
          child.severity,

        status:
          child.status,
      }),
    ),
  };
}