"use client";

import * as stylex from "@stylexjs/stylex";
import type { ComponentPropsWithoutRef, FormEvent, ReactNode } from "react";
import { forwardRef } from "react";
import type { FieldValues, UseControllerProps } from "react-hook-form";
import { useController } from "react-hook-form";

import {
  Field,
  FormActions,
  FormGrid,
  FormSection,
  FormStack,
  Select,
  Switch,
  Textarea,
  TextInput,
} from "..";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, fonts, space, zIndices } from "../../styles/tokens.stylex";
import { WorkflowScreen } from "../workflowScreen.stylex";

type FieldError = { message?: string } | undefined;

export function AdminFormScreen({
  children,
  onClose,
  onSave,
  saveDisabled = false,
  saveLabel,
  title,
}: {
  children: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  onSave: (event: FormEvent<HTMLFormElement | HTMLButtonElement>) => void;
  saveDisabled?: boolean;
  saveLabel?: string;
  sidebar?: ReactNode;
  title: string;
}) {
  return (
    <WorkflowScreen
      onClose={onClose}
      onSave={saveDisabled ? undefined : onSave}
      saveLabel={saveLabel}
      saving={saveDisabled}
      title={title}
    >
      {children}
    </WorkflowScreen>
  );
}

export function AdminForm({
  children,
  isSubmitting = false,
  ...props
}: ComponentPropsWithoutRef<"form"> & { isSubmitting?: boolean }) {
  return (
    <>
      {isSubmitting ? (
        <div aria-live="polite" role="status" {...stylex.props(styles.saving)}>
          <span
            {...stylex.props(foundationStyles.interactive, styles.savingLabel)}
          >
            Saving…
          </span>
        </div>
      ) : null}
      <form {...props} {...stylex.props(styles.form)}>
        <FormStack>{children}</FormStack>
      </form>
    </>
  );
}

export function AdminFormPage({
  afterForm,
  children,
  error,
  isSubmitting,
  onSubmit,
  title,
}: {
  afterForm?: ReactNode;
  children: ReactNode;
  error?: string;
  isSubmitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement | HTMLButtonElement>) => void;
  title: string;
}) {
  return (
    <AdminFormScreen
      onSave={onSubmit}
      saveDisabled={isSubmitting}
      title={title}
    >
      {error ? <AdminFormError values={[error]} /> : null}
      <AdminForm isSubmitting={isSubmitting} onSubmit={onSubmit}>
        {children}
      </AdminForm>
      {afterForm}
    </AdminFormScreen>
  );
}

export function AdminFieldset({
  action,
  children,
  description,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  title?: ReactNode;
}) {
  return title ? (
    <FormSection action={action} description={description} title={title}>
      {children}
    </FormSection>
  ) : (
    <fieldset {...stylex.props(styles.fieldset)}>
      <FormStack>{children}</FormStack>
    </fieldset>
  );
}

export function AdminFormGrid({ children }: { children: ReactNode }) {
  return <FormGrid>{children}</FormGrid>;
}

export function AdminFormActions({ children }: { children: ReactNode }) {
  return <FormActions>{children}</FormActions>;
}

type AdminTextFieldProps = Omit<
  ComponentPropsWithoutRef<"input">,
  "className" | "style"
> & {
  error?: FieldError;
  helpText?: ReactNode;
  label?: ReactNode;
  suffixLabel?: ReactNode;
};

export const AdminTextField = forwardRef<HTMLInputElement, AdminTextFieldProps>(
  function AdminTextField(
    { error, helpText, id, label, name, required, suffixLabel, ...props },
    ref,
  ) {
    const fieldId = id ?? `f-${name}`;
    return (
      <Field
        error={error?.message}
        hint={helpText}
        htmlFor={fieldId}
        label={label ?? name ?? "Field"}
        optional={!required}
        required={required}
      >
        {suffixLabel ? (
          <span {...stylex.props(styles.suffixControl)}>
            <TextInput
              {...props}
              id={fieldId}
              invalid={Boolean(error)}
              name={name}
              ref={ref}
              required={required}
            />
            <span {...stylex.props(foundationStyles.metadata, styles.suffix)}>
              {suffixLabel}
            </span>
          </span>
        ) : (
          <TextInput
            {...props}
            id={fieldId}
            invalid={Boolean(error)}
            name={name}
            ref={ref}
            required={required}
          />
        )}
      </Field>
    );
  },
);

