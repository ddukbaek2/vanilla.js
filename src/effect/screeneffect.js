//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Color } from "../base/color.js";
import { Graphic } from "../core/graphic.js";
import { FullscreenPass } from "../experimental/graphics/fullscreenpass.js";


//==============================================================================
// 화면 효과 종류.
//==============================================================================
export const ScreenEffectType = {
	// --- 형태 왜곡 ---
	lensDistortion: "lensDistortion", // 배럴 / 핀쿠션 렌즈 왜곡. (parameters = [세기 — 음수면 핀쿠션])
	bulge: "bulge",                   // 볼록 / 오목. (parameters = [중심 x, 중심 y, 세기, 반지름])
	swirl: "swirl",                   // 소용돌이. (parameters = [중심 x, 중심 y, 회전 수, 반지름])
	kaleidoscope: "kaleidoscope",     // 만화경. (parameters = [조각 수])
	mirror: "mirror",                 // 대칭. (parameters = [0 가로 / 1 세로])
	ripple: "ripple",                 // 물 파문. (parameters = [중심 x, 중심 y, 빈도, 속도])
	heatHaze: "heatHaze",             // 아지랑이. (parameters = [노이즈 배율, 속도])
	jitter: "jitter",                 // 화면 흔들림. (parameters = [진폭 픽셀, 초당 변화])
	doubleVision: "doubleVision",     // 겹쳐 보임. (parameters = [간격, 흔들리는 속도])
	pixelate: "pixelate",             // 모자이크. (strength 0 → 1, parameters = [가장 큰 블록 픽셀])
	shockwave: "shockwave",           // 충격파 링 왜곡. (parameters = [중심 x, 중심 y, 반지름 0 ~ 1.5, 폭], color = 링 빛)
	wave: "wave",                     // 화면 물결. (parameters = [빈도, 속도])
	// --- 흐림 ---
	motionBlur: "motionBlur",         // 방향 블러. (parameters = [각도 라디안, 길이 픽셀])
	zoomBlur: "zoomBlur",             // 중심으로 뻗는 방사 블러. (parameters = [중심 x, 중심 y, 길이])
	blur: "blur",                     // 가우시안 블러. (parameters = [반지름 픽셀])
	tiltShift: "tiltShift",           // 틸트 시프트. (parameters = [초점 y, 초점 폭, 반지름 픽셀])
	godRays: "godRays",               // 빛줄기. (parameters = [중심 x, 중심 y, 문턱, 감쇠], color = 빛 색)
	bloom: "bloom",                   // 밝은 곳 번짐. (parameters = [문턱, 세기 배율, 반지름 픽셀])
	anamorphic: "anamorphic",         // 가로 렌즈 플레어. (parameters = [문턱, 세기 배율, 폭 픽셀], color = 플레어 색)
	// --- 글리치 ---
	glitch: "glitch",                 // 가로 줄 어긋남 + 색 분리 + 블록 반전. (parameters = [줄 수, 초당 변화, 어긋남 폭])
	vhs: "vhs",                       // VHS 테이프. (흔들림 + 색 번짐 + 노이즈 줄, parameters = [흔들림, 노이즈])
	chromatic: "chromatic",           // 색수차. (parameters = [배율])
	// --- 색 ---
	whiteBalance: "whiteBalance",     // 색온도 / 틴트. (parameters = [온도 -1 ~ 1, 틴트 -1 ~ 1])
	liftGammaGain: "liftGammaGain",   // 리프트 / 감마 / 게인. (parameters = [리프트, 감마, 게인])
	colorGrade: "colorGrade",         // 대비 / 채도 / 밝기 + 틴트. (parameters = [대비, 채도, 밝기], color = 틴트)
	hueShift: "hueShift",             // 색상 회전. (parameters = [회전 수 — strength 와 곱])
	splitToning: "splitToning",       // 스플릿 토닝. (parameters.xyz = 그림자 색, color = 하이라이트 색, w = 균형)
	tonemap: "tonemap",               // ACES 톤매핑. (parameters = [노출])
	gradientMap: "gradientMap",       // 밝기를 두 색 사이로 매핑. (parameters.xyz = 어두운 색, color = 밝은 색)
	sepia: "sepia",                   // 세피아.
	grayscale: "grayscale",           // 무채색.
	posterize: "posterize",           // 포스터화. (parameters = [단계 수])
	dither: "dither",                 // 오더드 디더링. (parameters = [단계 수, 픽셀 크기])
	halftone: "halftone",             // 하프톤 점. (parameters = [격자 픽셀])
	sharpen: "sharpen",               // 샤픈.
	edgeDetect: "edgeDetect",         // 윤곽 검출. (color = 선 색)
	oldFilm: "oldFilm",               // 낡은 필름. (세피아 + 그레인 + 스크래치 + 깜빡임)
	nightVision: "nightVision",       // 야시경. (color = 틴트)
	invert: "invert",                 // 색 반전.
	// --- 무늬 / 마스크 ---
	scanline: "scanline",             // CRT 곡면 + 주사선 + RGB 마스크. (parameters = [곡률, 주사선 밀도])
	grain: "grain",                   // 필름 그레인.
	rain: "rain",                     // 빗줄기. (parameters = [줄 수, 밀도, 속도], color = 빗줄기 색)
	fog: "fog",                       // 세로 안개. (parameters = [시작 y, 끝 y], color = 안개 색)
	vignette: "vignette",             // 비네트. (parameters = [시작 거리, 끝 거리], color = 가장자리 색)
	spotlight: "spotlight",           // 스포트라이트 바깥 어둡힘. (parameters = [중심 x, 중심 y, 반지름, 부드러움], color = 바깥 색)
	speedLines: "speedLines",         // 집중선. (parameters = [중심 x, 중심 y, 밀도, 속도], color = 선 색)
	letterbox: "letterbox",           // 위아래 / 좌우 검은 띠. (parameters = [세로 띠 비율, 가로 띠 비율], color = 띠 색)
	// --- 전환 (strength 0 → 1 로 color 에 덮인다) ---
	pixelDissolve: "pixelDissolve",   // 블록 디졸브. (parameters = [블록 수])
	wipe: "wipe",                     // 방향 와이프. (parameters = [방향 x, 방향 y, 부드러움])
	irisWipe: "irisWipe",             // 원형 아이리스. (parameters = [중심 x, 중심 y, 부드러움])
	diamondWipe: "diamondWipe",       // 마름모 와이프. (parameters = [부드러움])
	clockWipe: "clockWipe",           // 시계 와이프. (parameters = [부드러움])
	blinds: "blinds",                 // 블라인드. (parameters = [줄 수, 부드러움])
	checkerWipe: "checkerWipe",       // 체커 보드. (parameters = [칸 수])
	noiseFade: "noiseFade",           // 노이즈 페이드. (parameters = [노이즈 배율, 부드러움])
	burn: "burn",                     // 불에 타듯. (parameters = [노이즈 배율, 띠 폭], color = 덮을 색, 띠는 주황)
	tvOff: "tvOff",                   // 브라운관 끄기. (세로로 눌리며 밝은 선으로)
	fade: "fade",                     // 단색으로 페이드. (color = 목표 색)
};

// 적용 차례. (형태 왜곡 → 흐림 → 글리치 → 색 → 무늬 → 전환)
const EFFECT_ORDER = [
	"lensDistortion", "bulge", "swirl", "kaleidoscope", "mirror", "ripple", "heatHaze", "jitter", "doubleVision", "pixelate", "shockwave", "wave",
	"motionBlur", "zoomBlur", "blur", "tiltShift", "godRays", "bloom", "anamorphic",
	"glitch", "vhs", "chromatic",
	"whiteBalance", "liftGammaGain", "colorGrade", "hueShift", "splitToning", "tonemap", "gradientMap", "sepia", "grayscale", "posterize", "dither", "halftone", "sharpen", "edgeDetect", "oldFilm", "nightVision", "invert",
	"scanline", "grain", "rain", "fog", "vignette", "spotlight", "speedLines", "letterbox",
	"pixelDissolve", "wipe", "irisWipe", "diamondWipe", "clockWipe", "blinds", "checkerWipe", "noiseFade", "burn", "tvOff", "fade",
];

