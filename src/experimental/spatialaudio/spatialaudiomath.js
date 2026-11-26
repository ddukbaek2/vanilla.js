//==============================================================================
// 포함 모듈 목록.
//==============================================================================
// 옮긴 원문: 크로미엄 third_party/blink/renderer/modules/webaudio/panner_handler.cc, third_party/blink/renderer/platform/audio/distance_effect.cc, cone_effect.cc, equal_power_panner.cc, ui/gfx/geometry/vector3d_f.cc 에서 옮김, BSD-3-Clause, THIRD_PARTY_LICENSES.md
const System = globalThis;
import { Vector3 } from "../../base/vector3.js";


//==============================================================================
// PannerNode 셈. (크로미엄 panner_handler.cc, distance_effect.cc, cone_effect.cc, equal_power_panner.cc 와 ui/gfx 의 Vector3dF 를 옮긴 것, Chromium Authors BSD-3-Clause)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 소리는 브라우저 PannerNode 가 셈한다. 이 셈은 같은 값을 미리 알고 싶을 때(멀어 들리지 않는 소리 거르기, 시험) 쓴다.
//   러스트 판(vanilla-engine)의 데스크탑 믹서가 같은 셈으로 소리를 낸다.
// - 정밀도는 크로미엄 그대로다. 벡터는 float 칸(Math.fround)이고, 길이 제곱과 외적은 double 로 셈해 float 로, 내적과 사이 각은 float 로, 거리와 원뿔 이득은 double 로 셈한다.
// - 좌표는 WebAudio 와 같은 오른손 좌표다. 리스너 기본은 자리 (0, 0, 0), 앞 (0, 0, -1), 위 (0, 1, 0)이다.
//==============================================================================
// 길이가 이보다 작은 벡터는 0 으로 친다. (gfx kEpsilon)
const VECTOR_EPSILON = 1.0e-6;
// 라디안을 도로. (base::RadToDeg 의 float 판, 180 / pi_v<float>)
const RADIAN_TO_DEGREE_F32 = System.Math.fround(180 / System.Math.fround(System.Math.PI));


//==============================================================================
// 좌우 나누는 방식. (WebAudio PanningModelType 의 글과 같다)
//==============================================================================
export const PanningModel = System.Object.freeze({
	EqualPower: "equalpower", // 등력 좌우. (기본, 방위각만 쓴다)
	Hrtf: "HRTF", // 머리 전달 함수. (브라우저가 IRCAM 자료로 셈한다, 러스트 데스크탑은 아직 등력)
});


//==============================================================================
// 거리에 따른 줄임 방식. (WebAudio DistanceModelType 의 글과 같다)
//==============================================================================
export const DistanceModel = System.Object.freeze({
	Linear: "linear", // 선형. (1 - rolloff x (거리 - 기준) / (최대 - 기준))
	Inverse: "inverse", // 역수. (기준 / (기준 + rolloff x (거리 - 기준)), 기본)
	Exponential: "exponential", // 지수. ((거리 / 기준) ^ -rolloff)
});


//==============================================================================
// PannerNode 의 거리와 원뿔, 좌우 방식 설정. (WebAudio PannerNode 의 속성들, 기본값도 같다)
//==============================================================================
/**
 * @example <caption>선형 거리 설정 만들기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const settings = new Experimental.PannerSettings();
 * settings.distanceModel = Experimental.DistanceModel.Linear;
 * settings.maximumDistance = 20;
 * console.log(settings.referenceDistance, settings.isValid());
 */
export class PannerSettings {
	/** @type { string } */ panningModel; // 좌우 나누는 방식. (PanningModel, 기본 등력)
	/** @type { string } */ distanceModel; // 거리 줄임 방식. (DistanceModel, 기본 역수)
	/** @type { number } */ referenceDistance; // 기준 거리. (refDistance, 0 이상, 기본 1)
	/** @type { number } */ maximumDistance; // 최대 거리. (maxDistance, 0 보다 큼, 기본 10000)
	/** @type { number } */ rolloffFactor; // 줄어드는 빠르기. (rolloffFactor, 0 이상, 기본 1)
	/** @type { number } */ coneInnerAngle; // 원뿔 안쪽 각. (도, 줄지 않는 각 전체, 기본 360)
	/** @type { number } */ coneOuterAngle; // 원뿔 바깥쪽 각. (도, 기본 360)
	/** @type { number } */ coneOuterGain; // 원뿔 바깥의 이득. (0 ~ 1, 기본 0)