type AdminTextareaFieldProps = Omit<
  ComponentPropsWithoutRef<"textarea">,
  "className" | "style"
> & {
  error?: FieldError;
  format?: "data" | "text";
  helpText?: ReactNode;
  label?: ReactNode;
};

export const AdminTextareaField = forwardRef<
  HTMLTextAreaElement,
  AdminTextareaFieldProps
>(function AdminTextareaField(
  { children, error, helpText, id, label, name, required, ...props },
  ref,
) {
  const fieldId = id ?? `f-${name}`;
  return (
    <Field
      error={error?.message}
      hint={helpText}
      htmlFor={fieldId}
      label={label ?? name ?? "Field"}
      optional={!required}
      required={required}
    >
      <Textarea
        {...props}
        id={fieldId}
        invalid={Boolean(error)}
        name={name}
        ref={ref}
        required={required}
      />
      {children}
    </Field>
  );
});

export type AdminSelectOption = {
  label: ReactNode;
  value: number | string;
};

export const AdminSelectField = forwardRef<
  HTMLSelectElement,
  Omit<
    ComponentPropsWithoutRef<"select">,
    "children" | "className" | "style"
  > & {
    error?: FieldError;
    helpText?: ReactNode;
    label: ReactNode;
    options: readonly AdminSelectOption[];
    placeholder?: string;
  }
>(function AdminSelectField(
  {
    error,
    helpText,
    id,
    label,
    name,
    options,
    placeholder,
    required,
    ...props
  },
  ref,
) {
  const fieldId = id ?? `f-${name}`;
  return (
    <Field
      error={error?.message}
      hint={helpText}
      htmlFor={fieldId}
      label={label}
      optional={!required}
      required={required}
    >
      <Select
        {...props}
        id={fieldId}
        invalid={Boolean(error)}
        name={name}
        ref={ref}
        required={required}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Field>
  );
});

export function AdminSwitchField<T extends FieldValues>({
  helpText,
  label,
  ...props
}: UseControllerProps<T> & {
  error?: FieldError;
  helpText?: ReactNode;
  label: ReactNode;
}) {
  const {
    field: { name, onChange, value },
  } = useController<T>(props);
  return (
    <Switch
      checked={Boolean(value)}
      description={helpText}
      label={label}
      name={name}
      onCheckedChange={onChange}
    />
  );
}

export function AdminFormError({ values }: { values: ReactNode[] }) {
  return (
    <div role="alert" {...stylex.props(foundationStyles.body, styles.error)}>
      <strong>There was an error with your submission.</strong>
      <ul {...stylex.props(styles.errorList)}>
        {values.map((value, index) => (
          <li key={index}>{value}</li>
        ))}
      </ul>
    </div>
  );
}

const styles = stylex.create({
  form: { minWidth: 0 },
  fieldset: { minWidth: 0, margin: 0, padding: 0, borderWidth: 0 },
  saving: {
    position: "fixed",
    zIndex: zIndices.dialog,
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgb(16 18 16 / 0.55)",
  },
  savingLabel: {
    padding: space.x4,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  suffixControl: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    backgroundColor: colors.inset,
  },
  suffix: {
    paddingRight: space.x4,
    color: colors.inkMuted,
  },
  error: {
    padding: space.x4,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.criticalQuiet,
    backgroundColor: colors.accentTint,
    color: colors.ink,
  },
  errorList: { marginTop: space.x2, marginBottom: 0, paddingLeft: space.x6 },
});
