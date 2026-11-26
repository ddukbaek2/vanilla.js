//==============================================================================
// 2D 뼈대의 엔진 자체 JSON 읽기. (Skeleton2DData.createFromJson 이 부른다)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 꼴은 Skeleton2DData.createFromJson 의 머리 주석에 있다. 꼴이 틀리면 "[Skeleton2D]" 로 시작하는 오류를 던진다.
// - 러스트 판 experimental/skeleton2d/skeleton2djsonreader.rs 와 같은 꼴, 같은 오류 글이다.
// - 공개 API 가 아니다. (Experimental 이름 공간에 내보내지 않는다)
//==============================================================================


//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Color } from "../../base/color.js";
import { Skeleton2DData, Skeleton2DBoneData, Skeleton2DSlotData, Skeleton2DIkConstraintData, Skeleton2DSkin, Skeleton2DRegionAttachment, Skeleton2DMeshAttachment } from "./skeleton2ddata.js";
import { Skeleton2DAnimation, Skeleton2DTimeline, Skeleton2DTimelineType, Skeleton2DCurveType, Skeleton2DEvent } from "./skeleton2danimation.js";


//==============================================================================
// 오류 던지기. (머리를 붙인다)
//==============================================================================
/**
 * @param { string } message
 */
function throwReadError(message) {
	throw new System.Error("[Skeleton2D] " + message);
}


//==============================================================================
// 객체인지.
//==============================================================================
/**
 * @param { any } value
 * @returns { boolean }
 */
function isPlainObject(value) {
	return value !== null && typeof value === "object" && !System.Array.isArray(value);
}


//==============================================================================
// 숫자 칸 읽기. (없거나 숫자가 아니면 기본값)
//==============================================================================
/**
 * @param { object } source
 * @param { string } key
 * @param { number } defaultValue
 * @returns { number }
 */
function readNumber(source, key, defaultValue) {
	const value = source[key];
	if (typeof value === "number") {
		return value;
	}
	return defaultValue;
}


//==============================================================================
// 글 칸 읽기. (없거나 글이 아니면 기본값)
//==============================================================================
/**
 * @param { object } source
 * @param { string } key
 * @param { string | null } defaultValue
 * @returns { string | null }
 */
function readString(source, key, defaultValue) {
	const value = source[key];
	if (typeof value === "string") {
		return value;
	}
	return defaultValue;
}


//==============================================================================
// 배열 칸 읽기. (없으면 빈 배열, 배열이 아니면 오류)
//==============================================================================
/**
 * @param { object } source
 * @param { string } key
 * @param { string } where
 * @returns { any[] }
 */
function readArray(source, key, where) {
	const value = source[key];
	if (value === undefined || value === null) {
		return [];
	}
	if (!System.Array.isArray(value)) {
		throwReadError(where + " 의 " + key + " 가 배열이 아니다.");
	}
	return value;
}


//==============================================================================
// 숫자 배열 칸 읽기. (없으면 빈 배열, 숫자가 아닌 것이 있으면 오류)
//==============================================================================
/**
 * @param { object } source
 * @param { string } key
 * @param { string } where
 * @returns { number[] }
 */
function readNumberArray(source, key, where) {
	const values = readArray(source, key, where);
	for (const value of values) {
		if (typeof value !== "number") {
			throwReadError(where + " 의 " + key + " 에 숫자가 아닌 값이 있다.");
		}
	}
	return values.slice();
}


//==============================================================================
// 색 글 읽기. ("#rrggbb" 나 "#rrggbbaa", 0 ~ 1 의 Color)
//==============================================================================
/**
 * @param { string } colorText
 * @param { string } where
 * @returns { Color }
 */
function readSkeleton2DColor(colorText, where) {
	const hexText = colorText.startsWith("#") ? colorText.substring(1) : colorText;
	const isValid = (hexText.length === 6 || hexText.length === 8) && /^[0-9a-fA-F]+$/.test(hexText);
	if (!isValid) {
		throwReadError(where + " 의 색 \"" + colorText + "\" 을 읽지 못했다.");
	}
	const red = System.parseInt(hexText.substring(0, 2), 16) / 255;
	const green = System.parseInt(hexText.substring(2, 4), 16) / 255;
	const blue = System.parseInt(hexText.substring(4, 6), 16) / 255;
	const alpha = hexText.length === 8 ? System.parseInt(hexText.substring(6, 8), 16) / 255 : 1;
	return new Color(red, green, blue, alpha);
}