// 효과별 기본 파라미터.
const DEFAULT_PARAMETER_TABLE = {
	lensDistortion: [0.35, 0, 0, 0],
	bulge: [0.5, 0.5, 0.5, 0.5],
	swirl: [0.5, 0.5, 0.6, 0.5],
	kaleidoscope: [6, 0, 0, 0],
	mirror: [0, 0, 0, 0],
	ripple: [0.5, 0.5, 40, 6],
	heatHaze: [6, 1.5, 0, 0],
	jitter: [8, 24, 0, 0],
	doubleVision: [0.02, 3, 0, 0],
	pixelate: [12, 0, 0, 0],
	shockwave: [0.5, 0.5, 0, 0.1],
	wave: [18, 4, 0, 0],
	motionBlur: [0, 24, 0, 0],
	zoomBlur: [0.5, 0.5, 0.35, 0],
	blur: [4, 0, 0, 0],
	tiltShift: [0.5, 0.18, 6, 0],
	godRays: [0.5, 0.35, 0.6, 0.94],
	bloom: [0.65, 1.2, 4, 0],
	anamorphic: [0.75, 1.5, 24, 0],
	glitch: [20, 10, 0.08, 0],
	vhs: [0.01, 0.35, 0, 0],
	chromatic: [1, 0, 0, 0],
	whiteBalance: [0.4, 0, 0, 0],
	liftGammaGain: [0, 1, 1, 0],
	colorGrade: [1, 1, 1, 0],
	hueShift: [1, 0, 0, 0],
	splitToning: [0.1, 0.15, 0.45, 0.5],
	tonemap: [1, 0, 0, 0],
	gradientMap: [0.05, 0.03, 0.2, 0],
	sepia: [0, 0, 0, 0],
	grayscale: [0, 0, 0, 0],
	posterize: [5, 0, 0, 0],
	dither: [4, 2, 0, 0],
	halftone: [6, 0, 0, 0],
	sharpen: [0, 0, 0, 0],
	edgeDetect: [0, 0, 0, 0],
	oldFilm: [0, 0, 0, 0],
	nightVision: [0, 0, 0, 0],
	invert: [0, 0, 0, 0],
	scanline: [0.15, 0.5, 0, 0],
	grain: [0, 0, 0, 0],
	rain: [90, 8, 1.6, 0],
	fog: [0.35, 1, 0, 0],
	vignette: [0.45, 1.1, 0, 0],
	spotlight: [0.5, 0.5, 0.25, 0.2],
	speedLines: [0.5, 0.5, 14, 6],
	letterbox: [0.12, 0, 0, 0],
	pixelDissolve: [24, 0, 0, 0],
	wipe: [1, 0, 0.05, 0],
	irisWipe: [0.5, 0.5, 0.05, 0],
	diamondWipe: [0.05, 0, 0, 0],
	clockWipe: [0.02, 0, 0, 0],
	blinds: [10, 0.05, 0, 0],
	checkerWipe: [10, 0, 0, 0],
	noiseFade: [5, 0.2, 0, 0],
	burn: [5, 0.06, 0, 0],
	tvOff: [0, 0, 0, 0],
	fade: [0, 0, 0, 0],
};

// 효과별 파라미터 이름. (타임라인 속성 "효과.이름" 으로 접근)
export const SCREEN_EFFECT_PARAMETER_NAMES = {
	lensDistortion: ["intensity"],
	bulge: ["centerX", "centerY", "intensity", "radius"],
	swirl: ["centerX", "centerY", "turns", "radius"],
	kaleidoscope: ["segments"],
	mirror: ["axis"],
	ripple: ["centerX", "centerY", "frequency", "speed"],
	heatHaze: ["scale", "speed"],
	jitter: ["amplitude", "rate"],
	doubleVision: ["offset", "speed"],
	pixelate: ["blockSize"],
	shockwave: ["centerX", "centerY", "radius", "width"],
	wave: ["frequency", "speed"],
	motionBlur: ["angle", "length"],
	zoomBlur: ["centerX", "centerY", "length"],
	blur: ["radius"],
	tiltShift: ["focusY", "focusWidth", "radius"],
	godRays: ["centerX", "centerY", "threshold", "decay"],
	bloom: ["threshold", "intensity", "radius"],
	anamorphic: ["threshold", "intensity", "width"],
	glitch: ["rows", "rate", "shift"],
	vhs: ["wobble", "noise"],
	chromatic: ["scale"],
	whiteBalance: ["temperature", "tint"],
	liftGammaGain: ["lift", "gamma", "gain"],
	colorGrade: ["contrast", "saturation", "brightness"],
	hueShift: ["turns"],
	splitToning: ["shadowRed", "shadowGreen", "shadowBlue", "balance"],
	tonemap: ["exposure"],
	gradientMap: ["darkRed", "darkGreen", "darkBlue"],
	sepia: [],
	grayscale: [],
	posterize: ["levels"],
	dither: ["levels", "pixelSize"],
	halftone: ["cellSize"],
	sharpen: [],
	edgeDetect: [],
	oldFilm: [],
	nightVision: [],
	invert: [],
	scanline: ["curvature", "density"],
	grain: [],
	rain: ["columns", "density", "speed"],
	fog: ["start", "end"],
	vignette: ["inner", "outer"],
	spotlight: ["centerX", "centerY", "radius", "softness"],
	speedLines: ["centerX", "centerY", "density", "speed"],
	letterbox: ["vertical", "horizontal"],
	pixelDissolve: ["blocks"],
	wipe: ["directionX", "directionY", "softness"],
	irisWipe: ["centerX", "centerY", "softness"],
	diamondWipe: ["softness"],
	clockWipe: ["softness"],
	blinds: ["count", "softness"],
	checkerWipe: ["cells"],
	noiseFade: ["scale", "softness"],
	burn: ["scale", "width"],
	tvOff: [],
	fade: [],
};

// 효과별 기본 색.
const DEFAULT_COLOR_TABLE = {
	shockwave: [1, 1, 1, 0.6],
	godRays: [1, 0.95, 0.8, 1],
	anamorphic: [0.5, 0.7, 1, 1],
	colorGrade: [1, 1, 1, 0],
	splitToning: [1, 0.85, 0.55, 1],
	gradientMap: [1, 0.9, 0.6, 1],
	edgeDetect: [1, 1, 1, 1],
	nightVision: [0.35, 1, 0.45, 1],
	rain: [0.8, 0.9, 1, 0.45],
	fog: [0.75, 0.8, 0.9, 1],
	vignette: [0, 0, 0, 1],
	spotlight: [0, 0, 0, 1],
	speedLines: [1, 1, 1, 0.8],
	letterbox: [0, 0, 0, 1],
	pixelDissolve: [0, 0, 0, 1],
	wipe: [0, 0, 0, 1],
	irisWipe: [0, 0, 0, 1],
	diamondWipe: [0, 0, 0, 1],
	clockWipe: [0, 0, 0, 1],
	blinds: [0, 0, 0, 1],
	checkerWipe: [0, 0, 0, 1],
	noiseFade: [0, 0, 0, 1],
	burn: [0, 0, 0, 1],
	tvOff: [0, 0, 0, 1],
	fade: [0, 0, 0, 1],
};

// 프래그먼트 셰이더 공통 머리. (효과 본문은 uv / color 를 다룬다)
const FRAGMENTSHADER_HEADER = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
uniform sampler2D sourceTexture;
uniform sampler2D auxiliaryTexture;
uniform vec2 resolution;
uniform float time;
uniform float strength;
uniform vec4 parameters;
uniform vec4 effectColor;
out vec4 outputColor;

float hash21(vec2 point) {
	vec3 scrambled = fract(vec3(point.xyx) * 0.1031);
	scrambled += dot(scrambled, scrambled.yzx + 33.33);
	return fract((scrambled.x + scrambled.y) * scrambled.z);
}

float valueNoise(vec2 point) {
	vec2 cell = floor(point);
	vec2 fraction = fract(point);
	vec2 blend = fraction * fraction * (3.0 - 2.0 * fraction);
	float bottom = mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), blend.x);
	float top = mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0, 1.0)), blend.x);
	return mix(bottom, top, blend.y);
}

vec4 sampleScreen(vec2 screenUv) {
	vec2 clamped = clamp(screenUv, 0.0, 1.0);
	return texture(sourceTexture, vec2(clamped.x, 1.0 - clamped.y));
}

float luminanceAt(vec2 uv) {
	return dot(texture(sourceTexture, uv).rgb, vec3(0.299, 0.587, 0.114));
}

