import { type ComponentPropsWithoutRef } from "react";
import Spinner from "./spinner";

export default function Form({
  isSubmitting = false,
  ...props
}: ComponentPropsWithoutRef<"form"> & { isSubmitting?: boolean }) {
  return (
    <>
      {isSubmitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-800 opacity-50" />
          <Spinner className="relative z-10 m-0 text-slate-800" />
        </div>
      )}

      <form
        className="mb-8 self-center rounded border-x border-slate-800 lg:mb-0"
        {...props}
      />
    </>
  );
}
