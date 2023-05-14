import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import BottleName from "../components/bottleName";
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
import { formatCategoryName, toTitleCase } from "../lib/strings";

type FormData = {
  name: string;
  brand: Option;
  distillers?: Option[] | undefined;
  statedAge?: number | undefined;
  category?: Option;
};

const PreviewCard = ({
  data: { distillers, brand, ...bottle },
}: {
  data: Partial<FormData>;
}) => {
  return (
    <div className="text-peated flex items-center space-x-4 rounded bg-gray-100 p-3 sm:mb-4">
      <div className="flex-1 space-y-1">
        <p className="text-peated font-semibold leading-6">
          {bottle.name ? (
            <BottleName
              bottle={{
                name: bottle.name,
                brand: brand
                  ? {
                      name: brand.name,
                    }
                  : undefined,
              }}
            />
          ) : (
            "Unknown Bottle"
          )}
        </p>
        <p className="text-sm font-light text-gray-500">
          Produced by {brand?.name || "Unknown"}
          {distillers &&
            distillers.length > 0 &&
            (distillers.length > 0 || brand?.name !== distillers[0].name) && (
              <span>
                {" "}
                &middot; Distilled at {distillers.map((d) => d.name).join(", ")}
              </span>
            )}
        </p>
      </div>
      <div className="space-y-1">
        <p className="leading-6 text-gray-500">
          {bottle.category && bottle.category.name}
        </p>
        <p className="mt-1 text-sm leading-5 text-gray-500">
          {bottle.statedAge ? `Aged ${bottle.statedAge} years` : null}
        </p>
      </div>
    </div>
  );
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
  const [saving, setSaving] = useState(false);

  const onSubmit = (e: FormEvent<HTMLFormElement | HTMLButtonElement>) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);

    (async () => {
      try {
        const bottle = await api.post("/bottles", {
          data: {
            ...formData,
            category: formData.category ? formData.category.id : null,
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
      setSaving(false);
    })();
  };

  return (
    <Layout
      header={
        <FormHeader
          title="Add Bottle"
          onSave={onSubmit}
          saveDisabled={saving}
        />
      }
      gutter
      noMobileGutter
    >
      <form className="sm:mx-16">
        {error && <FormError values={[error]} />}

        <PreviewCard data={formData} />

        <Fieldset>
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
            onChange={(value) => setFormData({ ...formData, category: value })}
            targetOptions={categoryList.length}
            suggestedOptions={categoryList}
            options={categoryList}
          />
        </Fieldset>
      </form>
    </Layout>
  );
}
