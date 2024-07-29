import { forwardRef } from "react";
import classNames from "../lib/classNames";

export default forwardRef<
  HTMLTextAreaElement,
  React.ComponentPropsWithoutRef<"textarea">
>(function TextArea(props, ref) {
  const { disabled, readOnly } = props;
  const baseStyles = classNames(
    "rounded px-4 py-2 sm:leading-6 border-0 focus:ring-0",
    disabled || readOnly ? "bg-slate-900 text-slate-300" : "",
    "bg-slate-800",
  );
  const inputStyles =
    "block outline-none focus:ring-0 sm:leading-6 placeholder:text-slate-400";

  // const baseStyles = "bg-inherit rounded border-0 focus:ring-0";
  // const inputStyles = "placeholder:text-muted sm:leading-6";
  return (
    <textarea
      className={classNames(`block min-w-full p-0`, baseStyles, inputStyles)}
      ref={ref}
      {...props}
    />
  );
});
