import express from "express";
import { getNamespacesController, getPodsController } from "../controllers/kubernetes.controller.js";


const router = express.Router();

router.get("/namespaces", getNamespacesController);

router.get("/pods", getPodsController);


export default router;