import crypto from 'crypto'
import Incident from '../models/Incident'
import logger from '../utils/logger'

class IncidentService {
  constructor() {
    this.activeIncidents = new Map();
  }

  generateFingerprint(resource, type, namespace) {
    const content = `${namespace}|${resource.kind}|${resource.name}|${type}`;
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 32);
  }

  async detectIncident(event) {
    try {
      const { resource, namespace, type } = event;
      
      // Determine incident type from event
      const incidentType = this.determineIncidentType(event);
      if (!incidentType) return null;

      // Check if incident already exists
      const fingerprint = this.generateFingerprint(resource, incidentType, namespace);
      
      let incident = await Incident.findOne({ 
        fingerprint, 
        status: { $in: ['DETECTED', 'INVESTIGATING', 'DIAGNOSED', 'RECOMMENDED', 'WAITING_APPROVAL', 'REMEDIATING', 'VERIFYING'] }
      });

      if (incident) {
        // Update existing incident
        incident.lastDetectedAt = new Date();
        await incident.save();
        logger.info(`Updated existing incident ${incident._id} for ${resource.name}`);
        return incident;
      }

      // Create new incident
      const severity = this.determineSeverity(incidentType);
      
      incident = new Incident({
        clusterId: event.clusterId || 'default',
        clusterName: 'default',
        namespace: namespace,
        resource: {
          kind: resource.kind,
          name: resource.name,
          uid: resource.uid,
          apiVersion: resource.apiVersion
        },
        workload: await this.determineWorkload(resource, namespace),
        type: incidentType,
        severity: severity,
        status: 'DETECTED',
        fingerprint: fingerprint,
        firstDetectedAt: new Date(),
        lastDetectedAt: new Date(),
        description: this.generateDescription(incidentType, resource)
      });

      await incident.save();
      this.activeIncidents.set(incident._id.toString(), incident);
      
      logger.info(`Created new incident ${incident._id} for ${resource.name}: ${incidentType}`);
      return incident;

    } catch (error) {
      logger.error('Error detecting incident:', error);
      return null;
    }
  }

  determineIncidentType(event) {
    const { type, rawData } = event;
    
    // Check for CrashLoopBackOff
    if (type === 'POD_MODIFIED' || type === 'POD_ADDED') {
      const pod = rawData;
      const containerStatuses = pod?.status?.containerStatuses || [];
      
      for (const container of containerStatuses) {
        if (container.state?.waiting?.reason === 'CrashLoopBackOff') {
          return 'CRASH_LOOP_BACKOFF';
        }
        if (container.state?.waiting?.reason === 'ImagePullBackOff') {
          return 'IMAGE_PULL_ERROR';
        }
        if (container.state?.waiting?.reason === 'ErrImagePull') {
          return 'IMAGE_PULL_ERROR';
        }
        if (container.lastState?.terminated?.reason === 'OOMKilled') {
          return 'OOM_KILLED';
        }
        if (container.state?.waiting?.reason === 'Pending') {
          return 'PENDING';
        }
      }
    }

    // Check events for probe failures
    if (type === 'KUBERNETES_EVENT') {
      const eventObj = rawData;
      const reason = eventObj?.reason || '';
      
      if (reason === 'Unhealthy' || reason === 'ReadinessProbeFailed' || reason === 'LivenessProbeFailed') {
        return 'PROBE_FAILURE';
      }
      if (reason === 'FailedMount' || reason === 'FailedAttachVolume') {
        return 'PVC_FAILURE';
      }
      if (reason === 'NetworkPolicyDenied') {
        return 'NETWORK_POLICY_DENIED';
      }
    }

    return null;
  }

  determineSeverity(incidentType) {
    const severityMap = {
      'CRASH_LOOP_BACKOFF': 'HIGH',
      'OOM_KILLED': 'HIGH',
      'IMAGE_PULL_ERROR': 'HIGH',
      'PENDING': 'MEDIUM',
      'PROBE_FAILURE': 'HIGH',
      'NO_ENDPOINTS': 'HIGH',
      'DNS_FAILURE': 'MEDIUM',
      'NETWORK_POLICY_DENIED': 'MEDIUM',
      'PVC_FAILURE': 'CRITICAL',
      'NODE_PRESSURE': 'CRITICAL'
    };
    return severityMap[incidentType] || 'MEDIUM';
  }

  generateDescription(incidentType, resource) {
    const descriptions = {
      'CRASH_LOOP_BACKOFF': `Pod ${resource.name} is in CrashLoopBackOff state`,
      'OOM_KILLED': `Pod ${resource.name} was killed due to Out of Memory`,
      'IMAGE_PULL_ERROR': `Pod ${resource.name} failed to pull container image`,
      'PENDING': `Pod ${resource.name} is stuck in Pending state`,
      'PROBE_FAILURE': `Pod ${resource.name} has failing health probes`,
      'NO_ENDPOINTS': `Service has no healthy endpoints`,
      'DNS_FAILURE': `DNS resolution failure detected`,
      'NETWORK_POLICY_DENIED': `Network policy blocking traffic`,
      'PVC_FAILURE': `Persistent volume claim failure`,
      'NODE_PRESSURE': `Node under pressure`
    };
    return descriptions[incidentType] || `Incident detected in ${resource.kind} ${resource.name}`;
  }

  async determineWorkload(resource, namespace) {
    // Try to find the owner reference (Deployment, StatefulSet, etc.)
    if (resource.rawData?.metadata?.ownerReferences) {
      for (const owner of resource.rawData.metadata.ownerReferences) {
        if (owner.kind === 'ReplicaSet' || owner.kind === 'StatefulSet' || owner.kind === 'DaemonSet') {
          // Could look up parent Deployment
          return {
            kind: owner.kind,
            name: owner.name,
            namespace: namespace
          };
        }
      }
    }
    
    // Try to infer from labels
    const labels = resource.rawData?.metadata?.labels || {};
    if (labels['app']) {
      return {
        kind: 'Deployment',
        name: labels['app'],
        namespace: namespace
      };
    }

    return null;
  }

  async getIncident(id) {
    return await Incident.findById(id);
  }

  async getIncidents(filters = {}) {
    const query = {};
    
    if (filters.status) query.status = filters.status;
    if (filters.clusterId) query.clusterId = filters.clusterId;
    if (filters.namespace) query.namespace = filters.namespace;
    if (filters.severity) query.severity = filters.severity;
    if (filters.type) query.type = filters.type;
    
    const sort = filters.sort || { firstDetectedAt: -1 };
    const limit = filters.limit || 100;
    const skip = filters.skip || 0;
    
    return await Incident.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('assignedTo', 'username email');
  }

  async updateIncidentStatus(id, status) {
    const incident = await Incident.findById(id);
    if (!incident) {
      throw new Error('Incident not found');
    }
    
    incident.updateStatus(status);
    await incident.save();
    
    return incident;
  }

  async resolveIncident(id) {
    const incident = await Incident.findById(id);
    if (!incident) {
      throw new Error('Incident not found');
    }
    
    incident.status = 'RESOLVED';
    incident.resolvedAt = new Date();
    await incident.save();
    
    this.activeIncidents.delete(id);
    return incident;
  }

  async addNote(id, userId, content) {
    const incident = await Incident.findById(id);
    if (!incident) {
      throw new Error('Incident not found');
    }
    
    incident.notes.push({
      content,
      createdBy: userId,
      createdAt: new Date()
    });
    
    await incident.save();
    return incident;
  }

  async getIncidentStats() {
    const stats = await Incident.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const severityStats = await Incident.aggregate([
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      }
    ]);
    
    return {
      byStatus: stats,
      bySeverity: severityStats,
      total: await Incident.countDocuments()
    };
  }

  async cleanupOldIncidents(days = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const result = await Incident.updateMany(
      { 
        resolvedAt: { $lt: cutoff },
        status: 'RESOLVED'
      },
      { isActive: false }
    );
    
    logger.info(`Cleaned up ${result.modifiedCount} old incidents`);
    return result;
  }
}

module.exports = new IncidentService();