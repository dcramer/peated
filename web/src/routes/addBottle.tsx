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
    <Layout header={<FormHeader title="Add Bottle" onSave={onSubmit} />}>
      <form className="mx-auto max-w-md">
        {error && <FormError values={[error]} />}

        <FormField>
          <FormLabel htmlFor="username">Bottle</FormLabel>
          <TextInput
            type="text"
            name="name"
            id="name"
            placeholder="e.g. Macallan 12"
            required
            onChange={(e) =>
              setFormData({ ...formData, [e.target.name]: e.target.value })
            }
            value={formData.name}
          />
          <HelpText>
            The full name of the bottle, excluding its series.
          </HelpText>
        </FormField>

        <FormField>
          <FormLabel htmlFor="series">Series</FormLabel>
          <TextInput
            type="text"
            name="series"
            id="series"
            placeholder="e.g. The Edition"
            onChange={(e) =>
              setFormData({ ...formData, [e.target.name]: e.target.value })
            }
            value={formData.series}
          />
          <HelpText>If applicable, the series of bottling.</HelpText>
        </FormField>

        <FormField>
          <FormLabel htmlFor="brand">Brand</FormLabel>
          <BrandSelect
            name="brand"
            id="brand"
            placeholder="e.g. Macallan"
            onChange={(value) => setFormData({ ...formData, brand: value })}
            canCreate={user.admin}
            value={formData.brand}
            required
          />
          <HelpText>The brand, or main label of the bottle.</HelpText>
        </FormField>

        <FormField>
          <FormLabel htmlFor="distiller">Distiller</FormLabel>
          <DistillerSelect
            name="distiller"
            id="distiller"
            placeholder="e.g. Distiller"
            onChange={(value) => setFormData({ ...formData, distiller: value })}
            canCreate={user.admin}
            value={formData.distiller}
          />
          <HelpText>
            If applicable, the single distillery which produces this bottle.
          </HelpText>
        </FormField>

        <FormField>
          <FormLabel htmlFor="abv">ABV</FormLabel>
          <TextInput
            type="number"
            name="abv"
            id="abv"
            placeholder="e.g. 45"
            required
            onChange={(e) =>
              setFormData({ ...formData, [e.target.name]: e.target.value })
            }
            value={formData.abv}
            suffixLabel="%"
          />
          <HelpText>The alcohol content by volume.</HelpText>
        </FormField>

        <FormField>
          <FormLabel htmlFor="statedAge">Stated Age</FormLabel>
          <TextInput
            type="number"
            name="statedAge"
            id="statedAge"
            placeholder="e.g. 12"
            onChange={(e) =>
              setFormData({ ...formData, [e.target.name]: e.target.value })
            }
            value={formData.statedAge}
            suffixLabel="years"
          />
          <HelpText>
            If applicable, the number of years the spirit was aged.
          </HelpText>
        </FormField>

        <FormField>
          <FormLabel htmlFor="category">Category</FormLabel>
          <Select
            name="category"
            id="category"
            onChange={(e) =>
              setFormData({ ...formData, [e.target.name]: e.target.value })
            }
            value={formData.category}
          >
            <option />
            {categoryList.map(({ id, name }) => {
              return (
                <option key={id} value={id}>
                  {name}
                </option>
              );
            })}
          </Select>
          <HelpText>The kind of spirit.</HelpText>
        </FormField>
      </form>
    </Layout>
  );
}
