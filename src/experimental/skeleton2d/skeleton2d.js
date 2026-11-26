//==============================================================================
// 2D 뼈대 인스턴스. (자료 하나로 지은 뼈, 슬롯, IK 의 지금 자세, 월드 행렬, 붙임 꼭짓점)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 뼈의 지역 값(이동, 회전, 크기, 기울임)은 클립이나 코드가 쓴다. updateWorldTransform 이 부모부터 월드 행렬을 셈하고 IK 를 건다.
// - IK 는 지역 값을 바꾸지 않고 '걸린 회전'(getAppliedRotation)만 바꾼다. 다음 셈은 다시 지역 값에서 시작해 쌓이지 않는다.
// - 뼈 하나 IK 는 뼈 x 축이 목표를 보게 돌린다. 뼈 둘 IK 는 코사인 법칙으로 부모를 돌려 팔꿈치를 놓고 자식이 목표를 보게 돌린다.
//   닿지 않으면 곧게 편다. 세기(mix)로 원래 회전과 섞는다. 할아버지 뼈가 뒤집혀 있으면(행렬식 음수) 꺾임 쪽을 뒤집는다. (DragonBones 와 같다)
//==============================================================================

/**
 * @example <caption>팔 두 뼈를 IK 로 목표에 닿게 하기</caption>
 * import { Experimental } from "./build/vanilla.js";
 *
 * const skeletonData = Experimental.Skeleton2DData.createFromJson({
 * 	bones: [
 * 		{ name: "root" },
 * 		{ name: "upper", parent: "root", length: 50 },
 * 		{ name: "lower", parent: "upper", x: 50, length: 50 },
 * 		{ name: "target", parent: "root", x: 60, y: 40 },
 * 	],
 * 	ik: [{ name: "armIk", bones: ["upper", "lower"], target: "target", bendPositive: true }],
 * });
 * const skeleton = new Experimental.Skeleton2D(skeletonData);
 * skeleton.updateWorldTransform();
 * const lowerBone = skeleton.findBone("lower");
 * const tip = lowerBone.localToWorld(50, 0);
 * console.log(tip.x.toFixed(3), tip.y.toFixed(3));
 */


//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";
import { Color } from "../../base/color.js";
import { Vector2 } from "../../base/vector2.js";
import { Skeleton2DAttachmentType } from "./skeleton2ddata.js";
import { SKELETON2D_BONE_VALUE_COUNT } from "./skeleton2danimation.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 도를 라디안으로.
const DEGREE_TO_RADIAN = System.Math.PI / 180;

// 라디안을 도로.
const RADIAN_TO_DEGREE = 180 / System.Math.PI;

// IK 가 길이 0 으로 보는 값.
const IK_EPSILON = 0.00001;


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
// 뼈. (지역 값, IK 가 건 회전, 월드 행렬)
// - 월드 행렬: 월드 x = a x 지역 x + c x 지역 y + 월드 x 자리, 월드 y = b x 지역 x + d x 지역 y + 월드 y 자리.
//==============================================================================
/**
 * @example <caption>뼈를 돌리고 뼈 끝의 월드 자리 읽기</caption>
 * import { Experimental } from "./build/vanilla.js";
 *
 * const skeletonData = Experimental.Skeleton2DData.createFromJson({ bones: [{ name: "root" }, { name: "arm", parent: "root", x: 10, length: 20 }] });
 * const skeleton = new Experimental.Skeleton2D(skeletonData);
 * const armBone = skeleton.findBone("arm");
 * armBone.setRotation(90);
 * skeleton.updateWorldTransform();
 * const tip = armBone.localToWorld(20, 0);
 * const local = armBone.worldToLocal(tip.x, tip.y);
 * console.log(armBone.getWorldRotation(), tip.x.toFixed(3), tip.y.toFixed(3), local.x.toFixed(3));
 */
