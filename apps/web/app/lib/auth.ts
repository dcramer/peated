export function getAuthRedirect({ request }: { request: Request }) {
  const location = new URL(request.url);

  const redirectTo = location.pathname;

  return `/login?redirectTo=${encodeURIComponent(redirectTo)}`;
}
