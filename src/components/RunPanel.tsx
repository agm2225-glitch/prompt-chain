"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Progress = {
  phase: "idle" | "uploading" | "running" | "done" | "failed";
  total: number;
  done: number; // steps finished so far
  name: string; // name of the step currently running
};

type RunEvent =
  | { type: "start"; runId: string; total: number }
  | { type: "step"; index: number; name: string }
  | { type: "step_done"; index: number }
  | { type: "error"; index: number; name: string; message: string }
  | { type: "done"; status: "completed" | "failed" };

export default function RunPanel({ chainId, userId }: { chainId: number; userId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [progress, setProgress] = useState<Progress>({ phase: "idle", total: 0, done: 0, name: "" });
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  const busy = progress.phase === "uploading" || progress.phase === "running";
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  let label = "";
  if (progress.phase === "uploading") label = "Uploading image…";
  else if (progress.phase === "running")
    label = `Step ${Math.min(progress.done + 1, progress.total)} of ${progress.total}: ${progress.name}`;
  else if (progress.phase === "done") label = "Finished. Opening results…";
  else if (progress.phase === "failed") label = `Stopped at step ${Math.min(progress.done + 1, progress.total)} of ${progress.total}`;

  async function run() {
    setError(null);
    setRunId(null);
    if (!file && !text.trim()) {
      setError("Add an image or some text to start the run.");
      return;
    }
    setProgress({ phase: "uploading", total: 0, done: 0, name: "" });
    try {
      let imagePath: string | null = null;
      if (file) {
        const supabase = createClient();
        const ext = file.name.split(".").pop() || "png";
        imagePath = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("chain-inputs")
          .upload(imagePath, file, { contentType: file.type });
        if (upErr) throw new Error(upErr.message);
      }

      const res = await fetch(`/api/chains/${chainId}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imagePath, inputText: text.trim() || null }),
      });
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Run failed.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let newRunId: string | null = null;
      let finalStatus: "completed" | "failed" | null = null;
      let failMessage: string | null = null;

      const handle = (ev: RunEvent) => {
        if (ev.type === "start") {
          newRunId = ev.runId;
          setRunId(ev.runId);
          setProgress({ phase: "running", total: ev.total, done: 0, name: "Starting…" });
        } else if (ev.type === "step") {
          setProgress((p) => ({ ...p, done: ev.index, name: ev.name }));
        } else if (ev.type === "step_done") {
          setProgress((p) => ({ ...p, done: ev.index + 1 }));
        } else if (ev.type === "error") {
          failMessage = `“${ev.name}” failed: ${ev.message}`;
        } else if (ev.type === "done") {
          finalStatus = ev.status;
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) handle(JSON.parse(line) as RunEvent);
      }

      if (finalStatus === "completed") {
        setProgress((p) => ({ ...p, phase: "done", done: p.total }));
        router.push(`/chains/${chainId}/runs#run-${newRunId}`);
      } else if (finalStatus === "failed") {
        setProgress((p) => ({ ...p, phase: "failed" }));
        setError(failMessage ?? "A step failed.");
      } else {
        throw new Error("The connection closed before the run finished. Check the generated media page for partial results.");
      }
    } catch (e) {
      setProgress((p) => ({ ...p, phase: "failed" }));
      setError(e instanceof Error ? e.message : "Run failed.");
    }
  }

  return (
    <div className="max-w-xl space-y-3">
      <div>
        <label className="label" htmlFor="run-image">Input image</label>
        <input
          id="run-image"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          disabled={busy}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="field"
        />
      </div>
      <div>
        <label className="label" htmlFor="run-text">Input text (optional)</label>
        <textarea id="run-text" rows={2} value={text} disabled={busy} onChange={(e) => setText(e.target.value)} className="field" />
      </div>

      <button onClick={run} disabled={busy} className="btn-primary px-5 py-2">
        {busy ? "Running…" : "Run chain"}
      </button>

      {progress.phase !== "idle" && (
        <div className="space-y-1.5" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>{label}</span>
            {progress.total > 0 && <span className="shrink-0 text-muted">{pct}%</span>}
          </div>
          <div
            role="progressbar"
            aria-label="Chain progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="relative h-2.5 overflow-hidden rounded-full bg-line"
          >
            <div
              className={`absolute inset-y-0 left-0 transition-[width] duration-500 ${
                progress.phase === "failed" ? "bg-danger" : "bg-accent"
              }`}
              style={{ width: `${pct}%` }}
            />
            {progress.phase === "running" && progress.total > 0 && (
              <div
                className="absolute inset-y-0 bg-accent/40 motion-safe:animate-pulse"
                style={{ left: `${pct}%`, width: `${100 / progress.total}%` }}
              />
            )}
            {progress.phase === "uploading" && <div className="absolute inset-0 bg-accent/30 motion-safe:animate-pulse" />}
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-danger">
          {error}{" "}
          {runId && (
            <Link href={`/chains/${chainId}/runs#run-${runId}`} className="underline">
              View what was saved
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
