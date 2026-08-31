import { detectIncident } from "./incidents/incident.detector.js";

const event = {
  clusterId: "be297b5c-b9c3-46b9-8770-780e6f1f2459",

  resource: {
    kind: "Pod",

    uid: "c5cbf90d-68e9-4e68-a1d8-941b5fb3b507",

    name: "kubedoctor-oom-test-744cdf8dbd-xlld4",

    namespace: "default",

    status: {
      containerStatuses: [
        {
          name: "memory-hog",

          restartCount: 6,

          state: {
            waiting: {
              reason: "CrashLoopBackOff",
            },
          },

          lastState: {
            terminated: {
              reason: "OOMKilled",

              exitCode: 1,
            },
          },
        },
      ],
    },
  },
};

const incident = detectIncident(event);

console.log(JSON.stringify(incident, null, 2));
