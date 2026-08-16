var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { log, logError, readProtectedFile, writeProtectedFile, fileCache } from '../utils/fileOps';
import { createServerSnapshot, getSnapshotsDir } from '../utils/snapshots';
import { sendJsonResponse, sendErrorResponse } from '../utils/apiUtils';
import { detectDistro, scanGrubThemes, parseDefaultGrubConfig } from '../services/systemService';
import { executeDeployPipeline } from '../services/deployService';
import { parseGrubCfg, getOverridesPath, getSavedOverrides, mergeEntriesWithOverrides, applyOverridesToGrubCfg } from '../parsers/grubParser';
export function handleBootEntriesGet(res) {
    return __awaiter(this, void 0, void 0, function () {
        var files, blsEntries_1, activeKernel_1, overrides_1, merged_1, content, needsPkexec, tmpPath, entries, overrides, merged;
        return __generator(this, function (_a) {
            log('GET /api/boot-entries', 'Fetching boot entries...');
            if (fs.existsSync('/boot/loader/entries')) {
                try {
                    files = fs.readdirSync('/boot/loader/entries').filter(function (f) { return f.endsWith('.conf') || f.endsWith('.mgnix'); });
                    if (files.length > 0) {
                        log('GET /api/boot-entries', "Found ".concat(files.length, " BLS entry files"));
                        blsEntries_1 = [];
                        activeKernel_1 = os.release().trim();
                        files.sort().forEach(function (file, idx) {
                            var content = fs.readFileSync(path.join('/boot/loader/entries', file), 'utf8');
                            var title = file;
                            var version = "";
                            var args = "";
                            content.split('\n').forEach(function (line) {
                                var l = line.trim();
                                if (l.startsWith('title '))
                                    title = l.substring(6).trim();
                                else if (l.startsWith('version '))
                                    version = l.substring(8).trim();
                                else if (l.startsWith('options '))
                                    args = l.substring(8).trim();
                            });
                            var isCurrent = version.includes(activeKernel_1) || title.includes(activeKernel_1);
                            blsEntries_1.push({
                                id: file.replace(/\.[^/.]+$/, ""),
                                title: title,
                                type: title.toLowerCase().includes('recovery') || title.toLowerCase().includes('rescue') ? 'recovery' : 'linux',
                                enabled: true,
                                order: idx,
                                args: args || undefined,
                                version: version || undefined,
                                isCurrent: isCurrent,
                                is_current: isCurrent,
                                is_default: idx === 0,
                            });
                        });
                        overrides_1 = getSavedOverrides();
                        log('GET /api/boot-entries', "Loaded ".concat(overrides_1.length, " saved overrides from ").concat(getOverridesPath()));
                        merged_1 = mergeEntriesWithOverrides(blsEntries_1, overrides_1);
                        log('GET /api/boot-entries', "Returning ".concat(merged_1.length, " entries"));
                        sendJsonResponse(res, merged_1);
                        return [2 /*return*/, true];
                    }
                }
                catch (e) {
                    logError('GET /api/boot-entries', 'BLS directory read error, falling back to grub.cfg:', e);
                }
            }
            log('GET /api/boot-entries', "Reading grub.cfg...");
            content = "";
            needsPkexec = false;
            try {
                content = fs.readFileSync('/boot/grub2/grub.cfg', 'utf8');
            }
            catch (e1) {
                if (e1.code === 'EACCES' || e1.code === 'EPERM')
                    needsPkexec = true;
                try {
                    content = fs.readFileSync('/boot/grub/grub.cfg', 'utf8');
                }
                catch (e2) {
                    if (e2.code === 'EACCES' || e2.code === 'EPERM')
                        needsPkexec = true;
                    if (needsPkexec) {
                        tmpPath = "/tmp/grub-editor-read-".concat(Date.now());
                        try {
                            execSync("pkexec /usr/bin/grub-editor-helper sh -c \"if [ -f /boot/grub2/grub.cfg ]; then cat /boot/grub2/grub.cfg > ".concat(tmpPath, "; elif [ -f /boot/grub/grub.cfg ]; then cat /boot/grub/grub.cfg > ").concat(tmpPath, "; fi; chmod 666 ").concat(tmpPath, "\""));
                            if (fs.existsSync(tmpPath)) {
                                content = fs.readFileSync(tmpPath, 'utf8');
                            }
                        }
                        catch (e) {
                            logError('GET /api/boot-entries', 'Failed to read grub.cfg via pkexec:', e.message);
                        }
                        finally {
                            if (fs.existsSync(tmpPath))
                                try {
                                    fs.unlinkSync(tmpPath);
                                }
                                catch (_b) { }
                        }
                    }
                }
            }
            entries = parseGrubCfg(content);
            log('GET /api/boot-entries', "Parsed ".concat(entries.length, " menuentry blocks from grub.cfg"));
            overrides = getSavedOverrides();
            log('GET /api/boot-entries', "Loaded ".concat(overrides.length, " saved overrides from ").concat(getOverridesPath()));
            merged = mergeEntriesWithOverrides(entries, overrides);
            log('GET /api/boot-entries', "Returning ".concat(merged.length, " entries"));
            sendJsonResponse(res, merged);
            return [2 /*return*/, true];
        });
    });
}
export function handleGrubConfigGet(res) {
    var map = parseDefaultGrubConfig();
    sendJsonResponse(res, map);
    return true;
}
export function handleDistroGet(res) {
    var distroInfo = detectDistro();
    sendJsonResponse(res, distroInfo);
    return true;
}
export function handleScanThemesGet(res) {
    var themes = scanGrubThemes();
    sendJsonResponse(res, themes);
    return true;
}
export function handleSnapshotsGet(res) {
    log('GET /api/snapshots', 'Fetching recovery snapshots...');
    var snapDir = getSnapshotsDir();
    var snapshots = [];
    if (fs.existsSync(snapDir)) {
        try {
            var subdirs = fs.readdirSync(snapDir);
            for (var _i = 0, subdirs_1 = subdirs; _i < subdirs_1.length; _i++) {
                var folder = subdirs_1[_i];
                var metaPath = path.join(snapDir, folder, 'snapshot_metadata.json');
                if (fs.existsSync(metaPath)) {
                    try {
                        var content = readProtectedFile(metaPath);
                        var data = JSON.parse(content);
                        snapshots.push(data);
                    }
                    catch (err) { }
                }
            }
            snapshots.sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
        }
        catch (e) {
            logError('GET /api/snapshots', 'Failed reading snapshot directories:', e);
        }
    }
    log('GET /api/snapshots', "Returning ".concat(snapshots.length, " snapshots"));
    sendJsonResponse(res, snapshots);
    return true;
}
export function handleSnapshotDetailsGet(req, res) {
    var url = new URL(req.url, "http://".concat(req.headers.host || 'localhost'));
    var timestamp = url.searchParams.get('timestamp');
    if (!timestamp) {
        sendErrorResponse(res, 'Missing timestamp', 400);
        return true;
    }
    try {
        var snapDir = getSnapshotsDir();
        var targetDir = path.join(snapDir, "snap_".concat(timestamp));
        var metaPath = path.join(targetDir, 'snapshot_metadata.json');
        if (!fs.existsSync(metaPath)) {
            throw new Error('Snapshot not found');
        }
        var snapData = JSON.parse(readProtectedFile(metaPath));
        var config_1 = {};
        if (snapData.default_grub_backup) {
            try {
                var content = readProtectedFile(snapData.default_grub_backup);
                content.split('\n').forEach(function (line) {
                    var trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                        var idx = trimmed.indexOf('=');
                        var key = trimmed.substring(0, idx).trim();
                        var val = trimmed.substring(idx + 1).trim();
                        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                            val = val.substring(1, val.length - 1);
                        }
                        config_1[key] = val;
                    }
                });
            }
            catch (e) {
                logError('GET /api/snapshot-details', 'Failed to read default_grub_backup', e);
            }
        }
        var bootEntries = [];
        if (snapData.bls_entries_backup) {
            try {
                bootEntries = JSON.parse(readProtectedFile(snapData.bls_entries_backup));
            }
            catch (e) {
                logError('GET /api/snapshot-details', 'Failed to read bls_entries_backup', e);
            }
        }
        sendJsonResponse(res, { config: config_1, bootEntries: bootEntries });
    }
    catch (e) {
        sendErrorResponse(res, e.message);
    }
    return true;
}
export function handleSaveGrubConfigPost(data, res) {
    return __awaiter(this, void 0, void 0, function () {
        var newConfig, reason, createSnapshot, snapScript, tmpMeta, snapResult, lines, _i, _a, _b, k, v, tmpPath, bashScript, scriptPath, isRoot, cmd;
        return __generator(this, function (_c) {
            newConfig = data.newConfig, reason = data.reason, createSnapshot = data.createSnapshot;
            log('POST /api/save-grub-config', "Saving config (createSnapshot=".concat(createSnapshot, ", reason=\"").concat(reason, "\")"));
            snapScript = "";
            tmpMeta = "";
            if (createSnapshot) {
                snapResult = createServerSnapshot(reason || "Modified GRUB general configuration", getOverridesPath, false);
                if (snapResult) {
                    snapScript = snapResult.script;
                    tmpMeta = snapResult.tmpMeta;
                }
            }
            if (newConfig) {
                lines = ["# Updated via GrubEditor GUI"];
                for (_i = 0, _a = Object.entries(newConfig); _i < _a.length; _i++) {
                    _b = _a[_i], k = _b[0], v = _b[1];
                    lines.push("".concat(k, "=\"").concat(v, "\""));
                }
                tmpPath = path.join(os.tmpdir(), "grub-config-".concat(Date.now()));
                fs.writeFileSync(tmpPath, lines.join('\n') + '\n', 'utf8');
                bashScript = "#!/bin/bash\nset -e\n\nif [ -f /boot/grub2/grub.cfg ]; then\n  grubCfgPath=\"/boot/grub2/grub.cfg\"\nelse\n  grubCfgPath=\"/boot/grub/grub.cfg\"\nfi\n\nif [ -f /etc/default/grub ]; then\n  grubDefaultPath=\"/etc/default/grub\"\nelse\n  grubDefaultPath=\"/boot/grub/default\"\nfi\n\n".concat(snapScript, "\n\nif [ -f /etc/default/grub ]; then\n  defTarget=\"/etc/default/grub\"\nelif [ -f /boot/grub/default ]; then\n  defTarget=\"/boot/grub/default\"\nelse\n  defTarget=\"/etc/default/grub\"\nfi\ncp \"").concat(tmpPath, "\" \"${defTarget}\"\nchmod 644 \"${defTarget}\"\nrm -f \"").concat(tmpPath, "\"\n");
                scriptPath = path.join(os.tmpdir(), "grub-editor-save-config-".concat(Date.now(), ".sh"));
                fs.writeFileSync(scriptPath, bashScript);
                try {
                    isRoot = process.getuid ? process.getuid() === 0 : false;
                    cmd = isRoot ? "bash ".concat(scriptPath) : "pkexec /usr/bin/grub-editor-helper bash ".concat(scriptPath);
                    execSync(cmd, { stdio: 'ignore' });
                }
                catch (e) {
                    console.warn("Failed to copy config via pkexec:", e.message);
                    throw new Error("Failed to copy config via pkexec: " + e.message);
                }
                finally {
                    if (fs.existsSync(scriptPath))
                        try {
                            fs.unlinkSync(scriptPath);
                        }
                        catch (_d) { }
                    if (fs.existsSync(tmpPath))
                        try {
                            fs.unlinkSync(tmpPath);
                        }
                        catch (_e) { }
                    if (tmpMeta && fs.existsSync(tmpMeta))
                        try {
                            fs.unlinkSync(tmpMeta);
                        }
                        catch (_f) { }
                }
                delete fileCache['/etc/default/grub'];
                delete fileCache['/boot/grub/default'];
            }
            sendJsonResponse(res, { success: true });
            return [2 /*return*/, true];
        });
    });
}
export function handleSaveBootEntriesPost(data, res) {
    return __awaiter(this, void 0, void 0, function () {
        var newEntries, reason, createSnapshot, snapScript, tmpMeta, snapResult, toSave, deletedCount, activeCount, targetPath, contentToSave, tmpEntries, bashScript, scriptPath, isRoot, cmd;
        var _a;
        return __generator(this, function (_b) {
            newEntries = data.newEntries, reason = data.reason, createSnapshot = data.createSnapshot;
            log('POST /api/save-boot-entries', "Received ".concat((_a = newEntries === null || newEntries === void 0 ? void 0 : newEntries.length) !== null && _a !== void 0 ? _a : 0, " entries to save (createSnapshot=").concat(createSnapshot, ", reason=\"").concat(reason, "\")"));
            snapScript = "";
            tmpMeta = "";
            if (createSnapshot) {
                snapResult = createServerSnapshot(reason || "Modified boot menu entries & ordering", getOverridesPath, false);
                if (snapResult) {
                    snapScript = snapResult.script;
                    tmpMeta = snapResult.tmpMeta;
                }
            }
            if (newEntries && Array.isArray(newEntries)) {
                toSave = newEntries.map(function (e) { return (__assign(__assign({}, e), { originalTitle: e.originalTitle || e.title })); });
                deletedCount = toSave.filter(function (e) { return e.deleted; }).length;
                activeCount = toSave.filter(function (e) { return !e.deleted; }).length;
                log('POST /api/save-boot-entries', "Saving ".concat(toSave.length, " entries (").concat(activeCount, " active, ").concat(deletedCount, " deleted) to ").concat(getOverridesPath()));
                targetPath = getOverridesPath();
                contentToSave = JSON.stringify(toSave, null, 2);
                if (snapScript) {
                    tmpEntries = "/tmp/grub-editor-entries-".concat(Date.now());
                    fs.writeFileSync(tmpEntries, contentToSave);
                    bashScript = "#!/bin/bash\nset -e\n\nif [ -f /boot/grub2/grub.cfg ]; then\n  grubCfgPath=\"/boot/grub2/grub.cfg\"\nelse\n  grubCfgPath=\"/boot/grub/grub.cfg\"\nfi\n\nif [ -f /etc/default/grub ]; then\n  grubDefaultPath=\"/etc/default/grub\"\nelse\n  grubDefaultPath=\"/boot/grub/default\"\nfi\n\n".concat(snapScript, "\ncp \"").concat(tmpEntries, "\" \"").concat(targetPath, "\"\nchmod 644 \"").concat(targetPath, "\"\n");
                    scriptPath = "/tmp/grub-editor-save-entries-".concat(Date.now(), ".sh");
                    fs.writeFileSync(scriptPath, bashScript);
                    try {
                        isRoot = process.getuid ? process.getuid() === 0 : false;
                        cmd = isRoot ? "bash ".concat(scriptPath) : "pkexec /usr/bin/grub-editor-helper bash ".concat(scriptPath);
                        execSync(cmd, { stdio: 'ignore' });
                        log('POST /api/save-boot-entries', 'Write successful via atomic pkexec');
                    }
                    catch (e) {
                        throw new Error("Failed to save entries via pkexec: " + e.message);
                    }
                    finally {
                        if (fs.existsSync(scriptPath))
                            try {
                                fs.unlinkSync(scriptPath);
                            }
                            catch (_c) { }
                        if (fs.existsSync(tmpEntries))
                            try {
                                fs.unlinkSync(tmpEntries);
                            }
                            catch (_d) { }
                        if (tmpMeta && fs.existsSync(tmpMeta))
                            try {
                                fs.unlinkSync(tmpMeta);
                            }
                            catch (_e) { }
                    }
                }
                else {
                    writeProtectedFile(targetPath, contentToSave);
                    log('POST /api/save-boot-entries', 'Write successful via writeProtectedFile');
                }
            }
            delete fileCache['/boot/grub/grub.cfg'];
            delete fileCache['/boot/grub2/grub.cfg'];
            sendJsonResponse(res, { success: true });
            return [2 /*return*/, true];
        });
    });
}
export function handleRestoreSnapshotPost(data, res) {
    return __awaiter(this, void 0, void 0, function () {
        var timestamp, snapDir, targetDir, metaPath, snapData, snapScript, tmpMeta, snapResult, overridesPath, scriptPath, bashScript, isRoot, cmd;
        return __generator(this, function (_a) {
            timestamp = data.timestamp;
            log('POST /api/restore-snapshot', "Restoring snapshot timestamp ".concat(timestamp, "..."));
            snapDir = getSnapshotsDir();
            targetDir = path.join(snapDir, "snap_".concat(timestamp));
            metaPath = path.join(targetDir, 'snapshot_metadata.json');
            if (!fs.existsSync(metaPath)) {
                throw new Error('Snapshot metadata not found for timestamp ' + timestamp);
            }
            snapData = JSON.parse(readProtectedFile(metaPath));
            snapScript = "";
            tmpMeta = "";
            snapResult = createServerSnapshot("Auto-backup before restoring snapshot from ".concat(new Date(timestamp).toLocaleString()), getOverridesPath, false);
            if (snapResult) {
                snapScript = snapResult.script;
                tmpMeta = snapResult.tmpMeta;
            }
            overridesPath = getOverridesPath();
            scriptPath = "/tmp/grub-editor-restore-script-".concat(Date.now(), ".sh");
            bashScript = "#!/bin/bash\nset -e\n\nif [ -f /boot/grub2/grub.cfg ]; then\n  grubCfgPath=\"/boot/grub2/grub.cfg\"\n  cfgTarget=\"/boot/grub2/grub.cfg\"\nelse\n  grubCfgPath=\"/boot/grub/grub.cfg\"\n  cfgTarget=\"/boot/grub/grub.cfg\"\nfi\n\nif [ -f /etc/default/grub ]; then\n  grubDefaultPath=\"/etc/default/grub\"\n  defTarget=\"/etc/default/grub\"\nelse\n  grubDefaultPath=\"/boot/grub/default\"\n  defTarget=\"/boot/grub/default\"\nfi\n\n".concat(snapScript, "\n\nif [ -n \"").concat(snapData.default_grub_backup, "\" ] && [ \"").concat(snapData.default_grub_backup, "\" != \"null\" ] && [ -f \"").concat(snapData.default_grub_backup, "\" ]; then\n  cp \"").concat(snapData.default_grub_backup, "\" \"${defTarget}\"\n  chmod 644 \"${defTarget}\"\nfi\n\nif [ -n \"").concat(snapData.grub_cfg_backup, "\" ] && [ \"").concat(snapData.grub_cfg_backup, "\" != \"null\" ] && [ -f \"").concat(snapData.grub_cfg_backup, "\" ]; then\n  cp \"").concat(snapData.grub_cfg_backup, "\" \"${cfgTarget}\"\n  chmod 644 \"${cfgTarget}\"\nfi\n\nif [ -n \"").concat(snapData.bls_entries_backup, "\" ] && [ \"").concat(snapData.bls_entries_backup, "\" != \"null\" ] && [ -f \"").concat(snapData.bls_entries_backup, "\" ]; then\n  cp \"").concat(snapData.bls_entries_backup, "\" \"").concat(overridesPath, "\"\n  chmod 644 \"").concat(overridesPath, "\"\nelse\n  echo '[]' > \"").concat(overridesPath, "\"\n  chmod 644 \"").concat(overridesPath, "\"\nfi\n");
            fs.writeFileSync(scriptPath, bashScript);
            try {
                isRoot = process.getuid ? process.getuid() === 0 : false;
                cmd = isRoot ? "bash ".concat(scriptPath) : "pkexec /usr/bin/grub-editor-helper bash ".concat(scriptPath);
                execSync(cmd, { stdio: 'ignore' });
                delete fileCache['/etc/default/grub'];
                delete fileCache['/boot/grub/default'];
                delete fileCache['/boot/grub/grub.cfg'];
                delete fileCache['/boot/grub2/grub.cfg'];
                delete fileCache[overridesPath];
                log('POST /api/restore-snapshot', 'Restore completed successfully');
                sendJsonResponse(res, { success: true });
            }
            catch (e) {
                logError('POST /api/restore-snapshot', 'Restore aborted due to error:', e.message);
                sendErrorResponse(res, e.message);
            }
            finally {
                if (fs.existsSync(scriptPath))
                    try {
                        fs.unlinkSync(scriptPath);
                    }
                    catch (_b) { }
                if (tmpMeta && fs.existsSync(tmpMeta))
                    try {
                        fs.unlinkSync(tmpMeta);
                    }
                    catch (_c) { }
            }
            return [2 /*return*/, true];
        });
    });
}
export function handleTriggerRegenPost(res) {
    return __awaiter(this, void 0, void 0, function () {
        var isRoot, overrides, hasOverrides, scriptPath, rawCfgOut, tmpPatched, bashScript, cmdArgs, cmdExec, child, output_1, pollInterval_1;
        return __generator(this, function (_a) {
            log('POST /api/trigger-regen', 'Starting GRUB regeneration...');
            isRoot = process.getuid ? process.getuid() === 0 : false;
            overrides = getSavedOverrides();
            hasOverrides = overrides.length > 0;
            scriptPath = "/tmp/grub-editor-regen-".concat(Date.now(), ".sh");
            rawCfgOut = "/tmp/grub-editor-raw-cfg-".concat(Date.now());
            tmpPatched = "/tmp/grub-editor-patched-cfg-".concat(Date.now());
            bashScript = "#!/bin/bash\nset -e\necho \"[Bash Runtime] Stage 1: Running update-grub...\"\nupdate-grub 2>&1\n\nif [ \"".concat(hasOverrides, "\" = \"true\" ]; then\n  if [ -f /boot/grub2/grub.cfg ]; then\n    cfgTarget=\"/boot/grub2/grub.cfg\"\n  else\n    cfgTarget=\"/boot/grub/grub.cfg\"\n  fi\n  echo \"[Bash Runtime] Stage 2: Exposing raw configuration for Node.js patching...\"\n  cat \"${cfgTarget}\" > \"").concat(rawCfgOut, "\"\n  chmod 666 \"").concat(rawCfgOut, "\"\n\n  echo \"[Bash Runtime] Stage 3: Waiting for Node.js to apply dynamic overrides...\"\n  COUNT=0\n  while [ ! -f \"").concat(tmpPatched, "\" ]; do\n    sleep 0.5\n    COUNT=$((COUNT+1))\n    if [ $COUNT -gt 60 ]; then\n      echo \"[Bash Runtime] ERROR: Timeout waiting for Node.js to patch configuration.\" >&2\n      exit 1\n    fi\n  done\n\n  echo \"[Bash Runtime] Stage 4: Finalizing deployment...\"\n  cp \"").concat(tmpPatched, "\" \"${cfgTarget}\"\n  chmod 644 \"${cfgTarget}\"\nfi\necho \"[Bash Runtime] Regeneration completed successfully!\"\n");
            fs.writeFileSync(scriptPath, bashScript);
            try {
                cmdArgs = isRoot ? ['bash', scriptPath] : ['/usr/bin/grub-editor-helper', 'bash', scriptPath];
                cmdExec = isRoot ? 'bash' : 'pkexec';
                child = require('node:child_process').spawn(cmdExec, cmdArgs);
                output_1 = "";
                child.stdout.on('data', function (data) { output_1 += data.toString(); });
                child.stderr.on('data', function (data) { output_1 += data.toString(); });
                pollInterval_1 = setInterval(function () {
                    if (hasOverrides && fs.existsSync(rawCfgOut)) {
                        clearInterval(pollInterval_1);
                        log('POST /api/trigger-regen', 'Detected raw config. Applying overrides...');
                        try {
                            var rawContent = fs.readFileSync(rawCfgOut, 'utf8');
                            var updatedContent = applyOverridesToGrubCfg(rawContent, overrides);
                            fs.writeFileSync(tmpPatched, updatedContent);
                        }
                        catch (err) {
                            logError('POST /api/trigger-regen', 'Failed to patch config:', err.message);
                        }
                    }
                }, 500);
                child.on('close', function (code) {
                    clearInterval(pollInterval_1);
                    [scriptPath, rawCfgOut, tmpPatched].forEach(function (p) {
                        try {
                            if (fs.existsSync(p))
                                fs.unlinkSync(p);
                        }
                        catch (_a) { }
                    });
                    delete fileCache['/boot/grub/grub.cfg'];
                    delete fileCache['/boot/grub2/grub.cfg'];
                    if (code === 0) {
                        log('POST /api/trigger-regen', 'Regeneration pipeline complete');
                        if (hasOverrides)
                            output_1 += "\n[GrubEditor] Applied custom menu ordering, titles, and exclusions to grub.cfg successfully.";
                        sendJsonResponse(res, { success: true, output: output_1 });
                    }
                    else {
                        logError('POST /api/trigger-regen', 'Regeneration failed:', output_1);
                        sendErrorResponse(res, "Failed to regenerate GRUB configuration:\n".concat(output_1));
                    }
                });
                child.on('error', function (err) {
                    clearInterval(pollInterval_1);
                    [scriptPath, rawCfgOut, tmpPatched].forEach(function (p) {
                        try {
                            if (fs.existsSync(p))
                                fs.unlinkSync(p);
                        }
                        catch (_a) { }
                    });
                    sendErrorResponse(res, "Failed to regenerate GRUB configuration: ".concat(err.message));
                });
            }
            catch (e) {
                sendErrorResponse(res, e.message);
            }
            return [2 /*return*/, true];
        });
    });
}
export function handleDeployPipelinePost(data, res) {
    return __awaiter(this, void 0, void 0, function () {
        var config, bootEntries, snapTitle, output, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    config = data.config, bootEntries = data.bootEntries, snapTitle = data.snapTitle;
                    log('POST /api/deploy-pipeline', "Starting batched deploy pipeline. snapTitle: ".concat(snapTitle));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, executeDeployPipeline(config, bootEntries, snapTitle)];
                case 2:
                    output = _a.sent();
                    log('POST /api/deploy-pipeline', 'Deployment pipeline complete');
                    sendJsonResponse(res, { success: true, output: output });
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    logError('POST /api/deploy-pipeline', 'Deploy pipeline failed:', e_1.message);
                    sendErrorResponse(res, e_1.message);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/, true];
            }
        });
    });
}
