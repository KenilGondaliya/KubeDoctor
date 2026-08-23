import express from "express";
import {
  namespaces,
  pods,
  services,
  endpoints,
  deployments,
  events,
  nodes,
} from "../controllers/kubernetes.controller.js";

const router = express.Router();
router.get("/namespaces", namespaces);
router.get("/pods", pods);
router.get("/services", services);
router.get("/endpoints", endpoints);
router.get("/deployments", deployments);
router.get("/events", events);
router.get("/nodes", nodes);
export default router;
