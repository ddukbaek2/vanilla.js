//==============================================================================
// 2D 뼈대 애니메이션의 곡선, 시간줄, 자세, 클립.
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 곡선은 키마다 다음 키까지의 보간이다. 선형, 계단, 3 차 베지어(CSS cubic-bezier 와 같은 [x1, y1, x2, y2], 끝점 (0, 0), (1, 1)) 셋이다.
// - 뼈 시간줄의 값은 처음 자세에 대한 몫이다. 회전, 이동, 기울임은 더하고 크기는 곱한다. (Spine, DragonBones 와 같은 꼴)
// - 슬롯 색은 그 값 그대로, 붙임과 그리기 차례는 계단, 사건은 그 시각에 한 번이다.
// - 자세(Skeleton2DPose)는 뼈 지역 값과 슬롯 상태만 든 배열이다. 클립은 자세에 값을 쓰고, 섞기는 자세끼리 섞는다.
//==============================================================================

/**
 * @example <caption>베지어 곡선과 회전 시간줄 하나를 자세에 걸기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const easedValue = Experimental.evaluateSkeleton2DCurve(Experimental.Skeleton2DCurveType.bezier, [0.42, 0, 0.58, 1], 0.5);
 * const skeletonData = Experimental.Skeleton2DData.createFromJson({
 * 	bones: [{ name: "root" }, { name: "arm", parent: "root", length: 40 }],
 * 	animations: {
 * 		swing: { bones: { arm: { rotate: [{ time: 0, value: 0 }, { time: 1, value: 90 }] } } },
 * 	},
 * });
 * const animation = skeletonData.findAnimation("swing");
 * const pose = new Experimental.Skeleton2DPose(2, 0);
 * pose.setToSetupPose(skeletonData);
 * animation.apply(pose, skeletonData, 0.5);
 * const boneValues = pose.getBoneValues();
 * console.log(easedValue, boneValues[Experimental.SKELETON2D_BONE_VALUE_COUNT + 2]);
 */


//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 자세에서 뼈 하나가 차지하는 값 수. (x, y, 회전, 크기 x, 크기 y, 기울임 x, 기울임 y)
export const SKELETON2D_BONE_VALUE_COUNT = 7;

//==============================================================================
// 인스턴스를 지은 자료 표. (자료는 인스턴스들이 나눠 쓰는 처음 자세라, 지은 뒤에는 고치지 않는다, 러스트 판은 Rc 로 나눠 들어 &mut 가 막힌다)
//==============================================================================
/** @private @type { WeakSet<object> } */
const frozenSkeleton2DSet = new System.WeakSet();


//==============================================================================
// 자료 하나를 얼린다. (뒤로 세터와 더하기가 던진다)
//==============================================================================
/**
 * @private
 * @param { object } target 얼릴 자료.
 */
export function freezeSkeleton2DObject(target) {
	frozenSkeleton2DSet.add(target);
}


//==============================================================================
// 자료를 고쳐도 되는지 본다. (얼었으면 던진다)
//==============================================================================
/**
 * @private
 * @param { object } target 고칠 자료.
 */
export function checkSkeleton2DWritable(target) {
	if (frozenSkeleton2DSet.has(target)) {
		throw new System.Error("[Skeleton2D] 인스턴스를 지은 자료는 고칠 수 없다. (자료는 인스턴스들이 나눠 쓰는 처음 자세다)");
	}
}

// 베지어 곡선에서 시간 x 로 매개변수 t 를 찾는 반 가르기 횟수. (2^-20 이면 t 의 오차가 백만분의 일쯤)
const BEZIER_BISECTION_COUNT = 20;


//==============================================================================
// 곡선 종류.
//==============================================================================
export const Skeleton2DCurveType = {
	linear: "linear", // 곧게.
	stepped: "stepped", // 다음 키까지 그 값.
	bezier: "bezier", // 3 차 베지어. ([x1, y1, x2, y2])
};


//==============================================================================
// 시간줄 종류.
//==============================================================================
export const Skeleton2DTimelineType = {
	rotate: "rotate", // 뼈 회전. (값 하나, 도)
	translate: "translate", // 뼈 이동. (값 둘)
	scale: "scale", // 뼈 크기. (값 둘, 곱한다)
	shear: "shear", // 뼈 기울임. (값 둘, 도)
	color: "color", // 슬롯 색. (값 넷, 0 ~ 1)
	attachment: "attachment", // 슬롯 붙임. (계단)
	drawOrder: "drawOrder", // 그리기 차례. (계단)
	event: "event", // 사건.
};


//==============================================================================
// 3 차 베지어 한 축의 값. (끝점 0 과 1, 제어점 firstControl, secondControl)
//==============================================================================
/**
 * @param { number } firstControl
 * @param { number } secondControl
 * @param { number } parameter
 * @returns { number }
 */
function evaluateBezierComponent(firstControl, secondControl, parameter) {
	const inverse = 1 - parameter;
	return 3 * inverse * inverse * parameter * firstControl + 3 * inverse * parameter * parameter * secondControl + parameter * parameter * parameter;
}


