//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Color } from "../base/color.js";
import { Rect } from "../base/rect.js";
import { Graphic } from "../core/graphic.js";
import { Sprite } from "../core/component/sprite.js";
import { ShaderProgram } from "../core/graphic/shaderprogram.js";


//==============================================================================
// 셰이더 스프라이트 효과 종류.
//==============================================================================
export const ShaderSpriteEffect = {
	none: "none",
	// --- 색 ---
	flash: "flash",                 // 실루엣을 단색으로 덮음. (피격 섬광 — progress = 세기, color = 덮을 색)
	silhouette: "silhouette",       // 실루엣 단색. (progress = 세기, color = 색 — 그림자 / 잔상)
	colorize: "colorize",           // 곱셈 틴트. (progress = 세기, color = 곱할 색)
	grayscale: "grayscale",         // 무채색. (progress = 세기, color = 틴트)
	sepia: "sepia",                 // 세피아.
	invert: "invert",               // 색 반전.
	hueShift: "hueShift",           // 색상 회전. (progress 0 → 1 = 0 → 360도)
	colorAdjust: "colorAdjust",     // 대비 / 채도 / 밝기. (parameters = [대비, 채도, 밝기], progress = 적용 비율)
	posterize: "posterize",         // 포스터화. (parameters = [단계 수])
	threshold: "threshold",         // 흑백 문턱. (parameters = [문턱])
	gradientMap: "gradientMap",     // 밝기를 두 색 사이로 매핑. (parameters.xyz = 어두운 색, color = 밝은 색)
	// --- 외곽 ---
	outline: "outline",             // 실루엣 바깥 외곽선. (color = 선 색, parameters = [두께 픽셀])
	innerOutline: "innerOutline",   // 실루엣 안쪽 외곽선. (color = 선 색, parameters = [두께 픽셀])
	glow: "glow",                   // 바깥 발광. (color = 빛 색, parameters = [반지름 픽셀])
	innerGlow: "innerGlow",         // 안쪽 발광. (color = 빛 색, parameters = [반지름 픽셀])
	shadow: "shadow",               // 드롭 섀도. (color = 그림자 색, parameters = [오프셋 x 픽셀, 오프셋 y 픽셀])
	edgeDetect: "edgeDetect",       // 윤곽 검출. (color = 선 색)
	emboss: "emboss",               // 엠보스.
	sharpen: "sharpen",             // 샤픈.
	// --- 흐림 ---
	blur: "blur",                   // 가우시안 블러. (parameters = [반지름 픽셀])
	motionBlur: "motionBlur",       // 방향 블러. (parameters = [방향 x, 방향 y, 길이 픽셀])
	radialBlur: "radialBlur",       // 중심 방사 블러. (parameters = [길이 0 ~ 1])
	// --- 왜곡 ---
	wave: "wave",                   // 가로 물결 왜곡. (parameters = [빈도, 속도, 진폭])
	flag: "flag",                   // 깃발 펄럭임. (parameters = [빈도, 속도, 진폭])
	ripple: "ripple",               // 중심 파문. (parameters = [빈도, 속도, 진폭])
	heatHaze: "heatHaze",           // 아지랑이. (parameters = [노이즈 배율, 속도, 진폭])
	bulge: "bulge",                 // 볼록 / 오목. (parameters = [세기 — 음수면 오목])
	swirl: "swirl",                 // 소용돌이. (parameters = [회전 수])
	mirror: "mirror",               // 좌우 대칭. (parameters = [0 가로 / 1 세로])
	kaleidoscope: "kaleidoscope",   // 만화경. (parameters = [조각 수])
	jitter: "jitter",               // 흔들림. (parameters = [진폭 픽셀, 초당 변화])
	pixelate: "pixelate",           // 모자이크. (parameters = [가장 거친 블록 수])
	glitch: "glitch",               // 가로 줄 어긋남 + 색 분리. (parameters = [줄 수, 초당 변화, 어긋남 폭])
	chromatic: "chromatic",         // 색수차. (parameters = [분리 픽셀])
	// --- 화면 무늬 ---
	hologram: "hologram",           // 주사선 + 틴트 + 깜빡임. (color = 틴트, parameters = [주사선 수, 흐르는 속도])
	scanlines: "scanlines",         // 주사선. (parameters = [주사선 수])
	oldFilm: "oldFilm",             // 낡은 필름. (세피아 + 그레인 + 스크래치 + 깜빡임)
	vignette: "vignette",           // 비네트. (color = 가장자리 색, parameters = [시작, 끝])
	shine: "shine",                 // 대각선 하이라이트 띠가 지나감. (color = 띠 색, parameters = [띠 폭])
	// --- 사라짐 / 드러남 (progress 0 → 1) ---
	dissolve: "dissolve",           // 노이즈로 타 들어가며 사라짐. (color = 가장자리 색, parameters = [노이즈 배율, 가장자리 폭])
	burn: "burn",                   // 불에 타듯 사라짐. (안쪽 밝은 띠 + 바깥 그을음, parameters = [노이즈 배율, 띠 폭])
	noiseFade: "noiseFade",         // 노이즈 알파 페이드. (parameters = [노이즈 배율, 부드러움])
	pixelDissolve: "pixelDissolve", // 블록 단위로 사라짐. (parameters = [블록 수])
	wipe: "wipe",                   // 방향 와이프로 드러남. (parameters = [방향 x, 방향 y, 부드러움])
	iris: "iris",                   // 원형 아이리스로 드러남. (parameters = [중심 x, 중심 y, 부드러움])
	diamondWipe: "diamondWipe",     // 마름모 와이프. (parameters = [부드러움])
	clockWipe: "clockWipe",         // 시계 방향 와이프. (parameters = [부드러움])
	blinds: "blinds",               // 블라인드. (parameters = [줄 수, 부드러움])
	checkerWipe: "checkerWipe",     // 체커 보드. (parameters = [칸 수])
};

