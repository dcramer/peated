import type { PolymorphicProps } from "@peated/web/types";
import type { ElementType } from "react";

const defaultElement = "h1";

export default function SimpleHeader<
  E extends ElementType = typeof defaultElement,
>({ as, ...props }: PolymorphicProps<E>) {
  const Component = as ?? defaultElement;

  return (
    <div className="mb-4 flex space-x-8 border-slate-700 border-b">
      <Component
        className="flex justify-center whitespace-nowrap border-highlight border-b-4 px-3 py-4 font-medium text-highlight text-sm"
        {...props}
      />
    </div>
  );
}
