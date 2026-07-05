"use client";

import type { FormEvent, ReactNode } from "react";
import FormHeader from "./formHeader";
import Header from "./header";
import Layout from "./layout";

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  onSave: (e: FormEvent<HTMLFormElement | HTMLButtonElement>) => void;
  saveDisabled?: boolean;
  saveLabel?: string;
  sidebar?: ReactNode;
  title: string;
};

export default function FormScreen({
  children,
  footer = null,
  onClose,
  onSave,
  saveDisabled = false,
  saveLabel,
  sidebar,
  title,
}: Props) {
  return (
    <Layout
      sidebar={sidebar}
      header={
        <Header>
          <FormHeader
            title={title}
            saveDisabled={saveDisabled}
            saveLabel={saveLabel}
            onSave={onSave}
            onClose={onClose}
          />
        </Header>
      }
      footer={footer}
    >
      {children}
    </Layout>
  );
}
