//==============================================================================
// 2D 뼈대 자료. (뼈, 슬롯, IK, 스킨과 붙임, 클립의 처음 자세 자료, 여러 인스턴스가 나눠 쓴다)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 좌표는 엔진과 같이 y 가 아래로 커진다. 회전과 기울임은 도 단위이고 양수가 화면에서 시계 방향이다.
// - 뼈의 지역 행렬: x 축 = (cos(회전 + 기울임 x), sin(회전 + 기울임 x)) x 크기 x, y 축 = (-sin(회전 + 기울임 y), cos(회전 + 기울임 y)) x 크기 y.
//   월드 행렬은 부모 월드 행렬 x 지역 행렬이다. (이동, 회전, 크기, 기울임 모두 물려받는다)
// - 뼈는 부모가 앞에 오는 차례여야 한다. (읽기가 확인한다)
// - 읽는 꼴 둘: 엔진 자체 JSON(createFromJson)과 DragonBones 5.x JSON(createFromDragonBones).
//   Spine 형식은 읽지 않는다. Spine 런타임 라이선스가 그 런타임을 넣은 제품의 사용자마다 Spine 편집기 라이선스를 요구해서다.
//==============================================================================

/**
 * @example <caption>엔진 JSON 으로 자료를 지어 뼈와 슬롯 찾기</caption>
 * import { Experimental } from "./build/vanilla.js";
 *
 * const skeletonData = Experimental.Skeleton2DData.createFromJson({
 * 	name: "hero",
 * 	bones: [{ name: "root" }, { name: "body", parent: "root", y: -40, length: 30 }],
 * 	slots: [{ name: "body", bone: "body", attachment: "body" }],
 * 	skins: [{ name: "default", attachments: { body: { body: { type: "region", frame: "body", width: 20, height: 40 } } } }],
 * });
 * const bodyBone = skeletonData.findBone("body");
 * const defaultSkin = skeletonData.getDefaultSkin();
 * const attachment = defaultSkin.getAttachment(0, "body");
 * console.log(skeletonData.getName(), bodyBone.getY(), attachment.getFrameName());
 */


//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";
import { Color } from "../../base/color.js";
import { readSkeleton2DJson } from "./skeleton2djsonreader.js";
import { readDragonBonesJson } from "./dragonbonesreader.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 처음 스킨 이름.
const DEFAULT_SKIN_NAME = "default";

// 네모 붙임의 꼭짓점 UV. (조각 안 0 ~ 1, 왼쪽 위, 오른쪽 위, 오른쪽 아래, 왼쪽 아래)
const REGION_UVS = [0, 0, 1, 0, 1, 1, 0, 1];

// 네모 붙임의 삼각형 둘.
const REGION_TRIANGLES = [0, 1, 2, 0, 2, 3];


//==============================================================================
// 붙임 종류.
//==============================================================================
export const Skeleton2DAttachmentType = {
	region: "region", // 네모.
	mesh: "mesh", // 메시.
};


//==============================================================================
// 뼈 자료. (이름, 부모, 처음 지역 값, 길이)
//==============================================================================
/**
 * @example <caption>뼈 자료 하나 만들기</caption>
 * import { Experimental } from "./build/vanilla.js";
 *
 * const boneData = new Experimental.Skeleton2DBoneData(1, "arm", 0);
 * boneData.setTransform(10, 0, 30, 1, 1, 0, 0);
 * boneData.setLength(40);
 * console.log(boneData.getName(), boneData.getParentIndex(), boneData.getRotation(), boneData.getLength());
 */
export class Skeleton2DBoneData extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #index;
	/** @private @type { string } */ #name;
	/** @private @type { number } */ #parentIndex;
	/** @private @type { number } */ #x;
	/** @private @type { number } */ #y;
	/** @private @type { number } */ #rotation;
	/** @private @type { number } */ #scaleX;
	/** @private @type { number } */ #scaleY;
	/** @private @type { number } */ #shearX;
	/** @private @type { number } */ #shearY;
	/** @private @type { number } */ #length;

	//==============================================================================
	// 생성. (지역 값은 이동 0, 회전 0, 크기 1, 기울임 0, 길이 0)
	//==============================================================================
	/**
	 * @param { number } index 뼈 번호.
	 * @param { string } name 뼈 이름.
	 * @param { number } parentIndex 부모 뼈 번호. (뿌리는 -1)
	 */
	constructor(index, name, parentIndex) {
		super();
		this.#index = index;
		this.#name = name;
		this.#parentIndex = parentIndex;
		this.#x = 0;
		this.#y = 0;
		this.#rotation = 0;
		this.#scaleX = 1;
		this.#scaleY = 1;
		this.#shearX = 0;
		this.#shearY = 0;
		this.#length = 0;
	}

	//==============================================================================
	// 번호 반환.
	//==============================================================================
	/**
	 * @returns { number } 뼈 번호.
	 */
	getIndex() {
		return this.#index;
	}

	//==============================================================================
	// 이름 반환.
	//==============================================================================
	/**
	 * @returns { string } 뼈 이름.
	 */
	getName() {
		return this.#name;
	}

	//==============================================================================
	// 부모 번호 반환.
	//==============================================================================
	/**
	 * @returns { number } 부모 뼈 번호. (뿌리는 -1)
	 */
	getParentIndex() {
		return this.#parentIndex;
	}

	//==============================================================================
	// 처음 지역 값 설정.
	//==============================================================================
	/**
	 * @param { number } x 부모 기준 x.
	 * @param { number } y 부모 기준 y.
	 * @param { number } rotation 회전. (도)
	 * @param { number } scaleX 크기 x.
	 * @param { number } scaleY 크기 y.
	 * @param { number } shearX 기울임 x. (도, x 축만 더 돈다)
	 * @param { number } shearY 기울임 y. (도, y 축만 더 돈다)
	 */
	setTransform(x, y, rotation, scaleX, scaleY, shearX, shearY) {
		this.#x = x;
		this.#y = y;
		this.#rotation = rotation;
		this.#scaleX = scaleX;
		this.#scaleY = scaleY;
		this.#shearX = shearX;
		this.#shearY = shearY;
	}

	//==============================================================================
	// x 반환.
	//==============================================================================
	/**
	 * @returns { number } 부모 기준 x.
	 */
	getX() {
		return this.#x;
	}

	//==============================================================================
	// y 반환.
	//==============================================================================
	/**
	 * @returns { number } 부모 기준 y.
	 */
	getY() {
		return this.#y;
	}

	//==============================================================================
	// 회전 반환.
	//==============================================================================
	/**
	 * @returns { number } 회전. (도)
	 */
	getRotation() {
		return this.#rotation;
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
	// 길이 설정. (IK 가 끝점을 셈하고, 기즈모가 뼈를 그린다)
	//==============================================================================
	/**
	 * @param { number } length 뼈 길이. (지역 x 축 쪽)
	 */
	setLength(length) {
		this.#length = length;
	}

	//==============================================================================
	// 길이 반환.
	//==============================================================================
	/**
	 * @returns { number } 뼈 길이.
	 */
	getLength() {
		return this.#length;
	}
}


