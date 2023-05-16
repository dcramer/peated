import classNames from "../lib/classNames";

export default ({
  suffixLabel,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"input"> & {
  suffixLabel?: string;
}) => {
  const baseStyles = "bg-inherit p-0 border-0 sm:leading-6";
  const inputStyles =
    "placeholder:text-slate-700 outline-none focus:ring-0 sm:leading-6";
  if (suffixLabel) {
    return (
      <div className={`flex ${baseStyles}`}>
        <input
          className={classNames(
            "block flex-1 border-0 bg-transparent p-0",
            inputStyles,
            className || "",
          )}
          {...props}
        />
        <span className="flex select-none items-center text-slate-700 sm:text-sm">
          {suffixLabel}
        </span>
      </div>
    );
  }

  return (
    <input
      className={classNames(
        "block min-w-full",
        baseStyles,
        inputStyles,
        className || "",
      )}
      {...props}
    />
  );
};