// 효과별 기본 파라미터.
const DEFAULT_PARAMETER_TABLE = {
	none: [0, 0, 0, 0],
	flash: [0, 0, 0, 0],
	silhouette: [0, 0, 0, 0],
	colorize: [0, 0, 0, 0],
	grayscale: [0, 0, 0, 0],
	sepia: [0, 0, 0, 0],
	invert: [0, 0, 0, 0],
	hueShift: [0, 0, 0, 0],
	colorAdjust: [1.4, 1.3, 1.1, 0],
	posterize: [4, 0, 0, 0],
	threshold: [0.5, 0, 0, 0],
	gradientMap: [0.1, 0.05, 0.25, 0],
	outline: [2, 0, 0, 0],
	innerOutline: [2, 0, 0, 0],
	glow: [6, 0, 0, 0],
	innerGlow: [5, 0, 0, 0],
	shadow: [6, 6, 0, 0],
	edgeDetect: [0, 0, 0, 0],
	emboss: [0, 0, 0, 0],
	sharpen: [0, 0, 0, 0],
	blur: [3, 0, 0, 0],
	motionBlur: [1, 0, 12, 0],
	radialBlur: [0.12, 0, 0, 0],
	wave: [12, 4, 0.03, 0],
	flag: [8, 5, 0.06, 0],
	ripple: [40, 6, 0.02, 0],
	heatHaze: [6, 1.5, 0.02, 0],
	bulge: [0.6, 0, 0, 0],
	swirl: [1, 0, 0, 0],
	mirror: [0, 0, 0, 0],
	kaleidoscope: [6, 0, 0, 0],
	jitter: [4, 24, 0, 0],
	pixelate: [24, 0, 0, 0],
	glitch: [18, 12, 0.15, 0],
	chromatic: [3, 0, 0, 0],
	hologram: [120, 6, 0, 0],
	scanlines: [90, 0, 0, 0],
	oldFilm: [0, 0, 0, 0],
	vignette: [0.4, 1, 0, 0],
	shine: [0.15, 0, 0, 0],
	dissolve: [8, 0.08, 0, 0],
	burn: [8, 0.06, 0, 0],
	noiseFade: [6, 0.2, 0, 0],
	pixelDissolve: [16, 0, 0, 0],
	wipe: [1, 0, 0.05, 0],
	iris: [0.5, 0.5, 0.05, 0],
	diamondWipe: [0.05, 0, 0, 0],
	clockWipe: [0.02, 0, 0, 0],
	blinds: [8, 0.05, 0, 0],
	checkerWipe: [8, 0, 0, 0],
};

// 효과별 기본 색.
const DEFAULT_COLOR_TABLE = {
	none: [1, 1, 1, 1],
	flash: [1, 1, 1, 1],
	silhouette: [0, 0, 0, 1],
	colorize: [1, 0.5, 0.5, 1],
	grayscale: [1, 1, 1, 1],
	sepia: [1, 1, 1, 1],
	invert: [1, 1, 1, 1],
	hueShift: [1, 1, 1, 1],
	colorAdjust: [1, 1, 1, 1],
	posterize: [1, 1, 1, 1],
	threshold: [1, 1, 1, 1],
	gradientMap: [1, 0.85, 0.5, 1],
	outline: [1, 1, 1, 1],
	innerOutline: [1, 1, 1, 1],
	glow: [1, 0.85, 0.4, 1],
	innerGlow: [1, 0.85, 0.4, 1],
	shadow: [0, 0, 0, 0.6],
	edgeDetect: [1, 1, 1, 1],
	emboss: [1, 1, 1, 1],
	sharpen: [1, 1, 1, 1],
	blur: [1, 1, 1, 1],
	motionBlur: [1, 1, 1, 1],
	radialBlur: [1, 1, 1, 1],
	wave: [1, 1, 1, 1],
	flag: [1, 1, 1, 1],
	ripple: [1, 1, 1, 1],
	heatHaze: [1, 1, 1, 1],
	bulge: [1, 1, 1, 1],
	swirl: [1, 1, 1, 1],
	mirror: [1, 1, 1, 1],
	kaleidoscope: [1, 1, 1, 1],
	jitter: [1, 1, 1, 1],
	pixelate: [1, 1, 1, 1],
	glitch: [1, 1, 1, 1],
	chromatic: [1, 1, 1, 1],
	hologram: [0.4, 0.9, 1, 1],
	scanlines: [1, 1, 1, 1],
	oldFilm: [1, 1, 1, 1],
	vignette: [0, 0, 0, 1],
	shine: [1, 1, 1, 1],
	dissolve: [1, 0.6, 0.2, 1],
	burn: [1, 0.7, 0.25, 1],
	noiseFade: [1, 1, 1, 1],
	pixelDissolve: [1, 1, 1, 1],
	wipe: [1, 1, 1, 1],
	iris: [1, 1, 1, 1],
	diamondWipe: [1, 1, 1, 1],
	clockWipe: [1, 1, 1, 1],
	blinds: [1, 1, 1, 1],
	checkerWipe: [1, 1, 1, 1],
};

