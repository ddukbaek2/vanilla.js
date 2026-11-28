//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Color } from "../base/color.js";
import { Vector2 } from "../base/vector2.js";
import { Pivot } from "../base/pivot.js";
import { Rect } from "../base/rect.js";
import { Tween } from "../core/tween.js";
import { WorldNode } from "../core/node/worldnode.js";
import { Paint } from "../core/component/paint.js";
import { Text } from "../core/component/text.js";
import { ParticleSystem } from "../effect/particlesystem.js";
import { ShaderSprite, ShaderSpriteEffect } from "../effect/shadersprite.js";
import { AudioAsset } from "../resource/audioasset.js";


// 자료 속 방향 이름("in", "out", "inOut")과 트윈 함수 이름(easeIn, easeOut, easeInOut)의 짝. (자료 꼴은 그대로 둔다)
const TIMELINE_EASING_DIRECTION_FUNCTION_NAMES = { in: "easeIn", out: "easeOut", inOut: "easeInOut" };


//==============================================================================
// 이징 이름 목록. ("linear" / "step" / "bezier" / "<종류>.<in|out|inOut>")
//==============================================================================
export const TIMELINE_EASING_NAMES = (() => {
	const nameList = ["linear", "step", "bezier"];
	for (const familyName of ["quadratic", "cubic", "quartic", "quintic", "sinusoidal", "exponential", "circular", "elastic", "back", "bounce"]) {
		nameList.push(familyName + ".in");
		nameList.push(familyName + ".out");
		nameList.push(familyName + ".inOut");
	}
	return nameList;
})();


//==============================================================================
// 3차 베지어 이징 생성. (CSS cubic-bezier 와 같은 제어점, x 는 0 ~ 1)
//==============================================================================
/**
 * @param { number } x1 첫 제어점 x. (0 ~ 1 로 자른다)
 * @param { number } y1 첫 제어점 y.
 * @param { number } x2 둘째 제어점 x. (0 ~ 1 로 자른다)
 * @param { number } y2 둘째 제어점 y.
 * @returns { Function } 0 ~ 1 진행률을 받아 이징한 값을 돌려주는 함수.
 */
export function createBezierEasing(x1, y1, x2, y2) {
	const clampedX1 = System.Math.max(0, System.Math.min(1, x1));
	const clampedX2 = System.Math.max(0, System.Math.min(1, x2));
	const sampleCurve = (t, p1, p2) => {
		const oneMinus = 1 - t;
		return 3 * oneMinus * oneMinus * t * p1 + 3 * oneMinus * t * t * p2 + t * t * t;
	};
	const sampleDerivative = (t, p1, p2) => {
		const oneMinus = 1 - t;
		return 3 * oneMinus * oneMinus * p1 + 6 * oneMinus * t * (p2 - p1) + 3 * t * t * (1 - p2);
	};
	return (progress) => {
		if (progress <= 0) {
			return 0;
		}
		if (progress >= 1) {
			return 1;
		}
		let t = progress;
		for (let iteration = 0; iteration < 8; ++iteration) {
			const error = sampleCurve(t, clampedX1, clampedX2) - progress;
			if (System.Math.abs(error) < 0.00001) {
				break;
			}
			const derivative = sampleDerivative(t, clampedX1, clampedX2);
			if (System.Math.abs(derivative) < 0.000001) {
				break;
			}
			t -= error / derivative;
			t = System.Math.max(0, System.Math.min(1, t));
		}
		return sampleCurve(t, y1, y2);
	};
}


//==============================================================================
// 이징 함수 반환. (모르는 이름은 linear, "bezier" 는 curve [x1, y1, x2, y2] 를 쓴다)
//==============================================================================
/**
 * @param { string } easingName 이징 이름. (TIMELINE_EASING_NAMES 가운데, 비었으면 linear)
 * @param { number[] | null } curve "bezier" 의 [x1, y1, x2, y2]. (넷이 안 되면 [0.42, 0, 0.58, 1])
 * @returns { Function } 0 ~ 1 진행률을 받아 이징한 값을 돌려주는 함수.
 * @example <caption>이름과 제어점으로 이징 얻기</caption>
 * import { resolveTimelineEasing, createBezierEasing } from "./build/vanilla.js";
 *
 * const bounceOut = resolveTimelineEasing("bounce.out");
 * const customCurve = resolveTimelineEasing("bezier", [0.25, 0.1, 0.25, 1]);
 * const easeInOut = createBezierEasing(0.42, 0, 0.58, 1);
 * console.log(bounceOut(0.5), customCurve(0.5), easeInOut(0.25));
 */
export function resolveTimelineEasing(easingName, curve = null) {
	if (!easingName || easingName === "linear") {
		return Tween.easingFunction.linear;
	}
	if (easingName === "step") {
		return (progress) => 0;
	}
	if (easingName === "bezier") {
		const controlPoints = System.Array.isArray(curve) && curve.length >= 4 ? curve : [0.42, 0, 0.58, 1];
		return createBezierEasing(controlPoints[0], controlPoints[1], controlPoints[2], controlPoints[3]);
	}
	const separatorIndex = easingName.indexOf(".");
	if (separatorIndex < 0) {
		return Tween.easingFunction.linear;
	}
	const familyName = easingName.substring(0, separatorIndex);
	const directionName = easingName.substring(separatorIndex + 1);
	const family = Tween.easingFunction[familyName];
	const functionName = TIMELINE_EASING_DIRECTION_FUNCTION_NAMES[directionName];
	if (!family || !functionName || typeof family[functionName] !== "function") {
		return Tween.easingFunction.linear;
	}
	return family[functionName];
}


//==============================================================================
// 색 문자열 ↔ 채널.
//==============================================================================
/**
 * @param { string } hexText - "#rrggbb" 또는 "#rrggbbaa"
 * @returns { number[] } 0 ~ 1 의 [빨강, 초록, 파랑, 알파]. (읽지 못한 채널은 1)
 */
export function parseTimelineColor(hexText) {
	const text = (typeof hexText === "string" && hexText.startsWith("#")) ? hexText.substring(1) : "ffffff";
	const red = System.parseInt(text.substring(0, 2), 16) / 255;
	const green = System.parseInt(text.substring(2, 4), 16) / 255;
	const blue = System.parseInt(text.substring(4, 6), 16) / 255;
	const alpha = text.length >= 8 ? System.parseInt(text.substring(6, 8), 16) / 255 : 1;
	return [
		System.Number.isFinite(red) ? red : 1,
		System.Number.isFinite(green) ? green : 1,
		System.Number.isFinite(blue) ? blue : 1,
		System.Number.isFinite(alpha) ? alpha : 1,
	];
}

