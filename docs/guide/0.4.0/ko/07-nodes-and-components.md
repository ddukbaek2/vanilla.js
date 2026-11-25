# 노드와 컴포넌트

씬에 보이는 것은 노드 트리로 짓습니다. 노드는 자리와 계층을 갖고, 그리기나 움직임 같은 기능은 노드에 붙이는 컴포넌트가 맡습니다. 이 장에서는 노드 클래스들의 관계, 자식 붙이기, 컴포넌트 붙이기와 찾기, 변환, 직접 만드는 컴포넌트, 트리 돌기를 봅니다.

## 클래스 관계

```text
Node                 부모와 자식, 활성, 이름
└── ComponentNode    컴포넌트 목록, tick
    └── TransformNode    로컬 자리, 회전, 크기, 투명도, 그리기
        ├── WorldNode    내용 크기, 기준점(pivot), 앵커, 터치 판정 (손으로 놓는 노드)
        └── UINode       제약 변수로 자리를 푸는 노드 (제약 기반 레이아웃)
Component            노드에 붙는 기능 (Paint, Sprite, Text, Mask, UIButton ...)
```

- 보통의 2D 물체와 화면 요소는 `WorldNode` 로 만듭니다. 씬의 루트 노드(`scene.getRoot()`)도 `WorldNode` 입니다.
- `UINode` 는 `WorldNode` 와 이어지지 않는 다른 갈래입니다. 제약을 걸어 자리를 정하는 방식은 "UI" 장에서 봅니다.
- `Component` 는 노드가 아닙니다. `ComponentNode` 를 이어받은 노드에 붙어 그 노드의 자리에서 그리고 갱신합니다.

## 노드 만들고 붙이기

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, Paint, Vector2, Color } from "./build/vanilla.js";

class NodeScene extends Scene {
	initialize(engine) {
		super.initialize(engine);
		const root = this.getRoot();

		const panel = new WorldNode();
		panel.setName("Panel");
		panel.setContentSize(Vector2.create(400, 240));
		panel.setLocalPosition(Vector2.create(640, 360));
		const panelPaint = panel.addComponent(Paint);
		panelPaint.setColor(new Color(0.2, 0.25, 0.35, 1));
		panelPaint.setRoundSize(16);
		root.addChild(panel);

		const badge = new WorldNode();
		badge.setName("Badge");
		badge.setContentSize(Vector2.create(64, 64));
		badge.setLocalPosition(Vector2.create(400, 0));
		const badgePaint = badge.addComponent(Paint);
		badgePaint.setColor("#ffcc33");
		badgePaint.setRoundSize(32);
		panel.addChild(badge);
	}

