# In your root directory (same level as package.json), create this file:

// puppeteer.config.cjs
const { join } = require('path');

/** @type {import('puppeteer').Configuration} */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer')
};
