import { Form, useLocation, useNavigate } from "react-router-dom";
// import BrandSelect from "../components/brandSelect";
import { FormEvent, useState } from "react";

// import DistillerSelect from "../components/distillerSelect";
import { Brand, Distiller } from "../types";
import api, { ApiError } from "../lib/api";
import { useRequiredAuth } from "../hooks/useAuth";
import Layout from "../components/layout";
import { formatCategoryName } from "../lib/strings";
import FormError from "../components/formError";
import FormField from "../components/formField";
import TextInput from "../components/textInput";
import FormLabel from "../components/formLabel";
import HelpText from "../components/helpText";
import FormHeader from "../components/formHeader";
import Typeahead from "../components/typeahead";

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
  const name = qs.get("name") || "";

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
        navigate(`/b/${bottle.id}/checkin`);
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
      <Form onSubmit={onSubmit} className="sm:mx-auto sm:w-full sm:max-w-md">
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
            defaultValue={formData.name}
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
            defaultValue={formData.series}
          />
          <HelpText>If applicable, the series of bottling.</HelpText>
        </FormField>

        <FormField>
          <FormLabel htmlFor="brand">Brand</FormLabel>
          <Typeahead
            type="text"
            name="brand"
            id="brand"
            placeholder="e.g. Macallan"
            onChange={(e) =>
              setFormData({ ...formData, [e.target.name]: e.target.value })
            }
            canCreate={user.admin}
            defaultValue={formData.brand}
          />
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
            defaultValue={formData.abv}
            suffixLabel="%"
          />
          <HelpText>The alcohol content by volume.</HelpText>
        </FormField>

        <FormField>
          <FormLabel htmlFor="stagedAge">Stated Age</FormLabel>
          <TextInput
            type="number"
            name="stagedAge"
            id="stagedAge"
            placeholder="e.g. 12"
            onChange={(e) =>
              setFormData({ ...formData, [e.target.name]: e.target.value })
            }
            defaultValue={formData.statedAge}
            suffixLabel="years"
          />
          <HelpText>
            If applicable, the number of years the spirit was aged.
          </HelpText>
        </FormField>
      </Form>
      {/* 

          <Grid item xs={12}>
            <FormControl fullWidth required>
              <InputLabel id="category-label">Category</InputLabel>
              <Select
                fullWidth
                name="category"
                variant="outlined"
                labelId="category-label"
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                renderValue={(value) =>
                  categoryList.find((v) => value === v.id)?.name || "Unknown"
                }
                value={formData.category}
                required
              >
                <MenuItem key="" value="">
                  <em>Unknown</em>
                </MenuItem>
                {categoryList.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>The kind of spirit.</FormHelperText>
            </FormControl>
          </Grid>
        </Grid> */}
    </Layout>
  );
}
