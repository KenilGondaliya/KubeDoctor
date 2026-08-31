import { detectIncident } from "./incidents/incident.detector.js";

const event = {
  clusterId:
    "be297b5c-b9c3-46b9-8770-780e6f1f2459",

  resource: {
    kind: "Pod",

    uid:
      "607b3a6c-9d20-4f25-9f7a-05d2215b3246",

    name:
      "kubedoctor-image-pull-test-7bb5f5bcbb-mk5nm",

    namespace:
      "default",

    status: {
      containerStatuses: [
        {
          name:
            "broken-image",

          image:
            "kubedoctor/non-existent-image:999999",

          state: {
            waiting: {
              reason:
                "ImagePullBackOff",

              message:
                "Back-off pulling image kubedoctor/non-existent-image:999999",
            },
          },

          restartCount: 0,
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