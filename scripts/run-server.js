import { spawn } from 'child_process';
import net from 'net';
import { env } from '../src/config/env.js';

const args = process.argv.slice(2);
const isDev = args.includes('--dev');
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

    if (!response.ok) {
      return null;
    }

    const data = await response.json().catch(() => null);
    if (data?.app !== 'LifeLink') {
      return null;
    }

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

    const onClose = () => resolve(false);
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', onClose);

    socket.connect(targetPort, host);
  });
}

async function stopExistingLifeLinkProcess() {
  const health = await fetchHealth();
  if (!health?.pid) {
    return false;
  }

  console.log(`[Launcher] Found existing LifeLink server on port ${port} (pid ${health.pid}, started ${health.startedAt}). Stopping it first...`);

  try {
    process.kill(health.pid, 'SIGTERM');
  } catch (error) {
    console.warn(`[Launcher] Could not signal existing process ${health.pid}: ${error.message}`);
    return false;
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    await sleep(250);
    const stillHealthy = await fetchHealth();
    if (!stillHealthy) {
      return true;
    }
  }

  throw new Error(`Timed out waiting for previous LifeLink process ${health.pid} to stop.`);
}

async function ensurePortReady() {
  const stopped = await stopExistingLifeLinkProcess();
  if (stopped) {
    return;
  }

  const portBusy = await isPortOpen(port);
  if (!portBusy) {
    return;
  }

  throw new Error(
    `Port ${port} is already in use by another process that does not identify as LifeLink. ` +
    'Stop that listener or change PORT before starting the backend.'
  );
}

function spawnServer() {
  const command = 'cmd.exe';
  const commandArgs = ['/d', '/s', '/c', 'nodemon src/server.js'];

  const child = spawn(command, commandArgs, {
    stdio: 'inherit',
    shell: false,
    cwd: process.cwd(),
    env: process.env,
  });

  const forwardSignal = (signal) => {
    if (child.exitCode == null && child.pid) {
      child.kill(signal);
    }
  };

  ['SIGINT', 'SIGTERM', 'SIGBREAK'].forEach((signal) => {
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
