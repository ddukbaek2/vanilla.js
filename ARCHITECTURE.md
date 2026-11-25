# vanilla.js 구조 설계 문서

엔진 전체의 클래스 구성과 소유 구조를 정리한 설계 문서다. API 레퍼런스가 아니라 "무엇이 무엇을 만들고, 들고 있고, 어떤 순서로 굴러가는가"를 보기 위한 문서다.

- 기준일: 2026-11-26 (dev)
- 기준 소스: `src/` 전체(.js 200 파일) + `import.js`

---

## 1. 전체 배치

```
import.js                  # 단일 공개 API 배럴. 소비자는 이 파일 하나만 import
src/base/                  # 엔진 비의존 기반 타입 (Object, Node, 수학, 색, 플랫폼, Format, FSM, 타이머, 난수)
src/core/                  # 엔진 본체 (Engine, 매니저, Scene, Node 계열, Graphic, Component, 입력, 소리)
src/core/node/             # ComponentNode → TransformNode → WorldNode
src/core/component/        # Paint, Sprite, Text, RichText, Mask, Outline, SoftShade, ShadowText, ShadowImage
src/core/graphic/          # ShaderProgram, ShaderWarmer, ImageTextureCache, TextStringTextureCache, sharedbakecache(구운 그림 나눠 쓰기)
src/resource/              # Asset 파생 (Image/Audio/Text/Json/Font/Blob) + AnimationClip, AssetLoader, SpriteAtlas
src/effect/                # ParticleSystem, TrailRenderer, ShaderSprite, ScreenEffect, HeatHazeEffect
src/ui/                    # 두 갈래 UI (Component 계열 UIView / Node 계열 UINode) + 창 쌓기, 모션 + autolayout/
src/misc/                  # DEVTools, NodeLayout, DynamicFont, LanguagePack, UIFont, CameraGestures, FrameProbe,
                           #     GraphicsQualityGovernor, FixedStepper, LoadingProgress, BuildInfo, VirtualPad 등 부가 기능
src/web/                   # DOM 영역 유틸 (Pane, WebSocketClient). 캔버스 밖 세계
src/game/                  # GameScene (게임용 공통 베이스 씬)
src/experimental/          # 컬렉션, Action, Animator, Timeline, Visual, Indicator, Camera, BunchAsset + graphics/ (WebGL2 3D 스택)
src/experimental/graphics/ # 3D: FbxLoader, SkinnedModel, Material, SkinnedModelRenderer, HumanSkinRenderer, Camera3D,
                           #     ShadowMap, RenderTarget, FullscreenPass, BloomEffect, MultiLevelBloomEffect,
                           #     AmbientOcclusionEffect, SubsurfaceScatteringEffect
src/experimental/graphics/toon/ # 툰 3D: MeshBuilder(ToonMesh), glbmeshreader(ToonGlb), ToonRenderer, ToonLightSet, ToonMaterial,
                           #     ToonDrawQueue, ToonScreenOutline, ToonVfx, ToonPostProcess, ToonView3D
src/deprecated/            # AnchoredWorldNode (폐기)
```

레이어 방향은 아래에서 위로만 의존한다: `base` ← `core` ← (`resource`, `effect`, `ui`, `game`, `misc`, `experimental`). `src/web` 은 엔진 노드 트리와 무관한 DOM 세계다.

---

## 2. 설계 원칙