//==============================================================================
// 키의 곡선 읽기. ({ curveType, curveValues })
//==============================================================================
/**
 * @param { object } keyJson
 * @param { string } where
 * @returns { object }
 */
function readCurve(keyJson, where) {
	const curve = keyJson.curve;
	if (curve === undefined || curve === null || curve === "linear") {
		return { curveType: Skeleton2DCurveType.linear, curveValues: null };
	}
	if (curve === "stepped") {
		return { curveType: Skeleton2DCurveType.stepped, curveValues: null };
	}
	const isBezier = System.Array.isArray(curve) && curve.length === 4 && curve.every((value) => typeof value === "number");
	if (!isBezier) {
		throwReadError(where + " 의 curve 를 읽지 못했다. (\"linear\", \"stepped\", [x1, y1, x2, y2])");
	}
	return { curveType: Skeleton2DCurveType.bezier, curveValues: curve.slice() };
}


//==============================================================================
// 키 시각 읽기. (앞 키보다 이르면 오류)
//==============================================================================
/**
 * @param { object } keyJson
 * @param { number } previousTime
 * @param { string } where
 * @returns { number }
 */
function readKeyTime(keyJson, previousTime, where) {
	if (!isPlainObject(keyJson)) {
		throwReadError(where + " 의 키가 객체가 아니다.");
	}
	const time = readNumber(keyJson, "time", 0);
	if (time < previousTime) {
		throwReadError(where + " 의 키 시각 " + time + " 이 앞 키보다 이르다.");
	}
	return time;
}


//==============================================================================
// 뼈 읽기.
//==============================================================================
/**
 * @param { Skeleton2DData } skeletonData
 * @param { object } json
 */
function readBones(skeletonData, json) {
	const boneJsonList = readArray(json, "bones", "뼈대");
	for (const boneJson of boneJsonList) {
		if (!isPlainObject(boneJson)) {
			throwReadError("뼈가 객체가 아니다.");
		}
		const name = readString(boneJson, "name", null);
		if (name === null) {
			throwReadError("이름 없는 뼈가 있다.");
		}
		const existingIndex = skeletonData.findBoneIndex(name);
		if (existingIndex >= 0) {
			throwReadError("뼈 이름 \"" + name + "\" 이 겹친다.");
		}
		const parentName = readString(boneJson, "parent", null);
		let parentIndex = -1;
		if (parentName !== null) {
			parentIndex = skeletonData.findBoneIndex(parentName);
			if (parentIndex < 0) {
				throwReadError("뼈 \"" + name + "\" 의 부모 \"" + parentName + "\" 가 앞에 없다. (부모가 앞에 와야 한다)");
			}
		}
		const bones = skeletonData.getBones();
		const boneData = new Skeleton2DBoneData(bones.length, name, parentIndex);
		const x = readNumber(boneJson, "x", 0);
		const y = readNumber(boneJson, "y", 0);
		const rotation = readNumber(boneJson, "rotation", 0);
		const scaleX = readNumber(boneJson, "scaleX", 1);
		const scaleY = readNumber(boneJson, "scaleY", 1);
		const shearX = readNumber(boneJson, "shearX", 0);
		const shearY = readNumber(boneJson, "shearY", 0);
		const length = readNumber(boneJson, "length", 0);
		boneData.setTransform(x, y, rotation, scaleX, scaleY, shearX, shearY);
		boneData.setLength(length);
		skeletonData.addBone(boneData);
	}
}


//==============================================================================
// 슬롯 읽기.
//==============================================================================
/**
 * @param { Skeleton2DData } skeletonData
 * @param { object } json
 */
