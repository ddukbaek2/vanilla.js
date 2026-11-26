//==============================================================================
// 2D 뼈대 예제의 자산 짓기. (node examples/skeleton2d/tools/makeassets.cjs)
// - 작은 뼈대 캐릭터 hero 를 도형으로 그린 아틀라스(hero.png, hero.atlas.json)와,
//   같은 캐릭터를 엔진 자체 JSON(hero.skeleton.json)과 DragonBones 5.5 JSON(hero_ske.json) 두 꼴로 쓴다.
// - 외부 의존 없이 node 내장 zlib 로 PNG 를 쓴다. 도형은 칸마다 4 x 4 표본으로 덮은 몫을 셈해 가장자리를 부드럽게 한다.
// - 그림은 화면에 서 있는 그대로 그린다. 위를 보는 뼈(몸통, 머리)의 붙임은 90 도, 아래를 보는 뼈(팔다리, 망토)의 붙임은 -90 도 돌린다.
//==============================================================================
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ASSET_DIRECTORY = path.join(__dirname, "..", "assets");
const PAGE_WIDTH = 128;
const PAGE_HEIGHT = 128;
const FRAME_RATE = 30;

//==============================================================================
// 색 글을 RGBA 로.
//==============================================================================
function parseColor(colorText) {
	const hexText = colorText.substring(1);
	return [parseInt(hexText.substring(0, 2), 16), parseInt(hexText.substring(2, 4), 16), parseInt(hexText.substring(4, 6), 16), 255];
}

//==============================================================================
// 쪽 그림. (RGBA 바이트, 덮은 몫으로 섞어 칠한다)
//==============================================================================
const pagePixels = new Uint8Array(PAGE_WIDTH * PAGE_HEIGHT * 4);

function blendPixel(x, y, color, coverage) {
	if (x < 0 || y < 0 || x >= PAGE_WIDTH || y >= PAGE_HEIGHT || coverage <= 0) {
		return;
	}
	const offset = (y * PAGE_WIDTH + x) * 4;
	const sourceAlpha = (color[3] / 255) * coverage;
	const destinationAlpha = pagePixels[offset + 3] / 255;
	const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
	for (let channelIndex = 0; channelIndex < 3; ++channelIndex) {
		const sourceValue = color[channelIndex];
		const destinationValue = pagePixels[offset + channelIndex];
		const outputValue = outputAlpha > 0 ? (sourceValue * sourceAlpha + destinationValue * destinationAlpha * (1 - sourceAlpha)) / outputAlpha : 0;
		pagePixels[offset + channelIndex] = Math.round(outputValue);
	}
	pagePixels[offset + 3] = Math.round(outputAlpha * 255);
}

// 도형 칠하기. (insideFunction(x, y) 가 참인 몫, 칸마다 4 x 4 표본)
function fillShape(left, top, right, bottom, color, insideFunction) {
	for (let y = Math.floor(top); y < Math.ceil(bottom); ++y) {
		for (let x = Math.floor(left); x < Math.ceil(right); ++x) {
			let insideCount = 0;
			for (let sampleY = 0; sampleY < 4; ++sampleY) {
				for (let sampleX = 0; sampleX < 4; ++sampleX) {
					if (insideFunction(x + (sampleX + 0.5) / 4, y + (sampleY + 0.5) / 4)) {
						insideCount += 1;
					}
				}
			}
			blendPixel(x, y, color, insideCount / 16);
		}
	}
}

function fillRoundRect(left, top, width, height, radius, color) {
	fillShape(left, top, left + width, top + height, color, (x, y) => {
		const nearestX = Math.min(Math.max(x, left + radius), left + width - radius);
		const nearestY = Math.min(Math.max(y, top + radius), top + height - radius);
		const differenceX = x - nearestX;
		const differenceY = y - nearestY;
		return differenceX * differenceX + differenceY * differenceY <= radius * radius;
	});
}

function fillCircle(centerX, centerY, radius, color) {
	fillShape(centerX - radius, centerY - radius, centerX + radius, centerY + radius, color, (x, y) => {
		const differenceX = x - centerX;
		const differenceY = y - centerY;
		return differenceX * differenceX + differenceY * differenceY <= radius * radius;
	});
}

