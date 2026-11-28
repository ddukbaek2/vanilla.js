//==============================================================================
// DragonBones 5.x JSON 읽기. (Skeleton2DData.createFromDragonBones 가 부른다)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - DragonBones 는 MIT 라이선스이고, 키 이름과 뜻은 DragonBones 5.5 형식 명세(DragonBones/Tools 의 dragonbones_json_format_5.5.md)와
//   DragonBonesJS 의 ObjectDataParser 를 보고 맞췄다. 코드는 옮기지 않고 엔진 자료 꼴로 새로 짰다.
// - 좌표는 엔진과 같이 y 가 아래로 커진다. (DragonBones 코어의 yDown 기본값)
// - 뼈 transform: 회전 = skY(또는 rotate), 기울임 y = skX - skY(또는 skew), 기울임 x = 0. 엔진 뼈 행렬과 DragonBones Transform.toMatrix 가 같은 값이 된다.
// - 무게 있는 메시: 꼭짓점을 slotPose 로 뼈대 공간에 옮기고, 영향 뼈마다 bonePose 의 되돌림 행렬로 그 뼈 기준 묶은 자리를 셈한다.
// - 무게 없는 메시와 그림은 display 의 transform 을 슬롯 뼈 기준으로 건다.
// - 프레임 수는 frameRate 로 초가 된다. 키프레임의 duration 기본은 1 프레임이다.
// - 러스트 판 experimental/skeleton2d/dragonbonesreader.rs 와 같은 꼴, 같은 오류 글이다. 공개 API 가 아니다.
//==============================================================================


//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Color } from "../../base/color.js";
import { Skeleton2DData, Skeleton2DBoneData, Skeleton2DSlotData, Skeleton2DIkConstraintData, Skeleton2DSkin, Skeleton2DRegionAttachment, Skeleton2DMeshAttachment } from "./skeleton2ddata.js";
import { Skeleton2DAnimation, Skeleton2DTimeline, Skeleton2DTimelineType, Skeleton2DCurveType, Skeleton2DEvent } from "./skeleton2danimation.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// DragonBones 섞기 이름 → 엔진 섞기 이름. (없는 것은 source-over)
const BLEND_MODE_TABLE = {
	normal: "source-over",
	add: "lighter",
	darken: "darken",
	difference: "difference",
	hardlight: "hard-light",
	lighten: "lighten",
	multiply: "multiply",
	overlay: "overlay",
	screen: "screen",
};

// 도를 라디안으로.
const DEGREE_TO_RADIAN = System.Math.PI / 180;


//==============================================================================
// 오류 던지기. (머리를 붙인다)
//==============================================================================
/**
 * @param { string } message
 */