	//==============================================================================
	// 생성. (WebAudio 기본값: 등력, 역수, 1, 10000, 1, 360, 360, 0)
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		this.panningModel = PanningModel.EqualPower;
		this.distanceModel = DistanceModel.Inverse;
		this.referenceDistance = 1;
		this.maximumDistance = 10000;
		this.rolloffFactor = 1;
		this.coneInnerAngle = 360;
		this.coneOuterAngle = 360;
		this.coneOuterGain = 0;
	}

	//==============================================================================
	// 복제.
	//==============================================================================
	/**
	 * @returns { PannerSettings } 같은 값의 새 설정.
	 */
	clone() {
		const settings = new PannerSettings();
		System.Object.assign(settings, this);
		return settings;
	}

	//==============================================================================
	// WebAudio 가 받는 값인지. (기준 거리 0 이상, 최대 거리 0 보다 큼, rolloff 0 이상, 원뿔 바깥 이득 0 ~ 1, 모두 유한, 방식 글이 맞음)
	// - WebAudio 는 이 밖의 값에 RangeError 를 던진다. 엔진은 그 값을 받지 않고 앞 값을 둔다.
	//==============================================================================
	/**
	 * @returns { boolean } 받는 값이면 참.
	 */
	isValid() {
		const numberList = [this.referenceDistance, this.maximumDistance, this.rolloffFactor, this.coneInnerAngle, this.coneOuterAngle, this.coneOuterGain];
		const isFinite = numberList.every((value) => typeof value === "number" && System.Number.isFinite(value));
		const isPanningModel = this.panningModel === PanningModel.EqualPower || this.panningModel === PanningModel.Hrtf;
		const isDistanceModel = this.distanceModel === DistanceModel.Linear || this.distanceModel === DistanceModel.Inverse || this.distanceModel === DistanceModel.Exponential;
		return isFinite && isPanningModel && isDistanceModel && this.referenceDistance >= 0 && this.maximumDistance > 0 && this.rolloffFactor >= 0 && this.coneOuterGain >= 0 && this.coneOuterGain <= 1;
	}
}


//==============================================================================
// float 벡터 셈. (gfx Vector3dF, 칸은 [x, y, z] 배열)
//==============================================================================
const fround = System.Math.fround;

//==============================================================================
// Vector3 를 float 칸 셋으로.
//==============================================================================
function toFloatVector(vector) {
	return [fround(vector.x), fround(vector.y), fround(vector.z)];
}

//==============================================================================
// 빼기. (float)
//==============================================================================
function subtract(left, right) {
	return [fround(left[0] - right[0]), fround(left[1] - right[1]), fround(left[2] - right[2])];
}

//==============================================================================
// 길이 제곱. (double)
//==============================================================================
function lengthSquared(vector) {
	return vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2];
}

//==============================================================================
// 길이. (double 로 셈해 float 로)
//==============================================================================
function length(vector) {
	return fround(System.Math.sqrt(lengthSquared(vector)));
}

//==============================================================================
// 단위 벡터. (gfx Vector3dF::GetNormalized, 길이가 너무 작으면 그대로 두고 isNormalized 거짓)
//==============================================================================
function getNormalized(vector) {
	const squared = lengthSquared(vector);
	if (squared < VECTOR_EPSILON * VECTOR_EPSILON) {
		return { vector, isNormalized: false };
	}
	const inverseScale = fround(System.Math.sqrt(squared));
	return { vector: [fround(vector[0] / inverseScale), fround(vector[1] / inverseScale), fround(vector[2] / inverseScale)], isNormalized: true };
}

//==============================================================================
// 외적. (gfx Vector3dF::Cross, double 로 셈해 float 로)
//==============================================================================
function cross(left, right) {
	return [fround(left[1] * right[2] - left[2] * right[1]), fround(left[2] * right[0] - left[0] * right[2]), fround(left[0] * right[1] - left[1] * right[0])];
}

//==============================================================================
// 내적. (float, 곱셈과 덧셈마다 float 로)
//==============================================================================
function dot(left, right) {
	return fround(fround(fround(left[0] * right[0]) + fround(left[1] * right[1])) + fround(left[2] * right[2]));
}

//==============================================================================
// 배율 곱하기. (float)
//==============================================================================
function scale(vector, scaleValue) {
	return [fround(vector[0] * scaleValue), fround(vector[1] * scaleValue), fround(vector[2] * scaleValue)];
}