export class Skeleton2DBone extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object } */ #data;
	/** @private @type { number } */ #x;
	/** @private @type { number } */ #y;
	/** @private @type { number } */ #rotation;
	/** @private @type { number } */ #scaleX;
	/** @private @type { number } */ #scaleY;
	/** @private @type { number } */ #shearX;
	/** @private @type { number } */ #shearY;
	/** @private @type { number } */ #appliedRotation;
	/** @private @type { number } */ #worldA;
	/** @private @type { number } */ #worldB;
	/** @private @type { number } */ #worldC;
	/** @private @type { number } */ #worldD;
	/** @private @type { number } */ #worldX;
	/** @private @type { number } */ #worldY;

	//==============================================================================
	// 생성. (처음 자세, 월드 행렬은 단위 행렬)
	//==============================================================================
	/**
	 * @param { object } boneData 뼈 자료. (Skeleton2DBoneData)
	 */
	constructor(boneData) {
		super();
		this.#data = boneData;
		this.#worldA = 1;
		this.#worldB = 0;
		this.#worldC = 0;
		this.#worldD = 1;
		this.#worldX = 0;
		this.#worldY = 0;
		this.setToSetupPose();
	}

	//==============================================================================
	// 자료 반환.
	//==============================================================================
	/**
	 * @returns { object } 뼈 자료. (Skeleton2DBoneData)
	 */
	getData() {
		return this.#data;
	}

	//==============================================================================
	// 번호 반환.
	//==============================================================================
	/**
	 * @returns { number } 뼈 번호.
	 */
	getIndex() {
		const boneData = this.getData();
		return boneData.getIndex();
	}

	//==============================================================================
	// 이름 반환.
	//==============================================================================
	/**
	 * @returns { string } 뼈 이름.
	 */
	getName() {
		const boneData = this.getData();
		return boneData.getName();
	}

	//==============================================================================
	// 부모 번호 반환.
	//==============================================================================
	/**
	 * @returns { number } 부모 뼈 번호. (뿌리는 -1)
	 */
	getParentIndex() {
		const boneData = this.getData();
		return boneData.getParentIndex();
	}

	//==============================================================================
	// 처음 자세로. (지역 값을 자료 값으로)
	//==============================================================================
	setToSetupPose() {
		const boneData = this.getData();
		this.#x = boneData.getX();
		this.#y = boneData.getY();
		this.#rotation = boneData.getRotation();
		this.#scaleX = boneData.getScaleX();
		this.#scaleY = boneData.getScaleY();
		this.#shearX = boneData.getShearX();
		this.#shearY = boneData.getShearY();
		this.#appliedRotation = this.#rotation;
	}

	//==============================================================================
	// 지역 x 반환.
	//==============================================================================
	/**
	 * @returns { number } 부모 기준 x.
	 */
	getX() {
		return this.#x;
	}

	//==============================================================================
	// 지역 y 반환.
	//==============================================================================
	/**
	 * @returns { number } 부모 기준 y.
	 */
	getY() {
		return this.#y;
	}

	//==============================================================================
	// 지역 자리 설정.
	//==============================================================================
	/**
	 * @param { number } x 부모 기준 x.
	 * @param { number } y 부모 기준 y.
	 */
	setPosition(x, y) {
		this.#x = x;
		this.#y = y;
	}

	//==============================================================================
	// 지역 회전 반환.
	//==============================================================================
	/**
	 * @returns { number } 회전. (도)
	 */
	getRotation() {
		return this.#rotation;
	}

	//==============================================================================
	// 지역 회전 설정.
	//==============================================================================
	/**
	 * @param { number } rotation 회전. (도)
	 */
	setRotation(rotation) {
		this.#rotation = rotation;
	}

	//==============================================================================
	// 크기 x 반환.
	//==============================================================================
	/**
	 * @returns { number } 크기 x.
	 */
	getScaleX() {
		return this.#scaleX;
	}

	//==============================================================================
	// 크기 y 반환.
	//==============================================================================
	/**
	 * @returns { number } 크기 y.
	 */
	getScaleY() {
		return this.#scaleY;
	}

	//==============================================================================
	// 크기 설정.
	//==============================================================================
	/**
	 * @param { number } scaleX 크기 x.
	 * @param { number } scaleY 크기 y.
	 */
	setScale(scaleX, scaleY) {
		this.#scaleX = scaleX;
		this.#scaleY = scaleY;
	}

	//==============================================================================
	// 기울임 x 반환.
	//==============================================================================
	/**
	 * @returns { number } 기울임 x. (도)
	 */
	getShearX() {
		return this.#shearX;
	}

	//==============================================================================
	// 기울임 y 반환.
	//==============================================================================
	/**
	 * @returns { number } 기울임 y. (도)
	 */
	getShearY() {
		return this.#shearY;
	}

	//==============================================================================
	// 기울임 설정.
	//==============================================================================
	/**
	 * @param { number } shearX 기울임 x. (도)
	 * @param { number } shearY 기울임 y. (도)
	 */
	setShear(shearX, shearY) {
		this.#shearX = shearX;
		this.#shearY = shearY;
	}

	//==============================================================================
	// 걸린 회전 반환. (IK 가 바꾼 회전, IK 가 없으면 지역 회전, updateWorldTransform 뒤의 값)
	//==============================================================================
	/**
	 * @returns { number } 걸린 회전. (도)
	 */
	getAppliedRotation() {
		return this.#appliedRotation;
	}

	//==============================================================================
	// 걸린 회전 설정. (Skeleton2D 가 월드 행렬 셈과 IK 에서 쓴다)
	//==============================================================================
	/**
	 * @param { number } appliedRotation 걸린 회전. (도)
	 */
	setAppliedRotation(appliedRotation) {
		this.#appliedRotation = appliedRotation;
	}

	//==============================================================================
	// 월드 행렬 설정. (Skeleton2D 가 셈해 넣는다)
	//==============================================================================
	/**
	 * @param { number } worldA 월드 행렬 a.
	 * @param { number } worldB 월드 행렬 b.
	 * @param { number } worldC 월드 행렬 c.
	 * @param { number } worldD 월드 행렬 d.
	 * @param { number } worldX 월드 x 자리.
	 * @param { number } worldY 월드 y 자리.
	 */
	setWorldTransform(worldA, worldB, worldC, worldD, worldX, worldY) {
		this.#worldA = worldA;
		this.#worldB = worldB;
		this.#worldC = worldC;
		this.#worldD = worldD;
		this.#worldX = worldX;
		this.#worldY = worldY;
	}

	//==============================================================================
	// 월드 행렬 a 반환. (지역 x 축의 월드 x)
	//==============================================================================
	/**
	 * @returns { number } 월드 행렬 a.
	 */
	getWorldA() {
		return this.#worldA;
	}

	//==============================================================================
	// 월드 행렬 b 반환. (지역 x 축의 월드 y)
	//==============================================================================
	/**
	 * @returns { number } 월드 행렬 b.
	 */
	getWorldB() {
		return this.#worldB;
	}

	//==============================================================================
	// 월드 행렬 c 반환. (지역 y 축의 월드 x)
	//==============================================================================
	/**
	 * @returns { number } 월드 행렬 c.
	 */
	getWorldC() {
		return this.#worldC;
	}

	//==============================================================================
	// 월드 행렬 d 반환. (지역 y 축의 월드 y)
	//==============================================================================
	/**
	 * @returns { number } 월드 행렬 d.
	 */
	getWorldD() {
		return this.#worldD;
	}

	//==============================================================================
	// 월드 x 자리 반환.
	//==============================================================================
	/**
	 * @returns { number } 월드 x 자리. (뼈대 기준)
	 */
	getWorldX() {
		return this.#worldX;
	}

	//==============================================================================
	// 월드 y 자리 반환.
	//==============================================================================
	/**
	 * @returns { number } 월드 y 자리. (뼈대 기준)
	 */
	getWorldY() {
		return this.#worldY;
	}

	//==============================================================================
	// 월드 회전 반환. (지역 x 축이 월드에서 가리키는 각)
	//==============================================================================
	/**
	 * @returns { number } 월드 회전. (도, -180 ~ 180)
	 */
	getWorldRotation() {
		return System.Math.atan2(this.#worldB, this.#worldA) * RADIAN_TO_DEGREE;
	}

	//==============================================================================
	// 월드 크기 x 반환. (지역 x 축의 길이)
	//==============================================================================
	/**
	 * @returns { number } 월드 크기 x.
	 */
	getWorldScaleX() {
		return System.Math.hypot(this.#worldA, this.#worldB);
	}

	//==============================================================================
	// 월드 크기 y 반환. (지역 y 축의 길이)
	//==============================================================================
	/**
	 * @returns { number } 월드 크기 y.
	 */
	getWorldScaleY() {
		return System.Math.hypot(this.#worldC, this.#worldD);
	}

	//==============================================================================
	// 뼈 기준 자리를 월드 자리로.
	//==============================================================================
	/**
	 * @param { number } localX 뼈 기준 x.
	 * @param { number } localY 뼈 기준 y.
	 * @returns { Vector2 } 월드 자리. (뼈대 기준)
	 */
	localToWorld(localX, localY) {
		const worldX = this.#worldA * localX + this.#worldC * localY + this.#worldX;
		const worldY = this.#worldB * localX + this.#worldD * localY + this.#worldY;
		return Vector2.create(worldX, worldY);
	}

	//==============================================================================
	// 월드 자리를 뼈 기준 자리로. (행렬을 되돌릴 수 없으면 0, 0)
	//==============================================================================
	/**
	 * @param { number } worldX 월드 x. (뼈대 기준)
	 * @param { number } worldY 월드 y. (뼈대 기준)
	 * @returns { Vector2 } 뼈 기준 자리.
	 */
	worldToLocal(worldX, worldY) {
		const determinant = this.#worldA * this.#worldD - this.#worldB * this.#worldC;
		if (determinant === 0) {
			return Vector2.create(0, 0);
		}
		const differenceX = worldX - this.#worldX;
		const differenceY = worldY - this.#worldY;
		const localX = (this.#worldD * differenceX - this.#worldC * differenceY) / determinant;
		const localY = (this.#worldA * differenceY - this.#worldB * differenceX) / determinant;
		return Vector2.create(localX, localY);
	}
}


//==============================================================================
// 슬롯. (지금 색과 붙임 이름)
//==============================================================================
/**
 * @example <caption>슬롯 색 바꾸기</caption>
 * import { Experimental, Color } from "./build/vanilla.js";
 *
 * const skeletonData = Experimental.Skeleton2DData.createFromJson({ bones: [{ name: "root" }], slots: [{ name: "body", bone: "root" }] });
 * const skeleton = new Experimental.Skeleton2D(skeletonData);
 * const bodySlot = skeleton.findSlot("body");
 * bodySlot.setColor(new Color(1, 0, 0, 0.5));
 * const color = bodySlot.getColor();
 * console.log(bodySlot.getName(), color.red, color.alpha, bodySlot.getAttachmentName());
 */
export class Skeleton2DSlot extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object } */ #data;
	/** @private @type { Color } */ #color;
	/** @private @type { string | null } */ #attachmentName;

	//==============================================================================
	// 생성. (처음 색과 붙임)
	//==============================================================================
	/**
	 * @param { object } slotData 슬롯 자료. (Skeleton2DSlotData)
	 */
	constructor(slotData) {
		super();
		this.#data = slotData;
		this.#color = new Color(1, 1, 1, 1);
		this.#attachmentName = null;
		this.setToSetupPose();
	}

	//==============================================================================
	// 자료 반환.
	//==============================================================================
	/**
	 * @returns { object } 슬롯 자료. (Skeleton2DSlotData)
	 */
	getData() {
		return this.#data;
	}

	//==============================================================================
	// 번호 반환.
	//==============================================================================
	/**
	 * @returns { number } 슬롯 번호.
	 */
	getIndex() {
		const slotData = this.getData();
		return slotData.getIndex();
	}

	//==============================================================================
	// 이름 반환.
	//==============================================================================
	/**
	 * @returns { string } 슬롯 이름.
	 */
	getName() {
		const slotData = this.getData();
		return slotData.getName();
	}

	//==============================================================================
	// 뼈 번호 반환.
	//==============================================================================
	/**
	 * @returns { number } 붙는 뼈 번호.
	 */
	getBoneIndex() {
		const slotData = this.getData();
		return slotData.getBoneIndex();
	}

	//==============================================================================
	// 처음 자세로. (처음 색과 붙임 이름)
	//==============================================================================
	setToSetupPose() {
		const slotData = this.getData();
		const color = slotData.getColor();
		this.#color.red = color.red;
		this.#color.green = color.green;
		this.#color.blue = color.blue;
		this.#color.alpha = color.alpha;
		this.#attachmentName = slotData.getAttachmentName();
	}

	//==============================================================================
	// 색 반환. (그림에 곱하는 색, 고치면 바로 걸린다)
	//==============================================================================
	/**
	 * @returns { Color } 지금 색.
	 */
	getColor() {
		return this.#color;
	}

	//==============================================================================
	// 색 설정. (값을 옮겨 담는다)
	//==============================================================================
	/**
	 * @param { Color } color 새 색.
	 */
	setColor(color) {
		this.#color.red = color.red;
		this.#color.green = color.green;
		this.#color.blue = color.blue;
		this.#color.alpha = color.alpha;
	}

	//==============================================================================
	// 붙임 이름 반환.
	//==============================================================================
	/**
	 * @returns { string | null } 지금 붙임 이름. (없으면 null)
	 */
	getAttachmentName() {
		return this.#attachmentName;
	}

	//==============================================================================
	// 붙임 이름 설정. (스킨에 있는지는 보지 않는다, 확인하려면 Skeleton2D.setAttachment)
	//==============================================================================
	/**
	 * @param { string | null } attachmentName 붙임 이름. (null 이면 숨긴다)
	 */
	setAttachmentName(attachmentName) {
		this.#attachmentName = attachmentName;
	}
}


//==============================================================================
// IK 제약. (지금 세기와 꺾임 쪽)
//==============================================================================
/**
 * @example <caption>IK 세기를 반으로</caption>
 * import { Experimental } from "./build/vanilla.js";
 *
 * const skeletonData = Experimental.Skeleton2DData.createFromJson({
 * 	bones: [{ name: "root" }, { name: "arm", parent: "root", length: 10 }, { name: "target", parent: "root", y: 10 }],
 * 	ik: [{ name: "aim", bones: ["arm"], target: "target" }],
 * });
 * const skeleton = new Experimental.Skeleton2D(skeletonData);
 * const ikConstraint = skeleton.findIkConstraint("aim");
 * ikConstraint.setMix(0.5);
 * skeleton.updateWorldTransform();
 * console.log(ikConstraint.getName(), skeleton.findBone("arm").getWorldRotation().toFixed(3));
 */
export class Skeleton2DIkConstraint extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object } */ #data;
	/** @private @type { number } */ #mix;
	/** @private @type { boolean } */ #isBendPositive;

	//==============================================================================
	// 생성. (자료의 세기와 꺾임 쪽)
	//==============================================================================
	/**
	 * @param { object } ikConstraintData 제약 자료. (Skeleton2DIkConstraintData)
	 */
	constructor(ikConstraintData) {
		super();
		this.#data = ikConstraintData;
		this.#mix = ikConstraintData.getMix();
		this.#isBendPositive = ikConstraintData.isBendPositive();
	}

	//==============================================================================
	// 자료 반환.
	//==============================================================================
	/**
	 * @returns { object } 제약 자료. (Skeleton2DIkConstraintData)
	 */
	getData() {
		return this.#data;
	}

	//==============================================================================
	// 이름 반환.
	//==============================================================================
	/**
	 * @returns { string } 제약 이름.
	 */
	getName() {
		const ikConstraintData = this.getData();
		return ikConstraintData.getName();
	}

	//==============================================================================
	// 세기 반환.
	//==============================================================================
	/**
	 * @returns { number } 세기. (0 ~ 1)
	 */
	getMix() {
		return this.#mix;
	}

	//==============================================================================
	// 세기 설정.
	//==============================================================================
	/**
	 * @param { number } mix 세기. (0 이면 걸지 않고 1 이면 끝까지)
	 */
	setMix(mix) {
		this.#mix = mix;
	}

	//==============================================================================
	// 꺾임 쪽 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 양의 쪽으로 꺾으면 참.
	 */
	isBendPositive() {
		return this.#isBendPositive;
	}

	//==============================================================================
	// 꺾임 쪽 설정.
	//==============================================================================
	/**
	 * @param { boolean } isBendPositive 양의 쪽으로 꺾으면 참.
	 */
	setBendPositive(isBendPositive) {
		this.#isBendPositive = isBendPositive;
	}

	//==============================================================================
	// 처음 값으로. (자료의 세기와 꺾임 쪽)
	//==============================================================================
	setToSetupPose() {
		const ikConstraintData = this.getData();
		this.#mix = ikConstraintData.getMix();
		this.#isBendPositive = ikConstraintData.isBendPositive();
	}
}


