import type { ReactNode } from "react";

export type Option = {
  id?: string | number | null;
  name: string;
};

export type CreateFormOptions<T extends Option> = {
  data: T;
  onFieldChange: (arg0: Partial<T>) => void;
  onSubmit: (newOption: T) => void;
  onClose: () => void;
};

export type CreateForm<T extends Option> = ({
  onSubmit,
  onClose,
  data,
  onFieldChange,
}: CreateFormOptions<T>) => ReactNode;

export type OnResults<T extends Option> = (results: any[]) => T[];

export type OnQuery<T extends Option> = (
  query: string,
  options: T[],
) => Promise<T[]>;

export type OnRenderOption<T extends Option> = (option: T) => ReactNode;

export type OnRenderChip<T extends Option> = (option: T) => ReactNode;
