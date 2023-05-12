import { useLocation, useNavigate } from "react-router-dom";
import { FormEvent, useState } from "react";

import api, { ApiError } from "../lib/api";
import { useRequiredAuth } from "../hooks/useAuth";
import Layout from "../components/layout";
import { formatCategoryName, toTitleCase } from "../lib/strings";
import FormError from "../components/formError";
import FormHeader from "../components/formHeader";
import TextField from "../components/textField";
import Fieldset from "../components/fieldset";
import BrandField from "../components/brandField";
import DistillerField from "../components/distillerField";
import SelectField from "../components/selectField";
import { Option } from "../components/richSelectField";
import BarcodeField from "../components/barcodeField";
import FormField from "../components/formField";
import FormLabel from "../components/formLabel";

type FormData = {
  name: string;
  brand: Option;
  distillers?: Option[] | undefined;
  statedAge?: number | undefined;
  category?: string | undefined;
};

export default function AddBottle() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useRequiredAuth();

  const qs = new URLSearchParams(location.search);
  const name = toTitleCase(qs.get("name") || "");

  const [formData, setFormData] = useState<Partial<FormData>>({
    name,
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
        const bottle = await api.post("/bottles", {
          data: {
            ...formData,
            brand: formData.brand?.id || formData.brand,
            distillers: formData.distillers
              ? formData.distillers.map((d) => d?.id || d)
              : undefined,
          },
        });
        navigate(`/bottles/${bottle.id}/addTasting`, {
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

  const bottleName = () => {
    if (!formData.name && !formData.brand?.name) return <em>Unknown</em>;
    return [formData.brand?.name || "", formData.name || ""].join(" ");
  };

  return (
    <Layout
      header={<FormHeader title="Add Bottle" onSave={onSubmit} />}
      gutter
      noMobileGutter
    >
      <form className="sm:mx-16">
        {error && <FormError values={[error]} />}

        <Fieldset>
          <FormField>
            <FormLabel>Display Name</FormLabel>
            {bottleName()}
          </FormField>

          <BrandField
            label="Brand"
            name="brand"
            helpText="The brand, or main label of the bottle."
            placeholder="e.g. Angel's Envy, Hibiki"
            onChange={(value) =>
              setFormData({ ...formData, brand: value as Option })
            }
            required
            canCreate={user.admin}
            value={formData.brand}
          />

          <TextField
            type="text"
            label="Bottle"
            name="name"
            required
            helpText="The name of the bottle, excluding its specific cask information, and its brand."
            placeholder="e.g. Private Selection, 12-year-old"
            onChange={(e) =>
              setFormData({ ...formData, [e.target.name]: e.target.value })
            }
            value={formData.name}
          />

          <DistillerField
            label="Distiller"
            name="distillers"
            placeholder="e.g. Angel's Envy, Suntory Whisky"
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
            onChange={(value) =>
              setFormData({ ...formData, category: value as string })
            }
            value={formData.category}
            options={[
              { id: "", value: "n/a" },
              ...categoryList.map(({ id, name }) => ({ id, value: name })),
            ]}
          />

          <BarcodeField name="barcode" />
        </Fieldset>
      </form>
    </Layout>
  );
}
