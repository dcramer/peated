import { Link, useLocation } from "react-router-dom";
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

type ItemProps = {
  to: string;
  active?: boolean;
  count?: number;
  controlled?: boolean;
} & React.ComponentPropsWithoutRef<typeof Link>;

Tabs.Item = ({
  to,
  active,
  count,
  children,
  controlled,
  ...props
}: ItemProps) => {
  const location = useLocation();
  if (controlled) active = location.pathname === to;

  const activeStyles = "text-highlight border-highlight";
  const inactiveStyles =
    "border-transparent text-slate-700 hover:border-slate-500 hover:text-slate-500";

  return (
    <Link
      to={to}
      className={classNames(
        active ? activeStyles : inactiveStyles,
        "flex whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium",
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
};

export default Tabs;
