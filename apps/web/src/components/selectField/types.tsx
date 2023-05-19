import { ReactNode } from "react";

export type Option = {
  id?: string | number | null;
  name: string;
  count?: number;
  [key: string]: any;
};

export type CreateOptionForm = ({
  data,
  onFieldChange,
}: {
  data: Option;
  onFieldChange: (arg0: Partial<Option>) => void;
}) => ReactNode;
