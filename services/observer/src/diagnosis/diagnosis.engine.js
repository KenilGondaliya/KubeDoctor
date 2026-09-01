import { generateHypotheses } from "./hypothesis.generator.js";

import { scoreHypothesis } from "./hypothesis.scorer.js";

import { buildDiagnosisEvidence } from "./evidence.view.js";

import { diagnoseDeployment } from "./deployment.diagnosis.js";

export async function diagnose({ incident, evidence }) {
  if (!incident) {
    throw new Error("Incident is required for diagnosis");
  }

  if (!Array.isArray(evidence)) {
    throw new Error("Evidence must be an array");
  }

  /*
   * Normalize evidence before diagnosis.
   */
  const normalizedEvidence = buildDiagnosisEvidence(evidence);

  /*
   * =========================================
   * Deployment-level diagnosis
   * =========================================
   *
   * Deployments are higher-level resources.
   * Their availability problems can often be
   * explained by active child incidents.
   *
   * diagnoseDeployment() is asynchronous
   * because it queries child incidents.
   */
  if (incident.incident_type === "DEPLOYMENT_UNAVAILABLE") {
    const deploymentDiagnosis = await diagnoseDeployment({
      incident,
    });

    /*
     * Use the deployment-specific diagnosis
     * when child incident information exists
     * or when the deployment fallback is useful.
     */
    if (deploymentDiagnosis) {
      const childEvidence = Array.isArray(deploymentDiagnosis.evidence)
        ? deploymentDiagnosis.evidence
        : [];

      return {
        primaryCause: deploymentDiagnosis.primaryCause,

        confidence: Number(deploymentDiagnosis.confidence),

        summary: deploymentDiagnosis.summary,

        reasoning: {
          selected: {
            cause: deploymentDiagnosis.primaryCause,

            score: Number(deploymentDiagnosis.confidence),

            summary: deploymentDiagnosis.summary,

            reasons: childEvidence.map(
              (item) =>
                `Child incident: ${item.incidentType} ` +
                `on ${item.resourceKind}/${item.resourceName}`,
            ),
          },

          alternatives: [],

          evidence: [
            ...normalizedEvidence,

            ...childEvidence.map((item) => ({
              type: "CHILD_INCIDENT",

              incidentId: item.incidentId,

              incidentType: item.incidentType,

              resourceKind: item.resourceKind,

              resourceName: item.resourceName,

              severity: item.severity,

              status: item.status,
            })),
          ],
        },
      };
    }
  }

  /*
   * =========================================
   * Generic diagnosis pipeline
   * =========================================
   */
  const hypotheses = generateHypotheses({
    incident,

    evidence: normalizedEvidence,
  });

  if (!Array.isArray(hypotheses) || hypotheses.length === 0) {
    throw new Error(
      `Unable to generate diagnosis hypotheses for ${incident.incident_type}`,
    );
  }

  /*
   * Score every hypothesis.
   */
  const scored = hypotheses
    .map((hypothesis) =>
      scoreHypothesis({
        hypothesis,

        evidence: normalizedEvidence,
      }),
    )
    .filter(Boolean)
    .sort((a, b) => Number(b.score) - Number(a.score));

  const best = scored[0];

  if (!best) {
    throw new Error("Unable to generate diagnosis");
  }

  return {
    primaryCause: best.cause,

    confidence: Number(best.score),

    summary: best.summary,

    reasoning: {
      selected: best,

      alternatives: scored.slice(1),

      evidence: normalizedEvidence,
    },
  };
}
