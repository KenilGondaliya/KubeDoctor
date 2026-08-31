export function buildDiagnosisEvidence(evidenceRows) {
  const result = [];

  for (const row of evidenceRows) {
    const data = row.data || {};

    if (row.evidence_type === "CONTAINER_STATUS") {
      for (const container of data.containers || []) {
        const waitingReason = container?.state?.waiting?.reason || null;

        const terminated = container?.lastState?.terminated || null;

        result.push({
          type: "CONTAINER",

          containerName: container.name || null,

          restartCount: Number(container.restartCount || 0),

          reason: waitingReason,

          exitCode: terminated?.exitCode ?? null,

          terminationReason: terminated?.reason || null,
        });
      }
    }

    if (row.evidence_type === "CONTAINER_LOG") {
      result.push({
        type: "LOG",

        logs: data.logs || "",
      });
    }

    if (row.evidence_type === "NODE_CONTEXT") {
      result.push({
        type: "NODE",

        nodeName: data.nodeName || null,
      });
    }

    if (row.evidence_type === "KUBERNETES_EVENT") {
      result.push({
        type: "KUBERNETES_EVENT",

        reason: data.reason || null,

        message: data.message || null,
      });
    }
  }

  return result;
}
