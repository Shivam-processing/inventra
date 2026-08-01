"use client";

import Link from "next/link";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import type { PointerEvent } from "react";
import { useLanguage } from "@/components/language-provider";

const reveal = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0 },
};

function AnalysisVisual() {
  const { t } = useLanguage();
  const reducedMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateX = useSpring(useTransform(pointerY, [-.5, .5], [4, -4]), { stiffness: 110, damping: 20 });
  const rotateY = useSpring(useTransform(pointerX, [-.5, .5], [-5, 5]), { stiffness: 110, damping: 20 });
  const driftX = useSpring(useTransform(pointerX, [-.5, .5], [-9, 9]), { stiffness: 85, damping: 22 });
  const driftY = useSpring(useTransform(pointerY, [-.5, .5], [-7, 7]), { stiffness: 85, damping: 22 });
  const reverseDriftX = useTransform(driftX, (value) => -value);

  function trackPointer(event: PointerEvent<HTMLDivElement>) {
    if (reducedMotion || event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - bounds.left) / bounds.width - .5);
    pointerY.set((event.clientY - bounds.top) / bounds.height - .5);
  }

  function resetPointer() {
    pointerX.set(0);
    pointerY.set(0);
  }

  return <motion.div className="lab-visual-wrap" onPointerMove={trackPointer} onPointerLeave={resetPointer} style={reducedMotion ? undefined : { rotateX, rotateY }}>
    <div className="lab-orbit orbit-one" aria-hidden="true" />
    <div className="lab-orbit orbit-two" aria-hidden="true" />
    <motion.div className="patent-mini-card patent-card-a" style={reducedMotion ? undefined : { x: driftX, y: driftY }}><span>{t("navigation.patentSearches")}</span><strong>14 {t("navigation.reports")}</strong><small>{t("landing.evidenceSearchDetail")}</small></motion.div>
    <motion.div className="patent-mini-card patent-card-b" style={reducedMotion ? undefined : { x: reverseDriftX, y: driftY }}><span>{t("workspace.novelty")}</span><strong>3 {t("workflow.features")}</strong><small>{t("landing.inventorReviewed")}</small></motion.div>
    <div className="analysis-node node-feature"><i>01</i><span><strong>{t("landing.stage.analysis")}</strong><small>{t("workflow.features")}</small></span></div>
    <div className="analysis-node node-prior"><i>02</i><span><strong>{t("workflow.patentSearch")}</strong><small>82% {t("matrix.partial")}</small></span></div>
    <div className="analysis-node node-draft"><i>03</i><span><strong>{t("workflow.patentDraft")}</strong><small>{t("status.ready")}</small></span></div>
    <div className="lab-schematic" aria-label={t("landing.multimodal")}>
      <div className="schematic-toolbar"><span><i /> {t("status.inProgress")}</span><small>INV–0248</small></div>
      <svg viewBox="0 0 520 430" role="img" aria-label="Patent blueprint of a modular invention with connected feature nodes">
        <defs>
          <linearGradient id="device-edge" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#D4603A" /><stop offset="1" stopColor="#2D7A4F" /></linearGradient>
          <radialGradient id="device-core"><stop stopColor="#D4603A" stopOpacity=".32" /><stop offset="1" stopColor="#CA8A04" stopOpacity="0" /></radialGradient>
          <filter id="cyan-glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <g className="schematic-links" fill="none">
          <path d="M159 142 L80 92" /><path d="M359 138 L442 82" /><path d="M374 280 L461 334" /><path d="M160 285 L64 342" />
        </g>
        <g className="schematic-points" filter="url(#cyan-glow)"><circle cx="80" cy="92" r="4" /><circle cx="442" cy="82" r="4" /><circle cx="461" cy="334" r="4" /><circle cx="64" cy="342" r="4" /></g>
        <ellipse cx="260" cy="218" rx="112" ry="108" fill="url(#device-core)" opacity=".32" />
        <g className="device-object" fill="none" stroke="url(#device-edge)" strokeWidth="2">
          <path d="M193 146 L255 111 L326 145 L326 274 L259 313 L193 276 Z" />
          <path d="M193 146 L259 183 L326 145 M259 183 L259 313" opacity=".72" />
          <rect x="219" y="164" width="81" height="98" rx="22" />
          <circle cx="260" cy="204" r="22" /><circle cx="260" cy="204" r="8" fill="#D4603A" stroke="none" filter="url(#cyan-glow)" />
          <path d="M234 261 L217 282 M286 261 L304 282 M235 145 L235 119 M285 145 L285 119" opacity=".72" />
        </g>
        <g className="blueprint-marks" fill="#94A3B8"><text x="38" y="57">{t("landing.figure")}</text><text x="368" y="398">{t("landing.scale")}</text><text x="38" y="398">{t("landing.labMark")}</text></g>
      </svg>
      <motion.div className="scan-line" animate={reducedMotion ? undefined : { y: [0, 330, 0] }} transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }} aria-hidden="true" />
      <div className="schematic-status"><span><i /> 12 {t("workflow.features")}</span><span>{t("status.completed")} 94.2%</span></div>
    </div>
  </motion.div>;
}

