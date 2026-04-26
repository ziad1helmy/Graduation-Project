import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runScript = (scriptName) => {
  return new Promise((resolve, reject) => {
    console.log(`\n=== Running ${scriptName} ===`);
    const proc = spawn('node', [path.join(__dirname, scriptName)], {
      stdio: 'inherit',
      env: process.env
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${scriptName} failed with exit code ${code}`));
      }
    });
  });
};

const runSmoke = async () => {
  try {
    // 1. Auth E2E Flow (which also checks /health)
    await runScript('auth-e2e.js');
    
    // 2. FCM Lifecycle & Seeded Login
    await runScript('fcm-e2e.js');
    
    console.log('\n✅ All smoke tests passed successfully!');
    console.log('Backend is stable and demo-ready.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Smoke tests failed:', error.message);
    process.exit(1);
  }
};

runSmoke();
