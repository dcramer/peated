import { useLoaderData, useNavigate } from "@remix-run/react";

import { XMarkIcon } from "@heroicons/react/20/solid";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserInputSchema } from "@peated/server/schemas";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import { type SitemapFunction } from "remix-sitemap";
import type { z } from "zod";
import BooleanField from "~/components/booleanField";
import Fieldset from "~/components/fieldset";
import Form from "~/components/form";
import FormError from "~/components/formError";
import FormHeader from "~/components/formHeader";
import Header from "~/components/header";
import ImageField from "~/components/imageField";
import Layout from "~/components/layout";
import TextField from "~/components/textField";
import useApi from "~/hooks/useApi";
import useAuth from "~/hooks/useAuth";
import { redirectToAuth } from "~/lib/auth.server";
import { toBlob } from "~/lib/blobs";
import { trpc } from "~/lib/trpc";

type FormSchemaType = z.infer<typeof UserInputSchema>;

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export async function loader({
  context: { user, trpc },
  request,
}: LoaderFunctionArgs) {
  if (!user) return redirectToAuth({ request });

  const userDetails = await trpc.userById.query("me");
  if (!userDetails) {
    return redirect(
      `/login?redirectTo=${encodeURIComponent(new URL(request.url).pathname)}`,
    );
  }

  return json({ user: userDetails });
}

export const meta: MetaFunction = () => {
  return [
    {
      title: "Settings",
    },
  ];
};

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useLoaderData<typeof loader>();
  const { setUser } = useAuth();
  const api = useApi();

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
        onSuccess: (newUser) => navigate(`/users/${newUser.username}`),
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
            icon={<XMarkIcon className="h-full w-full" />}
            saveDisabled={isSubmitting}
            onClose={() => navigate(`/users/${user.username}`)}
          />
        </Header>
      }
    >
      <Form onSubmit={handleSubmit(onSubmit)}>
        {userUpdateMutation.isError && (
          <FormError values={[(userUpdateMutation.error as Error).message]} />
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
