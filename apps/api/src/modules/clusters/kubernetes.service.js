import { createCoreV1Api } from "../../config/kubernetes.js";

export async function testClusterConnection(kubeContext) {
  const coreApi = createCoreV1Api(kubeContext);

  const [nodesResult, namespacesResult] = await Promise.all([
    coreApi.listNode(),
    coreApi.listNamespace(),
  ]);

  const nodes = nodesResult?.body?.items || nodesResult?.items || [];

  const namespaces =
    namespacesResult?.body?.items || namespacesResult?.items || [];

  return {
    connected: true,

    kubernetes: {
      context: kubeContext,
    },

    nodes: nodes.map((node) => ({
      name: node.metadata?.name,

      ready:
        node.status?.conditions?.find((condition) => condition.type === "Ready")
          ?.status === "True",
    })),

    namespaceCount: namespaces.length,
  };
}
