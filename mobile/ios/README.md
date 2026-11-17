# Vedik Milan iPhone project

Status: source project prepared on Windows. NOT compiled, simulator-tested, signed, exported as an IPA or submitted to App Store. Requires macOS and Xcode for the next stage. Do not describe this ZIP as an installable iPhone app.

Open `VedikMilan.xcodeproj` in Xcode 15 or later with the iOS SDK. Target: iPhone, iOS 16+, bundle ID `org.softinator.vedikmilan.ios`, version 1.0.0. Choose your own signing team in Signing & Capabilities. Credentials, certificates and provisioning profiles are intentionally absent. A personal Apple Account can support development-device testing subject to Apple's limits; TestFlight/App Store distribution requires the appropriate Developer Program membership and review.

The native SwiftUI launcher contains shortcuts for discovery, profile creation, Kundali matching and account access, plus a coordinator telephone link and the iOS share sheet for the public website URL. Pages open in Apple's SFSafariViewController. There is no custom JavaScript bridge, third-party analytics SDK, local profile database, cleartext exception or embedded password handler. Website authentication is managed by the Safari view and may require signing in separately from the standalone Safari app. Existing site permissions and admin approval remain in force.

If PDF download/sharing needs a full Safari session, use the visible Safari option. Verify photo upload, mobile login, CAPTCHA, PDF download, PDF sharing to WhatsApp, back/close navigation, network loss, Hindi text, Dynamic Type, dark mode and rotation on simulator and a physical iPhone before release. Do not claim these device flows are verified yet.

## Build on Mac

1. Open the project in Xcode, select the VedikMilan scheme and an iPhone simulator. Run once, resolve any compiler or SDK issues, then test the flows above.
2. Command line: `bash build-ios.sh simulator` creates an unsigned simulator build. It is not installable on an iPhone.
3. Select a signing team and connected iPhone to run a development build. For an archive, set `DEVELOPMENT_TEAM` securely and run `bash build-ios.sh archive`.
4. Use Xcode Organizer to validate and distribute. Confirm bundle ID ownership, privacy disclosures and App Store requirements in the actual Apple account. Apple review may require additional native functionality; source preparation does not imply approval. There is no App Store listing or TestFlight link yet.

For immediate use without signing, open https://vedik-milan.softinator.org/iphone-app in iPhone Safari and follow Add to Home Screen. That is the separate web-app installation option, not this native project.

Official references:
- https://developer.apple.com/documentation/safariservices/sfsafariviewcontroller
- https://developer.apple.com/help/account/basics/about-your-developer-account
- https://developer.apple.com/app-store/review/guidelines/