// 테두리가 있는 둥근 네모. (바깥 색 위에 안쪽 색)
function drawOutlinedRoundRect(left, top, width, height, radius, outlineColorText, fillColorText) {
	fillRoundRect(left, top, width, height, radius, parseColor(outlineColorText));
	fillRoundRect(left + 1.5, top + 1.5, width - 3, height - 3, Math.max(radius - 1.5, 0), parseColor(fillColorText));
}

//==============================================================================
// 조각 배치와 그리기. (이름, x, y, 너비, 높이, 그리는 함수)
//==============================================================================
const OUTLINE = "#2b2233";
const frameDefinitions = [
	{ name: "torso", x: 2, y: 2, width: 30, height: 42, draw: (left, top) => {
		drawOutlinedRoundRect(left, top, 30, 42, 9, OUTLINE, "#3f7fd6");
		fillRoundRect(left + 4, top + 28, 22, 6, 2, parseColor("#2b4f8f"));
		fillCircle(left + 21, top + 12, 3, parseColor("#ffd44d"));
	} },
	{ name: "head", x: 34, y: 2, width: 32, height: 32, draw: (left, top) => {
		fillCircle(left + 16, top + 16, 15.5, parseColor(OUTLINE));
		fillCircle(left + 16, top + 16, 14, parseColor("#f4c9a0"));
		fillRoundRect(left + 3, top + 2, 26, 10, 5, parseColor("#6b3f2a"));
		fillCircle(left + 21, top + 15, 2.4, parseColor(OUTLINE));
		fillCircle(left + 13, top + 15, 2.4, parseColor(OUTLINE));
		fillRoundRect(left + 16, top + 22, 7, 2, 1, parseColor("#b5524f"));
	} },
	{ name: "headBlink", x: 68, y: 2, width: 32, height: 32, draw: (left, top) => {
		fillCircle(left + 16, top + 16, 15.5, parseColor(OUTLINE));
		fillCircle(left + 16, top + 16, 14, parseColor("#f4c9a0"));
		fillRoundRect(left + 3, top + 2, 26, 10, 5, parseColor("#6b3f2a"));
		fillRoundRect(left + 18, top + 15, 6, 1.6, 0.8, parseColor(OUTLINE));
		fillRoundRect(left + 10, top + 15, 6, 1.6, 0.8, parseColor(OUTLINE));
		fillRoundRect(left + 16, top + 22, 7, 2, 1, parseColor("#b5524f"));
	} },
	{ name: "upperArm", x: 102, y: 2, width: 11, height: 24, draw: (left, top) => {
		drawOutlinedRoundRect(left, top, 11, 24, 5.5, OUTLINE, "#3f7fd6");
	} },
	{ name: "lowerArm", x: 115, y: 2, width: 11, height: 26, draw: (left, top) => {
		drawOutlinedRoundRect(left, top, 11, 20, 5.5, OUTLINE, "#f4c9a0");
		fillCircle(left + 5.5, top + 20, 5.4, parseColor(OUTLINE));
		fillCircle(left + 5.5, top + 20, 4, parseColor("#f4c9a0"));
	} },
	{ name: "thigh", x: 2, y: 48, width: 13, height: 32, draw: (left, top) => {
		drawOutlinedRoundRect(left, top, 13, 32, 6, OUTLINE, "#4a4560");
	} },
	{ name: "shin", x: 17, y: 48, width: 20, height: 34, draw: (left, top) => {
		drawOutlinedRoundRect(left, top, 13, 30, 6, OUTLINE, "#4a4560");
		drawOutlinedRoundRect(left, top + 25, 20, 9, 4, OUTLINE, "#7a4a2e");
	} },
	{ name: "cape", x: 40, y: 48, width: 20, height: 44, draw: (left, top) => {
		drawOutlinedRoundRect(left, top, 20, 44, 5, "#5a1a22", "#c8323f");
		fillRoundRect(left + 3, top + 34, 14, 3, 1.5, parseColor("#ffd44d"));
	} },
];

