import { type ComponentPropsWithoutRef } from "react";

export default (props: ComponentPropsWithoutRef<"div">) => (
  <div className="mt-2 text-sm leading-6 text-gray-400" {...props} />
);
