# Architecture

React dashboard -> Express API -> Kubernetes service layer -> Kubernetes API.

Incidents are detected from cluster state. Evidence collectors gather relevant Pod, container, log, event, Service and Endpoint information. The diagnostic engine applies explainable rules and returns a root cause, confidence and recommended action. Remediation is intentionally separated from diagnosis so that risky actions can later require approval.

PostgreSQL stores application state, snapshots, incidents, evidence, and diagnoses. Kubernetes remains the source of truth for cluster state. Redis provides supporting infrastructure, while NATS JetStream distributes Kubernetes resource events to the observer and incident detector.
