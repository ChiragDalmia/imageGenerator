"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h2 className="h2-bold text-dark-600">Something went wrong</h2>
      <p className="p-16-regular text-dark-400">
        An unexpected error occurred. Please try again.
      </p>
      <Button
        onClick={() => reset()}
        className="rounded-full bg-white text-black hover:bg-slate-200"
      >
        Try again
      </Button>
    </div>
  );
}
