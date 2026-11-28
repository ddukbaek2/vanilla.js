# Loading Assets

This chapter covers how to fetch images, text, JSON, binary data, fonts, and sounds and use them in the engine. It walks through the `Asset` subclasses that load one asset each, `AssetLoader` that loads many assets together and reports progress and failures, `LoadingProgress` that moves a loading bar smoothly, and `SpriteAtlas` that picks images out by name from atlases packed by `tools/atlas.cjs`.

## Loading in a scene's load

A scene goes through an asynchronous `load(engine)` step before `initialize(engine)`. Assets are usually loaded in `load`. When you override `load`, call `await super.load(engine)` first so the root node is sized to the view.

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, Sprite, ImageAsset, Vector2 } from "./build/vanilla.js";

class AssetScene extends Scene {
	async load(engine) {
		await super.load(engine);
		const imageAsset = new ImageAsset();
		await imageAsset.load("examples/assets/spritesheet.png");

		const node = new WorldNode();
		node.setContentSize(Vector2.create(300, 300));
		node.setLocalPosition(Vector2.create(640, 360));
		const sprite = node.addComponent(Sprite);
		sprite.setImage(imageAsset);
		const root = this.getRoot();
		root.addChild(node);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new AssetScene());
```

- Asset paths are relative to the page. They are fetched with `fetch` and `Image` internally.
- While `load` runs, the engine does not call the scene's `tick` and `draw`; it only calls `drawOnLoad(graphic)` every frame. After `load` finishes, it waits another 0.3 seconds, calls `initialize`, and moves on to regular updates.
- Calling `load` again on an asset that is already loaded does nothing (it returns right away when `isLoaded()` is true).

## Asset types

| Class | Loads | Read after loading from |
| --- | --- | --- |
| `ImageAsset` | Images such as png, jpeg, webp | `image` field (`HTMLImageElement`), `getImage()`, `getImageSize()` |
| `TextAsset` | Text files | `text` field |
| `JsonAsset` | JSON files (derives from `TextAsset`) | `data` field (parsed object) |
| `BlobAsset` | Binary data | `getBlob()` |
| `FontAsset` | ttf, otf, woff, woff2 fonts | `family`, `fontFace` fields |
| `AudioAsset` | Sound files | `getAudioBuffer()`, `getDuration()` (seconds) |

Every asset derives from `Asset` and has `getAssetPath()`, `isLoaded()`, `getAssetType()`, and `unload()`.

With `setNoCache(true)`, `TextAsset` and `JsonAsset` add `cache: "no-cache"` to `fetch`. Use it to keep browsers from holding on to old data tables after a deploy.

```javascript
import { JsonAsset, TextAsset, BlobAsset } from "./build/vanilla.js";

const jsonAsset = new JsonAsset();
jsonAsset.setNoCache(true);
await jsonAsset.load("examples/timelineshowcase/assets/combo.timeline.json");
const timelineName = jsonAsset.data.name;
console.log(timelineName);

const textAsset = new TextAsset();
await textAsset.load("examples/timelineshowcase/assets/title.timeline.json");
console.log(textAsset.text.length);

const blobAsset = new BlobAsset();
await blobAsset.load("examples/ancientmountain/assets/fox.glb");
const blob = blobAsset.getBlob();
console.log(blob.size);
```

## Fonts

`FontAsset` loads with `loadFont(family, path, descriptors)`, not `load(path)`. Once loaded, the font is added to the browser font set (`document.fonts`) under the `family` name. `descriptors` are `FontFace` descriptors (weight, style, and so on); when you add several files of the same family with different weights, pass them so a later file does not replace an earlier one. Text components accept a `FontAsset` directly in `setFont`.

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, Text, FontAsset, Vector2, Colors } from "./build/vanilla.js";

class FontScene extends Scene {
	async load(engine) {
		await super.load(engine);
		const fontAsset = new FontAsset();
		await fontAsset.loadFont("DOSGothic", "examples/assets/DOSGothic.woff", { weight: "400" });

		const node = new WorldNode();
		node.setContentSize(Vector2.create(600, 80));
		node.setLocalPosition(Vector2.create(640, 360));
		const text = node.addComponent(Text);
		text.setFont(fontAsset);
		text.setFontSize(48);
		text.setTextColor(Colors.white);
		text.setText("Hello, vanilla.js");
		const root = this.getRoot();
		root.addChild(node);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
const engine = new Engine(engineConfiguration);
engine.run(new FontScene());
```

The engine's default font and fonts for multiple languages are covered in the "Languages" chapter.

## Sounds

`AudioAsset` fetches a sound file, decodes it with an `OfflineAudioContext` (sample rate 44100), and keeps the resulting `AudioBuffer`. It does not take the speakers, so loading before user input does not trigger autoplay warnings. If fetching or decoding fails, it throws and leaves the reason in `getLoadError()`.

```javascript
import { AudioAsset } from "./build/vanilla.js";

const audioAsset = new AudioAsset();
await audioAsset.load("examples/assets/beep.wav");
console.log(audioAsset.getDuration());
console.log(audioAsset.getLoadError());
```

Playing loaded sounds is covered in the "Sound" chapter.

## Loading together with AssetLoader

Awaiting assets one by one lines up fetching and decoding and makes loading slow. `AssetLoader` loads everything in its list at once.

- `addImage(path)`, `addJson(path)`, `addText(path)`, `addBlob(path)`, `addAudio(path)`, and `addFont(family, path, descriptors)` create an asset, add it to the list, and return it. Read from that asset after loading.
- `addAsset(asset, path)` adds an `Asset` subclass you created, and `addTask(path, loadFunction)` adds any function that returns a Promise. `path` is the name shown in the failure list.
- `setConcurrency(count)` sets how many loads run at once. The default is 6; values below 1 become 1, and fractions are dropped.
- `load()` waits until everything finishes and returns the failure list `[{ path, error }]`. It does not throw on failure and keeps loading the rest. Items added during loading are loaded by the same `load()`.
- Progress is the finished count (including failures) divided by the total. Read it with `getProgress()` (0 to 1, or 1 when nothing was added), `getFinishedCount()`, `getLoadedCount()` (excluding failures), `getTotalCount()`, `getInFlightCount()`, and `isFinished()`.
- `setProgressHandler((progress, finishedCount, totalCount) => {})` is called whenever progress changes, and `setCompleteHandler((failedList) => {})` when everything is done.

The scene below passes the `AssetLoader` progress to a `LoadingProgress` and draws a loading bar in `drawOnLoad`. `LoadingProgress` makes the shown value (`getShownProgress`) smoothly follow the reported value (`setProgress`, 0 to 1, never decreasing). Call `update(timeDelta)` every frame; the follow speed is given in the constructor or with `setFollowRate` (fraction of the remaining distance per second, default 6).

```javascript
import { Engine, EngineConfiguration, Scene, AssetLoader, LoadingProgress, WorldNode, Sprite, Vector2, Rect, Colors } from "./build/vanilla.js";

class LoadingScene extends Scene {
	#assetLoader;
	#loadingProgress;

	constructor() {
		super();
		this.#assetLoader = new AssetLoader();
		this.#loadingProgress = new LoadingProgress();
	}

	async load(engine) {
		await super.load(engine);
		const assetLoader = this.#assetLoader;
		const loadingProgress = this.#loadingProgress;
		assetLoader.setConcurrency(4);
		const imageAsset = assetLoader.addImage("examples/assets/spritesheet.png");
		const jsonAsset = assetLoader.addJson("examples/timelineshowcase/assets/combo.timeline.json");
		const audioAsset = assetLoader.addAudio("examples/assets/beep.wav");
		const fontAsset = assetLoader.addFont("DOSGothic", "examples/assets/DOSGothic.woff");
		assetLoader.setProgressHandler((progress, finishedCount, totalCount) => {
			loadingProgress.setProgress(progress);
		});
		const failedList = await assetLoader.load();
		for (const failed of failedList) {
			console.warn(failed.path, failed.error);
		}

		const node = new WorldNode();
		node.setContentSize(Vector2.create(300, 300));
		node.setLocalPosition(Vector2.create(640, 360));
		const sprite = node.addComponent(Sprite);
		sprite.setImage(imageAsset);
		const root = this.getRoot();
		root.addChild(node);
		console.log(jsonAsset.isLoaded(), audioAsset.getDuration(), fontAsset.family);
	}

	drawOnLoad(graphic) {
		const engine = this.getEngine();
		const timeManager = engine.getTimeManager();
		const viewManager = engine.getViewManager();
		const timeDelta = timeManager.getUnscaleDeltaTime();
		const loadingProgress = this.#loadingProgress;
		loadingProgress.update(timeDelta);
		const shownProgress = loadingProgress.getShownProgress();

		viewManager.applyViewRect(graphic);
		const viewSize = viewManager.getViewSize();
		const barWidth = viewSize.x * 0.6;
		const barLeft = (viewSize.x - barWidth) * 0.5;
		const barTop = viewSize.y * 0.8;
		graphic.setFillColor(Colors.black);
		graphic.drawRect(Rect.create(0, 0, viewSize.x, viewSize.y));
		graphic.setFillColor("#404040");
		graphic.drawRect(Rect.create(barLeft, barTop, barWidth, 12));
		graphic.setFillColor(Colors.white);
		graphic.drawRect(Rect.create(barLeft, barTop, barWidth * shownProgress, 12));
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
const engine = new Engine(engineConfiguration);
engine.run(new LoadingScene());
```

## Loading from bytes you already have

When you already hold the bytes, for example after extracting them from an archive, assets can read them without fetching. Method names and arguments differ slightly by type.

| Class | Method | Async |
| --- | --- | --- |
| `ImageAsset` | `loadFromBytes(assetPath, bytes)` (`ArrayBuffer`, typed array, `Blob`) | Yes |
| `TextAsset` | `loadFromBytes(assetPath, bytes)` (read as UTF-8) | No |
| `JsonAsset` | `loadFromBytes(assetPath, bytes)` | No |
| `BlobAsset` | `loadFromBytes(assetPath, bytes)` | No |
| `FontAsset` | `loadFontFromBytes(family, bytes, descriptors)` | Yes |
| `AudioAsset` | `loadFromBytes(bytes)` (no path argument) | Yes |

`loadFromBytes` on `ImageAsset`, `TextAsset`, `JsonAsset`, and `BlobAsset` replaces the content even if the asset is already loaded. `FontAsset` and `AudioAsset` do nothing if already loaded. The bytes you pass are not modified.

```javascript
import { BlobAsset, ImageAsset } from "./build/vanilla.js";

const blobAsset = new BlobAsset();
await blobAsset.load("examples/assets/spritesheet.png");
const blob = blobAsset.getBlob();
const bytes = await blob.arrayBuffer();

const imageAsset = new ImageAsset();
await imageAsset.loadFromBytes("spritesheet.png", bytes);
const imageSize = imageAsset.getImageSize();
console.log(imageSize.x, imageSize.y);
```

## SpriteAtlas

An atlas gathers many images into a few page images and lets you pick them out by name. The engine batches sprites that share a page image into one draw, which cuts draw calls.

Atlases are made with `tools/atlas.cjs`. It packs the png and jpg files in a folder with MaxRects and writes `<folder name>.json` and page images (`<folder name>.png`, or `<folder name>-0.png`, `<folder name>-1.png` ... for several pages) next to the input folder. Each page is the smallest power of two that fits everything, and images that do not fit within `--max-size` (default 4096) go to the next page. `--padding` defaults to 2 and `--extrude` to 0. The tool uses the npm package `canvas`.

```bash
node tools/atlas.cjs assets/ui --extrude 1 --padding 2
```

Read the resulting JSON with `SpriteAtlas.load(jsonPath)`. Page image paths without a slash (/) are resolved against the folder of the JSON. Images can be found by file name or by the name without its extension (`"icon-close.png"` is also found as `"icon-close"`).

```json
{
	"images": {
		"icon-close.png": { "x": 0, "y": 0, "width": 64, "height": 64, "page": 0 }
	},
	"meta": {
		"imageFileName": "ui.png",
		"pages": [{ "imageFileName": "ui.png", "width": 256, "height": 256 }]
	}
}
```

A table kept in code, without a JSON file, can be read with `loadData(atlasData, baseDirectory)`. Two layouts are accepted: the `atlas.cjs` layout above, and the one below that lists page paths and `[page, x, y, width, height]` per name. The example below splits one 600 x 600 image into named 200 x 200 pieces.

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, Sprite, SpriteAtlas, Vector2 } from "./build/vanilla.js";

