# ModelStack desktop — publish-ready releases

The Electron app lives in [`desktop/`](../desktop/). This doc is the checklist for **signed, notarized (macOS)** builds you can share without Gatekeeper/SmartScreen fighting your users.

## Prerequisites

1. **Apple Developer Program** membership (paid) for Mac distribution outside your own machine.
2. **Windows**: an **Authenticode** code-signing certificate (commercial CA or your org’s cert) for installers users will trust.
3. A **GitHub** repository where you can add **Actions secrets** and publish **Releases**.

## One-time: macOS Developer ID Application certificate

1. On a Mac, open **Keychain Access** → Certificate Assistant, or use the Apple Developer portal to create a **Developer ID Application** certificate.
2. Export the certificate **and private key** as **.p12** (Personal Information Exchange). Set an export password (you will use it as `MAC_CSC_KEY_PASSWORD`).
3. Base64-encode the **raw .p12 file** (not the password) for GitHub:

   ```bash
   base64 -i YourCert.p12 | pbcopy
   ```

4. Paste that string into the **`MAC_CSC_LINK`** secret (the workflow decodes it to `desktop/mac-codesign.p12`).

## One-time: Apple notarization (app-specific password)

Notarization uses Apple’s **notarytool** (Xcode 13+ on the GitHub runner).

1. Sign in to [Apple ID account](https://appleid.apple.com/) → **App-Specific Passwords** → generate a password for “ModelStack CI” (or similar).
2. In GitHub → **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|--------|--------|
| `MAC_CSC_LINK` | Base64 of your **Developer ID Application** `.p12` file |
| `MAC_CSC_KEY_PASSWORD` | Password you set when exporting the `.p12` |
| `APPLE_ID` | Your Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | The app-specific password (not your Apple ID password) |
| `APPLE_TEAM_ID` | 10-character Team ID (Membership details in [developer.apple.com](https://developer.apple.com/account)) |

**Alternative (recommended for larger teams):** use an **App Store Connect API key** with notarization. `electron-builder` also supports `APPLE_API_KEY` (path to `.p8`), `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`; wire those in CI yourself if you prefer not to use an app-specific password.

## One-time: Windows Authenticode (PFX)

1. Obtain a **code signing** certificate usable for **Authenticode** (`.pfx` including private key).
2. Base64-encode the PFX (same idea as Mac):

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.pfx")) | Set-Clipboard
   ```

3. GitHub secrets:

| Secret | Value |
|--------|--------|
| `WIN_CSC_LINK` | Base64 of the `.pfx` file |
| `WIN_CSC_KEY_PASSWORD` | PFX password |

## Version before tagging

Bump **`version`** in **both**:

- [`package.json`](../package.json) (root)
- [`desktop/package.json`](../desktop/package.json)

Keep them identical for clarity. The tag should match (e.g. version `0.1.0` → tag `v0.1.0`).

## Ship a release

```bash
git tag v0.1.0
git push origin v0.1.0
```

Workflow: [`.github/workflows/desktop-release.yml`](../.github/workflows/desktop-release.yml)

- Runs tests, builds the desktop app, **signs** artifacts, **notarizes** the macOS app, uploads to **GitHub Releases**, and attaches `electron-updater` metadata (`latest-mac.yml`, `latest.yml`, etc.) for auto-updates.

Friends should download the **DMG/ZIP (Mac)** or **NSIS installer (Windows)** from the **Releases** page, not a random zip of the repo.

## Mac-only releases (no Windows cert yet)

Edit the workflow matrix so only macOS runs:

```yaml
matrix:
  os: [macos-latest]
```

Commit that change until you have `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD`.

## Local production build (optional)

**Unsigned (no Apple cert on this Mac):** avoids auto-picking a keychain identity that may fail with hardened runtime.

```bash
pnpm install
pnpm desktop:dist:unsigned
```

Artifacts land in `desktop/release/`. Gatekeeper will still warn; use this for smoke tests only.

**Signed + notarized locally:** set `CSC_LINK` (path to your `.p12` or `data:application/x-pkcs12;base64,...`), `CSC_KEY_PASSWORD`, and `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`, then run `pnpm desktop:dist`.

On **Windows** PowerShell for unsigned builds, run `setx CSC_IDENTITY_AUTO_DISCOVERY false` once, or prefix the env var the way your shell expects before `electron-builder`.

## Config reference

- [`desktop/electron-builder.config.cjs`](../desktop/electron-builder.config.cjs) — targets, `publish` → GitHub Releases when `GITHUB_REPOSITORY` is set.
- [`desktop/buildResources/entitlements.mac.plist`](../desktop/buildResources/entitlements.mac.plist) — hardened runtime entitlements required for Electron on macOS.

## Auto-updates

The app uses **`electron-updater`**. After a release is on GitHub with the generated YAML metadata, production builds check for updates on startup. Ensure `GITHUB_REPOSITORY` matches the repo users install from (handled in CI).
