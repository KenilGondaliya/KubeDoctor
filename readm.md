                             ┌──────────────────────┐
                             │      React Web       │
                             │      Dashboard       │
                             └──────────┬───────────┘
                                        │
                                   HTTPS / WS
                                        │
                             ┌──────────▼───────────┐
                             │    API Gateway       │
                             │      Express         │
                             └──────────┬───────────┘
                                        │
              ┌─────────────────────────┼────────────────────────┐
              │                         │                        │
              ▼                         ▼                        ▼
       Cluster Manager          Incident Manager          User/RBAC
              │                         │                        │
              └─────────────────────────┼────────────────────────┘
                                        │
                           ┌────────────▼─────────────┐
                           │      Job / Queue         │
                           │      Redis + BullMQ      │
                           └────────────┬─────────────┘
                                        │
                           ┌────────────▼─────────────┐
                           │   Diagnostic Workers     │
                           └────────────┬─────────────┘
                                        │
                 ┌──────────────────────┼──────────────────────────┐
                 │                      │                          │
                 ▼                      ▼                          ▼
        Kubernetes Client        Evidence Engine            Metrics Engine
                 │                      │                          │
                 └──────────────────────┼──────────────────────────┘
                                        │
                                        ▼
                                Diagnosis Engine
                                        │
                           ┌────────────┴────────────┐
                           ▼                         ▼
                    Rule Engine                Evidence Graph
                           │                         │
                           └────────────┬────────────┘
                                        ▼
                                  RCA Engine
                                        │
                                        ▼
                               Recommendation
                                        │
                                  Risk Engine
                                        │
                           ┌────────────┴────────────┐
                           ▼                         ▼
                     Auto Remediation          Human Approval
                           │                         │
                           └────────────┬────────────┘
                                        ▼
                                  Remediation
                                        │
                                        ▼
                                 Verify Recovery



                         Kubernetes Cluster
                                  │
        ┌─────────────────────────┼───────────────────────────┐
        ▼                         ▼                           ▼
      Workloads                Networking                 Cluster
        │                         │                           │
     Pods                       Services                    Nodes
     Deployments                Ingress                     Events
     ReplicaSets                Endpoints                   Metrics
     Jobs                       NetworkPolicy               HPA
     CronJobs                   DNS                         Storage
     ConfigMaps
     Secrets