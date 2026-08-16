import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

const LOG_PREFIX = '[GrubEditor API]';
export function log(stage: string, ...args: any[]) {
  console.log(`${LOG_PREFIX} [${stage}]`, ...args);
}
export function logError(stage: string, ...args: any[]) {
  console.error(`${LOG_PREFIX} [${stage}] ERROR:`, ...args);
}

export const fileCache: Record<string, { timestamp: number; data: string }> = {};

export function readProtectedFile(filepath: string, cacheTime = 5000): string {
  const now = Date.now();
  if (fileCache[filepath] && (now - fileCache[filepath].timestamp) < cacheTime) {
    return fileCache[filepath].data;
  }
  let content = "";
  try {
    content = fs.readFileSync(filepath, 'utf8');
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      throw new Error(`File not found: ${filepath}`);
    }
    // Only escalate to pkexec if we actually got a permission error
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      try {
        content = execSync(`pkexec /usr/bin/grub-editor-helper cat "${filepath}"`, { encoding: 'utf8' });
      } catch (e: any) {
        throw new Error(`File not found or unreadable via pkexec: ${filepath}`);
      }
    } else {
      throw err;
    }
  }
  fileCache[filepath] = { data: content, timestamp: now };
  return content;
}

export function writeProtectedFile(filepath: string, content: string): void {
  try {
    fs.writeFileSync(filepath, content, 'utf8');
  } catch {
    const tmpPath = path.join(os.tmpdir(), `grub-write-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
    fs.writeFileSync(tmpPath, content, 'utf8');
    try {
      execSync(`pkexec /usr/bin/grub-editor-helper sh -c "cp '${tmpPath}' '${filepath}' && chmod 0644 '${filepath}'"`, { stdio: 'ignore' });
    } catch (err: any) {
      console.error(`Failed to write ${filepath} via pkexec:`, err.message);
      throw new Error(`Cannot write to ${filepath}: permission denied or authentication dismissed.`);
    } finally {
      if (fs.existsSync(tmpPath)) try { fs.unlinkSync(tmpPath); } catch {}
    }
  }
  delete fileCache[filepath];
}
