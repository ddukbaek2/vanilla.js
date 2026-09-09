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

// 모프 타깃 텍스처 가로 크기. (정점 델타를 실수 텍스처에 행 단위로 적재 — 버텍스 셰이더가 gl_VertexID 로 조회)
const MORPH_TEXTURE_WIDTH = 2048;

// 드로어블당 모프 타깃 최대 개수. (셰이더 유니폼 배열 크기와 일치)
export const MORPH_TARGET_MAXIMUM = 96;


//==============================================================================
// 전역 함수 목록.
//==============================================================================
//==============================================================================
// FBX 오일러(도) → 쿼터니언. (eEulerXYZ = X 먼저 적용 — 열벡터 기준 Rz x Ry x Rx 합성)
//==============================================================================
/**
 * @param { number } xDegree
 * @param { number } yDegree
 * @param { number } zDegree
 * @returns { Quaternion }
 */
function createQuaternionFromFbxEuler(xDegree, yDegree, zDegree) {
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
// 스킨드 모델. (모델 인스턴스 — 메시/본/스킨/머티리얼/애니메이션 데이터 + 포즈 상태)
// - GLB(바이너리 glTF)와 바이너리 FBX 를 공통 중립 스키마로 해석해 GL 리소스를 구성한다.
// - 스킨 없는 정적 메시는 합성 스킨(조인트 1개)으로, 모프 타깃은 실수 텍스처로 올려 같은 스키닝 경로로 그린다.
// - 애니메이션 크로스페이드와 조인트 회전 오프셋(절차 포즈 가공), 모프 가중치(glTF weights / 프로그램)를 지원한다.
// - 렌더링은 SkinnedModelRenderer 가 담당한다. (모델은 렌더 기능을 갖지 않는다)
//==============================================================================
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

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 * @param { ShaderProgram } shaderProgram
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
	}

	//==============================================================================
	// URL 로부터 로드. (정적 — GLB 바이너리 glTF)
	//==============================================================================
	/**
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 * @param { string } url
	 * @param { SkinnedModelRenderer } skinnedModelRenderer
	 * @returns { Promise<SkinnedModel> }
	 */
	static async loadFromUrl(webGL2RenderingContext, url, skinnedModelRenderer) {
		const response = await System.fetch(url);
		if (!response.ok) {
			throw new Error(`SkinnedModel load failed: ${url}`);
		}
		const arrayBuffer = await response.arrayBuffer();
		const shaderProgram = skinnedModelRenderer.getShaderProgram();
		const model = new SkinnedModel(webGL2RenderingContext, shaderProgram);
		await model.parseBinary(arrayBuffer);
		return model;
	}

	//==============================================================================
	// URL 로부터 로드. (정적 — 바이너리 FBX)
	//==============================================================================
	/**
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 * @param { string } url
	 * @param { SkinnedModelRenderer } skinnedModelRenderer
	 * @returns { Promise<SkinnedModel> }
	 */
	static async loadFromFbxUrl(webGL2RenderingContext, url, skinnedModelRenderer) {
		const sceneData = await FbxLoader.loadFromUrl(url);
		const shaderProgram = skinnedModelRenderer.getShaderProgram();
		const model = new SkinnedModel(webGL2RenderingContext, shaderProgram);
		await model.parseFbxContent(sceneData);
		return model;
	}

	//==============================================================================
	// GLB 바이너리 해석.
	//==============================================================================
	/**
	 * @param { ArrayBuffer } arrayBuffer
	 */
	async parseBinary(arrayBuffer) {
		const dataView = new System.DataView(arrayBuffer);
		if (dataView.getUint32(0, true) !== 0x46546c67) {
			throw new Error("SkinnedModel: not a GLB file.");
		}

		// 청크 순회. (JSON + BIN)
		let json = null;
		let binaryBuffer = null;
		let chunkOffset = 12;
		while (chunkOffset < arrayBuffer.byteLength) {
			const chunkLength = dataView.getUint32(chunkOffset, true);
			const chunkType = dataView.getUint32(chunkOffset + 4, true);
			const chunkStart = chunkOffset + 8;
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

		await this.parseContent(json, binaryBuffer);
	}

	//==============================================================================
	// glTF 내용 해석. (노드 / 스킨 / 메시 / 애니메이션 / 텍스처)
	//==============================================================================
	/**
	 * @param { object } json
	 * @param { ArrayBuffer } binaryBuffer
	 */
	async parseContent(json, binaryBuffer) {
		// 접근자 CPU 읽기. (촘촘한 배치 + 인터리브(byteStride) 배치 + 희소(sparse) 접근자 지원)
		function readAccessorArray(accessorIndex) {
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

			// 희소 접근자. (인덱스 목록의 요소만 값으로 덮어쓴다 — 모프 타깃 델타에 흔히 쓰인다)
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
			const inverseBindArray = readAccessorArray(skin.inverseBindMatrices);
			const inverseBindMatrices = [];
			for (let jointIndex = 0; jointIndex < skin.joints.length; ++jointIndex) {
				const matrix = Matrix4.createIdentity();
				const elements = matrix.getElements();
				elements.set(inverseBindArray.subarray(jointIndex * 16, jointIndex * 16 + 16));
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
			const image = json.images[texture.source];
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

		// 중립 메시 서술 구성. (메시 노드의 프리미티브 — 접근자를 CPU 배열로 펼침)
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
			const baseMorphWeights = node.weights ? node.weights : (mesh.weights ? mesh.weights : []);
			for (const primitive of mesh.primitives) {
				const positions = new System.Float32Array(readAccessorArray(primitive.attributes.POSITION));
				const vertexCount = positions.length / 3;
				const normals = primitive.attributes.NORMAL !== undefined ? new System.Float32Array(readAccessorArray(primitive.attributes.NORMAL)) : null;
				const textureCoordinates = primitive.attributes.TEXCOORD_0 !== undefined ? new System.Float32Array(readAccessorArray(primitive.attributes.TEXCOORD_0)) : null;
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
					joints = new System.Uint16Array(readAccessorArray(primitive.attributes.JOINTS_0));
					const weightAccessor = json.accessors[primitive.attributes.WEIGHTS_0];
					const weightSource = readAccessorArray(primitive.attributes.WEIGHTS_0);
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
					const indexSource = readAccessorArray(primitive.indices);
					indices = indexSource instanceof System.Uint8Array ? new System.Uint16Array(indexSource) : indexSource;
				}

				// 모프 타깃. (위치 델타 필수, 노멀 델타 선택 — 이름은 mesh.extras.targetNames)
				const morphTargets = [];
				const primitiveTargets = primitive.targets ? primitive.targets : [];
				for (let targetIndex = 0; targetIndex < primitiveTargets.length; ++targetIndex) {
					const target = primitiveTargets[targetIndex];
					if (target.POSITION === undefined) {
						continue;
					}
					const positionDeltas = new System.Float32Array(readAccessorArray(target.POSITION));
					const normalDeltas = target.NORMAL !== undefined ? new System.Float32Array(readAccessorArray(target.NORMAL)) : null;
					const targetName = targetNameList[targetIndex] !== undefined ? targetNameList[targetIndex] : `target${targetIndex}`;
					morphTargets.push({ name: targetName, positionDeltas: positionDeltas, normalDeltas: normalDeltas });
				}
				const morphWeights = new System.Float32Array(morphTargets.length);
				for (let weightIndex = 0; weightIndex < morphTargets.length; ++weightIndex) {
					morphWeights[weightIndex] = baseMorphWeights[weightIndex] !== undefined ? baseMorphWeights[weightIndex] : 0;
				}

				const materialName = primitive.material !== undefined && json.materials[primitive.material].name ? json.materials[primitive.material].name : "";
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

		await this.uploadMeshesAndMaterials(meshDescriptionList, materialDescriptionList);

		// 애니메이션 구성.
		this.#animationList = (json.animations || []).map((animation) => {
			let duration = 0;
			const channels = animation.channels.map((channel) => {
				const sampler = animation.samplers[channel.sampler];
				const times = readAccessorArray(sampler.input);
				const values = readAccessorArray(sampler.output);
				if (times.length > 0) {
					duration = System.Math.max(duration, times[times.length - 1]);
				}
				return {
					nodeIndex: channel.target.node,
					path: channel.target.path,
					times: times,
					values: values,
					cursor: 0,
				};
			});
			return { name: animation.name || "", duration: duration, channels: channels };
		});

		if (this.#animationList.length > 0) {
			this.#currentAnimation = this.#animationList[0];
		}
	}

	//==============================================================================
	// FBX 중간 표현 해석. (노드/스킨/메시/텍스처/애니메이션 → 기존 스키닝 파이프라인)
	//==============================================================================
	/**
	 * @param { object } sceneData
	 */
	async parseFbxContent(sceneData) {
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
				const boneNodeIndex = sceneData.nodeIdToIndex.get(cluster.boneNodeId);
				jointNodeIndices.push(boneNodeIndex);
				// 클러스터 Transform = TransformLink^-1 x 메시 바인드 전역행렬 — 그 자체가 역바인드 행렬.
				// 미보유 시 TransformLink 의 역행렬로 대체. (메시 전역 = 단위행렬 가정)
				let inverseBindMatrix = null;
				if (cluster.transform) {
					inverseBindMatrix = Matrix4.createIdentity();
					const bindElements = inverseBindMatrix.getElements();
					bindElements.set(cluster.transform);
				}
				else {
					const linkMatrix = Matrix4.createIdentity();
					const linkElements = linkMatrix.getElements();
					linkElements.set(cluster.transformLink);
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
				for (let influenceIndex = 0; influenceIndex < cluster.vertexIndices.length; ++influenceIndex) {
					const vertexIndex = cluster.vertexIndices[influenceIndex];
					const weight = cluster.weights[influenceIndex];
					influencesPerVertex[vertexIndex].push({ jointIndex: clusterLocalIndex, weight: weight });
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

		await this.uploadMeshesAndMaterials(meshDescriptionList, materialDescriptionList);

		// 애니메이션 구성. (회전 채널은 오일러 도 → 사전회전 합성 쿼터니언 4성분으로 변환)
		this.#animationList = sceneData.animationList.map((fbxAnimation) => {
			const channels = convertFbxAnimationChannels(sceneData, fbxAnimation, (nodeIndex) => nodeIndex);
			return { name: fbxAnimation.name, duration: fbxAnimation.duration, channels: channels };
		});

		if (this.#animationList.length > 0) {
			this.#currentAnimation = this.#animationList[0];
		}
	}

	//==============================================================================
	// 애니메이션 FBX 추가 로드. (본 이름 매칭 리타게팅 — Mixamo 애니메이션 전용 FBX)
	// - 동일 스켈레톤을 전제로, 채널을 현재 모델의 노드 인덱스로 재지정해 클립을 추가한다.
	// - ignoreTranslation: 루트 모션이 박힌 클립에서 이동 채널을 버린다. (게임 로직이 위치를 제어할 때)
	//==============================================================================
	/**
	 * @param { string } url
	 * @param { string } clipName
	 * @param { boolean } ignoreTranslation
	 */
	async addAnimationsFromFbxUrl(url, clipName, ignoreTranslation = false) {
		const sceneData = await FbxLoader.loadFromUrl(url);
		const nodeList = this.getNodeList();
		const nodeIndexByName = new System.Map();
		for (let nodeIndex = 0; nodeIndex < nodeList.length; ++nodeIndex) {
			nodeIndexByName.set(nodeList[nodeIndex].name, nodeIndex);
		}
		for (const fbxAnimation of sceneData.animationList) {
			if (fbxAnimation.channels.length === 0) {
				continue;
			}
			let channels = convertFbxAnimationChannels(sceneData, fbxAnimation, (nodeIndex) => {
				const sourceName = sceneData.nodeList[nodeIndex].name;
				return nodeIndexByName.get(sourceName);
			});
			if (ignoreTranslation) {
				channels = channels.filter((channel) => channel.path !== "translation");
			}
			this.#animationList.push({ name: clipName, duration: fbxAnimation.duration, channels: channels });
		}
	}

	//==============================================================================
	// 중립 메시/머티리얼 서술 업로드. (공용 — Material 생성 + VAO/드로어블 구성)
	//==============================================================================
	/**
	 * @param { object[] } meshDescriptionList
	 * @param { object[] } materialDescriptionList
	 */
	async uploadMeshesAndMaterials(meshDescriptionList, materialDescriptionList) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const shaderProgram = this.getShaderProgram();
		const materialList = [];
		for (const materialDescription of materialDescriptionList) {
			const material = await Material.createFromDescription(webGL2RenderingContext, shaderProgram, materialDescription);
			materialList.push(material);
		}
		const defaultDescription = Material.createDefaultDescription();
		const defaultMaterial = await Material.createFromDescription(webGL2RenderingContext, shaderProgram, defaultDescription);

		this.#drawableList = [];
		for (const meshDescription of meshDescriptionList) {
			let normals = meshDescription.normals;
			if (!normals) {
				normals = this.generateSmoothNormals(meshDescription.positions, meshDescription.indices);
			}
			const vertexArray = webGL2RenderingContext.createVertexArray();
			webGL2RenderingContext.bindVertexArray(vertexArray);
			this.bindFloatAttribute(shaderProgram, "vertexPosition", meshDescription.positions, 3);
			this.bindFloatAttribute(shaderProgram, "vertexNormal", normals, 3);
			if (meshDescription.textureCoordinates) {
				this.bindFloatAttribute(shaderProgram, "vertexTextureCoordinate", meshDescription.textureCoordinates, 2);
			}
			this.bindIntegerAttribute(shaderProgram, "vertexJoints", meshDescription.joints, 4);
			this.bindFloatAttribute(shaderProgram, "vertexWeights", meshDescription.weights, 4);

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
	//==============================================================================
	/**
	 * @param { object } drawable
	 */
	uploadWireframeIndices(drawable) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const triangleIndices = drawable.meshDescription.indices;
		const vertexCount = drawable.vertexCount;
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
	// 모프 타깃 업로드. (드로어블의 델타 목록 → RGBA32F 텍스처, 타깃마다 위치 블록 + 노멀 블록)
	// - 텍셀 인덱스 = 정점 인덱스. 블록 시작 행 = 타깃 인덱스 x 2 x 타깃당 행 수.
	//==============================================================================
	/**
	 * @param { object } drawable
	 */
	uploadMorphTargets(drawable) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const targetCount = drawable.morphTargetList.length;
		if (targetCount === 0) {
			if (drawable.morphTexture) {
				webGL2RenderingContext.deleteTexture(drawable.morphTexture);
				drawable.morphTexture = null;
			}
			drawable.isMorphDirty = false;
			return;
		}
		const vertexCount = drawable.vertexCount;
		const textureWidth = System.Math.min(vertexCount, MORPH_TEXTURE_WIDTH);
		const rowsPerTarget = System.Math.ceil(vertexCount / textureWidth);
		const textureHeight = rowsPerTarget * 2 * targetCount;
		const texelData = new System.Float32Array(textureWidth * textureHeight * 4);
		for (let targetIndex = 0; targetIndex < targetCount; ++targetIndex) {
			const morphTarget = drawable.morphTargetList[targetIndex];
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
	// 모프 타깃 추가. (프로그램 생성 — 정점별 위치 델타 [+ 노멀 델타], 다음 update() 에서 업로드)
	//==============================================================================
	/**
	 * @param { number } drawableIndex
	 * @param { string } targetName
	 * @param { Float32Array } positionDeltas
	 * @param { Float32Array | null } normalDeltas
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
	// 모프 가중치 설정. (이름 일치 타깃 전부 — 드로어블 여러 개가 같은 이름을 가질 수 있음)
	//==============================================================================
	/**
	 * @param { string } targetName
	 * @param { number } weight
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
	// 모프 가중치 반환. (첫 일치 타깃 — 없으면 0)
	//==============================================================================
	/**
	 * @param { string } targetName
	 * @returns { number }
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
	// 머티리얼 교체. (드로어블 단위 — 외부 텍스처로 만든 머티리얼 인스턴스 적용)
	//==============================================================================
	/**
	 * @param { number } drawableIndex
	 * @param { Material } material
	 */
	setMaterial(drawableIndex, material) {
		const drawable = this.#drawableList[drawableIndex];
		if (!drawable) {
			throw new Error(`SkinnedModel: drawable ${drawableIndex} not found.`);
		}
		drawable.material = material;
	}

	//==============================================================================
	// 스무스 노멀 생성. (노멀 미보유 메시 — 바인드 포즈 기준, 스키닝 회전은 셰이더에서 적용)
	//==============================================================================
	/**
	 * @param { Float32Array } positions
	 * @param { Uint16Array | Uint32Array | null } indices
	 * @returns { Float32Array }
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
	 * @param { ShaderProgram } shaderProgram
	 * @param { string } attributeName
	 * @param { Float32Array } dataArray
	 * @param { number } componentCount
	 */
	bindFloatAttribute(shaderProgram, attributeName, dataArray, componentCount) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const attributeLocation = shaderProgram.getAttributeLocation(attributeName);
		if (attributeLocation < 0) {
			return;
		}
		const glBuffer = webGL2RenderingContext.createBuffer();
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, glBuffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, dataArray, webGL2RenderingContext.STATIC_DRAW);
		webGL2RenderingContext.enableVertexAttribArray(attributeLocation);
		webGL2RenderingContext.vertexAttribPointer(attributeLocation, componentCount, webGL2RenderingContext.FLOAT, false, 0, 0);
	}

	//==============================================================================
	// 정수형 어트리뷰트 바인드. (조인트 인덱스)
	//==============================================================================
	/**
	 * @param { ShaderProgram } shaderProgram
	 * @param { string } attributeName
	 * @param { Uint16Array } dataArray
	 * @param { number } componentCount
	 */
	bindIntegerAttribute(shaderProgram, attributeName, dataArray, componentCount) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const attributeLocation = shaderProgram.getAttributeLocation(attributeName);
		if (attributeLocation < 0) {
			return;
		}
		const glBuffer = webGL2RenderingContext.createBuffer();
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, glBuffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, dataArray, webGL2RenderingContext.STATIC_DRAW);
		webGL2RenderingContext.enableVertexAttribArray(attributeLocation);
		webGL2RenderingContext.vertexAttribIPointer(attributeLocation, componentCount, webGL2RenderingContext.UNSIGNED_SHORT, 0, 0);
	}

	//==============================================================================
	// 애니메이션 재생. (크로스페이드)
	//==============================================================================
	/**
	 * @param { string } animationName
	 * @param { number } fadeDuration
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
	 * @param { object } animation
	 * @param { number } time
	 * @param { number } blendWeight
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
				// 모프 가중치. (키마다 타깃 개수만큼의 값 — 해당 노드의 드로어블 전부에 적용)
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
	 * @param { number } deltaTime
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

		// 5. 조인트 행렬. (월드 x 역바인드)
		for (const skin of this.getSkinList()) {
			for (let jointIndex = 0; jointIndex < skin.jointNodeIndices.length; ++jointIndex) {
				const jointNode = nodeList[skin.jointNodeIndices[jointIndex]];
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
	 * @param { string } jointNamePart
	 * @param { Quaternion } offsetRotation
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
	 * @returns { string[] }
	 */
	getAnimationNameList() {
		const nameList = this.#animationList.map((animation) => animation.name);
		return nameList;
	}

	//==============================================================================
	// 재생 속도 설정.
	//==============================================================================
	/**
	 * @param { number } timeScale
	 */
	setTimeScale(timeScale) {
		this.#timeScale = timeScale;
	}

	//==============================================================================
	// 렌더링 컨텍스트 반환.
	//==============================================================================
	/**
	 * @returns { WebGL2RenderingContext }
	 */
	getWebGL2RenderingContext() {
		return this.#webGL2RenderingContext;
	}

	//==============================================================================
	// 셰이더 프로그램 반환.
	//==============================================================================
	/**
	 * @returns { ShaderProgram }
	 */
	getShaderProgram() {
		return this.#shaderProgram;
	}

	//==============================================================================
	// 노드 목록 반환.
	//==============================================================================
	/**
	 * @returns { object[] }
	 */
	getNodeList() {
		return this.#nodeList;
	}

	//==============================================================================
	// 루트 노드 인덱스 목록 반환.
	//==============================================================================
	/**
	 * @returns { number[] }
	 */
	getRootNodeIndices() {
		return this.#rootNodeIndices;
	}

	//==============================================================================
	// 스킨 목록 반환.
	//==============================================================================
	/**
	 * @returns { object[] }
	 */
	getSkinList() {
		return this.#skinList;
	}

	//==============================================================================
	// 드로어블 목록 반환.
	//==============================================================================
	/**
	 * @returns { object[] }
	 */
	getDrawableList() {
		return this.#drawableList;
	}
}
