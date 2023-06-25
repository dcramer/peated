import type { ReactNode } from "react";
import { forwardRef } from "react";

import FormField from "./formField";
import TextArea from "./textArea";

type Props = {
  label?: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
  className?: string;
  error?: {
    message?: string;
  };
} & React.ComponentProps<typeof TextArea>;

export default forwardRef<HTMLTextAreaElement, Props>(function TextAreaField(
  { name, helpText, label, required, error, className, ...props },
  ref,
) {
  return (
    <FormField
      label={label}
      htmlFor={`f-${name}`}
      required={required}
      helpText={helpText}
      className={className}
      error={error}
    >
      <TextArea
        name={name}
        id={`f-${name}`}
        required={required}
        ref={ref}
        {...props}
      />
    </FormField>
  );
});
