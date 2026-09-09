//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Color } from "../base/color.js";
import { Rect } from "../base/rect.js";
import * as Math from "../base/math.js";
import { Graphic } from "../core/graphic.js";
import { UIView } from "./uiview.js";


//==============================================================================
// 진행률 방향.
//==============================================================================
export const ProgressDirection = {
	horizontal: "horizontal", // 좌→우 채움
	vertical: "vertical",     // 하→상 채움
};


//==============================================================================
// 진행률 표시.
// - 노드의 contentSize 영역을 트랙으로 사용.
// - value 비율만큼 fill 영역을 그린다.
// - 입력은 없음. 값은 외부에서 setValue 로만 변경.
// - UIView 를 상속하여 컨테이너 표시 객체로서의 일관성을 유지하고,
//   WorldNode 에 부착될 때 자동 마스크/콘텐츠 노드 처리를 받는다.
//==============================================================================
export class UIProgressView extends UIView {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #value;
	/** @private @type { number } */ #minValue;
	/** @private @type { number } */ #maxValue;
	/** @private @type { Color } */  #fillColor;
	/** @private @type { number | null } */ #secondaryValue; // 반대편에서 차오르는 값. (null 이면 안 씀)
	/** @private @type { Color } */ #secondaryFillColor;
	/** @private @type { number } */ #cornerRadius;
	/** @private @type { string } */ #direction;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("UIProgressView");
		this.#value = 0;
		this.#minValue = 0;
		this.#maxValue = 1;
		this.#fillColor = new Color(0.23, 0.51, 0.96, 1); // blue-500 근사
		this.#secondaryValue = null;
		this.#secondaryFillColor = new Color(0.94, 0.33, 0.31, 1);
		this.#cornerRadius = 0;
		this.#direction = ProgressDirection.horizontal;
		// 트랙 색은 UIView 의 backgroundColor 로 일원화.
		super.setBackgroundColor(new Color(0.7, 0.7, 0.7, 1));
	}

	//==============================================================================
	// 출력. (트랙 + 채움. 트랙은 UIView.backgroundColor 사용)
	// - cornerRadius 처리를 위해 super.draw 를 호출하지 않고 직접 그린다.
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		const node = this.getNode();
		if (!node) {
			return;
		}
		const contentSize = node.getContentSize();
		if (contentSize.x <= 0 || contentSize.y <= 0) {
			return;
		}

		// 트랙. (UIView.backgroundColor 활용)
		const trackRect = Rect.create(0, 0, contentSize.x, contentSize.y);
		graphic.setFillColor(this.getBackgroundColor());
		if (this.#cornerRadius > 0) {
			graphic.drawRoundRect(trackRect, this.#cornerRadius);
		}
		else {
			graphic.drawRect(trackRect);
		}

		// 채움.
		const ratio = this.getRatio();
		if (ratio <= 0) {
			return;
		}
		let fillRect;
		if (this.#direction === ProgressDirection.vertical) {
			const fillHeight = contentSize.y * ratio;
			fillRect = Rect.create(0, contentSize.y - fillHeight, contentSize.x, fillHeight);
		}
		else {
			const fillWidth = contentSize.x * ratio;
			fillRect = Rect.create(0, 0, fillWidth, contentSize.y);
		}
		graphic.setFillColor(this.#fillColor);
		if (this.#cornerRadius > 0) {
			graphic.drawRoundRect(fillRect, this.#cornerRadius);
		}
		else {
			graphic.drawRect(fillRect);
		}

		// 반대편 게이지. (점유율 / 대전 게이지처럼 한 바에 양쪽을 함께 보일 때)
		if (this.#secondaryValue !== null) {
			const range = this.#maxValue - this.#minValue;
			if (range > 0) {
				const secondaryRatio = Math.clamp((this.#secondaryValue - this.#minValue) / range, 0, 1);
				if (secondaryRatio > 0) {
					let secondaryRect;
					if (this.#direction === ProgressDirection.vertical) {
						const secondaryHeight = contentSize.y * secondaryRatio;
						secondaryRect = Rect.create(0, 0, contentSize.x, secondaryHeight);
					}
					else {
						const secondaryWidth = contentSize.x * secondaryRatio;
						secondaryRect = Rect.create(contentSize.x - secondaryWidth, 0, secondaryWidth, contentSize.y);
					}
					graphic.setFillColor(this.#secondaryFillColor);
					if (this.#cornerRadius > 0) {
						graphic.drawRoundRect(secondaryRect, this.#cornerRadius);
					}
					else {
						graphic.drawRect(secondaryRect);
					}
				}
			}
		}
	}

	//==============================================================================
	// 0~1 비율 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getRatio() {
		const range = this.#maxValue - this.#minValue;
		if (range <= 0) {
			return 0;
		}
		const r = (this.#value - this.#minValue) / range;
		return Math.clamp(r, 0, 1);
	}

	//==============================================================================
	// 값 설정.
	//==============================================================================
	/**
	 * @param { number } value
	 */
	setValue(value) {
		this.#value = Math.clamp(value, this.#minValue, this.#maxValue);
	}

	//==============================================================================
	// 값 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getValue() {
		return this.#value;
	}

	//==============================================================================
	// 최소~최대 값 범위 설정.
	//==============================================================================
	/**
	 * @param { number } minValue
	 * @param { number } maxValue
	 */
	setRange(minValue, maxValue) {
		this.#minValue = minValue;
		this.#maxValue = maxValue;
		this.setValue(this.#value);
	}

	getMinValue() { return this.#minValue; }
	getMaxValue() { return this.#maxValue; }

	//==============================================================================
	// 트랙 색. (UIView.backgroundColor 의 alias)
	//==============================================================================
	/**
	 * @param { Color } color
	 */
	//==============================================================================
	// 반대편 값 설정. (null 이면 끔 — 진행 방향의 반대쪽 끝에서 차오른다)
	//==============================================================================
	/**
	 * @param { number | null } secondaryValue
	 */
	setSecondaryValue(secondaryValue) {
		this.#secondaryValue = (secondaryValue === null) ? null : Math.clamp(secondaryValue, this.#minValue, this.#maxValue);
	}

	//==============================================================================
	// 반대편 값 반환.
	//==============================================================================
	/**
	 * @returns { number | null }
	 */
	getSecondaryValue() {
		return this.#secondaryValue;
	}

	//==============================================================================
	// 반대편 채움 색 설정.
	//==============================================================================
	/**
	 * @param { Color } color
	 */
	setSecondaryFillColor(color) {
		this.#secondaryFillColor = color;
	}

	//==============================================================================
	// 반대편 채움 색 반환.
	//==============================================================================
	/**
	 * @returns { Color }
	 */
	getSecondaryFillColor() {
		return this.#secondaryFillColor;
	}

	setTrackColor(color) {
		this.setBackgroundColor(color);
	}
	getTrackColor() { return this.getBackgroundColor(); }

	//==============================================================================
	// 채움 색.
	//==============================================================================
	/**
	 * @param { Color } color
	 */
	setFillColor(color) {
		this.#fillColor = color;
	}
	getFillColor() { return this.#fillColor; }

	//==============================================================================
	// 라운드 코너 반지름.
	//==============================================================================
	/**
	 * @param { number } radius
	 */
	setCornerRadius(radius) {
		this.#cornerRadius = radius;
	}
	getCornerRadius() { return this.#cornerRadius; }

	//==============================================================================
	// 방향. (ProgressDirection.horizontal / vertical)
	//==============================================================================
	/**
	 * @param { string } direction
	 */
	setDirection(direction) {
		this.#direction = direction;
	}
	getDirection() { return this.#direction; }
}