//==============================================================================
// 곡선 값 셈. (키 사이의 진행 몫 0 ~ 1 을 곡선에 따라 바꾼 몫)
// - 선형은 그대로, 계단은 다음 키에 닿기 전까지 0 이다.
// - 베지어는 시간 축 x(t) 가 percent 인 t 를 반 가르기로 찾아 y(t) 를 돌려준다. (x 제어점이 0 ~ 1 이어야 t 가 하나다)
//==============================================================================
/**
 * @param { string } curveType 곡선 종류. (Skeleton2DCurveType)
 * @param { number[] | null } curveValues 베지어 제어점 [x1, y1, x2, y2]. (베지어가 아니면 쓰지 않는다)
 * @param { number } percent 키 사이의 진행 몫. (0 ~ 1)
 * @returns { number } 곡선을 지난 몫. (베지어는 0 ~ 1 밖으로 넘을 수 있다)
 * @example <caption>세 곡선의 가운데 값</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const linearValue = Experimental.evaluateSkeleton2DCurve(Experimental.Skeleton2DCurveType.linear, null, 0.25);
 * const steppedValue = Experimental.evaluateSkeleton2DCurve(Experimental.Skeleton2DCurveType.stepped, null, 0.75);
 * const bezierValue = Experimental.evaluateSkeleton2DCurve(Experimental.Skeleton2DCurveType.bezier, [0.25, 0.1, 0.25, 1], 0.5);
 * console.log(linearValue, steppedValue, bezierValue);
 */
export function evaluateSkeleton2DCurve(curveType, curveValues, percent) {
	if (curveType === Skeleton2DCurveType.stepped) {
		return percent >= 1 ? 1 : 0;
	}
	if (curveType !== Skeleton2DCurveType.bezier || curveValues === null || curveValues === undefined) {
		return percent;
	}

	const firstControlX = curveValues[0];
	const firstControlY = curveValues[1];
	const secondControlX = curveValues[2];
	const secondControlY = curveValues[3];
	let lowParameter = 0;
	let highParameter = 1;
	for (let iteration = 0; iteration < BEZIER_BISECTION_COUNT; ++iteration) {
		const middleParameter = (lowParameter + highParameter) * 0.5;
		const middleX = evaluateBezierComponent(firstControlX, secondControlX, middleParameter);
		if (middleX < percent) {
			lowParameter = middleParameter;
		}
		else {
			highParameter = middleParameter;
		}
	}
	const parameter = (lowParameter + highParameter) * 0.5;
	return evaluateBezierComponent(firstControlY, secondControlY, parameter);
}


//==============================================================================
// 각도 차를 -180 ~ 180 도로 접기.
//==============================================================================
/**
 * @param { number } degree
 * @returns { number }
 */
function wrapDegree(degree) {
	let wrappedDegree = degree % 360;
	if (wrappedDegree > 180) {
		wrappedDegree -= 360;
	}
	else if (wrappedDegree < -180) {
		wrappedDegree += 360;
	}
	return wrappedDegree;
}


//==============================================================================
// 2D 뼈대 사건. (클립의 그 시각에 한 번 알린다, 발소리나 타격 판정 자리)
//==============================================================================
/**
 * @example <caption>사건 하나 만들기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const event = new Experimental.Skeleton2DEvent("step", 0.25, 1, 0.5, "left");
 * console.log(event.getName(), event.getTime(), event.getIntValue(), event.getFloatValue(), event.getStringValue());
 */
export class Skeleton2DEvent extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #name;
	/** @private @type { number } */ #time;
	/** @private @type { number } */ #intValue;
	/** @private @type { number } */ #floatValue;
	/** @private @type { string } */ #stringValue;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { string } name 사건 이름.
	 * @param { number } time 클립 안의 시각. (초)
	 * @param { number } intValue 정수 값. (기본 0)
	 * @param { number } floatValue 실수 값. (기본 0)
	 * @param { string } stringValue 글 값. (기본 빈 글)
	 */
	constructor(name, time, intValue = 0, floatValue = 0, stringValue = "") {
		super();
		this.#name = name;
		this.#time = time;
		this.#intValue = intValue;
		this.#floatValue = floatValue;
		this.#stringValue = stringValue;
	}

	//==============================================================================
	// 이름 반환.
	//==============================================================================
	/**
	 * @returns { string } 사건 이름.
	 */
	getName() {
		return this.#name;
	}

	//==============================================================================
	// 시각 반환.
	//==============================================================================
	/**
	 * @returns { number } 클립 안의 시각. (초)
	 */
	getTime() {
		return this.#time;
	}

	//==============================================================================
	// 정수 값 반환.
	//==============================================================================
	/**
	 * @returns { number } 정수 값.
	 */
	getIntValue() {
		return this.#intValue;
	}

	//==============================================================================
	// 실수 값 반환.
	//==============================================================================
	/**
	 * @returns { number } 실수 값.
	 */
	getFloatValue() {
		return this.#floatValue;
	}

	//==============================================================================
	// 글 값 반환.
	//==============================================================================
	/**
	 * @returns { string } 글 값.
	 */
	getStringValue() {
		return this.#stringValue;
	}
}


