import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { deleteRun } from "../../../actions";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import type { Chain, Run, RunOutput } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RunsPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) notFound();
  const { supabase } = await requireAdmin();

  const { data: chain } = await supabase.from("prompt_chains").select("id,slug").eq("id", id).single<Chain>();
  if (!chain) notFound();

  const { data: runData } = await supabase
    .from("chain_runs")
    .select("*")
    .eq("chain_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  const runs = (runData ?? []) as Run[];

  const { data: outData } = runs.length
    ? await supabase
        .from("chain_run_outputs")
        .select("*")
        .in("run_id", runs.map((r) => r.id))
        .order("step_position")
    : { data: [] };
  const outputs = (outData ?? []) as RunOutput[];

  const imageUrls: Record<string, string> = {};
  await Promise.all(
    runs
      .filter((r) => r.input_image_path)
      .map(async (r) => {
        const { data } = await supabase.storage.from("chain-inputs").createSignedUrl(r.input_image_path!, 3600);
        if (data?.signedUrl) imageUrls[r.id] = data.signedUrl;
      })
  );

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/chains/${id}`} className="text-sm text-muted hover:text-ink">← {chain.slug}</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Generated media</h1>
      </div>

      {runs.length === 0 && <p className="text-muted">No runs yet. Run the chain from its page.</p>}

      {runs.map((run) => (
        <article key={run.id} id={`run-${run.id}`} className="scroll-mt-6 rounded-md border border-line bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {new Date(run.created_at).toLocaleString()} ·{" "}
              <span className={run.status === "failed" ? "text-danger" : ""}>{run.status}</span>
            </p>
            <form action={deleteRun.bind(null, run.id, id)}>
              <ConfirmSubmit label="Delete run" message="Delete this run and its outputs?" />
            </form>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr]">
            <div>
              <h2 className="mb-1 text-sm font-medium">Input</h2>
              {imageUrls[run.id] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrls[run.id]} alt="Run input" className="w-full rounded border border-line" />
              )}
              {run.input_text && <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{run.input_text}</p>}
            </div>
            <ol className="space-y-4">
              {outputs
                .filter((o) => o.run_id === run.id)
                .map((o) => (
                  <li key={o.id}>
                    <h3 className="text-sm font-medium">
                      {o.step_position}. {o.step_name}
                    </h3>
                    {o.error ? (
                      <p className="mt-1 text-sm text-danger">Failed: {o.error}</p>
                    ) : (
                      <p className="mt-1 whitespace-pre-wrap text-sm">{o.output_text}</p>
                    )}
                  </li>
                ))}
            </ol>
          </div>
        </article>
      ))}
    </div>
  );
}
