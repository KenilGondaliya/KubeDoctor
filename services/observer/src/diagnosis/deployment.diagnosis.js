import {
  findChildIncidents,
  findDiagnosisByIncidentId,
} from "./deployment.context.js";

const CAUSE_BY_INCIDENT = {
  POD_CRASH_LOOP: "POD_FAILURE",

  OOM_KILLED: "RESOURCE_EXHAUSTION",

  IMAGE_PULL_FAILURE: "IMAGE_PULL_FAILURE",

  FAILED_SCHEDULING: "SCHEDULING_FAILURE",

  READINESS_FAILURE: "READINESS_FAILURE",

  LIVENESS_FAILURE: "LIVENESS_FAILURE",
};

function getConfidence(severity) {
  switch (severity) {
    case "CRITICAL":
      return 0.95;

    case "HIGH":
      return 0.9;

    case "MEDIUM":
      return 0.75;

    case "LOW":
      return 0.6;

    default:
      return 0.5;
  }
}

export async function diagnoseDeployment({ incident }) {
  if (incident.incident_type !== "DEPLOYMENT_UNAVAILABLE") {
    return null;
  }

  const children = await findChildIncidents({
    clusterId: incident.cluster_id,

    workloadUid: incident.workload_uid,

    excludeIncidentId: incident.id,
  });

  const activeChildren = children.filter(
    (child) => child.status !== "RESOLVED",
  );

  /*
   * -----------------------------------------
   * No active child incident
   * -----------------------------------------
   */
  if (activeChildren.length === 0) {
    return {
      primaryCause: "NO_AVAILABLE_REPLICAS",

      confidence: 0.3,

      summary:
        `Deployment ${incident.workload_name} ` +
        `has unavailable replicas, but no active ` +
        `child incident currently explains the failure.`,

      evidence: [],

      causalChain: [
        {
          type: "INCIDENT",

          incidentId: incident.id,

          incidentType: incident.incident_type,

          resourceKind: incident.resource_kind,

          resourceName: incident.resource_name,
        },
      ],
    };
  }

  /*
   * -----------------------------------------
   * Select strongest child
   * -----------------------------------------
   */
  const selected = activeChildren[0];

  /*
   * Immediate cause from child incident.
   */
  const immediateCause =
    CAUSE_BY_INCIDENT[selected.incident_type] || "POD_FAILURE";

  /*
   * -----------------------------------------
   * Load child's diagnosis
   * -----------------------------------------
   */
  const childDiagnosis = await findDiagnosisByIncidentId(selected.id);

  /*
   * If child diagnosis exists, use its
   * root cause as the deepest known cause.
   */
  const rootCause = childDiagnosis?.primary_cause || immediateCause;

  const confidence = childDiagnosis
    ? Math.min(
        getConfidence(selected.severity),
        Number(childDiagnosis.confidence) || 0,
      )
    : getConfidence(selected.severity);

  /*
   * -----------------------------------------
   * Build causal chain
   * -----------------------------------------
   */
  const causalChain = [
    {
      type: "INCIDENT",

      incidentId: incident.id,

      incidentType: incident.incident_type,

      resourceKind: incident.resource_kind,

      resourceName: incident.resource_name,
    },

    {
      type: "CHILD_INCIDENT",

      incidentId: selected.id,

      incidentType: selected.incident_type,

      resourceKind: selected.resource_kind,

      resourceName: selected.resource_name,

      severity: selected.severity,

      status: selected.status,
    },
  ];

  /*
   * Add the child's diagnosis to the
   * causal chain when available.
   */
  if (childDiagnosis) {
    causalChain.push({
      type: "ROOT_CAUSE",

      incidentId: selected.id,

      cause: childDiagnosis.primary_cause,

      confidence: Number(childDiagnosis.confidence),

      summary: childDiagnosis.summary,
    });
  }

  return {
    primaryCause: rootCause,

    confidence,

    summary: childDiagnosis
      ? `Deployment ${incident.workload_name} ` +
        `is unavailable because of ` +
        `${selected.incident_type} on ` +
        `${selected.resource_kind}/` +
        `${selected.resource_name}. ` +
        `The deepest known cause is ` +
        `${childDiagnosis.primary_cause}.`
      : `Deployment ${incident.workload_name} ` +
        `is unavailable because of ` +
        `${selected.incident_type} on ` +
        `${selected.resource_kind}/` +
        `${selected.resource_name}.`,

    evidence: activeChildren.map((child) => ({
      incidentId: child.id,

      incidentType: child.incident_type,

      resourceKind: child.resource_kind,

      resourceName: child.resource_name,

      severity: child.severity,

      status: child.status,
    })),

    causalChain,
  };
}
