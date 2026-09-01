const SERVICE_NO_ENDPOINTS =
  "SERVICE_NO_ENDPOINTS";


function getSelector(event) {
  return (
    event?.resource?.spec?.selector ||
    event?.resource?.raw?.spec?.selector ||
    {}
  );
}


function getEndpointSlices(event) {
  return event?.endpointSlices || [];
}


function getReadyEndpointCount(endpointSlices) {
  let ready = 0;

  for (const slice of endpointSlices) {
    const raw =
      slice?.resource?.raw ||
      slice?.resource ||
      slice ||
      {};

    const endpoints =
      Array.isArray(raw.endpoints)
        ? raw.endpoints
        : [];

    for (const endpoint of endpoints) {
      const conditions =
        endpoint?.conditions || {};

      /*
       * Kubernetes EndpointSlice:
       *
       * ready=true means this endpoint is
       * considered ready for normal traffic.
       *
       * Older/missing condition is treated
       * conservatively as not-ready.
       */
      if (
        conditions.ready === true
      ) {
        ready++;
      }
    }
  }

  return ready;
}


function getTotalEndpointCount(endpointSlices) {
  let total = 0;

  for (const slice of endpointSlices) {
    const raw =
      slice?.resource?.raw ||
      slice?.resource ||
      slice ||
      {};

    const endpoints =
      Array.isArray(raw.endpoints)
        ? raw.endpoints
        : [];

    total += endpoints.length;
  }

  return total;
}


export function detectServiceNoEndpoints(event) {
  if (
    event?.resource?.kind !==
    "Service"
  ) {
    return null;
  }


  const {
    uid,
    name,
    namespace,
  } = event.resource;


  if (
    !uid ||
    !name
  ) {
    return null;
  }


  const selector =
    getSelector(event);


  /*
   * A Service without a selector can be
   * manually backed by EndpointSlices.
   *
   * Do not report that as a selector
   * failure here.
   */
  const endpointSlices =
    getEndpointSlices(event);


  const totalEndpoints =
    getTotalEndpointCount(
      endpointSlices,
    );


  const readyEndpoints =
    getReadyEndpointCount(
      endpointSlices,
    );


  /*
   * No EndpointSlices at all.
   */
  if (
    endpointSlices.length === 0
  ) {
    return {
      incidentType:
        SERVICE_NO_ENDPOINTS,

      resourceUid:
        uid,

      resourceKind:
        "Service",

      resourceName:
        name,

      namespace:
        namespace || null,

      severity:
        "HIGH",

      title:
        `Service ${name} has no endpoints`,

      description:
        `Service ${name} has no EndpointSlices providing backends.`,

      evidence: {
        selector,

        endpointSliceCount:
          0,

        totalEndpoints:
          0,

        readyEndpoints:
          0,

        reason:
          "NO_ENDPOINT_SLICES",
      },
    };
  }


  /*
   * EndpointSlices exist, but none of their
   * endpoints are ready.
   */
  if (
    readyEndpoints === 0
  ) {
    return {
      incidentType:
        SERVICE_NO_ENDPOINTS,

      resourceUid:
        uid,

      resourceKind:
        "Service",

      resourceName:
        name,

      namespace:
        namespace || null,

      severity:
        "HIGH",

      title:
        `Service ${name} has no ready endpoints`,

      description:
        `Service ${name} has EndpointSlices, but none of the endpoints are currently ready to receive traffic.`,

      evidence: {
        selector,

        endpointSliceCount:
          endpointSlices.length,

        totalEndpoints,

        readyEndpoints,

        reason:
          "NO_READY_ENDPOINTS",

        endpointSlices:
          endpointSlices.map(
            (slice) => {
              const raw =
                slice?.resource?.raw ||
                slice?.resource ||
                slice ||
                {};

              return {
                uid:
                  raw.metadata?.uid ||
                  slice.uid ||
                  null,

                name:
                  raw.metadata?.name ||
                  slice.name ||
                  null,

                endpoints:
                  (
                    Array.isArray(
                      raw.endpoints,
                    )
                      ? raw.endpoints
                      : []
                  ).map(
                    (endpoint) => ({
                      addresses:
                        endpoint.addresses ||
                        [],

                      ready:
                        endpoint?.conditions
                          ?.ready ??
                        false,

                      serving:
                        endpoint?.conditions
                          ?.serving ??
                        false,

                      terminating:
                        endpoint?.conditions
                          ?.terminating ??
                        false,

                      targetRef:
                        endpoint.targetRef ||
                        null,
                    }),
                  ),
              };
            },
          ),
      },
    };
  }


  return null;
}


export const SERVICE_NO_ENDPOINTS_PRIORITY =
  85;