import { detectIncident } from "./incidents/incident.detector.js";


const event = {
  clusterId:
    "be297b5c-b9c3-46b9-8770-780e6f1f2459",

  resource: {
    kind:
      "Deployment",

    uid:
      "39c75fa4-fb26-4fde-b92a-f95b28154e27",

    name:
      "kubedoctor-liveness-test",

    namespace:
      "default",

    status: {
      replicas: 1,

      updatedReplicas: 1,

      availableReplicas: 0,

      unavailableReplicas: 1,

      conditions: [
        {
          type:
            "Progressing",

          status:
            "True",

          reason:
            "NewReplicaSetAvailable",
        },

        {
          type:
            "Available",

          status:
            "False",

          reason:
            "MinimumReplicasUnavailable",

          message:
            "Deployment does not have minimum availability.",
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