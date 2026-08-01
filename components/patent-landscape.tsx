"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PatentLandscapeTimeline } from "@/components/patent-landscape-timeline";
import { PatentNetworkGraph } from "@/components/patent-network-graph";
import { classificationLabel, filterLandscapePatents, limitTopPatents, type LandscapeClassification, type LandscapeFilters, type LandscapePatent } from "@/lib/patents/patent-landscape";

const emptyFilters: LandscapeFilters = { query: "", classification: "all", applicant: "", dateFrom: "", dateTo: "" };
const classLabels: Record<LandscapeClassification, string> = { high: "High", partial: "Partial", low: "Low", insufficient: "Insufficient information" };

export function PatentLandscape({ inventionId, inventionTitle, featureSetVersion, searchDate, patents }: { inventionId: string; inventionTitle: string; featureSetVersion: number; searchDate: string; patents: LandscapePatent[] }) {
  const [view, setView] = useState<"network" | "timeline">("network");
  const [filters, setFilters] = useState<LandscapeFilters>(emptyFilters);
  const [selected, setSelected] = useState<LandscapePatent | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const [exportStatus, setExportStatus] = useState<"idle" | "exporting" | "success" | "error">("idle");
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const networkSvgRef = useRef<SVGSVGElement>(null);
  const timelineSvgRef = useRef<SVGSVGElement>(null);
  const filtered = useMemo(() => filterLandscapePatents(patents, filters), [filters, patents]);
  const visualLimit = mobile ? 12 : 30;
  const visible = useMemo(() => showAll ? filtered : limitTopPatents(filtered, visualLimit), [filtered, showAll, visualLimit]);
  const applicants = useMemo(() => [...new Set(patents.map((patent) => patent.applicant))].sort(), [patents]);
  const selectPatent = useCallback((patent: LandscapePatent) => setSelected(patent), []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => { setMobile(media.matches); if (media.matches) setView("network"); };
    update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", update); return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = containerRef.current;
    if (!canvas || !host || window.matchMedia("(prefers-reduced-motion: reduce)").matches || mobile) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    let active = !document.hidden;
    const particles = Array.from({ length: 42 }, () => ({ x: Math.random(), y: Math.random(), radius: 0.35 + Math.random(), speed: 0.00004 + Math.random() * 0.00008 }));
    const resize = () => { const rect = host.getBoundingClientRect(); const ratio = Math.min(devicePixelRatio, 2); canvas.width = Math.max(1, rect.width * ratio); canvas.height = Math.max(1, rect.height * ratio); canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`; };
    const draw = () => { if (!active) return; const width = canvas.width; const height = canvas.height; context.clearRect(0, 0, width, height); context.fillStyle = "rgba(103,232,249,.42)"; particles.forEach((particle) => { particle.y = (particle.y + particle.speed) % 1; context.beginPath(); context.arc(particle.x * width, particle.y * height, particle.radius * Math.min(devicePixelRatio, 2), 0, Math.PI * 2); context.fill(); }); frame = requestAnimationFrame(draw); };
    const visibility = () => { active = !document.hidden; cancelAnimationFrame(frame); if (active) frame = requestAnimationFrame(draw); };
    const observer = new ResizeObserver(resize); observer.observe(host); resize(); draw(); document.addEventListener("visibilitychange", visibility);
    return () => { active = false; cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, [mobile]);

  async function toggleFullscreen() {
    setFullscreenError("");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (containerRef.current?.requestFullscreen) await containerRef.current.requestFullscreen();
      else setFullscreenError("Fullscreen is not supported by this browser.");
    } catch { setFullscreenError("Fullscreen could not be opened. Please retry."); }
  }

  async function exportPng() {
    const svg = view === "network" ? networkSvgRef.current : timelineSvgRef.current;
    if (!svg || exportStatus === "exporting") return;
    setExportStatus("exporting");
    try {
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const viewBox = svg.viewBox.baseVal;
      const width = Math.max(1, viewBox.width || 1000); const height = Math.max(1, viewBox.height || 580);
      const source = new XMLSerializer().serializeToString(clone);
      const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
      const image = new Image();
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("image_load_failed")); image.src = url; });
      const canvas = document.createElement("canvas"); canvas.width = width * 2; canvas.height = height * 2;
      const context = canvas.getContext("2d"); if (!context) throw new Error("canvas_unavailable");
      context.fillStyle = "#050B18"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url);
      const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("png_failed")), "image/png"));
      const downloadUrl = URL.createObjectURL(png); const anchor = document.createElement("a"); anchor.href = downloadUrl; anchor.download = `${inventionTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "invention"}-patent-landscape-${view}.png`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
      setExportStatus("success");
    } catch { setExportStatus("error"); }
  }

  return <div className="landscape-shell" ref={containerRef}>
    <canvas ref={canvasRef} className="landscape-stars" aria-hidden="true" />
    <header className="landscape-header"><div><span className="landscape-badge">Deterministic visualisation</span><h1>Patent Landscape</h1><p>{inventionTitle}</p><div className="landscape-meta"><span>Feature set v{featureSetVersion}</span><span>{patents.length} patent{patents.length === 1 ? "" : "s"} visualised</span><span>Search {new Date(searchDate).toLocaleDateString("en-GB", { dateStyle: "medium" })}</span></div></div><div className="landscape-header-actions"><Link href={`/dashboard/inventions/${inventionId}?section=prior-art`}>← Back to invention workspace</Link><button type="button" onClick={toggleFullscreen}>{fullscreen ? "Exit fullscreen" : "Fullscreen"}</button></div></header>

    <div className="landscape-toolbar"><div role="tablist" aria-label="Patent landscape view"><button role="tab" aria-selected={view === "network"} onClick={() => setView("network")}>Network map</button><button role="tab" aria-selected={view === "timeline"} onClick={() => setView("timeline")}>Filing timeline</button></div><button type="button" onClick={exportPng} disabled={!visible.length || exportStatus === "exporting"}>{exportStatus === "exporting" ? "Exporting…" : exportStatus === "error" ? "Retry PNG export" : "Export current view as PNG"}</button></div>

    <section className="landscape-filters" aria-label="Patent landscape filters">
      <label><span>Search</span><input type="search" value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Title, publication or applicant" /></label>
      <label><span>Overlap</span><select value={filters.classification} onChange={(event) => setFilters((current) => ({ ...current, classification: event.target.value as LandscapeFilters["classification"] }))}><option value="all">All</option>{Object.entries(classLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label><span>Applicant</span><select value={filters.applicant} onChange={(event) => setFilters((current) => ({ ...current, applicant: event.target.value }))}><option value="">All applicants</option>{applicants.map((applicant) => <option key={applicant}>{applicant}</option>)}</select></label>
      <label><span>Date from</span><input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
      <label><span>Date to</span><input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} /></label>
      <div><strong>{filtered.length} of {patents.length} visible</strong><button type="button" onClick={() => { setFilters(emptyFilters); setShowAll(false); }}>Clear filters</button></div>
    </section>

    <p className="landscape-note">Observed overlap scores are deterministic visual summaries of the stored feature comparisons and are not legal conclusions.</p>
    {fullscreenError && <p className="landscape-error" role="alert">{fullscreenError}</p>}{exportStatus === "success" && <p className="landscape-success" role="status">PNG download started.</p>}{exportStatus === "error" && <p className="landscape-error" role="alert">The current view could not be exported. Please retry.</p>}

    <div className="landscape-stage">
      {!filtered.length ? <div className="landscape-empty"><strong>No patents match these filters</strong><p>Clear or adjust the filters to restore results.</p></div> : view === "network"
        ? <PatentNetworkGraph patents={visible} inventionTitle={inventionTitle} onSelect={selectPatent} svgRef={networkSvgRef} />
        : <PatentLandscapeTimeline patents={visible} onSelect={selectPatent} svgRef={timelineSvgRef} />}
      {!showAll && filtered.length > visualLimit && <button className="landscape-show-all" type="button" onClick={() => setShowAll(true)}>Visualise all {filtered.length} patents</button>}
      {selected && <PatentDetails patent={selected} onClose={() => setSelected(null)} />}
    </div>

    <style jsx global>{`
      .landscape-shell{min-height:calc(100vh - 40px);position:relative;isolation:isolate;overflow:hidden;border:1px solid rgba(56,189,248,.18);border-radius:18px;background:radial-gradient(circle at 70% 10%,rgba(34,211,238,.08),transparent 30%),radial-gradient(circle at 15% 70%,rgba(16,185,129,.07),transparent 34%),#050b18;color:#f8fafc}.landscape-shell:fullscreen{width:100vw;height:100vh;border:0;border-radius:0;overflow:auto}.landscape-stars{position:absolute;inset:0;z-index:-1;pointer-events:none}.landscape-header{padding:clamp(24px,4vw,44px);display:flex;align-items:flex-start;justify-content:space-between;gap:24px;border-bottom:1px solid rgba(56,189,248,.14);background:rgba(5,11,24,.56)}.landscape-badge{display:inline-flex;padding:6px 9px;border:1px solid rgba(34,211,238,.28);border-radius:999px;background:rgba(34,211,238,.07);color:#67e8f9;font-size:12px;font-weight:800}.landscape-header h1{margin:14px 0 4px;font-size:clamp(34px,5vw,58px);letter-spacing:-.04em}.landscape-header p{max-width:72ch;margin:0;color:#d5e2ee;font-size:18px;line-height:1.6}.landscape-meta{margin-top:16px;display:flex;flex-wrap:wrap;gap:8px}.landscape-meta span{padding:5px 8px;border-radius:6px;background:rgba(13,27,46,.8);color:#94a3b8;font-size:13px}.landscape-header-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;justify-content:flex-end}.landscape-header-actions a,.landscape-header-actions button,.landscape-toolbar button,.landscape-filters button,.landscape-show-all,.patent-details button{min-height:44px;padding:0 14px;border:1px solid rgba(56,189,248,.26);border-radius:8px;background:rgba(13,27,46,.9);color:#dbeafe;cursor:pointer;font:inherit;font-size:14px;font-weight:700}.landscape-header-actions button,.landscape-toolbar>button{background:linear-gradient(115deg,#0b3d36,#0e7490,#22d3ee);color:#f8fafc}.landscape-header-actions a{display:inline-flex;align-items:center}.landscape-toolbar{padding:16px clamp(20px,4vw,44px);display:flex;align-items:center;justify-content:space-between;gap:14px}.landscape-toolbar>[role=tablist]{display:flex;padding:4px;border:1px solid rgba(56,189,248,.14);border-radius:10px;background:rgba(8,20,38,.8)}.landscape-toolbar [role=tab]{border:0;background:transparent}.landscape-toolbar [role=tab][aria-selected=true]{background:#0b3d36;color:#67e8f9;box-shadow:0 0 18px rgba(34,211,238,.09)}.landscape-filters{padding:0 clamp(20px,4vw,44px) 18px;display:grid;grid-template-columns:2fr repeat(4,minmax(130px,1fr)) auto;align-items:end;gap:10px}.landscape-filters label{display:grid;gap:6px}.landscape-filters label>span{color:#94a3b8;font-size:12px;font-weight:750}.landscape-filters input,.landscape-filters select{width:100%;min-height:44px;padding:0 10px;border:1px solid rgba(56,189,248,.18);border-radius:8px;background:#081426;color:#f8fafc;color-scheme:light;font:inherit;font-size:14px}.landscape-filters>div{display:grid;gap:5px;justify-items:end}.landscape-filters>div strong{color:#94a3b8;font-size:12px}.landscape-filters button{min-height:34px;padding-inline:9px}.landscape-header-actions a:focus-visible,.landscape-shell button:focus-visible,.landscape-shell input:focus-visible,.landscape-shell select:focus-visible,.landscape-node:focus-visible,.timeline-svg g[role=button]:focus-visible{outline:2px solid #38bdf8;outline-offset:3px}.landscape-note,.landscape-error,.landscape-success{max-width:75ch;margin:0 clamp(20px,4vw,44px) 14px;padding:10px 12px;border-left:2px solid #22d3ee;background:rgba(34,211,238,.05);color:#aebed0;font-size:14px;line-height:1.6}.landscape-error{border-color:#f87171;color:#fecaca}.landscape-success{border-color:#10b981;color:#a7f3d0}.landscape-stage{min-height:580px;position:relative;margin:0 clamp(12px,2vw,24px) 24px;border:1px solid rgba(56,189,248,.13);border-radius:14px;background:rgba(5,11,24,.55);overflow:hidden}.network-graph-host,.timeline-visual{animation:landscape-view-in .22s ease both}.network-graph-host,.timeline-svg-wrap{min-height:580px;position:relative}.landscape-svg{width:100%;height:auto;display:block;touch-action:none}.landscape-node{cursor:pointer}.landscape-node.centre circle{animation:landscape-pulse 3s ease-in-out infinite}.landscape-edge.flowing{stroke-dasharray:5 9;animation:landscape-flow 3s linear infinite}.landscape-tooltip{max-width:310px;padding:14px;display:grid;gap:6px;position:absolute;z-index:5;top:14px;left:14px;border:1px solid rgba(34,211,238,.26);border-radius:9px;background:rgba(8,20,38,.92);box-shadow:0 16px 40px rgba(0,0,0,.3);backdrop-filter:blur(12px);pointer-events:none}.landscape-tooltip strong{font-size:15px;line-height:1.45}.landscape-tooltip span{color:#a8b8ca;font-size:13px}.landscape-tooltip b{color:#67e8f9;font-size:13px}.landscape-show-all{position:absolute;z-index:4;right:14px;bottom:14px}.patent-details{width:min(460px,44%);height:100%;padding:24px;position:absolute;z-index:10;top:0;right:0;overflow:auto;border-left:1px solid rgba(34,211,238,.24);background:rgba(8,20,38,.97);box-shadow:-24px 0 60px rgba(0,0,0,.34)}.patent-details>header{display:flex;align-items:flex-start;justify-content:space-between;gap:15px}.patent-details h2{margin:8px 0 0;font-size:22px;line-height:1.35}.patent-details .landscape-badge{margin:0}.patent-details-meta{margin:18px 0;display:grid;gap:9px}.patent-details-meta div{display:flex;justify-content:space-between;gap:14px;padding-bottom:8px;border-bottom:1px solid rgba(56,189,248,.1)}.patent-details dt{color:#94a3b8;font-size:12px}.patent-details dd{margin:0;text-align:right;color:#dbeafe;font-size:13px}.patent-details>p{max-width:72ch;color:#cbd5e1;font-size:15px;line-height:1.7}.patent-details>a{color:#38bdf8;font-size:14px;font-weight:700}.match-counts{margin:20px 0;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.match-counts div{padding:10px;background:rgba(13,27,46,.9);text-align:center}.match-counts strong{display:block;font-size:22px}.match-counts span{color:#94a3b8;font-size:11px}.patent-feature-list{margin:14px 0 0;padding:0;display:grid;gap:12px;list-style:none}.patent-feature-list li{padding:14px;border:1px solid rgba(56,189,248,.12);border-radius:8px;background:rgba(5,11,24,.65)}.patent-feature-list strong{display:block;font-size:15px;line-height:1.5}.patent-feature-list span{display:block;margin-top:6px;color:#67e8f9;font-size:12px}.patent-feature-list p{max-width:70ch;margin:7px 0 0;color:#aebed0;font-size:14px;line-height:1.65}.timeline-visual{padding:20px}.timeline-svg-wrap{min-height:0}.timeline-mobile-list{display:none}.timeline-summary{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:0 18px 22px}.timeline-summary>div,.timeline-summary>p{margin:0;padding:16px;border:1px solid rgba(56,189,248,.12);border-radius:9px;background:rgba(8,20,38,.7)}.timeline-summary>div>div{margin-top:9px;display:flex;flex-wrap:wrap;gap:8px}.timeline-summary span{color:#94a3b8;font-size:12px}.timeline-summary p{max-width:70ch;color:#cbd5e1;font-size:14px;line-height:1.65}.landscape-empty{min-height:300px;display:grid;place-content:center;text-align:center}.landscape-empty strong{font-size:20px}.landscape-empty p{max-width:70ch;color:#aebed0;font-size:15px;line-height:1.65}.sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}@keyframes landscape-pulse{50%{filter:drop-shadow(0 0 14px rgba(34,211,238,.75))}}@keyframes landscape-flow{to{stroke-dashoffset:-28}}@keyframes landscape-view-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
      @media(max-width:1000px){.landscape-filters{grid-template-columns:repeat(3,1fr)}.landscape-filters>div{justify-items:start}.landscape-header{flex-direction:column}.landscape-header-actions{justify-content:flex-start}}@media(max-width:767px){.landscape-shell{border-radius:12px}.landscape-header{padding:22px}.landscape-header h1{font-size:36px}.landscape-header-actions{width:100%}.landscape-header-actions a,.landscape-header-actions button{flex:1;justify-content:center}.landscape-toolbar{align-items:stretch;flex-direction:column}.landscape-toolbar>[role=tablist]{display:grid;grid-template-columns:1fr 1fr}.landscape-filters{grid-template-columns:1fr 1fr}.landscape-filters label:first-child{grid-column:1/-1}.landscape-filters>div{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between}.landscape-stage,.network-graph-host{min-height:480px}.network-svg{min-width:760px;transform:translateX(-140px)}.patent-details{width:100%;height:auto;max-height:82%;top:auto;bottom:0;border-top:1px solid rgba(34,211,238,.24);border-left:0;border-radius:16px 16px 0 0}.timeline-svg-wrap{display:none}.timeline-mobile-list{margin:0;padding:0;display:grid;gap:8px;list-style:none}.timeline-mobile-list button{width:100%;padding:11px;display:grid;grid-template-columns:8px 1fr auto;align-items:center;gap:10px;border:1px solid rgba(56,189,248,.13);border-radius:8px;background:#081426;color:#f8fafc;text-align:left}.timeline-mobile-list i{width:8px;height:8px;border-radius:50%}.timeline-mobile-list span{display:grid;gap:4px}.timeline-mobile-list small{color:#94a3b8}.timeline-summary{grid-template-columns:1fr;padding:16px 0}.match-counts{grid-template-columns:repeat(2,1fr)}}@media(max-width:480px){.landscape-filters{grid-template-columns:1fr}.landscape-filters label:first-child,.landscape-filters>div{grid-column:auto}.landscape-meta{display:grid}.landscape-header-actions{display:grid}.landscape-toolbar>button{width:100%}}@media(prefers-reduced-motion:reduce){.landscape-node.centre circle,.landscape-edge.flowing,.network-graph-host,.timeline-visual{animation:none}.landscape-shell *{scroll-behavior:auto!important;transition:none!important}}
    `}</style>
  </div>;
}

function PatentDetails({ patent, onClose }: { patent: LandscapePatent; onClose: () => void }) {
  return <aside className="patent-details" role="dialog" aria-modal="false" aria-labelledby="patent-details-title">
    <header><div><span className="landscape-badge">{classificationLabel(patent.classification)}</span><h2 id="patent-details-title">{patent.title}</h2></div><button type="button" onClick={onClose} aria-label="Close patent details">Close</button></header>
    <dl className="patent-details-meta"><div><dt>Publication</dt><dd>{patent.publicationNumber}</dd></div><div><dt>Applicant</dt><dd>{patent.applicant}</dd></div><div><dt>Date</dt><dd>{patent.date ?? "Not listed"}</dd></div><div><dt>Observed overlap score</dt><dd>{patent.classification === "insufficient" ? "Not available" : patent.score}</dd></div></dl>
    <p>{patent.abstract}</p>{patent.sourceUrl && <a href={patent.sourceUrl} target="_blank" rel="noreferrer">View patent source ↗</a>}
    <div className="match-counts" aria-label="Feature comparison counts">{(["FULL", "PARTIAL", "NOT_FOUND", "UNCERTAIN"] as const).map((status) => <div key={status}><strong>{patent.counts[status]}</strong><span>{status}</span></div>)}</div>
    <h3>Feature comparisons</h3><ol className="patent-feature-list">{patent.comparisons.map((comparison, index) => <li key={`${index}-${comparison.feature}`}><strong>{comparison.feature}</strong><span>{comparison.matchType} · Keywords: {comparison.matchedKeywords.length ? comparison.matchedKeywords.join(", ") : "None"}</span><p>{comparison.explanation}</p></li>)}</ol>
  </aside>;
}