//==============================================================================
// 슬롯 자료. (그림이 붙는 자리: 뼈, 처음 색, 처음 붙임, 섞기 방식)
//==============================================================================
/**
 * @example <caption>슬롯 자료 하나 만들기</caption>
 * import { Experimental, Color } from "./build/vanilla.js";
 *
 * const slotData = new Experimental.Skeleton2DSlotData(0, "body", 1);
 * slotData.setColor(new Color(1, 0.5, 0.5, 1));
 * slotData.setAttachmentName("body");
 * slotData.setBlendMode("lighter");
 * console.log(slotData.getName(), slotData.getBoneIndex(), slotData.getAttachmentName(), slotData.getBlendMode());
 */
export class Skeleton2DSlotData extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #index;
	/** @private @type { string } */ #name;
	/** @private @type { number } */ #boneIndex;
	/** @private @type { Color } */ #color;
	/** @private @type { string | null } */ #attachmentName;
	/** @private @type { string } */ #blendMode;

	//==============================================================================
	// 생성. (흰색, 붙임 없음, 섞기 source-over)
	//==============================================================================
	/**
	 * @param { number } index 슬롯 번호. (처음 그리기 차례)
	 * @param { string } name 슬롯 이름.
	 * @param { number } boneIndex 붙는 뼈 번호.
	 */
	constructor(index, name, boneIndex) {
		super();
		this.#index = index;
		this.#name = name;
		this.#boneIndex = boneIndex;
		this.#color = new Color(1, 1, 1, 1);
		this.#attachmentName = null;
		this.#blendMode = "source-over";
	}

	//==============================================================================
	// 번호 반환.
	//==============================================================================
	/**
	 * @returns { number } 슬롯 번호.
	 */
	getIndex() {
		return this.#index;
	}

	//==============================================================================
	// 이름 반환.
	//==============================================================================
	/**
	 * @returns { string } 슬롯 이름.
	 */
	getName() {
		return this.#name;
	}

	//==============================================================================
	// 뼈 번호 반환.
	//==============================================================================
	/**
	 * @returns { number } 붙는 뼈 번호.
	 */
	getBoneIndex() {
		return this.#boneIndex;
	}

	//==============================================================================
	// 처음 색 설정. (그림에 곱한다)
	//==============================================================================
	/**
	 * @param { Color } color 처음 색.
	 */
	setColor(color) {
		this.#color = color;
	}

	//==============================================================================
	// 처음 색 반환.
	//==============================================================================
	/**
	 * @returns { Color } 처음 색.
	 */
	getColor() {
		return this.#color;
	}

	//==============================================================================
	// 처음 붙임 이름 설정.
	//==============================================================================
	/**
	 * @param { string | null } attachmentName 처음 붙임 이름. (null 이면 비운다)
	 */
	setAttachmentName(attachmentName) {
		this.#attachmentName = attachmentName;
	}

	//==============================================================================
	// 처음 붙임 이름 반환.
	//==============================================================================
	/**
	 * @returns { string | null } 처음 붙임 이름. (없으면 null)
	 */
	getAttachmentName() {
		return this.#attachmentName;
	}

	//==============================================================================
	// 섞기 방식 설정. (Graphic.setBlendMode 의 이름)
	//==============================================================================
	/**
	 * @param { string } blendMode 섞기 방식. ("source-over", "lighter", "multiply", "screen" 같은)
	 */
	setBlendMode(blendMode) {
		this.#blendMode = blendMode;
	}

	//==============================================================================
	// 섞기 방식 반환.
	//==============================================================================
	/**
	 * @returns { string } 섞기 방식.
	 */
	getBlendMode() {
		return this.#blendMode;
	}
}


//==============================================================================
// IK 제약 자료. (뼈 하나는 끝을 목표로 돌리고, 뼈 둘(부모, 자식)은 두 뼈 IK 로 끝이 목표에 닿게 꺾는다)
//==============================================================================
/**
 * @example <caption>두 뼈 IK 자료 하나 만들기</caption>
 * import { Experimental } from "./build/vanilla.js";
 *
 * const ikConstraintData = new Experimental.Skeleton2DIkConstraintData(0, "armIk", [1, 2], 3);
 * ikConstraintData.setBendPositive(false);
 * ikConstraintData.setMix(0.5);
 * console.log(ikConstraintData.getBoneIndices(), ikConstraintData.getTargetIndex(), ikConstraintData.isBendPositive(), ikConstraintData.getMix());
 */
