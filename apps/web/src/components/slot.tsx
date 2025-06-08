import React from "react";
import { twMerge } from "tailwind-merge";

export type AsChildProps<DefaultElementProps> =
  | ({ asChild?: false } & DefaultElementProps)
  | { asChild: true; children: React.ReactNode };

export function Slot({
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode;
}) {
  if (React.Children.count(children) > 1) {
    React.Children.only(null);
  }

  if (React.isValidElement(children)) {
    const childProps = children.props as any;

    return React.cloneElement(children, {
      ...props,
      ...childProps,
      style: {
        ...props.style,
        ...childProps.style,
      },
      className: twMerge(props.className, childProps.className),
    });
  }

  return null;
}
