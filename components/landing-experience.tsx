"use client";

import Link from "next/link";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import type { PointerEvent } from "react";

const workflow = [
  ["01", "Describe", "Capture the problem, solution, and inventive idea."],
  ["02", "Images", "Add real prototype views, diagrams, and sketches."],
  ["03", "Analysis", "Extract components, interactions, and key features."],
  ["04", "Clarify", "Resolve uncertainty with focused technical questions."],
  ["05", "Search", "Compare reviewed features against related patents."],
  ["06", "Report", "Understand overlap and points of differentiation."],
  ["07", "Draft", "Build an editable patent specification in your workspace."],
  ["08", "Download", "Export the reviewed draft as DOCX or PDF."],
];

const reveal = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0 },
};

function AnalysisVisual() {
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
    <motion.div className="patent-mini-card patent-card-a" style={reducedMotion ? undefined : { x: driftX, y: driftY }}><span>US PATENT SIGNAL</span><strong>14 related documents</strong><small>Similarity cluster mapped</small></motion.div>
    <motion.div className="patent-mini-card patent-card-b" style={reducedMotion ? undefined : { x: reverseDriftX, y: driftY }}><span>NOVELTY LAYER</span><strong>3 distinct features</strong><small>Ready for inventor review</small></motion.div>
    <div className="analysis-node node-feature"><i>01</i><span><strong>Feature extracted</strong><small>Pressure control assembly</small></span></div>
    <div className="analysis-node node-prior"><i>02</i><span><strong>Prior art match</strong><small>82% feature proximity</small></span></div>
    <div className="analysis-node node-draft"><i>03</i><span><strong>Draft generated</strong><small>Claims structure ready</small></span></div>
    <div className="lab-schematic" aria-label="Interactive invention analysis schematic">
      <div className="schematic-toolbar"><span><i /> LIVE ANALYSIS</span><small>INV–0248</small></div>
      <svg viewBox="0 0 520 430" role="img" aria-label="Patent blueprint of a modular invention with connected feature nodes">
        <defs>
          <linearGradient id="device-edge" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#22D3EE" /><stop offset="1" stopColor="#10b981" /></linearGradient>
          <radialGradient id="device-core"><stop stopColor="#22D3EE" stopOpacity=".75" /><stop offset="1" stopColor="#3B82F6" stopOpacity="0" /></radialGradient>
          <filter id="cyan-glow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
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
          <circle cx="260" cy="204" r="22" /><circle cx="260" cy="204" r="8" fill="#22D3EE" stroke="none" filter="url(#cyan-glow)" />
          <path d="M234 261 L217 282 M286 261 L304 282 M235 145 L235 119 M285 145 L285 119" opacity=".72" />
        </g>
        <g className="blueprint-marks" fill="#94A3B8"><text x="38" y="57">FIG. 01 / SYSTEM VIEW</text><text x="368" y="398">SCALE 1:2</text><text x="38" y="398">PATENT LAB / A-17</text></g>
      </svg>
      <motion.div className="scan-line" animate={reducedMotion ? undefined : { y: [0, 330, 0] }} transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }} aria-hidden="true" />
      <div className="schematic-status"><span><i /> 12 features mapped</span><span>Confidence 94.2%</span></div>
    </div>
  </motion.div>;
}

