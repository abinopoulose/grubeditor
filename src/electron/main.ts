import { app, BrowserWindow, Menu } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as http from 'node:http';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from '../server/grubBackend';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ubuntu 24.04+ and many modern Linux distributions restrict unprivileged user namespaces.
// Disable Chromium sandbox requirement programmatically so Electron launches cleanly without requiring setuid chrome-sandbox binary.
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');

function createWindow() {
  const preloadPath = fs.existsSync(path.join(__dirname, 'preload.mjs'))
    ? path.join(__dirname, 'preload.mjs')
    : path.join(__dirname, 'preload.js');

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 768,
    title: "GrubEditor - Pro Bootloader Studio",
    backgroundColor: "#050811",
    icon: path.join(__dirname, '../public/app_logo.png'),
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.setMenuBarVisibility(false);
  Menu.setApplicationMenu(null);

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer Console] [level ${level}] ${message} (${sourceId}:${line})`);
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Renderer Fail Load] (${errorCode}) ${errorDescription} - ${validatedURL}`);
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[Renderer Process Gone] ${details.reason} - exitCode: ${details.exitCode}`);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // Start loopback HTTP server for production static assets and live system API
    const distDir = path.join(__dirname, '../dist');
    const server = http.createServer(async (req, res) => {
      try {
        const handled = await handleApiRequest(req, res);
        if (!handled) {
          const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
          let filePath = path.join(distDir, url.pathname === '/' ? 'index.html' : url.pathname);
          if (!fs.existsSync(filePath)) {
            filePath = path.join(distDir, 'index.html');
          }
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.mjs': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
          };
          const contentType = mimeTypes[ext] || 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': contentType });
          fs.createReadStream(filePath).pipe(res);
        }
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
      }
    });

    const bindAndLoad = (port: number) => {
      server.listen(port, '127.0.0.1', () => {
        const activePort = (server.address() as any).port;
        win.loadURL(`http://127.0.0.1:${activePort}`);
      });
    };

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn('Port 31415 occupied, retrying with ephemeral loopback port...');
        server.close();
        bindAndLoad(0);
      }
    });

    bindAndLoad(31415);

    win.on('closed', () => {
      try { server.close(); } catch {}
    });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
