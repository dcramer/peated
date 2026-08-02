import { ChevronRightIcon } from "@heroicons/react/20/solid";
import type { KeyboardEvent, ReactNode } from "react";
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
  onClick,
  ...props
}: Props) {
  const interactionProps = onClick
    ? {
        role: "button",
        tabIndex: 0,
        onClick,
        onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.currentTarget.click();
          }
        },
      }
    : {};

  return (
    <div
      {...props}
      {...interactionProps}
      className={classNames(
        `relative block px-4 py-4 text-white focus-within:z-10`,
        className,
        onClick ? "cursor-pointer" : "",
        error ? "border border-red-500" : "",
      )}
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
      {helpText && <HelpText>{helpText}</HelpText>}
    </div>
  );
}