class AtlasScene extends Scene {
	async load(engine) {
		await super.load(engine);
		const spriteAtlas = new SpriteAtlas();
		await spriteAtlas.loadData({
			pagePaths: ["examples/assets/spritesheet.png"],
			frames: {
				"first": [0, 0, 0, 200, 200],
				"second": [0, 200, 0, 200, 200],
				"third": [0, 400, 0, 200, 200],
			},
		});
		console.log(spriteAtlas.getFrameNames());

		const root = this.getRoot();
		const frameNames = ["first", "second", "third"];
		for (let index = 0; index < frameNames.length; ++index) {
			const node = new WorldNode();
			node.setContentSize(Vector2.create(200, 200));
			node.setLocalPosition(Vector2.create(340 + index * 300, 360));
			const sprite = node.addComponent(Sprite);
			const frameName = frameNames[index];
			spriteAtlas.applyFrame(sprite, frameName);
			root.addChild(node);
		}
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
const engine = new Engine(engineConfiguration);
engine.run(new AtlasScene());
```

- `readFrame(name)` returns a `Frame` (an image and a region inside it), or `null` if missing. There are also `hasFrame(name)`, `getFrameNames()`, `getPageImages()`, `getPageCount()`, and `isLoaded()`.
- `applyFrame(sprite, name)` sets a piece on a sprite. For an unknown name it clears the sprite image and returns `false`.
- After adding several atlases with the static `SpriteAtlas.addSearchAtlas(spriteAtlas)`, `SpriteAtlas.findFrame(name)` and `SpriteAtlas.applySearchFrame(sprite, name)` search them in the order added (earlier ones win). Remove them with `removeSearchAtlas` and `clearSearchAtlases`. To avoid the global list, use `SpriteAtlas.findFrameInOrder(atlasList, name)` and `SpriteAtlas.applyFrameInOrder(atlasList, sprite, name)`.
- `SpriteAtlas` is not an `Asset` subclass, so add it to an `AssetLoader` with `addTask`.

```javascript
import { AssetLoader, SpriteAtlas } from "./build/vanilla.js";

const assetLoader = new AssetLoader();
const spriteAtlas = new SpriteAtlas();
assetLoader.addTask("spritesheet atlas", async () => {
	await spriteAtlas.loadData({
		pagePaths: ["examples/assets/spritesheet.png"],
		frames: {
			"first": [0, 0, 0, 200, 200],
		},
	});
});
const imageAsset = assetLoader.addImage("assets/icons/icon.png");
const failedList = await assetLoader.load();
SpriteAtlas.addSearchAtlas(spriteAtlas);
const frame = SpriteAtlas.findFrame("first");
console.log(failedList.length, frame !== null, imageAsset.isLoaded());
```

## Things to watch out for

- `load` on `ImageAsset`, `TextAsset`, `BlobAsset`, and `AudioAsset` throws on failure (including failed responses such as 404). `JsonAsset.load` does not throw when fetching or parsing fails; it reports the error and leaves `isLoaded()` false. Check `isLoaded()` when loading directly. `AssetLoader` counts an asset as failed if `isLoaded()` is false after loading.
- `SpriteAtlas.load` only warns and returns when it cannot read the JSON. Since it does not throw, check `isLoaded()`. When added with `addTask`, `AssetLoader` does not count this as a failure either.
- `AssetLoader` prints an error to the console for each failure and counts failures as finished in the progress. Handle failures with the list returned by `load()` or with `getFailedList()`.
- `FontAsset.load(path)` does not load the font. Use `loadFont` or `AssetLoader.addFont`.
- `drawOnLoad` is called only while `load` runs. Set up the drawing coordinates yourself there (`viewManager.applyViewRect(graphic)`).

## Related classes

Asset, ImageAsset, TextAsset, JsonAsset, BlobAsset, FontAsset, AudioAsset, AssetLoader, LoadingProgress, SpriteAtlas, Frame, Sprite, Scene
