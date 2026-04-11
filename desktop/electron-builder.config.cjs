/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration
 */
const repo = process.env.GITHUB_REPOSITORY;
const [owner, repoName] = repo ? repo.split("/") : [undefined, undefined];

// GitHub-hosted macOS runners are Apple Silicon; building/signing x64 there is slow and has hung for some setups.
// Local `desktop:dist` still produces both architectures.
const macArchitectures = process.env.CI === "true" ? ["arm64"] : ["x64", "arm64"];

module.exports = {
  appId: "com.modelstack.app",
  productName: "ModelStack",
  copyright: "Copyright © ModelStack contributors",
  directories: {
    output: "release",
    buildResources: "buildResources",
  },
  files: ["out/**/*", "package.json"],
  asar: true,
  mac: {
    category: "public.app-category.developer-tools",
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "buildResources/entitlements.mac.plist",
    entitlementsInherit: "buildResources/entitlements.mac.inherit.plist",
    target: [
      { target: "dmg", arch: macArchitectures },
      { target: "zip", arch: macArchitectures },
    ],
  },
  win: {
    target: [{ target: "nsis", arch: ["x64"] }],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    perMachine: false,
  },
  publish:
    owner && repoName
      ? {
          provider: "github",
          owner,
          repo: repoName,
        }
      : undefined,
};
