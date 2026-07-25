"use client";

import { useRef, useState } from "react";

export function FullReportDownload({ inventionId, disabled }: { inventionId: string; disabled: boolean }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);

  async function download() {
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/reports/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventionId }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: unknown } | null;
        throw new Error(typeof payload?.error === "string" ? payload.error : "The full report could not be generated.");
      }

      const blob = await response.blob();
      if (blob.type !== "application/pdf" || blob.size === 0) throw new Error("The generated report was invalid. Please retry.");
      const disposition = response.headers.get("Content-Disposition");
      const filename = disposition?.match(/filename="([^"]+)"/)?.[1] ?? "inventra-analysis-report.pdf";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setStatus("success");
      setMessage("Full analysis report download started.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "The full report could not be generated. Please retry.");
    } finally {
      inFlight.current = false;
    }
  }

  return <div className="full-report-download">
    <button type="button" onClick={download} disabled={disabled || status === "loading"}>
      {status === "loading" && <span className="auth-spinner" aria-hidden="true" />}
      {status === "loading" ? "Generating your report…" : status === "error" ? "Retry full report" : "Download Full Analysis Report"}
    </button>
    {message && <p className={status === "error" ? "full-report-message error" : "full-report-message success"} role={status === "error" ? "alert" : "status"}>{status === "success" ? "✓ " : ""}{message}</p>}
  </div>;
}
