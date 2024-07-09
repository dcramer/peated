import type { PolymorphicProps } from "@peated/web/types";
import type { ElementType } from "react";

const defaultElement = "h1";

export default function SimpleHeader<
  E extends ElementType = typeof defaultElement,
>({ as, ...props }: PolymorphicProps<E>) {
  const Component = as ?? defaultElement;

  return (
    <div className="mb-4 flex space-x-8 border-b border-slate-700">
      <Component
        className="text-highlight border-highlight flex justify-center whitespace-nowrap border-b-4 px-1 py-4 text-sm font-medium"
        {...props}
      />
    </div>
  );
}
