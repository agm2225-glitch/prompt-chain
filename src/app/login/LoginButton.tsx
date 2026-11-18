"use client";
import { createClient } from "@/lib/supabase/client";

export default function LoginButton() {
  async function signIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }
  return (
    <button onClick={signIn} className="btn-primary px-5 py-2.5">
      Sign in with Google
    </button>
  );
}
