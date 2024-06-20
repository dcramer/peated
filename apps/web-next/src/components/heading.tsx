import type { PolymorphicProps } from "@peated/web/types";
import type { ElementType } from "react";

const defaultElement = "h1";

export default function Heading<E extends ElementType = typeof defaultElement>({
  as,
  ...props
}: PolymorphicProps<E>) {
  const Component = as ?? defaultElement;

  return (
    <Component className="text-highlight mb-4 text-lg font-bold" {...props} />
  );
}
