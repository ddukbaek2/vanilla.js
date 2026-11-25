# 트윈과 타임라인

시간에 따라 값을 바꾸는 방법을 다룹니다. 값이나 노드 속성을 시작값에서 목표값으로 옮기는 `Tween`, 프레임 그림을 넘기는 `Animation` 과 `SpriteAnimator`, Timeline Editor 가 저장한 문서를 재생하는 `Timeline`, 그리고 상태 묶음인 `Animator` 차례입니다. 노드 자체는 "노드와 컴포넌트" 장, 3D 모델의 본 애니메이션은 "3D" 장, 편집기는 "저작 도구" 장에서 다룹니다.

## Tween

`Tween` 은 이름 붙은 값들을 시작값에서 목표값으로 옮깁니다. 값은 숫자나 `Vector2` 이고, 시작값과 목표값의 꼴이 같은 이름만 바뀝니다.

- `new Tween(startValues)` 로 만들고 `to(endValues, duration)`(초, 기본 1), `delay(seconds)`, `easing(easingFunction)`(기본 `linear`)을 잇습니다. 이 메서드들은 트윈 자신을 돌려주므로 이어 부를 수 있습니다.
- `setUpdate((values) => {})` 는 매 갱신마다 이번 값 객체를 받고(대기 시간 동안은 부르지 않음), `setComplete(() => {})` 는 진행률이 1 에 닿으면 한 번 불립니다.
- `start()`, `stop()`, `tick(timeDelta)`, `isFinished()` 로 직접 돌릴 수 있습니다. `duration` 이 0 이하면 바로 끝으로 칩니다.

```javascript
import { Tween } from "./build/vanilla.js";

const tween = new Tween({ x: 0, alpha: 1 });
tween.to({ x: 100, alpha: 0 }, 0.5);
tween.easing(Tween.easingFunction.quadratic.out);
tween.setUpdate((values) => {
	console.log(values.x, values.alpha);
});
tween.setComplete(() => {
	console.log("complete");
});
tween.start();
for (let step = 0; step < 5; ++step) {
	tween.tick(0.1);
}
console.log(tween.isFinished());
```

### 이징

`Tween.easingFunction` 에 `linear` 와 `quadratic`, `cubic`, `quartic`, `quintic`, `sinusoidal`, `exponential`, `circular`, `elastic`, `back`, `bounce` 가 있고, `linear` 를 뺀 것은 저마다 `in`, `out`, `inOut` 을 가집니다(`Tween.easingFunction.back.out` 처럼). 진행률(0 ~ 1)을 받아 바뀐 진행률을 돌려주는 함수면 무엇이든 `easing` 에 줄 수 있습니다.

### 노드 속성 트윈

`setTarget(node)` 로 대상 노드를 정하면 값 이름이 `TweenProperty` 의 이름인 값을 매 갱신마다 그 노드에 바로 씁니다.

| `TweenProperty` | 값 | 쓰는 곳 |
| --- | --- | --- |
| `localPosition` | `Vector2` | `setLocalPosition` |
| `localScale` | `Vector2` | `setLocalScale` |
| `localRotation` | 숫자 (도) | `setLocalRotation` |
| `localOpacity` | 숫자 (0 ~ 1) | `setLocalOpacity` |
| `contentSize` | `Vector2` (픽셀) | `setContentSize` |

`Vector2` 속성에 숫자를 주면 두 축에 같이 씁니다(`localScale: 0` 은 `(0, 0)`). `Tween.createNodeTween(node, tweenProperty, startValue, endValue, duration)` 은 속성 하나를 움직이는 트윈을 한 줄로 만듭니다. 노드에 값 하나만 쓰고 싶으면 `applyTweenProperty(node, tweenProperty, value)` 를 씁니다.

씬에서는 `scene.startTween(tween)` 으로 맡깁니다. 씬이 트윈을 시작하고 매 프레임 갱신하며, 끝나면 목록에서 뺍니다. `stopTween(tween)`, `stopAllTweens()`, `getTweenCount()` 도 있습니다.

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, Paint, Tween, TweenProperty, Vector2, Color } from "./build/vanilla.js";

class TweenScene extends Scene {
	#boxNode;

	constructor() {
		super();
		this.#boxNode = null;
	}

