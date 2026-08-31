import * as k8s from "@kubernetes/client-node";

export function loadKubeConfig(contextName) {
  const config = new k8s.KubeConfig();

  config.loadFromDefault();

  if (contextName) {
    config.setCurrentContext(contextName);
  }

  return config;
}

export function createCoreApi(contextName) {
  const config = loadKubeConfig(contextName);

  return config.makeApiClient(k8s.CoreV1Api);
}

export function createAppsApi(contextName) {
  const config = loadKubeConfig(contextName);

  return config.makeApiClient(k8s.AppsV1Api);
}

export function createLogApi(contextName) {
  const config = loadKubeConfig(contextName);

  return config.makeApiClient(k8s.CoreV1Api);
}
