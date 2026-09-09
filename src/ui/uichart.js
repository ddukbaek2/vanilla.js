//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";
import { Color } from "../base/color.js";
import { Component } from "../core/component.js";
import { Graphic } from "../core/graphic.js";


//==============================================================================
// 라인 차트.
// - 값 배열을 노드 영역에 폴리라인으로 그린다. pushValue 로 매 프레임 / 매 초
//   새 값을 밀어 넣으면 오래된 값이 밀려나는 실시간 그래프가 된다.
// - 사용:
//     const lineChart = chartNode.addComponent(UILineChart);
//     lineChart.setMaxSampleCount(60);
//     매 초: lineChart.pushValue(newValue);
//==============================================================================
export class UILineChart extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number[] } */ #valueList;
	/** @private @type { number } */ #maxSampleCount;
	/** @private @type { number | null } */ #minValue; // null 이면 자동.
	/** @private @type { number | null } */ #maxValue; // null 이면 자동.
	/** @private @type { Color } */ #lineColor;
	/** @private @type { Color } */ #gridColor;
	/** @private @type { number } */ #lineWidth;
	/** @private @type { number } */ #gridLineCount;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.setComponentType("UILineChart");
		this.#valueList = [];
		this.#maxSampleCount = 60;
		this.#minValue = null;
		this.#maxValue = null;
		this.#lineColor = new Color(0.42, 0.48, 1, 1);
		this.#gridColor = new Color(1, 1, 1, 0.07);
		this.#lineWidth = 1.5;
		this.#gridLineCount = 3;
	}

	//==============================================================================
	// 값 하나 추가. (표본 수를 넘기면 앞에서 밀려난다)
	//==============================================================================
	/**
	 * @param { number } value
	 */
	pushValue(value) {
		this.#valueList.push(value);
		while (this.#valueList.length > this.#maxSampleCount) {
			this.#valueList.shift();
		}
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		const node = this.getNode();
		const contentSize = node.getContentSize();
		const width = contentSize.x;
		const height = contentSize.y;

		// 격자.
		graphic.setStrokeColor(this.#gridColor.toRGBAString());
		for (let gridIndex = 1; gridIndex <= this.#gridLineCount; ++gridIndex) {
			const gridY = height * gridIndex / (this.#gridLineCount + 1);
			graphic.drawLine([Vector2.create(0, gridY), Vector2.create(width, gridY)], 1);
		}

		const sampleCount = this.#valueList.length;
		if (sampleCount < 2) {
			return;
		}

		// 값 범위.
		let lowValue = this.#minValue;
		let highValue = this.#maxValue;
		if (lowValue === null || highValue === null) {
			let autoLow = this.#valueList[0];
			let autoHigh = this.#valueList[0];
			for (const value of this.#valueList) {
				autoLow = System.Math.min(autoLow, value);
				autoHigh = System.Math.max(autoHigh, value);
			}
			if (lowValue === null) {
				lowValue = autoLow;
			}
			if (highValue === null) {
				highValue = autoHigh;
			}
		}
		const valueRange = System.Math.max(highValue - lowValue, 0.0001);

		// 폴리라인. (표본이 그래프 폭 전체에 퍼지도록)
		const points = [];
		for (let sampleIndex = 0; sampleIndex < sampleCount; ++sampleIndex) {
			const ratio = sampleIndex / (this.#maxSampleCount - 1);
			const valueRatio = (this.#valueList[sampleIndex] - lowValue) / valueRange;
			points.push(Vector2.create(ratio * width, height - valueRatio * (height - 4) - 2));
		}
		graphic.setStrokeColor(this.#lineColor.toRGBAString());
		graphic.drawLine(points, this.#lineWidth);
	}

	//==============================================================================
	// 설정 / 조회 메서드 목록.
	//==============================================================================
	/** @param { number } maxSampleCount */
	setMaxSampleCount(maxSampleCount) {
		this.#maxSampleCount = System.Math.max(2, maxSampleCount);
	}

	/** @returns { number } */
	getMaxSampleCount() {
		return this.#maxSampleCount;
	}

	/** @param { number | null } minValue @param { number | null } maxValue */
	setValueRange(minValue, maxValue) {
		this.#minValue = minValue;
		this.#maxValue = maxValue;
	}

	/** @param { number[] } valueList */
	setValueList(valueList) {
		this.#valueList = valueList.slice(-this.#maxSampleCount);
	}

	/** @returns { number[] } */
	getValueList() {
		return this.#valueList.slice();
	}

	/** @param { Color } lineColor */
	setLineColor(lineColor) {
		this.#lineColor = lineColor.clone();
	}

	/** @param { Color } gridColor */
	setGridColor(gridColor) {
		this.#gridColor = gridColor.clone();
	}

	/** @param { number } lineWidth */
	setLineWidth(lineWidth) {
		this.#lineWidth = lineWidth;
	}
}


//==============================================================================
// 바 차트.
// - 값 배열을 세로 막대로 그린다. 값이 바뀌면 다음 프레임에 그대로 반영된다.
//==============================================================================
export class UIBarChart extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number[] } */ #valueList;
	/** @private @type { number | null } */ #maxValue; // null 이면 자동.
	/** @private @type { Color } */ #barColor;
	/** @private @type { Color } */ #highlightColor;
	/** @private @type { number } */ #highlightIndex; // -1 이면 없음.
	/** @private @type { number } */ #barGap;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.setComponentType("UIBarChart");
		this.#valueList = [];
		this.#maxValue = null;
		this.#barColor = new Color(0.42, 0.48, 1, 0.85);
		this.#highlightColor = new Color(0.22, 0.84, 1, 1);
		this.#highlightIndex = -1;
		this.#barGap = 4;
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		const barCount = this.#valueList.length;
		if (barCount === 0) {
			return;
		}
		const node = this.getNode();
		const contentSize = node.getContentSize();
		const width = contentSize.x;
		const height = contentSize.y;

		let highValue = this.#maxValue;
		if (highValue === null) {
			highValue = 0.0001;
			for (const value of this.#valueList) {
				highValue = System.Math.max(highValue, value);
			}
		}

		const barWidth = (width - this.#barGap * (barCount - 1)) / barCount;
		for (let barIndex = 0; barIndex < barCount; ++barIndex) {
			const valueRatio = System.Math.max(0, System.Math.min(1, this.#valueList[barIndex] / highValue));
			const barHeight = System.Math.max(1, valueRatio * height);
			const barX = barIndex * (barWidth + this.#barGap);
			const barColor = (barIndex === this.#highlightIndex) ? this.#highlightColor : this.#barColor;
			graphic.setFillColor(barColor.toRGBAString());
			graphic.drawRect(Rect.create(barX, height - barHeight, barWidth, barHeight));
		}
	}

	//==============================================================================
	// 설정 / 조회 메서드 목록.
	//==============================================================================
	/** @param { number[] } valueList */
	setValueList(valueList) {
		this.#valueList = valueList.slice();
	}

	/** @returns { number[] } */
	getValueList() {
		return this.#valueList.slice();
	}

	/** @param { number | null } maxValue */
	setMaxValue(maxValue) {
		this.#maxValue = maxValue;
	}

	/** @param { Color } barColor */
	setBarColor(barColor) {
		this.#barColor = barColor.clone();
	}

	/** @param { Color } highlightColor */
	setHighlightColor(highlightColor) {
		this.#highlightColor = highlightColor.clone();
	}

	/** @param { number } highlightIndex -1 이면 강조 없음. */
	setHighlightIndex(highlightIndex) {
		this.#highlightIndex = highlightIndex;
	}

	/** @param { number } barGap */
	setBarGap(barGap) {
		this.#barGap = barGap;
	}
}
