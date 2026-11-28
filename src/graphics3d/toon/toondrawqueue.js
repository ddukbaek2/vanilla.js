//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { ToonBlendMode } from "./toonmaterial.js";
import { TOON_SCREEN_OUTLINE_MAXIMUM_LINE_ID } from "./toonscreenoutline.js";
import { writeInstanceBufferSphere, readMatrixDeterminant, isSameBatchState, DRAW_STATE_JOINT_MATRICES, DRAW_STATE_INDEX_START, DRAW_STATE_INDEX_COUNT, DRAW_STATE_IS_MIRRORED, DRAW_STATE_MATERIAL, DRAW_STATE_IS_TRANSPARENT, DRAW_STATE_HAS_OUTLINE, DRAW_STATE_IS_CULLED, DRAW_STATE_CASTS_SHADOW, DRAW_STATE_LINE_ID, DRAW_STATE_GROUP, DRAW_STATE_IS_DEPTH_PREPASSED, DRAW_STATE_BASE_COLOR_TEXTURE, EMPTY_OPTIONS } from "./toonrenderer.js";
import { ShadowUpdateMode } from "../shadowmap.js";
import { Matrix4 } from "../../base/matrix4.js";


/**
 * @example <caption>그리기 줄로 그림자, 화면 공간 바깥선, 비치는 것까지 한 프레임</caption>
 * import { ToonRenderer, ToonDrawQueue, ToonScreenOutline, MeshBuilder, createSphereGeometry, ShadowMap, Camera3D, Matrix4, Vector3 } from "./vanilla.js";
 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
 * const renderer = new ToonRenderer(webGL2RenderingContext);
 * const builder = new MeshBuilder();
 * builder.addPart(createSphereGeometry(0.5, 32, 20), Matrix4.createIdentity(), "#f0e8e0", { hasOutline: false });
 * const ballMesh = renderer.createMesh(builder.readArrays());
 * const shadowMap = new ShadowMap(webGL2RenderingContext, 1024);
 * shadowMap.updateLightMatrix(Vector3.create(0, 0, 0), Vector3.create(-0.4, -1, -0.3), 5, 0.5, 30);
 * renderer.setShadow(shadowMap, 1);
 * const camera = new Camera3D();
 * camera.setPerspective(0.8, 0.1, 100);
 * camera.lookAt(Vector3.create(0, 2, 5), Vector3.create(0, 0.5, 0), Vector3.create(0, 1, 0));
 * const queue = new ToonDrawQueue();
 * queue.setScreenOutline(new ToonScreenOutline(webGL2RenderingContext));
 * queue.addMesh(ballMesh, Matrix4.createTranslation(0, 0.5, 0), { lineId: 1 });
 * queue.addMesh(ballMesh, Matrix4.createTranslation(1.2, 0.5, 0), { lineId: 2, alpha: 0.5 });
 * queue.drawShadows(renderer, shadowMap);
 * queue.draw(renderer, camera);
 */


//==============================================================================
// 전역 변수 목록.
//==============================================================================
const sortIdTable = new System.WeakMap(); // 정렬 번호. (재질, 모형, 텍스처마다 처음 본 차례)
let nextSortId = 1;


//==============================================================================
// 정렬 번호 읽기. (객체마다 처음 본 차례로 매긴다, 없으면 0)
//==============================================================================
/**
 * @param { any } value - 재질, 모형, 텍스처 같은 객체.
 * @returns { number } 정렬 번호.
 */
function readSortId(value) {
	if (value === undefined || value === null || typeof value !== "object") {
		return 0;
	}
	let sortId = sortIdTable.get(value);
	if (sortId === undefined) {
		sortId = nextSortId;
		nextSortId += 1;
		sortIdTable.set(value, sortId);
	}
	return sortId;
}


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 그림자 캐시에서 드리우개를 움직이지 않는 것으로 굽기까지 그대로여야 하는 프레임 수. (자주 섰다 움직이는 것이 구운 판을 자꾸 다시 굽지 않게)
const SHADOW_STATIC_FRAME_COUNT = 30;
const DRAW_PART_OUTLINE = 1; // drawMeshBatch 가 그릴 것: 바깥선 껍데기. (ToonRenderer 와 같은 값)
const DRAW_PART_BODY = 2; // 몸.
const DRAW_PART_ALL = 3; // 둘 다. (그림자 패스면 깊이)
const INSTANCE_BUFFER_SPHERE = [0, 0, 0, 0]; // addMeshInstanceBuffer 의 경계 구 칸. (다시 쓴다)


//==============================================================================
// 드리우개 기록 쓰기. (그림자 깊이에 닿는 값을 기록과 견주고 새 값으로 바꾼다, 다르면 true)
// - 모형, 재질, 모형 행렬이나 인스턴스 행렬, 관절 행렬, 번호 버퍼의 범위, 화면 밖 거르기, 뒤집기. (틴트, 색, 바깥선 같은 것은 깊이에 닿지 않는다)
//==============================================================================
/**
 * @param { object } record - { mesh, material, values Float32Array, stableFrameCount, isStatic }
 * @param { object } item - 담은 것 하나.
 * @returns { boolean } 앞의 프레임과 다르면 true.
 */
function writeCasterRecord(record, item) {
	const state = item.state;
	const material = state[DRAW_STATE_MATERIAL];
	const jointMatrices = state[DRAW_STATE_JOINT_MATRICES];
	const instanceBuffer = item.instanceBuffer;
	const matrixCount = instanceBuffer !== null ? 0 : (item.instances !== null ? item.instances.length : 1);
	const valueCount = 6 + matrixCount * 16 + (instanceBuffer !== null ? 1 : 0) + (jointMatrices !== null ? jointMatrices.length : 0);
	const generation = instanceBuffer !== null ? instanceBuffer.generation : -1;
	let isChanged = record.mesh !== item.mesh || record.material !== material || record.instanceBuffer !== instanceBuffer || record.generation !== generation;
	record.mesh = item.mesh;
	record.material = material;
	record.instanceBuffer = instanceBuffer;
	record.generation = generation;
	if (record.values.length !== valueCount) {
		record.values = new System.Float32Array(valueCount);
		isChanged = true;
	}
	const values = record.values;
	isChanged = writeRecordValue(values, 0, matrixCount) || isChanged;
	isChanged = writeRecordValue(values, 1, state[DRAW_STATE_INDEX_START]) || isChanged;
	isChanged = writeRecordValue(values, 2, state[DRAW_STATE_INDEX_COUNT]) || isChanged;
	isChanged = writeRecordValue(values, 3, state[DRAW_STATE_IS_CULLED] ? 1 : 0) || isChanged;
	isChanged = writeRecordValue(values, 4, state[DRAW_STATE_IS_MIRRORED]) || isChanged;
	isChanged = writeRecordValue(values, 5, jointMatrices !== null ? jointMatrices.length : -1) || isChanged;
	let index = 6;
	if (instanceBuffer !== null) {
		isChanged = writeRecordValue(values, index, item.instanceCount) || isChanged;
		index += 1;
	}
	else if (item.instances !== null) {
		const instances = item.instances;
		for (let instanceIndex = 0; instanceIndex < instances.length; ++instanceIndex) {
			isChanged = writeRecordValues(values, index, instances[instanceIndex].modelMatrix.getElements(), 16) || isChanged;
			index += 16;
		}
	}
	else {
		isChanged = writeRecordValues(values, index, item.modelMatrix.getElements(), 16) || isChanged;
		index += 16;
	}
	if (jointMatrices !== null) {
		isChanged = writeRecordValues(values, index, jointMatrices, jointMatrices.length) || isChanged;
	}
	return isChanged;
}

//==============================================================================
// 드리우개 기록의 값 하나 쓰기. (float 로 맞춘 값이 다르면 바꾸고 true)
//==============================================================================
/**
 * @param { Float32Array } values - 기록의 값.
 * @param { number } index - 자리.
 * @param { number } value - 새 값.
 * @returns { boolean } 달랐으면 true.
 */
function writeRecordValue(values, index, value) {
	const rounded = System.Math.fround(value);
	if (values[index] !== rounded) {
		values[index] = rounded;
		return true;
	}
	return false;
}

//==============================================================================
// 드리우개 기록의 값 여럿 쓰기. (writeRecordValue 를 count 번, 클로저와 객체를 짓지 않는다)
//==============================================================================
/**
 * @param { Float32Array } values - 기록의 값.
 * @param { number } offset - 첫 자리.
 * @param { ArrayLike<number> } source - 새 값.
 * @param { number } count - 수.
 * @returns { boolean } 하나라도 달랐으면 true.
 */
function writeRecordValues(values, offset, source, count) {
	let isChanged = false;
	for (let index = 0; index < count; ++index) {
		const rounded = System.Math.fround(source[index]);
		if (values[offset + index] !== rounded) {
			values[offset + index] = rounded;
			isChanged = true;
		}
	}
	return isChanged;
}

//==============================================================================
// 비치는 덩어리 차례. (가운데 깊이가 먼 것부터, 같으면 차례 그대로, Array.prototype.sort 는 안정 정렬)
//==============================================================================
/**
 * @param { object } entry - 덩어리.
 * @param { object } other - 견줄 덩어리.
 * @returns { number } 정렬 값.
 */
function compareTransparentEntry(entry, other) {
	return other.averageDepth - entry.averageDepth;
}

//==============================================================================
// 목록 길이 맞추기. (다를 때만, 칸에 차례로 쓴 뒤 부른다)
// - 프레임마다 length = 0 으로 비우고 push 하면 V8 이 칸(16 개 넘게 잡은 것)을 놓고 다시 잡는다. 칸에 쓰고 길이만 맞추면 수가 그대로인 프레임은 할당이 없다.
//==============================================================================
/**
 * @param { Array<any> } list - 목록.
 * @param { number } length - 길이.
 */
function setListLength(list, length) {
	if (list.length !== length) {
		list.length = length;
	}
}

//==============================================================================
// 자동 인스턴싱으로 묶을 수 있는지. (같은 모형, 같은 재질 블록, 같은 감기, 선 번호와 묶음 말고 푼 칸이 모두 같은 보통 모형 하나씩)
//==============================================================================
/**
 * @param { object } item - 담은 것.
 * @param { object } other - 견줄 담은 것.
 * @returns { boolean } 묶을 수 있으면 true.
 */
function isBatchableItem(item, other) {
	return other.mesh === item.mesh && other.modelMatrix !== null && other.instances === null && other.instanceBuffer === null && other.materialBlock === item.materialBlock && other.mirrorSign === item.mirrorSign && isSameBatchState(item.state, other.state);
}


//==============================================================================
// 같은 수 묶음인지. (null 이면 다르다)
//==============================================================================
/**
 * @param { Float32Array | null } values - 앞의 값.
 * @param { Float32Array } other - 지금 값.
 * @returns { boolean } 길이와 값이 모두 같으면 true.
 */
function isSameValues(values, other) {
	if (values === null || values.length !== other.length) {
		return false;
	}
	for (let index = 0; index < values.length; ++index) {
		if (values[index] !== other[index]) {
			return false;
		}
	}
	return true;
}


//==============================================================================
// 전역 상수 목록.
//==============================================================================
/**
 * 그리기 줄의 단계. (addPass 의 콜백을 부를 자리)
 * - beforeOpaque: 불투명한 몸 앞. (평면 거울에 비친 모습, 하늘)
 * - afterOpaque: 불투명한 몸 뒤, 바깥선 껍데기 앞.
 * - afterOutline: 바깥선 껍데기와 화면 공간 바깥선 뒤, 비치는 것 앞.
 * - afterTransparent: 비치는 것 뒤. (효과)
 * @example <caption>불투명한 것 뒤에 하늘 그리기</caption>
 * import { ToonDrawQueue, ToonDrawStage } from "./vanilla.js";
 * const queue = new ToonDrawQueue();
 * queue.addPass(ToonDrawStage.afterOpaque, (renderer, webGL2RenderingContext) => {
 * 	webGL2RenderingContext.depthMask(false);
 * });
 */
