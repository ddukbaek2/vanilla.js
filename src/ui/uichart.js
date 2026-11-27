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
/**
 * @example <caption>값을 밀어 넣어 꺾은선 그리기</caption>
 * import { Engine, EngineConfiguration, UIScene, UILineChart, WorldNode, Color, Pivot, Vector2 } from "./build/vanilla.js";
 *
 * class LineChartScene extends UIScene {
 * 	create() {
 * 		super.create();
 * 		const chartNode = new WorldNode();
 * 		chartNode.setPivot(Pivot.topLeft.clone());
 * 		chartNode.setAnchor(Pivot.topLeft.clone());
 * 		chartNode.setContentSize(Vector2.create(480, 160));
 * 		chartNode.setLocalPosition(Vector2.create(80, 100));
 * 		const lineChart = chartNode.addComponent(UILineChart);
 * 		lineChart.setMaxSampleCount(60);
 * 		lineChart.setValueRange(0, 100);
 * 		lineChart.setLineColor(new Color(0.3, 0.8, 1, 1));
 * 		lineChart.setLineWidth(2);
 * 		for (let sampleIndex = 0; sampleIndex < 80; ++sampleIndex) {
 * 			lineChart.pushValue(50 + Math.sin(sampleIndex * 0.3) * 30);
 * 		}
 * 		const valueList = lineChart.getValueList();
 * 		console.log(valueList.length);
 * 		const root = this.getRoot();
 * 		root.addChild(chartNode);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const scene = new LineChartScene();
 * scene.setLoadingMinDurationMs(0);
 * engine.run(scene);
 */
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
	 * @param { number } value 새 표본 값. (맨 뒤에 붙는다)
	 */
	pushValue(value) {
		this.#valueList.push(value);
		while (this.#valueList.length > this.#maxSampleCount) {
			this.#valueList.shift();
		}
		// 범위를 정했으면 값이 범위 밖으로 나가 내용 영역 밖에 그릴 수 있다. (범위를 스스로 잡으면 늘 안이다)
		if (this.#minValue !== null || this.#maxValue !== null) {
			this.markDrawnRectDirty();
		}
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic 그릴 그래픽. (노드 로컬 좌표, 내용 영역 왼쪽 위가 원점)
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

		const points = this.calculatePoints(width, height);
		if (points.length < 2) {
			return;
		}
		graphic.setStrokeColor(this.#lineColor.toRGBAString());
		graphic.drawLine(points, this.#lineWidth);
	}

	//==============================================================================
	// 그리는 사각형을 rect 에 적기. (오버라이드: 격자는 내용 영역 안, 선은 값이 정한 범위 밖으로 나간 만큼 위아래로 넘친다)
	// - 가로는 표본이 내용 폭 안에 퍼지므로 내용 폭. 세로는 내용 높이와 가장 큰 값, 가장 작은 값이 놓이는 높이를 합친다.
	// - 선 두께만큼(이음새를 메우는 반두께 연장까지) 사방으로 넓혀 본다.
	//==============================================================================
	/**
	 * @override
	 * @param { Rect } rect 그리는 사각형을 적을 곳. (노드 내용 영역의 왼쪽 위가 원점)
	 * @returns { boolean } 노드에 붙어 있으면 참.
	 * @example <caption>범위를 넘는 값이 그리는 곳 보기</caption>
	 * import { WorldNode, UILineChart, Rect, Vector2 } from "./build/vanilla.js";
	 *
	 * const node = new WorldNode();
	 * node.setContentSize(Vector2.create(160, 60));
	 * const chart = node.addComponent(UILineChart);
	 * chart.setValueRange(0, 1);
	 * chart.setValueList([0.5, 2, 0.2]);
	 * const drawnRect = Rect.zero();
	 * chart.calculateDrawnRect(drawnRect);
	 * console.log(drawnRect.position.y < 0);
	 */
	calculateDrawnRect(rect) {
		const node = this.getNode();
		if (!node) {
			return false;
		}
		const contentSize = node.getContentSize();
		const width = contentSize.x;
		const height = contentSize.y;
		let minimumY = System.Math.min(0, height);
		let maximumY = System.Math.max(0, height);
		const valueList = this.#valueList;
		if (valueList.length >= 2 && (this.#minValue !== null || this.#maxValue !== null)) {
			let lowValue = valueList[0];
			let highValue = valueList[0];
			for (const value of valueList) {
				lowValue = System.Math.min(lowValue, value);
				highValue = System.Math.max(highValue, value);
			}
			const rangeLowValue = (this.#minValue !== null) ? this.#minValue : lowValue;
			const rangeHighValue = (this.#maxValue !== null) ? this.#maxValue : highValue;
			const valueRange = System.Math.max(rangeHighValue - rangeLowValue, 0.0001);
			const lowY = height - (lowValue - rangeLowValue) / valueRange * (height - 4) - 2;
			const highY = height - (highValue - rangeLowValue) / valueRange * (height - 4) - 2;
			minimumY = System.Math.min(minimumY, lowY, highY);
			maximumY = System.Math.max(maximumY, lowY, highY);
		}
		const margin = System.Math.max(1, this.#lineWidth) + 1;
		rect.position.set(System.Math.min(0, width) - margin, minimumY - margin);
		rect.size.set(System.Math.abs(width) + margin * 2, maximumY - minimumY + margin * 2);
		return true;
	}

	//==============================================================================
	// 폴리라인 점 계산. (그리기와 같은 자리, 표본이 둘보다 적으면 빈 목록)
	//==============================================================================
	/**
	 * @param { number } width 그래프 너비. (픽셀, 표본 수 상한을 채웠을 때 마지막 점이 이 자리)
	 * @param { number } height 그래프 높이. (픽셀, 위아래 2 픽셀은 비운다)
	 * @returns { Vector2[] } 표본마다 점 하나. (왼쪽 위가 원점, 값이 클수록 위)
	 */
	calculatePoints(width, height) {
		const sampleCount = this.#valueList.length;
		if (sampleCount < 2) {
			return [];
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
		return points;
	}

	//==============================================================================
	// 설정 / 조회 메서드 목록.
	//==============================================================================

	//==============================================================================
	// 표본 수 상한 설정. (2 보다 작으면 2, 이미 든 표본이 새 상한보다 많으면 오래된 것부터 버린다)
	//==============================================================================
	/**
	 * @param { number } maxSampleCount 표본 수 상한.
	 * @example <caption>상한을 줄이면 오래된 표본부터 버리기</caption>
	 * import { UILineChart } from "./build/vanilla.js";
	 *
	 * const lineChart = new UILineChart();
	 * lineChart.setValueList([1, 2, 3, 4, 5]);
	 * lineChart.setMaxSampleCount(3);
	 * const valueList = lineChart.getValueList();
	 * console.log(valueList.join(", "));
	 */
	setMaxSampleCount(maxSampleCount) {
		this.#maxSampleCount = System.Math.max(2, maxSampleCount);
		const excessCount = this.#valueList.length - this.#maxSampleCount;
		if (excessCount > 0) {
			this.#valueList.splice(0, excessCount);
		}
		this.markDrawnRectDirty();
	}

	//==============================================================================
	// 표본 수 상한 반환.
	//==============================================================================
	/** @returns { number } 표본 수 상한. (2 이상) */
	getMaxSampleCount() {
		return this.#maxSampleCount;
	}

	//==============================================================================
	// 세로 값 범위 설정. (null 인 끝은 표본의 최소, 최대로 자동으로 맞춘다)
	//==============================================================================
	/**
	 * @param { number | null } minValue 아래 끝 값. (null 이면 자동)
	 * @param { number | null } maxValue 위 끝 값. (null 이면 자동)
	 * @example <caption>고정 범위와 자동 범위의 점 자리 비교</caption>
	 * import { UILineChart } from "./build/vanilla.js";
	 *
	 * const lineChart = new UILineChart();
	 * lineChart.setMaxSampleCount(3);
	 * lineChart.setValueList([20, 40, 60]);
	 * lineChart.setValueRange(0, 100);
	 * const fixedPoints = lineChart.calculatePoints(200, 104);
	 * console.log(fixedPoints[2].y);
	 * lineChart.setValueRange(null, null);
	 * const autoPoints = lineChart.calculatePoints(200, 104);
	 * console.log(autoPoints[2].y);
	 */
	setValueRange(minValue, maxValue) {
		this.#minValue = minValue;
		this.#maxValue = maxValue;
		this.markDrawnRectDirty();
	}

	//==============================================================================
	// 표본 목록 설정. (표본 수 상한보다 길면 뒤쪽만 남긴다)
	//==============================================================================
	/** @param { number[] } valueList 표본 값 목록. (복사해 쥔다) */
	setValueList(valueList) {
		this.#valueList = valueList.slice(-this.#maxSampleCount);
		this.markDrawnRectDirty();
	}

	//==============================================================================
	// 표본 목록 반환.
	//==============================================================================
	/** @returns { number[] } 표본 값 목록의 복사본. (오래된 것부터) */
	getValueList() {
		return this.#valueList.slice();
	}

	//==============================================================================
	// 선 색 설정.
	//==============================================================================
	/** @param { Color | string } lineColor 선 색. (복제해 쥔다) */
	setLineColor(lineColor) {
		lineColor = Color.from(lineColor);
		this.#lineColor = lineColor.clone();
	}

	//==============================================================================
	// 격자 색 설정. (가로 격자선 3 개)
	//==============================================================================
	/** @param { Color | string } gridColor 격자 색. (복제해 쥔다) */
	setGridColor(gridColor) {
		gridColor = Color.from(gridColor);
		this.#gridColor = gridColor.clone();
	}

	//==============================================================================
	// 선 굵기 설정.
	//==============================================================================
	/** @param { number } lineWidth 선 굵기. (픽셀) */
	setLineWidth(lineWidth) {
		this.#lineWidth = lineWidth;
		this.markDrawnRectDirty();
	}
}


//==============================================================================
// 바 차트.
// - 값 배열을 세로 막대로 그린다. 값이 바뀌면 다음 프레임에 그대로 반영된다.
//==============================================================================
/**
 * @example <caption>막대 하나를 강조한 막대 그래프</caption>
 * import { Engine, EngineConfiguration, UIScene, UIBarChart, WorldNode, Color, Pivot, Vector2 } from "./build/vanilla.js";
 *
 * class BarChartScene extends UIScene {
 * 	create() {
 * 		super.create();
 * 		const chartNode = new WorldNode();
 * 		chartNode.setPivot(Pivot.topLeft.clone());
 * 		chartNode.setAnchor(Pivot.topLeft.clone());
 * 		chartNode.setContentSize(Vector2.create(420, 160));
 * 		chartNode.setLocalPosition(Vector2.create(110, 100));
 * 		const barChart = chartNode.addComponent(UIBarChart);
 * 		barChart.setValueList([12, 30, 22, 48, 36, 54, 41]);
 * 		barChart.setMaxValue(60);
 * 		barChart.setBarGap(8);
 * 		barChart.setBarColor(new Color(0.42, 0.48, 1, 0.6));
 * 		barChart.setHighlightColor(new Color(0.22, 0.84, 1, 1));
 * 		barChart.setHighlightIndex(5);
 * 		const root = this.getRoot();
 * 		root.addChild(chartNode);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const scene = new BarChartScene();
 * scene.setLoadingMinDurationMs(0);
 * engine.run(scene);
 */
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
	 * @param { Graphic } graphic 그릴 그래픽. (노드 로컬 좌표, 내용 영역 왼쪽 위가 원점)
	 */
	draw(graphic) {
		const node = this.getNode();
		const contentSize = node.getContentSize();
		const barRects = this.calculateBarRects(contentSize.x, contentSize.y);
		for (let barIndex = 0; barIndex < barRects.length; ++barIndex) {
			const barColor = (barIndex === this.#highlightIndex) ? this.#highlightColor : this.#barColor;
			graphic.setFillColor(barColor.toRGBAString());
			graphic.drawRect(barRects[barIndex]);
		}
	}

	//==============================================================================
	// 그리는 사각형을 rect 에 적기. (오버라이드: 막대는 내용 영역 안, 막대 사이가 너무 넓어 막대 폭이 음수가 되면 그만큼 옆으로 넘친다)
	// - 세로는 막대가 가장 낮아도 한 단위 높이로 그리므로 내용 높이가 한 단위보다 작으면 위로 넘친다. 한 단위씩 넓혀 본다.
	//==============================================================================
	/**
	 * @override
	 * @param { Rect } rect 그리는 사각형을 적을 곳. (노드 내용 영역의 왼쪽 위가 원점)
	 * @returns { boolean } 노드에 붙어 있으면 참.
	 * @example <caption>막대 그래프가 그리는 곳 보기</caption>
	 * import { WorldNode, UIBarChart, Rect, Vector2 } from "./build/vanilla.js";
	 *
	 * const node = new WorldNode();
	 * node.setContentSize(Vector2.create(120, 40));
	 * const chart = node.addComponent(UIBarChart);
	 * chart.setValueList([3, 5, 2]);
	 * const drawnRect = Rect.zero();
	 * chart.calculateDrawnRect(drawnRect);
	 * console.log(drawnRect.size.x, drawnRect.size.y);
	 */
	calculateDrawnRect(rect) {
		const node = this.getNode();
		if (!node) {
			return false;
		}
		const barCount = this.#valueList.length;
		if (barCount === 0) {
			rect.position.set(0, 0);
			rect.size.set(0, 0);
			return true;
		}
		const contentSize = node.getContentSize();
		const width = contentSize.x;
		const height = contentSize.y;
		const barWidth = (width - this.#barGap * (barCount - 1)) / barCount;
		const minimumX = System.Math.min(0, barWidth, width);
		const maximumX = System.Math.max(width, width - barWidth, 0);
		const minimumY = System.Math.min(0, height - 1);
		const maximumY = System.Math.max(height, 0);
		rect.position.set(minimumX - 1, minimumY - 1);
		rect.size.set(maximumX - minimumX + 2, maximumY - minimumY + 2);
		return true;
	}

	//==============================================================================
	// 막대 사각형 목록 계산. (그리기와 같은 자리)
	//==============================================================================
	/**
	 * @param { number } width 그래프 너비. (픽셀, 막대 사이 간격을 뺀 나머지를 막대 수로 나눈다)
	 * @param { number } height 그래프 높이. (픽셀, 최대 값이 이 높이)
	 * @returns { Rect[] } 막대마다 사각형 하나. (바닥에 붙고, 값이 0 이하여도 높이 1 픽셀)
	 */
	calculateBarRects(width, height) {
		const barCount = this.#valueList.length;
		if (barCount === 0) {
			return [];
		}
		let highValue = this.#maxValue;
		if (highValue === null) {
			highValue = 0.0001;
			for (const value of this.#valueList) {
				highValue = System.Math.max(highValue, value);
			}
		}

		const barWidth = (width - this.#barGap * (barCount - 1)) / barCount;
		const barRects = [];
		for (let barIndex = 0; barIndex < barCount; ++barIndex) {
			const valueRatio = System.Math.max(0, System.Math.min(1, this.#valueList[barIndex] / highValue));
			const barHeight = System.Math.max(1, valueRatio * height);
			const barX = barIndex * (barWidth + this.#barGap);
			barRects.push(Rect.create(barX, height - barHeight, barWidth, barHeight));
		}
		return barRects;
	}

	//==============================================================================
	// 설정 / 조회 메서드 목록.
	//==============================================================================

	//==============================================================================
	// 막대 값 목록 설정.
	//==============================================================================
	/** @param { number[] } valueList 막대 값 목록. (복사해 쥔다) */
	setValueList(valueList) {
		this.#valueList = valueList.slice();
		this.markDrawnRectDirty();
	}

	//==============================================================================
	// 막대 값 목록 반환.
	//==============================================================================
	/** @returns { number[] } 막대 값 목록의 복사본. */
	getValueList() {
		return this.#valueList.slice();
	}

	//==============================================================================
	// 최대 값 설정. (막대가 높이를 다 채우는 값, 넘는 값은 잘린다)
	//==============================================================================
	/** @param { number | null } maxValue 최대 값. (null 이면 값 목록의 최대) */
	setMaxValue(maxValue) {
		this.#maxValue = maxValue;
	}

	//==============================================================================
	// 막대 색 설정.
	//==============================================================================
	/** @param { Color | string } barColor 막대 색. (복제해 쥔다) */
	setBarColor(barColor) {
		barColor = Color.from(barColor);
		this.#barColor = barColor.clone();
	}

	//==============================================================================
	// 강조 막대 색 설정.
	//==============================================================================
	/** @param { Color | string } highlightColor 강조 막대 색. (복제해 쥔다) */
	setHighlightColor(highlightColor) {
		highlightColor = Color.from(highlightColor);
		this.#highlightColor = highlightColor.clone();
	}

	//==============================================================================
	// 강조할 막대 순서 설정.
	//==============================================================================
	/** @param { number } highlightIndex -1 이면 강조 없음. */
	setHighlightIndex(highlightIndex) {
		this.#highlightIndex = highlightIndex;
	}

	//==============================================================================
	// 막대 사이 간격 설정.
	//==============================================================================
	/** @param { number } barGap 막대 사이 간격. (픽셀) */
	setBarGap(barGap) {
		this.#barGap = barGap;
		this.markDrawnRectDirty();
	}
}
