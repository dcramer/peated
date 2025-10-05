import { type ComponentPropsWithoutRef } from "react";

export default function Fieldset(props: ComponentPropsWithoutRef<"fieldset">) {
  return (
    <fieldset
      className="relative border border-slate-800 px-3 lg:px-4"
      {...props}
    />
  );
}
