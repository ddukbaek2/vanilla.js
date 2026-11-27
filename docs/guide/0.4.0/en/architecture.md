# vanilla.js Architecture Design Document

This design document organizes the class composition and ownership structure of the whole engine. It is not an API reference but a document for seeing "what creates what, what holds what, and in what order things run".

- Reference date: 2026-11-26 (dev)
- Reference source: all of `src/` (200 .js files, not counting the draft area src/experimental) + `import.js`

---

## 1. Overall Layout

```
import.js                  # Single public API barrel. Consumers import only this one file
src/base/                  # Engine-independent base types (Object, Node, math, color, platform, Format, FSM, timer, random)
src/core/                  # Engine body (Engine, managers, Scene, Node family, Graphic, Component, input, sound, FullscreenPass)
src/core/node/             # ComponentNode → TransformNode → WorldNode
src/core/component/        # Paint, Sprite, Text, RichText, Mask, Outline, SoftShade, ShadowText, ShadowImage
src/core/graphic/          # ShaderProgram, ShaderWarmer, ImageTextureCache, TextStringTextureCache, sharedbakecache(sharing baked images)
src/resource/              # Asset derivatives (Image/Audio/Text/Json/Font/Blob/Bunch/Visual) + AnimationClip, AssetLoader, SpriteAtlas
src/effect/                # ParticleSystem, TrailRenderer, ShaderSprite, ScreenEffect, HeatHazeEffect
src/ui/                    # Two-branch UI (Component-family UIView / Node-family UINode) + window stacking, motion + autolayout/
src/misc/                  # DevTools, NodeLayout, DynamicFont, LanguagePack, UIFont, CameraGestures, FrameProbe,
                           #     GraphicsQualityGovernor, FixedStepper, LoadingProgress, BuildInfo, VirtualPad, Visual, Indicator and other add-on features
src/web/                   # DOM-area utilities (Pane, WebSocketClient). The world outside the canvas
src/game/                  # GameScene (common base scene for games)
src/base/collection/       # List, Dictionary, Queue, Stack, Set (in the Rust version the standard Vec, HashMap and the like do this)
src/animation/             # Timeline, Animator, Action
src/graphics3d/            # 3D (WebGL2): FbxLoader, SkinnedModel, Material, SkinnedModelRenderer, HumanSkinRenderer, Camera3D,
                           #     ShadowMap, RenderTarget, BloomEffect, MultiLevelBloomEffect,
                           #     AmbientOcclusionEffect, SubsurfaceScatteringEffect (FullscreenPass is in core)
src/graphics3d/toon/       # Toon 3D: MeshBuilder, glbmeshreader, ToonRenderer, ToonLightSet, ToonMaterial,
                           #     ToonDrawQueue, ToonScreenOutline, ToonVfx, ToonPostProcess, ToonView3D
src/deprecated/            # AnchoredWorldNode (deprecated), Camera (to be deprecated, Camera2D covers it), dead code aabb, transform2d, gl2d, webgl2
```

Layers depend only from bottom to top: `base` ← `core` ← (`resource`, `effect`, `ui`, `game`, `misc`, `animation`, `graphics3d`). `src/web` is a DOM world unrelated to the engine node tree.

---

## 2. Design Principles

