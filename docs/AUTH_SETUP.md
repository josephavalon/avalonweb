# Auth setup — running on local

Avalon ships with **Client Login**, **Admin Login**, and a launch **Nurse**
demo role that reaches the `/provider/*` surface. This page covers what to do
once on a fresh machine.

## 1. Environment

`.env*` is gitignored. Create `.env.local` at the repo root and paste the
keys for the Supabase project you want to point at:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
# Optional — only needed for the demo (no-Supabase) fallback:
# VITE_AVALON_DEMO_PASSWORD=demo-pass
```

Without these keys, the auth store falls back to the local demo roster
(see `src/lib/useAuthStore.js`).

## 2. Apply Supabase migrations

Run the Supabase migrations in order through
`supabase/migrations/011_launch_messaging_roles.sql` against the project
(SQL editor in the Supabase dashboard, or `supabase db push`).

The auth-critical pieces are:

- `007_auth_profile_trigger.sql` creates the signup profile trigger so every
  signup gets a `public.profiles` row with `role='client'`, `status='active'`,
  and the `avalon-vitality` tenant.
- `009_private_auth_profile_trigger.sql` moves that trigger function into the
  private schema.
- `010_tighten_clinical_rls_and_reconciliation_cases.sql` tightens clinical
  RLS and aligns reconciliation case constraints.
- `011_launch_messaging_roles.sql` aligns messaging RLS with the ADMIN /
  CLIENT / NURSE launch model.

## 3. Promote your first admin

After you sign up at `/signup` (or get a magic link at `/login`), open the
SQL editor and promote yourself:

```sql
update public.profiles
   set role = 'admin'
 where email = 'you@example.com';
```

Then sign in at `/admin/login` — the `AdminLogin` page rejects any
non-admin role with a clean error.

## 4. Allowed redirect URLs

In **Supabase → Authentication → URL Configuration**, add the local dev URL
to the redirect allow list:

- `http://localhost:5173/login`
- `http://localhost:5173/admin/login`

Magic links and signup confirmation emails redirect back to `/login` by
default (see `signInWithEmail` and `signUpWithEmail` in
`src/lib/useAuthStore.js`).

## 5. Run

```
npm install
npm run dev
```

Then verify:

| Route          | Expected                                            |
| -------------- | --------------------------------------------------- |
| `/login`       | Email magic-link, phone OTP, passkey                |
| `/signup`      | Create account, confirmation email                  |
| `/forgot`      | Same as `/login` — passwordless recovery            |
| `/admin/login` | Admin-only email magic-link                         |
| `/members/*`   | Bookings, Memberships, Billing, Profile, Documents  |
| `/admin`       | 7 sections (Avalon OS, Dispatch, Inventory, Scheduling, CRM, Analytics, Operations) |
| `/provider/*`  | Nurse operations surfaces for the launch nurse role |

Phone OTP needs the Supabase auth hook (`/api/auth/send-sms.js`) wired in;
on local without that, stick to email magic-link.

## 6. Nurse launch role

`/provider/*` routes already exist and are role-gated to `nurse | admin`.
The local demo roster includes `NURSE001`; production nurse users should have
`public.profiles.role = 'nurse'`.

Prescriber-specific `np` / `physician` roles remain in the database policy
helpers for future clinical workflows, but they are not launch login roles.

No structural change needed.
