import { XMarkIcon } from "@heroicons/react/20/solid";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserInputSchema } from "@peated/server/schemas";
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
import { redirectToAuth } from "@peated/web/lib/auth";
import { toBlob } from "@peated/web/lib/blobs";
import { trpc } from "@peated/web/lib/trpc";
import type { MetaFunction } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { redirect } from "@remix-run/server-runtime";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import { type SitemapFunction } from "remix-sitemap";
import type { z } from "zod";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

type FormSchemaType = z.infer<typeof UserInputSchema>;

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ context: { user, queryUtils }, request }) => {
    if (!user) return redirectToAuth({ request });

    const userDetails = await queryUtils.userById.ensureData("me");
    if (!userDetails) {
      const url = new URL(request.url);
      return redirect(
        `/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`,
      );
    }

    return { user: userDetails };
  },
);

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
            icon={<XMarkIcon className="h-8 w-8" />}
            saveDisabled={isSubmitting}
            onClose={() => navigate(`/users/${user.username}`)}
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
