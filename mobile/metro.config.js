// The app runs the website's own pricing engine and price sheet
// (../assets/js/calc.js + data/plans.js) instead of a copy, so the two can't
// drift. It's imported as `eutility-web/<file>`; types are in src/engine/website.d.ts.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const websiteJs = path.resolve(__dirname, '../assets/js');
const config = getDefaultConfig(__dirname);
config.watchFolders = [websiteJs];
config.resolver.extraNodeModules = { 'eutility-web': websiteJs };

module.exports = config;
