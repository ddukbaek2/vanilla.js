//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Scene, WorldNode, Vector2, Pivot, Color, Rect, ViewScaleMode } from "../../import.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 손잡이의 길이와 굵기와 잡는 거리. (화면 픽셀)
export const HANDLE_LENGTH = 70;
const HANDLE_WIDTH = 3;
const HANDLE_PICK_DISTANCE = 9;
const ROTATE_HANDLE_RADIUS = 60;

// 도구.
export const EditorTool = System.Object.freeze({
	hand: "hand",
	move: "move",
	rotate: "rotate",
	scale: "scale",
});

// 손잡이 종류. (잡은 것)
export const HandleKind = System.Object.freeze({
	none: "none",
	moveX: "moveX",
	moveY: "moveY",
	moveFree: "moveFree",
	rotate: "rotate",
	scaleX: "scaleX",
	scaleY: "scaleY",
	scaleUniform: "scaleUniform",
});

const GRID_COLOR = new Color(1, 1, 1, 0.05);
const GRID_MAJOR_COLOR = new Color(1, 1, 1, 0.1);
const AXIS_X_COLOR = new Color(0.9, 0.3, 0.3, 1);
const AXIS_Y_COLOR = new Color(0.4, 0.85, 0.4, 1);
const SELECTION_COLOR = new Color(0.3, 0.55, 1, 1);
const HOVER_COLOR = new Color(1, 1, 1, 0.35);
const ROTATE_COLOR = new Color(0.4, 0.7, 1, 1);
const FRAME_COLOR = new Color(1, 1, 1, 0.25);


