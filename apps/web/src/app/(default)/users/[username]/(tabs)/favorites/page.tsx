import { redirect } from "next/navigation";

export default async function UserFavorites(props: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await props.params;
  return redirect(`/users/${username}/library`);
}
