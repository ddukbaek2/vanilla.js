# Storage

This chapter covers how to keep values in the browser that must survive a restart, such as settings, high scores, and progress. It walks through `LocalStorage`, which reads and writes one value per key, and `PersistedStore`, which keeps one state object as JSON under a single key and notifies you when it changes.

## Saving single values with LocalStorage

Every method of `LocalStorage` is static. Call them directly without creating an instance. The default storage is the browser's `window.localStorage`, and every value is stored as a string.

```javascript
import { LocalStorage } from "./build/vanilla.js";

LocalStorage.setString("mygame.playerName", "Hero");
LocalStorage.setNumber("mygame.bestScore", 1200);
LocalStorage.setBoolean("mygame.isMuted", true);
LocalStorage.setJson("mygame.inventory", { potion: 3, key: 1 });

const playerName = LocalStorage.getString("mygame.playerName", "Guest");
const bestScore = LocalStorage.getNumber("mygame.bestScore", 0);
const isMuted = LocalStorage.getBoolean("mygame.isMuted", false);
const inventory = LocalStorage.getJson("mygame.inventory", {});
console.log(playerName, bestScore, isMuted, inventory.potion);

const hasLevel = LocalStorage.containsKey("mygame.level");
const level = LocalStorage.getNumber("mygame.level", 1);
console.log(hasLevel, level);
```

| Write | Read | Stored string |
| --- | --- | --- |
| `setString(key, value)` | `getString(key, default = "")` | As is |
| `setNumber(key, value)` | `getNumber(key, default = 0)` | `String(value)` |
| `setBoolean(key, value)` | `getBoolean(key, default = false)` | `"true"` or `"false"` |
| `setJson(key, value)` | `getJson(key, default = null)` | `JSON.stringify(value)` |

- Read methods only return the default when the key is missing; they never write it to storage.
- `getNumber` converts the stored string with `Number()`. If the string is not a number, you get `NaN`.
- `getBoolean` is true only when the stored string is `"true"`; any other non-empty string is false.
- `getJson` returns the default when the string is missing, empty, or fails to parse. `setJson` logs a warning and returns `false` without writing when the value cannot be turned into JSON, such as a circular reference.
- `getItem(key)`, `setItem(key, value)`, and `removeItem(key)` are the low-level methods that handle raw strings. `getItem` returns `null` for a missing key.

## Listing and removing keys

Pages on the same address (origin) share a single storage. Prefix your keys with something like the game name so they do not mix with other apps' values and so you can remove only your game's values.

```javascript
import { LocalStorage } from "./build/vanilla.js";

LocalStorage.setNumber("mygame.stage", 3);
LocalStorage.setNumber("mygame.gold", 250);
LocalStorage.setString("othergame.name", "Other");

const keys = LocalStorage.getKeys();
console.log(keys);

LocalStorage.remove("mygame.stage");
const removedCount = LocalStorage.clearByPrefix("mygame.");
console.log(removedCount, LocalStorage.containsKey("othergame.name"));
```

- `getKeys()` merges the storage keys with keys kept in memory (see the next section) and returns them sorted by name.
- `remove(key)` removes one key. It is the same as `removeItem`.
- `clearByPrefix(prefix)` removes every key that starts with the prefix and returns how many it removed. An empty prefix removes nothing and returns 0.
- `clear()` empties the whole storage. It also wipes other apps' values on the same origin and the developer tools settings (the `hierarchy.settings` key), so use `clearByPrefix` to remove only your game's values.

## When storage is unavailable

In private windows or browsers that block cookies, touching `window.localStorage` throws, and writes fail when storage is full. `LocalStorage` wraps every access in `try` so it never throws, and keeps values it could not write in memory for as long as the page is alive.

- `setItem` returns `true` when it wrote to storage and `false` when it kept the value in memory instead. `setJson` does the same.
- `isMemoryFallback()` is true once any value has fallen back to memory.
- Values kept in memory are gone after a restart. Games where saving matters can check `isMemoryFallback()` and show a notice such as "Progress will not be saved".

## Replacing the storage

Where a platform SDK provides its own storage, swap it in with `LocalStorage.setBackend(backend)`. `backend` is an object with `getItem(key)` (a string or `null`), `setItem(key, value)`, and `removeItem(key)`. To use key listing (`getKeys`, `clearByPrefix`), add `getKeys()` returning an array of strings; to empty it at once, add `clear()`. `setBackend(null)` switches back to `window.localStorage`.

```javascript
import { LocalStorage } from "./build/vanilla.js";

const itemMap = new Map();
LocalStorage.setBackend({
	getItem: (key) => {
		return itemMap.has(key) ? itemMap.get(key) : null;
	},
	setItem: (key, value) => {
		itemMap.set(key, value);
	},
	removeItem: (key) => {
		itemMap.delete(key);
	},
	getKeys: () => {
		return Array.from(itemMap.keys());
	},
});

LocalStorage.setNumber("mygame.coins", 50);
const coins = LocalStorage.getNumber("mygame.coins", 0);
const backendKeys = LocalStorage.getKeys();
console.log(coins, backendKeys);

LocalStorage.setBackend(null);
```

