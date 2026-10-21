/**
 * Zustand persistence adapter backed by localForage, which uses IndexedDB and falls back to
 * localStorage. localForage is loaded lazily and only in the browser, so server rendering
 * never touches storage.
 */

import type { StateStorage } from "zustand/middleware";

type LocalForage = typeof import("localforage");

let instance: Promise<LocalForage | null> | null = null;

function store(): Promise<LocalForage | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  instance ??= import("localforage")
    .then(({ default: localforage }) => {
      const db = localforage.createInstance({
        name: "datacommand",
        storeName: "progress",
        description: "DataCommand revision progress (stored only on this device)",
        driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE],
      });
      return db as unknown as LocalForage;
    })
    .catch(() => null);
  return instance;
}

export const localForageStorage: StateStorage = {
  getItem: async (name) => {
    const db = await store();
    return db ? ((await db.getItem<string>(name)) ?? null) : null;
  },
  setItem: async (name, value) => {
    const db = await store();
    await db?.setItem(name, value);
  },
  removeItem: async (name) => {
    const db = await store();
    await db?.removeItem(name);
  },
};
