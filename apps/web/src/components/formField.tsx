import { ChevronRightIcon } from "@heroicons/react/20/solid";
import { MouseEvent, ReactNode } from "react";
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
  labelAction,
  onClick,
}: Props) => {
  return (
    <div
      className={classNames(
        `relative block bg-slate-950 px-3 py-2.5 text-white focus-within:z-10 focus-within:bg-slate-900 hover:bg-slate-900 sm:px-5 sm:py-4`,
        className,
        onClick ? "cursor-pointer" : "",
      )}
      onClick={onClick}
    >
      {label && (
        <FormLabel
          htmlFor={htmlFor}
          required={required}
          labelNote={labelNote}
          className="flex flex-1 cursor-pointer items-center"
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