export const ToonDrawStage = System.Object.freeze({
	beforeOpaque: "beforeOpaque", // 불투명한 몸 앞.
	afterOpaque: "afterOpaque", // 불투명한 몸 뒤, 바깥선 껍데기 앞.
	afterOutline: "afterOutline", // 바깥선 껍데기와 화면 공간 바깥선 뒤, 비치는 것 앞.
	afterTransparent: "afterTransparent", // 비치는 것 뒤.
});


//==============================================================================
// 남겨 두는 그리기 항목. (모형, 모형 행렬, 꼴을 쥐고 꼴을 푼 것을 기억한다, 프레임마다 ToonDrawQueue.addItem 으로 담는다)
// - 유니티 MeshRenderer, 언리얼 프리미티브 컴포넌트 꼴이다. 한 번 짓고 쥐어 두면 그리기 줄이 꼴 객체를 프레임마다 견주거나 풀지 않는다.
//   부품이 많은 모형은 부품마다 하나씩 짓는다. (재질 범위의 indexStart, indexCount 를 꼴에)
// - 꼴은 넘긴 객체를 그대로 쥔다. (복사하지 않는다) 꼴을 고치면 바뀜 표시가 있어야 다시 푼다:
//   setOption(이름, 값) 이나 setOptions(새 꼴) 은 스스로 표시한다. 꼴 객체의 값(틴트 배열의 수까지)을 그 자리에서 고쳤으면 markDirty() 를 부른다.
// - 모형 행렬은 복사해 쥔다. 바꾸면 setModelMatrix 로 넘긴다. (그 자리에서 고친 행렬도 다시 넘긴다, 쥔 행렬을 고치지 않는다)
//   바뀐 것(모형, 행렬, 꼴)이 없는 항목은 그림자 캐시(ShadowUpdateMode.onChange)도 견주지 않는다. (뼈대 행렬이 있으면 견준다)
// - addMesh 와 화면이 같다. 꼴은 addMesh 의 꼴과 같다. (ToonRenderer.drawMesh 의 꼴과 castsShadow, group, isDepthPrepassed, lineId, hasScreenOutline, hasCreaseLine)
//==============================================================================
/**
 * @example <caption>꼴을 바꿀 때만 표시하기</caption>
 * import { ToonDrawItem, Matrix4 } from "./vanilla.js";
 * const options = { tintColor: [1, 1, 1, 1], lineId: 7 };
 * const drawItem = new ToonDrawItem(null, Matrix4.createIdentity(), options);
 * drawItem.setOption("emissiveIntensity", 0.5);
 * options.tintColor[0] = 0.5;
 * drawItem.markDirty();
 */
export class ToonDrawItem {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object | null } */ #mesh; // ToonRenderer.createMesh 의 결과.
	/** @private @type { Matrix4 } */ #modelMatrix; // 모형 행렬. (복사해 쥔 것)
	/** @private @type { object } */ #options; // 그리기 꼴. (쥔 것)
	/** @private @type { boolean } */ #isDirty; // 꼴을 다시 풀어야 하는지.
	/** @private @type { number } */ #changeSerial; // 모형, 행렬, 꼴이 바뀔 때마다 오르는 번호. (그림자 캐시가 견주지 않을 때 쓴다)
	/** @private @type { object | null } */ #entry; // 렌더러가 푼 기억 칸. (꼴 객체마다 기억하지 않고 이 항목이 쥔다)
	/** @private @type { object | null } */ #renderer; // 기억 칸을 푼 렌더러.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { object | null } mesh - ToonRenderer.createMesh 의 결과.
	 * @param { Matrix4 } modelMatrix - 모형 행렬. (복사한다)
	 * @param { object } [options] - ToonDrawQueue.addMesh 와 같은 꼴.
	 */
	constructor(mesh, modelMatrix, options = {}) {
		this.#mesh = mesh;
		this.#modelMatrix = new Matrix4();
		this.#modelMatrix.copyFrom(modelMatrix);
		this.#options = options;
		this.#isDirty = true;
		this.#changeSerial = 0;
		this.#entry = null;
		this.#renderer = null;
	}

	//==============================================================================
	// 모형 반환.
	//==============================================================================
	/**
	 * @returns { object | null } 모형.
	 */
	getMesh() {
		return this.#mesh;
	}

	//==============================================================================
	// 모형 바꾸기. (꼴은 그대로)
	//==============================================================================
	/**
	 * @param { object | null } mesh - ToonRenderer.createMesh 의 결과.
	 * @example <caption>모형 바꾸기</caption>
	 * import { ToonDrawItem, Matrix4 } from "./vanilla.js";
	 * const drawItem = new ToonDrawItem(null, Matrix4.createIdentity(), {});
	 * drawItem.setMesh(null);
	 */
	setMesh(mesh) {
		this.#mesh = mesh;
		this.#changeSerial += 1;
	}

	//==============================================================================
	// 모형 행렬 반환. (쥔 것, 읽기만 한다, 바꾸려면 setModelMatrix)
	//==============================================================================
	/**
	 * @returns { Matrix4 } 모형 행렬.
	 */
	getModelMatrix() {
		return this.#modelMatrix;
	}

	//==============================================================================
	// 모형 행렬 바꾸기. (값을 복사해 쥔다, 같은 값이면 바뀐 것으로 치지 않는다)
	//==============================================================================
	/**
	 * @param { Matrix4 } modelMatrix - 모형 행렬. (복사한다)
	 * @example <caption>모형 행렬 바꾸기</caption>
	 * import { ToonDrawItem, Matrix4 } from "./vanilla.js";
	 * const drawItem = new ToonDrawItem(null, Matrix4.createIdentity(), {});
	 * drawItem.setModelMatrix(Matrix4.createTranslation(1, 0, 0));
	 */
	setModelMatrix(modelMatrix) {
		const elements = this.#modelMatrix.getElements();
		const otherElements = modelMatrix.getElements();
		for (let index = 0; index < 16; ++index) {
			if (elements[index] !== otherElements[index]) {
				elements.set(otherElements);
				this.#changeSerial += 1;
				return;
			}
		}
	}

	//==============================================================================
	// 꼴 반환. (쥔 객체, 그 자리에서 고쳤으면 markDirty)
	//==============================================================================
	/**
	 * @returns { object } 그리기 꼴.
	 */
	getOptions() {
		return this.#options;
	}

	//==============================================================================
	// 꼴 바꾸기. (새 꼴 객체를 쥐고 바뀜 표시)
	//==============================================================================
	/**
	 * @param { object } options - ToonDrawQueue.addMesh 와 같은 꼴.
	 * @example <caption>꼴 통째로 바꾸기</caption>
	 * import { ToonDrawItem, Matrix4 } from "./vanilla.js";
	 * const drawItem = new ToonDrawItem(null, Matrix4.createIdentity(), { lineId: 1 });
	 * drawItem.setOptions({ lineId: 1, alpha: 0.5 });
	 */
	setOptions(options) {
		this.#options = options;
		this.markDirty();
	}

	//==============================================================================
	// 꼴의 칸 하나 바꾸기. (쥔 꼴 객체의 칸을 고치고 바뀜 표시, undefined 면 칸을 지운다)
	//==============================================================================
	/**
	 * @param { string } name - 꼴의 칸 이름. (tintColor, emissiveIntensity, alpha 같은 것)
	 * @param { any } value - 값. (undefined 면 칸을 지워 기본값으로)
	 * @example <caption>틴트 바꾸기</caption>
	 * import { ToonDrawItem, Matrix4 } from "./vanilla.js";
	 * const drawItem = new ToonDrawItem(null, Matrix4.createIdentity(), { lineId: 1 });
	 * drawItem.setOption("tintColor", [1, 0.6, 0.6, 1]);
	 */
	setOption(name, value) {
		if (value === undefined) {
			delete this.#options[name];
		}
		else {
			this.#options[name] = value;
		}
		this.markDirty();
	}

	//==============================================================================
	// 바뀜 표시. (꼴 객체의 값을 그 자리에서 고친 뒤 부른다, 다음에 담을 때 다시 푼다)
	//==============================================================================
	/**
	 * @example <caption>그 자리에서 고친 뒤 표시</caption>
	 * import { ToonDrawItem, Matrix4 } from "./vanilla.js";
	 * const options = { tintColor: [1, 1, 1, 1] };
	 * const drawItem = new ToonDrawItem(null, Matrix4.createIdentity(), options);
	 * options.tintColor[1] = 0.5;
	 * drawItem.markDirty();
	 */
	markDirty() {
		this.#isDirty = true;
		this.#changeSerial += 1;
	}

	//==============================================================================
	// 바뀜 표시가 있는지.
	//==============================================================================
	/**
	 * @returns { boolean } 다음에 담을 때 꼴을 다시 풀면 true.
	 */
	isDirty() {
		return this.#isDirty;
	}

	//==============================================================================
	// 바뀜 번호 반환. (모형, 행렬, 꼴이 바뀔 때마다 오른다, 그림자 캐시가 견주지 않을 때 쓴다)
	//==============================================================================
	/**
	 * @returns { number } 바뀜 번호.
	 * @private
	 */
	getChangeSerial() {
		return this.#changeSerial;
	}

	//==============================================================================
	// 기억 칸 읽기. (그리기 줄이 부른다, 바뀜 표시나 렌더러가 바뀌었을 때만 다시 푼다)
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer.
	 * @returns { object } 기억 칸.
	 * @private
	 */
	readDrawEntry(renderer) {
		if (this.#renderer !== renderer) {
			this.#renderer = renderer;
			this.#entry = null;
			this.#isDirty = true;
		}
		if (this.#isDirty) {
			this.#entry = renderer.writeHeldDrawEntry(this.#entry, this.#options, true);
			this.#isDirty = false;
			return this.#entry;
		}
		return renderer.readHeldDrawEntry(this.#entry);
	}
}


