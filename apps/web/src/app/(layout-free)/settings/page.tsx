"use client";

import { XMarkIcon } from "@heroicons/react/20/solid";
import { zodResolver } from "@hookform/resolvers/zod";
import { isDefinedError } from "@orpc/client";
import { UserInputSchema } from "@peated/server/schemas";
import BooleanField from "@peated/web/components/booleanField";
import Fieldset from "@peated/web/components/fieldset";
import Form from "@peated/web/components/form";
import FormError from "@peated/web/components/formError";
import FormHeader from "@peated/web/components/formHeader";
import Header from "@peated/web/components/header";
import ImageField from "@peated/web/components/imageField";
import Layout from "@peated/web/components/layout";
import Legend from "@peated/web/components/legend";
import PendingTosAlert from "@peated/web/components/pendingTosAlert";
import PendingVerificationAlert from "@peated/web/components/pendingVerificationAlert";
import TextField from "@peated/web/components/textField";
import useAuth from "@peated/web/hooks/useAuth";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { updateSession } from "@peated/web/lib/auth.actions";
import { toBlob } from "@peated/web/lib/blobs";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { redirect, useRouter } from "next/navigation";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { z } from "zod";

type FormSchemaType = z.infer<typeof UserInputSchema>;

export default function Page() {
  useAuthRequired();

  const { setUser } = useAuth();
  const orpc = useORPC();

  const router = useRouter();

  const { data: user } = useSuspenseQuery(
    orpc.users.details.queryOptions({
      input: { user: "me" },
      onError: (error: any) => {
        if (isDefinedError(error) && error.name === "NOT_FOUND") {
          redirect("/login");
        }
        throw error;
      },
    }),
  );

  const userUpdateMutation = useMutation(orpc.users.update.mutationOptions());

  const [picture, setPicture] = useState<HTMLCanvasElement | null | undefined>(
    undefined,
  );
  const userAvatarUpdateMutation = useMutation(
    orpc.users.avatarUpdate.mutationOptions(),
  );
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(UserInputSchema),
    defaultValues: {
      ...user,
    },
  });

  const onSubmit: SubmitHandler<FormSchemaType> = async (data) => {
    const newUser = await userUpdateMutation.mutateAsync({
      ...data,
      picture: picture === null ? null : undefined,
      user: "me",
    });

    let newAvatar: any;

    if (picture) {
      newAvatar = await userAvatarUpdateMutation.mutateAsync({
        user: "me",
        file: await toBlob(picture),
      });
    } else {
      newAvatar = {};
    }

    await updateSession();

    setUser({
      ...newUser,
      ...newAvatar,
    });

    router.push(`/users/${newUser.username}`);
  };

  return (
    <Layout
      header={
        <Header>
          <FormHeader
            title="Settings"
            onSave={handleSubmit(onSubmit)}
            icon={<XMarkIcon className="h-8 w-8" />}
            saveDisabled={isSubmitting}
            onClose={() => router.push(`/users/${user.username}`)}
          />
        </Header>
      }
    >
      {!user.termsAcceptedAt && (
        <div className="p-3 lg:mb-8 lg:p-0">
          <PendingTosAlert />
        </div>
      )}

      {!user.verified && (
        <div className="p-3 lg:mb-8 lg:p-0">
          <PendingVerificationAlert />
        </div>
      )}

      {userUpdateMutation.isError && (
        <FormError values={[userUpdateMutation.error.message]} />
      )}

      <Form onSubmit={handleSubmit(onSubmit)}>
        <Fieldset>
          <TextField
            {...register("username")}
            error={errors.username}
            label="Username"
            required
            placeholder="you99"
          />
          <TextField
            readOnly
            disabled
            type="email"
            label="Email"
            placeholder="you@example.com"
            required
            value={user.email}
          />
          <TextField type="password" label="Password" />
          <ImageField
            name="picture"
            label="Picture"
            value={user.pictureUrl}
            onChange={(value) => setPicture(value)}
          />
          <BooleanField
            control={control}
            label="Private"
            helpText="Limit visibility of your activity to friends-only."
            name="private"
          />
        </Fieldset>

        <Fieldset>
          <Legend title="Notifications" />

          <BooleanField
            control={control}
            label="Comments"
            helpText="Receive email notifications for new comments in threads you're participating in."
            name="notifyComments"
          />
        </Fieldset>
      </Form>
    </Layout>
  );
}
