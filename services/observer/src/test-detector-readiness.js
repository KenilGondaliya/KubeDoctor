import { detectIncident } from "./incidents/incident.detector.js";

const event = {
  clusterId:
    "be297b5c-b9c3-46b9-8770-780e6f1f2459",

  resource: {
    kind: "Pod",

    uid:
      "729824d6-2337-461a-ac06-365748649c87",

    name:
      "kubedoctor-readiness-test-5dbbb675f8-w5kkp",

    namespace:
      "default",

    status: {
      phase:
        "Running",

      conditions: [
        {
          type:
            "PodReadyToStartContainers",

          status:
            "True",
        },

        {
          type:
            "Initialized",

          status:
            "True",
        },

        {
          type:
            "Ready",

          status:
            "False",

          reason:
            "ContainersNotReady",

          message:
            "containers with unready status: [readiness-test]",
        },

        {
          type:
            "ContainersReady",

          status:
            "False",

          reason:
            "ContainersNotReady",

          message:
            "containers with unready status: [readiness-test]",
        },

        {
          type:
            "PodScheduled",

          status:
            "True",
        },
      ],

      containerStatuses: [
        {
          name:
            "readiness-test",

          ready:
            false,

          restartCount:
            0,

          state: {
            running: {},
          },
        },
      ],
    },
  },
};

const incident =
  detectIncident(event);

console.log(
  JSON.stringify(
    incident,
    null,
    2,
  ),
);