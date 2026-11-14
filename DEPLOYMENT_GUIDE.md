# KWAN Education Platform Deployment Guide

The project deploys as one Vercel application: Vite serves the frontend and a Vercel Function serves the Express API. Platform state is stored in Postgres; resource attachments and CMS images are stored in separate Vercel Blob stores.

## 1. Connect the project to Vercel

1. Import the repository into Vercel and set the project root to the repository root.
2. Keep the Vite build command (`npm run build`) and output directory (`dist`).
3. Use Node.js 24 or newer for the function runtime.
4. Add the storage integrations below before testing the deployed API.

`vercel.json` configures the Vite output and includes the initial seed database in the API Function bundle. The build also copies legacy `/src/assets/...` and `/uploads/...` image paths into the static output.

## 2. Provision persistent storage

### Postgres

From the Vercel project, add a Postgres database through the Vercel Marketplace (for example, Neon). Set `DATABASE_URL` to the provider's pooled connection string. On the first API request, the application creates its state table and imports the bundled `data/kwan-db.json` seed if the table is empty. Later changes are stored in Postgres.

### Vercel Blob

Create two Blob stores because Blob access is configured per store:

- A **private** store for resource attachments. Set its read/write token as `BLOB_PRIVATE_READ_WRITE_TOKEN`.
- A **public** store for CMS banner images. Set its read/write token as `BLOB_PUBLIC_READ_WRITE_TOKEN`.

The application requests short-lived client upload tokens from the API; do not expose either store token in a `VITE_` variable.

## 3. Configure environment variables

Add these in Vercel Project Settings → Environment Variables. Apply them to Production and Preview as appropriate, then redeploy after changing them.

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | Pooled Postgres connection string from the database provider. |
| `SESSION_SECRET` | Yes | Stable random secret used to sign login sessions. Generate with `openssl rand -hex 32`; do not rotate casually because rotation signs users out. |
| `BLOB_PRIVATE_READ_WRITE_TOKEN` | Yes | Read/write token for the private resource-file store. |
| `BLOB_PUBLIC_READ_WRITE_TOKEN` | Yes | Read/write token for the public CMS-image store. |
| `VITE_BLOB_CLIENT_UPLOADS` | Yes | Set to `true` to upload files directly to Blob, avoiding Vercel Function request-size limits. This is a public build-time flag, not a secret. |
| `NEXT_PUBLIC_SUPABASE_URL` | If using Supabase from the browser | Supabase project URL; public client configuration. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | If using Supabase from the browser | Supabase publishable key; intended for public client use. |
| `SUPABASE_URL` | If using Supabase server features | Supabase project URL, available only to server code. |
| `SUPABASE_PUBLISHABLE_KEY` | If using Supabase server features | Supabase publishable key for server-side request handling. |
| `SUPABASE_SECRET_KEY` | If using Supabase server features | Supabase secret key. Keep server-side only; rotate any key exposed outside Vercel. |
| `SUPABASE_JWKS_URL` | If validating Supabase JWTs | Public JWKS endpoint for this project. |
| `ADMIN_SETUP_KEY` | For initial setup | Strong one-time key for creating the first administrator password. Remove it after setup. |
| `GEMINI_API_KEY` | Optional | Gemini API key for AI features. |

Do not set `VITE_API_BASE_URL` when the frontend and API are deployed together. Keep secrets in Vercel settings, never in the repository or a `VITE_` variable.

The Vite build exposes both `VITE_` and `NEXT_PUBLIC_` variables to browser code. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are public client configuration; never put service-role/secret keys, database passwords, or Vercel Connect tokens under either prefix. The current server-side app state store still requires `DATABASE_URL`; these Supabase settings alone do not replace it.

## 4. Deploy and create the administrator password

1. Deploy from Vercel and check `https://<your-domain>/api/health`; it should return `{"ok":true}`.
2. Open `https://<your-domain>/?page=login&view=public`.
3. Use the configured `ADMIN_SETUP_KEY` to create the administrator password.
4. Remove `ADMIN_SETUP_KEY` from the Vercel environment and redeploy. The setup endpoint is closed after the admin password has been created.
5. Sign in as `admin@kwan.ac.ug` with the password you created.

There is no seeded admin password. Do not reuse the setup key as the administrator password.

## 5. Verify storage and uploads

- The homepage and `/api/health` load on the same Vercel domain.
- An administrator can sign in and create a resource with a small supported file.
- An authorized user can download that file; unauthenticated users cannot access private resource attachments.
- An administrator can upload and remove a CMS banner.
- Accounts, settings, and uploaded files remain available after a new deployment.

The purchase flow is simulated; it does not collect or verify real payments. Review [INTEGRATIONS_AND_WEBSITE_ROADMAP.md](./INTEGRATIONS_AND_WEBSITE_ROADMAP.md) before using the platform with real student data or accepting payments.

## Troubleshooting

### `/api/health` is 404 or returns HTML

Confirm the Vercel project root is the repository root and that `api/[...path].ts` and `vercel.json` are included in the deployed commit. Redeploy after changing project settings.

### The API says Postgres or `SESSION_SECRET` is not configured

Set `DATABASE_URL` and `SESSION_SECRET` in the Vercel environment used by that deployment, then redeploy.

### Blob uploads fail

Check `VITE_BLOB_CLIENT_UPLOADS=true` and confirm each Blob token belongs to the correct store: private for resources, public for CMS images. Because `VITE_` variables are embedded at build time, redeploy after changing the flag.

### The platform reports a database connection error

Confirm the Marketplace database is connected to this Vercel project and that `DATABASE_URL` is the provider's valid pooled connection string. Review the Function logs for the database error.
