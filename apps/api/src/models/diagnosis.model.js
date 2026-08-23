import mongoose from 'mongoose';

const evidenceSchema = new mongoose.Schema({
  type: String,
  summary: String,
  value: mongoose.Schema.Types.Mixed,
  weight: Number
}, { _id: false });

const diagnosisSchema = new mongoose.Schema({
  incidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true },
  rootCause: String,
  confidence: Number,
  evidence: [evidenceSchema],
  recommendations: [{ action: String, risk: String, reason: String }]
}, { timestamps: true });

export const Diagnosis = mongoose.models.Diagnosis || mongoose.model('Diagnosis', diagnosisSchema);