export function LandingExperience() {
  const reducedMotion = useReducedMotion();
  const spotlightX = useMotionValue(70);
  const spotlightY = useMotionValue(32);
  const smoothX = useSpring(spotlightX, { stiffness: 70, damping: 22 });
  const smoothY = useSpring(spotlightY, { stiffness: 70, damping: 22 });
  const background = useTransform([smoothX, smoothY], ([x, y]) => `radial-gradient(620px circle at ${x}% ${y}%, rgba(34,211,238,.13), transparent 58%)`);

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
        <motion.div className="lab-hero-copy" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: reducedMotion ? 0 : .09 } } }}>
          <motion.div className="lab-kicker" variants={reveal}><span /> AI PATENT INTELLIGENCE LAB</motion.div>
          <motion.h1 variants={reveal}>Turn your invention into <em>protected intellectual property.</em></motion.h1>
          <motion.p variants={reveal}>Transform rough ideas, prototype images, and technical notes into reviewed features, prior-art intelligence, and an editable patent draft.</motion.p>
          <motion.div className="lab-hero-actions" variants={reveal}>
            <Link className="lab-primary-cta" href="/dashboard">Enter the patent lab <span aria-hidden="true">↗</span></Link>
            <a className="lab-secondary-cta" href="#lab-workflow"><span aria-hidden="true">▶</span> Explore the process</a>
          </motion.div>
          <motion.div className="lab-proof" variants={reveal}><span><i>✓</i> Private workspace</span><span><i>✓</i> Inventor-reviewed</span><span><i>✓</i> Export ready</span></motion.div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: .94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : .8, delay: .2 }}><AnalysisVisual /></motion.div>
      </div>
    </motion.section>

    <section className="lab-signal-strip" aria-label="Inventra capabilities"><div className="section-shell">
      <span><i>01</i><strong>Multimodal analysis</strong><small>Text + real invention images</small></span>
      <span><i>02</i><strong>Evidence-led search</strong><small>Feature-level patent comparison</small></span>
      <span><i>03</i><strong>Human checkpoints</strong><small>Nothing advances unreviewed</small></span>
      <span><i>04</i><strong>Editable output</strong><small>Drafts built for refinement</small></span>
    </div></section>

    <section className="lab-workflow" id="lab-workflow">
      <div className="section-shell">
        <motion.div className="lab-section-heading" initial="hidden" whileInView="visible" viewport={{ once: true, amount: .4 }} variants={reveal}>
          <span className="lab-kicker"><i /> INTELLIGENCE PIPELINE</span>
          <h2>From raw idea to <em>structured protection.</em></h2>
          <p>Every stage builds on inventor-reviewed evidence, keeping the process transparent and grounded.</p>
        </motion.div>
        <div className="lab-workflow-track" aria-hidden="true"><span /></div>
        <div className="lab-workflow-grid">
          {workflow.map(([number, title, description], index) => <motion.article className="lab-step-card" initial="hidden" whileInView="visible" viewport={{ once: true, amount: .25 }} variants={reveal} transition={{ delay: reducedMotion ? 0 : index * .045 }} whileHover={reducedMotion ? undefined : { y: -7 }} key={number}>
            <div><span>{number}</span><i>{index < 4 ? "ACTIVE" : "PIPELINE"}</i></div><h3>{title}</h3><p>{description}</p><small>OPEN STAGE <b aria-hidden="true">→</b></small>
          </motion.article>)}
        </div>
      </div>
    </section>

    <section className="lab-control"><div className="section-shell lab-control-grid">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: .35 }} variants={reveal}>
        <span className="lab-kicker"><i /> HUMAN-IN-THE-LOOP</span><h2>AI maps the invention.<br /><em>You control the record.</em></h2><p>Inventra exposes uncertainty, asks focused questions, and keeps every extracted feature editable before any search or draft begins.</p>
        <ul><li><span>01</span>Inspect every extracted component</li><li><span>02</span>Correct technical assumptions</li><li><span>03</span>Approve the final feature set</li></ul>
      </motion.div>
      <motion.div className="lab-review-panel" initial={{ opacity: 0, x: 28 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: .35 }} transition={{ duration: reducedMotion ? 0 : .6 }}>
        <div className="review-panel-top"><span>FEATURE REVIEW / 07</span><i>NEEDS INPUT</i></div><h3>Pressure regulation assembly</h3><p>The prototype appears to use a spring-biased valve connected to the primary chamber.</p><div className="review-confidence"><span>VISUAL CONFIDENCE</span><strong>71%</strong><i><b /></i></div><div className="review-question"><span>?</span><p><strong>Clarification required</strong>Is the valve mechanically triggered or pressure activated?</p></div><div className="review-actions"><button type="button">Edit finding</button><button type="button">Approve feature ✓</button></div>
      </motion.div>
    </div></section>

    <section className="lab-cta section-shell"><div className="cta-glow" aria-hidden="true" /><div><span className="lab-kicker"><i /> INITIALIZE WORKSPACE</span><h2>Your invention deserves a sharper path forward.</h2><p>Start with what you know. Build the evidence layer one reviewed step at a time.</p></div><Link className="lab-primary-cta" href="/dashboard">Start your invention <span aria-hidden="true">→</span></Link></section>
  </main>;
}
