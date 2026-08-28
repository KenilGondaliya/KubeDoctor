import * as k8s from "@kubernetes/client-node";

const kc = new k8s.KubeConfig();

kc.loadFromDefault();

console.log(
  "[TEST] Current context:",
  kc.getCurrentContext(),
);

const api =
  kc.makeApiClient(
    k8s.CoreV1Api,
  );

try {
  const response =
    await api.listPodForAllNamespaces();

  const pods =
    response.body?.items ??
    response.items ??
    [];

  console.log(
    `[TEST] Kubernetes connected. Pods: ${pods.length}`,
  );

  for (const pod of pods) {
    console.log(
      pod.metadata?.namespace,
      pod.metadata?.name,
    );
  }
} catch (error) {
  console.error(
    "[TEST] Kubernetes connection failed:",
    error,
  );
}