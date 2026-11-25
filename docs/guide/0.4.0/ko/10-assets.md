# 애셋 불러오기

그림, 글, JSON, 바이너리, 글꼴, 소리를 받아 엔진에서 쓰는 방법을 다룹니다. 애셋 하나를 직접 받는 `Asset` 파생 클래스, 여러 애셋을 함께 받으며 진행률과 실패 목록을 주는 `AssetLoader`, 로딩 막대를 부드럽게 움직이는 `LoadingProgress`, `tools/atlas.cjs` 가 묶은 그림을 이름으로 꺼내는 `SpriteAtlas` 차례로 봅니다.

## 씬의 load 에서 불러오기

씬은 `load(engine)` 이라는 비동기 단계를 거친 뒤 `initialize(engine)` 로 넘어갑니다. 애셋은 보통 `load` 에서 받습니다. `load` 를 덮어쓸 때는 맨 앞에서 `await super.load(engine)` 을 불러야 루트 노드가 화면 크기에 맞춰집니다.

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

- 애셋 주소는 페이지 기준 상대 주소입니다. 안에서 `fetch` 와 `Image` 로 받습니다.
- `load` 가 도는 동안 엔진은 씬의 `tick` 과 `draw` 를 부르지 않고 `drawOnLoad(graphic)` 만 매 프레임 부릅니다. `load` 가 끝나면 0.3 초를 더 기다린 뒤 `initialize` 를 부르고 보통 갱신으로 넘어갑니다.
- 이미 읽힌 애셋에 `load` 를 다시 부르면 아무것도 하지 않습니다(`isLoaded()` 가 참이면 바로 돌아갑니다).

## 애셋 종류

| 클래스 | 받는 것 | 받은 뒤 읽는 곳 |
| --- | --- | --- |
| `ImageAsset` | png, jpeg, webp 같은 그림 | `image` 필드(`HTMLImageElement`), `getImage()`, `getImageSize()` |
| `TextAsset` | 글 파일 | `text` 필드 |
| `JsonAsset` | JSON 파일 (`TextAsset` 파생) | `data` 필드 (해석한 객체) |
| `BlobAsset` | 바이너리 | `getBlob()` |
| `FontAsset` | ttf, otf, woff, woff2 글꼴 | `family`, `fontFace` 필드 |
| `AudioAsset` | 소리 파일 | `getAudioBuffer()`, `getDuration()` (초) |

모든 애셋은 `Asset` 을 이어받아 `getAssetPath()`, `isLoaded()`, `getAssetType()`, `unload()` 를 가집니다.

`TextAsset` 과 `JsonAsset` 은 `setNoCache(true)` 를 주면 `fetch` 에 `cache: "no-cache"` 를 붙여 받습니다. 배포한 뒤에도 브라우저가 옛 데이터 표를 계속 쓰는 일을 막을 때 씁니다.

```javascript
import { JsonAsset, TextAsset, BlobAsset } from "./build/vanilla.js";

const jsonAsset = new JsonAsset();
jsonAsset.setNoCache(true);
await jsonAsset.load("examples/oldface/assets/expressions.json");
const happyExpression = jsonAsset.data.happy;
console.log(happyExpression.MouthSmileLeft);

const textAsset = new TextAsset();
await textAsset.load("examples/timelineshowcase/assets/title.timeline.json");
console.log(textAsset.text.length);

const blobAsset = new BlobAsset();
await blobAsset.load("examples/ancientmountain/assets/fox.glb");
const blob = blobAsset.getBlob();
console.log(blob.size);
```

## 글꼴

`FontAsset` 은 `load(path)` 가 아니라 `loadFont(family, path, descriptors)` 로 받습니다. 다 받으면 브라우저 글꼴 목록(`document.fonts`)에 `family` 이름으로 오릅니다. `descriptors` 는 `FontFace` 서술자(weight, style 같은 것)이고, 같은 패밀리에 굵기가 다른 파일을 여러 개 올릴 때는 꼭 주어야 뒤의 것이 앞의 것을 덮지 않습니다. 텍스트 컴포넌트는 `setFont` 에 `FontAsset` 을 그대로 받습니다.

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

엔진이 처음 쓰는 기본 글꼴과 여러 언어 글꼴은 "언어" 장에서 다룹니다.

## 소리

`AudioAsset` 은 소리 파일을 받아 `OfflineAudioContext`(샘플레이트 44100)로 디코딩해 `AudioBuffer` 로 들고 있습니다. 스피커를 잡지 않으므로 사용자 입력 전에 받아도 자동 재생 경고가 나지 않습니다. 받기나 디코딩이 실패하면 예외를 내고 `getLoadError()` 에 까닭을 남깁니다.

