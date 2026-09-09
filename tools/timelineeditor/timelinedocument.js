//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { TIMELINE_NODE_DEFAULTS } from "../../src/experimental/animation/timeline.js";


//==============================================================================
// 노드 종류 정의. (팔레트 — 이름 / 종류 / 기본 서술 덮어쓰기)
//==============================================================================
export const NODE_KIND_DEFINITIONS = [
	{ type: "group", label: "Group", overrides: { width: 200, height: 200 } },
	{ type: "paint", label: "Paint", overrides: { width: 160, height: 100, color: "#d4b06aff", roundSize: 8 } },
	{ type: "sprite", label: "Sprite", overrides: { width: 128, height: 128, color: "#ffffff00" } },
	{ type: "text", label: "Text", overrides: { width: 400, height: 60, text: "TEXT", fontSize: 40, bold: true, color: "#f2ece2ff" } },
	{ type: "particle", label: "Particle", overrides: { width: 20, height: 20 } },
	{ type: "sound", label: "Sound", overrides: { width: 24, height: 24 } },
];

// 종류별 애니메이션 가능한 속성. (트랙을 만들 수 있는 것 — 차례가 인스펙터 / 메뉴 차례)
export const ANIMATABLE_PROPERTY_TABLE = {
	group: ["x", "y", "width", "height", "scaleX", "scaleY", "rotation", "opacity", "visible", "event"],
	paint: ["x", "y", "width", "height", "scaleX", "scaleY", "rotation", "opacity", "visible", "color", "event"],
	sprite: ["x", "y", "width", "height", "scaleX", "scaleY", "rotation", "opacity", "visible", "color", "frame", "effect", "event"],
	text: ["x", "y", "width", "height", "scaleX", "scaleY", "rotation", "opacity", "visible", "color", "text", "number", "fontSize", "visibleCharacters", "event"],
	particle: ["x", "y", "scaleX", "scaleY", "rotation", "opacity", "visible", "event"],
	sound: ["event"],
};

// 속성 → 서술 필드. (기본값이 사는 곳 — 없으면 같은 이름)
export const PROPERTY_DESCRIPTION_FIELD = {
	effect: "effectProgress",
	number: "text",
	visibleCharacters: null,
	event: null,
};

// 종류별 이벤트 값 목록. (이벤트 키 값 선택지)
export const EVENT_VALUE_TABLE = {
	particle: ["play", "stop", "clear", "emit:20", "emit:50", "emit:100"],
	sound: ["play", "loop", "stop"],
	default: ["trigger", "show", "hide", "custom"],
};

// 자주 쓰는 이징 8종. (컨텍스트 메뉴)
export const QUICK_EASING_DEFINITIONS = [
	{ label: "Linear", easing: "linear" },
	{ label: "Ease In", easing: "quadratic.in" },
	{ label: "Ease Out", easing: "quadratic.out" },
	{ label: "Ease In Out", easing: "cubic.inOut" },
	{ label: "Back Out", easing: "back.out" },
	{ label: "Elastic Out", easing: "elastic.out" },
	{ label: "Bounce Out", easing: "bounce.out" },
	{ label: "Step", easing: "step" },
];

// 베지어 프리셋. (CSS 표준 곡선)
export const BEZIER_PRESET_DEFINITIONS = [
	{ label: "Ease", curve: [0.25, 0.1, 0.25, 1] },
	{ label: "In", curve: [0.42, 0, 1, 1] },
	{ label: "Out", curve: [0, 0, 0.58, 1] },
	{ label: "In Out", curve: [0.42, 0, 0.58, 1] },
	{ label: "Overshoot", curve: [0.34, 1.56, 0.64, 1] },
	{ label: "Anticipate", curve: [0.36, 0, 0.66, -0.56] },
];

// 파티클 프리셋. (파티클 편집기 서술 형식 — 기본 서술 위에 덮어쓴다)
export const PARTICLE_DEFAULT_DESCRIPTION = {
	looping: true,
	duration: 1,
	maxParticleCount: 800,
	emissionRate: 60,
	bursts: [],
	shape: "cone",
	shapeRadius: 20,
	coneAngle: 0.35,
	boxSize: [200, 100],
	edgeWidth: 400,
	lifetime: [0.6, 1.2],
	speed: [80, 180],
	size: [6, 14],
	rotation: [0, 0],
	angularVelocity: [0, 0],
	startColorA: [1, 0.75, 0.3, 1],
	startColorB: [1, 0.5, 0.12, 1],
	colorOverLifetime: [
		{ time: 0, color: [1, 1, 0.85, 1] },
		{ time: 0.5, color: [1, 0.6, 0.2, 0.9] },
		{ time: 1, color: [0.65, 0.1, 0.02, 0] },
	],
	sizeOverLifetime: [1, 0.3],
	gravity: [0, -110],
	damping: 1,
	attractor: null,
	wobble: [0, 4],
	renderShape: "circle",
	blendMode: "lighter",
	streakScale: 0.05,
	worldSpace: false,
};