//==============================================================================
// 2D 뼈대 자세. (뼈 지역 값, 슬롯 색, 슬롯 붙임 이름, 그리기 차례)
// - 뼈 값은 뼈마다 SKELETON2D_BONE_VALUE_COUNT 개: x, y, 회전(도), 크기 x, 크기 y, 기울임 x(도), 기울임 y(도).
// - 슬롯 색은 슬롯마다 빨강, 초록, 파랑, 투명도 넷이다. (0 ~ 1)
// - 그리기 차례는 그리는 차례의 슬롯 번호 목록이다.
//==============================================================================
/**
 * @example <caption>두 자세를 반씩 섞기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const fromPose = new Experimental.Skeleton2DPose(1, 0);
 * const toPose = new Experimental.Skeleton2DPose(1, 0);
 * fromPose.getBoneValues()[2] = 170;
 * toPose.getBoneValues()[2] = -170;
 * fromPose.blend(toPose, 0.5);
 * console.log(fromPose.getBoneValues()[2]);
 */
export class Skeleton2DPose extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Float64Array } */ #boneValues;
	/** @private @type { Float64Array } */ #slotColors;
	/** @private @type { (string | null)[] } */ #slotAttachmentNames;
	/** @private @type { number[] } */ #drawOrder;

	//==============================================================================
	// 생성. (뼈 값은 크기 1, 나머지 0, 슬롯 색은 흰색, 붙임은 없음, 그리기 차례는 슬롯 차례)
	//==============================================================================
	/**
	 * @param { number } boneCount 뼈 수.
	 * @param { number } slotCount 슬롯 수.
	 */
	constructor(boneCount, slotCount) {
		super();
		this.#boneValues = new System.Float64Array(boneCount * SKELETON2D_BONE_VALUE_COUNT);
		for (let boneIndex = 0; boneIndex < boneCount; ++boneIndex) {
			this.#boneValues[boneIndex * SKELETON2D_BONE_VALUE_COUNT + 3] = 1;
			this.#boneValues[boneIndex * SKELETON2D_BONE_VALUE_COUNT + 4] = 1;
		}
		this.#slotColors = new System.Float64Array(slotCount * 4);
		this.#slotColors.fill(1);
		this.#slotAttachmentNames = new System.Array(slotCount).fill(null);
		this.#drawOrder = [];
		for (let slotIndex = 0; slotIndex < slotCount; ++slotIndex) {
			this.#drawOrder.push(slotIndex);
		}
	}

	//==============================================================================
	// 뼈 값 배열 반환. (뼈마다 SKELETON2D_BONE_VALUE_COUNT 개, 고치면 자세가 바뀐다)
	//==============================================================================
	/**
	 * @returns { Float64Array } 뼈 값 배열.
	 */
	getBoneValues() {
		return this.#boneValues;
	}

	//==============================================================================
	// 슬롯 색 배열 반환. (슬롯마다 빨강, 초록, 파랑, 투명도)
	//==============================================================================
	/**
	 * @returns { Float64Array } 슬롯 색 배열.
	 */
	getSlotColors() {
		return this.#slotColors;
	}

	//==============================================================================
	// 슬롯 붙임 이름 배열 반환. (없으면 null)
	//==============================================================================
	/**
	 * @returns { (string | null)[] } 슬롯마다의 붙임 이름.
	 */
	getSlotAttachmentNames() {
		return this.#slotAttachmentNames;
	}

	//==============================================================================
	// 그리기 차례 반환. (그리는 차례의 슬롯 번호)
	//==============================================================================
	/**
	 * @returns { number[] } 그리기 차례.
	 */
	getDrawOrder() {
		return this.#drawOrder;
	}

	//==============================================================================
	// 다른 자세를 그대로 옮겨 오기. (뼈와 슬롯 수가 같아야 한다)
	//==============================================================================
	/**
	 * @param { Skeleton2DPose } pose 옮겨 올 자세.
	 */
	copyFrom(pose) {
		const boneValues = pose.getBoneValues();
		const slotColors = pose.getSlotColors();
		const slotAttachmentNames = pose.getSlotAttachmentNames();
		const drawOrder = pose.getDrawOrder();
		this.#boneValues.set(boneValues);
		this.#slotColors.set(slotColors);
		const ownSlotAttachmentNames = this.#slotAttachmentNames;
		for (let slotIndex = 0; slotIndex < ownSlotAttachmentNames.length; ++slotIndex) {
			ownSlotAttachmentNames[slotIndex] = slotAttachmentNames[slotIndex];
		}
		const ownDrawOrder = this.#drawOrder;
		for (let orderIndex = 0; orderIndex < ownDrawOrder.length; ++orderIndex) {
			ownDrawOrder[orderIndex] = drawOrder[orderIndex];
		}
	}

	//==============================================================================
	// 다른 자세 쪽으로 섞기. (이 자세 = 이 자세 + (대상 - 이 자세) x alpha)
	// - 회전과 기울임은 짧은 쪽으로 돈다. 크기와 이동과 색은 곧게 섞는다.
	// - 붙임 이름과 그리기 차례는 섞을 수 없어 alpha 가 0.5 이상이면 대상 것을 쓴다.
	// - alpha 가 1 이상이면 대상을 그대로 옮긴다. 0 이하면 아무것도 하지 않는다.
	//==============================================================================
	/**
	 * @param { Skeleton2DPose } targetPose 섞을 대상 자세.
	 * @param { number } alpha 대상의 몫. (0 ~ 1)
	 */
	blend(targetPose, alpha) {
		if (alpha <= 0) {
			return;
		}
		if (alpha >= 1) {
			this.copyFrom(targetPose);
			return;
		}

		const boneValues = this.#boneValues;
		const targetBoneValues = targetPose.getBoneValues();
		for (let valueIndex = 0; valueIndex < boneValues.length; ++valueIndex) {
			const componentIndex = valueIndex % SKELETON2D_BONE_VALUE_COUNT;
			const isAngle = componentIndex === 2 || componentIndex === 5 || componentIndex === 6;
			const difference = isAngle ? wrapDegree(targetBoneValues[valueIndex] - boneValues[valueIndex]) : targetBoneValues[valueIndex] - boneValues[valueIndex];
			boneValues[valueIndex] += difference * alpha;
		}
		const slotColors = this.#slotColors;
		const targetSlotColors = targetPose.getSlotColors();
		for (let valueIndex = 0; valueIndex < slotColors.length; ++valueIndex) {
			slotColors[valueIndex] += (targetSlotColors[valueIndex] - slotColors[valueIndex]) * alpha;
		}
		if (alpha >= 0.5) {
			const slotAttachmentNames = this.#slotAttachmentNames;
			const targetSlotAttachmentNames = targetPose.getSlotAttachmentNames();
			for (let slotIndex = 0; slotIndex < slotAttachmentNames.length; ++slotIndex) {
				slotAttachmentNames[slotIndex] = targetSlotAttachmentNames[slotIndex];
			}
			const drawOrder = this.#drawOrder;
			const targetDrawOrder = targetPose.getDrawOrder();
			for (let orderIndex = 0; orderIndex < drawOrder.length; ++orderIndex) {
				drawOrder[orderIndex] = targetDrawOrder[orderIndex];
			}
		}
	}

	//==============================================================================
	// 처음 자세로. (뼈대 자료의 뼈 값, 슬롯 색과 붙임, 슬롯 차례)
	//==============================================================================
	/**
	 * @param { object } skeletonData 뼈대 자료. (Skeleton2DData, 뼈와 슬롯 수가 이 자세와 같아야 한다)
	 */
	setToSetupPose(skeletonData) {
		const boneDataList = skeletonData.getBones();
		const boneValues = this.#boneValues;
		for (let boneIndex = 0; boneIndex < boneDataList.length; ++boneIndex) {
			writeSetupBoneValues(boneDataList[boneIndex], boneValues, boneIndex * SKELETON2D_BONE_VALUE_COUNT);
		}
		const slotDataList = skeletonData.getSlots();
		for (let slotIndex = 0; slotIndex < slotDataList.length; ++slotIndex) {
			this.resetSlotToSetup(slotDataList[slotIndex]);
		}
		const drawOrder = this.#drawOrder;
		for (let orderIndex = 0; orderIndex < drawOrder.length; ++orderIndex) {
			drawOrder[orderIndex] = orderIndex;
		}
	}

	//==============================================================================
	// 슬롯 하나의 색과 붙임을 처음 값으로.
	//==============================================================================
	/**
	 * @param { object } slotData 슬롯 자료. (Skeleton2DSlotData)
	 */
	resetSlotToSetup(slotData) {
		const slotIndex = slotData.getIndex();
		const color = slotData.getColor();
		const slotColors = this.#slotColors;
		slotColors[slotIndex * 4] = color.red;
		slotColors[slotIndex * 4 + 1] = color.green;
		slotColors[slotIndex * 4 + 2] = color.blue;
		slotColors[slotIndex * 4 + 3] = color.alpha;
		this.#slotAttachmentNames[slotIndex] = slotData.getAttachmentName();
	}
}


