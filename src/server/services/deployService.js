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
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { log, logError, fileCache } from '../utils/fileOps';
import { getSnapshotsDir } from '../utils/snapshots';
import { getOverridesPath, applyOverridesToGrubCfg } from '../parsers/grubParser';
export function executeDeployPipeline(config, bootEntries, snapTitle) {
    return __awaiter(this, void 0, void 0, function () {
        var isRoot, tmpConfig, tmpEntries, grubContent, _i, _a, _b, k, v, toSaveEntries, timestamp, snapDir, defTarget, cfgTarget, overridesPath, scriptPath, rawCfgOut, snapMeta, tmpMeta, tmpPatched, bashScript;
        return __generator(this, function (_c) {
            isRoot = process.getuid ? process.getuid() === 0 : false;
            tmpConfig = "/tmp/grub-editor-deploy-config-".concat(Date.now());
            tmpEntries = "/tmp/grub-editor-deploy-entries-".concat(Date.now());
            grubContent = "";
            for (_i = 0, _a = Object.entries(config); _i < _a.length; _i++) {
                _b = _a[_i], k = _b[0], v = _b[1];
                grubContent += "".concat(k, "=\"").concat(v, "\"\n");
            }
            fs.writeFileSync(tmpConfig, grubContent);
            toSaveEntries = (bootEntries || []).map(function (e) { return (__assign(__assign({}, e), { originalTitle: e.originalTitle || e.title })); });
            fs.writeFileSync(tmpEntries, JSON.stringify(toSaveEntries, null, 2));
            timestamp = Date.now();
            snapDir = path.join(getSnapshotsDir(), "snap_".concat(timestamp));
            defTarget = fs.existsSync('/etc/default/grub') ? '/etc/default/grub' : '/boot/grub/default';
            cfgTarget = fs.existsSync('/boot/grub2/grub.cfg') ? '/boot/grub2/grub.cfg' : '/boot/grub/grub.cfg';
            overridesPath = getOverridesPath();
            scriptPath = "/tmp/grub-editor-deploy-script-".concat(Date.now(), ".sh");
            rawCfgOut = "/tmp/grub-editor-raw-cfg-".concat(Date.now());
            snapMeta = {
                timestamp: timestamp,
                date_string: "".concat(timestamp, " (UTC Timestamp)"),
                description: snapTitle,
                default_grub_backup: path.join(snapDir, 'default_grub.bak'),
                grub_cfg_backup: path.join(snapDir, 'grub.cfg.bak'),
                bls_entries_backup: path.join(snapDir, 'grub-editor-entries.json.bak')
            };
            tmpMeta = "/tmp/grub-editor-deploy-meta-".concat(Date.now());
            fs.writeFileSync(tmpMeta, JSON.stringify(snapMeta, null, 2));
            tmpPatched = "/tmp/grub-editor-patched-cfg-".concat(Date.now());
            bashScript = "#!/bin/bash\nset -e\nset -x\n\nif [ -f /boot/grub2/grub.cfg ]; then\n  cfgTarget=\"/boot/grub2/grub.cfg\"\nelse\n  cfgTarget=\"/boot/grub/grub.cfg\"\nfi\n\nif [ -f /etc/default/grub ]; then\n  defTarget=\"/etc/default/grub\"\nelse\n  defTarget=\"/boot/grub/default\"\nfi\n\necho \"[Bash Runtime] Stage 1: Initializing snapshot in ".concat(snapDir, "...\"\nmkdir -p \"").concat(snapDir, "\"\nchmod 755 \"").concat(snapDir, "\"\ncp \"").concat(tmpMeta, "\" \"").concat(snapDir, "/snapshot_metadata.json\"\nchmod 644 \"").concat(snapDir, "/snapshot_metadata.json\"\n\nif [ -n \"").concat(snapMeta.default_grub_backup, "\" ] && [ \"").concat(snapMeta.default_grub_backup, "\" != \"null\" ] && [ -f \"${defTarget}\" ]; then cp \"${defTarget}\" \"").concat(snapMeta.default_grub_backup, "\"; chmod 644 \"").concat(snapMeta.default_grub_backup, "\"; fi\nif [ -n \"").concat(snapMeta.grub_cfg_backup, "\" ] && [ \"").concat(snapMeta.grub_cfg_backup, "\" != \"null\" ] && [ -f \"${cfgTarget}\" ]; then cp \"${cfgTarget}\" \"").concat(snapMeta.grub_cfg_backup, "\"; chmod 644 \"").concat(snapMeta.grub_cfg_backup, "\"; fi\nif [ -n \"").concat(snapMeta.bls_entries_backup, "\" ] && [ \"").concat(snapMeta.bls_entries_backup, "\" != \"null\" ] && [ -f \"").concat(overridesPath, "\" ]; then cp \"").concat(overridesPath, "\" \"").concat(snapMeta.bls_entries_backup, "\"; chmod 644 \"").concat(snapMeta.bls_entries_backup, "\"; fi\n\necho \"[Bash Runtime] Stage 2: Applying new GRUB configurations...\"\ncp \"").concat(tmpConfig, "\" \"${defTarget}\"\nchmod 644 \"${defTarget}\"\ncp \"").concat(tmpEntries, "\" \"").concat(overridesPath, "\"\nchmod 644 \"").concat(overridesPath, "\"\n\necho \"[Bash Runtime] Stage 3: Regenerating bootloader via update-grub...\"\nupdate-grub 2>&1\n\necho \"[Bash Runtime] Stage 4: Exposing raw configuration for Node.js patching...\"\ncat \"${cfgTarget}\" > \"").concat(rawCfgOut, "\"\nchmod 666 \"").concat(rawCfgOut, "\"\n\necho \"[Bash Runtime] Stage 5: Waiting for Node.js to apply dynamic overrides...\"\nCOUNT=0\nwhile [ ! -f \"").concat(tmpPatched, "\" ]; do\n  sleep 0.5\n  COUNT=$((COUNT+1))\n  if [ $COUNT -gt 60 ]; then\n    echo \"[Bash Runtime] ERROR: Timeout waiting for Node.js to patch configuration.\" >&2\n    exit 1\n  fi\ndone\n\necho \"[Bash Runtime] Stage 6: Finalizing deployment...\"\ncp \"").concat(tmpPatched, "\" \"${cfgTarget}\"\nchmod 644 \"${cfgTarget}\"\n\necho \"[Bash Runtime] Execution completed successfully!\"\n");
            fs.writeFileSync(scriptPath, bashScript);
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    var out = "";
                    var cmdArgs = isRoot ? ['bash', scriptPath] : ['/usr/bin/grub-editor-helper', 'bash', scriptPath];
                    var cmdExec = isRoot ? 'bash' : 'pkexec';
                    var child = spawn(cmdExec, cmdArgs);
                    child.stdout.on('data', function (data) { out += data.toString(); });
                    child.stderr.on('data', function (data) { out += data.toString(); });
                    child.on('close', function (code) {
                        [tmpConfig, tmpEntries, tmpMeta, scriptPath, rawCfgOut, tmpPatched].forEach(function (p) {
                            try {
                                if (fs.existsSync(p))
                                    fs.unlinkSync(p);
                            }
                            catch (_a) { }
                        });
                        if (code === 0) {
                            delete fileCache['/boot/grub/grub.cfg'];
                            delete fileCache['/boot/grub2/grub.cfg'];
                            delete fileCache['/etc/default/grub'];
                            resolve(out);
                        }
                        else {
                            reject(new Error("Exit code ".concat(code, ":\n").concat(out)));
                        }
                    });
                    child.on('error', function (err) {
                        [tmpConfig, tmpEntries, tmpMeta, scriptPath, rawCfgOut, tmpPatched].forEach(function (p) {
                            try {
                                if (fs.existsSync(p))
                                    fs.unlinkSync(p);
                            }
                            catch (_a) { }
                        });
                        reject(new Error("Spawn error: ".concat(err.message, "\n").concat(out)));
                    });
                    var pollInterval = setInterval(function () {
                        if (fs.existsSync(rawCfgOut)) {
                            clearInterval(pollInterval);
                            log('POST /api/deploy-pipeline', 'Detected raw config. Applying overrides...');
                            try {
                                var rawContent = fs.readFileSync(rawCfgOut, 'utf8');
                                var updatedContent = applyOverridesToGrubCfg(rawContent, toSaveEntries);
                                fs.writeFileSync(tmpPatched, updatedContent);
                            }
                            catch (err) {
                                logError('POST /api/deploy-pipeline', 'Failed to patch config:', err.message);
                            }
                        }
                    }, 500);
                })];
        });
    });
}
