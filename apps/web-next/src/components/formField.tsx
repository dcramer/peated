import { ChevronRightIcon } from "@heroicons/react/20/solid";
import type { MouseEvent, ReactNode } from "react";
import classNames from "../lib/classNames";
import FormLabel from "./formLabel";
import HelpText from "./helpText";

type Props = React.ComponentPropsWithoutRef<"div"> & {
  label?: string;
  labelNote?: ReactNode;
  htmlFor?: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
  error?: {
    message?: string;
  };
  className?: string;
  labelAction?: () => void;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
};

export default ({
  className,
  children,
  required,
  label,
  labelNote,
  helpText,
  htmlFor,
  error,
  labelAction,
  onClick,
}: Props) => {
  return (
    <div
      className={classNames(
        `relative block bg-slate-950 px-4 py-5 text-white focus-within:z-10 focus-within:bg-slate-900 hover:bg-slate-900`,
        className,
        onClick ? "cursor-pointer" : "",
        error ? "border border-red-500" : "",
      )}
      onClick={onClick}
    >
      {error?.message && (
        <div className="-mx-3 -mt-2.5 mb-2.5 bg-red-600 px-3 py-2.5 sm:-mx-5 sm:-mt-4 sm:mb-4 sm:px-5">
          {error.message}
        </div>
      )}

      {label && (
        <FormLabel
          htmlFor={htmlFor}
          required={required}
          labelNote={labelNote}
          className="flex flex-auto cursor-pointer items-center"
        >
          {label}
          {labelAction && (
            <ChevronRightIcon className="ml-1 inline-block h-5 font-bold" />
          )}
        </FormLabel>
      )}
      {children}
      {false && helpText && <HelpText>{helpText}</HelpText>}
    </div>
  );
};
