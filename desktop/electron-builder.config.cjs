/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration
 */
const repo = process.env.GITHUB_REPOSITORY;
const [owner, repoName] = repo ? repo.split("/") : [undefined, undefined];

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
      { target: "dmg", arch: ["x64", "arm64"] },
      { target: "zip", arch: ["x64", "arm64"] },
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