// 효과별 프래그먼트 본문. (uv / local / textureColor 를 바꾸거나 다시 샘플한다 — 텍스처는 프리멀티플라이드 알파)
// - 공용: sampleSprite(uv) / sampleLocal(local) / unpremultiply(color) / luminanceAt(uv) / hash21 / valueNoise.
const EFFECT_BODY_TABLE = {
	flash: `
	textureColor.rgb = mix(textureColor.rgb, effectColor.rgb * textureColor.a, effectProgress * effectColor.a);
	`,
	silhouette: `
	textureColor.rgb = mix(textureColor.rgb, effectColor.rgb * textureColor.a, effectProgress);
	textureColor *= mix(1.0, effectColor.a, effectProgress);
	`,
	colorize: `
	textureColor.rgb *= mix(vec3(1.0), effectColor.rgb, effectProgress * effectColor.a);
	`,
	grayscale: `
	float gray = dot(textureColor.rgb, vec3(0.299, 0.587, 0.114));
	textureColor.rgb = mix(textureColor.rgb, vec3(gray) * effectColor.rgb, effectProgress);
	`,
	sepia: `
	float gray = dot(textureColor.rgb, vec3(0.299, 0.587, 0.114));
	textureColor.rgb = mix(textureColor.rgb, gray * vec3(1.2, 1.0, 0.78), effectProgress);
	`,
	invert: `
	textureColor.rgb = mix(textureColor.rgb, vec3(textureColor.a) - textureColor.rgb, effectProgress);
	`,
	hueShift: `
	float hueAngle = effectProgress * 6.28318530718;
	vec3 yiq = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312) * textureColor.rgb;
	float chroma = length(yiq.yz);
	float hue = atan(yiq.z, yiq.y) + hueAngle;
	yiq.yz = vec2(cos(hue), sin(hue)) * chroma;
	textureColor.rgb = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703) * yiq;
	`,
	colorAdjust: `
	vec3 straight = unpremultiply(textureColor);
	float gray = dot(straight, vec3(0.299, 0.587, 0.114));
	vec3 adjusted = mix(vec3(gray), straight, effectParameters.y);
	adjusted = (adjusted - 0.5) * effectParameters.x + 0.5;
	adjusted *= effectParameters.z;
	textureColor.rgb = mix(textureColor.rgb, clamp(adjusted, 0.0, 1.0) * textureColor.a, effectProgress);
	`,
	posterize: `
	vec3 straight = unpremultiply(textureColor);
	float levels = max(effectParameters.x, 1.0);
	vec3 posterized = floor(straight * levels + 0.5) / levels;
	textureColor.rgb = mix(textureColor.rgb, posterized * textureColor.a, effectProgress);
	`,
	threshold: `
	vec3 straight = unpremultiply(textureColor);
	float gray = dot(straight, vec3(0.299, 0.587, 0.114));
	vec3 binary = vec3(step(effectParameters.x, gray)) * effectColor.rgb;
	textureColor.rgb = mix(textureColor.rgb, binary * textureColor.a, effectProgress);
	`,
	gradientMap: `
	vec3 straight = unpremultiply(textureColor);
	float gray = dot(straight, vec3(0.299, 0.587, 0.114));
	vec3 mapped = mix(effectParameters.xyz, effectColor.rgb, gray);
	textureColor.rgb = mix(textureColor.rgb, mapped * textureColor.a, effectProgress);
	`,
	outline: `
	vec2 outlineStep = texelSize * effectParameters.x;
	float neighborAlpha = 0.0;
	for (int sampleIndex = 0; sampleIndex < 8; ++sampleIndex) {
		float angle = float(sampleIndex) * 0.78539816;
		neighborAlpha = max(neighborAlpha, sampleSprite(uv + vec2(cos(angle), sin(angle)) * outlineStep).a);
	}
	float outlineMask = clamp(neighborAlpha - textureColor.a, 0.0, 1.0) * effectProgress * effectColor.a;
	textureColor.rgb += effectColor.rgb * outlineMask;
	textureColor.a += outlineMask;
	`,
	innerOutline: `
	vec2 outlineStep = texelSize * effectParameters.x;
	float minimumAlpha = 1.0;
	for (int sampleIndex = 0; sampleIndex < 8; ++sampleIndex) {
		float angle = float(sampleIndex) * 0.78539816;
		minimumAlpha = min(minimumAlpha, sampleSprite(uv + vec2(cos(angle), sin(angle)) * outlineStep).a);
	}
	float edgeMask = clamp(textureColor.a - minimumAlpha, 0.0, 1.0) * effectProgress * effectColor.a;
	textureColor.rgb = mix(textureColor.rgb, effectColor.rgb * textureColor.a, edgeMask);
	`,
	glow: `
	float alphaSum = 0.0;
	for (int sampleIndex = 0; sampleIndex < 12; ++sampleIndex) {
		float angle = float(sampleIndex) * 0.52359878;
		vec2 offset = vec2(cos(angle), sin(angle)) * texelSize * effectParameters.x;
		alphaSum += sampleSprite(uv + offset).a;
		alphaSum += sampleSprite(uv + offset * 0.5).a;
	}
	float glowAlpha = clamp(alphaSum / 24.0 * 1.5, 0.0, 1.0) * (1.0 - textureColor.a) * effectProgress * effectColor.a;
	textureColor.rgb += effectColor.rgb * glowAlpha;
	textureColor.a += glowAlpha;
	`,
	innerGlow: `
	float alphaSum = 0.0;
	for (int sampleIndex = 0; sampleIndex < 12; ++sampleIndex) {
		float angle = float(sampleIndex) * 0.52359878;
		vec2 offset = vec2(cos(angle), sin(angle)) * texelSize * effectParameters.x;
		alphaSum += sampleSprite(uv + offset).a;
		alphaSum += sampleSprite(uv + offset * 0.5).a;
	}
	float glowMask = clamp(1.0 - alphaSum / 24.0, 0.0, 1.0) * textureColor.a * effectProgress * effectColor.a;
	textureColor.rgb = mix(textureColor.rgb, effectColor.rgb * textureColor.a, glowMask);
	`,
	shadow: `
	vec2 shadowOffset = effectParameters.xy * texelSize;
	float shadowAlpha = sampleSprite(uv - shadowOffset).a * effectColor.a * effectProgress * (1.0 - textureColor.a);
	textureColor.rgb += effectColor.rgb * shadowAlpha;
	textureColor.a += shadowAlpha;
	`,
	edgeDetect: `
	float gradientX = 0.0;
	float gradientY = 0.0;
	gradientX += luminanceAt(uv + vec2(-texelSize.x, -texelSize.y)) * -1.0 + luminanceAt(uv + vec2(texelSize.x, -texelSize.y));
	gradientX += luminanceAt(uv + vec2(-texelSize.x, 0.0)) * -2.0 + luminanceAt(uv + vec2(texelSize.x, 0.0)) * 2.0;
	gradientX += luminanceAt(uv + vec2(-texelSize.x, texelSize.y)) * -1.0 + luminanceAt(uv + vec2(texelSize.x, texelSize.y));
	gradientY += luminanceAt(uv + vec2(-texelSize.x, -texelSize.y)) * -1.0 + luminanceAt(uv + vec2(-texelSize.x, texelSize.y));
	gradientY += luminanceAt(uv + vec2(0.0, -texelSize.y)) * -2.0 + luminanceAt(uv + vec2(0.0, texelSize.y)) * 2.0;
	gradientY += luminanceAt(uv + vec2(texelSize.x, -texelSize.y)) * -1.0 + luminanceAt(uv + vec2(texelSize.x, texelSize.y));
	float edge = clamp(length(vec2(gradientX, gradientY)) * 2.0, 0.0, 1.0);
	textureColor = mix(textureColor, vec4(effectColor.rgb * edge, edge) * effectColor.a, effectProgress);
	`,
	emboss: `
	vec3 lower = sampleSprite(uv - texelSize).rgb;
	vec3 upper = sampleSprite(uv + texelSize).rgb;
	float relief = dot(upper - lower, vec3(0.299, 0.587, 0.114)) * 2.0 + 0.5;
	textureColor.rgb = mix(textureColor.rgb, vec3(clamp(relief, 0.0, 1.0)) * textureColor.a, effectProgress);
	`,
	sharpen: `
	vec4 neighbors = sampleSprite(uv + vec2(texelSize.x, 0.0)) + sampleSprite(uv - vec2(texelSize.x, 0.0)) + sampleSprite(uv + vec2(0.0, texelSize.y)) + sampleSprite(uv - vec2(0.0, texelSize.y));
	vec4 sharpened = clamp(textureColor * 5.0 - neighbors, 0.0, 1.0);
	textureColor = mix(textureColor, sharpened, effectProgress);
	`,
	blur: `
	vec2 blurStep = texelSize * effectParameters.x * effectProgress;
	vec4 sum = vec4(0.0);
	for (int y = -1; y <= 1; ++y) {
		for (int x = -1; x <= 1; ++x) {
			float weight = (x == 0 && y == 0) ? 4.0 : ((x == 0 || y == 0) ? 2.0 : 1.0);
			sum += sampleSprite(uv + vec2(float(x), float(y)) * blurStep) * weight;
		}
	}
	textureColor = sum / 16.0;
	`,
	motionBlur: `
	vec2 blurDirection = normalize(effectParameters.xy + vec2(0.0001, 0.0)) * texelSize * effectParameters.z * effectProgress;
	vec4 sum = vec4(0.0);
	for (int sampleIndex = 0; sampleIndex < 8; ++sampleIndex) {
		float offset = (float(sampleIndex) - 3.5) / 3.5;
		sum += sampleSprite(uv + blurDirection * offset);
	}
	textureColor = sum / 8.0;
	`,
	radialBlur: `
	vec2 toCenter = (vec2(0.5) - local) * effectParameters.x * effectProgress;
	vec4 sum = vec4(0.0);
	for (int sampleIndex = 0; sampleIndex < 8; ++sampleIndex) {
		sum += sampleLocal(local + toCenter * (float(sampleIndex) / 8.0));
	}
	textureColor = sum / 8.0;
	`,
	wave: `
	float waveOffset = sin(local.y * effectParameters.x + effectTime * effectParameters.y) * effectParameters.z * effectProgress;
	textureColor = sampleLocal(local + vec2(waveOffset, 0.0));
	`,
	flag: `
	float flagOffset = sin(local.x * effectParameters.x - effectTime * effectParameters.y) * effectParameters.z * effectProgress * local.x;
	textureColor = sampleLocal(local + vec2(0.0, flagOffset));
	`,
	ripple: `
	vec2 fromCenter = local - 0.5;
	float rippleDistance = length(fromCenter);
	float rippleWave = sin(rippleDistance * effectParameters.x - effectTime * effectParameters.y) * effectParameters.z * effectProgress;
	vec2 rippleDirection = rippleDistance > 0.0001 ? fromCenter / rippleDistance : vec2(0.0);
	textureColor = sampleLocal(local + rippleDirection * rippleWave);
	`,
	heatHaze: `
	vec2 hazeOffset = vec2(valueNoise(local * effectParameters.x + vec2(0.0, effectTime * effectParameters.y)), valueNoise(local * effectParameters.x + vec2(effectTime * effectParameters.y, 7.3))) - 0.5;
	textureColor = sampleLocal(local + hazeOffset * effectParameters.z * effectProgress);
	`,
	bulge: `
	vec2 fromCenter = local - 0.5;
	float bulgeRadius = length(fromCenter) * 2.0;
	float bulgeFactor = 1.0 - effectParameters.x * effectProgress * (1.0 - clamp(bulgeRadius, 0.0, 1.0));
	textureColor = sampleLocal(0.5 + fromCenter * bulgeFactor);
	`,
	swirl: `
	vec2 fromCenter = local - 0.5;
	float swirlRadius = length(fromCenter) * 2.0;
	float swirlAngle = effectParameters.x * effectProgress * 6.28318530718 * pow(1.0 - clamp(swirlRadius, 0.0, 1.0), 2.0);
	float cosine = cos(swirlAngle);
	float sine = sin(swirlAngle);
	textureColor = sampleLocal(0.5 + vec2(fromCenter.x * cosine - fromCenter.y * sine, fromCenter.x * sine + fromCenter.y * cosine));
	`,
	mirror: `
	vec2 mirrored = local;
	if (effectParameters.x < 0.5) {
		mirrored.x = local.x < 0.5 ? local.x : 1.0 - local.x;
	}
	else {
		mirrored.y = local.y < 0.5 ? local.y : 1.0 - local.y;
	}
	textureColor = mix(textureColor, sampleLocal(mirrored), step(0.5, effectProgress));
	`,
	kaleidoscope: `
	vec2 fromCenter = local - 0.5;
	float kaleidoRadius = length(fromCenter);
	float segmentAngle = 6.28318530718 / max(effectParameters.x, 1.0);
	float kaleidoAngle = atan(fromCenter.y, fromCenter.x);
	kaleidoAngle = abs(mod(kaleidoAngle, segmentAngle) - segmentAngle * 0.5);
	vec4 kaleidoColor = sampleLocal(0.5 + vec2(cos(kaleidoAngle), sin(kaleidoAngle)) * kaleidoRadius);
	textureColor = mix(textureColor, kaleidoColor, effectProgress);
	`,
	jitter: `
	float jitterSeed = floor(effectTime * effectParameters.y) + effectSeed;
	vec2 jitterOffset = (vec2(hash21(vec2(jitterSeed, 1.0)), hash21(vec2(jitterSeed, 2.0))) - 0.5) * effectParameters.x * effectProgress;
	textureColor = sampleSprite(uv + jitterOffset * texelSize);
	`,
	pixelate: `
	float blockCount = mix(512.0, max(1.0, effectParameters.x), effectProgress);
	vec2 blockLocal = (floor(local * blockCount) + 0.5) / blockCount;
	textureColor = sampleLocal(blockLocal);
	`,
	glitch: `
	float glitchSeed = floor(effectTime * effectParameters.y) + effectSeed;
	float glitchRow = floor(local.y * effectParameters.x);
	float rowRandom = hash21(vec2(glitchRow, glitchSeed));
	float shift = step(0.75, rowRandom) * (hash21(vec2(glitchSeed, glitchRow)) - 0.5) * effectParameters.z * effectProgress;
	vec2 shiftedLocal = local + vec2(shift, 0.0);
	textureColor = sampleLocal(shiftedLocal);
	float split = effectProgress * 0.02 * step(0.5, rowRandom);
	textureColor.r = sampleLocal(shiftedLocal + vec2(split, 0.0)).r;
	textureColor.b = sampleLocal(shiftedLocal - vec2(split, 0.0)).b;
	`,
	chromatic: `
	vec2 chromaticStep = vec2(texelSize.x * effectParameters.x * effectProgress, 0.0);
	textureColor.r = sampleSprite(uv + chromaticStep).r;
	textureColor.b = sampleSprite(uv - chromaticStep).b;
	`,
	hologram: `
	float scan = 0.7 + 0.3 * sin(local.y * effectParameters.x - effectTime * effectParameters.y);
	float flicker = 0.92 + 0.08 * sin(effectTime * 23.0 + effectSeed);
	float jitter = step(0.97, hash21(vec2(floor(effectTime * 14.0), effectSeed))) * 0.03;
	vec4 jitterColor = sampleLocal(local + vec2(jitter, 0.0));
	textureColor = mix(textureColor, jitterColor, effectProgress);
	float luminance = dot(textureColor.rgb, vec3(0.299, 0.587, 0.114));
	vec3 holoColor = effectColor.rgb * (luminance * 0.6 + textureColor.a * 0.4) * scan * flicker;
	textureColor.rgb = mix(textureColor.rgb, holoColor, effectProgress * effectColor.a);
	textureColor.a *= mix(1.0, 0.8 * scan, effectProgress);
	`,
	scanlines: `
	float lines = 0.5 + 0.5 * sin(local.y * effectParameters.x);
	textureColor.rgb *= 1.0 - effectProgress * 0.5 * lines;
	`,
	oldFilm: `
	float gray = dot(textureColor.rgb, vec3(0.299, 0.587, 0.114));
	vec3 filmColor = gray * vec3(1.15, 1.0, 0.8);
	float grain = (hash21(local * 300.0 + fract(effectTime * 9.1) * 100.0) - 0.5) * 0.25 * textureColor.a;
	float scratchSeed = floor(effectTime * 8.0);
	float scratchX = hash21(vec2(scratchSeed, effectSeed));
	float scratch = (1.0 - smoothstep(0.0, 0.006, abs(local.x - scratchX))) * step(0.6, hash21(vec2(scratchSeed, 3.0))) * textureColor.a;
	float flicker = 0.9 + 0.1 * hash21(vec2(floor(effectTime * 12.0), 5.0));
	float vignette = 1.0 - smoothstep(0.5, 1.0, distance(local, vec2(0.5)) * 1.4142) * 0.6;
	vec3 aged = (filmColor + grain + scratch * 0.8) * flicker * vignette;
	textureColor.rgb = mix(textureColor.rgb, clamp(aged, 0.0, 1.0), effectProgress);
	`,
	vignette: `
	float vignetteDistance = distance(local, vec2(0.5)) * 1.4142;
	float vignetteMask = smoothstep(effectParameters.x, effectParameters.y, vignetteDistance) * effectProgress * effectColor.a;
	textureColor.rgb = mix(textureColor.rgb, effectColor.rgb * textureColor.a, vignetteMask);
	`,
	shine: `
	float band = local.x * 0.8 + local.y * 0.5;
	float bandCenter = mix(-0.4, 1.7, effectProgress);
	float glow = 1.0 - smoothstep(0.0, max(effectParameters.x, 0.001), abs(band - bandCenter));
	textureColor.rgb += effectColor.rgb * glow * glow * textureColor.a * effectColor.a;
	`,
	dissolve: `
	float dissolveNoise = valueNoise(local * effectParameters.x + vec2(effectSeed * 17.0, effectSeed * 31.0));
	float threshold = effectProgress * (1.0 + effectParameters.y * 2.0) - effectParameters.y;
	float edge = smoothstep(threshold, threshold + effectParameters.y, dissolveNoise);
	float keep = step(threshold, dissolveNoise);
	vec3 edgeColor = effectColor.rgb * textureColor.a * effectColor.a;
	textureColor.rgb = mix(edgeColor, textureColor.rgb, edge) * keep;
	textureColor.a *= keep;
	`,
	burn: `
	float burnNoise = valueNoise(local * effectParameters.x + vec2(effectSeed * 13.0, effectSeed * 29.0));
	float threshold = effectProgress * (1.0 + effectParameters.y * 4.0) - effectParameters.y * 2.0;
	float keep = step(threshold, burnNoise);
	float innerBand = smoothstep(threshold, threshold + effectParameters.y, burnNoise);
	float outerBand = smoothstep(threshold + effectParameters.y, threshold + effectParameters.y * 2.0, burnNoise);
	vec3 emberColor = effectColor.rgb * textureColor.a * effectColor.a;
	vec3 sootColor = vec3(0.05, 0.02, 0.01) * textureColor.a;
	textureColor.rgb = mix(emberColor, mix(sootColor, textureColor.rgb, outerBand), innerBand) * keep;
	textureColor.a *= keep;
	`,
	noiseFade: `
	float fadeNoise = valueNoise(local * effectParameters.x + vec2(effectSeed * 11.0, effectSeed * 23.0));
	float softness = max(effectParameters.y, 0.001);
	float fadeMask = smoothstep(effectProgress * (1.0 + softness) - softness, effectProgress * (1.0 + softness), fadeNoise);
	textureColor *= fadeMask;
	`,
	pixelDissolve: `
	vec2 blockCell = floor(local * effectParameters.x);
	float blockRandom = hash21(blockCell + effectSeed);
	textureColor *= step(effectProgress, blockRandom);
	`,
	wipe: `
	vec2 wipeDirection = normalize(effectParameters.xy + vec2(0.0001, 0.0));
	float wipeDistance = dot(local - 0.5, wipeDirection) + 0.5;
	float softness = max(effectParameters.z, 0.0001);
	float reveal = 1.0 - smoothstep(effectProgress * (1.0 + softness) - softness, effectProgress * (1.0 + softness), wipeDistance);
	textureColor *= reveal;
	`,
	iris: `
	float irisRadius = effectProgress * 0.7072;
	float softness = max(effectParameters.z, 0.0001);
	float reveal = 1.0 - smoothstep(irisRadius, irisRadius + softness, distance(local, effectParameters.xy));
	textureColor *= reveal;
	`,
	diamondWipe: `
	float diamondDistance = abs(local.x - 0.5) + abs(local.y - 0.5);
	float softness = max(effectParameters.x, 0.0001);
	float reveal = 1.0 - smoothstep(effectProgress * (1.0 + softness), effectProgress * (1.0 + softness) + softness, diamondDistance);
	textureColor *= reveal;
	`,
	clockWipe: `
	vec2 fromCenter = local - 0.5;
	float clockAngle = (atan(fromCenter.x, -fromCenter.y) + 3.14159265) / 6.28318530718;
	float softness = max(effectParameters.x, 0.0001);
	float reveal = 1.0 - smoothstep(effectProgress, effectProgress + softness, clockAngle);
	textureColor *= reveal;
	`,
	blinds: `
	float stripe = fract(local.y * effectParameters.x);
	float softness = max(effectParameters.y, 0.0001);
	float reveal = 1.0 - smoothstep(effectProgress, effectProgress + softness, stripe);
	textureColor *= reveal;
	`,
	checkerWipe: `
	vec2 checkerCell = floor(local * effectParameters.x);
	float parity = mod(checkerCell.x + checkerCell.y, 2.0);
	float cellThreshold = parity * 0.5 + hash21(checkerCell + effectSeed) * 0.5;
	textureColor *= step(cellThreshold, effectProgress * 1.0001);
	`,
};