function readSlots(skeletonData, json) {
	const slotJsonList = readArray(json, "slots", "뼈대");
	for (const slotJson of slotJsonList) {
		if (!isPlainObject(slotJson)) {
			throwReadError("슬롯이 객체가 아니다.");
		}
		const name = readString(slotJson, "name", null);
		if (name === null) {
			throwReadError("이름 없는 슬롯이 있다.");
		}
		const existingIndex = skeletonData.findSlotIndex(name);
		if (existingIndex >= 0) {
			throwReadError("슬롯 이름 \"" + name + "\" 이 겹친다.");
		}
		const boneName = readString(slotJson, "bone", null);
		const boneIndex = boneName === null ? -1 : skeletonData.findBoneIndex(boneName);
		if (boneIndex < 0) {
			throwReadError("슬롯 \"" + name + "\" 의 뼈 \"" + boneName + "\" 가 없다.");
		}
		const slots = skeletonData.getSlots();
		const slotData = new Skeleton2DSlotData(slots.length, name, boneIndex);
		const colorText = readString(slotJson, "color", null);
		if (colorText !== null) {
			const color = readSkeleton2DColor(colorText, "슬롯 \"" + name + "\"");
			slotData.setColor(color);
		}
		const attachmentName = readString(slotJson, "attachment", null);
		slotData.setAttachmentName(attachmentName);
		const blendMode = readString(slotJson, "blendMode", "source-over");
		slotData.setBlendMode(blendMode);
		skeletonData.addSlot(slotData);
	}
}


//==============================================================================
// IK 제약 읽기.
//==============================================================================
/**
 * @param { Skeleton2DData } skeletonData
 * @param { object } json
 */
function readIkConstraints(skeletonData, json) {
	const ikJsonList = readArray(json, "ik", "뼈대");
	for (const ikJson of ikJsonList) {
		if (!isPlainObject(ikJson)) {
			throwReadError("IK 가 객체가 아니다.");
		}
		const name = readString(ikJson, "name", "");
		const boneNames = readArray(ikJson, "bones", "IK \"" + name + "\"");
		if (boneNames.length < 1 || boneNames.length > 2) {
			throwReadError("IK \"" + name + "\" 의 뼈는 하나나 둘이어야 한다.");
		}
		const boneIndices = [];
		for (const boneName of boneNames) {
			const boneIndex = typeof boneName === "string" ? skeletonData.findBoneIndex(boneName) : -1;
			if (boneIndex < 0) {
				throwReadError("IK \"" + name + "\" 의 뼈 \"" + boneName + "\" 가 없다.");
			}
			boneIndices.push(boneIndex);
		}
		if (boneIndices.length === 2) {
			const bones = skeletonData.getBones();
			const childParentIndex = bones[boneIndices[1]].getParentIndex();
			if (childParentIndex !== boneIndices[0]) {
				throwReadError("IK \"" + name + "\" 의 둘째 뼈는 첫째 뼈의 자식이어야 한다.");
			}
		}
		const targetName = readString(ikJson, "target", null);
		const targetIndex = targetName === null ? -1 : skeletonData.findBoneIndex(targetName);
		if (targetIndex < 0) {
			throwReadError("IK \"" + name + "\" 의 목표 뼈 \"" + targetName + "\" 가 없다.");
		}
		const ikConstraints = skeletonData.getIkConstraints();
		const ikConstraintData = new Skeleton2DIkConstraintData(ikConstraints.length, name, boneIndices, targetIndex);
		const isBendPositive = ikJson.bendPositive !== false;
		const mix = readNumber(ikJson, "mix", 1);
		ikConstraintData.setBendPositive(isBendPositive);
		ikConstraintData.setMix(mix);
		skeletonData.addIkConstraint(ikConstraintData);
	}
}


//==============================================================================
// 메시 붙임 읽기. (무게가 있으면 처음 자세의 월드 행렬로 묶은 자리를 셈한다)
//==============================================================================
/**
 * @param { Skeleton2DData } skeletonData
 * @param { number[] } worldMatrices
 * @param { number } slotIndex
 * @param { string } attachmentName
 * @param { object } attachmentJson
 * @returns { Skeleton2DMeshAttachment }
 */
