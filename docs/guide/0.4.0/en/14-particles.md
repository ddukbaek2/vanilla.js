# Particles

This chapter covers particles such as flames, snow, and explosions, along with other 2D effects. It goes through `ParticleSystem` and `TrailRenderer`, which attach to nodes; `ShaderSprite`, a sprite with shader effects; `ScreenEffect`, which applies post-processing to the whole screen; and the heat haze `HeatHazeEffect`. Nodes and components are covered in the "Nodes and Components" chapter, draw order and blending in the "Drawing" chapter, 3D effects (`ToonVfx`) in the "3D" chapter, and the Particle Editor itself in the "Authoring Tools" chapter.

## ParticleSystem

`ParticleSystem` is a component that brings the commonly used parts of Unity's ParticleSystem to 2D. It starts emitting as soon as it is attached to a node (playing, looping, 20 per second by default), and particles are drawn relative to the node's origin.

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, ParticleSystem, ParticleEmitterShape, Vector2, Color } from "./build/vanilla.js";

class FireScene extends Scene {
	async load(engine) {
		await super.load(engine);
		const fireNode = new WorldNode();
		fireNode.setLocalPosition(Vector2.create(640, 520));
		const particleSystem = fireNode.addComponent(ParticleSystem);
		particleSystem.setEmitterShape(ParticleEmitterShape.cone);
		particleSystem.setShapeRadius(20);
		particleSystem.setConeAngle(0.35);
		particleSystem.setEmissionRate(60);
		particleSystem.setStartLifetime(0.6, 1.2);
		particleSystem.setStartSpeed(80, 180);
		particleSystem.setStartSize(6, 14);
		particleSystem.setStartColor(new Color(1, 0.75, 0.3, 1), new Color(1, 0.5, 0.12, 1));
		particleSystem.setColorOverLifetime([
			{ time: 0, color: new Color(1, 1, 0.85, 1) },
			{ time: 0.5, color: new Color(1, 0.6, 0.2, 0.9) },
			{ time: 1, color: new Color(0.65, 0.1, 0.02, 0) },
		]);
		particleSystem.setSizeOverLifetime(1, 0.3);
		particleSystem.setGravity(0, -110);
		particleSystem.setDamping(1);
		particleSystem.setAdditive(true);
		particleSystem.setMaxParticleCount(800);
		const root = this.getRoot();
		root.addChild(fireNode);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
const engine = new Engine(engineConfiguration);
engine.run(new FireScene());
```

### Emission

- `setEmissionRate(count)`: particles per second (default 20).
- `setLooping(isLooping)` (default `true`) and `setDuration(seconds)` (default 1): without looping, it emits only during `duration`.
- `setBurstList([{ time, count }])`: emits many at once at the given times (seconds). When looping, it repeats every `duration`.
- `emit(count, offset)`: emits several right away. Use it for events such as presses; `offset` is an origin offset (`Vector2`) in node-local space.
- `play()` resets the emission time and bursts and starts emitting. `stop(isClearing)` stops emitting; living particles move until their lifetime ends unless `isClearing` is true.
- `isPlaying()`, `isFinished()` (true when no particles are alive and there is nothing more to emit), and `setMaxParticleCount(count)` (default 512; no new particles beyond that).

### Emitter shapes (ParticleEmitterShape)

| Value | Where particles appear | Direction |
| --- | --- | --- |
| `point` (default) | The node origin | Random |
| `circle` | Within the `setShapeRadius` radius | Outward from the center |
| `cone` | Within the radius | Up (-y) within the `setConeAngle` half-angle (radians, default 0.5) |
| `box` | Within the `setBoxSize(width, height)` rectangle | Up (-y) |
| `edge` | On a horizontal segment of length `setEdgeWidth` | Down (+y) |

All sizes are in pixels and default to 0.

### Per-particle values

- Start ranges: `setStartLifetime(min, max)` (seconds, default 1), `setStartSpeed(min, max)` (pixels per second, default 60), `setStartSize(min, max)` (pixels, default 6), `setStartRotation(min, max)` (radians, default 0), `setStartColor(colorA, colorB)` (random between the two colors, default white), and `setAngularVelocity(min, max)` (radians per second, default 0). Omitting the second value uses the first value alone.
- Changes over lifetime: `setColorOverLifetime([{ time, color }])` (`time` is 0 to 1; multiplied with the start color, linearly interpolated between keys) and `setSizeOverLifetime(startScale, endScale)` (default 1, 1).
- Forces: `setGravity(x, y)` (pixels per second squared, default 0, 0; screen coordinates, so up is negative), `setDamping(damping)` (fraction of velocity lost per second, default 0), and `setAttractor(x, y, strength, swirl)` (pulls toward a point in node-local coordinates, pushes away when `strength` is negative, and `swirl` turns particles tangentially; remove it with `clearAttractor()`).
- `setWobble(amplitude, frequency)` (default frequency 4) sways particles side to side only when drawing, without affecting movement.

### Drawing

- `setRenderShape(shape)`: `ParticleRenderShape.circle` (soft circle, default), `rect` (a spinning plate), `streak` (a band stretched along the direction of travel, length multiplier `setStreakScale`, default 0.06), and `image` (the image set with `setImage(image)`).
- `setAdditive(true)` uses additive blending (`"lighter"`), and `setBlendMode(mode)` sets another blend (default `"source-over"`).
- `circle`, `rect`, and `streak` are drawn in one batch, while `image` draws each particle separately, so use it for effects with few particles.

### World space

With `setWorldSpace(true)`, each particle gets the node's position at birth added and stays fixed there. When the node moves, particles already emitted do not follow and linger like a smoke trail (the default `false` moves them along with the node). The example below emits in world space from a moving node, and on a press fires one burst with an attractor at that spot.

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, ParticleSystem, ParticleEmitterShape, ParticleRenderShape, Vector2, Color } from "./build/vanilla.js";

class BurstScene extends Scene {
	#emitterNode;
	#burstSystem;
	#elapsedSeconds;

	constructor() {
		super();
		this.#emitterNode = null;
		this.#burstSystem = null;
		this.#elapsedSeconds = 0;
	}

	async load(engine) {
		await super.load(engine);
		const root = this.getRoot();

		const emitterNode = new WorldNode();
		emitterNode.setLocalPosition(Vector2.create(640, 360));
		const smoke = emitterNode.addComponent(ParticleSystem);
		smoke.setEmissionRate(40);
		smoke.setStartSpeed(10, 30);
		smoke.setStartLifetime(1, 2);
		smoke.setStartColor(new Color(0.8, 0.85, 1, 0.6));
		smoke.setSizeOverLifetime(1, 3);
		smoke.setWorldSpace(true);
		root.addChild(emitterNode);
		this.#emitterNode = emitterNode;

		const burstNode = new WorldNode();
		burstNode.setLocalPosition(Vector2.create(640, 360));
		const burstSystem = burstNode.addComponent(ParticleSystem);
		burstSystem.setEmissionRate(0);
		burstSystem.setLooping(false);
		burstSystem.setEmitterShape(ParticleEmitterShape.circle);
		burstSystem.setShapeRadius(8);
		burstSystem.setStartSpeed(200, 420);
		burstSystem.setStartLifetime(0.5, 1);
		burstSystem.setStartColor(new Color(1, 0.9, 0.4, 1), new Color(1, 0.4, 0.2, 1));
		burstSystem.setRenderShape(ParticleRenderShape.streak);
		burstSystem.setAttractor(0, 0, -200, 300);
		burstSystem.setDamping(2);
		burstSystem.setAdditive(true);
		root.addChild(burstNode);
		this.#burstSystem = burstSystem;
	}

	tick(timeDelta) {
		super.tick(timeDelta);
		this.#elapsedSeconds += timeDelta;
		const positionX = 640 + Math.cos(this.#elapsedSeconds) * 300;
		const positionY = 360 + Math.sin(this.#elapsedSeconds * 2) * 120;
		this.#emitterNode.setLocalPosition(Vector2.create(positionX, positionY));
	}

	touchPress(viewInputPosition) {
		super.touchPress(viewInputPosition);
		const burstSystem = this.#burstSystem;
		const burstNode = burstSystem.getNode();
		burstNode.setLocalPosition(viewInputPosition);
		burstSystem.emit(80);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
const engine = new Engine(engineConfiguration);
engine.run(new BurstScene());
```

### Reading Particle Editor presets

The Particle Editor saves `.vfx.json` files shaped like `{ systems: [{ name, ...description }] }`. Each description is read as is by `applyDescription(description)`. Every field is optional, and only the given fields change. Colors are `[r, g, b, a]` arrays and ranges are `[min, max]` arrays.

| Fields | Methods |
| --- | --- |
| `looping`, `duration`, `maxParticleCount`, `emissionRate` | `setLooping`, `setDuration`, `setMaxParticleCount`, `setEmissionRate` |
| `bursts` | `setBurstList` |
| `shape`, `shapeRadius`, `coneAngle`, `boxSize`, `edgeWidth` | Emitter shape |
| `lifetime`, `speed`, `size`, `rotation`, `angularVelocity` | Start ranges |
| `startColorA`, `startColorB`, `colorOverLifetime`, `sizeOverLifetime` | Color and size |
| `gravity`, `damping`, `attractor` (`{ x, y, strength, swirl }` or `null`), `wobble` | Forces |
| `renderShape`, `blendMode`, `streakScale`, `worldSpace` | Drawing |

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, ParticleSystem, Vector2 } from "./build/vanilla.js";

const vfxAsset = {
	systems: [
		{
			name: "Snow",
			emissionRate: 70,
			shape: "edge",
			edgeWidth: 1200,
			lifetime: [5, 8],
			speed: [30, 70],
			size: [2.5, 6],
			gravity: [0, 12],
			damping: 0.1,
			wobble: [14, 1.4],
			renderShape: "circle",
			blendMode: "source-over",
			startColorA: [1, 1, 1, 0.95],
			startColorB: [0.8, 0.88, 1, 0.55],
			colorOverLifetime: [
				{ time: 0, color: [1, 1, 1, 0] },
				{ time: 0.06, color: [1, 1, 1, 1] },
				{ time: 1, color: [1, 1, 1, 0] },
			],
		},
	],
};

class SnowScene extends Scene {
	async load(engine) {
		await super.load(engine);
		const root = this.getRoot();
		for (const description of vfxAsset.systems) {
			const node = new WorldNode();
			node.setName(description.name);
			node.setLocalPosition(Vector2.create(640, 0));
			const particleSystem = node.addComponent(ParticleSystem);
			particleSystem.applyDescription(description);
			root.addChild(node);
		}
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
const engine = new Engine(engineConfiguration);
engine.run(new SnowScene());
```

### Controlling time yourself

With `setManualTick(true)`, time does not advance with node updates, only when you call `simulate(timeDelta)`. With `setRandomSeed(seed)`, spawn randomness follows that seed and returns to it on every `stop(true)`, so rewinding produces the same result. `Timeline` handles particle nodes this way (see the "Tweens and Timelines" chapter).

## TrailRenderer

Records the path a node travels as points and draws it as a band whose width and color fade out (the 2D counterpart of Unity's TrailRenderer). Points are recorded at the node's local position.

- `setTime(seconds)`: how long points remain, which is the length of the band (default 0.5).
- `setWidth(startWidth, endWidth)`: width from the newest point to the end (default 10, 0).
- `setColors(startColor, endColor)`: by default from `(1, 1, 1, 0.9)` to `(1, 1, 1, 0)`.
- `setMinVertexDistance(distance)`: the node must move this far to add a point (pixels, default 3).
- `setAdditive(isAdditive)`, `setEmitting(isEmitting)` (when off, no new points are made), and `clear()`.

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, Paint, TrailRenderer, Vector2, Color } from "./build/vanilla.js";

class TrailScene extends Scene {
	#cometNode;
	#elapsedSeconds;

	constructor() {
		super();
		this.#cometNode = null;
		this.#elapsedSeconds = 0;
	}

	async load(engine) {
		await super.load(engine);
		const cometNode = new WorldNode();
		cometNode.setContentSize(Vector2.create(16, 16));
		cometNode.setLocalPosition(Vector2.create(640, 360));
		const trail = cometNode.addComponent(TrailRenderer);
		trail.setTime(0.5);
		trail.setWidth(14, 0);
		trail.setColors(new Color(0.4, 0.8, 1, 0.9), new Color(0.4, 0.8, 1, 0));
		trail.setAdditive(true);
		const paint = cometNode.addComponent(Paint);
		paint.setColor(new Color(1, 1, 1, 1));
		paint.setRoundSize(8);
		const root = this.getRoot();
		root.addChild(cometNode);
		this.#cometNode = cometNode;
	}

	tick(timeDelta) {
		super.tick(timeDelta);
		this.#elapsedSeconds += timeDelta;
		const angle = this.#elapsedSeconds * 2;
		const position = Vector2.create(640 + Math.cos(angle) * 260, 360 + Math.sin(angle) * 160);
		this.#cometNode.setLocalPosition(position);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
const engine = new Engine(engineConfiguration);
engine.run(new TrailScene());
```

## ShaderSprite

A sprite derived from `Sprite` that applies fragment shader effects. `ShaderSpriteEffect` has 49 effects besides `none` (such as `flash`, `outline`, `shine`, `dissolve`, `hologram`, `wave`, `pixelate`, `glitch`, and `wipe`). Each effect has default parameters and a default color, and the `ShaderSpriteEffect` comments in the source describe what progress, color, and parameters mean for each effect.

- `setEffect(effect)` changes the effect and resets to that effect's default parameters and color. With `none`, or without an image, it draws the same as `Sprite`.
- `setEffectProgress(progress)` (0 to 1) is the progress pushed in by tweens or timelines. The effect time (`setEffectTime`) advances by itself in `tick`.
- `setEffectColor(color)`, `setEffectParameters(x, y, z, w)`, `setEffectSeed(seed)` (when you want the same noise pattern), and the static `ShaderSprite.getDefaultParameters(effect)` and `ShaderSprite.getDefaultColor(effect)`.

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, ShaderSprite, ShaderSpriteEffect, ImageAsset, Tween, Vector2, Rect, Color } from "./build/vanilla.js";

class DissolveScene extends Scene {
	#shaderSprite;

