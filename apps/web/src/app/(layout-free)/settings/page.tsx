"use client";

import { XMarkIcon } from "@heroicons/react/20/solid";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserInputSchema } from "@peated/server/schemas";
import { type User } from "@peated/server/types";
import BooleanField from "@peated/web/components/booleanField";
import Fieldset from "@peated/web/components/fieldset";
import Form from "@peated/web/components/form";
import FormError from "@peated/web/components/formError";
import FormHeader from "@peated/web/components/formHeader";
import Header from "@peated/web/components/header";
import ImageField from "@peated/web/components/imageField";
import Layout from "@peated/web/components/layout";
import Legend from "@peated/web/components/legend";
import PendingVerificationAlert from "@peated/web/components/pendingVerificationAlert";
import TextField from "@peated/web/components/textField";
import useApi from "@peated/web/hooks/useApi";
import useAuth from "@peated/web/hooks/useAuth";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { updateSession } from "@peated/web/lib/auth.actions";
import { toBlob } from "@peated/web/lib/blobs";
import { isTRPCClientError, trpc } from "@peated/web/lib/trpc/client";
import { redirect, useRouter } from "next/navigation";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { z } from "zod";

type FormSchemaType = z.infer<typeof UserInputSchema>;

export default function Page() {
  useAuthRequired();

  const { setUser } = useAuth();
  const api = useApi();

  const router = useRouter();

  let user: User;
  try {
    [user] = trpc.userById.useSuspenseQuery("me");
  } catch (err) {
    if (isTRPCClientError(err) && err.data?.code === "NOT_FOUND") {
      redirect("/login");
    }
    throw err;
  }

  const userUpdateMutation = trpc.userUpdate.useMutation({
    onSuccess: async (newUser) => {
      let newAvatar: any;
      if (picture) {
        const blob = await toBlob(picture, 0.8);
        newAvatar = await api.post("/users/me/avatar", {
          data: {
            picture: blob,
          },
        });
      } else {
        newAvatar = {};
      }
      await updateSession();
      setUser({
        ...newUser,
        ...newAvatar,
      });
    },
  });

  const [picture, setPicture] = useState<HTMLCanvasElement | null>(null);
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
    await userUpdateMutation.mutateAsync(
      { ...data, user: "me" },
      {
        onSuccess: (newUser) => {
          router.push(`/users/${newUser.username}`);
        },
      },
    );
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
      {!user.verified && (
        <div className="p-3 lg:mb-8 lg:p-0">
          <PendingVerificationAlert />
        </div>
      )}

      <Form onSubmit={handleSubmit(onSubmit)}>
        {userUpdateMutation.isError && (
          <FormError values={[userUpdateMutation.error.message]} />
        )}

        <Fieldset>
          <TextField
            {...register("username")}
            error={errors.username}
            label="Username"
            required
          />
          <TextField
            readOnly
            disabled
            type="email"
            label="Email"
            required
            value={user.email}
          />
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