//==============================================================================
// 채널을 색 문자열로. ("#rrggbbaa")
//==============================================================================
/**
 * @param { number[] } channels 0 ~ 1 의 [빨강, 초록, 파랑, 알파]. (0 ~ 1 로 자르고, 알파가 없으면 1)
 * @returns { string } "#rrggbbaa" 색 문자열.
 */
export function composeTimelineColor(channels) {
	const toByte = (value) => System.Math.round(System.Math.max(0, System.Math.min(1, value)) * 255).toString(16).padStart(2, "0");
	return "#" + toByte(channels[0]) + toByte(channels[1]) + toByte(channels[2]) + toByte(channels[3] === undefined ? 1 : channels[3]);
}

//==============================================================================
// 색 문자열로 Color 만들기.
//==============================================================================
/**
 * @param { string } hexText
 * @returns { Color }
 */
function createColorFromText(hexText) {
	const channels = parseTimelineColor(hexText);
	return new Color(channels[0], channels[1], channels[2], channels[3]);
}


//==============================================================================
// 노드에서 색을 받는 컴포넌트 찾기. (Text → 글자색 / Paint, Sprite → 색)
//==============================================================================
/**
 * @param { WorldNode } node
 * @param { string } hexText
 */
function applyNodeColor(node, hexText) {
	const textComponent = node.getComponent(Text);
	if (textComponent) {
		textComponent.setTextColor(createColorFromText(hexText));
		return;
	}
	const paintComponent = node.getComponent(Paint);
	if (paintComponent) {
		paintComponent.setColor(createColorFromText(hexText));
	}
}


//==============================================================================
// 애니메이션 속성 정의. (이름 → 종류 / 적용 함수)
// - kind: "number" 는 이징 보간, "color" 는 채널 보간, "string" / "boolean" 은 계단.
//==============================================================================
export const TIMELINE_PROPERTY_DEFINITIONS = {
	x: { kind: "number", label: "X", apply: (node, value) => {
		const localPosition = node.getLocalPosition();
		node.setLocalPosition(Vector2.create(value, localPosition.y));
	} },
	y: { kind: "number", label: "Y", apply: (node, value) => {
		const localPosition = node.getLocalPosition();
		node.setLocalPosition(Vector2.create(localPosition.x, value));
	} },
	width: { kind: "number", label: "Width", apply: (node, value) => {
		const contentSize = node.getContentSize();
		node.setContentSize(Vector2.create(value, contentSize.y));
	} },
	height: { kind: "number", label: "Height", apply: (node, value) => {
		const contentSize = node.getContentSize();
		node.setContentSize(Vector2.create(contentSize.x, value));
	} },
	scaleX: { kind: "number", label: "Scale X", apply: (node, value) => {
		const localScale = node.getLocalScale();
		node.setLocalScale(Vector2.create(value, localScale.y));
	} },
	scaleY: { kind: "number", label: "Scale Y", apply: (node, value) => {
		const localScale = node.getLocalScale();
		node.setLocalScale(Vector2.create(localScale.x, value));
	} },
	rotation: { kind: "number", label: "Rotation", apply: (node, value) => {
		node.setLocalRotation(value);
	} },
	opacity: { kind: "number", label: "Opacity", apply: (node, value) => {
		node.setLocalOpacity(System.Math.max(0, System.Math.min(1, value)));
	} },
	visible: { kind: "boolean", label: "Visible", apply: (node, value) => {
		node.setActive(value === true || value === "true");
	} },
	color: { kind: "color", label: "Color", apply: (node, value) => {
		applyNodeColor(node, value);
	} },
	text: { kind: "string", label: "Text", apply: (node, value) => {
		const textComponent = node.getComponent(Text);
		if (textComponent) {
			textComponent.setText(String(value));
		}
	} },
	number: { kind: "number", label: "Number", apply: (node, value) => {
		const textComponent = node.getComponent(Text);
		if (textComponent) {
			textComponent.setText(String(System.Math.round(value)));
		}
	} },
	fontSize: { kind: "number", label: "Font Size", apply: (node, value) => {
		const textComponent = node.getComponent(Text);
		if (textComponent) {
			// 글자 텍스처는 (문자열, 폰트) 조합마다 굽히므로 정수 픽셀로 맞춰 매 프레임 재굽기를 막는다.
			textComponent.setFontSize(System.Math.round(value));
		}
	} },
	visibleCharacters: { kind: "number", label: "Visible Characters", apply: (node, value) => {
		const textComponent = node.getComponent(Text);
		if (textComponent) {
			textComponent.setVisibleCharacterCount(System.Math.round(value));
		}
	} },
	frame: { kind: "number", label: "Frame", apply: (node, value) => {
		const sprite = node.getComponent(ShaderSprite);
		if (sprite) {
			applySpriteFrame(sprite, System.Math.round(value));
		}
	} },
	effect: { kind: "number", label: "Effect Progress", apply: (node, value) => {
		const sprite = node.getComponent(ShaderSprite);
		if (sprite) {
			sprite.setEffectProgress(value);
		}
	} },
	event: { kind: "string", label: "Event", apply: null },
};


//==============================================================================
// 스프라이트 시트 격자 표. (스프라이트 → { columns, rows }, 노드 서술의 frameColumns / frameRows)
//==============================================================================
const spriteFrameGridTable = new System.WeakMap();

// 사운드 노드 표. (노드 → { audioPlayer, audioAsset, audioSource, volume }) 와 오디오 매니저. (한 페이지에 엔진 하나)
const soundPlayerTable = new System.WeakMap();
let timelineAudioManager = null;


//==============================================================================
// 스프라이트 시트 프레임 적용. (격자로 잘라 imageRect 를 고른다)
//==============================================================================
/**
 * @param { ShaderSprite } sprite
 * @param { number } frameIndex
 */
function applySpriteFrame(sprite, frameIndex) {
	const image = sprite.getImage();
	const frameGrid = spriteFrameGridTable.get(sprite);
	const gridColumns = frameGrid ? frameGrid.columns : 1;
	const gridRows = frameGrid ? frameGrid.rows : 1;
	if (!image || (gridColumns <= 1 && gridRows <= 1)) {
		return;
	}
	const frameCount = gridColumns * gridRows;
	const wrappedIndex = ((frameIndex % frameCount) + frameCount) % frameCount;
	const frameWidth = image.width / gridColumns;
	const frameHeight = image.height / gridRows;
	const column = wrappedIndex % gridColumns;
	const row = System.Math.floor(wrappedIndex / gridColumns);
	sprite.setImageRect(Rect.create(column * frameWidth, row * frameHeight, frameWidth, frameHeight));
}


