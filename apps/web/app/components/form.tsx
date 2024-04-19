import { type ComponentPropsWithoutRef } from "react";
import Spinner from "./spinner";

export default ({
  isSubmitting = false,
  ...props
}: ComponentPropsWithoutRef<"form"> & { isSubmitting?: boolean }) => (
  <>
    {isSubmitting && (
      <div className="fixed inset-0 z-10">
        <div className="absolute inset-0 bg-slate-800 opacity-50" />
        <Spinner />
      </div>
    )}

    <form className="self-center bg-slate-950 pb-6 sm:pb-0" {...props} />
  </>
);
