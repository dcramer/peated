"use client";

import { usePathname } from "next/navigation";
import Button from "./button";

export default function EmbeddedLogin() {
  const pathname = usePathname();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center p-4">
      <p className="mb-4 text-muted text-sm">
        Looks like you'll need to login to participate here.
      </p>
      <Button
        href={`/login?redirectTo=${encodeURIComponent(pathname)}`}
        color="highlight"
      >
        Login to Peated
      </Button>
    </div>
  );
}
