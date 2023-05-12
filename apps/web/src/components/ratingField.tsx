import { ReactNode } from "react";

import FormField from "./formField";
import Rating from "./rating";

type Props = {
  label?: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
  className?: string;
} & React.ComponentProps<typeof Rating>;

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
      <Rating name={name} id={`f-${name}`} required={required} {...props} />
    </FormField>
  );
};
