# vanilla.js 구조 설계 문서

엔진 전체의 클래스 구성과 소유 구조를 정리한 설계 문서다. API 레퍼런스가 아니라 "무엇이 무엇을 만들고, 들고 있고, 어떤 순서로 굴러가는가"를 보기 위한 문서다.

- 기준일: 2026-08-19
- 기준 소스: `src/` 전체 + `import.js`

---

## 1. 전체 배치

```
import.js                  # 단일 공개 API 배럴 — 소비자는 이 파일 하나만 import
src/base/                  # 엔진 비의존 기반 타입 (Object, Node, 수학, 플랫폼)
src/core/                  # 엔진 본체 (Engine, 매니저, Scene, Node 계열, Graphic, Component)
src/core/node/             # ComponentNode → TransformNode → WorldNode
src/core/component/        # Paint, Sprite, Text, RichText, Mask
src/core/graphic/          # ShaderProgram, ImageTextureCache, TextStringTextureCache
src/resource/              # Asset 파생 (Image/Audio/Text/Json/Font/Blob) + AnimationClip
src/ui/                    # 두 갈래 UI (Component 계열 UIView / Node 계열 UINode) + autolayout/
src/misc/                  # DEVTools, NodeLayout, DynamicFont, VirtualPad 등 부가 기능
src/web/                   # DOM 영역 유틸 (Pane, WebSocketClient) — 캔버스 밖 세계
src/game/                  # GameScene (게임용 공통 베이스 씬)
src/experimental/          # 컬렉션, Action, Animator, Visual + graphics/ (WebGL2 3D 스택)
src/experimental/graphics/ # 3D: FbxLoader, SkinnedModel, Material, SkinnedModelRenderer,
                           #     ShadowMap, RenderTarget, FullscreenPass, BloomEffect
src/deprecated/            # AnchoredWorldNode (폐기)
```

레이어 방향은 아래에서 위로만 의존한다: `base` ← `core` ← (`resource`, `ui`, `game`, `misc`, `experimental`). `src/web` 은 엔진 노드 트리와 무관한 DOM 세계다.

---

## 2. 설계 원칙

1. **전역 내장 객체 규약** — 엔진이 `Object`, `Math` 등의 이름을 자체 클래스로 가리므로, 자바스크립트 내장은 반드시 `const System = globalThis` 를 통해 `System.Math`, `System.Object` 로 접근한다. `import.js` 최상단의 `export const System = globalThis` 가 이 규약을 API 표면에 편입시킨다.
2. **단일 루트 클래스** — 거의 모든 클래스가 `base/Object` 를 상속한다. Object 는 GUID(instanceId), 복제(clone/structuredClone), 동등성(equals), 파괴 훅(destroy) 자리를 제공한다.
3. **게임오브젝트/컴포넌트 월드 없음(3D)** — 3D 쪽은 씬그래프 엔티티 시스템이 아니다. 로더가 `SkinnedModel` 이라는 완결된 모델 인스턴스를 만들고, 그 안에 메시·본·스킨·머티리얼·애니메이션이 전부 연결된다.
4. **임포터는 임포터일 뿐** — `FbxLoader` 는 파싱만 한다. GL 리소스나 셰이딩 로직을 갖지 않는다. 포맷별 해석 결과는 공통 중립 스키마로 수렴한 뒤 모델이 소비한다.
5. **Shader–Material–Model 계층 (유니티/언리얼 사상)** — Material 은 셰이더(템플릿)를 참조하는 인스턴스이고, 모델은 드로어블별로 Material 인스턴스를 참조하며, 렌더러가 이를 그린다.
6. **모델과 렌더 기능의 분리** — `SkinnedModel` 은 데이터 + 포즈 상태만 갖는다. 그리는 것은 `SkinnedModelRenderer` 라는 별도 객체다. 환경 상태(태양/안개/그림자)도 모델이 아닌 렌더러 소유다.
7. **2D 와 3D 는 하나의 GL 컨텍스트를 공유** — core 의 `Graphic`(2D)과 experimental/graphics(3D)는 같은 `WebGL2RenderingContext` 위에 공존한다.

