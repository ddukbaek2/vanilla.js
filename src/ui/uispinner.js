//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { WorldNode } from "../core/node/worldnode.js";
import { Vector2 } from "../base/vector2.js";
import { Color } from "../base/color.js";
import { Pivot } from "../base/pivot.js";
import { Paint } from "../core/component/paint.js";


//==============================================================================
// 회전 로딩 인디케이터.
// - 원 둘레에 점 여러 개를 놓고 밝기가 꼬리처럼 돌아가는 표준 스피너.
// - 사용:
//     const spinner = new UISpinner({ radius: 9, dotCount: 10 });
//     someNode.addChild(spinner);
//     spinner.setLocalPosition(Vector2.create(x, y));
//==============================================================================
export class UISpinner extends WorldNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WorldNode[] } */ #dotNodeList;
	/** @private @type { number } */ #dotCount;
	/** @private @type { number } */ #rotationSpeed; // 초당 바퀴 수.
	/** @private @type { number } */ #phase;
	/** @private @type { Color } */ #dotColor;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { object } options { radius = 9, dotCount = 10, dotRadius = 2, color?, rotationSpeed = 1 }
	 */
	constructor(options = {}) {
		super();

		const radius = (options.radius !== undefined) ? options.radius : 9;
		this.#dotCount = (options.dotCount !== undefined) ? options.dotCount : 10;
		const dotRadius = (options.dotRadius !== undefined) ? options.dotRadius : 2;
		this.#dotColor = options.color ? options.color : new Color(1, 1, 1, 1);
		this.#rotationSpeed = (options.rotationSpeed !== undefined) ? options.rotationSpeed : 1;
		this.#phase = 0;
		this.#dotNodeList = [];

		this.setName("UISpinner");
		this.setPivot(Pivot.middleCenter.clone());
		this.setAnchor(Pivot.topLeft.clone());
		this.setContentSize(Vector2.create((radius + dotRadius) * 2, (radius + dotRadius) * 2));

		const center = radius + dotRadius;
		for (let dotIndex = 0; dotIndex < this.#dotCount; ++dotIndex) {
			const angle = (dotIndex / this.#dotCount) * System.Math.PI * 2;
			const dotNode = new WorldNode();
			dotNode.setName("SpinnerDot" + dotIndex);
			dotNode.setPivot(Pivot.middleCenter.clone());
			dotNode.setAnchor(Pivot.topLeft.clone());
			dotNode.setContentSize(Vector2.create(dotRadius * 2, dotRadius * 2));
			dotNode.setLocalPosition(Vector2.create(
				center + System.Math.cos(angle) * radius,
				center + System.Math.sin(angle) * radius));
			const paint = dotNode.addComponent(Paint);
			paint.setColor(this.#dotColor.clone());
			paint.setRoundSize(dotRadius);
			this.addChild(dotNode);
			this.#dotNodeList.push(dotNode);
		}
	}

	//==============================================================================
	// 갱신. (밝기 꼬리 회전)
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		this.#phase += timeDelta * this.#rotationSpeed;
		for (let dotIndex = 0; dotIndex < this.#dotNodeList.length; ++dotIndex) {
			const orderRatio = dotIndex / this.#dotCount;
			let tailRatio = (orderRatio - this.#phase) % 1;
			if (tailRatio < 0) {
				tailRatio += 1;
			}
			const dotOpacity = 0.15 + 0.85 * (1 - tailRatio);
			this.#dotNodeList[dotIndex].setLocalOpacity(dotOpacity);
		}
	}

	//==============================================================================
	// 점 색 설정.
	//==============================================================================
	/**
	 * @param { Color } dotColor
	 */
	setDotColor(dotColor) {
		this.#dotColor = dotColor.clone();
		for (const dotNode of this.#dotNodeList) {
			const paintComponents = dotNode.getComponents(Paint);
			if (paintComponents.length > 0) {
				paintComponents[0].setColor(this.#dotColor.clone());
			}
		}
	}

	//==============================================================================
	// 회전 속도 설정. (초당 바퀴 수)
	//==============================================================================
	/**
	 * @param { number } rotationSpeed
	 */
	setRotationSpeed(rotationSpeed) {
		this.#rotationSpeed = rotationSpeed;
	}
}
