//==============================================================================
// 타임라인 샘플 애셋 생성기. — 8가지 연출 시퀀스를 타임라인 편집기 문서 형식(.timeline.json)으로 만든다.
// - 형식은 Timeline 런타임 / 타임라인 편집기와 1:1 이다. (무대 노드 + 트랙 + 마커)
// - 이미지는 assets/ 의 파일 이름으로 가리키고, index.html 이 미리 읽어 이름으로 넘긴다.
// - 실행: node examples/timeline/generate.mjs
//==============================================================================
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const OUTPUT_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), "assets");
const STAGE_WIDTH = 960;
const STAGE_HEIGHT = 540;
const COLOR_BACKGROUND = "#101114ff";
const COLOR_SURFACE = "#171a22ff";
const COLOR_CARD = "#232937ff";
const COLOR_INK = "#f2ece2ff";
const COLOR_DIM = "#9aa2b2ff";
const COLOR_ACCENT = "#d4b06aff";
const COLOR_ACCENT_SOFT = "#d4b06a22";
const COLOR_POSITIVE = "#45b585ff";
const COLOR_NEGATIVE = "#e06058ff";


//==============================================================================
// 노드 / 키 도우미.
//==============================================================================
function node(name, type, overrides) {
	return Object.assign({ name: name, type: type, parent: null, x: STAGE_WIDTH / 2, y: STAGE_HEIGHT / 2, width: 100, height: 100 }, overrides);
}

function key(time, value, easing = "cubic.inOut", extra = null) {
	const result = { time: time, value: value, easing: easing };
	if (extra) {
		Object.assign(result, extra);
	}
	return result;
}

function track(target, property, keys, extra = null) {
	const result = { target: target, property: property, keys: keys };
	if (extra) {
		Object.assign(result, extra);
	}
	return result;
}

function particle(presetOverrides) {
	return Object.assign({
		looping: false, duration: 1.2, maxParticleCount: 600, emissionRate: 0, bursts: [{ time: 0, count: 60 }],
		shape: "circle", shapeRadius: 6, coneAngle: 0.35, boxSize: [200, 100], edgeWidth: 400,
		lifetime: [0.5, 1.1], speed: [180, 420], size: [3, 6], rotation: [0, 0], angularVelocity: [0, 0],
		startColorA: [1, 0.85, 0.4, 1], startColorB: [1, 0.55, 0.2, 1],
		colorOverLifetime: [{ time: 0, color: [1, 1, 1, 1] }, { time: 1, color: [1, 0.4, 0.1, 0] }],
		sizeOverLifetime: [1, 0.5], gravity: [0, 240], damping: 1.6, attractor: null, wobble: [0, 4],
		renderShape: "streak", blendMode: "lighter", streakScale: 0.04, worldSpace: false,
	}, presetOverrides);
}

function document(name, duration, loop, nodes, tracks, markers) {
	return {
		name: name,
		duration: duration,
		frameRate: 30,
		loop: loop,
		stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT, backgroundColor: COLOR_BACKGROUND, nodes: nodes },
		tracks: tracks,
		markers: markers,
	};
}


//==============================================================================
// 1. TITLE REVEAL — 제목 슬라이드 + 밑줄 + 부제 + 마커 이벤트로 파티클.
//==============================================================================
function buildTitleReveal() {
	const titleText = "VANILLA";
	const nodes = [
		node("Backdrop", "paint", { x: 480, y: 270, width: 960, height: 540, color: COLOR_SURFACE }),
		node("Glow", "paint", { x: 480, y: 290, width: 560, height: 560, color: COLOR_ACCENT_SOFT, roundSize: 280, scaleX: 0.3, scaleY: 0.3, opacity: 0 }),
		node("Word", "text", { x: 480, y: 250, width: 900, height: 120, text: titleText, fontSize: 96, bold: true, color: COLOR_INK, opacity: 0 }),
		node("Underline", "paint", { x: 480, y: 318, width: 0, height: 4, color: COLOR_ACCENT }),
		node("Subtitle", "text", { x: 480, y: 360, width: 700, height: 40, text: "TIMELINE · KEYFRAMES · EASING", fontSize: 22, color: COLOR_DIM, opacity: 0 }),
		node("Burst", "particle", { x: 480, y: 250, width: 20, height: 20, particle: particle({ bursts: [{ time: 0, count: 90 }], speed: [220, 520] }) }),
	];
	const tracks = [
		track("Word", "opacity", [key(0, 0, "cubic.out"), key(0.7, 1)]),
		track("Word", "y", [key(0, 300, "cubic.out"), key(0.9, 250)]),
		track("Word", "scaleX", [key(0, 0.7, "back.out"), key(1.0, 1)]),
		track("Word", "scaleY", [key(0, 0.7, "back.out"), key(1.0, 1)]),
		track("Word", "fontSize", [key(2.8, 96, "sinusoidal.inOut"), key(3.6, 104), key(4.4, 96)]),
		track("Underline", "width", [key(0.5, 0, "quartic.out"), key(1.4, 520)]),
		track("Subtitle", "opacity", [key(1.0, 0, "sinusoidal.out"), key(1.8, 1)]),
		track("Subtitle", "y", [key(1.0, 384, "cubic.out"), key(1.8, 360)]),
		track("Subtitle", "visibleCharacters", [key(1.0, 0, "linear"), key(2.2, 30)]),
		track("Glow", "opacity", [key(0.3, 0, "sinusoidal.out"), key(1.4, 1), key(4.2, 1), key(5, 0)]),
		track("Glow", "scaleX", [key(0.3, 0.3, "sinusoidal.out"), key(1.8, 1)]),
		track("Glow", "scaleY", [key(0.3, 0.3, "sinusoidal.out"), key(1.8, 1)]),
		track("Word", "color", [key(2.6, COLOR_INK, "sinusoidal.inOut"), key(3.4, COLOR_ACCENT), key(4.2, COLOR_INK)]),
		track("Burst", "event", [key(0.85, "play", "step")]),
		track("Word", "opacity", [key(4.4, 1, "cubic.in"), key(5, 0)]),
		track("Subtitle", "opacity", [key(4.4, 1, "cubic.in"), key(5, 0)]),
		track("Underline", "width", [key(4.4, 520, "cubic.in"), key(5, 0)]),
	];
	return documentFromBundle("Title Reveal", 5, true, mergeTracks(nodes, tracks), [{ time: 0.85, name: "hit" }, { time: 2.6, name: "shine" }, { time: 4.4, name: "outro" }]);
}