```javascript
import { AudioAsset } from "./build/vanilla.js";

const audioAsset = new AudioAsset();
await audioAsset.load("examples/assets/beep.wav");
console.log(audioAsset.getDuration());
console.log(audioAsset.getLoadError());
```

받은 소리를 재생하는 방법은 "소리" 장에서 다룹니다.

## AssetLoader 로 함께 받기

애셋을 하나씩 `await` 하면 받기와 풀기가 줄지어 늦어집니다. `AssetLoader` 는 목록에 넣은 것을 한꺼번에 받습니다.

- `addImage(path)`, `addJson(path)`, `addText(path)`, `addBlob(path)`, `addAudio(path)`, `addFont(family, path, descriptors)` 는 애셋을 만들어 목록에 넣고 그 애셋을 돌려줍니다. 받은 뒤 바로 그 애셋에서 읽으면 됩니다.
- `addAsset(asset, path)` 는 직접 만든 `Asset` 파생을, `addTask(path, loadFunction)` 은 Promise 를 돌려주는 아무 함수나 넣습니다. `path` 는 실패 목록에 보일 이름입니다.
- `setConcurrency(count)` 로 동시에 받는 수를 정합니다. 기본은 6 이고, 1 보다 작으면 1, 소수는 버립니다.
- `load()` 는 모두 끝날 때까지 기다리고 실패 목록 `[{ path, error }]` 를 돌려줍니다. 실패해도 예외를 내지 않고 다른 것을 계속 받습니다. 받는 중에 더 넣은 것도 같은 `load()` 가 받습니다.
- 진행률은 끝난 수(실패 포함) 나누기 전체 수입니다. `getProgress()`(0 ~ 1, 넣은 것이 없으면 1), `getFinishedCount()`, `getLoadedCount()`(실패 뺀 수), `getTotalCount()`, `getInFlightCount()`, `isFinished()` 로 읽습니다.
- `setProgressHandler((progress, finishedCount, totalCount) => {})` 는 진행이 바뀔 때마다, `setCompleteHandler((failedList) => {})` 는 다 끝났을 때 불립니다.

아래는 `AssetLoader` 의 진행률을 `LoadingProgress` 에 넘기고, `drawOnLoad` 에서 로딩 막대를 그리는 씬입니다. `LoadingProgress` 는 알려 준 정도(`setProgress`, 0 ~ 1, 줄어들지 않음)를 보이는 정도(`getShownProgress`)가 부드럽게 따라가게 합니다. 매 프레임 `update(timeDelta)` 를 불러야 하고, 따라가는 빠르기는 생성자나 `setFollowRate` 로 줍니다(초당 남은 거리의 비율, 기본 6).

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
		const jsonAsset = assetLoader.addJson("examples/oldface/assets/expressions.json");
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

## 이미 가진 바이트로 읽기

압축 파일에서 꺼낸 것처럼 바이트를 이미 들고 있으면 받지 않고 바로 읽힙니다. 메서드 이름과 인자가 종류마다 조금씩 다릅니다.

| 클래스 | 메서드 | 비동기 |
| --- | --- | --- |
| `ImageAsset` | `loadFromBytes(assetPath, bytes)` (`ArrayBuffer`, 형식 배열, `Blob`) | 예 |
| `TextAsset` | `loadFromBytes(assetPath, bytes)` (UTF-8 로 읽음) | 아니오 |
| `JsonAsset` | `loadFromBytes(assetPath, bytes)` | 아니오 |
| `BlobAsset` | `loadFromBytes(assetPath, bytes)` | 아니오 |
| `FontAsset` | `loadFontFromBytes(family, bytes, descriptors)` | 예 |
| `AudioAsset` | `loadFromBytes(bytes)` (경로 인자 없음) | 예 |

`ImageAsset`, `TextAsset`, `JsonAsset`, `BlobAsset` 의 `loadFromBytes` 는 이미 읽힌 애셋이어도 새 바이트로 바꿉니다. `FontAsset` 과 `AudioAsset` 은 이미 읽혔으면 아무것도 하지 않습니다. 넘긴 바이트는 바뀌지 않습니다.

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

여러 그림을 쪽 그림 몇 장에 모아 두고 이름으로 꺼냅니다. 같은 쪽 그림을 쓰는 스프라이트는 엔진이 묶어 한 번에 그리므로 그리기 호출이 줄어듭니다.

