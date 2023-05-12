import { ReactNode } from "react";

export type Option = {
  id?: string | null;
  name: string;
  [key: string]: any;
};

export type CreateOptionForm = ({
  data,
  onFieldChange,
}: {
  data: Option;
  onFieldChange: (arg0: Partial<Option>) => void;
}) => ReactNode;
