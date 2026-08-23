import express from "express";
import { getNamespacesController, getPodsController } from "../controllers/kubernetes.controllers.js";


const router = express.Router();

router.get("/namespaces", getNamespacesController);

router.get("/pods", getPodsController);


export default router;