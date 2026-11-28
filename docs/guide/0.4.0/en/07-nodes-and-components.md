# Nodes and Components

What you see in a scene is built as a node tree. Nodes have a position and a place in the hierarchy, while features such as drawing and movement are handled by components attached to nodes. This chapter covers how the node classes relate, attaching children, adding and finding components, transforms, writing your own components, and walking the tree.

## How the classes relate

```text
Node                 parent and children, active state, name
└── ComponentNode    component list, tick
    └── TransformNode    local position, rotation, scale, opacity, drawing
        ├── WorldNode    content size, pivot, anchor, touch hit test (placed by hand)
        └── UINode       position solved from constraint variables (constraint based layout)
Component            feature attached to a node (Paint, Sprite, Text, Mask, UIButton ...)
```

- Ordinary 2D objects and screen elements are made with `WorldNode`. The scene's root node (`scene.getRoot()`) is a `WorldNode` too.
- `UINode` is a separate branch that does not connect to `WorldNode`. Placing nodes with constraints is covered in the "UI" chapter.
- `Component` is not a node. It attaches to a node derived from `ComponentNode` and draws and updates at that node's position.

## Creating and attaching nodes

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

- `addChild(child)` appends to the end of the child list. If the node was attached to another parent, it is detached from there first.
- `removeChild(child)` only detaches; it does not destroy the node. A detached node can be attached again.
- A node starts with default values from its constructor (position 0, 0, scale 1, rotation 0, opacity 1, active). A `WorldNode` has content size (0, 0) and its pivot and anchor at the center (0.5, 0.5).

## Positioning a WorldNode

The local position of a `WorldNode` is "where this node's pivot is, measured from the top left of the parent's content area". The pivot is a ratio inside the content area (0 to 1), so with the default (0.5, 0.5) the center of the node sits on its local position. In the example above, the center of `Badge` sits on the top right corner of `Panel` (400, 0).

| Method | Description |
| --- | --- |
| `setContentSize(size)`, `setContentSizeXY(width, height)` | Content size. `Paint` and `Sprite` fill this size |
| `setPivot(pivot)` | Pivot (clamped to 0 to 1). There are nine values such as `Pivot.topLeft`, `Pivot.middleCenter` and `Pivot.bottomRight` |
| `setAnchor(anchor)` | Anchor (0 to 1). Not used for drawing; only `setAnchoredPosition` uses it to compute a position |
| `setAnchoredPosition(position)` | Sets the local position measured from the anchor point (parent size x anchor) inside the parent's content area |
| `setRect(x, y, width, height)` | Sets the content size and local position together so the top left lands on (x, y), wherever the pivot is |

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

The first line is `740 565`. (800 x 1 - 60, 600 x 1 - 35) The second line is `20 20` because the pivot is the top left.

## Transforms

| Local (relative to parent) | Global (relative to root) | Description |
| --- | --- | --- |
| `setLocalPosition`, `setLocalPositionXY`, `getLocalPosition` | `setPosition`, `getPosition` | Position |
| `setLocalRotation`, `getLocalRotation` | `setRotation`, `getRotation` | Rotation (degrees, clockwise) |
| `setLocalScale`, `setLocalScaleXY`, `getLocalScale` | `setScale`, `getScale` | Scale |
| `setLocalOpacity`, `getLocalOpacity` | `getOpacity` | Opacity (clamped to 0 to 1, multiplied down to children) |

When drawing, a node moves to its local position, rotates, applies its scale, then moves back by the pivot (content size x pivot) and draws its components with the top left of the content area as the origin. Children repeat the same steps from that origin. So rotating and scaling a parent rotates and scales its children with it.

`WorldNode` also provides screen side tests.

- `getWorldCorners()`: the four corners after all parents' position, rotation and scale (top left, top right, bottom right, bottom left)
- `getWorldBounds()`: the axis aligned rectangle around those four points
- `contains(viewPosition)`: whether a point in view coordinates is inside the node (correct for rotated nodes too)
- `convertViewToLocal(viewPosition)`: converts view coordinates to this node's content area coordinates (top left is 0, 0)

