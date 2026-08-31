import {
  detectPodCrashLoop,
  isPodCrashLoopResolved,
  POD_CRASH_LOOP_PRIORITY,
} from "./rules/pod-crash-loop.rule.js";

import {
  detectOomKilled,
  OOM_KILLED_PRIORITY,
} from "./rules/oom-killed.rule.js";

import {
  detectImagePullFailure,
  IMAGE_PULL_FAILURE_PRIORITY,
} from "./rules/image-pull.rule.js";

import {
  detectPodPending,
  POD_PENDING_PRIORITY,
} from "./rules/pod-pending.rule.js";

const incidentRules = [
  {
    name: "OOM_KILLED",

    priority: OOM_KILLED_PRIORITY,

    detect: detectOomKilled,
  },

  {
    name: "IMAGE_PULL_FAILURE",

    priority: IMAGE_PULL_FAILURE_PRIORITY,

    detect: detectImagePullFailure,
  },

  {
    name: "POD_CRASH_LOOP",

    priority: POD_CRASH_LOOP_PRIORITY,

    detect: detectPodCrashLoop,
  },

  {
    name: "POD_PENDING",

    priority: POD_PENDING_PRIORITY,

    detect: detectPodPending,
  },
];

incidentRules.sort((a, b) => b.priority - a.priority);

export function detectIncident(event) {
  for (const rule of incidentRules) {
    const incident = rule.detect(event);

    if (incident) {
      return incident;
    }
  }

  return null;
}

export function isIncidentResolved(event, incidentType) {
  switch (incidentType) {
    case "POD_CRASH_LOOP":
      return isPodCrashLoopResolved(event);

    case "OOM_KILLED":
      /*
       * OOMKilled is an observed termination
       * event, not a persistent waiting state.
       *
       * We will resolve it using workload
       * health/recovery logic later.
       */
      return false;

    case "IMAGE_PULL_FAILURE":
      return false;

    case "POD_PENDING":
      return (
        event?.resource?.kind === "Pod" &&
        event?.resource?.status?.phase !== "Pending"
      );

    default:
      return false;
  }
}
