import type { ReactNode } from "react";

export type Option = {
  description?: string | null;
  id?: string | number | null;
  name: string;
  shortName?: string | null;
};

export type CreateFormOptions<T extends Option> = {
  data: Option;
  onSubmit: (newOption: T) => void;
  onClose: () => void;
};

export type CreateForm<T extends Option> = ({
  onSubmit,
  onClose,
  data,
}: CreateFormOptions<T>) => ReactNode;

export type OnResults<T extends Option> = (results: any[]) => T[];

export type OnQuery<T extends Option> = (
  query: string,
  options: T[],
) => Promise<T[]>;

export type OnRenderOption<T extends Option> = (option: T) => ReactNode;

export type OnRenderChip<T extends Option> = (option: T) => ReactNode;
