import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "/api/v1";

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("kubedoctor-session")) || null;
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState(readSession);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "", workspaceName: "" });
  const [authError, setAuthError] = useState("");

  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState(session?.workspace?.id || "");
  const [clusters, setClusters] = useState([]);
  const [clusterId, setClusterId] = useState("");
  const [pods, setPods] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState({});
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [clusterFormOpen, setClusterFormOpen] = useState(false);
  const [clusterForm, setClusterForm] = useState({ name: "local-minikube", kubeContext: "minikube", namespace: "default" });

  async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        ...(workspaceId ? { "X-Workspace-Id": workspaceId } : {}),
        ...(clusterId ? { "X-Cluster-Id": clusterId } : {}),
        ...options.headers,
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.error?.message || "Request failed");
    }
    return body;
  }

  async function authenticate(event) {
    event.preventDefault();
    setAuthError("");
    try {
      const path = authMode === "register" ? "/auth/register" : "/auth/login";
      const body = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm),
      }).then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error?.message || "Authentication failed");
        return result;
      });
      const nextSession = {
        accessToken: body.data.accessToken,
        refreshToken: body.data.refreshToken,
        user: body.data.user,
        workspace: body.data.workspace,
      };
      localStorage.setItem("kubedoctor-session", JSON.stringify(nextSession));
      setSession(nextSession);
      setWorkspaceId(nextSession.workspace?.id || "");
    } catch (error) {
      setAuthError(error.message);
    }
  }

  async function loadWorkspaceData() {
    if (!session?.accessToken) return;
    setLoading(true);
    setNotice("");
    try {
      const workspaceResponse = await api("/workspaces");
      const workspaceList = workspaceResponse.data.workspaces;
      setWorkspaces(workspaceList);
      const activeWorkspace = workspaceId || workspaceList[0]?.id;
      if (activeWorkspace) setWorkspaceId(activeWorkspace);

      if (activeWorkspace) {
        const clusterResponse = await api(`/workspaces/${activeWorkspace}/clusters`);
        const clusterList = clusterResponse.data.clusters;
        setClusters(clusterList);
        const activeCluster = clusterId || clusterList[0]?.id;
        if (activeCluster) setClusterId(activeCluster);
        await loadClusterData(activeCluster);
      }
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadClusterData(activeClusterId = clusterId) {
    if (!activeClusterId) return;
    setLoading(true);
    try {
      const [podResponse, incidentResponse, statsResponse] = await Promise.all([
        api(`/kubernetes/pods?clusterId=${activeClusterId}&namespace=default`),
        api(`/incidents?clusterId=${activeClusterId}`),
        api(`/incidents/stats?clusterId=${activeClusterId}`),
      ]);
      setPods(podResponse.data.pods || []);
      setIncidents(incidentResponse.data.incidents || []);
      setStats(statsResponse.data.stats || {});
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function scanCluster() {
    if (!clusterId) {
      setNotice("Add or select a cluster first.");
      return;
    }

    async function createCluster(event) {
      event.preventDefault();
      try {
        const response = await api(`/workspaces/${workspaceId}/clusters`, {
          method: "POST",
          body: JSON.stringify({
            name: clusterForm.name,
            connectionType: "kubeconfig",
            kubeContext: clusterForm.kubeContext,
            namespace: clusterForm.namespace,
          }),
        });
        setClusterFormOpen(false);
        setClusters((current) => [...current, response.data.cluster]);
        setClusterId(response.data.cluster.id);
        setNotice("Cluster registered. Run a scan to collect resources.");
      } catch (error) {
        setNotice(error.message);
      }
    }
    setLoading(true);
    setNotice("");
    try {
      const result = await api(`/incidents/scan?clusterId=${clusterId}&namespace=default`, { method: "POST" });
      setNotice(`Scan published ${result.data.published} Kubernetes resources.`);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await loadClusterData(clusterId);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function openIncident(id) {
    try {
      const response = await api(`/incidents/${id}`);
      setSelectedIncident(response.data);
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function updateIncidentStatus(status) {
    if (!selectedIncident?.incident) return;
    try {
      await api(`/incidents/${selectedIncident.incident.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setSelectedIncident(null);
      await loadClusterData(clusterId);
    } catch (error) {
      setNotice(error.message);
    }
  }

  function logout() {
    localStorage.removeItem("kubedoctor-session");
    setSession(null);
    setWorkspaceId("");
    setClusters([]);
    setClusterId("");
  }

  useEffect(() => {
    if (session?.accessToken) loadWorkspaceData();
  }, [session?.accessToken]);

  useEffect(() => {
    if (session?.accessToken && workspaceId) {
      api(`/workspaces/${workspaceId}/clusters`)
        .then((response) => {
          setClusters(response.data.clusters);
          if (!clusterId && response.data.clusters[0]) {
            setClusterId(response.data.clusters[0].id);
          }
        })
        .catch((error) => setNotice(error.message));
    }
  }, [workspaceId]);

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-mark">KD</div>
          <h1>KubeDoctor</h1>
          <p>Evidence-driven Kubernetes diagnostics</p>
          <div className="auth-tabs">
            <button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>Sign in</button>
            <button className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>Create account</button>
          </div>
          <form onSubmit={authenticate}>
            {authMode === "register" && (
              <label>Workspace<input value={authForm.workspaceName} onChange={(e) => setAuthForm({ ...authForm, workspaceName: e.target.value })} placeholder="Platform Team" /></label>
            )}
            <label>Email<input type="email" required value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="you@example.com" /></label>
            <label>Password<input type="password" required minLength={8} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder="At least 8 characters" /></label>
            {authError && <div className="error">{authError}</div>}
            <button className="primary" type="submit">{authMode === "register" ? "Create workspace" : "Sign in"}</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header>
        <div>
          <div className="eyebrow">KUBEDOCTOR</div>
          <h1>Operations overview</h1>
        </div>
        <div className="header-actions">
          <select value={workspaceId} onChange={(e) => { setWorkspaceId(e.target.value); setClusterId(""); }}>
            {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </select>
          <select value={clusterId} onChange={(e) => { setClusterId(e.target.value); loadClusterData(e.target.value); }}>
            {clusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.name}</option>)}
          </select>
          <button className="secondary" onClick={() => setClusterFormOpen(true)}>Add cluster</button>
          <button className="secondary" onClick={logout}>Sign out</button>
        </div>
      </header>

      {notice && <div className="notice">{notice}</div>}

      <section className="metrics">
        <article><span>Pods</span><strong>{pods.length}</strong><small>default namespace</small></article>
        <article><span>Open incidents</span><strong>{stats.open || 0}</strong><small>requires review</small></article>
        <article><span>Critical</span><strong>{stats.critical || 0}</strong><small>high-priority findings</small></article>
        <article><span>Clusters</span><strong>{clusters.length}</strong><small>configured workspaces</small></article>
      </section>

      <section className="actions">
        <button className="primary" onClick={scanCluster} disabled={loading}>{loading ? "Scanning..." : "Scan cluster"}</button>
        <button className="secondary" onClick={() => loadClusterData(clusterId)} disabled={loading}>Refresh</button>
      </section>

      <section className="grid">
        <article className="panel">
          <div className="panel-heading"><div><span>Workload inventory</span><h2>Pods</h2></div></div>
          {pods.length === 0 ? <p className="empty">No pods found in the default namespace.</p> : (
            <div className="table-wrap"><table><thead><tr><th>Name</th><th>Phase</th><th>Restarts</th><th>Node</th></tr></thead><tbody>
              {pods.map((pod) => {
                const resource = pod.resource || {};
                const restarts = (resource.status?.containerStatuses || []).reduce((sum, item) => sum + (item.restartCount || 0), 0);
                return <tr key={pod.uid}><td>{pod.name}</td><td><span className={`status ${resource.status?.phase?.toLowerCase()}`}>{resource.status?.phase || "Unknown"}</span></td><td>{restarts}</td><td>{resource.spec?.nodeName || "-"}</td></tr>;
              })}
            </tbody></table></div>
          )}
        </article>

        <article className="panel incidents-panel">
          <div className="panel-heading"><div><span>Detection feed</span><h2>Incidents</h2></div><span className="count">{incidents.length}</span></div>
          {incidents.length === 0 ? <p className="empty">No incidents detected.</p> : incidents.map((incident) => (
            <button className="incident" key={incident.id} onClick={() => openIncident(incident.id)}>
              <span className={`severity ${incident.severity.toLowerCase()}`}>{incident.severity}</span>
              <span className="incident-copy"><strong>{incident.title}</strong><small>{incident.resource_kind}/{incident.resource_name}</small></span>
              <span className="incident-status">{incident.status}</span>
            </button>
          ))}
        </article>
      </section>

      {selectedIncident && (
        <div className="modal-backdrop" onClick={() => setSelectedIncident(null)}>
          <section className="modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedIncident(null)}>×</button>
            <span className={`severity ${selectedIncident.incident.severity.toLowerCase()}`}>{selectedIncident.incident.severity}</span>
            <h2>{selectedIncident.incident.title}</h2>
            <p>{selectedIncident.incident.description}</p>
            {selectedIncident.diagnosis && (
              <div className="diagnosis">
                <span>Primary cause</span>
                <strong>{selectedIncident.diagnosis.primary_cause}</strong>
                <p>{selectedIncident.diagnosis.summary}</p>
                <small>Confidence {Math.round(Number(selectedIncident.diagnosis.confidence) * 100)}%</small>
              </div>
            )}

            {clusterFormOpen && (
              <div className="modal-backdrop" onClick={() => setClusterFormOpen(false)}>
                <section className="modal small-modal" onClick={(event) => event.stopPropagation()}>
                  <button className="modal-close" onClick={() => setClusterFormOpen(false)}>×</button>
                  <h2>Register cluster</h2>
                  <p>Use a context from your local kubeconfig.</p>
                  <form className="cluster-form" onSubmit={createCluster}>
                    <label>Cluster name<input required value={clusterForm.name} onChange={(e) => setClusterForm({ ...clusterForm, name: e.target.value })} /></label>
                    <label>Kube context<input required value={clusterForm.kubeContext} onChange={(e) => setClusterForm({ ...clusterForm, kubeContext: e.target.value })} /></label>
                    <label>Namespace<input value={clusterForm.namespace} onChange={(e) => setClusterForm({ ...clusterForm, namespace: e.target.value })} /></label>
                    <button className="primary" type="submit">Register cluster</button>
                  </form>
                </section>
              </div>
            )}
            <h3>Evidence</h3>
            {selectedIncident.evidence.length === 0 ? <p className="empty">No evidence recorded.</p> : (
              <div className="evidence-list">
                {selectedIncident.evidence.map((item) => <article key={item.id}><strong>{item.evidence_type}</strong><p>{item.summary}</p></article>)}
              </div>
            )}
            <div className="modal-actions">
              {selectedIncident.incident.status !== "ACKNOWLEDGED" && <button className="secondary" onClick={() => updateIncidentStatus("ACKNOWLEDGED")}>Acknowledge</button>}
              {selectedIncident.incident.status !== "RESOLVED" && <button className="primary" onClick={() => updateIncidentStatus("RESOLVED")}>Resolve</button>}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