---

## 3. 상속 계층

```
Object (base/object.js)
├── Node (base) ────────────────────────── 부모/자식 계층 + 활성화
│   └── ComponentNode (core) ──────────── 컴포넌트 보유 + tick
│       └── TransformNode (core) ──────── 로컬 TRS + 렌더 재귀
│           ├── WorldNode (core) ──────── pivot/anchor/contentSize + 터치 (수동 배치 노선)
│           │   ├── UIScrollBar, UIInputField (ui)
│           │   ├── TouchEffect (misc)
│           │   └── AnchoredWorldNode (deprecated)
│           ├── UINode (ui) ───────────── 오토레이아웃 제약 변수 (솔버 배치 노선)
│           └── HeatHazeEffect (experimental)
├── Component (core) ─────────────────── 노드에 부착되는 기능 단위
│   ├── Paint → Sprite
│   ├── Text → RichText
│   ├── Mask
│   ├── Visual (experimental)
│   └── UIView (ui) ──────────────────── UI 위젯 기반 (위젯 대부분은 노드가 아니라 컴포넌트)
│       ├── UILabel, UIImageView, UIProgressView
│       ├── UIScrollView → UISnapScrollView
│       └── UIControl → UISlider / UIButton → UIToggleButton
├── Scene (core)
│   ├── GameScene (game) ─────────────── WorldNode 노선 베이스 씬
│   └── UIScene (ui) ─────────────────── UINode + 솔버 노선 베이스 씬
├── Asset (core)
│   ├── ImageAsset, AudioAsset, FontAsset, VisualAsset
│   ├── TextAsset → JsonAsset
│   └── BlobAsset → BunchAsset
├── TouchRaycaster (core) → TouchRecognizer (ui)
├── 엔진/매니저: Engine, EngineConfiguration, SceneManager, TimeManager,
│                ViewManager, InputManager, GamepadManager, AudioManager
├── 렌더: Graphic, ShaderProgram, ImageTextureCache, TextStringTextureCache
├── 3D (experimental/graphics): FbxLoader, SkinnedModel, SkinnedModelRenderer,
│                Material, ShadowMap, RenderTarget, FullscreenPass, BloomEffect
├── 수학/자료: Vector2/3, Matrix4, Quaternion, TransformMatrix, Rect, OBB, Color,
│                List/Dictionary/Queue/Stack/Set, FiniteStateMachine
└── 기타: Tween, Animation, Frame, Animator, Action, DEVTools, NodeLayout,
          DynamicFont, VirtualPad, WebSocketClient ...
```

주의할 분기 두 곳:
- `TransformNode` 아래에서 **WorldNode 노선**(pivot/anchor 수동 배치)과 **UINode 노선**(제약 솔버 자동 배치)이 갈리며, 둘은 상속 관계가 없다.
- UI 위젯 대부분은 **노드가 아니라 Component** 다 (`UIView extends Component`). 노드인 위젯은 `UIScrollBar` / `UIInputField` 뿐이다.

Object 를 상속하지 않는 예외: `AudioPlayer`, `Pane`, autolayout 전체(`LayoutSolver` 등 — 독립 수학 모듈).

---

## 4. 소유 구조

"A ── B" 는 A 가 B 를 생성·소유함을 뜻한다. "(참조)" 는 참조만 보유.

### 4-1. 엔진 루트