function readMeshAttachment(skeletonData, worldMatrices, slotIndex, attachmentName, attachmentJson) {
	const where = "메시 \"" + attachmentName + "\"";
	const frameName = readString(attachmentJson, "frame", attachmentName);
	const meshAttachment = new Skeleton2DMeshAttachment(attachmentName, frameName);
	const uvs = readNumberArray(attachmentJson, "uvs", where);
	const triangles = readNumberArray(attachmentJson, "triangles", where);
	const vertices = readNumberArray(attachmentJson, "vertices", where);
	const vertexCount = System.Math.floor(uvs.length / 2);
	if (vertices.length !== vertexCount * 2) {
		throwReadError(where + " 의 vertices 와 uvs 의 꼭짓점 수가 다르다.");
	}
	if (triangles.length % 3 !== 0) {
		throwReadError(where + " 의 triangles 가 셋씩 나뉘지 않는다.");
	}
	for (const vertexIndex of triangles) {
		if (vertexIndex < 0 || vertexIndex >= vertexCount || !System.Number.isInteger(vertexIndex)) {
			throwReadError(where + " 의 triangles 에 없는 꼭짓점 " + vertexIndex + " 이 있다.");
		}
	}
	meshAttachment.setGeometry(uvs, triangles);

	const weightJsonList = readArray(attachmentJson, "weights", where);
	if (weightJsonList.length === 0) {
		meshAttachment.setVertices(vertices);
		return meshAttachment;
	}
	if (weightJsonList.length !== vertexCount) {
		throwReadError(where + " 의 weights 수가 꼭짓점 수와 다르다.");
	}

	// 슬롯 뼈 기준 꼭짓점을 처음 자세의 월드 자리로 옮긴 뒤, 영향 뼈마다 그 뼈 기준 자리로 되돌린다.
	const slots = skeletonData.getSlots();
	const slotBoneOffset = slots[slotIndex].getBoneIndex() * 6;
	const influenceCounts = [];
	const influenceBoneIndices = [];
	const influenceValues = [];
	for (let vertexIndex = 0; vertexIndex < vertexCount; ++vertexIndex) {
		const localX = vertices[vertexIndex * 2];
		const localY = vertices[vertexIndex * 2 + 1];
		const worldX = worldMatrices[slotBoneOffset] * localX + worldMatrices[slotBoneOffset + 2] * localY + worldMatrices[slotBoneOffset + 4];
		const worldY = worldMatrices[slotBoneOffset + 1] * localX + worldMatrices[slotBoneOffset + 3] * localY + worldMatrices[slotBoneOffset + 5];
		const weightJson = weightJsonList[vertexIndex];
		if (!System.Array.isArray(weightJson) || weightJson.length < 2 || weightJson.length % 2 !== 0) {
			throwReadError(where + " 의 꼭짓점 " + vertexIndex + " 무게는 [뼈 이름, 무게, ...] 꼴이어야 한다.");
		}
		let totalWeight = 0;
		for (let pairIndex = 1; pairIndex < weightJson.length; pairIndex += 2) {
			totalWeight += typeof weightJson[pairIndex] === "number" ? weightJson[pairIndex] : 0;
		}
		if (totalWeight <= 0) {
			throwReadError(where + " 의 꼭짓점 " + vertexIndex + " 무게 합이 0 이다.");
		}
		influenceCounts.push(weightJson.length / 2);
		for (let pairIndex = 0; pairIndex < weightJson.length; pairIndex += 2) {
			const boneName = weightJson[pairIndex];
			const boneIndex = typeof boneName === "string" ? skeletonData.findBoneIndex(boneName) : -1;
			if (boneIndex < 0) {
				throwReadError(where + " 의 무게 뼈 \"" + boneName + "\" 가 없다.");
			}
			const boneOffset = boneIndex * 6;
			const boneA = worldMatrices[boneOffset];
			const boneB = worldMatrices[boneOffset + 1];
			const boneC = worldMatrices[boneOffset + 2];
			const boneD = worldMatrices[boneOffset + 3];
			const determinant = boneA * boneD - boneB * boneC;
			if (determinant === 0) {
				throwReadError(where + " 의 무게 뼈 \"" + boneName + "\" 의 처음 행렬을 되돌릴 수 없다. (크기 0)");
			}
			const differenceX = worldX - worldMatrices[boneOffset + 4];
			const differenceY = worldY - worldMatrices[boneOffset + 5];
			const bindX = (boneD * differenceX - boneC * differenceY) / determinant;
			const bindY = (boneA * differenceY - boneB * differenceX) / determinant;
			const weight = typeof weightJson[pairIndex + 1] === "number" ? weightJson[pairIndex + 1] : 0;
			influenceBoneIndices.push(boneIndex);
			influenceValues.push(bindX, bindY, weight / totalWeight);
		}
	}
	meshAttachment.setWeights(influenceCounts, influenceBoneIndices, influenceValues);
	return meshAttachment;
}


