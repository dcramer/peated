import type { ReactNode } from "react";
import { Slot } from "./slot";

type Props = {
  required?: boolean;
  labelNote?: ReactNode;
  asChild?: boolean;
} & React.ComponentPropsWithoutRef<"label">;

export default function FormLabel({
  className,
  asChild = false,
  required,
  labelNote,
  children,
  ...props
}: Props) {
  const Component = asChild ? Slot : "label";

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
