//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { ToonBlendMode } from "./toonmaterial.js";
import { TOON_SCREEN_OUTLINE_MAXIMUM_LINE_ID } from "./toonscreenoutline.js";
import { ShadowUpdateMode } from "../shadowmap.js";


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
	const options = item.options;
	const jointMatrices = options.jointMatrices !== undefined && options.jointMatrices !== null ? options.jointMatrices : null;
	const matrixCount = item.instances !== null ? item.instances.length : 1;
	const valueCount = 6 + matrixCount * 16 + (jointMatrices !== null ? jointMatrices.length : 0);
	let isChanged = record.mesh !== item.mesh || record.material !== options.material;
	record.mesh = item.mesh;
	record.material = options.material;
	if (record.values.length !== valueCount) {
		record.values = new System.Float32Array(valueCount);
		isChanged = true;
	}
	const values = record.values;
	let index = 0;
	const write = (value) => {
		const rounded = System.Math.fround(value);
		if (values[index] !== rounded) {
			values[index] = rounded;
			isChanged = true;
		}
		index += 1;
	};
	write(matrixCount);
	write(options.indexStart !== undefined ? options.indexStart : -1);
	write(options.indexCount !== undefined ? options.indexCount : -1);
	write(options.isCulled === false ? 0 : 1);
	write(options.isMirrored === undefined ? -1 : (options.isMirrored === true ? 1 : 0));
	write(jointMatrices !== null ? jointMatrices.length : -1);
	if (item.instances !== null) {
		for (const instance of item.instances) {
			const elements = instance.modelMatrix.getElements();
			for (let elementIndex = 0; elementIndex < 16; ++elementIndex) {
				write(elements[elementIndex]);
			}
		}
	}
	else {
		const elements = item.modelMatrix.getElements();
		for (let elementIndex = 0; elementIndex < 16; ++elementIndex) {
			write(elements[elementIndex]);
		}
	}
	if (jointMatrices !== null) {
		for (let jointIndex = 0; jointIndex < jointMatrices.length; ++jointIndex) {
			write(jointMatrices[jointIndex]);
		}
	}
	return isChanged;
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
//   번호는 options.lineId (주지 않으면 담은 차례 + 1, 인스턴스는 instances[i].lineId 가 먼저), 모형마다 options.hasScreenOutline, options.hasCreaseLine 으로 끄고 켠다.
//   비치는 것은 선의 판에 그리지 않는다. 화면 사각형(ToonRenderer.setScreenRect)이 있으면 그 사각형을 선의 판의 그리는 영역으로 쓴다.
// - 단계 콜백: addPass(stage, callback) 의 callback(renderer, webGL2RenderingContext) 를 그 자리에서 부른다. 부른 뒤 렌더러가 프레임의 그리기 상태를 다시 건다.
// - 인스턴스 묶음(addMeshInstanced)은 불투명이면 몸과 바깥선 껍데기를 한 번에 그리고, 비치면 인스턴스 자리의 가운데로 한 덩어리로 정렬한다.
// - 그림자: drawShadows(renderer, shadowMap) 가 castsShadow 가 false 가 아닌 불투명한 것만 해의 그림자 깊이로 그린다. draw 보다 먼저 부른다.
//   그림자 판의 setUpdateMode(ShadowUpdateMode) 를 따른다. 기본 onChange 는 빛과 드리우개가 그대로면 다시 그리지 않고, 오래 그대로인 것은 구워 두고 움직이는 것만 덧그린다. (화면은 매 프레임 그린 것과 같다)
//   점광과 스포트라이트 그림자는 drawLocalShadows(renderer, shadowAtlas) 가 아틀라스의 칸마다 같은 것을 그린다. (렌더러에 setLocalShadows 로 건다)
// - 사용: 매 프레임 clear() → addMesh / addMeshInstanced / addPass → (drawShadows) → draw(renderer, camera) 나 drawWithMatrices(renderer, 보기 행렬, 투영 행렬)
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
	/** @private @type { Array<object> } */ #itemList; // { mesh, modelMatrix, instances, options, isTransparent, depthPosition, depth }
	/** @private @type { Array<object> } */ #passList; // { stage, callback }
	/** @private @type { object | null } */ #screenOutline; // ToonScreenOutline. (없으면 null)
	/** @private @type { Array<object> | null } */ #opaqueItemList; // 정렬한 불투명한 것. (담거나 비우면 null, 처음 그릴 때 만든다)

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		this.#itemList = [];
		this.#passList = [];
		this.#screenOutline = null;
		this.#opaqueItemList = null;
	}

	//==============================================================================
	// 비우기. (프레임마다 담기 전에, 단계 콜백도 비운다, 화면 공간 바깥선은 그대로)
	//==============================================================================
	clear() {
		this.#itemList.length = 0;
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
		return this.#itemList.length;
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
	addMesh(mesh, modelMatrix, options = {}) {
		if (mesh === null || mesh === undefined) {
			return;
		}
		const center = mesh.boundingCenter;
		const depthPosition = modelMatrix.transformPoint(center[0], center[1], center[2]);
		this.#opaqueItemList = null;
		this.#itemList.push({ mesh: mesh, modelMatrix: modelMatrix, instances: null, options: options, isTransparent: this.isTransparentOptions(options), depthPosition: depthPosition, depth: 0 });
	}

	//==============================================================================
	// 같은 모형 여럿 담기. (GPU 인스턴싱, 비어 있거나 null 이면 담지 않는다)
	//==============================================================================
	/**
	 * @param { object | null } mesh - ToonRenderer.createMesh 의 결과.
	 * @param { Array<object> } instances - { modelMatrix, tintColor, lineId (선택) } 의 배열.
	 * @param { object } [options] - addMesh 와 같다.
	 */
	addMeshInstanced(mesh, instances, options = {}) {
		if (mesh === null || mesh === undefined || instances.length === 0) {
			return;
		}
		const depthPosition = { x: 0, y: 0, z: 0 };
		for (const instance of instances) {
			const elements = instance.modelMatrix.getElements();
			depthPosition.x += elements[12];
			depthPosition.y += elements[13];
			depthPosition.z += elements[14];
		}
		depthPosition.x /= instances.length;
		depthPosition.y /= instances.length;
		depthPosition.z /= instances.length;
		this.#opaqueItemList = null;
		this.#itemList.push({ mesh: mesh, modelMatrix: null, instances: instances, options: options, isTransparent: this.isTransparentOptions(options), depthPosition: depthPosition, depth: 0 });
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
		const lightKey = new System.Float32Array(17);
		lightKey.set(shadowMap.getLightViewProjectionMatrix().getElements());
		lightKey[16] = shadowMap.getResolution();
		this.drawShadowCasters(renderer, shadowMap.getShadowCache(), lightKey, () => {
			renderer.beginShadowPass(shadowMap);
		}, (casterList) => {
			for (const item of casterList) {
				this.drawItem(renderer, item, item.options);
			}
		});
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
		const lightKey = new System.Float32Array(1 + tileCount * 19);
		lightKey[0] = shadowAtlas.getResolution();
		for (let tileIndex = 0; tileIndex < tileCount; ++tileIndex) {
			const tile = shadowAtlas.getTile(tileIndex);
			const offset = 1 + tileIndex * 19;
			lightKey.set(tile.viewProjectionMatrix.getElements(), offset);
			lightKey[offset + 16] = tile.x;
			lightKey[offset + 17] = tile.y;
			lightKey[offset + 18] = tile.size;
		}
		this.drawShadowCasters(renderer, shadowAtlas.getShadowCache(), lightKey, () => {
			renderer.beginShadowAtlasPass(shadowAtlas);
		}, (casterList) => {
			for (let tileIndex = 0; tileIndex < tileCount; ++tileIndex) {
				renderer.setShadowAtlasTile(shadowAtlas, tileIndex);
				for (const item of casterList) {
					this.drawItem(renderer, item, item.options);
				}
			}
		});
	}

	//==============================================================================
	// 그림자 드리우개 그리기. (그림자 판의 갱신 방식대로 다시 그리거나 건너뛴다, 불투명하고 castsShadow 가 false 가 아닌 것만)
	// - everyFrame: 판을 비우고 전부 그린다.
	// - interval: N 프레임마다(처음과 requestUpdate 뒤에는 바로) 판을 비우고 전부 그린다. 사이의 프레임은 그리지 않는다.
	// - onChange: 드리우개를 담은 차례로 앞의 프레임과 견준다. SHADOW_STATIC_FRAME_COUNT 프레임 그대로인 것은 구운 판에 굽고,
	//   나머지(움직이는 것, 정점 조각이 있는 재질)는 매 프레임 구운 판을 판에 옮긴 뒤 그 위에 덧그린다.
	//   구운 것이 바뀌거나 빠지거나 새로 구울 것이 생기거나 requestUpdate 를 부르면 다시 굽는다. 움직이는 것이 없고 판이 구운 판과 같으면 아무것도 그리지 않는다.
	//   빛 행렬이나 칸이 바뀐 프레임은 전부를 판에 바로 그리고, 빛이 멈춘 다음 프레임에 굽는다.
	//   깊이는 LEQUAL 로 가장 가까운 것이 남으므로 굽고 덧그린 판은 전부를 한 번에 그린 판과 같다.
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer.
	 * @param { object } shadowCache - ShadowMap 이나 ShadowAtlas 의 getShadowCache().
	 * @param { Float32Array } lightKey - 빛 행렬과 판의 꼴. (다르면 다시 굽는다)
	 * @param { Function } beginPass - 깊이 패스를 시작한다. (endShadowPass 로 끝낸다)
	 * @param { Function } drawCasters - (드리우개 목록) 을 그린다.
	 * @private
	 */
	drawShadowCasters(renderer, shadowCache, lightKey, beginPass, drawCasters) {
		const casterList = [];
		for (const item of this.readOpaqueItemList()) {
			if (item.options.castsShadow !== false) {
				casterList.push(item);
			}
		}
		const drawPass = (renderTarget, itemList) => {
			shadowCache.renderTarget = renderTarget;
			beginPass();
			drawCasters(itemList);
			renderer.endShadowPass();
		};
		const updateMode = shadowCache.updateMode;
		if (updateMode === ShadowUpdateMode.everyFrame) {
			shadowCache.casterRecords.length = 0;
			shadowCache.lightKey = null;
			shadowCache.hasCache = false;
			drawPass("live", casterList);
			return;
		}
		if (updateMode === ShadowUpdateMode.interval) {
			const isDue = shadowCache.isUpdateRequested || shadowCache.frameCount % shadowCache.updateInterval === 0;
			shadowCache.frameCount += 1;
			if (isDue) {
				shadowCache.isUpdateRequested = false;
				shadowCache.hasCache = false;
				drawPass("live", casterList);
			}
			return;
		}

		// 바뀔 때만. (드리우개를 담은 차례로 견준다)
		const isLightChanged = !isSameValues(shadowCache.lightKey, lightKey);
		let isCacheStale = shadowCache.isUpdateRequested;
		shadowCache.isUpdateRequested = false;
		shadowCache.lightKey = lightKey;
		const recordList = shadowCache.casterRecords;
		for (let recordIndex = casterList.length; recordIndex < recordList.length; ++recordIndex) {
			isCacheStale = isCacheStale || recordList[recordIndex].isStatic;
		}
		if (recordList.length > casterList.length) {
			recordList.length = casterList.length;
		}
		const staticList = [];
		const dynamicList = [];
		for (let casterIndex = 0; casterIndex < casterList.length; ++casterIndex) {
			const item = casterList[casterIndex];
			if (casterIndex >= recordList.length) {
				recordList.push({ mesh: null, material: undefined, values: new System.Float32Array(0), stableFrameCount: 0, isStatic: false });
			}
			const record = recordList[casterIndex];
			const material = item.options.material;
			const isVertexAnimated = material !== undefined && material !== null && material.getVertexChunk() !== "";
			if (writeCasterRecord(record, item) || isVertexAnimated) {
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
			if (record.isStatic) {
				staticList.push(item);
			}
			else {
				dynamicList.push(item);
			}
		}
		if (isLightChanged) {
			// 빛이 바뀐 프레임은 전부를 판에 바로 그린다. (빛이 매 프레임 움직여도 굽고 옮기는 몫이 더 들지 않게, 구운 판은 빛이 멈춘 다음 프레임에 굽는다)
			shadowCache.hasCache = false;
			drawPass("live", casterList);
			return;
		}
		if (isCacheStale || (!shadowCache.hasCache && staticList.length > 0)) {
			shadowCache.hasCache = staticList.length > 0;
			if (shadowCache.hasCache) {
				drawPass("cache", staticList);
			}
			shadowCache.isDepthCurrent = false;
		}
		if (dynamicList.length > 0) {
			drawPass(shadowCache.hasCache ? "copy" : "live", dynamicList);
			return;
		}
		if (!shadowCache.isDepthCurrent) {
			drawPass(shadowCache.hasCache ? "copy" : "live", dynamicList);
			shadowCache.isDepthCurrent = true;
		}
	}

	//==============================================================================
	// 담은 것 그리기. (화면 공간 바깥선이 있으면 선의 판부터, beginFrameWithCamera 와 endFrame 을 스스로 부른다)
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer.
	 * @param { object } camera - Camera3D.
	 */
	draw(renderer, camera) {
		this.drawLineIds(renderer, camera.getViewMatrix(), camera.getProjectionMatrix());
		renderer.beginFrameWithCamera(camera);
		this.drawStages(renderer, (position) => {
			return camera.readViewDepth(position.x, position.y, position.z);
		});
		renderer.endFrame();
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
		this.drawLineIds(renderer, viewMatrix, projectionMatrix);
		renderer.beginFrameWithMatrices(viewMatrix, projectionMatrix);
		const elements = viewMatrix.getElements();
		this.drawStages(renderer, (position) => {
			return -(elements[2] * position.x + elements[6] * position.y + elements[10] * position.z + elements[14]);
		});
		renderer.endFrame();
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
		const screenOutline = this.#screenOutline;
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
			let itemIndex = 0;
			for (const item of this.#itemList) {
				itemIndex += 1;
				if (item.isTransparent) {
					continue;
				}
				const lineId = typeof item.options.lineId === "number" ? item.options.lineId : (itemIndex - 1) % TOON_SCREEN_OUTLINE_MAXIMUM_LINE_ID + 1;
				if (item.instances !== null) {
					screenOutline.drawMeshInstanced(item.mesh, item.instances, lineId, item.options);
				}
				else {
					screenOutline.drawMesh(item.mesh, item.modelMatrix, lineId, item.options);
				}
			}
			screenOutline.endLineIds();
		}
		webGL2RenderingContext.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);
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
			pass.callback(renderer, renderer.getWebGL2RenderingContext());
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
		const itemList = this.#itemList;
		const webGL2RenderingContext = renderer.getWebGL2RenderingContext();
		this.runPasses(renderer, ToonDrawStage.beforeOpaque);

		// 1. 불투명한 몸. (인스턴스 묶음은 바깥선까지 한 번에)
		const outlineItemList = [];
		for (const item of this.readOpaqueItemList()) {
			if (item.instances !== null) {
				this.drawItem(renderer, item, item.options);
				continue;
			}
			// 화면 밖이면 drawMesh 가 걸러 센다. 바깥선도 담지 않는다.
			if (item.options.isCulled !== false && !renderer.isVisible(item.mesh, item.modelMatrix.getElements())) {
				this.drawItem(renderer, item, item.options);
				continue;
			}
			const bodyOptions = System.Object.assign({}, item.options, { hasOutline: false });
			this.drawItem(renderer, item, bodyOptions);
			if (item.options.hasOutline !== false && item.mesh.outlineVertexArray !== null) {
				outlineItemList.push(item);
			}
		}
		this.runPasses(renderer, ToonDrawStage.afterOpaque);

		// 2. 불투명한 것의 바깥선 껍데기와 화면 공간 바깥선.
		for (const item of outlineItemList) {
			renderer.drawMeshOutline(item.mesh, item.modelMatrix, item.options);
		}
		if (this.#screenOutline !== null) {
			this.#screenOutline.drawOutline();
			renderer.applyFrameState();
		}
		this.runPasses(renderer, ToonDrawStage.afterOutline);

		// 3. 비치는 것. (묶음은 한 덩어리로, 먼 것부터, 깊이는 쓰지 않음)
		const entryList = [];
		const groupTable = new Map();
		for (const item of itemList) {
			if (!item.isTransparent) {
				continue;
			}
			item.depth = readDepth(item.depthPosition);
			const group = item.options.group;
			const isDepthPrepassed = item.options.isDepthPrepassed === true;
			if (group === undefined || group === null) {
				entryList.push({ depthSum: item.depth, itemList: [item], isDepthPrepassed: isDepthPrepassed });
				continue;
			}
			let entry = groupTable.get(group);
			if (entry === undefined) {
				entry = { depthSum: 0, itemList: [], isDepthPrepassed: false };
				groupTable.set(group, entry);
				entryList.push(entry);
			}
			entry.depthSum += item.depth;
			entry.itemList.push(item);
			entry.isDepthPrepassed = entry.isDepthPrepassed || isDepthPrepassed;
		}
		if (entryList.length > 0) {
			entryList.sort((entry, other) => {
				return other.depthSum / other.itemList.length - entry.depthSum / entry.itemList.length;
			});
			webGL2RenderingContext.depthMask(false);
			for (const entry of entryList) {
				if (entry.isDepthPrepassed) {
					webGL2RenderingContext.colorMask(false, false, false, false);
					webGL2RenderingContext.depthMask(true);
					for (const item of entry.itemList) {
						this.drawItem(renderer, item, item.options);
					}
					webGL2RenderingContext.colorMask(true, true, true, true);
					webGL2RenderingContext.depthMask(false);
				}
				for (const item of entry.itemList) {
					this.drawItem(renderer, item, item.options);
				}
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
		const keyList = [];
		for (const item of this.#itemList) {
			if (item.isTransparent) {
				continue;
			}
			keyList.push({ item: item, order: keyList.length, materialId: readSortId(item.options.material), meshId: readSortId(item.mesh), textureId: readSortId(item.options.baseColorTexture) });
		}
		keyList.sort((key, other) => {
			return key.materialId - other.materialId || key.meshId - other.meshId || key.textureId - other.textureId || key.order - other.order;
		});
		this.#opaqueItemList = keyList.map((key) => {
			return key.item;
		});
		return this.#opaqueItemList;
	}

	//==============================================================================
	// 하나 그리기. (모형 하나는 drawMesh, 인스턴스 묶음은 drawMeshInstanced)
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer.
	 * @param { object } item - 담은 것 하나.
	 * @param { object } options - 이번에 쓸 그리기 꼴.
	 */
	drawItem(renderer, item, options) {
		if (item.instances !== null) {
			renderer.drawMeshInstanced(item.mesh, item.instances, options);
		}
		else {
			renderer.drawMesh(item.mesh, item.modelMatrix, options);
		}
	}
}
