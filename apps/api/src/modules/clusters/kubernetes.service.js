import {
  createCoreV1Api,
  createAppsV1Api
} from "../../config/kubernetes.js";


export async function testClusterConnection(
  kubeContext
) {
  const coreApi =
    createCoreV1Api(kubeContext);

  const appsApi =
    createAppsV1Api(kubeContext);


  const [
    versionResult,
    nodesResult,
    namespacesResult
  ] = await Promise.all([
    coreApi.getAPIVersions(),
    coreApi.listNode(),
    coreApi.listNamespace()
  ]);


  return {
    connected: true,

    kubernetes: {
      versions:
        versionResult.body
          ?.versions || []
    },

    nodes:
      nodesResult.body.items.map(
        (node) => ({
          name: node.metadata?.name,

          ready:
            node.status?.conditions
              ?.find(
                (condition) =>
                  condition.type === "Ready"
              )
              ?.status === "True"
        })
      ),

    namespaceCount:
      namespacesResult.body.items.length
  };
}