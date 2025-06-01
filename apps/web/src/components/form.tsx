import type { ComponentPropsWithoutRef } from "react";
import Spinner from "./spinner";

export default function Form({
  isSubmitting = false,
  ...props
}: ComponentPropsWithoutRef<"form"> & { isSubmitting?: boolean }) {
  return (
    <>
      {isSubmitting && (
        <div className="fixed inset-0 z-10">
          <div className="absolute inset-0 bg-slate-800 opacity-50" />
          <Spinner />
        </div>
      )}

      <form
        className="mb-8 self-center rounded border-x border-slate-800 lg:mb-0"
        {...props}
      />
    </>
  );
}
