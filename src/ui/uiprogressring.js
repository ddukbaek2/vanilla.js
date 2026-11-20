//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Color } from "../base/color.js";
import { Graphic } from "../core/graphic.js";
import { Component } from "../core/component.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 둥근 귀퉁이 하나를 나누는 점의 수. (고리가 매끈해 보일 만큼)
const CORNER_STEPS = 10;


//==============================================================================
// 진행 고리.
// - 노드의 꼴(둥근 네모, 둥근 정도가 크기의 반이면 동그라미)을 따라 도는 가는 선이다.
// - 위 가운데에서 시계 방향으로 채운 몫만큼 채운 색, 나머지는 바탕 색으로 그린다.
// - 붙인 노드의 내용 크기 전체가 고리의 바깥 꼴이고, 선의 가운데가 그 안쪽으로 굵기의 반만큼 들어온다.
// - 둘레의 점은 크기, 둥근 정도, 굵기가 바뀔 때만 다시 셈한다.
//==============================================================================
export class UIProgressRing extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #ratio; // 채운 몫. (0 ~ 1)
	/** @private @type { number } */ #roundSize; // 귀퉁이의 둥근 정도. (바깥 꼴 기준)
	/** @private @type { number } */ #lineWidth; // 선 굵기.
	/** @private @type { Color } */ #fillColor; // 채운 몫의 색.
	/** @private @type { Color } */ #trackColor; // 나머지의 색.
	/** @private @type { Array<Vector2> } */ #perimeterPoints; // 둘레의 점. (닫는 점은 넣지 않는다)
	/** @private @type { string } */ #perimeterKey; // 둘레의 점을 셈한 크기, 둥근 정도, 굵기.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.setComponentType("UIProgressRing");
		this.#ratio = 0;
		this.#roundSize = 0;
		this.#lineWidth = 2;
		this.#fillColor = Color.white();
		this.#trackColor = new Color(0.2, 0.2, 0.25, 1);
		this.#perimeterPoints = [];
		this.#perimeterKey = "";
	}

	//==============================================================================
	// 출력. (바탕 고리 한 바퀴, 그 위에 채운 몫)
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		const node = this.getNode();
		const contentSize = node.getContentSize();
		const lineWidth = this.getLineWidth();
		const inset = lineWidth * 0.5;
		const width = contentSize.x - lineWidth;
		const height = contentSize.y - lineWidth;
		if (width <= 1 || height <= 1) {
			return;
		}
		const roundSize = System.Math.max(0, this.getRoundSize() - inset);
		const perimeterKey = `${width},${height},${roundSize},${inset}`;
		if (perimeterKey !== this.#perimeterKey) {
			this.#perimeterPoints = this.readPerimeterPoints(inset, inset, width, height, roundSize);
			this.#perimeterKey = perimeterKey;
		}
		const points = this.getPerimeterPoints();
		const trackColor = this.getTrackColor();
		const fillColor = this.getFillColor();
		const ratio = this.getRatio();
		graphic.setStrokeColor(trackColor);
		graphic.drawLineLoop(points, lineWidth);
		if (ratio <= 0) {
			return;
		}
		graphic.setStrokeColor(fillColor);
		if (ratio >= 1) {
			graphic.drawLineLoop(points, lineWidth);
			return;
		}
		const partialPoints = this.readPartialPoints(points, ratio);
		graphic.drawLine(partialPoints, lineWidth);
	}

	//==============================================================================
	// 둥근 네모 둘레의 점. (위 가운데에서 시작해 시계 방향, 닫는 점은 넣지 않는다)
	//==============================================================================
	/**
	 * @param { number } left
	 * @param { number } top
	 * @param { number } width
	 * @param { number } height
	 * @param { number } roundSize
	 * @returns { Array<Vector2> }
	 */
	readPerimeterPoints(left, top, width, height, roundSize) {
		const radius = System.Math.min(roundSize, width * 0.5, height * 0.5);
		const right = left + width;
		const bottom = top + height;
		const points = [Vector2.create(left + width * 0.5, top)];

		// 귀퉁이마다 가운데와 시작 각. (화면 좌표는 아래가 + 라 시계 방향이 각이 느는 쪽이다)
		const corners = [
			{ x: right - radius, y: top + radius, start: -System.Math.PI * 0.5 },
			{ x: right - radius, y: bottom - radius, start: 0 },
			{ x: left + radius, y: bottom - radius, start: System.Math.PI * 0.5 },
			{ x: left + radius, y: top + radius, start: System.Math.PI },
		];
		for (const corner of corners) {
			for (let stepIndex = 0; stepIndex <= CORNER_STEPS; ++stepIndex) {
				const angle = corner.start + System.Math.PI * 0.5 * stepIndex / CORNER_STEPS;
				const pointX = corner.x + System.Math.cos(angle) * radius;
				const pointY = corner.y + System.Math.sin(angle) * radius;
				points.push(Vector2.create(pointX, pointY));
			}
		}
		return points;
	}

	//==============================================================================
	// 둘레의 앞 몫만큼의 점. (길이로 셈하고, 끝점은 마지막 변 위에서 잘라 넣는다)
	//==============================================================================
	/**
	 * @param { Array<Vector2> } points - readPerimeterPoints 의 결과. (닫힌 꼴)
	 * @param { number } ratio
	 * @returns { Array<Vector2> }
	 */
	readPartialPoints(points, ratio) {
		const closedPoints = points.concat([points[0]]);
		let totalLength = 0;
		for (let pointIndex = 1; pointIndex < closedPoints.length; ++pointIndex) {
			const from = closedPoints[pointIndex - 1];
			const to = closedPoints[pointIndex];
			totalLength += System.Math.hypot(to.x - from.x, to.y - from.y);
		}
		const targetLength = totalLength * ratio;
		const partialPoints = [closedPoints[0]];
		let walkedLength = 0;
		for (let pointIndex = 1; pointIndex < closedPoints.length; ++pointIndex) {
			const from = closedPoints[pointIndex - 1];
			const to = closedPoints[pointIndex];
			const segmentLength = System.Math.hypot(to.x - from.x, to.y - from.y);
			if (walkedLength + segmentLength >= targetLength) {
				const segmentRatio = segmentLength > 0 ? (targetLength - walkedLength) / segmentLength : 0;
				const pointX = from.x + (to.x - from.x) * segmentRatio;
				const pointY = from.y + (to.y - from.y) * segmentRatio;
				partialPoints.push(Vector2.create(pointX, pointY));
				return partialPoints;
			}
			partialPoints.push(to);
			walkedLength += segmentLength;
		}
		return partialPoints;
	}

	//==============================================================================
	// 채운 몫 설정. (0 ~ 1 로 자른다)
	//==============================================================================
	/**
	 * @param { number } ratio
	 */
	setRatio(ratio) {
		this.#ratio = System.Math.max(0, System.Math.min(1, ratio));
	}

	//==============================================================================
	// 채운 몫 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getRatio() {
		return this.#ratio;
	}

	//==============================================================================
	// 귀퉁이 둥근 정도 설정. (크기의 반 이상이면 동그라미)
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
	// 선 굵기 설정.
	//==============================================================================
	/**
	 * @param { number } lineWidth
	 */
	setLineWidth(lineWidth) {
		this.#lineWidth = lineWidth;
	}

	//==============================================================================
	// 선 굵기 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getLineWidth() {
		return this.#lineWidth;
	}

	//==============================================================================
	// 채운 몫의 색 설정.
	//==============================================================================
	/**
	 * @param { Color | string } color
	 */
	setFillColor(color) {
		this.#fillColor = UIProgressRing.parseColor(color);
	}

	//==============================================================================
	// 채운 몫의 색 반환.
	//==============================================================================
	/**
	 * @returns { Color }
	 */
	getFillColor() {
		return this.#fillColor;
	}

	//==============================================================================
	// 나머지의 색 설정.
	//==============================================================================
	/**
	 * @param { Color | string } color
	 */
	setTrackColor(color) {
		this.#trackColor = UIProgressRing.parseColor(color);
	}

	//==============================================================================
	// 나머지의 색 반환.
	//==============================================================================
	/**
	 * @returns { Color }
	 */
	getTrackColor() {
		return this.#trackColor;
	}

	//==============================================================================
	// 둘레의 점 반환. (마지막으로 그린 크기의 것)
	//==============================================================================
	/**
	 * @returns { Array<Vector2> }
	 */
	getPerimeterPoints() {
		return this.#perimeterPoints;
	}

	//==============================================================================
	// 색 값 읽기. ("#rrggbb", "rgba(...)" 또는 Color)
	//==============================================================================
	/**
	 * @param { Color | string } color
	 * @returns { Color }
	 */
	static parseColor(color) {
		if (color instanceof Color) {
			return color;
		}
		if (typeof color === "string" && color.startsWith("rgb")) {
			return Color.createFromRGBA(color);
		}
		return Color.createFromHEX(color);
	}
}