//==============================================================================
// 같은 대상 / 속성 트랙을 하나로 합친다. (생성 편의)
//==============================================================================
function mergeTracks(nodes, tracks) {
	const merged = [];
	for (const entry of tracks) {
		const existing = merged.find((other) => other.target === entry.target && other.property === entry.property);
		if (existing) {
			existing.keys.push(...entry.keys);
		}
		else {
			merged.push(entry);
		}
	}
	return { nodes: nodes, tracks: merged };
}

// document() 가 { nodes, tracks } 묶음도 받도록 감싼다.
function documentFromBundle(name, duration, loop, bundle, markers) {
	return document(name, duration, loop, bundle.nodes, bundle.tracks, markers);
}


//==============================================================================
// 2. LOGO STING — 문장 스프라이트 스케일 펀치 + 회전 정착 + 광택 + 디졸브 아웃.
//==============================================================================
function buildLogoSting() {
	const nodes = [
		node("Backdrop", "paint", { x: 480, y: 270, width: 960, height: 540, color: "#0d0f14ff" }),
		node("Ring", "paint", { x: 480, y: 260, width: 300, height: 300, color: "#d4b06a00", roundSize: 150, scaleX: 0.2, scaleY: 0.2 }),
		node("Emblem", "sprite", { x: 480, y: 260, width: 220, height: 220, image: "emblem.png", effect: "shine", effectProgress: 0, effectColor: "#fff3c8ff", scaleX: 0, scaleY: 0, rotation: -30 }),
		node("Caption", "text", { x: 480, y: 420, width: 600, height: 40, text: "VANILLA.JS", fontSize: 30, bold: true, color: COLOR_ACCENT, opacity: 0 }),
		node("Stars", "particle", { x: 480, y: 260, width: 20, height: 20, particle: particle({ bursts: [{ time: 0, count: 50 }], renderShape: "circle", gravity: [0, 120], speed: [120, 320], startColorA: [1, 0.95, 0.75, 1], startColorB: [1, 0.8, 0.4, 1] }) }),
		node("Dust", "particle", { x: 480, y: 260, width: 20, height: 20, particle: particle({ looping: true, emissionRate: 25, bursts: [], shape: "box", boxSize: [520, 320], lifetime: [1.4, 2.4], speed: [0, 12], size: [1.5, 4], gravity: [0, -16], damping: 0, renderShape: "circle", startColorA: [1, 0.9, 0.6, 0.8], startColorB: [1, 1, 1, 0.6], colorOverLifetime: [{ time: 0, color: [1, 1, 1, 0] }, { time: 0.4, color: [1, 1, 1, 1] }, { time: 1, color: [1, 1, 1, 0] }] }) }),
	];
	const tracks = [
		track("Emblem", "scaleX", [key(0.1, 0, "back.out"), key(0.7, 1.15), key(1.0, 1)]),
		track("Emblem", "scaleY", [key(0.1, 0, "back.out"), key(0.7, 1.15), key(1.0, 1)]),
		track("Emblem", "rotation", [key(0.1, -30, "elastic.out"), key(1.2, 0)]),
		track("Emblem", "effect", [key(1.1, 0, "linear"), key(1.9, 1), key(3.4, 0, "step"), key(3.5, 0)]),
		track("Ring", "color", [key(0.5, "#d4b06a00", "cubic.out"), key(0.8, "#d4b06a55"), key(1.6, "#d4b06a00")]),
		track("Ring", "scaleX", [key(0.5, 0.2, "cubic.out"), key(1.6, 2.6)]),
		track("Ring", "scaleY", [key(0.5, 0.2, "cubic.out"), key(1.6, 2.6)]),
		track("Caption", "opacity", [key(1.2, 0, "sinusoidal.out"), key(1.8, 1), key(3.6, 1, "cubic.in"), key(4.2, 0)]),
		track("Caption", "y", [key(1.2, 440, "cubic.out"), key(1.8, 420)]),
		track("Stars", "event", [key(0.6, "play", "step")]),
		track("Emblem", "opacity", [key(3.5, 1, "linear"), key(3.55, 1)]),
	];
	const bundle = mergeTracks(nodes, tracks);
	// 디졸브 아웃은 셰이더 효과를 바꿔야 하므로 두 번째 스프라이트로 겹쳐 처리한다.
	bundle.nodes.push(node("Emblem Dissolve", "sprite", { x: 480, y: 260, width: 220, height: 220, image: "emblem.png", effect: "dissolve", effectProgress: 0, effectColor: "#ffb347ff", opacity: 0 }));
	bundle.tracks.push(track("Emblem Dissolve", "opacity", [key(3.45, 0, "step"), key(3.5, 1)]));
	bundle.tracks.push(track("Emblem", "opacity", [key(3.45, 1, "step"), key(3.5, 0)]));
	bundle.tracks.push(track("Emblem Dissolve", "effect", [key(3.5, 0, "quadratic.in"), key(4.4, 1)]));
	return documentFromBundle("Logo Sting", 4.6, true, bundle, [{ time: 0.6, name: "impact" }, { time: 1.1, name: "shine" }, { time: 3.5, name: "dissolve" }]);
}


