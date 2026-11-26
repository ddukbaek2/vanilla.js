//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";
import { Matrix4 } from "../../base/matrix4.js";
import { Quaternion } from "../../base/quaternion.js";
import { FbxLoader } from "./fbxloader.js";
import { Material } from "./material.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================

// GLB 청크 타입.
const GLB_CHUNKTYPE_JSON = 0x4e4f534a;
const GLB_CHUNKTYPE_BINARY = 0x004e4942;

// 컴포넌트 타입별 배열 생성자.
const COMPONENT_ARRAY_TABLE = {
	5121: System.Uint8Array,
	5123: System.Uint16Array,
	5125: System.Uint32Array,
	5126: System.Float32Array,
};

// 어트리뷰트 타입별 컴포넌트 수.
const TYPE_COMPONENT_COUNT_TABLE = {
	SCALAR: 1,
	VEC2: 2,
	VEC3: 3,
	VEC4: 4,
	MAT4: 16,
};

// 모프 타깃 텍스처 가로 크기. (정점 델타를 실수 텍스처에 행 단위로 적재, 버텍스 셰이더가 gl_VertexID 로 조회)
const MORPH_TEXTURE_WIDTH = 2048;

// glTF 애니메이션 채널 경로. (이 밖의 경로는 버린다)
const ANIMATION_PATH_SET = new System.Set(["translation", "rotation", "scale", "weights"]);

// 드로어블당 모프 타깃 최대 개수. (셰이더 유니폼 배열 크기와 일치)
export const MORPH_TARGET_MAXIMUM = 96;


//==============================================================================
// 전역 함수 목록.
//==============================================================================
//==============================================================================
// FBX 오일러(도) → 쿼터니언. (eEulerXYZ = X 먼저 적용, 열벡터 기준 Rz x Ry x Rx 합성)
//==============================================================================
/**
 * @param { number } xDegree
 * @param { number } yDegree
 * @param { number } zDegree
 * @returns { Quaternion }
 */
export function createQuaternionFromFbxEuler(xDegree, yDegree, zDegree) {
	const degreeToRadian = System.Math.PI / 180;
	const rotationX = Quaternion.createFromEuler(xDegree * degreeToRadian, 0, 0);
	const rotationY = Quaternion.createFromEuler(0, yDegree * degreeToRadian, 0);
	const rotationZ = Quaternion.createFromEuler(0, 0, zDegree * degreeToRadian);
	const rotationZY = rotationZ.multiply(rotationY);
	const combinedRotation = rotationZY.multiply(rotationX);
	return combinedRotation;
}

//==============================================================================
// FBX 애니메이션 채널 변환. (회전 = 오일러 도 → 사전회전 합성 쿼터니언 4성분)
// - resolveNodeIndex 로 대상 노드 인덱스를 재지정한다. (본 이름 매칭 리타게팅용)
//==============================================================================
/**
 * @param { object } sceneData
 * @param { object } fbxAnimation
 * @param { function(number): (number | undefined) } resolveNodeIndex
 * @returns { object[] }
 */
function convertFbxAnimationChannels(sceneData, fbxAnimation, resolveNodeIndex) {
	const channels = [];
	for (const fbxChannel of fbxAnimation.channels) {
		const targetNodeIndex = resolveNodeIndex(fbxChannel.nodeIndex);
		if (targetNodeIndex === undefined) {
			continue;
		}
		if (fbxChannel.path === "rotation") {
			const sourceFbxNode = sceneData.nodeList[fbxChannel.nodeIndex];
			const preRotationQuaternion = createQuaternionFromFbxEuler(sourceFbxNode.preRotationDegrees[0], sourceFbxNode.preRotationDegrees[1], sourceFbxNode.preRotationDegrees[2]);
			const keyCount = fbxChannel.times.length;
			const quaternionValues = new System.Float32Array(keyCount * 4);
			for (let keyIndex = 0; keyIndex < keyCount; ++keyIndex) {
				const eulerQuaternion = createQuaternionFromFbxEuler(fbxChannel.values[keyIndex * 3], fbxChannel.values[keyIndex * 3 + 1], fbxChannel.values[keyIndex * 3 + 2]);
				const rotationQuaternion = preRotationQuaternion.multiply(eulerQuaternion);
				quaternionValues[keyIndex * 4] = rotationQuaternion.x;
				quaternionValues[keyIndex * 4 + 1] = rotationQuaternion.y;
				quaternionValues[keyIndex * 4 + 2] = rotationQuaternion.z;
				quaternionValues[keyIndex * 4 + 3] = rotationQuaternion.w;
			}
			channels.push({ nodeIndex: targetNodeIndex, path: fbxChannel.path, times: fbxChannel.times, values: quaternionValues, cursor: 0 });
		}
		else {
			channels.push({ nodeIndex: targetNodeIndex, path: fbxChannel.path, times: fbxChannel.times, values: fbxChannel.values, cursor: 0 });
		}
	}
	return channels;
}

//==============================================================================
// 애니메이션 FBX 의 클립 이름. (채널이 있는 스택이 하나면 받은 이름 그대로, 여럿이면 "받은 이름/스택 이름")
// - 스택 이름은 FBX 이름에서 "\u0000\u0001AnimStack" 같은 종류 꼬리를 뗀 것이다. (비었으면 채널 있는 스택 사이의 차례 번호)
// - 받은 이름이 비었으면 스택 이름만 쓴다.
//==============================================================================
/**
 * @param { string } clipName 부르는 쪽이 준 클립 이름.
 * @param { string } stackName FBX 스택 이름. (종류 꼬리가 붙은 그대로)
 * @param { number } stackIndex 채널이 있는 스택 사이의 차례. (0 부터)
 * @param { number } stackCount 채널이 있는 스택 수.
 * @returns { string } 클립 이름.
 */
function createFbxClipName(clipName, stackName, stackIndex, stackCount) {
	if (stackCount <= 1) {
		return clipName;
	}
	const separatorIndex = stackName.indexOf("\u0000");
	const displayName = separatorIndex !== -1 ? stackName.substring(0, separatorIndex) : stackName;
	const stackLabel = displayName !== "" ? displayName : `${stackIndex}`;
	return clipName !== "" ? `${clipName}/${stackLabel}` : stackLabel;
}

//==============================================================================
// 접근자 CPU 읽기. (촘촘한 배치 + 인터리브(byteStride) 배치 + 희소(sparse) 접근자 지원, GL 무관)
//==============================================================================
/**
 * @param { object } json glTF JSON.
 * @param { ArrayBuffer } binaryBuffer GLB 의 BIN 청크.
 * @param { number } accessorIndex
 * @returns { Uint8Array | Uint16Array | Uint32Array | Float32Array }
 */
export function readAccessorArray(json, binaryBuffer, accessorIndex) {
	const accessor = json.accessors[accessorIndex];
	const componentCount = TYPE_COMPONENT_COUNT_TABLE[accessor.type];
	const ArrayConstructor = COMPONENT_ARRAY_TABLE[accessor.componentType];
	let resultArray = null;
	if (accessor.bufferView === undefined) {
		resultArray = new ArrayConstructor(accessor.count * componentCount);
	}
	else {
		const bufferView = json.bufferViews[accessor.bufferView];
		const elementOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
		const tightByteSize = componentCount * ArrayConstructor.BYTES_PER_ELEMENT;
		const byteStride = bufferView.byteStride || 0;
		if (byteStride === 0 || byteStride === tightByteSize) {
			const sourceArray = new ArrayConstructor(binaryBuffer, elementOffset, accessor.count * componentCount);
			resultArray = new ArrayConstructor(sourceArray);
		}
		else {
			resultArray = new ArrayConstructor(accessor.count * componentCount);
			for (let elementIndex = 0; elementIndex < accessor.count; ++elementIndex) {
				const sourceArray = new ArrayConstructor(binaryBuffer, elementOffset + elementIndex * byteStride, componentCount);
				resultArray.set(sourceArray, elementIndex * componentCount);
			}
		}
	}

	// 희소 접근자. (인덱스 목록의 요소만 값으로 덮어쓴다, 모프 타깃 델타에 흔히 쓰인다)
	if (accessor.sparse) {
		const sparse = accessor.sparse;
		const indexBufferView = json.bufferViews[sparse.indices.bufferView];
		const IndexArrayConstructor = COMPONENT_ARRAY_TABLE[sparse.indices.componentType];
		const indexOffset = (indexBufferView.byteOffset || 0) + (sparse.indices.byteOffset || 0);
		const sparseIndices = new IndexArrayConstructor(binaryBuffer, indexOffset, sparse.count);
		const valueBufferView = json.bufferViews[sparse.values.bufferView];
		const valueOffset = (valueBufferView.byteOffset || 0) + (sparse.values.byteOffset || 0);
		const sparseValues = new ArrayConstructor(binaryBuffer, valueOffset, sparse.count * componentCount);
		for (let sparseIndex = 0; sparseIndex < sparse.count; ++sparseIndex) {
			const targetElement = sparseIndices[sparseIndex];
			for (let componentIndex = 0; componentIndex < componentCount; ++componentIndex) {
				resultArray[targetElement * componentCount + componentIndex] = sparseValues[sparseIndex * componentCount + componentIndex];
			}
		}
	}
	return resultArray;
}


//==============================================================================
// 스킨드 모델. (모델 인스턴스, 메시/본/스킨/머티리얼/애니메이션 데이터 + 포즈 상태)
// - GLB(바이너리 glTF)와 바이너리 FBX 를 공통 중립 스키마로 해석해 GL 리소스를 구성한다.
// - 스킨 없는 정적 메시는 합성 스킨(조인트 1개)으로, 모프 타깃은 실수 텍스처로 올려 같은 스키닝 경로로 그린다.
// - 애니메이션 크로스페이드와 조인트 회전 오프셋(절차 포즈 가공), 모프 가중치(glTF weights / 프로그램)를 지원한다.
// - 렌더링은 SkinnedModelRenderer 가 담당한다. (모델은 렌더 기능을 갖지 않는다)
//==============================================================================
/**
 * @example <caption>GLB 모델을 불러와 걷는 애니메이션 돌리기</caption>
 * import { SkinnedModel, SkinnedModelRenderer, Camera3D, Matrix4, Vector3 } from "./build/vanilla.js";
 *
 * const width = 640;
 * const height = 360;
 * const canvas = document.createElement("canvas");
 * canvas.width = width;
 * canvas.height = height;
 * document.body.appendChild(canvas);
 * const webGL2RenderingContext = canvas.getContext("webgl2");
 * const skinnedModelRenderer = new SkinnedModelRenderer(webGL2RenderingContext);
 * const skinnedModel = await SkinnedModel.loadFromUrl(webGL2RenderingContext, "examples/ancientmountain/assets/fox.glb", skinnedModelRenderer);
 * const animationNameList = skinnedModel.getAnimationNameList();
 * console.log(animationNameList.join(", "));
 * skinnedModel.playAnimation("Walk", 0);
 *
 * const cameraX = 0;
 * const cameraY = 80;
 * const cameraZ = 220;
 * const camera = new Camera3D();
 * camera.setPerspective(Math.PI / 3, 1, 2000);
 * camera.setAspectRatio(width / height);
 * const eyePosition = Vector3.create(cameraX, cameraY, cameraZ);
 * const targetPosition = Vector3.create(0, 45, 0);
 * camera.lookAt(eyePosition, targetPosition);
 * const viewProjectionMatrix = camera.getViewProjectionMatrix();
 * const viewProjectionElements = viewProjectionMatrix.getElements();
 * const modelMatrix = Matrix4.createIdentity();
 * const modelMatrixElements = modelMatrix.getElements();
 * webGL2RenderingContext.enable(webGL2RenderingContext.DEPTH_TEST);
 *
 * let previousTime = performance.now();
 * function drawFrame(currentTime) {
 * 	const deltaTime = Math.max(0, currentTime - previousTime) / 1000;
 * 	previousTime = currentTime;
 * 	skinnedModel.update(deltaTime);
 * 	webGL2RenderingContext.viewport(0, 0, width, height);
 * 	webGL2RenderingContext.clearColor(0.16, 0.2, 0.26, 1);
 * 	webGL2RenderingContext.clear(webGL2RenderingContext.COLOR_BUFFER_BIT | webGL2RenderingContext.DEPTH_BUFFER_BIT);
 * 	skinnedModelRenderer.draw(skinnedModel, viewProjectionElements, modelMatrixElements, cameraX, cameraY, cameraZ);
 * 	requestAnimationFrame(drawFrame);
 * }
 * requestAnimationFrame(drawFrame);
 */
