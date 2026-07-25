"use client";

import { useState } from "react";
import { useLanguage } from "@/components/language-provider";

const stageKeys = ["landing.stage.describe", "landing.stage.images", "landing.stage.analysis", "workflow.features", "workflow.patentSearch", "landing.stage.report", "landing.stage.draft"] as const;

export function ProgressPipeline() {
  const [selected, setSelected] = useState(2);
  const { t } = useLanguage();
  const stages = stageKeys.map((key) => t(key));

  return <section className="dashboard-pipeline card" aria-labelledby="pipeline-title">
    <div className="pipeline-heading"><div><p className="eyebrow">{t("workflow.current")}</p><h2 id="pipeline-title">{t("workflow.title")}</h2></div><p><strong>{stages[selected]}</strong><span>{selected < 2 ? t("status.completed") : selected === 2 ? t("status.current") : t("status.notStarted")}</span></p></div>
    <div className="pipeline-track" role="group" aria-label={t("workflow.stepsLabel")}>
      {stages.map((stage, index) => <button className={index < 2 ? "complete" : index === 2 ? "current" : "upcoming"} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)} key={stage}><span>{index < 2 ? "✓" : index + 1}</span><small>{stage}</small></button>)}
    </div>
  </section>;
}