for (const frameDefinition of frameDefinitions) {
	frameDefinition.draw(frameDefinition.x, frameDefinition.y);
}

//==============================================================================
// PNG 쓰기. (8 비트 RGBA, 줄마다 거르개 0)
//==============================================================================
const crcTable = new Uint32Array(256);
for (let tableIndex = 0; tableIndex < 256; ++tableIndex) {
	let crc = tableIndex;
	for (let bitIndex = 0; bitIndex < 8; ++bitIndex) {
		crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
	}
	crcTable[tableIndex] = crc >>> 0;
}

function computeCrc(bytes) {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
	const lengthBytes = Buffer.alloc(4);
	lengthBytes.writeUInt32BE(data.length);
	const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const crcBytes = Buffer.alloc(4);
	crcBytes.writeUInt32BE(computeCrc(typeAndData));
	return Buffer.concat([lengthBytes, typeAndData, crcBytes]);
}

function encodePng(width, height, pixels) {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8;
	header[9] = 6;
	const rawRows = Buffer.alloc((width * 4 + 1) * height);
	for (let y = 0; y < height; ++y) {
		rawRows[y * (width * 4 + 1)] = 0;
		Buffer.from(pixels.buffer, y * width * 4, width * 4).copy(rawRows, y * (width * 4 + 1) + 1);
	}
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	return Buffer.concat([signature, createChunk("IHDR", header), createChunk("IDAT", zlib.deflateSync(rawRows, { level: 9 })), createChunk("IEND", Buffer.alloc(0))]);
}

//==============================================================================
// 캐릭터 서술. (y 가 아래로 커지는 좌표, 발 가운데가 원점, 오른쪽을 본다)
//==============================================================================
const bones = [
	{ name: "root" },
	{ name: "hip", parent: "root", y: -52 },
	{ name: "torso", parent: "hip", rotation: -90, length: 34 },
	{ name: "head", parent: "torso", x: 34, length: 24 },
	{ name: "capeTop", parent: "torso", x: 31, y: -6, rotation: 180, length: 18 },
	{ name: "capeBottom", parent: "capeTop", x: 18, length: 18 },
	{ name: "upperArmBack", parent: "torso", x: 29, y: -3, rotation: 180, length: 18 },
	{ name: "lowerArmBack", parent: "upperArmBack", x: 18, length: 18 },
	{ name: "thighBack", parent: "hip", x: -3, rotation: 90, length: 26 },
	{ name: "shinBack", parent: "thighBack", x: 26, length: 26 },
	{ name: "thighFront", parent: "hip", x: 3, rotation: 90, length: 26 },
	{ name: "shinFront", parent: "thighFront", x: 26, length: 26 },
	{ name: "upperArmFront", parent: "torso", x: 29, y: 3, rotation: 180, length: 18 },
	{ name: "lowerArmFront", parent: "upperArmFront", x: 18, length: 18 },
	{ name: "handTarget", parent: "root", x: 3, y: -46 },
];

// 슬롯. (그리는 차례, 붙임은 [이름, 조각, 뼈 기준 x, 회전])
const slots = [
	{ name: "cape", bone: "capeTop", attachment: "cape" },
	{ name: "upperArmBack", bone: "upperArmBack", attachment: "upperArm", color: "#c8c8d8" },
	{ name: "lowerArmBack", bone: "lowerArmBack", attachment: "lowerArm", color: "#c8c8d8" },
	{ name: "thighBack", bone: "thighBack", attachment: "thigh", color: "#c8c8d8" },
	{ name: "shinBack", bone: "shinBack", attachment: "shin", color: "#c8c8d8" },
	{ name: "torso", bone: "torso", attachment: "torso" },
	{ name: "head", bone: "head", attachment: "head" },
	{ name: "thighFront", bone: "thighFront", attachment: "thigh" },
	{ name: "shinFront", bone: "shinFront", attachment: "shin" },
	{ name: "upperArmFront", bone: "upperArmFront", attachment: "upperArm" },
	{ name: "lowerArmFront", bone: "lowerArmFront", attachment: "lowerArm" },
];