아틀라스는 `tools/atlas.cjs` 로 만듭니다. 폴더 안의 png, jpg 를 MaxRects 로 묶어 입력 폴더 옆에 `<폴더 이름>.json` 과 쪽 그림(`<폴더 이름>.png`, 여러 장이면 `<폴더 이름>-0.png`, `<폴더 이름>-1.png` ...)을 씁니다. 쪽 크기는 모두 들어가는 가장 작은 2 의 거듭제곱이고, `--max-size`(기본 4096)를 넘는 그림은 다음 쪽으로 갑니다. `--padding` 기본은 2, `--extrude` 기본은 0 입니다. 이 도구는 npm 패키지 `canvas` 를 씁니다.

```bash
node tools/atlas.cjs assets/ui --extrude 1 --padding 2
```

만든 JSON 은 `SpriteAtlas.load(jsonPath)` 로 읽습니다. 쪽 그림 경로에 빗금(/)이 없으면 JSON 이 있는 폴더를 기준으로 찾습니다. 그림 이름은 파일 이름으로도, 확장자를 뗀 이름으로도 찾습니다(`"icon-close.png"` 는 `"icon-close"` 로도 찾음).

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

JSON 파일 없이 코드에 둔 표도 `loadData(atlasData, baseDirectory)` 로 읽습니다. 표 꼴은 위의 `atlas.cjs` 꼴과, 쪽 경로 목록과 `[쪽, x, y, 가로, 세로]` 를 적는 아래 꼴 둘입니다. 아래 예제는 600 x 600 그림 한 장을 200 x 200 조각으로 나눠 이름을 붙입니다.

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

- `readFrame(name)` 은 `Frame`(그림과 그 안의 영역)을, 없으면 `null` 을 돌려줍니다. `hasFrame(name)`, `getFrameNames()`, `getPageImages()`, `getPageCount()`, `isLoaded()` 도 있습니다.
- `applyFrame(sprite, name)` 은 스프라이트에 조각을 겁니다. 없는 이름이면 스프라이트 그림을 비우고 `false` 를 돌려줍니다.
- 정적 메서드 `SpriteAtlas.addSearchAtlas(spriteAtlas)` 로 아틀라스를 여러 개 넣어 두면 `SpriteAtlas.findFrame(name)`, `SpriteAtlas.applySearchFrame(sprite, name)` 이 넣은 차례로 찾습니다(앞의 것이 이깁니다). `removeSearchAtlas`, `clearSearchAtlases` 로 뺍니다. 전역 목록을 쓰지 않으려면 `SpriteAtlas.findFrameInOrder(atlasList, name)`, `SpriteAtlas.applyFrameInOrder(atlasList, sprite, name)` 을 씁니다.
- `SpriteAtlas` 는 `Asset` 파생이 아니라서 `AssetLoader` 에는 `addTask` 로 넣습니다.

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

## 주의할 점

- `ImageAsset`, `TextAsset`, `BlobAsset`, `AudioAsset` 의 `load` 는 실패하면(404 같은 실패 응답 포함) 예외를 냅니다. `JsonAsset.load` 는 받기나 해석이 실패해도 예외를 내지 않고 오류를 알린 뒤 `isLoaded()` 를 거짓으로 둡니다. 직접 받을 때는 `isLoaded()` 를 확인합니다. `AssetLoader` 는 받은 뒤 `isLoaded()` 가 거짓이면 실패로 칩니다.
- `SpriteAtlas.load` 는 JSON 을 읽지 못하면 경고만 내고 돌아옵니다. 예외가 나지 않으므로 `isLoaded()` 로 확인합니다. `addTask` 로 넣었을 때도 `AssetLoader` 는 이것을 실패로 세지 않습니다.
- `AssetLoader` 는 실패한 것마다 콘솔에 오류를 찍고, 실패한 것도 끝난 것으로 쳐서 진행률에 넣습니다. 실패 처리는 `load()` 가 돌려준 목록이나 `getFailedList()` 로 합니다.
- `FontAsset.load(path)` 는 글꼴을 받지 않습니다. `loadFont` 나 `AssetLoader.addFont` 를 씁니다.
- `drawOnLoad` 는 `load` 가 도는 동안에만 불립니다. 이때 그리는 좌표계는 직접 맞춥니다(`viewManager.applyViewRect(graphic)`).

## 관련 클래스

Asset, ImageAsset, TextAsset, JsonAsset, BlobAsset, FontAsset, AudioAsset, AssetLoader, LoadingProgress, SpriteAtlas, Frame, Sprite, Scene
