export type Chain = {
  id: number;
  slug: string;
  description: string | null;
  output_type: string;
  created_at: string | null;
};
export type Step = {
  id: number;
  prompt_chain_id: number;
  order_by: number;
  description: string | null;
  llm_system_prompt: string | null;
  llm_user_prompt: string | null;
  llm_temperature: number | null;
  llm_model_id: number | null;
};
export type Model = { id: number; name: string; provider_model_id: string | null };
export type Run = {
  id: string;
  chain_id: number;
  input_text: string | null;
  input_image_path: string | null;
  status: "running" | "completed" | "failed";
  created_at: string;
};
export type RunOutput = {
  id: string;
  run_id: string;
  step_position: number;
  step_name: string;
  output_text: string | null;
  error: string | null;
};
