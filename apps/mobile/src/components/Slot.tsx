import { Children, cloneElement, isValidElement } from "react";
import { twMerge } from "tailwind-merge";

export type AsChildProps<DefaultElementProps> =
  | ({ asChild?: false } & DefaultElementProps)
  | { asChild: true; children: React.ReactNode };

export default function Slot({
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode;
}) {
  if (isValidElement(children)) {
    return cloneElement(children, {
      ...props,
      ...children.props,
      style: {
        ...props.style,
        ...children.props.style,
      },
      className: twMerge(props.className, children.props.className),
    });
  }
  if (Children.count(children) > 1) {
    Children.only(null);
  }
  return null;
}
