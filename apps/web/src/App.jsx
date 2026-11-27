import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "/api/v1";
let refreshRequest = null;

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`API returned an invalid response (${response.status})`);
  }
}

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
  const [clusterModal, setClusterModal] = useState(false);
  const [workspaceModal, setWorkspaceModal] = useState(false);
  const [clusterForm, setClusterForm] = useState({
    name: "local-minikube",
    kubeContext: "minikube",
    namespace: "default",
  });
  const [kubeContexts, setKubeContexts] = useState([]);
  const [contextsLoading, setContextsLoading] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");

  async function api(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...options.headers,
    };
    let response = await fetch(`${API}${path}`, { ...options, headers });
    if (
      response.status === 401 &&
      session?.refreshToken &&
      path !== "/auth/refresh"
    ) {
      try {
        if (!refreshRequest) {
          refreshRequest = fetch(`${API}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: session.refreshToken }),
          })
            .then(async (refreshResponse) => {
              const result = await readJsonResponse(refreshResponse);
              if (!refreshResponse.ok) {
                throw new Error(result?.error?.message || "Session expired. Sign in again.");
              }
              return result.data;
            })
            .finally(() => {
              refreshRequest = null;
            });
        }
        const refreshed = await refreshRequest;
        const nextSession = { ...session, ...refreshed };
        localStorage.setItem("kubedoctor-session", JSON.stringify(nextSession));
        setSession(nextSession);
        response = await fetch(`${API}${path}`, {
          ...options,
          headers: {
            ...headers,
            Authorization: `Bearer ${refreshed.accessToken}`,
          },
        });
      } catch (error) {
        localStorage.removeItem("kubedoctor-session");
        setSession(null);
        throw error;
      }
    }
    const body = await readJsonResponse(response);
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
      const body = await api(path, {
        method: "POST",
        body: JSON.stringify(authForm),
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

  async function loadWorkspaces(activeWorkspaceId = workspaceId) {
    if (!session?.accessToken) return;
    const response = await api("/workspaces");
    const workspaceList = response.data.workspaces;
    setWorkspaces(workspaceList);
    const nextWorkspaceId = activeWorkspaceId || workspaceList[0]?.id || "";
    if (nextWorkspaceId) {
      setWorkspaceId(nextWorkspaceId);
      await loadClusters(nextWorkspaceId);
    } else {
      setWorkspaceId("");
      setClusters([]);
      setClusterId("");
    }
  }

  async function loadClusters(activeWorkspaceId = workspaceId, preferredClusterId = clusterId) {
    if (!activeWorkspaceId) return;
    const response = await api(`/workspaces/${activeWorkspaceId}/clusters`);
    const clusterList = response.data.clusters;
    setClusters(clusterList);
    const nextClusterId = clusterList.some((item) => item.id === preferredClusterId)
      ? preferredClusterId
      : clusterList[0]?.id || "";
    setClusterId(nextClusterId);
    if (nextClusterId) await loadClusterData(nextClusterId);
  }

  async function loadClusterData(activeClusterId = clusterId) {
    if (!activeClusterId) {
      setPods([]);
      setIncidents([]);
      setStats({});
      return;
    }
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

  async function createWorkspace(event) {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    try {
      const response = await api("/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: workspaceName }),
      });
      const workspace = response.data.workspace;
      setWorkspaceModal(false);
      setWorkspaceName("");
      await loadWorkspaces(workspace.id);
      setNotice(`Workspace "${workspace.name}" created.`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function createCluster(event) {
    event.preventDefault();
    if (!workspaceId) {
      setNotice("Create or select a workspace first.");
      return;
    }
    setLoading(true);
    setNotice("");
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
      setClusterModal(false);
      setClusters((current) => [response.data.cluster, ...current]);
      setClusterId(response.data.cluster.id);
      setNotice(`Cluster "${response.data.cluster.name}" registered.`);
      await testCluster(response.data.cluster.id);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function openClusterModal() {
    setClusterModal(true);
    setContextsLoading(true);
    setNotice("");
    try {
      const response = await api("/kubernetes/contexts");
      const contexts = response.data.contexts;
      setKubeContexts(contexts);
      const selectedContext =
        contexts.find((context) => context.name === response.data.currentContext) ||
        contexts[0];
      if (selectedContext) {
        setClusterForm((current) => ({
          ...current,
          kubeContext: selectedContext.name,
        }));
      } else {
        setNotice("No Kubernetes contexts found. Configure a kubeconfig on the API host first.");
      }
    } catch (error) {
      setNotice(error.message);
    } finally {
      setContextsLoading(false);
    }
  }

  async function testCluster(activeClusterId = clusterId) {
    if (!workspaceId || !activeClusterId) return;
    setLoading(true);
    setNotice("");
    try {
      const response = await api(
        `/workspaces/${workspaceId}/clusters/${activeClusterId}/test`,
        { method: "POST" },
      );
      await loadClusters(workspaceId, activeClusterId);
      setNotice(
        `Cluster connected: ${response.data.connection.nodes.length} node(s), ${response.data.connection.namespaceCount} namespace(s).`,
      );
    } catch (error) {
      await loadClusters(workspaceId, activeClusterId);
      setNotice(`Cluster connection failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function deleteCluster(activeClusterId = clusterId) {
    if (!workspaceId || !activeClusterId) return;
    if (
      !window.confirm(
        "Remove this cluster and its KubeDoctor data? This will not delete the Kubernetes cluster or its workloads.",
      )
    ) return;
    setLoading(true);
    try {
      await api(`/workspaces/${workspaceId}/clusters/${activeClusterId}`, {
        method: "DELETE",
      });
      setClusterId("");
      await loadClusters(workspaceId);
      setNotice("Cluster removed.");
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
    setLoading(true);
    setNotice("");
    try {
      const response = await api(
        `/incidents/scan?clusterId=${clusterId}&namespace=default`,
        { method: "POST" },
      );
      setNotice(`Scan published ${response.data.published} Kubernetes resources.`);
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
    if (!session?.accessToken) return;
    loadWorkspaces(session.workspace?.id).catch((error) => setNotice(error.message));
  }, [session?.accessToken]);

  async function switchWorkspace(id) {
    setWorkspaceId(id);
    setClusterId("");
    setLoading(true);
    try {
      await loadClusters(id);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

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
              <label>Workspace<input value={authForm.workspaceName} onChange={(event) => setAuthForm({ ...authForm, workspaceName: event.target.value })} placeholder="Platform Team" /></label>
            )}
            <label>Email<input type="email" required value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} placeholder="you@example.com" /></label>
            <label>Password<input type="password" required minLength={8} value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} placeholder="At least 8 characters" /></label>
            {authError && <div className="error">{authError}</div>}
            <button className="primary" type="submit">{authMode === "register" ? "Create workspace" : "Sign in"}</button>
          </form>
        </section>
      </main>
    );
  }

  const activeCluster = clusters.find((item) => item.id === clusterId);

  return (
    <main className="shell">
      <header>
        <div>
          <div className="eyebrow">KUBEDOCTOR</div>
          <h1>Operations overview</h1>
        </div>
        <div className="header-actions">
          <select value={workspaceId} onChange={(event) => switchWorkspace(event.target.value)}>
            {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </select>
          <select value={clusterId} onChange={(event) => { setClusterId(event.target.value); loadClusterData(event.target.value); }}>
            <option value="">Select cluster</option>
            {clusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.name}</option>)}
          </select>
          <button className="secondary" onClick={() => setWorkspaceModal(true)}>New workspace</button>
          <button className="secondary" onClick={openClusterModal} disabled={!workspaceId}>Add cluster</button>
          <button className="secondary" onClick={logout}>Sign out</button>
        </div>
      </header>

      {notice && <div className="notice">{notice}</div>}

      {activeCluster && (
        <section className="cluster-strip">
          <div>
            <span>Selected cluster</span>
            <strong>{activeCluster.name}</strong>
            <small>{activeCluster.kube_context} · {activeCluster.status}</small>
          </div>
          <div className="cluster-actions">
            <button className="secondary" onClick={() => testCluster(activeCluster.id)} disabled={loading}>Test connection</button>
            <button className="danger" onClick={() => deleteCluster(activeCluster.id)} disabled={loading}>Remove</button>
          </div>
        </section>
      )}

      <section className="metrics">
        <article><span>Pods</span><strong>{pods.length}</strong><small>default namespace</small></article>
        <article><span>Open incidents</span><strong>{stats.open || 0}</strong><small>requires review</small></article>
        <article><span>Critical</span><strong>{stats.critical || 0}</strong><small>high-priority findings</small></article>
        <article><span>Clusters</span><strong>{clusters.length}</strong><small>configured workspace</small></article>
      </section>

      <section className="actions">
        <button className="primary" onClick={scanCluster} disabled={loading || !clusterId}>{loading ? "Working..." : "Scan cluster"}</button>
        <button className="secondary" onClick={() => loadClusterData(clusterId)} disabled={loading || !clusterId}>Refresh</button>
      </section>

      <section className="grid">
        <article className="panel">
          <div className="panel-heading"><div><span>Workload inventory</span><h2>Pods</h2></div></div>
          {pods.length === 0 ? <p className="empty">{clusterId ? "No pods found in the default namespace." : "Select or register a cluster."}</p> : (
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

      {clusterModal && (
        <div className="modal-backdrop" onClick={() => setClusterModal(false)}>
          <section className="modal small-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setClusterModal(false)}>×</button>
            <h2>Register cluster</h2>
            <p>Use a context that is available in your local kubeconfig.</p>
            <form className="cluster-form" onSubmit={createCluster}>
              <label>Cluster name<input required minLength={2} value={clusterForm.name} onChange={(event) => setClusterForm({ ...clusterForm, name: event.target.value })} /></label>
              <label>Kubernetes context
                <select required disabled={contextsLoading || kubeContexts.length === 0} value={clusterForm.kubeContext} onChange={(event) => setClusterForm({ ...clusterForm, kubeContext: event.target.value })}>
                  {contextsLoading && <option value="">Loading contexts...</option>}
                  {!contextsLoading && kubeContexts.length === 0 && <option value="">No kubeconfig contexts found</option>}
                  {kubeContexts.map((context) => <option key={context.name} value={context.name}>{context.name}{context.name === "minikube" ? " (local sample)" : ""}</option>)}
                </select>
              </label>
              <p className="form-hint">Choose a context configured in the API host’s kubeconfig. For local Minikube, use <code>minikube</code> and namespace <code>default</code>.</p>
              <label>Namespace<input value={clusterForm.namespace} onChange={(event) => setClusterForm({ ...clusterForm, namespace: event.target.value })} /></label>
              <button className="primary" type="submit" disabled={loading || contextsLoading || kubeContexts.length === 0}>{loading ? "Registering..." : "Register and test connection"}</button>
            </form>
          </section>
        </div>
      )}

      {workspaceModal && (
        <div className="modal-backdrop" onClick={() => setWorkspaceModal(false)}>
          <section className="modal small-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setWorkspaceModal(false)}>×</button>
            <h2>Create workspace</h2>
            <form className="cluster-form" onSubmit={createWorkspace}>
              <label>Workspace name<input required minLength={2} value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Platform team" /></label>
              <button className="primary" type="submit" disabled={loading}>{loading ? "Creating..." : "Create workspace"}</button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
