import { Link, useLocation } from "@remix-run/react";
import classNames from "../lib/classNames";

type Props = {
  fullWidth?: boolean;
} & React.ComponentPropsWithoutRef<"nav">;

const Tabs = ({ fullWidth, ...props }: Props) => {
  return (
    <nav
      className={classNames(
        "-mb-px flex space-x-8",
        fullWidth ? "[&>*]:flex-1 [&>*]:justify-center" : "",
      )}
      aria-label="Tabs"
      {...props}
    />
  );
};

type BaseItemProps = {
  active?: boolean;
  count?: number;
  controlled?: boolean;
};

type LinkItemProps = BaseItemProps &
  React.ComponentPropsWithoutRef<typeof Link>;
type ButtonItemProps = BaseItemProps & React.ComponentPropsWithoutRef<"button">;

type ItemProps = LinkItemProps | ButtonItemProps;

Tabs.Item = function TabItem({
  active,
  count,
  children,
  controlled,
  ...props
}: ItemProps) {
  const location = useLocation();

  const activeStyles = "text-highlight border-highlight";
  const inactiveStyles =
    "border-transparent text-slate-500 hover:border-slate-500 hover:text-slate-400";

  if ("to" in props) {
    if (controlled) active = location.pathname === props.to;

    return (
      <Link
        className={classNames(
          active ? activeStyles : inactiveStyles,
          "flex whitespace-nowrap border-b-4 px-1 py-4 text-sm font-medium",
        )}
        {...props}
      >
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
      </Link>
    );
  }

  return (
    <button
      className={classNames(
        active ? activeStyles : inactiveStyles,
        "flex whitespace-nowrap border-b-4 px-1 py-4 text-sm font-medium",
      )}
      {...props}
    >
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
    </button>
  );
};

export default Tabs;
