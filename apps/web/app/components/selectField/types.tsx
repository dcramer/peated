import type { ReactNode } from "react";

export type Option = Record<string, any> & {
  id?: string | number | null;
  name: string;
  count?: number;
};

export type CreateOptionForm<T> = ({
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

export type EndpointOptions =
  | string
  | {
      path: string;
      query?: Record<string, any>;
    };

export type OnResults<T> = (results: any[]) => T[];

export type OnQuery<T> = (query: string) => Promise<T[]>;

export type OnRenderOption<T> = (option: T) => ReactNode;

export type OnRenderChip<T> = (option: T) => ReactNode;