export class SkinnedModel extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { ShaderProgram } */ #shaderProgram;
	/** @private @type { object[] } */ #nodeList;
	/** @private @type { number[] } */ #rootNodeIndices;
	/** @private @type { object[] } */ #skinList;
	/** @private @type { object[] } */ #drawableList;
	/** @private @type { object[] } */ #animationList;
	/** @private @type { object | null } */ #currentAnimation;
	/** @private @type { object | null } */ #previousAnimation;
	/** @private @type { number } */ #currentTime;
	/** @private @type { number } */ #previousTime;
	/** @private @type { number } */ #fadeDuration;
	/** @private @type { number } */ #fadeElapsed;
	/** @private @type { number } */ #timeScale;
	/** @private @type { Map<number, Quaternion> } */ #jointRotationOffsets;
	/** @private @type { Material[] } */ #ownedMaterialList; // 이 모델이 업로드에서 지은 머티리얼. (destroy 가 지운다)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext WebGL2 렌더링 컨텍스트. (null 이면 GL 업로드를 하지 않는 모델)
	 * @param { ShaderProgram } shaderProgram 어트리뷰트 위치와 머티리얼에 쓸 셰이더 프로그램. (보통 렌더러의 getShaderProgram, null 이면 업로드하지 않는다)
	 */
	constructor(webGL2RenderingContext, shaderProgram) {
		super();

		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#shaderProgram = shaderProgram;
		this.#nodeList = [];
		this.#rootNodeIndices = [];
		this.#skinList = [];
		this.#drawableList = [];
		this.#animationList = [];
		this.#currentAnimation = null;
		this.#previousAnimation = null;
		this.#currentTime = 0;
		this.#previousTime = 0;
		this.#fadeDuration = 0;
		this.#fadeElapsed = 0;
		this.#timeScale = 1;
		this.#jointRotationOffsets = new System.Map();
		this.#ownedMaterialList = [];
	}

	//==============================================================================
	// 셰이더 없이 생성. (정적, 해석과 포즈 계산만 하는 모델, uploadMeshesAndMaterials 는 던진다)
	// - 애니메이션 원본 모델이나 단위 시험처럼 GL 없이 interpretContent / interpretFbxContent 와 update 만 쓴다.
	//==============================================================================
	/**
	 * @returns { SkinnedModel } GL 과 셰이더가 없는 모델.
	 * @example <caption>GL 없이 GLB 를 해석하고 포즈만 셈하기</caption>
	 * import { SkinnedModel } from "./build/vanilla.js";
	 *
	 * const response = await fetch("examples/ancientmountain/assets/fox.glb");
	 * const arrayBuffer = await response.arrayBuffer();
	 * const glbChunks = SkinnedModel.readGlbChunks(arrayBuffer);
	 * const skinnedModel = SkinnedModel.createWithoutShaderProgram();
	 * const interpretation = skinnedModel.interpretContent(glbChunks.json, glbChunks.binaryBuffer);
	 * skinnedModel.playAnimation("Run", 0);
	 * skinnedModel.update(0.5);
	 * const nodeList = skinnedModel.getNodeList();
	 * console.log(interpretation.meshDescriptionList.length, nodeList.length);
	 */
	static createWithoutShaderProgram() {
		return new SkinnedModel(null, null);
	}

	//==============================================================================
	// URL 로부터 로드. (정적, GLB 바이너리 glTF)
	//==============================================================================
	/**
	 * @param { WebGL2RenderingContext } webGL2RenderingContext WebGL2 렌더링 컨텍스트.
	 * @param { string } url GLB 파일 주소.
	 * @param { SkinnedModelRenderer } skinnedModelRenderer 셰이더 프로그램을 빌려 올 렌더러.
	 * @returns { Promise<SkinnedModel> } GL 리소스까지 올린 모델. (응답이 실패하거나 GLB 가 아니면 오류를 던진다)
	 */
	static async loadFromUrl(webGL2RenderingContext, url, skinnedModelRenderer) {
		const response = await System.fetch(url);
		if (!response.ok) {
			throw new Error(`SkinnedModel load failed: ${url}`);
		}
		const arrayBuffer = await response.arrayBuffer();
		const model = await SkinnedModel.loadFromBytes(webGL2RenderingContext, arrayBuffer, skinnedModelRenderer);
		return model;
	}

	//==============================================================================
	// 바이트로부터 로드. (정적, GLB 바이너리 glTF, loadFromUrl 의 fetch 뒤 부분)
	// - 번들에 담긴 바이트나 BlobAsset 처럼 이미 받은 데이터에서 짓는다.
	//==============================================================================
	/**
	 * @param { WebGL2RenderingContext } webGL2RenderingContext WebGL2 렌더링 컨텍스트.
	 * @param { ArrayBuffer } arrayBuffer GLB 파일 바이트.
	 * @param { SkinnedModelRenderer } skinnedModelRenderer 셰이더 프로그램을 빌려 올 렌더러.
	 * @returns { Promise<SkinnedModel> } GL 리소스까지 올린 모델. (GLB 가 아니면 오류를 던진다)
	 * @example <caption>이미 받은 바이트로 모델 짓기</caption>
	 * import { SkinnedModel, SkinnedModelRenderer } from "./build/vanilla.js";
	 *
	 * const canvas = document.createElement("canvas");
	 * const webGL2RenderingContext = canvas.getContext("webgl2");
	 * const skinnedModelRenderer = new SkinnedModelRenderer(webGL2RenderingContext);
	 * const response = await fetch("examples/ancientmountain/assets/fox.glb");
	 * const arrayBuffer = await response.arrayBuffer();
	 * const skinnedModel = await SkinnedModel.loadFromBytes(webGL2RenderingContext, arrayBuffer, skinnedModelRenderer);
	 * const drawableList = skinnedModel.getDrawableList();
	 * console.log(drawableList.length);
	 * skinnedModel.destroy();
	 */
	static async loadFromBytes(webGL2RenderingContext, arrayBuffer, skinnedModelRenderer) {
		const shaderProgram = skinnedModelRenderer.getShaderProgram();
		const model = new SkinnedModel(webGL2RenderingContext, shaderProgram);
		await model.parseBinary(arrayBuffer);
		return model;
	}

	//==============================================================================
	// URL 로부터 로드. (정적, 바이너리 FBX)
	//==============================================================================
	/**
	 * @param { WebGL2RenderingContext } webGL2RenderingContext WebGL2 렌더링 컨텍스트.
	 * @param { string } url 바이너리 FBX 파일 주소.
	 * @param { SkinnedModelRenderer } skinnedModelRenderer 셰이더 프로그램을 빌려 올 렌더러.
	 * @returns { Promise<SkinnedModel> } GL 리소스까지 올린 모델.
	 */
	static async loadFromFbxUrl(webGL2RenderingContext, url, skinnedModelRenderer) {
		const sceneData = await FbxLoader.loadFromUrl(url);
		const shaderProgram = skinnedModelRenderer.getShaderProgram();
		const model = new SkinnedModel(webGL2RenderingContext, shaderProgram);
		await model.parseFbxContent(sceneData);
		return model;
	}

	//==============================================================================
	// 바이트로부터 로드. (정적, 바이너리 FBX, loadFromFbxUrl 의 fetch 뒤 부분)
	//==============================================================================
	/**
	 * @param { WebGL2RenderingContext } webGL2RenderingContext WebGL2 렌더링 컨텍스트.
	 * @param { ArrayBuffer } arrayBuffer 바이너리 FBX 파일 바이트.
	 * @param { SkinnedModelRenderer } skinnedModelRenderer 셰이더 프로그램을 빌려 올 렌더러.
	 * @returns { Promise<SkinnedModel> } GL 리소스까지 올린 모델.
	 */
	static async loadFromFbxBytes(webGL2RenderingContext, arrayBuffer, skinnedModelRenderer) {
		const sceneData = await new FbxLoader().parse(arrayBuffer);
		const shaderProgram = skinnedModelRenderer.getShaderProgram();
		const model = new SkinnedModel(webGL2RenderingContext, shaderProgram);
		await model.parseFbxContent(sceneData);
		return model;
	}

	//==============================================================================
	// GLB 청크 읽기. (정적, 머리 확인 + JSON 청크 + BIN 청크, GL 무관)
	//==============================================================================
	/**
	 * @param { ArrayBuffer } arrayBuffer GLB 파일 바이트.
	 * @returns { { json: object, binaryBuffer: ArrayBuffer } } JSON 청크를 읽은 객체와 BIN 청크 바이트. (머리가 GLB 가 아니거나 청크가 깨졌거나 JSON, BIN 가운데 하나라도 없으면 오류를 던진다)
	 */
	static readGlbChunks(arrayBuffer) {
		const dataView = new System.DataView(arrayBuffer);
		if (arrayBuffer.byteLength < 12 || dataView.getUint32(0, true) !== 0x46546c67) {
			throw new Error("SkinnedModel: not a GLB file.");
		}

		// 청크 순회. (JSON + BIN)
		let json = null;
		let binaryBuffer = null;
		let chunkOffset = 12;
		while (chunkOffset < arrayBuffer.byteLength) {
			if (chunkOffset + 8 > arrayBuffer.byteLength) {
				throw new Error("SkinnedModel: invalid GLB chunks.");
			}
			const chunkLength = dataView.getUint32(chunkOffset, true);
			const chunkType = dataView.getUint32(chunkOffset + 4, true);
			const chunkStart = chunkOffset + 8;
			if (chunkStart + chunkLength > arrayBuffer.byteLength) {
				throw new Error("SkinnedModel: invalid GLB chunks.");
			}
			if (chunkType === GLB_CHUNKTYPE_JSON) {
				const jsonBytes = new System.Uint8Array(arrayBuffer, chunkStart, chunkLength);
				const jsonText = new System.TextDecoder().decode(jsonBytes);
				json = System.JSON.parse(jsonText);
			}
			else if (chunkType === GLB_CHUNKTYPE_BINARY) {
				binaryBuffer = arrayBuffer.slice(chunkStart, chunkStart + chunkLength);
			}
			chunkOffset = chunkStart + chunkLength;
		}
		if (!json || !binaryBuffer) {
			throw new Error("SkinnedModel: invalid GLB chunks.");
		}
		return { json: json, binaryBuffer: binaryBuffer };
	}

	//==============================================================================
	// GLB 바이너리 해석.
	//==============================================================================
	/**
	 * @param { ArrayBuffer } arrayBuffer GLB 파일 바이트.
	 */
	async parseBinary(arrayBuffer) {
		const glbChunks = SkinnedModel.readGlbChunks(arrayBuffer);
		await this.parseContent(glbChunks.json, glbChunks.binaryBuffer);
	}

	//==============================================================================
	// glTF 내용 해석. (노드 / 스킨 / 메시 / 애니메이션 / 텍스처 → GL 업로드)
	//==============================================================================
	/**
	 * @param { object } json glTF JSON.
	 * @param { ArrayBuffer } binaryBuffer GLB 의 BIN 청크.
	 */
	async parseContent(json, binaryBuffer) {
		const interpretation = this.interpretContent(json, binaryBuffer);
		await this.uploadMeshesAndMaterials(interpretation.meshDescriptionList, interpretation.materialDescriptionList);
	}

	//==============================================================================
	// glTF 내용 해석. (GL 무관, 노드 / 스킨 / 애니메이션을 채우고 중립 메시 / 머티리얼 서술을 돌려준다)
	// - 바깥(uri) 이미지는 텍스처 없음, inverseBindMatrices 가 없는 스킨은 단위 행렬, 노드가 없거나 모르는 경로의 채널은 버린다.
	//==============================================================================
	/**
	 * @param { object } json glTF JSON.
	 * @param { ArrayBuffer } binaryBuffer GLB 의 BIN 청크.
	 * @returns { { meshDescriptionList: object[], materialDescriptionList: object[] } } 중립 메시 서술 목록과 중립 머티리얼 서술 목록. (uploadMeshesAndMaterials 에 넘긴다)
	 */
	interpretContent(json, binaryBuffer) {

		// 노드 구성.
		this.#nodeList = json.nodes.map((node) => {
			const rotation = node.rotation ? Quaternion.create(node.rotation[0], node.rotation[1], node.rotation[2], node.rotation[3]) : Quaternion.identity();
			return {
				name: node.name || "",
				childIndices: node.children || [],
				meshIndex: node.mesh,
				skinIndex: node.skin,
				baseTranslation: node.translation ? node.translation.slice() : [0, 0, 0],
				baseRotation: rotation,
				baseScale: node.scale ? node.scale.slice() : [1, 1, 1],
				currentTranslation: [0, 0, 0],
				currentRotation: Quaternion.identity(),
				currentScale: [1, 1, 1],
				worldMatrix: Matrix4.createIdentity(),
			};
		});
		const scene = json.scenes[json.scene || 0];
		this.#rootNodeIndices = scene.nodes.slice();

		// 스킨 구성.
		this.#skinList = (json.skins || []).map((skin) => {
			const inverseBindArray = skin.inverseBindMatrices !== undefined ? readAccessorArray(json, binaryBuffer, skin.inverseBindMatrices) : null;
			const inverseBindMatrices = [];
			for (let jointIndex = 0; jointIndex < skin.joints.length; ++jointIndex) {
				const matrix = Matrix4.createIdentity();
				if (inverseBindArray !== null && inverseBindArray.length >= jointIndex * 16 + 16) {
					const elements = matrix.getElements();
					elements.set(inverseBindArray.subarray(jointIndex * 16, jointIndex * 16 + 16));
				}
				inverseBindMatrices.push(matrix);
			}
			return {
				jointNodeIndices: skin.joints.slice(),
				inverseBindMatrices: inverseBindMatrices,
				jointMatrixArray: new System.Float32Array(skin.joints.length * 16),
			};
		});

		// 이미지 서술 구성 헬퍼. (텍스처 참조 → 임베디드 이미지 바이트)
		function createImageDescription(textureInfo) {
			if (!textureInfo) {
				return null;
			}
			const texture = json.textures[textureInfo.index];
			const image = texture ? json.images[texture.source] : undefined;
			if (!image || image.bufferView === undefined) {
				return null;
			}
			const bufferView = json.bufferViews[image.bufferView];
			const imageBytes = new System.Uint8Array(binaryBuffer, bufferView.byteOffset || 0, bufferView.byteLength);
			return { bytes: imageBytes, mimeType: image.mimeType, flipY: false };
		}

		// 중립 머티리얼 서술 구성. (glTF metallic-roughness → 그대로 매핑)
		const materialDescriptionList = (json.materials || []).map((material) => {
			const description = Material.createDefaultDescription();
			const pbrMetallicRoughness = material.pbrMetallicRoughness;
			if (pbrMetallicRoughness) {
				if (pbrMetallicRoughness.baseColorFactor) {
					description.baseColorFactor = pbrMetallicRoughness.baseColorFactor.slice(0, 3);
				}
				description.metallicFactor = pbrMetallicRoughness.metallicFactor !== undefined ? pbrMetallicRoughness.metallicFactor : 1;
				description.roughnessFactor = pbrMetallicRoughness.roughnessFactor !== undefined ? pbrMetallicRoughness.roughnessFactor : 1;
				description.baseColorImage = createImageDescription(pbrMetallicRoughness.baseColorTexture);
				description.metallicRoughnessImage = createImageDescription(pbrMetallicRoughness.metallicRoughnessTexture);
			}
			description.normalImage = createImageDescription(material.normalTexture);
			description.occlusionImage = createImageDescription(material.occlusionTexture);
			description.emissiveImage = createImageDescription(material.emissiveTexture);
			if (material.emissiveFactor) {
				description.emissiveFactor = material.emissiveFactor.slice(0, 3);
			}
			return description;
		});

		// 중립 메시 서술 구성. (메시 노드의 프리미티브, 접근자를 CPU 배열로 펼침)
		// - 스킨 없는 정적 메시는 노드 자신을 유일한 조인트로 갖는 합성 스킨을 붙여 같은 스키닝 경로로 그린다.
		const meshDescriptionList = [];
		for (let nodeIndex = 0; nodeIndex < this.#nodeList.length; ++nodeIndex) {
			const node = this.#nodeList[nodeIndex];
			if (node.meshIndex === undefined) {
				continue;
			}
			const mesh = json.meshes[node.meshIndex];
			const isStaticMesh = node.skinIndex === undefined;
			if (isStaticMesh) {
				this.#skinList.push({
					jointNodeIndices: [nodeIndex],
					inverseBindMatrices: [Matrix4.createIdentity()],
					jointMatrixArray: new System.Float32Array(16),
				});
				node.skinIndex = this.#skinList.length - 1;
			}
			const targetNameList = mesh.extras && mesh.extras.targetNames ? mesh.extras.targetNames : [];
			const nodeValue = json.nodes[nodeIndex];
			const baseMorphWeights = nodeValue.weights ? nodeValue.weights : (mesh.weights ? mesh.weights : []);
			for (const primitive of mesh.primitives) {
				const positions = new System.Float32Array(readAccessorArray(json, binaryBuffer, primitive.attributes.POSITION));
				const vertexCount = positions.length / 3;
				const normals = primitive.attributes.NORMAL !== undefined ? new System.Float32Array(readAccessorArray(json, binaryBuffer, primitive.attributes.NORMAL)) : null;
				const textureCoordinates = primitive.attributes.TEXCOORD_0 !== undefined ? new System.Float32Array(readAccessorArray(json, binaryBuffer, primitive.attributes.TEXCOORD_0)) : null;
				let joints = null;
				let weights = null;
				if (isStaticMesh) {
					joints = new System.Uint16Array(vertexCount * 4);
					weights = new System.Float32Array(vertexCount * 4);
					for (let vertexIndex = 0; vertexIndex < vertexCount; ++vertexIndex) {
						weights[vertexIndex * 4] = 1;
					}
				}
				else {
					joints = new System.Uint16Array(readAccessorArray(json, binaryBuffer, primitive.attributes.JOINTS_0));
					const weightAccessor = json.accessors[primitive.attributes.WEIGHTS_0];
					const weightSource = readAccessorArray(json, binaryBuffer, primitive.attributes.WEIGHTS_0);
					weights = new System.Float32Array(weightSource.length);
					if (weightAccessor.componentType === 5126) {
						weights.set(weightSource);
					}
					else {
						const normalizeDivisor = weightAccessor.componentType === 5121 ? 255 : 65535;
						for (let weightIndex = 0; weightIndex < weightSource.length; ++weightIndex) {
							weights[weightIndex] = weightSource[weightIndex] / normalizeDivisor;
						}
					}
				}
				let indices = null;
				if (primitive.indices !== undefined) {
					const indexSource = readAccessorArray(json, binaryBuffer, primitive.indices);
					indices = indexSource instanceof System.Uint8Array ? new System.Uint16Array(indexSource) : indexSource;
				}

				// 모프 타깃. (위치 델타 필수, 노멀 델타 선택, 이름은 mesh.extras.targetNames)
				const morphTargets = [];
				const primitiveTargets = primitive.targets ? primitive.targets : [];
				for (let targetIndex = 0; targetIndex < primitiveTargets.length; ++targetIndex) {
					const target = primitiveTargets[targetIndex];
					if (target.POSITION === undefined) {
						continue;
					}
					const positionDeltas = new System.Float32Array(readAccessorArray(json, binaryBuffer, target.POSITION));
					const normalDeltas = target.NORMAL !== undefined ? new System.Float32Array(readAccessorArray(json, binaryBuffer, target.NORMAL)) : null;
					const targetName = targetNameList[targetIndex] !== undefined ? targetNameList[targetIndex] : `target${targetIndex}`;
					morphTargets.push({ name: targetName, positionDeltas: positionDeltas, normalDeltas: normalDeltas });
				}
				const morphWeights = new System.Float32Array(morphTargets.length);
				for (let weightIndex = 0; weightIndex < morphTargets.length; ++weightIndex) {
					morphWeights[weightIndex] = baseMorphWeights[weightIndex] !== undefined ? baseMorphWeights[weightIndex] : 0;
				}

				const primitiveMaterial = primitive.material !== undefined && json.materials ? json.materials[primitive.material] : undefined;
				const materialName = primitiveMaterial && primitiveMaterial.name ? primitiveMaterial.name : "";
				meshDescriptionList.push({
					positions: positions,
					normals: normals,
					textureCoordinates: textureCoordinates,
					joints: joints,
					weights: weights,
					indices: indices,
					skinIndex: node.skinIndex,
					materialIndex: primitive.material !== undefined ? primitive.material : -1,
					materialName: materialName,
					nodeIndex: nodeIndex,
					morphTargets: morphTargets,
					morphWeights: morphWeights,
				});
			}
		}

		// 애니메이션 구성. (노드가 없거나 모르는 경로의 채널은 버린다)
		this.#animationList = (json.animations || []).map((animation) => {
			let duration = 0;
			const channels = [];
			for (const channel of animation.channels) {
				const sampler = animation.samplers[channel.sampler];
				const times = readAccessorArray(json, binaryBuffer, sampler.input);
				const values = readAccessorArray(json, binaryBuffer, sampler.output);
				if (times.length > 0) {
					duration = System.Math.max(duration, times[times.length - 1]);
				}
				const target = channel.target || {};
				if (target.node === undefined || !ANIMATION_PATH_SET.has(target.path)) {
					continue;
				}
				channels.push({
					nodeIndex: target.node,
					path: target.path,
					times: times,
					values: values,
					cursor: 0,
				});
			}
			return { name: animation.name || "", duration: duration, channels: channels };
		});

		if (this.#animationList.length > 0) {
			this.#currentAnimation = this.#animationList[0];
		}
		return { meshDescriptionList: meshDescriptionList, materialDescriptionList: materialDescriptionList };
	}

	//==============================================================================
	// FBX 중간 표현 해석. (노드/스킨/메시/텍스처/애니메이션 → 기존 스키닝 파이프라인)
	//==============================================================================
	/**
	 * @param { object } sceneData FbxLoader 가 읽은 중간 표현.
	 */
	async parseFbxContent(sceneData) {
		const interpretation = this.interpretFbxContent(sceneData);
		await this.uploadMeshesAndMaterials(interpretation.meshDescriptionList, interpretation.materialDescriptionList);
	}

	//==============================================================================
	// FBX 중간 표현 해석. (GL 무관, 노드 / 스킨 / 애니메이션을 채우고 중립 메시 / 머티리얼 서술을 돌려준다)
	// - 본이 없는 클러스터는 단위 조인트, 배열 밖 정점 번호는 건너뛴다. 원본처럼 스킨이 붙은 메시만 담는다.
	//==============================================================================
	/**
	 * @param { object } sceneData FbxLoader 가 읽은 중간 표현.
	 * @returns { { meshDescriptionList: object[], materialDescriptionList: object[] } } 중립 메시 서술 목록과 중립 머티리얼 서술 목록. (uploadMeshesAndMaterials 에 넘긴다)
	 */
	interpretFbxContent(sceneData) {
		// 노드 구성. (오일러 도 → 쿼터니언, 사전회전 우측 누적)
		this.#nodeList = sceneData.nodeList.map((fbxNode) => {
			const rotationQuaternion = createQuaternionFromFbxEuler(fbxNode.rotationEulerDegrees[0], fbxNode.rotationEulerDegrees[1], fbxNode.rotationEulerDegrees[2]);
			const preRotationQuaternion = createQuaternionFromFbxEuler(fbxNode.preRotationDegrees[0], fbxNode.preRotationDegrees[1], fbxNode.preRotationDegrees[2]);
			const baseRotation = preRotationQuaternion.multiply(rotationQuaternion);
			return {
				name: fbxNode.name,
				childIndices: fbxNode.childIndices,
				meshIndex: undefined,
				skinIndex: undefined,
				baseTranslation: fbxNode.translation.slice(),
				baseRotation: baseRotation,
				baseScale: fbxNode.scale.slice(),
				currentTranslation: [0, 0, 0],
				currentRotation: Quaternion.identity(),
				currentScale: [1, 1, 1],
				worldMatrix: Matrix4.createIdentity(),
			};
		});
		this.#rootNodeIndices = sceneData.rootNodeIndices.slice();

		// 스킨 구성. (클러스터 → 조인트 노드 인덱스 + 링크 변환의 역행렬)
		const skinIdList = System.Array.from(sceneData.skinDeformerById.keys());
		this.#skinList = skinIdList.map((skinId) => {
			const skinDeformer = sceneData.skinDeformerById.get(skinId);
			const jointNodeIndices = [];
			const inverseBindMatrices = [];
			for (const clusterId of skinDeformer.clusterIds) {
				const cluster = sceneData.clusterById.get(clusterId);
				const boneNodeIndex = cluster && cluster.boneNodeId !== null ? sceneData.nodeIdToIndex.get(cluster.boneNodeId) : undefined;
				jointNodeIndices.push(boneNodeIndex !== undefined ? boneNodeIndex : -1);
				// 클러스터 Transform = TransformLink^-1 x 메시 바인드 전역행렬, 그 자체가 역바인드 행렬.
				// 미보유 시 TransformLink 의 역행렬로 대체. (메시 전역 = 단위행렬 가정, 둘 다 없으면 단위 행렬)
				let inverseBindMatrix = Matrix4.createIdentity();
				if (cluster && cluster.transform && cluster.transform.length >= 16) {
					const bindElements = inverseBindMatrix.getElements();
					bindElements.set(cluster.transform.slice(0, 16));
				}
				else if (cluster && cluster.transformLink && cluster.transformLink.length >= 16) {
					const linkMatrix = Matrix4.createIdentity();
					const linkElements = linkMatrix.getElements();
					linkElements.set(cluster.transformLink.slice(0, 16));
					inverseBindMatrix = Matrix4.createInverse(linkMatrix);
				}
				inverseBindMatrices.push(inverseBindMatrix);
			}
			return {
				jointNodeIndices: jointNodeIndices,
				inverseBindMatrices: inverseBindMatrices,
				jointMatrixArray: new System.Float32Array(jointNodeIndices.length * 16),
			};
		});

		// 이미지 서술 구성 헬퍼. (텍스처 id → 임베디드 이미지 바이트, FBX 는 상하 반전 필요)
		function createFbxImageDescription(textureId) {
			if (textureId === null) {
				return null;
			}
			const texture = sceneData.textureById.get(textureId);
			if (!texture || texture.videoId === null) {
				return null;
			}
			const video = sceneData.videoById.get(texture.videoId);
			if (!video || !video.contentBytes || video.contentBytes.length === 0) {
				return null;
			}
			return { bytes: video.contentBytes, mimeType: null, flipY: true };
		}

		// 중립 머티리얼 서술 구성. (FBX phong → 비금속 + 스펙큘러/글로스 근사 경로)
		const materialIdList = System.Array.from(sceneData.materialById.keys());
		const materialDescriptionList = materialIdList.map((materialId) => {
			const fbxMaterial = sceneData.materialById.get(materialId);
			const description = Material.createDefaultDescription();
			description.baseColorFactor = fbxMaterial.diffuseColor.slice(0, 3);
			description.baseColorImage = createFbxImageDescription(fbxMaterial.diffuseTextureId);
			description.normalImage = createFbxImageDescription(fbxMaterial.normalTextureId);
			description.specularImage = createFbxImageDescription(fbxMaterial.specularTextureId);
			description.glossinessImage = createFbxImageDescription(fbxMaterial.glossTextureId);
			return description;
		});

		// 지오메트리를 소유한 노드 조회 헬퍼. (스킨 메시 노드 → 머티리얼)
		function findNodeByGeometryId(geometryId) {
			for (const fbxNode of sceneData.nodeList) {
				if (fbxNode.geometryId === geometryId) {
					return fbxNode;
				}
			}
			return null;
		}

		// 스킨드 메시 → 중립 메시 서술 구성.
		const meshDescriptionList = [];
		for (let skinListIndex = 0; skinListIndex < skinIdList.length; ++skinListIndex) {
			const skinId = skinIdList[skinListIndex];
			const skinDeformer = sceneData.skinDeformerById.get(skinId);
			const geometry = sceneData.geometryById.get(skinDeformer.geometryId);
			if (!geometry) {
				continue;
			}

			// 정점별 스킨 영향 누적. (클러스터 로컬 조인트 인덱스 + 가중치)
			const influencesPerVertex = new System.Array(geometry.originalVertexCount);
			for (let vertexIndex = 0; vertexIndex < geometry.originalVertexCount; ++vertexIndex) {
				influencesPerVertex[vertexIndex] = [];
			}
			for (let clusterLocalIndex = 0; clusterLocalIndex < skinDeformer.clusterIds.length; ++clusterLocalIndex) {
				const cluster = sceneData.clusterById.get(skinDeformer.clusterIds[clusterLocalIndex]);
				if (!cluster) {
					continue;
				}
				for (let influenceIndex = 0; influenceIndex < cluster.vertexIndices.length; ++influenceIndex) {
					const vertexIndex = cluster.vertexIndices[influenceIndex];
					const weight = influenceIndex < cluster.weights.length ? cluster.weights[influenceIndex] : 0;
					if (vertexIndex >= 0 && vertexIndex < geometry.originalVertexCount) {
						influencesPerVertex[vertexIndex].push({ jointIndex: clusterLocalIndex, weight: weight });
					}
				}
			}

			// 정점별 상위 4개 선택 + 정규화.
			const vertexJointArray = new System.Uint16Array(geometry.originalVertexCount * 4);
			const vertexWeightArray = new System.Float32Array(geometry.originalVertexCount * 4);
			for (let vertexIndex = 0; vertexIndex < geometry.originalVertexCount; ++vertexIndex) {
				const influenceList = influencesPerVertex[vertexIndex];
				influenceList.sort((left, right) => right.weight - left.weight);
				let weightSum = 0;
				const usedCount = System.Math.min(4, influenceList.length);
				for (let slotIndex = 0; slotIndex < usedCount; ++slotIndex) {
					weightSum += influenceList[slotIndex].weight;
				}
				if (weightSum <= 0) {
					weightSum = 1;
				}
				for (let slotIndex = 0; slotIndex < usedCount; ++slotIndex) {
					vertexJointArray[vertexIndex * 4 + slotIndex] = influenceList[slotIndex].jointIndex;
					vertexWeightArray[vertexIndex * 4 + slotIndex] = influenceList[slotIndex].weight / weightSum;
				}
			}

			// 코너 단위(비인덱스)로 조인트/가중치 펼침.
			const cornerCount = geometry.cornerCount;
			const cornerJointArray = new System.Uint16Array(cornerCount * 4);
			const cornerWeightArray = new System.Float32Array(cornerCount * 4);
			for (let cornerIndex = 0; cornerIndex < cornerCount; ++cornerIndex) {
				const originalVertexIndex = geometry.originalVertexIndices[cornerIndex];
				if (originalVertexIndex < 0 || originalVertexIndex >= geometry.originalVertexCount) {
					continue;
				}
				for (let slotIndex = 0; slotIndex < 4; ++slotIndex) {
					cornerJointArray[cornerIndex * 4 + slotIndex] = vertexJointArray[originalVertexIndex * 4 + slotIndex];
					cornerWeightArray[cornerIndex * 4 + slotIndex] = vertexWeightArray[originalVertexIndex * 4 + slotIndex];
				}
			}

			// 머티리얼 인덱스 조회. (지오메트리 소유 노드의 첫 머티리얼)
			const ownerNode = findNodeByGeometryId(skinDeformer.geometryId);
			let materialIndex = -1;
			if (ownerNode && ownerNode.materialIds.length > 0) {
				materialIndex = materialIdList.indexOf(ownerNode.materialIds[0]);
			}

			meshDescriptionList.push({
				positions: geometry.positions,
				normals: geometry.normals,
				textureCoordinates: geometry.textureCoordinates,
				joints: cornerJointArray,
				weights: cornerWeightArray,
				indices: null,
				skinIndex: skinListIndex,
				materialIndex: materialIndex,
				nodeIndex: ownerNode ? sceneData.nodeList.indexOf(ownerNode) : -1,
				morphTargets: [],
				morphWeights: new System.Float32Array(0),
			});
		}

		// 애니메이션 구성. (회전 채널은 오일러 도 → 사전회전 합성 쿼터니언 4성분으로 변환)
		this.#animationList = sceneData.animationList.map((fbxAnimation) => {
			const channels = convertFbxAnimationChannels(sceneData, fbxAnimation, (nodeIndex) => nodeIndex);
			return { name: fbxAnimation.name, duration: fbxAnimation.duration, channels: channels };
		});

		if (this.#animationList.length > 0) {
			this.#currentAnimation = this.#animationList[0];
		}
		return { meshDescriptionList: meshDescriptionList, materialDescriptionList: materialDescriptionList };
	}

	//==============================================================================
	// 애니메이션 FBX 추가 로드. (본 이름 매칭 리타게팅, Mixamo 애니메이션 전용 FBX)
	// - 동일 스켈레톤을 전제로, 채널을 현재 모델의 노드 인덱스로 재지정해 클립을 추가한다.
	// - ignoreTranslation: 루트 모션이 박힌 클립에서 이동 채널을 버린다. (게임 로직이 위치를 제어할 때)
	//==============================================================================
	/**
	 * @param { string } url 애니메이션 FBX 파일 주소.
	 * @param { string } clipName 더할 클립 이름. (채널이 있는 스택이 하나면 이 이름, 여럿이면 스택마다 "이 이름/스택 이름")
	 * @param { boolean } ignoreTranslation 참이면 이동 채널을 버린다. (기본 false)
	 */
	async addAnimationsFromFbxUrl(url, clipName, ignoreTranslation = false) {
		const sceneData = await FbxLoader.loadFromUrl(url);
		this.addAnimationsFromFbxSceneData(sceneData, clipName, ignoreTranslation);
	}

	//==============================================================================
	// 애니메이션 FBX 추가. (바이트, addAnimationsFromFbxUrl 의 fetch 뒤 부분)
	//==============================================================================
	/**
	 * @param { ArrayBuffer } arrayBuffer 애니메이션 FBX 파일 바이트.
	 * @param { string } clipName 더할 클립 이름. (채널이 있는 스택이 하나면 이 이름, 여럿이면 스택마다 "이 이름/스택 이름")
	 * @param { boolean } ignoreTranslation 참이면 이동 채널을 버린다. (기본 false)
	 */
	async addAnimationsFromFbxBytes(arrayBuffer, clipName, ignoreTranslation = false) {
		const sceneData = await new FbxLoader().parse(arrayBuffer);
		this.addAnimationsFromFbxSceneData(sceneData, clipName, ignoreTranslation);
	}

	//==============================================================================
	// 애니메이션 FBX 추가. (FbxLoader 가 읽은 중간 표현, 본 이름 매칭 리타게팅)
	//==============================================================================
	/**
	 * @param { object } sceneData FbxLoader 가 읽은 중간 표현.
	 * @param { string } clipName 더할 클립 이름. (채널이 있는 스택이 하나면 이 이름, 여럿이면 스택마다 "이 이름/스택 이름")
	 * @param { boolean } ignoreTranslation 참이면 이동 채널을 버린다. (기본 false)
	 */
	addAnimationsFromFbxSceneData(sceneData, clipName, ignoreTranslation = false) {
		const nodeList = this.getNodeList();
		const nodeIndexByName = new System.Map();
		for (let nodeIndex = 0; nodeIndex < nodeList.length; ++nodeIndex) {
			nodeIndexByName.set(nodeList[nodeIndex].name, nodeIndex);
		}
		// 채널이 있는 스택만 클립이 된다. (스택이 여럿이면 스택마다 제 이름의 클립)
		const channelAnimationList = sceneData.animationList.filter((fbxAnimation) => fbxAnimation.channels.length > 0);
		for (let stackIndex = 0; stackIndex < channelAnimationList.length; ++stackIndex) {
			const fbxAnimation = channelAnimationList[stackIndex];
			let channels = convertFbxAnimationChannels(sceneData, fbxAnimation, (nodeIndex) => {
				const sourceNode = sceneData.nodeList[nodeIndex];
				return sourceNode ? nodeIndexByName.get(sourceNode.name) : undefined;
			});
			if (ignoreTranslation) {
				channels = channels.filter((channel) => channel.path !== "translation");
			}
			const animationName = createFbxClipName(clipName, fbxAnimation.name, stackIndex, channelAnimationList.length);
			this.#animationList.push({ name: animationName, duration: fbxAnimation.duration, channels: channels });
		}
	}

	//==============================================================================
	// 중립 메시/머티리얼 서술 업로드. (공용, Material 생성 + VAO/드로어블 구성)
	// - 예전 드로어블의 GL 리소스와 이 모델이 지은 머티리얼은 먼저 지운다. (destroy, 다시 불러도 새지 않는다)
	//==============================================================================
	/**
	 * @param { object[] } meshDescriptionList 중립 메시 서술 목록.
	 * @param { object[] } materialDescriptionList 중립 머티리얼 서술 목록. (메시의 materialIndex 가 가리키고, 없으면 기본 머티리얼)
	 */
	async uploadMeshesAndMaterials(meshDescriptionList, materialDescriptionList) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const shaderProgram = this.getShaderProgram();
		if (!webGL2RenderingContext || !shaderProgram) {
			throw new Error("SkinnedModel: no shader program to upload with.");
		}
		this.destroy();
		const materialList = [];
		for (const materialDescription of materialDescriptionList) {
			const material = await Material.createFromDescription(webGL2RenderingContext, shaderProgram, materialDescription);
			materialList.push(material);
			this.#ownedMaterialList.push(material);
		}
		const defaultDescription = Material.createDefaultDescription();
		const defaultMaterial = await Material.createFromDescription(webGL2RenderingContext, shaderProgram, defaultDescription);
		this.#ownedMaterialList.push(defaultMaterial);

		this.#drawableList = [];
		for (const meshDescription of meshDescriptionList) {
			let normals = meshDescription.normals;
			if (!normals) {
				normals = this.generateSmoothNormals(meshDescription.positions, meshDescription.indices);
			}
			const vertexArray = webGL2RenderingContext.createVertexArray();
			webGL2RenderingContext.bindVertexArray(vertexArray);
			const vertexBufferList = [];
			vertexBufferList.push(this.bindFloatAttribute(shaderProgram, "vertexPosition", meshDescription.positions, 3));
			vertexBufferList.push(this.bindFloatAttribute(shaderProgram, "vertexNormal", normals, 3));
			if (meshDescription.textureCoordinates) {
				vertexBufferList.push(this.bindFloatAttribute(shaderProgram, "vertexTextureCoordinate", meshDescription.textureCoordinates, 2));
			}
			vertexBufferList.push(this.bindIntegerAttribute(shaderProgram, "vertexJoints", meshDescription.joints, 4));
			vertexBufferList.push(this.bindFloatAttribute(shaderProgram, "vertexWeights", meshDescription.weights, 4));

			// 인덱스. (없는 메시는 drawArrays 로 출력)
			let indexCount = 0;
			let indexComponentType = 0;
			let indexBuffer = null;
			const isIndexed = meshDescription.indices !== null;
			if (isIndexed) {
				indexBuffer = webGL2RenderingContext.createBuffer();
				webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ELEMENT_ARRAY_BUFFER, indexBuffer);
				webGL2RenderingContext.bufferData(webGL2RenderingContext.ELEMENT_ARRAY_BUFFER, meshDescription.indices, webGL2RenderingContext.STATIC_DRAW);
				indexCount = meshDescription.indices.length;
				indexComponentType = meshDescription.indices instanceof System.Uint32Array ? webGL2RenderingContext.UNSIGNED_INT : webGL2RenderingContext.UNSIGNED_SHORT;
			}
			webGL2RenderingContext.bindVertexArray(null);

			const material = meshDescription.materialIndex >= 0 && materialList[meshDescription.materialIndex] ? materialList[meshDescription.materialIndex] : defaultMaterial;
			const morphTargetList = meshDescription.morphTargets ? meshDescription.morphTargets.slice() : [];
			this.#drawableList.push({
				vertexArray: vertexArray,
				vertexBufferList: vertexBufferList.filter((vertexBuffer) => vertexBuffer !== null),
				isIndexed: isIndexed,
				indexBuffer: indexBuffer,
				indexCount: indexCount,
				indexComponentType: indexComponentType,
				indexByteOffset: 0,
				wireframeIndexBuffer: null,
				wireframeIndexCount: 0,
				wireframeIndexComponentType: 0,
				vertexCount: meshDescription.positions.length / 3,
				material: material,
				materialName: meshDescription.materialName !== undefined ? meshDescription.materialName : "",
				skinIndex: meshDescription.skinIndex,
				nodeIndex: meshDescription.nodeIndex !== undefined ? meshDescription.nodeIndex : -1,
				meshDescription: meshDescription,
				morphTargetList: morphTargetList,
				morphWeights: meshDescription.morphWeights ? new System.Float32Array(meshDescription.morphWeights) : new System.Float32Array(0),
				morphTexture: null,
				morphRowsPerTarget: 0,
				morphTextureWidth: 0,
				isMorphDirty: morphTargetList.length > 0,
			});
		}
	}

	//==============================================================================
	// 와이어프레임 인덱스 업로드. (삼각형 인덱스 → 중복 없는 모서리 선 인덱스, 비인덱스 메시는 삼각형별 3변)
	// - 드로어블의 버텍스 어레이와 무관한 별도 엘리먼트 버퍼. 렌더러가 선 출력 시 잠시 바꿔 끼운다.
	// - 이미 올린 선 버퍼가 있으면 지우고 새로 올린다.
	//==============================================================================
	/**
	 * @param { object } drawable 선 인덱스를 올릴 드로어블.
	 */
	uploadWireframeIndices(drawable) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		if (drawable.wireframeIndexBuffer) {
			webGL2RenderingContext.deleteBuffer(drawable.wireframeIndexBuffer);
			drawable.wireframeIndexBuffer = null;
		}
		const vertexCount = drawable.vertexCount;
		const edgeList = SkinnedModel.buildWireframeEdgeList(drawable.meshDescription.indices, vertexCount);
		const useUnsignedInt = vertexCount > 65535;
		const wireframeIndices = useUnsignedInt ? new System.Uint32Array(edgeList) : new System.Uint16Array(edgeList);
		const wireframeIndexBuffer = webGL2RenderingContext.createBuffer();
		webGL2RenderingContext.bindVertexArray(null);
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ELEMENT_ARRAY_BUFFER, wireframeIndexBuffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ELEMENT_ARRAY_BUFFER, wireframeIndices, webGL2RenderingContext.STATIC_DRAW);
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ELEMENT_ARRAY_BUFFER, null);
		drawable.wireframeIndexBuffer = wireframeIndexBuffer;
		drawable.wireframeIndexCount = wireframeIndices.length;
		drawable.wireframeIndexComponentType = useUnsignedInt ? webGL2RenderingContext.UNSIGNED_INT : webGL2RenderingContext.UNSIGNED_SHORT;
	}

	//==============================================================================
	// 와이어프레임 모서리 목록 만들기. (정적, GL 무관, 인덱스 쌍 목록)
	//==============================================================================
	/**
	 * @param { Uint16Array | Uint32Array | null } triangleIndices 삼각형 인덱스. (null 이면 정점 셋씩 삼각형으로 본다)
	 * @param { number } vertexCount 정점 수.
	 * @returns { number[] } 중복 없는 모서리의 정점 인덱스 쌍을 이어 놓은 목록.
	 */
	static buildWireframeEdgeList(triangleIndices, vertexCount) {
		const edgeList = [];
		if (triangleIndices) {
			const edgeKeySet = new System.Set();
			const triangleCount = triangleIndices.length / 3;
			for (let triangleIndex = 0; triangleIndex < triangleCount; ++triangleIndex) {
				for (let cornerIndex = 0; cornerIndex < 3; ++cornerIndex) {
					const indexA = triangleIndices[triangleIndex * 3 + cornerIndex];
					const indexB = triangleIndices[triangleIndex * 3 + (cornerIndex + 1) % 3];
					const minimumIndex = System.Math.min(indexA, indexB);
					const maximumIndex = System.Math.max(indexA, indexB);
					const edgeKey = minimumIndex * vertexCount + maximumIndex;
					if (edgeKeySet.has(edgeKey)) {
						continue;
					}
					edgeKeySet.add(edgeKey);
					edgeList.push(minimumIndex, maximumIndex);
				}
			}
		}
		else {
			for (let vertexIndex = 0; vertexIndex + 2 < vertexCount; vertexIndex += 3) {
				edgeList.push(vertexIndex, vertexIndex + 1, vertexIndex + 1, vertexIndex + 2, vertexIndex + 2, vertexIndex);
			}
		}
		return edgeList;
	}

	//==============================================================================
	// 모프 타깃 업로드. (드로어블의 델타 목록 → RGBA32F 텍스처, 타깃마다 위치 블록 + 노멀 블록)
	// - 텍셀 인덱스 = 정점 인덱스. 블록 시작 행 = 타깃 인덱스 x 2 x 타깃당 행 수.
	//==============================================================================
	/**
	 * @param { object } drawable 모프 텍스처를 올릴 드로어블. (타깃이 없으면 텍스처를 지운다)
	 */
	uploadMorphTargets(drawable) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const targetCount = drawable.morphTargetList.length;
		const vertexCount = drawable.vertexCount;
		if (targetCount === 0 || vertexCount === 0) {
			if (drawable.morphTexture) {
				webGL2RenderingContext.deleteTexture(drawable.morphTexture);
				drawable.morphTexture = null;
			}
			drawable.isMorphDirty = false;
			return;
		}
		const morphTexelData = SkinnedModel.buildMorphTexelData(drawable.morphTargetList, vertexCount);
		const textureWidth = morphTexelData.textureWidth;
		const rowsPerTarget = morphTexelData.rowsPerTarget;
		const textureHeight = rowsPerTarget * 2 * targetCount;
		const texelData = morphTexelData.texelData;
		if (!drawable.morphTexture) {
			drawable.morphTexture = webGL2RenderingContext.createTexture();
		}
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, drawable.morphTexture);
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA32F, textureWidth, textureHeight, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.FLOAT, texelData);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.NEAREST);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.NEAREST);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);
		drawable.morphRowsPerTarget = rowsPerTarget;
		drawable.morphTextureWidth = textureWidth;
		drawable.isMorphDirty = false;
	}

	//==============================================================================
	// 모프 텍셀 데이터 만들기. (정적, GL 무관, 텍스처 가로, 타깃당 행 수, RGBA 실수 배열)
	//==============================================================================
	/**
	 * @param { object[] } morphTargetList 모프 타깃 목록. ([{ name, positionDeltas, normalDeltas }])
	 * @param { number } vertexCount 정점 수.
	 * @returns { { textureWidth: number, rowsPerTarget: number, texelData: Float32Array } } 텍스처 가로(정점 수와 2048 가운데 작은 값, 최소 1), 타깃당 행 수, RGBA 실수 텍셀 배열.
	 */
	static buildMorphTexelData(morphTargetList, vertexCount) {
		const targetCount = morphTargetList.length;
		const textureWidth = System.Math.max(1, System.Math.min(vertexCount, MORPH_TEXTURE_WIDTH));
		const rowsPerTarget = System.Math.ceil(vertexCount / textureWidth);
		const textureHeight = rowsPerTarget * 2 * targetCount;
		const texelData = new System.Float32Array(textureWidth * textureHeight * 4);
		for (let targetIndex = 0; targetIndex < targetCount; ++targetIndex) {
			const morphTarget = morphTargetList[targetIndex];
			const positionBlockOffset = targetIndex * 2 * rowsPerTarget * textureWidth;
			const normalBlockOffset = positionBlockOffset + rowsPerTarget * textureWidth;
			for (let vertexIndex = 0; vertexIndex < vertexCount; ++vertexIndex) {
				const positionTexelOffset = (positionBlockOffset + vertexIndex) * 4;
				texelData[positionTexelOffset] = morphTarget.positionDeltas[vertexIndex * 3];
				texelData[positionTexelOffset + 1] = morphTarget.positionDeltas[vertexIndex * 3 + 1];
				texelData[positionTexelOffset + 2] = morphTarget.positionDeltas[vertexIndex * 3 + 2];
				if (morphTarget.normalDeltas) {
					const normalTexelOffset = (normalBlockOffset + vertexIndex) * 4;
					texelData[normalTexelOffset] = morphTarget.normalDeltas[vertexIndex * 3];
					texelData[normalTexelOffset + 1] = morphTarget.normalDeltas[vertexIndex * 3 + 1];
					texelData[normalTexelOffset + 2] = morphTarget.normalDeltas[vertexIndex * 3 + 2];
				}
			}
		}
		return { textureWidth: textureWidth, rowsPerTarget: rowsPerTarget, texelData: texelData };
	}

	//==============================================================================
	// 모프 타깃 추가. (프로그램 생성, 정점별 위치 델타 [+ 노멀 델타], 다음 update() 에서 업로드)
	//==============================================================================
	/**
	 * @param { number } drawableIndex 드로어블 번호. (없으면 오류를 던진다)
	 * @param { string } targetName 타깃 이름. (setMorphWeight 가 이 이름으로 찾는다)
	 * @param { Float32Array } positionDeltas 정점마다 위치 델타 x, y, z. (길이가 정점 수 x 3 이 아니면 오류를 던진다)
	 * @param { Float32Array | null } normalDeltas 정점마다 노멀 델타 x, y, z. (null 이면 노멀은 그대로)
	 * @example <caption>코드로 모프 타깃을 만들어 반만 걸기</caption>
	 * import { SkinnedModel, SkinnedModelRenderer } from "./build/vanilla.js";
	 *
	 * const canvas = document.createElement("canvas");
	 * const webGL2RenderingContext = canvas.getContext("webgl2");
	 * const skinnedModelRenderer = new SkinnedModelRenderer(webGL2RenderingContext);
	 * const skinnedModel = await SkinnedModel.loadFromUrl(webGL2RenderingContext, "examples/ancientmountain/assets/fox.glb", skinnedModelRenderer);
	 * const drawableList = skinnedModel.getDrawableList();
	 * const vertexCount = drawableList[0].vertexCount;
	 * const positionDeltas = new Float32Array(vertexCount * 3);
	 * for (let vertexIndex = 0; vertexIndex < vertexCount; ++vertexIndex) {
	 * 	positionDeltas[vertexIndex * 3 + 1] = 5;
	 * }
	 * skinnedModel.addMorphTarget(0, "lift", positionDeltas);
	 * skinnedModel.setMorphWeight("lift", 0.5);
	 * skinnedModel.update(0);
	 * const weight = skinnedModel.getMorphWeight("lift");
	 * console.log(weight);
	 */
	addMorphTarget(drawableIndex, targetName, positionDeltas, normalDeltas = null) {
		const drawable = this.#drawableList[drawableIndex];
		if (!drawable) {
			throw new Error(`SkinnedModel: drawable ${drawableIndex} not found.`);
		}
		if (drawable.morphTargetList.length >= MORPH_TARGET_MAXIMUM) {
			throw new Error(`SkinnedModel: morph target limit ${MORPH_TARGET_MAXIMUM} exceeded.`);
		}
		if (positionDeltas.length !== drawable.vertexCount * 3) {
			throw new Error(`SkinnedModel: morph target "${targetName}" delta count mismatch.`);
		}
		drawable.morphTargetList.push({ name: targetName, positionDeltas: positionDeltas, normalDeltas: normalDeltas });
		const morphWeights = new System.Float32Array(drawable.morphTargetList.length);
		morphWeights.set(drawable.morphWeights);
		drawable.morphWeights = morphWeights;
		drawable.isMorphDirty = true;
	}

	//==============================================================================
	// 모프 가중치 설정. (이름 일치 타깃 전부, 드로어블 여러 개가 같은 이름을 가질 수 있음)
	//==============================================================================
	/**
	 * @param { string } targetName 타깃 이름.
	 * @param { number } weight 가중치. (0 이면 꺼지고 1 이면 델타 그대로)
	 */
	setMorphWeight(targetName, weight) {
		for (const drawable of this.#drawableList) {
			for (let targetIndex = 0; targetIndex < drawable.morphTargetList.length; ++targetIndex) {
				if (drawable.morphTargetList[targetIndex].name === targetName) {
					drawable.morphWeights[targetIndex] = weight;
				}
			}
		}
	}

	//==============================================================================
	// 모프 가중치 반환. (첫 일치 타깃, 없으면 0)
	//==============================================================================
	/**
	 * @param { string } targetName 타깃 이름.
	 * @returns { number } 첫 일치 타깃의 가중치. (없으면 0)
	 */
	getMorphWeight(targetName) {
		for (const drawable of this.#drawableList) {
			for (let targetIndex = 0; targetIndex < drawable.morphTargetList.length; ++targetIndex) {
				if (drawable.morphTargetList[targetIndex].name === targetName) {
					return drawable.morphWeights[targetIndex];
				}
			}
		}
		return 0;
	}

	//==============================================================================
	// 머티리얼 교체. (드로어블 단위, 외부 텍스처로 만든 머티리얼 인스턴스 적용)
	//==============================================================================
	/**
	 * @param { number } drawableIndex 드로어블 번호. (없으면 오류를 던진다)
	 * @param { Material } material 바꿔 넣을 머티리얼. (destroy 가 지우지 않는다)
	 */
	setMaterial(drawableIndex, material) {
		const drawable = this.#drawableList[drawableIndex];
		if (!drawable) {
			throw new Error(`SkinnedModel: drawable ${drawableIndex} not found.`);
		}
		drawable.material = material;
	}

	//==============================================================================
	// 스무스 노멀 생성. (노멀 미보유 메시, 바인드 포즈 기준, 스키닝 회전은 셰이더에서 적용)
	//==============================================================================
	/**
	 * @param { Float32Array } positions 정점 위치 x, y, z 배열.
	 * @param { Uint16Array | Uint32Array | null } indices 삼각형 인덱스. (null 이면 정점 셋씩 삼각형으로 본다)
	 * @returns { Float32Array } 정점마다 면 노멀을 더해 정규화한 노멀 배열. (positions 와 같은 길이)
	 */
	generateSmoothNormals(positions, indices) {
		const normals = new System.Float32Array(positions.length);
		const triangleCount = indices ? indices.length / 3 : positions.length / 9;
		for (let triangleIndex = 0; triangleIndex < triangleCount; ++triangleIndex) {
			const indexA = (indices ? indices[triangleIndex * 3] : triangleIndex * 3) * 3;
			const indexB = (indices ? indices[triangleIndex * 3 + 1] : triangleIndex * 3 + 1) * 3;
			const indexC = (indices ? indices[triangleIndex * 3 + 2] : triangleIndex * 3 + 2) * 3;
			const edgeABX = positions[indexB] - positions[indexA];
			const edgeABY = positions[indexB + 1] - positions[indexA + 1];
			const edgeABZ = positions[indexB + 2] - positions[indexA + 2];
			const edgeACX = positions[indexC] - positions[indexA];
			const edgeACY = positions[indexC + 1] - positions[indexA + 1];
			const edgeACZ = positions[indexC + 2] - positions[indexA + 2];
			const faceNormalX = edgeABY * edgeACZ - edgeABZ * edgeACY;
			const faceNormalY = edgeABZ * edgeACX - edgeABX * edgeACZ;
			const faceNormalZ = edgeABX * edgeACY - edgeABY * edgeACX;
			normals[indexA] += faceNormalX;
			normals[indexA + 1] += faceNormalY;
			normals[indexA + 2] += faceNormalZ;
			normals[indexB] += faceNormalX;
			normals[indexB + 1] += faceNormalY;
			normals[indexB + 2] += faceNormalZ;
			normals[indexC] += faceNormalX;
			normals[indexC + 1] += faceNormalY;
			normals[indexC + 2] += faceNormalZ;
		}
		for (let vertexIndex = 0; vertexIndex < normals.length; vertexIndex += 3) {
			const normalLength = System.Math.sqrt(normals[vertexIndex] * normals[vertexIndex] + normals[vertexIndex + 1] * normals[vertexIndex + 1] + normals[vertexIndex + 2] * normals[vertexIndex + 2]);
			if (normalLength > 0) {
				normals[vertexIndex] /= normalLength;
				normals[vertexIndex + 1] /= normalLength;
				normals[vertexIndex + 2] /= normalLength;
			}
		}
		return normals;
	}

	//==============================================================================
	// 실수형 어트리뷰트 바인드. (신규 버퍼 생성 + 포인터 설정)
	//==============================================================================
	/**
	 * @param { ShaderProgram } shaderProgram 어트리뷰트 위치를 찾을 셰이더 프로그램.
	 * @param { string } attributeName 어트리뷰트 이름.
	 * @param { Float32Array } dataArray 정점 데이터.
	 * @param { number } componentCount 정점당 성분 수.
	 * @returns { WebGLBuffer | null } 지은 버퍼. (셰이더에 없는 어트리뷰트면 null)
	 */
	bindFloatAttribute(shaderProgram, attributeName, dataArray, componentCount) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const attributeLocation = shaderProgram.getAttributeLocation(attributeName);
		if (attributeLocation < 0) {
			return null;
		}
		const glBuffer = webGL2RenderingContext.createBuffer();
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, glBuffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, dataArray, webGL2RenderingContext.STATIC_DRAW);
		webGL2RenderingContext.enableVertexAttribArray(attributeLocation);
		webGL2RenderingContext.vertexAttribPointer(attributeLocation, componentCount, webGL2RenderingContext.FLOAT, false, 0, 0);
		return glBuffer;
	}

	//==============================================================================
	// 정수형 어트리뷰트 바인드. (조인트 인덱스)
	//==============================================================================
	/**
	 * @param { ShaderProgram } shaderProgram 어트리뷰트 위치를 찾을 셰이더 프로그램.
	 * @param { string } attributeName 어트리뷰트 이름.
	 * @param { Uint16Array } dataArray 정점 데이터. (UNSIGNED_SHORT 로 읽는다)
	 * @param { number } componentCount 정점당 성분 수.
	 * @returns { WebGLBuffer | null } 지은 버퍼. (셰이더에 없는 어트리뷰트면 null)
	 */
	bindIntegerAttribute(shaderProgram, attributeName, dataArray, componentCount) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const attributeLocation = shaderProgram.getAttributeLocation(attributeName);
		if (attributeLocation < 0) {
			return null;
		}
		const glBuffer = webGL2RenderingContext.createBuffer();
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, glBuffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, dataArray, webGL2RenderingContext.STATIC_DRAW);
		webGL2RenderingContext.enableVertexAttribArray(attributeLocation);
		webGL2RenderingContext.vertexAttribIPointer(attributeLocation, componentCount, webGL2RenderingContext.UNSIGNED_SHORT, 0, 0);
		return glBuffer;
	}

	//==============================================================================
	// 애니메이션 재생. (크로스페이드)
	//==============================================================================
	/**
	 * @param { string } animationName 클립 이름. (지금 클립과 같거나 없으면 아무것도 하지 않는다, 같은 이름이 여럿이면 마지막 것)
	 * @param { number } fadeDuration 앞 클립에서 넘어가는 시간. (초, 기본 0.25)
	 * @example <caption>걷기에서 달리기로 0.4 초 동안 넘어가기</caption>
	 * import { SkinnedModel } from "./build/vanilla.js";
	 *
	 * const response = await fetch("examples/ancientmountain/assets/fox.glb");
	 * const arrayBuffer = await response.arrayBuffer();
	 * const glbChunks = SkinnedModel.readGlbChunks(arrayBuffer);
	 * const skinnedModel = SkinnedModel.createWithoutShaderProgram();
	 * skinnedModel.interpretContent(glbChunks.json, glbChunks.binaryBuffer);
	 * skinnedModel.playAnimation("Walk", 0);
	 * skinnedModel.update(1.0);
	 * skinnedModel.playAnimation("Run", 0.4);
	 * for (let frameIndex = 0; frameIndex < 30; ++frameIndex) {
	 * 	skinnedModel.update(1 / 60);
	 * }
	 * const skinList = skinnedModel.getSkinList();
	 * console.log(skinList[0].jointMatrixArray[12]);
	 */
	playAnimation(animationName, fadeDuration = 0.25) {
		if (this.#currentAnimation && this.#currentAnimation.name === animationName) {
			return;
		}
		let foundAnimation = null;
		for (const animation of this.#animationList) {
			if (animation.name === animationName) {
				foundAnimation = animation;
			}
		}
		if (!foundAnimation) {
			return;
		}
		this.#previousAnimation = this.#currentAnimation;
		this.#previousTime = this.#currentTime;
		this.#currentAnimation = foundAnimation;
		this.#currentTime = 0;
		this.#fadeDuration = fadeDuration;
		this.#fadeElapsed = 0;
	}

	//==============================================================================
	// 애니메이션 샘플링. (현재 노드 포즈에 가중 블렌딩)
	//==============================================================================
	/**
	 * @param { object } animation 애니메이션 클립. ({ name, duration, channels })
	 * @param { number } time 클립 시간. (초, 클립 길이로 되감는다)
	 * @param { number } blendWeight 지금 포즈에 섞을 가중치. (1 이면 덮어쓴다)
	 */
	sampleAnimation(animation, time, blendWeight) {
		const nodeList = this.getNodeList();
		const loopedTime = animation.duration > 0 ? time % animation.duration : 0;
		for (const channel of animation.channels) {
			const node = nodeList[channel.nodeIndex];
			if (!node) {
				continue;
			}
			const times = channel.times;
			const keyCount = times.length;

			// 키프레임 커서 탐색. (역방향 점프 시 리셋 후 전진)
			if (channel.cursor >= keyCount - 1 || times[channel.cursor] > loopedTime) {
				channel.cursor = 0;
			}
			while (channel.cursor < keyCount - 2 && times[channel.cursor + 1] < loopedTime) {
				channel.cursor += 1;
			}
			const frameIndex = channel.cursor;
			const nextIndex = System.Math.min(frameIndex + 1, keyCount - 1);
			const spanDuration = times[nextIndex] - times[frameIndex];
			const factor = spanDuration > 0 ? System.Math.max(0, System.Math.min(1, (loopedTime - times[frameIndex]) / spanDuration)) : 0;

			if (channel.path === "rotation") {
				const baseOffset = frameIndex * 4;
				const nextOffset = nextIndex * 4;
				const fromRotation = Quaternion.create(channel.values[baseOffset], channel.values[baseOffset + 1], channel.values[baseOffset + 2], channel.values[baseOffset + 3]);
				const toRotation = Quaternion.create(channel.values[nextOffset], channel.values[nextOffset + 1], channel.values[nextOffset + 2], channel.values[nextOffset + 3]);
				const sampledRotation = Quaternion.slerp(fromRotation, toRotation, factor);
				if (blendWeight >= 1) {
					node.currentRotation = sampledRotation;
				}
				else {
					node.currentRotation = Quaternion.slerp(node.currentRotation, sampledRotation, blendWeight);
				}
			}
			else if (channel.path === "translation" || channel.path === "scale") {
				const targetArray = channel.path === "translation" ? node.currentTranslation : node.currentScale;
				const baseOffset = frameIndex * 3;
				const nextOffset = nextIndex * 3;
				for (let componentIndex = 0; componentIndex < 3; ++componentIndex) {
					const fromValue = channel.values[baseOffset + componentIndex];
					const toValue = channel.values[nextOffset + componentIndex];
					const sampledValue = fromValue + (toValue - fromValue) * factor;
					targetArray[componentIndex] = targetArray[componentIndex] + (sampledValue - targetArray[componentIndex]) * blendWeight;
				}
			}
			else if (channel.path === "weights") {
				// 모프 가중치. (키마다 타깃 개수만큼의 값, 해당 노드의 드로어블 전부에 적용)
				for (const drawable of this.#drawableList) {
					if (drawable.nodeIndex !== channel.nodeIndex) {
						continue;
					}
					const targetCount = drawable.morphWeights.length;
					const baseOffset = frameIndex * targetCount;
					const nextOffset = nextIndex * targetCount;
					for (let targetIndex = 0; targetIndex < targetCount; ++targetIndex) {
						const fromValue = channel.values[baseOffset + targetIndex];
						const toValue = channel.values[nextOffset + targetIndex];
						const sampledValue = fromValue + (toValue - fromValue) * factor;
						drawable.morphWeights[targetIndex] = drawable.morphWeights[targetIndex] + (sampledValue - drawable.morphWeights[targetIndex]) * blendWeight;
					}
				}
			}
		}
	}

	//==============================================================================
	// 갱신. (시간 전진 → 포즈 샘플링 → 월드/조인트 행렬 계산)
	//==============================================================================
	/**
	 * @param { number } deltaTime 지난 프레임에서 흐른 시간. (초, 재생 속도를 곱해 클립 시간을 나아간다)
	 */
	update(deltaTime) {
		// 애니메이션이 없어도 기본 포즈로 월드/조인트 행렬은 계산한다. (정적 모델 지원)
		const currentAnimation = this.#currentAnimation;
		if (currentAnimation) {
			this.#currentTime += deltaTime * this.#timeScale;
			if (this.#previousAnimation) {
				this.#previousTime += deltaTime * this.#timeScale;
				this.#fadeElapsed += deltaTime;
				if (this.#fadeElapsed >= this.#fadeDuration) {
					this.#previousAnimation = null;
				}
			}
		}

		// 1. 기본 포즈로 리셋.
		const nodeList = this.getNodeList();
		for (const node of nodeList) {
			node.currentTranslation[0] = node.baseTranslation[0];
			node.currentTranslation[1] = node.baseTranslation[1];
			node.currentTranslation[2] = node.baseTranslation[2];
			node.currentScale[0] = node.baseScale[0];
			node.currentScale[1] = node.baseScale[1];
			node.currentScale[2] = node.baseScale[2];
			node.currentRotation = node.baseRotation;
		}

		// 2. 이전/현재 클립 샘플링. (크로스페이드)
		if (currentAnimation) {
			if (this.#previousAnimation) {
				this.sampleAnimation(this.#previousAnimation, this.#previousTime, 1);
				const blendWeight = System.Math.min(this.#fadeElapsed / System.Math.max(this.#fadeDuration, 0.0001), 1);
				this.sampleAnimation(currentAnimation, this.#currentTime, blendWeight);
			}
			else {
				this.sampleAnimation(currentAnimation, this.#currentTime, 1);
			}
		}

		// 3. 조인트 회전 오프셋. (절차 포즈 가공)
		for (const [nodeIndex, offsetRotation] of this.#jointRotationOffsets) {
			const node = nodeList[nodeIndex];
			if (node) {
				node.currentRotation = node.currentRotation.multiply(offsetRotation);
			}
		}

		// 4. 월드 행렬 계산. (루트부터 명시적 스택 순회)
		const traversalStack = [];
		for (const rootIndex of this.getRootNodeIndices()) {
			traversalStack.push({ nodeIndex: rootIndex, parentIndex: -1 });
		}
		while (traversalStack.length > 0) {
			const entry = traversalStack.pop();
			const node = nodeList[entry.nodeIndex];
			const localMatrix = Matrix4.createTranslation(node.currentTranslation[0], node.currentTranslation[1], node.currentTranslation[2]);
			const rotationMatrix = Matrix4.createRotationFromQuaternion(node.currentRotation);
			localMatrix.multiply(rotationMatrix);
			localMatrix.scale(node.currentScale[0], node.currentScale[1], node.currentScale[2]);
			if (entry.parentIndex >= 0) {
				const parentNode = nodeList[entry.parentIndex];
				const worldMatrix = parentNode.worldMatrix.clone();
				worldMatrix.multiply(localMatrix);
				node.worldMatrix = worldMatrix;
			}
			else {
				node.worldMatrix = localMatrix;
			}
			for (const childIndex of node.childIndices) {
				traversalStack.push({ nodeIndex: childIndex, parentIndex: entry.nodeIndex });
			}
		}

		// 5. 조인트 행렬. (월드 x 역바인드, 본이 없는 조인트는 단위 행렬)
		for (const skin of this.getSkinList()) {
			for (let jointIndex = 0; jointIndex < skin.jointNodeIndices.length; ++jointIndex) {
				const jointNode = nodeList[skin.jointNodeIndices[jointIndex]];
				if (!jointNode) {
					skin.jointMatrixArray.set(Matrix4.createIdentity().getElements(), jointIndex * 16);
					continue;
				}
				const jointMatrix = jointNode.worldMatrix.clone();
				jointMatrix.multiply(skin.inverseBindMatrices[jointIndex]);
				const jointElements = jointMatrix.getElements();
				skin.jointMatrixArray.set(jointElements, jointIndex * 16);
			}
		}

		// 6. 모프 타깃 업로드. (추가/변경된 드로어블만)
		for (const drawable of this.#drawableList) {
			if (drawable.isMorphDirty) {
				this.uploadMorphTargets(drawable);
			}
		}
	}

	//==============================================================================
	// 조인트 회전 오프셋 설정. (이름 부분 일치 노드에 로컬 회전 누적)
	//==============================================================================
	/**
	 * @param { string } jointNamePart 노드 이름에 든 글. (든 노드 모두)
	 * @param { Quaternion } offsetRotation 애니메이션 포즈 뒤에 로컬 회전으로 곱할 쿼터니언.
	 * @example <caption>애니메이션 위에서 머리를 돌리기</caption>
	 * import { SkinnedModel, Quaternion } from "./build/vanilla.js";
	 *
	 * const response = await fetch("examples/ancientmountain/assets/fox.glb");
	 * const arrayBuffer = await response.arrayBuffer();
	 * const glbChunks = SkinnedModel.readGlbChunks(arrayBuffer);
	 * const skinnedModel = SkinnedModel.createWithoutShaderProgram();
	 * skinnedModel.interpretContent(glbChunks.json, glbChunks.binaryBuffer);
	 * const headTurn = Quaternion.createFromEuler(0, 0.6, 0);
	 * skinnedModel.setJointRotationOffset("b_Head", headTurn);
	 * skinnedModel.update(1 / 60);
	 * skinnedModel.clearJointRotationOffsets();
	 */
	setJointRotationOffset(jointNamePart, offsetRotation) {
		const nodeList = this.getNodeList();
		for (let nodeIndex = 0; nodeIndex < nodeList.length; ++nodeIndex) {
			if (nodeList[nodeIndex].name.includes(jointNamePart)) {
				this.#jointRotationOffsets.set(nodeIndex, offsetRotation);
			}
		}
	}

	//==============================================================================
	// 조인트 회전 오프셋 전체 해제.
	//==============================================================================
	clearJointRotationOffsets() {
		this.#jointRotationOffsets.clear();
	}

	//==============================================================================
	// 애니메이션 이름 목록 반환.
	//==============================================================================
	/**
	 * @returns { string[] } 클립 이름 목록. (클립 차례)
	 */
	getAnimationNameList() {
		const nameList = this.#animationList.map((animation) => animation.name);
		return nameList;
	}

	//==============================================================================
	// 재생 속도 설정.
	//==============================================================================
	/**
	 * @param { number } timeScale 재생 속도 배율. (기본 1, 크로스페이드 시간에는 곱하지 않는다)
	 */
	setTimeScale(timeScale) {
		this.#timeScale = timeScale;
	}

	//==============================================================================
	// 렌더링 컨텍스트 반환.
	//==============================================================================
	/**
	 * @returns { WebGL2RenderingContext } 렌더링 컨텍스트. (셰이더 없이 지었으면 null)
	 */
	getWebGL2RenderingContext() {
		return this.#webGL2RenderingContext;
	}

	//==============================================================================
	// 셰이더 프로그램 반환.
	//==============================================================================
	/**
	 * @returns { ShaderProgram } 셰이더 프로그램. (셰이더 없이 지었으면 null)
	 */
	getShaderProgram() {
		return this.#shaderProgram;
	}

	//==============================================================================
	// 노드 목록 반환.
	//==============================================================================
	/**
	 * @returns { object[] } 노드 목록. (이름, 자식 번호, 기본과 지금의 이동, 회전, 배율, 월드 행렬)
	 */
	getNodeList() {
		return this.#nodeList;
	}

	//==============================================================================
	// 루트 노드 인덱스 목록 반환.
	//==============================================================================
	/**
	 * @returns { number[] } 장면 루트 노드 번호 목록.
	 */
	getRootNodeIndices() {
		return this.#rootNodeIndices;
	}

	//==============================================================================
	// 스킨 목록 반환.
	//==============================================================================
	/**
	 * @returns { object[] } 스킨 목록. (조인트 노드 번호, 역바인드 행렬, 조인트 행렬 배열)
	 */
	getSkinList() {
		return this.#skinList;
	}

	//==============================================================================
	// 드로어블 목록 반환.
	//==============================================================================
	/**
	 * @returns { object[] } 드로어블 목록. (버텍스 어레이, 인덱스, 머티리얼, 스킨 번호, 모프 상태)
	 */
	getDrawableList() {
		return this.#drawableList;
	}

	//==============================================================================
	// 애니메이션 클립 목록 반환.
	//==============================================================================
	/**
	 * @returns { object[] } 애니메이션 클립 목록. ({ name, duration, channels })
	 */
	getAnimationList() {
		return this.#animationList;
	}

	//==============================================================================
	// 파괴. (GL 리소스 해제, 버텍스 어레이, 버퍼, 모프 텍스처, 이 모델이 업로드에서 지은 머티리얼의 텍스처)
	// - setMaterial 로 바깥에서 넣은 머티리얼은 지우지 않는다. 이 모델이 지은 머티리얼을 다른 모델에 넣어 썼다면 함께 지워진다.
	//==============================================================================
	destroy() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		if (!webGL2RenderingContext) {
			this.#drawableList = [];
			return;
		}
		for (const drawable of this.#drawableList) {
			webGL2RenderingContext.deleteVertexArray(drawable.vertexArray);
			for (const vertexBuffer of drawable.vertexBufferList) {
				webGL2RenderingContext.deleteBuffer(vertexBuffer);
			}
			if (drawable.indexBuffer) {
				webGL2RenderingContext.deleteBuffer(drawable.indexBuffer);
			}
			if (drawable.wireframeIndexBuffer) {
				webGL2RenderingContext.deleteBuffer(drawable.wireframeIndexBuffer);
			}
			if (drawable.morphTexture) {
				webGL2RenderingContext.deleteTexture(drawable.morphTexture);
			}
		}
		this.#drawableList = [];
		for (const material of this.#ownedMaterialList) {
			material.destroy();
		}
		this.#ownedMaterialList = [];
	}
}
