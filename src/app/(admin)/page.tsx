import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createChain } from "./actions";
import type { Chain } from "@/lib/types";

export default async function ChainsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("prompt_chains")
    .select("id,slug,description,output_type,created_at,prompt_chain_steps(count)")
    .order("created_at", { ascending: false });
  const chains = (data ?? []) as unknown as (Chain & { prompt_chain_steps: { count: number }[] })[];

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Prompt chains</h1>
        {chains.length === 0 ? (
          <p className="mt-4 text-muted">No chains yet. Create your first one below.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-md border border-line bg-surface">
            {chains.map((c) => (
              <li key={c.id}>
                <Link href={`/chains/${c.id}`} className="flex items-baseline justify-between gap-4 px-4 py-3 hover:bg-bg">
                  <span>
                    <span className="font-medium">{c.slug}</span>
                    {c.description && <span className="block text-sm text-muted">{c.description}</span>}
                  </span>
                  <span className="shrink-0 text-sm text-muted">{c.prompt_chain_steps?.[0]?.count ?? 0} steps</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">New chain</h2>
        <form action={createChain} className="mt-3 max-w-xl space-y-3">
          <ChainFields />
          <button className="btn-primary">Create chain</button>
        </form>
      </section>
    </div>
  );
}

function ChainFields({ chain }: { chain?: Chain }) {
  return (
    <>
      <div>
        <label className="label" htmlFor="slug">Name</label>
        <input id="slug" name="slug" required defaultValue={chain?.slug} className="field" placeholder="image-to-funny-captions" />
        <p className="mt-1 text-xs text-muted">Saved as a lowercase slug, e.g. image-to-funny-captions.</p>
      </div>
      <div>
        <label className="label" htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={2} defaultValue={chain?.description ?? ""} className="field" placeholder="What this chain produces" />
      </div>
      <div>
        <label className="label" htmlFor="output_type">Output type</label>
        <select id="output_type" name="output_type" defaultValue={chain?.output_type ?? "text"} className="field">
          <option value="text">Text</option>
          <option value="image">Image</option>
          <option value="both">Both</option>
        </select>
      </div>
    </>
  );
}
