import Evidence from '../models/Evidence'
import logger from '../utils/logger'
import kubernetesClient from '../config/kubernetes'
import uuidv4 from 'uuid'

class EvidenceService {
  async collectEvidence(incidentId, incident) {
    try {
      const evidence = [];
      const collectionOrder = 0;

      // Collect pod state
      const podEvidence = await this.collectPodState(incident);
      if (podEvidence) {
        evidence.push(podEvidence);
      }

      // Collect pod logs
      const logEvidence = await this.collectPodLogs(incident);
      if (logEvidence) {
        evidence.push(logEvidence);
      }

      // Collect events
      const eventEvidence = await this.collectEvents(incident);
      if (eventEvidence) {
        evidence.push(eventEvidence);
      }

      // Collect deployment state if applicable
      if (incident.workload) {
        const deploymentEvidence = await this.collectDeploymentState(incident);
        if (deploymentEvidence) {
          evidence.push(deploymentEvidence);
        }
      }

      // Collect service and endpoint state
      const serviceEvidence = await this.collectServiceState(incident);
      if (serviceEvidence) {
        evidence.push(serviceEvidence);
      }

      // Collect node state
      const nodeEvidence = await this.collectNodeState(incident);
      if (nodeEvidence) {
        evidence.push(nodeEvidence);
      }

      // Save all evidence to database
      const savedEvidence = [];
      for (const item of evidence) {
        const saved = await this.saveEvidence(incidentId, item);
        savedEvidence.push(saved);
      }

      // Update incident evidence count
      await this.updateIncidentEvidenceCount(incidentId);

      logger.info(`Collected ${savedEvidence.length} evidence items for incident ${incidentId}`);
      return savedEvidence;

    } catch (error) {
      logger.error(`Failed to collect evidence for incident ${incidentId}:`, error);
      throw error;
    }
  }

  async collectPodState(incident) {
    try {
      const coreApi = kubernetesClient.getCoreApi();
      const { namespace, resource } = incident;
      
      const response = await coreApi.readNamespacedPod(resource.name, namespace);
      const pod = response.body;
      
      return {
        type: 'POD_STATE',
        resource: {
          kind: 'Pod',
          name: pod.metadata.name,
          namespace: pod.metadata.namespace,
          uid: pod.metadata.uid
        },
        data: {
          phase: pod.status.phase,
          restartCount: pod.status.containerStatuses?.[0]?.restartCount || 0,
          ready: pod.status.conditions?.some(c => c.type === 'Ready' && c.status === 'True') || false,
          containers: pod.spec.containers.map(c => ({
            name: c.name,
            image: c.image,
            ready: pod.status.containerStatuses?.find(cs => cs.name === c.name)?.ready || false,
            state: pod.status.containerStatuses?.find(cs => cs.name === c.name)?.state
          })),
          nodeName: pod.spec.nodeName,
          creationTimestamp: pod.metadata.creationTimestamp
        },
        source: 'KUBERNETES_API',
        timestamp: new Date()
      };
    } catch (error) {
      logger.warn(`Failed to collect pod state for ${incident.resource.name}:`, error.message);
      return null;
    }
  }

  async collectPodLogs(incident) {
    try {
      const coreApi = kubernetesClient.getCoreApi();
      const { namespace, resource } = incident;
      
      // Get current logs
      let currentLogs = '';
      try {
        const response = await coreApi.readNamespacedPodLog(
          resource.name,
          namespace,
          undefined,
          undefined,
          undefined,
          undefined,
          1000 // tail lines
        );
        currentLogs = response.body || '';
      } catch (error) {
        if (error.statusCode === 404) {
          currentLogs = 'Pod not found or no logs available';
        } else {
          logger.warn(`Failed to get current logs: ${error.message}`);
        }
      }

      // Get previous logs
      let previousLogs = '';
      try {
        const response = await coreApi.readNamespacedPodLog(
          resource.name,
          namespace,
          undefined,
          undefined,
          undefined,
          undefined,
          1000,
          true // previous
        );
        previousLogs = response.body || '';
      } catch (error) {
        if (error.statusCode === 404) {
          previousLogs = 'No previous logs available';
        } else {
          logger.warn(`Failed to get previous logs: ${error.message}`);
        }
      }

      // Only store if we have meaningful logs
      if (!currentLogs && !previousLogs) {
        return null;
      }

      return {
        type: 'POD_LOGS',
        resource: {
          kind: 'Pod',
          name: resource.name,
          namespace: namespace
        },
        data: {
          current: currentLogs,
          previous: previousLogs,
          logCount: {
            current: currentLogs.split('\n').length,
            previous: previousLogs.split('\n').length
          }
        },
        source: 'LOGS',
        timestamp: new Date()
      };
    } catch (error) {
      logger.warn(`Failed to collect pod logs for ${incident.resource.name}:`, error.message);
      return null;
    }
  }

  async collectEvents(incident) {
    try {
      const coreApi = kubernetesClient.getCoreApi();
      const { namespace, resource } = incident;
      
      const response = await coreApi.listNamespacedEvent(
        namespace,
        undefined,
        undefined,
        undefined,
        `involvedObject.name=${resource.name}`,
        20 // limit
      );
      
      const events = response.body.items.map(event => ({
        type: event.type,
        reason: event.reason,
        message: event.message,
        count: event.count,
        firstTimestamp: event.firstTimestamp,
        lastTimestamp: event.lastTimestamp,
        involvedObject: event.involvedObject
      }));

      if (events.length === 0) {
        return null;
      }

      return {
        type: 'KUBERNETES_EVENTS',
        resource: {
          kind: 'Pod',
          name: resource.name,
          namespace: namespace
        },
        data: {
          events: events,
          count: events.length
        },
        source: 'KUBERNETES_EVENTS',
        timestamp: new Date()
      };
    } catch (error) {
      logger.warn(`Failed to collect events for ${incident.resource.name}:`, error.message);
      return null;
    }
  }

