#!/bin/bash
set -e

TEAM_ID="${TEAM_ID:-KAW522XXT3}"
CONFIGURATION="${CONFIGURATION:-Release}"

cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

echo "▶ Project root: $PROJECT_ROOT"
echo "▶ Team: $TEAM_ID | Config: $CONFIGURATION"
echo ""

echo "▶ [1/3] React Native codegen"
node node_modules/react-native/scripts/generate-codegen-artifacts.js \
  -p . -t ios -o ios > /tmp/mp3-codegen.log 2>&1 || {
    echo "✗ Codegen failed (see /tmp/mp3-codegen.log):"
    tail -20 /tmp/mp3-codegen.log
    exit 1
  }
echo "✓ Codegen done"
echo ""

echo "▶ [2/3] xcodebuild (5-10 min on first run)"
cd ios
xcodebuild \
  -workspace MP3Player.xcworkspace \
  -scheme MP3Player \
  -configuration "$CONFIGURATION" \
  -destination 'generic/platform=iOS' \
  -sdk iphoneos \
  -derivedDataPath ./build \
  -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  build > /tmp/mp3-xcodebuild.log 2>&1 || {
    echo "✗ Build failed (see /tmp/mp3-xcodebuild.log):"
    tail -50 /tmp/mp3-xcodebuild.log
    exit 1
  }
echo "✓ Build done"
echo ""

APP_DIR="ios/build/Build/Products/$CONFIGURATION-iphoneos"
APP_PATH="$PROJECT_ROOT/$APP_DIR/MP3Player.app"
IPA_NAME="MP3Player.ipa"
IPA_PATH="$PROJECT_ROOT/$IPA_NAME"

if [ ! -d "$APP_PATH" ]; then
  echo "✗ .app not found at $APP_PATH"
  exit 1
fi

echo "▶ [3/3] Package .ipa"
STAGING="$(mktemp -d)"
mkdir "$STAGING/Payload"
cp -R "$APP_PATH" "$STAGING/Payload/"
( cd "$STAGING" && zip -qr "$IPA_NAME" Payload )
mv "$STAGING/$IPA_NAME" "$IPA_PATH"
rm -rf "$STAGING"

SIZE=$(ls -lh "$IPA_PATH" | awk '{print $5}')
echo ""
echo "✓ Done"
echo "  IPA:  $IPA_PATH"
echo "  Size: $SIZE"
echo "  Team: $TEAM_ID"
echo ""
echo "Install: Xcode → Window → Devices and Simulators → drag .ipa to your iPhone"
echo "Trust:   iPhone → Settings → General → VPN & Device Management → trust your developer cert"
echo "Note:    Free personal signing expires in 7 days. Re-run this script (or Cmd+R in Xcode) to refresh."