//==============================================================================
// 두 벡터 사이 각. (도, gfx AngleBetweenVectorsInDegrees, float 로 셈한다)
//==============================================================================
function angleBetweenVectorsInDegrees(base, other) {
	const cosine = fround(fround(dot(base, other) / length(base)) / length(other));
	const clampedCosine = System.Math.max(System.Math.min(cosine, 1), -1);
	return fround(fround(System.Math.acos(clampedCosine)) * RADIAN_TO_DEGREE_F32);
}

//==============================================================================
// 값 자르기. (wtf ClampTo: 최대 이상이면 최대, 최소 이하면 최소, NaN 은 그대로)
//==============================================================================
function clampTo(value, minimum, maximum) {
	if (value >= maximum) {
		return maximum;
	}
	return value <= minimum ? minimum : value;
}

//==============================================================================
// 유한하지 않으면 0.
//==============================================================================
function ensureFinite(value) {
	return System.Number.isFinite(value) ? value : 0;
}


//==============================================================================
// 거리 이득. (크로미엄 DistanceEffect::Gain, WebAudio 의 linear, inverse, exponential 식)
//==============================================================================
/**
 * @param { string } distanceModel 거리 모델. (DistanceModel)
 * @param { number } distance 소리와 리스너 사이 거리.
 * @param { number } referenceDistance 기준 거리.
 * @param { number } maximumDistance 최대 거리.
 * @param { number } rolloffFactor 줄어드는 빠르기.
 * @returns { number } 거리 이득. (0 ~ 1)
 * @example <caption>거리 모델 셋의 이득</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const { calculateDistanceGain, DistanceModel } = Experimental;
 * console.log(calculateDistanceGain(DistanceModel.Inverse, 4, 1, 10000, 1));
 * console.log(calculateDistanceGain(DistanceModel.Linear, 6, 2, 10, 1));
 * console.log(calculateDistanceGain(DistanceModel.Exponential, 0.5, 1, 10000, 2));
 */
export function calculateDistanceGain(distanceModel, distance, referenceDistance, maximumDistance, rolloffFactor) {
	if (distanceModel === DistanceModel.Linear) {
		const minimumDistance = System.Math.min(referenceDistance, maximumDistance);
		const largestDistance = System.Math.max(referenceDistance, maximumDistance);
		const clampedDistance = clampTo(distance, minimumDistance, largestDistance);
		if (minimumDistance === largestDistance) {
			return 1 - rolloffFactor;
		}
		return 1 - clampTo(rolloffFactor, 0, 1) * (clampedDistance - minimumDistance) / (largestDistance - minimumDistance);
	}
	if (referenceDistance === 0) {
		return 0;
	}
	const clampedDistance = clampTo(distance, referenceDistance, System.Number.MAX_VALUE);
	const clampedRolloff = clampTo(rolloffFactor, 0, System.Number.MAX_VALUE);
	if (distanceModel === DistanceModel.Exponential) {
		return System.Math.pow(clampedDistance / referenceDistance, -clampedRolloff);
	}
	return referenceDistance / (referenceDistance + clampedRolloff * (clampedDistance - referenceDistance));
}


//==============================================================================
// 원뿔 이득. (크로미엄 ConeEffect::Gain, OpenAL 명세의 원뿔)
// - 소리의 방향이 0 이거나 안쪽, 바깥쪽 각이 모두 360 이면 1. 소리 → 리스너 벡터와 방향 사이 각이 안쪽 각의 반 이하면 1,
//   바깥쪽 각의 반 이상이면 바깥 이득, 그 사이는 선형으로 섞는다.
//==============================================================================
/**
 * @param { Vector3 } sourcePosition 소리 자리.
 * @param { Vector3 } sourceOrientation 소리가 보는 방향.
 * @param { Vector3 } listenerPosition 리스너 자리.
 * @param { number } coneInnerAngle 안쪽 각. (도, 각 전체)
 * @param { number } coneOuterAngle 바깥쪽 각. (도, 각 전체)
 * @param { number } coneOuterGain 바깥 이득. (0 ~ 1)
 * @returns { number } 원뿔 이득.
 * @example <caption>소리 뒤에 선 리스너의 원뿔 이득</caption>
 * import { Vector3 } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const gain = Experimental.calculateConeGain(Vector3.create(0, 0, 0), Vector3.create(1, 0, 0), Vector3.create(-5, 0, 0), 60, 180, 0.25);
 * console.log(gain);
 */
export function calculateConeGain(sourcePosition, sourceOrientation, listenerPosition, coneInnerAngle, coneOuterAngle, coneOuterGain) {
	return calculateConeGainFloat(toFloatVector(sourcePosition), toFloatVector(sourceOrientation), toFloatVector(listenerPosition), coneInnerAngle, coneOuterAngle, coneOuterGain);
}

