import { useLoaderData, useNavigate } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";

import type { User } from "../types";
import api, { ApiError } from "../lib/api";
import Layout from "../components/layout";
import TextField from "../components/textField";
import Fieldset from "../components/fieldset";
import ImageField from "../components/imageField";
import { FormEvent, useState } from "react";
import FormHeader from "../components/formHeader";
import FormError from "../components/formError";

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
  displayName?: string;
  image?: string;
};

export default function Settings() {
  const { user } = useLoaderData() as LoaderData;
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    displayName: user.displayName,
    image: user.imageUrl,
  });
  const [error, setError] = useState<string | undefined>();

  const onSubmit = (e: FormEvent<HTMLFormElement | HTMLButtonElement>) => {
    e.preventDefault();

    (async () => {
      try {
        await api.post("/users/me", { data: formData });
        navigate(`/users/${user.id}`, {
          replace: true,
        });
      } catch (err) {
        if (err instanceof ApiError) {
          setError(await err.errorMessage());
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
          <ImageField
            name="image"
            label="Picture"
            value={formData.image}
            onChange={(value) => setFormData({ ...formData, image: value })}
          />
        </Fieldset>
      </form>
    </Layout>
  );
}
