// Vercel serverless entry point — re-exports the Express app from server.js
const app = require('../server');
module.exports = app;
