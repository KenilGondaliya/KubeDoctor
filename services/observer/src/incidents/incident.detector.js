import {
  detectPodCrashLoop,
  isPodCrashLoopResolved,
} from "./rules/pod-crash-loop.rule.js";

import { detectOomKilled } from "./rules/oom-killed.rule.js";

const incidentRules = [detectOomKilled, detectPodCrashLoop];

export function detectIncident(event) {
  for (const rule of incidentRules) {
    const incident = rule(event);

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

    /*
     * OOMKilled is a terminating event,
     * not a permanent Pod condition.
     *
     * Therefore we don't automatically
     * resolve OOMKilled from a single
     * Pod event yet.
     */
    case "OOM_KILLED":
      return false;

    default:
      return false;
  }
}