	async load(engine) {
		await super.load(engine);
		const boxNode = new WorldNode();
		boxNode.setContentSize(Vector2.create(80, 80));
		boxNode.setLocalPosition(Vector2.create(160, 360));
		const paint = boxNode.addComponent(Paint);
		paint.setColor(new Color(0.35, 0.8, 1, 1));
		paint.setRoundSize(12);
		const root = this.getRoot();
		root.addChild(boxNode);
		this.#boxNode = boxNode;
	}

	initialize(engine) {
		super.initialize(engine);
		const boxNode = this.#boxNode;
		const moveTween = new Tween({ localPosition: Vector2.create(160, 360), localOpacity: 0 });
		moveTween.to({ localPosition: Vector2.create(1120, 360), localOpacity: 1 }, 1.5);
		moveTween.delay(0.2);
		moveTween.easing(Tween.easingFunction.cubic.inOut);
		moveTween.setTarget(boxNode);
		moveTween.setComplete(() => {
			this.startPulse(1, 1.4);
		});
		this.startTween(moveTween);
	}

	startPulse(startScale, endScale) {
		const pulseTween = Tween.createNodeTween(this.#boxNode, TweenProperty.localScale, startScale, endScale, 0.4);
		pulseTween.easing(Tween.easingFunction.sinusoidal.inOut);
		pulseTween.setComplete(() => {
			this.startPulse(endScale, startScale);
		});
		this.startTween(pulseTween);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
const engine = new Engine(engineConfiguration);
engine.run(new TweenScene());
```

대상 노드가 트윈이 처음 돈 때의 노드 트리에서 떨어지면(`removeChild` 같은 것) 트윈은 완료 알림 없이 조용히 끝납니다.

## Animation 과 Frame

`Frame` 은 그림 하나와 그 안의 영역(`Rect`)입니다. `new Frame(image, rect)` 로 만들고 영역을 주지 않으면 그림 전체입니다. `Sprite.setFrame(frame)` 은 그림과 영역을 함께 겁니다.

`Animation` 은 프레임 목록을 정해진 빠르기로 넘기는 처리기입니다. 노드에 붙는 컴포넌트가 아니므로 `tick` 을 직접 부르고, 지금 프레임을 읽어 그립니다.

- 프레임은 `setFrames(frames)`, `setFramesFromRects(image, rects)`(스프라이트 시트, `image` 는 `HTMLImageElement`), `setFramesFromImages(images)`(낱장 그림) 로 넣습니다. 넣으면 첫 프레임으로 돌아가 멈춥니다.
- `setAnimationSpeed(framesPerSecond)` 는 초당 넘기는 프레임 수입니다(기본 10). `setLoop(isLoop)`(기본 `true`), `setOnComplete(callback)`(반복하지 않을 때 끝에 닿으면 불림).
- `play()`, `pause()`(지금 프레임에 멈춤), `resume()`, `stop()`(첫 프레임으로), `gotoAndPlay(index)`, `gotoAndStop(index)`.
- `getCurrentFrame()`, `getCurrentFrameIndex()`, `getTotalFrameCount()`, `isPlaying()`.

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, Sprite, ImageAsset, Animation, Vector2, Rect } from "./build/vanilla.js";

class AnimationScene extends Scene {
	#animation;
	#sprite;

	constructor() {
		super();
		this.#animation = new Animation();
		this.#sprite = null;
	}

	async load(engine) {
		await super.load(engine);
		const imageAsset = new ImageAsset();
		await imageAsset.load("examples/assets/spritesheet.png");
		const image = imageAsset.getImage();
		const rects = [];
		for (let index = 0; index < 8; ++index) {
			const column = index % 3;
			const row = Math.floor(index / 3);
			rects.push(Rect.create(column * 200, row * 200, 200, 200));
		}
		const animation = this.#animation;
		animation.setFramesFromRects(image, rects);
		animation.setAnimationSpeed(8);
		animation.setLoop(true);
		animation.play();

		const node = new WorldNode();
		node.setContentSize(Vector2.create(200, 200));
		node.setLocalPosition(Vector2.create(640, 360));
		this.#sprite = node.addComponent(Sprite);
		const root = this.getRoot();
		root.addChild(node);
	}

	tick(timeDelta) {
		super.tick(timeDelta);
		const animation = this.#animation;
		animation.tick(timeDelta);
		const currentFrame = animation.getCurrentFrame();
		this.#sprite.setFrame(currentFrame);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
const engine = new Engine(engineConfiguration);
engine.run(new AnimationScene());
```

## SpriteAnimator

`SpriteAnimator` 는 이름 붙은 클립(프레임 차례)을 등록해 두고 `play("run")` 처럼 바꾸는 컴포넌트입니다. 매 프레임 같은 노드의 `Sprite` 에 지금 프레임을 걸어 줍니다. 그래서 노드에 `Sprite` 를 먼저 붙여 둡니다.

- `addClip(clipName, image, frameRects, framesPerSecond, isLoop)` 는 클립을 등록합니다(기본 10 프레임, 반복). `image` 는 `HTMLImageElement` 입니다.
- `addClipFromAtlas(clipName, image, atlasJson, frameIds, framesPerSecond, isLoop)` 는 TexturePacker 꼴(`{ frames: { 이름: { frame: { x, y, w, h } } } }`) 표에서 프레임을 뽑습니다.
- `play(clipName, { restartIfSame, onComplete })` 는 클립을 바꿉니다. 같은 클립이 이미 돌고 있으면 다시 시작하지 않고(`restartIfSame: true` 면 다시 시작) 완료 함수만 바꿉니다. 시작했으면 `true` 를 돌려줍니다.
- `stop()`, `getClipName()`, `isPlaying()`, `getCurrentFrameIndex()`, `hasClip(clipName)`, 정적 `SpriteAnimator.playOnNode(node, clipName, options)` 가 있습니다.

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, Sprite, SpriteAnimator, ImageAsset, Vector2, Rect } from "./build/vanilla.js";

class AnimatorScene extends Scene {
	#spriteAnimator;

	constructor() {
		super();
		this.#spriteAnimator = null;
	}

	async load(engine) {
		await super.load(engine);
		const imageAsset = new ImageAsset();
		await imageAsset.load("examples/assets/spritesheet.png");
		const image = imageAsset.getImage();
		const idleRects = [Rect.create(0, 0, 200, 200), Rect.create(200, 0, 200, 200)];
		const attackRects = [];
		for (let column = 0; column < 3; ++column) {
			attackRects.push(Rect.create(column * 200, 200, 200, 200));
		}

		const node = new WorldNode();
		node.setContentSize(Vector2.create(200, 200));
		node.setLocalPosition(Vector2.create(640, 360));
		node.addComponent(Sprite);
		const spriteAnimator = node.addComponent(SpriteAnimator);
		spriteAnimator.addClip("idle", image, idleRects, 4, true);
		spriteAnimator.addClip("attack", image, attackRects, 12, false);
		spriteAnimator.play("idle");
		const root = this.getRoot();
		root.addChild(node);
		this.#spriteAnimator = spriteAnimator;
	}

	touchPress(viewInputPosition) {
		super.touchPress(viewInputPosition);
		const spriteAnimator = this.#spriteAnimator;
		spriteAnimator.play("attack", {
			restartIfSame: true,
			onComplete: () => {
				spriteAnimator.play("idle");
			},
		});
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
const engine = new Engine(engineConfiguration);
engine.run(new AnimatorScene());
```

## Timeline

`Timeline` 은 Timeline Editor 가 저장한 문서(`*.timeline.json`)를 재생합니다. 문서는 무대 노드 목록, 트랙(대상 이름, 속성, 키), 마커로 이루어진 JSON 입니다.

```json
{
	"name": "Title Reveal",
	"duration": 5,
	"frameRate": 30,
	"loop": true,
	"stage": {
		"width": 960,
		"height": 540,
		"backgroundColor": "#101114ff",
		"nodes": [
			{ "name": "Logo", "type": "text", "parent": null, "x": 480, "y": 270, "text": "LOGO", "fontSize": 64 }
		]
	},
	"tracks": [
		{ "target": "Logo", "property": "opacity", "keys": [
			{ "time": 0, "value": 0, "easing": "cubic.out" },
			{ "time": 1, "value": 1, "easing": "linear" }
		] },
		{ "target": "Logo", "property": "event", "keys": [{ "time": 1, "value": "shine", "easing": "step" }] }
	],
	"markers": [{ "time": 0.5, "name": "hit" }]
}
```

### 만들기와 무대 짓기

- `await Timeline.loadFromUrl(url)` 은 주소에서 받아 만듭니다. `Timeline.loadFromText(text)` 는 JSON 글에서, `Timeline.createFromJsonAsset(jsonAsset)` 은 읽은 `JsonAsset` 에서 만듭니다(아직 안 읽혔으면 `null`). `new Timeline(description)` 은 문서 객체를 그대로 씁니다. 문서 없이 만들면 3 초, 30 프레임, 반복, 960 x 540 무대의 빈 문서입니다.
- `buildStage(parentNode, imageResolver)` 는 문서의 무대 노드를 만들어 `parentNode` 아래에 붙이고, 이름에서 노드로 가는 `Map` 을 돌려줍니다. 노드 종류는 `group`(빈 노드), `paint`(`Paint`), `sprite`(`ShaderSprite`, 격자로 자른 프레임과 효과), `text`(`Text`), `particle`(`ParticleSystem`), `sound` 입니다. `imageResolver` 는 문서의 그림 이름을 받아 `HTMLImageElement` 를 돌려주는 함수입니다.
- 무대를 직접 지었으면 `bind(rootNode)` 로 트랙의 대상 이름과 같은 이름의 노드를 찾아 붙입니다. `setTarget(name, target)` 으로 하나씩 붙이거나, `setTargetResolver((name) => target)` 로 이름을 객체로 바꾸는 함수를 줍니다.
- 사운드 노드를 쓰려면 `Timeline.setAudioManager(engine.getAudioManager())` 를 한 번 불러 둡니다.

### 재생

- `play()`, `pause()`, `stop()`(처음으로, 소리와 파티클도 멈춤), `seek(time)`(그 시각의 값을 바로 적용, 이벤트는 내지 않음).
- `tick(timeDelta)` 를 매 프레임 직접 부릅니다. 시간을 흘리고 값을 적용하며, 지나친 이벤트 키와 마커를 알립니다.
- `setSpeed(speed)`(1 이 실시간), `setLoop(isLoop)`, `getTime()`, `getDuration()`, `getFrameRate()`, `isPlaying()`, `isLoop()`.
- 처리기: `setEventHandler((targetName, eventName, key, timeline) => {})`, `setMarkerHandler((markerName, marker, timeline) => {})`, `setCompleteHandler((timeline) => {})`(반복이 아닐 때 끝에 닿으면).

### 트랙과 키

- 키의 `easing` 은 그 키부터 다음 키까지 구간에 걸립니다. 이름은 `TIMELINE_EASING_NAMES` 에 있고, `"linear"`, `"step"`, `"bezier"`(키의 `curve: [x1, y1, x2, y2]`, CSS `cubic-bezier` 와 같은 제어점), 그리고 `"cubic.out"` 처럼 `<종류>.<in|out|inOut>` 입니다. 모르는 이름은 `linear` 로 칩니다. `resolveTimelineEasing(name, curve)` 와 `createBezierEasing(x1, y1, x2, y2)` 로 같은 함수를 꺼낼 수 있습니다.
- 노드 속성은 `TIMELINE_PROPERTY_DEFINITIONS` 에 있습니다: `x`, `y`, `width`, `height`, `scaleX`, `scaleY`, `rotation`, `opacity`, `visible`, `color`, `text`, `number`, `fontSize`, `visibleCharacters`, `frame`, `effect`, `event`. 숫자는 이징으로 보간하고, 색(`"#rrggbbaa"`)은 채널마다 보간하며, 글과 참거짓은 계단으로 바뀝니다.
- 이 목록에 없는 속성은 대상의 `setTimelineProperty(name, value)` 를 부릅니다. 대상이 노드가 아니어도 이 메서드만 있으면 됩니다(`ScreenEffect` 가 그렇습니다. "파티클" 장).
- 속성이 `event` 인 트랙은 키의 값을 이벤트 이름으로 알립니다. 대상이 파티클 노드면 `"play"`, `"stop"`, `"clear"`, `"emit:N"`(N 개 뿜기, 없으면 30)을, 사운드 노드면 `"play"`, `"loop"`, `"stop"` 을 스스로 처리하고, 그 뒤 이벤트 처리기도 부릅니다.

아래는 `examples/timelineshowcase` 의 로고 문서를 재생하는 씬입니다. 문서가 쓰는 그림 `emblem.png` 를 먼저 받아 두고 `buildStage` 에 넘깁니다.

```javascript
import { Engine, EngineConfiguration, Scene, Timeline, ImageAsset, Vector2 } from "./build/vanilla.js";

class TimelineScene extends Scene {
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
			if (imageName === "emblem.png") {
				return emblemAsset.getImage();
			}
			return null;
		});
		timeline.setMarkerHandler((markerName) => {
			console.log("marker", markerName);
		});
		timeline.setEventHandler((targetName, eventName) => {
			console.log("event", targetName, eventName);
		});
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
engine.run(new TimelineScene());
```

문서를 코드로 만들어 이미 있는 노드에 붙일 수도 있습니다. 아래는 이름이 `Box` 인 노드를 좌우로 옮기며 색을 바꾸고, 1 초에 이벤트를, 0.5 초에 마커를 냅니다.

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, Paint, Timeline, Vector2, Color } from "./build/vanilla.js";

const timeline = new Timeline({
	name: "Box",
	duration: 2,
	frameRate: 30,
	loop: true,
	stage: { width: 640, height: 360, backgroundColor: "#101114ff", nodes: [] },
	tracks: [
		{ target: "Box", property: "x", keys: [
			{ time: 0, value: 120, easing: "cubic.inOut" },
			{ time: 1, value: 520, easing: "cubic.inOut" },
			{ time: 2, value: 120, easing: "linear" },
		] },
		{ target: "Box", property: "color", keys: [
			{ time: 0, value: "#3b82f6ff", easing: "linear" },
			{ time: 1, value: "#f97316ff", easing: "linear" },
			{ time: 2, value: "#3b82f6ff", easing: "linear" },
		] },
		{ target: "Box", property: "event", keys: [
			{ time: 1, value: "bounce", easing: "step" },
		] },
	],
	markers: [{ time: 0.5, name: "half" }],
});

class BindScene extends Scene {
	async load(engine) {
		await super.load(engine);
		const boxNode = new WorldNode();
		boxNode.setName("Box");
		boxNode.setContentSize(Vector2.create(64, 64));
		boxNode.setLocalPosition(Vector2.create(120, 180));
		const paint = boxNode.addComponent(Paint);
		paint.setColor(new Color(1, 1, 1, 1));
		const root = this.getRoot();
		root.addChild(boxNode);
		timeline.bind(root);
		timeline.setEventHandler((targetName, eventName) => {
			console.log(targetName, eventName);
		});
		timeline.setMarkerHandler((markerName) => {
			console.log(markerName);
		});
		timeline.play();
	}

	tick(timeDelta) {
		super.tick(timeDelta);
		timeline.tick(timeDelta);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
const engine = new Engine(engineConfiguration);
engine.run(new BindScene());
```

## Animator

`Animator`, `AnimationState`, `AnimationTransition`, `AnimationClip` 은 실험 단계의 클래스입니다. 지금은 상태와 전환, 프로퍼티를 담아 두는 그릇입니다.

- `animator.addState(state)` 와 `addTransition(transition)` 은 목록에 넣고 번호를 돌려줍니다. `getStates()`, `getTransitions()` 는 엔진의 `List` 를 돌려줍니다.
- `AnimationState.setClip(clip)` 은 상태에 `AnimationClip` 을 답니다. `AnimationTransition` 은 `setFrom(stateIndex)`, `setTo(stateIndex)` 로 두 상태 번호를 잇습니다.
- `setProperty(name, value)`, `getProperty(name)` 은 이름 붙은 값을 담습니다.
- `AnimationClip` 은 프레임 영역 목록, 길이(초), 반복 여부를 담습니다. `AnimationClip.fromAtlas(atlasJson, frameIds, framesPerSecond, isLoop)` 는 아틀라스 표에서 영역을 뽑고 길이를 프레임 수 나누기 초당 프레임 수로 정합니다.
- `animator.tick(timeDelta)` 는 안의 `Animation`(`getAnimation()`)만 갱신합니다. 전환에는 조건을 거는 자리가 없고, 상태를 스스로 바꾸지도 않습니다.

```javascript
import { Animator, AnimationState, AnimationTransition, AnimationClip } from "./build/vanilla.js";

const animator = new Animator();
const idleClip = AnimationClip.fromAtlas({ frames: { idle0: { frame: { x: 0, y: 0, w: 200, h: 200 } } } }, ["idle0"], 10, true);
const runClip = new AnimationClip();
runClip.setLoop(true);
const idleState = new AnimationState();
idleState.setClip(idleClip);
const runState = new AnimationState();
runState.setClip(runClip);
const idleIndex = animator.addState(idleState);
const runIndex = animator.addState(runState);
const transition = new AnimationTransition();
transition.setFrom(idleIndex);
transition.setTo(runIndex);
animator.addTransition(transition);
animator.setProperty("speed", 2);
animator.tick(1 / 60);
const states = animator.getStates();
console.log(states.getCount(), idleClip.getDuration(), animator.getProperty("speed"));
```

캐릭터의 상태에 따라 클립을 바꾸는 일은 지금은 `FiniteStateMachine` 과 `SpriteAnimator` 를 함께 써서 합니다. 상태의 `enter` 에서 `play` 를 부르는 식입니다.

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, Sprite, SpriteAnimator, FiniteStateMachine, ImageAsset, Vector2, Rect } from "./build/vanilla.js";

class StateScene extends Scene {
	#stateMachine;

	constructor() {
		super();
		this.#stateMachine = new FiniteStateMachine();
	}

	async load(engine) {
		await super.load(engine);
		const imageAsset = new ImageAsset();
		await imageAsset.load("examples/assets/spritesheet.png");
		const image = imageAsset.getImage();
		const node = new WorldNode();
		node.setContentSize(Vector2.create(200, 200));
		node.setLocalPosition(Vector2.create(640, 360));
		node.addComponent(Sprite);
		const spriteAnimator = node.addComponent(SpriteAnimator);
		spriteAnimator.addClip("idle", image, [Rect.create(0, 0, 200, 200), Rect.create(200, 0, 200, 200)], 4, true);
		spriteAnimator.addClip("run", image, [Rect.create(0, 200, 200, 200), Rect.create(200, 200, 200, 200), Rect.create(400, 200, 200, 200)], 10, true);
		const root = this.getRoot();
		root.addChild(node);

		const stateMachine = this.#stateMachine;
		stateMachine.addState("idle", {
			enter: () => {
				spriteAnimator.play("idle");
			},
			tick: (timeDelta, stateSeconds) => {
				if (stateSeconds >= 2) {
					stateMachine.changeState("run");
				}
			},
		});
		stateMachine.addState("run", {
			enter: () => {
				spriteAnimator.play("run");
			},
			tick: (timeDelta, stateSeconds) => {
				if (stateSeconds >= 1) {
					stateMachine.changeState("idle");
				}
			},
		});
		stateMachine.changeState("idle");
	}

	tick(timeDelta) {
		super.tick(timeDelta);
		this.#stateMachine.tick(timeDelta);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
const engine = new Engine(engineConfiguration);
engine.run(new StateScene());
```

## 주의할 점

- `Animation`, `Timeline`, `FiniteStateMachine` 은 스스로 시간이 가지 않습니다. 씬의 `tick` 에서 `tick(timeDelta)` 를 불러 줍니다. 트윈은 `scene.startTween` 으로 맡기면 씬이 갱신합니다.
- `setFramesFromRects` 와 `addClip` 의 그림은 `HTMLImageElement` 여야 합니다. `ImageAsset` 이면 `getImage()` 로 꺼내 넘깁니다(`setFramesFromRects` 는 다른 것을 받으면 아무것도 하지 않습니다).
- `SpriteAnimator` 는 같은 노드의 `Sprite` 를 찾아 씁니다. `Sprite` 가 없으면 그림이 바뀌지 않습니다.
- `Timeline.seek` 는 이벤트와 마커를 내지 않습니다. 이벤트는 `tick` 이 시간을 지나갈 때만 납니다.
- `Timeline.loadFromUrl` 은 받은 응답의 상태를 따로 보지 않고 JSON 으로 읽습니다. 주소가 틀리면 JSON 해석 오류로 실패합니다.

## 관련 클래스

Tween, TweenProperty, Frame, Animation, Sprite, SpriteAnimator, Timeline, ShaderSprite, ParticleSystem, ScreenEffect, Animator, AnimationState, AnimationTransition, AnimationClip, FiniteStateMachine, Scene