//==============================================================================
// 3. HUD INTRO — 패널 슬라이드 인 + 체력 바 채움 + 점수 카운트 + 코인 프레임 애니메이션.
//==============================================================================
function buildHudIntro() {
	const nodes = [
		node("Backdrop", "paint", { x: 480, y: 270, width: 960, height: 540, color: "#0f141bff" }),
		node("Top Bar", "paint", { x: 480, y: -30, width: 960, height: 58, color: "#171d27ff" }),
		node("Title", "text", { x: 140, y: -30, width: 240, height: 30, text: "STAGE 3 · RUINS", fontSize: 18, bold: true, color: COLOR_INK, textAlign: "left" }),
		node("Score Label", "text", { x: 830, y: -30, width: 120, height: 30, text: "SCORE", fontSize: 12, color: COLOR_DIM, textAlign: "right" }),
		node("Score", "text", { x: 830, y: -30, width: 200, height: 30, text: "0", fontSize: 24, bold: true, color: COLOR_ACCENT, textAlign: "right" }),
		node("Health Panel", "paint", { x: -170, y: 470, width: 320, height: 84, color: "#171d27ff", roundSize: 14 }),
		node("Health Label", "text", { x: -170, y: 450, width: 280, height: 20, text: "HP", fontSize: 12, bold: true, color: COLOR_DIM, textAlign: "left" }),
		node("Health Track", "paint", { x: -170, y: 482, width: 280, height: 14, color: "#0b0e13ff", roundSize: 7 }),
		node("Health Fill", "paint", { x: -170, y: 482, width: 0, height: 14, color: COLOR_POSITIVE, roundSize: 7, pivotX: 0 }),
		node("Coin Panel", "paint", { x: 1130, y: 470, width: 220, height: 84, color: "#171d27ff", roundSize: 14 }),
		node("Coin", "sprite", { x: 1130, y: 470, width: 48, height: 48, image: "coin.png", frameColumns: 8, frameRows: 1 }),
		node("Coin Count", "text", { x: 1130, y: 470, width: 100, height: 40, text: "0", fontSize: 26, bold: true, color: COLOR_INK, textAlign: "left" }),
		node("Hero", "sprite", { x: 480, y: 330, width: 128, height: 128, image: "slime.png", frameColumns: 8, frameRows: 1, opacity: 0 }),
		node("Hero Shadow", "paint", { x: 480, y: 392, width: 90, height: 16, color: "#00000066", roundSize: 8, opacity: 0 }),
		node("Ready", "text", { x: 480, y: 200, width: 500, height: 70, text: "READY", fontSize: 64, bold: true, color: COLOR_INK, opacity: 0 }),
	];
	const tracks = [
		track("Top Bar", "y", [key(0, -30, "quartic.out"), key(0.6, 29)]),
		track("Title", "y", [key(0.1, -30, "quartic.out"), key(0.7, 29)]),
		track("Score Label", "y", [key(0.15, -30, "quartic.out"), key(0.75, 18)]),
		track("Score", "y", [key(0.15, -30, "quartic.out"), key(0.75, 38)]),
		track("Health Panel", "x", [key(0.3, -170, "back.out"), key(0.9, 190)]),
		track("Health Label", "x", [key(0.3, -170, "back.out"), key(0.9, 190)]),
		track("Health Track", "x", [key(0.3, -170, "back.out"), key(0.9, 190)]),
		track("Health Fill", "x", [key(0.3, -310, "back.out"), key(0.9, 50)]),
		track("Health Fill", "width", [key(1.0, 0, "quartic.out"), key(1.8, 280)]),
		track("Coin Panel", "x", [key(0.4, 1130, "back.out"), key(1.0, 830)]),
		track("Coin", "x", [key(0.4, 1130, "back.out"), key(1.0, 760)]),
		track("Coin Count", "x", [key(0.4, 1130, "back.out"), key(1.0, 850)]),
		track("Coin", "frame", [key(0, 0, "linear"), key(4, 32)]),
		track("Coin Count", "number", [key(1.2, 0, "quadratic.out"), key(2.4, 128)]),
		track("Score", "number", [key(1.2, 0, "quadratic.out"), key(3.0, 48250)]),
		track("Hero", "opacity", [key(0.8, 0, "cubic.out"), key(1.2, 1)]),
		track("Hero", "y", [key(0.8, 250, "bounce.out"), key(1.5, 330)]),
		track("Hero", "frame", [key(0, 0, "linear"), key(4, 30)]),
		track("Hero Shadow", "opacity", [key(0.8, 0, "cubic.out"), key(1.5, 1)]),
		track("Hero Shadow", "scaleX", [key(0.8, 0.4, "bounce.out"), key(1.5, 1)]),
		track("Ready", "opacity", [key(1.9, 0, "cubic.out"), key(2.2, 1), key(3.2, 1, "cubic.in"), key(3.6, 0)]),
		track("Ready", "scaleX", [key(1.9, 1.6, "back.out"), key(2.3, 1)]),
		track("Ready", "scaleY", [key(1.9, 1.6, "back.out"), key(2.3, 1)]),
		track("Ready", "text", [key(1.9, "READY", "step"), key(3.0, "GO!", "step")]),
		track("Ready", "color", [key(1.9, COLOR_INK, "step"), key(3.0, COLOR_ACCENT, "step")]),
	];
	return documentFromBundle("HUD Intro", 4, true, mergeTracks(nodes, tracks), [{ time: 1.9, name: "ready" }, { time: 3.0, name: "go" }]);
}


