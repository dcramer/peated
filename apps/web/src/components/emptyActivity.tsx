import { ReactNode } from "react";
import { Link } from "react-router-dom";

type Props =
  | {
      to: string;
      children?: ReactNode;
    }
  | {
      to?: never;
      children?: ReactNode;
    };

export default ({ to, children }: Props) => {
  const baseStyles =
    "border-slate-700 text-slate-700 m-3 sm:my-4 flex flex-col items-center rounded-lg border border-dashed p-12 font-light";

  if (to) {
    return (
      <Link
        className={`${baseStyles} group hover:border-slate-400 hover:text-slate-400`}
        to={to}
      >
        {children}
      </Link>
    );
  }
  return <div className={baseStyles}>{children}</div>;
};
