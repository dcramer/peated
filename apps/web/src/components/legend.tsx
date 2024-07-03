import { type ComponentPropsWithoutRef } from "react";

export default function Legend({
  children,
  title,
  ...props
}: ComponentPropsWithoutRef<"legend"> & { title: string }) {
  return (
    <legend
      className="-mb-1 flex w-full items-center bg-slate-800 px-4 py-6 font-bold text-white"
      {...props}
    >
      <div className="flex-grow">{title}</div>
      {children}
    </legend>
  );
}
