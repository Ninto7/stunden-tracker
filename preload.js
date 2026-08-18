const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getUsers: () => ipcRenderer.invoke('get-users'),
  createUser: (name, lohn) => ipcRenderer.invoke('create-user', name, lohn),
  addTimeEntry: (data) => ipcRenderer.invoke('add-time-entry', data),
  addUeberweisung: (data) => ipcRenderer.invoke('add-ueberweisung', data),
  deleteUser: (userId) => ipcRenderer.invoke('delete-user', userId),
  getBalance: (userId) => ipcRenderer.invoke('get-user-total-time', userId),
  getTransactions: (userId) => ipcRenderer.invoke('get-user-transactions', userId),
});