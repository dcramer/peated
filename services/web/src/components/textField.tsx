import { ReactNode } from "react";

import FormField from "./formField";
import TextInput from "./textInput";

type Props = {
  label?: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
  className?: string;
} & React.ComponentProps<typeof TextInput>;

export default ({
  name,
  helpText,
  label,
  required,
  className,
  ...props
}: Props) => {
  return (
    <FormField
      label={label}
      htmlFor={`f-${name}`}
      required={required}
      helpText={helpText}
      className={className}
    >
      <TextInput name={name} id={`f-${name}`} required={required} {...props} />
    </FormField>
  );
};
