import { FormEvent, useState } from "react";
import type { LoaderFunction } from "react-router-dom";
import { useLoaderData, useNavigate } from "react-router-dom";

import BrandField from "../components/brandField";
import DistillerField from "../components/distillerField";
import Fieldset from "../components/fieldset";
import FormError from "../components/formError";
import FormHeader from "../components/formHeader";
import Layout from "../components/layout";
import SelectField, { Option } from "../components/selectField";
import TextField from "../components/textField";
import { useRequiredAuth } from "../hooks/useAuth";
import api, { ApiError } from "../lib/api";
import { formatCategoryName } from "../lib/strings";
import { Bottle } from "../types";

type LoaderData = {
  bottle: Bottle;
};

export const loader: LoaderFunction = async ({
  params: { bottleId },
}): Promise<LoaderData> => {
  if (!bottleId) throw new Error("Missing bottleId");
  const bottle = await api.get(`/bottles/${bottleId}`);

  return { bottle };
};

type FormData = {
  name?: string;
  brand?: Option | undefined;
  distillers?: Option[] | undefined;
  statedAge?: number | undefined;
  category?: Option | undefined;
};

const entityToOption = (entity: any) => {
  return {
    id: entity.id,
    name: entity.name,
  };
};

export default function EditBottle() {
  const navigate = useNavigate();
  const { user } = useRequiredAuth();
  const { bottle } = useLoaderData() as LoaderData;

  const [formData, setFormData] = useState<FormData>({
    name: bottle.name,
    category: bottle.category
      ? {
          id: bottle.category,
          name: formatCategoryName(bottle.category),
        }
      : undefined,
    brand: entityToOption(bottle.brand),
    distillers: bottle.distillers.map(entityToOption),
    statedAge: bottle.statedAge || undefined,
  });

  const categoryList = [
    "blend",
    "bourbon",
    "rye",
    "single_grain",
    "single_malt",
    "spirit",
  ].map((c) => ({
    id: c,
    name: formatCategoryName(c),
  }));

  const [error, setError] = useState<string | undefined>();

  const onSubmit = (e: FormEvent<HTMLFormElement | HTMLButtonElement>) => {
    e.preventDefault();
    (async () => {
      try {
        console.log(formData);
        await api.put(`/bottles/${bottle.id}`, {
          data: {
            ...formData,
            category: formData.category?.id || null,
            brand: formData.brand?.id || formData.brand,
            distillers: formData.distillers
              ? formData.distillers.map((d) => d?.id || d)
              : undefined,
          },
        });
        navigate(`/bottles/${bottle.id}`);
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
      header={<FormHeader title="Edit Bottle" onSave={onSubmit} />}
      gutter
      noMobileGutter
    >
      <form className="sm:mx-16">
        {error && <FormError values={[error]} />}

        <Fieldset>
          <TextField
            type="text"
            label="Bottle"
            name="name"
            required
            helpText="The full name of the bottle, excluding its specific cask information."
            placeholder="e.g. Macallan 12"
            onChange={(e) =>
              setFormData({ ...formData, [e.target.name]: e.target.value })
            }
            value={formData.name}
          />

          <BrandField
            label="Brand"
            name="brand"
            helpText="The brand, or main label of the bottle."
            placeholder="e.g. Macallan"
            onChange={(value) =>
              setFormData({ ...formData, brand: value as Option })
            }
            required
            canCreate={user.admin}
            value={formData.brand}
          />

          <DistillerField
            label="Distiller"
            name="distillers"
            placeholder="e.g. Distiller"
            helpText="The distilleries which produces the spirit(s) for this bottle."
            onChange={(value) =>
              setFormData({
                ...formData,
                distillers: value as Option[],
              })
            }
            canCreate={user.admin}
            value={formData.distillers}
            multiple
          />

          <TextField
            type="number"
            label="Stated Age"
            name="statedAge"
            placeholder="e.g. 12"
            helpText="The number of years the spirit was aged."
            onChange={(e) =>
              setFormData({ ...formData, [e.target.name]: e.target.value })
            }
            value={formData.statedAge}
            suffixLabel="years"
          />

          <SelectField
            label="Category"
            name="category"
            placeholder="e.g. Single Malt"
            helpText="The kind of spirit."
            onChange={(value) => setFormData({ ...formData, category: value })}
            suggestedOptions={categoryList}
            options={categoryList}
          />
        </Fieldset>
      </form>
    </Layout>
  );
}