// 버텍스 셰이더. (Graphic 기본 프로그램과 동일)
const VERTEXSHADER_SOURCE = `#version 300 es
in vec2 vertexPosition;
in vec2 vertexTextureCoordinate;
uniform mat3 projectionMatrix;
uniform mat3 modelMatrix;
out vec2 fragmentTextureCoordinate;
void main() {
	vec3 transformedPosition = projectionMatrix * (modelMatrix * vec3(vertexPosition, 1.0));
	gl_Position = vec4(transformedPosition.xy, 0.0, 1.0);
	fragmentTextureCoordinate = vertexTextureCoordinate;
}
`;

// 프래그먼트 셰이더 틀. (효과 본문을 EFFECT_BODY 자리에 끼운다)
const FRAGMENTSHADER_TEMPLATE = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
uniform sampler2D mainTexture;
uniform vec4 mainColor;
uniform vec4 tintColor;
uniform float globalAlpha;
uniform float effectTime;
uniform float effectProgress;
uniform float effectSeed;
uniform vec4 effectColor;
uniform vec4 effectParameters;
uniform vec4 textureRect;
uniform vec2 texelSize;
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

vec4 sampleSprite(vec2 uv) {
	if (uv.x < textureRect.x || uv.x > textureRect.z || uv.y < textureRect.y || uv.y > textureRect.w) {
		return vec4(0.0);
	}
	return texture(mainTexture, uv);
}

