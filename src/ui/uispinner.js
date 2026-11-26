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
/**
 * @example <caption>화면 가운데에 스피너 돌리기</caption>
 * import { Engine, EngineConfiguration, UIScene, UISpinner, Color, Vector2 } from "./build/vanilla.js";
 *
 * class SpinnerScene extends UIScene {
 * 	create() {
 * 		super.create();
 * 		const spinner = new UISpinner({ radius: 16, dotCount: 12, dotRadius: 3, color: new Color(0.4, 0.7, 1, 1), rotationSpeed: 0.8 });
 * 		spinner.setLocalPosition(Vector2.create(320, 180));
 * 		spinner.setDotColor(new Color(1, 0.8, 0.3, 1));
 * 		const root = this.getRoot();
 * 		root.addChild(spinner);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const scene = new SpinnerScene();
 * scene.setLoadingMinDurationMs(0);
 * engine.run(scene);
 */
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
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		this.#phase += timeDelta * this.#rotationSpeed;
		for (let dotIndex = 0; dotIndex < this.#dotNodeList.length; ++dotIndex) {
			const dotOpacity = this.calculateDotOpacity(dotIndex);
			this.#dotNodeList[dotIndex].setLocalOpacity(dotOpacity);
		}
	}

	//==============================================================================
	// 점 투명도 계산. (점 순서 비율에서 위상을 뺀 꼬리 비율이 작을수록 밝다)
	// - 점이 없으면(dotCount 0) 순서 비율을 0 으로 본다.
	//==============================================================================
	/**
	 * @param { number } dotIndex 점 순서. (0 부터, 오른쪽에서 시작해 시계 방향)
	 * @returns { number } 불투명도. (0.15 ~ 1, 밝기 꼬리의 머리 점이 1)
	 */
	calculateDotOpacity(dotIndex) {
		let orderRatio = 0;
		if (this.#dotCount > 0) {
			orderRatio = dotIndex / this.#dotCount;
		}
		let tailRatio = (orderRatio - this.#phase) % 1;
		if (tailRatio < 0) {
			tailRatio += 1;
		}
		return 0.15 + 0.85 * (1 - tailRatio);
	}

	//==============================================================================
	// 점 색 반환.
	//==============================================================================
	/**
	 * @returns { Color } 점 색. (복제하지 않은 원본)
	 */
	getDotColor() {
		return this.#dotColor;
	}

	//==============================================================================
	// 회전 속도 반환. (초당 바퀴 수)
	//==============================================================================
	/**
	 * @returns { number } 초당 바퀴 수.
	 */
	getRotationSpeed() {
		return this.#rotationSpeed;
	}

	//==============================================================================
	// 점 노드 목록 반환.
	//==============================================================================
	/**
	 * @returns { WorldNode[] } 점 노드 목록의 복사본. (점 노드는 같은 것)
	 */
	getDotNodes() {
		return this.#dotNodeList.slice();
	}

	//==============================================================================
	// 점 색 설정.
	//==============================================================================
	/**
	 * @param { Color } dotColor 점 색. (복제해 모든 점의 Paint 에 넣는다)
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
	 * @param { number } rotationSpeed 초당 바퀴 수. (음수면 거꾸로 돈다)
	 */
	setRotationSpeed(rotationSpeed) {
		this.#rotationSpeed = rotationSpeed;
	}
}
