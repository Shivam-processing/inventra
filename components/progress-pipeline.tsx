"use client";

import { useState } from "react";

const stages = ["Description", "Images", "Analysis", "Features", "Patent Search", "Report", "Draft"];

export function ProgressPipeline() {
  const [selected, setSelected] = useState(2);

  return <section className="dashboard-pipeline card" aria-labelledby="pipeline-title">
    <div className="pipeline-heading"><div><p className="eyebrow">WORKFLOW</p><h2 id="pipeline-title">Invention progress</h2></div><p><strong>{stages[selected]}</strong><span>{selected < 2 ? "Completed stage" : selected === 2 ? "Current focus" : "Upcoming stage"}</span></p></div>
    <div className="pipeline-track" role="group" aria-label="Invention workflow stages">
      {stages.map((stage, index) => <button className={index < 2 ? "complete" : index === 2 ? "current" : "upcoming"} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)} key={stage}><span>{index < 2 ? "✓" : index + 1}</span><small>{stage}</small></button>)}
    </div>
  </section>;
}