//==============================================================================
// 4. CUTSCENE — 레터박스 + 카메라 그룹 팬 + 캐릭터 점프 + 타자기 대사 + 페이드 아웃.
//==============================================================================
function buildCutscene() {
	const nodes = [
		node("Sky", "paint", { x: 480, y: 270, width: 960, height: 540, color: "#141a2aff" }),
		node("Camera", "group", { x: 480, y: 270, width: 960, height: 540 }),
		node("Moon", "paint", { parent: "Camera", x: 760, y: 90, width: 90, height: 90, color: "#f2ece2ff", roundSize: 45 }),
		node("Hill Far", "paint", { parent: "Camera", x: 300, y: 470, width: 900, height: 420, color: "#1c2436ff", roundSize: 210 }),
		node("Hill Near", "paint", { parent: "Camera", x: 700, y: 520, width: 1100, height: 420, color: "#232f45ff", roundSize: 210 }),
		node("Ground", "paint", { parent: "Camera", x: 480, y: 500, width: 1400, height: 120, color: "#2a3650ff" }),
		node("Gem", "sprite", { parent: "Camera", x: 720, y: 400, width: 56, height: 56, image: "gem.png" }),
		node("Gem Light", "paint", { parent: "Camera", x: 720, y: 400, width: 140, height: 140, color: "#80b8ff22", roundSize: 70 }),
		node("Hero", "sprite", { parent: "Camera", x: 180, y: 410, width: 112, height: 112, image: "slime.png", frameColumns: 8, frameRows: 1 }),
		node("Bat", "sprite", { parent: "Camera", x: 1100, y: 160, width: 96, height: 72, image: "bat.png", frameColumns: 4, frameRows: 1 }),
		node("Bar Top", "paint", { x: 480, y: -40, width: 960, height: 80, color: "#000000ff" }),
		node("Bar Bottom", "paint", { x: 480, y: 580, width: 960, height: 80, color: "#000000ff" }),
		node("Dialogue Box", "paint", { x: 480, y: 470, width: 760, height: 88, color: "#0b0d12dd", roundSize: 12, opacity: 0 }),
		node("Speaker", "text", { x: 140, y: 448, width: 200, height: 24, text: "SLIME", fontSize: 13, bold: true, color: COLOR_ACCENT, textAlign: "left", opacity: 0 }),
		node("Dialogue", "text", { x: 140, y: 482, width: 700, height: 30, text: "That gem... it's been calling me since the ruins.", fontSize: 20, color: COLOR_INK, textAlign: "left", opacity: 0 }),
		node("Fade", "paint", { x: 480, y: 270, width: 960, height: 540, color: "#000000ff", opacity: 0 }),
	];
	const tracks = [
		track("Bar Top", "y", [key(0, -40, "cubic.out"), key(0.8, 40)]),
		track("Bar Bottom", "y", [key(0, 580, "cubic.out"), key(0.8, 500)]),
		track("Camera", "x", [key(0, 480, "sinusoidal.inOut"), key(4, 240), key(7, 240)]),
		track("Camera", "scaleX", [key(3.5, 1, "sinusoidal.inOut"), key(6.5, 1.25)]),
		track("Camera", "scaleY", [key(3.5, 1, "sinusoidal.inOut"), key(6.5, 1.25)]),
		track("Hero", "x", [key(0.5, 180, "linear"), key(3.8, 560)]),
		track("Hero", "y", [key(0.5, 410, "quadratic.out"), key(0.9, 340, "quadratic.in"), key(1.3, 410, "quadratic.out"), key(1.7, 340, "quadratic.in"), key(2.1, 410, "quadratic.out"), key(2.5, 340, "quadratic.in"), key(2.9, 410, "quadratic.out"), key(3.3, 340, "quadratic.in"), key(3.7, 410)]),
		track("Hero", "frame", [key(0, 0, "linear"), key(7, 56)]),
		track("Bat", "frame", [key(0, 0, "linear"), key(7, 42)]),
		track("Bat", "x", [key(0, 1100, "sinusoidal.inOut"), key(3, 300), key(7, -200)]),
		track("Bat", "y", [key(0, 160, "sinusoidal.inOut"), key(1.5, 110), key(3, 190), key(4.5, 120), key(7, 170)]),
		track("Gem", "y", [key(0, 400, "sinusoidal.inOut"), key(1, 388), key(2, 400), key(3, 388), key(4, 400), key(5, 388), key(6, 400)]),
		track("Gem Light", "opacity", [key(0, 0.6, "sinusoidal.inOut"), key(1, 1), key(2, 0.6), key(3, 1), key(4, 0.6), key(5, 1), key(6, 0.6)]),
		track("Dialogue Box", "opacity", [key(3.9, 0, "cubic.out"), key(4.3, 1), key(6.3, 1, "cubic.in"), key(6.7, 0)]),
		track("Speaker", "opacity", [key(4.0, 0, "cubic.out"), key(4.3, 1), key(6.3, 1, "cubic.in"), key(6.7, 0)]),
		track("Dialogue", "opacity", [key(4.1, 0, "step"), key(4.15, 1), key(6.3, 1, "cubic.in"), key(6.7, 0)]),
		track("Dialogue", "visibleCharacters", [key(4.1, 0, "linear"), key(5.9, 50)]),
		track("Fade", "opacity", [key(6.4, 0, "cubic.in"), key(7, 1)]),
		// 화면 효과. (대상 "screen" 은 샘플이 ScreenEffect 로 해석한다 — 편집기에서는 비어 있는 묶음으로 보인다)
		track("screen", "vignette", [key(0, 0, "sinusoidal.out"), key(1.2, 0.85)]),
		track("screen", "colorGrade", [key(0, 1, "step")]),
		track("screen", "colorGrade.saturation", [key(0, 1.15, "linear"), key(5.5, 1.15, "cubic.in"), key(7, 0.2)]),
		track("screen", "grain", [key(0, 0.35, "step")]),
	];
	return documentFromBundle("Cutscene", 7, false, mergeTracks(nodes, tracks), [{ time: 0.8, name: "bars" }, { time: 3.9, name: "dialogue" }, { time: 6.4, name: "fade" }]);
}