//==============================================================================
// 스킨 읽기.
//==============================================================================
/**
 * @param { Skeleton2DData } skeletonData
 * @param { object } json
 */
function readSkins(skeletonData, json) {
	const skinJsonList = readArray(json, "skins", "뼈대");
	if (skinJsonList.length === 0) {
		return;
	}
	const bones = skeletonData.getBones();
	const worldMatrices = Skeleton2DData.computeSetupWorldMatrices(bones);
	for (const skinJson of skinJsonList) {
		if (!isPlainObject(skinJson)) {
			throwReadError("스킨이 객체가 아니다.");
		}
		const skinName = readString(skinJson, "name", "default");
		const skin = new Skeleton2DSkin(skinName);
		const slotAttachmentsJson = isPlainObject(skinJson.attachments) ? skinJson.attachments : {};
		for (const slotName of System.Object.keys(slotAttachmentsJson)) {
			const slotIndex = skeletonData.findSlotIndex(slotName);
			if (slotIndex < 0) {
				throwReadError("스킨 \"" + skinName + "\" 의 슬롯 \"" + slotName + "\" 가 없다.");
			}
			const attachmentsJson = slotAttachmentsJson[slotName];
			if (!isPlainObject(attachmentsJson)) {
				throwReadError("스킨 \"" + skinName + "\" 의 슬롯 \"" + slotName + "\" 붙임이 객체가 아니다.");
			}
			for (const attachmentName of System.Object.keys(attachmentsJson)) {
				const attachmentJson = attachmentsJson[attachmentName];
				if (!isPlainObject(attachmentJson)) {
					throwReadError("붙임 \"" + attachmentName + "\" 이 객체가 아니다.");
				}
				const attachmentType = readString(attachmentJson, "type", "region");
				if (attachmentType === "region") {
					const frameName = readString(attachmentJson, "frame", attachmentName);
					const regionAttachment = new Skeleton2DRegionAttachment(attachmentName, frameName);
					const x = readNumber(attachmentJson, "x", 0);
					const y = readNumber(attachmentJson, "y", 0);
					const rotation = readNumber(attachmentJson, "rotation", 0);
					const scaleX = readNumber(attachmentJson, "scaleX", 1);
					const scaleY = readNumber(attachmentJson, "scaleY", 1);
					const width = readNumber(attachmentJson, "width", 0);
					const height = readNumber(attachmentJson, "height", 0);
					const pivotX = readNumber(attachmentJson, "pivotX", 0.5);
					const pivotY = readNumber(attachmentJson, "pivotY", 0.5);
					regionAttachment.setTransform(x, y, rotation, scaleX, scaleY);
					regionAttachment.setSize(width, height);
					regionAttachment.setPivot(pivotX, pivotY);
					skin.setAttachment(slotIndex, attachmentName, regionAttachment);
				}
				else if (attachmentType === "mesh") {
					const meshAttachment = readMeshAttachment(skeletonData, worldMatrices, slotIndex, attachmentName, attachmentJson);
					skin.setAttachment(slotIndex, attachmentName, meshAttachment);
				}
				else {
					throwReadError("붙임 \"" + attachmentName + "\" 의 종류 \"" + attachmentType + "\" 를 모른다. (region, mesh)");
				}
			}
		}
		skeletonData.addSkin(skin);
	}
}


//==============================================================================
// 뼈 시간줄 읽기. (rotate, translate, scale, shear)
//==============================================================================
/**
 * @param { Skeleton2DAnimation } animation
 * @param { number } boneIndex
 * @param { string } timelineName
 * @param { any[] } keyJsonList
 * @param { string } where
 * @returns { number } 마지막 키 시각.
 */
