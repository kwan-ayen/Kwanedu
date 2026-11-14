# KWAN Education Platform Deployment Guide

This guide covers deploying the current React/Vite + Express application as one Node.js service. The server serves the production frontend and the `/api` endpoints from the same origin.

## Important production limitations

Review these limitations before inviting real students or accepting payments:

- The application stores its database and uploaded files on local disk. Use a host with a persistent writable volume mounted at `<application-root>/data`.
- Run one application instance only. The JSON database is not safe for concurrent multi-instance writes, and login sessions are currently stored in server memory.
- The purchase flow is simulated; it does not collect or verify real payments.
- Some APIs still need comprehensive authentication and role-based authorization. The current platform state API exposes student and tutor records. Do not use real student data until these gaps are addressed.
- Resource documents are limited to 20 MB and are stored locally. Production use should add managed object storage, backups, and malware scanning.

For a real production launch, first address the security and payment gaps described in [INTEGRATIONS_AND_WEBSITE_ROADMAP.md](./INTEGRATIONS_AND_WEBSITE_ROADMAP.md).

## 1. Prepare the deployment

1. Push the project to a private Git repository.
2. Choose a Node.js host or container platform that supports a persistent disk. Static-only hosting is not sufficient.
3. Configure the service to run from the repository root.
4. Use **Node.js 24.x**. The production start script runs `server.ts` directly using Node's built-in TypeScript support.
5. Configure a persistent disk mounted at `<application-root>/data`. The service must be able to create and write:
   - `data/kwan-db.json`
   - `data/uploads/`
   - `data/resource-files/`

Keep the volume attached to the same service during deployments. A temporary filesystem will lose the database and uploaded files when the instance restarts or is replaced.

## 2. Configure build and start commands

Set these commands in the hosting service:

**Build**

For Render (this repository includes `bun.lock`), use:

```bash
bun install --frozen-lockfile
bun run lint
bun run build
```

For an npm-based host, use `npm ci --legacy-peer-deps --include=dev`, then `npm run lint` and `npm run build`.
After changing dependencies, regenerate and commit the relevant lockfile (`bun.lock` for Render/Bun) before deploying.

**Start**

```bash
npm start
```

Configure `NODE_ENV=production`. The host should provide `PORT`; the server listens on that port and binds to `0.0.0.0`. Do not use `npm run dev` or `npm run preview` as the production server.

Set the service health-check path to:

```text
/api/health
```

## 3. Set environment variables

Add environment variables in the hosting provider's secret/configuration settings—not in Git:

| Variable | Required | Purpose |
|---|---:|---|
| `NODE_ENV` | Yes | Set to `production` so Express serves the built frontend instead of starting Vite. |
| `ADMIN_SETUP_KEY` | For initial setup | One-time secret authorizing creation of the first admin password. Generate a strong random value, for example with `openssl rand -hex 32`. |
| `PORT` | Usually provided by host | Listening port. Let the hosting provider set this value. |

`GEMINI_API_KEY` and `APP_URL` appear as placeholders in `.env.example`, but are not currently read by this repository's server. Do not deploy the example placeholder values as secrets.

## 4. Deploy and create the administrator password

1. Deploy the service and wait for the `/api/health` check to pass.
2. Open the public login page:

   ```text
   https://<your-domain>/?page=login&view=public
   ```

3. The first-run screen should identify the administrator as **Ayen Geoffrey Alexander** (`admin@kwan.ac.ug`).
4. Enter the `ADMIN_SETUP_KEY` you configured, then create and confirm a password of at least 12 characters.
5. Once setup succeeds, remove `ADMIN_SETUP_KEY` from the hosting environment and restart/redeploy the service. The setup endpoint is closed after the admin password has been created.
6. Sign in with `admin@kwan.ac.ug` and the password you just created.

There is no seeded admin password. Do not reuse the setup key as the admin password.

## 5. Verify the deployment

Check the health endpoint:

```bash
curl -fsS https://<your-domain>/api/health
```

It should return:

```json
{"ok":true}
```

Then verify in a browser:

- The homepage loads over HTTPS.
- Login and student registration work.
- The admin can create a tutor and upload a small PDF resource.
- A student can preview/download an approved free PDF.
- A paid resource remains unavailable until the student's account has access.
- Uploaded data and accounts remain after a service restart.

## 6. Backups and operations

- Back up the entire `data/` directory, not just `kwan-db.json`; resource attachments and CMS media are stored alongside it.
- Test restoring a backup before relying on it.
- Restrict access to deployment logs and environment secrets. Never log or commit admin passwords, setup keys, or session tokens.
- Schedule maintenance windows for deploys while the JSON database is in use, and verify that the persistent disk remains mounted after each release.
- Expect active sessions to end when the server restarts; users can sign in again.

## Troubleshooting

### The first-run setup screen says `ADMIN_SETUP_KEY` is not configured

Add the key to the service's environment settings and restart the service. For local setup, put it in `.env` (not `.env.example`).

### The app loads but the database resets after redeploy

The host is using ephemeral storage or the persistent volume is mounted somewhere other than `<application-root>/data`. Attach the volume at the correct path and restore the latest `data/` backup if required.

### Resource uploads fail

Check that the service can write to `data/resource-files/`, that the file is a supported document/image type, and that it is no larger than 20 MB. The JSON API request limit is configured for this upload size.

### API health check fails

Check startup logs for a missing build, invalid environment, or port binding issue. Confirm that the build command completed successfully and that the host provides `PORT`.

### The page reports `Unexpected token 'T'` while loading the platform

The frontend received a text or HTML response instead of JSON from `/api/state`. Deploy this as a Node.js service using `npm start` with Node.js 24+ and `NODE_ENV=production`; a static-only deployment of `dist/` cannot serve the API. Verify that `https://<your-domain>/api/health` returns `{"ok":true}`.
