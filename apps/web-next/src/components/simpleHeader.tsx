import type { ReactNode } from "react";

export default function SimpleHeader({ children }: { children?: ReactNode }) {
  return (
    <h1 className="text-highlight border-highlight flex justify-center whitespace-nowrap border-b-4 px-1 py-4 text-sm font-medium">
      {children}
    </h1>
  );
}