export class Skeleton2DIkConstraintData extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #index;
	/** @private @type { string } */ #name;
	/** @private @type { number[] } */ #boneIndices;
	/** @private @type { number } */ #targetIndex;
	/** @private @type { boolean } */ #isBendPositive;
	/** @private @type { number } */ #mix;

	//==============================================================================
	// 생성. (꺾임은 양의 쪽, 세기 1)
	//==============================================================================
	/**
	 * @param { number } index 제약 번호. (거는 차례)
	 * @param { string } name 제약 이름.
	 * @param { number[] } boneIndices 움직일 뼈 번호. (하나, 또는 부모와 그 자식 둘)
	 * @param { number } targetIndex 목표 뼈 번호.
	 */
	constructor(index, name, boneIndices, targetIndex) {
		super();
		this.#index = index;
		this.#name = name;
		this.#boneIndices = boneIndices;
		this.#targetIndex = targetIndex;
		this.#isBendPositive = true;
		this.#mix = 1;
	}

	//==============================================================================
	// 번호 반환.
	//==============================================================================
	/**
	 * @returns { number } 제약 번호.
	 */
	getIndex() {
		return this.#index;
	}

	//==============================================================================
	// 이름 반환.
	//==============================================================================
	/**
	 * @returns { string } 제약 이름.
	 */
	getName() {
		return this.#name;
	}

	//==============================================================================
	// 움직일 뼈 번호 반환.
	//==============================================================================
	/**
	 * @returns { number[] } 움직일 뼈 번호. (하나, 또는 부모와 자식 둘)
	 */
	getBoneIndices() {
		return this.#boneIndices;
	}

	//==============================================================================
	// 목표 뼈 번호 반환.
	//==============================================================================
	/**
	 * @returns { number } 목표 뼈 번호.
	 */
	getTargetIndex() {
		return this.#targetIndex;
	}

	//==============================================================================
	// 꺾임 쪽 설정. (참이면 자식이 부모에 대해 양의 쪽, 화면에서 시계 방향으로 꺾인다)
	//==============================================================================
	/**
	 * @param { boolean } isBendPositive 양의 쪽으로 꺾으면 참.
	 */
	setBendPositive(isBendPositive) {
		this.#isBendPositive = isBendPositive;
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
	// 세기 설정.
	//==============================================================================
	/**
	 * @param { number } mix 세기. (0 이면 걸지 않고 1 이면 끝까지)
	 */
	setMix(mix) {
		this.#mix = mix;
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
}


//==============================================================================
// 네모 붙임. (아틀라스 조각 하나를 뼈에 붙인 네모, 축점을 뼈 기준 자리에 둔다)
//==============================================================================
/**
 * @example <caption>네모 붙임 하나 만들기</caption>
 * import { Experimental } from "./build/vanilla.js";
 *
 * const regionAttachment = new Experimental.Skeleton2DRegionAttachment("head", "head.png");
 * regionAttachment.setTransform(0, -10, 0, 1, 1);
 * regionAttachment.setSize(32, 32);
 * regionAttachment.setPivot(0.5, 1);
 * console.log(regionAttachment.getAttachmentType(), regionAttachment.getFrameName(), regionAttachment.getVertexCount());
 */
export class Skeleton2DRegionAttachment extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #name;
	/** @private @type { string } */ #frameName;
	/** @private @type { number } */ #x;
	/** @private @type { number } */ #y;
	/** @private @type { number } */ #rotation;
	/** @private @type { number } */ #scaleX;
	/** @private @type { number } */ #scaleY;
	/** @private @type { number } */ #width;
	/** @private @type { number } */ #height;
	/** @private @type { number } */ #pivotX;
	/** @private @type { number } */ #pivotY;

	//==============================================================================
	// 생성. (뼈 자리에 가운데를 두고, 크기는 조각 크기)
	//==============================================================================
	/**
	 * @param { string } name 붙임 이름.
	 * @param { string } frameName 아틀라스 조각 이름.
	 */
	constructor(name, frameName) {
		super();
		this.#name = name;
		this.#frameName = frameName;
		this.#x = 0;
		this.#y = 0;
		this.#rotation = 0;
		this.#scaleX = 1;
		this.#scaleY = 1;
		this.#width = 0;
		this.#height = 0;
		this.#pivotX = 0.5;
		this.#pivotY = 0.5;
	}

	//==============================================================================
	// 종류 반환.
	//==============================================================================
	/**
	 * @returns { string } Skeleton2DAttachmentType.region.
	 */
	getAttachmentType() {
		return Skeleton2DAttachmentType.region;
	}

	//==============================================================================
	// 이름 반환.
	//==============================================================================
	/**
	 * @returns { string } 붙임 이름.
	 */
	getName() {
		return this.#name;
	}

	//==============================================================================
	// 조각 이름 반환.
	//==============================================================================
	/**
	 * @returns { string } 아틀라스 조각 이름.
	 */
	getFrameName() {
		return this.#frameName;
	}

	//==============================================================================
	// 뼈 기준 변환 설정.
	//==============================================================================
	/**
	 * @param { number } x 뼈 기준 x. (축점이 올 자리)
	 * @param { number } y 뼈 기준 y.
	 * @param { number } rotation 회전. (도)
	 * @param { number } scaleX 크기 x.
	 * @param { number } scaleY 크기 y.
	 */
	setTransform(x, y, rotation, scaleX, scaleY) {
		this.#x = x;
		this.#y = y;
		this.#rotation = rotation;
		this.#scaleX = scaleX;
		this.#scaleY = scaleY;
	}

	//==============================================================================
	// x 반환.
	//==============================================================================
	/**
	 * @returns { number } 뼈 기준 x.
	 */
	getX() {
		return this.#x;
	}

	//==============================================================================
	// y 반환.
	//==============================================================================
	/**
	 * @returns { number } 뼈 기준 y.
	 */
	getY() {
		return this.#y;
	}

	//==============================================================================
	// 회전 반환.
	//==============================================================================
	/**
	 * @returns { number } 회전. (도)
	 */
	getRotation() {
		return this.#rotation;
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
	// 크기 설정. (0 이면 조각 크기를 쓴다)
	//==============================================================================
	/**
	 * @param { number } width 너비.
	 * @param { number } height 높이.
	 */
	setSize(width, height) {
		this.#width = width;
		this.#height = height;
	}

	//==============================================================================
	// 너비 반환.
	//==============================================================================
	/**
	 * @returns { number } 너비. (0 이면 조각 너비)
	 */
	getWidth() {
		return this.#width;
	}

	//==============================================================================
	// 높이 반환.
	//==============================================================================
	/**
	 * @returns { number } 높이. (0 이면 조각 높이)
	 */
	getHeight() {
		return this.#height;
	}

	//==============================================================================
	// 축점 설정. (네모 안의 몫, 왼쪽 위 0, 오른쪽 아래 1)
	//==============================================================================
	/**
	 * @param { number } pivotX 축점 x 몫.
	 * @param { number } pivotY 축점 y 몫.
	 */
	setPivot(pivotX, pivotY) {
		this.#pivotX = pivotX;
		this.#pivotY = pivotY;
	}

	//==============================================================================
	// 축점 x 반환.
	//==============================================================================
	/**
	 * @returns { number } 축점 x 몫.
	 */
	getPivotX() {
		return this.#pivotX;
	}

	//==============================================================================
	// 축점 y 반환.
	//==============================================================================
	/**
	 * @returns { number } 축점 y 몫.
	 */
	getPivotY() {
		return this.#pivotY;
	}

	//==============================================================================
	// 꼭짓점 UV 반환. (조각 안 0 ~ 1, 왼쪽 위부터 시계 방향 넷)
	//==============================================================================
	/**
	 * @returns { number[] } 꼭짓점 UV.
	 */
	getUvs() {
		return REGION_UVS;
	}

	//==============================================================================
	// 삼각형 꼭짓점 번호 반환.
	//==============================================================================
	/**
	 * @returns { number[] } 삼각형 둘의 꼭짓점 번호.
	 */
	getTriangles() {
		return REGION_TRIANGLES;
	}

	//==============================================================================
	// 꼭짓점 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 4.
	 */
	getVertexCount() {
		return 4;
	}
}


//==============================================================================
// 메시 붙임. (아틀라스 조각을 삼각형 메시로, 무게가 없으면 슬롯 뼈를 따르고 있으면 뼈 여럿의 무게로 꼭짓점을 옮긴다)
// - 무게 없는 꼭짓점은 슬롯 뼈 기준 자리다.
// - 무게 있는 꼭짓점은 꼭짓점마다 영향 수와, 영향마다 뼈 번호와 (그 뼈 기준 묶은 자리 x, y, 무게) 다.
//   월드 자리 = Σ 무게 x (뼈 월드 행렬 x 묶은 자리). (선형 블렌드 스키닝)
//==============================================================================
/**
 * @example <caption>무게 있는 네모 메시 하나 만들기</caption>
 * import { Experimental } from "./build/vanilla.js";
 *
 * const meshAttachment = new Experimental.Skeleton2DMeshAttachment("cape", "cape.png");
 * meshAttachment.setGeometry([0, 0, 1, 0, 1, 1, 0, 1], [0, 1, 2, 0, 2, 3]);
 * meshAttachment.setWeights([1, 1, 1, 1], [0, 0, 1, 1], [-5, 0, 1, 5, 0, 1, 5, 10, 1, -5, 10, 1]);
 * console.log(meshAttachment.getVertexCount(), meshAttachment.isWeighted(), meshAttachment.getTriangles().length);
 */
export class Skeleton2DMeshAttachment extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #name;
	/** @private @type { string } */ #frameName;
	/** @private @type { number[] } */ #uvs;
	/** @private @type { number[] } */ #triangles;
	/** @private @type { number[] } */ #vertices;
	/** @private @type { number[] } */ #influenceCounts;
	/** @private @type { number[] } */ #influenceBoneIndices;
	/** @private @type { number[] } */ #influenceValues;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { string } name 붙임 이름.
	 * @param { string } frameName 아틀라스 조각 이름.
	 */
	constructor(name, frameName) {
		super();
		this.#name = name;
		this.#frameName = frameName;
		this.#uvs = [];
		this.#triangles = [];
		this.#vertices = [];
		this.#influenceCounts = [];
		this.#influenceBoneIndices = [];
		this.#influenceValues = [];
	}

	//==============================================================================
	// 종류 반환.
	//==============================================================================
	/**
	 * @returns { string } Skeleton2DAttachmentType.mesh.
	 */
	getAttachmentType() {
		return Skeleton2DAttachmentType.mesh;
	}

	//==============================================================================
	// 이름 반환.
	//==============================================================================
	/**
	 * @returns { string } 붙임 이름.
	 */
	getName() {
		return this.#name;
	}

	//==============================================================================
	// 조각 이름 반환.
	//==============================================================================
	/**
	 * @returns { string } 아틀라스 조각 이름.
	 */
	getFrameName() {
		return this.#frameName;
	}

	//==============================================================================
	// UV 와 삼각형 설정.
	//==============================================================================
	/**
	 * @param { number[] } uvs 꼭짓점마다 u, v. (조각 안 0 ~ 1)
	 * @param { number[] } triangles 삼각형마다 꼭짓점 번호 셋.
	 */
	setGeometry(uvs, triangles) {
		this.#uvs = uvs;
		this.#triangles = triangles;
	}

	//==============================================================================
	// UV 반환.
	//==============================================================================
	/**
	 * @returns { number[] } 꼭짓점마다 u, v.
	 */
	getUvs() {
		return this.#uvs;
	}

	//==============================================================================
	// 삼각형 반환.
	//==============================================================================
	/**
	 * @returns { number[] } 삼각형마다 꼭짓점 번호 셋.
	 */
	getTriangles() {
		return this.#triangles;
	}

	//==============================================================================
	// 꼭짓점 수 반환. (UV 수로 센다)
	//==============================================================================
	/**
	 * @returns { number } 꼭짓점 수.
	 */
	getVertexCount() {
		return System.Math.floor(this.#uvs.length / 2);
	}

	//==============================================================================
	// 무게 없는 꼭짓점 설정. (슬롯 뼈 기준 x, y, 무게는 지운다)
	//==============================================================================
	/**
	 * @param { number[] } vertices 꼭짓점마다 x, y.
	 */
	setVertices(vertices) {
		this.#vertices = vertices;
		this.#influenceCounts = [];
		this.#influenceBoneIndices = [];
		this.#influenceValues = [];
	}

	//==============================================================================
	// 무게 없는 꼭짓점 반환.
	//==============================================================================
	/**
	 * @returns { number[] } 꼭짓점마다 x, y. (무게 있는 메시는 빈 배열)
	 */
	getVertices() {
		return this.#vertices;
	}

	//==============================================================================
	// 무게 설정. (무게 없는 꼭짓점은 지운다)
	//==============================================================================
	/**
	 * @param { number[] } influenceCounts 꼭짓점마다 영향 뼈 수.
	 * @param { number[] } influenceBoneIndices 영향마다 뼈 번호.
	 * @param { number[] } influenceValues 영향마다 그 뼈 기준 묶은 자리 x, y 와 무게.
	 */
	setWeights(influenceCounts, influenceBoneIndices, influenceValues) {
		this.#vertices = [];
		this.#influenceCounts = influenceCounts;
		this.#influenceBoneIndices = influenceBoneIndices;
		this.#influenceValues = influenceValues;
	}

	//==============================================================================
	// 무게가 있는지.
	//==============================================================================
	/**
	 * @returns { boolean } 무게로 옮기면 참.
	 */
	isWeighted() {
		return this.#influenceCounts.length > 0;
	}

	//==============================================================================
	// 꼭짓점마다 영향 수 반환.
	//==============================================================================
	/**
	 * @returns { number[] } 꼭짓점마다 영향 뼈 수.
	 */
	getInfluenceCounts() {
		return this.#influenceCounts;
	}

	//==============================================================================
	// 영향마다 뼈 번호 반환.
	//==============================================================================
	/**
	 * @returns { number[] } 영향마다 뼈 번호.
	 */
	getInfluenceBoneIndices() {
		return this.#influenceBoneIndices;
	}

	//==============================================================================
	// 영향마다 묶은 자리와 무게 반환.
	//==============================================================================
	/**
	 * @returns { number[] } 영향마다 x, y, 무게.
	 */
	getInfluenceValues() {
		return this.#influenceValues;
	}
}


//==============================================================================
// 스킨. (슬롯마다 이름 붙은 붙임 묶음, 옷이나 무기 바꾸기 자리)
//==============================================================================
/**
 * @example <caption>스킨에 붙임을 넣고 찾기</caption>
 * import { Experimental } from "./build/vanilla.js";
 *
 * const skin = new Experimental.Skeleton2DSkin("armor");
 * const regionAttachment = new Experimental.Skeleton2DRegionAttachment("helmet", "helmet.png");
 * skin.setAttachment(0, "head", regionAttachment);
 * const foundAttachment = skin.getAttachment(0, "head");
 * console.log(skin.getName(), foundAttachment.getFrameName(), skin.getAttachmentNames(0), skin.getAttachment(1, "head"));
 */
export class Skeleton2DSkin extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #name;
	/** @private @type { Map<number, Map<string, object>> } */ #slotAttachmentTable;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { string } name 스킨 이름.
	 */
	constructor(name) {
		super();
		this.#name = name;
		this.#slotAttachmentTable = new System.Map();
	}

	//==============================================================================
	// 이름 반환.
	//==============================================================================
	/**
	 * @returns { string } 스킨 이름.
	 */
	getName() {
		return this.#name;
	}

	//==============================================================================
	// 붙임 넣기. (같은 슬롯, 같은 이름이 있으면 바꾼다)
	//==============================================================================
	/**
	 * @param { number } slotIndex 슬롯 번호.
	 * @param { string } attachmentName 슬롯 안의 붙임 이름.
	 * @param { Skeleton2DRegionAttachment | Skeleton2DMeshAttachment } attachment 붙임.
	 */
	setAttachment(slotIndex, attachmentName, attachment) {
		let attachmentTable = this.#slotAttachmentTable.get(slotIndex);
		if (attachmentTable === undefined) {
			attachmentTable = new System.Map();
			this.#slotAttachmentTable.set(slotIndex, attachmentTable);
		}
		attachmentTable.set(attachmentName, attachment);
	}

	//==============================================================================
	// 붙임 찾기. (없으면 null)
	//==============================================================================
	/**
	 * @param { number } slotIndex 슬롯 번호.
	 * @param { string } attachmentName 슬롯 안의 붙임 이름.
	 * @returns { Skeleton2DRegionAttachment | Skeleton2DMeshAttachment | null } 붙임. (없으면 null)
	 */
	getAttachment(slotIndex, attachmentName) {
		const attachmentTable = this.#slotAttachmentTable.get(slotIndex);
		if (attachmentTable === undefined) {
			return null;
		}
		const attachment = attachmentTable.get(attachmentName);
		if (attachment === undefined) {
			return null;
		}
		return attachment;
	}

	//==============================================================================
	// 슬롯의 붙임 이름 목록 반환. (넣은 차례)
	//==============================================================================
	/**
	 * @param { number } slotIndex 슬롯 번호.
	 * @returns { string[] } 붙임 이름 목록.
	 */
	getAttachmentNames(slotIndex) {
		const attachmentTable = this.#slotAttachmentTable.get(slotIndex);
		if (attachmentTable === undefined) {
			return [];
		}
		return System.Array.from(attachmentTable.keys());
	}

	//==============================================================================
	// 모든 붙임 목록 반환. (조각 찾기 같은 데 쓴다)
	//==============================================================================
	/**
	 * @returns { (Skeleton2DRegionAttachment | Skeleton2DMeshAttachment)[] } 붙임 목록.
	 */
	getAttachmentList() {
		const attachmentList = [];
		for (const attachmentTable of this.#slotAttachmentTable.values()) {
			for (const attachment of attachmentTable.values()) {
				attachmentList.push(attachment);
			}
		}
		return attachmentList;
	}
}


