# Linden Windows Gecko build

This folder starts the reproducible Firefox-source build track.

## Important branding/licensing choice

The initial build configuration intentionally uses Mozilla's **unbranded** Firefox browser build. Do not enable official Firefox branding or redistribute Mozilla trademarks as if Linden were an official Mozilla product. Linden's own gold-drop identity and distribution defaults will be layered on top.

## Prepare

1. Read Mozilla's current Windows build prerequisites: https://firefox-source-docs.mozilla.org/setup/windows_build.html
2. Install MozillaBuild and the required Windows build tools exactly as Mozilla documents.
3. Open the MozillaBuild shell (not a regular PowerShell window for the actual build).
4. Run the preparation script from PowerShell after Mercurial is available:

   powershell -ExecutionPolicy Bypass -File firefox/build/prepare-source.ps1

   Or clone mozilla-central manually and copy mozconfig.win to the source root as .mozconfig.
5. In the MozillaBuild shell, enter the source checkout and run:

   ./mach build

The first build downloads and compiles a large toolchain and source tree. Do not expect a quick npm-style build.

## Next packaging milestone

The current branch has not yet produced a Linden executable or installer. Before calling it a browser distribution, we must:
- package the signed Linden Start extension into Firefox's distribution/extensions directory;
- install the distribution preferences and test the profile defaults;
- apply and verify browser chrome styling on the exact Firefox revision;
- build and test a Windows installer, upgrade path and clean uninstall;
- validate news source availability, extension permissions and startup performance.

No existing Firefox installation or user profile is modified by the preparation script.
