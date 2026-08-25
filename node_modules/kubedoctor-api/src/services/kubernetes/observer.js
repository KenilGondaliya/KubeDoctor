import * as k8s from '@kubernetes/client-node';
import EventEmitter from 'events'
import logger from '../../utils/logger'
import uuidv4 from 'uuid'
import kubernetesClient from '../../config/kubernetes'

class KubernetesObserver extends EventEmitter {
  constructor() {
    super();
    this.watches = new Map();
    this.isWatching = false;
    this.resourceVersion = new Map();
    this.eventBuffer = [];
    this.bufferSize = 1000;
  }

  async startWatching() {
    if (this.isWatching) {
      logger.warn('Observer already watching');
      return;
    }

    try {
      await kubernetesClient.initialize();
      
      // Start watching pods
      this.watchPods();
      
      // Start watching deployments
      this.watchDeployments();
      
      // Start watching services
      this.watchServices();
      
      // Start watching nodes
      this.watchNodes();
      
      // Start watching events
      this.watchEvents();
      
      this.isWatching = true;
      logger.info('Kubernetes observer started watching all resources');
      
      // Start processing buffer
      this.startBufferProcessor();
      
    } catch (error) {
      logger.error('Failed to start observer:', error);
      throw error;
    }
  }

  watchPods() {
    const coreApi = kubernetesClient.getCoreApi();
    const watch = new k8s.Watch(kubernetesClient.getKubeConfig());
    
    const listFn = () => coreApi.listPodForAllNamespaces();
    const startResourceVersion = this.resourceVersion.get('pods') || '0';
    
    watch.watch(
      '/api/v1/pods',
      {},
      (type, apiObj, watchObj) => {
        if (apiObj) {
          this.handlePodEvent(type, apiObj, watchObj);
        }
      },
      (err) => {
        if (err) {
          logger.error('Pod watch error:', err);
          setTimeout(() => this.watchPods(), 5000);
        }
      }
    );
    
    this.watches.set('pods', watch);
    logger.info('Pod watch started');
  }

  watchDeployments() {
    const appsApi = kubernetesClient.getAppsApi();
    const watch = new k8s.Watch(kubernetesClient.getKubeConfig());
    
    watch.watch(
      '/apis/apps/v1/deployments',
      {},
      (type, apiObj, watchObj) => {
        if (apiObj) {
          this.handleDeploymentEvent(type, apiObj, watchObj);
        }
      },
      (err) => {
        if (err) {
          logger.error('Deployment watch error:', err);
          setTimeout(() => this.watchDeployments(), 5000);
        }
      }
    );
    
    this.watches.set('deployments', watch);
    logger.info('Deployment watch started');
  }

  watchServices() {
    const coreApi = kubernetesClient.getCoreApi();
    const watch = new k8s.Watch(kubernetesClient.getKubeConfig());
    
    watch.watch(
      '/api/v1/services',
      {},
      (type, apiObj, watchObj) => {
        if (apiObj) {
          this.handleServiceEvent(type, apiObj, watchObj);
        }
      },
      (err) => {
        if (err) {
          logger.error('Service watch error:', err);
          setTimeout(() => this.watchServices(), 5000);
        }
      }
    );
    
    this.watches.set('services', watch);
    logger.info('Service watch started');
  }

  watchNodes() {
    const coreApi = kubernetesClient.getCoreApi();
    const watch = new k8s.Watch(kubernetesClient.getKubeConfig());
    
    watch.watch(
      '/api/v1/nodes',
      {},
      (type, apiObj, watchObj) => {
        if (apiObj) {
          this.handleNodeEvent(type, apiObj, watchObj);
        }
      },
      (err) => {
        if (err) {
          logger.error('Node watch error:', err);
          setTimeout(() => this.watchNodes(), 5000);
        }
      }
    );
    
    this.watches.set('nodes', watch);
    logger.info('Node watch started');
  }