function readBoneTimeline(animation, boneIndex, timelineName, keyJsonList, where) {
	const timelineTypeTable = {
		rotate: Skeleton2DTimelineType.rotate,
		translate: Skeleton2DTimelineType.translate,
		scale: Skeleton2DTimelineType.scale,
		shear: Skeleton2DTimelineType.shear,
	};
	const timelineType = timelineTypeTable[timelineName];
	if (timelineType === undefined) {
		throwReadError(where + " 의 시간줄 \"" + timelineName + "\" 를 모른다. (rotate, translate, scale, shear)");
	}
	if (!System.Array.isArray(keyJsonList)) {
		throwReadError(where + " 의 " + timelineName + " 가 배열이 아니다.");
	}
	const timeline = new Skeleton2DTimeline(timelineType, boneIndex);
	const defaultValue = timelineType === Skeleton2DTimelineType.scale ? 1 : 0;
	let previousTime = 0;
	for (const keyJson of keyJsonList) {
		const time = readKeyTime(keyJson, previousTime, where);
		const curve = readCurve(keyJson, where);
		if (timelineType === Skeleton2DTimelineType.rotate) {
			const value = readNumber(keyJson, "value", 0);
			timeline.addValueFrame(time, [value], curve.curveType, curve.curveValues);
		}
		else {
			const x = readNumber(keyJson, "x", defaultValue);
			const y = readNumber(keyJson, "y", defaultValue);
			timeline.addValueFrame(time, [x, y], curve.curveType, curve.curveValues);
		}
		previousTime = time;
	}
	animation.addTimeline(timeline);
	return previousTime;
}


//==============================================================================
// 클립 하나 읽기.
//==============================================================================
/**
 * @param { Skeleton2DData } skeletonData
 * @param { string } animationName
 * @param { object } animationJson
 * @returns { Skeleton2DAnimation }
 */
