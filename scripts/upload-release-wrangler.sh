#!/bin/bash

# Build, notarize, and release desktop app
# Usage: ./scripts/upload-release-wrangler.sh
#
# Requires:
#   - Keychain profile "21st-notarize" (xcrun notarytool store-credentials)
#   - wrangler authenticated (npx wrangler login)
#   - gh CLI authenticated (gh auth login)

set -e

SCRIPT_DIR="$(dirname "$0")"
BUCKET="components-code"
PREFIX="releases/desktop"
RELEASE_DIR="$SCRIPT_DIR/../release"
PACKAGE_JSON="$SCRIPT_DIR/../package.json"
KEYCHAIN_PROFILE="21st-notarize"

# Get version from package.json
VERSION=$(node -p "require('$PACKAGE_JSON').version")
TAG="v$VERSION"

echo "============================================================"
echo "📦 Releasing Desktop v$VERSION"
echo "============================================================"
echo ""

if [ ! -d "$RELEASE_DIR" ]; then
  echo "❌ Release directory not found: $RELEASE_DIR"
  echo "   Run 'bun run build && bun run package:mac && bun run dist:manifest' first"
  exit 1
fi

cd "$RELEASE_DIR"

# ============================================================
# Part 0: Submit DMGs for notarization (async, no waiting)
# ============================================================
echo "🔏 Submitting DMGs for notarization..."
echo ""

for dmg in *.dmg; do
  if [ -f "$dmg" ]; then
    echo "   Submitting $dmg..."
    xcrun notarytool submit "$dmg" --keychain-profile "$KEYCHAIN_PROFILE"
    echo ""
  fi
done

echo "✅ Notarization submitted! Check status with:"
echo "   xcrun notarytool history --keychain-profile \"$KEYCHAIN_PROFILE\""
echo ""
echo "   After approved, staple with:"
echo "   cd release && xcrun stapler staple *.dmg"
echo ""

# ============================================================
# Part 1: Upload to R2 CDN
# ============================================================
echo "📤 Uploading to R2 CDN..."
echo ""

# Upload manifests first
echo "   Uploading manifests..."
npx wrangler r2 object put "$BUCKET/$PREFIX/latest-mac.yml" --file=latest-mac.yml --content-type="text/yaml"
npx wrangler r2 object put "$BUCKET/$PREFIX/latest-mac-x64.yml" --file=latest-mac-x64.yml --content-type="text/yaml"
echo "   ✅ Manifests uploaded"

# Upload blockmaps (for delta updates)
echo ""
echo "   Uploading blockmaps..."
for f in *.blockmap; do
  if [ -f "$f" ]; then
    npx wrangler r2 object put "$BUCKET/$PREFIX/$f" --file="$f" --content-type="application/octet-stream"
  fi
done
echo "   ✅ Blockmaps uploaded"

# Upload ZIP files (for auto-update)
echo ""
echo "   Uploading ZIP files..."
for f in *-mac.zip; do
  if [ -f "$f" ]; then
    SIZE=$(ls -lh "$f" | awk '{print $5}')
    echo "   Uploading $f ($SIZE)..."
    npx wrangler r2 object put "$BUCKET/$PREFIX/$f" --file="$f" --content-type="application/zip"
  fi
done
echo "   ✅ ZIP files uploaded"

# Upload DMG files (for manual download)
echo ""
echo "   Uploading DMG files..."
for f in *.dmg; do
  if [ -f "$f" ]; then
    SIZE=$(ls -lh "$f" | awk '{print $5}')
    echo "   Uploading $f ($SIZE)..."
    npx wrangler r2 object put "$BUCKET/$PREFIX/$f" --file="$f" --content-type="application/x-apple-diskimage"
  fi
done
echo "   ✅ DMG files uploaded"

echo ""
echo "✅ R2 CDN upload complete!"
echo ""

# ============================================================
# Part 2: Create/Update GitHub Release
# ============================================================
echo "============================================================"
echo "🐙 Creating GitHub Release $TAG..."
echo "============================================================"
echo ""

# Check if gh is installed
if ! command -v gh &> /dev/null; then
  echo "❌ GitHub CLI (gh) not found. Install it: brew install gh"
  exit 1
fi

# Check if release exists
if gh release view "$TAG" &> /dev/null; then
  echo "   Release $TAG exists, updating..."
  
  # Delete existing assets
  echo "   Deleting old assets..."
  ASSETS=$(gh release view "$TAG" --json assets -q '.assets[].name')
  for asset in $ASSETS; do
    echo "   Deleting $asset..."
    gh release delete-asset "$TAG" "$asset" --yes 2>/dev/null || true
  done
  
  # Upload new assets
  echo ""
  echo "   Uploading new assets..."
  for f in *.dmg *.zip *.blockmap; do
    if [ -f "$f" ]; then
      echo "   Uploading $f..."
      gh release upload "$TAG" "$f" --clobber
    fi
  done
  
  echo ""
  echo "   ✅ Release $TAG updated!"
else
  echo "   Creating new release $TAG..."
  
  # Collect asset files
  ASSETS=""
  for f in *.dmg *.zip *.blockmap; do
    if [ -f "$f" ]; then
      ASSETS="$ASSETS $f"
    fi
  done
  
  # Create release with assets (not draft, mark as latest)
  gh release create "$TAG" \
    --title "1Code $TAG" \
    --latest \
    --notes "## What's New

- Desktop app release $TAG

## Downloads

- **macOS ARM64 (Apple Silicon)**: Download the \`-arm64.dmg\` file
- **macOS Intel**: Download the \`-x64.dmg\` file

Auto-updates are enabled. Existing users will be notified automatically." \
    $ASSETS
  
  echo ""
  echo "   ✅ Release $TAG created!"
fi

echo ""
echo "============================================================"
echo "✅ Release complete!"
echo ""
echo "🔗 URLs:"
echo "   CDN ARM64: https://cdn.21st.dev/$PREFIX/latest-mac.yml"
echo "   CDN x64:   https://cdn.21st.dev/$PREFIX/latest-mac-x64.yml"
echo "   GitHub:    https://github.com/21st-dev/21st/releases/tag/$TAG"
echo "============================================================"