//==============================================================================
// 원뿔 이득. (float 칸 셋을 받는 안쪽 판)
//==============================================================================
function calculateConeGainFloat(sourcePosition, sourceOrientation, listenerPosition, coneInnerAngle, coneOuterAngle, coneOuterGain) {
	const isZero = sourceOrientation[0] === 0 && sourceOrientation[1] === 0 && sourceOrientation[2] === 0;
	if (isZero || (coneInnerAngle === 360 && coneOuterAngle === 360)) {
		return 1;
	}
	const sourceToListener = subtract(listenerPosition, sourcePosition);
	const absoluteAngle = System.Math.abs(angleBetweenVectorsInDegrees(sourceToListener, sourceOrientation));
	const absoluteInnerAngle = System.Math.abs(coneInnerAngle) / 2;
	const absoluteOuterAngle = System.Math.abs(coneOuterAngle) / 2;
	if (absoluteAngle <= absoluteInnerAngle) {
		return 1;
	}
	if (absoluteAngle >= absoluteOuterAngle) {
		return coneOuterGain;
	}
	const ratio = (absoluteAngle - absoluteInnerAngle) / (absoluteOuterAngle - absoluteInnerAngle);
	return (1 - ratio) + coneOuterGain * ratio;
}


//==============================================================================
// 방위각과 높이. (도, 크로미엄 PannerHandler::CalculateAzimuthElevation)
// - 방위각은 리스너 앞이 0, 오른쪽이 90, 왼쪽이 -90, 뒤는 180 쪽이다. 소리와 리스너가 같은 자리면 둘 다 0.
//==============================================================================
/**
 * @param { Vector3 } sourcePosition 소리 자리.
 * @param { Vector3 } listenerPosition 리스너 자리.
 * @param { Vector3 } listenerForward 리스너 앞.
 * @param { Vector3 } listenerUp 리스너 위.
 * @returns { { azimuth: number, elevation: number } } 방위각과 높이. (도)
 * @example <caption>오른쪽 소리의 방위각</caption>
 * import { Vector3 } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const { azimuth, elevation } = Experimental.calculateAzimuthElevation(Vector3.create(3, 0, 0), Vector3.create(0, 0, 0), Vector3.create(0, 0, -1), Vector3.create(0, 1, 0));
 * console.log(azimuth, elevation);
 */
export function calculateAzimuthElevation(sourcePosition, listenerPosition, listenerForward, listenerUp) {
	return calculateAzimuthElevationFloat(toFloatVector(sourcePosition), toFloatVector(listenerPosition), toFloatVector(listenerForward), toFloatVector(listenerUp));
}

//==============================================================================
// 방위각과 높이. (float 칸 셋을 받는 안쪽 판)
//==============================================================================
function calculateAzimuthElevationFloat(sourcePosition, listenerPosition, listenerForward, listenerUp) {
	const sourceListenerResult = getNormalized(subtract(sourcePosition, listenerPosition));
	if (!sourceListenerResult.isNormalized) {
		return { azimuth: 0, elevation: 0 };
	}
	const sourceListener = sourceListenerResult.vector;
	const listenerRight = getNormalized(cross(listenerForward, listenerUp)).vector;
	const listenerForwardNormalized = getNormalized(listenerForward).vector;
	const up = cross(listenerRight, listenerForwardNormalized);
	const upProjection = dot(sourceListener, up);
	const projectedSource = getNormalized(subtract(sourceListener, scale(up, upProjection))).vector;
	const clampedDot = System.Math.max(-1, System.Math.min(1, dot(projectedSource, listenerRight)));
	let azimuth = ensureFinite(fround(fround(System.Math.acos(clampedDot)) * RADIAN_TO_DEGREE_F32));
	const frontBack = dot(projectedSource, listenerForwardNormalized);
	if (frontBack < 0) {
		azimuth = 360 - azimuth;
	}
	if (azimuth >= 0 && azimuth <= 270) {
		azimuth = 90 - azimuth;
	}
	else {
		azimuth = 450 - azimuth;
	}
	let elevation = ensureFinite(fround(90 - angleBetweenVectorsInDegrees(sourceListener, up)));
	if (elevation > 90) {
		elevation = 180 - elevation;
	}
	else if (elevation < -90) {
		elevation = -180 - elevation;
	}
	return { azimuth, elevation };
}


