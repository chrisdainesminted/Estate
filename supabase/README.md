# Squarely accounts in Supabase

With Supabase switched on, people sign up and sign in with Supabase Auth
(email and password), and everything they save to their account is kept in
the project's Postgres database: their deal library, saved homes,
applications, tenancies, landlord workspace links, listing alerts and
Squarely Plus. Until the three settings below are added in Cloudflare, the
site keeps using its older accounts and nothing changes.

How it fits together:

- The browser signs in with Supabase directly (`src/lib/account.js`, using
  the project's public anon key). The session is kept in the browser under
  `squarely-auth`.
- The app sends the person's access token to the Squarely server at
  `/api/me`. The server (`worker/supabase.js`) checks the token against the
  project's signing keys, then reads and writes that person's rows with the
  service role key, after checking and cleaning what's saved.
- Row level security is on for every table. A signed-in person can read
  their own account and subscription; nobody can write from the browser.
- The daily job (`worker/index.js`) emails listing alerts and the
  savings-month note to accounts with a confirmed alerts email.
- Stripe tags a Plus subscription with the person's user id, and the
  webhook keeps `subscriptions` in step.

## Set it up (about 15 minutes)

1. **Make the project.** At supabase.com, create a new project (the free plan
   is enough). For people's data to stay in Canada, pick the
   **Canada (Central)** region.
2. **Make the tables.** In the project, open **SQL Editor**, paste all of
   `migrations/20261107000000_squarely_accounts.sql`, and run it. It's safe
   to run again.
3. **Where sign-in links go.** **Authentication → URL Configuration**:
   - Site URL: `https://bedrock.signia83.workers.dev`
   - Redirect URLs: add `https://bedrock.signia83.workers.dev/account/**`
4. **Send the sign-in emails through Resend.** Supabase's built-in email only
   reaches the project's own team, a few an hour, so confirmation and reset
   emails won't reach anyone else without this. **Authentication → Emails →
   SMTP Settings**, turn on custom SMTP:
   - Host `smtp.resend.com`, port `465`, username `resend`
   - Password: a Resend API key (the same kind as the site's `RESEND_API_KEY`)
   - Sender email: the same address as the site's `EMAIL_FROM`, name `Squarely`
5. **Passwords.** **Authentication → Providers → Email**: keep **Confirm
   email** on, and set the minimum password length to 8.
6. **Copy the keys.** **Project Settings → API Keys** (or **Data API**):
   the Project URL, the publishable (anon) key, and the secret (service
   role) key.
7. **Add them to Cloudflare.** Workers & Pages → bedrock → Settings →
   Variables and Secrets:
   - `SUPABASE_URL`: the Project URL, like `https://abcd1234.supabase.co`
   - `SUPABASE_ANON_KEY`: the publishable (anon) key
   - `SUPABASE_SERVICE_ROLE_KEY`: the secret (service role) key. Add it as a
     **Secret**. It can read and write every account, so it never goes in
     the code or the browser.

   Save and deploy. The next page load uses Supabase.

## Moving people over

Everyone makes their account again, with a new password. What they had
comes with them:

- On a device that has their older account, it's brought over by itself the
  first time they sign in: deals, saved homes, applications, rentals,
  workspaces, alerts and a Plus subscription.
- On another device, their account page has **Bring over my old account**:
  they sign in with the old email and password once.
- Their deals are also kept in each browser, so a device's own deals upload
  to the new account on first sign-in.

An older account moves to one Supabase account only. Plus for good still
comes from `PLUS_EMAILS`, matched against the email someone signs in with.

## Checking it

`supabase/migrations` was tested on Postgres 16 with Supabase's roles
(`anon`, `authenticated`, `service_role`): people see only their own rows,
the browser can't write, and the server-only functions are closed to
everyone but the service role. `worker/supabase.test.js` covers the token
checks and every account operation.
