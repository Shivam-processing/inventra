"use client";

import { useActionState, useState } from "react";
import {
  saveClarifications,
  type ClarificationActionState,
} from "@/app/dashboard/inventions/[id]/clarification-actions";
import type { ClarificationItem, ClarificationState } from "@/lib/ai/clarification";

const initialActionState: ClarificationActionState = {};

const statusLabels = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
} as const;

export function ClarificationReview({
  inventionId,
  clarification,
}: {
  inventionId: string;
  clarification: ClarificationState;
}) {
  const [actionState, action, pending] = useActionState(saveClarifications, initialActionState);
  const [editor, setEditor] = useState<{ revision: number; items: ClarificationItem[] }>({
    revision: clarification.revision,
    items: clarification.items,
  });
  const [expandedItems, setExpandedItems] = useState<Set<ClarificationItem["id"]>>(() => new Set(
    clarification.items.filter((item) => !item.skipped && item.answer.trim().length === 0).map((item) => item.id),
  ));
  const items = editor.revision === clarification.revision ? editor.items : clarification.items;

  const dirty = JSON.stringify(items) !== JSON.stringify(clarification.items);
  const completeReady = items.every((item) => item.skipped || item.answer.trim().length > 0);
  const orderedItems = [...items].sort((left, right) => {
    const leftResolved = left.skipped || left.answer.trim().length > 0;
    const rightResolved = right.skipped || right.answer.trim().length > 0;
    return Number(leftResolved) - Number(rightResolved);
  });

  function updateAnswer(id: ClarificationItem["id"], answer: string) {
    setEditor({
      revision: clarification.revision,
      items: items.map((item) => item.id === id ? { ...item, answer, skipped: false } : item),
    });
  }

  function updateSkipped(id: ClarificationItem["id"], skipped: boolean) {
    setEditor({
      revision: clarification.revision,
      items: items.map((item) => item.id === id ? { ...item, skipped } : item),
    });
  }

  return <section className="clarification-review" aria-labelledby="clarification-heading">
    <header className="clarification-header">
      <div><span className="eyebrow">DETERMINISTIC CLARIFICATION</span><h2 id="clarification-heading">Resolve technical gaps</h2><p>Questions appear only when the stored invention information does not clearly answer them.</p></div>
      <span className={`clarification-status status-${clarification.status.toLowerCase()}`}>{statusLabels[clarification.status]}</span>
    </header>

    <div className="clarification-note" role="note"><span aria-hidden="true">!</span><p>Clarification answers improve the technical description but must still be reviewed before patent searching.</p></div>

    <form action={action} className="clarification-form">
      <input type="hidden" name="invention_id" value={inventionId} />
      <input type="hidden" name="revision" value={clarification.revision} />

      {items.length === 0 ? <div className="clarification-empty"><span aria-hidden="true">✓</span><div><strong>No unresolved clarification questions</strong><p>The stored title, problem, solution, novelty, claims, and feature information currently cover the deterministic checks.</p></div></div> : <ol className="clarification-list">
        {orderedItems.map((item, index) => {
          const resolved = item.skipped || item.answer.trim().length > 0;
          return <li key={item.id}>
            <details className="clarification-item" open={expandedItems.has(item.id)} onToggle={(event) => {
              const open = event.currentTarget.open;
              setExpandedItems((current) => {
                if (current.has(item.id) === open) return current;
                const next = new Set(current);
                if (open) next.add(item.id); else next.delete(item.id);
                return next;
              });
            }}>
              <summary>
                <div className="clarification-question"><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{item.question}</h3><p>May affect: <strong>{item.affects}</strong></p></div></div>
                <span className={resolved ? "clarification-resolution resolved" : "clarification-resolution"}>{resolved ? "Resolved" : "Action required"}</span>
              </summary>
              <div className="clarification-answer">
                <label><span>Your answer</span><textarea name={`answer:${item.id}`} value={item.answer} onChange={(event) => updateAnswer(item.id, event.target.value)} disabled={pending || item.skipped} maxLength={3000} rows={4} placeholder="Add only information you know to be accurate." /></label>
                <label className="clarification-skip"><input type="checkbox" name={`skip:${item.id}`} value="true" checked={item.skipped} onChange={(event) => updateSkipped(item.id, event.target.checked)} disabled={pending} /><span>Skip this optional question</span></label>
              </div>
            </details>
          </li>;
        })}
      </ol>}

      {clarification.featureReviewRequired && <div className="clarification-review-required" role="status"><span aria-hidden="true">↺</span><p><strong>Feature review required</strong>Technical clarification answers changed. Existing downstream records remain readable but are now from an older feature-set version.</p></div>}
      {actionState.error && <div className="analysis-message analysis-error" role="alert"><span>!</span>{actionState.error}</div>}
      {actionState.message && <div className="analysis-message analysis-success" role="status"><span>✓</span>{actionState.message}</div>}

      <footer>
        <p>{items.length ? `${items.filter((item) => item.answer.trim().length > 0 || item.skipped).length} of ${items.length} resolved` : "No answers required"}</p>
        <div><button type="submit" name="intent" value="save" className="clarification-save" disabled={pending || !dirty}>{pending ? "Saving…" : actionState.error ? "Retry save" : "Save answers"}</button><button type="submit" name="intent" value="complete" className="clarification-complete" disabled={pending || !completeReady || (clarification.status === "COMPLETED" && !dirty)}>{pending ? "Saving…" : clarification.status === "COMPLETED" && !dirty ? "Clarification complete" : "Mark clarification complete"}</button></div>
      </footer>
    </form>
  </section>;
}