function readAnimation(skeletonData, animationName, animationJson) {
	const where = "클립 \"" + animationName + "\"";
	if (!isPlainObject(animationJson)) {
		throwReadError(where + " 가 객체가 아니다.");
	}
	const animation = new Skeleton2DAnimation(animationName, 0);
	let lastTime = 0;

	// 뼈 시간줄.
	const bonesJson = isPlainObject(animationJson.bones) ? animationJson.bones : {};
	for (const boneName of System.Object.keys(bonesJson)) {
		const boneIndex = skeletonData.findBoneIndex(boneName);
		if (boneIndex < 0) {
			throwReadError(where + " 의 뼈 \"" + boneName + "\" 가 없다.");
		}
		const timelinesJson = bonesJson[boneName];
		if (!isPlainObject(timelinesJson)) {
			throwReadError(where + " 의 뼈 \"" + boneName + "\" 시간줄이 객체가 아니다.");
		}
		for (const timelineName of System.Object.keys(timelinesJson)) {
			const timelineLastTime = readBoneTimeline(animation, boneIndex, timelineName, timelinesJson[timelineName], where + " 뼈 \"" + boneName + "\"");
			lastTime = System.Math.max(lastTime, timelineLastTime);
		}
	}

	// 슬롯 시간줄.
	const slotsJson = isPlainObject(animationJson.slots) ? animationJson.slots : {};
	for (const slotName of System.Object.keys(slotsJson)) {
		const slotIndex = skeletonData.findSlotIndex(slotName);
		if (slotIndex < 0) {
			throwReadError(where + " 의 슬롯 \"" + slotName + "\" 가 없다.");
		}
		const timelinesJson = slotsJson[slotName];
		if (!isPlainObject(timelinesJson)) {
			throwReadError(where + " 의 슬롯 \"" + slotName + "\" 시간줄이 객체가 아니다.");
		}
		const slotWhere = where + " 슬롯 \"" + slotName + "\"";
		for (const timelineName of System.Object.keys(timelinesJson)) {
			const keyJsonList = readArray(timelinesJson, timelineName, slotWhere);
			let previousTime = 0;
			if (timelineName === "color") {
				const timeline = new Skeleton2DTimeline(Skeleton2DTimelineType.color, slotIndex);
				for (const keyJson of keyJsonList) {
					const time = readKeyTime(keyJson, previousTime, slotWhere);
					const curve = readCurve(keyJson, slotWhere);
					const colorText = readString(keyJson, "color", "#ffffffff");
					const color = readSkeleton2DColor(colorText, slotWhere);
					timeline.addValueFrame(time, [color.red, color.green, color.blue, color.alpha], curve.curveType, curve.curveValues);
					previousTime = time;
				}
				animation.addTimeline(timeline);
			}
			else if (timelineName === "attachment") {
				const timeline = new Skeleton2DTimeline(Skeleton2DTimelineType.attachment, slotIndex);
				for (const keyJson of keyJsonList) {
					const time = readKeyTime(keyJson, previousTime, slotWhere);
					const attachmentName = readString(keyJson, "name", null);
					timeline.addAttachmentFrame(time, attachmentName);
					previousTime = time;
				}
				animation.addTimeline(timeline);
			}
			else {
				throwReadError(slotWhere + " 의 시간줄 \"" + timelineName + "\" 를 모른다. (color, attachment)");
			}
			lastTime = System.Math.max(lastTime, previousTime);
		}
	}

	// 그리기 차례 시간줄.
	const drawOrderJsonList = readArray(animationJson, "drawOrder", where);
	if (drawOrderJsonList.length > 0) {
		const slots = skeletonData.getSlots();
		const timeline = new Skeleton2DTimeline(Skeleton2DTimelineType.drawOrder, -1);
		let previousTime = 0;
		for (const keyJson of drawOrderJsonList) {
			const time = readKeyTime(keyJson, previousTime, where + " drawOrder");
			const orderJson = keyJson.order;
			if (orderJson === undefined || orderJson === null) {
				timeline.addDrawOrderFrame(time, null);
			}
			else {
				if (!System.Array.isArray(orderJson) || orderJson.length !== slots.length) {
					throwReadError(where + " 의 drawOrder 키는 슬롯 이름을 모두 담아야 한다.");
				}
				const drawOrder = [];
				for (const slotName of orderJson) {
					const slotIndex = typeof slotName === "string" ? skeletonData.findSlotIndex(slotName) : -1;
					if (slotIndex < 0 || drawOrder.includes(slotIndex)) {
						throwReadError(where + " 의 drawOrder 슬롯 \"" + slotName + "\" 가 없거나 겹친다.");
					}
					drawOrder.push(slotIndex);
				}
				timeline.addDrawOrderFrame(time, drawOrder);
			}
			previousTime = time;
		}
		animation.addTimeline(timeline);
		lastTime = System.Math.max(lastTime, previousTime);
	}

	// 사건 시간줄.
	const eventJsonList = readArray(animationJson, "events", where);
	if (eventJsonList.length > 0) {
		const timeline = new Skeleton2DTimeline(Skeleton2DTimelineType.event, -1);
		let previousTime = 0;
		for (const keyJson of eventJsonList) {
			const time = readKeyTime(keyJson, previousTime, where + " events");
			const name = readString(keyJson, "name", "");
			const intValue = readNumber(keyJson, "int", 0);
			const floatValue = readNumber(keyJson, "float", 0);
			const stringValue = readString(keyJson, "string", "");
			const event = new Skeleton2DEvent(name, time, intValue, floatValue, stringValue);
			timeline.addEventFrame(event);
			previousTime = time;
		}
		animation.addTimeline(timeline);
		lastTime = System.Math.max(lastTime, previousTime);
	}

	const duration = readNumber(animationJson, "duration", lastTime);
	animation.setDuration(duration);
	return animation;
}


//==============================================================================
// 엔진 자체 JSON 읽기. (꼴이 틀리면 오류를 던진다)
//==============================================================================
/**
 * @param { object } json JSON 을 읽은 객체.
 * @returns { Skeleton2DData } 지은 자료.
 */
export function readSkeleton2DJson(json) {
	if (!isPlainObject(json)) {
		throwReadError("뼈대 JSON 이 객체가 아니다.");
	}
	const name = readString(json, "name", "");
	const skeletonData = new Skeleton2DData(name);
	const frameRate = readNumber(json, "frameRate", 30);
	skeletonData.setFrameRate(frameRate);
	readBones(skeletonData, json);
	readSlots(skeletonData, json);
	readIkConstraints(skeletonData, json);
	readSkins(skeletonData, json);
	const animationsJson = json.animations;
	if (animationsJson !== undefined && animationsJson !== null) {
		if (!isPlainObject(animationsJson)) {
			throwReadError("animations 가 객체가 아니다. ({ 이름: 클립 })");
		}
		for (const animationName of System.Object.keys(animationsJson)) {
			const animation = readAnimation(skeletonData, animationName, animationsJson[animationName]);
			skeletonData.addAnimation(animation);
		}
	}
	return skeletonData;
}
