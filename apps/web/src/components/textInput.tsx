import { forwardRef } from "react";
import classNames from "../lib/classNames";

type Props = React.ComponentPropsWithoutRef<"input"> & {
  suffixLabel?: string;
};

export default forwardRef<HTMLInputElement, Props>(function TextInput(
  { suffixLabel, className, ...props },
  ref
) {
  const { disabled, readOnly } = props;
  const baseStyles = classNames(
    "rounded px-4 py-2 sm:leading-6 border-0 focus:ring-0",
    disabled || readOnly ? "bg-slate-900 text-slate-300" : "",
    "bg-slate-800"
  );
  const inputStyles =
    "block outline-none focus:ring-0 sm:leading-6 placeholder:text-slate-400";
  if (suffixLabel) {
    return (
      <div className={classNames("flex", baseStyles)}>
        <input
          className={classNames(
            "flex-auto border-0 bg-transparent p-0",
            inputStyles,
            className
          )}
          ref={ref}
          {...props}
        />
        <span className="flex select-none items-center text-slate-300 sm:text-sm">
          {suffixLabel}
        </span>
      </div>
    );
  }

  return (
    <input
      className={classNames(
        "min-w-full",
        baseStyles,
        inputStyles,
        className || ""
      )}
      ref={ref}
      {...props}
    />
  );
});
