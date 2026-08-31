//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { WorldNode } from "../core/node/worldnode.js";
import { Vector2 } from "../base/vector2.js";
import { Color } from "../base/color.js";
import { Pivot } from "../base/pivot.js";
import { UILabel } from "../ui/uilabel.js";
import * as Math from "../base/math.js";


//==============================================================================
// 떠오르는 텍스트 관리 노드. (데미지 숫자 / +코인 등)
// - spawn() 으로 띄우면 위로 떠오르며 사라진다. 끝난 라벨 노드는 재사용한다.
// - 씬 뿌리에 addChild 해 두고 월드 좌표로 띄운다.
// - 사용:
//     const floatingText = new FloatingText();
//     scene.getRoot().addChild(floatingText);
//     floatingText.spawn("-120", position, { color: new Color(1, 0.4, 0.4, 1) });
//==============================================================================
export class FloatingText extends WorldNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object[] } */ #activeList;
	/** @private @type { WorldNode[] } */ #freeList;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setName("FloatingText");
		this.setPivot(Pivot.topLeft.clone());
		this.setAnchor(Pivot.topLeft.clone());
		this.#activeList = [];
		this.#freeList = [];
	}

	//==============================================================================
	// 텍스트 띄우기.
	//==============================================================================
	/**
	 * @param { string } text
	 * @param { Vector2 } worldPosition
	 * @param { object } options { color?, fontSize = 22, rise = 46, duration = 0.8, jitter = 10, bold = true }
	 */
	spawn(text, worldPosition, options = {}) {
		const fontSize = (options.fontSize !== undefined) ? options.fontSize : 22;
		const rise = (options.rise !== undefined) ? options.rise : 46;
		const duration = (options.duration !== undefined) ? options.duration : 0.8;
		const jitter = (options.jitter !== undefined) ? options.jitter : 10;
		const textColor = options.color ? options.color : new Color(1, 1, 1, 1);

		let labelNode = this.#freeList.pop();
		if (!labelNode) {
			labelNode = new WorldNode();
			labelNode.setName("FloatingTextItem");
			labelNode.setPivot(Pivot.middleCenter.clone());
			labelNode.setAnchor(Pivot.topLeft.clone());
			labelNode.setContentSize(Vector2.create(240, 40));
			labelNode.addComponent(UILabel);
			this.addChild(labelNode);
		}
		labelNode.setActive(true);
		labelNode.setLocalOpacity(1);

		const labelComponents = labelNode.getComponents(UILabel);
		const labelComponent = labelComponents[0];
		labelComponent.setText(text);
		labelComponent.setFontSize(fontSize);
		labelComponent.setTextColor(textColor);
		labelComponent.setBold((options.bold !== undefined) ? options.bold : true);

		const jitterX = Math.randomRange(-jitter, jitter);
		const startPosition = Vector2.create(worldPosition.x + jitterX, worldPosition.y);
		labelNode.setLocalPosition(startPosition);

		this.#activeList.push({
			node: labelNode,
			startPosition: startPosition,
			rise: rise,
			duration: duration,
			elapsedSeconds: 0,
		});
	}

	//==============================================================================
	// 갱신. (떠오름 + 사라짐 + 회수)
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		for (let index = this.#activeList.length - 1; index >= 0; --index) {
			const item = this.#activeList[index];
			item.elapsedSeconds += timeDelta;
			const linearRatio = System.Math.min(1, item.elapsedSeconds / item.duration);
			const easedRatio = 1 - (1 - linearRatio) * (1 - linearRatio);
			item.node.setLocalPosition(Vector2.create(item.startPosition.x, item.startPosition.y - item.rise * easedRatio));
			item.node.setLocalOpacity(1 - linearRatio * linearRatio);
			if (linearRatio >= 1) {
				item.node.setActive(false);
				this.#freeList.push(item.node);
				this.#activeList.splice(index, 1);
			}
		}
	}

	//==============================================================================
	// 떠 있는 항목 수 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getActiveCount() {
		return this.#activeList.length;
	}

	//==============================================================================
	// 모두 지우기.
	//==============================================================================
	clear() {
		for (const item of this.#activeList) {
			item.node.setActive(false);
			this.#freeList.push(item.node);
		}
		this.#activeList.length = 0;
	}
}
