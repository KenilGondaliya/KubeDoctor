import React, { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function App() {
  const [pods, setPods] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [p, i] = await Promise.all([
        fetch(`${API}/kubernetes/pods?namespace=default`).then(r => r.json()),
        fetch(`${API}/incidents`).then(r => r.json())
      ]);
      setPods(p.data || []);
      setIncidents(i.data || []);
    } finally { setLoading(false); }
  }

  async function scan() {
    await fetch(`${API}/incidents/scan?namespace=default`, { method: 'POST' });
    await load();
  }

  useEffect(() => { load(); }, []);

  return <div className="shell">
    <header><div><h1>KubeDoctor</h1><p>Evidence-driven Kubernetes diagnostics</p></div><button onClick={scan}>Scan Cluster</button></header>
    <section className="cards">
      <div className="card"><span>Pods</span><strong>{pods.length}</strong></div>
      <div className="card"><span>Open Incidents</span><strong>{incidents.length}</strong></div>
      <div className="card"><span>Status</span><strong>{loading ? 'Loading' : 'Connected'}</strong></div>
    </section>
    <section className="panel"><h2>Pods</h2>{pods.length === 0 ? <p>No Pods in default namespace.</p> : <table><thead><tr><th>Name</th><th>Phase</th><th>Restarts</th><th>Node</th></tr></thead><tbody>{pods.map(p => <tr key={p.name}><td>{p.name}</td><td>{p.phase}</td><td>{p.containers?.reduce((n,c)=>n+(c.restartCount||0),0)}</td><td>{p.node || '-'}</td></tr>)}</tbody></table>}</section>
    <section className="panel"><h2>Incidents</h2>{incidents.length === 0 ? <p>No incidents recorded.</p> : incidents.map(i => <div className="incident" key={i._id || i.fingerprint}><div><strong>{i.type}</strong><p>{i.resource?.kind}/{i.resource?.name} · {i.namespace}</p></div><span className={`badge ${i.severity?.toLowerCase()}`}>{i.severity}</span></div>)}</section>
  </div>;
}
