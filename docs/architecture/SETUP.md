# Local setup

1. Start Docker Desktop.
2. Start Minikube: `minikube start --driver=docker`
3. Verify: `kubectl get nodes`
4. From repo root run `npm install`.
5. Start API: `npm run dev`
6. Start web in another terminal: `npm run dev:web`
7. Optional: start MongoDB locally. Set `MONGO_URI` in `apps/api/.env`.
8. Visit the Vite URL shown in the terminal.

## Test incidents
From repo root:
- `kubectl apply -f incidents/crash-loop/deployment.yaml`
- `kubectl apply -f incidents/image-pull/deployment.yaml`
- `kubectl apply -f incidents/pending/deployment.yaml`
- `kubectl apply -f incidents/service-endpoint/deployment.yaml`
- `kubectl apply -f incidents/probe-failure/deployment.yaml`

Then POST `/api/incidents/scan?namespace=default` to run the diagnostic scan.
