import { type ComponentPropsWithoutRef } from "react";

export default function Fieldset(props: ComponentPropsWithoutRef<"fieldset">) {
  return (
    <fieldset
      className="relative space-y-1 divide-y divide-slate-800 border-y border-slate-800"
      {...props}
    />
  );
}
