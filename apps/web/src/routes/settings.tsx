import type { LoaderFunction } from "react-router-dom";
import { useLoaderData, useNavigate } from "react-router-dom";

import { FormEvent, useState } from "react";
import Fieldset from "../components/fieldset";
import FormError from "../components/formError";
import FormHeader from "../components/formHeader";
import ImageField from "../components/imageField";
import Layout from "../components/layout";
import TextField from "../components/textField";
import { useRequiredAuth } from "../hooks/useAuth";
import api, { ApiError } from "../lib/api";
import type { User } from "../types";

type LoaderData = {
  user: User;
};

// TODO: when this executes the apiClient has not configured
// its token yet as react-dom (thus context) seemingly has
// not rendered.. so this errors out
export const loader: LoaderFunction = async (): Promise<LoaderData> => {
  const user = await api.get(`/users/me`);

  return { user };
};

type FormData = {
  username: string;
  displayName?: string;
  picture?: string;
};

export default function Settings() {
  const { user } = useLoaderData() as LoaderData;
  const { updateUser } = useRequiredAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    username: user.username,
    displayName: user.displayName,
  });
  const [picture, setPicture] = useState<File | string | undefined>(
    user.pictureUrl,
  );

  const [error, setError] = useState<string | undefined>();

  const onSubmit = (e: FormEvent<HTMLFormElement | HTMLButtonElement>) => {
    e.preventDefault();
    (async () => {
      try {
        const newUser = await api.put("/users/me", {
          data: {
            displayName: formData.displayName,
          },
        });
        const newAvatar =
          picture !== user.pictureUrl
            ? await api.post("/users/me/avatar", {
                data: {
                  picture,
                },
              })
            : {};
        updateUser({
          ...newUser,
          ...newAvatar,
        });
        navigate(`/users/${newUser.username}`, {
          replace: true,
        });
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
      header={<FormHeader title="Settings" onSave={onSubmit} />}
      gutter
      noMobileGutter
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
            value={picture}
            onChange={(e) =>
              setPicture(e.target.files?.length ? e.target.files[0] : undefined)
            }
          />
        </Fieldset>
      </form>
    </Layout>
  );
}