// 네모 붙임. (슬롯, 붙임 이름, 조각, 뼈 기준 x, y, 회전)
const regionAttachments = [
	["upperArmBack", "upperArm", "upperArm", 9, 0, -90],
	["lowerArmBack", "lowerArm", "lowerArm", 11, 0, -90],
	["thighBack", "thigh", "thigh", 13, 0, -90],
	["shinBack", "shin", "shin", 15, -3, -90],
	["torso", "torso", "torso", 17, 0, 90],
	["head", "head", "head", 13, 0, 90],
	["head", "headBlink", "headBlink", 13, 0, 90],
	["thighFront", "thigh", "thigh", 13, 0, -90],
	["shinFront", "shin", "shin", 15, -3, -90],
	["upperArmFront", "upperArm", "upperArm", 9, 0, -90],
	["lowerArmFront", "lowerArm", "lowerArm", 11, 0, -90],
];

// 망토 메시. (슬롯 뼈 capeTop 기준, 줄 넷 x 칸 둘, 위는 몸통, 가운데는 망토 뼈 둘이 나눠 갖는다)
const capeRows = [0, 13, 26, 40];
const capeVertices = [];
const capeUvs = [];
const capeWeights = [];
const capeRowWeights = [["torso", 1], ["capeTop", 1], ["capeTop", 0.5, "capeBottom", 0.5], ["capeBottom", 1]];
for (let rowIndex = 0; rowIndex < capeRows.length; ++rowIndex) {
	for (const acrossY of [9, -9]) {
		capeVertices.push(capeRows[rowIndex] - 2, acrossY);
		capeUvs.push(acrossY > 0 ? 0 : 1, capeRows[rowIndex] / 40);
		capeWeights.push(capeRowWeights[rowIndex]);
	}
}
const capeTriangles = [];
for (let rowIndex = 0; rowIndex < capeRows.length - 1; ++rowIndex) {
	const first = rowIndex * 2;
	capeTriangles.push(first, first + 1, first + 3, first, first + 3, first + 2);
}

// 클립. (뼈마다 시간줄, 키는 [초, 값 또는 [x, y], 곡선])
const EASE = [0.42, 0, 0.58, 1];
const animations = {
	idle: {
		duration: 2,
		bones: {
			hip: { translate: [[0, [0, 0], EASE], [1, [0, -2], EASE], [2, [0, 0]]] },
			torso: { rotate: [[0, 0, EASE], [1, 2, EASE], [2, 0]] },
			head: { rotate: [[0, 0, EASE], [1, -3, EASE], [2, 0]] },
			upperArmFront: { rotate: [[0, 3, EASE], [1, 6, EASE], [2, 3]] },
			upperArmBack: { rotate: [[0, -3, EASE], [1, -6, EASE], [2, -3]] },
			capeTop: { rotate: [[0, 4, EASE], [1, 8, EASE], [2, 4]] },
			capeBottom: { rotate: [[0, 2, EASE], [1, 8, EASE], [2, 2]] },
		},
		slots: { head: { attachment: [[0, "head"], [1.8, "headBlink"], [1.9, "head"]] } },
	},
	walk: {
		duration: 0.8,
		bones: {
			hip: { translate: [[0, [0, 0], EASE], [0.2, [0, -3], EASE], [0.4, [0, 0], EASE], [0.6, [0, -3], EASE], [0.8, [0, 0]]] },
			torso: { rotate: [[0, 4]] },
			thighFront: { rotate: [[0, -25, EASE], [0.4, 25, EASE], [0.8, -25]] },
			thighBack: { rotate: [[0, 25, EASE], [0.4, -25, EASE], [0.8, 25]] },
			shinFront: { rotate: [[0, 5, "linear"], [0.2, 10, "linear"], [0.4, 40, "linear"], [0.6, 25, "linear"], [0.8, 5]] },
			shinBack: { rotate: [[0, 40, "linear"], [0.2, 25, "linear"], [0.4, 5, "linear"], [0.6, 10, "linear"], [0.8, 40]] },
			upperArmFront: { rotate: [[0, 22, EASE], [0.4, -22, EASE], [0.8, 22]] },
			upperArmBack: { rotate: [[0, -22, EASE], [0.4, 22, EASE], [0.8, -22]] },
			lowerArmFront: { rotate: [[0, -10, EASE], [0.4, -28, EASE], [0.8, -10]] },
			lowerArmBack: { rotate: [[0, -28, EASE], [0.4, -10, EASE], [0.8, -28]] },
			capeTop: { rotate: [[0, 12, EASE], [0.4, 20, EASE], [0.8, 12]] },
			capeBottom: { rotate: [[0, 10, EASE], [0.4, 24, EASE], [0.8, 10]] },
		},
		events: [[0, "step", 0], [0.4, "step", 1]],
	},
	wave: {
		duration: 1,
		bones: {
			upperArmFront: { rotate: [[0, -150, EASE], [0.5, -160, EASE], [1, -150]] },
			lowerArmFront: { rotate: [[0, -15, EASE], [0.5, -70, EASE], [1, -15]] },
		},
		slots: { lowerArmFront: { color: [[0, "#ffffffff", EASE], [0.5, "#ffc890ff", EASE], [1, "#ffffffff"]] } },
	},
};

