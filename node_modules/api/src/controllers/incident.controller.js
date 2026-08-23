import { scanNamespace, listIncidents } from '../services/incident.service.js';
import { Diagnosis } from '../models/diagnosis.model.js';

export async function scan(req, res) {
  try {
    const namespace = req.query.namespace || 'default';
    const result = await scanNamespace(namespace);
    res.json({ success: true, namespace, data: result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function incidents(req, res) {
  try { res.json({ success: true, data: await listIncidents() }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
}

export async function diagnosis(req, res) {
  try {
    const data = await Diagnosis.findById(req.params.id).lean();
    if (!data) return res.status(404).json({ success: false, message: 'Diagnosis not found' });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
}
