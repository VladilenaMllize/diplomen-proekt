import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  Device,
  DeviceInput,
  DeviceStatusUpdate,
  Macro,
  MacroFolder,
  MacroInput,
  MacroRunResult,
  RequestOptions,
  ResponseData,
  Store
} from '../shared/types'

export type VaultStatus = { diskEncrypted: boolean; unlocked: boolean }
export type VaultOpResult = { ok: boolean; error?: string }

const api = {
  getState: (): Promise<Store> => ipcRenderer.invoke('app:getState'),
  getStoreLoadError: (): Promise<string | null> => ipcRenderer.invoke('app:getStoreLoadError'),
  getVaultStatus: (): Promise<VaultStatus> => ipcRenderer.invoke('vault:status'),
  vaultUnlock: (password: string): Promise<VaultOpResult> => ipcRenderer.invoke('vault:unlock', password),
  vaultLock: (): Promise<void> => ipcRenderer.invoke('vault:lock'),
  vaultEnable: (password: string): Promise<VaultOpResult> => ipcRenderer.invoke('vault:enable', password),
  vaultDisable: (password: string): Promise<VaultOpResult> => ipcRenderer.invoke('vault:disable', password),
  vaultChangePassword: (current: string, next: string): Promise<VaultOpResult> =>
    ipcRenderer.invoke('vault:changePassword', current, next),
  updateSettings: (settings: AppSettings): Promise<AppSettings | undefined> =>
    ipcRenderer.invoke('app:updateSettings', settings),
  exportConfig: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('app:exportConfig'),
  importConfig: (): Promise<{ ok: boolean; error: string | null }> =>
    ipcRenderer.invoke('app:importConfig'),
  saveDevice: (input: DeviceInput): Promise<Device> => ipcRenderer.invoke('devices:upsert', input),
  removeDevice: (id: string): Promise<void> => ipcRenderer.invoke('devices:remove', id),
  sendRequest: (options: RequestOptions): Promise<ResponseData> =>
    ipcRenderer.invoke('requests:send', options),
  clearHistory: (): Promise<void> => ipcRenderer.invoke('history:clear'),
  saveMacro: (input: MacroInput): Promise<Macro> => ipcRenderer.invoke('macros:upsert', input),
  removeMacro: (id: string): Promise<void> => ipcRenderer.invoke('macros:remove', id),
  runMacro: (id: string): Promise<MacroRunResult> => ipcRenderer.invoke('macros:run', id),
  createFolder: (name: string): Promise<MacroFolder> => ipcRenderer.invoke('folders:create', name),
  updateFolder: (id: string, name: string): Promise<MacroFolder | null> =>
    ipcRenderer.invoke('folders:update', id, name),
  removeFolder: (id: string): Promise<void> => ipcRenderer.invoke('folders:remove', id),
  onDeviceStatus: (callback: (update: DeviceStatusUpdate) => void) => {
    const handler = (_event: unknown, payload: DeviceStatusUpdate) => callback(payload)
    ipcRenderer.on('devices:status', handler)
    return () => ipcRenderer.removeListener('devices:status', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
