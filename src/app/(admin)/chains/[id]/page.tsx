import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createStep, deleteChain, updateChain } from "../../actions";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import StepList from "@/components/StepList";
import StepFields from "@/components/StepFields";
import RunPanel from "@/components/RunPanel";
import type { Chain, Model, Step } from "@/lib/types";

export default async function ChainPage({ params }: { params: Promise<{ id: string }> }) {
  const chainId = Number((await params).id);
  if (!Number.isFinite(chainId)) notFound();
  const { supabase, user } = await requireAdmin();

  const { data: chain } = await supabase.from("prompt_chains").select("*").eq("id", chainId).single<Chain>();
  if (!chain) notFound();
  const { data: steps } = await supabase
    .from("prompt_chain_steps")
    .select("*")
    .eq("prompt_chain_id", chainId)
    .order("order_by");
  const list = (steps ?? []) as Step[];
  const { data: modelData } = await supabase.from("llm_models").select("id,name,provider_model_id").order("name");
  const models = (modelData ?? []) as Model[];

  return (
    <div className="space-y-10">
      <Link href="/" className="text-sm text-muted hover:text-ink">← All chains</Link>

      <section>
        <h1 className="text-2xl font-semibold tracking-tight">{chain.slug}</h1>
        {chain.description && <p className="mt-1 text-muted">{chain.description}</p>}
        <div className="mt-5">
          {list.length > 0 ? (
            <RunPanel chainId={chainId} userId={user.id} />
          ) : (
            <p className="text-sm text-muted">Add at least one step below to run this chain.</p>
          )}
          <Link href={`/chains/${chainId}/runs`} className="btn mt-4">
            View generated media
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Chain settings</h2>
        <form action={updateChain.bind(null, chainId)} className="mt-4 max-w-xl space-y-3">
          <div>
            <label className="label" htmlFor="slug">Name</label>
            <input id="slug" name="slug" defaultValue={chain.slug} required className="field" />
          </div>
          <div>
            <label className="label" htmlFor="description">Description</label>
            <textarea id="description" name="description" defaultValue={chain.description ?? ""} rows={2} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="output_type">Output type</label>
            <select id="output_type" name="output_type" defaultValue={chain.output_type} className="field">
              <option value="text">Text</option>
              <option value="image">Image</option>
              <option value="both">Both</option>
            </select>
          </div>
          <button className="btn">Save chain</button>
        </form>
        <form action={deleteChain.bind(null, chainId)} className="mt-3">
          <ConfirmSubmit label="Delete chain" message="Delete this chain, its steps and all of its runs?" />
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Steps</h2>
        <p className="mt-1 text-sm text-muted">
          Each step receives the previous step’s output. Drag the handle or use the arrows to reorder.
        </p>
        {list.length === 0 ? (
          <p className="mt-4 text-muted">No steps yet. Add the first one below.</p>
        ) : (
          <StepList key={JSON.stringify(list)} chainId={chainId} initial={list} models={models} />
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Add a step</h2>
        <form action={createStep.bind(null, chainId)} className="mt-3 max-w-xl space-y-3">
          <StepFields id="new" models={models} />
          <button className="btn-primary">Add step</button>
        </form>
      </section>
    </div>
  );
}