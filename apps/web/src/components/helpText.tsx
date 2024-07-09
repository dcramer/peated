import { type ComponentPropsWithoutRef } from "react";

export default function HelpText(props: ComponentPropsWithoutRef<"div">) {
  return <div className="mt-4 text-sm text-gray-400" {...props} />;
}
