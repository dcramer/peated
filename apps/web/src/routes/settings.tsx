import { useNavigate } from "react-router-dom";

import { XMarkIcon } from "@heroicons/react/20/solid";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserInputSchema } from "@peated/shared/schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import Fieldset from "../components/fieldset";
import FormError from "../components/formError";
import FormHeader from "../components/formHeader";
import Header from "../components/header";
import ImageField from "../components/imageField";
import Layout from "../components/layout";
import TextField from "../components/textField";
import { useRequiredAuth } from "../hooks/useAuth";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api, { ApiError } from "../lib/api";
import { toBlob } from "../lib/blobs";
import type { User } from "../types";

type FormSchemaType = z.infer<typeof UserInputSchema>;

export default function Settings() {
  const { user: currentUser, updateUser } = useRequiredAuth();
  const queryClient = useQueryClient();

  const { data: user } = useSuspenseQuery(
    ["users", currentUser.username],
    (): Promise<User> => api.get(`/users/me`),
    { cacheTime: 0 },
  );

  const navigate = useNavigate();

  const saveUser = useMutation({
    mutationFn: async (data: FormSchemaType) => {
      try {
        const newUser = await api.put("/users/me", {
          data,
        });
        let newAvatar: any;
        if (picture) {
          const blob = await toBlob(picture);
          newAvatar = await api.post("/users/me/avatar", {
            data: {
              picture: blob,
            },
          });
        } else {
          newAvatar = {};
        }
        updateUser({
          ...newUser,
          ...newAvatar,
        });
        await queryClient.invalidateQueries(["users", currentUser.username]);
        navigate(`/users/${newUser.username}`);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          console.error(err);
          setError("Internal error");
        }
      }
    },
  });

  const [picture, setPicture] = useState<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | undefined>();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(UserInputSchema),
    defaultValues: user,
  });

  const onSubmit: SubmitHandler<FormSchemaType> = (data) => {
    saveUser.mutate(data);
  };

  return (
    <Layout
      title="Settings"
      header={
        <Header>
          <FormHeader
            title="Settings"
            onSave={handleSubmit(onSubmit)}
            icon={<XMarkIcon className="h-full w-full" />}
            saveDisabled={isSubmitting}
            onClose={() => navigate(`/users/${currentUser.username}`)}
          />
        </Header>
      }
    >
      <form className="sm:mx-16" onSubmit={handleSubmit(onSubmit)}>
        {error && <FormError values={[error]} />}

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
        </Fieldset>
      </form>
    </Layout>
  );
}
