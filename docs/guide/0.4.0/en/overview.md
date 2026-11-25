# vanilla.js

**A lightweight web game engine built with vanilla JavaScript and no external dependencies**

## Introduction

vanilla.js is a web game engine that runs directly in the browser without external libraries.
Load a single bundle as a module and scenes, nodes, input, UI, particles and audio are all ready.

- Zero runtime dependencies. Bundling the current source (2026-11-26 dev) with the commands below gives `vanilla.min.js` at about 765 KB, about 215 KB gzipped
- WebGL2 renderer. Sprites, text, shapes and masks share the same output path, and batching and off-screen culling are on by default
- Blend modes cover all 26 Canvas2D compositing modes. 13 of them, such as overlay, soft-light and hue, plus multiply when drawing to a render target, copy the area under the draw region and blend in a shader following the W3C Compositing and Blending formulas
- A UI system with a node / component structure, resolution-aware views, constraint-based layout and window stacking
- Particles, shader effects, timelines, skinned 3D and toon 3D sit on top of the same API
- Public API and behavior are kept in line with [vanilla-engine](https://github.com/ddukbaek2/vanilla-engine), the Rust port
- JSDoc types cover the entire public API, so editor autocompletion and type hints work

## Key Features

| Area | Contents |
| --- | --- |
| Core | `Engine` loop (max FPS, page events, screen capture for verification), `Scene` / `SceneManager`, `Node` hierarchy (`WorldNode` / `UINode`), `Component`, `TimeManager`, `InputManager` (mouse buttons, finger list, last input device, keys to block), `InputActions` (input actions), `GamepadManager` (vibration, pad type), `ViewManager` (resolution handling, safe area, render scale cap), `TouchRaycaster` / `TouchRecognizer`, `PointerCursor` |
| Rendering | WebGL2 `Graphic` (sprites, text, rich text, shapes, rounded rectangles, rings and arcs, line segment batches, stencil clipping, 26 blend modes), batching and off-screen culling (on by default), `Mask`, `Outline`, `SoftShade`, `ShadowText`, `ShadowImage`, `Camera2D`, glyph texture cache, shader program switching, `ShaderWarmer` |
| UI | Button / toggle / scroll view / scroll bar / slider / input field / progress bar / progress ring / list view / dropdown / context menu / dialog / toast / spinner / line and bar charts, window stacking (`UIWindowLayer`, `UIWindow`, `UIConfirmWindow`), `ButtonMotion`, `ToastMotion`, `UIHitArea`, `UIScale`, `UIDocument`, constraint-based layout (`LayoutSolver`) |
| Effects | `ParticleSystem` (emission shapes, render shapes, bursts, lifetime curves, attractors, world space), `TrailRenderer`, 49 `ShaderSprite` types, 58 `ScreenEffect` types, `HeatHazeEffect`, `Shaker`, `FloatingText` |
| Animation | `Timeline` runtime (track interpolation, 31 easings + Bezier, events / markers / sounds / particles), `Animator` state machine, `Tween` (including node property tweens), `SpriteAnimator` |
| 3D (experimental) | `SkinnedModel` (glTF / GLB / FBX, skinning, morph targets), `SkinnedModelRenderer`, `HumanSkinRenderer`, `ShadowMap`, `BloomEffect`, `MultiLevelBloomEffect`, `AmbientOcclusionEffect`, `SubsurfaceScatteringEffect`, `Camera3D`, `Material` / `RenderTarget` (multisample) / `FullscreenPass` |
| Toon 3D (experimental) | `ToonRenderer` (cel shading, shell outlines, instancing, shadows, `ToonLightSet` light sets and point lights, `ToonMaterial` shader snippets, instance formats and persistent instance buffers), `ToonMesh` / `ToonGlb`, `ToonDrawQueue` (draw stage callbacks), `ToonScreenOutline`, `ToonVfx`, `ToonPostProcess` (MSAA, multi-level bloom, color grading), `ToonView3D` |
| Game helpers | `FiniteStateMachine`, `PathFinder`, `Grid`, `Collision2D`, `Steering2D`, `PlatformerBody`, `ObjectPool`, `SeededRandom`, `FixedStepper`, `Localization`, `LanguagePack`, `UIFont`, `DynamicFont`, `Format`, `PersistedStore`, `LocalStorage`, `DialogueRunner`, `Typewriter`, `CameraGestures`, `FrameProbe`, `GraphicsQualityGovernor`, `BuildInfo` |
| Assets | `ImageAsset`, `TextAsset`, `JsonAsset`, `BlobAsset`, `FontAsset`, `AudioAsset`, `AssetLoader` (concurrent loading, progress, failure list), `LoadingProgress`, `SpriteAtlas` |
| Audio | `AudioPlayer`, `AudioBus`, `SoundSystem` (sound table, background music, sound effect bus, mute rules), `SoundEffectPool`, `BeepPlayer` |

## Games

Playable results made with the engine.

| Game | Link |
| --- | --- |
| Tales of Cultivation | [Open](https://ddukbaek2.com/portfolio/talesofcultivation/) |
| Pipe Mania | [Open](https://ddukbaek2.com/portfolio/pipemania/) |
| Scramble Heroes | [Open](https://ddukbaek2.com/portfolio/scramble-heroes/) |

## Repository Structure

```
src/            Engine source
	base/         Math, color, data structures, random numbers
	core/         Engine loop, scenes, nodes, input, rendering (Graphic), sound
	ui/           UI components, layout
	effect/       Particles, trails, ShaderSprite, ScreenEffect, HeatHazeEffect
	experimental/ 3D graphics (including toon 3D), timeline, collections
	game/ misc/   Game helper features
	resource/     Asset loader
	web/          Browser integration
examples/       Samples (same source as the deployed builds)
tools/          Web authoring tools and command-line tools
build/          Bundle output (vanilla.js / vanilla.min.js)
import.js       Public API entry point
UPDATE.md       Update history
```

## Development Environment

- Windows 11 Pro, macOS (Apple silicon)
- VSCode
	- Gemini Code Assist / Korean Language Pack / Live Server / Task Explorer
- Node.js v25
	- esbuild (bundling), jsdoc (documentation generation)

## Links

- Repository: <https://github.com/ddukbaek2/vanilla.js>
- Template: <https://github.com/ddukbaek2/playablegame-template>
- Template: <https://github.com/ddukbaek2/retrogame-template>
- Deployment page: <https://ddukbaek2.com>

## License

[MIT](https://github.com/ddukbaek2/vanilla.js/blob/release/LICENSE) © ddukbaek2