//==============================================================================
// 5. COMBO POPUP — 콤보 숫자 카운트 + 탄성 스케일 + 흔들림 + 색 섬광 + 파티클.
//==============================================================================
function buildComboPopup() {
	const nodes = [
		node("Backdrop", "paint", { x: 480, y: 270, width: 960, height: 540, color: "#12111aff" }),
		node("Flash", "paint", { x: 480, y: 270, width: 960, height: 540, color: "#ffffffff", opacity: 0 }),
		node("Combo Root", "group", { x: 480, y: 250, width: 400, height: 200, scaleX: 0, scaleY: 0 }),
		node("Combo Number", "text", { parent: "Combo Root", x: 200, y: 80, width: 400, height: 140, text: "1", fontSize: 128, bold: true, color: COLOR_ACCENT }),
		node("Combo Label", "text", { parent: "Combo Root", x: 200, y: 170, width: 400, height: 40, text: "COMBO", fontSize: 34, bold: true, color: COLOR_INK }),
		node("Hit Ring", "paint", { x: 480, y: 250, width: 200, height: 200, color: "#e0605800", roundSize: 100, scaleX: 0.5, scaleY: 0.5 }),
		node("Sparks", "particle", { x: 480, y: 250, width: 20, height: 20, particle: particle({ bursts: [{ time: 0, count: 40 }], speed: [260, 560], startColorA: [1, 0.5, 0.35, 1], startColorB: [1, 0.85, 0.4, 1] }) }),
		node("Big Sparks", "particle", { x: 480, y: 250, width: 20, height: 20, particle: particle({ bursts: [{ time: 0, count: 140 }], speed: [300, 720], size: [4, 9], lifetime: [0.7, 1.4] }) }),
		node("Star", "sprite", { x: 480, y: 250, width: 96, height: 96, image: "star.png", opacity: 0, effect: "glow", effectProgress: 1, effectColor: "#ffd166ff" }),
	];
	const tracks = [
		track("Combo Root", "scaleX", [key(0, 0, "back.out"), key(0.35, 1)]),
		track("Combo Root", "scaleY", [key(0, 0, "back.out"), key(0.35, 1)]),
		track("Combo Number", "number", [key(0.2, 1, "step"), key(2.4, 12, "step")]),
		track("Hit Ring", "color", [key(0, "#e0605800", "step")]),
		track("Sparks", "event", []),
		track("Flash", "opacity", [key(0, 0, "step"), key(2.4, 0.9, "cubic.out"), key(2.75, 0)]),
		track("Combo Number", "color", [key(2.4, "#ffffffff", "cubic.out"), key(2.75, COLOR_ACCENT)]),
		track("Combo Number", "text", [key(2.4, "12", "step")]),
		track("Combo Label", "text", [key(0, "COMBO", "step"), key(2.4, "MAX COMBO!", "step")]),
		track("Combo Root", "rotation", [key(0, 0, "step"), key(2.4, -6, "elastic.out"), key(3.2, 0)]),
		track("Big Sparks", "event", [key(2.4, "play", "step")]),
		track("Star", "opacity", [key(2.4, 0, "cubic.out"), key(2.6, 1), key(3.6, 1, "cubic.in"), key(4, 0)]),
		track("Star", "y", [key(2.4, 250, "back.out"), key(2.9, 120)]),
		track("Star", "rotation", [key(2.4, -90, "back.out"), key(3.0, 0)]),
		track("Star", "scaleX", [key(2.4, 0.3, "elastic.out"), key(3.2, 1)]),
		track("Star", "scaleY", [key(2.4, 0.3, "elastic.out"), key(3.2, 1)]),
		track("Combo Root", "opacity", [key(3.6, 1, "cubic.in"), key(4, 0)]),
	];
	// 히트 11번: 숫자 증가마다 스케일 펀치 + 링 + 스파크.
	const scaleKeysX = [key(0, 1, "step")];
	const scaleKeysY = [key(0, 1, "step")];
	const ringScaleX = [];
	const ringScaleY = [];
	const ringColor = [];
	const sparkEvents = [];
	for (let hitIndex = 0; hitIndex < 11; ++hitIndex) {
		const hitTime = 0.2 + hitIndex * 0.2;
		scaleKeysX.push(key(hitTime, 1.35, "cubic.out"), key(hitTime + 0.16, 1));
		scaleKeysY.push(key(hitTime, 0.8, "cubic.out"), key(hitTime + 0.16, 1));
		ringScaleX.push(key(hitTime, 0.5, "cubic.out"), key(hitTime + 0.19, 1.6));
		ringScaleY.push(key(hitTime, 0.5, "cubic.out"), key(hitTime + 0.19, 1.6));
		ringColor.push(key(hitTime, "#e06058aa", "cubic.out"), key(hitTime + 0.19, "#e0605800"));
		sparkEvents.push(key(hitTime, "play", "step"));
	}
	tracks.push(track("Combo Number", "scaleX", scaleKeysX));
	tracks.push(track("Combo Number", "scaleY", scaleKeysY));
	tracks.push(track("Hit Ring", "scaleX", ringScaleX));
	tracks.push(track("Hit Ring", "scaleY", ringScaleY));
	tracks.push(track("Hit Ring", "color", ringColor));
	tracks.push(track("Sparks", "event", sparkEvents));
	return documentFromBundle("Combo Popup", 4, true, mergeTracks(nodes, tracks), [{ time: 0.2, name: "first hit" }, { time: 2.4, name: "max" }]);
}


