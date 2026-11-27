# Local setup

1. Start Docker Desktop.
2. From the repository root, start infrastructure:
   `docker compose up -d`
3. Apply migrations:
   `npm run db:migrate`
4. Install dependencies:
   `npm install`
5. Start Minikube:
   `minikube start --driver=docker`
6. Verify Kubernetes access:
   `kubectl get nodes`
7. Start the API:
   `npm run dev:api`
8. Start the observer:
   `npm run dev:observer`
9. Start the web dashboard:
   `npm run dev:web`
10. Open `http://127.0.0.1:5173/`.

The API uses PostgreSQL, Redis, and NATS. Create or register an account in the dashboard, register the `minikube` context, then select **Scan cluster**.

## Test incidents
Deploy workloads with Kubernetes manifests, then run **Scan cluster** from the dashboard or call the authenticated API:

```text
POST /api/v1/incidents/scan?clusterId=<cluster-id>&namespace=default
```
