"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const OUTPUT_TYPES = ["text", "image", "both"];

function chainFields(f: FormData) {
  const slug = slugify(str(f, "slug"));
  if (!slug) throw new Error("Give the chain a name (letters and numbers).");
  const output_type = OUTPUT_TYPES.includes(str(f, "output_type")) ? str(f, "output_type") : "text";
  return { slug, description: str(f, "description") || null, output_type };
}

function stepFields(f: FormData) {
  const description = str(f, "description");
  const llm_system_prompt = str(f, "llm_system_prompt") || null;
  const llm_user_prompt = str(f, "llm_user_prompt") || null;
  if (!description) throw new Error("Give the step a name.");
  if (!llm_system_prompt && !llm_user_prompt) throw new Error("A step needs a system prompt or a user prompt.");
  const temp = parseFloat(str(f, "llm_temperature"));
  const model = parseInt(str(f, "llm_model_id"), 10);
  return {
    description,
    llm_system_prompt,
    llm_user_prompt,
    llm_temperature: Number.isFinite(temp) ? temp : 0.7,
    llm_model_id: Number.isFinite(model) ? model : null,
  };
}

// ---------- chains ----------
export async function createChain(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const { data, error } = await supabase
    .from("prompt_chains")
    .insert({ ...chainFields(formData), created_by: user.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/chains/${data.id}`);
}

export async function updateChain(id: number, formData: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("prompt_chains").update(chainFields(formData)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/chains/${id}`);
  revalidatePath("/");
}

export async function deleteChain(id: number) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("prompt_chains").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  redirect("/");
}

// ---------- steps ----------
export async function createStep(chainId: number, formData: FormData) {
  const { supabase } = await requireAdmin();
  const fields = stepFields(formData);
  const { data: last } = await supabase
    .from("prompt_chain_steps")
    .select("order_by")
    .eq("prompt_chain_id", chainId)
    .order("order_by", { ascending: false })
    .limit(1);
  const order_by = (last?.[0]?.order_by ?? 0) + 1;
  const { error } = await supabase.from("prompt_chain_steps").insert({ prompt_chain_id: chainId, order_by, ...fields });
  if (error) throw new Error(error.message);
  revalidatePath(`/chains/${chainId}`);
}

export async function updateStep(stepId: number, chainId: number, formData: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("prompt_chain_steps").update(stepFields(formData)).eq("id", stepId);
  if (error) throw new Error(error.message);
  revalidatePath(`/chains/${chainId}`);
}

export async function deleteStep(stepId: number, chainId: number) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("prompt_chain_steps").delete().eq("id", stepId);
  if (error) throw new Error(error.message);
  const { data: rest } = await supabase
    .from("prompt_chain_steps")
    .select("id")
    .eq("prompt_chain_id", chainId)
    .order("order_by");
  if (rest?.length) {
    const { error: e2 } = await supabase.rpc("reorder_steps", {
      p_chain_id: chainId,
      p_step_ids: rest.map((s) => s.id),
    });
    if (e2) throw new Error(e2.message);
  }
  revalidatePath(`/chains/${chainId}`);
}

export async function reorderSteps(chainId: number, orderedIds: number[]) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("reorder_steps", { p_chain_id: chainId, p_step_ids: orderedIds });
  if (error) throw new Error(error.message);
  revalidatePath(`/chains/${chainId}`);
}

export async function deleteRun(runId: string, chainId: number) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("chain_runs").delete().eq("id", runId);
  if (error) throw new Error(error.message);
  revalidatePath(`/chains/${chainId}/runs`);
}