//==============================================================================
// 6. SCENE TRANSITION — 장면 A → 아이리스 아웃 → 장면 B → 픽셀 디졸브 → 장면 A.
//==============================================================================
function buildSceneTransition() {
	const nodes = [
		node("Scene A", "group", { x: 480, y: 270, width: 960, height: 540 }),
		node("Sky A", "paint", { parent: "Scene A", x: 480, y: 270, width: 960, height: 540, color: "#1b2a44ff" }),
		node("Sun", "paint", { parent: "Scene A", x: 720, y: 150, width: 120, height: 120, color: "#ffd166ff", roundSize: 60 }),
		node("Field", "paint", { parent: "Scene A", x: 480, y: 470, width: 960, height: 180, color: "#2f6b45ff" }),
		node("Hero A", "sprite", { parent: "Scene A", x: 300, y: 350, width: 112, height: 112, image: "slime.png", frameColumns: 8, frameRows: 1 }),
		node("Label A", "text", { parent: "Scene A", x: 480, y: 80, width: 500, height: 40, text: "MEADOW", fontSize: 30, bold: true, color: COLOR_INK }),
		node("Scene B", "group", { x: 480, y: 270, width: 960, height: 540, visible: false }),
		node("Sky B", "paint", { parent: "Scene B", x: 480, y: 270, width: 960, height: 540, color: "#160f1eff" }),
		node("Moon B", "paint", { parent: "Scene B", x: 240, y: 130, width: 90, height: 90, color: "#e8e2f2ff", roundSize: 45 }),
		node("Cave", "paint", { parent: "Scene B", x: 480, y: 480, width: 960, height: 160, color: "#2a1f33ff" }),
		node("Bat B", "sprite", { parent: "Scene B", x: 640, y: 220, width: 96, height: 72, image: "bat.png", frameColumns: 4, frameRows: 1 }),
		node("Gem B", "sprite", { parent: "Scene B", x: 480, y: 380, width: 64, height: 64, image: "gem.png" }),
		node("Label B", "text", { parent: "Scene B", x: 480, y: 80, width: 500, height: 40, text: "CRYSTAL CAVE", fontSize: 30, bold: true, color: COLOR_INK }),
		node("Cover", "sprite", { x: 480, y: 270, width: 960, height: 540, image: "cover.png", color: "#000000ff", effect: "iris", effectProgress: 0, opacity: 0 }),
	];
	const tracks = [
		track("Hero A", "x", [key(0, 300, "linear"), key(2, 420), key(8, 420, "linear"), key(10, 540)]),
		track("Hero A", "frame", [key(0, 0, "linear"), key(10, 80)]),
		track("Bat B", "frame", [key(0, 0, "linear"), key(10, 60)]),
		track("Bat B", "x", [key(3, 640, "sinusoidal.inOut"), key(5, 400), key(7, 640)]),
		track("Gem B", "y", [key(3, 380, "sinusoidal.inOut"), key(4, 368), key(5, 380), key(6, 368), key(7, 380)]),
		// 아이리스 아웃: 커버(검정)가 iris 진행도 1(전부 보임) → 0(중앙만) 으로 닫히며 장면 A 를 덮는다.
		track("Cover", "opacity", [key(1.9, 0, "step"), key(2.0, 1), key(4.0, 1, "step"), key(4.05, 0), key(6.9, 0, "step"), key(7.0, 1), key(9.0, 1, "step"), key(9.05, 0)]),
		track("Cover", "effect", [key(2.0, 0, "cubic.inOut"), key(3.0, 1), key(3.0, 1, "cubic.inOut"), key(4.0, 0)]),
		track("Scene A", "visible", [key(0, true, "step"), key(3.0, false, "step"), key(8.0, true, "step")]),
		track("Scene B", "visible", [key(0, false, "step"), key(3.0, true, "step"), key(8.0, false, "step")]),
	];
	const bundle = mergeTracks(nodes, tracks);
	// 두 번째 전환은 픽셀 디졸브 — 다른 효과의 커버 스프라이트.
	bundle.nodes.push(node("Cover Pixel", "sprite", { x: 480, y: 270, width: 960, height: 540, image: "cover.png", color: "#000000ff", effect: "pixelDissolve", effectProgress: 1, opacity: 0 }));
	bundle.tracks.push(track("Cover Pixel", "opacity", [key(6.9, 0, "step"), key(7.0, 1), key(9.0, 1, "step"), key(9.05, 0)]));
	bundle.tracks.push(track("Cover Pixel", "effect", [key(7.0, 1, "linear"), key(8.0, 0), key(8.0, 0, "linear"), key(9.0, 1)]));
	bundle.tracks = bundle.tracks.filter((entry) => !(entry.target === "Cover" && entry.property === "opacity"));
	bundle.tracks.push(track("Cover", "opacity", [key(1.9, 0, "step"), key(2.0, 1), key(4.0, 1, "step"), key(4.05, 0)]));
	return documentFromBundle("Scene Transition", 10, true, bundle, [{ time: 2.0, name: "iris out" }, { time: 3.0, name: "scene B" }, { time: 7.0, name: "pixel out" }, { time: 8.0, name: "scene A" }]);
}