  watchEvents() {
    const eventsApi = kubernetesClient.getEventsApi();
    const watch = new k8s.Watch(kubernetesClient.getKubeConfig());
    
    watch.watch(
      '/apis/events.k8s.io/v1/events',
      {},
      (type, apiObj, watchObj) => {
        if (apiObj) {
          this.handleEvent(type, apiObj, watchObj);
        }
      },
      (err) => {
        if (err) {
          logger.error('Event watch error:', err);
          setTimeout(() => this.watchEvents(), 5000);
        }
      }
    );
    
    this.watches.set('events', watch);
    logger.info('Event watch started');
  }

  handlePodEvent(type, apiObj, watchObj) {
    const event = this.normalizeEvent('POD', type, apiObj, watchObj);
    this.bufferEvent(event);
  }

  handleDeploymentEvent(type, apiObj, watchObj) {
    const event = this.normalizeEvent('DEPLOYMENT', type, apiObj, watchObj);
    this.bufferEvent(event);
  }

  handleServiceEvent(type, apiObj, watchObj) {
    const event = this.normalizeEvent('SERVICE', type, apiObj, watchObj);
    this.bufferEvent(event);
  }

  handleNodeEvent(type, apiObj, watchObj) {
    const event = this.normalizeEvent('NODE', type, apiObj, watchObj);
    this.bufferEvent(event);
  }

  handleEvent(type, apiObj, watchObj) {
    const event = this.normalizeEvent('KUBERNETES_EVENT', type, apiObj, watchObj);
    this.bufferEvent(event);
  }

  normalizeEvent(resourceKind, eventType, apiObj, watchObj) {
    const timestamp = new Date();
    const uid = apiObj?.metadata?.uid || uuidv4();
    const name = apiObj?.metadata?.name || 'unknown';
    const namespace = apiObj?.metadata?.namespace || 'default';

    // Determine event type mapping
    const eventTypeMap = {
      'ADDED': `${resourceKind}_ADDED`,
      'MODIFIED': `${resourceKind}_MODIFIED`,
      'DELETED': `${resourceKind}_DELETED`,
      'BOOKMARK': `${resourceKind}_BOOKMARK`,
      'ERROR': `${resourceKind}_ERROR`
    };

    const normalizedType = eventTypeMap[eventType] || `${resourceKind}_${eventType}`;

    return {
      eventId: `evt_${uuidv4().replace(/-/g, '').substring(0, 12)}`,
      clusterId: 'default-cluster', // Will be resolved later
      type: normalizedType,
      resource: {
        kind: resourceKind,
        name: name,
        namespace: namespace,
        uid: uid,
        apiVersion: apiObj?.apiVersion || 'v1'
      },
      rawData: apiObj,
      timestamp: timestamp,
      watchEvent: watchObj
    };
  }

  bufferEvent(event) {
    this.eventBuffer.push(event);
    
    // Emit immediately for critical events
    if (event.type.includes('POD_') || event.type.includes('KUBERNETES_EVENT')) {
      this.emit('event', event);
    }
    
    // Trim buffer if too large
    if (this.eventBuffer.length > this.bufferSize) {
      this.eventBuffer = this.eventBuffer.slice(-this.bufferSize);
    }
  }

  startBufferProcessor() {
    setInterval(() => {
      if (this.eventBuffer.length > 0) {
        const events = this.eventBuffer.splice(0, 50); // Process in batches
        this.emit('batch', events);
      }
    }, 1000);
  }

  stopWatching() {
    for (const [name, watch] of this.watches) {
      try {
        watch.abort();
        logger.info(`Stopped watching ${name}`);
      } catch (error) {
        logger.error(`Error stopping watch ${name}:`, error);
      }
    }
    this.watches.clear();
    this.isWatching = false;
    this.eventBuffer = [];
    logger.info('Kubernetes observer stopped');
  }

  getStatus() {
    return {
      isWatching: this.isWatching,
      watches: Array.from(this.watches.keys()),
      bufferSize: this.eventBuffer.length,
      resourceVersions: Object.fromEntries(this.resourceVersion)
    };
  }
}

module.exports = new KubernetesObserver();