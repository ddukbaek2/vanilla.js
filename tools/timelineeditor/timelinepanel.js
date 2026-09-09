//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Timeline, TIMELINE_PROPERTY_DEFINITIONS } from "../../src/experimental/animation/timeline.js";
import { EditorTheme } from "../common/editorkit.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const HEADER_WIDTH = 240;          // 왼쪽 트랙 이름 열 폭.
const RULER_HEIGHT = 30;           // 위 눈금자 높이. (마커도 여기 산다)
const GROUP_ROW_HEIGHT = 26;       // 노드 묶음 줄 높이.
const TRACK_ROW_HEIGHT = 24;       // 트랙 줄 높이.
const CURVE_ROW_HEIGHT = 170;      // 커브 보기 줄 높이.
const KEY_HALF_SIZE = 5;           // 키 마름모 반 크기.
const MARKER_HALF_WIDTH = 6;       // 마커 깃발 반 폭.
const MINIMUM_PIXELS_PER_SECOND = 24;
const MAXIMUM_PIXELS_PER_SECOND = 3000;
const DRAG_THRESHOLD = 3;
const HEADER_BACKGROUND = "#1f1f1f";
const LANE_BACKGROUND = "#181818";
const LANE_ALTERNATE = "rgba(255, 255, 255, 0.018)";
const GROUP_BACKGROUND = "#232323";
const CURVE_BACKGROUND = "#141414";
const OUT_OF_RANGE_COLOR = "rgba(0, 0, 0, 0.35)";
const KEY_COLOR = "#cfcfcf";
const KEY_EVENT_COLOR = "#8fd3a5";
const KEY_SELECTED_COLOR = EditorTheme.accentColor;
const KEY_LINE_COLOR = "rgba(207, 207, 207, 0.22)";
const PLAYHEAD_COLOR = EditorTheme.accentColor;
const MARKER_COLOR = "#6fb1ff";
const GRID_COLOR = "rgba(255, 255, 255, 0.06)";
const GRID_MAJOR_COLOR = "rgba(255, 255, 255, 0.12)";
const TEXT_COLOR = EditorTheme.inkColor;
const TEXT_DIM_COLOR = EditorTheme.inkDimColor;


