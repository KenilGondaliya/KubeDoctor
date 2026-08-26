import { Router } from "express";

import {
  listWorkspaces,
  getWorkspace,
  create
} from "./workspace.controller.js";

import {
  authenticate
} from "../../middleware/auth.middleware.js";


const router = Router();


router.use(authenticate);


router.get(
  "/",
  listWorkspaces
);


router.post(
  "/",
  create
);


router.get(
  "/:workspaceId",
  getWorkspace
);


export default router;