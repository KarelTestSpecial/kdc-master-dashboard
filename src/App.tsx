import React, { useState, useEffect, useCallback } from 'react';
import {
  Rocket,
  Terminal,
  Layers,
  ExternalLink,
  Activity,
  Layout,
  Play,
  Square,
  RefreshCw,
  PlusCircle,
  X,
  CheckCircle,
  Folder,
  HelpCircle,
  AlertCircle,
  Cpu,
  HardDrive,
  Github,
  GitBranch,
  CloudUpload
} from 'lucide-react';
import './App.css';

interface RegistryInfo {
  port: number;
  project: string;
  description: string;
  in_use: boolean;
}

interface PortRegistry {
  [key: string]: RegistryInfo;
}

interface PmctlProject {
  name: string;
  description: string;
  tech: string;
  path: string;
  status: string;
  category?: string;
  ports: number[];
  open_ports: number[];
  memory_mb: number;
  cpu_percent: number;
  disk_usage: string;
  token_usage: number;
  relations: string[];
  services?: string[];
  links?: { label: string, url: string }[];
  git?: {
    is_repo: boolean;
    branch?: string;
    is_dirty?: boolean;
    remote?: string;
    status_summary?: string;
    error?: string;
  };
}

function App() {
  const [activeTab, setActiveTab] = useState('projects');
  const [registry, setRegistry] = useState<PortRegistry>({});
  const [projects, setProjects] = useState<{ [key: string]: PmctlProject }>({});
  const [systemStats, setSystemStats] = useState<{ cpu_total: number, memory: { percent: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPortModal, setShowPortModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [processing, setProcessing] = useState<{ [key: string]: string | null }>({});

  const [newPort, setNewPort] = useState({ service: '', project: '', description: '', port: '' });

  const host = window.location.hostname || 'localhost';

  const fetchRegistry = useCallback(async () => {
    try {
      const regRes = await fetch(`http://${host}:7777/api/ports`);
      if (regRes.ok) {
        setRegistry(await regRes.json());
      }

      const sysRes = await fetch(`http://${host}:7777/api/system/stats`);
      if (sysRes.ok) {
        setSystemStats(await sysRes.json());
      }

      const projRes = await fetch(`http://${host}:7777/api/projects`);
      if (projRes.ok) {
        setProjects(await projRes.json());
        setError(null);
      } else {
        setError("Kan projectlijst niet ophalen van pm2-center (:7777)");
      }
    } catch (err) {
      console.error("Connection error:", err);
      setError("Verbindingsfout met backend services.");
    } finally {
      setLoading(false);
    }
  }, [host]);

  useEffect(() => {
    fetchRegistry();
  }, [fetchRegistry]);

  const handleDelete = async (projectId: string) => {
    if (!confirm(`"${projectId}" verwijderen uit het dashboard?`)) return;
    await fetch(`http://${host}:7777/api/projects/${projectId}`, { method: 'DELETE' });
    await fetchRegistry();
  };

  const handleAddProject = async () => {
    if (!newProject.name || !newProject.location) return;
    const res = await fetch(`http://${host}:7777/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newProject.name,
        path: newProject.location,
        description: newProject.goal,
        tech: newProject.tech,
        category: newProject.category,
        start_script: newProject.startScript || null,
        pm2_name: newProject.pm2Name || null,
        serviceName: newProject.serviceName,
      })
    });
    const data = await res.json();
    if (data.success) {
      setShowAddModal(false);
      setNewProject({ name: '', location: '', goal: '', tech: '', category: 'agent', startScript: '', pm2Name: '', serviceName: '', preferredPort: '' });
      await fetchRegistry();
    } else {
      alert(data.message);
    }
  };

  const handleRegisterPort = async () => {
    if (!newPort.service || !newPort.project) return;
    const res = await fetch(`http://${host}:4444/ports/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: newPort.service,
        project: newPort.project,
        description: newPort.description,
        preferred_port: newPort.port ? parseInt(newPort.port) : null
      })
    });
    const data = await res.json();
    if (res.ok) {
      setShowPortModal(false);
      setNewPort({ service: '', project: '', description: '', port: '' });
      await fetchRegistry();
    } else {
      alert(data.detail || 'Fout bij registreren poort');
    }
  };

  const handlePm2All = async (action: 'stop-all' | 'start-all') => {
    if (!confirm(action === 'stop-all' ? 'Alle PM2 processen stoppen?' : 'Alle PM2 processen starten?')) return;
    await fetch(`http://${host}:7777/api/pm2/${action}`, { method: 'POST' });
    setTimeout(fetchRegistry, 1500);
  };

  const handleAction = async (projectId: string, action: 'start' | 'stop' | 'restart' | 'sync') => {
    setProcessing(prev => ({ ...prev, [projectId]: action }));

    try {
      const res = await fetch(`http://${host}:7777/api/projects/${projectId}/${action}`, {
        method: 'POST'
      });
      const data = await res.json();

      if (action === 'sync') {
        if (data.success) {
          alert(`Sync succesvol voor ${projectId}`);
        } else {
          alert(`Sync mislukt voor ${projectId}: ${data.message}`);
        }
      }

      let attempts = 0;
      const poll = async () => {
        attempts++;
        await fetchRegistry();
        const currentProject = projects[projectId];
        let isDone = false;
        if (action === 'stop') isDone = currentProject?.status === 'stopped';
        if (action === 'start') isDone = currentProject?.status === 'running';
        if (action === 'sync') isDone = !currentProject?.git?.is_dirty;

        if (isDone || attempts >= 10) {
          setProcessing(prev => ({ ...prev, [projectId]: null }));
        } else {
          setTimeout(poll, 1000);
        }
      };
      setTimeout(poll, 1000);
    } catch (err) {
      setProcessing(prev => ({ ...prev, [projectId]: null }));
    }
  };

  const [newProject, setNewProject] = useState({
    name: '',
    location: '',
    goal: '',
    tech: '',
    category: 'agent',
    startScript: '',
    pm2Name: '',
    serviceName: '',
    preferredPort: ''
  });

  const renderCard = (id: string, project: PmctlProject) => {
    const status = project.status === 'running' ? 'online' : 'offline';
    const isStopping = processing[id] === 'stop' && status === 'online';

    return (
      <div key={id} className="project-card">
        <div className="card-header">
          <div className="title-group">
            <h3>{project.name}</h3>
            <div className="ports-row">
              {project.ports.map(p => (
                <span key={p} className={`port-tag ${project.open_ports.includes(p) ? 'active' : ''}`}>:{p}</span>
              ))}
              {project.ports.length === 0 && status === 'online' && (
                <span className="port-tag bg-tag">
                  {project.tech?.toLowerCase().includes('bash') ? 'bg bash loop' : 'achtergrond'}
                </span>
              )}
            </div>
          </div>
          <button className="btn-icon" onClick={() => handleDelete(id)} title="Verwijder uit dashboard">
            <X size={14} />
          </button>
          <div
            className={`status-badge ${isStopping ? 'stopping' : status}${status === 'online' && !isStopping && project.open_ports.length > 0 ? ' clickable' : ''}`}
            onClick={() => {
              if (status === 'online' && !isStopping && project.open_ports.length > 0) {
                window.open(`http://${host}:${project.open_ports[0]}`, '_blank');
              }
            }}
            title={status === 'online' && !isStopping && project.open_ports.length > 0 ? `Open op :${project.open_ports[0]}` : undefined}
          >
            {isStopping ? 'STOPPING' : status.toUpperCase()}
            {status === 'online' && !isStopping && project.open_ports.length > 0 && <ExternalLink size={10} style={{ marginLeft: '4px' }} />}
          </div>
        </div>

        <p className="goal">{project.description || "Geen beschrijving"}</p>

        <div className="project-stats">
          <div className="mini-stat">
            <span className="stat-label">CPU</span>
            {project.status === 'running' ? `${project.cpu_percent}%` : '—'}
          </div>
          <div className="mini-stat">
            <span className="stat-label">MEM</span>
            {project.memory_mb > 0 ? `${Math.round(project.memory_mb)} MB` : '—'}
          </div>
          <div className="mini-stat">
            <span className="stat-label">DISK</span>
            {project.disk_usage}
          </div>
        </div>

        <div className="tech-tag">{project.tech}</div>

        <div className="location">
          <Folder size={12} /> <code>{project.path}</code>
        </div>

        <div className="actions">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleAction(id, 'start')}
            disabled={status === 'online' || !!processing[id]}
          >
            {processing[id] === 'start' ? <RefreshCw size={14} className="spin" /> : <Play size={14} />} Start
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleAction(id, 'stop')}
            disabled={status === 'offline' || !!processing[id]}
          >
            {processing[id] === 'stop' ? <RefreshCw size={14} className="spin" /> : <Square size={14} />} Stop
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => handleAction(id, 'restart')}
            disabled={!!processing[id]}
          >
            <RefreshCw size={14} className={processing[id] === 'restart' ? 'spin' : ''} />
          </button>
        </div>
      </div>
    );
  };

  const agents = Object.entries(projects).filter(([_, p]) => p.category === 'agent');
  const infra = Object.entries(projects).filter(([_, p]) => p.category === 'infra');
  const uncategorized = Object.entries(projects).filter(([_, p]) => !p.category);

  return (
    <div className="dashboard">
      <header className="header">
        <div className="logo">
          <Layers size={28} color="#3fb950" />
          <h1>KDC's AI INCOME <span>GENERATION</span></h1>
        </div>
        <div className="header-actions">
          {systemStats && (
            <div className="system-metrics">
              <div className="metric" title="Totale CPU Belasting">
                <Cpu size={12} />
                <span>CPU {systemStats.cpu_total}%</span>
              </div>
              <div className="metric" title="Systeemgeheugen in gebruik">
                <Layers size={12} />
                <span>RAM {systemStats.memory.percent}%</span>
              </div>
            </div>
          )}
          <div className="system-health">
            <Activity size={16} />
            <span>{loading ? 'Verbinden...' : (error ? 'Fout' : 'SYSTEM ONLINE')}</span>
            <div className={`status-dot ${loading ? 'yellow' : (error ? 'red' : 'green')}`}></div>
          </div>
        </div>
      </header>

      <nav className="sidebar">
        <button className={activeTab === 'projects' ? 'active' : ''} onClick={() => setActiveTab('projects')}>
          <Rocket size={18} /> Ecosysteem
        </button>
        <button className={activeTab === 'git' ? 'active' : ''} onClick={() => setActiveTab('git')}>
          <Github size={18} /> Source Control
        </button>
        <button className={activeTab === 'ports' ? 'active' : ''} onClick={() => setActiveTab('ports')}>
          <Layout size={18} /> Port Registry
        </button>
        <button className={activeTab === 'sop' ? 'active' : ''} onClick={() => setActiveTab('sop')}>
          <CheckCircle size={18} /> AI Protocol
        </button>
        <div className="sidebar-footer">
          <div className="version">KDC ENGINE v2.0</div>
        </div>
      </nav>

      <main className="main-content">
        {error && <div className="error-banner"><AlertCircle size={18} /> {error}</div>}

        {activeTab === 'projects' && (
          <div className="view">
            <div className="mission-banner">
              <h2><Rocket size={20} /> DOELSTELLING & VISIE</h2>
              <div className="mission-text">
                Dit ecosysteem is ontworpen voor <b>re-integratie en financiële onafhankelijkheid</b>. 
                Door de inzet van autonome AI-agents (AIGA) en cloud-infrastructuur bouwen we aan een schaalbare bron van inkomsten.
                De focus ligt op <b>automatisering van acquisitie</b> terwijl de mens de strategische controle behoudt.
              </div>
            </div>

            <div className="header-row">
              <h2 className="section-title">KDC Ecosystem Control</h2>
              <div className="button-group">
                <button className="btn btn-outline btn-sm" onClick={fetchRegistry} title="Refresh data"><RefreshCw size={14} /></button>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}><PlusCircle size={14} /> Nieuw Project</button>
              </div>
            </div>

            {agents.length > 0 && (
              <div className="project-section">
                <div className="section-label">
                  <Rocket size={14} /> AGENTS
                </div>
                <div className="project-grid">
                  {agents.map(([id, project]) => renderCard(id, project))}
                </div>
              </div>
            )}

            {infra.length > 0 && (
              <div className="project-section">
                <div className="section-label">
                  <Terminal size={14} /> INFRASTRUCTUUR
                </div>
                <div className="project-grid">
                  {infra.map(([id, project]) => renderCard(id, project))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'git' && (
          <div className="view">
            <h2 className="section-title">GitHub Synchronisatie</h2>
            <div className="git-grid">
              {Object.entries(projects).map(([id, project]) => (
                <div key={id} className="git-card">
                  <div className="git-header">
                    <div className="git-title">
                      <h3>{project.name}</h3>
                      {project.git?.is_repo ? (
                        <span className={`git-badge ${project.git.is_dirty ? 'dirty' : 'clean'}`}>
                          {project.git.is_dirty ? 'WIJZIGINGEN' : 'SCHOON'}
                        </span>
                      ) : (
                        <span className="git-badge none">GEEN REPO</span>
                      )}
                    </div>
                    <div className="git-branch">
                      <GitBranch size={14} /> {project.git?.branch || '—'}
                    </div>
                  </div>

                  <div className="git-body">
                    <div className="git-remote">
                      <ExternalLink size={12} /> <code>{project.git?.remote || 'Geen remote'}</code>
                    </div>
                    {project.git?.is_dirty && (
                      <div className="git-summary">
                        <code>{project.git.status_summary}</code>
                      </div>
                    )}
                  </div>

                  <div className="git-actions">
                    <button
                      className="btn btn-primary btn-sm btn-full"
                      onClick={() => handleAction(id, 'sync')}
                      disabled={!project.git?.is_repo || !project.git?.is_dirty || !!processing[id]}
                    >
                      {processing[id] === 'sync' ? (
                        <><RefreshCw size={14} className="spin" /> Pushen...</>
                      ) : (
                        <><CloudUpload size={14} /> Commit & Push naar GitHub</>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'ports' && (
          <div className="view">
            <div className="header-row">
              <h2 className="section-title">Centraal Poort Register</h2>
              <button className="btn btn-primary btn-sm" onClick={() => setShowPortModal(true)}>
                <PlusCircle size={14} /> Poort Claimen
              </button>
            </div>

            <div className="mission-banner" style={{ borderLeftColor: 'var(--primary)', marginBottom: '24px' }}>
              <h2><HelpCircle size={18} /> Hoe werkt de koppeling?</h2>
              <div className="mission-text">
                De link tussen een poort en een project op de schijf is <b>puur administratief</b>:
                <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
                  <li>Wanneer je een poort claimt, slaat het register dit op in <code>registry.json</code> onder de naam van dat project.</li>
                  <li><b>De koppeling op schijf:</b> Je project (bijv. een Python script) moet vervolgens <i>zelf</i> die poort gebruiken bij het opstarten.</li>
                  <li><b>Het dashboard:</b> Dit leest <code>projects.json</code> en matcht dit met de data uit de registry om de status te tonen.</li>
                </ul>
                Het register is dus de <b>boekhouder</b>: het zegt "Karel heeft poort X gereserveerd voor project Y". Het dwingt niets af bij het script, maar zorgt voor een conflictvrij overzicht.
              </div>
            </div>

            <div className="port-registry-card">
              <table className="port-table">
                <thead>
                  <tr><th>Poort</th><th>Service</th><th>Project</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {Object.entries(registry).sort((a, b) => a[1].port - b[1].port).map(([name, info]) => (
                    <tr key={name}>
                      <td><code className="port-code">:{info.port}</code></td>
                      <td><strong>{name}</strong></td>
                      <td><span className="project-tag">{info.project}</span></td>
                      <td>
                        <div className="status-cell">
                          <div className={`status-dot ${info.in_use ? 'green' : 'gray'}`}></div>
                          <span>{info.in_use ? 'ACTIEF' : 'IDLE'}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'sop' && (
          <div className="view">
            <h2 className="section-title">Standard Operating Procedure</h2>
            <div className="sop-grid">
              <div className="sop-card">
                <h3>🤖 AI Agent Protocol (Technisch)</h3>
                <ul className="sop-list">
                  <li><strong>1. Poort Check:</strong> Agents vragen altijd een poort aan bij <code>port-registry</code> (:4444).</li>
                  <li><strong>2. AI Waterfall:</strong> Alle LLM calls verlopen via de Waterfall (:5005) voor kostenbeheersing.</li>
                  <li><strong>3. PM2 Setup:</strong> Nieuwe services worden direct aan PM2 toegevoegd voor persistentie.</li>
                  <li><strong>4. Git Push:</strong> Na elke succesvolle wijziging moet de code gepushed worden via de Git-tab.</li>
                </ul>
              </div>
              <div className="sop-card highlight">
                <h3>👤 Menselijk Protocol (Besluitvorming)</h3>
                <ul className="sop-list">
                  <li><strong>1. Monitoring:</strong> Controleer dagelijks de OCI Hunter. Zodra de VPS live is, volgt migratie.</li>
                  <li><strong>2. QA & Review:</strong> De mens beoordeelt de proposals die AIGA voorbereidt voordat ze verzonden worden.</li>
                  <li><strong>3. Strategische Keuzes:</strong> Beslis welke gigs/leads prioriteit krijgen op basis van de Mission Banner.</li>
                  <li><strong>4. Systeem-Integriteit:</strong> Vermijd handmatige aanpassingen in <code>projects.json</code>; gebruik het dashboard.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      {showPortModal && (
        <div className="modal-overlay" onClick={() => setShowPortModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Poort Reserveren</h3>
              <button className="btn-icon" onClick={() => setShowPortModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <label>Service Naam *<input className="input" placeholder="bv. mijn-nieuwe-api" value={newPort.service} onChange={e => setNewPort(p => ({ ...p, service: e.target.value }))} /></label>
              <label>Project Naam *<input className="input" placeholder="bv. aiga-pro" value={newPort.project} onChange={e => setNewPort(p => ({ ...p, project: e.target.value }))} /></label>
              <label>Beschrijving<input className="input" placeholder="Waarvoor dient deze poort?" value={newPort.description} onChange={e => setNewPort(p => ({ ...p, description: e.target.value }))} /></label>
              <label>Voorkeurspoort (Optioneel)<input className="input" placeholder="Laat leeg voor auto-toewijzing" value={newPort.port} onChange={e => setNewPort(p => ({ ...p, port: e.target.value }))} /></label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline btn-sm" onClick={() => setShowPortModal(false)}>Annuleer</button>
              <button className="btn btn-primary btn-sm" onClick={handleRegisterPort} disabled={!newPort.service || !newPort.project}>Registreren</button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Project toevoegen</h3>
              <button className="btn-icon" onClick={() => setShowAddModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <label>Naam *<input className="input" placeholder="bv. mijn-api" value={newProject.name} onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))} /></label>
              <label>Pad *<input className="input" placeholder="/home/kareltestspecial/1-Infrastructuur/..." value={newProject.location} onChange={e => setNewProject(p => ({ ...p, location: e.target.value }))} /></label>
              <label>Beschrijving<input className="input" placeholder="Wat doet dit project?" value={newProject.goal} onChange={e => setNewProject(p => ({ ...p, goal: e.target.value }))} /></label>
              <label>Tech<input className="input" placeholder="bv. Python (FastAPI)" value={newProject.tech} onChange={e => setNewProject(p => ({ ...p, tech: e.target.value }))} /></label>
              <label>Categorie
                <select className="input" value={newProject.category} onChange={e => setNewProject(p => ({ ...p, category: e.target.value }))}>
                  <option value="agent">Agent</option>
                  <option value="infra">Infrastructuur</option>
                </select>
              </label>
              <label>Start script<input className="input" placeholder="bv. node launch.js" value={newProject.startScript} onChange={e => setNewProject(p => ({ ...p, startScript: e.target.value }))} /></label>
              <label>PM2 naam<input className="input" placeholder="bv. mijn-api (leeg = geen PM2)" value={newProject.pm2Name} onChange={e => setNewProject(p => ({ ...p, pm2Name: e.target.value }))} /></label>
              <label>Service naam<input className="input" placeholder="bv. mijn-api (voor port registry)" value={newProject.serviceName} onChange={e => setNewProject(p => ({ ...p, serviceName: e.target.value }))} /></label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline btn-sm" onClick={() => setShowAddModal(false)}>Annuleer</button>
              <button className="btn btn-primary btn-sm" onClick={handleAddProject} disabled={!newProject.name || !newProject.location}>Toevoegen</button>
            </div>
          </div>
        </div>
      )}
      {showEmergencyModal && (
        <div className="modal-overlay" onClick={() => setShowEmergencyModal(false)}>
          <div className="modal emergency-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🚨 Nood-instructies (Terminal)</h3>
              <button className="btn-icon" onClick={() => setShowEmergencyModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p>Mocht het dashboard niet reageren of een proces (zoals port-registry) 100% CPU verbruiken, gebruik dan de volgende commando's in de terminal:</p>

              <div className="command-block">
                <label>Alles stoppen (PM2):</label>
                <code>pm2 stop all && pm2 kill</code>
              </div>

              <div className="command-block">
                <label>Forceer stop Port Registry (bij 100% CPU):</label>
                <code>pkill -9 -f "port-registry"</code>
              </div>

              <div className="command-block">
                <label>Forceer stop alle Python/Node processen:</label>
                <code>pkill -9 -f "python" && pkill -9 -f "node"</code>
              </div>

              <p className="modal-footer-note">Herstart het systeem handmatig via: <code>~/1-Infrastructuur/start-core.sh</code> (indien geconfigureerd) of per project via <code>pm2-center web</code>.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary btn-sm" onClick={() => setShowEmergencyModal(false)}>Begrepen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
