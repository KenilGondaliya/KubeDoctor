import { Router } from "express";

import {
  create,
  list,
  get,
  remove,
  test
} from "./cluster.controller.js";

import {
  authenticate
} from "../../middleware/auth.middleware.js";

import {
  requireWorkspace
} from "../../middleware/workspace.middleware.js";

import {
  requireMinimumRole
} from "../../middleware/rbac.middleware.js";


const router = Router();


router.use(authenticate);

router.use(requireWorkspace);


router.get(
  "/",
  list
);


router.post(
  "/",
  requireMinimumRole("Engineer"),
  create
);


router.get(
  "/:clusterId",
  get
);


router.post(
  "/:clusterId/test",
  test
);


router.delete(
  "/:clusterId",
  requireMinimumRole("Admin"),
  remove
);


export default router;