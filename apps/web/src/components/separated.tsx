import { Children, ReactNode } from "react";

export default function Separated({
  children,
  separator = " ",
}: {
  separator?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      {Children.toArray(children)
        .reduce<ReactNode[]>((previousValue: ReactNode[], currentValue) => {
          return [...previousValue, currentValue, separator];
        }, [])
        .slice(0, -1)}
    </>
  );
}