//==============================================================================
// 거리 이득 x 원뿔 이득. (크로미엄 PannerHandler::CalculateDistanceConeGain, float 로)
//==============================================================================
/**
 * @param { PannerSettings } settings 설정.
 * @param { Vector3 } sourcePosition 소리 자리.
 * @param { Vector3 } sourceOrientation 소리가 보는 방향.
 * @param { Vector3 } listenerPosition 리스너 자리.
 * @returns { number } 거리 x 원뿔 이득.
 * @example <caption>기본 설정에서 2 만큼 떨어진 소리</caption>
 * import { Vector3 } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const gain = Experimental.calculateDistanceConeGain(new Experimental.PannerSettings(), Vector3.create(0, 0, -2), Vector3.create(1, 0, 0), Vector3.create(0, 0, 0));
 * console.log(gain);
 */
export function calculateDistanceConeGain(settings, sourcePosition, sourceOrientation, listenerPosition) {
	const source = toFloatVector(sourcePosition);
	const listener = toFloatVector(listenerPosition);
	const listenerDistance = length(subtract(source, listener));
	const distanceGain = calculateDistanceGain(settings.distanceModel, listenerDistance, settings.referenceDistance, settings.maximumDistance, settings.rolloffFactor);
	const coneGain = calculateConeGainFloat(source, toFloatVector(sourceOrientation), listener, settings.coneInnerAngle, settings.coneOuterAngle, settings.coneOuterGain);
	return fround(distanceGain * coneGain);
}


//==============================================================================
// 등력 좌우 이득. (크로미엄 EqualPowerPanner::UpdateDesiredGain)
// - 방위각을 -180 ~ 180 으로 자르고 뒤쪽을 앞쪽으로 접은 뒤, 모노는 x = (방위각 + 90) / 180, 스테레오는 방위각이 0 이하면 (방위각 + 90) / 90, 아니면 방위각 / 90 으로
//   왼쪽 cos(x π/2), 오른쪽 sin(x π/2).
// - 스테레오 입력은 접은 방위각이 0 이하면 왼쪽 = 왼쪽 + 오른쪽 x 왼쪽 이득, 오른쪽 = 오른쪽 x 오른쪽 이득이고, 아니면 거꾸로 섞는다.
//==============================================================================
/**
 * @param { number } azimuth 방위각. (도)
 * @param { number } inputChannelCount 입력 채널 수. (1 이나 2)
 * @returns { { left: number, right: number } } 왼쪽과 오른쪽 이득.
 * @example <caption>가운데와 오른쪽 끝의 이득</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const center = Experimental.calculateEqualPowerGains(0, 1);
 * const right = Experimental.calculateEqualPowerGains(90, 1);
 * console.log(center.left, center.right, right.left, right.right);
 */
export function calculateEqualPowerGains(azimuth, inputChannelCount) {
	let aliasedAzimuth = clampTo(azimuth, -180, 180);
	if (aliasedAzimuth < -90) {
		aliasedAzimuth = -180 - aliasedAzimuth;
	}
	else if (aliasedAzimuth > 90) {
		aliasedAzimuth = 180 - aliasedAzimuth;
	}
	let desiredPanPosition;
	if (inputChannelCount === 1) {
		desiredPanPosition = (aliasedAzimuth + 90) / 180;
	}
	else if (aliasedAzimuth <= 0) {
		desiredPanPosition = (aliasedAzimuth + 90) / 90;
	}
	else {
		desiredPanPosition = aliasedAzimuth / 90;
	}
	const radian = (System.Math.PI / 2) * desiredPanPosition;
	return { left: System.Math.cos(radian), right: System.Math.sin(radian) };
}


//==============================================================================
// 화면 자리를 WebAudio 자리로. ((x / pixelsPerUnit, -y / pixelsPerUnit, depth), 화면은 아래가 +Y, WebAudio 는 위가 +Y)
//==============================================================================
/**
 * @param { Vector2 } viewPosition 화면(뷰) 좌표의 자리. (픽셀)
 * @param { number } pixelsPerUnit WebAudio 한 단위가 몇 픽셀인지. (0 보다 큼)
 * @param { number } depth Z 값.
 * @returns { Vector3 } WebAudio 좌표의 자리.
 * @example <caption>화면 자리 바꾸기</caption>
 * import { Vector2 } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const position = Experimental.convertViewPositionToAudioPosition(Vector2.create(200, 100), 100, 0);
 * console.log(position.x, position.y, position.z);
 */
export function convertViewPositionToAudioPosition(viewPosition, pixelsPerUnit, depth) {
	return Vector3.create(fround(viewPosition.x / pixelsPerUnit), fround(-viewPosition.y / pixelsPerUnit), fround(depth));
}
