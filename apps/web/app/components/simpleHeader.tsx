import type { ReactNode } from "react";

export default function SimpleHeader({ children }: { children?: ReactNode }) {
  return (
    <div className="p-3 sm:py-0">
      <h1 className="mb-4 truncate text-center text-3xl font-semibold leading-7 sm:text-left">
        {children}
      </h1>
    </div>
  );
}
