import { detectIncident } from "./incidents/incident.detector.js";

const event = {
  clusterId: "be297b5c-b9c3-46b9-8770-780e6f1f2459",

  resource: {
    kind: "Pod",

    uid: "a836a9da-7c75-42b6-b71b-458f79f3b162",

    name: "kubedoctor-pending-test",

    namespace: "default",

    spec: {
      nodeSelector: {
        "kubedoctor-test": "does-not-exist",
      },
    },

    status: {
      phase: "Pending",

      conditions: [
        {
          type: "PodScheduled",

          status: "False",

          reason: "Unschedulable",

          message:
            "0/1 nodes are available: 1 node(s) didn't match Pod's node affinity/selector.",
        },
      ],

      containerStatuses: [],
    },
  },
};

const incident = detectIncident(event);

console.log(JSON.stringify(incident, null, 2));
