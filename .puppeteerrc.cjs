const path = require('path');

/**
 * Puppeteer configuration file.
 * Puppeteer reads this automatically at both install time and require() time.
 * Using __dirname anchors the cache inside the project root so the path is
 * identical during the Render build phase and the runtime phase.
 * Resolved path on Render: /opt/render/project/src/.cache/puppeteer
 */
module.exports = {
  cacheDirectory: path.join(__dirname, '.cache', 'puppeteer'),
};
