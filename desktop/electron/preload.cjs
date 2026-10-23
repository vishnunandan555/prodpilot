const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('prodpilotDesktop', {
  platform: process.platform,
  version: '1.0.0',
});