//==============================================================================
// 뼈 자료의 처음 값을 뼈 값 배열에 적기.
//==============================================================================
/**
 * @param { object } boneData
 * @param { Float64Array } boneValues
 * @param { number } offset
 */
function writeSetupBoneValues(boneData, boneValues, offset) {
	boneValues[offset] = boneData.getX();
	boneValues[offset + 1] = boneData.getY();
	boneValues[offset + 2] = boneData.getRotation();
	boneValues[offset + 3] = boneData.getScaleX();
	boneValues[offset + 4] = boneData.getScaleY();
	boneValues[offset + 5] = boneData.getShearX();
	boneValues[offset + 6] = boneData.getShearY();
}


//==============================================================================
// 2D 뼈대 시간줄. (뼈 하나나 슬롯 하나의 한 갈래 값, 또는 그리기 차례, 사건)
// - 키는 시각 차례로 더한다. 처음 키 앞은 처음 키의 값, 마지막 키 뒤는 마지막 키의 값이다.
// - 값 시간줄(회전 1, 이동, 크기, 기울임 2, 색 4 개)은 키마다 곡선을 둔다. 곡선은 그 키에서 다음 키까지다.
//==============================================================================
/**
 * @example <caption>이동 시간줄을 만들어 가운데 시각의 값 읽기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const timeline = new Experimental.Skeleton2DTimeline(Experimental.Skeleton2DTimelineType.translate, 0);
 * timeline.addValueFrame(0, [0, 0], Experimental.Skeleton2DCurveType.linear, null);
 * timeline.addValueFrame(1, [10, -20], Experimental.Skeleton2DCurveType.linear, null);
 * const values = [0, 0];
 * timeline.sampleValues(0.5, values);
 * console.log(timeline.getFrameCount(), values[0], values[1]);
 */
