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
  village, LGD villages, hamlets and towns (with PIN) are suggested (`GET /api/address/villages`). Picking one offers
  sub-district, block, district and state from LGD, and post office and police station that other
  operators saved (`POST /api/address/resolve`), as ticked rows confirmed before saving. Values that
  differ from the profile are ticked and shown as replacing it; only learned values still in doubt
  start unticked. Test: `e2e/village-field.spec.ts`. Contract: `docs/contracts/address-api.md`.
