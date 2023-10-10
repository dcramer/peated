import { useLoaderData, useNavigate } from "@remix-run/react";

import { XMarkIcon } from "@heroicons/react/20/solid";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserInputSchema } from "@peated/shared/schemas";
import type { User } from "@peated/shared/types";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import BooleanField from "~/components/booleanField";
import Fieldset from "~/components/fieldset";
import FormError from "~/components/formError";
import FormHeader from "~/components/formHeader";
import Header from "~/components/header";
import ImageField from "~/components/imageField";
import Layout from "~/components/layout";
import TextField from "~/components/textField";
import useApi from "~/hooks/useApi";
import useAuth from "~/hooks/useAuth";
import { toBlob } from "~/lib/blobs";

type FormSchemaType = z.infer<typeof UserInputSchema>;

export async function loader({ context, request }: LoaderFunctionArgs) {
  const user: User = await context.api.get("/users/me");

  if (!user) {
    if (!context.user) {
      return redirect(
        `/login?redirectTo=${encodeURIComponent(
          new URL(request.url).pathname,
        )}`,
      );
    }
  }

  return json({ user });
}

export const meta: MetaFunction = () => {
  return [
    {
      title: "Settings",
    },
  ];
};

export default function Settings() {
  const api = useApi();
  const navigate = useNavigate();
  const { user } = useLoaderData<typeof loader>();
  const { setUser } = useAuth();

  const queryClient = useQueryClient();
  const saveUser = useMutation({
    mutationFn: async (data: FormSchemaType) => {
      const newUser = await api.put("/users/me", {
        data,
      });
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
      return newUser;
    },
    onSuccess: (newUser) => {
      queryClient.invalidateQueries(["users", newUser.username]);
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
    defaultValues: user,
  });

  const onSubmit: SubmitHandler<FormSchemaType> = async (data) => {
    await saveUser.mutateAsync(data, {
      onSuccess: (newUser) => navigate(`/users/${newUser.username}`),
    });
  };

  return (
    <Layout
      header={
        <Header>
          <FormHeader
            title="Settings"
            onSave={handleSubmit(onSubmit)}
            icon={<XMarkIcon className="h-full w-full" />}
            saveDisabled={isSubmitting}
            onClose={() => navigate(`/users/${user.username}`)}
          />
        </Header>
      }
    >
      <form
        className="self-center bg-slate-950 pb-6 sm:mx-16 sm:my-6"
        onSubmit={handleSubmit(onSubmit)}
      >
        {saveUser.isError && (
          <FormError values={[(saveUser.error as Error).message]} />
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
      </form>
    </Layout>
  );
}
