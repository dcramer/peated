import { ReactNode } from "react";
import FormLabel from "./formLabel";
import HelpText from "./helpText";
import { ChevronRightIcon } from "@heroicons/react/20/solid";
import classNames from "../lib/classNames";

type Props = React.ComponentPropsWithoutRef<"div"> & {
  label?: string;
  htmlFor?: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
  className?: string;
  labelAction?: () => void;
};

export default ({
  className,
  children,
  required,
  label,
  helpText,
  htmlFor,
  labelAction,
}: Props) => {
  return (
    <div
      className={classNames(
        `relative block px-3 pb-2.5 pt-2.5 bg-white focus-within:z-10`,
        className
      )}
    >
      {label && (
        <FormLabel
          htmlFor={htmlFor}
          required={required}
          className="flex items-center flex-1 cursor-pointer"
          onClick={labelAction}
        >
          {label}
          {labelAction && (
            <ChevronRightIcon className="h-5 ml-1 color-peated font-bold inline-block" />
          )}
        </FormLabel>
      )}
      {children}
      {false && helpText && <HelpText>{helpText}</HelpText>}
    </div>
  );
};
