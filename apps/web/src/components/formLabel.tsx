import type { PolymorphicProps } from "@peated/web/types";
import type { ElementType, ReactNode } from "react";

type Props = {
  required?: boolean;
  labelNote?: ReactNode;
} & React.ComponentPropsWithoutRef<"label">;

const defaultElement = "label";

export default function FormLabel<
  E extends ElementType = typeof defaultElement,
>({
  className,
  as,
  required,
  labelNote,
  children,
  ...props
}: PolymorphicProps<E, Props>) {
  const Component = as ?? defaultElement;

  return (
    <Component
      {...props}
      className={`mb-2 flex justify-between font-semibold leading-6 ${
        className || ""
      }`}
    >
      <div>{children}</div>
      <span className="text-muted text-xs leading-6">
        {labelNote || (!required && "Optional")}
      </span>
    </Component>
  );
}
