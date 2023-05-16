import { FormEvent, useState } from "react";
import type { LoaderFunction } from "react-router-dom";
import { useLoaderData, useNavigate } from "react-router-dom";

import CountryField from "../components/countryField";
import Fieldset from "../components/fieldset";
import FormError from "../components/formError";
import FormHeader from "../components/formHeader";
import Layout from "../components/layout";
import SelectField, { Option } from "../components/selectField";
import TextField from "../components/textField";
import { useRequiredAuth } from "../hooks/useAuth";
import api, { ApiError } from "../lib/api";
import { Entity } from "../types";

type LoaderData = {
  entity: Entity;
};

export const loader: LoaderFunction = async ({
  params: { entityId },
}): Promise<LoaderData> => {
  if (!entityId) throw new Error("Missing brandId");
  const entity = await api.get(`/entities/${entityId}`);

  return { entity };
};

type FormData = {
  name?: string;
  country?: string | undefined;
  region?: string | undefined;
  type: Option[];
};

export default function EditEntity() {
  const navigate = useNavigate();
  const { user } = useRequiredAuth();
  const { entity } = useLoaderData() as LoaderData;

  const entityTypes = [
    { id: "brand", name: "Brand" },
    { id: "distiller", name: "Distiller" },
    { id: "bottler", name: "Bottler" },
  ];

  const [formData, setFormData] = useState<FormData>({
    name: entity.name,
    country: entity.country,
    region: entity.region,
    type: entity.type.map(
      (t) => entityTypes.find((et) => et.id === t) || { id: "", name: "" },
    ),
  });

  const [error, setError] = useState<string | undefined>();

  const onSubmit = (e: FormEvent<HTMLFormElement | HTMLButtonElement>) => {
    e.preventDefault();
    (async () => {
      try {
        await api.put(`/entities/${entity.id}`, {
          data: {
            ...formData,
            type: formData.type.map((t) => t.id),
          },
        });
        navigate(`/entities/${entity.id}`);
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
      header={<FormHeader title="Edit Entity" onSave={onSubmit} />}
      gutter
      noMobileGutter
    >
      <form className="sm:mx-16">
        {error && <FormError values={[error]} />}

        <Fieldset>
          <TextField
            autoFocus
            label="Name"
            name="name"
            type="text"
            placeholder="e.g. Macallan"
            required
            value={formData.name}
            autoComplete="off"
            onChange={(e) =>
              setFormData({ ...formData, [e.target.name]: e.target.value })
            }
          />
          <CountryField
            name="country"
            label="Country"
            placeholder="e.g. Scotland, United States of America"
            required
            value={formData.country}
            onChange={(value) => setFormData({ ...formData, country: value })}
          />
          <TextField
            name="region"
            label="Region"
            type="text"
            placeholder="e.g. Islay, Kentucky"
            autoComplete="off"
            value={formData.region}
            onChange={(e) =>
              setFormData({ ...formData, [e.target.name]: e.target.value })
            }
          />
          <SelectField
            label="Type"
            suggestedOptions={entityTypes}
            options={entityTypes}
            value={formData.type}
            multiple
            onChange={(value) => setFormData({ ...formData, type: value })}
          />
        </Fieldset>
      </form>
    </Layout>
  );
}
