import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h2 className="h2-bold text-dark-600">Page not found</h2>
      <p className="p-16-regular text-dark-400">
        The page you are looking for doesn&apos;t exist or has been removed.
      </p>
      <Button asChild className="rounded-full bg-white text-black hover:bg-slate-200">
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
