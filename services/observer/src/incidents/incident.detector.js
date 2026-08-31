import {
  detectPodCrashLoop,
  isPodCrashLoopResolved,
  POD_CRASH_LOOP_PRIORITY,
} from "./rules/pod-crash-loop.rule.js";

import {
  detectOomKilled,
  OOM_KILLED_PRIORITY,
} from "./rules/oom-killed.rule.js";

const incidentRules = [
  {
    name: "OOM_KILLED",

    priority: OOM_KILLED_PRIORITY,

    detect: detectOomKilled,
  },

  {
    name: "POD_CRASH_LOOP",

    priority: POD_CRASH_LOOP_PRIORITY,

    detect: detectPodCrashLoop,
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
      return false;

    default:
      return false;
  }
}
