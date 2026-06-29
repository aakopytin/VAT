// НДС widget entry point
const fs   = require('fs');
const path = require('path');
 
const HTML = fs.readFileSync(path.join(__dirname, 'nds.html'), 'utf8');
 
module.exports = function handler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');
  res.end(HTML);
};