export const PARTICLE_PRESET_TABLE = {
	Fire: null,
	Sparkle: {
		emissionRate: 40, shape: "box", boxSize: [300, 200], lifetime: [0.8, 1.6], speed: [0, 8], size: [2, 6],
		gravity: [0, 0], damping: 0, renderShape: "circle", blendMode: "lighter", wobble: [0, 4],
		startColorA: [1, 0.9, 0.6, 1], startColorB: [1, 1, 1, 1], sizeOverLifetime: [0.4, 1.3],
		colorOverLifetime: [{ time: 0, color: [1, 1, 1, 0] }, { time: 0.3, color: [1, 1, 1, 1] }, { time: 1, color: [1, 1, 1, 0] }],
	},
	Burst: {
		looping: false, emissionRate: 0, bursts: [{ time: 0, count: 60 }], duration: 1.2, shape: "circle", shapeRadius: 6,
		lifetime: [0.5, 1.1], speed: [180, 420], size: [3, 6], gravity: [0, 240], damping: 1.6,
		renderShape: "streak", streakScale: 0.04, blendMode: "lighter",
		startColorA: [1, 0.85, 0.4, 1], startColorB: [1, 0.55, 0.2, 1], sizeOverLifetime: [1, 0.5],
		colorOverLifetime: [{ time: 0, color: [1, 1, 1, 1] }, { time: 1, color: [1, 0.4, 0.1, 0] }],
	},
	Confetti: {
		looping: false, emissionRate: 0, bursts: [{ time: 0, count: 70 }], duration: 1.2, shape: "circle", shapeRadius: 10,
		lifetime: [1.6, 2.6], speed: [150, 380], size: [4.5, 8], rotation: [0, 6.28], angularVelocity: [2.2, 3.6],
		gravity: [0, 480], damping: 1.5, wobble: [8, 3], renderShape: "rect", blendMode: "source-over",
		startColorA: [1, 0.45, 0.55, 1], startColorB: [0.4, 0.75, 1, 1], sizeOverLifetime: [1, 1],
		colorOverLifetime: [{ time: 0, color: [1, 1, 1, 1] }, { time: 0.85, color: [1, 1, 1, 1] }, { time: 1, color: [1, 1, 1, 0] }],
	},
	Smoke: {
		emissionRate: 18, shape: "circle", shapeRadius: 12, lifetime: [1.6, 2.8], speed: [20, 50], size: [18, 34],
		gravity: [0, -40], damping: 0.6, wobble: [10, 1.2], renderShape: "circle", blendMode: "source-over",
		startColorA: [0.5, 0.5, 0.55, 0.5], startColorB: [0.7, 0.7, 0.75, 0.35], sizeOverLifetime: [0.6, 1.8],
		colorOverLifetime: [{ time: 0, color: [1, 1, 1, 0] }, { time: 0.2, color: [1, 1, 1, 1] }, { time: 1, color: [1, 1, 1, 0] }],
	},
	Rain: {
		emissionRate: 200, shape: "edge", edgeWidth: 960, lifetime: [0.8, 1.0], speed: [430, 540], size: [1.4, 2.2],
		gravity: [0, 0], damping: 0, wobble: [0, 4], renderShape: "streak", streakScale: 0.03, blendMode: "source-over",
		startColorA: [0.62, 0.74, 0.95, 0.55], startColorB: [0.75, 0.85, 1, 0.35], sizeOverLifetime: [1, 1],
		colorOverLifetime: [{ time: 0, color: [1, 1, 1, 1] }, { time: 1, color: [1, 1, 1, 1] }],
	},
	Snow: {
		emissionRate: 70, shape: "edge", edgeWidth: 960, lifetime: [5, 8], speed: [30, 70], size: [2.5, 6],
		gravity: [0, 12], damping: 0.1, wobble: [14, 1.4], renderShape: "circle", blendMode: "source-over",
		startColorA: [1, 1, 1, 0.95], startColorB: [0.8, 0.88, 1, 0.55], sizeOverLifetime: [1, 1],
		colorOverLifetime: [{ time: 0, color: [1, 1, 1, 0] }, { time: 0.06, color: [1, 1, 1, 1] }, { time: 0.92, color: [1, 1, 1, 1] }, { time: 1, color: [1, 1, 1, 0] }],
	},
};


//==============================================================================
// 파티클 서술 합성. (기본 + 프리셋)
//==============================================================================
/**
 * @param { string } presetName
 * @returns { object }
 */
