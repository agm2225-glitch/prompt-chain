import LoginButton from "./LoginButton";
import ThemeToggle from "@/components/ThemeToggle";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">Prompt Chain Tool</h1>
      <p className="mt-3 text-muted">
        Build prompt chains, reorder their steps and run them on an image. Superadmin accounts only.
      </p>
      <div className="mt-8">
        <LoginButton />
      </div>
    </main>
  );
}
