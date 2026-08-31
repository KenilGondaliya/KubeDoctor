import { generateHypotheses } from "./hypothesis.generator.js";

import { scoreHypothesis } from "./hypothesis.scorer.js";

import { buildDiagnosisEvidence } from "./evidence.view.js";

export function diagnose({ incident, evidence }) {
  const normalizedEvidence = buildDiagnosisEvidence(evidence);

  const hypotheses = generateHypotheses({
    incident,

    evidence: normalizedEvidence,
  });

  const scored = hypotheses
    .map((hypothesis) =>
      scoreHypothesis({
        hypothesis,

        evidence: normalizedEvidence,
      }),
    )
    .sort((a, b) => b.score - a.score);

  const best = scored[0];

  if (!best) {
    throw new Error("Unable to generate diagnosis");
  }

  return {
    primaryCause: best.cause,

    confidence: best.score,

    summary: best.summary,

    reasoning: {
      selected: best,

      alternatives: scored.slice(1),

      evidence: normalizedEvidence,
    },
  };
}
