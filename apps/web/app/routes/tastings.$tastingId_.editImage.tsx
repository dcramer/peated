import type { LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import invariant from "tiny-invariant";

import Fieldset from "~/components/fieldset";
import FormError from "~/components/formError";
import FormHeader from "~/components/formHeader";
import Header from "~/components/header";
import ImageField from "~/components/imageField";
import Layout from "~/components/layout";
import Spinner from "~/components/spinner";
import useApi from "~/hooks/useApi";
import { ApiError } from "~/lib/api";
import { toBlob } from "~/lib/blobs";
import type { Tasting } from "~/types";

export async function loader({ params, context }: LoaderArgs) {
  invariant(params.tastingId);

  const tasting: Tasting = await context.api.get(
    `/tastings/${params.tastingId}`,
  );

  return json({ tasting });
}

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: "Edit Tasting Image",
    },
  ];
};

export default function EditTastingImage() {
  const api = useApi();
  const { tasting } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const [error, setError] = useState<string | undefined>();
  const [image, setImage] = useState<HTMLCanvasElement | null>(null);

  const {
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<Record<string, never>>({});

  const onSubmit: SubmitHandler<Record<string, never>> = async (data) => {
    if (!image) {
      await api.delete(`/tastings/${tasting.id}/image`);
      navigate(`/tastings/${tasting.id}`);
    } else {
      try {
        const blob = await toBlob(image);
        await api.post(`/tastings/${tasting.id}/image`, {
          data: {
            image: blob,
          },
        });
        navigate(`/tastings/${tasting.id}`);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          console.error(err);
          setError("Internal error");
        }
      }
    }
  };

  return (
    <Layout
      header={
        <Header>
          <FormHeader
            title="Edit Tasting Image"
            onSave={handleSubmit(onSubmit)}
            saveDisabled={isSubmitting}
          />
        </Header>
      }
      footer={null}
    >
      {isSubmitting && (
        <div className="fixed inset-0 z-10">
          <div className="absolute inset-0 bg-slate-800 opacity-50" />
          <Spinner />
        </div>
      )}
      <form
        className="w-full max-w-xl self-center bg-slate-950 pb-6 sm:my-6"
        onSubmit={handleSubmit(onSubmit)}
      >
        {error && <FormError values={[error]} />}

        <Fieldset>
          <ImageField
            name="image"
            label="Picture"
            value={tasting.imageUrl}
            onChange={(value) => setImage(value)}
            imageWidth={1024 / 2}
            imageHeight={768 / 2}
          />
        </Fieldset>
      </form>
    </Layout>
  );
}
