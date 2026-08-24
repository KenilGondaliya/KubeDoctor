export function diagnoseProbeFailure({ pod, events = [] }) {
  const event = events.find((e) =>
    /unhealthy|probe/i.test(`${e.reason} ${e.message}`),
  );
  if (!event) return null;
  return {
    rootCause: "HEALTH_PROBE_FAILURE",
    confidence: 0.9,
    evidence: [{ type: "EVENT", summary: event.message, weight: 70 }],
    recommendations: [
      {
        action: "INSPECT_HEALTH_PROBES",
        risk: "LOW",
        reason:
          "Verify probe path, port, timing, and application health endpoint.",
      },
    ],
  };
}