## Active state and draw order

- A node with `setActive(false)` and its descendants receive no updates (`tick`), no drawing and no touch hit tests. `isActiveInHierarchy()` checks that every node up to the root is active.
- A node with opacity 0 draws neither itself nor its descendants, but still receives updates.
- Children are drawn in child list order. Later children appear on top. Change the order among siblings with `setSiblingIndex(index)` and read it with `getSiblingIndex()`.

## Adding and finding components

| Method | Description |
| --- | --- |
| `addComponent(Type)` | Takes a class, creates and attaches a new instance, and returns it |
| `getOrAddComponent(Type)` | The existing one if there is one, otherwise a newly attached one |
| `getComponent(Type)` | The first component of that class (or a subclass), or `null` |
| `getComponents(Type)` | Every component of that class (array) |
| `hasComponent(Type)` | Whether there is one |
| `getAllComponents()` | All of them, in attach order |
| `removeComponent(component)` | Detaches the instance |

A component declares the components it needs with `require()`. Right before attaching, `addComponent` first attaches that list to the same node with `getOrAddComponent`. For example, `UILabel` requires `Text` and `RichText`, and `UIScrollView` requires `Mask`.

Attaching goes constructor, node assignment (`setNode`), attaching required components, then `attach(node)`. Detaching clears the node, removes it from the list, and then calls `detach(node)`.

## Writing a component

Extend `Component` and override only what you need.

| Method to override | When it is called |
| --- | --- |
| `attach(node)`, `detach(node)` | When attached to a node, when detached |
| `tick(timeDelta)` | Every frame while the node is active. Only components that override `tick` are called (`isTickNeeded()`) |
| `draw(graphic)` | When the node is visible and the component is enabled (`isEnable()`). The origin is the top left of the node's content area |
| `require()` | Right before attaching. The list of classes to attach with it |
| `isDrawnInsideContent()` | Return `true` if you draw only inside the content area. When every enabled component of the node says so, off-screen culling skips drawing the node while it is off screen |

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

Components draw in attach order. In the example above, `Paint` fills the background and then `CrossMark` draws lines on top of it.

## Walking the node tree

| Method | Description |
| --- | --- |
| `getParent()`, `isRoot()`, `isLeaf()` | Parent, whether it has no parent, whether it has no children |
| `getChildren()`, `getChildCount()`, `getChild(index)` | Direct children |
| `findChildByName(name)`, `findChild(predicate)` | First match among direct children |
| `findDescendantByName(name)`, `findChildRecursive(predicate)` | First match among all descendants, depth first (`findChildRecursiveByName` is the same as `findDescendantByName`) |
| `removeChildByName(name)`, `removeChildAt(index)`, `removeChildren()` | Detach direct children |
| `destroyChildrenWhere(predicate)` | Detaches the direct children that match, calls `destroy()` on them, and returns how many |

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

## Things to watch

- `getLocalPosition()`, `getLocalScale()`, `getPivot()` and `getContentSize()` return copies. Changing the returned vector does not change the node, so `set` the changed value back.
- `getComponent(Type)` finds subclasses too. `Sprite` extends `Paint`, so `getComponent(Paint)` may return a `Sprite`.
- `setEnable(false)` stops that component's drawing, but its `tick` keeps being called while the node is active. To stop updates too, check `isEnable()` inside the component or turn the node off.
- For a node to receive touches, besides `WorldNode.setInteractable(true)`, the scene has to pass touches to nodes. (`TouchRecognizer`, "Input" chapter)
- The root node is created in the scene's `create()` and gets the view size in `load`. Attach nodes after `create` has run (after `super.create()`), or in `load` or `initialize`.

## Related classes

Node, ComponentNode, TransformNode, WorldNode, UINode, Component, Pivot, Paint, Scene
