import { useLocation, useNavigate } from "react-router-dom";
import { FormEvent, useState } from "react";

import { Brand, Distiller } from "../types";
import api, { ApiError } from "../lib/api";
import { useRequiredAuth } from "../hooks/useAuth";
import Layout from "../components/layout";
import { formatCategoryName, toTitleCase } from "../lib/strings";
import FormError from "../components/formError";
import FormField from "../components/formField";
import TextInput from "../components/textInput";
import FormLabel from "../components/formLabel";
import HelpText from "../components/helpText";
import FormHeader from "../components/formHeader";
import BrandSelect from "../components/brandSelect";
import Select from "../components/select";
import DistillerSelect from "../components/distillerSelect";
import TextField from "../components/textField";
import Fieldset from "../components/fieldset";
import BrandField from "../components/brandField";
import DistillerField from "../components/distillerField";
import SelectField from "../components/selectField";

type FormData = {
  name?: string;
  series?: string;
  brand?: Brand;
  distiller?: Distiller;
  abv?: number;
  statedAge?: number;
  category?: string;
};

export default function AddBottle() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useRequiredAuth();

  const qs = new URLSearchParams(location.search);
  const name = toTitleCase(qs.get("name") || "");

  const [formData, setFormData] = useState<FormData>({
    name,
    series: "",
    category: "",
  });

  const categoryList = [
    "blend",
    "blended_grain",
    "blended_malt",
    "blended_scotch",
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
        const bottle = await api.post("/bottles", { data: formData });
        navigate(`/bottles/${bottle.id}/checkin`, {
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
      header={<FormHeader title="Add Bottle" onSave={onSubmit} />}
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
            helpText="The full name of the bottle, excluding its series."
            placeholder="e.g. Macallan 12"
            onChange={(e) =>
              setFormData({ ...formData, [e.target.name]: e.target.value })
            }
            value={formData.name}
          />
          <TextField
            type="text"
            label="Series"
            name="series"
            placeholder="e.g. The Edition"
            onChange={(e) =>
              setFormData({ ...formData, [e.target.name]: e.target.value })
            }
            value={formData.series}
          />

          <BrandField
            label="Brand"
            name="brand"
            helpText="The brand, or main label of the bottle."
            placeholder="e.g. Macallan"
            onChange={(value: Brand) =>
              setFormData({ ...formData, brand: value })
            }
            required
            canCreate={user.admin}
            value={formData.brand}
          />

          <DistillerField
            label="Distiller"
            name="distiller"
            placeholder="e.g. Distiller"
            helpText="The single distillery which produces this bottle."
            onChange={(value: Distiller) =>
              setFormData({ ...formData, distiller: value })
            }
            canCreate={user.admin}
            value={formData.distiller}
          />

          <div className="flex">
            <div className="w-1/2 border-r">
              <TextField
                type="number"
                label="ABV"
                name="abv"
                placeholder="e.g. 45"
                helpText="The alcohol content by volume."
                required
                onChange={(e) =>
                  setFormData({ ...formData, [e.target.name]: e.target.value })
                }
                value={formData.abv}
                suffixLabel="%"
              />
            </div>
            <div className="w-1/2">
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
            </div>
          </div>

          <SelectField
            label="Category"
            name="category"
            placeholder="e.g. Single Malt"
            helpText="The kind of spirit."
            onChange={(e) =>
              setFormData({ ...formData, [e.target.name]: e.target.value })
            }
            value={formData.category}
            options={[
              { id: "", value: <em>Unknown</em> },
              ...categoryList.map(({ id, name }) => ({ id, value: name })),
            ]}
          />
        </Fieldset>
      </form>
    </Layout>
  );
}