//==============================================================================
// 에디터 씬. (카메라 노드 밑의 문서 루트에 편집하는 노드를 두고, 격자와 선택 손잡이를 그린다)
// - 루트 → 카메라 노드(밀기와 키우기) → 문서 루트(문서로 저장하는 노드, 늘 제자리) → 편집하는 노드들.
// - 재생 중이 아니면 노드의 tick 에 시간을 0 으로 준다. (편집 중에는 움직임이 멈춰 있다)
// - 문서의 화면 틀(frameSize)을 옅은 테로 그린다. (게임의 기준 해상도)
//==============================================================================
export class EditorScene extends Scene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WorldNode } */ #cameraNode;
	/** @private @type { WorldNode } */ #documentRoot;
	/** @private @type { boolean } */ #isPlaying;
	/** @private @type { WorldNode | null } */ #selectedNode;
	/** @private @type { WorldNode | null } */ #hoverNode;
	/** @private @type { string } */ #tool;
	/** @private @type { Vector2 } */ #frameSize;
	/** @private @type { function(): void | null } */ #readyEvent;
	/** @private @type { boolean } */ #isGameView; // 게임 뷰. (격자와 손잡이 없이 화면 틀만, 틀 밖은 가린다)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#isPlaying = false;
		this.#selectedNode = null;
		this.#hoverNode = null;
		this.#tool = EditorTool.move;
		this.#frameSize = Vector2.create(1280, 720);
		this.#readyEvent = null;
		this.#isGameView = false;
	}

	//==============================================================================
	// 생성. (카메라 노드와 문서 루트)
	//==============================================================================
	create() {
		super.create();
		const root = this.getRoot();
		root.setPivot(Pivot.topLeft);
		this.#cameraNode = new WorldNode();
		this.#cameraNode.setName("editorCamera");
		this.#cameraNode.setPivot(Pivot.topLeft);
		root.addChild(this.#cameraNode);
		this.#documentRoot = this.createDocumentRoot();
		this.#cameraNode.addChild(this.#documentRoot);
	}

	//==============================================================================
	// 문서 루트 만들기. (이름 sceneRoot, 왼쪽 위 피봇, 크기 없음)
	//==============================================================================
	/**
	 * @returns { WorldNode }
	 */
	createDocumentRoot() {
		const documentRoot = new WorldNode();
		documentRoot.setName("sceneRoot");
		documentRoot.setPivot(Pivot.topLeft);
		documentRoot.setContentSize(Vector2.create(0, 0));
		return documentRoot;
	}

	//==============================================================================
	// 초기화. (뷰를 캔버스 크기 그대로, 카메라를 틀 가운데로)
	//==============================================================================
	/**
	 * @param { * } engine
	 */
	initialize(engine) {
		super.initialize(engine);
		const viewManager = engine.getViewManager();
		viewManager.setViewScaleMode(ViewScaleMode.none);
		this.frameDocument();
		const readyEvent = this.#readyEvent;
		if (readyEvent !== null) {
			readyEvent();
		}
	}

	//==============================================================================
	// 화면 크기 바뀜. (게임 뷰면 틀을 다시 맞춘다)
	//==============================================================================
	/**
	 * @param { Vector2 } canvasNativeSize
	 */
	resize(canvasNativeSize) {
		super.resize(canvasNativeSize);
		if (this.#isGameView) {
			this.frameDocument();
		}
	}

	//==============================================================================
	// 준비되면 부를 함수 설정.
	//==============================================================================
	/**
	 * @param { function(): void } readyEvent
	 */
	setReadyEvent(readyEvent) {
		this.#readyEvent = readyEvent;
	}

	//==============================================================================
	// 주기적 갱신. (편집 중에는 시간을 0 으로 흘려 위젯 배치만 맞추고, 재생 중에만 시간이 간다)
	//==============================================================================
	/**
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		super.tick(this.#isPlaying ? timeDelta : 0);
	}

	//==============================================================================
	// 이전 출력. (바탕과 격자와 화면 틀)
	//==============================================================================
	/**
	 * @param { * } graphic
	 */
	preDraw(graphic) {
		const engine = this.getEngine();
		const viewSize = engine.getViewManager().getViewSize();
		const cameraPosition = this.#cameraNode.getLocalPosition();
		const zoom = this.#cameraNode.getLocalScale().x;
		if (this.#isGameView) {
			graphic.setFillColor(new Color(0.1, 0.1, 0.12, 1));
			graphic.drawRect(Rect.create(0, 0, viewSize.x, viewSize.y));
			return;
		}
		graphic.setFillColor(new Color(0.16, 0.17, 0.19, 1));
		graphic.drawRect(Rect.create(0, 0, viewSize.x, viewSize.y));

		// 격자. (100 단위마다 진하게, 너무 촘촘하면 10 배씩 넓힌다)
		let gridStep = 50;
		while (gridStep * zoom < 24) {
			gridStep *= 10;
		}
		const startX = System.Math.floor(-cameraPosition.x / zoom / gridStep) * gridStep;
		const startY = System.Math.floor(-cameraPosition.y / zoom / gridStep) * gridStep;
		const endX = (viewSize.x - cameraPosition.x) / zoom;
		const endY = (viewSize.y - cameraPosition.y) / zoom;
		for (let worldX = startX; worldX <= endX; worldX += gridStep) {
			const screenX = cameraPosition.x + worldX * zoom;
			const isMajor = System.Math.round(worldX / gridStep) % 2 === 0;
			graphic.setStrokeColor(worldX === 0 ? AXIS_Y_COLOR : (isMajor ? GRID_MAJOR_COLOR : GRID_COLOR));
			graphic.drawLine([Vector2.create(screenX, 0), Vector2.create(screenX, viewSize.y)], 1);
		}
		for (let worldY = startY; worldY <= endY; worldY += gridStep) {
			const screenY = cameraPosition.y + worldY * zoom;
			const isMajor = System.Math.round(worldY / gridStep) % 2 === 0;
			graphic.setStrokeColor(worldY === 0 ? AXIS_X_COLOR : (isMajor ? GRID_MAJOR_COLOR : GRID_COLOR));
			graphic.drawLine([Vector2.create(0, screenY), Vector2.create(viewSize.x, screenY)], 1);
		}

		// 화면 틀. (문서의 기준 해상도)
		const frameSize = this.#frameSize;
		graphic.setStrokeColor(FRAME_COLOR);
		graphic.drawLineLoop([
			Vector2.create(cameraPosition.x, cameraPosition.y),
			Vector2.create(cameraPosition.x + frameSize.x * zoom, cameraPosition.y),
			Vector2.create(cameraPosition.x + frameSize.x * zoom, cameraPosition.y + frameSize.y * zoom),
			Vector2.create(cameraPosition.x, cameraPosition.y + frameSize.y * zoom),
		], 1);
	}

	//==============================================================================
	// 이후 출력. (올린 노드와 고른 노드의 테, 도구 손잡이)
	//==============================================================================
	/**
	 * @param { * } graphic
	 */
	postDraw(graphic) {
		if (this.#isGameView) {
			this.drawFrameMask(graphic);
			return;
		}
		const hoverNode = this.#hoverNode;
		if (hoverNode !== null && hoverNode !== this.#selectedNode && this.isInDocument(hoverNode)) {
			graphic.setStrokeColor(HOVER_COLOR);
			graphic.drawLineLoop(hoverNode.getWorldCorners(), 1);
		}
		const selectedNode = this.#selectedNode;
		if (selectedNode === null || !this.isInDocument(selectedNode)) {
			return;
		}
		graphic.setStrokeColor(SELECTION_COLOR);
		graphic.drawLineLoop(selectedNode.getWorldCorners(), 2);
		const origin = selectedNode.getPosition();
		const tool = this.#tool;
		if (tool === EditorTool.move || tool === EditorTool.scale) {
			const isScale = tool === EditorTool.scale;
			graphic.setStrokeColor(AXIS_X_COLOR);
			graphic.drawLine([origin, Vector2.create(origin.x + HANDLE_LENGTH, origin.y)], HANDLE_WIDTH);
			graphic.setStrokeColor(AXIS_Y_COLOR);
			graphic.drawLine([origin, Vector2.create(origin.x, origin.y - HANDLE_LENGTH)], HANDLE_WIDTH);
			graphic.setFillColor(AXIS_X_COLOR);
			graphic.drawRect(Rect.create(origin.x + HANDLE_LENGTH - 5, origin.y - 5, 10, 10));
			graphic.setFillColor(AXIS_Y_COLOR);
			graphic.drawRect(Rect.create(origin.x - 5, origin.y - HANDLE_LENGTH - 5, 10, 10));
			graphic.setFillColor(isScale ? new Color(0.9, 0.9, 0.9, 1) : new Color(0.3, 0.55, 1, 0.6));
			graphic.drawRect(Rect.create(origin.x - 7, origin.y - 7, 14, 14));
		}
		else if (tool === EditorTool.rotate) {
			graphic.setStrokeColor(ROTATE_COLOR);
			graphic.drawStrokeCircle(origin, ROTATE_HANDLE_RADIUS, 2);
			const radian = selectedNode.getRotation() * System.Math.PI / 180;
			graphic.drawLine([origin, Vector2.create(origin.x + System.Math.cos(radian) * ROTATE_HANDLE_RADIUS, origin.y + System.Math.sin(radian) * ROTATE_HANDLE_RADIUS)], 2);
		}
	}

	//==============================================================================
	// 화면 틀 밖 가리기. (게임 뷰, 틀 밖으로 나간 노드는 게임에서 보이지 않는다)
	//==============================================================================
	/**
	 * @param { * } graphic
	 */
	drawFrameMask(graphic) {
		const viewSize = this.getEngine().getViewManager().getViewSize();
		const cameraPosition = this.#cameraNode.getLocalPosition();
		const zoom = this.#cameraNode.getLocalScale().x;
		const left = cameraPosition.x;
		const top = cameraPosition.y;
		const right = cameraPosition.x + this.#frameSize.x * zoom;
		const bottom = cameraPosition.y + this.#frameSize.y * zoom;
		graphic.setFillColor(new Color(0, 0, 0, 1));
		graphic.drawRect(Rect.create(0, 0, viewSize.x, top));
		graphic.drawRect(Rect.create(0, bottom, viewSize.x, viewSize.y - bottom));
		graphic.drawRect(Rect.create(0, top, left, bottom - top));
		graphic.drawRect(Rect.create(right, top, viewSize.x - right, bottom - top));
	}

	//==============================================================================
	// 화면 위치에서 잡히는 손잡이. (고른 노드와 도구에 따라)
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition
	 * @returns { string } HandleKind
	 */
	pickHandle(viewPosition) {
		const selectedNode = this.#selectedNode;
		if (selectedNode === null || !this.isInDocument(selectedNode)) {
			return HandleKind.none;
		}
		const origin = selectedNode.getPosition();
		const deltaX = viewPosition.x - origin.x;
		const deltaY = viewPosition.y - origin.y;
		const tool = this.#tool;
		if (tool === EditorTool.move || tool === EditorTool.scale) {
			if (System.Math.abs(deltaX) <= HANDLE_PICK_DISTANCE && System.Math.abs(deltaY) <= HANDLE_PICK_DISTANCE) {
				return tool === EditorTool.scale ? HandleKind.scaleUniform : HandleKind.moveFree;
			}
			if (deltaX >= 0 && deltaX <= HANDLE_LENGTH + HANDLE_PICK_DISTANCE && System.Math.abs(deltaY) <= HANDLE_PICK_DISTANCE) {
				return tool === EditorTool.scale ? HandleKind.scaleX : HandleKind.moveX;
			}
			if (-deltaY >= 0 && -deltaY <= HANDLE_LENGTH + HANDLE_PICK_DISTANCE && System.Math.abs(deltaX) <= HANDLE_PICK_DISTANCE) {
				return tool === EditorTool.scale ? HandleKind.scaleY : HandleKind.moveY;
			}
		}
		else if (tool === EditorTool.rotate) {
			const distance = System.Math.hypot(deltaX, deltaY);
			if (System.Math.abs(distance - ROTATE_HANDLE_RADIUS) <= HANDLE_PICK_DISTANCE) {
				return HandleKind.rotate;
			}
		}
		return HandleKind.none;
	}

	//==============================================================================
	// 화면 위치에 있는 가장 위의 문서 노드. (그리는 차례가 늦은 것이 위, 꺼진 노드는 건너뛴다)
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition
	 * @returns { WorldNode | null }
	 */
	pickNode(viewPosition) {
		let pickedNode = null;
		const visit = (node) => {
			if (!node.isActive()) {
				return;
			}
			if (node !== this.#documentRoot && node.contains(viewPosition)) {
				pickedNode = node;
			}
			for (const childNode of node.getChildren()) {
				visit(childNode);
			}
		};
		visit(this.#documentRoot);
		return pickedNode;
	}

	//==============================================================================
	// 노드가 문서 안에 있는지. (문서 루트 자신은 아님)
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @returns { boolean }
	 */
	isInDocument(node) {
		let currentNode = node.getParent();
		while (currentNode !== null && currentNode !== undefined) {
			if (currentNode === this.#documentRoot) {
				return true;
			}
			currentNode = currentNode.getParent();
		}
		return false;
	}

	//==============================================================================
	// 카메라 밀기. (화면 픽셀)
	//==============================================================================
	/**
	 * @param { number } deltaX
	 * @param { number } deltaY
	 */
	panCamera(deltaX, deltaY) {
		const position = this.#cameraNode.getLocalPosition();
		this.#cameraNode.setLocalPosition(Vector2.create(position.x + deltaX, position.y + deltaY));
	}

	//==============================================================================
	// 카메라 키우기. (화면 위치를 가운데로 둔 채, 0.05 ~ 20 배)
	//==============================================================================
	/**
	 * @param { number } zoomRatio
	 * @param { Vector2 } viewPosition
	 */
	zoomCamera(zoomRatio, viewPosition) {
		const cameraNode = this.#cameraNode;
		const position = cameraNode.getLocalPosition();
		const zoom = cameraNode.getLocalScale().x;
		const nextZoom = System.Math.max(0.05, System.Math.min(20, zoom * zoomRatio));
		const appliedRatio = nextZoom / zoom;
		cameraNode.setLocalScale(Vector2.create(nextZoom, nextZoom));
		cameraNode.setLocalPosition(Vector2.create(viewPosition.x - (viewPosition.x - position.x) * appliedRatio, viewPosition.y - (viewPosition.y - position.y) * appliedRatio));
	}

	//==============================================================================
	// 화면 틀을 뷰 가운데에 맞추기.
	//==============================================================================
	frameDocument() {
		const engine = this.getEngine();
		if (!engine) {
			return;
		}
		const viewSize = engine.getViewManager().getViewSize();
		const frameSize = this.#frameSize;
		const margin = this.#isGameView ? 0 : 60;
		const maximumZoom = this.#isGameView ? 20 : 1;
		const zoom = System.Math.max(0.05, System.Math.min(maximumZoom, (viewSize.x - margin) / frameSize.x, (viewSize.y - margin) / frameSize.y));
		this.#cameraNode.setLocalScale(Vector2.create(zoom, zoom));
		this.#cameraNode.setLocalPosition(Vector2.create((viewSize.x - frameSize.x * zoom) * 0.5, (viewSize.y - frameSize.y * zoom) * 0.5));
	}

	//==============================================================================
	// 고른 노드를 뷰 가운데로.
	//==============================================================================
	frameSelected() {
		const selectedNode = this.#selectedNode;
		const engine = this.getEngine();
		if (selectedNode === null || !engine) {
			return;
		}
		const viewSize = engine.getViewManager().getViewSize();
		const origin = selectedNode.getPosition();
		this.panCamera(viewSize.x * 0.5 - origin.x, viewSize.y * 0.5 - origin.y);
	}

	//==============================================================================
	// 문서 루트 바꾸기. (불러온 문서, 카메라는 그대로)
	//==============================================================================
	/**
	 * @param { WorldNode } documentRoot
	 */
	replaceDocumentRoot(documentRoot) {
		const cameraNode = this.#cameraNode;
		cameraNode.removeChild(this.#documentRoot);
		documentRoot.setName("sceneRoot");
		documentRoot.setPivot(Pivot.topLeft);
		documentRoot.setLocalPosition(Vector2.create(0, 0));
		documentRoot.setLocalScale(Vector2.create(1, 1));
		documentRoot.setLocalRotation(0);
		cameraNode.addChild(documentRoot);
		this.#documentRoot = documentRoot;
		this.#selectedNode = null;
		this.#hoverNode = null;
	}

	//==============================================================================
	// 값 읽고 쓰기.
	//==============================================================================
	/**
	 * @returns { WorldNode }
	 */
	getDocumentRoot() {
		return this.#documentRoot;
	}

	/**
	 * @returns { WorldNode }
	 */
	getCameraNode() {
		return this.#cameraNode;
	}

	/**
	 * @returns { number }
	 */
	getZoom() {
		return this.#cameraNode.getLocalScale().x;
	}

	/**
	 * @param { boolean } isPlaying
	 */
	setPlaying(isPlaying) {
		this.#isPlaying = isPlaying;
	}

	/**
	 * @returns { boolean }
	 */
	isPlaying() {
		return this.#isPlaying;
	}

	/**
	 * @param { WorldNode | null } selectedNode
	 */
	setSelectedNode(selectedNode) {
		this.#selectedNode = selectedNode;
	}

	/**
	 * @returns { WorldNode | null }
	 */
	getSelectedNode() {
		return this.#selectedNode;
	}

	/**
	 * @param { WorldNode | null } hoverNode
	 */
	setHoverNode(hoverNode) {
		this.#hoverNode = hoverNode;
	}

	/**
	 * @param { string } tool
	 */
	setTool(tool) {
		this.#tool = tool;
	}

	/**
	 * @returns { string }
	 */
	getTool() {
		return this.#tool;
	}

	/**
	 * @param { boolean } isGameView
	 */
	setGameView(isGameView) {
		this.#isGameView = isGameView;
	}

	/**
	 * @returns { boolean }
	 */
	isGameView() {
		return this.#isGameView;
	}

	/**
	 * @param { Vector2 } frameSize
	 */
	setFrameSize(frameSize) {
		this.#frameSize = frameSize.clone();
	}

	/**
	 * @returns { Vector2 }
	 */
	getFrameSize() {
		return this.#frameSize;
	}
}
