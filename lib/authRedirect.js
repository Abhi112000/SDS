export function authRedirect(ctx) {
  const path = ctx?.resolvedUrl || ctx?.req?.url || '/';
  const callbackUrl = encodeURIComponent(String(path));
  return {
    redirect: {
      destination: `/login?callbackUrl=${callbackUrl}`,
      permanent: false,
    },
  };
}