export class Skeleton2DTimeline extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #timelineType;
	/** @private @type { number } */ #targetIndex;
	/** @private @type { number[] } */ #frameTimes;
	/** @private @type { number[] } */ #frameValues;
	/** @private @type { string[] } */ #curveTypes;
	/** @private @type { number[] } */ #curveValues;
	/** @private @type { (string | null)[] } */ #attachmentNames;
	/** @private @type { (number[] | null)[] } */ #drawOrders;
	/** @private @type { Skeleton2DEvent[] } */ #events;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { string } timelineType 시간줄 종류. (Skeleton2DTimelineType)
	 * @param { number } targetIndex 뼈 번호나 슬롯 번호. (그리기 차례와 사건은 -1)
	 */
	constructor(timelineType, targetIndex) {
		super();
		this.#timelineType = timelineType;
		this.#targetIndex = targetIndex;
		this.#frameTimes = [];
		this.#frameValues = [];
		this.#curveTypes = [];
		this.#curveValues = [];
		this.#attachmentNames = [];
		this.#drawOrders = [];
		this.#events = [];
	}

	//==============================================================================
	// 종류 반환.
	//==============================================================================
	/**
	 * @returns { string } 시간줄 종류. (Skeleton2DTimelineType)
	 */
	getTimelineType() {
		return this.#timelineType;
	}

	//==============================================================================
	// 대상 번호 반환.
	//==============================================================================
	/**
	 * @returns { number } 뼈 번호나 슬롯 번호. (그리기 차례와 사건은 -1)
	 */
	getTargetIndex() {
		return this.#targetIndex;
	}

	//==============================================================================
	// 키 하나의 값 수 반환. (회전 1, 이동, 크기, 기울임 2, 색 4, 그 밖 0)
	//==============================================================================
	/**
	 * @returns { number } 키 하나의 값 수.
	 */
	getValueStride() {
		switch (this.#timelineType) {
			case Skeleton2DTimelineType.rotate: {
				return 1;
			}
			case Skeleton2DTimelineType.translate:
			case Skeleton2DTimelineType.scale:
			case Skeleton2DTimelineType.shear: {
				return 2;
			}
			case Skeleton2DTimelineType.color: {
				return 4;
			}
			default: {
				return 0;
			}
		}
	}

	//==============================================================================
	// 키 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 키 수.
	 */
	getFrameCount() {
		return this.#frameTimes.length;
	}

	//==============================================================================
	// 키 시각 반환.
	//==============================================================================
	/**
	 * @param { number } frameIndex 키 번호.
	 * @returns { number } 그 키의 시각. (초)
	 */
	getFrameTime(frameIndex) {
		return this.#frameTimes[frameIndex];
	}

	//==============================================================================
	// 마지막 키의 시각 반환. (키가 없으면 0)
	//==============================================================================
	/**
	 * @returns { number } 마지막 키의 시각. (초)
	 */
	getLastFrameTime() {
		const frameTimes = this.#frameTimes;
		if (frameTimes.length === 0) {
			return 0;
		}
		return frameTimes[frameTimes.length - 1];
	}

	//==============================================================================
	// 값 키 더하기. (회전, 이동, 크기, 기울임, 색 시간줄)
	//==============================================================================
	/**
	 * @param { number } time 시각. (초, 앞 키보다 늦어야 한다)
	 * @param { number[] } values 값. (getValueStride 개, 뼈는 처음 자세에 대한 몫, 색은 0 ~ 1 의 빨강, 초록, 파랑, 투명도)
	 * @param { string } curveType 다음 키까지의 곡선. (Skeleton2DCurveType, 기본 선형)
	 * @param { number[] | null } curveValues 베지어 제어점 [x1, y1, x2, y2]. (x 는 0 ~ 1 로 자른다, 베지어가 아니면 null)
	 */
	addValueFrame(time, values, curveType = Skeleton2DCurveType.linear, curveValues = null) {
		checkSkeleton2DWritable(this);
		const valueStride = this.getValueStride();
		this.#frameTimes.push(time);
		for (let valueIndex = 0; valueIndex < valueStride; ++valueIndex) {
			this.#frameValues.push(values[valueIndex]);
		}
		this.#curveTypes.push(curveType);
		if (curveType === Skeleton2DCurveType.bezier && curveValues !== null && curveValues !== undefined) {
			this.#curveValues.push(System.Math.min(System.Math.max(curveValues[0], 0), 1), curveValues[1], System.Math.min(System.Math.max(curveValues[2], 0), 1), curveValues[3]);
		}
		else {
			this.#curveValues.push(0, 0, 1, 1);
		}
	}

	//==============================================================================
	// 붙임 키 더하기. (붙임 시간줄, 계단)
	//==============================================================================
	/**
	 * @param { number } time 시각. (초, 앞 키보다 늦어야 한다)
	 * @param { string | null } attachmentName 그 시각부터 보일 붙임 이름. (null 이면 숨긴다)
	 */
	addAttachmentFrame(time, attachmentName) {
		checkSkeleton2DWritable(this);
		this.#frameTimes.push(time);
		this.#attachmentNames.push(attachmentName);
	}

	//==============================================================================
	// 그리기 차례 키 더하기. (그리기 차례 시간줄, 계단)
	//==============================================================================
	/**
	 * @param { number } time 시각. (초, 앞 키보다 늦어야 한다)
	 * @param { number[] | null } drawOrder 그리는 차례의 슬롯 번호 모두. (null 이면 처음 차례)
	 */
	addDrawOrderFrame(time, drawOrder) {
		checkSkeleton2DWritable(this);
		this.#frameTimes.push(time);
		this.#drawOrders.push(drawOrder);
	}

	//==============================================================================
	// 사건 키 더하기. (사건 시간줄)
	//==============================================================================
	/**
	 * @param { Skeleton2DEvent } event 사건. (시각은 사건이 든다, 앞 사건보다 늦거나 같아야 한다)
	 */
	addEventFrame(event) {
		checkSkeleton2DWritable(this);
		const time = event.getTime();
		this.#frameTimes.push(time);
		this.#events.push(event);
	}

	//==============================================================================
	// 사건 목록 반환.
	//==============================================================================
	/**
	 * @returns { Skeleton2DEvent[] } 사건 목록. (시각 차례)
	 */
	getEvents() {
		return this.#events;
	}

	//==============================================================================
	// 그 시각에 걸리는 키 번호. (시각이 그 키 이상인 마지막 키, 처음 키 앞이면 0, 키가 없으면 -1)
	//==============================================================================
	/**
	 * @param { number } time 시각. (초)
	 * @returns { number } 키 번호.
	 */
	findFrameIndex(time) {
		const frameTimes = this.#frameTimes;
		if (frameTimes.length === 0) {
			return -1;
		}
		let lowIndex = 0;
		let highIndex = frameTimes.length - 1;
		while (lowIndex < highIndex) {
			const middleIndex = (lowIndex + highIndex + 1) >> 1;
			if (frameTimes[middleIndex] <= time) {
				lowIndex = middleIndex;
			}
			else {
				highIndex = middleIndex - 1;
			}
		}
		return lowIndex;
	}

	//==============================================================================
	// 그 시각의 값 읽기. (값 시간줄, getValueStride 개를 output 에 적는다, 키가 없으면 적지 않고 false)
	//==============================================================================
	/**
	 * @param { number } time 시각. (초)
	 * @param { number[] | Float64Array } output 값을 적을 곳.
	 * @returns { boolean } 적었으면 참.
	 */
	sampleValues(time, output) {
		const frameIndex = this.findFrameIndex(time);
		if (frameIndex < 0) {
			return false;
		}
		const valueStride = this.getValueStride();
		const frameTimes = this.#frameTimes;
		const frameValues = this.#frameValues;
		const offset = frameIndex * valueStride;
		const isLastFrame = frameIndex === frameTimes.length - 1;
		if (isLastFrame || time <= frameTimes[frameIndex]) {
			for (let valueIndex = 0; valueIndex < valueStride; ++valueIndex) {
				output[valueIndex] = frameValues[offset + valueIndex];
			}
			return true;
		}

		const frameTime = frameTimes[frameIndex];
		const nextFrameTime = frameTimes[frameIndex + 1];
		const span = nextFrameTime - frameTime;
		const percent = span > 0 ? (time - frameTime) / span : 1;
		const curveValues = this.#curveValues;
		const curveOffset = frameIndex * 4;
		const bezierValues = [curveValues[curveOffset], curveValues[curveOffset + 1], curveValues[curveOffset + 2], curveValues[curveOffset + 3]];
		const easedPercent = evaluateSkeleton2DCurve(this.#curveTypes[frameIndex], bezierValues, percent);
		const nextOffset = offset + valueStride;
		for (let valueIndex = 0; valueIndex < valueStride; ++valueIndex) {
			const value = frameValues[offset + valueIndex];
			const nextValue = frameValues[nextOffset + valueIndex];
			output[valueIndex] = value + (nextValue - value) * easedPercent;
		}
		return true;
	}

	//==============================================================================
	// 자세에 걸기. (뼈는 처음 값에 몫을 더하거나 곱하고, 슬롯 색과 붙임과 그리기 차례는 그 값으로)
	//==============================================================================
	/**
	 * @param { Skeleton2DPose } pose 값을 쓸 자세.
	 * @param { object } skeletonData 뼈대 자료. (Skeleton2DData, 처음 값을 읽는다)
	 * @param { number } time 클립 안의 시각. (초)
	 */
	apply(pose, skeletonData, time) {
		const timelineType = this.#timelineType;
		const targetIndex = this.#targetIndex;
		switch (timelineType) {
			case Skeleton2DTimelineType.rotate:
			case Skeleton2DTimelineType.translate:
			case Skeleton2DTimelineType.scale:
			case Skeleton2DTimelineType.shear: {
				const values = [0, 0];
				const isSampled = this.sampleValues(time, values);
				if (!isSampled) {
					return;
				}
				const boneDataList = skeletonData.getBones();
				const boneData = boneDataList[targetIndex];
				const boneValues = pose.getBoneValues();
				const offset = targetIndex * SKELETON2D_BONE_VALUE_COUNT;
				if (timelineType === Skeleton2DTimelineType.rotate) {
					boneValues[offset + 2] = boneData.getRotation() + values[0];
				}
				else if (timelineType === Skeleton2DTimelineType.translate) {
					boneValues[offset] = boneData.getX() + values[0];
					boneValues[offset + 1] = boneData.getY() + values[1];
				}
				else if (timelineType === Skeleton2DTimelineType.scale) {
					boneValues[offset + 3] = boneData.getScaleX() * values[0];
					boneValues[offset + 4] = boneData.getScaleY() * values[1];
				}
				else {
					boneValues[offset + 5] = boneData.getShearX() + values[0];
					boneValues[offset + 6] = boneData.getShearY() + values[1];
				}
				break;
			}
			case Skeleton2DTimelineType.color: {
				const values = [1, 1, 1, 1];
				const isSampled = this.sampleValues(time, values);
				if (!isSampled) {
					return;
				}
				const slotColors = pose.getSlotColors();
				for (let channelIndex = 0; channelIndex < 4; ++channelIndex) {
					slotColors[targetIndex * 4 + channelIndex] = values[channelIndex];
				}
				break;
			}
			case Skeleton2DTimelineType.attachment: {
				const frameIndex = this.findFrameIndex(time);
				if (frameIndex < 0) {
					return;
				}
				const slotAttachmentNames = pose.getSlotAttachmentNames();
				slotAttachmentNames[targetIndex] = this.#attachmentNames[frameIndex];
				break;
			}
			case Skeleton2DTimelineType.drawOrder: {
				const frameIndex = this.findFrameIndex(time);
				if (frameIndex < 0) {
					return;
				}
				const drawOrder = pose.getDrawOrder();
				const frameDrawOrder = this.#drawOrders[frameIndex];
				for (let orderIndex = 0; orderIndex < drawOrder.length; ++orderIndex) {
					drawOrder[orderIndex] = frameDrawOrder === null ? orderIndex : frameDrawOrder[orderIndex];
				}
				break;
			}
			default: {
				break;
			}
		}
	}

	//==============================================================================
	// 이 시간줄이 움직이는 값을 처음 값으로. (사건은 아무것도 하지 않는다)
	//==============================================================================
	/**
	 * @param { Skeleton2DPose } pose 값을 쓸 자세.
	 * @param { object } skeletonData 뼈대 자료. (Skeleton2DData)
	 */
	resetToSetup(pose, skeletonData) {
		const timelineType = this.#timelineType;
		const targetIndex = this.#targetIndex;
		switch (timelineType) {
			case Skeleton2DTimelineType.rotate:
			case Skeleton2DTimelineType.translate:
			case Skeleton2DTimelineType.scale:
			case Skeleton2DTimelineType.shear: {
				const boneDataList = skeletonData.getBones();
				const boneData = boneDataList[targetIndex];
				const boneValues = pose.getBoneValues();
				const offset = targetIndex * SKELETON2D_BONE_VALUE_COUNT;
				if (timelineType === Skeleton2DTimelineType.rotate) {
					boneValues[offset + 2] = boneData.getRotation();
				}
				else if (timelineType === Skeleton2DTimelineType.translate) {
					boneValues[offset] = boneData.getX();
					boneValues[offset + 1] = boneData.getY();
				}
				else if (timelineType === Skeleton2DTimelineType.scale) {
					boneValues[offset + 3] = boneData.getScaleX();
					boneValues[offset + 4] = boneData.getScaleY();
				}
				else {
					boneValues[offset + 5] = boneData.getShearX();
					boneValues[offset + 6] = boneData.getShearY();
				}
				break;
			}
			case Skeleton2DTimelineType.color:
			case Skeleton2DTimelineType.attachment: {
				const slotDataList = skeletonData.getSlots();
				const slotData = slotDataList[targetIndex];
				const slotColors = pose.getSlotColors();
				if (timelineType === Skeleton2DTimelineType.color) {
					const color = slotData.getColor();
					slotColors[targetIndex * 4] = color.red;
					slotColors[targetIndex * 4 + 1] = color.green;
					slotColors[targetIndex * 4 + 2] = color.blue;
					slotColors[targetIndex * 4 + 3] = color.alpha;
				}
				else {
					const slotAttachmentNames = pose.getSlotAttachmentNames();
					slotAttachmentNames[targetIndex] = slotData.getAttachmentName();
				}
				break;
			}
			case Skeleton2DTimelineType.drawOrder: {
				const drawOrder = pose.getDrawOrder();
				for (let orderIndex = 0; orderIndex < drawOrder.length; ++orderIndex) {
					drawOrder[orderIndex] = orderIndex;
				}
				break;
			}
			default: {
				break;
			}
		}
	}
}


