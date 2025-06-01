import type { ComponentPropsWithoutRef } from "react";

export default function Fieldset(props: ComponentPropsWithoutRef<"fieldset">) {
  return <fieldset className="relative border-slate-800 border-y" {...props} />;
}