1. **전역 내장 객체 규약**: 엔진이 `Object`, `Math` 등의 이름을 자체 클래스로 가리므로, 자바스크립트 내장은 반드시 `const System = globalThis` 를 통해 `System.Math`, `System.Object` 로 접근한다. `import.js` 최상단의 `export const System = globalThis` 가 이 규약을 API 표면에 편입시킨다.
2. **단일 루트 클래스**: 거의 모든 클래스가 `base/Object` 를 상속한다. Object 는 GUID(instanceId), 복제(clone/structuredClone), 동등성(equals), 파괴 훅(destroy) 자리를 제공한다.
3. **게임오브젝트/컴포넌트 월드 없음(3D)**: 3D 쪽은 씬그래프 엔티티 시스템이 아니다. 로더가 `SkinnedModel` 이라는 완결된 모델 인스턴스를 만들고, 그 안에 메시, 본, 스킨, 머티리얼, 애니메이션이 전부 연결된다.
4. **임포터는 임포터일 뿐**: `FbxLoader` 는 파싱만 한다. GL 리소스나 셰이딩 로직을 갖지 않는다. 포맷별 해석 결과는 공통 중립 스키마로 수렴한 뒤 모델이 소비한다.
5. **Shader, Material, Model 계층 (유니티/언리얼 사상)**: Material 은 셰이더(템플릿)를 참조하는 인스턴스이고, 모델은 드로어블별로 Material 인스턴스를 참조하며, 렌더러가 이를 그린다.
6. **모델과 렌더 기능의 분리**: `SkinnedModel` 은 데이터 + 포즈 상태만 갖는다. 그리는 것은 `SkinnedModelRenderer` 라는 별도 객체다. 환경 상태(태양/안개/그림자)도 모델이 아닌 렌더러 소유다. 툰 3D 도 같아서 메시 배열(ToonMesh, ToonGlb)과 렌더러(ToonRenderer), 빛 값(ToonLightSet)이 따로다.
7. **2D 와 3D 는 하나의 GL 컨텍스트를 공유**: core 의 `Graphic`(2D)과 experimental/graphics(3D)는 같은 `WebGL2RenderingContext` 위에 공존한다. 2D 그리기 사이에 끼우는 3D 는 `Graphic.runExternalPass` 로 감싼다.
8. **러스트 판과 같게**: 러스트 판 [vanilla-engine](https://github.com/ddukbaek2/vanilla-engine) 은 이 엔진을 옮긴 것이고, 두 엔진은 기능 차이를 두지 않는다. 한쪽에만 생긴 범용 기능과 한쪽에서 찾은 버그는 양쪽에 같이 넣는다. (9장)

---

## 3. 상속 계층

```
Object (base/object.js)
├── Node (base): 부모/자식 계층 + 활성화
│   └── ComponentNode (core): 컴포넌트 보유 + tick
│       └── TransformNode (core): 로컬 TRS + 렌더 재귀
│           ├── WorldNode (core): pivot/anchor/contentSize + 터치 (수동 배치 노선)
│           │   ├── UIScrollBar, UIInputField, UIDropdown, UIContextMenu, UIDialog, UIToast, UISpinner (ui)
│           │   ├── UIWindow → UIConfirmWindow, UIWindowLayer (ui)
│           │   ├── FloatingText, TouchEffect (misc)
│           │   └── AnchoredWorldNode (deprecated)
│           └── UINode (ui): 오토레이아웃 제약 변수 (솔버 배치 노선)
├── Component (core): 노드에 부착되는 기능 단위
│   ├── Paint → Sprite → ShaderSprite (effect)
│   ├── Text → RichText
│   ├── Mask, Outline, SoftShade, ShadowText, ShadowImage
│   ├── ParticleSystem, TrailRenderer, HeatHazeEffect (effect)
│   ├── SpriteAnimator, PlatformerBody (misc)
│   ├── Visual (experimental), ToonView3D (experimental/graphics/toon)
│   ├── UIProgressRing, UIHitArea, UIListView, UILineChart, UIBarChart, ButtonMotion, ToastMotion (ui)
│   └── UIView (ui): UI 위젯 기반
│       ├── UILabel, UIImageView, UIProgressView
│       ├── UIScrollView → UISnapScrollView
│       └── UIControl → UISlider / UIDraggable / UIButton → UIToggleButton
├── Scene (core)
│   ├── GameScene (game): WorldNode 노선 베이스 씬
│   └── UIScene (ui): UINode + 솔버 노선 베이스 씬
├── Asset (core)
│   ├── ImageAsset, AudioAsset, FontAsset, VisualAsset
│   ├── TextAsset → JsonAsset
│   └── BlobAsset → BunchAsset
├── TouchRaycaster (core) → TouchRecognizer (ui)
├── Singleton (base) → PointerCursor (core)
├── 엔진/매니저: Engine, EngineConfiguration, SceneManager, TimeManager,
│                ViewManager, InputManager, InputActions, GamepadManager, AudioManager
├── 렌더: Graphic, ShaderProgram, ImageTextureCache, TextStringTextureCache
├── 3D (experimental/graphics): FbxLoader, SkinnedModel, SkinnedModelRenderer → HumanSkinRenderer,
│                Material, ShadowMap, RenderTarget, FullscreenPass, BloomEffect, MultiLevelBloomEffect,
│                AmbientOcclusionEffect, SubsurfaceScatteringEffect
├── 수학/자료: Vector2/3, Matrix4, Quaternion, TransformMatrix, Rect, OBB, Color,
│                List/Dictionary/Queue/Stack/Set, FiniteStateMachine, ObjectPool, SeededRandom
└── 기타: Tween, Animation, Frame, Animator, Action, Timeline, DEVTools, NodeLayout, AssetLoader, SpriteAtlas,
          DynamicFont, VirtualPad, WebSocketClient, Camera2D, FixedStepper, LoadingProgress, BuildInfo ...
```

주의할 분기 두 곳:
- `TransformNode` 아래에서 **WorldNode 노선**(pivot/anchor 수동 배치)과 **UINode 노선**(제약 솔버 자동 배치)이 갈리며, 둘은 상속 관계가 없다.
- UI 위젯은 **노드인 것과 Component 인 것**이 섞여 있다. `UIView extends Component` 계열(라벨, 버튼, 스크롤 뷰 등)과 진행 고리, 리스트 뷰, 차트, 모션은 컴포넌트이고, 스스로 자식 노드를 짓는 위젯(스크롤 바, 입력 필드, 드롭다운, 컨텍스트 메뉴, 다이얼로그, 토스트, 스피너, 창과 창 층)은 `WorldNode` 를 상속한 노드다.

Object 를 상속하지 않는 예외: `AudioPlayer`, `AudioBus`, `SoundSystem`, `ShaderWarmer`, `Pane`, `PaneStyle`, `FrameProbe`, `CameraGestures`, `GraphicsQualityGovernor`, `UIScale`, `Camera3D`, 툰 3D(`MeshBuilder`, `ToonRenderer`, `ToonLightSet`, `ToonMaterial`, `ToonInstanceLayout`, `ToonDrawQueue`, `ToonScreenOutline`, `ToonPostProcess`, `ToonVfx`), autolayout 전체(`LayoutSolver` 등, 독립 수학 모듈).

---

## 4. 소유 구조

"A ── B" 는 A 가 B 를 생성, 소유함을 뜻한다. "(참조)" 는 참조만 보유.

### 4-1. 엔진 루트

```
Engine
├── EngineConfiguration (참조, 외부 주입)
├── Platform ─────────────── canvas 획득 담당
├── Graphic ──────────────── WebGL2 컨텍스트 + 2D 렌더 파이프라인 소유
│   ├── ShaderProgram (2D 내장 셰이더, 묶음, 파티클, 블렌드 섞기 셰이더)
│   ├── ImageTextureCache ── WeakMap<image, texture> (원본 GC 시 함께 수거)
│   ├── TextStringTextureCache ── 문자열 → 텍스처 LRU (상한 512) + 오프스크린 2D 캔버스, 글 재기 캐시 (2048)
│   └── VAO/VBO/스크래치 버퍼/1x1 흰색 텍스처, 블렌드 섞기용 바탕 칸
├── SceneManager ─────────── 로드된 Scene 목록 보관 (Scene 생성은 호출자 몫)
├── TimeManager
├── ViewManager ──────────── canvas (참조) + 뷰 스케일/좌표 변환, 세이프 에어리어, 렌더 배율 상한
├── InputManager
│   ├── GamepadManager ───── 게임패드는 Engine 직속이 아니라 InputManager 하위
│   └── InputActions ─────── 입력 동작 (tick 에서 갱신)
├── AudioManager ─────────── AudioContext lazy 생성. AudioPlayer, AudioBus(createAudioBus, 그 버스로 트는 플레이어를 만든다) 는 생성 후 소유권 이양
└── Version
PointerCursor (Singleton) ── 엔진이 프레임 끝마다 apply() 로 캔버스 커서를 정한다 (켜져 있을 때만)
```

- `Engine` 은 생성 시 자신을 `System.vanillaEngine` 전역에 등록하고 `Engine.getEngine()` 정적 접근자를 제공한다. 사실상 암묵적 싱글턴이다.
- rAF 루프도 Engine 이 소유한다 (`frame.js` 의 `Frame` 은 루프가 아니라 스프라이트 이미지 영역 클래스다).

### 4-2. 씬 → 노드 트리

```
SceneManager ── Scene[] (보관, 생명주기만. 인스턴스는 호출자가 new)
Scene
├── Engine (참조, SceneManager 가 주입)
├── 루트 WorldNode ("root") ── create() 시점에 생성 (생성자 아님에 주의)
└── Tween[] ── startTween 으로 등록, 완료 시 자동 제거

Node 트리: 부모가 children[] 을 소유 + 자식이 parent 역참조
ComponentNode ── Component[] ── addComponent(type) 이 직접 new 해 목록에 넣고, require() 의존성을 재귀로 추가한 뒤 attach
Component ── 소유 노드 (참조)
```

- 씬-레이어 구조는 존재하지 않는다. `core/layer.js` 는 빈 스텁이며 어디서도 쓰이지 않는다. 실제 구조는 씬 → 루트 노드 → 노드 트리다.

### 4-3. UI

```
UIScene
├── LayoutSolver ─────────── 솔버 소유자는 씬. UINode 는 setSolver() 로 주입받아 사용
├── screenNode / safeAreaLayoutGuide (UINode) ── 트리에 넣지 않는 순수 가이드
├── DEVTools (F2 하이어라키/인스펙터, EngineConfiguration.useDevTools 가 꺼져 있으면 없음)
└── TouchRecognizer ──────── UIKit 스타일 제스처 (드래그 임계 + delaysContentTouches)

UINode
├── LayoutVariable 8개 (left/right/top/bottom/width/height/centerX/centerY)
├── 본질 제약 4개 (right=left+width 등) + 사용자 제약 + intrinsic 제약
└── layoutMarginsGuide (자식 UINode, lazy)

UIView(Component).attach(node)
└── content WorldNode 생성 → 호스트 노드의 자식으로 추가 (트리 소유권은 호스트에)
UILabel ── Text/RichText 를 require() 로 선언 → 소유는 호스트 ComponentNode
UIScrollView ── Mask 를 require(), 스크롤바는 host 의 sibling 으로 생성
UIWindowLayer (노드) ── UIWindow[] (맨 위 창만 보임, UIScale 만큼 층을 키움, 닫는 움직임이 끝나면 떼어 냄)
```

터치 흐름: DOM 이벤트 → Engine → InputManager 플래그 → Scene.tickTouch → TouchRecognizer 가 루트 트리를 draw 순서로 순회해 최상위 interactable WorldNode 선택 → 노드가 자기 컴포넌트들에 전달 → UIButton 등 Component 가 처리. 휠은 그 자리를 덮는 것 가운데 그리는 순서로 가장 앞인 스크롤 칸이 받는다. (TouchRaycaster.touchWheel)

### 4-4. 애셋

- **중앙 리소스 매니저는 없다** (`core/resources.js` 는 빈 파일). 애셋은 `new ImageAsset()` → `await load(path)` 하는 인스턴스 단위 소유이며, 보통 씬이 멤버로 든다. 이미 가진 바이트는 `loadFromBytes` 로 읽는다. (글꼴은 `loadFontFromBytes`)
- 여럿을 함께 받을 때는 `AssetLoader` 가 동시 수(기본 6)만큼 받고 진행률과 실패 목록을 센다. 받은 애셋은 여전히 부르는 쪽이 든다. `SpriteAtlas` 는 tools/atlas.cjs 가 구운 JSON 과 쪽 그림을 읽는다.
- 캐시는 GPU 리소스 레벨에만 존재하고 `Graphic` 이 소유한다 (ImageTextureCache / TextStringTextureCache). ShadowText, ShadowImage, SoftShade 가 구운 그림은 같은 모양끼리 sharedbakecache.js 에서 나눠 쓴다.

### 4-5. 3D 스택 (experimental/graphics)

```
씬(샘플 코드)
├── SkinnedModelRenderer ── 씬당 하나 (HumanSkinRenderer 는 이것을 상속해 피부, 눈, 머리카락 셰이딩을 더한다)
│   ├── ShaderProgram (스키닝 PBR 셰이더 = 머티리얼 템플릿)
│   ├── ShaderProgram (깊이 패스 셰이더, 섀도우 캐스팅)
│   └── 환경 상태: sunDirection / fogColor / fogRange / shadowMap / shadowStrength
├── SkinnedModel ── 모델 인스턴스, 여러 개 가능 (렌더 기능 없음)
│   ├── nodeList (본 계층 + 포즈 상태: currentTRS, worldMatrix)
│   ├── skinList (jointNodeIndices + inverseBindMatrices + jointMatrixArray)
│   ├── drawableList ── { VAO, 인덱스, skinIndex, material(참조) }
│   ├── Material[] ── 드로어블이 참조하는 인스턴스
│   │   ├── ShaderProgram (참조, 렌더러의 템플릿)
│   │   ├── PBR 팩터 (baseColor/metallic/roughness/emissive)
│   │   └── GL 텍스처 7종 (baseColor/normal/metallicRoughness/glossiness/
│   │                      occlusion/emissive/specular, 없으면 1x1 대체)
│   └── animationList ── 클립 (채널 = 노드 인덱스 + 시간/값 커브)
├── Camera3D ── 원근/직교, 보기와 투영 행렬, 월드 점을 화면 사각형 자리로 (렌더러와 2D 표시가 같이 쓴다)
├── ShadowMap ── 깊이 텍스처 + 직교 광원 행렬 (텍셀 스냅)
├── RenderTarget ── 오프스크린 FBO (포스트 프로세싱 기본 단위, 멀티샘플과 깊이 비트 옵션)
├── FullscreenPass ── 풀스크린 삼각형 패스
└── BloomEffect, MultiLevelBloomEffect ── 밝은 영역 추출 → 블러(다단은 반씩 줄이고 천막 꼴로 키움) → 합성 체인

툰 3D (experimental/graphics/toon)
├── ToonMesh(MeshBuilder), ToonGlb ── 꼭짓점 배열 짓기와 GLB 읽기 (UV, 재질 범위 포함, GL 무관)
├── ToonRenderer ── 몸, 바깥선 껍데기, 그림자 깊이 프로그램 + 머티리얼과 인스턴스 꼴마다 지은 프로그램
│   ├── ToonLightSet (기본 빛 묶음: 해, 채움 빛, 림, 정반사, 점광 8 개, 띠 램프, 빛 꼴)
│   └── ToonMaterial (참조, 셰이더 조각: uniform, surface, light, vertex)
├── ToonDrawQueue ── 한 프레임에 그릴 모형을 담아 불투명, 바깥선, 비치는 것 차례로 + 단계 콜백
├── ToonScreenOutline ── 같은 모형을 한 번 더 그려 노멀, 선 번호, 깊이로 화면 공간 바깥선 (경계 잡기, 점프 플러딩, 거리로 섞기)
├── ToonVfx ── 코드로 짓는 아틀라스와 인스턴스 GPU 효과 (파티클, 불덩이, 충격파, 자국, 기둥, 빔, 리본, 번개, 빛 점)
├── ToonPostProcess ── RenderTarget(멀티샘플, 실수 판) + BloomEffect 또는 MultiLevelBloomEffect + 톤매핑과 색 보정
└── ToonView3D (Component) ── 노드 사각형 안에 runExternalPass 로 툰 3D 를 그린다 (렌더러는 여러 노드가 나눠 쓸 수 있다)
```

- `FbxLoader` 는 소유 관계 밖의 **순수 파서**다. `SkinnedModel.loadFromFbxUrl` 이 일시적으로 생성해 쓰고 버린다.
- `ShaderProgram` 은 core/graphic 소속이며 2D/3D 가 공유하는 공용 부품이다.
- 텍스처 유닛 배치 규약: 0 = baseColor, **1 = 섀도우 맵 전용(모델 머티리얼 사용 금지)**, 2~7 = normal/metallicRoughness/glossiness/occlusion/emissive/specular. 툰 렌더러는 그림자 3, 바탕색 4, 빛남 5, 데칼 6, 머티리얼 7~15 를 쓴다.

---

## 5. 프레임 루프

```
new Engine(config) → 매니저 생성 + DOM 이벤트 바인딩 + resize()
engine.run(scene)  → 기본 폰트 로드 + sceneManager.loadScene(scene) + rAF 시작

매 프레임 Engine.updateEngine(timestamp):
0. 최대 FPS 제한               # 세기 시작한 뒤 처리한 프레임 수로 차례를 정하고, 차례보다 일찍 온 프레임은 건너뜀
1. graphic.applySettings()      # 뷰포트/프로젝션 갱신 + 상태 리셋 + 스텐실 클리어 + 묶음 기억 잊기
2. timeManager.update()         # timeDelta 산출
3. inputManager.tick()          # 게임패드 폴링, 입력 동작 갱신 포함
4. 로드된 씬마다:
   - 미로드 씬 → drawOnLoad() 만 (로딩 화면)
   - scene.tick(timeDelta)      # root.tick 재귀(isTickNeeded 가 참인 컴포넌트만 tick) → 터치 디스패치(한 프레임 안의 누름과 뗌은 둘 다) → 트윈
   - graphic.invalidateRenderStateCache() → scene.preDraw / draw / postDraw → (기즈모)   # draw 기본 구현 = graphic.drawNode(root) 재귀
   (씬마다 try/catch, 한 씬의 예외가 루프를 죽이지 않음)
5. 통계 출력(옵션) → flushSpriteBatch(남은 묶음) → PointerCursor.apply() → 1회성 입력 플래그 클리어 → 검증용 화면 저장(requestFrameCapture, ?capture=) → 다음 rAF
```

노드 렌더 재귀: `drawNode` = pushTransform(로컬 TRS/pivot 보정) → (화면 밖이면 건너뜀) 컴포넌트 draw → 자식 재귀 → popTransform. `Mask` 컴포넌트는 자식 그리기 전후로 스텐실 클립을 걸고 푼다.

3D 씬(ancientmountain 등)은 이 루프 대신 **자체 rAF + 자체 패스 구성**을 쓴다: 섀도우 깊이 패스(`ShadowMap.beginRender` → `renderer.drawDepth`) → 씬 패스(RenderTarget) → 본 패스(`renderer.draw`) → 포스트(BloomEffect) → HUD(Graphic 2D). 엔진 루프 안에서 2D 사이에 3D 를 끼울 때는 `Graphic.runExternalPass` 가 앞의 묶음을 그리고, 상태 기억을 잊고, 깊이를 비운 뒤 패스를 부르고 `restoreRenderState` 로 되돌린다.

---

## 6. 렌더링 구조

### 6-1. 2D: core/Graphic

- **WebGL2 기반**이다 (Canvas2D 아님, 폴백 없음). Canvas2D 시절의 API 표면(좌상 원점, save/restore 상태 스택, fillRect/drawImage/fillText)을 WebGL2 위에 재현한다.
- 모든 드로우는 `drawVertices()` 한 지점으로 수렴한다 (배칭 삽입 지점). 단색 도형도 1x1 흰색 텍스처로 텍스처 경로와 통일.
- 묶어 그리기(`setSpriteBatchingEnabled`)와 화면 밖 거르기(`setCullingEnabled`)는 기본으로 켠다. 거르기는 켜진 컴포넌트가 모두 내용 영역 안에서만 그린다고 알리거나(`isDrawnInsideContent`) 그리는 사각형을 알려 줄 때(`calculateDrawnRect`, 한 줄과 여러 줄 Text) 그 경계 상자가 화면에 걸치지 않으면 그 노드의 컴포넌트 그리기를 건너뛴다.
- 마지막으로 쓰게 한 셰이더 프로그램과 0 번 텍스처 유닛의 텍스처를 기억해 같으면 다시 걸지 않는다. Graphic 을 거치지 않고 WebGL 을 만진 뒤에는 `invalidateRenderStateCache` 를 부른다. (restoreRenderState, applySettings, 컨텍스트를 잃거나 되살릴 때는 스스로 잊는다)
- 클리핑은 스텐실 버퍼 기반 (회전/스케일된 마스크 정확히 처리). 텍스트는 오프스크린 2D 캔버스에 구워 텍스처로 출력.
- 블렌드는 Canvas2D 합성 문자열 26종을 모두 그린다. 13종(포터 더프 연산자, lighter, multiply, screen)은 고정 블렌딩, 나머지 13종(overlay, darken, lighten, color-dodge, color-burn, hard-light, soft-light, difference, exclusion, hue, saturation, color, luminosity)은 그리기마다 그릴 영역 아래를 지금 프레임버퍼에서 `blitFramebuffer` 로 떠 와 W3C Compositing and Blending Level 1 공식대로 셰이더로 섞는다(섞기 모드에서는 묶어 그리지 않음, 바꿔 끼운 셰이더는 덧그림 칸에 먼저 그린 뒤 섞어 옮김). multiply 는 기본 프레임버퍼에서는 고정 블렌딩이고, 렌더 타겟(프레임버퍼를 묶은 동안)에 그릴 때만 셰이더로 섞는다(고정 블렌딩은 바탕이 반투명하면 W3C 식과 달라서). Canvas2D 와 달리 source-in, source-out, destination-in, destination-atop, copy 는 그린 도형 안만 바꾼다.

### 6-2. 3D: experimental/graphics

임포트 파이프라인 (포맷 중립화가 핵심):

```
Remy.fbx ──> FbxLoader.parse ──> FBX IR (노드/지오메트리/스킨/머티리얼/애니 원본 구조)
                                     │
soldier.glb ──> parseBinary ──> glTF JSON+BIN
                                     │
              SkinnedModel.parseFbxContent / parseContent  (포맷별 해석기)
                                     ↓
              공통 중립 스키마
              ├── 메시 서술: positions/normals/uv/joints/weights/indices (순수 CPU 배열)
              └── 머티리얼 서술: PBR 팩터 + 이미지 바이트 (GL 무관)
                                     ↓
              uploadMeshesAndMaterials  (공용 GL 업로드)
              ├── Material.createFromDescription → GL 텍스처 생성
              └── VAO/버퍼 → drawableList
```

- FBX 머티리얼(Phong: Diffuse/Normal/Specular/Gloss)은 metallic-roughness 로 근사 매핑된다: gloss → roughness(1-gloss), specular → F0 변조, metallic = 0. glTF 는 네이티브 매핑.
- 셰이더는 쿡-토런스 GGX PBR 하나로 통일 (노멀맵은 화면공간 미분 코탄젠트 프레임, 탄젠트 어트리뷰트 불필요).
- 애니메이션 추가 로드: `addAnimationsFromFbxUrl(url, clipName, ignoreTranslation)` 이 애니 전용 FBX 를 **본 이름 매칭으로 리타게팅**해 클립을 추가한다. 루트 모션이 박힌 클립은 이동 채널을 버릴 수 있다.
- 매 프레임: `model.update(dt)` 가 클립 샘플링(크로스페이드) → 조인트 오프셋 → 월드 행렬 → 조인트 행렬(월드 x 역바인드)까지 계산하고, `renderer.draw(model, ...)` 가 GL 상태를 잡고 드로어블을 순회한다.
- 툰 3D 는 텍스처 없이 재질 색으로 칠하는 메시를 중심으로 하되, UV 와 바탕색, 빛남, 데칼 텍스처, 머티리얼 셰이더 조각을 받는다. 씬 판은 선형 색이다. (ToonRenderer.setHdrOutput, ToonPostProcess 가 톤매핑과 감마를 건다)

### 6-3. 툰 바깥선

툰 3D 의 바깥선은 두 가지이고 함께 써도 된다.

- 껍데기(inverted hull): MeshBuilder 가 점마다 같은 자리의 노멀을 모아 평균한 쪽(모서리는 덜 튀게 민 쪽)으로 민 사본을 짓고, ToonRenderer 가 그 뒷면만 그려 몸 둘레에 테로 보인다. 모형 하나의 실루엣에 맞고, 굵기를 꼭짓점마다 다르게 지을 수 있다.
- 화면 공간(ToonScreenOutline): 장면 전체의 실루엣, 물체가 맞닿은 곳, 꺾인 모서리를 한 번에 긋는다.

```
불투명한 모형 ──(같은 행렬로 한 번 더)──> 선의 판 RGBA8 + 깊이 24
                                          (노멀 팔면체 접기 rg, 선 번호 14 비트, 꼴 2 비트: 바깥 선, 꺾임 선)
                                                   │
씨앗 고르기 (화소와 바로 이웃 넷 사이 경계마다 한 번) ──> 씨앗 판 RGBA16UI (rg 바깥 선, ba 꺾임 선의 경계 가운데, 반 화소 단위)
   - 바깥 선: 한쪽이 빈 곳 / 번호가 다름 / 같은 번호라도 서로의 접평면에서 깊이 문턱 + 화소 크기 2 배보다 떨어짐
   - 꺾임 선: 같은 번호, 떨어지지 않음, 두 노멀이 꺾임 각보다 벌어짐
   - 선은 가린 쪽의 꼴을 따르고, 맞닿은 두 번호는 한쪽만 켜져 있어도 긋는다
                                                   │
점프 플러딩 (걸음 k, k/2, ..., 1, 씨앗 판 둘을 번갈아) ──> 화소마다 가장 가까운 경계 토막
                                                   │
섞기 (그리는 영역 화소마다, 선의 판 2x2 칸의 씨앗까지 거리) ──> 덮는 몫 clamp(굵기 / 2 - 거리 + 0.5, 0, 1) x 선 색
```

- 선은 화소가 아니라 화소 사이의 경계 가운데에 서므로 한 경계를 두 번 긋지 않고, 꺾임 양쪽에 띠나 평행한 둘째 선이 서지 않는다.
- 선의 판을 줄여도(setResolutionScale) 거리를 그리는 영역에서 재므로 늘인 선이 끊기지 않는다. (줄인 판의 계단은 남는다)
- 그리기 줄(ToonDrawQueue.setScreenOutline)에 맡기면 선의 판은 몸 앞에, 섞기는 바깥선 껍데기 뒤 afterOutline 앞에 한다. 모형마다 hasScreenOutline, hasCreaseLine.

---

## 7. 공개 API 표면 (import.js)

- 저장소 루트의 단일 배럴 파일. 주석 섹션 8블록(내장/기반/코어/기본 컴포넌트/UI/리소스/기타/실험)이 곧 논리 레이어 구분이고, 실험 블록 뒤에 갈래마다 한 줄 주석을 단 내보내기가 이어진다.
- 열거는 클래스와 같은 줄에 함께 export 한다 (`export { ViewScaleMode, ViewManager }`).
- 함수 묶음 모듈은 이름 공간으로 낸다 (`export * as Format`, `LanguagePack`, `UIFont`, `ToonMesh`, `ToonGlb`).
- **의도적 미노출** = 내부 구현 취급: `AudioManager`(Engine 경유 사용), `Layer`, `DEVTools`, `GameScene`, `FbxLoader`(SkinnedModel 경유), 텍스처 캐시 2종과 sharedbakecache, autolayout 내부 타입(`LayoutRow`, `LayoutSymbol`, `LayoutSymbolType`), src/web 전체(`Pane`, `WebSocketClient`). 미노출 클래스가 필요한 프로젝트는 파일 경로로 직접 import 한다.

---

## 8. 알려진 공백 / 레거시

| 항목 | 상태 |
|---|---|
| `core/resources.js` | 0 바이트. 중앙 애셋 캐시 계층 미구현 (현재는 인스턴스 단위 소유) |
| `core/layer.js` | 빈 스텁. base/Object 미임포트로 전역 Object 상속. 미사용, 미노출 |
| `Object.destroy()` | 파괴 표시를 남기지 않는 훅이라 `isDestroyed()` 는 항상 false (고유식별자는 처음 `getInstanceId()` 에서 모듈 WeakMap 에 넣는다) |
| `Scene` 초기화 | 루트 노드가 생성자가 아닌 `create()` 에서 생성됨. SceneManager 경유가 암묵 계약 |
| `experimental/graphics/webgl2.js` | import 경로 깨짐 + 미노출. 데드 코드 |
| `experimental/graphics/gl2d.js` | export 없음. 데드 코드 |
| `experimental/aabb.js`, `transform2d.js` | 전체 주석 처리. 데드 파일 |
| `experimental/camera.js` | misc/camera2d.js 의 Camera2D 가 회전과 begin/end 까지 모두 덮는 중복. 러스트 판에는 옮기지 않는다 |
| `misc/uibuilder.js` | NodeLayout 으로 대체됨 (주석 1줄만 남음) |
| `base/calculator.js` | 0 을 돌려주는 빈 함수. 미노출 |
| 3D 머티리얼 공유 | 텍스처/머티리얼/클립의 모델 간 공유 캐시 없음. 모델 단위 소유 (공유 소비자가 생기면 도입) |

---

## 9. 러스트 판과의 관계

- 러스트 판(vanilla-engine)은 이 엔진의 `src/` 200 파일 가운데 181 파일을 옮겼다. 일부러 옮기지 않은 19 파일은 빈 파일과 데드 코드(calculator, layer, resources, uibuilder, aabb, transform2d, gl2d, webgl2, deprecated 의 anchoredworldmnode), 러스트 언어가 맡는 것(object, reflection, singleton, wait, collection 다섯), Camera2D 가 덮는 experimental/camera.js 다.
- 두 엔진의 공개 API 와 동작은 같게 둔다. 이름만 러스트 규칙(snake_case, UpperCamelCase, SCREAMING_SNAKE_CASE)으로 바뀐다. (setFillColor → set_fill_color)
- 남은 차이(정말 맞출 수 없는 것과 러스트에 맞게 정한 꼴)는 러스트 판 저장소의 ARCHITECTURE.md 9장과 10장에 모았다. 요점: 러스트 판은 async 대신 받기 손잡이와 콜백, 리플렉션 대신 등록 표, 전역 엔진 대신 인자로 넘기기, 노드는 핸들(NodeId), 데스크탑에는 DOM 과 브라우저 설정과 세이프 에어리어가 없다.
