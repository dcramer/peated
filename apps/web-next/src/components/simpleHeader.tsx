import type { PolymorphicProps } from "@peated/web/types";
import type { ElementType } from "react";

const defaultElement = "h1";

export default function SimpleHeader<
  E extends ElementType = typeof defaultElement,
>({ as, ...props }: PolymorphicProps<E>) {
  const Component = as ?? defaultElement;

  return (
    <Component
      className="text-highlight border-highlight flex justify-center whitespace-nowrap border-b-4 px-1 py-4 text-sm font-medium"
      {...props}
    />
  );
}
