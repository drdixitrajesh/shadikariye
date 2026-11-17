# Vedik Milan Android app

Android package: `org.softinator.vedikmilan`, version 1.0.0 (1), Android 8.0+.

This is a Trusted Web Activity powered by Google's Android Browser Helper 2.7.4. It opens only the existing HTTPS website as the app's default origin. The installed browser handles authentication, file upload, PDF downloads, sharing and external links. It requires internet and a compatible, up-to-date browser; a Custom Tab is the fallback when fullscreen verification/browser support is unavailable. It has no custom JavaScript bridge, embedded login form, analytics SDK or local profile database.

The site's `/.well-known/assetlinks.json` binds this package to the release certificate. The release keystore must be retained for all future updates. It is kept outside the repository under the current Windows user's Codex integration directory; its password is protected by Windows DPAPI. Do not put signing keys or passwords in Git, downloadable ZIP files or the public website. A future Google Play App Signing certificate must also be added to assetlinks if Play publishing is chosen.

## Build

Requires JDK 21, Gradle 8.13, Android platform 36 and build tools 36.0.0. SDK/tool downloads are local, under ignored `work/android-tools/`. On this workstation, run `./mobile/build-android.ps1` from PowerShell. The script reads the protected signing password without printing it and builds the signed APK, Android App Bundle and lint report. The checked-in Gradle wrapper also works with standard `JAVA_HOME` and `ANDROID_HOME` plus `VEDIK_KEYSTORE` and `VEDIK_STORE_PASSWORD` environment variables supplied securely by the owner.

Release outputs are under `android/app/build/outputs/`. The APK can be installed directly. The AAB is a publishing artifact, not directly installable. Play Store submission, store account setup and physical-device validation are separate from the build. Preserve the package name, increment versionCode on updates and sign with the same key.

## Validation

Run Android lint, `apksigner verify --verbose --print-certs`, `zipalign -c -P 16 -v 4`, and compare the signing certificate SHA-256 to the live assetlinks. Confirm the live association returns JSON without sign-in/redirect. Verify the manifest uses HTTPS, disables cleartext traffic and backup, and exposes only the intended launch/deep-link activity. Test login, photo selection, PDF download/share and back navigation on a real Android phone before a wider release. Compilation and signature checks do not establish these device flows.

References: https://github.com/GoogleChrome/android-browser-helper and https://developer.chrome.com/docs/android/trusted-web-activity/
