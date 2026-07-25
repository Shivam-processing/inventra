"use client";

import { useActionState, useRef, useState } from "react";
import {
  deleteInvention,
  type DeleteInventionState,
} from "@/app/dashboard/inventions/delete-actions";
import { deletionConfirmationMatches } from "@/lib/inventions/deletion";

const initialState: DeleteInventionState = {};
const warning = "Deleting this invention permanently removes its images, searches, overlap reports, drafts, and workflow history. This action cannot be undone.";

export function DeleteInventionDialog({ inventionId, inventionTitle, compact = false }: {
  inventionId: string;
  inventionTitle: string;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(deleteInvention, initialState);
  const [confirmation, setConfirmation] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmed = deletionConfirmationMatches(confirmation, inventionTitle);

  function openDialog() {
    setConfirmation("");
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    if (pending) return;
    dialogRef.current?.close();
    triggerRef.current?.focus();
  }

  return <>
    <button ref={triggerRef} type="button" className={compact ? "delete-invention-trigger compact" : "delete-invention-trigger"} onClick={openDialog}>{compact ? "Delete" : "Delete invention"}</button>
    <dialog ref={dialogRef} className="delete-invention-dialog" onCancel={(event) => {
      if (pending) event.preventDefault();
      else closeDialog();
    }} onClose={() => triggerRef.current?.focus()}>
      <form action={action}>
        <input type="hidden" name="invention_id" value={inventionId} />
        <header><span aria-hidden="true">!</span><div><p className="eyebrow">DANGER ZONE</p><h2>Delete invention</h2></div></header>
        <p>{warning}</p>
        <label><span>Type <strong>{inventionTitle}</strong> or <strong>DELETE</strong> to confirm</span><input name="confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" disabled={pending} autoFocus /></label>
        {state.error && <div className="delete-invention-error" role="alert">{state.error}</div>}
        <footer><button type="button" onClick={closeDialog} disabled={pending}>Cancel</button><button type="submit" disabled={!confirmed || pending}>{pending ? "Deleting…" : "Delete invention"}</button></footer>
      </form>
    </dialog>
  </>;
}
