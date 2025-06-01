import type { ReactNode } from "react";
import { forwardRef } from "react";

import FormField from "./formField";
import TextInput from "./textInput";

type Props = React.ComponentProps<typeof TextInput> &
  React.ComponentProps<typeof FormField>;

export default forwardRef<HTMLInputElement, Props>(function TextField(
  { name, helpText, label, required, className, error, ...props },
  ref
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
      <TextInput
        name={name}
        id={`f-${name}`}
        required={required}
        ref={ref}
        {...props}
      />
    </FormField>
  );
});
