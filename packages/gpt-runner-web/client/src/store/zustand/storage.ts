import type { StateStorage } from 'zustand/middleware'
import type { FrontendState } from '@nicepkg/gpt-runner-shared/common'
import { debounce, runOnceByKey, tryParseJson } from '@nicepkg/gpt-runner-shared/common'
import { globalConfig } from '../../helpers/global-config'
import { fetchState, saveState } from '../../networks/state'

const debounceSaveState = debounce(async (key: string, state: FrontendState) => {
  return await saveState({ key, state })
}, 1000)

function updateStateFromRemoteOnce(key: string) {
  return runOnceByKey(async (key: string) => {
    return await fetchState({ key })
  }, key)(key)
}

export class CustomStorage implements StateStorage {
  #storage: Storage

  static get prefixKey() {
    const rootPath = globalConfig.rootPath
    return `gpt-runner:${rootPath}:`
  }

  constructor(storage: Storage) {
    this.#storage = storage
  }

  getItem = async (key: string) => {
    const finalKey = CustomStorage.prefixKey + key
    const remoteSourceValue = (await updateStateFromRemoteOnce(finalKey))?.data?.state

    if (remoteSourceValue !== undefined) {
      const remoteString = JSON.stringify(remoteSourceValue)
      this.#storage.setItem(finalKey, remoteString)
      return remoteString
    }
    else {
      return this.#storage.getItem(finalKey)
    }
  }

  setItem = (key: string, value: string) => {
    const finalKey = CustomStorage.prefixKey + key

    // save to server
    debounceSaveState(finalKey, tryParseJson(value))

    return this.#storage.setItem(finalKey, value)
  }

  removeItem = (key: string) => {
    const finalKey = CustomStorage.prefixKey + key

    // save to server
    debounceSaveState(finalKey, null)

    return this.#storage.removeItem(finalKey)
  }
}
