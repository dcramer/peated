import type { ReactNode } from "react";

export type Option = {
  id?: string | number | null;
  name: string;
};

export type CreateOptionForm<T extends Option> = ({
  onSubmit,
  onClose,
  data,
  onFieldChange,
}: {
  data: T;
  onFieldChange: (arg0: Partial<T>) => void;
  onSubmit: (newOption: T) => void;
  onClose: () => void;
}) => ReactNode;

export type OnResults<T extends Option> = (results: any[]) => T[];

export type OnQuery<T extends Option> = (
  query: string,
  options: T[],
) => Promise<T[]>;

export type OnRenderOption<T extends Option> = (option: T) => ReactNode;

export type OnRenderChip<T extends Option> = (option: T) => ReactNode;
