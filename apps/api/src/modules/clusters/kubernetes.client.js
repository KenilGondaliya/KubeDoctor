import {
  createCoreV1Api,
  createAppsV1Api,
  createNetworkingV1Api,
  createAutoscalingV2Api
} from "../../config/kubernetes.js";


export function createKubernetesClient(
  cluster
) {
  const context =
    cluster.kube_context;

  return {
    core:
      createCoreV1Api(context),

    apps:
      createAppsV1Api(context),

    networking:
      createNetworkingV1Api(context),

    autoscaling:
      createAutoscalingV2Api(context)
  };
}