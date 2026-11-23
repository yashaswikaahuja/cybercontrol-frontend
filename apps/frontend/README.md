# cybercontrol-frontend



<!-- generated:start (tooling/departments/readmes.mjs, do not edit by hand) -->
- **Package:** `cybercontrol-frontend` (app)
- **Department:** frontend
- **Depends on:** `packages/media-tools`, `packages/media-viewer`
- **Used by:** nothing in this repo
- **Scripts:** `dev`, `build`, `typecheck`, `test`
- **Source folders:** `src/features/`, `src/lib/`, `src/shared/`
<!-- generated:end -->

## Purpose and rules

Only parts documented so far:

- **Profile village field** (`src/features/customers/village-field/`): while the operator types a
  village, LGD villages and hamlets are suggested (`GET /api/address/villages`). Picking one offers
  sub-district, block, district and state from LGD, and post office and police station that other
  operators saved (`POST /api/address/resolve`), as ticked rows confirmed before saving. Rows that
  differ from the profile or need checking start unticked. Contract: `docs/contracts/address-api.md`.
