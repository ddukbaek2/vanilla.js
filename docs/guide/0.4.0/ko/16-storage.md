# 저장

설정, 최고 점수, 진행 상황처럼 다음에 켜도 남아 있어야 하는 값을 브라우저에 저장하는 방법을 다룹니다. 키 하나에 값 하나를 쓰고 읽는 `LocalStorage` 와, 상태 객체 하나를 JSON 으로 한 키에 두고 바뀔 때 알려 주는 `PersistedStore` 차례로 봅니다.

## LocalStorage 로 값 하나씩 저장하기

`LocalStorage` 는 모든 메서드가 정적입니다. 만들지 않고 바로 부릅니다. 기본 저장소는 브라우저의 `window.localStorage` 이고, 값은 모두 글로 저장됩니다.

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

| 쓰기 | 읽기 | 저장되는 글 |
| --- | --- | --- |
| `setString(key, value)` | `getString(key, default = "")` | 그대로 |
| `setNumber(key, value)` | `getNumber(key, default = 0)` | `String(value)` |
| `setBoolean(key, value)` | `getBoolean(key, default = false)` | `"true"` 나 `"false"` |
| `setJson(key, value)` | `getJson(key, default = null)` | `JSON.stringify(value)` |

- 읽기 메서드는 키가 없을 때 기본값을 돌려주기만 하고 저장소에 써 넣지 않습니다.
- `getNumber` 는 저장된 글을 `Number()` 로 바꿉니다. 숫자가 아닌 글이 들어 있으면 `NaN` 이 나옵니다.
- `getBoolean` 은 저장된 글이 `"true"` 일 때만 참이고, 비어 있지 않은 다른 글이면 거짓입니다.
- `getJson` 은 글이 없거나 비었거나 해석이 실패하면 기본값을 돌려줍니다. `setJson` 은 순환 참조처럼 JSON 으로 바꿀 수 없는 값이면 경고를 남기고 쓰지 않은 채 `false` 를 돌려줍니다.
- `getItem(key)`, `setItem(key, value)`, `removeItem(key)` 는 글을 그대로 다루는 낮은 단계의 메서드입니다. `getItem` 은 키가 없으면 `null` 입니다.

## 키 목록과 지우기

같은 주소(출처)의 페이지는 저장소 하나를 함께 씁니다. 키 앞에 게임 이름 같은 접두사를 붙여 두면 다른 앱의 값과 섞이지 않고, 게임의 값만 골라 지울 수 있습니다.

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

- `getKeys()` 는 저장소의 키와 메모리에 대신 둔 키(아래 절)를 합쳐 이름 차례로 정렬해 돌려줍니다.
- `remove(key)` 는 키 하나를 지웁니다. `removeItem` 과 같습니다.
- `clearByPrefix(prefix)` 는 그 접두사로 시작하는 키를 모두 지우고 지운 수를 돌려줍니다. 빈 접두사면 아무것도 지우지 않고 0 입니다.
- `clear()` 는 저장소 전체를 비웁니다. 같은 출처의 다른 앱 값과 개발자 도구 설정(`hierarchy.settings` 키)까지 지워지므로, 게임 값만 지울 때는 `clearByPrefix` 를 씁니다.

## 저장소를 쓰지 못할 때

사생활 보호 창이나 쿠키를 막은 브라우저에서는 `window.localStorage` 에 접근하면 예외가 나고, 저장소가 가득 차면 쓰기가 실패합니다. `LocalStorage` 는 모든 접근을 `try` 로 감싸 예외를 내지 않고, 쓰지 못한 값은 페이지가 살아 있는 동안 메모리에 대신 둡니다.

- `setItem` 은 저장소에 썼으면 `true`, 메모리에 대신 뒀으면 `false` 를 돌려줍니다. `setJson` 도 같습니다.
- 한 번이라도 메모리로 대신했으면 `isMemoryFallback()` 이 참입니다.
- 메모리에 둔 값은 다시 켜면 사라집니다. 저장이 중요한 게임은 `isMemoryFallback()` 을 보고 "저장되지 않습니다" 같은 안내를 띄웁니다.

## 저장소 갈아 끼우기

플랫폼 SDK 가 따로 저장소를 주는 곳에서는 `LocalStorage.setBackend(backend)` 로 갈아 끼웁니다. `backend` 는 `getItem(key)`(글 또는 `null`), `setItem(key, value)`, `removeItem(key)` 를 가진 객체입니다. 키 목록(`getKeys`, `clearByPrefix`)을 쓰려면 글 배열을 돌려주는 `getKeys()` 를, 한 번에 비우려면 `clear()` 를 더 둡니다. `setBackend(null)` 이면 `window.localStorage` 로 돌아갑니다.

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

