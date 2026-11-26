# Tweens and Timelines

This chapter covers changing values over time. It goes through `Tween`, which moves values or node properties from a start value to a target value; `Animation` and `SpriteAnimator`, which flip through frame images; `Timeline`, which plays documents saved by the Timeline Editor; and `Animator`, a state machine. Nodes themselves are covered in the "Nodes and Components" chapter, bone animation of 3D models in the "3D" chapter, and the editor in the "Authoring Tools" chapter.

## Tween

`Tween` moves named values from start values to target values. Values are numbers or `Vector2`, and only names whose start and target values have the same type change.

- Create one with `new Tween(startValues)` and chain `to(endValues, duration)` (seconds, default 1), `delay(seconds)`, and `easing(easingFunction)` (default `linear`). These methods return the tween itself, so they can be chained.
- `setUpdate((values) => {})` receives the current value object on every update (not during the delay), and `setComplete(() => {})` is called once when progress reaches 1.
- You can drive it yourself with `start()`, `stop()`, `tick(timeDelta)`, and `isFinished()`. A `duration` of 0 or less counts as finished immediately.

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

### Easing

`Tween.easingFunction` has `linear` plus `quadratic`, `cubic`, `quartic`, `quintic`, `sinusoidal`, `exponential`, `circular`, `elastic`, `back`, and `bounce`, and every one except `linear` has `in`, `out`, and `inOut` (as in `Tween.easingFunction.back.out`). Any function that takes progress (0 to 1) and returns changed progress can be passed to `easing`.

### Node property tweens

After setting a target node with `setTarget(node)`, values whose names are `TweenProperty` names are written straight to that node on every update.

| `TweenProperty` | Value | Written with |
| --- | --- | --- |
| `localPosition` | `Vector2` | `setLocalPosition` |
| `localScale` | `Vector2` | `setLocalScale` |
| `localRotation` | Number (degrees) | `setLocalRotation` |
| `localOpacity` | Number (0 to 1) | `setLocalOpacity` |
| `contentSize` | `Vector2` (pixels) | `setContentSize` |

Giving a number to a `Vector2` property writes it to both axes (`localScale: 0` is `(0, 0)`). `Tween.createNodeTween(node, tweenProperty, startValue, endValue, duration)` creates a tween that moves one property in a single line. To write just one value to a node, use `applyTweenProperty(node, tweenProperty, value)`.

In a scene, hand tweens over with `scene.startTween(tween)`. The scene starts the tween, updates it every frame, and removes it when finished. There are also `stopTween(tween)`, `stopAllTweens()`, and `getTweenCount()`.

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

If the target node leaves the node tree it was in when the tween first ran (through `removeChild` and the like), the tween ends quietly without the completion callback.

## Animation and Frame

A `Frame` is one image and a region (`Rect`) inside it. Create one with `new Frame(image, rect)`; without a region it is the whole image. `Sprite.setFrame(frame)` sets the image and region together.

`Animation` is a processor that flips through a list of frames at a set speed. It is not a component attached to a node, so you call `tick` yourself and read the current frame to draw it.

- Frames are set with `setFrames(frames)`, `setFramesFromRects(image, rects)` (sprite sheet; `image` is an `HTMLImageElement`), or `setFramesFromImages(images)` (separate images). Setting them returns to the first frame and stops.
- `setAnimationSpeed(framesPerSecond)` is the number of frames per second (default 10). `setLoop(isLoop)` (default `true`) and `setOnComplete(callback)` (called when it reaches the end without looping).
- `play()`, `pause()` (stops on the current frame), `resume()`, `stop()` (back to the first frame), `gotoAndPlay(index)`, and `gotoAndStop(index)`.
- `getCurrentFrame()`, `getCurrentFrameIndex()`, `getTotalFrameCount()`, and `isPlaying()`.

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

`SpriteAnimator` is a component that registers named clips (frame sequences) and switches between them with calls like `play("run")`. Every frame it sets the current frame on the `Sprite` of the same node, so attach a `Sprite` to the node first.