//==============================================================================
// 툰 그리기 줄. (한 프레임에 그릴 모형을 담아 두었다가 ToonRenderer 로 차례를 맞춰 그린다)
// - 차례: (화면 공간 바깥선의 선의 판) → 단계 beforeOpaque → 불투명한 몸 → afterOpaque → 불투명한 것의 바깥선 껍데기 → 화면 공간 바깥선 → afterOutline
//   → 비치는 것(카메라에서 먼 것부터, 깊이는 쓰지 않음) → afterTransparent.
//   몸을 다 그린 뒤 바깥선을 몰아 그려 프로그램을 덜 바꾸고, 비치는 것은 뒤의 것이 비쳐 보이게 맨 끝에 먼 것부터 섞는다.
// - 불투명한 것(몸, 바깥선 껍데기, 그림자 깊이)은 재질, 모형, 바탕색 텍스처로 정렬해 그린다. (같은 것끼리는 담은 차례, 유니티 SRP Batcher 처럼 상태를 덜 바꾼다)
//   깊이 시험(LEQUAL)으로 가장 가까운 것이 남으므로 화면은 담은 차례와 같다. 깊이가 꼭 같은 면(겹친 평면)만 나중에 그린 것이 이겨 차례가 드러난다.
//   그런 것은 한 모형으로 합치거나 깊이를 띄운다. 비치는 것은 지금처럼 먼 것부터 담은 차례로 그린다.
// - 비치는 것: 그릴 때의 alpha 나 tintColor 의 알파가 1 보다 작거나 blendMode 가 alpha 가 아닌 것. 바깥선 껍데기도 함께(hasOutline) 그린다.
// - 묶음: options.group 이 같은 비치는 것은 한 덩어리로 가운데 깊이(담긴 것의 평균)로 정렬하고 담은 차례로 그린다.
//   options.isDepthPrepassed 가 묶음 안에 하나라도 있으면 그 덩어리는 깊이만 먼저 그린 뒤 같은 깊이(LEQUAL)인 화소에만 색을 칠한다.
//   여러 부품이 겹친 홀로그램이 두 겹으로 밝지 않고 한 덩어리로 비친다. 덩어리끼리는 먼 것부터라 서로 비친다.
// - 화면 공간 바깥선: setScreenOutline(ToonScreenOutline) 을 주면 draw 가 몸 앞에 불투명한 것을 선의 판에 그리고, 바깥선 껍데기 뒤에 섞는다.
//   번호는 options.lineId (주지 않으면 담은 차례 + 1, 인스턴스는 instances[i].lineId, 인스턴스 버퍼는 꼴의 instanceLineId 칸이 먼저), 모형마다 options.hasScreenOutline, options.hasCreaseLine 으로 끄고 켠다.
//   비치는 것은 선의 판에 그리지 않는다. 화면 사각형(ToonRenderer.setScreenRect)이 있으면 그 사각형을 선의 판의 그리는 영역으로 쓴다.
// - 모서리 어둠: setPostProcess(ToonPostProcess) 를 주고 후처리에서 setAmbientOcclusion 을 켜면 선의 판 뒤, 몸 앞에 셈해 렌더러에 걸고 endFrame 뒤에 푼다. (바깥선이 없으면 선 없이 선의 판만 그린다)
// - 단계 콜백: addPass(stage, callback) 의 callback(renderer, webGL2RenderingContext) 를 그 자리에서 부른다. 부른 뒤 렌더러가 프레임의 그리기 상태를 다시 건다.
// - 인스턴스 묶음(addMeshInstanced)은 불투명이면 몸과 바깥선 껍데기를 한 번에 그리고, 비치면 인스턴스 자리의 가운데로 한 덩어리로 정렬한다.
//   인스턴스마다 걸러 그릴 때마다 올린다. (몸, 그림자, 선의 판이 같은 배열을 따로 올림) 오래 두는 것은 addMeshInstanceBuffer 로 한 번 올린 버퍼를 같이 쓴다.
// - 인스턴스 버퍼(addMeshInstanceBuffer)는 유니티 Graphics.RenderMeshInstanced 와 GraphicsBuffer, 고도 MultiMesh 꼴이다. 버퍼 전체의 경계로 통째 거르고 다시 올리지 않는다.
// - 그림자: drawShadows(renderer, shadowMap) 가 castsShadow 가 false 가 아닌 불투명한 것만 해의 그림자 깊이로 그린다. draw 보다 먼저 부른다.
//   그림자 판의 setUpdateMode(ShadowUpdateMode) 를 따른다. 기본 onChange 는 빛과 드리우개가 그대로면 다시 그리지 않고, 오래 그대로인 것은 구워 두고 움직이는 것만 덧그린다. (화면은 매 프레임 그린 것과 같다)
//   점광과 스포트라이트 그림자는 drawLocalShadows(renderer, shadowAtlas) 가 아틀라스의 칸마다 같은 것을 그린다. (렌더러에 setLocalShadows 로 건다)
// - 사용: 매 프레임 clear() → addMesh / addMeshInstanced / addMeshInstanceBuffer / addPass → (drawShadows) → draw(renderer, camera) 나 drawWithMatrices(renderer, 보기 행렬, 투영 행렬)
//   draw 는 renderer.beginFrameWithCamera(camera) 와 endFrame 을 스스로 부른다. drawWithMatrices 는 beginFrameWithMatrices 를 부른다. (직교 원 행렬 카메라)
//   화면 사각형(ToonRenderer.setScreenRect)은 그 전에 건다. clear 는 담은 모형과 단계 콜백을 모두 비운다. (화면 공간 바깥선은 그대로 둔다)
// - 담는 것은 행렬과 꼴의 참조다. draw 를 부를 때까지 고치지 않는다.
//==============================================================================
/**
 * @example <caption>모형마다 바깥선 꼴 정하기</caption>
 * import { ToonRenderer, ToonDrawQueue, ToonScreenOutline, MeshBuilder, createBoxGeometry, createFacetedChunkGeometry, Camera3D, Matrix4, Vector3 } from "./vanilla.js";
 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
 * const renderer = new ToonRenderer(webGL2RenderingContext);
 * const floorBuilder = new MeshBuilder();
 * floorBuilder.addPart(createBoxGeometry(8, 0.2, 8), Matrix4.createTranslation(0, -0.1, 0), "#708090", { hasOutline: false });
 * const floorMesh = renderer.createMesh(floorBuilder.readArrays());
 * const gemBuilder = new MeshBuilder();
 * gemBuilder.addPart(createFacetedChunkGeometry(0.5, [1, 0.9, 1.1], [1, 1, 1]), Matrix4.createTranslation(0, 0.5, 0), "#a0c0ff", { hasOutline: false });
 * const gemMesh = renderer.createMesh(gemBuilder.readArrays());
 * const camera = new Camera3D();
 * camera.setPerspective(0.8, 0.1, 100);
 * camera.lookAt(Vector3.create(0, 2, 4), Vector3.create(0, 0.4, 0), Vector3.create(0, 1, 0));
 * const queue = new ToonDrawQueue();
 * queue.setScreenOutline(new ToonScreenOutline(webGL2RenderingContext));
 * queue.addMesh(floorMesh, Matrix4.createIdentity(), { lineId: 1, hasScreenOutline: false });
 * queue.addMesh(gemMesh, Matrix4.createIdentity(), { lineId: 2, hasCreaseLine: false });
 * queue.draw(renderer, camera);
 */
