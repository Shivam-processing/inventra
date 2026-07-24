"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateWorkflowState,
  type WorkflowState,
  type WorkflowStateInput,
  type WorkflowStatus,
  type WorkflowTarget,
} from "@/lib/patents/workflow-state";
import { workspaceSectionForTarget } from "@/lib/patents/invention-workspace";

const statusLabels: Record<WorkflowStatus, string> = {
  NOT_STARTED: "Not started",
  ACTION_REQUIRED: "Action required",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  OUTDATED: "Outdated",
  ERROR: "Error",
};

function focusTarget(target: WorkflowTarget, analysisStatus: string) {
  window.dispatchEvent(new CustomEvent("inventra:workspace-navigate", {
    detail: {
      section: workspaceSectionForTarget(target, analysisStatus),
      focusSelector: target === "draft-save" ? ".draft-save-bar button" : undefined,
    },
  }));
}

export function WorkflowProgress({
  inventionId,
  input,
  initialState,
  compact = false,
}: {
  inventionId: string;
  input: WorkflowStateInput;
  initialState: WorkflowState;
  compact?: boolean;
}) {
  const [hasUnsavedDraftChanges, setHasUnsavedDraftChanges] = useState(input.hasUnsavedDraftChanges);

  useEffect(() => {
    function handleDraftState(event: Event) {
      const detail = (event as CustomEvent<{ inventionId?: string; dirty?: boolean }>).detail;
      if (detail?.inventionId === inventionId) setHasUnsavedDraftChanges(Boolean(detail.dirty));
    }
    window.addEventListener("inventra:draft-dirty", handleDraftState);
    return () => window.removeEventListener("inventra:draft-dirty", handleDraftState);
  }, [inventionId]);

  const state = useMemo(() => hasUnsavedDraftChanges === input.hasUnsavedDraftChanges
    ? initialState
    : calculateWorkflowState({ ...input, hasUnsavedDraftChanges }), [hasUnsavedDraftChanges, initialState, input]);

  return <section className={compact ? "workflow-progress-panel workflow-progress-compact" : "workflow-progress-panel"} aria-labelledby="workflow-progress-title">
    <header className="workflow-progress-header">
      <div><p className="eyebrow">CURRENT WORKFLOW</p><h2 id="workflow-progress-title">Workflow progress</h2><p>Every downstream result is checked against the approved feature version and its source records.</p></div>
      <div className="workflow-completion" aria-label={`${state.completedSteps} of ${state.totalSteps} workflow steps completed`}>
        <strong>{state.completionPercentage}%</strong><span>{state.completedSteps} of {state.totalSteps} current</span>
        <i><b style={{ width: `${state.completionPercentage}%` }} /></i>
      </div>
    </header>

    {!compact && <ol className="workflow-stepper" aria-label="Invention workflow steps">
      {state.steps.map((step, index) => <li className={`workflow-step status-${step.status.toLowerCase()}`} key={step.id}>
        <button type="button" onClick={() => focusTarget(step.target, input.analysisStatus)} aria-label={`${step.label}: ${statusLabels[step.status]}. Go to section.`}>
          <span className="workflow-step-number" aria-hidden="true">{step.status === "COMPLETED" ? "✓" : String(index + 1).padStart(2, "0")}</span>
          <span className="workflow-step-copy"><strong>{step.label}</strong><small className="workflow-status-text">{statusLabels[step.status]}</small>{step.version !== null && <small>Feature set v{step.version}</small>}<em>{step.explanation}</em></span>
        </button>
      </li>)}
    </ol>}

    {compact && <ul className="workflow-compact-readiness" aria-label="Workflow readiness summary">{state.steps.map((step) => <li className={`status-${step.status.toLowerCase()}`} key={step.id}><span aria-hidden="true">{step.status === "COMPLETED" ? "✓" : step.status === "ERROR" ? "×" : step.status === "OUTDATED" ? "↺" : "○"}</span><strong>{step.label}</strong><small>{statusLabels[step.status]}</small>{step.version !== null && <em>v{step.version}</em>}</li>)}</ul>}

    <div className="workflow-recommendation">
      <span aria-hidden="true">→</span><div><small>RECOMMENDED NEXT ACTION</small><h3>{state.recommendation.title}</h3><p>{state.recommendation.explanation}</p></div>
      <button type="button" onClick={() => focusTarget(state.recommendation.target, input.analysisStatus)}>{state.recommendation.buttonLabel}<span aria-hidden="true">→</span></button>
    </div>
  </section>;
}