갈아 끼우면 메모리에 대신 둔 값은 버려지고 `isMemoryFallback()` 도 거짓으로 돌아갑니다. `getBackend()` 는 갈아 끼운 객체를, `readStorage()` 는 지금 쓰는 저장소(갈아 끼운 것, 없으면 `window.localStorage`, 그것도 막혀 있으면 `null`)를 돌려줍니다.

## PersistedStore 로 상태 묶음 저장하기

설정 화면이나 점수판처럼 여러 값을 한 덩어리로 다루고, 값이 바뀌면 화면을 고쳐야 할 때는 `PersistedStore` 를 씁니다. 상태 객체 하나를 키 하나에 JSON 으로 저장하고, 바뀔 때마다 구독자에게 알립니다.

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

- 생성자는 `new PersistedStore(storageKey, defaultState = {}, version = 1)` 입니다. 만들 때 바로 저장소에서 읽습니다.
- `get()` 은 지금 상태를 돌려줍니다. 복사본이 아니므로 직접 고치지 않습니다. 직접 고치면 저장되지도, 알려지지도 않습니다.
- `set(partialState)` 은 지금 상태에 얕게 합친 새 객체를 만들고, 저장하고, 구독자를 부릅니다. `replace(nextState)` 는 상태 전체를 바꿉니다.
- `reset()` 은 기본 상태로 `replace` 합니다. 키를 지우는 것이 아니라 기본 상태를 저장합니다.
- `subscribe(subscriber)` 는 `(state) => {}` 를 걸고 해지 함수를 돌려줍니다. 해지 함수를 부르거나 `unsubscribe(subscription)` 에 넘기면 풀립니다. `notify()` 를 직접 불러 구독자를 부를 수도 있습니다.
- `set`, `replace`, `reset` 은 부를 때마다 바로 저장합니다. 매 프레임 바뀌는 값은 넣지 않습니다.

저장소에는 판 번호와 상태가 함께 들어갑니다.

```json
{"version":1,"state":{"musicVolume":0.5,"effectVolume":1,"language":""}}
```

## 판 번호와 기본값

읽을 때 저장된 `version` 이 생성자의 판 번호와 다르거나, JSON 해석이 실패하거나, `state` 가 객체가 아니면 기본 상태로 시작합니다. 판 번호가 같으면 기본 상태 위에 저장된 상태를 덮어 씁니다. 그래서 기본 상태에 새 키를 더하면 예전 저장에도 그 키가 기본값으로 채워지고, 기본 상태에 없는 키가 저장돼 있어도 그대로 살아납니다.

구조를 크게 바꿔 판 번호를 올리면 예전 저장은 버려집니다. `PersistedStore` 에는 옮기는 기능이 없으므로, 옮겨야 하면 만들기 전에 `LocalStorage.getJson` 으로 예전 글을 직접 읽어 둡니다.

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

## 상태 묶음마다 저장소 따로 두기

`setStorageBackend(backend)` 는 그 `PersistedStore` 하나만 다른 저장소를 쓰게 합니다. `backend` 꼴은 `LocalStorage.setBackend` 와 같고, `null` 이면 `LocalStorage` 로 돌아갑니다. 갈아 끼우면 새 저장소에서 상태를 다시 읽고(없으면 기본 상태) 구독자를 부릅니다. 갈아 끼운 저장소에 쓰다 실패하면 예외 없이 경고만 남깁니다.

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

## 지우기

- 값 하나: `LocalStorage.remove(key)`.
- 게임의 값 모두: `LocalStorage.clearByPrefix("mygame.")`.
- `PersistedStore` 를 처음 상태로: `reset()`. 저장소의 키까지 없애려면 `LocalStorage.remove(store.getStorageKey())` 를 부릅니다. 이때 그 `PersistedStore` 가 들고 있는 상태는 그대로이고, 다음 `set` 에서 다시 저장됩니다.

개발 중에는 개발자 도구(F2)의 Local Storage 탭에서 키와 값을 보고, 더하고, 고치고, 지울 수 있습니다. "개발자 도구" 장에서 다룹니다.

## 주의할 점

- 저장소는 출처(프로토콜, 호스트, 포트)마다 하나입니다. 같은 주소에 여러 게임을 올리면 키에 접두사를 꼭 붙입니다.
- 값은 모두 글로 저장됩니다. 숫자와 참거짓은 읽을 때 바꾸므로, 다른 곳에서 글로 써 넣은 값은 `getNumber` 가 `NaN` 을, `getBoolean` 이 거짓을 돌려줄 수 있습니다.
- 저장소를 쓰지 못해 메모리에 대신 둔 값은 다시 켜면 없습니다(`isMemoryFallback`).
- `PersistedStore.get()` 이 돌려준 객체를 직접 고치지 않습니다. `set` 이나 `replace` 를 씁니다.
- `PersistedStore` 의 판 번호를 올리면 예전 저장은 기본 상태로 바뀝니다. 옮길 것이 있으면 만들기 전에 읽어 둡니다.

## 관련 클래스

LocalStorage, PersistedStore