//==============================================================================
// 타임라인 패널. (도프 시트 + 커브 보기 — 캔버스 하나에 헤더 열 / 눈금자 / 레인을 그린다)
// - 문서 접근과 선택 / 되돌리기는 위임 객체(편집기)가 맡는다.
//==============================================================================
export class TimelinePanel {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { HTMLElement } */ #hostElement;
	/** @private @type { HTMLCanvasElement } */ #canvasElement;
	/** @private @type { object } */ #delegate;
	/** @private @type { number } */ #pixelsPerSecond;
	/** @private @type { number } */ #scrollTime;
	/** @private @type { number } */ #scrollY;
	/** @private @type { System.Set } */ #collapsedNodeSet;
	/** @private @type { object[] } */ #rowList;
	/** @private @type { object | null } */ #dragState;
	/** @private @type { boolean } */ #isDrawRequested;
	/** @private @type { number } */ #hoverTime;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { HTMLElement } hostElement
	 * @param { object } delegate
	 */
	constructor(hostElement, delegate) {
		this.#hostElement = hostElement;
		this.#delegate = delegate;
		this.#pixelsPerSecond = 180;
		this.#scrollTime = -0.15;
		this.#scrollY = 0;
		this.#collapsedNodeSet = new System.Set();
		this.#rowList = [];
		this.#dragState = null;
		this.#isDrawRequested = false;
		this.#hoverTime = -1;

		this.#canvasElement = System.document.createElement("canvas");
		this.#canvasElement.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block;cursor:default;";
		hostElement.appendChild(this.#canvasElement);

		const resizeObserver = new System.ResizeObserver(() => {
			this.resize();
		});
		resizeObserver.observe(hostElement);

		this.#canvasElement.addEventListener("pointerdown", (pointerEvent) => {
			this.handlePointerDown(pointerEvent);
		});
		this.#canvasElement.addEventListener("pointermove", (pointerEvent) => {
			this.handlePointerMove(pointerEvent);
		});
		this.#canvasElement.addEventListener("pointerup", (pointerEvent) => {
			this.handlePointerUp(pointerEvent);
		});
		this.#canvasElement.addEventListener("pointerleave", () => {
			if (!this.#dragState) {
				this.#hoverTime = -1;
				this.requestDraw();
			}
		});
		this.#canvasElement.addEventListener("dblclick", (mouseEvent) => {
			this.handleDoubleClick(mouseEvent);
		});
		this.#canvasElement.addEventListener("wheel", (wheelEvent) => {
			this.handleWheel(wheelEvent);
		}, { passive: false });
		this.#canvasElement.addEventListener("contextmenu", (mouseEvent) => {
			mouseEvent.preventDefault();
			mouseEvent.stopPropagation();
			this.handleContextMenu(mouseEvent);
		});
		this.resize();
	}

	//==============================================================================
	// 크기 갱신. (장치 픽셀 비율 반영)
	//==============================================================================
	resize() {
		const devicePixelRatio = System.window.devicePixelRatio || 1;
		const width = System.Math.max(1, this.#hostElement.clientWidth);
		const height = System.Math.max(1, this.#hostElement.clientHeight);
		this.#canvasElement.width = System.Math.round(width * devicePixelRatio);
		this.#canvasElement.height = System.Math.round(height * devicePixelRatio);
		this.requestDraw();
	}

	//==============================================================================
	// 다시 그리기 요청. (프레임당 한 번)
	//==============================================================================
	requestDraw() {
		if (this.#isDrawRequested) {
			return;
		}
		this.#isDrawRequested = true;
		System.requestAnimationFrame(() => {
			this.#isDrawRequested = false;
			this.draw();
		});
	}

	//==============================================================================
	// 시간 ↔ 화면 x.
	//==============================================================================
	/**
	 * @param { number } time
	 * @returns { number }
	 */
	timeToX(time) {
		return HEADER_WIDTH + (time - this.#scrollTime) * this.#pixelsPerSecond;
	}

	/**
	 * @param { number } x
	 * @returns { number }
	 */
	xToTime(x) {
		return this.#scrollTime + (x - HEADER_WIDTH) / this.#pixelsPerSecond;
	}

	//==============================================================================
	// 시간 스냅. (프레임 단위 — 스냅이 꺼져 있으면 그대로)
	//==============================================================================
	/**
	 * @param { number } time
	 * @returns { number }
	 */
	snapTime(time) {
		const document = this.#delegate.getDocument();
		const duration = System.Math.max(0, System.Number(document.duration) || 0);
		let snapped = System.Math.max(0, System.Math.min(duration, time));
		if (this.#delegate.isSnapEnabled()) {
			const frameRate = System.Math.max(1, System.Number(document.frameRate) || 30);
			snapped = System.Math.round(snapped * frameRate) / frameRate;
		}
		return snapped;
	}

	//==============================================================================
	// 줄 목록 구성. (노드 묶음 → 트랙 — 문서의 노드 차례를 따른다)
	//==============================================================================
	buildRowList() {
		const document = this.#delegate.getDocument();
		const selectedTrack = this.#delegate.getSelectedTrack();
		const isCurveVisible = this.#delegate.isCurveVisible();
		const nodeOrder = document.stage.nodes.map((nodeDescription) => nodeDescription.name);
		const groupNames = [];
		for (const track of document.tracks) {
			if (!groupNames.includes(track.target)) {
				groupNames.push(track.target);
			}
		}
		groupNames.sort((left, right) => {
			const leftIndex = nodeOrder.indexOf(left);
			const rightIndex = nodeOrder.indexOf(right);
			return (leftIndex < 0 ? 100000 : leftIndex) - (rightIndex < 0 ? 100000 : rightIndex);
		});

		const rowList = [];
		let y = 0;
		for (const nodeName of groupNames) {
			const isCollapsed = this.#collapsedNodeSet.has(nodeName);
			rowList.push({ kind: "group", nodeName: nodeName, y: y, height: GROUP_ROW_HEIGHT, isCollapsed: isCollapsed });
			y += GROUP_ROW_HEIGHT;
			if (isCollapsed) {
				continue;
			}
			for (const track of document.tracks) {
				if (track.target !== nodeName) {
					continue;
				}
				const definition = TIMELINE_PROPERTY_DEFINITIONS[track.property];
				const kind = definition ? definition.kind : "number";
				const isCurveRow = isCurveVisible && track === selectedTrack && kind === "number";
				const height = isCurveRow ? CURVE_ROW_HEIGHT : TRACK_ROW_HEIGHT;
				rowList.push({ kind: "track", track: track, nodeName: nodeName, y: y, height: height, isCurveRow: isCurveRow, valueKind: kind });
				y += height;
			}
		}
		this.#rowList = rowList;
		return rowList;
	}

	//==============================================================================
	// 커브 줄의 값 범위. (키 최소 / 최대에 여백)
	//==============================================================================
	/**
	 * @param { object } track
	 * @returns { object }
	 */
	computeValueRange(track) {
		let minimum = System.Infinity;
		let maximum = -System.Infinity;
		for (const key of track.keys) {
			const value = System.Number(key.value);
			if (System.Number.isFinite(value)) {
				minimum = System.Math.min(minimum, value);
				maximum = System.Math.max(maximum, value);
			}
		}
		if (!System.Number.isFinite(minimum)) {
			minimum = 0;
			maximum = 1;
		}
		if (maximum - minimum < 0.0001) {
			minimum -= 1;
			maximum += 1;
		}
		const padding = (maximum - minimum) * 0.2;
		return { minimum: minimum - padding, maximum: maximum + padding };
	}

	/**
	 * @param { object } row
	 * @param { number } value
	 * @returns { number }
	 */
	valueToY(row, value) {
		const range = row.valueRange;
		const innerTop = row.y + 12;
		const innerHeight = row.height - 24;
		const normalized = (value - range.minimum) / (range.maximum - range.minimum);
		return innerTop + (1 - normalized) * innerHeight;
	}

	/**
	 * @param { object } row
	 * @param { number } y
	 * @returns { number }
	 */
	yToValue(row, y) {
		const range = row.valueRange;
		const innerTop = row.y + 12;
		const innerHeight = row.height - 24;
		const normalized = 1 - (y - innerTop) / innerHeight;
		return range.minimum + normalized * (range.maximum - range.minimum);
	}

	//==============================================================================
	// 그리기.
	//==============================================================================
	draw() {
		const context = this.#canvasElement.getContext("2d");
		const devicePixelRatio = System.window.devicePixelRatio || 1;
		const width = this.#canvasElement.width / devicePixelRatio;
		const height = this.#canvasElement.height / devicePixelRatio;
		context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
		context.font = "11px " + EditorTheme.fontFamily;
		context.textBaseline = "middle";

		const document = this.#delegate.getDocument();
		const duration = System.Math.max(0, System.Number(document.duration) || 0);
		const frameRate = System.Math.max(1, System.Number(document.frameRate) || 30);
		const playhead = this.#delegate.getPlayhead();
		const selectedKeys = this.#delegate.getSelectedKeys();
		const selectedTrack = this.#delegate.getSelectedTrack();
		const selectedNodeName = this.#delegate.getSelectedNodeName();
		const selectedMarker = this.#delegate.getSelectedMarker();
		const rowList = this.buildRowList();
		for (const row of rowList) {
			row.y -= this.#scrollY;
			if (row.isCurveRow) {
				row.valueRange = this.computeValueRange(row.track);
			}
		}

		// 바탕.
		context.fillStyle = LANE_BACKGROUND;
		context.fillRect(0, 0, width, height);
		context.fillStyle = HEADER_BACKGROUND;
		context.fillRect(0, 0, HEADER_WIDTH, height);

		// --- 레인 ---
		context.save();
		context.beginPath();
		context.rect(HEADER_WIDTH, RULER_HEIGHT, width - HEADER_WIDTH, height - RULER_HEIGHT);
		context.clip();

		// 범위 밖 어둡힘.
		const startX = this.timeToX(0);
		const endX = this.timeToX(duration);
		context.fillStyle = OUT_OF_RANGE_COLOR;
		if (startX > HEADER_WIDTH) {
			context.fillRect(HEADER_WIDTH, RULER_HEIGHT, startX - HEADER_WIDTH, height);
		}
		if (endX < width) {
			context.fillRect(endX, RULER_HEIGHT, width - endX, height);
		}

		// 세로 격자. (눈금자와 같은 간격)
		const tickStep = this.computeTickStep(frameRate);
		const firstTick = System.Math.floor(this.xToTime(HEADER_WIDTH) / tickStep.minor) * tickStep.minor;
		const lastTime = this.xToTime(width);
		for (let tickTime = firstTick; tickTime <= lastTime; tickTime += tickStep.minor) {
			const x = System.Math.round(this.timeToX(tickTime)) + 0.5;
			const isMajor = System.Math.abs(tickTime / tickStep.major - System.Math.round(tickTime / tickStep.major)) < 0.0001;
			context.strokeStyle = isMajor ? GRID_MAJOR_COLOR : GRID_COLOR;
			context.beginPath();
			context.moveTo(x, RULER_HEIGHT);
			context.lineTo(x, height);
			context.stroke();
		}

		// 줄 바탕 + 키.
		let rowIndex = 0;
		for (const row of rowList) {
			const rowTop = row.y + RULER_HEIGHT;
			if (rowTop > height || rowTop + row.height < RULER_HEIGHT) {
				rowIndex += 1;
				continue;
			}
			if (row.kind === "group") {
				context.fillStyle = GROUP_BACKGROUND;
				context.fillRect(HEADER_WIDTH, rowTop, width - HEADER_WIDTH, row.height);
				if (row.isCollapsed) {
					for (const track of document.tracks) {
						if (track.target !== row.nodeName) {
							continue;
						}
						for (const key of track.keys) {
							this.drawKeyDiamond(context, this.timeToX(key.time), rowTop + row.height / 2, 3, selectedKeys.has(key) ? KEY_SELECTED_COLOR : TEXT_DIM_COLOR);
						}
					}
				}
			}
			else if (row.isCurveRow) {
				context.fillStyle = CURVE_BACKGROUND;
				context.fillRect(HEADER_WIDTH, rowTop, width - HEADER_WIDTH, row.height);
				this.drawCurveRow(context, row, rowTop, width, selectedKeys);
			}
			else {
				if (rowIndex % 2 === 1) {
					context.fillStyle = LANE_ALTERNATE;
					context.fillRect(HEADER_WIDTH, rowTop, width - HEADER_WIDTH, row.height);
				}
				if (row.track === selectedTrack) {
					context.fillStyle = "rgba(212, 176, 106, 0.07)";
					context.fillRect(HEADER_WIDTH, rowTop, width - HEADER_WIDTH, row.height);
				}
				const centerY = rowTop + row.height / 2;
				const sortedKeys = row.track.keys.slice().sort((left, right) => left.time - right.time);
				if (sortedKeys.length > 1) {
					context.strokeStyle = KEY_LINE_COLOR;
					context.lineWidth = 1;
					context.beginPath();
					context.moveTo(this.timeToX(sortedKeys[0].time), centerY);
					context.lineTo(this.timeToX(sortedKeys[sortedKeys.length - 1].time), centerY);
					context.stroke();
				}
				const isEventTrack = row.track.property === "event";
				for (const key of sortedKeys) {
					const x = this.timeToX(key.time);
					const isSelected = selectedKeys.has(key);
					if (isEventTrack) {
						this.drawEventFlag(context, x, centerY, String(key.value), isSelected ? KEY_SELECTED_COLOR : KEY_EVENT_COLOR);
					}
					else {
						this.drawKeyDiamond(context, x, centerY, KEY_HALF_SIZE, isSelected ? KEY_SELECTED_COLOR : KEY_COLOR);
						if (key.easing === "step") {
							context.fillStyle = "#181818";
							context.fillRect(x - 1.5, centerY - 1.5, 3, 3);
						}
					}
				}
			}
			context.strokeStyle = EditorTheme.borderSoftColor;
			context.beginPath();
			context.moveTo(HEADER_WIDTH, rowTop + row.height + 0.5);
			context.lineTo(width, rowTop + row.height + 0.5);
			context.stroke();
			rowIndex += 1;
		}

		// 상자 선택.
		if (this.#dragState && this.#dragState.kind === "box") {
			const box = this.#dragState;
			const left = System.Math.min(box.startX, box.currentX);
			const top = System.Math.min(box.startY, box.currentY);
			context.fillStyle = "rgba(212, 176, 106, 0.12)";
			context.strokeStyle = "rgba(212, 176, 106, 0.8)";
			context.fillRect(left, top, System.Math.abs(box.currentX - box.startX), System.Math.abs(box.currentY - box.startY));
			context.strokeRect(left + 0.5, top + 0.5, System.Math.abs(box.currentX - box.startX), System.Math.abs(box.currentY - box.startY));
		}

		// 마우스 시간 안내선.
		if (this.#hoverTime >= 0 && !this.#dragState) {
			const hoverX = System.Math.round(this.timeToX(this.#hoverTime)) + 0.5;
			context.strokeStyle = "rgba(255, 255, 255, 0.12)";
			context.beginPath();
			context.moveTo(hoverX, RULER_HEIGHT);
			context.lineTo(hoverX, height);
			context.stroke();
		}

		// 재생 헤드.
		const playheadX = System.Math.round(this.timeToX(playhead)) + 0.5;
		context.strokeStyle = PLAYHEAD_COLOR;
		context.lineWidth = 1;
		context.beginPath();
		context.moveTo(playheadX, RULER_HEIGHT);
		context.lineTo(playheadX, height);
		context.stroke();
		context.restore();

		// --- 눈금자 ---
		context.save();
		context.beginPath();
		context.rect(HEADER_WIDTH, 0, width - HEADER_WIDTH, RULER_HEIGHT);
		context.clip();
		context.fillStyle = HEADER_BACKGROUND;
		context.fillRect(HEADER_WIDTH, 0, width - HEADER_WIDTH, RULER_HEIGHT);
		context.fillStyle = OUT_OF_RANGE_COLOR;
		if (startX > HEADER_WIDTH) {
			context.fillRect(HEADER_WIDTH, 0, startX - HEADER_WIDTH, RULER_HEIGHT);
		}
		if (endX < width) {
			context.fillRect(endX, 0, width - endX, RULER_HEIGHT);
		}
		context.textAlign = "left";
		for (let tickTime = firstTick; tickTime <= lastTime; tickTime += tickStep.minor) {
			const x = System.Math.round(this.timeToX(tickTime)) + 0.5;
			const isMajor = System.Math.abs(tickTime / tickStep.major - System.Math.round(tickTime / tickStep.major)) < 0.0001;
			context.strokeStyle = isMajor ? "rgba(255, 255, 255, 0.35)" : "rgba(255, 255, 255, 0.14)";
			context.beginPath();
			context.moveTo(x, RULER_HEIGHT - (isMajor ? 12 : 6));
			context.lineTo(x, RULER_HEIGHT);
			context.stroke();
			if (isMajor) {
				context.fillStyle = TEXT_DIM_COLOR;
				context.fillText(this.formatRulerTime(tickTime, frameRate, tickStep), x + 4, 9);
			}
		}

		// 마커.
		for (const marker of document.markers) {
			const x = this.timeToX(marker.time);
			const isSelected = marker === selectedMarker;
			context.fillStyle = isSelected ? KEY_SELECTED_COLOR : MARKER_COLOR;
			context.beginPath();
			context.moveTo(x, RULER_HEIGHT);
			context.lineTo(x - MARKER_HALF_WIDTH, RULER_HEIGHT - 9);
			context.lineTo(x - MARKER_HALF_WIDTH, RULER_HEIGHT - 16);
			context.lineTo(x + MARKER_HALF_WIDTH, RULER_HEIGHT - 16);
			context.lineTo(x + MARKER_HALF_WIDTH, RULER_HEIGHT - 9);
			context.closePath();
			context.fill();
			context.fillStyle = isSelected ? KEY_SELECTED_COLOR : TEXT_COLOR;
			context.fillText(marker.name, x + MARKER_HALF_WIDTH + 3, RULER_HEIGHT - 12);
		}

		// 재생 헤드 머리.
		context.fillStyle = PLAYHEAD_COLOR;
		context.beginPath();
		context.moveTo(playheadX - 6, 0);
		context.lineTo(playheadX + 6, 0);
		context.lineTo(playheadX + 6, 6);
		context.lineTo(playheadX, 12);
		context.lineTo(playheadX - 6, 6);
		context.closePath();
		context.fill();
		context.restore();

		// --- 헤더 열 ---
		context.save();
		context.beginPath();
		context.rect(0, RULER_HEIGHT, HEADER_WIDTH, height - RULER_HEIGHT);
		context.clip();
		for (const row of rowList) {
			const rowTop = row.y + RULER_HEIGHT;
			if (rowTop > height || rowTop + row.height < RULER_HEIGHT) {
				continue;
			}
			if (row.kind === "group") {
				context.fillStyle = GROUP_BACKGROUND;
				context.fillRect(0, rowTop, HEADER_WIDTH, row.height);
				const isSelectedNode = row.nodeName === selectedNodeName;
				context.fillStyle = isSelectedNode ? KEY_SELECTED_COLOR : TEXT_DIM_COLOR;
				context.textAlign = "left";
				context.fillText(row.isCollapsed ? "▸" : "▾", 10, rowTop + row.height / 2);
				context.fillStyle = isSelectedNode ? EditorTheme.selectedRowTextColor : TEXT_COLOR;
				context.font = "600 11.5px " + EditorTheme.fontFamily;
				context.fillText(this.truncateText(context, row.nodeName, HEADER_WIDTH - 40), 26, rowTop + row.height / 2);
				context.font = "11px " + EditorTheme.fontFamily;
			}
			else {
				const isSelectedTrack = row.track === selectedTrack;
				if (isSelectedTrack) {
					context.fillStyle = EditorTheme.accentSoftColor;
					context.fillRect(0, rowTop, HEADER_WIDTH, row.height);
					context.fillStyle = KEY_SELECTED_COLOR;
					context.fillRect(0, rowTop, 3, row.height);
				}
				const labelY = rowTop + System.Math.min(row.height / 2, TRACK_ROW_HEIGHT / 2);
				const isEnabled = row.track.enabled !== false;
				context.beginPath();
				context.arc(30, labelY, 4, 0, System.Math.PI * 2);
				context.strokeStyle = isEnabled ? KEY_SELECTED_COLOR : TEXT_DIM_COLOR;
				context.lineWidth = 1.2;
				context.stroke();
				if (isEnabled) {
					context.fillStyle = KEY_SELECTED_COLOR;
					context.fill();
				}
				context.fillStyle = isEnabled ? (isSelectedTrack ? EditorTheme.selectedRowTextColor : TEXT_COLOR) : TEXT_DIM_COLOR;
				context.textAlign = "left";
				context.fillText(this.truncateText(context, this.#delegate.getTrackLabel(row.track), HEADER_WIDTH - 80), 42, labelY);

				// 재생 헤드 위치 키 단추. (키가 있으면 채움)
				const hasKeyAtPlayhead = row.track.keys.some((key) => System.Math.abs(key.time - playhead) < 0.5 / frameRate);
				this.drawKeyDiamond(context, HEADER_WIDTH - 18, labelY, 5, hasKeyAtPlayhead ? KEY_SELECTED_COLOR : null, TEXT_DIM_COLOR);

				// 커브 줄이면 값 눈금.
				if (row.isCurveRow) {
					context.fillStyle = TEXT_DIM_COLOR;
					context.textAlign = "right";
					const range = row.valueRange;
					for (let stepIndex = 0; stepIndex <= 4; ++stepIndex) {
						const value = range.maximum - (range.maximum - range.minimum) * stepIndex / 4;
						const y = this.valueToY(row, value) + RULER_HEIGHT;
						context.fillText(this.formatValue(value), HEADER_WIDTH - 34, y);
					}
					context.textAlign = "left";
				}
			}
			context.strokeStyle = EditorTheme.borderSoftColor;
			context.beginPath();
			context.moveTo(0, rowTop + row.height + 0.5);
			context.lineTo(HEADER_WIDTH, rowTop + row.height + 0.5);
			context.stroke();
		}
		if (rowList.length === 0) {
			context.fillStyle = TEXT_DIM_COLOR;
			context.textAlign = "left";
			context.fillText("No tracks. Press ◆ next to a property in the inspector.", 12, RULER_HEIGHT + 18);
		}
		context.restore();

		// 헤더 열 위 모서리 (시간 표시).
		context.fillStyle = HEADER_BACKGROUND;
		context.fillRect(0, 0, HEADER_WIDTH, RULER_HEIGHT);
		context.fillStyle = KEY_SELECTED_COLOR;
		context.font = "600 12px " + EditorTheme.fontFamily;
		context.textAlign = "left";
		context.fillText(this.formatTimecode(playhead, frameRate), 12, RULER_HEIGHT / 2);
		context.fillStyle = TEXT_DIM_COLOR;
		context.font = "11px " + EditorTheme.fontFamily;
		context.fillText("frame " + System.Math.round(playhead * frameRate) + " / " + System.Math.round(duration * frameRate), 110, RULER_HEIGHT / 2);

		// 구분선.
		context.strokeStyle = EditorTheme.borderColor;
		context.beginPath();
		context.moveTo(HEADER_WIDTH + 0.5, 0);
		context.lineTo(HEADER_WIDTH + 0.5, height);
		context.moveTo(0, RULER_HEIGHT + 0.5);
		context.lineTo(width, RULER_HEIGHT + 0.5);
		context.stroke();
	}

	//==============================================================================
	// 커브 줄 그리기. (값 격자 + 보간 곡선 + 키 점)
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } context
	 * @param { object } row
	 * @param { number } rowTop
	 * @param { number } width
	 * @param { System.Set } selectedKeys
	 */
	drawCurveRow(context, row, rowTop, width, selectedKeys) {
		const range = row.valueRange;
		context.strokeStyle = GRID_COLOR;
		for (let stepIndex = 0; stepIndex <= 4; ++stepIndex) {
			const value = range.maximum - (range.maximum - range.minimum) * stepIndex / 4;
			const y = System.Math.round(this.valueToY(row, value) + RULER_HEIGHT) + 0.5;
			context.beginPath();
			context.moveTo(HEADER_WIDTH, y);
			context.lineTo(width, y);
			context.stroke();
		}
		const sortedKeys = row.track.keys.slice().sort((left, right) => left.time - right.time);
		if (sortedKeys.length === 0) {
			return;
		}
		context.strokeStyle = KEY_SELECTED_COLOR;
		context.lineWidth = 1.5;
		context.beginPath();
		const firstX = System.Math.max(HEADER_WIDTH, this.timeToX(sortedKeys[0].time));
		const lastX = System.Math.min(width, this.timeToX(sortedKeys[sortedKeys.length - 1].time));
		for (let x = firstX; x <= lastX; x += 2) {
			const value = Timeline.sampleKeys(sortedKeys, "number", this.xToTime(x));
			const y = this.valueToY(row, value) + RULER_HEIGHT;
			if (x === firstX) {
				context.moveTo(x, y);
			}
			else {
				context.lineTo(x, y);
			}
		}
		context.stroke();
		context.lineWidth = 1;
		for (const key of sortedKeys) {
			const x = this.timeToX(key.time);
			const y = this.valueToY(row, System.Number(key.value)) + RULER_HEIGHT;
			context.fillStyle = selectedKeys.has(key) ? KEY_SELECTED_COLOR : KEY_COLOR;
			context.beginPath();
			context.arc(x, y, 4.5, 0, System.Math.PI * 2);
			context.fill();
			if (selectedKeys.has(key)) {
				context.fillStyle = TEXT_COLOR;
				context.textAlign = "left";
				context.fillText(this.formatValue(System.Number(key.value)), x + 8, y - 8);
			}
		}
	}

	//==============================================================================
	// 키 마름모 / 이벤트 깃발 그리기.
	//==============================================================================
	drawKeyDiamond(context, x, y, halfSize, fillColor, strokeColor = null) {
		context.beginPath();
		context.moveTo(x, y - halfSize);
		context.lineTo(x + halfSize, y);
		context.lineTo(x, y + halfSize);
		context.lineTo(x - halfSize, y);
		context.closePath();
		if (fillColor) {
			context.fillStyle = fillColor;
			context.fill();
		}
		if (strokeColor) {
			context.strokeStyle = strokeColor;
			context.lineWidth = 1;
			context.stroke();
		}
	}

	drawEventFlag(context, x, y, labelText, color) {
		context.fillStyle = color;
		context.fillRect(x - 1, y - 8, 2, 16);
		context.beginPath();
		context.moveTo(x, y - 8);
		context.lineTo(x + 9, y - 4);
		context.lineTo(x, y);
		context.closePath();
		context.fill();
		context.fillStyle = TEXT_DIM_COLOR;
		context.textAlign = "left";
		context.fillText(labelText, x + 12, y + 1);
	}

	//==============================================================================
	// 눈금 간격. (배율에 따라 프레임 / 초 단위)
	//==============================================================================
	/**
	 * @param { number } frameRate
	 * @returns { object }
	 */
	computeTickStep(frameRate) {
		const frameSeconds = 1 / frameRate;
		const candidateList = [
			{ minor: frameSeconds, major: frameSeconds * 5, isFrame: true },
			{ minor: frameSeconds, major: frameSeconds * 10, isFrame: true },
			{ minor: frameSeconds * 5, major: 1, isFrame: false },
			{ minor: 0.25, major: 1, isFrame: false },
			{ minor: 0.5, major: 2, isFrame: false },
			{ minor: 1, major: 5, isFrame: false },
			{ minor: 2, major: 10, isFrame: false },
			{ minor: 5, major: 30, isFrame: false },
		];
		for (const candidate of candidateList) {
			if (candidate.minor * this.#pixelsPerSecond >= 9 && candidate.major * this.#pixelsPerSecond >= 64) {
				return candidate;
			}
		}
		return candidateList[candidateList.length - 1];
	}

	/**
	 * @param { number } time
	 * @param { number } frameRate
	 * @param { object } tickStep
	 * @returns { string }
	 */
	formatRulerTime(time, frameRate, tickStep) {
		if (tickStep.isFrame) {
			return String(System.Math.round(time * frameRate)) + "f";
		}
		return this.formatTimecode(time, frameRate);
	}

	/**
	 * @param { number } time
	 * @param { number } frameRate
	 * @returns { string }
	 */
	formatTimecode(time, frameRate) {
		const totalFrames = System.Math.round(System.Math.max(0, time) * frameRate);
		const seconds = System.Math.floor(totalFrames / frameRate);
		const frames = totalFrames - seconds * frameRate;
		const minutes = System.Math.floor(seconds / 60);
		return String(minutes).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0") + ":" + String(frames).padStart(2, "0");
	}

	/**
	 * @param { number } value
	 * @returns { string }
	 */
	formatValue(value) {
		if (System.Math.abs(value - System.Math.round(value)) < 0.001) {
			return String(System.Math.round(value));
		}
		return value.toFixed(2);
	}

	/**
	 * @param { CanvasRenderingContext2D } context
	 * @param { string } text
	 * @param { number } maximumWidth
	 * @returns { string }
	 */
	truncateText(context, text, maximumWidth) {
		if (context.measureText(text).width <= maximumWidth) {
			return text;
		}
		let truncated = text;
		while (truncated.length > 1 && context.measureText(truncated + "…").width > maximumWidth) {
			truncated = truncated.substring(0, truncated.length - 1);
		}
		return truncated + "…";
	}

	//==============================================================================
	// 좌표 → 히트 정보. ({ area, row, key, marker, time })
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @returns { object }
	 */
	hitTest(x, y) {
		const document = this.#delegate.getDocument();
		const time = this.xToTime(x);
		const hit = { area: "empty", row: null, key: null, marker: null, time: time, x: x, y: y };
		if (y < RULER_HEIGHT) {
			hit.area = x < HEADER_WIDTH ? "corner" : "ruler";
			if (hit.area === "ruler") {
				for (const marker of document.markers) {
					const markerX = this.timeToX(marker.time);
					if (System.Math.abs(x - markerX) <= MARKER_HALF_WIDTH + 2 && y >= RULER_HEIGHT - 18) {
						hit.area = "marker";
						hit.marker = marker;
						break;
					}
				}
			}
			return hit;
		}
		const laneY = y - RULER_HEIGHT;
		for (const row of this.#rowList) {
			if (laneY < row.y || laneY >= row.y + row.height) {
				continue;
			}
			hit.row = row;
			if (x < HEADER_WIDTH) {
				if (row.kind === "group") {
					hit.area = x < 24 ? "groupCaret" : "groupHeader";
				}
				else if (x >= HEADER_WIDTH - 28) {
					hit.area = "trackKeyButton";
				}
				else if (x < 40) {
					hit.area = "trackToggle";
				}
				else {
					hit.area = "trackHeader";
				}
				return hit;
			}
			if (row.kind === "group") {
				hit.area = "groupLane";
				return hit;
			}
			hit.area = "lane";
			const sortedKeys = row.track.keys.slice().sort((left, right) => right.time - left.time);
			for (const key of sortedKeys) {
				const keyX = this.timeToX(key.time);
				let keyY = row.y + System.Math.min(row.height / 2, TRACK_ROW_HEIGHT / 2);
				if (row.isCurveRow) {
					keyY = this.valueToY(row, System.Number(key.value));
				}
				const isEventKey = row.track.property === "event";
				const hitWidth = isEventKey ? 10 : KEY_HALF_SIZE + 2;
				const isInsideX = isEventKey ? (x >= keyX - 3 && x <= keyX + hitWidth) : System.Math.abs(x - keyX) <= hitWidth;
				if (isInsideX && System.Math.abs(laneY - keyY) <= 8) {
					hit.area = "key";
					hit.key = key;
					return hit;
				}
			}
			return hit;
		}
		hit.area = x < HEADER_WIDTH ? "headerEmpty" : "empty";
		return hit;
	}

	//==============================================================================
	// 포인터 누름.
	//==============================================================================
	handlePointerDown(pointerEvent) {
		const canvasRect = this.#canvasElement.getBoundingClientRect();
		const x = pointerEvent.clientX - canvasRect.left;
		const y = pointerEvent.clientY - canvasRect.top;
		this.#canvasElement.setPointerCapture(pointerEvent.pointerId);
		this.#delegate.focusPanel();

		// 가운데 단추 / Alt 끌기: 화면 이동.
		if (pointerEvent.button === 1 || (pointerEvent.button === 0 && pointerEvent.altKey)) {
			pointerEvent.preventDefault();
			this.#dragState = { kind: "pan", startX: x, startY: y, startScrollTime: this.#scrollTime, startScrollY: this.#scrollY };
			return;
		}
		if (pointerEvent.button !== 0) {
			return;
		}
		const hit = this.hitTest(x, y);
		switch (hit.area) {
			case "ruler": {
				this.#delegate.selectMarker(null);
				this.#delegate.setPlayhead(this.snapTime(hit.time), true);
				this.#dragState = { kind: "scrub" };
				break;
			}
			case "marker": {
				this.#delegate.selectMarker(hit.marker);
				this.#dragState = { kind: "marker", marker: hit.marker, startTime: hit.marker.time, startX: x, isMoved: false };
				break;
			}
			case "groupCaret": {
				this.toggleGroup(hit.row.nodeName);
				break;
			}
			case "groupHeader":
			case "groupLane": {
				this.#delegate.selectNode(hit.row.nodeName);
				break;
			}
			case "trackToggle": {
				this.#delegate.toggleTrackEnabled(hit.row.track);
				break;
			}
			case "trackKeyButton": {
				this.#delegate.addKeyAtPlayhead(hit.row.track);
				break;
			}
			case "trackHeader": {
				this.#delegate.selectTrack(hit.row.track);
				break;
			}
			case "key": {
				const selectedKeys = this.#delegate.getSelectedKeys();
				const isToggle = pointerEvent.shiftKey || pointerEvent.ctrlKey || pointerEvent.metaKey;
				let nextSelection;
				if (isToggle) {
					nextSelection = new System.Set(selectedKeys);
					if (nextSelection.has(hit.key)) {
						nextSelection.delete(hit.key);
					}
					else {
						nextSelection.add(hit.key);
					}
				}
				else if (selectedKeys.has(hit.key)) {
					nextSelection = new System.Set(selectedKeys);
				}
				else {
					nextSelection = new System.Set([hit.key]);
				}
				this.#delegate.setSelectedKeys(nextSelection, hit.row.track);
				if (nextSelection.has(hit.key)) {
					const originList = [];
					for (const key of nextSelection) {
						originList.push({ key: key, time: key.time, value: key.value });
					}
					this.#dragState = { kind: "keys", startX: x, startY: y, originList: originList, row: hit.row, isMoved: false, anchorKey: hit.key };
				}
				break;
			}
			case "lane":
			case "empty": {
				if (!(pointerEvent.shiftKey || pointerEvent.ctrlKey)) {
					this.#delegate.setSelectedKeys(new System.Set(), hit.row ? hit.row.track : null);
				}
				this.#dragState = { kind: "box", startX: x, startY: y, currentX: x, currentY: y, isAdditive: pointerEvent.shiftKey || pointerEvent.ctrlKey };
				break;
			}
			default: {
				break;
			}
		}
		this.requestDraw();
	}

	//==============================================================================
	// 포인터 이동.
	//==============================================================================
	handlePointerMove(pointerEvent) {
		const canvasRect = this.#canvasElement.getBoundingClientRect();
		const x = pointerEvent.clientX - canvasRect.left;
		const y = pointerEvent.clientY - canvasRect.top;
		if (!this.#dragState) {
			this.#hoverTime = x >= HEADER_WIDTH ? this.snapTime(this.xToTime(x)) : -1;
			const hit = this.hitTest(x, y);
			let cursor = "default";
			if (hit.area === "key" || hit.area === "marker") {
				cursor = "grab";
			}
			else if (hit.area === "ruler") {
				cursor = "col-resize";
			}
			else if (hit.area === "trackKeyButton" || hit.area === "trackToggle" || hit.area === "groupCaret") {
				cursor = "pointer";
			}
			this.#canvasElement.style.cursor = cursor;
			this.requestDraw();
			return;
		}
		const dragState = this.#dragState;
		switch (dragState.kind) {
			case "pan": {
				this.#scrollTime = System.Math.max(-0.5, dragState.startScrollTime - (x - dragState.startX) / this.#pixelsPerSecond);
				this.#scrollY = System.Math.max(0, dragState.startScrollY - (y - dragState.startY));
				break;
			}
			case "scrub": {
				this.#delegate.setPlayhead(this.snapTime(this.xToTime(x)), true);
				break;
			}
			case "marker": {
				if (!dragState.isMoved && System.Math.abs(x - dragState.startX) < DRAG_THRESHOLD) {
					return;
				}
				if (!dragState.isMoved) {
					dragState.isMoved = true;
					this.#delegate.beginEdit("Move Marker");
				}
				dragState.marker.time = this.snapTime(dragState.startTime + (x - dragState.startX) / this.#pixelsPerSecond);
				this.#delegate.onMarkersChanged();
				break;
			}
			case "keys": {
				if (!dragState.isMoved && System.Math.abs(x - dragState.startX) < DRAG_THRESHOLD && System.Math.abs(y - dragState.startY) < DRAG_THRESHOLD) {
					return;
				}
				if (!dragState.isMoved) {
					dragState.isMoved = true;
					this.#delegate.beginEdit("Move Keys");
				}
				const deltaTime = (x - dragState.startX) / this.#pixelsPerSecond;
				const anchorOrigin = dragState.originList.find((origin) => origin.key === dragState.anchorKey);
				const snappedAnchorTime = this.snapTime(anchorOrigin.time + deltaTime);
				const appliedDelta = snappedAnchorTime - anchorOrigin.time;
				const document = this.#delegate.getDocument();
				const duration = System.Math.max(0, System.Number(document.duration) || 0);
				for (const origin of dragState.originList) {
					origin.key.time = System.Math.max(0, System.Math.min(duration, origin.time + appliedDelta));
				}
				if (dragState.row.isCurveRow && !pointerEvent.shiftKey) {
					const valuePerPixel = (dragState.row.valueRange.maximum - dragState.row.valueRange.minimum) / (dragState.row.height - 24);
					const deltaValue = -(y - dragState.startY) * valuePerPixel;
					for (const origin of dragState.originList) {
						if (typeof origin.value === "number") {
							origin.key.value = System.Math.round((origin.value + deltaValue) * 1000) / 1000;
						}
					}
				}
				this.#delegate.onKeysChanged();
				break;
			}
			case "box": {
				dragState.currentX = x;
				dragState.currentY = y;
				break;
			}
			default: {
				break;
			}
		}
		this.requestDraw();
	}

	//==============================================================================
	// 포인터 뗌.
	//==============================================================================
	handlePointerUp(pointerEvent) {
		const dragState = this.#dragState;
		this.#dragState = null;
		if (!dragState) {
			return;
		}
		if (dragState.kind === "keys" || dragState.kind === "marker") {
			if (dragState.isMoved) {
				this.#delegate.endEdit();
			}
		}
		else if (dragState.kind === "box") {
			const left = System.Math.min(dragState.startX, dragState.currentX);
			const right = System.Math.max(dragState.startX, dragState.currentX);
			const top = System.Math.min(dragState.startY, dragState.currentY) - RULER_HEIGHT;
			const bottom = System.Math.max(dragState.startY, dragState.currentY) - RULER_HEIGHT;
			if (right - left >= DRAG_THRESHOLD || bottom - top >= DRAG_THRESHOLD) {
				const nextSelection = dragState.isAdditive ? new System.Set(this.#delegate.getSelectedKeys()) : new System.Set();
				let lastTrack = null;
				for (const row of this.#rowList) {
					if (row.kind !== "track" || row.y + row.height < top || row.y > bottom) {
						continue;
					}
					for (const key of row.track.keys) {
						const keyX = this.timeToX(key.time);
						const keyY = row.isCurveRow ? this.valueToY(row, System.Number(key.value)) : row.y + row.height / 2;
						if (keyX >= left && keyX <= right && keyY >= top && keyY <= bottom) {
							nextSelection.add(key);
							lastTrack = row.track;
						}
					}
				}
				this.#delegate.setSelectedKeys(nextSelection, lastTrack ? lastTrack : this.#delegate.getSelectedTrack());
			}
		}
		else if (dragState.kind === "scrub") {
			this.#delegate.setPlayhead(this.#delegate.getPlayhead(), false);
		}
		this.requestDraw();
	}

	//==============================================================================
	// 두 번 누름. (레인: 키 추가 / 눈금자: 마커 추가 / 묶음: 접기)
	//==============================================================================
	handleDoubleClick(mouseEvent) {
		const canvasRect = this.#canvasElement.getBoundingClientRect();
		const x = mouseEvent.clientX - canvasRect.left;
		const y = mouseEvent.clientY - canvasRect.top;
		const hit = this.hitTest(x, y);
		if (hit.area === "lane" && hit.row && hit.row.kind === "track") {
			this.#delegate.addKeyAt(hit.row.track, this.snapTime(hit.time));
		}
		else if (hit.area === "ruler") {
			this.#delegate.addMarkerAt(this.snapTime(hit.time));
		}
		else if (hit.area === "marker") {
			this.#delegate.renameMarker(hit.marker);
		}
		else if (hit.area === "groupHeader" || hit.area === "groupCaret") {
			this.toggleGroup(hit.row.nodeName);
		}
		else if (hit.area === "key") {
			this.#delegate.setPlayhead(hit.key.time, false);
		}
	}

	//==============================================================================
	// 휠. (Ctrl: 배율 / Shift: 가로 / 기본: 세로)
	//==============================================================================
	handleWheel(wheelEvent) {
		wheelEvent.preventDefault();
		const canvasRect = this.#canvasElement.getBoundingClientRect();
		const x = wheelEvent.clientX - canvasRect.left;
		if (wheelEvent.ctrlKey || wheelEvent.metaKey) {
			const anchorTime = this.xToTime(System.Math.max(HEADER_WIDTH, x));
			const zoomFactor = wheelEvent.deltaY < 0 ? 1.15 : 1 / 1.15;
			this.#pixelsPerSecond = System.Math.max(MINIMUM_PIXELS_PER_SECOND, System.Math.min(MAXIMUM_PIXELS_PER_SECOND, this.#pixelsPerSecond * zoomFactor));
			this.#scrollTime = anchorTime - (System.Math.max(HEADER_WIDTH, x) - HEADER_WIDTH) / this.#pixelsPerSecond;
		}
		else if (wheelEvent.shiftKey || System.Math.abs(wheelEvent.deltaX) > System.Math.abs(wheelEvent.deltaY)) {
			const delta = wheelEvent.shiftKey ? wheelEvent.deltaY : wheelEvent.deltaX;
			this.#scrollTime = System.Math.max(-0.5, this.#scrollTime + delta / this.#pixelsPerSecond);
		}
		else {
			this.#scrollY = System.Math.max(0, this.#scrollY + wheelEvent.deltaY);
		}
		this.requestDraw();
	}

	//==============================================================================
	// 오른쪽 단추 메뉴. (히트 정보를 편집기에 넘긴다)
	//==============================================================================
	handleContextMenu(mouseEvent) {
		const canvasRect = this.#canvasElement.getBoundingClientRect();
		const x = mouseEvent.clientX - canvasRect.left;
		const y = mouseEvent.clientY - canvasRect.top;
		const hit = this.hitTest(x, y);
		hit.time = this.snapTime(hit.time);
		if (hit.area === "key" && !this.#delegate.getSelectedKeys().has(hit.key)) {
			this.#delegate.setSelectedKeys(new System.Set([hit.key]), hit.row.track);
		}
		else if ((hit.area === "trackHeader" || hit.area === "lane") && hit.row && hit.row.kind === "track") {
			if (this.#delegate.getSelectedTrack() !== hit.row.track) {
				this.#delegate.selectTrack(hit.row.track);
			}
		}
		else if (hit.area === "marker") {
			this.#delegate.selectMarker(hit.marker);
		}
		this.#delegate.openTimelineContextMenu(hit, mouseEvent.clientX, mouseEvent.clientY);
		this.requestDraw();
	}

	//==============================================================================
	// 묶음 접기 / 펼치기.
	//==============================================================================
	/**
	 * @param { string } nodeName
	 */
	toggleGroup(nodeName) {
		if (this.#collapsedNodeSet.has(nodeName)) {
			this.#collapsedNodeSet.delete(nodeName);
		}
		else {
			this.#collapsedNodeSet.add(nodeName);
		}
		this.requestDraw();
	}

	//==============================================================================
	// 전체 길이를 화면에 맞춤.
	//==============================================================================
	zoomToFit() {
		const document = this.#delegate.getDocument();
		const duration = System.Math.max(0.5, System.Number(document.duration) || 1);
		const devicePixelRatio = System.window.devicePixelRatio || 1;
		const laneWidth = System.Math.max(100, this.#canvasElement.width / devicePixelRatio - HEADER_WIDTH - 40);
		this.#pixelsPerSecond = System.Math.max(MINIMUM_PIXELS_PER_SECOND, System.Math.min(MAXIMUM_PIXELS_PER_SECOND, laneWidth / duration));
		this.#scrollTime = -20 / this.#pixelsPerSecond;
		this.#scrollY = 0;
		this.requestDraw();
	}

	//==============================================================================
	// 트랙 줄이 보이도록 세로 이동.
	//==============================================================================
	/**
	 * @param { object } track
	 */
	ensureTrackVisible(track) {
		this.buildRowList();
		const row = this.#rowList.find((otherRow) => otherRow.kind === "track" && otherRow.track === track);
		if (!row) {
			return;
		}
		const devicePixelRatio = System.window.devicePixelRatio || 1;
		const laneHeight = this.#canvasElement.height / devicePixelRatio - RULER_HEIGHT;
		if (row.y < this.#scrollY) {
			this.#scrollY = row.y;
		}
		else if (row.y + row.height > this.#scrollY + laneHeight) {
			this.#scrollY = System.Math.max(0, row.y + row.height - laneHeight);
		}
		this.requestDraw();
	}

	//==============================================================================
	// 재생 헤드가 보이도록 가로 이동. (재생 중 따라가기)
	//==============================================================================
	/**
	 * @param { number } time
	 */
	ensureTimeVisible(time) {
		const devicePixelRatio = System.window.devicePixelRatio || 1;
		const width = this.#canvasElement.width / devicePixelRatio;
		const x = this.timeToX(time);
		if (x > width - 20) {
			this.#scrollTime = time - (width - HEADER_WIDTH) * 0.15 / this.#pixelsPerSecond;
		}
		else if (x < HEADER_WIDTH) {
			this.#scrollTime = time - 20 / this.#pixelsPerSecond;
		}
	}

	//==============================================================================
	// 배율 반환 / 헤더 폭 반환. (정적 상수 노출)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getPixelsPerSecond() {
		return this.#pixelsPerSecond;
	}

	/**
	 * @returns { HTMLCanvasElement }
	 */
	getCanvasElement() {
		return this.#canvasElement;
	}
}