- `addClip(clipName, image, frameRects, framesPerSecond, isLoop)` registers a clip (default 10 frames per second, looping). `image` is an `HTMLImageElement`.
- `addClipFromAtlas(clipName, image, atlasJson, frameIds, framesPerSecond, isLoop)` takes frames from a TexturePacker-style table (`{ frames: { name: { frame: { x, y, w, h } } } }`).
- `play(clipName, { restartIfSame, onComplete })` switches clips. If the same clip is already playing, it does not restart (unless `restartIfSame: true`) and only replaces the completion function. It returns `true` if it started the clip.
- There are also `stop()`, `getClipName()`, `isPlaying()`, `getCurrentFrameIndex()`, `hasClip(clipName)`, and the static `SpriteAnimator.playOnNode(node, clipName, options)`.

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

`Timeline` plays documents (`*.timeline.json`) saved by the Timeline Editor. A document is JSON made of a list of stage nodes, tracks (target name, property, keys), and markers.

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

### Creating and building the stage

- `await Timeline.loadFromUrl(url)` fetches a document from a URL and creates a timeline. `Timeline.loadFromText(text)` creates one from JSON text, and `Timeline.createFromJsonAsset(jsonAsset)` from a loaded `JsonAsset` (`null` if not loaded yet). `new Timeline(description)` uses a document object as is. Created without a document, it is an empty document of 3 seconds, 30 frames per second, looping, with a 960 x 540 stage.
- `buildStage(parentNode, imageResolver)` creates the document's stage nodes, adds them under `parentNode`, and returns a `Map` from names to nodes. Node types are `group` (empty node), `paint` (`Paint`), `sprite` (`ShaderSprite`, with grid-cut frames and effects), `text` (`Text`), `particle` (`ParticleSystem`), and `sound`. `imageResolver` is a function that takes an image name from the document and returns an `HTMLImageElement`.
- If you built the stage yourself, `bind(rootNode)` finds and attaches nodes whose names match the tracks' target names. Attach them one by one with `setTarget(name, target)`, or give a function that turns names into objects with `setTargetResolver((name) => target)`.
- To use sound nodes, call `Timeline.setAudioManager(engine.getAudioManager())` once.

### Playback

- `play()`, `pause()`, `stop()` (back to the start, also stopping sounds and particles), and `seek(time)` (applies the values at that time immediately, without firing events).
- Call `tick(timeDelta)` yourself every frame. It advances time, applies values, and reports the event keys and markers it passed.
- `setSpeed(speed)` (1 is real time), `setLoop(isLoop)`, `getTime()`, `getDuration()`, `getFrameRate()`, `isPlaying()`, and `isLoop()`.
- Handlers: `setEventHandler((targetName, eventName, key, timeline) => {})`, `setMarkerHandler((markerName, marker, timeline) => {})`, and `setCompleteHandler((timeline) => {})` (when it reaches the end without looping).

### Tracks and keys

- A key's `easing` applies to the span from that key to the next. Names are in `TIMELINE_EASING_NAMES`: `"linear"`, `"step"`, `"bezier"` (uses the key's `curve: [x1, y1, x2, y2]`, the same control points as CSS `cubic-bezier`), and `<family>.<in|out|inOut>` such as `"cubic.out"`. Unknown names count as `linear`. `resolveTimelineEasing(name, curve)` and `createBezierEasing(x1, y1, x2, y2)` give you the same functions.
- Node properties are in `TIMELINE_PROPERTY_DEFINITIONS`: `x`, `y`, `width`, `height`, `scaleX`, `scaleY`, `rotation`, `opacity`, `visible`, `color`, `text`, `number`, `fontSize`, `visibleCharacters`, `frame`, `effect`, and `event`. Numbers are interpolated with easing, colors (`"#rrggbbaa"`) per channel, and text and booleans change in steps.
- Properties not in this list call the target's `setTimelineProperty(name, value)`. The target does not have to be a node as long as it has this method (`ScreenEffect` does; see the "Particles" chapter).
- A track whose property is `event` reports key values as event names. If the target is a particle node, it handles `"play"`, `"stop"`, `"clear"`, and `"emit:N"` (emit N, or 30 if omitted) itself; if it is a sound node, `"play"`, `"loop"`, and `"stop"`; and then it also calls the event handler.

Below is a scene that plays the logo document from `examples/timelineshowcase`. It loads `emblem.png`, the image the document uses, first and passes it to `buildStage`.

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

You can also create a document in code and attach it to existing nodes. The example below moves a node named `Box` left and right while changing its color, fires an event at 1 second, and a marker at 0.5 seconds.

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

