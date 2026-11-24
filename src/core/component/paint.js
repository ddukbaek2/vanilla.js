//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Color } from "../../base/color.js";
import { Rect } from "../../base/rect.js";
import { Graphic } from "../graphic.js";
import { Component } from "../component.js";
import { TransformNode } from "../node/transformnode.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 그릴 때마다 고쳐 쓰는 사각 영역. (graphic 의 그리기 함수는 받은 사각 영역을 그 자리에서 읽기만 하고 들고 있지 않는다)
const paintRect = new Rect();


//==============================================================================
// 내용의 색상과 투명도를 결정하는 컴포넌트.
//==============================================================================
export class Paint extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Color } */ #color; // 컬러.
	/** @private @type { number } */ #roundSize; // 라운드 사이즈.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @construct
	 */
	constructor() {
		super();
		this.setComponentType("Paint");
		this.#color = Color.white();
		this.#roundSize = 0;
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		// super.draw(graphic);
		const node = this.getNode();

		// Component.draw()를 호출하는 쪽은 TransformNode이므로 신뢰하고 사용.
		// if (node instanceof TransformNode)
		const color = this.getColor();
		const rect = paintRect;
		const rectPosition = rect.position;
		const rectSize = rect.size;
		rectPosition.set(0, 0);
		if (typeof node.copyContentSizeTo === "function") {
			// 내용 크기를 복제본 없이 받는다.
			node.copyContentSizeTo(rectSize);
		}
		else {
			const contentSize = node.getContentSize();
			rectSize.set(contentSize.x, contentSize.y);
		}

		// 출력.
		graphic.setFillColor(color);
		if (this.#roundSize > 0) {
			graphic.drawRoundRect(rect, this.#roundSize);
		}
		else {
			graphic.drawRect(rect);
		}
	}

	//==============================================================================
	// 내용 영역 안에서만 그리는지 반환. (내용 크기의 사각형만 칠한다)
	// - draw 를 덮어쓴 하위 클래스는 어디에 그리는지 모르므로 false. (그 클래스가 이 함수도 덮어써 알린다)
	//==============================================================================
	/**
	 * @override
	 * @returns { boolean }
	 */
	isDrawnInsideContent() {
		return this.draw === Paint.prototype.draw;
	}

	//==============================================================================
	// 색상 설정.
	//==============================================================================
	/**
	 * @param { Color | string | CanvasGradient | CanvasPattern } other
	 */
	setColor(other) {
		if (other === null || other === undefined) {
			this.#color = Color.transparent();
		}
		else if (typeof other === "string") {
			if (other.startsWith("#")) {
				this.#color = Color.createFromHEX(other);
			}
			else if (other.startsWith("rgb")) {
				this.#color = Color.createFromRGBA(other);
			}
		}
		else if (other instanceof Color) {
			this.#color = other;
		}
	}

	//==============================================================================
	// 색상 반환.
	//==============================================================================
	/**
	 * @returns { Color }
	 */
	getColor() {
		return this.#color;
	}

	//==============================================================================
	// 라운드 크기 설정.
	//==============================================================================
	/**
	 * @param { number } roundSize
	 */
	setRoundSize(roundSize) {
		this.#roundSize = roundSize;
	}

	//==============================================================================
	// 라운드 사이즈 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getRoundSize() {
		return this.#roundSize;
	}
}
