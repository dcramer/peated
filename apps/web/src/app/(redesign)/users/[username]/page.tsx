import { ProfileTastingsPageClient } from "./profileTastingsPageClient.stylex";

export const fetchCache = "default-no-store";

export default async function ProfilePageRoute(props: {
  params: Promise<{ username: string }>;
}) {
  await props.params;
  return <ProfileTastingsPageClient />;
}