//==============================================================================
// 2D 뼈대 인스턴스.
//==============================================================================
/**
 * @example <caption>스킨을 고르고 붙임을 바꾼 뒤 슬롯 꼭짓점 셈하기</caption>
 * import { Experimental } from "./build/vanilla.js";
 *
 * const skeletonData = Experimental.Skeleton2DData.createFromJson({
 * 	bones: [{ name: "root" }, { name: "head", parent: "root", y: -50 }],
 * 	slots: [{ name: "head", bone: "head", attachment: "face" }],
 * 	skins: [{ name: "default", attachments: { head: {
 * 		face: { type: "region", frame: "face", width: 20, height: 20 },
 * 		mask: { type: "region", frame: "mask", width: 24, height: 20 },
 * 	} } }],
 * });
 * const skeleton = new Experimental.Skeleton2D(skeletonData);
 * const isChanged = skeleton.setAttachment("head", "mask");
 * skeleton.updateWorldTransform();
 * const positions = new Float64Array(8);
 * const vertexCount = skeleton.computeAttachmentVertices(0, positions, 0, 0);
 * console.log(isChanged, vertexCount, positions[0], positions[1]);
 */
export class Skeleton2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object } */ #data;
	/** @private @type { Skeleton2DBone[] } */ #bones;
	/** @private @type { Skeleton2DSlot[] } */ #slots;
	/** @private @type { Skeleton2DIkConstraint[] } */ #ikConstraints;
	/** @private @type { number[] } */ #drawOrder;
	/** @private @type { object | null } */ #skin;
	/** @private @type { Uint8Array } */ #dirtyFlags;

	//==============================================================================
	// 생성. (처음 자세, 처음 스킨)
	//==============================================================================
	/**
	 * @param { object } skeletonData 뼈대 자료. (Skeleton2DData)
	 */
	constructor(skeletonData) {
		super();
		this.#data = skeletonData;
		this.#bones = [];
		const boneDataList = skeletonData.getBones();
		for (const boneData of boneDataList) {
			this.#bones.push(new Skeleton2DBone(boneData));
		}
		this.#slots = [];
		const slotDataList = skeletonData.getSlots();
		for (const slotData of slotDataList) {
			this.#slots.push(new Skeleton2DSlot(slotData));
		}
		this.#ikConstraints = [];
		const ikConstraintDataList = skeletonData.getIkConstraints();
		for (const ikConstraintData of ikConstraintDataList) {
			this.#ikConstraints.push(new Skeleton2DIkConstraint(ikConstraintData));
		}
		this.#drawOrder = [];
		for (let slotIndex = 0; slotIndex < this.#slots.length; ++slotIndex) {
			this.#drawOrder.push(slotIndex);
		}
		this.#skin = skeletonData.getDefaultSkin();
		this.#dirtyFlags = new System.Uint8Array(this.#bones.length);
	}

	//==============================================================================
	// 자료 반환.
	//==============================================================================
	/**
	 * @returns { object } 뼈대 자료. (Skeleton2DData)
	 */
	getData() {
		return this.#data;
	}

	//==============================================================================
	// 뼈 목록 반환.
	//==============================================================================
	/**
	 * @returns { Skeleton2DBone[] } 뼈 목록. (부모가 앞)
	 */
	getBones() {
		return this.#bones;
	}

	//==============================================================================
	// 슬롯 목록 반환.
	//==============================================================================
	/**
	 * @returns { Skeleton2DSlot[] } 슬롯 목록. (번호 차례)
	 */
	getSlots() {
		return this.#slots;
	}

	//==============================================================================
	// IK 제약 목록 반환.
	//==============================================================================
	/**
	 * @returns { Skeleton2DIkConstraint[] } 제약 목록. (거는 차례)
	 */
	getIkConstraints() {
		return this.#ikConstraints;
	}

	//==============================================================================
	// 그리기 차례 반환. (그리는 차례의 슬롯 번호, 고치면 바로 걸린다)
	//==============================================================================
	/**
	 * @returns { number[] } 그리기 차례.
	 */
	getDrawOrder() {
		return this.#drawOrder;
	}

	//==============================================================================
	// 뼈 찾기. (없으면 null)
	//==============================================================================
	/**
	 * @param { string } boneName 뼈 이름.
	 * @returns { Skeleton2DBone | null } 뼈. (없으면 null)
	 */
	findBone(boneName) {
		const boneIndex = this.findBoneIndex(boneName);
		if (boneIndex < 0) {
			return null;
		}
		return this.#bones[boneIndex];
	}

	//==============================================================================
	// 뼈 번호 찾기. (없으면 -1)
	//==============================================================================
	/**
	 * @param { string } boneName 뼈 이름.
	 * @returns { number } 뼈 번호. (없으면 -1)
	 */
	findBoneIndex(boneName) {
		const skeletonData = this.getData();
		return skeletonData.findBoneIndex(boneName);
	}

	//==============================================================================
	// 슬롯 찾기. (없으면 null)
	//==============================================================================
	/**
	 * @param { string } slotName 슬롯 이름.
	 * @returns { Skeleton2DSlot | null } 슬롯. (없으면 null)
	 */
	findSlot(slotName) {
		const slotIndex = this.findSlotIndex(slotName);
		if (slotIndex < 0) {
			return null;
		}
		return this.#slots[slotIndex];
	}

	//==============================================================================
	// 슬롯 번호 찾기. (없으면 -1)
	//==============================================================================
	/**
	 * @param { string } slotName 슬롯 이름.
	 * @returns { number } 슬롯 번호. (없으면 -1)
	 */
	findSlotIndex(slotName) {
		const skeletonData = this.getData();
		return skeletonData.findSlotIndex(slotName);
	}

	//==============================================================================
	// IK 제약 찾기. (없으면 null)
	//==============================================================================
	/**
	 * @param { string } ikConstraintName 제약 이름.
	 * @returns { Skeleton2DIkConstraint | null } 제약. (없으면 null)
	 */
	findIkConstraint(ikConstraintName) {
		for (const ikConstraint of this.#ikConstraints) {
			const name = ikConstraint.getName();
			if (name === ikConstraintName) {
				return ikConstraint;
			}
		}
		return null;
	}

	//==============================================================================
	// 스킨 고르기. (없는 이름이면 false, 고른 스킨에 없는 붙임은 처음 스킨에서 찾는다)
	//==============================================================================
	/**
	 * @param { string } skinName 스킨 이름.
	 * @returns { boolean } 골랐으면 참.
	 */
	setSkin(skinName) {
		const skeletonData = this.getData();
		const skin = skeletonData.findSkin(skinName);
		if (skin === null) {
			return false;
		}
		this.#skin = skin;
		return true;
	}

	//==============================================================================
	// 고른 스킨 이름 반환. (스킨이 없으면 null)
	//==============================================================================
	/**
	 * @returns { string | null } 스킨 이름.
	 */
	getSkinName() {
		const skin = this.#skin;
		if (skin === null) {
			return null;
		}
		return skin.getName();
	}

	//==============================================================================
	// 붙임 찾기. (고른 스킨, 없으면 처음 스킨에서, 없으면 null)
	//==============================================================================
	/**
	 * @param { number } slotIndex 슬롯 번호.
	 * @param { string | null } attachmentName 붙임 이름.
	 * @returns { object | null } 붙임. (Skeleton2DRegionAttachment 나 Skeleton2DMeshAttachment, 없으면 null)
	 */
	getAttachment(slotIndex, attachmentName) {
		if (attachmentName === null) {
			return null;
		}
		const skin = this.#skin;
		if (skin !== null) {
			const attachment = skin.getAttachment(slotIndex, attachmentName);
			if (attachment !== null) {
				return attachment;
			}
		}
		const skeletonData = this.getData();
		const defaultSkin = skeletonData.getDefaultSkin();
		if (defaultSkin === null || defaultSkin === skin) {
			return null;
		}
		return defaultSkin.getAttachment(slotIndex, attachmentName);
	}

	//==============================================================================
	// 슬롯의 지금 붙임 반환. (없으면 null)
	//==============================================================================
	/**
	 * @param { number } slotIndex 슬롯 번호.
	 * @returns { object | null } 붙임. (없으면 null)
	 */
	getSlotAttachment(slotIndex) {
		const slot = this.#slots[slotIndex];
		const attachmentName = slot.getAttachmentName();
		return this.getAttachment(slotIndex, attachmentName);
	}

	//==============================================================================
	// 슬롯의 붙임 바꾸기. (슬롯이나 붙임이 없으면 false, null 이면 숨긴다)
	//==============================================================================
	/**
	 * @param { string } slotName 슬롯 이름.
	 * @param { string | null } attachmentName 붙임 이름. (null 이면 숨긴다)
	 * @returns { boolean } 바꿨으면 참.
	 */
	setAttachment(slotName, attachmentName) {
		const slotIndex = this.findSlotIndex(slotName);
		if (slotIndex < 0) {
			return false;
		}
		if (attachmentName !== null) {
			const attachment = this.getAttachment(slotIndex, attachmentName);
			if (attachment === null) {
				return false;
			}
		}
		this.#slots[slotIndex].setAttachmentName(attachmentName);
		return true;
	}

	//==============================================================================
	// 모두 처음 자세로. (뼈, 슬롯, 그리기 차례, IK 값)
	//==============================================================================
	setToSetupPose() {
		this.setBonesToSetupPose();
		this.setSlotsToSetupPose();
	}

	//==============================================================================
	// 뼈와 IK 를 처음 자세로.
	//==============================================================================
	setBonesToSetupPose() {
		for (const bone of this.#bones) {
			bone.setToSetupPose();
		}
		for (const ikConstraint of this.#ikConstraints) {
			ikConstraint.setToSetupPose();
		}
	}

	//==============================================================================
	// 슬롯과 그리기 차례를 처음 자세로.
	//==============================================================================
	setSlotsToSetupPose() {
		for (const slot of this.#slots) {
			slot.setToSetupPose();
		}
		const drawOrder = this.#drawOrder;
		for (let orderIndex = 0; orderIndex < drawOrder.length; ++orderIndex) {
			drawOrder[orderIndex] = orderIndex;
		}
	}

	//==============================================================================
	// 지금 자세를 자세 배열로 읽기.
	//==============================================================================
	/**
	 * @param { object } pose 적을 자세. (Skeleton2DPose, 뼈와 슬롯 수가 같아야 한다)
	 */
	readPose(pose) {
		const boneValues = pose.getBoneValues();
		const bones = this.#bones;
		for (let boneIndex = 0; boneIndex < bones.length; ++boneIndex) {
			const bone = bones[boneIndex];
			const offset = boneIndex * SKELETON2D_BONE_VALUE_COUNT;
			boneValues[offset] = bone.getX();
			boneValues[offset + 1] = bone.getY();
			boneValues[offset + 2] = bone.getRotation();
			boneValues[offset + 3] = bone.getScaleX();
			boneValues[offset + 4] = bone.getScaleY();
			boneValues[offset + 5] = bone.getShearX();
			boneValues[offset + 6] = bone.getShearY();
		}
		const slotColors = pose.getSlotColors();
		const slotAttachmentNames = pose.getSlotAttachmentNames();
		const slots = this.#slots;
		for (let slotIndex = 0; slotIndex < slots.length; ++slotIndex) {
			const slot = slots[slotIndex];
			const color = slot.getColor();
			slotColors[slotIndex * 4] = color.red;
			slotColors[slotIndex * 4 + 1] = color.green;
			slotColors[slotIndex * 4 + 2] = color.blue;
			slotColors[slotIndex * 4 + 3] = color.alpha;
			slotAttachmentNames[slotIndex] = slot.getAttachmentName();
		}
		const drawOrder = pose.getDrawOrder();
		const ownDrawOrder = this.#drawOrder;
		for (let orderIndex = 0; orderIndex < ownDrawOrder.length; ++orderIndex) {
			drawOrder[orderIndex] = ownDrawOrder[orderIndex];
		}
	}

	//==============================================================================
	// 자세 배열을 지금 자세로 쓰기.
	//==============================================================================
	/**
	 * @param { object } pose 읽을 자세. (Skeleton2DPose, 뼈와 슬롯 수가 같아야 한다)
	 */
	writePose(pose) {
		const boneValues = pose.getBoneValues();
		const bones = this.#bones;
		for (let boneIndex = 0; boneIndex < bones.length; ++boneIndex) {
			const bone = bones[boneIndex];
			const offset = boneIndex * SKELETON2D_BONE_VALUE_COUNT;
			bone.setPosition(boneValues[offset], boneValues[offset + 1]);
			bone.setRotation(boneValues[offset + 2]);
			bone.setScale(boneValues[offset + 3], boneValues[offset + 4]);
			bone.setShear(boneValues[offset + 5], boneValues[offset + 6]);
		}
		const slotColors = pose.getSlotColors();
		const slotAttachmentNames = pose.getSlotAttachmentNames();
		const slots = this.#slots;
		for (let slotIndex = 0; slotIndex < slots.length; ++slotIndex) {
			const slot = slots[slotIndex];
			const color = slot.getColor();
			color.red = slotColors[slotIndex * 4];
			color.green = slotColors[slotIndex * 4 + 1];
			color.blue = slotColors[slotIndex * 4 + 2];
			color.alpha = slotColors[slotIndex * 4 + 3];
			slot.setAttachmentName(slotAttachmentNames[slotIndex]);
		}
		const drawOrder = pose.getDrawOrder();
		const ownDrawOrder = this.#drawOrder;
		for (let orderIndex = 0; orderIndex < ownDrawOrder.length; ++orderIndex) {
			ownDrawOrder[orderIndex] = drawOrder[orderIndex];
		}
	}

	//==============================================================================
	// 뼈 하나의 월드 행렬 셈. (걸린 회전으로, 부모의 월드 행렬은 셈해 둔 것이어야 한다)
	//==============================================================================
	/**
	 * @param { number } boneIndex 뼈 번호.
	 */
	updateBoneWorldTransform(boneIndex) {
		const bone = this.#bones[boneIndex];
		const appliedRotation = bone.getAppliedRotation();
		const shearX = bone.getShearX();
		const shearY = bone.getShearY();
		const scaleX = bone.getScaleX();
		const scaleY = bone.getScaleY();
		const x = bone.getX();
		const y = bone.getY();
		const xAxisRadian = (appliedRotation + shearX) * DEGREE_TO_RADIAN;
		const yAxisRadian = (appliedRotation + shearY) * DEGREE_TO_RADIAN;
		const localA = System.Math.cos(xAxisRadian) * scaleX;
		const localB = System.Math.sin(xAxisRadian) * scaleX;
		const localC = -System.Math.sin(yAxisRadian) * scaleY;
		const localD = System.Math.cos(yAxisRadian) * scaleY;
		const parentIndex = bone.getParentIndex();
		if (parentIndex < 0) {
			bone.setWorldTransform(localA, localB, localC, localD, x, y);
			return;
		}
		const parent = this.#bones[parentIndex];
		const parentA = parent.getWorldA();
		const parentB = parent.getWorldB();
		const parentC = parent.getWorldC();
		const parentD = parent.getWorldD();
		const worldA = parentA * localA + parentC * localB;
		const worldB = parentB * localA + parentD * localB;
		const worldC = parentA * localC + parentC * localD;
		const worldD = parentB * localC + parentD * localD;
		const worldX = parentA * x + parentC * y + parent.getWorldX();
		const worldY = parentB * x + parentD * y + parent.getWorldY();
		bone.setWorldTransform(worldA, worldB, worldC, worldD, worldX, worldY);
	}

	//==============================================================================
	// 뼈의 월드 회전을 그 값이 되게 걸린 회전 정하기. (부모 행렬을 되돌려 지역 각을 찾는다, 월드 행렬은 셈하지 않는다)
	//==============================================================================
	/**
	 * @param { number } boneIndex 뼈 번호.
	 * @param { number } worldRotation 바라는 월드 회전. (도)
	 */
	setBoneWorldRotation(boneIndex, worldRotation) {
		const bone = this.#bones[boneIndex];
		const parentIndex = bone.getParentIndex();
		let localRotation = worldRotation;
		if (parentIndex >= 0) {
			const parent = this.#bones[parentIndex];
			const parentA = parent.getWorldA();
			const parentB = parent.getWorldB();
			const parentC = parent.getWorldC();
			const parentD = parent.getWorldD();
			const determinant = parentA * parentD - parentB * parentC;
			const radian = worldRotation * DEGREE_TO_RADIAN;
			const directionX = System.Math.cos(radian);
			const directionY = System.Math.sin(radian);
			if (determinant !== 0) {
				const localDirectionX = (parentD * directionX - parentC * directionY) / determinant;
				const localDirectionY = (parentA * directionY - parentB * directionX) / determinant;
				localRotation = System.Math.atan2(localDirectionY, localDirectionX) * RADIAN_TO_DEGREE;
			}
			else {
				localRotation = worldRotation - parent.getWorldRotation();
			}
		}
		const scaleX = bone.getScaleX();
		if (scaleX < 0) {
			localRotation += 180;
		}
		const shearX = bone.getShearX();
		bone.setAppliedRotation(localRotation - shearX);
	}

	//==============================================================================
	// 뼈 하나와 그 자손의 월드 행렬 다시 셈. (그 뼈는 셈해 두었어야 한다)
	//==============================================================================
	/**
	 * @param { number } rootBoneIndex 다시 셈한 뼈 번호.
	 */
	updateDescendantWorldTransforms(rootBoneIndex) {
		const dirtyFlags = this.#dirtyFlags;
		dirtyFlags.fill(0);
		dirtyFlags[rootBoneIndex] = 1;
		const bones = this.#bones;
		for (let boneIndex = rootBoneIndex + 1; boneIndex < bones.length; ++boneIndex) {
			const parentIndex = bones[boneIndex].getParentIndex();
			if (parentIndex >= 0 && dirtyFlags[parentIndex] === 1) {
				this.updateBoneWorldTransform(boneIndex);
				dirtyFlags[boneIndex] = 1;
			}
		}
	}

	//==============================================================================
	// IK 제약 하나 걸기.
	//==============================================================================
	/**
	 * @param { Skeleton2DIkConstraint } ikConstraint 걸 제약.
	 */
	applyIkConstraint(ikConstraint) {
		const mix = ikConstraint.getMix();
		if (mix <= 0) {
			return;
		}
		const ikConstraintData = ikConstraint.getData();
		const boneIndices = ikConstraintData.getBoneIndices();
		const targetIndex = ikConstraintData.getTargetIndex();
		const bones = this.#bones;
		const target = bones[targetIndex];
		const targetX = target.getWorldX();
		const targetY = target.getWorldY();

		// 뼈 하나: x 축이 목표를 보게 돌린다.
		if (boneIndices.length === 1) {
			const boneIndex = boneIndices[0];
			const bone = bones[boneIndex];
			const currentRotation = bone.getWorldRotation();
			let desiredRotation = System.Math.atan2(targetY - bone.getWorldY(), targetX - bone.getWorldX()) * RADIAN_TO_DEGREE;
			if (bone.getScaleX() < 0) {
				desiredRotation += 180;
			}
			const deltaRotation = wrapDegree(desiredRotation - currentRotation) * mix;
			this.setBoneWorldRotation(boneIndex, currentRotation + deltaRotation);
			this.updateBoneWorldTransform(boneIndex);
			this.updateDescendantWorldTransforms(boneIndex);
			return;
		}

		// 뼈 둘: 부모를 돌려 팔꿈치(자식 뿌리)를 놓고, 자식이 목표를 보게 돌린다.
		const parentIndex = boneIndices[0];
		const childIndex = boneIndices[1];
		const parent = bones[parentIndex];
		const child = bones[childIndex];
		const parentX = parent.getWorldX();
		const parentY = parent.getWorldY();
		const childLengthWorld = child.getData().getLength() * child.getWorldScaleX();
		const upperLength = System.Math.hypot(child.getWorldX() - parentX, child.getWorldY() - parentY);
		const targetDistance = System.Math.hypot(targetX - parentX, targetY - parentY);
		const currentElbowRotation = System.Math.atan2(child.getWorldY() - parentY, child.getWorldX() - parentX) * RADIAN_TO_DEGREE;
		const targetRotation = System.Math.atan2(targetY - parentY, targetX - parentX) * RADIAN_TO_DEGREE;
		let desiredElbowRotation = targetRotation;
		if (upperLength > IK_EPSILON && childLengthWorld > IK_EPSILON && targetDistance > IK_EPSILON) {
			const cosine = (upperLength * upperLength + targetDistance * targetDistance - childLengthWorld * childLengthWorld) / (2 * upperLength * targetDistance);
			const clampedCosine = System.Math.min(System.Math.max(cosine, -1), 1);
			const elbowAngle = System.Math.acos(clampedCosine) * RADIAN_TO_DEGREE;
			let isBendPositive = ikConstraint.isBendPositive();
			const grandparentIndex = parent.getParentIndex();
			if (grandparentIndex >= 0) {
				const grandparent = bones[grandparentIndex];
				const grandparentDeterminant = grandparent.getWorldA() * grandparent.getWorldD() - grandparent.getWorldB() * grandparent.getWorldC();
				if (grandparentDeterminant < 0) {
					isBendPositive = !isBendPositive;
				}
			}
			desiredElbowRotation = isBendPositive ? targetRotation - elbowAngle : targetRotation + elbowAngle;
		}
		const parentDeltaRotation = wrapDegree(desiredElbowRotation - currentElbowRotation) * mix;
		const parentWorldRotation = parent.getWorldRotation();
		this.setBoneWorldRotation(parentIndex, parentWorldRotation + parentDeltaRotation);
		this.updateBoneWorldTransform(parentIndex);
		this.updateBoneWorldTransform(childIndex);

		const childWorldRotation = child.getWorldRotation();
		let desiredChildRotation = System.Math.atan2(targetY - child.getWorldY(), targetX - child.getWorldX()) * RADIAN_TO_DEGREE;
		if (child.getScaleX() < 0) {
			desiredChildRotation += 180;
		}
		const childDeltaRotation = wrapDegree(desiredChildRotation - childWorldRotation) * mix;
		this.setBoneWorldRotation(childIndex, childWorldRotation + childDeltaRotation);
		this.updateBoneWorldTransform(childIndex);
		this.updateDescendantWorldTransforms(parentIndex);
	}

	//==============================================================================
	// 월드 행렬 셈. (지역 값으로 부모부터 셈한 뒤 IK 를 차례로 건다)
	//==============================================================================
	updateWorldTransform() {
		const bones = this.#bones;
		for (let boneIndex = 0; boneIndex < bones.length; ++boneIndex) {
			const bone = bones[boneIndex];
			const rotation = bone.getRotation();
			bone.setAppliedRotation(rotation);
			this.updateBoneWorldTransform(boneIndex);
		}
		for (const ikConstraint of this.#ikConstraints) {
			this.applyIkConstraint(ikConstraint);
		}
	}

	//==============================================================================
	// 슬롯 붙임의 꼭짓점 월드 자리 셈. (뼈대 기준, updateWorldTransform 뒤에 부른다)
	// - 네모는 왼쪽 위부터 시계 방향 넷, 메시는 꼭짓점 차례로 x, y 를 적는다.
	//==============================================================================
	/**
	 * @param { number } slotIndex 슬롯 번호.
	 * @param { Float64Array | number[] } output 꼭짓점마다 x, y 를 적을 곳. (붙임 꼭짓점 수 x 2 이상)
	 * @param { number } frameWidth 크기가 0 인 네모 붙임에 쓸 조각 너비.
	 * @param { number } frameHeight 크기가 0 인 네모 붙임에 쓸 조각 높이.
	 * @returns { number } 적은 꼭짓점 수. (붙임이 없으면 0)
	 */
	computeAttachmentVertices(slotIndex, output, frameWidth, frameHeight) {
		const attachment = this.getSlotAttachment(slotIndex);
		if (attachment === null) {
			return 0;
		}
		const slot = this.#slots[slotIndex];
		const bones = this.#bones;
		const bone = bones[slot.getBoneIndex()];
		const boneA = bone.getWorldA();
		const boneB = bone.getWorldB();
		const boneC = bone.getWorldC();
		const boneD = bone.getWorldD();
		const boneX = bone.getWorldX();
		const boneY = bone.getWorldY();
		const attachmentType = attachment.getAttachmentType();

		if (attachmentType === Skeleton2DAttachmentType.region) {
			const width = attachment.getWidth() > 0 ? attachment.getWidth() : frameWidth;
			const height = attachment.getHeight() > 0 ? attachment.getHeight() : frameHeight;
			const radian = attachment.getRotation() * DEGREE_TO_RADIAN;
			const cosine = System.Math.cos(radian);
			const sine = System.Math.sin(radian);
			const scaleX = attachment.getScaleX();
			const scaleY = attachment.getScaleY();
			const localA = cosine * scaleX;
			const localB = sine * scaleX;
			const localC = -sine * scaleY;
			const localD = cosine * scaleY;
			const attachmentX = attachment.getX();
			const attachmentY = attachment.getY();
			const left = -attachment.getPivotX() * width;
			const top = -attachment.getPivotY() * height;
			const cornerValues = [left, top, left + width, top, left + width, top + height, left, top + height];
			for (let cornerIndex = 0; cornerIndex < 4; ++cornerIndex) {
				const cornerX = cornerValues[cornerIndex * 2];
				const cornerY = cornerValues[cornerIndex * 2 + 1];
				const attachedX = localA * cornerX + localC * cornerY + attachmentX;
				const attachedY = localB * cornerX + localD * cornerY + attachmentY;
				output[cornerIndex * 2] = boneA * attachedX + boneC * attachedY + boneX;
				output[cornerIndex * 2 + 1] = boneB * attachedX + boneD * attachedY + boneY;
			}
			return 4;
		}

		const vertexCount = attachment.getVertexCount();
		if (!attachment.isWeighted()) {
			const vertices = attachment.getVertices();
			for (let vertexIndex = 0; vertexIndex < vertexCount; ++vertexIndex) {
				const localX = vertices[vertexIndex * 2];
				const localY = vertices[vertexIndex * 2 + 1];
				output[vertexIndex * 2] = boneA * localX + boneC * localY + boneX;
				output[vertexIndex * 2 + 1] = boneB * localX + boneD * localY + boneY;
			}
			return vertexCount;
		}

		const influenceCounts = attachment.getInfluenceCounts();
		const influenceBoneIndices = attachment.getInfluenceBoneIndices();
		const influenceValues = attachment.getInfluenceValues();
		let influenceIndex = 0;
		for (let vertexIndex = 0; vertexIndex < vertexCount; ++vertexIndex) {
			let worldX = 0;
			let worldY = 0;
			const influenceCount = influenceCounts[vertexIndex];
			for (let countIndex = 0; countIndex < influenceCount; ++countIndex) {
				const influenceBone = bones[influenceBoneIndices[influenceIndex]];
				const bindX = influenceValues[influenceIndex * 3];
				const bindY = influenceValues[influenceIndex * 3 + 1];
				const weight = influenceValues[influenceIndex * 3 + 2];
				worldX += (influenceBone.getWorldA() * bindX + influenceBone.getWorldC() * bindY + influenceBone.getWorldX()) * weight;
				worldY += (influenceBone.getWorldB() * bindX + influenceBone.getWorldD() * bindY + influenceBone.getWorldY()) * weight;
				influenceIndex += 1;
			}
			output[vertexIndex * 2] = worldX;
			output[vertexIndex * 2 + 1] = worldY;
		}
		return vertexCount;
	}
}
