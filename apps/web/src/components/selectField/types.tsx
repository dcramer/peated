import type { ReactNode } from "react";

export type Option = {
  id?: string | number | null;
  name: string;
} & Record<string, any>;

export type CreateFormOptions<T extends Option> = {
  data: T;
  onSubmit: (newOption: any) => void;
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
  options: T[]
) => Promise<T[]>;

export type OnRenderOption<T extends Option> = (option: T) => ReactNode;

export type OnRenderChip<T extends Option> = (option: T) => ReactNode;