//==============================================================================
// 7. LOOPING IDLE — 슬라임 숨쉬기 + 눈 깜빡임 + 코인 회전 + 별 맥동 + 박쥐 비행.
//==============================================================================
function buildLoopingIdle() {
	const nodes = [
		node("Backdrop", "paint", { x: 480, y: 270, width: 960, height: 540, color: "#111726ff" }),
		node("Floor", "paint", { x: 480, y: 470, width: 960, height: 140, color: "#18213aff" }),
		node("Slime Shadow", "paint", { x: 480, y: 402, width: 120, height: 22, color: "#00000066", roundSize: 11 }),
		node("Slime", "sprite", { x: 480, y: 340, width: 144, height: 144, image: "slime.png", frameColumns: 8, frameRows: 1, pivotY: 0.85 }),
		node("Coin", "sprite", { x: 700, y: 330, width: 64, height: 64, image: "coin.png", frameColumns: 8, frameRows: 1 }),
		node("Coin Shadow", "paint", { x: 700, y: 402, width: 50, height: 14, color: "#00000055", roundSize: 7 }),
		node("Star", "sprite", { x: 260, y: 300, width: 80, height: 80, image: "star.png", effect: "glow", effectProgress: 0.5, effectColor: "#ffd166ff" }),
		node("Bat", "sprite", { x: 800, y: 150, width: 96, height: 72, image: "bat.png", frameColumns: 4, frameRows: 1 }),
		node("Gem", "sprite", { x: 200, y: 400, width: 56, height: 56, image: "gem.png", effect: "shine", effectProgress: 0, effectColor: "#ffffffff" }),
		node("Blink", "paint", { x: 480, y: 300, width: 60, height: 8, color: "#1f5a36ff", visible: false }),
	];
	const tracks = [
		track("Slime", "frame", [key(0, 0, "linear"), key(3, 24)]),
		track("Slime", "scaleY", [key(0, 1, "sinusoidal.inOut"), key(0.75, 1.06), key(1.5, 1), key(2.25, 1.06), key(3, 1)]),
		track("Slime", "scaleX", [key(0, 1, "sinusoidal.inOut"), key(0.75, 0.96), key(1.5, 1), key(2.25, 0.96), key(3, 1)]),
		track("Slime Shadow", "scaleX", [key(0, 1, "sinusoidal.inOut"), key(0.75, 0.92), key(1.5, 1), key(2.25, 0.92), key(3, 1)]),
		track("Coin", "frame", [key(0, 0, "linear"), key(3, 24)]),
		track("Coin", "y", [key(0, 330, "sinusoidal.inOut"), key(1.5, 312), key(3, 330)]),
		track("Coin Shadow", "scaleX", [key(0, 1, "sinusoidal.inOut"), key(1.5, 0.7), key(3, 1)]),
		track("Star", "effect", [key(0, 0.2, "sinusoidal.inOut"), key(1.5, 1), key(3, 0.2)]),
		track("Star", "rotation", [key(0, -8, "sinusoidal.inOut"), key(1.5, 8), key(3, -8)]),
		track("Star", "scaleX", [key(0, 0.9, "sinusoidal.inOut"), key(1.5, 1.1), key(3, 0.9)]),
		track("Star", "scaleY", [key(0, 0.9, "sinusoidal.inOut"), key(1.5, 1.1), key(3, 0.9)]),
		track("Bat", "frame", [key(0, 0, "linear"), key(3, 18)]),
		track("Bat", "x", [key(0, 800, "sinusoidal.inOut"), key(1.5, 640), key(3, 800)]),
		track("Bat", "y", [key(0, 150, "sinusoidal.inOut"), key(0.75, 120), key(1.5, 160), key(2.25, 110), key(3, 150)]),
		track("Gem", "effect", [key(0, 0, "linear"), key(0.6, 1), key(2.4, 1, "step"), key(2.5, 0)]),
		track("Blink", "visible", [key(0, false, "step"), key(1.2, true, "step"), key(1.3, false, "step"), key(2.6, true, "step"), key(2.7, false, "step")]),
	];
	return documentFromBundle("Looping Idle", 3, true, mergeTracks(nodes, tracks), [{ time: 1.2, name: "blink" }, { time: 2.6, name: "blink" }]);
}


