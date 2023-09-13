import type { ActionArgs, LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import {
  json,
  redirect,
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
} from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import invariant from "tiny-invariant";

import { MAX_FILESIZE } from "@peated/shared/constants";

import type { Tasting } from "@peated/shared/types";
import Fieldset from "~/components/fieldset";
import FormError from "~/components/formError";
import FormHeader from "~/components/formHeader";
import Header from "~/components/header";
import ImageField from "~/components/imageField";
import Layout from "~/components/layout";
import Spinner from "~/components/spinner";
import { ApiError } from "~/lib/api";
import { toBlob } from "~/lib/blobs";
import { logError } from "~/lib/log";

export async function action({ context, request, params }: ActionArgs) {
  invariant(params.tastingId);

  const uploadHandler = unstable_createMemoryUploadHandler({
    maxPartSize: MAX_FILESIZE,
  });

  const formData =
    (request.headers.get("Content-Type") || "").indexOf(
      "application/x-www-form-urlencoded",
    ) === 0
      ? await request.formData()
      : await unstable_parseMultipartFormData(request, uploadHandler);

  // TODO: move to queries
  const image = formData.get("image");
  if (!image) {
    await context.api.delete(`/tastings/${params.tastingId}/image`);
  } else {
    try {
      await context.api.post(`/tastings/${params.tastingId}/image`, {
        data: {
          image,
        },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        return json({ error: err.message });
      } else {
        logError(err);
        return json({ error: "Unknown error" });
      }
    }
  }
  return redirect(`/tastings/${params.tastingId}`);
}

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
  const { error } = useActionData<typeof action>() || {};
  const { tasting } = useLoaderData<typeof loader>();

  const submit = useSubmit();

  const [image, setImage] = useState<HTMLCanvasElement | null>(null);

  const {
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<Record<string, never>>({});

  const onSubmit: SubmitHandler<Record<string, never>> = async () => {
    const data = new FormData();
    if (image) {
      const blob = await toBlob(image, 0.8);
      if (blob) data.append("image", blob);
    }
    submit(data, { method: "POST", encType: "multipart/form-data" });
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
