# Manual local runbook

This guide starts the complete local development stack in separate PowerShell terminals. Run commands from the repository root (`E:\D\KubeDoctor`) unless a step says otherwise.

## What runs

- Docker Compose: PostgreSQL, Redis, and NATS JetStream.
- Minikube: local Kubernetes cluster for observing and scanning workloads.
- API: Express service on `http://localhost:4000`.
- Web: Vite dashboard on `http://127.0.0.1:5173/`.
- Observer: watches the selected Kubernetes cluster and processes resource events, incidents, evidence, and diagnoses.

The API and web app are not started by Docker Compose; start them in their own terminals as described below.

## One-time prerequisites

Install and start Docker Desktop, Node.js/npm, `kubectl`, and Minikube. In PowerShell, check that they are available:

```powershell
node --version
npm --version
docker version
kubectl version --client
minikube version
```

From the repository root, install dependencies once:

```powershell
npm install
```

The repository includes development environment files. Ensure:

- `apps/api/.env` uses `DATABASE_URL=postgresql://kubedoctor:kubedoctor@127.0.0.1:5433/kubedoctor`.
- `services/observer/.env` uses the same database URL, `NATS_URL=nats://localhost:4222`, `KUBE_CONTEXT=minikube`, and the selected cluster's ID as `CLUSTER_ID`.
- Keep `JWT_SECRET` development-only; use a secure secret outside local development.

The API reads `apps/api/.env`; the observer reads `services/observer/.env`.

## Start the project

### 1. Start infrastructure

In PowerShell terminal 1, at the repository root:

```powershell
docker compose up -d
docker compose ps
npm run db:migrate
```

Wait until PostgreSQL is healthy and PostgreSQL, Redis, and NATS are running.

### 2. Start Minikube

In PowerShell terminal 2:

```powershell
minikube start --driver=docker
minikube update-context
kubectl get nodes
```

Continue when the Minikube node reports `Ready`. The `minikube` kubeconfig context must be available to the API and observer processes.

### 3. Start the API

In PowerShell terminal 3, at the repository root:

```powershell
npm run dev:api
```

Keep the terminal open. Check API readiness in another terminal:

```powershell
Invoke-RestMethod http://localhost:4000/api/v1/ready
```

The response should report PostgreSQL and Redis as `ok`.

### 4. Start the dashboard

In PowerShell terminal 4, at the repository root:

```powershell
npm run dev:web
```

Open `http://127.0.0.1:5173/`, register or sign in, and add a cluster:

- Name: `local-minikube`
- Kubernetes context: select the listed `minikube` context
- Namespace: `default`

The dashboard tests the connection when registering. A healthy local setup reports one ready node and the available namespaces.

### 5. Configure and start the observer

The observer requires the ID of the cluster registered in the dashboard. In PowerShell terminal 5, retrieve cluster IDs:

```powershell
docker exec kubedoctor-postgres psql -U kubedoctor -d kubedoctor -c "SELECT c.id, c.name, c.kube_context, w.name AS workspace FROM clusters c JOIN workspaces w ON w.id = c.workspace_id ORDER BY c.created_at DESC;"
```

Edit `services/observer/.env` and set `CLUSTER_ID` to the ID for the cluster you just registered. Confirm these values are also set:

```text
DATABASE_URL=postgresql://kubedoctor:kubedoctor@127.0.0.1:5433/kubedoctor
NATS_URL=nats://localhost:4222
KUBE_CONTEXT=minikube
```

Then, at the repository root:

```powershell
npm run dev:observer
```

Keep this terminal open. The observer reconciles cluster state and consumes resource events from NATS.

### 6. Scan and view results

In the dashboard, select the registered cluster and click **Scan cluster**. The scan publishes Kubernetes resources; the observer processes them into snapshots and, when a rule matches, incidents and diagnoses.

The authenticated scan endpoint is:

```text
POST /api/v1/incidents/scan?clusterId=<cluster-id>&namespace=default
```

For local verification, check cluster status, pod inventory, and the incidents panel in the dashboard.

## Stop the project

In each terminal running the API, web app, or observer, press **Ctrl+C**. Then stop Minikube and the Compose services from the repository root:

```powershell
minikube stop
docker compose stop
```

These stop commands preserve database volumes and the Minikube cluster for the next run. Do not use `docker compose down -v` or `minikube delete` unless you intend to delete local data.
