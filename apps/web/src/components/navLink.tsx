import { ComponentProps } from "react";
import { Link } from "react-router-dom";

export default function NavLink(props: ComponentProps<typeof Link>) {
  return (
    <Link
      className="focus:ring-highlight relative flex max-w-xs items-center rounded p-2 text-sm text-slate-500 hover:bg-slate-800 hover:text-white focus:outline-none focus:ring"
      {...props}
    />
  );
}
