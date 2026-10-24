// Apple associated domains: lets the Peated iOS app use passkeys for
// peated.com. The app ID is the Apple team ID plus the app's bundle ID, and must
// match the `webcredentials:peated.com` entitlement in the iOS project.
// https://developer.apple.com/documentation/xcode/supporting-associated-domains
const IOS_APP_ID = "87528L5SLE.com.peated.Peated";

export const dynamic = "force-static";

export function GET() {
  return Response.json(
    { webcredentials: { apps: [IOS_APP_ID] } },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
