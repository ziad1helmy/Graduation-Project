import express from 'express';

const app = express();
const PORT = 5000;

const server = app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server started on port ${PORT}`);
});

server.on('error', (error) => {
  console.error(`[${new Date().toISOString()}] ERROR: ${error.code || error.message}`);
  process.exit(1);
});

// Keep alive for 3 seconds
setTimeout(() => {
  console.log(`[${new Date().toISOString()}] Closing server`);
  server.close(() => process.exit(0));
}, 3000);
