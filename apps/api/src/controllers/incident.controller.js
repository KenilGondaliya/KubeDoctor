import {
  scanNamespace,
  getIncidents,
  getIncidentById,
} from "../services/incident.service.js";
import { Diagnosis } from "../models/diagnosis.model.js";

export async function listIncidents(req, res) {
  try {
    const { status, namespace, limit = 50 } = req.query;

    const incidents = await getIncidents({
      status,
      namespace,
      limit: Math.min(Number(limit) || 50, 100),
    });

    res.json({
      success: true,
      data: incidents,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch incidents",
    });
  }
}

export async function scan(req, res) {
  try {
    const namespace = req.query.namespace || "default";
    const result = await scanNamespace(namespace);
    res.json({ success: true, namespace, data: result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function getIncident(req, res) {
  try {
    const incident = await getIncidentById(req.params.id);

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: "Incident not found",
      });
    }

    res.json({
      success: true,
      data: incident,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch incident",
    });
  }
}

export async function diagnosis(req, res) {
  try {
    const data = await Diagnosis.findById(req.params.id).lean();
    if (!data)
      return res
        .status(404)
        .json({ success: false, message: "Diagnosis not found" });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}
