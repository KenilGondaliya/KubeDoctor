import { createCoreApi } from "../config/kubernetes.js";

import { EvidenceType } from "./evidence.types.js";

export async function collectContainerLogs({
  kubeContext,
  namespace,
  podName,
  containerName,
  previous = false,
  tailLines = 200,
}) {
  if (!namespace) {
    throw new Error("Namespace is required for log collection");
  }

  if (!podName) {
    throw new Error("Pod name is required for log collection");
  }

  const coreApi = createCoreApi(kubeContext);

  const response = await coreApi.readNamespacedPodLog({
    name: podName,

    namespace,

    container: containerName || undefined,

    previous,

    tailLines,
  });

  const logs =
    typeof response === "string" ? response : (response?.body ?? response);

  return {
    logs: logs || "",

    previous,

    tailLines,

    containerName: containerName || null,

    namespace,

    podName,
  };
}

export function buildContainerLogEvidence({
  pod,
  logResult,
  previous = false,
}) {
  return {
    evidenceType: EvidenceType.CONTAINER_LOG,

    sourceType: "kubernetes.pod.log",

    sourceUid: pod.uid,

    sourceKind: "Pod",

    sourceName: pod.name,

    namespace: pod.namespace,

    summary: `${previous ? "Previous" : "Current"} logs for Pod ${pod.name}`,

    data: {
      previous,

      containerName: logResult.containerName,

      tailLines: logResult.tailLines,

      logs: logResult.logs,
    },

    confidence: 0.95,

    /*
     * Log content can support or contradict
     * a diagnosis depending on what it contains.
     */
    supports: true,

    observedAt: new Date(),
  };
}