export function LandingExperience() {
  const { t } = useLanguage();
  const workflow = [
    { id: "capture", number: "01", title: t("landing.phaseCapture"), description: t("landing.phaseCaptureDescription"), steps: [t("landing.stage.describe"), t("landing.stage.images")], output: t("landing.phaseCaptureOutput") },
    { id: "understand", number: "02", title: t("landing.phaseUnderstand"), description: t("landing.phaseUnderstandDescription"), steps: [t("landing.stage.analysis"), t("landing.stage.clarify"), t("workflow.features")], output: t("landing.phaseUnderstandOutput") },
    { id: "compare", number: "03", title: t("landing.phaseCompare"), description: t("landing.phaseCompareDescription"), steps: [t("landing.stage.search"), t("landing.stage.report")], output: t("landing.phaseCompareOutput") },
    { id: "protect", number: "04", title: t("landing.phaseProtect"), description: t("landing.phaseProtectDescription"), steps: [t("landing.stage.draft"), t("landing.stage.download")], output: t("landing.phaseProtectOutput") },
  ] as const;
  const reducedMotion = useReducedMotion();
  const spotlightX = useMotionValue(70);
  const spotlightY = useMotionValue(32);
  const smoothX = useSpring(spotlightX, { stiffness: 70, damping: 22 });
  const smoothY = useSpring(spotlightY, { stiffness: 70, damping: 22 });
  const background = useTransform([smoothX, smoothY], ([x, y]) => `radial-gradient(620px circle at ${x}% ${y}%, rgba(212,96,58,.10), transparent 58%)`);

  function moveSpotlight(event: PointerEvent<HTMLElement>) {
    if (reducedMotion || event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    spotlightX.set(((event.clientX - bounds.left) / bounds.width) * 100);
    spotlightY.set(((event.clientY - bounds.top) / bounds.height) * 100);
  }

  return <main className="lab-main">
    <motion.section className="lab-hero" onPointerMove={moveSpotlight} style={reducedMotion ? undefined : { background }}>
      <div className="lab-grid" aria-hidden="true" />
      <div className="lab-aurora aurora-one" aria-hidden="true" /><div className="lab-aurora aurora-two" aria-hidden="true" />
      <div className="section-shell lab-hero-grid">
        <motion.div className="lab-hero-copy" initial={false} animate="visible" variants={{ visible: { transition: { staggerChildren: reducedMotion ? 0 : .09 } } }}>
          <motion.div className="lab-kicker" variants={reveal}><span /> {t("landing.kicker")}</motion.div>
          <motion.h1 variants={reveal}>{t("landing.titleStart")} <em>{t("landing.titleAccent")}</em></motion.h1>
          <motion.p variants={reveal}>{t("landing.description")}</motion.p>
          <motion.div className="lab-hero-actions" variants={reveal}>
            <Link className="lab-primary-cta" href="/dashboard">{t("landing.enterLab")} <span aria-hidden="true">↗</span></Link>
            <a className="lab-secondary-cta" href="#lab-workflow"><span aria-hidden="true">▶</span> {t("landing.explore")}</a>
          </motion.div>
          <motion.div className="lab-proof" variants={reveal}><span><i>✓</i> {t("landing.privateWorkspace")}</span><span><i>✓</i> {t("landing.inventorReviewed")}</span><span><i>✓</i> {t("landing.exportReady")}</span></motion.div>
        </motion.div>
        <motion.div initial={false} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : .8, delay: .2 }}><AnalysisVisual /></motion.div>
      </div>
    </motion.section>

    <section className="lab-signal-strip" aria-label={t("landing.capabilities")}><div className="section-shell">
      <span><i>01</i><strong>{t("landing.multimodal")}</strong><small>{t("landing.multimodalDetail")}</small></span>
      <span><i>02</i><strong>{t("landing.evidenceSearch")}</strong><small>{t("landing.evidenceSearchDetail")}</small></span>
      <span><i>03</i><strong>{t("landing.humanCheckpoints")}</strong><small>{t("landing.humanCheckpointsDetail")}</small></span>
      <span><i>04</i><strong>{t("landing.editableOutput")}</strong><small>{t("landing.editableOutputDetail")}</small></span>
    </div></section>

    <section className="lab-workflow" id="lab-workflow">
      <div className="section-shell">
        <motion.div className="lab-section-heading" initial={false} whileInView="visible" viewport={{ once: true, amount: .4 }} variants={reveal}>
          <span className="lab-kicker"><i /> {t("landing.pipeline")}</span>
          <h2>{t("landing.pipelineTitleStart")} <em>{t("landing.pipelineTitleAccent")}</em></h2>
          <p>{t("landing.pipelineDescription")}</p>
        </motion.div>
        <div className="lab-workflow-track" aria-hidden="true"><span /></div>
        <div className="lab-workflow-grid workshop-phase-grid">
          {workflow.map((phase) => <motion.article className={`lab-step-card workshop-phase phase-${phase.id}`} initial={false} whileInView="visible" viewport={{ once: true, amount: .25 }} variants={reveal} transition={{ duration: reducedMotion ? 0 : .35 }} key={phase.id}>
            <header><span>{phase.number}</span><strong>{phase.title}</strong></header><p>{phase.description}</p><ul>{phase.steps.map((step) => <li key={step}><i aria-hidden="true">✓</i>{step}</li>)}</ul><footer><span>{t("landing.phaseOutput")}</span><strong>{phase.output}</strong></footer>
          </motion.article>)}
        </div>
      </div>
    </section>

    <section className="lab-control"><div className="section-shell lab-control-grid">
      <motion.div initial={false} whileInView="visible" viewport={{ once: true, amount: .35 }} variants={reveal}>
        <span className="lab-kicker"><i /> {t("landing.humanLoop")}</span><h2>{t("landing.controlTitle")}<br /><em>{t("landing.controlAccent")}</em></h2><p>{t("landing.controlDescription")}</p>
        <ul><li><span>01</span>{t("landing.inspectComponents")}</li><li><span>02</span>{t("landing.correctAssumptions")}</li><li><span>03</span>{t("landing.approveFeatures")}</li></ul>
      </motion.div>
      <motion.div className="lab-review-panel" initial={false} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: .35 }} transition={{ duration: reducedMotion ? 0 : .6 }}>
        <div className="review-panel-top"><span>{t("workspace.featureReview")} / 07</span><i>{t("status.actionRequired")}</i></div><h3>{t("landing.inspectComponents")}</h3><p>{t("landing.controlDescription")}</p><div className="review-confidence"><span>{t("landing.inventorReviewed")}</span><strong>71%</strong><i><b /></i></div><div className="review-question"><span>?</span><p><strong>{t("workspace.reviewRequired")}</strong>{t("clarification.description")}</p></div><div className="review-actions"><button type="button">{t("common.retry")}</button><button type="button">{t("features.approve")} ✓</button></div>
      </motion.div>
    </div></section>

    <section className="lab-cta section-shell"><div className="cta-glow" aria-hidden="true" /><div><span className="lab-kicker"><i /> {t("landing.initialize")}</span><h2>{t("landing.ctaTitle")}</h2><p>{t("landing.ctaDescription")}</p></div><Link className="lab-primary-cta" href="/dashboard">{t("navigation.startInvention")} <span aria-hidden="true">→</span></Link></section>
  </main>;
}
