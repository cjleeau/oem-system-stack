import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import SidebarNav from './components/SidebarNav';
import Filters from './components/Filters';
import ToggleBar from './components/ToggleBar';
import Tooltip from './components/Tooltip';
import StrategicCards from './components/StrategicCards';
import InsightPanel from './components/InsightPanel';
import GridView from './views/GridView';
import NetworkView from './views/NetworkView';
import ArchitectureView from './views/ArchitectureView';
import GovernanceView from './views/GovernanceView';
import DocsView from './views/DocsView';
import SupplierConcentrationView from './views/SupplierConcentrationView';
import PlatformDependencyView from './views/PlatformDependencyView';
import DealerEcosystemView from './views/DealerEcosystemView';
import { DEFAULT_STATE } from './lib/constants';
import { buildFilteredData, getFilterOptions, getGovernanceMetrics, loadData } from './lib/data';
import { buildInsightPanel, buildIntelligence } from './lib/intelligence';

function LinkedinIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M4.98 3.5C4.98 4.88 3.86 6 2.48 6S0 4.88 0 3.5 1.12 1 2.48 1s2.5 1.12 2.5 2.5ZM.5 8h4V23h-4V8Zm7 0h3.8v2h.1c.53-1 1.82-2.1 3.75-2.1 4.01 0 4.75 2.64 4.75 6.07V23h-4v-7.14c0-1.7-.03-3.89-2.37-3.89-2.37 0-2.73 1.85-2.73 3.76V23h-4V8Z" />
    </svg>
  );
}

function XIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.847h-7.406l-5.8-7.584-6.637 7.584H.478l8.6-9.83L0 1.153h7.594l5.243 6.932L18.901 1.153Zm-1.29 19.494h2.039L6.486 3.259H4.298l13.313 17.388Z" />
    </svg>
  );
}

function GithubIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">
      <span className="inline-block size-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
      {children}
    </div>
  );
}

function trackView(view) {
  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'view_change', { view });
      window.gtag('event', 'page_view', { page_title: document.title, page_path: `/${view}` });
    }
  } catch {
    // analytics must never break the app
  }
}

