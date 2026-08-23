export function summarizeContainerStatus(pod) {
  return (pod.status?.containerStatuses ?? []).map(c => ({
    name: c.name,
    ready: c.ready,
    restartCount: c.restartCount,
    image: c.image,
    state: c.state,
    lastState: c.lastState
  }));
}