//==============================================================================
// 2D 뼈대 자료.
//==============================================================================
/**
 * @example <caption>코드로 뼈 둘을 짓고 처음 자세의 월드 행렬 셈하기</caption>
 * import { Experimental } from "./build/vanilla.js";
 *
 * const skeletonData = new Experimental.Skeleton2DData("arm");
 * const rootBoneData = new Experimental.Skeleton2DBoneData(0, "root", -1);
 * const armBoneData = new Experimental.Skeleton2DBoneData(1, "arm", 0);
 * armBoneData.setTransform(10, 0, 90, 1, 1, 0, 0);
 * skeletonData.addBone(rootBoneData);
 * skeletonData.addBone(armBoneData);
 * const worldMatrices = Experimental.Skeleton2DData.computeSetupWorldMatrices(skeletonData.getBones());
 * console.log(skeletonData.findBoneIndex("arm"), worldMatrices[6 + 4], worldMatrices[6 + 1]);
 */
export class Skeleton2DData extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #name;
	/** @private @type { number } */ #frameRate;
	/** @private @type { Skeleton2DBoneData[] } */ #bones;
	/** @private @type { Skeleton2DSlotData[] } */ #slots;
	/** @private @type { Skeleton2DIkConstraintData[] } */ #ikConstraints;
	/** @private @type { Skeleton2DSkin[] } */ #skins;
	/** @private @type { object[] } */ #animations;

	//==============================================================================
	// 생성. (빈 자료, 초당 프레임 30)
	//==============================================================================
	/**
	 * @param { string } name 뼈대 이름.
	 */
	constructor(name) {
		super();
		this.#name = name;
		this.#frameRate = 30;
		this.#bones = [];
		this.#slots = [];
		this.#ikConstraints = [];
		this.#skins = [];
		this.#animations = [];
	}

	//==============================================================================
	// 이름 반환.
	//==============================================================================
	/**
	 * @returns { string } 뼈대 이름.
	 */
	getName() {
		return this.#name;
	}

	//==============================================================================
	// 초당 프레임 설정. (만든 도구의 값, 시각은 모두 초라 재생에는 쓰지 않는다)
	//==============================================================================
	/**
	 * @param { number } frameRate 초당 프레임.
	 */
	setFrameRate(frameRate) {
		this.#frameRate = frameRate;
	}

	//==============================================================================
	// 초당 프레임 반환.
	//==============================================================================
	/**
	 * @returns { number } 초당 프레임.
	 */
	getFrameRate() {
		return this.#frameRate;
	}

	//==============================================================================
	// 뼈 더하기. (부모가 앞에 있어야 한다)
	//==============================================================================
	/**
	 * @param { Skeleton2DBoneData } boneData 더할 뼈. (번호는 지금 뼈 수와 같아야 한다)
	 */
	addBone(boneData) {
		this.#bones.push(boneData);
	}

	//==============================================================================
	// 뼈 목록 반환.
	//==============================================================================
	/**
	 * @returns { Skeleton2DBoneData[] } 뼈 목록. (부모가 앞)
	 */
	getBones() {
		return this.#bones;
	}

	//==============================================================================
	// 슬롯 더하기.
	//==============================================================================
	/**
	 * @param { Skeleton2DSlotData } slotData 더할 슬롯. (번호는 지금 슬롯 수와 같아야 한다)
	 */
	addSlot(slotData) {
		this.#slots.push(slotData);
	}

	//==============================================================================
	// 슬롯 목록 반환.
	//==============================================================================
	/**
	 * @returns { Skeleton2DSlotData[] } 슬롯 목록. (처음 그리기 차례)
	 */
	getSlots() {
		return this.#slots;
	}

	//==============================================================================
	// IK 제약 더하기.
	//==============================================================================
	/**
	 * @param { Skeleton2DIkConstraintData } ikConstraintData 더할 제약.
	 */
	addIkConstraint(ikConstraintData) {
		this.#ikConstraints.push(ikConstraintData);
	}

	//==============================================================================
	// IK 제약 목록 반환.
	//==============================================================================
	/**
	 * @returns { Skeleton2DIkConstraintData[] } 제약 목록. (거는 차례)
	 */
	getIkConstraints() {
		return this.#ikConstraints;
	}

	//==============================================================================
	// 스킨 더하기.
	//==============================================================================
	/**
	 * @param { Skeleton2DSkin } skin 더할 스킨.
	 */
	addSkin(skin) {
		this.#skins.push(skin);
	}

	//==============================================================================
	// 스킨 목록 반환.
	//==============================================================================
	/**
	 * @returns { Skeleton2DSkin[] } 스킨 목록.
	 */
	getSkins() {
		return this.#skins;
	}

	//==============================================================================
	// 클립 더하기.
	//==============================================================================
	/**
	 * @param { object } animation 더할 클립. (Skeleton2DAnimation)
	 */
	addAnimation(animation) {
		this.#animations.push(animation);
	}

	//==============================================================================
	// 클립 목록 반환.
	//==============================================================================
	/**
	 * @returns { object[] } 클립 목록. (Skeleton2DAnimation)
	 */
	getAnimations() {
		return this.#animations;
	}

	//==============================================================================
	// 뼈 찾기. (없으면 null)
	//==============================================================================
	/**
	 * @param { string } boneName 뼈 이름.
	 * @returns { Skeleton2DBoneData | null } 뼈. (없으면 null)
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
		const bones = this.#bones;
		for (let boneIndex = 0; boneIndex < bones.length; ++boneIndex) {
			const name = bones[boneIndex].getName();
			if (name === boneName) {
				return boneIndex;
			}
		}
		return -1;
	}

	//==============================================================================
	// 슬롯 찾기. (없으면 null)
	//==============================================================================
	/**
	 * @param { string } slotName 슬롯 이름.
	 * @returns { Skeleton2DSlotData | null } 슬롯. (없으면 null)
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
		const slots = this.#slots;
		for (let slotIndex = 0; slotIndex < slots.length; ++slotIndex) {
			const name = slots[slotIndex].getName();
			if (name === slotName) {
				return slotIndex;
			}
		}
		return -1;
	}

	//==============================================================================
	// 스킨 찾기. (없으면 null)
	//==============================================================================
	/**
	 * @param { string } skinName 스킨 이름.
	 * @returns { Skeleton2DSkin | null } 스킨. (없으면 null)
	 */
	findSkin(skinName) {
		for (const skin of this.#skins) {
			const name = skin.getName();
			if (name === skinName) {
				return skin;
			}
		}
		return null;
	}

	//==============================================================================
	// 스킨 번호 찾기. (없으면 -1)
	//==============================================================================
	/**
	 * @param { string } skinName 스킨 이름.
	 * @returns { number } 스킨 번호. (없으면 -1)
	 */
	findSkinIndex(skinName) {
		const skins = this.#skins;
		for (let skinIndex = 0; skinIndex < skins.length; ++skinIndex) {
			const name = skins[skinIndex].getName();
			if (name === skinName) {
				return skinIndex;
			}
		}
		return -1;
	}

	//==============================================================================
	// 처음 스킨 번호 반환. ("default" 스킨, 없으면 첫 스킨의 번호, 스킨이 없으면 -1)
	//==============================================================================
	/**
	 * @returns { number } 처음 스킨 번호.
	 */
	getDefaultSkinIndex() {
		const skinIndex = this.findSkinIndex(DEFAULT_SKIN_NAME);
		if (skinIndex >= 0) {
			return skinIndex;
		}
		return this.#skins.length > 0 ? 0 : -1;
	}

	//==============================================================================
	// 처음 스킨 반환. ("default" 스킨, 없으면 첫 스킨, 스킨이 없으면 null)
	//==============================================================================
	/**
	 * @returns { Skeleton2DSkin | null } 처음 스킨.
	 */
	getDefaultSkin() {
		const skinIndex = this.getDefaultSkinIndex();
		if (skinIndex < 0) {
			return null;
		}
		return this.#skins[skinIndex];
	}

	//==============================================================================
	// 클립 찾기. (없으면 null)
	//==============================================================================
	/**
	 * @param { string } animationName 클립 이름.
	 * @returns { object | null } 클립. (Skeleton2DAnimation, 없으면 null)
	 */
	findAnimation(animationName) {
		for (const animation of this.#animations) {
			const name = animation.getName();
			if (name === animationName) {
				return animation;
			}
		}
		return null;
	}

	//==============================================================================
	// IK 제약 찾기. (없으면 null)
	//==============================================================================
	/**
	 * @param { string } ikConstraintName 제약 이름.
	 * @returns { Skeleton2DIkConstraintData | null } 제약. (없으면 null)
	 */
	findIkConstraint(ikConstraintName) {
		for (const ikConstraintData of this.#ikConstraints) {
			const name = ikConstraintData.getName();
			if (name === ikConstraintName) {
				return ikConstraintData;
			}
		}
		return null;
	}

	//==============================================================================
	// 처음 자세의 월드 행렬 셈. (뼈마다 a, b, c, d, x, y 여섯, IK 는 걸지 않는다)
	//==============================================================================
	/**
	 * @static
	 * @param { Skeleton2DBoneData[] } boneDataList 뼈 목록. (부모가 앞)
	 * @returns { number[] } 뼈마다 월드 행렬 여섯 값.
	 */
	static computeSetupWorldMatrices(boneDataList) {
		const worldMatrices = new System.Array(boneDataList.length * 6).fill(0);
		for (let boneIndex = 0; boneIndex < boneDataList.length; ++boneIndex) {
			const boneData = boneDataList[boneIndex];
			const rotation = boneData.getRotation();
			const shearX = boneData.getShearX();
			const shearY = boneData.getShearY();
			const scaleX = boneData.getScaleX();
			const scaleY = boneData.getScaleY();
			const x = boneData.getX();
			const y = boneData.getY();
			const xAxisRadian = (rotation + shearX) * System.Math.PI / 180;
			const yAxisRadian = (rotation + shearY) * System.Math.PI / 180;
			const localA = System.Math.cos(xAxisRadian) * scaleX;
			const localB = System.Math.sin(xAxisRadian) * scaleX;
			const localC = -System.Math.sin(yAxisRadian) * scaleY;
			const localD = System.Math.cos(yAxisRadian) * scaleY;
			const offset = boneIndex * 6;
			const parentIndex = boneData.getParentIndex();
			if (parentIndex < 0) {
				worldMatrices[offset] = localA;
				worldMatrices[offset + 1] = localB;
				worldMatrices[offset + 2] = localC;
				worldMatrices[offset + 3] = localD;
				worldMatrices[offset + 4] = x;
				worldMatrices[offset + 5] = y;
				continue;
			}
			const parentOffset = parentIndex * 6;
			const parentA = worldMatrices[parentOffset];
			const parentB = worldMatrices[parentOffset + 1];
			const parentC = worldMatrices[parentOffset + 2];
			const parentD = worldMatrices[parentOffset + 3];
			worldMatrices[offset] = parentA * localA + parentC * localB;
			worldMatrices[offset + 1] = parentB * localA + parentD * localB;
			worldMatrices[offset + 2] = parentA * localC + parentC * localD;
			worldMatrices[offset + 3] = parentB * localC + parentD * localD;
			worldMatrices[offset + 4] = parentA * x + parentC * y + worldMatrices[parentOffset + 4];
			worldMatrices[offset + 5] = parentB * x + parentD * y + worldMatrices[parentOffset + 5];
		}
		return worldMatrices;
	}

	//==============================================================================
	// 엔진 자체 JSON 으로 짓기. (꼴이 틀리면 오류를 던진다)
	// - 꼴: { name, frameRate, bones: [{ name, parent, x, y, rotation, scaleX, scaleY, shearX, shearY, length }],
	//   slots: [{ name, bone, attachment, color: "#rrggbb(aa)", blendMode }], ik: [{ name, bones: [부모, 자식], target, bendPositive, mix }],
	//   skins: [{ name, attachments: { 슬롯: { 붙임: { type: "region" | "mesh", frame, ... } } } }],
	//   animations: { 이름: { duration, bones: { 뼈: { rotate, translate, scale, shear } }, slots: { 슬롯: { color, attachment } }, drawOrder, events } } }
	// - 네모 붙임: x, y, rotation, scaleX, scaleY, width, height, pivotX, pivotY. 메시 붙임: vertices(슬롯 뼈 기준), uvs, triangles, weights(꼭짓점마다 [뼈 이름, 무게, ...]).
	//   무게 있는 메시의 묶은 자리는 처음 자세에서 셈한다. (유니티 2D Animation, DragonBones 와 같은 꼴)
	// - 키: { time(초), value 또는 x, y 또는 color 또는 name, curve: "linear" | "stepped" | [x1, y1, x2, y2] }. 그리기 차례 키의 order 는 슬롯 이름 모두다.
	//==============================================================================
	/**
	 * @static
	 * @param { object } json JSON 을 읽은 객체.
	 * @returns { Skeleton2DData } 지은 자료.
	 * @example <caption>걷기 클립 하나를 가진 자료</caption>
	 * import { Experimental } from "./build/vanilla.js";
	 *
	 * const skeletonData = Experimental.Skeleton2DData.createFromJson({
	 * 	bones: [{ name: "root" }, { name: "leg", parent: "root", rotation: 90, length: 30 }],
	 * 	animations: {
	 * 		walk: {
	 * 			bones: { leg: { rotate: [{ time: 0, value: -20, curve: [0.42, 0, 0.58, 1] }, { time: 0.5, value: 20 }, { time: 1, value: -20 }] } },
	 * 			events: [{ time: 0.5, name: "step" }],
	 * 		},
	 * 	},
	 * });
	 * const walkAnimation = skeletonData.findAnimation("walk");
	 * console.log(walkAnimation.getDuration(), walkAnimation.getTimelines().length);
	 */
	static createFromJson(json) {
		return readSkeleton2DJson(json);
	}

	//==============================================================================
	// DragonBones 5.x JSON 으로 짓기. (꼴이 틀리면 오류를 던진다)
	// - 뼈(transform 의 x, y, skX, skY, scX, scY, length), 슬롯(displayIndex, color 의 곱, blendMode), 스킨의 image 와 mesh(무게는 slotPose, bonePose),
	//   IK(bone, target, chain 0 이나 1, bendPositive, weight), 클립(translateFrame, rotateFrame 의 rotate 와 skew, scaleFrame, displayFrame, colorFrame, zOrder, 사건)을 읽는다.
	// - 회전은 skY, 기울임 y 는 skX - skY 다. 프레임 수는 frameRate 로 초가 된다. 회전 키는 clockwise 를 따라 이어지는 값으로 펴서 담는다.
	// - tweenEasing 이 없으면 계단, 0 이면 선형, 그 밖은 같은 꼴의 베지어로, curve 는 [x1, y1, x2, y2] 하나만 베지어로 읽는다. (여러 토막 곡선은 선형)
	// - 읽지 않는 것: 뼈의 inheritRotation, inheritScale 끄기, 색 더하기(aO 등), armature, boundingBox, path 붙임, ffd, IK 시간줄, 소리와 행동.
	//==============================================================================
	/**
	 * @static
	 * @param { object } json DragonBones JSON 을 읽은 객체. (_ske.json)
	 * @param { string | null } armatureName 읽을 뼈대 이름. (null 이면 첫 뼈대)
	 * @returns { Skeleton2DData } 지은 자료.
	 * @example <caption>DragonBones 뼈대 하나 읽기</caption>
	 * import { Experimental } from "./build/vanilla.js";
	 *
	 * const skeletonData = Experimental.Skeleton2DData.createFromDragonBones({
	 * 	frameRate: 24,
	 * 	armature: [{
	 * 		name: "hero",
	 * 		bone: [{ name: "root" }, { name: "arm", parent: "root", length: 40, transform: { x: 10, skX: 30, skY: 30 } }],
	 * 		slot: [{ name: "arm", parent: "arm" }],
	 * 		skin: [{ slot: [{ name: "arm", display: [{ name: "arm_image" }] }] }],
	 * 		animation: [{ name: "wave", duration: 24, bone: [{ name: "arm", rotateFrame: [{ duration: 24, tweenEasing: 0, rotate: 0 }, { duration: 0, rotate: 45 }] }] }],
	 * 	}],
	 * }, null);
	 * console.log(skeletonData.getName(), skeletonData.findBone("arm").getRotation(), skeletonData.findAnimation("wave").getDuration());
	 */
	static createFromDragonBones(json, armatureName = null) {
		return readDragonBonesJson(json, armatureName);
	}
}