export default function App() {
  const [data, setData] = useState({ nodes: [], edges: [] });
  const [state, setState] = useState(DEFAULT_STATE);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, data: null, kind: 'node' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);

    loadData(import.meta.env.BASE_URL.replace(/\/$/, ''))
      .then((nextData) => {
        if (!active) return;
        setData(nextData);
        setError('');
        setLoading(false);
      })
      .catch((nextError) => {
        if (!active) return;
        setError(nextError.message || 'Failed to load CSV data.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    trackView(state.view);
  }, [state.view]);

  useEffect(() => {
    setTooltip((current) => ({ ...current, visible: false }));
  }, [
    state.view,
    state.region,
    state.oem,
    state.layer,
    state.type,
    state.confidence,
    state.search,
    state.telemetryOnly,
    state.evidenceOnly,
    state.archAdjacentOnly,
    state.archSupplierFocus,
    state.archTight
  ]);

  const filterOptions = useMemo(() => getFilterOptions(data.nodes, state), [data.nodes, state]);
  const filtered = useMemo(() => buildFilteredData(data.nodes, data.edges, state), [data.nodes, data.edges, state]);
  const governanceMetrics = useMemo(() => getGovernanceMetrics(filtered.nodes, filtered.edges), [filtered.nodes, filtered.edges]);
  const intelligence = useMemo(() => buildIntelligence(filtered.nodes, filtered.edges, state), [filtered.nodes, filtered.edges, state]);

  useEffect(() => {
    if (state.selectedNodeId && !filtered.nodeMap.has(state.selectedNodeId)) {
      setState((current) => ({ ...current, selectedNodeId: null }));
    }
  }, [filtered.nodeMap, state.selectedNodeId]);

  const selectedNode = state.selectedNodeId ? filtered.nodeMap.get(state.selectedNodeId) || null : null;
  const insight = useMemo(
    () => buildInsightPanel(intelligence, state, selectedNode, filtered.nodes, filtered.edges),
    [intelligence, state, selectedNode, filtered.nodes, filtered.edges]
  );

  const onChange = useCallback((key, value) => {
    setState((current) => ({ ...current, [key]: value }));
  }, []);

  const onReset = useCallback(() => {
    setState((current) => ({ ...DEFAULT_STATE, view: current.view }));
  }, []);

  const clearTooltip = useCallback(() => {
    setTooltip((current) => ({ ...current, visible: false }));
  }, []);

  const onNodeHover = useCallback((event, datum) => {
    setTooltip({ visible: true, x: event.clientX, y: event.clientY, data: datum, kind: 'node' });
  }, []);

  const onEdgeHover = useCallback((event, datum) => {
    setTooltip({ visible: true, x: event.clientX, y: event.clientY, data: datum, kind: 'edge' });
  }, []);

  const onLeave = clearTooltip;

  const onNodeSelect = useCallback((datum) => {
    setState((current) => ({ ...current, selectedNodeId: datum?.id || null }));
  }, []);

  const commonProps = {
    onNodeHover,
    onNodeSelect,
    onEdgeHover,
    onLeave,
    onCanvasInteract: clearTooltip
  };

  const showFilters = !loading && !error && state.view !== 'docs';
  const showCoreSections = !loading && !error && ['grid', 'network', 'architecture'].includes(state.view);

  const content = () => {
    if (loading) {
      return (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 text-sm text-muted-foreground">
          Loading CSV data…
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-6 text-sm text-[#ffd9b3]">
          {error}
        </div>
      );
    }

    if (state.view === 'grid') {
      return <GridView nodes={filtered.nodes} edges={filtered.edges} {...commonProps} />;
    }

    if (state.view === 'network') {
      return <NetworkView nodes={filtered.nodes} edges={filtered.edges} {...commonProps} />;
    }

    if (state.view === 'architecture') {
      return <ArchitectureView state={state} nodes={filtered.nodes} edges={filtered.edges} {...commonProps} />;
    }

    if (state.view === 'supplier') {
      return <SupplierConcentrationView intelligence={intelligence} />;
    }

    if (state.view === 'platform') {
      return <PlatformDependencyView intelligence={intelligence} />;
    }

    if (state.view === 'dealer') {
      return <DealerEcosystemView intelligence={intelligence} />;
    }

    if (state.view === 'governance') {
      return <GovernanceView metrics={governanceMetrics} />;
    }

    return <DocsView />;
  };

  return (
    <div className="h-screen overflow-hidden bg-canvas text-ink">
      <div className="flex h-full">
        <SidebarNav activeView={state.view} onChange={(view) => onChange('view', view)} />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header searchValue={state.search} onSearchChange={(value) => onChange('search', value)} />

          <main className="flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5">
            <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4">
              {showFilters ? (
                <>
                  <div className="pt-2">
                    <div className="mb-4 text-[10px] font-black uppercase tracking-[0.22em] text-foreground">
                      Global OEM System Stack
                    </div>
                  </div>

                  <SectionLabel>Ecosystem Filters</SectionLabel>
                  <Filters state={state} options={filterOptions} onChange={onChange} />
                  <ToggleBar state={state} onChange={onChange} onReset={onReset} />
                </>
              ) : null}

              {showCoreSections ? (
                <>
                  <SectionLabel>Core Ecosystem Metrics</SectionLabel>
                  <StrategicCards cards={intelligence.strategicCards} />

                  <SectionLabel>Insight</SectionLabel>
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                    <div className="min-w-0">
                      <InsightPanel insight={insight} />
                    </div>

                    <div className="space-y-4">
                      <SectionLabel>Interpretation & Analysis</SectionLabel>

                      {(insight?.sections || []).flatMap((section) => section.rows || []).slice(0, 2).map((row, index) => (
                        <div
                          key={`${row.label}-${index}`}
                          className="rounded-xl border border-border/40 bg-card/20 p-5 transition-all hover:border-blue-500/30 hover:bg-card/40"
                        >
                          <div className="mb-3 flex items-center gap-3">
                            <span className="inline-block size-4 rounded-full border border-blue-500/30 bg-blue-600/10" />
                            <h5 className="text-[13px] font-bold text-foreground">{row.label || 'Interpretation'}</h5>
                          </div>
                          <p className="text-xs italic leading-relaxed text-muted-foreground">"{row.note}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              <div className="min-w-0">{content()}</div>
            </div>
          </main>

          <footer className="shrink-0 border-t border-white/5 bg-black/40 px-6 py-3 backdrop-blur-2xl">
            <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center gap-3 font-mono uppercase tracking-[0.16em]">
                <span className="inline-block size-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.7)]" />
                ACTIVE // POWERED BY{' '}
                <a className="text-accentSoft hover:text-white" href="https://www.mrleeco.com/" target="_blank" rel="noreferrer">
                  MR LEE CO
                </a>{' '}
                // CREATED BY CHRIS LEE
              </div>

              <div className="flex items-center gap-4">
                <a href="https://www.linkedin.com/in/christopherjustinlee" target="_blank" rel="noreferrer" className="hover:text-white">
                  <LinkedinIcon className="size-4" />
                </a>
                <a href="https://x.com/mr_lee_co" target="_blank" rel="noreferrer" className="hover:text-white">
                  <XIcon className="size-4" />
                </a>
                <a href="https://github.com/cjleeau" target="_blank" rel="noreferrer" className="hover:text-white">
                  <GithubIcon className="size-4" />
                </a>
              </div>
            </div>
          </footer>
        </div>
      </div>

      <Tooltip tooltip={tooltip} />
    </div>
  );
}