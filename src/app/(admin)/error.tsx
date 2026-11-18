"use client";

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-md border border-danger p-5">
      <h2 className="font-semibold text-danger">Something went wrong</h2>
      <p className="mt-2 text-sm">{error.message}</p>
      <button onClick={reset} className="btn mt-4">
        Try again
      </button>
    </div>
  );
}
