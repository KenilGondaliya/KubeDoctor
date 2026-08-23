import { getNamespaces } from "../kubernetes/namespace.service.js";
import { getPods } from "../kubernetes/pod.service.js";
import { getServices, getEndpoints } from "../kubernetes/service.service.js";
import { getDeployments } from "../kubernetes/deployment.service.js";
import { getEvents } from "../kubernetes/event.service.js";
import { getNodes } from "../kubernetes/node.service.js";

export async function namespaces(req, res) {
  try {
    res.json({ success: true, data: await getNamespaces() });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}
export async function pods(req, res) {
  try {
    const namespace = req.query.namespace || "default";
    res.json({ success: true, namespace, data: await getPods(namespace) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}
export async function services(req, res) {
  try {
    const namespace = req.query.namespace || "default";
    res.json({ success: true, namespace, data: await getServices(namespace) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}
export async function endpoints(req, res) {
  try {
    const namespace = req.query.namespace || "default";
    res.json({ success: true, namespace, data: await getEndpoints(namespace) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}
export async function deployments(req, res) {
  try {
    const namespace = req.query.namespace || "default";
    res.json({
      success: true,
      namespace,
      data: await getDeployments(namespace),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}
export async function events(req, res) {
  try {
    const namespace = req.query.namespace || "default";
    res.json({ success: true, namespace, data: await getEvents(namespace) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}
export async function nodes(req, res) {
  try {
    res.json({ success: true, data: await getNodes() });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}
