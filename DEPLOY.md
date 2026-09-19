# Deploying CiteScape

CiteScape deploys to Firebase Hosting on the free Spark plan — a static
site, no Cloud Functions or Cloud Storage involved. Deploys are run from
your own computer, since Claude has no access to your Firebase account.

## One-time setup

```bash
npm install          # installs firebase-tools locally (no global install)
npx firebase login   # opens a browser to sign in to your Firebase account
```

`.firebaserc` already points at the `citescape-8407b` project, so you
shouldn't need `firebase use`.

If you want sign-in/Save project to work in production, create
`.env.local` (gitignored) from `.env.example` and fill in your Firebase
project's Web App config before building. Leaving it unset is fine too —
the build never fails without it, it just serves the app with saving
disabled (a small "Saving isn't configured" note replaces the sign-in UI).

## Deploy hosting (the app)

```bash
npm run deploy
```

This builds (`npm run build`) and runs `firebase deploy --only hosting`.
It serves `dist/`, rewrites every route to `/index.html` (single-page app),
caches hashed files under `/assets/` for a year, and serves `index.html`
with `Cache-Control: no-cache` so visitors always get the latest build.

## Deploy Firestore security rules

Only needed when `firestore.rules` changes — hosting deploys don't touch it.

```bash
npm run deploy:rules
```

## Everyday commands, spelled out

| Script                | What it runs                                          |
| ---------------------- | ------------------------------------------------------ |
| `npm run deploy`       | `npm run build && npx firebase deploy --only hosting`  |
| `npm run deploy:rules` | `npx firebase deploy --only firestore:rules`           |

Both use the `firebase-tools` already in `devDependencies` via `npx` — no
global `firebase-tools` install needed.
