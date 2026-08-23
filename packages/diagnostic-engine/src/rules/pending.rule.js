export function diagnosePending({ pod, events = [] }) {
  if (pod?.phase !== 'Pending') return null;
  const scheduling = events.find(e => /FailedScheduling/i.test(e.reason ?? ''));
  return {
    rootCause: scheduling ? 'POD_SCHEDULING_CONSTRAINT' : 'POD_PENDING',
    confidence: scheduling ? 0.88 : 0.7,
    evidence: [
      { type: 'POD_STATE', summary: 'Pod phase is Pending', weight: 40 },
      ...(scheduling ? [{ type: 'EVENT', summary: scheduling.message, weight: 48 }] : [])
    ],
    recommendations: [{ action: 'INSPECT_SCHEDULER_EVENTS', risk: 'LOW', reason: 'Check node capacity, taints/tolerations, affinity, selectors and PVC requirements.' }]
  };
}
