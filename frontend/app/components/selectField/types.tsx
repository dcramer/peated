import type { ReactNode } from "react";

export type Option = Record<string, any> & {
  id?: string | number | null;
  name: string;
  count?: number;
};

export type CreateOptionForm = ({
  onSubmit,
  onClose,
  data,
  onFieldChange,
}: {
  data: Option;
  onFieldChange: (arg0: Partial<Option>) => void;
  onSubmit: (newOption: Option) => void;
  onClose: () => void;
}) => ReactNode;
