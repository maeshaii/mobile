// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure vector icons fonts are properly resolved
config.resolver.assetExts.push(
  // Fonts
  'ttf',
  'otf',
  'woff',
  'woff2'
);

// Ensure proper source extensions
config.resolver.sourceExts.push('mjs', 'cjs');

module.exports = config;

