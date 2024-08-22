import type { ReactNode } from "react";
import { Fragment } from "react";

export default function Join({
  children,
  divider,
}: {
  children: ReactNode[];
  divider: ReactNode;
}) {
  return (
    <>
      {children.map((child, index) => {
        return (
          <Fragment key={index}>
            {!!index && divider}
            {child}
          </Fragment>
        );
      })}
    </>
  );
}