//==============================================================================
// 값 보간. (종류별)
//==============================================================================
/**
 * @param { string } kind
 * @param { * } fromValue
 * @param { * } toValue
 * @param { number } easedProgress
 * @returns { * }
 */
function interpolateValue(kind, fromValue, toValue, easedProgress) {
	if (kind === "number") {
		return fromValue + (toValue - fromValue) * easedProgress;
	}
	if (kind === "color") {
		const fromChannels = parseTimelineColor(fromValue);
		const toChannels = parseTimelineColor(toValue);
		const mixedChannels = [0, 0, 0, 0];
		for (let channelIndex = 0; channelIndex < 4; ++channelIndex) {
			mixedChannels[channelIndex] = fromChannels[channelIndex] + (toChannels[channelIndex] - fromChannels[channelIndex]) * easedProgress;
		}
		return composeTimelineColor(mixedChannels);
	}
	return fromValue;
}


//==============================================================================
// 서술 노드 기본값.
//==============================================================================
export const TIMELINE_NODE_DEFAULTS = {
	type: "group",
	parent: null,
	x: 0,
	y: 0,
	width: 100,
	height: 100,
	scaleX: 1,
	scaleY: 1,
	rotation: 0,
	opacity: 1,
	pivotX: 0.5,
	pivotY: 0.5,
	visible: true,
	color: "#ffffffff",
	roundSize: 0,
	image: "",
	frameColumns: 1,
	frameRows: 1,
	frame: 0,
	effect: "none",
	effectProgress: 0,
	effectColor: "",
	blendMode: "source-over",
	text: "Text",
	fontSize: 32,
	bold: false,
	textAlign: "center",
	particle: null,
	audio: "",
	volume: 1,
};


//==============================================================================
// 타임라인.
// - 문서(서술)는 무대 노드 목록 + 트랙(대상 이름 / 속성 / 키) + 마커로 이루어진 JSON 이며 타임라인 편집기가 저장한다.
// - buildStage() 로 무대 노드를 만들거나, bind() 로 기존 노드 트리에 이름으로 붙인다.
// - 키의 easing 은 그 키에서 다음 키까지 구간에 적용된다.
// - 사용:
//     const timeline = await Timeline.loadFromUrl("./assets/intro.timeline.json");
//     timeline.buildStage(stageNode, (imageName) => imageTable[imageName]);
//     timeline.play();
//     // 매 프레임: timeline.tick(timeDelta);
//==============================================================================
// 파티클 시드. (수집 차례로 서로 다른 시드를 준다)
const PARTICLE_RANDOM_SEED_BASE = 0x9E3779B1;
const PARTICLE_RANDOM_SEED_STEP = 7919;

/**
 * @example <caption>문서를 읽어 무대를 짓고 재생하기</caption>
 * import { Engine, EngineConfiguration, Scene, Timeline, Vector2 } from "./build/vanilla.js";
 *
 * const emblemImage = new Image();
 * emblemImage.src = "examples/timelineshowcase/assets/emblem.png";
 * await emblemImage.decode();
 * const timeline = await Timeline.loadFromUrl("examples/timelineshowcase/assets/logo.timeline.json");
 * timeline.setMarkerHandler((markerName) => {
 * 	console.log("marker", markerName);
 * });
 *
 * class TimelineScene extends Scene {
 * 	async load(engine) {
 * 		await super.load(engine);
 * 		const root = this.getRoot();
 * 		timeline.buildStage(root, (imageName) => {
 * 			return imageName === "emblem.png" ? emblemImage : null;
 * 		});
 * 		timeline.play();
 * 	}
 *
 * 	tick(timeDelta) {
 * 		super.tick(timeDelta);
 * 		timeline.tick(timeDelta);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.referenceResolutionSize = Vector2.create(960, 540);
 * const engine = new Engine(engineConfiguration);
 * engine.run(new TimelineScene());
 * @exampleImage timeline.webp
 */
