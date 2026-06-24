# Publishing `@0xpdf/client`

## Release (CI)

1. Bump `version` in `package.json` and commit to `main`.
2. Tag and push (tag must match `package.json` version):
   ```bash
   git tag v0.1.5
   git push origin v0.1.5
   ```
3. GitHub Actions publishes to npm. Re-running the workflow or re-pushing the same tag is **safe** — if that version is already on npm, the job exits successfully without republishing.

Manual fallback: **Actions → Publish @0xpdf/client → Run workflow** (same idempotent behavior).

## npm token for CI

1. Sign in at [npmjs.com](https://www.npmjs.com/) as the **0xpdf** org owner.
2. Create a **Granular Access Token** with:
   - **Read and write** on the **0xpdf** org (or all packages)
   - **Bypass two-factor authentication for automation** enabled
3. Update the GitHub secret:
   ```bash
   gh secret set NPM_TOKEN --repo risha-max/oxpdf-js
   ```

## Manual publish

```bash
npm login   # as 0xpdf org owner
npm install
npm run build
npm publish --access public --otp=123456   # if 2FA required
npm deprecate oxpdf@* "Use @0xpdf/client instead — https://www.npmjs.com/package/@0xpdf/client"
```

## Troubleshooting

| Error | Fix |
|-------|-----|
| `404` on `PUT @0xpdf/client` | Token user cannot publish under `@0xpdf` — use org owner token |
| `403` bypass 2FA required | Create granular token with automation / bypass 2FA |
| `403` version already published | Bump `package.json` version before tagging; re-runs of an existing version are now skipped in CI |
