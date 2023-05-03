import { ReactNode } from "react";
import FormLabel from "./formLabel";
import HelpText from "./helpText";

type Props = React.ComponentPropsWithoutRef<"div"> & {
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
      className={`relative px-3 pb-2.5 pt-2.5 bg-white focus-within:z-10 ${className}`}
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
