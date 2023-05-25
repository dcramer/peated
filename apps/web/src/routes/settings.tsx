import { useNavigate } from "react-router-dom";

import { XMarkIcon } from "@heroicons/react/20/solid";
import { useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
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

type FormData = {
  username: string;
  displayName?: string;
};

export default function Settings() {
  const { user: currentUser, updateUser } = useRequiredAuth();
  const queryClient = useQueryClient();

  const { data: user } = useSuspenseQuery(
    ["users", currentUser.username],
    (): Promise<User> => api.get(`/users/me`),
    { cacheTime: 0 },
  );

  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    username: user.username,
    displayName: user.displayName,
  });
  const [picture, setPicture] = useState<HTMLCanvasElement | null>(null);

  const [error, setError] = useState<string | undefined>();

  const onSubmit = (e: FormEvent<HTMLFormElement | HTMLButtonElement>) => {
    e.preventDefault();
    (async () => {
      try {
        const newUser = await api.put("/users/me", {
          data: {
            displayName: formData.displayName,
            username: formData.username,
          },
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
    })();
  };

  return (
    <Layout
      title="Settings"
      header={
        <Header>
          <FormHeader
            title="Settings"
            onSave={onSubmit}
            icon={<XMarkIcon className="h-full w-full" />}
            onClose={() => navigate(`/users/${currentUser.username}`)}
          />
        </Header>
      }
    >
      <form className="sm:mx-16">
        {error && <FormError values={[error]} />}

        <Fieldset>
          <TextField
            name="displayName"
            label="Name"
            value={formData.displayName}
            required
            onChange={(e) =>
              setFormData({ ...formData, [e.target.name]: e.target.value })
            }
          />
          <TextField
            name="username"
            label="Username"
            value={formData.username}
            required
            onChange={(e) =>
              setFormData({ ...formData, [e.target.name]: e.target.value })
            }
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