//==============================================================================
// 엔진 JSON 짓기.
//==============================================================================
function toEngineCurve(curve) {
	if (curve === undefined) {
		return undefined;
	}
	return curve;
}

function buildEngineJson() {
	const skinAttachments = {};
	for (const [slotName, attachmentName, frameName, x, y, rotation] of regionAttachments) {
		skinAttachments[slotName] = skinAttachments[slotName] || {};
		skinAttachments[slotName][attachmentName] = { type: "region", frame: frameName, x: x, y: y, rotation: rotation };
	}
	skinAttachments.cape = { cape: { type: "mesh", frame: "cape", vertices: capeVertices, uvs: capeUvs, triangles: capeTriangles, weights: capeWeights } };
	const animationJson = {};
	for (const animationName of Object.keys(animations)) {
		const animation = animations[animationName];
		const bonesJson = {};
		for (const boneName of Object.keys(animation.bones)) {
			const timelines = animation.bones[boneName];
			bonesJson[boneName] = {};
			if (timelines.rotate) {
				bonesJson[boneName].rotate = timelines.rotate.map(([time, value, curve]) => ({ time: time, value: value, curve: toEngineCurve(curve) }));
			}
			if (timelines.translate) {
				bonesJson[boneName].translate = timelines.translate.map(([time, value, curve]) => ({ time: time, x: value[0], y: value[1], curve: toEngineCurve(curve) }));
			}
		}
		const entry = { duration: animation.duration, bones: bonesJson };
		if (animation.slots) {
			entry.slots = {};
			for (const slotName of Object.keys(animation.slots)) {
				const timelines = animation.slots[slotName];
				entry.slots[slotName] = {};
				if (timelines.attachment) {
					entry.slots[slotName].attachment = timelines.attachment.map(([time, name]) => ({ time: time, name: name }));
				}
				if (timelines.color) {
					entry.slots[slotName].color = timelines.color.map(([time, color, curve]) => ({ time: time, color: color, curve: toEngineCurve(curve) }));
				}
			}
		}
		if (animation.events) {
			entry.events = animation.events.map(([time, name, intValue]) => ({ time: time, name: name, int: intValue }));
		}
		animationJson[animationName] = entry;
	}
	return {
		name: "hero",
		frameRate: FRAME_RATE,
		bones: bones,
		slots: slots,
		ik: [{ name: "armIk", bones: ["upperArmFront", "lowerArmFront"], target: "handTarget", bendPositive: false, mix: 0 }],
		skins: [{ name: "default", attachments: skinAttachments }],
		animations: animationJson,
	};
}

