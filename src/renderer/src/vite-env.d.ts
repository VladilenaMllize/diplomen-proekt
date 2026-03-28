/// <reference types="vite/client" />
/// <reference path="./prism.d.ts" />

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
} from '../../shared/types'

declare global {
  interface Window {
    api: {
      getState: () => Promise<Store>
      getStoreLoadError: () => Promise<string | null>
      updateSettings: (settings: AppSettings) => Promise<AppSettings | undefined>
      exportConfig: () => Promise<{ ok: boolean }>
      importConfig: () => Promise<{ ok: boolean; error: string | null }>
      saveDevice: (input: DeviceInput) => Promise<Device>
      removeDevice: (id: string) => Promise<void>
      sendRequest: (options: RequestOptions) => Promise<ResponseData>
      clearHistory: () => Promise<void>
      saveMacro: (input: MacroInput) => Promise<Macro>
      removeMacro: (id: string) => Promise<void>
      runMacro: (id: string) => Promise<MacroRunResult>
      createFolder: (name: string) => Promise<MacroFolder>
      updateFolder: (id: string, name: string) => Promise<MacroFolder | null>
      removeFolder: (id: string) => Promise<void>
      onDeviceStatus: (callback: (update: DeviceStatusUpdate) => void) => () => void
    }
  }
}

export {}