function throwReadError(message) {
	throw new System.Error("[Skeleton2D] DragonBones " + message);
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
 * @param { string } defaultValue
 * @returns { string }
 */
function readString(source, key, defaultValue) {
	const value = source[key];
	if (typeof value === "string") {
		return value;
	}
	return defaultValue;
}


//==============================================================================
// 배열 칸 읽기. (없거나 배열이 아니면 빈 배열)
//==============================================================================
/**
 * @param { object } source
 * @param { string } key
 * @returns { any[] }
 */
function readArray(source, key) {
	const value = source[key];
	if (System.Array.isArray(value)) {
		return value;
	}
	return [];
}


//==============================================================================
// transform 읽기. ({ x, y, rotation, shearY, scaleX, scaleY }, 도)
//==============================================================================
/**
 * @param { any } transformJson
 * @returns { object }
 */
function readTransform(transformJson) {
	const transform = { x: 0, y: 0, rotation: 0, shearY: 0, scaleX: 1, scaleY: 1 };
	if (!isPlainObject(transformJson)) {
		return transform;
	}
	transform.x = readNumber(transformJson, "x", 0);
	transform.y = readNumber(transformJson, "y", 0);
	if (transformJson.rotate !== undefined || transformJson.skew !== undefined) {
		transform.rotation = readNumber(transformJson, "rotate", 0);
		transform.shearY = readNumber(transformJson, "skew", 0);
	}
	else {
		const skewX = readNumber(transformJson, "skX", 0);
		const skewY = readNumber(transformJson, "skY", 0);
		transform.rotation = skewY;
		transform.shearY = skewX - skewY;
	}
	transform.scaleX = readNumber(transformJson, "scX", 1);
	transform.scaleY = readNumber(transformJson, "scY", 1);
	return transform;
}


//==============================================================================
// 색 변환의 곱 읽기. (aM, rM, gM, bM 은 0 ~ 100, 더하기 aO 등은 읽지 않는다)
//==============================================================================
/**
 * @param { any } colorJson
 * @returns { Color }
 */
function readColorTransform(colorJson) {
	if (!isPlainObject(colorJson)) {
		return new Color(1, 1, 1, 1);
	}
	const red = readNumber(colorJson, "rM", 100) * 0.01;
	const green = readNumber(colorJson, "gM", 100) * 0.01;
	const blue = readNumber(colorJson, "bM", 100) * 0.01;
	const alpha = readNumber(colorJson, "aM", 100) * 0.01;
	return new Color(red, green, blue, alpha);
}


//==============================================================================
// 키프레임의 곡선 읽기. ({ curveType, curveValues })
// - curve 가 넷이면 베지어, 더 길면(여러 토막) 선형. 없으면 tweenEasing: 없음은 계단, 0 은 선형,
//   음수는 QuadIn, 0 ~ 1 은 QuadOut, 1 초과는 QuadInOut 을 그 세기로 선형과 섞은 것. Quad 둘은 같은 베지어로, QuadInOut 은 smoothstep 베지어로 담는다.
//==============================================================================
/**
 * @param { object } frameJson
 * @returns { object }
 */
function readFrameCurve(frameJson) {
	const curve = frameJson.curve;
	if (System.Array.isArray(curve)) {
		if (curve.length === 4) {
			return { curveType: Skeleton2DCurveType.bezier, curveValues: curve.slice() };
		}
		return { curveType: Skeleton2DCurveType.linear, curveValues: null };
	}
	const tweenEasing = frameJson.tweenEasing;
	if (typeof tweenEasing !== "number") {
		return { curveType: Skeleton2DCurveType.stepped, curveValues: null };
	}
	if (tweenEasing === 0) {
		return { curveType: Skeleton2DCurveType.linear, curveValues: null };
	}
	const oneThird = 1 / 3;
	const twoThirds = 2 / 3;
	if (tweenEasing < 0) {
		const easing = -tweenEasing;
		return { curveType: Skeleton2DCurveType.bezier, curveValues: [oneThird, (1 - easing) / 3, twoThirds, (2 - easing) / 3] };
	}
	if (tweenEasing <= 1) {
		const easing = tweenEasing;
		return { curveType: Skeleton2DCurveType.bezier, curveValues: [oneThird, (1 + easing) / 3, twoThirds, (2 + easing) / 3] };
	}
	const easing = tweenEasing - 1;
	return { curveType: Skeleton2DCurveType.bezier, curveValues: [oneThird, (1 - easing) / 3, twoThirds, (2 + easing) / 3] };
}


//==============================================================================
// 슬롯의 display 목록에서 붙임 이름 짓기. (같은 이름이 겹치면 "#번호", 읽지 않는 종류는 null)
//==============================================================================
/**
 * @param { any[] } displayJsonList
 * @returns { (string | null)[] }
 */
function readDisplayNames(displayJsonList) {
	const displayNames = [];
	for (let displayIndex = 0; displayIndex < displayJsonList.length; ++displayIndex) {
		const displayJson = displayJsonList[displayIndex];
		if (!isPlainObject(displayJson)) {
			displayNames.push(null);
			continue;
		}
		const displayType = readString(displayJson, "type", "image");
		if (displayType !== "image" && displayType !== "mesh") {
			displayNames.push(null);
			continue;
		}
		let name = readString(displayJson, "name", "");
		if (name.length === 0) {
			name = readString(displayJson, "path", "display" + displayIndex);
		}
		if (displayNames.includes(name)) {
			name = name + "#" + displayIndex;
		}
		displayNames.push(name);
	}
	return displayNames;
}


//==============================================================================
// 메시 display 읽기.
//==============================================================================
/**
 * @param { Skeleton2DData } skeletonData
 * @param { string } attachmentName
 * @param { string } frameName
 * @param { object } displayJson
 * @returns { Skeleton2DMeshAttachment }
 */
function readMeshDisplay(skeletonData, attachmentName, frameName, displayJson) {
	const where = "메시 \"" + attachmentName + "\"";
	const vertices = readArray(displayJson, "vertices");
	const uvs = readArray(displayJson, "uvs");
	const triangles = readArray(displayJson, "triangles");
	const vertexCount = System.Math.floor(vertices.length / 2);
	if (uvs.length !== vertexCount * 2) {
		throwReadError(where + " 의 uvs 와 vertices 의 꼭짓점 수가 다르다.");
	}
	if (triangles.length % 3 !== 0) {
		throwReadError(where + " 의 triangles 가 셋씩 나뉘지 않는다.");
	}
	const meshAttachment = new Skeleton2DMeshAttachment(attachmentName, frameName);
	meshAttachment.setGeometry(uvs.slice(), triangles.slice());

	const weights = readArray(displayJson, "weights");
	if (weights.length === 0) {
		// 무게 없는 꼭짓점은 display transform 을 걸어 슬롯 뼈 기준으로 담는다.
		const transform = readTransform(displayJson.transform);
		const xAxisRadian = transform.rotation * DEGREE_TO_RADIAN;
		const yAxisRadian = (transform.rotation + transform.shearY) * DEGREE_TO_RADIAN;
		const localA = System.Math.cos(xAxisRadian) * transform.scaleX;
		const localB = System.Math.sin(xAxisRadian) * transform.scaleX;
		const localC = -System.Math.sin(yAxisRadian) * transform.scaleY;
		const localD = System.Math.cos(yAxisRadian) * transform.scaleY;
		const boneLocalVertices = [];
		for (let vertexIndex = 0; vertexIndex < vertexCount; ++vertexIndex) {
			const vertexX = vertices[vertexIndex * 2];
			const vertexY = vertices[vertexIndex * 2 + 1];
			boneLocalVertices.push(localA * vertexX + localC * vertexY + transform.x, localB * vertexX + localD * vertexY + transform.y);
		}
		meshAttachment.setVertices(boneLocalVertices);
		return meshAttachment;
	}

	const slotPose = readArray(displayJson, "slotPose");
	const bonePose = readArray(displayJson, "bonePose");
	if (slotPose.length < 6 || bonePose.length < 7) {
		throwReadError(where + " 의 무게는 slotPose 와 bonePose 가 있어야 한다.");
	}
	const boneCount = skeletonData.getBones().length;
	const poseBoneIndices = [];
	for (let poseIndex = 0; poseIndex + 6 < bonePose.length; poseIndex += 7) {
		poseBoneIndices.push(bonePose[poseIndex]);
	}
	const influenceCounts = [];
	const influenceBoneIndices = [];
	const influenceValues = [];
	let weightIndex = 0;
	for (let vertexIndex = 0; vertexIndex < vertexCount; ++vertexIndex) {
		const vertexX = vertices[vertexIndex * 2];
		const vertexY = vertices[vertexIndex * 2 + 1];
		const armatureX = slotPose[0] * vertexX + slotPose[2] * vertexY + slotPose[4];
		const armatureY = slotPose[1] * vertexX + slotPose[3] * vertexY + slotPose[5];
		const influenceCount = weights[weightIndex];
		weightIndex += 1;
		if (typeof influenceCount !== "number" || influenceCount <= 0 || weightIndex + influenceCount * 2 > weights.length) {
			throwReadError(where + " 의 꼭짓점 " + vertexIndex + " 무게를 읽지 못했다.");
		}
		influenceCounts.push(influenceCount);
		for (let countIndex = 0; countIndex < influenceCount; ++countIndex) {
			const boneIndex = weights[weightIndex];
			const weight = weights[weightIndex + 1];
			weightIndex += 2;
			const poseIndex = poseBoneIndices.indexOf(boneIndex);
			if (boneIndex < 0 || boneIndex >= boneCount || poseIndex < 0) {
				throwReadError(where + " 의 무게 뼈 " + boneIndex + " 가 bonePose 에 없다.");
			}
			const poseOffset = poseIndex * 7 + 1;
			const poseA = bonePose[poseOffset];
			const poseB = bonePose[poseOffset + 1];
			const poseC = bonePose[poseOffset + 2];
			const poseD = bonePose[poseOffset + 3];
			const determinant = poseA * poseD - poseB * poseC;
			if (determinant === 0) {
				throwReadError(where + " 의 bonePose 를 되돌릴 수 없다. (크기 0)");
			}
			const differenceX = armatureX - bonePose[poseOffset + 4];
			const differenceY = armatureY - bonePose[poseOffset + 5];
			const bindX = (poseD * differenceX - poseC * differenceY) / determinant;
			const bindY = (poseA * differenceY - poseB * differenceX) / determinant;
			influenceBoneIndices.push(boneIndex);
			influenceValues.push(bindX, bindY, weight);
		}
	}
	meshAttachment.setWeights(influenceCounts, influenceBoneIndices, influenceValues);
	return meshAttachment;
}


//==============================================================================
// 시간줄 키프레임 시각 목록. (프레임 수를 쌓아 초로, duration 기본 1)
//==============================================================================
/**
 * @param { any[] } frameJsonList
 * @param { number } frameRate
 * @returns { number[] }
 */
function readFrameTimes(frameJsonList, frameRate) {
	const frameTimes = [];
	let frameStart = 0;
	for (const frameJson of frameJsonList) {
		frameTimes.push(frameStart / frameRate);
		const duration = isPlainObject(frameJson) ? readNumber(frameJson, "duration", 1) : 1;
		frameStart += duration;
	}
	return frameTimes;
}


//==============================================================================
// 그리기 차례 오프셋 풀기. ([슬롯 번호, 옮김, ...] → 그리는 차례의 슬롯 번호 모두, 비었으면 null)
//==============================================================================
/**
 * @param { any[] } zOrderValues
 * @param { number } slotCount
 * @param { string } where
 * @returns { number[] | null }
 */
function readZOrder(zOrderValues, slotCount, where) {
	if (zOrderValues.length === 0) {
		return null;
	}
	const drawOrder = new System.Array(slotCount).fill(-1);
	const unchangedSlots = [];
	let originalIndex = 0;
	for (let pairIndex = 0; pairIndex + 1 < zOrderValues.length; pairIndex += 2) {
		const slotIndex = zOrderValues[pairIndex];
		const offset = zOrderValues[pairIndex + 1];
		if (slotIndex < originalIndex || slotIndex >= slotCount) {
			throwReadError(where + " 의 zOrder 슬롯 번호 " + slotIndex + " 가 차례가 아니거나 없다.");
		}
		while (originalIndex !== slotIndex) {
			unchangedSlots.push(originalIndex);
			originalIndex += 1;
		}
		const orderIndex = originalIndex + offset;
		if (orderIndex < 0 || orderIndex >= slotCount || drawOrder[orderIndex] !== -1) {
			throwReadError(where + " 의 zOrder 옮김이 자리를 벗어나거나 겹친다.");
		}
		drawOrder[orderIndex] = originalIndex;
		originalIndex += 1;
	}
	while (originalIndex < slotCount) {
		unchangedSlots.push(originalIndex);
		originalIndex += 1;
	}
	let unchangedIndex = unchangedSlots.length;
	for (let orderIndex = slotCount - 1; orderIndex >= 0; --orderIndex) {
		if (drawOrder[orderIndex] === -1) {
			unchangedIndex -= 1;
			drawOrder[orderIndex] = unchangedSlots[unchangedIndex];
		}
	}
	return drawOrder;
}


//==============================================================================
// 클립 하나 읽기.
//==============================================================================
/**
 * @param { Skeleton2DData } skeletonData
 * @param { object } animationJson
 * @param { number } frameRate
 * @param { (string | null)[][] } slotDisplayNames
 * @returns { Skeleton2DAnimation }
 */
function readAnimation(skeletonData, animationJson, frameRate, slotDisplayNames) {
	let animationName = readString(animationJson, "name", "default");
	if (animationName.length === 0) {
		animationName = "default";
	}
	const where = "클립 \"" + animationName + "\"";
	const duration = readNumber(animationJson, "duration", 0) / frameRate;
	const animation = new Skeleton2DAnimation(animationName, duration);

	// 뼈 시간줄.
	for (const boneTimelineJson of readArray(animationJson, "bone")) {
		if (!isPlainObject(boneTimelineJson)) {
			continue;
		}
		const boneName = readString(boneTimelineJson, "name", "");
		const boneIndex = skeletonData.findBoneIndex(boneName);
		if (boneIndex < 0) {
			continue;
		}
		const translateFrameList = readArray(boneTimelineJson, "translateFrame");
		if (translateFrameList.length > 0) {
			const timeline = new Skeleton2DTimeline(Skeleton2DTimelineType.translate, boneIndex);
			const frameTimes = readFrameTimes(translateFrameList, frameRate);
			for (let frameIndex = 0; frameIndex < translateFrameList.length; ++frameIndex) {
				const frameJson = isPlainObject(translateFrameList[frameIndex]) ? translateFrameList[frameIndex] : {};
				const curve = readFrameCurve(frameJson);
				const x = readNumber(frameJson, "x", 0);
				const y = readNumber(frameJson, "y", 0);
				timeline.addValueFrame(frameTimes[frameIndex], [x, y], curve.curveType, curve.curveValues);
			}
			animation.addTimeline(timeline);
		}
		const rotateFrameList = readArray(boneTimelineJson, "rotateFrame");
		if (rotateFrameList.length > 0) {
			const rotateTimeline = new Skeleton2DTimeline(Skeleton2DTimelineType.rotate, boneIndex);
			const shearTimeline = new Skeleton2DTimeline(Skeleton2DTimelineType.shear, boneIndex);
			const frameTimes = readFrameTimes(rotateFrameList, frameRate);
			let previousRotation = 0;
			let previousClockwise = 0;
			let hasSkew = false;
			for (let frameIndex = 0; frameIndex < rotateFrameList.length; ++frameIndex) {
				const frameJson = isPlainObject(rotateFrameList[frameIndex]) ? rotateFrameList[frameIndex] : {};
				const curve = readFrameCurve(frameJson);
				let rotation = readNumber(frameJson, "rotate", 0);

				// 앞 키에서 이어지는 값으로 편다. (clockwise 0 은 가까운 쪽, 양수는 시계 방향, 음수는 반시계 방향으로 그 바퀴 수)
				if (frameIndex > 0) {
					if (previousClockwise === 0) {
						let difference = (rotation - previousRotation) % 360;
						if (difference > 180) {
							difference -= 360;
						}
						else if (difference < -180) {
							difference += 360;
						}
						rotation = previousRotation + difference;
					}
					else {
						const isPassed = previousClockwise > 0 ? rotation >= previousRotation : rotation <= previousRotation;
						if (isPassed) {
							previousClockwise = previousClockwise > 0 ? previousClockwise - 1 : previousClockwise + 1;
						}
						rotation = rotation + 360 * previousClockwise;
					}
				}
				previousClockwise = readNumber(frameJson, "clockwise", 0);
				previousRotation = rotation;
				const skew = readNumber(frameJson, "skew", 0);
				if (skew !== 0) {
					hasSkew = true;
				}
				rotateTimeline.addValueFrame(frameTimes[frameIndex], [rotation], curve.curveType, curve.curveValues);
				shearTimeline.addValueFrame(frameTimes[frameIndex], [0, skew], curve.curveType, curve.curveValues);
			}
			animation.addTimeline(rotateTimeline);
			if (hasSkew) {
				animation.addTimeline(shearTimeline);
			}
		}
		const scaleFrameList = readArray(boneTimelineJson, "scaleFrame");
		if (scaleFrameList.length > 0) {
			const timeline = new Skeleton2DTimeline(Skeleton2DTimelineType.scale, boneIndex);
			const frameTimes = readFrameTimes(scaleFrameList, frameRate);
			for (let frameIndex = 0; frameIndex < scaleFrameList.length; ++frameIndex) {
				const frameJson = isPlainObject(scaleFrameList[frameIndex]) ? scaleFrameList[frameIndex] : {};
				const curve = readFrameCurve(frameJson);
				const x = readNumber(frameJson, "x", 1);
				const y = readNumber(frameJson, "y", 1);
				timeline.addValueFrame(frameTimes[frameIndex], [x, y], curve.curveType, curve.curveValues);
			}
			animation.addTimeline(timeline);
		}
	}

	// 슬롯 시간줄.
	for (const slotTimelineJson of readArray(animationJson, "slot")) {
		if (!isPlainObject(slotTimelineJson)) {
			continue;
		}
		const slotName = readString(slotTimelineJson, "name", "");
		const slotIndex = skeletonData.findSlotIndex(slotName);
		if (slotIndex < 0) {
			continue;
		}
		const displayFrameList = readArray(slotTimelineJson, "displayFrame");
		if (displayFrameList.length > 0) {
			const timeline = new Skeleton2DTimeline(Skeleton2DTimelineType.attachment, slotIndex);
			const frameTimes = readFrameTimes(displayFrameList, frameRate);
			const displayNames = slotDisplayNames[slotIndex];
			for (let frameIndex = 0; frameIndex < displayFrameList.length; ++frameIndex) {
				const frameJson = isPlainObject(displayFrameList[frameIndex]) ? displayFrameList[frameIndex] : {};
				const displayIndex = frameJson.value !== undefined ? readNumber(frameJson, "value", 0) : readNumber(frameJson, "displayIndex", 0);
				const attachmentName = displayIndex >= 0 && displayIndex < displayNames.length ? displayNames[displayIndex] : null;
				timeline.addAttachmentFrame(frameTimes[frameIndex], attachmentName);
			}
			animation.addTimeline(timeline);
		}
		const colorFrameList = readArray(slotTimelineJson, "colorFrame");
		if (colorFrameList.length > 0) {
			const timeline = new Skeleton2DTimeline(Skeleton2DTimelineType.color, slotIndex);
			const frameTimes = readFrameTimes(colorFrameList, frameRate);
			for (let frameIndex = 0; frameIndex < colorFrameList.length; ++frameIndex) {
				const frameJson = isPlainObject(colorFrameList[frameIndex]) ? colorFrameList[frameIndex] : {};
				const curve = readFrameCurve(frameJson);
				const colorJson = frameJson.value !== undefined ? frameJson.value : frameJson.color;
				const color = readColorTransform(colorJson);
				timeline.addValueFrame(frameTimes[frameIndex], [color.red, color.green, color.blue, color.alpha], curve.curveType, curve.curveValues);
			}
			animation.addTimeline(timeline);
		}
	}

	// 그리기 차례.
	const zOrderJson = animationJson.zOrder;
	if (isPlainObject(zOrderJson)) {
		const zOrderFrameList = readArray(zOrderJson, "frame");
		if (zOrderFrameList.length > 0) {
			const slotCount = skeletonData.getSlots().length;
			const timeline = new Skeleton2DTimeline(Skeleton2DTimelineType.drawOrder, -1);
			const frameTimes = readFrameTimes(zOrderFrameList, frameRate);
			for (let frameIndex = 0; frameIndex < zOrderFrameList.length; ++frameIndex) {
				const frameJson = isPlainObject(zOrderFrameList[frameIndex]) ? zOrderFrameList[frameIndex] : {};
				const zOrderValues = readArray(frameJson, "zOrder");
				const drawOrder = readZOrder(zOrderValues, slotCount, where);
				timeline.addDrawOrderFrame(frameTimes[frameIndex], drawOrder);
			}
			animation.addTimeline(timeline);
		}
	}

	// 사건. (frame 의 event 글, events 의 name, ints, floats, strings 첫 값)
	const eventFrameList = readArray(animationJson, "frame");
	if (eventFrameList.length > 0) {
		const timeline = new Skeleton2DTimeline(Skeleton2DTimelineType.event, -1);
		const frameTimes = readFrameTimes(eventFrameList, frameRate);
		for (let frameIndex = 0; frameIndex < eventFrameList.length; ++frameIndex) {
			const frameJson = isPlainObject(eventFrameList[frameIndex]) ? eventFrameList[frameIndex] : {};
			const time = frameTimes[frameIndex];
			if (typeof frameJson.event === "string") {
				timeline.addEventFrame(new Skeleton2DEvent(frameJson.event, time, 0, 0, ""));
			}
			for (const eventJson of readArray(frameJson, "events")) {
				if (!isPlainObject(eventJson)) {
					continue;
				}
				const name = readString(eventJson, "name", "");
				const ints = readArray(eventJson, "ints");
				const floats = readArray(eventJson, "floats");
				const strings = readArray(eventJson, "strings");
				const intValue = typeof ints[0] === "number" ? ints[0] : 0;
				const floatValue = typeof floats[0] === "number" ? floats[0] : 0;
				const stringValue = typeof strings[0] === "string" ? strings[0] : "";
				timeline.addEventFrame(new Skeleton2DEvent(name, time, intValue, floatValue, stringValue));
			}
		}
		if (timeline.getFrameCount() > 0) {
			animation.addTimeline(timeline);
		}
	}
	return animation;
}


//==============================================================================
// DragonBones 5.x JSON 읽기. (꼴이 틀리면 오류를 던진다)
//==============================================================================
/**
 * @param { object } json DragonBones JSON 을 읽은 객체.
 * @param { string | null } armatureName 읽을 뼈대 이름. (null 이면 첫 뼈대)
 * @returns { Skeleton2DData } 지은 자료.
 */
export function readDragonBonesJson(json, armatureName) {
	if (!isPlainObject(json)) {
		throwReadError("JSON 이 객체가 아니다.");
	}
	const armatureJsonList = readArray(json, "armature");
	let armatureJson = null;
	for (const candidateJson of armatureJsonList) {
		if (!isPlainObject(candidateJson)) {
			continue;
		}
		const candidateName = readString(candidateJson, "name", "");
		if (armatureName === null || armatureName === undefined || candidateName === armatureName) {
			armatureJson = candidateJson;
			break;
		}
	}
	if (armatureJson === null) {
		throwReadError("뼈대 \"" + armatureName + "\" 가 없다.");
	}
	const rootFrameRate = readNumber(json, "frameRate", 24);
	let frameRate = readNumber(armatureJson, "frameRate", rootFrameRate);
	if (frameRate <= 0) {
		frameRate = 24;
	}
	const name = readString(armatureJson, "name", "");
	const skeletonData = new Skeleton2DData(name);
	skeletonData.setFrameRate(frameRate);

	// 뼈.
	for (const boneJson of readArray(armatureJson, "bone")) {
		if (!isPlainObject(boneJson)) {
			throwReadError("뼈가 객체가 아니다.");
		}
		const boneName = readString(boneJson, "name", "");
		const parentName = readString(boneJson, "parent", "");
		let parentIndex = -1;
		if (parentName.length > 0) {
			parentIndex = skeletonData.findBoneIndex(parentName);
			if (parentIndex < 0) {
				throwReadError("뼈 \"" + boneName + "\" 의 부모 \"" + parentName + "\" 가 앞에 없다.");
			}
		}
		const bones = skeletonData.getBones();
		const boneData = new Skeleton2DBoneData(bones.length, boneName, parentIndex);
		const transform = readTransform(boneJson.transform);
		boneData.setTransform(transform.x, transform.y, transform.rotation, transform.scaleX, transform.scaleY, 0, transform.shearY);
		const length = readNumber(boneJson, "length", 0);
		boneData.setLength(length);
		skeletonData.addBone(boneData);
	}

	// 슬롯. (처음 붙임은 스킨을 읽은 뒤 displayIndex 로 정한다)
	const displayIndexList = [];
	for (const slotJson of readArray(armatureJson, "slot")) {
		if (!isPlainObject(slotJson)) {
			throwReadError("슬롯이 객체가 아니다.");
		}
		const slotName = readString(slotJson, "name", "");
		const boneName = readString(slotJson, "parent", "");
		const boneIndex = skeletonData.findBoneIndex(boneName);
		if (boneIndex < 0) {
			throwReadError("슬롯 \"" + slotName + "\" 의 뼈 \"" + boneName + "\" 가 없다.");
		}
		const slots = skeletonData.getSlots();
		const slotData = new Skeleton2DSlotData(slots.length, slotName, boneIndex);
		const color = readColorTransform(slotJson.color);
		slotData.setColor(color);
		const blendModeName = readString(slotJson, "blendMode", "normal");
		const blendMode = BLEND_MODE_TABLE[blendModeName] !== undefined ? BLEND_MODE_TABLE[blendModeName] : "source-over";
		slotData.setBlendMode(blendMode);
		skeletonData.addSlot(slotData);
		displayIndexList.push(readNumber(slotJson, "displayIndex", 0));
	}

	// 스킨. (슬롯마다 display 목록, 이름 없는 스킨은 "default")
	const slots = skeletonData.getSlots();
	const slotDisplayNames = [];
	for (let slotIndex = 0; slotIndex < slots.length; ++slotIndex) {
		slotDisplayNames.push([]);
	}
	for (const skinJson of readArray(armatureJson, "skin")) {
		if (!isPlainObject(skinJson)) {
			continue;
		}
		let skinName = readString(skinJson, "name", "default");
		if (skinName.length === 0) {
			skinName = "default";
		}
		const skin = new Skeleton2DSkin(skinName);
		for (const skinSlotJson of readArray(skinJson, "slot")) {
			if (!isPlainObject(skinSlotJson)) {
				continue;
			}
			const slotName = readString(skinSlotJson, "name", "");
			const slotIndex = skeletonData.findSlotIndex(slotName);
			if (slotIndex < 0) {
				continue;
			}
			const displayJsonList = readArray(skinSlotJson, "display");
			const displayNames = readDisplayNames(displayJsonList);
			if (skinName === "default" || slotDisplayNames[slotIndex].length === 0) {
				slotDisplayNames[slotIndex] = displayNames;
			}
			for (let displayIndex = 0; displayIndex < displayJsonList.length; ++displayIndex) {
				const attachmentName = displayNames[displayIndex];
				if (attachmentName === null) {
					continue;
				}
				const displayJson = displayJsonList[displayIndex];
				const displayType = readString(displayJson, "type", "image");
				const displayName = readString(displayJson, "name", "");
				const frameName = readString(displayJson, "path", displayName);
				if (displayType === "image") {
					const regionAttachment = new Skeleton2DRegionAttachment(attachmentName, frameName);
					const transform = readTransform(displayJson.transform);
					regionAttachment.setTransform(transform.x, transform.y, transform.rotation, transform.scaleX, transform.scaleY);
					if (isPlainObject(displayJson.pivot)) {
						const pivotX = readNumber(displayJson.pivot, "x", 0);
						const pivotY = readNumber(displayJson.pivot, "y", 0);
						regionAttachment.setPivot(pivotX, pivotY);
					}
					skin.setAttachment(slotIndex, attachmentName, regionAttachment);
				}
				else {
					const meshAttachment = readMeshDisplay(skeletonData, attachmentName, frameName, displayJson);
					skin.setAttachment(slotIndex, attachmentName, meshAttachment);
				}
			}
		}
		skeletonData.addSkin(skin);
	}
	for (let slotIndex = 0; slotIndex < slots.length; ++slotIndex) {
		const displayIndex = displayIndexList[slotIndex];
		const displayNames = slotDisplayNames[slotIndex];
		const attachmentName = displayIndex >= 0 && displayIndex < displayNames.length ? displayNames[displayIndex] : null;
		slots[slotIndex].setAttachmentName(attachmentName);
	}

	// IK. (chain 이 0 보다 크고 부모가 있으면 부모와 그 뼈 둘)
	for (const ikJson of readArray(armatureJson, "ik")) {
		if (!isPlainObject(ikJson)) {
			continue;
		}
		const ikName = readString(ikJson, "name", "");
		const boneName = readString(ikJson, "bone", "");
		const targetName = readString(ikJson, "target", "");
		const boneIndex = skeletonData.findBoneIndex(boneName);
		const targetIndex = skeletonData.findBoneIndex(targetName);
		if (boneIndex < 0 || targetIndex < 0) {
			throwReadError("IK \"" + ikName + "\" 의 뼈나 목표가 없다.");
		}
		const chain = readNumber(ikJson, "chain", 0);
		const bones = skeletonData.getBones();
		const parentIndex = bones[boneIndex].getParentIndex();
		const boneIndices = chain > 0 && parentIndex >= 0 ? [parentIndex, boneIndex] : [boneIndex];
		const ikConstraints = skeletonData.getIkConstraints();
		const ikConstraintData = new Skeleton2DIkConstraintData(ikConstraints.length, ikName, boneIndices, targetIndex);
		ikConstraintData.setBendPositive(ikJson.bendPositive !== false);
		ikConstraintData.setMix(readNumber(ikJson, "weight", 1));
		skeletonData.addIkConstraint(ikConstraintData);
	}

	// 클립.
	for (const animationJson of readArray(armatureJson, "animation")) {
		if (!isPlainObject(animationJson)) {
			continue;
		}
		const animation = readAnimation(skeletonData, animationJson, frameRate, slotDisplayNames);
		skeletonData.addAnimation(animation);
	}
	return skeletonData;
}
