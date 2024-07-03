import { type ComponentPropsWithoutRef } from "react";

export default function HelpText(props: ComponentPropsWithoutRef<"div">) {
  return <div className="mt-2 text-sm leading-6 text-gray-400" {...props} />;
}
