import { useLocation } from "@remix-run/react";
import type { ElementType } from "react";
import type { PolymorphicProps } from "~/types";
import classNames from "../lib/classNames";

type Props = {
  fullWidth?: boolean;
  border?: boolean;
} & React.ComponentPropsWithoutRef<"nav">;

const Tabs = ({ fullWidth, border, ...props }: Props) => {
  return (
    <nav
      className={classNames(
        "-mb-px flex space-x-8",
        fullWidth ? "[&>*]:flex-auto [&>*]:justify-center" : "",
        border ? "border-b border-slate-700" : "",
      )}
      aria-label="Tabs"
      {...props}
    />
  );
};

type ItemProps = {
  active?: boolean;
  count?: number;
  controlled?: boolean;
};

const defaultElement = "button";

Tabs.Item = function TabItem<E extends ElementType = typeof defaultElement>({
  as,
  active,
  count,
  children,
  controlled,
  ...props
}: PolymorphicProps<E, ItemProps>) {
  const Component = as ?? defaultElement;

  const location = useLocation();

  const activeStyles = "text-highlight border-highlight";
  const inactiveStyles =
    "border-transparent text-slate-500 hover:border-slate-500 hover:text-slate-400";

  if ("to" in props) {
    if (controlled) active = location.pathname === props.to;
  }

  const className = classNames(
    active ? activeStyles : inactiveStyles,
    "flex whitespace-nowrap border-b-4 px-1 py-4 text-sm font-medium",
  );

  return (
    <Component className={className} {...props}>
      {children}
      {count !== undefined && (
        <span
          className={classNames(
            "bg-slate-700 text-slate-500",
            "ml-3 hidden rounded-full px-2.5 py-0.5 text-xs font-medium md:inline-block",
          )}
        >
          {count}
        </span>
      )}
    </Component>
  );
};

export default Tabs;