	constructor() {
		super();
		this.#shaderSprite = null;
	}

	async load(engine) {
		await super.load(engine);
		const imageAsset = new ImageAsset();
		await imageAsset.load("examples/assets/spritesheet.png");
		const node = new WorldNode();
		node.setContentSize(Vector2.create(300, 300));
		node.setLocalPosition(Vector2.create(640, 360));
		const shaderSprite = node.addComponent(ShaderSprite);
		shaderSprite.setImage(imageAsset);
		shaderSprite.setImageRect(Rect.create(0, 0, 200, 200));
		shaderSprite.setEffect(ShaderSpriteEffect.dissolve);
		shaderSprite.setEffectColor(new Color(1, 0.5, 0.1, 1));
		const root = this.getRoot();
		root.addChild(node);
		this.#shaderSprite = shaderSprite;
	}

	initialize(engine) {
		super.initialize(engine);
		this.startDissolve(0, 1);
	}

	startDissolve(startProgress, endProgress) {
		const shaderSprite = this.#shaderSprite;
		const tween = new Tween({ progress: startProgress });
		tween.to({ progress: endProgress }, 1.5);
		tween.easing(Tween.easingFunction.sinusoidal.inOut);
		tween.setUpdate((values) => {
			shaderSprite.setEffectProgress(values.progress);
		});
		tween.setComplete(() => {
			this.startDissolve(endProgress, startProgress);
		});
		this.startTween(tween);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
const engine = new Engine(engineConfiguration);
engine.run(new DissolveScene());
```

## ScreenEffect

A post-processing chain applied to the whole scene. The scene draws to the screen as usual, and in `end` the screen (or a chosen region) is captured, the enabled effects are applied in order, and the result is put back in the same place. `ScreenEffectType` has 58 effects (such as `vignette`, `shockwave`, `bloom`, `colorGrade`, `chromatic`, `grain`, `fog`, and `fade`).

- Create it with `new ScreenEffect(engine.getGraphic())`, and call `begin(graphic)` at the start of the scene's `preDraw`, `end(graphic)` at the end of `postDraw`, and `tick(timeDelta)` in `tick`.
- `setEnabled(type, isEnabled)`, `setStrength(type, strength)` (0 is the same as off), `setParameters(type, x, y, z, w)`, `setParameter(type, name, value)` (names are in `SCREEN_EFFECT_PARAMETER_NAMES`), `setColor(type, color)`, `disableAll()`, and `resetAll()`.
- `setRegion(x, y, width, height, cornerRadius)` limits effects to a region in canvas pixels (top-left origin). `clearRegion()` returns to the whole screen.
- Effects are applied in a fixed order (shape distortion, blur, glitch, color, pattern, transition; `ScreenEffect.getEffectOrder()`).
- It has `setTimelineProperty(name, value)`, so it can be a `Timeline` target. `"vignette"` is the strength (0 turns it off), `"shockwave.radius"` is a parameter, and `"fade.color"` is a color.
- It uses WebGL resources, so call `destroy()` when you are done.

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, Paint, ScreenEffect, ScreenEffectType, Vector2, Color } from "./build/vanilla.js";

class ScreenEffectScene extends Scene {
	#screenEffect;
	#shockwaveSeconds;

	constructor() {
		super();
		this.#screenEffect = null;
		this.#shockwaveSeconds = -1;
	}

	async load(engine) {
		await super.load(engine);
		const graphic = engine.getGraphic();
		const screenEffect = new ScreenEffect(graphic);
		screenEffect.setEnabled(ScreenEffectType.vignette, true);
		screenEffect.setColor(ScreenEffectType.vignette, new Color(0, 0, 0, 1));
		this.#screenEffect = screenEffect;

		const root = this.getRoot();
		for (let index = 0; index < 5; ++index) {
			const node = new WorldNode();
			node.setContentSize(Vector2.create(160, 160));
			node.setLocalPosition(Vector2.create(240 + index * 200, 360));
			const paint = node.addComponent(Paint);
			paint.setColor(new Color(0.2 + index * 0.15, 0.5, 1 - index * 0.15, 1));
			paint.setRoundSize(24);
			root.addChild(node);
		}
	}

	async unload(engine) {
		await super.unload(engine);
		this.#screenEffect.destroy();
	}

	tick(timeDelta) {
		super.tick(timeDelta);
		const screenEffect = this.#screenEffect;
		screenEffect.tick(timeDelta);
		if (this.#shockwaveSeconds >= 0) {
			this.#shockwaveSeconds += timeDelta;
			const radius = this.#shockwaveSeconds * 1.5;
			screenEffect.setParameter(ScreenEffectType.shockwave, "radius", radius);
			if (radius > 1.5) {
				screenEffect.setEnabled(ScreenEffectType.shockwave, false);
				this.#shockwaveSeconds = -1;
			}
		}
	}

	preDraw(graphic) {
		super.preDraw(graphic);
		this.#screenEffect.begin(graphic);
	}

	postDraw(graphic) {
		super.postDraw(graphic);
		this.#screenEffect.end(graphic);
	}

	touchPress(viewInputPosition) {
		super.touchPress(viewInputPosition);
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		const viewSize = viewManager.getViewSize();
		const screenEffect = this.#screenEffect;
		screenEffect.setEnabled(ScreenEffectType.shockwave, true);
		screenEffect.setParameter(ScreenEffectType.shockwave, "centerX", viewInputPosition.x / viewSize.x);
		screenEffect.setParameter(ScreenEffectType.shockwave, "centerY", viewInputPosition.y / viewSize.y);
		this.#shockwaveSeconds = 0;
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
const engine = new Engine(engineConfiguration);
engine.run(new ScreenEffectScene());
```

## HeatHazeEffect

Captures the canvas content drawn before its node, within the node's area, and redraws it with each row swaying left and right. The area uses the node's content size and pivot; if the content size is empty when attached, it becomes 300 x 300.

- Because it captures what was drawn before, attach it to the node drawn last in the scene to see the effect. That node's children are drawn on top of the effect.
- `setAmplitude(pixels)` (sway width, default 3), `setFrequency(value)` (frequency multiplied by row position, default 0.05), and `setSpeed(value)` (speed multiplied by time, default 2).
- When the area goes off screen, the edge pixels are stretched. The captured texture is a GL resource, so call `destroy()` when you are done.

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, Paint, HeatHazeEffect, Vector2, Color } from "./build/vanilla.js";

class HeatHazeScene extends Scene {
	async load(engine) {
		await super.load(engine);
		const root = this.getRoot();
		for (let index = 0; index < 6; ++index) {
			const stripeNode = new WorldNode();
			stripeNode.setContentSize(Vector2.create(40, 400));
			stripeNode.setLocalPosition(Vector2.create(390 + index * 100, 360));
			const paint = stripeNode.addComponent(Paint);
			paint.setColor(new Color(1, 0.6 + index * 0.06, 0.2, 1));
			root.addChild(stripeNode);
		}

		const hazeNode = new WorldNode();
		hazeNode.setContentSize(Vector2.create(600, 300));
		hazeNode.setLocalPosition(Vector2.create(640, 360));
		const heatHazeEffect = hazeNode.addComponent(HeatHazeEffect);
		heatHazeEffect.setAmplitude(4);
		heatHazeEffect.setFrequency(0.08);
		heatHazeEffect.setSpeed(3);
		root.addChild(hazeNode);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
const engine = new Engine(engineConfiguration);
engine.run(new HeatHazeScene());
```

## Things to watch out for

- `ParticleSystem` starts looping emission as soon as it is attached. For one-shot effects, set `setEmissionRate(0)` and use `emit` or bursts.
- Rotation and cone angles are in radians (node rotation is in degrees).
- Screen coordinates have +y pointing down, so gravity that pulls upward is negative.
- `ParticleRenderShape.image` draws each particle separately, so emitting many slows things down.
- `HeatHazeEffect` and `ScreenEffect` capture what is already on screen. Draw order (which node is drawn last, where `begin` and `end` are called) decides the result.

## Related classes

ParticleSystem, ParticleEmitterShape, ParticleRenderShape, TrailRenderer, ShaderSprite, ShaderSpriteEffect, ScreenEffect, ScreenEffectType, HeatHazeEffect, Sprite, Tween, Timeline
