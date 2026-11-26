# Authoring Tools

This chapter covers how to load the files made by the engine's authoring tools in your game. It walks through UI Editor's `.uiasset.json`, Timeline Editor's `.timeline.json`, Particle Editor's `.vfx.json`, and Visual Editor's `.scene.json` and `.prefab.json`, and ends with where the outputs of the command-line tools are used. The tool list and where to open each tool are in the "Tools" chapter.

## Tools and files

| Tool | Demo | File it makes | Read in the engine by |
| --- | --- | --- | --- |
| UI Editor | [Open](https://ddukbaek2.com/portfolio/uieditor/) | `.uiasset.json` (default name `ui.uiasset.json`) | `UIDocument.fromJsonText` |
| Timeline Editor | [Open](https://ddukbaek2.com/portfolio/timelineeditor/) | `.timeline.json` (default name `titlecard.timeline.json`) | `Timeline.loadFromUrl`, `loadFromText`, `createFromJsonAsset` |
| Particle Editor | [Open](https://ddukbaek2.com/portfolio/particleeditor/) | `.vfx.json` (default name `effect.vfx.json`) | `ParticleSystem.applyDescription` |
| Visual Editor | [Open](https://ddukbaek2.com/portfolio/visualeditor/) | `scenes/*.scene.json`, `prefabs/*.prefab.json` | `UIDocument.fromJsonText` |

- Each tool's `tools/<tool name>/<tool name>.html` is a build that bundles the engine into one file, so it works when opened as a file without a server. After changing the source, rebuild it with `node tools/<tool name>/build.mjs`.
- UI Editor, Timeline Editor, and Particle Editor save by downloading the file through the browser. Visual Editor writes directly into a folder opened with Open Folder in Chromium-based browsers, and downloads in other browsers.
- Put the saved files in your game's asset folder and load them as shown below.

## Loading UI Editor documents

A `.uiasset.json` is a UI document that records a node tree as is. It holds a version number and one root node, and each node records its type, name, position, scale, rotation, opacity, pivot, anchor, content size, components, and children.

```json
{
	"version": 1,
	"root": {
		"type": "WorldNode",
		"name": "Root",
		"position": [0, 0],
		"contentSize": [960, 640],
		"components": [],
		"children": [
			{
				"type": "WorldNode",
				"name": "StartButton",
				"position": [40, 300],
				"contentSize": [240, 64],
				"components": [
					{ "type": "Paint", "color": [0.25, 0.5, 0.9, 1], "roundSize": 12 },
					{ "type": "UIButton" },
					{ "type": "UILabel", "text": "Start", "fontSize": 24 }
				],
				"children": []
			}
		]
	}
}
```

`UIDocument.fromJsonText(jsonText)` turns this text back into a live engine node tree (`WorldNode`) and returns its root. Attach it to the scene root and it shows up as is; then find nodes by name and attach behavior. `UIDocument.findNodeByPath(rootNode, pathText)` finds a node by a path of names joined with `/` from the document root (leaving out the root's own name and starting with `/`), and returns `null` when missing.

```javascript
import { Engine, EngineConfiguration, UIScene, UIDocument, UIButton, UILabel, TextAsset, Vector2 } from "./build/vanilla.js";

class TitleScene extends UIScene {
	#documentRoot;

	constructor() {
		super();
		this.setLoadingMinDurationMs(0);
		this.#documentRoot = null;
	}

	async loadAssets() {
		await super.loadAssets();
		const textAsset = new TextAsset();
		await textAsset.load("examples/uisample/assets/title.uiasset.json");
		this.#documentRoot = UIDocument.fromJsonText(textAsset.text);
	}

	initialize(engine) {
		super.initialize(engine);
		const documentRoot = this.#documentRoot;
		const root = this.getRoot();
		root.addChild(documentRoot);

		const startButtonNode = UIDocument.findNodeByPath(documentRoot, "/Panel/StartButton");
		const descriptionNode = UIDocument.findNodeByPath(documentRoot, "/Panel/Description");
		const startButton = startButtonNode.getComponent(UIButton);
		const descriptionLabel = descriptionNode.getComponent(UILabel);
		startButton.setClickedEvent(() => {
			descriptionLabel.setText("Start pressed");
		});
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(960, 640);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new TitleScene());
```

- `UIScene.loadAssets()` is the hook `UIScene` calls while it shows its loading screen. Call `super.loadAssets()` when you override it. If you derive directly from `Scene`, read the file in `load`.
- Widgets of the `UIView` family, such as scroll views, create their inner content node themselves when attached. So the document records only the widget, and children placed inside the content (list items and so on) are recorded separately as `contentChildren` and attached under the content when restored. The content node is named `content`, so include it in the path. (For example, `/Panel/ItemList/content/Item0`)
- Values that point to other nodes (node references) are recorded as `$nodeRef` with a path from the root, and they are connected after the whole tree is built.
- Components and children that a node constructor makes by itself (the title bar of `UIWindow`, the `Sprite` that `UIImageView` attaches, and so on) receive the document values when their order and type (name for children) match from the front of the document, instead of being created twice. So loading and saving again gives the same document.

### Resolving image paths

Documents record only image paths (`imagePath`), not the images themselves. `Sprite` and `UIImageView` use this field. To connect images on restore, register a path to `HTMLImageElement` function with `UIDocument.setImageResolver(resolver)` before calling `fromJsonText`. The function must return immediately (it cannot be asynchronous), so load the images first. Without a resolver, or when it returns `null`, the component is restored without an image and only the path stays in its `imagePath`.

### Registering component and node types

The components the game-side `UIDocument` knows from the start are `Paint`, `Sprite`, `Text`, `RichText`, `Mask`, `Outline`, `SoftShade`, `ShadowText`, `UIProgressRing`, `UILabel`, `UIImageView`, `UIButton`, `UIToggleButton`, `UIProgressView`, `UISlider`, `UIScrollView`, and `ShadowImage` (`UIDocument.getComponentTypeNames()`), and the only node type is `WorldNode`. UI Editor registers every component and every `WorldNode`-derived node the engine exports with the document format. So when a type used in the editor is missing from the game-side table, that component is dropped on load with a warning and that node comes back as a plain `WorldNode` with a warning.

A game that loads documents saved by the editors calls `UIDocument.registerEditorTypes()` once before `fromJsonText`. It registers every type the editors register (35 components, 12 node types) under the same names and leaves names that are already registered as they are. To register types one at a time, use `registerNodeType` and `registerComponentType`. For example, the input field (`UIInputField`) and the scroll bar (`UIScrollBar`) are nodes derived from `WorldNode`, while the snap scroll view (`UISnapScrollView`) is a component.

```javascript
import { UIDocument, UIInputField, UIScrollBar, UISnapScrollView, SoftShade } from "./build/vanilla.js";

UIDocument.registerNodeType("UIInputField", UIInputField);
UIDocument.registerNodeType("UIScrollBar", UIScrollBar);
UIDocument.registerComponentType("UISnapScrollView", UISnapScrollView);
UIDocument.registerEditorTypes();

const componentTypeNames = UIDocument.getComponentTypeNames();
console.log(componentTypeNames.includes("UISnapScrollView"), componentTypeNames.length, UIDocument.getComponentType("SoftShade") === SoftShade);
```

Components without dedicated save rules are saved and restored through the values read and written by matching `get` and `set` methods (`saveByReflection`, `loadByReflection`).

### Saving documents from the game

`UIDocument.toJsonText(rootNode, isPretty = true)` turns a node tree into text of the same shape. Node and component type names are written with the names registered in the tables, so the document is the same even in a bundle that shortens class names (esbuild's `--minify`). Only types that are not registered are written with their JavaScript class names (`constructor.name`), so to save such types as well, use a bundle that keeps class names (`--keep-names`). The README commands and `tools/project.cjs build` minify with `--keep-names`. Loading (`fromJsonText`) looks up the table by the names in the document, so it works with any bundle.

## Playing Timeline Editor documents

A `.timeline.json` is a document made of a list of stage nodes, tracks (target name, property, keys), and markers. At the top level are `name`, `duration` (seconds), `frameRate`, `loop`, `stage` (`width`, `height`, `backgroundColor`, `nodes`), `tracks`, and `markers`.

```javascript
import { Engine, EngineConfiguration, Scene, Timeline, ImageAsset, Vector2 } from "./build/vanilla.js";

class LogoScene extends Scene {
	#timeline;

	constructor() {
		super();
		this.#timeline = null;
	}

	async load(engine) {
		await super.load(engine);
		const emblemAsset = new ImageAsset();
		await emblemAsset.load("examples/timelineshowcase/assets/emblem.png");
		const timeline = await Timeline.loadFromUrl("examples/timelineshowcase/assets/logo.timeline.json");
		const root = this.getRoot();
		timeline.buildStage(root, (imageName) => {
			return imageName === "emblem.png" ? emblemAsset.getImage() : null;
		});
		timeline.setMarkerHandler((markerName) => {
			console.log("marker", markerName);
		});
		timeline.setCompleteHandler(() => {
			console.log("complete");
		});
		timeline.setLoop(false);
		timeline.play();
		this.#timeline = timeline;
	}

	tick(timeDelta) {
		super.tick(timeDelta);
		this.#timeline.tick(timeDelta);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(960, 540);
const engine = new Engine(engineConfiguration);
engine.run(new LogoScene());
```

- Loading: `Timeline.loadFromUrl(url)` (fetches and builds), `Timeline.loadFromText(text)` (from JSON text), `Timeline.createFromJsonAsset(jsonAsset)` (from a loaded `JsonAsset`; it copies the document; returns `null` if not loaded). When loading together with other assets through `AssetLoader`, load it with `addJson` and then use `createFromJsonAsset`.
- Stage: `buildStage(parentNode, imageResolver)` creates the document's stage nodes, attaches them under `parentNode`, and returns a `Map` of name to node. To drive an existing node tree instead, `bind(rootNode)` finds nodes whose names match the tracks' target names; for targets that are not nodes, use `setTarget(name, target)` or `setTargetResolver(resolver)`.
- Images: images imported in the editor go into the document's `image` field as `data:` URLs, and the runtime reads them by itself. Images written by name (`"emblem.png"`), as in the example, must be returned by `imageResolver`.
- Playback: `play()`, `pause()`, `stop()` (back to the start), `seek(time)` (fires no events), and `tick(timeDelta)` every frame. Change looping and speed with `setLoop` and `setSpeed`.
- Notifications: `setMarkerHandler((markerName, marker, timeline) => {})`, `setEventHandler((targetName, eventName, key, timeline) => {})`, and `setCompleteHandler((timeline) => {})`. Completion is reported when a non-looping timeline reaches its end.
- Documents with sound nodes need `Timeline.setAudioManager(engine.getAudioManager())` first to make sound.

The detailed rules for tracks, easing, and keys are in the "Tweens and Timelines" chapter.

## Using Particle Editor assets

A `.vfx.json` is a list of particle system descriptions. Each system records its name together with the description fields accepted by `ParticleSystem.applyDescription`.

```json
{
	"systems": [
		{ "name": "Fire", "looping": true, "duration": 1, "emissionRate": 60, "shape": "cone", "lifetime": [0.6, 1.2], "speed": [80, 180], "renderShape": "circle", "blendMode": "lighter" }
	]
}
```

In the engine, create one node per system, add a `ParticleSystem`, and apply the description. A `ParticleSystem` starts playing as soon as it is added. If a particle image was imported in the editor, it is stored in the description's `imageDataUrl` field as a `data:` URL; `applyDescription` does not read that field, so load the image yourself and pass it to `setImage`.

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, ParticleSystem, Vector2 } from "./build/vanilla.js";

const vfxAssetText = `{
	"systems": [
		{
			"name": "Sparks",
			"looping": true,
			"duration": 1,
			"emissionRate": 80,
			"shape": "circle",
			"shapeRadius": 10,
			"lifetime": [0.4, 0.8],
			"speed": [120, 260],
			"size": [3, 6],
			"gravity": [0, 300],
			"startColorA": [1, 0.9, 0.4, 1],
			"startColorB": [1, 0.5, 0.1, 1],
			"colorOverLifetime": [{ "time": 0, "color": [1, 1, 1, 1] }, { "time": 1, "color": [1, 0.3, 0.05, 0] }],
			"renderShape": "streak",
			"blendMode": "lighter"
		}
	]
}`;

class EffectScene extends Scene {
	async load(engine) {
		await super.load(engine);
		const vfxAsset = JSON.parse(vfxAssetText);
		const root = this.getRoot();
		for (const description of vfxAsset.systems) {
			const systemNode = new WorldNode();
			systemNode.setName(description.name);
			systemNode.setLocalPosition(Vector2.create(640, 360));
			const particleSystem = systemNode.addComponent(ParticleSystem);
			particleSystem.applyDescription(description);
			if (description.imageDataUrl) {
				const imageElement = new Image();
				imageElement.src = description.imageDataUrl;
				await imageElement.decode();
				particleSystem.setImage(imageElement);
			}
			root.addChild(systemNode);
		}
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
const engine = new Engine(engineConfiguration);
engine.run(new EffectScene());
```

In a game, load the file with `JsonAsset` and loop over `jsonAsset.data.systems` as above. The editor also reads an older shape without `systems` (an object holding a single description), so for such a file use that one object as the description. The meaning of each description field is covered in the "Particles" chapter.

## Loading Visual Editor scenes

Visual Editor saves scenes in the same shape as UI documents (`UIDocument`). The default save path is `scenes/untitled.scene.json`, and the frame size used only by the editor (`frameSize`) sits in the same JSON. `UIDocument` skips keys it does not know, so the game reads the file as is with `UIDocument.fromJsonText`. The scene root is a `WorldNode` named `sceneRoot` with its pivot at the top left.

Saving the selected node as a prefab creates a UI document at `prefabs/<name>.prefab.json` with that node as its root. To use the same prefab many times in a game, load the text once and call `fromJsonText` each time; every call returns a new node tree.

Visual Editor's `Sprite` records the image's project-relative path in `imagePath`. In the game, load the image at that path first and return it from the resolver. The example below keeps a trimmed version of what Visual Editor saves in code.

```javascript
import { Engine, EngineConfiguration, Scene, UIDocument, ImageAsset, Vector2 } from "./build/vanilla.js";

const sceneJsonText = JSON.stringify({
	version: 1,
	frameSize: [1280, 720],
	root: {
		type: "WorldNode",
		name: "sceneRoot",
		pivot: [0, 0],
		contentSize: [0, 0],
		components: [],
		children: [
			{
				type: "WorldNode",
				name: "Hero",
				position: [640, 360],
				contentSize: [300, 300],
				components: [{ type: "Sprite", imagePath: "images/spritesheet.png" }],
				children: [],
			},
		],
	},
});

const prefabJsonText = JSON.stringify({
	version: 1,
	root: {
		type: "WorldNode",
		name: "Coin",
		contentSize: [80, 80],
		components: [{ type: "Paint", color: [1, 0.8, 0.2, 1], roundSize: 40 }],
		children: [],
	},
});

class VisualScene extends Scene {
	async load(engine) {
		await super.load(engine);
		const imageTable = new Map();
		const spritesheetAsset = new ImageAsset();
		await spritesheetAsset.load("examples/assets/spritesheet.png");
		imageTable.set("images/spritesheet.png", spritesheetAsset.getImage());
		UIDocument.setImageResolver((imagePath) => {
			return imageTable.has(imagePath) ? imageTable.get(imagePath) : null;
		});

		const root = this.getRoot();
		const sceneRoot = UIDocument.fromJsonText(sceneJsonText);
		root.addChild(sceneRoot);

		for (let index = 0; index < 3; ++index) {
			const coinNode = UIDocument.fromJsonText(prefabJsonText);
			coinNode.setLocalPosition(Vector2.create(200 + index * 120, 120));
			sceneRoot.addChild(coinNode);
		}
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
const engine = new Engine(engineConfiguration);
engine.run(new VisualScene());
```

In a game, load a file such as `scenes/main.scene.json` with `TextAsset` and pass `textAsset.text`.

## Command-line tools

The command-line tools run with Node.js. Full usage is in [`tools/TOOLS.md`](https://github.com/ddukbaek2/vanilla.js/blob/release/tools/TOOLS.md); this section only covers where their outputs are used in the engine.

```bash
node tools/atlas.cjs assets/ui --extrude 1 --padding 2
node tools/webm.cjs assets/sounds
node tools/project.cjs build --script main.js --input . --output build/web
node tools/project.cjs check --input .
node tools/project.cjs stage --source build/web --destination ../site/game --skip README.md
node tools/mangle.cjs build/web/js/bundle.min.js build/web/js/bundle.mangled.js images x y width height
node tools/apidoc.cjs 0.4.0 --check-examples
```

| Tool | Output | Used in the engine by |
| --- | --- | --- |
| `atlas.cjs` | `<folder name>.json` and page images next to the input folder. Needs the npm package `canvas` | `SpriteAtlas.load` ("Loading Assets" chapter) |
| `webm.cjs` | A libopus `.webm` next to each audio file under the folder (mp3, wav, ogg, flac, aac, m4a, wma, opus, aiff, au). Originals are kept. Needs the npm packages `fluent-ffmpeg` and `ffmpeg-static` | `AudioAsset`, `AssetLoader.addAudio` ("Sound" chapter) |
| `project.cjs build` | Empties the output folder, copies the build template (by default `tools/buildtemplate`; change it with `-t` or `--template`) and `<input>/assets`, then bundles the entry file with esbuild into `<output>/js/bundle.min.js` (iife, minified) | The template's `index.html` loads `./js/bundle.min.js` |
| `project.cjs check` | Reports the images and atlases under `<input>/assets/sprites`. Needs the npm package `canvas` | None (for checking) |
| `project.cjs stage` | Copies a source folder to a destination folder (emptying the destination first). Top-level names given to `--skip`, comma separated, are skipped | None (for deployment) |
| `mangle.cjs` | Renames `.name` property names outside strings in a bundled file to short names such as `$a` and `$b`, and writes the mapping to `<output>.map.json` | None (for size) |
| `apidoc.cjs` | `docs/api/<version>.json`. `--check-examples` runs the API examples and the code blocks in this guide | None (for the documentation site) |

`mangle.cjs` does not rename the keys of JSON read at run time. JSON keys your code reads as `.name` (such as fields of documents made by the tools) must be passed as exclusions from the third argument on, or they will be renamed. The example in the tool's header passes `images x y width height`, the keys of the atlas JSON. Features that build method names as strings and call them (such as `UIDocument` reading `get` and `set` pairs) also stop working when those names change.

`tools/excel.cjs` is a module that only exports functions, so other scripts load it with `require`. (See the "Tools" chapter)

## Things to watch for

- UI documents record only image paths. Load the images and register `setImageResolver` before `fromJsonText`.
- Component and node types used in the editor but missing from the game-side `UIDocument` table are silently dropped or become `WorldNode`. Register any type beyond the 16 built-in components.
- To save with `UIDocument.toJsonText` in a game, use a bundle that keeps class names.
- A `Timeline` only moves when `tick` is called every frame. For documents with sound, call `Timeline.setAudioManager` first.
- `applyDescription` does not read `imageDataUrl` in a `.vfx.json`. Load the image yourself and pass it to `setImage`.
- When you use `mangle.cjs`, put the JSON keys read at run time in the exclusion list.

## Related classes

UIDocument, UIScene, TextAsset, JsonAsset, ImageAsset, Timeline, ParticleSystem, WorldNode, UIButton, UILabel, UIInputField, UIScrollBar, UISnapScrollView, SpriteAtlas, AudioAsset