//==============================================================================
// 2D 뼈대 클립. (이름, 길이, 시간줄 목록)
// - apply 는 시각을 그대로 쓴다. 되풀이와 끝에서 멈추기는 부르는 쪽(Skeleton2DAnimationState)이 시각을 접어 준다.
//==============================================================================
/**
 * @example <caption>코드로 클립을 지어 자세에 걸기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const skeletonData = Experimental.Skeleton2DData.createFromJson({ bones: [{ name: "root" }, { name: "body", parent: "root" }] });
 * const timeline = new Experimental.Skeleton2DTimeline(Experimental.Skeleton2DTimelineType.translate, 1);
 * timeline.addValueFrame(0, [0, 0], Experimental.Skeleton2DCurveType.linear, null);
 * timeline.addValueFrame(1, [0, -10], Experimental.Skeleton2DCurveType.linear, null);
 * const animation = new Experimental.Skeleton2DAnimation("jump", 1);
 * animation.addTimeline(timeline);
 * const pose = new Experimental.Skeleton2DPose(2, 0);
 * pose.setToSetupPose(skeletonData);
 * animation.apply(pose, skeletonData, 0.5);
 * console.log(animation.getName(), animation.getDuration(), pose.getBoneValues()[8]);
 */
export class Skeleton2DAnimation extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #name;
	/** @private @type { number } */ #duration;
	/** @private @type { Skeleton2DTimeline[] } */ #timelines;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { string } name 클립 이름.
	 * @param { number } duration 길이. (초)
	 */
	constructor(name, duration) {
		super();
		this.#name = name;
		this.#duration = duration;
		this.#timelines = [];
	}

	//==============================================================================
	// 이름 반환.
	//==============================================================================
	/**
	 * @returns { string } 클립 이름.
	 */
	getName() {
		return this.#name;
	}

	//==============================================================================
	// 길이 반환.
	//==============================================================================
	/**
	 * @returns { number } 길이. (초)
	 */
	getDuration() {
		return this.#duration;
	}

	//==============================================================================
	// 길이 설정.
	//==============================================================================
	/**
	 * @param { number } duration 길이. (초)
	 */
	setDuration(duration) {
		checkSkeleton2DWritable(this);
		this.#duration = duration;
	}

	//==============================================================================
	// 시간줄 더하기.
	//==============================================================================
	/**
	 * @param { Skeleton2DTimeline } timeline 더할 시간줄.
	 */
	addTimeline(timeline) {
		checkSkeleton2DWritable(this);
		this.#timelines.push(timeline);
	}

	//==============================================================================
	// 시간줄 목록 반환.
	//==============================================================================
	/**
	 * @returns { Skeleton2DTimeline[] } 시간줄 목록.
	 */
	getTimelines() {
		return this.#timelines;
	}

	//==============================================================================
	// 자세에 걸기. (시간줄마다 apply)
	//==============================================================================
	/**
	 * @param { Skeleton2DPose } pose 값을 쓸 자세.
	 * @param { object } skeletonData 뼈대 자료. (Skeleton2DData)
	 * @param { number } time 클립 안의 시각. (초)
	 */
	apply(pose, skeletonData, time) {
		for (const timeline of this.#timelines) {
			timeline.apply(pose, skeletonData, time);
		}
	}

	//==============================================================================
	// 이 클립이 움직이는 값을 처음 값으로. (시간줄마다 resetToSetup)
	//==============================================================================
	/**
	 * @param { Skeleton2DPose } pose 값을 쓸 자세.
	 * @param { object } skeletonData 뼈대 자료. (Skeleton2DData)
	 */
	resetKeyedToSetup(pose, skeletonData) {
		for (const timeline of this.#timelines) {
			timeline.resetToSetup(pose, skeletonData);
		}
	}

	//==============================================================================
	// 두 시각 사이의 사건 모으기. (fromTime 초과 toTime 이하, fromTime 이 음수면 0 의 사건도 든다)
	//==============================================================================
	/**
	 * @param { number } fromTime 앞 시각. (초, 이 시각의 사건은 빠진다)
	 * @param { number } toTime 뒤 시각. (초, 이 시각의 사건은 든다)
	 * @param { Skeleton2DEvent[] } output 사건을 덧붙일 목록.
	 */
	collectEvents(fromTime, toTime, output) {
		for (const timeline of this.#timelines) {
			if (timeline.getTimelineType() !== Skeleton2DTimelineType.event) {
				continue;
			}
			const events = timeline.getEvents();
			for (const event of events) {
				const eventTime = event.getTime();
				if (eventTime > fromTime && eventTime <= toTime) {
					output.push(event);
				}
			}
		}
	}
}
