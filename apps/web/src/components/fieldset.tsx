import type { ComponentPropsWithoutRef } from "react";

export default function Fieldset(props: ComponentPropsWithoutRef<"fieldset">) {
  return <fieldset className="relative border-y border-slate-800" {...props} />;
}
