import type { Model, Step } from "@/lib/types";

export default function StepFields({ id, models, step }: { id: string; models: Model[]; step?: Step }) {
  return (
    <>
      <div>
        <label className="label" htmlFor={`${id}-d`}>Step name</label>
        <input id={`${id}-d`} name="description" required defaultValue={step?.description ?? ""} className="field" placeholder="Describe the image" />
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <div>
          <label className="label" htmlFor={`${id}-m`}>Model</label>
          <select id={`${id}-m`} name="llm_model_id" defaultValue={step?.llm_model_id ?? ""} className="field">
            <option value="">Default (set in env vars)</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`${id}-t`}>Temperature</label>
          <input id={`${id}-t`} name="llm_temperature" type="number" step="0.1" min="0" max="2" defaultValue={step?.llm_temperature ?? 0.7} className="field" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`${id}-s`}>System prompt</label>
        <textarea id={`${id}-s`} name="llm_system_prompt" rows={3} defaultValue={step?.llm_system_prompt ?? ""} className="field" placeholder="You describe images accurately and concisely." />
      </div>
      <div>
        <label className="label" htmlFor={`${id}-u`}>User prompt</label>
        <textarea id={`${id}-u`} name="llm_user_prompt" rows={3} defaultValue={step?.llm_user_prompt ?? ""} className="field" placeholder="Write something funny about this: {{input}}" />
        <p className="mt-1 text-xs text-muted">
          {"{{input}}"} is replaced with the previous step’s output. Without it, the output is added after your prompt. The first step also receives the uploaded image.
        </p>
      </div>
    </>
  );
}