//==============================================================================
// DragonBones JSON 짓기. (같은 캐릭터, 프레임 단위, 회전은 skY, 기울임은 없음)
//==============================================================================
function computeSetupWorldMatrices() {
	const matrices = [];
	for (const bone of bones) {
		const radian = (bone.rotation || 0) * Math.PI / 180;
		const local = [Math.cos(radian), Math.sin(radian), -Math.sin(radian), Math.cos(radian), bone.x || 0, bone.y || 0];
		if (!bone.parent) {
			matrices.push(local);
			continue;
		}
		const parent = matrices[bones.findIndex((candidate) => candidate.name === bone.parent)];
		matrices.push([
			parent[0] * local[0] + parent[2] * local[1],
			parent[1] * local[0] + parent[3] * local[1],
			parent[0] * local[2] + parent[2] * local[3],
			parent[1] * local[2] + parent[3] * local[3],
			parent[0] * local[4] + parent[2] * local[5] + parent[4],
			parent[1] * local[4] + parent[3] * local[5] + parent[5],
		]);
	}
	return matrices;
}

function toDragonBonesCurve(frame, curve) {
	if (Array.isArray(curve)) {
		frame.curve = curve;
	}
	else if (curve === "linear") {
		frame.tweenEasing = 0;
	}
	return frame;
}

function toFrames(keys, buildFrame, duration) {
	const frames = [];
	for (let keyIndex = 0; keyIndex < keys.length; ++keyIndex) {
		const key = keys[keyIndex];
		const nextTime = keyIndex + 1 < keys.length ? keys[keyIndex + 1][0] : duration;
		const frame = buildFrame(key);
		frame.duration = Math.round((nextTime - key[0]) * FRAME_RATE);
		frames.push(frame);
	}
	return frames;
}

function hexToMultiplier(colorText) {
	const hexText = colorText.substring(1);
	const values = [0, 2, 4, 6].map((offset) => parseInt(hexText.substring(offset, offset + 2), 16) / 255 * 100);
	return { rM: values[0], gM: values[1], bM: values[2], aM: values[3] };
}

