import { spawn } from 'child_process';
import net from 'net';

const { validateEnv } = await import('../src/config/env.js');
const env = validateEnv();

const args = process.argv.slice(2);
const isDev = args.includes('--dev');

// ✅ Production: skip launcher completely
if (env.NODE_ENV === 'production' && !isDev) {
  console.log('[Launcher] Production mode → starting server directly...');
  await import('../src/server.js');

  // ❌ DO NOT EXIT
  // process.exit(0); ← كان بيموت السيرفر
} else {
  const port = env.PORT;
  const host = '127.0.0.1';
  const healthUrl = `http://${host}:${port}/health`;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function fetchHealth() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);

      const response = await fetch(healthUrl, { signal: controller.signal });
      clearTimeout(timer);

      if (!response.ok) return null;

      const data = await response.json().catch(() => null);
      if (data?.app !== 'LifeLink') return null;

      return data;
    } catch {
      return null;
    }
  }

  async function isPortOpen(targetPort) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(1000);

      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.once('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.once('error', () => resolve(false));

      socket.connect(targetPort, host);
    });
  }

  async function stopExistingLifeLinkProcess() {
    const health = await fetchHealth();
    if (!health?.pid) return false;

    console.log(
      `[Launcher] Found existing LifeLink server on port ${port} (pid ${health.pid}). Stopping it...`
    );

    try {
      process.kill(health.pid, 'SIGTERM');
    } catch (error) {
      console.warn(`[Launcher] Could not stop process ${health.pid}: ${error.message}`);
      return false;
    }

    for (let attempt = 0; attempt < 30; attempt++) {
      await sleep(250);
      if (!(await fetchHealth())) return true;
    }

    throw new Error(`Timeout waiting for process ${health.pid} to stop.`);
  }

  async function ensurePortReady() {
    const stopped = await stopExistingLifeLinkProcess();
    if (stopped) return;

    const portBusy = await isPortOpen(port);
    if (!portBusy) return;

    throw new Error(`Port ${port} is already in use. Stop it or change PORT.`);
  }

  function spawnServer() {
    const child = spawn('npx', ['--yes', 'nodemon', 'src/server.js'], {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd(),
      env: process.env,
    });

    const forwardSignal = (signal) => {
      if (child.exitCode == null && child.pid) {
        child.kill(signal);
      }
    };

    ['SIGINT', 'SIGTERM'].forEach((signal) => {
      process.on(signal, () => forwardSignal(signal));
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exit(code ?? 0);
    });
  }

  try {
    await ensurePortReady();

    if (isDev) {
      spawnServer();
    } else {
      await import('../src/server.js');
    }
  } catch (error) {
    console.error(`[Launcher] ${error.message}`);
    process.exit(1);
  }
}