1. **Global built-in object convention**: Because the engine shadows names such as `Object` and `Math` with its own classes, JavaScript built-ins must always be accessed through `const System = globalThis`, as `System.Math` and `System.Object`. The `export const System = globalThis` at the very top of `import.js` brings this convention into the API surface.
2. **Single root class**: Almost every class inherits `base/Object`. Object provides the slots for a GUID (instanceId), cloning (clone/structuredClone), equality (equals) and the destruction hook (destroy).
3. **No GameObject/Component world (3D)**: The 3D side is not a scene-graph entity system. The loader creates a self-contained model instance called `SkinnedModel`, and meshes, bones, skins, materials and animations are all connected inside it.
4. **An importer is only an importer**: `FbxLoader` only parses. It holds no GL resources or shading logic. Per-format interpretation results converge into a common neutral schema, which the model then consumes.
5. **Shader, Material, Model hierarchy (Unity/Unreal philosophy)**: A Material is an instance that references a shader (template), the model references a Material instance per drawable, and the renderer draws them.
6. **Separation of model and render functionality**: `SkinnedModel` holds only data + pose state. Drawing is done by a separate object, `SkinnedModelRenderer`. Environment state (sun/fog/shadow) is also owned by the renderer, not the model. Toon 3D is the same: the mesh arrays (MeshBuilder, readGlbArrays), the renderer (ToonRenderer) and the light values (ToonLightSet) are separate.
7. **2D and 3D share one GL context**: core's `Graphic` (2D) and graphics3d (3D) coexist on the same `WebGL2RenderingContext`. 3D inserted between 2D draws is wrapped with `Graphic.runExternalPass`.
8. **Same as the Rust version**: The Rust version [vanilla-engine](https://github.com/ddukbaek2/vanilla-engine) is a port of this engine, and the two engines keep no feature differences. General-purpose features that appear on only one side and bugs found on one side are put into both. (Section 9)

---

## 3. Inheritance Hierarchy

```
Object (base/object.js)
├── Node (base): parent/child hierarchy + activation
│   └── ComponentNode (core): holds components + tick
│       └── TransformNode (core): local TRS + render recursion
│           ├── WorldNode (core): pivot/anchor/contentSize + touch (manual placement track)
│           │   ├── UIScrollBar, UIInputField, UIDropdown, UIContextMenu, UIDialog, UIToast, UISpinner (ui)
│           │   ├── UIWindow → UIConfirmWindow, UIWindowLayer (ui)
│           │   ├── FloatingText, TouchEffect (misc)
│           │   └── AnchoredWorldNode (deprecated)
│           └── UINode (ui): autolayout constraint variables (solver placement track)
├── Component (core): functional unit attached to a node
│   ├── Paint → Sprite → ShaderSprite (effect)
│   ├── Text → RichText
│   ├── Mask, Outline, SoftShade, ShadowText, ShadowImage
│   ├── ParticleSystem, TrailRenderer, HeatHazeEffect (effect)
│   ├── SpriteAnimator, PlatformerBody (misc)
│   ├── Visual (misc), ToonView3D (graphics3d/toon)
│   ├── UIProgressRing, UIHitArea, UIListView, UILineChart, UIBarChart, ButtonMotion, ToastMotion (ui)
│   └── UIView (ui): UI widget base
│       ├── UILabel, UIImageView, UIProgressView
│       ├── UIScrollView → UISnapScrollView
│       └── UIControl → UISlider / UIDraggable / UIButton → UIToggleButton
├── Scene (core)
│   ├── GameScene (game): WorldNode-track base scene
│   └── UIScene (ui): UINode + solver track base scene
├── Asset (core)
│   ├── ImageAsset, AudioAsset, FontAsset, VisualAsset
│   ├── TextAsset → JsonAsset
│   └── BlobAsset → BunchAsset
├── TouchRaycaster (core) → TouchRecognizer (ui)
├── Singleton (base) → PointerCursor (core)
├── Engine/managers: Engine, EngineConfiguration, SceneManager, TimeManager,
│                ViewManager, InputManager, InputActions, GamepadManager, AudioManager
├── Render: Graphic, ShaderProgram, ImageTextureCache, TextStringTextureCache
├── 3D (graphics3d, FullscreenPass is in core): FbxLoader, SkinnedModel, SkinnedModelRenderer → HumanSkinRenderer,
│                Material, ShadowMap, RenderTarget, FullscreenPass, BloomEffect, MultiLevelBloomEffect,
│                AmbientOcclusionEffect, SubsurfaceScatteringEffect
├── Math/data: Vector2/3, Matrix4, Quaternion, TransformMatrix, Rect, OBB, Color,
│                List/Dictionary/Queue/Stack/Set, FiniteStateMachine, ObjectPool, SeededRandom
└── Other: Tween, Animation, Frame, Animator, Action, Timeline, DevTools, NodeLayout, AssetLoader, SpriteAtlas,
          DynamicFont, VirtualPad, WebSocketClient, Camera2D, FixedStepper, LoadingProgress, BuildInfo ...
```

Two branches to note:
- Under `TransformNode`, the **WorldNode track** (pivot/anchor manual placement) and the **UINode track** (constraint-solver automatic placement) split, and the two have no inheritance relationship.
- UI widgets are a mix of **ones that are nodes and ones that are Components**. The `UIView extends Component` family (labels, buttons, scroll views, etc.) and the progress ring, list view, charts and motions are components, while widgets that build their own child nodes (scroll bar, input field, dropdown, context menu, dialog, toast, spinner, window and window layer) are nodes that inherit `WorldNode`.

Exceptions that do not inherit Object: `AudioPlayer`, `AudioBus`, `SoundSystem`, `ShaderWarmer`, `Pane`, `PaneStyle`, `FrameProbe`, `CameraGestures`, `GraphicsQualityGovernor`, `UIScale`, `Camera3D`, toon 3D (`MeshBuilder`, `ToonRenderer`, `ToonLightSet`, `ToonMaterial`, `ToonInstanceLayout`, `ToonDrawQueue`, `ToonScreenOutline`, `ToonPostProcess`, `ToonVfx`), all of autolayout (`LayoutSolver` etc., an independent math module).

---

## 4. Ownership Structure

"A ── B" means A creates and owns B. "(reference)" means only a reference is held.

### 4-1. Engine Root

```
Engine
├── EngineConfiguration (reference, injected externally)
├── Platform ─────────────── responsible for obtaining the canvas
├── Graphic ──────────────── owns the WebGL2 context + 2D render pipeline
│   ├── ShaderProgram (2D built-in shaders, batch, particle, blend-mix shaders)
│   ├── ImageTextureCache ── WeakMap<image, texture> (collected together when the source is GC'd)
│   ├── TextStringTextureCache ── string → texture LRU (cap 512) + offscreen 2D canvas, text measurement cache (2048)
│   └── VAO/VBO/scratch buffer/1x1 white texture, backdrop slot for blend mixing
├── SceneManager ─────────── keeps the list of loaded Scenes (creating Scenes is the caller's job)
├── TimeManager
├── ViewManager ──────────── canvas (reference) + view scale/coordinate conversion, safe area, render scale cap
├── InputManager
│   ├── GamepadManager ───── the gamepad is under InputManager, not directly under Engine
│   └── InputActions ─────── input actions (updated in tick)
├── AudioManager ─────────── creates AudioContext lazily. Ownership of AudioPlayer and AudioBus (createAudioBus, which makes players that play through that bus) is handed over after creation
└── Version
PointerCursor (Singleton) ── the engine sets the canvas cursor with apply() at the end of every frame (only when enabled)
```

- On creation, `Engine` registers itself in the `System.vanillaEngine` global and provides the `Engine.getEngine()` static accessor. It is effectively an implicit singleton.
- The rAF loop is also owned by Engine (`Frame` in `frame.js` is not a loop but a sprite image region class).

### 4-2. Scene → Node Tree

```
SceneManager ── Scene[] (kept, lifecycle only. The caller creates instances with new)
Scene
├── Engine (reference, injected by SceneManager)
├── root WorldNode ("root") ── created at create() time (note: not in the constructor)
└── Tween[] ── registered with startTween, removed automatically on completion

Node tree: the parent owns children[] + the child back-references parent
ComponentNode ── Component[] ── addComponent(type) creates it directly with new, puts it in the list, adds require() dependencies recursively, then attaches
Component ── owning node (reference)
```

- A scene-layer structure does not exist. `core/layer.js` is an empty stub and is not used anywhere. The actual structure is scene → root node → node tree.

### 4-3. UI

```
UIScene
├── LayoutSolver ─────────── the scene owns the solver. UINode receives it via setSolver() and uses it
├── screenNode / safeAreaLayoutGuide (UINode) ── pure guides not put into the tree
├── DevTools (F2 hierarchy/inspector, absent if EngineConfiguration.useDevTools is off)
└── TouchRecognizer ──────── UIKit-style gestures (drag threshold + delaysContentTouches)

UINode
├── 8 LayoutVariables (left/right/top/bottom/width/height/centerX/centerY)
├── 4 essential constraints (right=left+width etc.) + user constraints + intrinsic constraints
└── layoutMarginsGuide (child UINode, lazy)

UIView(Component).attach(node)
└── creates the content WorldNode → adds it as a child of the host node (tree ownership stays with the host)
UILabel ── declares Text/RichText via require() → owned by the host ComponentNode
UIScrollView ── require()s Mask, the scrollbar is created as a sibling of host
UIWindowLayer (node) ── UIWindow[] (only the top window is visible, enlarges the layer by UIScale, detaches a window when its closing motion ends)
```

Touch flow: DOM event → Engine → InputManager flags → Scene.tickTouch → the scene's touch raycaster (TouchRaycaster; UIScene and GameScene use a TouchRecognizer from their touch hooks) traverses the root tree in draw order and selects the topmost interactable WorldNode → the node passes it to its components → a Component such as UIButton handles it. The wheel goes to the scroll area that is frontmost in draw order among those covering that spot. (TouchRaycaster.touchWheel)

### 4-4. Assets

- **There is no central resource manager** (`core/resources.js` is an empty file). Assets are owned per instance via `new ImageAsset()` → `await load(path)`, and are usually held by the scene as members. Bytes already in hand are read with `loadFromBytes`. (For fonts, `loadFontFromBytes`)
- When loading several together, `AssetLoader` loads up to a concurrency count (default 6) at a time and tracks progress and the failure list. The loaded assets are still held by the caller. `SpriteAtlas` reads the JSON and page images baked by tools/atlas.cjs.
- Caches exist only at the GPU resource level and are owned by `Graphic` (ImageTextureCache / TextStringTextureCache). Images baked by ShadowText, ShadowImage and SoftShade are shared among identical shapes in sharedbakecache.js.

### 4-5. 3D Stack (graphics3d)

```
Scene (sample code)
├── SkinnedModelRenderer ── one per scene (HumanSkinRenderer inherits it and adds skin, eye and hair shading)
│   ├── ShaderProgram (skinning PBR shader = material template)
│   ├── ShaderProgram (depth pass shader, shadow casting)
│   └── environment state: sunDirection / fogColor / fogRange / shadowMap / shadowStrength
├── SkinnedModel ── model instance, multiple allowed (no render functionality)
│   ├── nodeList (bone hierarchy + pose state: currentTRS, worldMatrix)
│   ├── skinList (jointNodeIndices + inverseBindMatrices + jointMatrixArray)
│   ├── drawableList ── { VAO, indices, skinIndex, material(reference) }
│   ├── Material[] ── instances referenced by drawables
│   │   ├── ShaderProgram (reference, the renderer's template)
│   │   ├── PBR factors (baseColor/metallic/roughness/emissive)
│   │   └── 7 GL texture types (baseColor/normal/metallicRoughness/glossiness/
│   │                           occlusion/emissive/specular, 1x1 substitute if missing)
│   └── animationList ── clips (channel = node index + time/value curves)
├── Camera3D ── perspective/orthographic, view and projection matrices, world point to screen rectangle position (shared by the renderer and 2D display)
├── ShadowMap ── depth texture + orthographic light matrix (texel snapping)
├── RenderTarget ── offscreen FBO (basic unit of post-processing, multisample and depth bit options)
├── FullscreenPass ── fullscreen triangle pass
└── BloomEffect, MultiLevelBloomEffect ── bright area extraction → blur (multi-level halves down and scales up with a tent shape) → composite chain

Toon 3D (graphics3d/toon)
├── MeshBuilder, glbmeshreader ── building vertex arrays and reading GLB (including UV and material ranges, GL-independent)
├── ToonRenderer ── body, outline shell and shadow depth programs + programs built per material and instance layout
│   ├── ToonLightSet (default light set: sun, fill light, rim, specular, 8 point lights, band ramp, light shape)
│   └── ToonMaterial (reference, shader fragments: uniform, surface, light, vertex)
├── ToonDrawQueue ── holds the models to draw in one frame and draws opaque, outline, translucent in order + stage callbacks
├── ToonScreenOutline ── draws the same models once more for screen-space outlines from normals, line IDs and depth
├── ToonVfx ── code-built atlas and instanced GPU effects (particles, fireballs, shockwaves, marks, pillars, beams, ribbons, lightning, light dots)
├── ToonPostProcess ── RenderTarget (multisample, floating-point) + BloomEffect or MultiLevelBloomEffect + tone mapping and color correction
└── ToonView3D (Component) ── draws toon 3D inside the node rectangle with runExternalPass (a renderer can be shared by multiple nodes)
```

- `FbxLoader` is a **pure parser** outside the ownership relationships. `SkinnedModel.loadFromFbxUrl` creates it temporarily, uses it and discards it.
- `ShaderProgram` belongs to core/graphic and is a common part shared by 2D/3D.
- Texture unit assignment convention: 0 = baseColor, **1 = shadow map only (model materials must not use it)**, 2~7 = normal/metallicRoughness/glossiness/occlusion/emissive/specular. The toon renderer uses shadow 3, base color 4, emission 5, decal 6, materials 7~15.

---

## 5. Frame Loop

```
new Engine(config) → create managers + bind DOM events + resize()
engine.run(scene)  → load default font + sceneManager.loadScene(scene) + start rAF

Every frame, Engine.updateEngine(timestamp):
0. Max FPS limit                # decides the turn by the number of frames processed since counting began, and skips frames that arrive earlier than their turn
1. graphic.applySettings()      # update viewport/projection + reset state + clear stencil + forget batch memory
2. timeManager.update()         # compute timeDelta
3. inputManager.tick()          # includes gamepad polling and input action updates
4. For each loaded scene:
   - unloaded scene → drawOnLoad() only (loading screen)
   - scene.tick(timeDelta)      # root.tick recursion (tick only components whose isTickNeeded is true) → touch dispatch (both press and release within one frame) → tweens
   - graphic.invalidateRenderStateCache() → scene.preDraw / draw / postDraw → (gizmos)   # default draw implementation = graphic.drawNode(root) recursion
   (try/catch per scene, an exception in one scene does not kill the loop)
5. Stats output (optional) → flushBatch (remaining batch) → PointerCursor.apply() → clear one-shot input flags → screen capture for verification (requestFrameCapture, ?capture=) → next rAF
```

Node render recursion: `drawNode` = pushTransform (local TRS/pivot correction) → (skip if off screen) component draw → child recursion → popTransform. The `Mask` component sets and releases a stencil clip before and after drawing children.

3D scenes (ancientmountain etc.) use **their own rAF + their own pass composition** instead of this loop: shadow depth pass (`ShadowMap.beginRender` → `renderer.drawDepth`) → scene pass (RenderTarget) → main pass (`renderer.draw`) → post (BloomEffect) → HUD (Graphic 2D). When inserting 3D between 2D inside the engine loop, `Graphic.runExternalPass` draws the preceding batch, forgets the state memory, clears depth, then calls the pass and restores with `restoreRenderState`.

---

## 6. Rendering Structure

### 6-1. 2D: core/Graphic

- It is **WebGL2-based** (not Canvas2D, no fallback). It reproduces the API surface of the Canvas2D era (top-left origin, save/restore state stack, fillRect/drawImage/fillText) on top of WebGL2.
- All draws converge to a single point, `drawVertices()` (the batching insertion point). Solid-color shapes are also unified with the texture path via a 1x1 white texture.
- Batched drawing (`setBatchingEnabled`) and off-screen culling (`setCullingEnabled`) are on by default. Culling skips drawing a node's components when all enabled components report that they draw only inside the content area (`isDrawnInsideContent`) or report the rectangle they draw (`calculateDrawnRect`, single-line and multi-line Text), and that bounding box does not overlap the screen.
- It remembers the shader program last put in use and the texture of texture unit 0, and does not bind them again if they are the same. After touching WebGL without going through Graphic, call `invalidateRenderStateCache`. (restoreRenderState, applySettings, and losing or restoring the context make it forget on its own)
- Clipping is stencil-buffer based (handles rotated/scaled masks accurately). Text is baked into an offscreen 2D canvas and output as a texture.
- Blending draws all 26 Canvas2D composite strings. 13 of them (Porter-Duff operators, lighter, multiply, screen) use fixed blending, and the remaining 13 (overlay, darken, lighten, color-dodge, color-burn, hard-light, soft-light, difference, exclusion, hue, saturation, color, luminosity) copy the area under each draw from the current framebuffer with `blitFramebuffer` and mix in a shader following the W3C Compositing and Blending Level 1 formulas (no batching in mix modes; a swapped-in shader is first drawn to an overlay slot, then mixed and transferred). multiply uses fixed blending on the default framebuffer and mixes in a shader only when drawing to a render target (while a framebuffer is bound) (because fixed blending differs from the W3C formula when the backdrop is translucent). Unlike Canvas2D, source-in, source-out, destination-in, destination-atop and copy change only the inside of the drawn shape.

### 6-2. 3D: graphics3d

Import pipeline (format neutralization is the key):

```
mannequin.fbx ──> FbxLoader.parse ──> FBX IR (raw structure of nodes/geometry/skin/materials/animation)
                                     │
mannequin_female.glb ──> parseBinary ──> glTF JSON+BIN
                                     │
              SkinnedModel.parseFbxContent / parseContent  (per-format interpreters)
                                     ↓
              Common neutral schema
              ├── Mesh description: positions/normals/uv/joints/weights/indices (pure CPU arrays)
              └── Material description: PBR factors + image bytes (GL-independent)
                                     ↓
              uploadMeshesAndMaterials  (common GL upload)
              ├── Material.createFromDescription → create GL textures
              └── VAO/buffers → drawableList
```

- FBX materials (Phong: Diffuse/Normal/Specular/Gloss) are approximately mapped to metallic-roughness: gloss → roughness(1-gloss), specular → F0 modulation, metallic = 0. glTF uses native mapping.
- Shaders are unified into a single Cook-Torrance GGX PBR shader (normal maps use a screen-space derivative cotangent frame, no tangent attribute needed).
- Loading additional animations: `addAnimationsFromFbxUrl(url, clipName, ignoreTranslation)` **retargets an animation-only FBX by bone name matching** and adds the clips. Clips with baked-in root motion can drop their translation channels.
- Every frame: `model.update(dt)` computes clip sampling (crossfade) → joint offsets → world matrices → joint matrices (world x inverse bind), and `renderer.draw(model, ...)` sets up GL state and iterates over the drawables.
- Toon 3D centers on meshes painted with material colors without textures, but accepts UVs and base color, emission and decal textures, and material shader fragments. The scene buffer is in linear color. (ToonRenderer.setHdrOutput; ToonPostProcess applies tone mapping and gamma)

---

## 7. Public API Surface (import.js)

- A single barrel file at the repository root. Its 13 comment-section blocks (built-in/base/core/basic components/UI/resources/other/collections/animation/shaders and fullscreen pass/3D graphics/to be deprecated/experimental) are the logical layer divisions, and after the experimental block come exports with a one-line comment per branch.
- Enums are exported on the same line together with their class (`export { ViewScaleMode, ViewManager }`).
- Function-collection modules are exported as namespaces (`export * as Format`, `LanguagePack`, `UIFont`). The toon mesh builder and GLB reading functions are exported by name, as in the Rust version.
- **Intentionally unexposed** = treated as internal implementation: `AudioManager` (used via Engine), `Layer`, `DevTools`, `FbxLoader` (via SkinnedModel), the 2 texture caches and sharedbakecache, autolayout internal types (`LayoutRow`, `LayoutSymbol`, `LayoutSymbolType`), all of src/web (`Pane`, `WebSocketClient`). Projects that need an unexposed class import it directly by file path.

---

## 8. Known Gaps / Legacy

| Item | Status |
|---|---|
| `core/resources.js` | 0 bytes. Central asset cache layer not implemented (currently per-instance ownership) |
| `core/layer.js` | Empty stub. Does not import base/Object, so it inherits the global Object. Unused, unexposed |
| `Object.destroy()` | A hook that leaves no destroyed mark. `isDestroyed()`, which was always false, is removed in 0.4.0 (the Rust engine has no such function because a dropped value is gone and the handle of a removed node is None. The unique identifier is put into a module WeakMap on the first `getInstanceId()`) |
| `Scene` initialization | The root node is created in `create()`, not in the constructor. Going through SceneManager is an implicit contract |
| `deprecated/webgl2.js` | Unexposed. Dead code (in its old place experimental/graphics its import paths were broken too) |
| `deprecated/gl2d.js` | No exports. Dead code |
| `deprecated/aabb.js`, `transform2d.js` | Entirely commented out. Dead files |
| `deprecated/camera.js` | Duplicate, since Camera2D in misc/camera2d.js covers everything including rotation and begin/end. To be deprecated (import.js still exports it as Camera). Not ported to the Rust version |
| `misc/uibuilder.js` | Replaced by NodeLayout (only 1 comment line remains) |
| `base/calculator.js` | Empty function that returns 0. Unexposed |
| 3D material sharing | No cross-model shared cache for textures/materials/clips. Per-model ownership (to be introduced when a consumer that shares them appears) |

---

## 9. Relationship with the Rust Version

- The Rust version (vanilla-engine) ported 182 of this engine's 200 `src/` files (not counting the draft area src/experimental). The 18 files intentionally not ported are empty files (calculator, layer, resources, uibuilder), dead code (aabb, transform2d, gl2d, webgl2, anchoredworldmnode in deprecated), things the Rust language and standard library take care of (object, reflection, singleton and the five in base/collection), and deprecated/camera.js, which Camera2D covers.
- The folders are the same as in the Rust version. (graphics3d, graphics3d/toon, animation, misc, resource) Only the original core/graphic/* sits directly under core/ in the Rust version.
- The public API and behavior of the two engines are kept the same. Only the names change to Rust conventions (snake_case, UpperCamelCase, SCREAMING_SNAKE_CASE). (setFillColor → set_fill_color)
- The remaining differences (things that truly cannot be matched and forms decided to suit Rust) are collected in sections 9 and 10 of ARCHITECTURE.md in the Rust version repository. Key points: the Rust version runs async/await on a single-threaded executor the engine carries (core/task.rs), builds reflection at compile time with the `#[vanilla::reflect]` procedural macro, passes the engine as an argument instead of a global, uses handles (NodeId) for nodes, and the desktop has no DOM or browser settings and its safe area insets are 0 like Chrome desktop (they can be set with `set_safe_area_insets`).

---

## Node Family (NODE.md)

- Node (extends Object)
- ComponentNode (extends Node)
- TransformNode (extends ComponentNode)
- WorldNode (extends TransformNode)
- AnchoredWorldNode (extends WorldNode) (Legacy)
- UINode (extends TransformNode)