void main() {
	vec2 uv = fragmentTextureCoordinate;
	vec2 screenUv = vec2(uv.x, 1.0 - uv.y);
	vec4 color = texture(sourceTexture, uv);
`;

const FRAGMENTSHADER_FOOTER = `
	outputColor = vec4(color.rgb, 1.0);
}
`;

// 효과별 프래그먼트 본문.
// - uv: 텍스처 좌표(아래가 0), screenUv: 화면 좌표(위가 0), color: 현재 색. sampleScreen(screenUv) 는 화면 좌표로 샘플.
const EFFECT_BODY_TABLE = {
	copy: ``,
	lensDistortion: `
	vec2 centered = uv - 0.5;
	float radiusSquared = dot(centered, centered);
	float distortion = parameters.x * strength;
	vec2 warped = uv + centered * radiusSquared * distortion;
	warped = 0.5 + (warped - 0.5) / (1.0 + 0.25 * max(distortion, 0.0));
	vec2 insideMask = step(vec2(0.0), warped) * step(warped, vec2(1.0));
	color = texture(sourceTexture, warped) * insideMask.x * insideMask.y;
	`,
	bulge: `
	float aspect = resolution.x / resolution.y;
	vec2 fromCenter = (screenUv - parameters.xy) * vec2(aspect, 1.0);
	float bulgeDistance = length(fromCenter) / max(parameters.w, 0.001);
	float bulgeFactor = 1.0 - parameters.z * strength * (1.0 - clamp(bulgeDistance, 0.0, 1.0));
	vec2 warpedScreen = parameters.xy + fromCenter * bulgeFactor / vec2(aspect, 1.0);
	color = sampleScreen(warpedScreen);
	`,
	swirl: `
	float aspect = resolution.x / resolution.y;
	vec2 fromCenter = (screenUv - parameters.xy) * vec2(aspect, 1.0);
	float swirlDistance = length(fromCenter) / max(parameters.w, 0.001);
	float swirlAngle = parameters.z * strength * 6.28318530718 * pow(1.0 - clamp(swirlDistance, 0.0, 1.0), 2.0);
	float cosine = cos(swirlAngle);
	float sine = sin(swirlAngle);
	vec2 rotated = vec2(fromCenter.x * cosine - fromCenter.y * sine, fromCenter.x * sine + fromCenter.y * cosine);
	color = sampleScreen(parameters.xy + rotated / vec2(aspect, 1.0));
	`,
	kaleidoscope: `
	float aspect = resolution.x / resolution.y;
	vec2 fromCenter = (screenUv - 0.5) * vec2(aspect, 1.0);
	float kaleidoRadius = length(fromCenter);
	float segmentAngle = 6.28318530718 / max(parameters.x, 1.0);
	float kaleidoAngle = atan(fromCenter.y, fromCenter.x);
	kaleidoAngle = abs(mod(kaleidoAngle, segmentAngle) - segmentAngle * 0.5);
	vec2 mirroredScreen = 0.5 + vec2(cos(kaleidoAngle), sin(kaleidoAngle)) * kaleidoRadius / vec2(aspect, 1.0);
	color = mix(color, sampleScreen(mirroredScreen), strength);
	`,
	mirror: `
	vec2 mirroredScreen = screenUv;
	if (parameters.x < 0.5) {
		mirroredScreen.x = screenUv.x < 0.5 ? screenUv.x : 1.0 - screenUv.x;
	}
	else {
		mirroredScreen.y = screenUv.y < 0.5 ? screenUv.y : 1.0 - screenUv.y;
	}
	color = mix(color, sampleScreen(mirroredScreen), step(0.5, strength));
	`,
	ripple: `
	float aspect = resolution.x / resolution.y;
	vec2 fromCenter = (screenUv - parameters.xy) * vec2(aspect, 1.0);
	float rippleDistance = length(fromCenter);
	float rippleWave = sin(rippleDistance * parameters.z - time * parameters.w) * strength * 0.012 / (1.0 + rippleDistance * 4.0);
	vec2 rippleDirection = rippleDistance > 0.0001 ? fromCenter / rippleDistance : vec2(0.0);
	color = sampleScreen(screenUv + rippleDirection * rippleWave / vec2(aspect, 1.0));
	`,
	heatHaze: `
	vec2 hazeOffset = vec2(valueNoise(uv * parameters.x + vec2(0.0, time * parameters.y)), valueNoise(uv * parameters.x + vec2(time * parameters.y, 7.3))) - 0.5;
	color = texture(sourceTexture, uv + hazeOffset * strength * 0.03);
	`,
	jitter: `
	float jitterSeed = floor(time * parameters.y);
	vec2 jitterOffset = (vec2(hash21(vec2(jitterSeed, 1.0)), hash21(vec2(jitterSeed, 2.0))) - 0.5) * parameters.x * strength / resolution;
	color = texture(sourceTexture, clamp(uv + jitterOffset, 0.0, 1.0));
	`,
	doubleVision: `
	vec2 visionOffset = vec2(sin(time * parameters.y) * parameters.x, cos(time * parameters.y * 0.7) * parameters.x * 0.5) * strength;
	color = (texture(sourceTexture, uv + visionOffset) + texture(sourceTexture, uv - visionOffset)) * 0.5;
	`,
	pixelate: `
	float block = max(1.0, parameters.x * strength);
	vec2 pixelUv = (floor(uv * resolution / block) + 0.5) * block / resolution;
	color = texture(sourceTexture, pixelUv);
	`,
	shockwave: `
	float aspect = resolution.x / resolution.y;
	vec2 delta = (screenUv - parameters.xy) * vec2(aspect, 1.0);
	float ringDistance = length(delta);
	float ringWidth = max(parameters.w, 0.001);
	float ring = 1.0 - smoothstep(0.0, ringWidth, abs(ringDistance - parameters.z));
	float wave = sin((ringDistance - parameters.z) / ringWidth * 3.14159265) * ring;
	vec2 direction = ringDistance > 0.0001 ? delta / ringDistance : vec2(0.0);
	vec2 uvDirection = vec2(direction.x, -direction.y);
	vec2 displaced = uv - uvDirection / vec2(aspect, 1.0) * wave * strength * 0.06;
	color = texture(sourceTexture, displaced);
	color.rgb += effectColor.rgb * ring * ring * strength * effectColor.a;
	`,
	wave: `
	vec2 displaced = uv + vec2(sin(uv.y * parameters.x + time * parameters.y), cos(uv.x * parameters.x * 0.7 + time * parameters.y * 0.8)) * strength * 0.012;
	color = texture(sourceTexture, displaced);
	`,
	motionBlur: `
	vec2 blurDirection = vec2(cos(parameters.x), -sin(parameters.x)) * parameters.y * strength / resolution;
	vec4 sum = vec4(0.0);
	for (int sampleIndex = 0; sampleIndex < 12; ++sampleIndex) {
		float offset = (float(sampleIndex) - 5.5) / 5.5;
		sum += texture(sourceTexture, uv + blurDirection * offset);
	}
	color = sum / 12.0;
	`,
	zoomBlur: `
	vec2 toCenter = (parameters.xy - screenUv) * strength * parameters.z;
	toCenter.y = -toCenter.y;
	vec4 sum = vec4(0.0);
	for (int sampleIndex = 0; sampleIndex < 12; ++sampleIndex) {
		sum += texture(sourceTexture, uv + toCenter * (float(sampleIndex) / 12.0));
	}
	color = sum / 12.0;
	`,
	blur: `
	vec2 blurStep = parameters.zw / resolution * parameters.x * strength;
	vec4 sum = color * 0.227027;
	sum += (texture(sourceTexture, uv + blurStep * 1.3846) + texture(sourceTexture, uv - blurStep * 1.3846)) * 0.3162162;
	sum += (texture(sourceTexture, uv + blurStep * 3.2307) + texture(sourceTexture, uv - blurStep * 3.2307)) * 0.0702703;
	color = sum;
	`,
	tiltShift: `
	float focusDistance = smoothstep(parameters.y * 0.5, parameters.y * 1.5, abs(screenUv.y - parameters.x));
	vec2 blurStep = parameters.zw / resolution * focusDistance * strength;
	vec4 sum = color * 0.227027;
	sum += (texture(sourceTexture, uv + blurStep * 1.3846) + texture(sourceTexture, uv - blurStep * 1.3846)) * 0.3162162;
	sum += (texture(sourceTexture, uv + blurStep * 3.2307) + texture(sourceTexture, uv - blurStep * 3.2307)) * 0.0702703;
	color = sum;
	`,
	godRays: `
	vec2 rayCenter = vec2(parameters.x, 1.0 - parameters.y);
	vec2 rayStep = (rayCenter - uv) / 16.0;
	vec3 rays = vec3(0.0);
	float weight = 1.0;
	vec2 sampleUv = uv;
	for (int sampleIndex = 0; sampleIndex < 16; ++sampleIndex) {
		sampleUv += rayStep;
		vec3 sampled = texture(sourceTexture, sampleUv).rgb;
		float luminance = dot(sampled, vec3(0.299, 0.587, 0.114));
		rays += sampled * smoothstep(parameters.z - 0.1, parameters.z + 0.1, luminance) * weight;
		weight *= parameters.w;
	}
	color.rgb += rays / 16.0 * effectColor.rgb * strength * 2.0;
	`,
	bloomBright: `
	float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
	float knee = smoothstep(parameters.x - 0.1, parameters.x + 0.1, luminance);
	color.rgb *= knee;
	`,
	bloomComposite: `
	vec3 bloom = texture(auxiliaryTexture, uv).rgb;
	color.rgb += bloom * strength * parameters.y;
	`,
	anamorphicComposite: `
	vec3 flare = texture(auxiliaryTexture, uv).rgb;
	color.rgb += flare * effectColor.rgb * strength * parameters.y;
	`,
	glitch: `
	float seed = floor(time * parameters.y);
	float row = floor(uv.y * parameters.x);
	float rowRandom = hash21(vec2(row, seed));
	float shift = step(0.8, rowRandom) * (hash21(vec2(seed, row)) - 0.5) * parameters.z * strength;
	vec2 shifted = uv + vec2(shift, 0.0);
	color = texture(sourceTexture, shifted);
	float split = strength * 0.012 * step(0.5, rowRandom);
	color.r = texture(sourceTexture, shifted + vec2(split, 0.0)).r;
	color.b = texture(sourceTexture, shifted - vec2(split, 0.0)).b;
	float blockNoise = step(0.93, hash21(floor(uv * vec2(8.0, 6.0)) + seed)) * strength;
	color.rgb = mix(color.rgb, 1.0 - color.rgb, blockNoise * 0.6);
	`,
	vhs: `
	float band = fract(time * 0.35);
	float bandMask = smoothstep(0.0, 0.05, abs(screenUv.y - band)) ;
	float wobble = (sin(time * 9.0 + uv.y * 40.0) * 0.5 + (1.0 - bandMask) * 3.0) * parameters.x * strength;
	vec2 shifted = uv + vec2(wobble, 0.0);
	color = texture(sourceTexture, shifted);
	color.r = texture(sourceTexture, shifted + vec2(0.006 * strength, 0.0)).r;
	color.b = texture(sourceTexture, shifted - vec2(0.006 * strength, 0.0)).b;
	float lineNoise = hash21(vec2(floor(uv.y * resolution.y * 0.5), floor(time * 30.0)));
	float noiseLine = step(1.0 - parameters.y * 0.08, lineNoise) * strength;
	color.rgb = mix(color.rgb, vec3(0.9), noiseLine * 0.6);
	float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
	color.rgb = mix(color.rgb, vec3(gray), 0.2 * strength);
	color.rgb += (hash21(uv * resolution + fract(time * 5.0) * 100.0) - 0.5) * parameters.y * 0.3 * strength;
	`,
	chromatic: `
	vec2 offset = (uv - 0.5) * strength * 0.03 * parameters.x;
	color.r = texture(sourceTexture, uv + offset).r;
	color.b = texture(sourceTexture, uv - offset).b;
	`,
	whiteBalance: `
	vec3 balanced = color.rgb * vec3(1.0 + parameters.x * 0.25, 1.0 + parameters.y * 0.15, 1.0 - parameters.x * 0.25);
	color.rgb = mix(color.rgb, clamp(balanced, 0.0, 1.0), strength);
	`,
	liftGammaGain: `
	vec3 graded = color.rgb * parameters.z + parameters.x * (1.0 - color.rgb);
	graded = pow(max(graded, vec3(0.0)), vec3(1.0 / max(parameters.y, 0.01)));
	color.rgb = mix(color.rgb, clamp(graded, 0.0, 1.0), strength);
	`,
	colorGrade: `
	float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
	vec3 graded = mix(vec3(gray), color.rgb, parameters.y);
	graded = (graded - 0.5) * parameters.x + 0.5;
	graded *= parameters.z;
	graded *= mix(vec3(1.0), effectColor.rgb, effectColor.a);
	color.rgb = mix(color.rgb, clamp(graded, 0.0, 1.0), strength);
	`,
	hueShift: `
	float hueAngle = strength * parameters.x * 6.28318530718;
	vec3 yiq = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312) * color.rgb;
	float chroma = length(yiq.yz);
	float hue = atan(yiq.z, yiq.y) + hueAngle;
	yiq.yz = vec2(cos(hue), sin(hue)) * chroma;
	color.rgb = clamp(mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703) * yiq, 0.0, 1.0);
	`,
	splitToning: `
	float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
	float highlightWeight = smoothstep(parameters.w - 0.3, parameters.w + 0.3, luminance);
	vec3 toned = color.rgb * mix(parameters.xyz * 2.0, effectColor.rgb * 2.0, highlightWeight);
	color.rgb = mix(color.rgb, clamp(mix(color.rgb, toned, 0.5), 0.0, 1.0), strength);
	`,
	tonemap: `
	vec3 exposed = color.rgb * parameters.x;
	vec3 mapped = (exposed * (2.51 * exposed + 0.03)) / (exposed * (2.43 * exposed + 0.59) + 0.14);
	color.rgb = mix(color.rgb, clamp(mapped, 0.0, 1.0), strength);
	`,
	gradientMap: `
	float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
	color.rgb = mix(color.rgb, mix(parameters.xyz, effectColor.rgb, gray), strength);
	`,
	sepia: `
	float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
	color.rgb = mix(color.rgb, gray * vec3(1.2, 1.0, 0.78), strength);
	`,
	grayscale: `
	float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
	color.rgb = mix(color.rgb, vec3(gray), strength);
	`,
	posterize: `
	float levels = max(parameters.x, 1.0);
	color.rgb = mix(color.rgb, floor(color.rgb * levels + 0.5) / levels, strength);
	`,
	dither: `
	float pixelSize = max(parameters.y, 1.0);
	vec2 pixelCell = floor(uv * resolution / pixelSize);
	vec3 sampled = texture(sourceTexture, (pixelCell + 0.5) * pixelSize / resolution).rgb;
	int bayerX = int(mod(pixelCell.x, 4.0));
	int bayerY = int(mod(pixelCell.y, 4.0));
	int bayerIndex = bayerX + bayerY * 4;
	float bayerValues[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
	float bayerThreshold = (bayerValues[bayerIndex] + 0.5) / 16.0 - 0.5;
	float levels = max(parameters.x, 2.0) - 1.0;
	vec3 dithered = floor(sampled * levels + bayerThreshold + 0.5) / levels;
	color.rgb = mix(color.rgb, clamp(dithered, 0.0, 1.0), strength);
	`,
	halftone: `
	float cellSize = max(parameters.x, 2.0);
	vec2 cell = floor(uv * resolution / cellSize);
	vec2 cellCenter = (cell + 0.5) * cellSize / resolution;
	vec3 sampled = texture(sourceTexture, cellCenter).rgb;
	float luminance = dot(sampled, vec3(0.299, 0.587, 0.114));
	float dotRadius = (1.0 - luminance) * 0.7;
	float cellDistance = length((uv * resolution / cellSize) - (cell + 0.5));
	float dotMask = 1.0 - smoothstep(dotRadius - 0.1, dotRadius + 0.1, cellDistance);
	vec3 halftoned = mix(vec3(1.0), vec3(0.05), dotMask);
	color.rgb = mix(color.rgb, halftoned * mix(vec3(1.0), sampled + 0.3, 0.4), strength);
	`,
	sharpen: `
	vec2 texel = 1.0 / resolution;
	vec3 neighbors = texture(sourceTexture, uv + vec2(texel.x, 0.0)).rgb + texture(sourceTexture, uv - vec2(texel.x, 0.0)).rgb + texture(sourceTexture, uv + vec2(0.0, texel.y)).rgb + texture(sourceTexture, uv - vec2(0.0, texel.y)).rgb;
	vec3 sharpened = clamp(color.rgb * 5.0 - neighbors, 0.0, 1.0);
	color.rgb = mix(color.rgb, sharpened, strength);
	`,
	edgeDetect: `
	vec2 texel = 1.0 / resolution;
	float gradientX = 0.0;
	float gradientY = 0.0;
	gradientX += luminanceAt(uv + vec2(-texel.x, -texel.y)) * -1.0 + luminanceAt(uv + vec2(texel.x, -texel.y));
	gradientX += luminanceAt(uv + vec2(-texel.x, 0.0)) * -2.0 + luminanceAt(uv + vec2(texel.x, 0.0)) * 2.0;
	gradientX += luminanceAt(uv + vec2(-texel.x, texel.y)) * -1.0 + luminanceAt(uv + vec2(texel.x, texel.y));
	gradientY += luminanceAt(uv + vec2(-texel.x, -texel.y)) * -1.0 + luminanceAt(uv + vec2(-texel.x, texel.y));
	gradientY += luminanceAt(uv + vec2(0.0, -texel.y)) * -2.0 + luminanceAt(uv + vec2(0.0, texel.y)) * 2.0;
	gradientY += luminanceAt(uv + vec2(texel.x, -texel.y)) * -1.0 + luminanceAt(uv + vec2(texel.x, texel.y));
	float edge = clamp(length(vec2(gradientX, gradientY)) * 2.0, 0.0, 1.0);
	color.rgb = mix(color.rgb, effectColor.rgb * edge, strength);
	`,
	oldFilm: `
	float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
	vec3 filmColor = gray * vec3(1.15, 1.0, 0.8);
	float grain = (hash21(uv * resolution + fract(time * 9.1) * 100.0) - 0.5) * 0.25;
	float scratchSeed = floor(time * 8.0);
	float scratchX = hash21(vec2(scratchSeed, 1.0));
	float scratch = (1.0 - smoothstep(0.0, 0.003, abs(uv.x - scratchX))) * step(0.6, hash21(vec2(scratchSeed, 3.0)));
	float flicker = 0.9 + 0.1 * hash21(vec2(floor(time * 12.0), 5.0));
	float vignette = 1.0 - smoothstep(0.5, 1.0, distance(uv, vec2(0.5)) * 1.4142) * 0.6;
	vec3 aged = (filmColor + grain + scratch * 0.8) * flicker * vignette;
	color.rgb = mix(color.rgb, clamp(aged, 0.0, 1.0), strength);
	`,
	nightVision: `
	float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
	float amplified = clamp(gray * 1.8 + 0.08, 0.0, 1.0);
	float noise = (hash21(uv * resolution + fract(time * 7.0) * 100.0) - 0.5) * 0.25;
	float lines = 0.9 + 0.1 * sin(uv.y * resolution.y * 1.5);
	float vignette = 1.0 - smoothstep(0.55, 1.0, distance(uv, vec2(0.5)) * 1.4142);
	vec3 visionColor = effectColor.rgb * (amplified + noise) * lines * vignette;
	color.rgb = mix(color.rgb, clamp(visionColor, 0.0, 1.0), strength);
	`,
	invert: `
	color.rgb = mix(color.rgb, vec3(1.0) - color.rgb, strength);
	`,
	scanline: `
	vec2 centered = uv - 0.5;
	float radiusSquared = dot(centered, centered);
	vec2 warped = uv + centered * radiusSquared * parameters.x * strength;
	vec2 insideMask = step(vec2(0.0), warped) * step(warped, vec2(1.0));
	color = texture(sourceTexture, warped) * insideMask.x * insideMask.y;
	float lines = 0.5 + 0.5 * sin(warped.y * resolution.y * 3.14159265 * parameters.y);
	color.rgb *= 1.0 - strength * 0.35 * lines;
	float maskPhase = warped.x * resolution.x * 2.0943951;
	color.rgb *= 1.0 + strength * 0.08 * vec3(sin(maskPhase), sin(maskPhase + 2.0943951), sin(maskPhase + 4.1887902));
	`,
	grain: `
	float grainValue = hash21(uv * resolution + fract(time * 7.13) * 100.0) - 0.5;
	color.rgb += grainValue * strength * 0.25;
	`,
	rain: `
	float column = floor(screenUv.x * parameters.x);
	float columnRandom = hash21(vec2(column, 1.0));
	float streakY = fract(screenUv.y * parameters.y * (0.6 + columnRandom * 0.8) - time * parameters.z * (0.8 + columnRandom * 0.6) + columnRandom * 7.0);
	float columnX = fract(screenUv.x * parameters.x);
	float streak = smoothstep(0.7, 1.0, streakY) * (1.0 - smoothstep(0.0, 0.25, abs(columnX - 0.5))) * step(0.35, columnRandom);
	color.rgb = mix(color.rgb, effectColor.rgb, streak * strength * effectColor.a);
	`,
	fog: `
	float fogMask = smoothstep(parameters.x, parameters.y, screenUv.y) * strength;
	color.rgb = mix(color.rgb, effectColor.rgb, fogMask * effectColor.a);
	`,
	vignette: `
	float vignetteDistance = distance(uv, vec2(0.5)) * 1.4142;
	float vignetteMask = smoothstep(parameters.x, parameters.y, vignetteDistance) * strength;
	color.rgb = mix(color.rgb, effectColor.rgb, vignetteMask * effectColor.a);
	`,
	spotlight: `
	float aspect = resolution.x / resolution.y;
	float spotDistance = length((screenUv - parameters.xy) * vec2(aspect, 1.0));
	float spotMask = smoothstep(parameters.z, parameters.z + max(parameters.w, 0.001), spotDistance) * strength;
	color.rgb = mix(color.rgb, effectColor.rgb, spotMask * effectColor.a);
	`,
	speedLines: `
	float aspect = resolution.x / resolution.y;
	vec2 delta = (screenUv - parameters.xy) * vec2(aspect, 1.0);
	float lineDistance = length(delta);
	float angle = atan(delta.y, delta.x);
	float streak = valueNoise(vec2(cos(angle), sin(angle)) * parameters.z + vec2(time * parameters.w, 0.0));
	float lineMask = smoothstep(0.55, 0.75, streak) * smoothstep(0.15, 0.6, lineDistance);
	color.rgb = mix(color.rgb, effectColor.rgb, lineMask * strength * effectColor.a);
	`,
	letterbox: `
	float bar = parameters.x * strength;
	float pillar = parameters.y * strength;
	float inside = step(bar, uv.y) * step(uv.y, 1.0 - bar) * step(pillar, uv.x) * step(uv.x, 1.0 - pillar);
	color.rgb = mix(effectColor.rgb, color.rgb, inside);
	`,
	pixelDissolve: `
	vec2 blockCell = floor(screenUv * vec2(parameters.x, parameters.x * resolution.y / resolution.x));
	float blockRandom = hash21(blockCell + 3.7);
	color.rgb = mix(color.rgb, effectColor.rgb, step(blockRandom, strength) * effectColor.a);
	`,
	wipe: `
	vec2 wipeDirection = normalize(parameters.xy + vec2(0.0001, 0.0));
	float wipeDistance = dot(screenUv - 0.5, wipeDirection) + 0.5;
	float softness = max(parameters.z, 0.0001);
	float cover = 1.0 - smoothstep(strength * (1.0 + softness) - softness, strength * (1.0 + softness), wipeDistance);
	color.rgb = mix(color.rgb, effectColor.rgb, cover * effectColor.a);
	`,
	irisWipe: `
	float aspect = resolution.x / resolution.y;
	float irisDistance = length((screenUv - parameters.xy) * vec2(aspect, 1.0));
	float softness = max(parameters.z, 0.0001);
	float visibleRadius = (1.0 - strength) * 0.9 * max(aspect, 1.0);
	float cover = smoothstep(visibleRadius, visibleRadius + softness, irisDistance);
	color.rgb = mix(color.rgb, effectColor.rgb, cover * effectColor.a);
	`,
	diamondWipe: `
	float diamondDistance = abs(screenUv.x - 0.5) + abs(screenUv.y - 0.5);
	float softness = max(parameters.x, 0.0001);
	float cover = 1.0 - smoothstep(strength * (1.0 + softness), strength * (1.0 + softness) + softness, diamondDistance);
	color.rgb = mix(color.rgb, effectColor.rgb, cover * effectColor.a);
	`,
	clockWipe: `
	vec2 fromCenter = screenUv - 0.5;
	float clockAngle = (atan(fromCenter.x, -fromCenter.y) + 3.14159265) / 6.28318530718;
	float softness = max(parameters.x, 0.0001);
	float cover = 1.0 - smoothstep(strength, strength + softness, clockAngle);
	color.rgb = mix(color.rgb, effectColor.rgb, cover * effectColor.a);
	`,
	blinds: `
	float stripe = fract(screenUv.y * parameters.x);
	float softness = max(parameters.y, 0.0001);
	float cover = 1.0 - smoothstep(strength, strength + softness, stripe);
	color.rgb = mix(color.rgb, effectColor.rgb, cover * effectColor.a);
	`,
	checkerWipe: `
	vec2 checkerCell = floor(screenUv * vec2(parameters.x, parameters.x * resolution.y / resolution.x));
	float parity = mod(checkerCell.x + checkerCell.y, 2.0);
	float cellThreshold = parity * 0.5 + hash21(checkerCell + 1.3) * 0.5;
	color.rgb = mix(color.rgb, effectColor.rgb, step(cellThreshold, strength * 1.0001) * effectColor.a);
	`,
	noiseFade: `
	float fadeNoise = valueNoise(screenUv * vec2(parameters.x * resolution.x / resolution.y, parameters.x) + 2.1);
	float softness = max(parameters.y, 0.001);
	float cover = 1.0 - smoothstep(strength * (1.0 + softness) - softness, strength * (1.0 + softness), fadeNoise);
	color.rgb = mix(color.rgb, effectColor.rgb, cover * effectColor.a);
	`,
	burn: `
	float burnNoise = valueNoise(screenUv * vec2(parameters.x * resolution.x / resolution.y, parameters.x) + 5.3);
	float threshold = strength * (1.0 + parameters.y * 4.0) - parameters.y * 2.0;
	float burned = 1.0 - step(threshold, burnNoise);
	float innerBand = smoothstep(threshold, threshold + parameters.y, burnNoise);
	float outerBand = smoothstep(threshold + parameters.y, threshold + parameters.y * 2.0, burnNoise);
	vec3 emberColor = vec3(1.0, 0.55, 0.15);
	vec3 sootColor = vec3(0.05, 0.02, 0.01);
	vec3 burning = mix(emberColor, mix(sootColor, color.rgb, outerBand), innerBand);
	color.rgb = mix(burning, effectColor.rgb, burned * effectColor.a);
	`,
	tvOff: `
	float collapse = max(1.0 - strength, 0.0);
	float squeeze = max(collapse * collapse, 0.002);
	float centeredY = (screenUv.y - 0.5) / squeeze + 0.5;
	float widthSqueeze = smoothstep(0.0, 0.15, collapse);
	float centeredX = (screenUv.x - 0.5) / max(widthSqueeze, 0.002) + 0.5;
	float inside = step(0.0, centeredY) * step(centeredY, 1.0) * step(0.0, centeredX) * step(centeredX, 1.0);
	vec3 collapsed = sampleScreen(vec2(centeredX, centeredY)).rgb * (1.0 + (1.0 - collapse) * 2.0);
	float glowLine = (1.0 - smoothstep(0.0, 0.01 + squeeze * 0.5, abs(screenUv.y - 0.5))) * (1.0 - collapse) * step(0.02, widthSqueeze);
	color.rgb = mix(effectColor.rgb, collapsed, inside) + vec3(glowLine);
	color.rgb = mix(color.rgb, effectColor.rgb, step(0.999, strength));
	`,
	fade: `
	color.rgb = mix(color.rgb, effectColor.rgb, strength * effectColor.a);
	`,
	regionComposite: `
	vec4 original = texture(auxiliaryTexture, uv);
	vec2 pixel = uv * resolution;
	vec2 halfSize = resolution * 0.5;
	float cornerRadius = min(parameters.x, min(halfSize.x, halfSize.y));
	vec2 cornerOffset = abs(pixel - halfSize) - (halfSize - cornerRadius);
	float cornerDistance = length(max(cornerOffset, 0.0)) + min(max(cornerOffset.x, cornerOffset.y), 0.0) - cornerRadius;
	float inside = 1.0 - smoothstep(-0.75, 0.75, cornerDistance);
	color = mix(original, color, inside);
	`,
};


//==============================================================================
// 색 텍스처 생성. (RGBA8 — 화면 사본은 RGB8: 기본 프레임버퍼(alpha: false)에서 copyTexSubImage2D 로 떠 오려면 성분이 같아야 한다)
//==============================================================================
/**
 * @param { WebGL2RenderingContext } webGL2RenderingContext
 * @param { number } width
 * @param { number } height
 * @param { boolean } isOpaque
 * @returns { WebGLTexture }
 */
function createColorTexture(webGL2RenderingContext, width, height, isOpaque = false) {
	const texture = webGL2RenderingContext.createTexture();
	webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
	if (isOpaque) {
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGB8, width, height, 0, webGL2RenderingContext.RGB, webGL2RenderingContext.UNSIGNED_BYTE, null);
	}
	else {
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA8, width, height, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, null);
	}
	webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.LINEAR);
	webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.LINEAR);
	webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
	webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
	return texture;
}


//==============================================================================
// 렌더 대상 생성. (색 텍스처 + 필요하면 스텐실 렌더버퍼)
//==============================================================================
/**
 * @param { WebGL2RenderingContext } webGL2RenderingContext
 * @param { number } width
 * @param { number } height
 * @param { boolean } useStencil
 * @param { boolean } isOpaque
 * @returns { object }
 */
function createRenderTarget(webGL2RenderingContext, width, height, useStencil, isOpaque = false) {
	const texture = createColorTexture(webGL2RenderingContext, width, height, isOpaque);
	const framebuffer = webGL2RenderingContext.createFramebuffer();
	webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, framebuffer);
	webGL2RenderingContext.framebufferTexture2D(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.COLOR_ATTACHMENT0, webGL2RenderingContext.TEXTURE_2D, texture, 0);
	let stencilRenderbuffer = null;
	if (useStencil) {
		stencilRenderbuffer = webGL2RenderingContext.createRenderbuffer();
		webGL2RenderingContext.bindRenderbuffer(webGL2RenderingContext.RENDERBUFFER, stencilRenderbuffer);
		webGL2RenderingContext.renderbufferStorage(webGL2RenderingContext.RENDERBUFFER, webGL2RenderingContext.DEPTH24_STENCIL8, width, height);
		webGL2RenderingContext.framebufferRenderbuffer(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.DEPTH_STENCIL_ATTACHMENT, webGL2RenderingContext.RENDERBUFFER, stencilRenderbuffer);
	}
	webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, null);
	return { framebuffer: framebuffer, texture: texture, stencilRenderbuffer: stencilRenderbuffer, width: width, height: height };
}


//==============================================================================
// 렌더 대상 파괴.
//==============================================================================
/**
 * @param { WebGL2RenderingContext } webGL2RenderingContext
 * @param { object | null } renderTarget
 */
function destroyRenderTarget(webGL2RenderingContext, renderTarget) {
	if (!renderTarget) {
		return;
	}
	webGL2RenderingContext.deleteFramebuffer(renderTarget.framebuffer);
	webGL2RenderingContext.deleteTexture(renderTarget.texture);
	if (renderTarget.stencilRenderbuffer) {
		webGL2RenderingContext.deleteRenderbuffer(renderTarget.stencilRenderbuffer);
	}
}


//==============================================================================
// 화면 효과. (씬 후처리 사슬)
// - 씬은 화면에 그대로 그리고, end() 에서 화면(또는 setRegion 으로 정한 영역)을 떠 와 켜진 효과를 차례로 건 뒤 같은 자리에 되돌려 놓는다.
// - 영역은 캔버스 픽셀 좌표(왼쪽 위 원점)이며 둥근 모서리 반지름을 주면 그 바깥은 원본을 유지한다.
// - 사용:
//     // 씬 load 에서
//     this.screenEffect = new ScreenEffect(engine.getGraphic());
//     this.screenEffect.setEnabled(ScreenEffectType.vignette, true);
//     // preDraw 처음 / postDraw 끝에서
//     this.screenEffect.begin(graphic);  ...  this.screenEffect.end(graphic);
//     // tick 에서
//     this.screenEffect.tick(timeDelta);
//==============================================================================
export class ScreenEffect extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { System.Map } */ #passTable;
	/** @private @type { System.Map } */ #effectTable;
	/** @private @type { object | null } */ #sceneTarget;
	/** @private @type { object | null } */ #pingTarget;
	/** @private @type { object | null } */ #pongTarget;
	/** @private @type { object | null } */ #halfTargetA;
	/** @private @type { object | null } */ #halfTargetB;
	/** @private @type { number } */ #time;
	/** @private @type { boolean } */ #isBound;
	/** @private @type { object | null } */ #region;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	constructor(graphic) {
		super();
		this.#webGL2RenderingContext = graphic.getWebGL2RenderingContext();
		this.#passTable = new System.Map();
		this.#effectTable = new System.Map();
		this.#sceneTarget = null;
		this.#pingTarget = null;
		this.#pongTarget = null;
		this.#halfTargetA = null;
		this.#halfTargetB = null;
		this.#time = 0;
		this.#isBound = false;
		this.#region = null;
		this.resetAll();
	}

	//==============================================================================
	// 전부 기본값으로. (끄고, 세기 1, 파라미터 / 색 기본 — 모드 전환 때 이전 설정이 남지 않게)
	//==============================================================================
	resetAll() {
		for (const effectType of EFFECT_ORDER) {
			const defaultParameters = DEFAULT_PARAMETER_TABLE[effectType];
			const defaultColor = DEFAULT_COLOR_TABLE[effectType] ? DEFAULT_COLOR_TABLE[effectType] : [1, 1, 1, 1];
			this.#effectTable.set(effectType, {
				isEnabled: false,
				strength: 1,
				parameters: [defaultParameters[0], defaultParameters[1], defaultParameters[2], defaultParameters[3]],
				color: new Color(defaultColor[0], defaultColor[1], defaultColor[2], defaultColor[3]),
			});
		}
	}

	//==============================================================================
	// 적용 영역 설정. (캔버스 픽셀, 왼쪽 위 원점 — null 이면 화면 전체)
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @param { number } width
	 * @param { number } height
	 * @param { number } cornerRadius - 둥근 모서리 반지름(픽셀). 0 이면 사각형.
	 */
	setRegion(x, y, width, height, cornerRadius = 0) {
		this.#region = { x: x, y: y, width: width, height: height, cornerRadius: System.Math.max(0, cornerRadius) };
	}

	//==============================================================================
	// 적용 영역 해제. (화면 전체)
	//==============================================================================
	clearRegion() {
		this.#region = null;
	}

	//==============================================================================
	// 적용 영역 반환.
	//==============================================================================
	/**
	 * @returns { object | null }
	 */
	getRegion() {
		return this.#region;
	}

	//==============================================================================
	// 갱신. (애니메이션 효과의 시간)
	//==============================================================================
	/**
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		this.#time += timeDelta;
	}

	//==============================================================================
	// 시작. (씬 preDraw 첫머리 — 씬은 화면에 그대로 그린다. 켜진 효과가 있을 때만 end 가 일한다)
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	begin(graphic) {
		this.#isBound = this.hasActiveEffect();
	}

	//==============================================================================
	// 효과 적용. (씬 postDraw 끝 — 화면의 영역을 떠 와 효과를 걸고 같은 자리에 되돌려 놓는다)
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	end(graphic) {
		if (!this.#isBound) {
			return;
		}
		this.#isBound = false;
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const bufferWidth = webGL2RenderingContext.drawingBufferWidth;
		const bufferHeight = webGL2RenderingContext.drawingBufferHeight;
		if (bufferWidth <= 0 || bufferHeight <= 0) {
			return;
		}

		// 영역 결정. (버퍼 안으로 자른다)
		let regionX = 0;
		let regionY = 0;
		let regionWidth = bufferWidth;
		let regionHeight = bufferHeight;
		let cornerRadius = 0;
		if (this.#region) {
			regionX = System.Math.max(0, System.Math.round(this.#region.x));
			regionY = System.Math.max(0, System.Math.round(this.#region.y));
			regionWidth = System.Math.min(bufferWidth - regionX, System.Math.round(this.#region.width));
			regionHeight = System.Math.min(bufferHeight - regionY, System.Math.round(this.#region.height));
			cornerRadius = this.#region.cornerRadius;
		}
		if (regionWidth <= 0 || regionHeight <= 0) {
			return;
		}
		const width = regionWidth;
		const height = regionHeight;
		this.ensureTargets(width, height);

		// 화면 영역 → 씬 대상 복사. (GL 은 아래가 0. 기본 프레임버퍼는 멀티샘플 / 무알파라 blitFramebuffer 대신 copyTexSubImage2D 로 RGB8 텍스처에 떠 온다)
		const glRegionY = bufferHeight - (regionY + regionHeight);
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, null);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, this.#sceneTarget.texture);
		webGL2RenderingContext.copyTexSubImage2D(webGL2RenderingContext.TEXTURE_2D, 0, 0, 0, regionX, glRegionY, width, height);
		webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.disable(webGL2RenderingContext.STENCIL_TEST);

		// 켜진 효과를 패스 단계 목록으로 편다. (블러는 가로 / 세로 2단계, 블룸은 밝기 추출 → 하프 블러 2단계 → 합성)
		const stepList = [];
		for (const effectType of EFFECT_ORDER) {
			const effectState = this.#effectTable.get(effectType);
			if (!effectState.isEnabled || effectState.strength <= 0) {
				continue;
			}
			if (effectType === "blur") {
				stepList.push({ passName: "blur", state: effectState, parameters: [effectState.parameters[0], 0, 1, 0], target: "pingpong" });
				stepList.push({ passName: "blur", state: effectState, parameters: [effectState.parameters[0], 0, 0, 1], target: "pingpong" });
				continue;
			}
			if (effectType === "bloom") {
				stepList.push({ passName: "bloomBright", state: effectState, parameters: effectState.parameters, target: "halfA" });
				stepList.push({ passName: "blur", state: effectState, parameters: [effectState.parameters[2], 0, 1, 0], target: "halfB", source: "halfA" });
				stepList.push({ passName: "blur", state: effectState, parameters: [effectState.parameters[2], 0, 0, 1], target: "halfA", source: "halfB" });
				stepList.push({ passName: "bloomComposite", state: effectState, parameters: effectState.parameters, target: "pingpong", auxiliary: "halfA", source: "previous" });
				continue;
			}
			if (effectType === "anamorphic") {
				stepList.push({ passName: "bloomBright", state: effectState, parameters: effectState.parameters, target: "halfA" });
				stepList.push({ passName: "blur", state: effectState, parameters: [effectState.parameters[2], 0, 1, 0], target: "halfB", source: "halfA" });
				stepList.push({ passName: "blur", state: effectState, parameters: [effectState.parameters[2] * 0.5, 0, 1, 0], target: "halfA", source: "halfB" });
				stepList.push({ passName: "anamorphicComposite", state: effectState, parameters: effectState.parameters, target: "pingpong", auxiliary: "halfA", source: "previous" });
				continue;
			}
			if (effectType === "tiltShift") {
				stepList.push({ passName: "tiltShift", state: effectState, parameters: [effectState.parameters[0], effectState.parameters[1], effectState.parameters[2], 0], target: "pingpong" });
				stepList.push({ passName: "tiltShift", state: effectState, parameters: [effectState.parameters[0], effectState.parameters[1], 0, effectState.parameters[2]], target: "pingpong" });
				continue;
			}
			stepList.push({ passName: effectType, state: effectState, parameters: effectState.parameters, target: "pingpong" });
		}
		if (stepList.length === 0) {
			stepList.push({ passName: "copy", state: null, parameters: [0, 0, 0, 0], target: "pingpong" });
		}
		// 둥근 모서리 영역이면 마지막에 원본과 합성한다. (모서리 바깥은 원본 그대로)
		if (cornerRadius > 0) {
			stepList.push({ passName: "regionComposite", state: null, parameters: [cornerRadius, 0, 0, 0], target: "pingpong", auxiliary: "scene" });
		}

		// 마지막 화면 출력 단계를 찾는다. (하프 대상에 그리는 단계는 화면이 될 수 없다)
		let lastScreenIndex = -1;
		for (let stepIndex = 0; stepIndex < stepList.length; ++stepIndex) {
			if (stepList[stepIndex].target === "pingpong") {
				lastScreenIndex = stepIndex;
			}
		}

		let previousTexture = this.#sceneTarget.texture;
		let pingPongTurn = 0;
		for (let stepIndex = 0; stepIndex < stepList.length; ++stepIndex) {
			const step = stepList[stepIndex];
			const pass = this.resolvePass(step.passName);

			// 대상 바인드.
			let targetTexture = null;
			if (stepIndex === lastScreenIndex) {
				webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, null);
				webGL2RenderingContext.viewport(regionX, glRegionY, width, height);
				webGL2RenderingContext.enable(webGL2RenderingContext.SCISSOR_TEST);
				webGL2RenderingContext.scissor(regionX, glRegionY, width, height);
			}
			else if (step.target === "halfA" || step.target === "halfB") {
				const halfTarget = step.target === "halfA" ? this.#halfTargetA : this.#halfTargetB;
				webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, halfTarget.framebuffer);
				webGL2RenderingContext.viewport(0, 0, halfTarget.width, halfTarget.height);
				targetTexture = halfTarget.texture;
			}
			else {
				const pingPongTarget = (pingPongTurn % 2 === 0) ? this.#pingTarget : this.#pongTarget;
				pingPongTurn += 1;
				webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, pingPongTarget.framebuffer);
				webGL2RenderingContext.viewport(0, 0, width, height);
				targetTexture = pingPongTarget.texture;
			}

			// 소스 결정. (하프 단계는 지정한 하프 텍스처, 블룸 합성은 마지막 전체 해상도 결과)
			let sourceTexture = previousTexture;
			if (step.source === "halfA") {
				sourceTexture = this.#halfTargetA.texture;
			}
			else if (step.source === "halfB") {
				sourceTexture = this.#halfTargetB.texture;
			}
			const isHalfTarget = (step.target === "halfA" || step.target === "halfB");
			const passWidth = isHalfTarget ? this.#halfTargetA.width : width;
			const passHeight = isHalfTarget ? this.#halfTargetA.height : height;

			pass.use();
			webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, sourceTexture);
			webGL2RenderingContext.uniform1i(pass.getUniformLocation("sourceTexture"), 0);
			if (step.auxiliary) {
				let auxiliaryTexture = this.#halfTargetB.texture;
				if (step.auxiliary === "halfA") {
					auxiliaryTexture = this.#halfTargetA.texture;
				}
				else if (step.auxiliary === "scene") {
					auxiliaryTexture = this.#sceneTarget.texture;
				}
				webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE1);
				webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, auxiliaryTexture);
				webGL2RenderingContext.uniform1i(pass.getUniformLocation("auxiliaryTexture"), 1);
				webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
			}
			webGL2RenderingContext.uniform2f(pass.getUniformLocation("resolution"), passWidth, passHeight);
			webGL2RenderingContext.uniform1f(pass.getUniformLocation("time"), this.#time);
			const strength = step.state ? step.state.strength : 1;
			webGL2RenderingContext.uniform1f(pass.getUniformLocation("strength"), strength);
			webGL2RenderingContext.uniform4f(pass.getUniformLocation("parameters"), step.parameters[0], step.parameters[1], step.parameters[2], step.parameters[3]);
			const color = step.state ? step.state.color : Color.white();
			webGL2RenderingContext.uniform4f(pass.getUniformLocation("effectColor"), color.red, color.green, color.blue, color.alpha);
			pass.draw();

			// 하프 단계는 전체 해상도 사슬의 "이전 결과" 를 바꾸지 않는다.
			if (!isHalfTarget) {
				previousTexture = targetTexture;
			}
		}

		webGL2RenderingContext.disable(webGL2RenderingContext.SCISSOR_TEST);
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, null);
		webGL2RenderingContext.bindVertexArray(null);
		graphic.restoreRenderState();
	}

	//==============================================================================
	// 켜진 효과 여부. (세기 0 은 꺼진 것으로 본다)
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	hasActiveEffect() {
		for (const effectState of this.#effectTable.values()) {
			if (effectState.isEnabled && effectState.strength > 0) {
				return true;
			}
		}
		return false;
	}

	//==============================================================================
	// 렌더 대상 준비. (크기가 바뀌면 다시 만든다)
	//==============================================================================
	/**
	 * @param { number } width
	 * @param { number } height
	 */
	ensureTargets(width, height) {
		if (this.#sceneTarget && this.#sceneTarget.width === width && this.#sceneTarget.height === height) {
			return;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		destroyRenderTarget(webGL2RenderingContext, this.#sceneTarget);
		destroyRenderTarget(webGL2RenderingContext, this.#pingTarget);
		destroyRenderTarget(webGL2RenderingContext, this.#pongTarget);
		destroyRenderTarget(webGL2RenderingContext, this.#halfTargetA);
		destroyRenderTarget(webGL2RenderingContext, this.#halfTargetB);
		const halfWidth = System.Math.max(1, System.Math.round(width / 2));
		const halfHeight = System.Math.max(1, System.Math.round(height / 2));
		this.#sceneTarget = createRenderTarget(webGL2RenderingContext, width, height, false, true);
		this.#pingTarget = createRenderTarget(webGL2RenderingContext, width, height, false);
		this.#pongTarget = createRenderTarget(webGL2RenderingContext, width, height, false);
		this.#halfTargetA = createRenderTarget(webGL2RenderingContext, halfWidth, halfHeight, false);
		this.#halfTargetB = createRenderTarget(webGL2RenderingContext, halfWidth, halfHeight, false);
	}

	//==============================================================================
	// 패스 반환. (없으면 컴파일)
	//==============================================================================
	/**
	 * @param { string } passName
	 * @returns { FullscreenPass }
	 */
	resolvePass(passName) {
		let pass = this.#passTable.get(passName);
		if (!pass) {
			const fragmentShaderSource = FRAGMENTSHADER_HEADER + EFFECT_BODY_TABLE[passName] + FRAGMENTSHADER_FOOTER;
			pass = new FullscreenPass(this.#webGL2RenderingContext, fragmentShaderSource);
			this.#passTable.set(passName, pass);
		}
		return pass;
	}

	//==============================================================================
	// 효과 켜기 / 끄기.
	//==============================================================================
	/**
	 * @param { string } effectType
	 * @param { boolean } isEnabled
	 */
	setEnabled(effectType, isEnabled) {
		const effectState = this.#effectTable.get(effectType);
		if (effectState) {
			effectState.isEnabled = isEnabled;
		}
	}

	//==============================================================================
	// 효과 켜짐 여부 반환.
	//==============================================================================
	/**
	 * @param { string } effectType
	 * @returns { boolean }
	 */
	isEnabled(effectType) {
		const effectState = this.#effectTable.get(effectType);
		return effectState ? effectState.isEnabled : false;
	}

	//==============================================================================
	// 세기 설정. (0 이면 꺼진 것과 같다)
	//==============================================================================
	/**
	 * @param { string } effectType
	 * @param { number } strength
	 */
	setStrength(effectType, strength) {
		const effectState = this.#effectTable.get(effectType);
		if (effectState) {
			effectState.strength = strength;
		}
	}

	//==============================================================================
	// 세기 반환.
	//==============================================================================
	/**
	 * @param { string } effectType
	 * @returns { number }
	 */
	getStrength(effectType) {
		const effectState = this.#effectTable.get(effectType);
		return effectState ? effectState.strength : 0;
	}

	//==============================================================================
	// 파라미터 설정. (효과마다 뜻이 다르다 — ScreenEffectType 주석 참고)
	//==============================================================================
	/**
	 * @param { string } effectType
	 * @param { number } x
	 * @param { number } y
	 * @param { number } z
	 * @param { number } w
	 */
	setParameters(effectType, x, y = 0, z = 0, w = 0) {
		const effectState = this.#effectTable.get(effectType);
		if (effectState) {
			effectState.parameters = [x, y, z, w];
		}
	}

	//==============================================================================
	// 파라미터 하나 설정. (이름은 SCREEN_EFFECT_PARAMETER_NAMES)
	//==============================================================================
	/**
	 * @param { string } effectType
	 * @param { string } parameterName
	 * @param { number } value
	 */
	setParameter(effectType, parameterName, value) {
		const effectState = this.#effectTable.get(effectType);
		const parameterNames = SCREEN_EFFECT_PARAMETER_NAMES[effectType];
		if (!effectState || !parameterNames) {
			return;
		}
		const parameterIndex = parameterNames.indexOf(parameterName);
		if (parameterIndex >= 0) {
			effectState.parameters[parameterIndex] = value;
		}
	}

	//==============================================================================
	// 파라미터 반환.
	//==============================================================================
	/**
	 * @param { string } effectType
	 * @returns { number[] }
	 */
	getParameters(effectType) {
		const effectState = this.#effectTable.get(effectType);
		return effectState ? effectState.parameters : [0, 0, 0, 0];
	}

	//==============================================================================
	// 색 설정.
	//==============================================================================
	/**
	 * @param { string } effectType
	 * @param { Color } color
	 */
	setColor(effectType, color) {
		const effectState = this.#effectTable.get(effectType);
		if (effectState && color) {
			effectState.color = color.clone();
		}
	}

	//==============================================================================
	// 색 반환.
	//==============================================================================
	/**
	 * @param { string } effectType
	 * @returns { Color }
	 */
	getColor(effectType) {
		const effectState = this.#effectTable.get(effectType);
		return effectState ? effectState.color : Color.white();
	}

	//==============================================================================
	// 전부 끄기.
	//==============================================================================
	disableAll() {
		for (const effectState of this.#effectTable.values()) {
			effectState.isEnabled = false;
		}
	}

	//==============================================================================
	// 타임라인 속성 적용. ("vignette" = 세기(0 이면 끔), "shockwave.radius" = 파라미터, "fade.color" = 색)
	//==============================================================================
	/**
	 * @param { string } propertyName
	 * @param { * } value
	 */
	setTimelineProperty(propertyName, value) {
		const separatorIndex = propertyName.indexOf(".");
		const effectType = separatorIndex >= 0 ? propertyName.substring(0, separatorIndex) : propertyName;
		const memberName = separatorIndex >= 0 ? propertyName.substring(separatorIndex + 1) : "";
		const effectState = this.#effectTable.get(effectType);
		if (!effectState) {
			return;
		}
		if (memberName === "") {
			const strength = System.Number(value);
			effectState.strength = strength;
			effectState.isEnabled = strength > 0;
			return;
		}
		if (memberName === "color") {
			effectState.color = (typeof value === "string") ? Color.createFromHEX(value) : effectState.color;
			return;
		}
		if (memberName === "enabled") {
			effectState.isEnabled = value === true || value === "true";
			return;
		}
		this.setParameter(effectType, memberName, System.Number(value));
	}

	//==============================================================================
	// 시간 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getTime() {
		return this.#time;
	}

	//==============================================================================
	// 씬 텍스처 반환. (end 이후 — 마지막 프레임에 떠 온 영역 원본)
	//==============================================================================
	/**
	 * @returns { WebGLTexture | null }
	 */
	getSceneTexture() {
		return this.#sceneTarget ? this.#sceneTarget.texture : null;
	}

	//==============================================================================
	// 적용 차례 반환. (정적)
	//==============================================================================
	/**
	 * @returns { string[] }
	 */
	static getEffectOrder() {
		return EFFECT_ORDER.slice();
	}

	//==============================================================================
	// 파괴. (WebGL 자원 해제)
	//==============================================================================
	destroy() {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		destroyRenderTarget(webGL2RenderingContext, this.#sceneTarget);
		destroyRenderTarget(webGL2RenderingContext, this.#pingTarget);
		destroyRenderTarget(webGL2RenderingContext, this.#pongTarget);
		destroyRenderTarget(webGL2RenderingContext, this.#halfTargetA);
		destroyRenderTarget(webGL2RenderingContext, this.#halfTargetB);
		this.#sceneTarget = null;
		this.#pingTarget = null;
		this.#pongTarget = null;
		this.#halfTargetA = null;
		this.#halfTargetB = null;
		super.destroy();
	}
}
