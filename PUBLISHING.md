# Publishing `@0xpdf/client`

## CI (recommended)

1. Sign in at [npmjs.com](https://www.npmjs.com/) as the **0xpdf** org owner.
2. Create a **Granular Access Token** with **Read and write** on the **0xpdf** org (or all packages).
3. Update the GitHub secret:
   ```bash
   gh secret set NPM_TOKEN --repo risha-max/oxpdf-js
   ```
4. Push a version tag or run **Actions → Publish @0xpdf/client → Run workflow**.

The workflow publishes `@0xpdf/client` and deprecates legacy `oxpdf`.

## Manual publish

```bash
npm login   # as 0xpdf org owner
npm install
npm run build
npm publish --access public
npm deprecate oxpdf@* "Use @0xpdf/client instead — https://www.npmjs.com/package/@0xpdf/client"
```

If you see `404` on `PUT @0xpdf/client`, the token user cannot create packages under the `@0xpdf` scope — use the org owner's token.
