import k8s from "@kubernetes/client-node";

let kubeConfig = null;

export function getKubeConfig() {
  if (!kubeConfig) {
    kubeConfig = new k8s.KubeConfig();

    kubeConfig.loadFromDefault();
  }

  return kubeConfig;
}


export function getKubeConfigForContext(
  contextName
) {
  const config = new k8s.KubeConfig();

  config.loadFromDefault();

  if (contextName) {
    config.setCurrentContext(contextName);
  }

  return config;
}


export function createCoreV1Api(
  contextName
) {
  const config =
    getKubeConfigForContext(contextName);

  return config.makeApiClient(
    k8s.CoreV1Api
  );
}


export function createAppsV1Api(
  contextName
) {
  const config =
    getKubeConfigForContext(contextName);

  return config.makeApiClient(
    k8s.AppsV1Api
  );
}


export function createNetworkingV1Api(
  contextName
) {
  const config =
    getKubeConfigForContext(contextName);

  return config.makeApiClient(
    k8s.NetworkingV1Api
  );
}


export function createAutoscalingV2Api(
  contextName
) {
  const config =
    getKubeConfigForContext(contextName);

  return config.makeApiClient(
    k8s.AutoscalingV2Api
  );
}