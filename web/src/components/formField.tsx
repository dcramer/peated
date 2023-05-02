import { ReactNode } from "react";
import FormLabel from "./formLabel";
import HelpText from "./helpText";

type Props = {
  label?: string;
  htmlFor?: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
  className?: string;
};

export default ({
  className,
  children,
  required,
  label,
  helpText,
  htmlFor,
}: Props) => {
  return (
    <div
      className={`relative px-3 pb-1.5 pt-2.5 focus-within:z-10 focus-within:ring-indigo-600 ${className}`}
    >
      {label && (
        <FormLabel htmlFor={htmlFor} required={required}>
          {label}
        </FormLabel>
      )}
      {children}
      {false && helpText && <HelpText>{helpText}</HelpText>}
    </div>
  );
};