export class ToonDrawQueue {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Array<object> } */ #itemList; // 담은 칸. ({ mesh, modelMatrix, instances, instanceBuffer, instanceCount, options, isTransparent, depthPosition, depth }, 앞의 #itemCount 칸, 칸은 프레임마다 다시 쓴다)
	/** @private @type { Array<object> } */ #passList; // { stage, callback }
	/** @private @type { object | null } */ #screenOutline; // ToonScreenOutline. (없으면 null)
	/** @private @type { object | null } */ #postProcess; // ToonPostProcess. (모서리 어둠을 몸 앞에 셈한다, 없으면 null)
	/** @private @type { Array<object> | null } */ #opaqueItemList; // 정렬한 불투명한 것. (담거나 비우면 null, 처음 그릴 때 만든다)
	/** @private @type { number } */ #itemCount; // 담은 수. (#itemList 의 앞 칸만 쓴다, 뒤 칸은 다시 쓸 칸이다)
	/** @private @type { number } */ #batchMatrixCount; // #batchMatrices 의 쓴 수. (배열 길이를 줄이지 않아 프레임마다 다시 잡지 않는다)
	/** @private @type { number } */ #outlineBatchCount; // #outlineBatches 의 쓴 수.
	/** @private @type { number } */ #lineMatrixCount; // #lineMatrices, #lineIds 의 쓴 수.
	/** @private @type { Int32Array } */ #sortKeys; // 앞의 정렬의 불투명한 것 열쇠. (하나에 재질, 모형, 텍스처 번호 셋, 담은 차례대로)
	/** @private @type { Int32Array } */ #sortOrder; // 앞의 정렬 차례. (불투명한 것의 담은 차례 번호, 열쇠가 모두 같으면 다시 정렬하지 않고 쓴다)
	/** @private @type { number } */ #sortCount; // 앞의 정렬의 불투명한 것 수. (-1 이면 없음)
	/** @private @type { Array<object> } */ #opaqueScratch; // 담은 차례의 불투명한 것. (프레임마다 다시 쓴다)
	/** @private @type { boolean } */ #isResolved; // 담은 것마다 꼴을 풀었는지. (그리기 앞에 렌더러로 한 번)
	/** @private @type { Array<object> } */ #batchMatrices; // 자동 인스턴싱으로 묶은 행렬. (프레임마다 다시 쓴다)
	/** @private @type { Array<any> } */ #outlineBatches; // 바깥선 껍데기를 그릴 것. (담은 것, 행렬 자리, 수, 묶음 자리를 넷씩)
	/** @private @type { Array<number> } */ #lineIds; // 선의 판의 묶은 번호. (#lineMatrices 와 같은 자리)
	/** @private @type { Array<object> } */ #lineMatrices; // 선의 판의 묶은 행렬.
	/** @private @type { Array<object> } */ #opaqueStorage; // 정렬한 불투명한 것을 담는 칸. (프레임마다 다시 쓴다, #opaqueItemList 가 가리킨다)
	/** @private @type { Array<number> } */ #sortIndexList; // 정렬할 차례 번호. (다시 쓴다)
	/** @private @type { Array<object> } */ #casterList; // 그림자를 드리우는 것. (프레임마다 다시 쓴다)
	/** @private @type { Array<object> } */ #staticCasterList; // 구울 드리우개.
	/** @private @type { Array<object> } */ #dynamicCasterList; // 덧그릴 드리우개.
	/** @private @type { Float32Array } */ #lightKey; // 해 그림자의 빛 열쇠. (빛의 보기 투영 행렬 16 과 해상도, 다시 쓴다)
	/** @private @type { Float32Array } */ #localLightKey; // 점광과 스포트라이트 그림자의 빛 열쇠. (칸 수가 늘 때만 다시 짓는다)
	/** @private @type { Array<object> } */ #lineGroupPool; // 선의 판 묶음 칸. ({ item, lineFlags, indexStart, indexCount, itemIndexList, nextIndex }, 다시 쓴다)
	/** @private @type { number } */ #lineGroupCount; // 지금 쓰는 묶음 칸 수.
	/** @private @type { number } */ #lineBatchSlotCount; // 이 프레임 선의 판에서 지금까지 쓴 묶음 자리 수. (프레임마다 같은 차례로 자리를 준다)
	/** @private @type { number } */ #lineGroupSerial; // 묶음을 비울 때마다 오르는 번호. (모형마다 기억한 첫 묶음이 지금 것인지)
	/** @private @type { WeakMap<object, object> } */ #lineGroupOfMesh; // 모형 → { serial, firstIndex, lastIndex } (모형마다 한 번 짓는다)
	/** @private @type { Array<object> } */ #transparentPool; // 비치는 것 덩어리 칸. ({ depthSum, itemList, isDepthPrepassed, group }, 다시 쓴다)
	/** @private @type { Array<object> } */ #transparentList; // 이번 프레임의 덩어리.

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		this.#itemList = [];
		this.#itemCount = 0;
		this.#batchMatrixCount = 0;
		this.#outlineBatchCount = 0;
		this.#lineMatrixCount = 0;
		this.#passList = [];
		this.#screenOutline = null;
		this.#postProcess = null;
		this.#opaqueItemList = null;
		this.#sortKeys = new System.Int32Array(0);
		this.#sortOrder = new System.Int32Array(0);
		this.#sortCount = -1;
		this.#opaqueScratch = [];
		this.#isResolved = false;
		this.#batchMatrices = [];
		this.#outlineBatches = [];
		this.#lineIds = [];
		this.#lineMatrices = [];
		this.#opaqueStorage = [];
		this.#sortIndexList = [];
		this.#casterList = [];
		this.#staticCasterList = [];
		this.#dynamicCasterList = [];
		this.#lightKey = new System.Float32Array(17);
		this.#localLightKey = new System.Float32Array(0);
		this.#lineGroupPool = [];
		this.#lineGroupCount = 0;
		this.#lineGroupSerial = 0;
		this.#lineBatchSlotCount = 0;
		this.#lineGroupOfMesh = new System.WeakMap();
		this.#transparentPool = [];
		this.#transparentList = [];
	}

	//==============================================================================
	// 담은 것마다 꼴 풀기. (렌더러가 꼴 객체마다 기억한 푼 칸을 쓴다, 담은 뒤 처음 그릴 때 한 번)
	// - 비치는지, 그림자를 드리우는지, 선 번호, 묶음 같은 것을 칸 이름으로 읽지 않고 번호로 읽는다. (렌더러의 readDrawEntry 머리말)
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer.
	 * @private
	 */
	resolveItems(renderer) {
		if (this.#isResolved) {
			return;
		}
		const itemList = this.#itemList;
		for (let index = 0; index < this.#itemCount; ++index) {
			const item = itemList[index];
			const entry = this.readItemEntry(renderer, item);
			const state = entry.state;
			item.entry = entry;
			item.state = state;
			item.isTransparent = state[DRAW_STATE_IS_TRANSPARENT];
			// 자동 인스턴싱의 열쇠. (보통 모형 하나씩인 불투명한 것만, 감기는 0 이나 1)
			item.materialBlock = null;
			item.mirrorSign = 0;
			if (!item.isTransparent && item.modelMatrix !== null) {
				item.materialBlock = renderer.readEntryMaterialBlock(entry, item.options);
				const isMirrored = state[DRAW_STATE_IS_MIRRORED];
				item.mirrorSign = isMirrored >= 0 ? isMirrored : (readMatrixDeterminant(item.modelMatrix.getElements()) < 0 ? 1 : 0);
			}
		}
		this.#isResolved = true;
		this.#opaqueItemList = null;
	}

	//==============================================================================
	// 담은 칸 하나의 기억 칸 읽기. (ToonDrawItem 은 바뀜 표시가 있을 때만 다시 푼다, 꼴 객체는 렌더러가 꼴마다 기억한 칸, 처음 보는 꼴 객체는 담은 칸이 쥔 칸)
	// - 게임이 프레임마다 새로 짓는 꼴 객체는 꼴 객체마다 기억하지 않는다. 담은 칸이 쥔 기억 칸의 얕은 사본과 견주어 값이 같으면 그대로 쓴다. (할당 없음)
	// - 같은 꼴 객체가 같은 칸에 다시 오면 (게임이 지어 둔 꼴을 다시 쓰면) 렌더러가 꼴 객체마다 기억하게 한다. (맡긴 판에서 한 번만 견준다)
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer.
	 * @param { object } item - 담은 칸.
	 * @returns { object } 기억 칸.
	 * @private
	 */
	readItemEntry(renderer, item) {
		const options = item.options;
		if (item.drawItem !== null) {
			return item.drawItem.readDrawEntry(renderer);
		}
		const entry = renderer.findDrawEntry(options);
		if (entry !== null) {
			return entry;
		}
		const heldEntry = item.heldRenderer === renderer ? item.heldEntry : null;
		if (heldEntry !== null && heldEntry.options === options) {
			heldEntry.options = null;
			return renderer.readDrawEntry(options);
		}
		item.heldEntry = renderer.writeHeldDrawEntry(heldEntry, options, false);
		item.heldRenderer = renderer;
		return item.heldEntry;
	}

	//==============================================================================
	// 담을 칸 하나 꺼내기. (풀에서 다시 쓴다, 담은 것 목록에 넣는다)
	//==============================================================================
	/**
	 * @param { object } mesh - 모형.
	 * @param { Matrix4 | null } modelMatrix - 모형 행렬. (인스턴스면 null)
	 * @param { Array<object> | null } instances - 인스턴스 배열.
	 * @param { object | null } instanceBuffer - 인스턴스 버퍼.
	 * @param { number } instanceCount - 인스턴스 버퍼의 그릴 수.
	 * @param { object } options - 그리기 꼴.
	 * @returns { object } 담은 칸. (depthPosition 을 채운다)
	 * @private
	 */
	pushItem(mesh, modelMatrix, instances, instanceBuffer, instanceCount, options) {
		const itemList = this.#itemList;
		const itemCount = this.#itemCount;
		let item = itemList[itemCount];
		if (item === undefined) {
			item = { mesh: null, modelMatrix: null, instances: null, instanceBuffer: null, instanceCount: 0, options: null, drawItem: null, entry: null, heldEntry: null, heldRenderer: null, state: null, isTransparent: false, materialBlock: null, mirrorSign: 0, isStaticCaster: false, depthPosition: { x: 0, y: 0, z: 0 }, depth: 0 };
			itemList.push(item);
		}
		item.mesh = mesh;
		item.modelMatrix = modelMatrix;
		item.instances = instances;
		item.instanceBuffer = instanceBuffer;
		item.instanceCount = instanceCount;
		item.options = options;
		item.drawItem = null;
		item.entry = null;
		item.state = null;
		item.isTransparent = false;
		item.depth = 0;
		this.#opaqueItemList = null;
		this.#isResolved = false;
		this.#itemCount = itemCount + 1;
		return item;
	}

	//==============================================================================
	// 비우기. (프레임마다 담기 전에, 단계 콜백도 비운다, 화면 공간 바깥선은 그대로)
	//==============================================================================
	clear() {
		const itemList = this.#itemList;
		for (let index = 0; index < this.#itemCount; ++index) {
			const item = itemList[index];
			item.mesh = null;
			item.modelMatrix = null;
			item.instances = null;
			item.instanceBuffer = null;
			item.options = null;
			item.drawItem = null;
			item.entry = null;
			item.state = null;
			item.materialBlock = null;
		}
		this.#itemCount = 0;
		this.#passList.length = 0;
		this.#opaqueItemList = null;
	}

	//==============================================================================
	// 담은 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 담은 모형과 인스턴스 묶음 수.
	 */
	getItemCount() {
		return this.#itemCount;
	}

	//==============================================================================
	// 화면 공간 바깥선 맡기기. (draw 가 선의 판을 그리고 바깥선 껍데기 뒤에 섞는다, null 이면 맡기지 않음)
	//==============================================================================
	/**
	 * @param { object | null } screenOutline - ToonScreenOutline 이나 null.
	 * @example <caption>그리기 줄에 화면 공간 바깥선 맡기기</caption>
	 * import { ToonDrawQueue, ToonScreenOutline } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const queue = new ToonDrawQueue();
	 * const outline = new ToonScreenOutline(webGL2RenderingContext);
	 * outline.setWidth(2.5);
	 * queue.setScreenOutline(outline);
	 */
	setScreenOutline(screenOutline) {
		this.#screenOutline = screenOutline;
	}

	//==============================================================================
	// 맡긴 화면 공간 바깥선 반환. (없으면 null)
	//==============================================================================
	/**
	 * @returns { object | null } ToonScreenOutline 이나 null.
	 */
	getScreenOutline() {
		return this.#screenOutline;
	}

	//==============================================================================
	// 툰 후처리 맡기기. (모서리 어둠을 켰으면 draw 가 선의 판 뒤, 몸 앞에 셈해 렌더러에 걸고 endFrame 뒤에 푼다, null 이면 맡기지 않음)
	// - 화면 공간 바깥선이 있으면 그 선의 판을, 없으면 후처리의 미리 그리기(getAmbientOcclusionPrepass)로 노멀과 깊이만 그린다.
	//==============================================================================
	/**
	 * @param { object | null } postProcess - ToonPostProcess 나 null.
	 * @example <caption>바깥선과 모서리 어둠을 함께</caption>
	 * import { ToonDrawQueue, ToonScreenOutline, ToonPostProcess } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const postProcess = new ToonPostProcess(webGL2RenderingContext, 640, 360, { depthBits: 24 });
	 * postProcess.setAmbientOcclusion(true, 0.5, 0.5, 0.5);
	 * const queue = new ToonDrawQueue();
	 * queue.setScreenOutline(new ToonScreenOutline(webGL2RenderingContext));
	 * queue.setPostProcess(postProcess);
	 */
	setPostProcess(postProcess) {
		this.#postProcess = postProcess;
	}

	//==============================================================================
	// 맡긴 툰 후처리 반환. (없으면 null)
	//==============================================================================
	/**
	 * @returns { object | null } ToonPostProcess 나 null.
	 */
	getPostProcess() {
		return this.#postProcess;
	}

	//==============================================================================
	// 노멀과 깊이를 그릴 선의 판 주인. (화면 공간 바깥선, 없고 모서리 어둠을 켰으면 후처리의 미리 그리기, 둘 다 아니면 null)
	//==============================================================================
	/**
	 * @returns { object | null } ToonScreenOutline 이나 null.
	 * @private
	 */
	readLineSource() {
		if (this.#screenOutline !== null) {
			return this.#screenOutline;
		}
		const postProcess = this.#postProcess;
		return postProcess !== null && postProcess.isAmbientOcclusionEnabled() ? postProcess.getAmbientOcclusionPrepass() : null;
	}

	//==============================================================================
	// 모서리 어둠 셈하고 렌더러에 걸기. (켜지 않았으면 아무것도 하지 않고 false)
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer.
	 * @param { Matrix4 } viewMatrix - 보기 행렬.
	 * @param { Matrix4 } projectionMatrix - 투영 행렬.
	 * @returns { boolean } 렌더러에 걸었으면 true. (endFrame 뒤에 풀어야 한다)
	 * @private
	 */
	drawAmbientOcclusion(renderer, viewMatrix, projectionMatrix) {
		const postProcess = this.#postProcess;
		if (postProcess === null || !postProcess.isAmbientOcclusionEnabled()) {
			return false;
		}
		const lineSource = this.readLineSource();
		const texture = postProcess.drawAmbientOcclusion(lineSource.getLineTarget(), viewMatrix, projectionMatrix);
		if (texture === null) {
			return false;
		}
		renderer.setAmbientOcclusionTexture(texture, postProcess.getAmbientOcclusionDirectLightingStrength());
		return true;
	}

	//==============================================================================
	// 단계 콜백 담기. (ToonDrawStage 의 자리에서 callback(renderer, webGL2RenderingContext) 를 부른다, 담은 차례로)
	//==============================================================================
	/**
	 * @param { string } stage - ToonDrawStage.
	 * @param { Function } callback - (renderer, webGL2RenderingContext) 를 받는다. 부른 뒤 렌더러가 프레임의 그리기 상태를 다시 건다.
	 */
	addPass(stage, callback) {
		this.#passList.push({ stage: stage, callback: callback });
	}

	//==============================================================================
	// 모형 하나 담기. (null 이면 담지 않는다)
	//==============================================================================
	/**
	 * @param { object | null } mesh - ToonRenderer.createMesh 의 결과.
	 * @param { Matrix4 } modelMatrix - 모형 행렬. (draw 때까지 고치지 않는다)
	 * @param { object } [options] - ToonRenderer.drawMesh 의 꼴과 castsShadow (기본 true), group, isDepthPrepassed, lineId, hasScreenOutline (기본 true), hasCreaseLine (기본 true).
	 */
	addMesh(mesh, modelMatrix, options = EMPTY_OPTIONS) {
		if (mesh === null || mesh === undefined) {
			return;
		}
		const item = this.pushItem(mesh, modelMatrix, null, null, 0, options);
		// 가운데의 월드 자리. (Matrix4.transformPoint 와 같은 셈, 새 객체를 짓지 않는다)
		const center = mesh.boundingCenter;
		const elements = modelMatrix.getElements();
		const depthPosition = item.depthPosition;
		depthPosition.x = elements[0] * center[0] + elements[4] * center[1] + elements[8] * center[2] + elements[12];
		depthPosition.y = elements[1] * center[0] + elements[5] * center[1] + elements[9] * center[2] + elements[13];
		depthPosition.z = elements[2] * center[0] + elements[6] * center[1] + elements[10] * center[2] + elements[14];
	}

	//==============================================================================
	// 남겨 두는 그리기 항목 짓기. (한 번 짓고 쥐어 두었다가 프레임마다 addItem 으로 담는다, new ToonDrawItem 과 같다)
	//==============================================================================
	/**
	 * @param { object | null } mesh - ToonRenderer.createMesh 의 결과.
	 * @param { Matrix4 } modelMatrix - 모형 행렬. (복사해 쥔다, 바꾸면 그 항목의 setModelMatrix)
	 * @param { object } [options] - addMesh 와 같은 꼴. (쥐어 둔다, 고치면 markDirty 나 setOption)
	 * @returns { ToonDrawItem } 그리기 항목.
	 * @example <caption>부품마다 항목을 한 번 짓고 프레임마다 담기</caption>
	 * import { ToonRenderer, ToonDrawQueue, MeshBuilder, createBoxGeometry, Camera3D, Matrix4, Vector3 } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * const builder = new MeshBuilder();
	 * builder.addPart(createBoxGeometry(1, 1, 1), Matrix4.createIdentity(), "#c08060");
	 * const boxMesh = renderer.createMesh(builder.readArrays());
	 * const camera = new Camera3D();
	 * camera.setPerspective(0.8, 0.1, 100);
	 * camera.lookAt(Vector3.create(0, 2, 4), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
	 * const queue = new ToonDrawQueue();
	 * const boxItem = queue.createItem(boxMesh, Matrix4.createTranslation(0, 0.5, 0), { tintColor: [1, 0.8, 0.8, 1], lineId: 1 });
	 * queue.clear();
	 * queue.addItem(boxItem);
	 * queue.draw(renderer, camera);
	 * boxItem.setOption("tintColor", [0.8, 1, 0.8, 1]);
	 */
	createItem(mesh, modelMatrix, options = {}) {
		return new ToonDrawItem(mesh, modelMatrix, options);
	}

	//==============================================================================
	// 남겨 두는 그리기 항목 담기. (addMesh 와 같은 자리, 바뀜 표시가 없으면 앞서 푼 꼴을 그대로 쓴다)
	// - 꼴 객체를 프레임마다 견주거나 풀지 않는다. 꼴을 고쳤으면 그 항목의 markDirty 나 setOption, setOptions 를 부른다. (유니티 MeshRenderer, 언리얼 프리미티브 컴포넌트 꼴)
	// - 바뀐 것이 없는 항목은 그림자 캐시(onChange)도 견주지 않는다. 행렬을 바꾸면 setModelMatrix 로 넘긴다.
	//==============================================================================
	/**
	 * @param { ToonDrawItem } drawItem - createItem 이나 new ToonDrawItem 의 결과.
	 * @example <caption>남겨 두는 항목 담기</caption>
	 * import { ToonDrawQueue, ToonDrawItem, Matrix4 } from "./vanilla.js";
	 * const queue = new ToonDrawQueue();
	 * const drawItem = new ToonDrawItem(null, Matrix4.createIdentity(), { lineId: 3 });
	 * queue.clear();
	 * queue.addItem(drawItem);
	 */
	addItem(drawItem) {
		const mesh = drawItem.getMesh();
		if (mesh === null || mesh === undefined) {
			return;
		}
		this.addMesh(mesh, drawItem.getModelMatrix(), drawItem.getOptions());
		this.#itemList[this.#itemCount - 1].drawItem = drawItem;
	}

	//==============================================================================
	// 같은 모형 여럿 담기. (GPU 인스턴싱, 비어 있거나 null 이면 담지 않는다)
	//==============================================================================
	/**
	 * @param { object | null } mesh - ToonRenderer.createMesh 의 결과.
	 * @param { Array<object> } instances - { modelMatrix, tintColor, lineId (선택) } 의 배열.
	 * @param { object } [options] - addMesh 와 같다.
	 */
	addMeshInstanced(mesh, instances, options = EMPTY_OPTIONS) {
		if (mesh === null || mesh === undefined || instances.length === 0) {
			return;
		}
		const item = this.pushItem(mesh, null, instances, null, 0, options);
		const depthPosition = item.depthPosition;
		depthPosition.x = 0;
		depthPosition.y = 0;
		depthPosition.z = 0;
		for (const instance of instances) {
			const elements = instance.modelMatrix.getElements();
			depthPosition.x += elements[12];
			depthPosition.y += elements[13];
			depthPosition.z += elements[14];
		}
		depthPosition.x /= instances.length;
		depthPosition.y /= instances.length;
		depthPosition.z /= instances.length;
	}

	//==============================================================================
	// 영구 인스턴스 버퍼로 같은 모형 여럿 담기. (몸, 바깥선 껍데기, 그림자, 선의 판이 한 GPU 버퍼를 같이 쓰고 다시 올리지 않는다)
	// - 버퍼는 ToonRenderer.createInstanceBuffer 로 짓고 updateInstanceBuffer, updateInstanceBufferRange 로 고친다. 버퍼 전체의 경계로 통째 거른다.
	// - 인스턴스마다 선 번호는 꼴의 instanceLineId 칸, 없으면 options.lineId (주지 않으면 담은 차례 + 1).
	// - 그림자 캐시(ShadowUpdateMode.onChange)는 버퍼의 generation 으로 고친 것을 안다.
	//==============================================================================
	/**
	 * @param { object | null } mesh - ToonRenderer.createMesh 의 결과.
	 * @param { object | null } instanceBuffer - ToonRenderer.createInstanceBuffer 의 결과.
	 * @param { number } instanceCount - 그릴 인스턴스 수. (버퍼에 든 수를 넘으면 자른다, 0 이하면 담지 않는다)
	 * @param { object } [options] - addMesh 와 같다.
	 * @example <caption>광부의 바위 밭을 한 번 올린 버퍼로 그리고 하나만 고치기</caption>
	 * import { ToonRenderer, ToonDrawQueue, ToonScreenOutline, MeshBuilder, createOctahedronGeometry, Camera3D, Matrix4, Vector3 } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * const builder = new MeshBuilder();
	 * builder.addPart(createOctahedronGeometry(0.3), Matrix4.createIdentity(), "#a89880");
	 * const rockMesh = renderer.createMesh(builder.readArrays());
	 * const instanceLayout = renderer.createInstanceLayout([{ name: "instanceMatrix", size: 16 }, { name: "instanceTint", size: 4 }, { name: "instanceLineId", size: 1 }]);
	 * const floatCount = instanceLayout.getFloatCount();
	 * const data = new Float32Array(floatCount * 25);
	 * for (let index = 0; index < 25; ++index) {
	 * 	data.set(Matrix4.createTranslation(index % 5 - 2, 0, Math.floor(index / 5) - 2).getElements(), index * floatCount);
	 * 	data.set([1, 1, 1, 1, 1 + index], index * floatCount + 16);
	 * }
	 * const instanceBuffer = renderer.createInstanceBuffer(instanceLayout, data, "dynamic");
	 * const camera = new Camera3D();
	 * camera.setPerspective(0.8, 0.1, 50);
	 * camera.lookAt(Vector3.create(0, 5, 6), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
	 * const queue = new ToonDrawQueue();
	 * queue.setScreenOutline(new ToonScreenOutline(webGL2RenderingContext));
	 * queue.addMeshInstanceBuffer(rockMesh, instanceBuffer, 25);
	 * queue.draw(renderer, camera);
	 * const brokenRock = data.slice(12 * floatCount, 13 * floatCount);
	 * brokenRock.set([0.5, 0.5, 0.5, 1], 16);
	 * renderer.updateInstanceBufferRange(instanceBuffer, 12, brokenRock);
	 * queue.draw(renderer, camera);
	 */
	addMeshInstanceBuffer(mesh, instanceBuffer, instanceCount, options = EMPTY_OPTIONS) {
		if (mesh === null || mesh === undefined || instanceBuffer === null || instanceBuffer === undefined || instanceCount <= 0) {
			return;
		}
		const sphere = INSTANCE_BUFFER_SPHERE;
		const hasSphere = writeInstanceBufferSphere(sphere, mesh, instanceBuffer);
		const item = this.pushItem(mesh, null, null, instanceBuffer, instanceCount, options);
		item.depthPosition.x = hasSphere ? sphere[0] : 0;
		item.depthPosition.y = hasSphere ? sphere[1] : 0;
		item.depthPosition.z = hasSphere ? sphere[2] : 0;
	}

	//==============================================================================
	// 그릴 꼴이 비치는지. (alpha 나 틴트의 알파가 1 보다 작거나 섞는 방식이 곧은 알파가 아님)
	//==============================================================================
	/**
	 * @param { object } options - 그리기 꼴.
	 * @returns { boolean } 비치면 true.
	 */
	isTransparentOptions(options) {
		const alpha = options.alpha !== undefined ? options.alpha : 1;
		const tintAlpha = options.tintColor !== undefined ? options.tintColor[3] : 1;
		const blendMode = options.blendMode !== undefined ? options.blendMode : ToonBlendMode.alpha;
		return alpha < 1 || tintAlpha < 1 || blendMode !== ToonBlendMode.alpha;
	}

	//==============================================================================
	// 그림자 깊이 그리기. (불투명하고 castsShadow 가 false 가 아닌 것만, 앞의 프레임버퍼와 뷰포트는 되돌린다)
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer.
	 * @param { object } shadowMap - ShadowMap.
	 */
	drawShadows(renderer, shadowMap) {
		const lightKey = this.#lightKey;
		lightKey.set(shadowMap.getLightViewProjectionMatrix().getElements());
		lightKey[16] = shadowMap.getResolution();
		renderer.beginTrustedOptions();
		try {
			this.drawShadowCasters(renderer, shadowMap.getShadowCache(), lightKey, shadowMap, null);
		}
		finally {
			renderer.endTrustedOptions();
		}
	}

	//==============================================================================
	// 점광과 스포트라이트 그림자 깊이 그리기. (불투명하고 castsShadow 가 false 가 아닌 것을 아틀라스의 칸마다, 앞의 프레임버퍼와 뷰포트는 되돌린다)
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer.
	 * @param { object } shadowAtlas - ShadowAtlas. (updateLights 를 부른 것)
	 * @example <caption>점광 그림자를 굽고 받기</caption>
	 * import { ToonRenderer, ToonDrawQueue, MeshBuilder, createBoxGeometry, createSphereGeometry, ShadowAtlas, Camera3D, Matrix4, Vector3 } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * const builder = new MeshBuilder();
	 * builder.addPart(createBoxGeometry(4, 0.2, 4), Matrix4.createTranslation(0, -0.1, 0), "#8090a0", { hasOutline: false });
	 * builder.addPart(createSphereGeometry(0.5, 24, 16), Matrix4.createTranslation(0, 0.5, 0), "#f0e0d0", { hasOutline: false });
	 * const mesh = renderer.createMesh(builder.readArrays());
	 * renderer.setPointLights([{ position: [1, 2, 1], color: [1, 0.85, 0.6], intensity: 4, range: 8, castsShadow: true }]);
	 * const shadowAtlas = new ShadowAtlas(webGL2RenderingContext, 1024);
	 * shadowAtlas.updateLights(renderer.getLightSet().getPointLights());
	 * renderer.setLocalShadows(shadowAtlas, 1);
	 * const camera = new Camera3D();
	 * camera.setPerspective(0.8, 0.1, 50);
	 * camera.lookAt(Vector3.create(0, 3, 5), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
	 * const queue = new ToonDrawQueue();
	 * queue.addMesh(mesh, Matrix4.createIdentity());
	 * queue.drawLocalShadows(renderer, shadowAtlas);
	 * queue.draw(renderer, camera);
	 */
	drawLocalShadows(renderer, shadowAtlas) {
		const tileCount = shadowAtlas.getTileCount();
		if (this.#localLightKey.length !== 1 + tileCount * 19) {
			this.#localLightKey = new System.Float32Array(1 + tileCount * 19);
		}
		const lightKey = this.#localLightKey;
		lightKey[0] = shadowAtlas.getResolution();
		for (let tileIndex = 0; tileIndex < tileCount; ++tileIndex) {
			const tile = shadowAtlas.getTile(tileIndex);
			const offset = 1 + tileIndex * 19;
			lightKey.set(tile.viewProjectionMatrix.getElements(), offset);
			lightKey[offset + 16] = tile.x;
			lightKey[offset + 17] = tile.y;
			lightKey[offset + 18] = tile.size;
		}
		renderer.beginTrustedOptions();
		try {
			this.drawShadowCasters(renderer, shadowAtlas.getShadowCache(), lightKey, null, shadowAtlas);
		}
		finally {
			renderer.endTrustedOptions();
		}
	}

	//==============================================================================
	// 그림자 드리우개 그리기. (그림자 판의 갱신 방식대로 다시 그리거나 건너뛴다, 불투명하고 castsShadow 가 false 가 아닌 것만)
	// - everyFrame: 판을 비우고 전부 그린다.
	// - interval: N 프레임마다(처음과 requestUpdate 뒤에는 바로) 판을 비우고 전부 그린다. 사이의 프레임은 그리지 않는다.
	// - onChange: 드리우개를 담은 차례로 앞의 프레임과 견준다. (모형, 재질, 행렬, 뼈대처럼 깊이에 닿는 것만, 틴트와 색 같은 재질 값으로 바뀌는 정렬 차례로 견주지 않는다)
	//   SHADOW_STATIC_FRAME_COUNT 프레임 그대로인 것은 구운 판에 굽고,
	//   나머지(움직이는 것, 정점 조각이 있는 재질)는 매 프레임 구운 판을 판에 옮긴 뒤 그 위에 덧그린다.
	//   구운 것이 바뀌거나 빠지거나 새로 구울 것이 생기거나 requestUpdate 를 부르면 다시 굽는다. 움직이는 것이 없고 판이 구운 판과 같으면 아무것도 그리지 않는다.
	//   빛 행렬이나 칸이 바뀐 프레임은 전부를 판에 바로 그리고, 빛이 멈춘 다음 프레임에 굽는다.
	//   깊이는 LEQUAL 로 가장 가까운 것이 남으므로 굽고 덧그린 판은 전부를 한 번에 그린 판과 같다.
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer.
	 * @param { object } shadowCache - ShadowMap 이나 ShadowAtlas 의 getShadowCache().
	 * @param { Float32Array } lightKey - 빛 행렬과 판의 꼴. (다르면 다시 굽는다)
	 * @param { object | null } shadowMap - 해 그림자의 ShadowMap. (아니면 null)
	 * @param { object | null } shadowAtlas - 점광과 스포트라이트 그림자의 ShadowAtlas. (아니면 null, 칸마다 그린다)
	 * @private
	 */
	drawShadowCasters(renderer, shadowCache, lightKey, shadowMap, shadowAtlas) {
		this.resolveItems(renderer);
		const casterList = this.#casterList;
		const opaqueItemList = this.readOpaqueItemList();
		let casterCount = 0;
		for (let index = 0; index < opaqueItemList.length; ++index) {
			const item = opaqueItemList[index];
			if (item.state[DRAW_STATE_CASTS_SHADOW]) {
				casterList[casterCount] = item;
				casterCount += 1;
			}
		}
		setListLength(casterList, casterCount);
		const updateMode = shadowCache.updateMode;
		if (updateMode === ShadowUpdateMode.everyFrame) {
			shadowCache.casterRecords.length = 0;
			shadowCache.lightKey = null;
			shadowCache.hasCache = false;
			this.drawShadowPass(renderer, shadowCache, "live", casterList, shadowMap, shadowAtlas);
			return;
		}
		if (updateMode === ShadowUpdateMode.interval) {
			const isDue = shadowCache.isUpdateRequested || shadowCache.frameCount % shadowCache.updateInterval === 0;
			shadowCache.frameCount += 1;
			if (isDue) {
				shadowCache.isUpdateRequested = false;
				shadowCache.hasCache = false;
				this.drawShadowPass(renderer, shadowCache, "live", casterList, shadowMap, shadowAtlas);
			}
			return;
		}

		// 바뀔 때만. (드리우개를 담은 차례로 견준다)
		const isLightChanged = !isSameValues(shadowCache.lightKey, lightKey);
		let isCacheStale = shadowCache.isUpdateRequested;
		shadowCache.isUpdateRequested = false;
		if (shadowCache.lightKey !== null && shadowCache.lightKey.length === lightKey.length) {
			shadowCache.lightKey.set(lightKey);
		}
		else {
			shadowCache.lightKey = lightKey.slice();
		}
		const recordList = shadowCache.casterRecords;
		for (let recordIndex = casterList.length; recordIndex < recordList.length; ++recordIndex) {
			isCacheStale = isCacheStale || recordList[recordIndex].isStatic;
		}
		if (recordList.length > casterList.length) {
			recordList.length = casterList.length;
		}
		// 기록은 담은 차례로 견준다. (정렬 차례는 재질 블록 같은 깊이에 닿지 않는 값으로도 바뀌어, 그 차례로 견주면 바뀌지 않은 드리우개도 다르게 보인다)
		const itemList = this.#itemList;
		let casterIndex = 0;
		for (let index = 0; index < this.#itemCount; ++index) {
			const item = itemList[index];
			if (item.isTransparent || !item.state[DRAW_STATE_CASTS_SHADOW]) {
				continue;
			}
			if (casterIndex >= recordList.length) {
				recordList.push({ mesh: null, material: undefined, instanceBuffer: null, generation: -1, values: new System.Float32Array(0), stableFrameCount: 0, isStatic: false, drawItem: null, changeSerial: -1 });
			}
			const record = recordList[casterIndex];
			casterIndex += 1;
			const material = item.state[DRAW_STATE_MATERIAL];
			const isVertexAnimated = material !== undefined && material !== null && material.getVertexChunk() !== "";
			if (this.isCasterChanged(record, item) || isVertexAnimated) {
				isCacheStale = isCacheStale || record.isStatic;
				record.isStatic = false;
				record.stableFrameCount = 0;
			}
			else {
				record.stableFrameCount += 1;
				if (!record.isStatic && record.stableFrameCount >= SHADOW_STATIC_FRAME_COUNT) {
					record.isStatic = true;
					isCacheStale = true;
				}
			}
			item.isStaticCaster = record.isStatic;
		}
		// 굽는 것과 덧그리는 것은 정렬 차례로 나눈다. (자동 인스턴싱으로 이어진 같은 것을 묶는다)
		const staticList = this.#staticCasterList;
		const dynamicList = this.#dynamicCasterList;
		let staticCount = 0;
		let dynamicCount = 0;
		for (let index = 0; index < casterList.length; ++index) {
			const item = casterList[index];
			if (item.isStaticCaster) {
				staticList[staticCount] = item;
				staticCount += 1;
			}
			else {
				dynamicList[dynamicCount] = item;
				dynamicCount += 1;
			}
		}
		setListLength(staticList, staticCount);
		setListLength(dynamicList, dynamicCount);
		if (isLightChanged) {
			// 빛이 바뀐 프레임은 전부를 판에 바로 그린다. (빛이 매 프레임 움직여도 굽고 옮기는 몫이 더 들지 않게, 구운 판은 빛이 멈춘 다음 프레임에 굽는다)
			shadowCache.hasCache = false;
			this.drawShadowPass(renderer, shadowCache, "live", casterList, shadowMap, shadowAtlas);
			return;
		}
		if (isCacheStale || (!shadowCache.hasCache && staticList.length > 0)) {
			shadowCache.hasCache = staticList.length > 0;
			if (shadowCache.hasCache) {
				this.drawShadowPass(renderer, shadowCache, "cache", staticList, shadowMap, shadowAtlas);
			}
			shadowCache.isDepthCurrent = false;
		}
		if (dynamicList.length > 0) {
			this.drawShadowPass(renderer, shadowCache, shadowCache.hasCache ? "copy" : "live", dynamicList, shadowMap, shadowAtlas);
			return;
		}
		if (!shadowCache.isDepthCurrent) {
			this.drawShadowPass(renderer, shadowCache, shadowCache.hasCache ? "copy" : "live", dynamicList, shadowMap, shadowAtlas);
			shadowCache.isDepthCurrent = true;
		}
	}

	//==============================================================================
	// 그림자 깊이 패스 하나. (renderTarget 은 그림자 캐시의 판: live, cache, copy, 해 그림자면 판 하나, 아틀라스면 칸마다)
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer.
	 * @param { object } shadowCache - 그림자 캐시.
	 * @param { string } renderTarget - "live", "cache", "copy".
	 * @param { Array<object> } itemList - 그릴 드리우개.
	 * @param { object | null } shadowMap - 해 그림자의 ShadowMap.
	 * @param { object | null } shadowAtlas - 점광과 스포트라이트 그림자의 ShadowAtlas.
	 * @private
	 */
	drawShadowPass(renderer, shadowCache, renderTarget, itemList, shadowMap, shadowAtlas) {
		shadowCache.renderTarget = renderTarget;
		if (shadowAtlas !== null) {
			renderer.beginShadowAtlasPass(shadowAtlas);
			const tileCount = shadowAtlas.getTileCount();
			for (let tileIndex = 0; tileIndex < tileCount; ++tileIndex) {
				renderer.setShadowAtlasTile(shadowAtlas, tileIndex);
				this.drawCasterList(renderer, itemList);
			}
		}
		else {
			renderer.beginShadowPass(shadowMap);
			this.drawCasterList(renderer, itemList);
		}
		renderer.endShadowPass();
	}

	//==============================================================================
	// 드리우개가 앞의 프레임과 다른지. (바뀐 것이 없는 ToonDrawItem 은 견주지 않는다, 뼈대 행렬이 있으면 견준다)
	//==============================================================================
	/**
	 * @param { object } record - 드리우개 기록.
	 * @param { object } item - 담은 것.
	 * @returns { boolean } 다르면 true.
	 * @private
	 */
	isCasterChanged(record, item) {
		const drawItem = item.drawItem;
		if (drawItem !== null && record.drawItem === drawItem && record.changeSerial === drawItem.getChangeSerial() && item.state[DRAW_STATE_JOINT_MATRICES] === null) {
			return false;
		}
		const isChanged = writeCasterRecord(record, item);
		record.drawItem = drawItem;
		record.changeSerial = drawItem !== null ? drawItem.getChangeSerial() : -1;
		return isChanged;
	}

	//==============================================================================
	// 담은 것 그리기. (화면 공간 바깥선이 있으면 선의 판부터, beginFrameWithCamera 와 endFrame 을 스스로 부른다)
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer.
	 * @param { object } camera - Camera3D.
	 */
	draw(renderer, camera) {
		renderer.beginTrustedOptions();
		let isAmbientOcclusionApplied = false;
		try {
			this.drawLineIds(renderer, camera.getViewMatrix(), camera.getProjectionMatrix());
			isAmbientOcclusionApplied = this.drawAmbientOcclusion(renderer, camera.getViewMatrix(), camera.getProjectionMatrix());
			renderer.beginFrameWithCamera(camera);
			this.drawStages(renderer, (position) => {
				return camera.readViewDepth(position.x, position.y, position.z);
			});
			renderer.endFrame();
		}
		finally {
			if (isAmbientOcclusionApplied) {
				renderer.setAmbientOcclusionTexture(null);
			}
			renderer.endTrustedOptions();
		}
	}

	//==============================================================================
	// 보기와 투영 행렬로 담은 것 그리기. (Camera3D 없이, beginFrameWithMatrices 와 endFrame 을 스스로 부른다)
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer.
	 * @param { Matrix4 } viewMatrix - 보기 행렬.
	 * @param { Matrix4 } projectionMatrix - 투영 행렬.
	 */
	drawWithMatrices(renderer, viewMatrix, projectionMatrix) {
		renderer.beginTrustedOptions();
		let isAmbientOcclusionApplied = false;
		try {
			this.drawLineIds(renderer, viewMatrix, projectionMatrix);
			isAmbientOcclusionApplied = this.drawAmbientOcclusion(renderer, viewMatrix, projectionMatrix);
			renderer.beginFrameWithMatrices(viewMatrix, projectionMatrix);
			const elements = viewMatrix.getElements();
			this.drawStages(renderer, (position) => {
				return -(elements[2] * position.x + elements[6] * position.y + elements[10] * position.z + elements[14]);
			});
			renderer.endFrame();
		}
		finally {
			if (isAmbientOcclusionApplied) {
				renderer.setAmbientOcclusionTexture(null);
			}
			renderer.endTrustedOptions();
		}
	}

	//==============================================================================
	// 화면 공간 바깥선의 선의 판 그리기. (맡긴 것이 없으면 아무것도 하지 않음, 불투명한 것만, 화면 사각형이 있으면 그 사각형을 그리는 영역으로)
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer.
	 * @param { Matrix4 } viewMatrix - 보기 행렬.
	 * @param { Matrix4 } projectionMatrix - 투영 행렬.
	 */
	drawLineIds(renderer, viewMatrix, projectionMatrix) {
		this.resolveItems(renderer);
		const screenOutline = this.readLineSource();
		if (screenOutline === null) {
			return;
		}
		const webGL2RenderingContext = renderer.getWebGL2RenderingContext();
		const screenRect = renderer.getScreenRect();
		const viewport = webGL2RenderingContext.getParameter(webGL2RenderingContext.VIEWPORT);
		if (screenRect !== null) {
			const left = System.Math.floor(screenRect.x);
			const bottom = System.Math.floor(viewport[3] - screenRect.y - screenRect.height);
			webGL2RenderingContext.viewport(viewport[0] + left, viewport[1] + bottom, System.Math.max(1, System.Math.round(screenRect.width)), System.Math.max(1, System.Math.round(screenRect.height)));
		}
		if (screenOutline.beginLineIds(viewMatrix, projectionMatrix)) {
			// 자동 인스턴싱: 보통 모형은 담은 차례로 거르고 초점 거리에 더한 뒤(acceptMesh), 같은 모형과 선 꼴인 것을 모아 인스턴스 그리기 한 번으로.
			// (번호는 인스턴스마다, 깊이가 같은 곳이 아니면 그리는 차례와 상관없이 같은 판)
			// 감기를 뒤집는 것(행렬식이 음수, 거울에 비친 모습)은 뒤집는 것끼리 묶는다. 묶지 않는 것(인스턴스 묶음, 인스턴스 버퍼, 뼈대)을 만나면 모은 것을 먼저 그려 그것과의 차례는 담은 차례 그대로 둔다. (선의 판은 LEQUAL)
			const lineMatrices = this.#lineMatrices;
			const lineIds = this.#lineIds;
			this.#lineMatrixCount = 0;
			this.#lineGroupCount = 0;
			this.#lineGroupSerial += 1;
			this.#lineBatchSlotCount = 0;
			const itemList = this.#itemList;
			for (let itemIndex = 1; itemIndex <= this.#itemCount; ++itemIndex) {
				const item = itemList[itemIndex - 1];
				if (item.isTransparent) {
					continue;
				}
				const stateLineId = item.state[DRAW_STATE_LINE_ID];
				const lineId = stateLineId !== null ? stateLineId : (itemIndex - 1) % TOON_SCREEN_OUTLINE_MAXIMUM_LINE_ID + 1;
				if (item.instanceBuffer !== null) {
					this.flushLineGroups(screenOutline);
					screenOutline.drawMeshInstanceBuffer(item.mesh, item.instanceBuffer, item.instanceCount, lineId, item.options);
					continue;
				}
				if (item.instances !== null) {
					this.flushLineGroups(screenOutline);
					screenOutline.drawMeshInstanced(item.mesh, item.instances, lineId, item.options);
					continue;
				}
				if (item.state[DRAW_STATE_JOINT_MATRICES] !== null) {
					this.flushLineGroups(screenOutline);
					screenOutline.drawMesh(item.mesh, item.modelMatrix, lineId, item.options);
					continue;
				}
				if (!screenOutline.acceptMesh(item.mesh, item.modelMatrix.getElements(), item.state[DRAW_STATE_IS_CULLED])) {
					continue;
				}
				const options = item.options;
				const lineFlags = (options.hasCreaseLine !== false ? 1 : 0) + (options.hasScreenOutline !== false ? 2 : 0);
				const indexStart = options.indexStart;
				const indexCount = options.indexCount;
				const isMirrored = item.mirrorSign === 1;
				// 모형마다 그 모형의 묶음을 잇는다. (모형마다 기억한 첫 묶음 자리, 묶음 번호가 지금 것이 아니면 비었다)
				let meshGroups = this.#lineGroupOfMesh.get(item.mesh);
				if (meshGroups === undefined) {
					meshGroups = { serial: -1, firstIndex: -1, lastIndex: -1 };
					this.#lineGroupOfMesh.set(item.mesh, meshGroups);
				}
				if (meshGroups.serial !== this.#lineGroupSerial) {
					meshGroups.serial = this.#lineGroupSerial;
					meshGroups.firstIndex = -1;
					meshGroups.lastIndex = -1;
				}
				const groupPool = this.#lineGroupPool;
				let group = null;
				for (let groupIndex = meshGroups.firstIndex; groupIndex >= 0; groupIndex = groupPool[groupIndex].nextIndex) {
					const candidate = groupPool[groupIndex];
					if (candidate.lineFlags === lineFlags && candidate.isMirrored === isMirrored && candidate.indexStart === indexStart && candidate.indexCount === indexCount) {
						group = candidate;
						break;
					}
				}
				if (group === null) {
					const groupIndex = this.#lineGroupCount;
					group = groupPool[groupIndex];
					if (group === undefined) {
						group = { item: null, lineFlags: 0, isMirrored: false, indexStart: undefined, indexCount: undefined, itemIndexList: [], itemIndexCount: 0, nextIndex: -1 };
						groupPool.push(group);
					}
					group.item = item;
					group.lineFlags = lineFlags;
					group.isMirrored = isMirrored;
					group.indexStart = indexStart;
					group.indexCount = indexCount;
					group.itemIndexCount = 0;
					group.nextIndex = -1;
					this.#lineGroupCount = groupIndex + 1;
					if (meshGroups.lastIndex >= 0) {
						groupPool[meshGroups.lastIndex].nextIndex = groupIndex;
					}
					else {
						meshGroups.firstIndex = groupIndex;
					}
					meshGroups.lastIndex = groupIndex;
				}
				group.itemIndexList[group.itemIndexCount] = this.#lineMatrixCount;
				group.itemIndexCount += 1;
				this.pushLineMatrix(item.modelMatrix, lineId);
			}
			// 묶음마다 이어 담아 그린다. (뒤쪽 자리에 차례로 옮겨 담는다)
			this.flushLineGroups(screenOutline);
			screenOutline.endLineIds();
		}
		webGL2RenderingContext.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);
	}

	//==============================================================================
	// 선의 판 묶음 그리기. (모은 묶음마다 행렬과 번호를 뒤쪽 자리에 이어 옮겨 담아 인스턴스 그리기 한 번, 묶음과 쓴 수를 비운다)
	//==============================================================================
	/**
	 * @param { object } screenOutline - ToonScreenOutline.
	 * @private
	 */
	flushLineGroups(screenOutline) {
		const lineMatrices = this.#lineMatrices;
		const lineIds = this.#lineIds;
		const groupPool = this.#lineGroupPool;
		for (let groupIndex = 0; groupIndex < this.#lineGroupCount; ++groupIndex) {
			const group = groupPool[groupIndex];
			const start = this.#lineMatrixCount;
			for (let index = 0; index < group.itemIndexCount; ++index) {
				const sourceIndex = group.itemIndexList[index];
				this.pushLineMatrix(lineMatrices[sourceIndex], lineIds[sourceIndex]);
			}
			screenOutline.drawMeshBatch(group.item.mesh, lineMatrices, lineIds, start, this.#lineMatrixCount - start, group.item.options, this.#lineBatchSlotCount, group.isMirrored);
			this.#lineBatchSlotCount += 1;
			group.item = null;
		}
		this.#lineGroupCount = 0;
		this.#lineGroupSerial += 1;
		this.#lineMatrixCount = 0;
	}

	//==============================================================================
	// 선의 판 행렬과 번호 하나 더하기. (쓴 수 자리에, 배열 길이를 줄이지 않는다)
	//==============================================================================
	/**
	 * @param { Matrix4 } matrix - 모형 행렬.
	 * @param { number } lineId - 선 번호.
	 * @private
	 */
	pushLineMatrix(matrix, lineId) {
		const index = this.#lineMatrixCount;
		this.#lineMatrices[index] = matrix;
		this.#lineIds[index] = lineId;
		this.#lineMatrixCount = index + 1;
	}

	//==============================================================================
	// 한 단계의 콜백 부르기. (부른 뒤 프레임의 그리기 상태를 다시 건다)
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer.
	 * @param { string } stage - ToonDrawStage.
	 */
	runPasses(renderer, stage) {
		let isRun = false;
		for (const pass of this.#passList) {
			if (pass.stage !== stage) {
				continue;
			}
			// 콜백은 렌더러로 바로 그릴 수 있다. (그 꼴은 그리기마다 견준다)
			renderer.pauseTrustedOptions(true);
			try {
				pass.callback(renderer, renderer.getWebGL2RenderingContext());
			}
			finally {
				renderer.pauseTrustedOptions(false);
			}
			isRun = true;
		}
		if (isRun) {
			renderer.applyFrameState();
		}
	}

	//==============================================================================
	// 단계마다 그리기. (beginFrame 과 endFrame 사이, readDepth(자리) 는 카메라에서의 보기 깊이)
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer.
	 * @param { Function } readDepth - ({ x, y, z }) 의 보기 깊이를 돌려준다.
	 */
	drawStages(renderer, readDepth) {
		this.resolveItems(renderer);
		const itemList = this.#itemList;
		const webGL2RenderingContext = renderer.getWebGL2RenderingContext();
		this.runPasses(renderer, ToonDrawStage.beforeOpaque);

		// 1. 불투명한 몸. (인스턴스 묶음과 인스턴스 버퍼는 바깥선까지 한 번에)
		// - 자동 인스턴싱: 정렬로 이어진 같은 모형, 같은 재질 블록의 보통 모형은 인스턴스 그리기 한 번으로. (거르기는 하나씩 먼저)
		const outlineBatches = this.#outlineBatches;
		const batchMatrices = this.#batchMatrices;
		this.#outlineBatchCount = 0;
		this.#batchMatrixCount = 0;
		const opaqueItemList = this.readOpaqueItemList();
		let itemIndex = 0;
		let slotIndex = 0;
		while (itemIndex < opaqueItemList.length) {
			const item = opaqueItemList[itemIndex];
			itemIndex += 1;
			if (item.instances !== null || item.instanceBuffer !== null) {
				this.drawItem(renderer, item, item.options);
				continue;
			}
			// 화면 밖이면 drawMesh 가 걸러 센다. 바깥선도 담지 않는다.
			if (item.state[DRAW_STATE_IS_CULLED] && !renderer.isVisible(item.mesh, item.modelMatrix.getElements())) {
				this.drawItem(renderer, item, item.options);
				continue;
			}
			const start = this.#batchMatrixCount;
			this.pushBatchMatrix(item.modelMatrix);
			itemIndex = this.collectBatch(renderer, opaqueItemList, itemIndex, item);
			const count = this.#batchMatrixCount - start;
			// 몸만. (바깥선 껍데기는 몸을 다 그린 뒤 몰아 그린다, 꼴 객체를 새로 짓지 않아 렌더러가 꼴마다 기억한 재질 블록을 그대로 쓴다)
			renderer.setDrawEntryHint(item.options, item.entry);
			if (count === 1) {
				renderer.drawMeshBody(item.mesh, item.modelMatrix, item.options);
			}
			else {
				renderer.drawMeshBatch(item.mesh, batchMatrices, start, count, item.options, DRAW_PART_BODY, slotIndex);
			}
			if (item.state[DRAW_STATE_HAS_OUTLINE] && item.mesh.outlineVertexArray !== null) {
				const offset = this.#outlineBatchCount;
				outlineBatches[offset] = item;
				outlineBatches[offset + 1] = start;
				outlineBatches[offset + 2] = count;
				outlineBatches[offset + 3] = slotIndex;
				this.#outlineBatchCount = offset + 4;
			}
			if (count > 1) {
				slotIndex += 1;
			}
		}
		this.runPasses(renderer, ToonDrawStage.afterOpaque);

		// 2. 불투명한 것의 바깥선 껍데기와 화면 공간 바깥선. (몸과 같은 묶음)
		for (let batchIndex = 0; batchIndex < this.#outlineBatchCount; batchIndex += 4) {
			const item = outlineBatches[batchIndex];
			const count = outlineBatches[batchIndex + 2];
			renderer.setDrawEntryHint(item.options, item.entry);
			if (count === 1) {
				renderer.drawMeshOutline(item.mesh, item.modelMatrix, item.options);
			}
			else {
				renderer.drawMeshBatch(item.mesh, batchMatrices, outlineBatches[batchIndex + 1], count, item.options, DRAW_PART_OUTLINE, outlineBatches[batchIndex + 3]);
			}
		}
		for (let batchIndex = 0; batchIndex < this.#outlineBatchCount; batchIndex += 4) {
			outlineBatches[batchIndex] = null; // 담은 칸을 쥐지 않게. (수 칸은 그대로)
		}
		this.#outlineBatchCount = 0;
		if (this.#screenOutline !== null) {
			this.#screenOutline.drawOutline();
			renderer.applyFrameState();
		}
		this.runPasses(renderer, ToonDrawStage.afterOutline);

		// 3. 비치는 것. (묶음은 한 덩어리로, 먼 것부터, 깊이는 쓰지 않음)
		// 덩어리 칸은 다시 쓴다. (묶음은 몇 개라 덩어리 목록에서 찾는다, 덩어리의 itemList 는 앞의 itemCount 칸)
		const entryList = this.#transparentList;
		const entryPool = this.#transparentPool;
		let entryCount = 0;
		for (let index = 0; index < this.#itemCount; ++index) {
			const item = itemList[index];
			if (!item.isTransparent) {
				continue;
			}
			item.depth = readDepth(item.depthPosition);
			const group = item.state[DRAW_STATE_GROUP];
			const isDepthPrepassed = item.state[DRAW_STATE_IS_DEPTH_PREPASSED];
			let entry = null;
			if (group !== null) {
				for (let entryIndex = 0; entryIndex < entryCount; ++entryIndex) {
					if (entryList[entryIndex].group === group) {
						entry = entryList[entryIndex];
						break;
					}
				}
			}
			if (entry === null) {
				entry = entryPool[entryCount];
				if (entry === undefined) {
					entry = { depthSum: 0, itemList: [], itemCount: 0, isDepthPrepassed: false, group: null, averageDepth: 0 };
					entryPool.push(entry);
				}
				entry.depthSum = 0;
				entry.itemCount = 0;
				entry.isDepthPrepassed = false;
				entry.group = group;
				entryList[entryCount] = entry;
				entryCount += 1;
			}
			entry.depthSum += item.depth;
			entry.itemList[entry.itemCount] = item;
			entry.itemCount += 1;
			entry.isDepthPrepassed = entry.isDepthPrepassed || isDepthPrepassed;
		}
		setListLength(entryList, entryCount);
		if (entryList.length > 0) {
			for (const entry of entryList) {
				entry.averageDepth = entry.depthSum / entry.itemCount;
			}
			entryList.sort(compareTransparentEntry);
			webGL2RenderingContext.depthMask(false);
			for (const entry of entryList) {
				if (entry.isDepthPrepassed) {
					webGL2RenderingContext.colorMask(false, false, false, false);
					webGL2RenderingContext.depthMask(true);
					for (let index = 0; index < entry.itemCount; ++index) {
						const item = entry.itemList[index];
						this.drawItem(renderer, item, item.options);
					}
					webGL2RenderingContext.colorMask(true, true, true, true);
					webGL2RenderingContext.depthMask(false);
				}
				for (let index = 0; index < entry.itemCount; ++index) {
					const item = entry.itemList[index];
					this.drawItem(renderer, item, item.options);
					entry.itemList[index] = null; // 담은 칸을 쥐지 않게.
				}
				entry.group = null;
			}
			webGL2RenderingContext.depthMask(true);
		}
		this.runPasses(renderer, ToonDrawStage.afterTransparent);
	}

	//==============================================================================
	// 정렬한 불투명한 것 읽기. (재질, 모형, 바탕색 텍스처의 차례, 같으면 담은 차례, 담은 것이 그대로면 앞서 만든 것을 쓴다)
	//==============================================================================
	/**
	 * @returns { Array<object> } 불투명한 것의 목록. (고치지 않는다)
	 * @private
	 */
	readOpaqueItemList() {
		if (this.#opaqueItemList !== null) {
			return this.#opaqueItemList;
		}
		// 담은 차례의 불투명한 것. (칸에 차례로 쓰고 길이는 다를 때만 맞춘다, 길이를 0 으로 줄이면 V8 이 칸을 놓아 프레임마다 다시 잡는다)
		const scratch = this.#opaqueScratch;
		const itemList = this.#itemList;
		let count = 0;
		for (let index = 0; index < this.#itemCount; ++index) {
			const item = itemList[index];
			if (!item.isTransparent) {
				scratch[count] = item;
				count += 1;
			}
		}
		setListLength(scratch, count);
		// 열쇠가 앞의 정렬과 모두 같으면 (게임이 프레임마다 같은 것을 같은 차례로 담으면) 앞의 차례를 그대로 쓴다.
		let keys = this.#sortKeys;
		let isSame = count === this.#sortCount;
		if (keys.length < count * 4) {
			keys = new System.Int32Array(count * 4);
			this.#sortKeys = keys;
			this.#sortOrder = new System.Int32Array(count);
			isSame = false;
		}
		for (let index = 0; index < count; ++index) {
			const item = scratch[index];
			const materialId = readSortId(item.state[DRAW_STATE_MATERIAL]);
			const meshId = readSortId(item.mesh);
			const textureId = readSortId(item.state[DRAW_STATE_BASE_COLOR_TEXTURE]);
			const blockId = readSortId(item.materialBlock);
			const offset = index * 4;
			if (keys[offset] !== materialId || keys[offset + 1] !== meshId || keys[offset + 2] !== textureId || keys[offset + 3] !== blockId) {
				keys[offset] = materialId;
				keys[offset + 1] = meshId;
				keys[offset + 2] = textureId;
				keys[offset + 3] = blockId;
				isSame = false;
			}
		}
		const order = this.#sortOrder;
		if (!isSame) {
			const indexList = this.#sortIndexList;
			for (let index = 0; index < count; ++index) {
				indexList[index] = index;
			}
			setListLength(indexList, count);
			indexList.sort((index, other) => {
				return keys[index * 4] - keys[other * 4] || keys[index * 4 + 1] - keys[other * 4 + 1] || keys[index * 4 + 2] - keys[other * 4 + 2] || keys[index * 4 + 3] - keys[other * 4 + 3] || index - other;
			});
			order.set(indexList);
			this.#sortCount = count;
		}
		const opaqueItemList = this.#opaqueStorage;
		for (let index = 0; index < count; ++index) {
			opaqueItemList[index] = scratch[order[index]];
		}
		setListLength(opaqueItemList, count);
		this.#opaqueItemList = opaqueItemList;
		return opaqueItemList;
	}

	//==============================================================================
	// 자동 인스턴싱으로 묶을 것 모으기. (item 뒤에 이어진 같은 것의 행렬을 #batchMatrices 에 더한다, 화면 밖인 것은 drawItem 이 걸러 센다)
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer.
	 * @param { Array<object> } itemList - 정렬한 담은 것 목록.
	 * @param { number } itemIndex - item 다음 자리.
	 * @param { object } item - 묶음의 첫 것. (보통 모형 하나, 걸러 그릴 것)
	 * @returns { number } 묶지 않은 첫 자리.
	 * @private
	 */
	collectBatch(renderer, itemList, itemIndex, item) {
		if (item.materialBlock === null) {
			return itemIndex;
		}
		while (itemIndex < itemList.length) {
			const other = itemList[itemIndex];
			if (!isBatchableItem(item, other)) {
				break;
			}
			itemIndex += 1;
			if (other.state[DRAW_STATE_IS_CULLED] && !renderer.isVisible(other.mesh, other.modelMatrix.getElements())) {
				this.drawItem(renderer, other, other.options);
				continue;
			}
			this.pushBatchMatrix(other.modelMatrix);
		}
		return itemIndex;
	}

	//==============================================================================
	// 그림자 드리우개 목록 그리기. (이어진 같은 것은 자동 인스턴싱으로 한 번에, 나머지는 drawItem)
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer. (그림자 패스 안)
	 * @param { Array<object> } casterList - 정렬한 드리우개 목록.
	 * @private
	 */
	drawCasterList(renderer, casterList) {
		const batchMatrices = this.#batchMatrices;
		let itemIndex = 0;
		let slotIndex = 0;
		while (itemIndex < casterList.length) {
			const item = casterList[itemIndex];
			itemIndex += 1;
			if (item.modelMatrix === null || (item.state[DRAW_STATE_IS_CULLED] && !renderer.isVisible(item.mesh, item.modelMatrix.getElements()))) {
				this.drawItem(renderer, item, item.options);
				continue;
			}
			this.#batchMatrixCount = 0;
			this.pushBatchMatrix(item.modelMatrix);
			itemIndex = this.collectBatch(renderer, casterList, itemIndex, item);
			if (this.#batchMatrixCount === 1) {
				this.drawItem(renderer, item, item.options);
			}
			else {
				renderer.setDrawEntryHint(item.options, item.entry);
				renderer.drawMeshBatch(item.mesh, batchMatrices, 0, this.#batchMatrixCount, item.options, DRAW_PART_ALL, slotIndex);
				slotIndex += 1;
			}
		}
		this.#batchMatrixCount = 0;
	}

	//==============================================================================
	// 자동 인스턴싱 행렬 하나 더하기. (#batchMatrices 의 쓴 수 자리에, 배열 길이를 줄이지 않는다)
	//==============================================================================
	/**
	 * @param { Matrix4 } matrix - 모형 행렬.
	 * @private
	 */
	pushBatchMatrix(matrix) {
		this.#batchMatrices[this.#batchMatrixCount] = matrix;
		this.#batchMatrixCount += 1;
	}

	//==============================================================================
	// 하나 그리기. (모형 하나는 drawMesh, 인스턴스 묶음은 drawMeshInstanced, 인스턴스 버퍼는 drawMeshInstanceBuffer)
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer.
	 * @param { object } item - 담은 것 하나.
	 * @param { object } options - 이번에 쓸 그리기 꼴.
	 */
	drawItem(renderer, item, options) {
		renderer.setDrawEntryHint(options, item.entry);
		if (item.instanceBuffer !== null) {
			renderer.drawMeshInstanceBuffer(item.mesh, item.instanceBuffer, item.instanceCount, options);
		}
		else if (item.instances !== null) {
			renderer.drawMeshInstanced(item.mesh, item.instances, options);
		}
		else {
			renderer.drawMesh(item.mesh, item.modelMatrix, options);
		}
	}
}
