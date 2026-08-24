export function diagnoseImagePull({ pod, events = [] }) {
  const waiting = (pod?.containers ?? []).find((c) =>
    ["ImagePullBackOff", "ErrImagePull"].includes(c.state?.waiting?.reason),
  );
  if (!waiting) return null;
  return {
    rootCause: "CONTAINER_IMAGE_PULL_FAILURE",
    confidence: 0.9,
    evidence: [
      {
        type: "CONTAINER_STATE",
        summary: `${waiting.name} is ${waiting.state.waiting.reason}`,
        weight: 50,
      },
      {
        type: "EVENT",
        summary:
          events.find((e) => /image/i.test(`${e.reason} ${e.message}`))
            ?.message ?? "Image pull events detected",
        weight: 40,
      },
    ],
    recommendations: [
      {
        action: "CHECK_IMAGE_REFERENCE",
        risk: "LOW",
        reason:
          "Verify image name/tag, registry availability, and image pull credentials.",
      },
    ],
  };
}
