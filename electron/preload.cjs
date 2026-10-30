'use strict'

const { contextBridge, ipcRenderer } = require('electron')

function subscribe(channel, callback) {
  if (typeof callback !== 'function') return () => {}
  const listener = (_event, payload) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('dodoi', {
  platform: process.platform,

  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (payload) => ipcRenderer.invoke('settings:save', payload),
  testConnection: (payload) => ipcRenderer.invoke('settings:test', payload),
  fetchFreeModels: (payload) => ipcRenderer.invoke('settings:free-models', payload),
  openEnvFile: () => ipcRenderer.invoke('settings:open-env'),
  refreshSettings: () => ipcRenderer.invoke('settings:get'),

  getLocalStatus: () => ipcRenderer.invoke('local:status'),
  prepareLocalModel: () => ipcRenderer.invoke('local:prepare'),
  cancelLocalPrepare: () => ipcRenderer.invoke('local:cancel'),
  startLocalEngine: () => ipcRenderer.invoke('local:start'),
  stopLocalEngine: () => ipcRenderer.invoke('local:stop'),
  testLocalEngine: () => ipcRenderer.invoke('local:test'),
  openLocalLog: () => ipcRenderer.invoke('local:open-log'),
  onLocalStatus: (callback) => subscribe('local:status', callback),

  getUpdateStatus: () => ipcRenderer.invoke('updates:get'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onUpdateStatus: (callback) => subscribe('updates:status', callback),

  translate: (text) => ipcRenderer.invoke('translate:run', text),
  hideOverlay: () => ipcRenderer.send('overlay:hide'),
  openSettings: () => ipcRenderer.send('overlay:open-settings'),

  pauseShortcut: () => ipcRenderer.invoke('shortcut:pause'),
  resumeShortcut: () => ipcRenderer.invoke('shortcut:resume'),

  minimizeSettings: () => ipcRenderer.send('settings:minimize'),
  maximizeSettings: () => ipcRenderer.send('settings:maximize'),
  closeSettings: () => ipcRenderer.send('settings:close'),
  quitApp: () => ipcRenderer.send('app:quit'),

  onOverlayShown: (callback) => subscribe('overlay:shown', callback),
  onOverlayHide: (callback) => subscribe('overlay:hide', callback),
  onSettingsRefresh: (callback) => subscribe('settings:refresh', callback),
  onSettingsChanged: (callback) => subscribe('settings:changed', callback),
})
