import express from "express";

import {
    getDiagnosis
} from "../controllers/diagnosis.controller.js";

const router =
    express.Router();

router.get(
    "/:incidentId",
    getDiagnosis
);

export default router;