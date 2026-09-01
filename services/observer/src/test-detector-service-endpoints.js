import { detectIncident } from "./incidents/incident.detector.js";


const event = {
  clusterId:
    "be297b5c-b9c3-46b9-8770-780e6f1f2459",

  resource: {
    kind:
      "Service",

    uid:
      "c9370a98-6663-4e01-baec-28f50a41d5ef",

    name:
      "kubedoctor-no-endpoints-test",

    namespace:
      "default",

    spec: {
      selector: {
        app:
          "kubedoctor-no-endpoints-test",
      },
    },
  },

  endpointSlices: [
    {
      uid:
        "477d4db6-89d5-4487-a852-e01de84009fc",

      name:
        "kubedoctor-no-endpoints-test-6mnzs",

      resource: {
        raw: {
          kind:
            "EndpointSlice",

          endpoints: [
            {
              addresses: [
                "10.244.0.38",
              ],

              conditions: {
                ready:
                  false,

                serving:
                  false,

                terminating:
                  false,
              },

              targetRef: {
                kind:
                  "Pod",

                name:
                  "kubedoctor-no-endpoints-test-84647f7bb-gzs6z",

                namespace:
                  "default",

                uid:
                  "a0e2af7c-4bd5-471d-b42b-004d25eafadf",
              },
            },
          ],
        },
      },
    },
  ],
};


console.log(
  JSON.stringify(
    detectIncident(event),
    null,
    2,
  ),
);