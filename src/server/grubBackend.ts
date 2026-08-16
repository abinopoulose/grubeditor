import type { IncomingMessage, ServerResponse } from 'node:http';
import { 
  handleBootEntriesGet, 
  handleGrubConfigGet, 
  handleDistroGet, 
  handleScanThemesGet, 
  handleSnapshotsGet, 
  handleSnapshotDetailsGet,
  handleSaveGrubConfigPost,
  handleSaveBootEntriesPost,
  handleRestoreSnapshotPost,
  handleTriggerRegenPost,
  handleDeployPipelinePost
} from './api/handlers';

export async function handleApiRequest(req: IncomingMessage | any, res: ServerResponse | any): Promise<boolean> {
  if (!req.url || !req.url.startsWith('/api/')) {
    return false;
  }

  res.setHeader('Content-Type', 'application/json');

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    if (req.method === 'GET') {
      if (pathname === '/api/boot-entries') return await handleBootEntriesGet(res);
      if (pathname === '/api/grub-config') return handleGrubConfigGet(res);
      if (pathname === '/api/distro') return handleDistroGet(res);
      if (pathname === '/api/scan-themes') return handleScanThemesGet(res);
      if (pathname === '/api/snapshots') return handleSnapshotsGet(res);
      if (pathname === '/api/snapshot-details') return handleSnapshotDetailsGet(req, res);
    }

    if (req.method === 'POST') {
      let body = "";
      req.on('data', (chunk: any) => { body += chunk; });
      await new Promise<void>((resolve) => {
        req.on('end', async () => {
          try {
            const data = body ? JSON.parse(body) : {};
            
            if (pathname === '/api/save-grub-config') {
              await handleSaveGrubConfigPost(data, res);
            } else if (pathname === '/api/save-boot-entries') {
              await handleSaveBootEntriesPost(data, res);
            } else if (pathname === '/api/restore-snapshot') {
              await handleRestoreSnapshotPost(data, res);
            } else if (pathname === '/api/trigger-regen') {
              await handleTriggerRegenPost(res);
            } else if (pathname === '/api/deploy-pipeline') {
              await handleDeployPipelinePost(data, res);
            } else {
              res.end(JSON.stringify({ success: true }));
            }
            resolve();
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
            resolve();
          }
        });
      });
      return true;
    }

    return false;
  } catch (err: any) {
    console.error("GrubBackend error:", err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
    return true;
  }
}
