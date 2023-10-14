import { type ComponentPropsWithoutRef } from "react";

export default (props: ComponentPropsWithoutRef<"form">) => (
  <form className="self-center bg-slate-950 pb-6 sm:my-6 sm:pb-0" {...props} />
);
