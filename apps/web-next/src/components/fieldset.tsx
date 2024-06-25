import { type ComponentPropsWithoutRef } from "react";

export default (props: ComponentPropsWithoutRef<"fieldset">) => (
  <fieldset
    className="relative space-y-1 divide-y divide-slate-800"
    {...props}
  />
);
