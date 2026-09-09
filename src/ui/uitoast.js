//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { WorldNode } from "../core/node/worldnode.js";
import { Vector2 } from "../base/vector2.js";
import { Color } from "../base/color.js";
import { Pivot } from "../base/pivot.js";
import { Paint } from "../core/component/paint.js";
import { UILabel } from "./uilabel.js";


//==============================================================================
// 토스트.
// - show(message) 로 알약 모양 알림이 아래에서 떠올라 잠시 머문 뒤 사라진다.
// - 여러 번 부르면 줄을 세워 하나씩 보여 준다. (여러 게임이 화면마다 복붙하던 패턴)
// - 씬 뿌리의 맨 위(마지막 자식)에 addChild 해 두고 쓴다.
// - 사용:
//     const toast = new UIToast();
//     scene.getRoot().addChild(toast);
//     toast.show("저장되었습니다.");
//==============================================================================
export class UIToast extends WorldNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string[] } */ #messageQueue;
	/** @private @type { string } */ #phase; // "hidden" | "enter" | "hold" | "exit"
	/** @private @type { number } */ #phaseSeconds;
	/** @private @type { number } */ #holdSeconds;
	/** @private @type { number } */ #restY;
	/** @private @type { number | null } */ #restX; // null 이면 부모 가로 중앙.
	/** @private @type { number } */ #riseDistance;
	/** @private @type { UILabel } */ #label;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { object } options { width = 400, height = 48, restY = 560, holdSeconds = 1.8, backgroundColor?, textColor? }
	 */
	constructor(options = {}) {
		super();

		const width = (options.width !== undefined) ? options.width : 400;
		const height = (options.height !== undefined) ? options.height : 48;
		this.#restY = (options.restY !== undefined) ? options.restY : 560;
		this.#restX = (options.restX !== undefined) ? options.restX : null;
		this.#holdSeconds = (options.holdSeconds !== undefined) ? options.holdSeconds : 1.8;
		this.#riseDistance = 28;
		this.#messageQueue = [];
		this.#phase = "hidden";
		this.#phaseSeconds = 0;

		this.setName("UIToast");
		this.setPivot(Pivot.middleCenter.clone());
		this.setAnchor(Pivot.topLeft.clone());
		this.setContentSize(Vector2.create(width, height));
		this.setActive(false);

		const paint = this.addComponent(Paint);
		paint.setColor(options.backgroundColor ? options.backgroundColor : new Color(0.09, 0.1, 0.13, 0.92));
		paint.setRoundSize(height * 0.5);

		this.#label = this.addComponent(UILabel);
		this.#label.setText("");
		this.#label.setFontSize((options.fontSize !== undefined) ? options.fontSize : 15);
		this.#label.setTextColor(options.textColor ? options.textColor : new Color(0.96, 0.97, 1, 1));
	}

	//==============================================================================
	// 토스트 표시. (표시 중이면 줄을 선다)
	//==============================================================================
	/**
	 * @param { string } messageText
	 */
	show(messageText) {
		this.#messageQueue.push(messageText);
		if (this.#phase === "hidden") {
			this.presentNext();
		}
	}

	//==============================================================================
	// 다음 메시지 표시.
	//==============================================================================
	/**
	 * @private
	 */
	presentNext() {
		if (this.#messageQueue.length === 0) {
			this.#phase = "hidden";
			this.setActive(false);
			return;
		}
		const messageText = this.#messageQueue.shift();
		this.#label.setText(messageText);
		this.#phase = "enter";
		this.#phaseSeconds = 0;
		this.setActive(true);
		this.setLocalOpacity(0);
		this.updatePosition(0);
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		if (this.#phase === "hidden") {
			return;
		}
		this.#phaseSeconds += timeDelta;
		if (this.#phase === "enter") {
			const ratio = System.Math.min(1, this.#phaseSeconds / 0.24);
			const eased = 1 - (1 - ratio) * (1 - ratio);
			this.setLocalOpacity(eased);
			this.updatePosition(eased);
			if (ratio >= 1) {
				this.#phase = "hold";
				this.#phaseSeconds = 0;
			}
		}
		else if (this.#phase === "hold") {
			if (this.#phaseSeconds >= this.#holdSeconds) {
				this.#phase = "exit";
				this.#phaseSeconds = 0;
			}
		}
		else if (this.#phase === "exit") {
			const ratio = System.Math.min(1, this.#phaseSeconds / 0.2);
			this.setLocalOpacity(1 - ratio);
			this.updatePosition(1 + ratio * 0.4);
			if (ratio >= 1) {
				this.presentNext();
			}
		}
	}

	//==============================================================================
	// 진행 비율에 따른 자리 갱신. (0 = 아래에서 출발, 1 = 제자리)
	//==============================================================================
	/**
	 * @private
	 * @param { number } progressRatio
	 */
	updatePosition(progressRatio) {
		let centerX = this.#restX;
		if (centerX === null) {
			centerX = 480;
			const parentNode = this.getParent();
			if (parentNode) {
				const parentSize = parentNode.getContentSize();
				if (parentSize.x > 0) {
					centerX = parentSize.x * 0.5;
				}
			}
		}
		this.setLocalPosition(Vector2.create(centerX, this.#restY + this.#riseDistance * (1 - progressRatio)));
	}

	//==============================================================================
	// 표시 자리(가운데 세로 좌표) 설정.
	//==============================================================================
	/**
	 * @param { number } restY
	 */
	setRestY(restY) {
		this.#restY = restY;
	}

	//==============================================================================
	// 표시 자리(가운데 가로 좌표) 설정. (null 이면 부모 가로 중앙)
	//==============================================================================
	/**
	 * @param { number | null } restX
	 */
	setRestX(restX) {
		this.#restX = restX;
	}

	//==============================================================================
	// 머무는 시간 설정.
	//==============================================================================
	/**
	 * @param { number } holdSeconds
	 */
	setHoldSeconds(holdSeconds) {
		this.#holdSeconds = holdSeconds;
	}

	//==============================================================================
	// 표시 중 여부.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isShowing() {
		return this.#phase !== "hidden";
	}
}
