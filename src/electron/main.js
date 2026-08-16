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
import { app, BrowserWindow, Menu } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as http from 'node:http';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from '../server/grubBackend';
var __dirname = path.dirname(fileURLToPath(import.meta.url));
// Ubuntu 24.04+ and many modern Linux distributions restrict unprivileged user namespaces.
// Disable Chromium sandbox requirement programmatically so Electron launches cleanly without requiring setuid chrome-sandbox binary.
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
function createWindow() {
    var _this = this;
    var preloadPath = fs.existsSync(path.join(__dirname, 'preload.mjs'))
        ? path.join(__dirname, 'preload.mjs')
        : path.join(__dirname, 'preload.js');
    var win = new BrowserWindow({
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
    win.webContents.on('console-message', function (_event, level, message, line, sourceId) {
        console.log("[Renderer Console] [level ".concat(level, "] ").concat(message, " (").concat(sourceId, ":").concat(line, ")"));
    });
    win.webContents.on('did-fail-load', function (_event, errorCode, errorDescription, validatedURL) {
        console.error("[Renderer Fail Load] (".concat(errorCode, ") ").concat(errorDescription, " - ").concat(validatedURL));
    });
    win.webContents.on('render-process-gone', function (_event, details) {
        console.error("[Renderer Process Gone] ".concat(details.reason, " - exitCode: ").concat(details.exitCode));
    });
    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
    }
    else {
        // Start loopback HTTP server for production static assets and live system API
        var distDir_1 = path.join(__dirname, '../dist');
        var server_1 = http.createServer(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
            var handled, url, filePath, ext, mimeTypes, contentType, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, handleApiRequest(req, res)];
                    case 1:
                        handled = _a.sent();
                        if (!handled) {
                            url = new URL(req.url || '/', "http://".concat(req.headers.host || 'localhost'));
                            filePath = path.join(distDir_1, url.pathname === '/' ? 'index.html' : url.pathname);
                            if (!fs.existsSync(filePath)) {
                                filePath = path.join(distDir_1, 'index.html');
                            }
                            ext = path.extname(filePath).toLowerCase();
                            mimeTypes = {
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
                            contentType = mimeTypes[ext] || 'application/octet-stream';
                            res.writeHead(200, { 'Content-Type': contentType });
                            fs.createReadStream(filePath).pipe(res);
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        err_1 = _a.sent();
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: err_1.message || 'Internal Server Error' }));
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
        var bindAndLoad_1 = function (port) {
            server_1.listen(port, '127.0.0.1', function () {
                var activePort = server_1.address().port;
                win.loadURL("http://127.0.0.1:".concat(activePort));
            });
        };
        server_1.on('error', function (err) {
            if (err.code === 'EADDRINUSE') {
                console.warn('Port 31415 occupied, retrying with ephemeral loopback port...');
                server_1.close();
                bindAndLoad_1(0);
            }
        });
        bindAndLoad_1(31415);
        win.on('closed', function () {
            try {
                server_1.close();
            }
            catch (_a) { }
        });
    }
}
app.whenReady().then(function () {
    createWindow();
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