	preDraw(graphic) {
		super.preDraw(graphic);
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		viewManager.applyViewRect(graphic);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new NodeScene());
```

- `addChild(child)` 는 자식 목록 맨 뒤에 붙입니다. 다른 부모에 붙어 있던 노드면 거기서 떼어 옵니다.
- `removeChild(child)` 는 떼어 내기만 하고 노드를 없애지 않습니다. 떼어 낸 노드는 다시 붙일 수 있습니다.
- 노드는 생성자에서 기본값(자리 0, 0, 크기 1, 회전 0, 투명도 1, 활성)을 가집니다. `WorldNode` 는 내용 크기 (0, 0), 기준점과 앵커가 가운데 (0.5, 0.5) 입니다.

## WorldNode 의 자리

`WorldNode` 의 로컬 자리는 "부모의 내용 영역 왼쪽 위에서 잰, 이 노드 기준점의 자리" 입니다. 기준점은 내용 영역 안의 비율(0 ~ 1)이라 처음 값 (0.5, 0.5) 이면 노드의 가운데가 로컬 자리에 옵니다. 위 예제에서 `Badge` 는 `Panel` 의 오른쪽 위 모서리(400, 0)에 가운데가 놓입니다.

| 메서드 | 내용 |
| --- | --- |
| `setContentSize(size)`, `setContentSizeXY(width, height)` | 내용 크기. `Paint` 와 `Sprite` 는 이 크기만큼 칠합니다 |
| `setPivot(pivot)` | 기준점 (0 ~ 1 로 자릅니다). `Pivot.topLeft`, `Pivot.middleCenter`, `Pivot.bottomRight` 같은 아홉 값이 있습니다 |
| `setAnchor(anchor)` | 앵커 (0 ~ 1). 그리기에는 쓰이지 않고 `setAnchoredPosition` 이 자리를 셀 때만 씁니다 |
| `setAnchoredPosition(position)` | 부모 내용 영역 안의 앵커 점(부모 크기 x 앵커)에서 잰 자리로 로컬 자리를 정합니다 |
| `setRect(x, y, width, height)` | 왼쪽 위가 (x, y) 에 오도록 내용 크기와 로컬 자리를 함께 정합니다 (기준점이 어디든) |

```javascript
import { WorldNode, Pivot, Vector2 } from "./build/vanilla.js";

const parent = new WorldNode();
parent.setPivot(Pivot.topLeft);
parent.setContentSize(Vector2.create(800, 600));

const corner = new WorldNode();
corner.setAnchor(Pivot.bottomRight);
corner.setContentSize(Vector2.create(100, 50));
parent.addChild(corner);
corner.setAnchoredPosition(Vector2.create(-60, -35));
const localPosition = corner.getLocalPosition();
console.log(localPosition.x, localPosition.y);

const label = new WorldNode();
label.setPivot(Pivot.topLeft);
parent.addChild(label);
label.setRect(20, 20, 300, 40);
const labelPosition = label.getLocalPosition();
console.log(labelPosition.x, labelPosition.y);
```

첫 줄은 `740 565` 입니다. (800 x 1 - 60, 600 x 1 - 35) 둘째 줄은 기준점이 왼쪽 위라 `20 20` 입니다.

## 변환

| 로컬 (부모 기준) | 전체 (루트 기준) | 내용 |
| --- | --- | --- |
| `setLocalPosition`, `setLocalPositionXY`, `getLocalPosition` | `setPosition`, `getPosition` | 자리 |
| `setLocalRotation`, `getLocalRotation` | `setRotation`, `getRotation` | 회전 (도, 시계 방향) |
| `setLocalScale`, `setLocalScaleXY`, `getLocalScale` | `setScale`, `getScale` | 크기 배율 |
| `setLocalOpacity`, `getLocalOpacity` | `getOpacity` | 투명도 (0 ~ 1 로 자릅니다, 자식에게 곱해 내려갑니다) |

그릴 때 노드는 로컬 자리로 옮기고, 회전하고, 크기를 곱한 뒤, 기준점만큼(내용 크기 x 기준점) 되돌아가 내용 영역의 왼쪽 위를 원점으로 컴포넌트를 그립니다. 자식은 그 원점에서 다시 같은 차례를 밟습니다. 그래서 부모를 돌리고 키우면 자식도 함께 돌고 커집니다.

`WorldNode` 는 화면 쪽 판정도 줍니다.

- `getWorldCorners()`: 부모들의 자리, 회전, 크기를 모두 거친 네 귀퉁이 (왼쪽 위, 오른쪽 위, 오른쪽 아래, 왼쪽 아래)
- `getWorldBounds()`: 그 네 점을 감싸는 축 정렬 사각형
- `contains(viewPosition)`: 뷰 좌표의 점이 노드 안인지 (돌아간 노드도 맞게)
- `convertViewToLocal(viewPosition)`: 뷰 좌표를 이 노드의 내용 영역 좌표로 (왼쪽 위가 0, 0)

## 활성과 그리는 차례

- `setActive(false)` 인 노드와 그 자손은 갱신(`tick`)도, 그리기도, 터치 판정도 받지 않습니다. `isActiveInHierarchy()` 는 루트까지 모두 활성인지 봅니다.
- 투명도가 0 인 노드는 자기와 자손을 그리지 않지만 갱신은 받습니다.
- 자식은 자식 목록 차례로 그립니다. 뒤에 있을수록 위에 보입니다. `setSiblingIndex(index)` 로 형제 사이의 차례를 바꾸고 `getSiblingIndex()` 로 읽습니다.

## 컴포넌트 붙이기와 찾기

| 메서드 | 내용 |
| --- | --- |
| `addComponent(Type)` | 클래스를 받아 새로 만들어 붙이고 그 인스턴스를 돌려줍니다 |
| `getOrAddComponent(Type)` | 있으면 그것, 없으면 새로 붙인 것 |
| `getComponent(Type)` | 그 클래스(또는 그 하위 클래스)인 첫 컴포넌트, 없으면 `null` |
| `getComponents(Type)` | 그 클래스인 컴포넌트 모두 (배열) |
| `hasComponent(Type)` | 있는지 |
| `getAllComponents()` | 붙은 차례대로 전부 |
| `removeComponent(component)` | 인스턴스를 떼어 냅니다 |

컴포넌트는 `require()` 로 함께 있어야 할 컴포넌트를 알립니다. `addComponent` 는 붙이기 직전에 그 목록을 같은 노드에 `getOrAddComponent` 로 먼저 붙입니다. 예를 들어 `UILabel` 은 `Text` 와 `RichText` 를, `UIScrollView` 는 `Mask` 를 요구합니다.

붙일 때 차례는 생성자, 노드 지정(`setNode`), 요구 컴포넌트 붙이기, `attach(node)` 입니다. 떼어 낼 때는 노드를 비우고 목록에서 뺀 뒤 `detach(node)` 를 부릅니다.

## 컴포넌트 만들기

`Component` 를 이어받아 필요한 것만 덮어씁니다.

| 덮어쓰는 메서드 | 불리는 때 |
| --- | --- |
| `attach(node)`, `detach(node)` | 노드에 붙을 때, 떨어질 때 |
| `tick(timeDelta)` | 노드가 활성인 동안 매 프레임. `tick` 을 덮어쓴 컴포넌트만 불립니다 (`isTickNeeded()`) |
| `draw(graphic)` | 노드가 보이고 컴포넌트가 켜져(`isEnable()`) 있을 때. 원점은 노드 내용 영역의 왼쪽 위 |
| `require()` | 붙기 직전. 함께 붙일 클래스 목록 |
| `isDrawnInsideContent()` | 내용 영역 안에만 그리면 `true` 를 돌려줍니다. 그 노드의 켜진 컴포넌트가 모두 이렇게 알리면 화면 밖 거르기가 노드가 화면 밖일 때 그리기를 건너뜁니다 |

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, Component, Paint, Vector2, Color } from "./build/vanilla.js";

class Spin extends Component {
	#degreesPerSecond;

	constructor() {
		super();
		this.#degreesPerSecond = 90;
	}

	setDegreesPerSecond(degreesPerSecond) {
		this.#degreesPerSecond = degreesPerSecond;
	}

	tick(timeDelta) {
		const node = this.getNode();
		const rotation = node.getLocalRotation();
		node.setLocalRotation(rotation + this.#degreesPerSecond * timeDelta);
	}
}

class CrossMark extends Component {
	draw(graphic) {
		const node = this.getNode();
		const contentSize = node.getContentSize();
		graphic.setStrokeColor("#ffffff");
		graphic.drawLine([Vector2.create(0, 0), Vector2.create(contentSize.x, contentSize.y)], 4);
		graphic.drawLine([Vector2.create(contentSize.x, 0), Vector2.create(0, contentSize.y)], 4);
	}

	isDrawnInsideContent() {
		return true;
	}
}

class ComponentScene extends Scene {
	initialize(engine) {
		super.initialize(engine);
		const root = this.getRoot();
		const node = new WorldNode();
		node.setContentSize(Vector2.create(160, 160));
		node.setLocalPosition(Vector2.create(640, 360));
		const paint = node.addComponent(Paint);
		paint.setColor(new Color(0.8, 0.3, 0.3, 1));
		node.addComponent(CrossMark);
		const spin = node.addComponent(Spin);
		spin.setDegreesPerSecond(45);
		root.addChild(node);

		const foundSpin = node.getComponent(Spin);
		const hasCrossMark = node.hasComponent(CrossMark);
		console.log(foundSpin === spin, hasCrossMark);
	}

	preDraw(graphic) {
		super.preDraw(graphic);
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		viewManager.applyViewRect(graphic);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new ComponentScene());
```

컴포넌트는 붙은 차례로 그립니다. 위 예제는 `Paint` 로 바탕을 칠한 뒤 `CrossMark` 가 그 위에 선을 긋습니다.

## 노드 트리 돌기

| 메서드 | 내용 |
| --- | --- |
| `getParent()`, `isRoot()`, `isLeaf()` | 부모, 부모가 없는지, 자식이 없는지 |
| `getChildren()`, `getChildCount()`, `getChild(index)` | 직계 자식 |
| `findChildByName(name)`, `findChild(predicate)` | 직계 자식 가운데 첫 것 |
| `findDescendantByName(name)`, `findChildRecursive(predicate)` | 자손 전체에서 깊이 우선으로 첫 것 (`findChildRecursiveByName` 은 `findDescendantByName` 과 같습니다) |
| `removeChildByName(name)`, `removeChildAt(index)`, `removeChildren()` | 직계 자식 떼어 내기 |
| `destroyChildrenWhere(predicate)` | 조건에 맞는 직계 자식을 떼어 `destroy()` 를 부르고 그 수를 돌려줍니다 |

```javascript
import { WorldNode, Paint } from "./build/vanilla.js";

function createNode(name) {
	const node = new WorldNode();
	node.setName(name);
	return node;
}

function visit(node, depth, lines) {
	const name = node.getName();
	lines.push(`${"  ".repeat(depth)}${name}`);
	const children = node.getChildren();
	for (const child of children) {
		visit(child, depth + 1, lines);
	}
}

const root = createNode("root");
const player = createNode("Player");
const weapon = createNode("Weapon");
const enemies = createNode("Enemies");
root.addChild(player);
player.addChild(weapon);
root.addChild(enemies);
for (let index = 0; index < 3; ++index) {
	const enemy = createNode(`Enemy${index}`);
	enemy.addComponent(Paint);
	enemies.addChild(enemy);
}

const lines = [];
visit(root, 0, lines);
console.log(lines.join("\n"));

const foundWeapon = root.findDescendantByName("Weapon");
const paintedNode = root.findChildRecursive((node) => {
	return node.hasComponent(Paint);
});
const removedCount = enemies.destroyChildrenWhere((node) => {
	return node.getName() !== "Enemy0";
});
const paintedName = paintedNode.getName();
const enemyCount = enemies.getChildCount();
console.log(foundWeapon === weapon, paintedName, removedCount, enemyCount);
```

## 주의할 점

- `getLocalPosition()`, `getLocalScale()`, `getPivot()`, `getContentSize()` 는 사본을 돌려줍니다. 받은 벡터를 고쳐도 노드는 그대로이므로 고친 값을 다시 `set` 합니다.
- `getComponent(Type)` 은 하위 클래스도 찾습니다. `Sprite` 는 `Paint` 를 이어받으므로 `getComponent(Paint)` 가 `Sprite` 를 돌려줄 수 있습니다.
- `setEnable(false)` 는 그 컴포넌트의 그리기를 멈추지만, `tick` 은 노드가 활성이면 계속 불립니다. 갱신까지 멈추려면 컴포넌트 안에서 `isEnable()` 을 보거나 노드를 끕니다.
- 노드가 터치를 받으려면 `WorldNode.setInteractable(true)` 와 함께 씬이 터치를 노드로 넘겨야 합니다. (`TouchRecognizer`, "입력" 장)
- 루트 노드는 씬의 `create()` 에서 생기고 `load` 에서 뷰 크기를 받습니다. 노드를 붙이는 일은 `create` 를 부른 뒤(`super.create()` 다음)나 `load`, `initialize` 에서 합니다.

## 관련 클래스

Node, ComponentNode, TransformNode, WorldNode, UINode, Component, Pivot, Paint, Scene
