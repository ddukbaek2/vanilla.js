//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Color } from "../../base/color.js";
import { Rect } from "../../base/rect.js";
import { Vector2 } from "../../base/vector2.js";
import { Graphic } from "../graphic.js";
import { Component } from "../component.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 그릴 때마다 고쳐 쓰는 사각 영역과 크기, 가운데. (graphic 의 그리기 함수는 받은 값을 그 자리에서 읽기만 하고 들고 있지 않는다)
const outlineRect = new Rect();
const outlineContentSize = new Vector2();
const outlineCenter = new Vector2();


//==============================================================================
// 테만 그리는 컴포넌트. (둥근 네모 테 또는 동그라미 테)
// - Paint 는 속을 채우기만 하므로, 비치는 판 위에 테를 따로 얹을 때 쓴다. (채운 판 두 장을 겹치면 비치는 속에 바깥 색이 섞인다)
// - 둥근 네모 테는 노드의 내용 크기 그대로, 동그라미 테는 그 가운데에 짧은 변의 반을 반지름으로 그린다.
// - 선은 내용 크기 안쪽에 들어온다. (선의 가운데가 굵기의 반만큼 안쪽)
//==============================================================================
export class Outline extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Color } */ #color; // 테의 색.
	/** @private @type { number } */ #lineWidth; // 테의 굵기. (0 이면 그리지 않는다)
	/** @private @type { number } */ #roundSize; // 둥근 네모의 귀퉁이. (바깥 꼴 기준, 동그라미면 쓰지 않는다)
	/** @private @type { boolean } */ #isCircle; // 동그라미 테인지.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.setComponentType("Outline");
		this.#color = Color.white();
		this.#lineWidth = 1;
		this.#roundSize = 0;
		this.#isCircle = false;
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		const lineWidth = this.getLineWidth();
		if (lineWidth <= 0) {
			return;
		}
		const node = this.getNode();
		const contentSize = outlineContentSize;
		if (typeof node.copyContentSizeTo === "function") {
			node.copyContentSizeTo(contentSize);
		}
		else {
			const nodeContentSize = node.getContentSize();
			contentSize.set(nodeContentSize.x, nodeContentSize.y);
		}
		const halfLineWidth = lineWidth * 0.5;
		const color = this.getColor();
		graphic.setStrokeColor(color);
		if (this.isCircle()) {
			const radius = System.Math.min(contentSize.x, contentSize.y) * 0.5 - halfLineWidth;
			if (radius <= 0) {
				return;
			}
			outlineCenter.set(contentSize.x * 0.5, contentSize.y * 0.5);
			graphic.drawStrokeCircle(outlineCenter, radius, lineWidth);
			return;
		}
		const width = contentSize.x - lineWidth;
		const height = contentSize.y - lineWidth;
		if (width <= 0 || height <= 0) {
			return;
		}
		const rect = outlineRect;
		rect.position.set(halfLineWidth, halfLineWidth);
		rect.size.set(width, height);
		const roundSize = System.Math.max(0, this.getRoundSize() - halfLineWidth);
		graphic.drawStrokeRoundRect(rect, roundSize, lineWidth);
	}

	//==============================================================================
	// 색상 설정.
	//==============================================================================
	/**
	 * @param { Color | string } other
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
	// 굵기 설정.
	//==============================================================================
	/**
	 * @param { number } lineWidth
	 */
	setLineWidth(lineWidth) {
		this.#lineWidth = lineWidth;
	}

	//==============================================================================
	// 굵기 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getLineWidth() {
		return this.#lineWidth;
	}

	//==============================================================================
	// 귀퉁이 둥근 정도 설정. (바깥 꼴 기준)
	//==============================================================================
	/**
	 * @param { number } roundSize
	 */
	setRoundSize(roundSize) {
		this.#roundSize = roundSize;
	}

	//==============================================================================
	// 귀퉁이 둥근 정도 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getRoundSize() {
		return this.#roundSize;
	}

	//==============================================================================
	// 동그라미 테로 그릴지 설정.
	//==============================================================================
	/**
	 * @param { boolean } isCircle
	 */
	setCircle(isCircle) {
		this.#isCircle = isCircle;
	}

	//==============================================================================
	// 동그라미 테인지 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isCircle() {
		return this.#isCircle;
	}
}