export class Timeline extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object } */ #description;
	/** @private @type { object[] } */ #compiledTracks;
	/** @private @type { object[] } */ #compiledMarkers;
	/** @private @type { System.Map } */ #targetTable;
	/** @private @type { Function | null } */ #targetResolver;
	/** @private @type { Function | null } */ #eventHandler;
	/** @private @type { Function | null } */ #markerHandler;
	/** @private @type { Function | null } */ #completeHandler;
	/** @private @type { number } */ #time;
	/** @private @type { number } */ #speed;
	/** @private @type { boolean } */ #isPlaying;
	/** @private @type { boolean } */ #isDirty;
	/** @private @type { ParticleSystem[] } */ #particleSystems; // 타임라인 시간으로 진행하는 파티클. (대상 노드에서 모은다)
	/** @private @type { System.Set } */ #particleFreeRunSet; // 이벤트 트랙이 없는 파티클. (타임라인이 시작하면 바로 도는 것으로 본다)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { object | null } description 타임라인 문서. (null 이면 createEmptyDescription 의 빈 문서)
	 */
	constructor(description = null) {
		super();
		this.#description = null;
		this.#compiledTracks = [];
		this.#compiledMarkers = [];
		this.#targetTable = new System.Map();
		this.#targetResolver = null;
		this.#eventHandler = null;
		this.#markerHandler = null;
		this.#completeHandler = null;
		this.#time = 0;
		this.#speed = 1;
		this.#isPlaying = false;
		this.#isDirty = true;
		this.#particleSystems = [];
		this.#particleFreeRunSet = new System.Set();
		this.setDescription(description ? description : Timeline.createEmptyDescription());
	}

	//==============================================================================
	// 빈 서술 생성. (정적)
	//==============================================================================
	/**
	 * @returns { object } 빈 타임라인 문서. (3 초, 30 프레임, 반복, 960x540 무대)
	 */
	static createEmptyDescription() {
		return {
			name: "Timeline",
			duration: 3,
			frameRate: 30,
			loop: true,
			stage: { width: 960, height: 540, backgroundColor: "#101114ff", nodes: [] },
			tracks: [],
			markers: [],
		};
	}

	//==============================================================================
	// 주소에서 읽기. (정적)
	//==============================================================================
	/**
	 * @param { string } url 타임라인 문서(*.timeline.json) 주소.
	 * @returns { Promise<Timeline> } 읽은 문서로 만든 타임라인. (실패 응답(404 등)이나 JSON 이 아니면 거부된다)
	 */
	static async loadFromUrl(url) {
		const response = await System.fetch(url);
		// 실패 응답(404 등)은 받지 못한 것으로 친다.
		if (!response.ok) {
			throw new System.Error(`Timeline: HTTP ${response.status}: ${url}`);
		}
		const description = await response.json();
		return new Timeline(description);
	}

	//==============================================================================
	// JSON 글에서 만들기. (정적)
	//==============================================================================
	/**
	 * @param { string } text 타임라인 문서 JSON 글.
	 * @returns { Timeline } 만든 타임라인.
	 */
	static loadFromText(text) {
		const description = System.JSON.parse(text);
		return new Timeline(description);
	}

	//==============================================================================
	// 읽은 JsonAsset 에서 만들기. (정적, 아직 안 읽혔거나 실패했으면 null. 문서는 복사해 쓴다)
	//==============================================================================
	/**
	 * @param { JsonAsset } jsonAsset 타임라인 문서를 읽은 JsonAsset.
	 * @returns { Timeline | null } 만든 타임라인. 아직 안 읽혔거나 실패했으면 null.
	 * @example <caption>JsonAsset 으로 읽은 문서에서 만들기</caption>
	 * import { JsonAsset, Timeline } from "./build/vanilla.js";
	 *
	 * const jsonAsset = new JsonAsset();
	 * await jsonAsset.load("examples/timelineshowcase/assets/title.timeline.json");
	 * const timeline = Timeline.createFromJsonAsset(jsonAsset);
	 * console.log(timeline.getDuration(), timeline.getFrameRate(), timeline.isLoop());
	 */
	static createFromJsonAsset(jsonAsset) {
		const isLoaded = jsonAsset.isLoaded();
		if (!isLoaded || !jsonAsset.data) {
			return null;
		}
		const description = System.structuredClone(jsonAsset.data);
		return new Timeline(description);
	}

	//==============================================================================
	// 서술 설정. (참조를 그대로 쓴다, 편집기가 고친 뒤 invalidate() 로 다시 컴파일)
	//==============================================================================
	/**
	 * @param { object } description 타임라인 문서. (빠진 stage, tracks, markers 는 채워 넣는다)
	 */
	setDescription(description) {
		this.#description = description;
		if (!this.#description.stage) {
			this.#description.stage = { width: 960, height: 540, backgroundColor: "#101114ff", nodes: [] };
		}
		if (!System.Array.isArray(this.#description.stage.nodes)) {
			this.#description.stage.nodes = [];
		}
		if (!System.Array.isArray(this.#description.tracks)) {
			this.#description.tracks = [];
		}
		if (!System.Array.isArray(this.#description.markers)) {
			this.#description.markers = [];
		}
		this.invalidate();
	}

	//==============================================================================
	// 서술 반환.
	//==============================================================================
	/**
	 * @returns { object } 타임라인 문서. (복사본이 아니다)
	 */
	getDescription() {
		return this.#description;
	}

	//==============================================================================
	// 다시 컴파일 요청. (트랙 / 키가 바뀌었을 때)
	//==============================================================================
	invalidate() {
		this.#isDirty = true;
	}

	//==============================================================================
	// 컴파일. (키를 시간순으로 정렬하고 대상 / 속성 정의를 붙인다)
	//==============================================================================
	compile() {
		this.#compiledTracks = [];
		for (const track of this.#description.tracks) {
			const definition = TIMELINE_PROPERTY_DEFINITIONS[track.property];
			const keys = System.Array.isArray(track.keys) ? track.keys.slice() : [];
			keys.sort((left, right) => left.time - right.time);
			const target = this.resolveTarget(track.target);
			const kind = definition ? definition.kind : (typeof (keys.length > 0 ? keys[0].value : 0) === "number" ? "number" : "string");
			this.#compiledTracks.push({ track: track, keys: keys, definition: definition, kind: kind, target: target });
		}
		this.#compiledMarkers = this.#description.markers.slice();
		this.#compiledMarkers.sort((left, right) => left.time - right.time);
		this.#isDirty = false;
		this.collectParticleSystems();
	}

	//==============================================================================
	// 대상 노드의 파티클 시스템 수집. (수동 틱으로 바꿔 타임라인 시간으로만 진행하고, 시드를 줘서 되감을 때마다 같은 결과가 나오게 한다)
	//==============================================================================
	collectParticleSystems() {
		this.#particleSystems = [];
		this.#particleFreeRunSet = new System.Set();
		const eventTargetSet = new System.Set();
		for (const compiledTrack of this.#compiledTracks) {
			if (compiledTrack.track.property === "event" && compiledTrack.target) {
				eventTargetSet.add(compiledTrack.target);
			}
		}
		for (const target of this.#targetTable.values()) {
			if (!target || typeof target.getComponent !== "function") {
				continue;
			}
			const particleSystem = target.getComponent(ParticleSystem);
			if (particleSystem && !this.#particleSystems.includes(particleSystem)) {
				particleSystem.setManualTick(true);
				const randomSeed = particleSystem.getRandomSeed();
				if (randomSeed === null) {
					particleSystem.setRandomSeed(PARTICLE_RANDOM_SEED_BASE + this.#particleSystems.length * PARTICLE_RANDOM_SEED_STEP);
				}
				if (!eventTargetSet.has(target)) {
					this.#particleFreeRunSet.add(particleSystem);
				}
				this.#particleSystems.push(particleSystem);
			}
		}
	}

	//==============================================================================
	// 파티클 시간 진행. (재생 중 매 프레임)
	//==============================================================================
	/**
	 * @param { number } timeDelta 흘릴 시간. (초, 0 이하이면 아무것도 하지 않는다)
	 */
	simulateParticles(timeDelta) {
		if (timeDelta <= 0) {
			return;
		}
		for (const particleSystem of this.#particleSystems) {
			particleSystem.simulate(timeDelta);
		}
	}

	//==============================================================================
	// 파티클 재시뮬레이션. (스크럽 / 되감기, 비운 뒤 0초부터 이벤트를 다시 밟으며 진행)
	//==============================================================================
	/**
	 * @param { number } time 맞출 타임라인 시간. (초)
	 */
	resimulateParticles(time) {
		if (this.#isDirty) {
			this.compile();
		}
		if (this.#particleSystems.length === 0) {
			return;
		}
		for (const particleSystem of this.#particleSystems) {
			particleSystem.stop(true);
		}
		for (const particleSystem of this.#particleFreeRunSet) {
			particleSystem.play();
		}
		// 파티클 대상 이벤트 키를 시간순으로 모은다.
		const eventList = [];
		for (const compiledTrack of this.#compiledTracks) {
			if (compiledTrack.track.property !== "event" || compiledTrack.track.enabled === false) {
				continue;
			}
			const target = compiledTrack.target;
			if (!target || typeof target.getComponent !== "function" || !target.getComponent(ParticleSystem)) {
				continue;
			}
			for (const key of compiledTrack.keys) {
				if (key.time <= time) {
					eventList.push({ time: key.time, compiledTrack: compiledTrack, key: key });
				}
			}
		}
		eventList.sort((left, right) => left.time - right.time);
		const stepSeconds = System.Math.max(1 / 60, time / 600);
		let currentTime = 0;
		const advanceTo = (targetTime) => {
			while (currentTime < targetTime - 0.000001) {
				const stepDelta = System.Math.min(stepSeconds, targetTime - currentTime);
				this.simulateParticles(stepDelta);
				currentTime += stepDelta;
			}
		};
		for (const eventEntry of eventList) {
			advanceTo(eventEntry.time);
			this.dispatchEvent(eventEntry.compiledTrack, eventEntry.key, true);
		}
		advanceTo(time);
	}

	//==============================================================================
	// 대상 해석. (무대 노드 표 → 사용자 해석기)
	//==============================================================================
	/**
	 * @param { string } targetName 트랙의 대상 이름.
	 * @returns { object | null } 찾은 대상. 없으면 null.
	 */
	resolveTarget(targetName) {
		if (this.#targetTable.has(targetName)) {
			return this.#targetTable.get(targetName);
		}
		if (this.#targetResolver) {
			const resolvedTarget = this.#targetResolver(targetName);
			if (resolvedTarget) {
				return resolvedTarget;
			}
		}
		return null;
	}

	//==============================================================================
	// 대상 해석기 설정. (이름 → 객체. 노드가 아니어도 setTimelineProperty(이름, 값) 이 있으면 된다)
	//==============================================================================
	/**
	 * @param { Function | null } targetResolver 대상 이름을 받아 객체를 돌려주는 함수. (null 이면 끈다)
	 */
	setTargetResolver(targetResolver) {
		this.#targetResolver = targetResolver;
		this.invalidate();
	}

	//==============================================================================
	// 대상 직접 등록.
	//==============================================================================
	/**
	 * @param { string } targetName 트랙의 대상 이름.
	 * @param { object } target 노드, 또는 setTimelineProperty(이름, 값) 이 있는 객체.
	 * @example <caption>노드가 아닌 객체에 트랙 걸기</caption>
	 * import { Timeline } from "./build/vanilla.js";
	 *
	 * const description = Timeline.createEmptyDescription();
	 * description.duration = 2;
	 * description.loop = false;
	 * description.tracks.push({
	 * 	target: "meter",
	 * 	property: "level",
	 * 	keys: [
	 * 		{ time: 0, value: 0, easing: "quadratic.out" },
	 * 		{ time: 2, value: 100 }
	 * 	]
	 * });
	 * const timeline = new Timeline(description);
	 * const meter = { level: 0 };
	 * meter.setTimelineProperty = (name, value) => {
	 * 	meter[name] = value;
	 * };
	 * timeline.setTarget("meter", meter);
	 * timeline.seek(1);
	 * console.log(timeline.getTime(), meter.level);
	 */
	setTarget(targetName, target) {
		this.#targetTable.set(targetName, target);
		this.invalidate();
	}

	//==============================================================================
	// 대상 반환.
	//==============================================================================
	/**
	 * @param { string } targetName 트랙의 대상 이름.
	 * @returns { object | null } 등록된 대상. 없으면 null. (해석기는 보지 않는다)
	 */
	getTarget(targetName) {
		return this.#targetTable.has(targetName) ? this.#targetTable.get(targetName) : null;
	}

	//==============================================================================
	// 노드 트리에 이름으로 붙이기. (무대를 직접 만든 경우)
	//==============================================================================
	/**
	 * @param { WorldNode } rootNode 이름으로 찾을 노드 트리의 뿌리. (뿌리 자신도 본다. 이미 등록된 이름은 건너뛴다)
	 */
	bind(rootNode) {
		for (const track of this.#description.tracks) {
			if (this.#targetTable.has(track.target)) {
				continue;
			}
			const foundNode = rootNode.getName() === track.target ? rootNode : rootNode.findChildRecursiveByName(track.target);
			if (foundNode) {
				this.#targetTable.set(track.target, foundNode);
			}
		}
		this.invalidate();
	}

	//==============================================================================
	// 무대 노드 생성. (서술의 stage.nodes 를 노드 트리로 만들고 대상으로 등록)
	// - 같은 이름의 노드가 둘이면 모두 붙이고, 이름 표에는 뒤의 것이 남는다.
	// - 부모가 자기 자신이거나 고리가 되면 parentNode 에 붙인다.
	//==============================================================================
	/**
	 * @param { WorldNode } parentNode 무대 노드를 붙일 부모 노드. (서술에 부모가 없는 노드가 여기 붙는다)
	 * @param { Function | null } imageResolver - (이미지 이름) → HTMLImageElement | HTMLCanvasElement | null
	 * @returns { System.Map } 이름 → 노드
	 */
	buildStage(parentNode, imageResolver = null) {
		const nodeTable = new System.Map();
		const nodeDescriptions = this.#description.stage.nodes;
		const createdList = [];
		for (const nodeDescription of nodeDescriptions) {
			const node = Timeline.createStageNode(nodeDescription, imageResolver);
			nodeTable.set(nodeDescription.name, node);
			this.#targetTable.set(nodeDescription.name, node);
			createdList.push({ node: node, parentName: nodeDescription.parent });
		}
		for (const createdEntry of createdList) {
			const node = createdEntry.node;
			const parentDescriptionNode = createdEntry.parentName ? nodeTable.get(createdEntry.parentName) : null;
			const isCycle = parentDescriptionNode ? Timeline.isAncestorOrSelf(node, parentDescriptionNode) : false;
			if (parentDescriptionNode && !isCycle) {
				parentDescriptionNode.addChild(node);
			}
			else {
				parentNode.addChild(node);
			}
		}
		this.invalidate();
		return nodeTable;
	}

	//==============================================================================
	// ancestorNode 가 node 자신이거나 그 조상인지. (정적)
	//==============================================================================
	/**
	 * @param { WorldNode } ancestorNode 조상인지 볼 노드.
	 * @param { WorldNode } node 부모를 거슬러 올라갈 노드.
	 * @returns { boolean } ancestorNode 가 node 자신이거나 그 조상이면 참.
	 */
	static isAncestorOrSelf(ancestorNode, node) {
		let currentNode = node;
		while (currentNode) {
			if (currentNode === ancestorNode) {
				return true;
			}
			currentNode = currentNode.getParent();
		}
		return false;
	}

	//==============================================================================
	// 무대 노드 한 개 생성. (정적)
	//==============================================================================
	/**
	 * @param { object } nodeDescription 무대 노드 서술. (빠진 값은 TIMELINE_NODE_DEFAULTS 로 채운다)
	 * @param { Function | null } imageResolver 이미지 이름을 받아 그림을 돌려주는 함수. (없거나 null 을 돌려주면 data: 주소만 스스로 읽는다)
	 * @returns { WorldNode } 서술의 이름을 단 새 노드.
	 */
	static createStageNode(nodeDescription, imageResolver = null) {
		const description = System.Object.assign({}, TIMELINE_NODE_DEFAULTS, nodeDescription);
		const node = new WorldNode();
		node.setName(description.name);
		Timeline.applyStageNodeDescription(node, description, imageResolver);
		return node;
	}

	//==============================================================================
	// 노드에 서술 반영. (정적, 편집기가 값을 고칠 때도 쓴다)
	//==============================================================================
	/**
	 * @param { WorldNode } node 서술을 반영할 노드. (종류에 맞는 컴포넌트가 없으면 더한다)
	 * @param { object } nodeDescription 무대 노드 서술. (빠진 값은 TIMELINE_NODE_DEFAULTS 로 채운다)
	 * @param { Function | null } imageResolver 이미지 이름을 받아 그림을 돌려주는 함수. (없거나 null 을 돌려주면 data: 주소만 스스로 읽는다)
	 */
	static applyStageNodeDescription(node, nodeDescription, imageResolver = null) {
		const description = System.Object.assign({}, TIMELINE_NODE_DEFAULTS, nodeDescription);
		node.setPivot(Vector2.create(description.pivotX, description.pivotY));
		node.setAnchor(Pivot.topLeft.clone());
		node.setContentSize(Vector2.create(description.width, description.height));
		node.setLocalPosition(Vector2.create(description.x, description.y));
		node.setLocalScale(Vector2.create(description.scaleX, description.scaleY));
		node.setLocalRotation(description.rotation);
		node.setLocalOpacity(description.opacity);
		node.setActive(description.visible !== false);

		if (description.type === "paint") {
			const paintComponent = node.getOrAddComponent(Paint);
			paintComponent.setColor(createColorFromText(description.color));
			paintComponent.setRoundSize(description.roundSize);
		}
		else if (description.type === "sprite") {
			const sprite = node.getOrAddComponent(ShaderSprite);
			spriteFrameGridTable.set(sprite, { columns: System.Math.max(1, description.frameColumns), rows: System.Math.max(1, description.frameRows) });
			let image = null;
			if (description.image && imageResolver) {
				image = imageResolver(description.image);
			}
			if (!image && description.image && description.image.startsWith("data:")) {
				image = new System.Image();
				image.onload = () => {
					applySpriteFrame(sprite, description.frame);
				};
				image.src = description.image;
			}
			sprite.setImage(image);
			sprite.setImageRect(Rect.zero());
			applySpriteFrame(sprite, description.frame);
			sprite.setColor(createColorFromText(description.color === "#ffffffff" ? "#ffffff00" : description.color));
			sprite.setSpriteBlendMode(description.blendMode);
			sprite.setEffect(description.effect);
			sprite.setEffectProgress(description.effectProgress);
			if (description.effectColor) {
				sprite.setEffectColor(createColorFromText(description.effectColor));
			}
		}
		else if (description.type === "text") {
			const textComponent = node.getOrAddComponent(Text);
			textComponent.setText(description.text);
			textComponent.setFontSize(description.fontSize);
			textComponent.setBold(description.bold === true);
			textComponent.setTextColor(createColorFromText(description.color));
			textComponent.setTextAlign(description.textAlign);
			textComponent.setTextBaseline("middle");
		}
		else if (description.type === "particle") {
			const particleSystem = node.getOrAddComponent(ParticleSystem);
			if (description.particle) {
				particleSystem.applyDescription(description.particle);
			}
		}
		else if (description.type === "sound") {
			let soundEntry = soundPlayerTable.get(node);
			if (!soundEntry) {
				soundEntry = { audioPlayer: null, audioAsset: null, audioSource: "", volume: 1 };
				soundPlayerTable.set(node, soundEntry);
			}
			soundEntry.volume = description.volume;
			if (description.audio && description.audio !== soundEntry.audioSource) {
				soundEntry.audioSource = description.audio;
				const audioAsset = new AudioAsset();
				soundEntry.audioAsset = audioAsset;
				audioAsset.load(description.audio).then(() => {
					if (soundEntry.audioPlayer) {
						soundEntry.audioPlayer.setAudioAsset(audioAsset);
					}
				}).catch(() => {
				});
			}
			if (!soundEntry.audioPlayer && timelineAudioManager) {
				soundEntry.audioPlayer = timelineAudioManager.createAudioPlayer();
				if (soundEntry.audioAsset) {
					soundEntry.audioPlayer.setAudioAsset(soundEntry.audioAsset);
				}
			}
		}
	}

	//==============================================================================
	// 오디오 매니저 설정. (정적, 사운드 노드가 플레이어를 만들 때 쓴다)
	//==============================================================================
	/**
	 * @param { object | null } audioManager 사운드 노드가 createAudioPlayer 로 플레이어를 만들 오디오 매니저. (null 이면 만들지 않는다)
	 */
	static setAudioManager(audioManager) {
		timelineAudioManager = audioManager;
	}

	//==============================================================================
	// 사운드 노드 정지. (정적, 편집기가 정지 / 되감기 때 부른다)
	//==============================================================================
	/**
	 * @param { WorldNode } node 멈출 사운드 노드. (사운드 노드가 아니면 아무것도 하지 않는다)
	 */
	static stopSound(node) {
		const soundEntry = soundPlayerTable.get(node);
		if (soundEntry && soundEntry.audioPlayer) {
			soundEntry.audioPlayer.stop();
		}
	}

	//==============================================================================
	// 재생.
	//==============================================================================
	play() {
		if (this.#time >= this.getDuration() && !this.isLoop()) {
			this.#time = 0;
		}
		this.#isPlaying = true;
	}

	//==============================================================================
	// 일시 정지.
	//==============================================================================
	pause() {
		this.#isPlaying = false;
	}

	//==============================================================================
	// 정지. (처음으로)
	//==============================================================================
	stop() {
		this.#isPlaying = false;
		for (const target of this.#targetTable.values()) {
			const soundEntry = soundPlayerTable.get(target);
			if (soundEntry && soundEntry.audioPlayer) {
				soundEntry.audioPlayer.stop();
			}
		}
		for (const particleSystem of this.#particleSystems) {
			particleSystem.stop(true);
		}
		this.seek(0);
	}

	//==============================================================================
	// 시간 이동. (이벤트는 발생하지 않는다)
	//==============================================================================
	/**
	 * @param { number } time 옮길 시간. (초, 0 ~ 길이로 자른다)
	 */
	seek(time) {
		this.#time = System.Math.max(0, System.Math.min(this.getDuration(), time));
		this.evaluate(this.#time);
		this.resimulateParticles(this.#time);
	}

	//==============================================================================
	// 갱신. (시간을 흘리고 값을 적용, 지나친 이벤트 / 마커를 발생)
	//==============================================================================
	/**
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초, 속도를 곱해 흘린다. 재생 중이 아니면 아무것도 하지 않는다)
	 * @example <caption>재생하며 이벤트, 마커, 완료 받기</caption>
	 * import { Timeline } from "./build/vanilla.js";
	 *
	 * const description = Timeline.createEmptyDescription();
	 * description.duration = 1;
	 * description.loop = false;
	 * description.tracks.push({
	 * 	target: "hero",
	 * 	property: "event",
	 * 	keys: [
	 * 		{ time: 0.5, value: "jump" }
	 * 	]
	 * });
	 * description.markers.push({ time: 0.25, name: "quarter" });
	 * const timeline = new Timeline(description);
	 * timeline.setEventHandler((targetName, eventName) => {
	 * 	console.log("event", targetName, eventName);
	 * });
	 * timeline.setMarkerHandler((markerName) => {
	 * 	console.log("marker", markerName);
	 * });
	 * timeline.setCompleteHandler(() => {
	 * 	console.log("complete", timeline.getTime());
	 * });
	 * timeline.play();
	 * for (let frame = 0; frame < 40; ++frame) {
	 * 	timeline.tick(1 / 30);
	 * }
	 */
	tick(timeDelta) {
		if (!this.#isPlaying) {
			return;
		}
		const duration = this.getDuration();
		const previousTime = this.#time;
		let nextTime = previousTime + timeDelta * this.#speed;
		let isWrapped = false;
		if (nextTime >= duration) {
			if (this.isLoop() && duration > 0) {
				this.fireEventsBetween(previousTime, duration);
				this.simulateParticles(duration - previousTime);
				nextTime = nextTime % duration;
				this.fireEventsBetween(-1, nextTime);
				isWrapped = true;
			}
			else {
				this.fireEventsBetween(previousTime, duration);
				this.simulateParticles(duration - previousTime);
				this.#time = duration;
				this.#isPlaying = false;
				this.evaluate(this.#time);
				if (this.#completeHandler) {
					this.#completeHandler(this);
				}
				return;
			}
		}
		else if (nextTime < 0) {
			nextTime = 0;
		}
		else {
			this.fireEventsBetween(previousTime, nextTime);
		}
		this.#time = nextTime;
		this.evaluate(this.#time);
		// 파티클은 타임라인 시간으로만 진행한다. (감기면 처음부터 다시, 매 반복이 같게)
		if (isWrapped) {
			this.resimulateParticles(this.#time);
		}
		else {
			this.simulateParticles(this.#time - previousTime);
		}
	}

	//==============================================================================
	// 구간 안의 이벤트 키 / 마커 발생. (fromTime 초과 ~ toTime 이하)
	//==============================================================================
	/**
	 * @param { number } fromTime 구간 시작. (초, 이 시간의 키는 넣지 않는다)
	 * @param { number } toTime 구간 끝. (초, 이 시간의 키는 넣는다)
	 */
	fireEventsBetween(fromTime, toTime) {
		if (this.#isDirty) {
			this.compile();
		}
		const isInside = (time) => {
			if (time <= fromTime) {
				return false;
			}
			return time <= toTime;
		};
		for (const compiledTrack of this.#compiledTracks) {
			if (compiledTrack.track.property !== "event" || compiledTrack.track.enabled === false) {
				continue;
			}
			for (const key of compiledTrack.keys) {
				if (isInside(key.time)) {
					this.dispatchEvent(compiledTrack, key);
				}
			}
		}
		if (this.#markerHandler) {
			for (const marker of this.#compiledMarkers) {
				if (isInside(marker.time)) {
					this.#markerHandler(marker.name, marker, this);
				}
			}
		}
	}

	//==============================================================================
	// 이벤트 키 처리. (파티클 대상은 play / stop / emit:N 을 스스로 처리, 그 외는 핸들러)
	//==============================================================================
	/**
	 * @param { object } compiledTrack 컴파일한 이벤트 트랙. (target 과 track 을 쓴다)
	 * @param { object } key 이벤트 키. (value 가 이벤트 이름)
	 * @param { boolean } isSilent - 재시뮬레이션용. (사운드 / 사용자 핸들러는 부르지 않고 파티클만)
	 */
	dispatchEvent(compiledTrack, key, isSilent = false) {
		const target = compiledTrack.target;
		const eventName = String(key.value);
		const soundEntry = (target && !isSilent) ? soundPlayerTable.get(target) : null;
		if (soundEntry && soundEntry.audioPlayer) {
			if (eventName === "play" || eventName === "loop") {
				if (soundEntry.audioAsset && soundEntry.audioAsset.isLoaded()) {
					soundEntry.audioPlayer.setAudioAsset(soundEntry.audioAsset);
					soundEntry.audioPlayer.setTime(0);
					soundEntry.audioPlayer.play(eventName === "loop");
				}
			}
			else if (eventName === "stop") {
				soundEntry.audioPlayer.stop();
			}
		}
		if (target && typeof target.getComponent === "function") {
			const particleSystem = target.getComponent(ParticleSystem);
			if (particleSystem) {
				if (eventName === "play") {
					particleSystem.play();
				}
				else if (eventName === "stop") {
					particleSystem.stop(false);
				}
				else if (eventName === "clear") {
					particleSystem.stop(true);
				}
				else if (eventName.startsWith("emit")) {
					const separatorIndex = eventName.indexOf(":");
					const emitCount = separatorIndex >= 0 ? System.Number(eventName.substring(separatorIndex + 1)) : 30;
					particleSystem.emit(System.Number.isFinite(emitCount) ? emitCount : 30);
				}
			}
		}
		if (this.#eventHandler && !isSilent) {
			this.#eventHandler(compiledTrack.track.target, eventName, key, this);
		}
	}

	//==============================================================================
	// 시간의 값 적용. (연속 속성만, 이벤트는 tick 에서만 발생)
	//==============================================================================
	/**
	 * @param { number } time 값을 적용할 시간. (초)
	 */
	evaluate(time) {
		if (this.#isDirty) {
			this.compile();
		}
		for (const compiledTrack of this.#compiledTracks) {
			if (compiledTrack.track.enabled === false || compiledTrack.keys.length === 0 || compiledTrack.track.property === "event") {
				continue;
			}
			const target = compiledTrack.target;
			if (!target) {
				continue;
			}
			const value = Timeline.sampleKeys(compiledTrack.keys, compiledTrack.kind, time);
			if (compiledTrack.definition && compiledTrack.definition.apply && typeof target.getComponent === "function") {
				compiledTrack.definition.apply(target, value);
			}
			else if (typeof target.setTimelineProperty === "function") {
				target.setTimelineProperty(compiledTrack.track.property, value);
			}
		}
	}

	//==============================================================================
	// 키 목록에서 시간의 값 표본. (정적, 편집기의 커브 그리기도 쓴다)
	//==============================================================================
	/**
	 * @param { object[] } sortedKeys 시간 차례로 정렬한 키 목록. ({ time, value, easing, curve })
	 * @param { string } kind "number", "color", "string", "boolean" 가운데. (number 와 color 만 보간하고 나머지는 계단)
	 * @param { number } time 표본 시간. (초)
	 * @returns { * } 그 시간의 값. (키가 없으면 number 는 0, 그 밖은 null)
	 */
	static sampleKeys(sortedKeys, kind, time) {
		const keyCount = sortedKeys.length;
		if (keyCount === 0) {
			return kind === "number" ? 0 : null;
		}
		if (time <= sortedKeys[0].time) {
			return sortedKeys[0].value;
		}
		if (time >= sortedKeys[keyCount - 1].time) {
			return sortedKeys[keyCount - 1].value;
		}
		let segmentIndex = 0;
		while (segmentIndex < keyCount - 2 && sortedKeys[segmentIndex + 1].time <= time) {
			segmentIndex += 1;
		}
		const fromKey = sortedKeys[segmentIndex];
		const toKey = sortedKeys[segmentIndex + 1];
		const segmentDuration = toKey.time - fromKey.time;
		if (segmentDuration <= 0) {
			return toKey.value;
		}
		if (kind !== "number" && kind !== "color") {
			return fromKey.value;
		}
		const easingFunction = resolveTimelineEasing(fromKey.easing, fromKey.curve);
		const progress = (time - fromKey.time) / segmentDuration;
		const easedProgress = easingFunction(System.Math.max(0, System.Math.min(1, progress)));
		return interpolateValue(kind, fromKey.value, toKey.value, easedProgress);
	}

	//==============================================================================
	// 트랙의 시간 값 표본. (서술 트랙 그대로, 정렬은 여기서)
	//==============================================================================
	/**
	 * @param { object } track 서술의 트랙. (property 로 종류를 정하고, 모르는 속성은 number)
	 * @param { number } time 표본 시간. (초)
	 * @returns { * } 그 시간의 값.
	 */
	static sampleTrack(track, time) {
		const definition = TIMELINE_PROPERTY_DEFINITIONS[track.property];
		const kind = definition ? definition.kind : "number";
		const sortedKeys = (track.keys ? track.keys : []).slice().sort((left, right) => left.time - right.time);
		return Timeline.sampleKeys(sortedKeys, kind, time);
	}

	//==============================================================================
	// 시간 반환.
	//==============================================================================
	/**
	 * @returns { number } 지금 시간. (초)
	 */
	getTime() {
		return this.#time;
	}

	//==============================================================================
	// 재생 중 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 재생 중이면 참.
	 */
	isPlaying() {
		return this.#isPlaying;
	}

	//==============================================================================
	// 속도 설정. (1 = 실시간)
	//==============================================================================
	/**
	 * @param { number } speed 재생 속도 배율. (1 = 실시간, 음수면 0 초에서 멈춰 선다)
	 */
	setSpeed(speed) {
		this.#speed = speed;
	}

	//==============================================================================
	// 속도 반환.
	//==============================================================================
	/**
	 * @returns { number } 재생 속도 배율.
	 */
	getSpeed() {
		return this.#speed;
	}

	//==============================================================================
	// 반복 설정.
	//==============================================================================
	/**
	 * @param { boolean } isLoop 반복하면 참. (문서의 loop 에 쓴다)
	 */
	setLoop(isLoop) {
		this.#description.loop = isLoop;
	}

	//==============================================================================
	// 반복 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 문서의 loop 가 true 면 참.
	 */
	isLoop() {
		return this.#description.loop === true;
	}

	//==============================================================================
	// 길이 반환. (초)
	//==============================================================================
	/**
	 * @returns { number } 길이. (초, 문서 값이 양수가 아니면 0)
	 */
	getDuration() {
		const duration = System.Number(this.#description.duration);
		return System.Number.isFinite(duration) && duration > 0 ? duration : 0;
	}

	//==============================================================================
	// 초당 프레임 반환.
	//==============================================================================
	/**
	 * @returns { number } 초당 프레임. (문서 값이 양수가 아니면 30)
	 */
	getFrameRate() {
		const frameRate = System.Number(this.#description.frameRate);
		return System.Number.isFinite(frameRate) && frameRate > 0 ? frameRate : 30;
	}

	//==============================================================================
	// 이벤트 핸들러 설정. ((대상 이름, 이벤트 이름, 키, 타임라인))
	//==============================================================================
	/**
	 * @param { Function | null } eventHandler (대상 이름, 이벤트 이름, 키, 타임라인) 을 받는 함수. (null 이면 끈다)
	 */
	setEventHandler(eventHandler) {
		this.#eventHandler = eventHandler;
	}

	//==============================================================================
	// 마커 핸들러 설정. ((마커 이름, 마커, 타임라인))
	//==============================================================================
	/**
	 * @param { Function | null } markerHandler (마커 이름, 마커, 타임라인) 을 받는 함수. (null 이면 끈다)
	 */
	setMarkerHandler(markerHandler) {
		this.#markerHandler = markerHandler;
	}

	//==============================================================================
	// 완료 핸들러 설정. (반복이 아닐 때 끝에 닿으면)
	//==============================================================================
	/**
	 * @param { Function | null } completeHandler 타임라인을 받는 함수. (null 이면 끈다)
	 */
	setCompleteHandler(completeHandler) {
		this.#completeHandler = completeHandler;
	}
}
