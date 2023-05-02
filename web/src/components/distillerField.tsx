import { ReactNode } from "react";

import FormField from "./formField";
import DistillerSelect from "./distillerSelect";

type Props = {
  label: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
  className?: string;
} & React.ComponentProps<typeof DistillerSelect>;

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
      <DistillerSelect
        name={name}
        id={`f-${name}`}
        required={required}
        {...props}
      />
    </FormField>
  );
};
