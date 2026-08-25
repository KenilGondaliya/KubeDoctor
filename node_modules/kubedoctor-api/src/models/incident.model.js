import mongoose from 'mongoose'

const incidentSchema = new mongoose.Schema({
  clusterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cluster',
    required: true
  },
  clusterName: {
    type: String,
    required: true
  },
  namespace: {
    type: String,
    required: true
  },
  resource: {
    kind: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    uid: {
      type: String
    },
    apiVersion: String
  },
  workload: {
    kind: {
      type: String
    },
    name: {
      type: String
    },
    namespace: {
      type: String
    }
  },
  type: {
    type: String,
    required: true,
    enum: [
      'CRASH_LOOP_BACKOFF',
      'OOM_KILLED',
      'IMAGE_PULL_ERROR',
      'PENDING',
      'PROBE_FAILURE',
      'NO_ENDPOINTS',
      'DNS_FAILURE',
      'NETWORK_POLICY_DENIED',
      'PVC_FAILURE',
      'NODE_PRESSURE',
      'UNKNOWN'
    ]
  },
  severity: {
    type: String,
    enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
    default: 'MEDIUM'
  },
  status: {
    type: String,
    enum: [
      'DETECTED',
      'INVESTIGATING',
      'DIAGNOSED',
      'RECOMMENDED',
      'WAITING_APPROVAL',
      'REMEDIATING',
      'VERIFYING',
      'RESOLVED',
      'FAILED'
    ],
    default: 'DETECTED'
  },
  fingerprint: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String
  },
  firstDetectedAt: {
    type: Date,
    default: Date.now
  },
  lastDetectedAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  evidenceCount: {
    type: Number,
    default: 0
  },
  diagnosis: {
    rootCause: {
      code: String,
      title: String,
      description: String
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    evidenceIds: [String],
    alternatives: [{
      title: String,
      confidence: Number
    }],
    model: String,
    analyzedAt: Date
  },
  recommendation: {
    action: String,
    description: String,
    risk: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    },
    target: {
      kind: String,
      name: String,
      namespace: String
    }
  },
  remediation: {
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXECUTING', 'SUCCESS', 'FAILED']
    },
    action: String,
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    executedAt: Date,
    result: String
  },
  verification: {
    status: {
      type: String,
      enum: ['PENDING', 'VERIFYING', 'SUCCESS', 'FAILED', 'TIMEOUT']
    },
    checks: [{
      name: String,
      status: String,
      details: String,
      timestamp: Date
    }],
    completedAt: Date
  },
  tags: [String],
  notes: [{
    content: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for common queries
incidentSchema.index({ clusterId: 1, status: 1 });
incidentSchema.index({ clusterId: 1, namespace: 1 });
incidentSchema.index({ fingerprint: 1 });
incidentSchema.index({ firstDetectedAt: -1 });
incidentSchema.index({ status: 1, severity: 1 });

// Method to update status with validation
incidentSchema.methods.updateStatus = function(newStatus) {
  const validTransitions = {
    DETECTED: ['INVESTIGATING', 'RESOLVED'],
    INVESTIGATING: ['DIAGNOSED', 'FAILED'],
    DIAGNOSED: ['RECOMMENDED', 'FAILED'],
    RECOMMENDED: ['WAITING_APPROVAL', 'REMEDIATING'],
    WAITING_APPROVAL: ['REMEDIATING', 'RESOLVED'],
    REMEDIATING: ['VERIFYING', 'FAILED'],
    VERIFYING: ['RESOLVED', 'FAILED'],
    RESOLVED: ['DETECTED']
  };

  if (!validTransitions[this.status] || !validTransitions[this.status].includes(newStatus)) {
    throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
  }

  this.status = newStatus;
  
  if (newStatus === 'RESOLVED') {
    this.resolvedAt = new Date();
  }

  return this;
};

const Incident = mongoose.model('Incident', incidentSchema);

module.exports = Incident;