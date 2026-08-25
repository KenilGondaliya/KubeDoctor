import * as k8s from '@kubernetes/client-node';
import path from "path"
import fs from "fs"
import logger from "../utils/logger.js"

class KubernetesClient {
  constructor() {
    this.kc = null;
    this.coreApi = null;
    this.appsApi = null;
    this.eventsApi = null;
    this.isConnected = false;
  }

  async initialize() {
    try {
      this.kc = new k8s.KubeConfig();
      
      // Try to load from kubeconfig path or default
      const kubeconfigPath = process.env.KUBECONFIG_PATH || 
                           path.join(process.env.HOME, '.kube', 'config');
      
      if (fs.existsSync(kubeconfigPath)) {
        this.kc.loadFromFile(kubeconfigPath);
        logger.info(`Loaded kubeconfig from ${kubeconfigPath}`);
      } else if (process.env.KUBERNETES_SERVICE_HOST) {
        // In-cluster mode
        this.kc.loadFromCluster();
        logger.info('Loaded in-cluster kubeconfig');
      } else {
        logger.warn('No kubeconfig found, using default context');
        this.kc.loadFromDefault();
      }

      // Set up API clients
      this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
      this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
      this.eventsApi = this.kc.makeApiClient(k8s.EventsV1Api);
      
      // Test connection
      await this.testConnection();
      
      this.isConnected = true;
      logger.info('Kubernetes client initialized successfully');
      
      return this;
    } catch (error) {
      logger.error('Kubernetes client initialization failed:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const response = await this.coreApi.listNamespace();
      logger.info(`Kubernetes connection successful: ${response.body.items.length} namespaces`);
      return true;
    } catch (error) {
      logger.error('Kubernetes connection test failed:', error);
      throw error;
    }
  }

  getCoreApi() {
    if (!this.coreApi) {
      throw new Error('Kubernetes client not initialized');
    }
    return this.coreApi;
  }

  getAppsApi() {
    if (!this.appsApi) {
      throw new Error('Kubernetes client not initialized');
    }
    return this.appsApi;
  }

  getEventsApi() {
    if (!this.eventsApi) {
      throw new Error('Kubernetes client not initialized');
    }
    return this.eventsApi;
  }

  getKubeConfig() {
    return this.kc;
  }
}

module.exports = new KubernetesClient();