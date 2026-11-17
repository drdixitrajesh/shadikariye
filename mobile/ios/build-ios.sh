#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Build requires macOS with Xcode. This source package is not an installable IPA." >&2
  exit 1
fi
xcodebuild -version
case "${1:-simulator}" in
  simulator)
    xcodebuild -project VedikMilan.xcodeproj -scheme VedikMilan -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO build
    ;;
  archive)
    : "${DEVELOPMENT_TEAM:?Set DEVELOPMENT_TEAM to your Apple signing team ID}"
    xcodebuild -project VedikMilan.xcodeproj -scheme VedikMilan -configuration Release -destination 'generic/platform=iOS' -archivePath build/VedikMilan.xcarchive DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM" archive
    echo "Archive created. Use Xcode Organizer to validate and distribute with your Apple account."
    ;;
  *) echo 'Usage: bash build-ios.sh [simulator|archive]' >&2; exit 1 ;;
esac
