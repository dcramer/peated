import { redirect } from "next/navigation";

export default async function ProfileFavoritesRedirect(props: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await props.params;
  redirect(`/users/${username}/library`);
}
