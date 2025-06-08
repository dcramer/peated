import classNames from "../lib/classNames";
import { Slot } from "./slot";

type Props = {
  noHover?: boolean;
  color?: "default" | "highlight";
  asChild?: boolean;
} & React.ComponentPropsWithoutRef<"div">;

export default function ListItem({
  children,
  noHover = false,
  color = "default",
  asChild = false,
  ...props
}: Props) {
  const Component = asChild ? Slot : "div";
  return (
    <Component
      className={classNames(
        "card group relative",
        color === "highlight" ? "bg-highlight text-black" : "",
        noHover ? "" : color === "highlight" ? "" : "hover:bg-slate-900"
      )}
      {...props}
    >
      <div className="mx-auto max-w-7xl justify-between gap-x-3 px-3 lg:px-5">
        <div className="flex items-center gap-x-4 py-3">{children}</div>
      </div>
    </Component>
  );
}