`Animator`, `AnimationState`, `AnimationTransition`, and `AnimationClip` form a state machine that attaches a frame clip to each state, moves between states by parameter conditions, and blends two states. (the same structure as Unity's Animator state machine)

- `animator.addState(state)` and `addTransition(transition)` add to their lists and return the index. `getStates()` and `getTransitions()` return the engine's `List`. It starts in the first state added.
- `AnimationState` holds a clip (`setClip`), a speed (`setSpeed`), and looping (`setLoop`, `null` follows the clip).
- `AnimationTransition` connects two states with `setFrom(stateIndex)` and `setTo(stateIndex)`. With `setFrom(null)` it can be taken from any state (Any State). Add conditions with `addCondition(name, AnimationConditionMode, threshold)`; with `setExitTime(normalizedTime)` it is taken only when that time is passed, and the two states blend for `setDuration(seconds)`.
- Parameters are set with `setFloat`, `setInteger`, `setBool`, and `setTrigger`. A trigger used in a condition is reset when the transition is taken.
- `animator.tick(timeDelta)` advances the state time, checks Any State transitions first and then the rest in the order added, and takes the first one that matches. No new transition is checked while blending.
- Read the chosen frame with `getCurrentFrame()`, and while blending with `getNextFrame()` and `getTransitionWeight()`.
- `AnimationClip` holds a list of frame regions, a duration (seconds), and a loop flag. `AnimationClip.fromAtlas(atlasJson, frameIds, framesPerSecond, isLoop)` takes regions from an atlas table and sets the duration to the frame count divided by frames per second.

```javascript
import { Animator, AnimationState, AnimationTransition, AnimationClip, AnimationConditionMode, Rect } from "./build/vanilla.js";

const walkClip = new AnimationClip();
walkClip.setFrames([Rect.create(0, 0, 32, 32), Rect.create(32, 0, 32, 32)]);
walkClip.setDuration(1);
walkClip.setLoop(true);
const runClip = AnimationClip.fromAtlas({ frames: { run0: { frame: { x: 0, y: 32, w: 32, h: 32 } }, run1: { frame: { x: 32, y: 32, w: 32, h: 32 } } } }, ["run0", "run1"], 4, true);

const animator = new Animator();
const walkState = new AnimationState();
walkState.setClip(walkClip);
const runState = new AnimationState();
runState.setClip(runClip);
const walkIndex = animator.addState(walkState);
const runIndex = animator.addState(runState);
const toRun = new AnimationTransition();
toRun.setFrom(walkIndex);
toRun.setTo(runIndex);
toRun.setDuration(0.25);
toRun.addCondition("speed", AnimationConditionMode.greater, 3);
animator.addTransition(toRun);
const toWalk = new AnimationTransition();
toWalk.setFrom(runIndex);
toWalk.setTo(walkIndex);
toWalk.addCondition("speed", AnimationConditionMode.less, 1);
animator.addTransition(toWalk);

animator.setFloat("speed", 5);
animator.tick(0.125);
console.log(animator.getCurrentStateIndex(), animator.getNextStateIndex(), animator.getTransitionWeight());
animator.tick(0.25);
const frame = animator.getCurrentFrame();
console.log(animator.getCurrentStateIndex(), animator.isInTransition(), frame.position.y);
```

`Animator` only picks frame regions and does not draw, so the game puts the chosen region on a `Sprite`. For the simple case of only switching clips by character state, you can also combine `FiniteStateMachine` and `SpriteAnimator`, calling `play` in a state's `enter`.

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

## Things to watch out for

- `Animation`, `Timeline`, and `FiniteStateMachine` do not advance time on their own. Call `tick(timeDelta)` from the scene's `tick`. Tweens handed over with `scene.startTween` are updated by the scene.
- The image for `setFramesFromRects` and `addClip` must be an `HTMLImageElement`. For an `ImageAsset`, pass `getImage()` (`setFramesFromRects` does nothing when given anything else).
- `SpriteAnimator` looks up the `Sprite` on the same node. Without a `Sprite`, the image does not change.
- `Timeline.seek` does not fire events or markers. Events only fire when `tick` passes their time.
- `Timeline.loadFromUrl` reads the response as JSON without checking its status. A wrong URL fails with a JSON parse error.

## Related classes

Tween, TweenProperty, Frame, Animation, Sprite, SpriteAnimator, Timeline, ShaderSprite, ParticleSystem, ScreenEffect, Animator, AnimationState, AnimationTransition, AnimationClip, FiniteStateMachine, Scene