```
Engine
├── EngineConfiguration (참조 — 외부 주입)
├── Platform ─────────────── canvas 획득 담당
├── Graphic ──────────────── WebGL2 컨텍스트 + 2D 렌더 파이프라인 소유
│   ├── ShaderProgram (2D 내장 셰이더)
│   ├── ImageTextureCache ── WeakMap<image, texture> (원본 GC 시 함께 수거)
│   ├── TextStringTextureCache ── 문자열 → 텍스처 LRU (상한 512) + 오프스크린 2D 캔버스 2개
│   └── VAO/VBO/스크래치 버퍼/1x1 흰색 텍스처
├── SceneManager ─────────── 로드된 Scene 목록 보관 (Scene 생성은 호출자 몫)
├── TimeManager
├── ViewManager ──────────── canvas (참조) + 뷰 스케일/좌표 변환
├── InputManager
│   └── GamepadManager ───── 게임패드는 Engine 직속이 아니라 InputManager 하위
├── AudioManager ─────────── AudioContext lazy 생성. AudioPlayer 는 생성 후 소유권 이양
└── Version
```

- `Engine` 은 생성 시 자신을 `System.vanillaEngine` 전역에 등록하고 `Engine.getEngine()` 정적 접근자를 제공한다 — 사실상 암묵적 싱글턴.
- rAF 루프도 Engine 이 소유한다 (`frame.js` 의 `Frame` 은 루프가 아니라 스프라이트 이미지 영역 클래스다).

### 4-2. 씬 → 노드 트리

```
SceneManager ── Scene[] (보관·생명주기만. 인스턴스는 호출자가 new)
Scene
├── Engine (참조 — SceneManager 가 주입)
├── 루트 WorldNode ("root") ── create() 시점에 생성 (생성자 아님에 주의)
└── Tween[] ── startTween 으로 등록, 완료 시 자동 제거

Node 트리: 부모가 children[] 을 소유 + 자식이 parent 역참조
ComponentNode ── Component[] ── addComponent(type) 이 직접 new + require() 의존성 재귀 추가
Component ── 소유 노드 (참조)
```

- 씬-레이어 구조는 존재하지 않는다. `core/layer.js` 는 빈 스텁이며 어디서도 쓰이지 않는다. 실제 구조는 씬 → 루트 노드 → 노드 트리다.

### 4-3. UI

```
UIScene
├── LayoutSolver ─────────── 솔버 소유자는 씬. UINode 는 setSolver() 로 주입받아 사용
├── screenNode / safeAreaLayoutGuide (UINode) ── 트리에 넣지 않는 순수 가이드
├── DEVTools (F2 하이어라키/인스펙터)
└── TouchRecognizer ──────── UIKit 스타일 제스처 (드래그 임계 + delaysContentTouches)

UINode
├── LayoutVariable 8개 (left/right/top/bottom/width/height/centerX/centerY)
├── 본질 제약 4개 (right=left+width 등) + 사용자 제약 + intrinsic 제약
└── layoutMarginsGuide (자식 UINode, lazy)

UIView(Component).attach(node)
└── content WorldNode 생성 → 호스트 노드의 자식으로 추가 (트리 소유권은 호스트에)
UILabel ── Text/RichText 를 require() 로 선언 → 소유는 호스트 ComponentNode
UIScrollView ── Mask 를 require(), 스크롤바는 host 의 sibling 으로 생성
```

터치 흐름: DOM 이벤트 → Engine → InputManager 플래그 → Scene.tickTouch → TouchRecognizer 가 루트 트리를 draw 순서로 순회해 최상위 interactable WorldNode 선택 → 노드가 자기 컴포넌트들에 전달 → UIButton 등 Component 가 처리.

### 4-4. 애셋

- **중앙 리소스 매니저는 없다** (`core/resources.js` 는 빈 파일). 애셋은 `new ImageAsset()` → `await load(path)` 하는 인스턴스 단위 소유이며, 보통 씬이 멤버로 든다.
- 캐시는 GPU 리소스 레벨에만 존재하고 `Graphic` 이 소유한다 (ImageTextureCache / TextStringTextureCache).

### 4-5. 3D 스택 (experimental/graphics)

