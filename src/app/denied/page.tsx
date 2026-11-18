import ThemeToggle from "@/components/ThemeToggle";

export default function DeniedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <h1 className="text-2xl font-semibold">This account isn’t a superadmin</h1>
      <p className="mt-3 text-muted">
        Only profiles with is_superadmin set to true can use this tool. Sign out and try another Google account.
      </p>
      <form action="/auth/signout" method="post" className="mt-6">
        <button className="btn-primary">Sign out</button>
      </form>
    </main>
  );
}