//==============================================================================
// 8. PARALLAX FLYBY — 층별 다른 속도 + 카메라 줌 + 박쥐 통과.
//==============================================================================
function buildParallaxFlyby() {
	const nodes = [
		node("Sky", "paint", { x: 480, y: 270, width: 960, height: 540, color: "#0f1a2eff" }),
		node("Camera", "group", { x: 480, y: 270, width: 960, height: 540 }),
		node("Stars Far", "particle", { parent: "Camera", x: 480, y: 200, width: 20, height: 20, particle: particle({ looping: true, emissionRate: 0, bursts: [{ time: 0, count: 120 }], shape: "box", boxSize: [1400, 360], lifetime: [30, 30], speed: [0, 0], size: [1, 2.5], gravity: [0, 0], damping: 0, renderShape: "circle", startColorA: [1, 1, 1, 0.9], startColorB: [0.7, 0.8, 1, 0.5], colorOverLifetime: [{ time: 0, color: [1, 1, 1, 1] }, { time: 1, color: [1, 1, 1, 1] }], sizeOverLifetime: [1, 1] }) }),
		node("Layer Far", "group", { parent: "Camera", x: 480, y: 270, width: 960, height: 540 }),
		node("Mountain 1", "paint", { parent: "Layer Far", x: 200, y: 460, width: 700, height: 500, color: "#1a2740ff", roundSize: 250 }),
		node("Mountain 2", "paint", { parent: "Layer Far", x: 760, y: 480, width: 800, height: 560, color: "#1a2740ff", roundSize: 280 }),
		node("Mountain 3", "paint", { parent: "Layer Far", x: 1300, y: 470, width: 700, height: 500, color: "#1a2740ff", roundSize: 250 }),
		node("Layer Mid", "group", { parent: "Camera", x: 480, y: 270, width: 960, height: 540 }),
		node("Hill 1", "paint", { parent: "Layer Mid", x: 100, y: 540, width: 600, height: 420, color: "#233552ff", roundSize: 210 }),
		node("Hill 2", "paint", { parent: "Layer Mid", x: 620, y: 560, width: 720, height: 460, color: "#233552ff", roundSize: 230 }),
		node("Hill 3", "paint", { parent: "Layer Mid", x: 1200, y: 540, width: 600, height: 420, color: "#233552ff", roundSize: 210 }),
		node("Layer Near", "group", { parent: "Camera", x: 480, y: 270, width: 960, height: 540 }),
		node("Ground", "paint", { parent: "Layer Near", x: 480, y: 540, width: 2400, height: 160, color: "#2d4468ff" }),
		node("Tree 1", "paint", { parent: "Layer Near", x: 160, y: 430, width: 40, height: 140, color: "#1c2c48ff", roundSize: 20 }),
		node("Tree 2", "paint", { parent: "Layer Near", x: 520, y: 420, width: 48, height: 160, color: "#1c2c48ff", roundSize: 24 }),
		node("Tree 3", "paint", { parent: "Layer Near", x: 900, y: 436, width: 40, height: 130, color: "#1c2c48ff", roundSize: 20 }),
		node("Bat", "sprite", { parent: "Camera", x: -120, y: 180, width: 128, height: 96, image: "bat.png", frameColumns: 4, frameRows: 1 }),
		node("Title", "text", { x: 480, y: 120, width: 700, height: 60, text: "PARALLAX FLYBY", fontSize: 44, bold: true, color: COLOR_INK, opacity: 0 }),
	];
	const tracks = [
		track("Layer Far", "x", [key(0, 480, "linear"), key(8, 320)]),
		track("Layer Mid", "x", [key(0, 480, "linear"), key(8, 100)]),
		track("Layer Near", "x", [key(0, 480, "linear"), key(8, -300)]),
		track("Stars Far", "x", [key(0, 480, "linear"), key(8, 400)]),
		track("Camera", "scaleX", [key(0, 1, "sinusoidal.inOut"), key(4, 1.2), key(8, 1)]),
		track("Camera", "scaleY", [key(0, 1, "sinusoidal.inOut"), key(4, 1.2), key(8, 1)]),
		track("Camera", "y", [key(0, 270, "sinusoidal.inOut"), key(4, 240), key(8, 270)]),
		track("Bat", "x", [key(0.5, -120, "linear"), key(6.5, 1100)]),
		track("Bat", "y", [key(0.5, 180, "sinusoidal.inOut"), key(2, 120), key(3.5, 200), key(5, 130), key(6.5, 180)]),
		track("Bat", "frame", [key(0, 0, "linear"), key(8, 48)]),
		track("Bat", "scaleX", [key(0, 1, "step")]),
		track("Title", "opacity", [key(0.4, 0, "cubic.out"), key(1.2, 1), key(6.5, 1, "cubic.in"), key(7.3, 0)]),
		track("Title", "y", [key(0.4, 140, "cubic.out"), key(1.2, 120)]),
		track("Stars Far", "event", [key(0.05, "play", "step")]),
		track("screen", "fog", [key(0, 0.5, "sinusoidal.inOut"), key(4, 0.2), key(8, 0.5)]),
		track("screen", "bloom", [key(0, 0.6, "step")]),
	];
	return documentFromBundle("Parallax Flyby", 8, true, mergeTracks(nodes, tracks), [{ time: 0.5, name: "bat" }, { time: 4, name: "zoom" }]);
}


//==============================================================================
// 출력.
//==============================================================================
const documentTable = {
	"title.timeline.json": buildTitleReveal(),
	"logo.timeline.json": buildLogoSting(),
	"hud.timeline.json": buildHudIntro(),
	"cutscene.timeline.json": buildCutscene(),
	"combo.timeline.json": buildComboPopup(),
	"transition.timeline.json": buildSceneTransition(),
	"idle.timeline.json": buildLoopingIdle(),
	"parallax.timeline.json": buildParallaxFlyby(),
};
for (const fileName of Object.keys(documentTable)) {
	const outputPath = join(OUTPUT_DIRECTORY, fileName);
	writeFileSync(outputPath, JSON.stringify(documentTable[fileName], null, "\t"));
	console.log("written:", outputPath);
}
