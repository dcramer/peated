import type { ComponentPropsWithoutRef } from "react";

export default function HelpText(props: ComponentPropsWithoutRef<"div">) {
  return <div className="mt-2 text-gray-500 text-sm" {...props} />;
}
