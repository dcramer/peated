"server only";

import { cache } from "react";

import { createServerClient } from "./orpc/client.server";
import { resolveOrNotFound } from "./orpc/notFound.server";

async function loadProfilePage(username: string) {
  const { client } = await createServerClient();
  return await resolveOrNotFound(client.users.details({ user: username }));
}

export const getProfilePage = cache(loadProfilePage);