```
씬(샘플 코드)
├── SkinnedModelRenderer ── 씬당 하나
│   ├── ShaderProgram (스키닝 PBR 셰이더 = 머티리얼 템플릿)
│   ├── ShaderProgram (깊이 패스 셰이더 — 섀도우 캐스팅)
│   └── 환경 상태: sunDirection / fogColor / fogRange / shadowMap / shadowStrength
├── SkinnedModel ── 모델 인스턴스, 여러 개 가능 (렌더 기능 없음)
│   ├── nodeList (본 계층 + 포즈 상태: currentTRS, worldMatrix)
│   ├── skinList (jointNodeIndices + inverseBindMatrices + jointMatrixArray)
│   ├── drawableList ── { VAO, 인덱스, skinIndex, material(참조) }
│   ├── Material[] ── 드로어블이 참조하는 인스턴스
│   │   ├── ShaderProgram (참조 — 렌더러의 템플릿)
│   │   ├── PBR 팩터 (baseColor/metallic/roughness/emissive)
│   │   └── GL 텍스처 7종 (baseColor/normal/metallicRoughness/glossiness/
│   │                      occlusion/emissive/specular, 없으면 1x1 대체)
│   └── animationList ── 클립 (채널 = 노드 인덱스 + 시간/값 커브)
├── ShadowMap ── 깊이 텍스처 + 직교 광원 행렬 (텍셀 스냅)
├── RenderTarget ── 오프스크린 FBO (포스트 프로세싱 기본 단위)
├── FullscreenPass ── 풀스크린 삼각형 패스
└── BloomEffect ── 밝은 영역 추출 → 블러 → 합성 체인
```

- `FbxLoader` 는 소유 관계 밖의 **순수 파서**다. `SkinnedModel.loadFromFbxUrl` 이 일시적으로 생성해 쓰고 버린다.
- `ShaderProgram` 은 core/graphic 소속이며 2D/3D 가 공유하는 공용 부품이다.
- 텍스처 유닛 배치 규약: 0 = baseColor, **1 = 섀도우 맵 전용(모델 머티리얼 사용 금지)**, 2~7 = normal/metallicRoughness/glossiness/occlusion/emissive/specular.

---

## 5. 프레임 루프

```
new Engine(config) → 매니저 생성 + DOM 이벤트 바인딩 + resize()
engine.run(scene)  → 기본 폰트 로드 + sceneManager.loadScene(scene) + rAF 시작

매 프레임 Engine.updateEngine(timestamp):
1. graphic.applySettings()      # 뷰포트/프로젝션 갱신 + 상태 리셋 + 스텐실 클리어
2. timeManager.update()         # timeDelta 산출
3. inputManager.tick()          # 게임패드 폴링 포함
4. 로드된 씬마다:
   - 미로드 씬 → drawOnLoad() 만 (로딩 화면)
   - scene.tick(timeDelta)      # root.tick 재귀(컴포넌트 tick) → 터치 디스패치 → 트윈
   - scene.preDraw / draw / postDraw   # draw 기본 구현 = graphic.drawNode(root) 재귀
   (씬마다 try/catch — 한 씬의 예외가 루프를 죽이지 않음)
5. 통계 출력(옵션) → 1회성 입력 플래그 클리어 → 다음 rAF
```

노드 렌더 재귀: `drawNode` = pushTransform(로컬 TRS/pivot 보정) → 컴포넌트 draw → 자식 재귀 → popTransform. `Mask` 컴포넌트는 자식 그리기 전후로 스텐실 클립을 걸고 푼다.

3D 씬(ancientmountain 등)은 이 루프 대신 **자체 rAF + 자체 패스 구성**을 쓴다: 섀도우 깊이 패스(`ShadowMap.beginRender` → `renderer.drawDepth`) → 씬 패스(RenderTarget) → 본 패스(`renderer.draw`) → 포스트(BloomEffect) → HUD(Graphic 2D).

---

## 6. 렌더링 구조

### 6-1. 2D — core/Graphic