  async collectDeploymentState(incident) {
    if (!incident.workload || incident.workload.kind !== 'Deployment') {
      return null;
    }

    try {
      const appsApi = kubernetesClient.getAppsApi();
      const { namespace, workload } = incident;
      
      const response = await appsApi.readNamespacedDeployment(workload.name, namespace);
      const deployment = response.body;
      
      return {
        type: 'DEPLOYMENT_STATE',
        resource: {
          kind: 'Deployment',
          name: deployment.metadata.name,
          namespace: deployment.metadata.namespace,
          uid: deployment.metadata.uid
        },
        data: {
          replicas: deployment.spec.replicas,
          readyReplicas: deployment.status.readyReplicas || 0,
          updatedReplicas: deployment.status.updatedReplicas || 0,
          availableReplicas: deployment.status.availableReplicas || 0,
          conditions: deployment.status.conditions || [],
          strategy: deployment.spec.strategy
        },
        source: 'KUBERNETES_API',
        timestamp: new Date()
      };
    } catch (error) {
      logger.warn(`Failed to collect deployment state:`, error.message);
      return null;
    }
  }

  async collectServiceState(incident) {
    try {
      const coreApi = kubernetesClient.getCoreApi();
      const { namespace } = incident;
      
      // Find services that match the pod's labels
      let services = [];
      try {
        const response = await coreApi.listNamespacedService(namespace);
        services = response.body.items.filter(svc => {
          // Check if service selects this pod
          const selector = svc.spec.selector || {};
          const podLabels = incident.resource.rawData?.metadata?.labels || {};
          
          for (const [key, value] of Object.entries(selector)) {
            if (podLabels[key] !== value) {
              return false;
            }
          }
          return true;
        });
      } catch (error) {
        logger.warn(`Failed to list services:`, error.message);
        return null;
      }

      if (services.length === 0) {
        return null;
      }

      const serviceData = [];
      for (const svc of services) {
        serviceData.push({
          name: svc.metadata.name,
          type: svc.spec.type,
          clusterIP: svc.spec.clusterIP,
          ports: svc.spec.ports,
          selector: svc.spec.selector
        });
      }

      return {
        type: 'SERVICE_STATE',
        resource: {
          kind: 'Service',
          name: services[0].metadata.name,
          namespace: namespace
        },
        data: {
          services: serviceData,
          count: services.length
        },
        source: 'KUBERNETES_API',
        timestamp: new Date()
      };
    } catch (error) {
      logger.warn(`Failed to collect service state:`, error.message);
      return null;
    }
  }

  async collectNodeState(incident) {
    try {
      const coreApi = kubernetesClient.getCoreApi();
      const response = await coreApi.listNode();
      
      const nodeState = response.body.items.map(node => ({
        name: node.metadata.name,
        status: {
          conditions: node.status.conditions.map(c => ({
            type: c.type,
            status: c.status,
            reason: c.reason,
            message: c.message
          })),
          allocatable: node.status.allocatable,
          capacity: node.status.capacity
        },
        labels: node.metadata.labels,
        taints: node.spec.taints
      }));

      return {
        type: 'NODE_STATE',
        resource: {
          kind: 'Node',
          name: 'all-nodes'
        },
        data: {
          nodes: nodeState,
          count: nodeState.length
        },
        source: 'KUBERNETES_API',
        timestamp: new Date()
      };
    } catch (error) {
      logger.warn(`Failed to collect node state:`, error.message);
      return null;
    }
  }

  async saveEvidence(incidentId, evidenceData) {
    const evidence = new Evidence({
      incidentId: incidentId,
      snapshotId: uuidv4(),
      type: evidenceData.type,
      resource: evidenceData.resource,
      data: evidenceData.data,
      source: evidenceData.source,
      timestamp: evidenceData.timestamp || new Date()
    });
    
    // Generate hash for deduplication
    evidence.hash = evidence.generateHash ? evidence.generateHash() : 
      require('crypto').createHash('sha256')
        .update(JSON.stringify(evidenceData))
        .digest('hex');
    
    // Check if similar evidence already exists
    const existing = await Evidence.findOne({
      incidentId: incidentId,
      type: evidenceData.type,
      hash: evidence.hash,
      'resource.kind': evidenceData.resource.kind,
      'resource.name': evidenceData.resource.name
    });

    if (existing) {
      // Update timestamp instead of creating new
      existing.timestamp = new Date();
      await existing.save();
      return existing;
    }

    await evidence.save();
    return evidence;
  }

  async updateIncidentEvidenceCount(incidentId) {
    const count = await Evidence.countDocuments({ incidentId });
    await require('../models/Incident').findByIdAndUpdate(incidentId, {
      evidenceCount: count
    });
  }

  async getEvidenceForIncident(incidentId, type = null) {
    const query = { incidentId };
    if (type) query.type = type;
    
    return await Evidence.find(query)
      .sort({ timestamp: -1 })
      .limit(100);
  }

  async getEvidenceTimeline(incidentId) {
    return await Evidence.find({ incidentId })
      .sort({ timestamp: 1 })
      .select('type resource timestamp data')
      .limit(1000);
  }

  async getLatestEvidence(incidentId, type) {
    return await Evidence.findOne({ incidentId, type })
      .sort({ timestamp: -1 });
  }

  async createEvidenceSnapshot(incidentId, snapshotId) {
    const evidence = await this.getEvidenceForIncident(incidentId);
    
    // Update all evidence with snapshot ID
    await Evidence.updateMany(
      { incidentId },
      { snapshotId }
    );
    
    return evidence;
  }
}

module.exports = new EvidenceService();