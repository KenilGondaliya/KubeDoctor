export function diagnoseNoEndpoints({ service, endpoint }) {
  if (!service || !endpoint) return null;
  const readyAddresses = (endpoint.subsets ?? []).reduce(
    (n, s) => n + (s.addresses?.length ?? 0),
    0,
  );
  if (readyAddresses !== 0) return null;
  return {
    rootCause: "SERVICE_HAS_NO_READY_ENDPOINTS",
    confidence: 0.92,
    evidence: [
      {
        type: "SERVICE",
        summary: `Service ${service.name} exists`,
        weight: 25,
      },
      {
        type: "ENDPOINT",
        summary: "Service has zero ready endpoints",
        weight: 60,
      },
    ],
    recommendations: [
      {
        action: "CHECK_SERVICE_SELECTOR_AND_POD_READINESS",
        risk: "LOW",
        reason:
          "Compare the Service selector to Pod labels and inspect Pod readiness.",
      },
    ],
  };
}