Swapping discards values kept in memory and resets `isMemoryFallback()` to false. `getBackend()` returns the swapped-in object, and `readStorage()` returns the storage in use (the swapped-in one, otherwise `window.localStorage`, or `null` if that is blocked too).

## Saving a state bundle with PersistedStore

When you handle several values as one bundle and need to refresh the screen when they change, as in a settings screen or a leaderboard, use `PersistedStore`. It stores one state object as JSON under one key and calls its subscribers on every change.

```javascript
import { PersistedStore } from "./build/vanilla.js";

const defaultSettings = { musicVolume: 0.8, effectVolume: 1, language: "" };
const settingsStore = new PersistedStore("mygame.settings", defaultSettings, 1);

const unsubscribe = settingsStore.subscribe((state) => {
	console.log("settings changed", state.musicVolume, state.effectVolume);
});

settingsStore.set({ musicVolume: 0.5 });
const settings = settingsStore.get();
console.log(settings.musicVolume, settings.language, settingsStore.getStorageKey());

unsubscribe();
settingsStore.reset();
```

- The constructor is `new PersistedStore(storageKey, defaultState = {}, version = 1)`. It reads from storage right away.
- `get()` returns the current state. It is not a copy, so do not modify it; direct changes are neither saved nor notified.
- `set(partialState)` creates a new object by shallow-merging into the current state, saves it, and calls the subscribers. `replace(nextState)` swaps the whole state.
- `reset()` calls `replace` with the default state. It does not remove the key; it saves the default state.
- `subscribe(subscriber)` registers `(state) => {}` and returns an unsubscribe function. Call that function, or pass it to `unsubscribe(subscription)`, to stop listening. You can also call `notify()` yourself to call the subscribers.
- `set`, `replace`, and `reset` save immediately on every call. Do not put values that change every frame in a store.

The storage holds the version number together with the state.

```json
{"version":1,"state":{"musicVolume":0.5,"effectVolume":1,"language":""}}
```

## Version numbers and defaults

When reading, if the stored `version` differs from the constructor's version, the JSON fails to parse, or `state` is not an object, the store starts from the default state. When the versions match, the stored state is written over the default state. So when you add a new key to the default state, older saves get it filled with the default value, and stored keys missing from the default state are kept.

If you change the structure a lot and raise the version, older saves are discarded. `PersistedStore` has no migration feature, so when you need to carry data over, read the old string yourself with `LocalStorage.getJson` before creating the store.

```javascript
import { LocalStorage, PersistedStore } from "./build/vanilla.js";

LocalStorage.setJson("mygame.progress", { version: 1, state: { level: 4, gold: 90 } });

const storedPayload = LocalStorage.getJson("mygame.progress", null);
let migratedState = null;
if (storedPayload !== null && storedPayload.version === 1) {
	migratedState = { stage: storedPayload.state.level, gold: storedPayload.state.gold };
}

const progressStore = new PersistedStore("mygame.progress", { stage: 1, gold: 0, gems: 0 }, 2);
if (migratedState !== null) {
	progressStore.set(migratedState);
}
const progress = progressStore.get();
console.log(progress.stage, progress.gold, progress.gems);
```

## A separate storage per state bundle

`setStorageBackend(backend)` makes only that one `PersistedStore` use a different storage. `backend` has the same shape as for `LocalStorage.setBackend`, and `null` switches back to `LocalStorage`. After swapping, the store reads its state again from the new storage (the default state if nothing is there) and calls its subscribers. Write failures on a swapped-in storage only log a warning instead of throwing.

```javascript
import { PersistedStore } from "./build/vanilla.js";

const cloudItemMap = new Map();
const cloudBackend = {
	getItem: (key) => {
		return cloudItemMap.has(key) ? cloudItemMap.get(key) : null;
	},
	setItem: (key, value) => {
		cloudItemMap.set(key, value);
	},
	removeItem: (key) => {
		cloudItemMap.delete(key);
	},
};

const rankingStore = new PersistedStore("mygame.ranking", { scores: [] }, 1);
rankingStore.setStorageBackend(cloudBackend);
rankingStore.set({ scores: [1200, 900, 450] });
console.log(cloudItemMap.get("mygame.ranking"));
```

## Removing data

- One value: `LocalStorage.remove(key)`.
- All of your game's values: `LocalStorage.clearByPrefix("mygame.")`.
- Back to the initial state of a `PersistedStore`: `reset()`. To remove its key from storage as well, call `LocalStorage.remove(store.getStorageKey())`. The state held by that `PersistedStore` stays as it is and is saved again on the next `set`.

During development you can view, add, edit, and remove keys and values in the Local Storage tab of the developer tools (F2). See the "Developer Tools" chapter.

## Things to watch for

- There is one storage per origin (protocol, host, port). If you host several games on the same address, always prefix your keys.
- Every value is stored as a string. Numbers and booleans are converted on read, so a value written as plain text elsewhere may give `NaN` from `getNumber` or false from `getBoolean`.
- Values kept in memory because storage was unavailable are gone after a restart (`isMemoryFallback`).
- Do not modify the object returned by `PersistedStore.get()`. Use `set` or `replace`.
- Raising the version of a `PersistedStore` turns older saves into the default state. Read anything you need to carry over before creating the store.

## Related classes

LocalStorage, PersistedStore
