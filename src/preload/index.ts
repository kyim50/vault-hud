import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('vault', { ping: () => 'pong' })