function buildDragonBonesJson() {
	const worldMatrices = computeSetupWorldMatrices();
	const boneIndexOf = (boneName) => bones.findIndex((bone) => bone.name === boneName);
	const dragonBonesBones = bones.map((bone) => {
		const entry = { name: bone.name };
		if (bone.parent) {
			entry.parent = bone.parent;
		}
		if (bone.length) {
			entry.length = bone.length;
		}
		entry.transform = { x: bone.x || 0, y: bone.y || 0, skX: bone.rotation || 0, skY: bone.rotation || 0 };
		return entry;
	});
	const slotDisplays = {};
	for (const [slotName, attachmentName, frameName, x, y, rotation] of regionAttachments) {
		slotDisplays[slotName] = slotDisplays[slotName] || [];
		slotDisplays[slotName].push({ name: attachmentName, path: frameName, transform: { x: x, y: y, skX: rotation, skY: rotation } });
	}

	// 망토: 꼭짓점은 슬롯 자세(slotPose = capeTop 처음 월드 행렬) 공간, 무게는 [수, 뼈 번호, 무게, ...], bonePose 는 [뼈 번호, a, b, c, d, tx, ty].
	const capeTopMatrix = worldMatrices[boneIndexOf("capeTop")];
	const weightBoneNames = ["torso", "capeTop", "capeBottom"];
	const bonePose = [];
	for (const boneName of weightBoneNames) {
		bonePose.push(boneIndexOf(boneName), ...worldMatrices[boneIndexOf(boneName)]);
	}
	const weights = [];
	for (const vertexWeight of capeWeights) {
		weights.push(vertexWeight.length / 2);
		let totalWeight = 0;
		for (let pairIndex = 1; pairIndex < vertexWeight.length; pairIndex += 2) {
			totalWeight += vertexWeight[pairIndex];
		}
		for (let pairIndex = 0; pairIndex < vertexWeight.length; pairIndex += 2) {
			weights.push(boneIndexOf(vertexWeight[pairIndex]), vertexWeight[pairIndex + 1] / totalWeight);
		}
	}
	slotDisplays.cape = [{ type: "mesh", name: "cape", path: "cape", vertices: capeVertices, uvs: capeUvs, triangles: capeTriangles, weights: weights, slotPose: capeTopMatrix, bonePose: bonePose }];
	const dragonBonesSlots = slots.map((slot) => {
		const entry = { name: slot.name, parent: slot.bone };
		const displayNames = slotDisplays[slot.name].map((display) => display.name);
		entry.displayIndex = displayNames.indexOf(slot.attachment);
		if (slot.color) {
			entry.color = hexToMultiplier(slot.color + "ff");
		}
		return entry;
	});
	const dragonBonesAnimations = Object.keys(animations).map((animationName) => {
		const animation = animations[animationName];
		const entry = { name: animationName, duration: Math.round(animation.duration * FRAME_RATE), playTimes: 0 };
		entry.bone = Object.keys(animation.bones).map((boneName) => {
			const timelines = animation.bones[boneName];
			const boneEntry = { name: boneName };
			if (timelines.translate) {
				boneEntry.translateFrame = toFrames(timelines.translate, ([, value, curve]) => toDragonBonesCurve({ x: value[0], y: value[1] }, curve), animation.duration);
			}
			if (timelines.rotate) {
				boneEntry.rotateFrame = toFrames(timelines.rotate, ([, value, curve]) => toDragonBonesCurve({ rotate: value }, curve), animation.duration);
			}
			return boneEntry;
		});
		if (animation.slots) {
			entry.slot = Object.keys(animation.slots).map((slotName) => {
				const timelines = animation.slots[slotName];
				const slotEntry = { name: slotName };
				if (timelines.attachment) {
					const displayNames = slotDisplays[slotName].map((display) => display.name);
					slotEntry.displayFrame = toFrames(timelines.attachment, ([, name]) => ({ value: displayNames.indexOf(name) }), animation.duration);
				}
				if (timelines.color) {
					slotEntry.colorFrame = toFrames(timelines.color, ([, color, curve]) => toDragonBonesCurve({ value: hexToMultiplier(color) }, curve), animation.duration);
				}
				return slotEntry;
			});
		}
		if (animation.events) {
			entry.frame = toFrames(animation.events, ([, name, intValue]) => ({ events: [{ name: name, ints: [intValue] }] }), animation.duration);
		}
		return entry;
	});
	return {
		name: "hero",
		version: "5.5",
		frameRate: FRAME_RATE,
		armature: [{
			type: "Armature",
			name: "hero",
			frameRate: FRAME_RATE,
			bone: dragonBonesBones,
			slot: dragonBonesSlots,
			skin: [{ name: "", slot: slots.map((slot) => ({ name: slot.name, display: slotDisplays[slot.name] })) }],
			ik: [{ name: "armIk", bone: "lowerArmFront", target: "handTarget", chain: 1, bendPositive: false, weight: 0 }],
			animation: dragonBonesAnimations,
		}],
	};
}

//==============================================================================
// 쓰기.
//==============================================================================
fs.mkdirSync(ASSET_DIRECTORY, { recursive: true });
fs.writeFileSync(path.join(ASSET_DIRECTORY, "hero.png"), encodePng(PAGE_WIDTH, PAGE_HEIGHT, pagePixels));
const atlasFrames = {};
for (const frameDefinition of frameDefinitions) {
	atlasFrames[frameDefinition.name] = [0, frameDefinition.x, frameDefinition.y, frameDefinition.width, frameDefinition.height];
}
fs.writeFileSync(path.join(ASSET_DIRECTORY, "hero.atlas.json"), JSON.stringify({ pagePaths: ["hero.png"], frames: atlasFrames }, null, "\t") + "\n");
fs.writeFileSync(path.join(ASSET_DIRECTORY, "hero.skeleton.json"), JSON.stringify(buildEngineJson(), null, "\t") + "\n");
fs.writeFileSync(path.join(ASSET_DIRECTORY, "hero_ske.json"), JSON.stringify(buildDragonBonesJson(), null, "\t") + "\n");
console.log("썼다: " + ASSET_DIRECTORY);
