import type { OpenAPI } from "@orpc/openapi";

export function imageUploadSpec(spec: OpenAPI.OperationObject) {
  const body = spec.requestBody;
  const multipart =
    body && "content" in body ? body.content["multipart/form-data"] : undefined;
  const schema = multipart?.schema;
  if (!multipart || !schema || !("properties" in schema)) {
    throw new Error("Image upload operation is missing its multipart schema.");
  }

  // OpenAPI image uploads must not tell generated clients to send files as JSON.
  const content = { "multipart/form-data": multipart };
  if (schema.required?.includes("file")) {
    return { ...spec, requestBody: { ...body, content } };
  }

  // Bottle image metadata can be changed without uploading another file.
  return {
    ...spec,
    requestBody: {
      ...body,
      content: {
        ...content,
        "application/json": {
          schema: {
            ...schema,
            properties: Object.fromEntries(
              Object.entries(schema.properties ?? {}).filter(
                ([key]) => key !== "file",
              ),
            ),
          },
        },
      },
    },
  };
}
