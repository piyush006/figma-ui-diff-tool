#!/usr/bin/env bash
set -o errexit

echo "📦 Installing dependencies..."
npm install

echo "📁 Creating Puppeteer cache dir..."
PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer
mkdir -p $PUPPETEER_CACHE_DIR

echo "🌐 Downloading Chromium for Puppeteer..."
npx puppeteer browsers install chrome

echo "📦 Caching Puppeteer Chrome binary..."
if [[ -d \"$PUPPETEER_CACHE_DIR\" ]]; then
  cp -R $PUPPETEER_CACHE_DIR /opt/render/project/src/.cache/puppeteer/chrome/
fi
