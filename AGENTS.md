# frontend

Operator web app (cafe UI), landing site, and the in-app file viewer/print tools.

This repository is one department of the CyberControl system. It contains only the code for this department. Other parts of the system are not available here by design.

## Packages

| Path | Package | Purpose |
|------|---------|---------|
| `apps/frontend` | `cybercontrol-frontend` |  |
| `apps/landing` | `vite_react_shadcn_ts` |  |
| `packages/media-tools` | `@cybercontrol/media-tools` | Photos desk: Photo Editor, Print Doc, PDF Tools, scan, and Aadhaar layout |
| `packages/media-viewer` | `@cybercontrol/media-viewer` | Photos-style media viewer overlay (images + Mozilla PDF.js) for Hub File Manager and WhatsApp Documents |

Each package has a `README.md` with its dependencies, entry points and rules. Read it before editing the package.


## Working rules

These apply to every developer and every AI agent working in this repo.

### Read before you edit
1. Read this file, then the `README.md` of the package you are changing. Do not read other packages unless a contract below requires it.
2. Before using a function, type or file you have not seen, look it up. Do not guess names or signatures.

### Definition of done
A change is not finished until its documentation is updated in the same change:

| You changed | Update |
|-------------|--------|
| Public exports, scripts or behaviour of a package | that package's `README.md` ("Purpose and rules" section; the generated block refreshes itself) |
| A contract with another department (HTTP, WSS, shared types) | `docs/contracts/` and the README of the package that owns the contract |
| Added or removed a package | the package table in this file (`node tooling/departments/readmes.mjs`) |
| A table you own (new table, column or index) | a new migration file in your repo, never an edit to an applied one |
| A decision future developers would ask "why" about | a short note in `docs/decisions/` |
| Work you could not finish | `docs/handoff/<issue-number>.md`: done, left, branch, gotchas |

CI fails a pull request that changes a package's `src/` or `package.json` without touching its `README.md`. If the change truly has no documentation impact, put `no-doc-impact: <reason>` in the pull request description.

### Boundaries
- Stay inside this repo. Never import from, copy from, or describe code of another department. If you need something from them, open an issue describing the contract you need.
- Do not edit the generated block of a README by hand. Edit the text outside it.
- The browser extension observes and acts. Planning, mapping, knowledge and learning live on the server.

### How your changes reach production
- This repo is a copy of part of a private repository. `main` is written only by the sync bot; do not push to it.
- Work on a branch and open a pull request against `main`. When it is ready, add the `import` label. The sync bot copies the files you changed inside your own packages into a pull request in the private repository, where it is reviewed.
- Do not merge your pull request here. After the private pull request is merged, the change comes back to `main` with the next sync and you can close yours.
- Only files inside this department's packages are imported. Changes to generated files (`AGENTS.md`, the root `README.md`, `db/`, CI, root config) are ignored, so ask for those in the pull request description.

### Database
- Each department has its own PostgreSQL database (see the Database section of this file). Create or alter only tables listed as yours.
- Tables of other departments live in their databases. Their definitions are in `db/shared-schema/` only so you can run locally. Never edit those files, and do not expect to join across databases. Read or write another department's table only if the Database section grants that access.
- Need data or a column from another department? Open an issue with the contract you need.

### Safety
- Never commit secrets, `.env` files, customer data, or identity numbers (Aadhaar, PAN, phone). Use `.env.example` for names only.
- Never put customer data in logs, docs, handoff notes or test fixtures.
- Do not run destructive commands (force push, hard reset, dropping data) without being asked.

### Keep context small
- Prefer a symbol search or a README over reading whole files.
- Summarise long tool output instead of pasting it into notes.
