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
import TextField from "@peated/web/components/textField";
import useApi from "@peated/web/hooks/useApi";
import useAuth from "@peated/web/hooks/useAuth";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { toBlob } from "@peated/web/lib/blobs";
import { isTRPCClientError, trpc } from "@peated/web/lib/trpc";
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
      displayName: user.displayName ?? user.username,
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
      <Form onSubmit={handleSubmit(onSubmit)}>
        {userUpdateMutation.isError && (
          <FormError values={[userUpdateMutation.error.message]} />
        )}

        <Fieldset>
          <TextField
            {...register("displayName")}
            error={errors.displayName}
            label="Name"
            required
          />
          <TextField
            {...register("username")}
            error={errors.username}
            label="Username"
            required
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
            defaultValue={user.private}
          />
        </Fieldset>
      </Form>
    </Layout>
  );
}