export function composeParticleDescription(presetName) {
	const description = System.JSON.parse(System.JSON.stringify(PARTICLE_DEFAULT_DESCRIPTION));
	const presetOverride = PARTICLE_PRESET_TABLE[presetName];
	if (presetOverride) {
		System.Object.assign(description, System.JSON.parse(System.JSON.stringify(presetOverride)));
	}
	description.preset = presetName;
	return description;
}


//==============================================================================
// 노드 서술 생성. (종류 기본값 + 팔레트 덮어쓰기 + 이름)
//==============================================================================
/**
 * @param { string } type
 * @param { string } name
 * @returns { object }
 */
export function createNodeDescription(type, name) {
	const kindDefinition = NODE_KIND_DEFINITIONS.find((definition) => definition.type === type);
	const description = System.Object.assign({}, TIMELINE_NODE_DEFAULTS, kindDefinition ? kindDefinition.overrides : {});
	description.name = name;
	description.type = type;
	description.parent = null;
	if (type === "particle") {
		description.particle = composeParticleDescription("Sparkle");
	}
	return description;
}


//==============================================================================
// 깊은 복사.
//==============================================================================
/**
 * @param { object } value
 * @returns { object }
 */
export function cloneDeep(value) {
	return System.JSON.parse(System.JSON.stringify(value));
}


//==============================================================================
// 기본 문서. ("TITLE CARD" — 처음 열 때 보이는 예제)
//==============================================================================
/**
 * @returns { object }
 */
export function createDefaultDocument() {
	return {
		name: "Title Card",
		duration: 4,
		frameRate: 30,
		loop: true,
		stage: {
			width: 960,
			height: 540,
			backgroundColor: "#101114ff",
			nodes: [
				{ name: "Backdrop", type: "paint", parent: null, x: 480, y: 270, width: 960, height: 540, color: "#15181fff" },
				{ name: "Glow", type: "paint", parent: null, x: 480, y: 300, width: 520, height: 520, color: "#d4b06a10", roundSize: 260, scaleX: 0.2, scaleY: 0.2 },
				{ name: "Accent Bar", type: "paint", parent: null, x: 480, y: 318, width: 0, height: 3, color: "#d4b06aff" },
				{ name: "Title", type: "text", parent: null, x: 480, y: 250, width: 800, height: 90, text: "VANILLA TIMELINE", fontSize: 64, bold: true, color: "#f2ece2ff" },
				{ name: "Subtitle", type: "text", parent: null, x: 480, y: 356, width: 600, height: 40, text: "keyframes · easing · events · shaders", fontSize: 20, color: "#9d9d9dff" },
				{ name: "Sparkles", type: "particle", parent: null, x: 480, y: 250, width: 20, height: 20, particle: composeParticleDescription("Burst") },
			],
		},
		tracks: [
			{ target: "Title", property: "opacity", keys: [{ time: 0, value: 0, easing: "cubic.out" }, { time: 0.6, value: 1 }] },
			{ target: "Title", property: "y", keys: [{ time: 0, value: 300, easing: "cubic.out" }, { time: 0.8, value: 250 }] },
			{ target: "Title", property: "scaleX", keys: [{ time: 0, value: 0.85, easing: "back.out" }, { time: 0.9, value: 1 }] },
			{ target: "Title", property: "scaleY", keys: [{ time: 0, value: 0.85, easing: "back.out" }, { time: 0.9, value: 1 }] },
			{ target: "Accent Bar", property: "width", keys: [{ time: 0.4, value: 0, easing: "quartic.out" }, { time: 1.2, value: 420 }] },
			{ target: "Subtitle", property: "opacity", keys: [{ time: 0.8, value: 0, easing: "sinusoidal.out" }, { time: 1.5, value: 1 }] },
			{ target: "Subtitle", property: "y", keys: [{ time: 0.8, value: 376, easing: "cubic.out" }, { time: 1.5, value: 356 }] },
			{ target: "Glow", property: "scaleX", keys: [{ time: 0.3, value: 0.2, easing: "sinusoidal.out" }, { time: 1.6, value: 1 }] },
			{ target: "Glow", property: "scaleY", keys: [{ time: 0.3, value: 0.2, easing: "sinusoidal.out" }, { time: 1.6, value: 1 }] },
			{ target: "Glow", property: "opacity", keys: [{ time: 0.3, value: 0 }, { time: 1.2, value: 1 }, { time: 3.2, value: 1 }, { time: 4, value: 0 }] },
			{ target: "Sparkles", property: "event", keys: [{ time: 0.7, value: "play" }] },
			{ target: "Title", property: "color", keys: [{ time: 2.4, value: "#f2ece2ff", easing: "sinusoidal.inOut" }, { time: 3.2, value: "#d4b06aff" }, { time: 4, value: "#f2ece2ff" }] },
		],
		markers: [
			{ time: 0.7, name: "hit" },
			{ time: 2.4, name: "shine" },
		],
	};
}
