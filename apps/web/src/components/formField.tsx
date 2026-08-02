import { ChevronRightIcon } from "@heroicons/react/20/solid";
import type { ReactNode } from "react";
import classNames from "../lib/classNames";
import FormLabel from "./formLabel";
import HelpText from "./helpText";

type Props = React.ComponentPropsWithoutRef<"div"> & {
  label?: string;
  labelNote?: ReactNode;
  htmlFor?: string;
  helpText?: ReactNode;
  required?: boolean;
  children?: ReactNode;
  error?: {
    message?: string;
  };
  className?: string;
  labelAction?: () => void;
};

export default function FormField({
  className,
  children,
  required,
  label,
  labelNote,
  helpText,
  htmlFor,
  error,
  labelAction,
  ...props
}: Props) {
  const labelClassName = classNames(
    "flex w-full flex-auto items-center text-left",
    labelAction ? "cursor-pointer" : "cursor-default",
  );
  const labelContent = (
    <>
      {label}
      {labelAction && (
        <ChevronRightIcon className="ml-1 inline-block h-5 font-bold" />
      )}
    </>
  );

  return (
    <div
      {...props}
      className={classNames(
        `relative block px-4 py-4 text-white focus-within:z-10`,
        className,
        error ? "border border-red-500" : "",
      )}
    >
      {error?.message && (
        <div className="-mx-3 -mt-2.5 mb-2.5 bg-red-600 px-3 py-2.5 sm:-mx-5 sm:-mt-4 sm:mb-4 sm:px-5">
          {error.message}
        </div>
      )}

      {label && labelAction ? (
        <FormLabel
          as="button"
          type="button"
          onClick={labelAction}
          required={required}
          labelNote={labelNote}
          className={labelClassName}
        >
          {labelContent}
        </FormLabel>
      ) : label ? (
        <FormLabel
          htmlFor={htmlFor}
          required={required}
          labelNote={labelNote}
          className={labelClassName}
        >
          {labelContent}
        </FormLabel>
      ) : null}
      {children}
      {helpText && <HelpText>{helpText}</HelpText>}
    </div>
  );
}
