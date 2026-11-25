// Step 1 of logging in to /admin: send the visitor to GitHub to approve the login.
// Cloudflare Pages runs this file automatically at the address /auth.
export async function onRequestGet(context) {
  const { env } = context;

  if (!env.GITHUB_CLIENT_ID) {
    return new Response('Login is not set up yet: GITHUB_CLIENT_ID is missing.', { status: 500 });
  }

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    scope: env.GITHUB_SCOPE || 'public_repo',
    state,
    allow_signup: 'false',
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://github.com/login/oauth/authorize?${params.toString()}`,
      'Set-Cookie': `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
      'Cache-Control': 'no-store',
    },
  });
}
