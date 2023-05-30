import { forwardRef } from "react";

export default forwardRef<
  HTMLTextAreaElement,
  React.ComponentPropsWithoutRef<"textarea">
>(function TextArea(props, ref) {
  const baseStyles = "bg-inherit rounded border-0 focus:ring-0";
  const inputStyles = "placeholder:text-slate-500 sm:leading-6";
  return (
    <textarea
      className={`block min-w-full p-0 ${baseStyles} ${inputStyles}`}
      ref={ref}
      {...props}
    />
  );
});
