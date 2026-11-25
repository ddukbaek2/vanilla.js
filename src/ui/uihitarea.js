//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Component } from "../core/component.js";
import { WorldNode } from "../core/node/worldnode.js";
import { UIButton } from "./uibutton.js";


//==============================================================================
// 누르는 자리 넓히기.
// - 보이는 단추는 그대로 두고, 단추 바로 뒤 형제로 투명한 누름 자리를 두어 가로세로를 가장 작은 크기 이상으로 넓힌다. (손가락으로 누르기 좋게)
// - 그리는 차례가 늦은 노드가 누름을 받으므로, 단추 위는 단추가 받고 단추 둘레의 넓힌 몫만 누름 자리가 받는다.
// - 누름 자리를 누르면 단추의 클릭 알림을 그대로 부른다. 단추가 꺼지거나 누를 수 없으면 누름 자리도 따른다.
// - 단추의 자리, 크기, 피봇을 프레임마다 따라가므로 화면이 단추를 다시 놓아도 맞는다.
// - 자르는 노드를 정하면 넓힌 몫이 그 노드의 화면 사각형 밖으로 나가지 않게 자른다. (단추 자신의 자리는 그대로, 창 밖이나 스크롤 칸 밖이 눌리지 않게)
//   자르기는 부모가 돌지 않을 때 맞는다.
// - 사용: UIHitArea.attach(buttonNode, minimumSize) (단추가 부모에 붙은 뒤에 부른다)
//==============================================================================
/**
 * @example <caption>작은 닫기 단추의 누르는 자리 넓히기</caption>
 * import { Engine, EngineConfiguration, UIScene, UIButton, UIHitArea, Paint, WorldNode, Pivot, Vector2, Color } from "./build/vanilla.js";
 *
 * class MainScene extends UIScene {
 * 	constructor() {
 * 		super();
 * 		this.setLoadingMinDurationMs(0);
 * 	}
 *
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		const buttonNode = new WorldNode();
 * 		buttonNode.setName("CloseButton");
 * 		buttonNode.setPivot(Pivot.topLeft);
 * 		buttonNode.setAnchor(Pivot.topLeft);
 * 		buttonNode.setLocalPosition(Vector2.create(300, 20));
 * 		buttonNode.setContentSize(Vector2.create(24, 24));
 * 		const paint = buttonNode.addComponent(Paint);
 * 		paint.setColor(new Color(0.85, 0.3, 0.3, 1));
 * 		const button = buttonNode.addComponent(UIButton);
 * 		button.setClickedEvent(() => {
 * 			console.log("close");
 * 		});
 * 		const root = this.getRoot();
 * 		root.addChild(buttonNode);
 *
 * 		const hitNode = UIHitArea.attach(buttonNode, 48);
 * 		const hitArea = hitNode.getComponent(UIHitArea);
 * 		hitArea.setClipNode(root);
 * 		console.log(hitNode.getName(), hitArea.getMinimumSize());
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.canvasId = "mainCanvas";
 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
 * engineConfiguration.autoResizeOnWindowResize = true;
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class UIHitArea extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WorldNode | null } */ #targetNode; // 넓혀 줄 단추의 노드.
	/** @private @type { UIButton | null } */ #targetButton; // 그 단추.
	/** @private @type { number } */ #minimumSize; // 누르는 자리의 가장 작은 가로세로.
	/** @private @type { WorldNode | null } */ #clipNode; // 넓힌 몫을 자르는 노드. (없으면 자르지 않는다)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.setComponentType("UIHitArea");
		this.#targetNode = null;
		this.#targetButton = null;
		this.#minimumSize = 0;
		this.#clipNode = null;
	}

	//==============================================================================
	// 단추 따라가기. (가운데를 맞추고 모자란 쪽만 넓힌다, 단추가 꺼져 있으면 함께 끈다)
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	tick(timeDelta) {
		const node = this.getNode();
		const targetNode = this.getTargetNode();
		const targetButton = this.getTargetButton();
		if (!node || targetNode === null || targetButton === null) {
			return;
		}
		const isTargetActive = targetNode.isActive();
		const isTargetInteractable = targetButton.getInteractable();
		const isUsable = isTargetActive && isTargetInteractable;
		node.setInteractable(isUsable);

		// 단추의 왼쪽 위와 크기. (부모 안의 자리)
		const targetPosition = targetNode.getLocalPosition();
		const targetSize = targetNode.getContentSize();
		const targetPivot = targetNode.getPivot();
		const targetLeft = targetPosition.x - targetPivot.x * targetSize.x;
		const targetTop = targetPosition.y - targetPivot.y * targetSize.y;
		const minimumSize = this.getMinimumSize();
		const width = System.Math.max(targetSize.x, minimumSize);
		const height = System.Math.max(targetSize.y, minimumSize);
		let left = targetLeft - (width - targetSize.x) * 0.5;
		let top = targetTop - (height - targetSize.y) * 0.5;
		let right = left + width;
		let bottom = top + height;

		// 넓힌 몫을 자르는 노드의 화면 사각형을 부모 안의 좌표로 바꿔 그 안으로 자른다.
		const clipNode = this.getClipNode();
		const parentNode = node.getParent();
		if (clipNode !== null && parentNode instanceof WorldNode) {
			const clipCorners = clipNode.getWorldCorners();
			const parentCorners = parentNode.getWorldCorners();
			const parentScale = parentNode.getScale();
			const scaleX = System.Math.max(0.0001, System.Math.abs(parentScale.x));
			const scaleY = System.Math.max(0.0001, System.Math.abs(parentScale.y));
			const clipMinimumX = System.Math.min(clipCorners[0].x, clipCorners[2].x);
			const clipMinimumY = System.Math.min(clipCorners[0].y, clipCorners[2].y);
			const clipMaximumX = System.Math.max(clipCorners[0].x, clipCorners[2].x);
			const clipMaximumY = System.Math.max(clipCorners[0].y, clipCorners[2].y);
			const parentLeft = System.Math.min(parentCorners[0].x, parentCorners[2].x);
			const parentTop = System.Math.min(parentCorners[0].y, parentCorners[2].y);

			// 자식의 로컬 원점은 부모 내용 영역의 왼쪽 위다. (WorldNode.pushTransform 이 피봇만큼 당긴 뒤)
			const clipLeft = (clipMinimumX - parentLeft) / scaleX;
			const clipTop = (clipMinimumY - parentTop) / scaleY;
			const clipRight = (clipMaximumX - parentLeft) / scaleX;
			const clipBottom = (clipMaximumY - parentTop) / scaleY;
			left = System.Math.max(left, System.Math.min(clipLeft, targetLeft));
			top = System.Math.max(top, System.Math.min(clipTop, targetTop));
			right = System.Math.min(right, System.Math.max(clipRight, targetLeft + targetSize.x));
			bottom = System.Math.min(bottom, System.Math.max(clipBottom, targetTop + targetSize.y));
		}

		// 누름 자리는 왼쪽 위 피봇이다.
		const hitPosition = Vector2.create(left, top);
		const hitSize = Vector2.create(System.Math.max(0, right - left), System.Math.max(0, bottom - top));
		node.setLocalPosition(hitPosition);
		node.setContentSize(hitSize);
	}

	//==============================================================================
	// 넓혀 줄 단추 설정.
	//==============================================================================
	/**
	 * @param { WorldNode } targetNode 넓혀 줄 단추의 노드.
	 * @param { UIButton } targetButton 그 노드에 붙은 단추.
	 */
	setTarget(targetNode, targetButton) {
		this.#targetNode = targetNode;
		this.#targetButton = targetButton;
	}

	//==============================================================================
	// 넓혀 줄 단추의 노드 반환.
	//==============================================================================
	/**
	 * @returns { WorldNode | null } 넓혀 줄 단추의 노드. (정하지 않았으면 null)
	 */
	getTargetNode() {
		return this.#targetNode;
	}

	//==============================================================================
	// 넓혀 줄 단추 반환.
	//==============================================================================
	/**
	 * @returns { UIButton | null } 넓혀 줄 단추. (정하지 않았으면 null)
	 */
	getTargetButton() {
		return this.#targetButton;
	}

	//==============================================================================
	// 누르는 자리의 가장 작은 가로세로 설정.
	//==============================================================================
	/**
	 * @param { number } minimumSize 누르는 자리의 가장 작은 가로세로. (부모 안의 단위, 단추가 이보다 큰 축은 넓히지 않는다)
	 */
	setMinimumSize(minimumSize) {
		this.#minimumSize = minimumSize;
	}

	//==============================================================================
	// 누르는 자리의 가장 작은 가로세로 반환.
	//==============================================================================
	/**
	 * @returns { number } 누르는 자리의 가장 작은 가로세로. (기본 0)
	 */
	getMinimumSize() {
		return this.#minimumSize;
	}

	//==============================================================================
	// 넓힌 몫을 자르는 노드 설정. (null 이면 자르지 않는다)
	//==============================================================================
	/**
	 * @param { WorldNode | null } clipNode 넓힌 몫을 자르는 노드. (null 이면 자르지 않는다)
	 */
	setClipNode(clipNode) {
		this.#clipNode = clipNode;
	}

	//==============================================================================
	// 넓힌 몫을 자르는 노드 반환.
	//==============================================================================
	/**
	 * @returns { WorldNode | null } 넓힌 몫을 자르는 노드. (없으면 null)
	 */
	getClipNode() {
		return this.#clipNode;
	}

	//==============================================================================
	// 단추에 넓힌 누름 자리 달기. (단추가 부모에 붙은 뒤에 부른다, 단추의 바로 뒤 형제로 끼우고 누름 자리 노드를 돌려준다)
	//==============================================================================
	/**
	 * @static
	 * @param { WorldNode } buttonNode - UIButton 이 붙은 노드.
	 * @param { number } minimumSize 누르는 자리의 가장 작은 가로세로. (부모 안의 단위)
	 * @returns { WorldNode | null } 만든 누름 자리 노드. (단추 노드에 부모가 없거나 UIButton 이 없으면 null)
	 */
	static attach(buttonNode, minimumSize) {
		const parentNode = buttonNode.getParent();
		if (!parentNode) {
			return null;
		}
		const targetButton = buttonNode.getComponent(UIButton);
		if (!targetButton) {
			return null;
		}
		const buttonName = buttonNode.getName();
		const hitNode = new WorldNode();
		hitNode.setName(`${buttonName}HitArea`);
		const hitPivot = Vector2.create(0, 0);
		hitNode.setPivot(hitPivot);
		const hitButton = hitNode.addComponent(UIButton);

		// 단추의 클릭 알림을 단추가 받은 것처럼 부른다.
		hitButton.setClickedEvent(() => {
			targetButton.fireClickEvents();
		});
		const hitArea = hitNode.addComponent(UIHitArea);
		hitArea.setTarget(buttonNode, targetButton);
		hitArea.setMinimumSize(minimumSize);
		parentNode.addChild(hitNode);
		const targetIndex = parentNode.getChildIndex(buttonNode);
		hitNode.setSiblingIndex(targetIndex);
		return hitNode;
	}
}
