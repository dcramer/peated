import { ReactNode } from "react";

export default ({
  className,
  required,
  labelNote,
  ...props
}: {
  required?: boolean;
  labelNote?: ReactNode;
} & React.ComponentPropsWithoutRef<"label">) => {
  return (
    <div className="mb-2 flex justify-between">
      <label
        {...props}
        className={`block font-semibold leading-6 ${className || ""}`}
      />
      <span className="text-xs leading-6 text-slate-500">
        {labelNote || (required && "Optional")}
      </span>
    </div>
  );
};
