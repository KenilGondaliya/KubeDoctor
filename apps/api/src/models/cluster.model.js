import mongoose from 'mongoose'

const clusterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  kubeconfig: {
    type: String,
    required: true
  },
  context: {
    type: String
  },
  server: {
    type: String
  },
  status: {
    type: String,
    enum: ['CONNECTED', 'DISCONNECTED', 'ERROR', 'PENDING'],
    default: 'PENDING'
  },
  lastHealthCheck: {
    type: Date
  },
  health: {
    type: String,
    enum: ['HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN'],
    default: 'UNKNOWN'
  },
  metadata: {
    version: String,
    nodes: Number,
    namespaces: Number
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
clusterSchema.index({ name: 1 });
clusterSchema.index({ status: 1 });

const Cluster = mongoose.model('Cluster', clusterSchema);

module.exports = Cluster;