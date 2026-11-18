import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callLlm, defaultModel, defaultProvider, normalizeProvider, type LlmImage, type Provider } from "@/lib/llm";
import type { Step } from "@/lib/types";

export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const chainId = Number((await params).id);
  if (!Number.isFinite(chainId)) return NextResponse.json({ error: "Bad chain id" }, { status: 400 });
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("is_superadmin").eq("id", user.id).single();
  if (profile?.is_superadmin !== true) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { imagePath, inputText } = (await request.json()) as { imagePath: string | null; inputText: string | null };

  const { data: stepData, error: stepsErr } = await supabase
    .from("prompt_chain_steps")
    .select("*")
    .eq("prompt_chain_id", chainId)
    .order("order_by");
  if (stepsErr) return NextResponse.json({ error: stepsErr.message }, { status: 500 });
  const steps = (stepData ?? []) as Step[];
  if (!steps.length) return NextResponse.json({ error: "This chain has no steps." }, { status: 400 });

  // Resolve each step's chosen model -> provider + provider model id
  const modelIds = [...new Set(steps.map((s) => s.llm_model_id).filter((x): x is number => x != null))];
  const resolved = new Map<number, { provider: Provider; model: string }>();
  if (modelIds.length) {
    const { data: models } = await supabase
      .from("llm_models")
      .select("id,name,provider_model_id,llm_provider_id")
      .in("id", modelIds);
    const providerIds = [...new Set((models ?? []).map((m) => m.llm_provider_id))];
    const { data: providers } = providerIds.length
      ? await supabase.from("llm_providers").select("id,name").in("id", providerIds)
      : { data: [] };
    for (const m of models ?? []) {
      const pname = providers?.find((p) => p.id === m.llm_provider_id)?.name;
      const provider = normalizeProvider(pname) ?? normalizeProvider(m.provider_model_id) ?? normalizeProvider(m.name);
      if (provider) resolved.set(m.id, { provider, model: m.provider_model_id || m.name });
    }
  }

  let image: LlmImage | null = null;
  if (imagePath) {
    const { data: blob, error } = await supabase.storage.from("chain-inputs").download(imagePath);
    if (error || !blob) return NextResponse.json({ error: error?.message || "Could not read the image." }, { status: 400 });
    image = { mediaType: blob.type || "image/png", base64: Buffer.from(await blob.arrayBuffer()).toString("base64") };
  }

  const { data: run, error: runErr } = await supabase
    .from("chain_runs")
    .insert({ chain_id: chainId, input_text: inputText, input_image_path: imagePath, created_by: user.id })
    .select("id")
    .single();
  if (runErr || !run) return NextResponse.json({ error: runErr?.message || "Could not start run." }, { status: 500 });

  // Stream progress to the page as newline-delimited JSON so it can show a progress bar.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          // The browser disconnected; keep running so the results still get saved.
        }
      };
      send({ type: "start", runId: run.id, total: steps.length });

      let previous = inputText ?? "";
      let failed = false;

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const name = step.description || `Step ${i + 1}`;
        const base = { run_id: run.id, step_id: step.id, step_position: i + 1, step_name: name };
        send({ type: "step", index: i, name });
        try {
          const pick = (step.llm_model_id != null && resolved.get(step.llm_model_id)) || null;
          const provider = pick?.provider ?? defaultProvider();
          const model = pick?.model ?? defaultModel(provider);

          let userText = step.llm_user_prompt ?? "";
          if (userText.includes("{{input}}")) userText = userText.split("{{input}}").join(previous);
          else if (previous) userText = userText ? `${userText}\n\n${previous}` : previous;

          const output = await callLlm({
            provider,
            model,
            system: step.llm_system_prompt ?? "",
            user: userText,
            image: i === 0 ? image : null,
            temperature: step.llm_temperature,
          });
          await supabase.from("chain_run_outputs").insert({ ...base, output_text: output });
          previous = output;
          send({ type: "step_done", index: i });
        } catch (e) {
          failed = true;
          const message = e instanceof Error ? e.message : "Unknown error";
          await supabase.from("chain_run_outputs").insert({ ...base, error: message });
          send({ type: "error", index: i, name, message });
          break;
        }
      }

      await supabase.from("chain_runs").update({ status: failed ? "failed" : "completed" }).eq("id", run.id);
      send({ type: "done", status: failed ? "failed" : "completed" });
      try {
        controller.close();
      } catch {}
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}