vec4 sampleLocal(vec2 local) {
	if (local.x < 0.0 || local.x > 1.0 || local.y < 0.0 || local.y > 1.0) {
		return vec4(0.0);
	}
	return texture(mainTexture, textureRect.xy + local * (textureRect.zw - textureRect.xy));
}

vec3 unpremultiply(vec4 color) {
	return color.rgb / max(color.a, 0.0001);
}

float luminanceAt(vec2 uv) {
	vec4 sampled = sampleSprite(uv);
	return dot(sampled.rgb, vec3(0.299, 0.587, 0.114));
}

void main() {
	vec2 uv = fragmentTextureCoordinate;
	vec2 local = (uv - textureRect.xy) / max(textureRect.zw - textureRect.xy, vec2(0.000001));
	vec4 textureColor = sampleSprite(uv);
	EFFECT_BODY
	vec3 tintedColor = mix(textureColor.rgb, tintColor.rgb * textureColor.a, tintColor.a);
	float finalAlpha = textureColor.a * mainColor.a * globalAlpha;
	vec3 finalColor = tintedColor * mainColor.rgb * mainColor.a * globalAlpha;
	outputColor = vec4(finalColor, finalAlpha);
}
`;

// 렌더링 컨텍스트별 프로그램 캐시. (컨텍스트 → 효과 이름 → 프로그램)
const programCacheByContext = new System.WeakMap();


//==============================================================================
// 효과 프로그램 반환. (없으면 컴파일해 캐시)
//==============================================================================
/**
 * @param { Graphic } graphic
 * @param { string } effect
 * @returns { ShaderProgram }
 */
function resolveEffectProgram(graphic, effect) {
	const webGL2RenderingContext = graphic.getWebGL2RenderingContext();
	let programTable = programCacheByContext.get(webGL2RenderingContext);
	if (!programTable) {
		programTable = new System.Map();
		programCacheByContext.set(webGL2RenderingContext, programTable);
	}
	let shaderProgram = programTable.get(effect);
	if (!shaderProgram) {
		const defaultShaderProgram = graphic.getShaderProgram();
		const attributeLocationTable = {
			vertexPosition: defaultShaderProgram.getAttributeLocation("vertexPosition"),
			vertexTextureCoordinate: defaultShaderProgram.getAttributeLocation("vertexTextureCoordinate"),
		};
		const fragmentShaderSource = FRAGMENTSHADER_TEMPLATE.replace("EFFECT_BODY", EFFECT_BODY_TABLE[effect]);
		shaderProgram = new ShaderProgram(webGL2RenderingContext, VERTEXSHADER_SOURCE, fragmentShaderSource, attributeLocationTable);
		programTable.set(effect, shaderProgram);
	}
	return shaderProgram;
}


//==============================================================================
// 셰이더 스프라이트 컴포넌트.
// - Sprite 와 같지만 프래그먼트 셰이더 효과(디졸브 / 섬광 / 외곽선 / 홀로그램 / 물결 / 모자이크 / 글리치 / 광택 / 실루엣 / 무채색 / 색상 회전 / 와이프 / 아이리스 / 색수차)를 건다.
// - 효과의 시간은 스스로 흐르고(tick), 진행도(progress)는 트윈 / 타임라인이 밀어 넣는다.
// - 사용:
//     const sprite = node.addComponent(ShaderSprite);
//     sprite.setImage(image);
//     sprite.setEffect(ShaderSpriteEffect.dissolve);
//     sprite.setEffectProgress(0.5);
//==============================================================================
export class ShaderSprite extends Sprite {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #effect;
	/** @private @type { number } */ #effectProgress;
	/** @private @type { number } */ #effectTime;
	/** @private @type { number } */ #effectSeed;
	/** @private @type { Color } */ #effectColor;
	/** @private @type { number[] } */ #effectParameters;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("ShaderSprite");
		this.#effect = ShaderSpriteEffect.none;
		this.#effectProgress = 0;
		this.#effectTime = 0;
		this.#effectSeed = System.Math.random() * 100;
		this.#effectColor = Color.white();
		this.#effectParameters = [0, 0, 0, 0];
	}

	//==============================================================================
	// 갱신. (효과 시간 누적)
	//==============================================================================
	/**
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		this.#effectTime += timeDelta;
	}

	//==============================================================================
	// 출력. (효과가 있으면 프로그램을 바꿔 끼우고 Sprite 출력 경로를 그대로 탄다)
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		const image = this.getImage();
		const effect = this.getEffect();
		if (effect === ShaderSpriteEffect.none || image === null || image === undefined) {
			super.draw(graphic);
			return;
		}

		const shaderProgram = resolveEffectProgram(graphic, effect);
		graphic.setShaderProgramOverride(shaderProgram);

		const webGL2RenderingContext = graphic.getWebGL2RenderingContext();
		let imageRect = this.getImageRect();
		if (imageRect === null || imageRect === undefined || imageRect.equals(Rect.zero())) {
			imageRect = Rect.create(0, 0, image.width, image.height);
		}
		const imageWidth = System.Math.max(1, image.width);
		const imageHeight = System.Math.max(1, image.height);
		const effectColor = this.getEffectColor();
		const effectParameters = this.getEffectParameters();
		webGL2RenderingContext.uniform1f(shaderProgram.getUniformLocation("effectTime"), this.getEffectTime());
		webGL2RenderingContext.uniform1f(shaderProgram.getUniformLocation("effectProgress"), this.getEffectProgress());
		webGL2RenderingContext.uniform1f(shaderProgram.getUniformLocation("effectSeed"), this.getEffectSeed());
		webGL2RenderingContext.uniform4f(shaderProgram.getUniformLocation("effectColor"), effectColor.red, effectColor.green, effectColor.blue, effectColor.alpha);
		webGL2RenderingContext.uniform4f(shaderProgram.getUniformLocation("effectParameters"), effectParameters[0], effectParameters[1], effectParameters[2], effectParameters[3]);
		webGL2RenderingContext.uniform4f(shaderProgram.getUniformLocation("textureRect"),
			imageRect.position.x / imageWidth, imageRect.position.y / imageHeight,
			(imageRect.position.x + imageRect.size.x) / imageWidth, (imageRect.position.y + imageRect.size.y) / imageHeight);
		webGL2RenderingContext.uniform2f(shaderProgram.getUniformLocation("texelSize"), 1 / imageWidth, 1 / imageHeight);

		super.draw(graphic);
		graphic.setShaderProgramOverride(null);
	}

	//==============================================================================
	// 효과 설정. (효과별 기본 파라미터 / 색으로 되돌린다)
	//==============================================================================
	/**
	 * @param { string } effect
	 */
	setEffect(effect) {
		const isKnownEffect = EFFECT_BODY_TABLE[effect] !== undefined || effect === ShaderSpriteEffect.none;
		this.#effect = isKnownEffect ? effect : ShaderSpriteEffect.none;
		const defaultParameters = DEFAULT_PARAMETER_TABLE[this.#effect];
		this.#effectParameters = [defaultParameters[0], defaultParameters[1], defaultParameters[2], defaultParameters[3]];
		const defaultColor = DEFAULT_COLOR_TABLE[this.#effect];
		this.#effectColor = new Color(defaultColor[0], defaultColor[1], defaultColor[2], defaultColor[3]);
	}

	//==============================================================================
	// 효과 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getEffect() {
		return this.#effect;
	}

	//==============================================================================
	// 진행도 설정. (0 ~ 1)
	//==============================================================================
	/**
	 * @param { number } effectProgress
	 */
	setEffectProgress(effectProgress) {
		this.#effectProgress = System.Math.max(0, System.Math.min(1, effectProgress));
	}

	//==============================================================================
	// 진행도 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getEffectProgress() {
		return this.#effectProgress;
	}

	//==============================================================================
	// 효과 시간 설정.
	//==============================================================================
	/**
	 * @param { number } effectTime
	 */
	setEffectTime(effectTime) {
		this.#effectTime = effectTime;
	}

	//==============================================================================
	// 효과 시간 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getEffectTime() {
		return this.#effectTime;
	}

	//==============================================================================
	// 시드 설정. (같은 노이즈 무늬를 원할 때 고정)
	//==============================================================================
	/**
	 * @param { number } effectSeed
	 */
	setEffectSeed(effectSeed) {
		this.#effectSeed = effectSeed;
	}

	//==============================================================================
	// 시드 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getEffectSeed() {
		return this.#effectSeed;
	}

	//==============================================================================
	// 효과 색 설정.
	//==============================================================================
	/**
	 * @param { Color } color
	 */
	setEffectColor(color) {
		if (color === null || color === undefined) {
			return;
		}
		this.#effectColor = color.clone();
	}

	//==============================================================================
	// 효과 색 반환.
	//==============================================================================
	/**
	 * @returns { Color }
	 */
	getEffectColor() {
		return this.#effectColor;
	}

	//==============================================================================
	// 효과 파라미터 설정. (효과마다 뜻이 다르다 — ShaderSpriteEffect 주석 참고)
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @param { number } z
	 * @param { number } w
	 */
	setEffectParameters(x, y = 0, z = 0, w = 0) {
		this.#effectParameters = [x, y, z, w];
	}

	//==============================================================================
	// 효과 파라미터 반환.
	//==============================================================================
	/**
	 * @returns { number[] }
	 */
	getEffectParameters() {
		return this.#effectParameters;
	}

	//==============================================================================
	// 효과 기본 파라미터 반환. (정적)
	//==============================================================================
	/**
	 * @param { string } effect
	 * @returns { number[] }
	 */
	static getDefaultParameters(effect) {
		const defaultParameters = DEFAULT_PARAMETER_TABLE[effect] ? DEFAULT_PARAMETER_TABLE[effect] : DEFAULT_PARAMETER_TABLE.none;
		return [defaultParameters[0], defaultParameters[1], defaultParameters[2], defaultParameters[3]];
	}

	//==============================================================================
	// 효과 기본 색 반환. (정적)
	//==============================================================================
	/**
	 * @param { string } effect
	 * @returns { Color }
	 */
	static getDefaultColor(effect) {
		const defaultColor = DEFAULT_COLOR_TABLE[effect] ? DEFAULT_COLOR_TABLE[effect] : DEFAULT_COLOR_TABLE.none;
		return new Color(defaultColor[0], defaultColor[1], defaultColor[2], defaultColor[3]);
	}
}
