"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function bustAppCache(redirectTo?: string) {
  revalidatePath("/", "layout");
  if (redirectTo) {
    redirect(redirectTo);
  }
}