- **WebGL2 기반**이다 (Canvas2D 아님, 폴백 없음). Canvas2D 시절의 API 표면(좌상 원점, save/restore 상태 스택, fillRect/drawImage/fillText)을 WebGL2 위에 재현한다.
- 모든 드로우는 `drawVertices()` 한 지점으로 수렴한다 (배칭 삽입 지점). 단색 도형도 1x1 흰색 텍스처로 텍스처 경로와 통일.
- 클리핑은 스텐실 버퍼 기반 (회전/스케일된 마스크 정확히 처리). 텍스트는 오프스크린 2D 캔버스에 구워 텍스처로 출력.
- 블렌드는 Canvas2D 합성 문자열 9종만 고정 블렌딩으로 재현, 나머지는 source-over 폴백.

### 6-2. 3D — experimental/graphics

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
- 셰이더는 쿡-토런스 GGX PBR 하나로 통일 (노멀맵은 화면공간 미분 코탄젠트 프레임 — 탄젠트 어트리뷰트 불필요).
- 애니메이션 추가 로드: `addAnimationsFromFbxUrl(url, clipName, ignoreTranslation)` 이 애니 전용 FBX 를 **본 이름 매칭으로 리타게팅**해 클립을 추가한다. 루트 모션이 박힌 클립은 이동 채널을 버릴 수 있다.
- 매 프레임: `model.update(dt)` 가 클립 샘플링(크로스페이드) → 조인트 오프셋 → 월드 행렬 → 조인트 행렬(월드 x 역바인드)까지 계산하고, `renderer.draw(model, ...)` 가 GL 상태를 잡고 드로어블을 순회한다.

---

## 7. 공개 API 표면 (import.js)

- 저장소 루트의 단일 배럴 파일. 주석 섹션 8블록(내장/기반/코어/기본 컴포넌트/UI/리소스/기타/실험)이 곧 논리 레이어 구분이다.
- 열거는 클래스와 같은 줄에 함께 export 한다 (`export { ViewScaleMode, ViewManager }`).
- **의도적 미노출** = 내부 구현 취급: `AudioManager`/`AudioPlayer`/`GamepadManager`(Engine 경유 사용), `Layer`, `DEVTools`, `GameScene`, `FbxLoader`(SkinnedModel 경유), 텍스처 캐시 2종, autolayout 내부 타입, src/web 전체. 미노출 클래스가 필요한 프로젝트는 파일 경로로 직접 import 한다.

---

## 8. 알려진 공백 / 레거시

| 항목 | 상태 |
|---|---|
| `core/resources.js` | 0 바이트 — 중앙 애셋 캐시 계층 미구현 (현재는 인스턴스 단위 소유) |
| `core/layer.js` | 빈 스텁. base/Object 미임포트로 전역 Object 상속. 미사용·미노출 |
| `Object.destroy()` | `#isDestroyed` 를 갱신하지 않는 no-op 훅 — `isDestroyed()` 는 항상 false |
| `Scene` 초기화 | 루트 노드가 생성자가 아닌 `create()` 에서 생성됨 — SceneManager 경유가 암묵 계약 |
| `experimental/graphics/webgl2.js` | import 경로 깨짐 + 미노출 — 데드 코드 |
| `experimental/graphics/gl2d.js` | export 없음 — 데드 코드 |
| `experimental/aabb.js`, `transform2d.js` | 전체 주석 처리 — 데드 파일 |
| `experimental/camera.js` | Canvas2D 시절 잔재 — 현 Graphic(WebGL2)과 불일치 |
| `misc/uibuilder.js` | NodeLayout 으로 대체됨 (주석 1줄만 남음) |
| Sprite 블렌드 | `SpriteBlendMode` 27종 중 Graphic 이 실제 재현하는 것은 9종, 나머지는 source-over 폴백 |
| 3D 머티리얼 공유 | 텍스처/머티리얼/클립의 모델 간 공유 캐시 없음 — 모델 단위 소유 (공유 소비자가 생기면 도입) |
