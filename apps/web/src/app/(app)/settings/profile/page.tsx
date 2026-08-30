"use client";

import { UserInputSchema } from "@peated/server/schemas";
import {
  Button,
  Field,
  FieldGroup,
  FormActions,
  FormNotice,
  FormSection,
  FormStack,
  PictureInput,
  Switch,
  TextInput,
} from "@peated/web/components";
import useAuth from "@peated/web/hooks/useAuth";
import {
  acceptTosForm,
  resendVerificationForm,
  updateSession,
} from "@peated/web/lib/auth.actions";
import { useORPC } from "@peated/web/lib/orpc/context";
import { zodResolver } from "@peated/web/lib/zodResolver";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

const ProfileSettingsSchema = UserInputSchema.pick({
  private: true,
  username: true,
});
type ProfileSettingsData = z.infer<typeof ProfileSettingsSchema>;

export default function ProfileSettingsPage() {
  const { setUser } = useAuth();
  const orpc = useORPC();
  const router = useRouter();
  const { data: user } = useSuspenseQuery(
    orpc.users.details.queryOptions({
      input: { user: "me" },
    }),
  );
  const userUpdate = useMutation(orpc.users.update.mutationOptions());
  const avatarUpdate = useMutation(orpc.users.avatarUpdate.mutationOptions());
  const [picture, setPicture] = useState<File | null | undefined>();
  const [picturePreview, setPicturePreview] = useState(
    user.pictureUrl ?? undefined,
  );
  const [submitError, setSubmitError] = useState<string>();
  const {
    control,
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
  } = useForm<ProfileSettingsData>({
    defaultValues: { private: user.private, username: user.username },
    resolver: zodResolver(ProfileSettingsSchema),
  });

  useEffect(() => {
    return () => {
      if (picturePreview?.startsWith("blob:"))
        URL.revokeObjectURL(picturePreview);
    };
  }, [picturePreview]);

  const onSubmit: SubmitHandler<ProfileSettingsData> = async (data) => {
    setSubmitError(undefined);
    try {
      const updatedUser = await userUpdate.mutateAsync({
        ...data,
        picture: picture === null ? null : undefined,
        user: "me",
      });
      const avatar = picture
        ? await avatarUpdate.mutateAsync({ file: picture, user: "me" })
        : {};
      await updateSession();
      setUser({ ...updatedUser, ...avatar });
      router.push(`/users/${updatedUser.username}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to save your profile.",
      );
    }
  };

  return (
    <FormStack>
      <AccountNotices
        termsAccepted={Boolean(user.termsAcceptedAt)}
        verified={Boolean(user.verified)}
      />
      {submitError ? <FormNotice>{submitError}</FormNotice> : null}
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormStack>
          <FormSection
            description="The name and picture shown beside your tastings and contributions."
            title="Profile"
          >
            <Field
              error={errors.username?.message}
              errorId="settings-username-error"
              htmlFor="settings-username"
              label="Username"
              required
            >
              <TextInput
                {...register("username")}
                aria-describedby={
                  errors.username ? "settings-username-error" : undefined
                }
                autoComplete="username"
                id="settings-username"
                invalid={Boolean(errors.username)}
                placeholder="you99"
              />
            </Field>
            <Field htmlFor="settings-email" label="Email">
              <TextInput
                disabled
                id="settings-email"
                type="email"
                value={user.email ?? ""}
              />
            </Field>
            <FieldGroupPicture
              disabled={isSubmitting}
              onChange={(file) => {
                setPicture(file);
                setPicturePreview(file ? URL.createObjectURL(file) : undefined);
              }}
              preview={picturePreview}
            />
          </FormSection>
          <FormSection
            description="Choose who can see your tasting activity."
            title="Privacy"
          >
            <Controller
              control={control}
              name="private"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  description="Only friends can see your activity."
                  label="Private profile"
                  name={field.name}
                  onBlur={field.onBlur}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </FormSection>
          <FormActions>
            <Button
              loading={isSubmitting}
              loadingLabel="Saving…"
              type="submit"
              variant="accent"
            >
              Save changes
            </Button>
          </FormActions>
        </FormStack>
      </form>
    </FormStack>
  );
}

function FieldGroupPicture({
  disabled,
  onChange,
  preview,
}: {
  disabled: boolean;
  onChange: (file: File | null) => void;
  preview?: string;
}) {
  return (
    <FieldGroup label="Profile picture" optional>
      <PictureInput
        disabled={disabled}
        id="settings-picture"
        label="Add a profile picture"
        name="picture"
        onFilesSelected={(files) => onChange(files.item(0))}
        onRemove={preview ? () => onChange(null) : undefined}
        preview={
          preview ? { alt: "Current profile picture", src: preview } : undefined
        }
      />
    </FieldGroup>
  );
}

function AccountNotices({
  termsAccepted,
  verified,
}: {
  termsAccepted: boolean;
  verified: boolean;
}) {
  const [tosState, acceptAction] = useActionState(acceptTosForm, undefined);
  const [verificationState, resendAction] = useActionState(
    resendVerificationForm,
    undefined,
  );

  useEffect(() => {
    if (tosState?.ok || verificationState?.alreadyVerified)
      void updateSession();
  }, [tosState?.ok, verificationState?.alreadyVerified]);

  return (
    <>
      {!termsAccepted ? (
        <FormNotice>
          <form action={acceptAction}>
            Accept the Terms of Service to update your account.{" "}
            <NoticeButton label="Accept terms" />
          </form>
        </FormNotice>
      ) : null}
      {!verified ? (
        <FormNotice>
          <form action={resendAction}>
            {verificationState?.ok
              ? "Verification email sent."
              : "Your email address is waiting for verification. "}
            {!verificationState?.ok ? (
              <NoticeButton label="Resend email" />
            ) : null}
          </form>
        </FormNotice>
      ) : null}
    </>
  );
}

function NoticeButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} size="sm" type="submit" variant="text">
      {pending ? "Working…" : label}
    </Button>
  );
}
