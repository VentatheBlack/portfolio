// Step 2 of logging in to /admin: GitHub sends the visitor back here with a one-time code.
// We swap the code for a token, check it belongs to the allowed GitHub user,
// and hand the token to the admin page that opened this window.
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const siteOrigin = url.origin;

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookie = request.headers.get('Cookie') || '';
  const savedState = (cookie.match(/(?:^|;\s*)oauth_state=([^;]+)/) || [])[1];

  if (!code || !state || !savedState || state !== savedState) {
    return reply('error', { message: 'Login failed: the security check did not match. Close this window and try again.' }, siteOrigin);
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.ALLOWED_GITHUB_USER) {
    return reply('error', { message: 'Login is not set up yet: a setting is missing in Cloudflare.' }, siteOrigin);
  }

  let tokenData;
  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'portfolio-admin-login',
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    tokenData = await tokenResponse.json();
  } catch (error) {
    return reply('error', { message: 'Could not reach GitHub. Try again in a minute.' }, siteOrigin);
  }

  if (!tokenData || !tokenData.access_token) {
    const why = (tokenData && (tokenData.error_description || tokenData.error)) || 'GitHub did not give a token.';
    return reply('error', { message: `Login failed: ${why}` }, siteOrigin);
  }

  let user;
  try {
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'portfolio-admin-login',
      },
    });
    user = await userResponse.json();
  } catch (error) {
    return reply('error', { message: 'Could not check your GitHub account. Try again.' }, siteOrigin);
  }

  if (!user || !user.login || user.login.toLowerCase() !== env.ALLOWED_GITHUB_USER.toLowerCase()) {
    return reply('error', { message: 'This GitHub account is not allowed to edit this site.' }, siteOrigin);
  }

  return reply('success', { token: tokenData.access_token, provider: 'github' }, siteOrigin);
}

// Builds the small page that passes the result back to the admin window.
// The message format below is what Decap CMS expects. Do not change it.
function reply(status, content, siteOrigin) {
  const message = `authorization:github:${status}:${JSON.stringify(content)}`;
  const safeMessage = JSON.stringify(message).replace(/</g, '\\u003c');
  const safeOrigin = JSON.stringify(siteOrigin).replace(/</g, '\\u003c');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Logging in</title></head>
<body>
<p>Finishing login. You can close this window if it does not close by itself.</p>
<script>
(function () {
  var message = ${safeMessage};
  var allowedOrigin = ${safeOrigin};
  function receive(event) {
    if (event.origin !== allowedOrigin) return;
    window.opener.postMessage(message, event.origin);
    window.removeEventListener('message', receive, false);
  }
  window.addEventListener('message', receive, false);
  window.opener.postMessage('authorizing:github', allowedOrigin);
})();
</script>
</body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': 'oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
    },
  });
}
