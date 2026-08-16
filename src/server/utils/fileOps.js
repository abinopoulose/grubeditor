var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
var LOG_PREFIX = '[GrubEditor API]';
export function log(stage) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    console.log.apply(console, __spreadArray(["".concat(LOG_PREFIX, " [").concat(stage, "]")], args, false));
}
export function logError(stage) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    console.error.apply(console, __spreadArray(["".concat(LOG_PREFIX, " [").concat(stage, "] ERROR:")], args, false));
}
export var fileCache = {};
export function readProtectedFile(filepath, cacheTime) {
    if (cacheTime === void 0) { cacheTime = 5000; }
    var now = Date.now();
    if (fileCache[filepath] && (now - fileCache[filepath].timestamp) < cacheTime) {
        return fileCache[filepath].data;
    }
    var content = "";
    try {
        content = fs.readFileSync(filepath, 'utf8');
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            throw new Error("File not found: ".concat(filepath));
        }
        // Only escalate to pkexec if we actually got a permission error
        if (err.code === 'EACCES' || err.code === 'EPERM') {
            try {
                content = execSync("pkexec /usr/bin/grub-editor-helper cat \"".concat(filepath, "\""), { encoding: 'utf8' });
            }
            catch (e) {
                throw new Error("File not found or unreadable via pkexec: ".concat(filepath));
            }
        }
        else {
            throw err;
        }
    }
    fileCache[filepath] = { data: content, timestamp: now };
    return content;
}
export function writeProtectedFile(filepath, content) {
    try {
        fs.writeFileSync(filepath, content, 'utf8');
    }
    catch (_a) {
        var tmpPath = path.join(os.tmpdir(), "grub-write-".concat(Date.now(), "-").concat(Math.random().toString(36).substring(2, 8)));
        fs.writeFileSync(tmpPath, content, 'utf8');
        try {
            execSync("pkexec /usr/bin/grub-editor-helper sh -c \"cp '".concat(tmpPath, "' '").concat(filepath, "' && chmod 0644 '").concat(filepath, "'\""), { stdio: 'ignore' });
        }
        catch (err) {
            console.error("Failed to write ".concat(filepath, " via pkexec:"), err.message);
            throw new Error("Cannot write to ".concat(filepath, ": permission denied or authentication dismissed."));
        }
        finally {
            if (fs.existsSync(tmpPath))
                try {
                    fs.unlinkSync(tmpPath);
                }
                catch (_b) { }
        }
    }
    delete fileCache[filepath];
}
