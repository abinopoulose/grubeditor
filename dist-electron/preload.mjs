"use strict";const e=require("electron");e.contextBridge.exposeInMainWorld("electronAPI",{isElectron:!0,platform:process.platform});
