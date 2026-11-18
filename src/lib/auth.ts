import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Gate for every admin page, server action and API route. */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (profile?.is_superadmin !== true) redirect("/denied");

  return { supabase, user };
}
