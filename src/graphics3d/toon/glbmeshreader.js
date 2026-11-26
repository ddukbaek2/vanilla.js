//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Matrix4 } from "../../base/matrix4.js";
import { MeshBuilder } from "./meshbuilder.js";


/**
 * @example <caption>GLB 모형을 읽어 움직임 자세로 그리기</caption>
 * import { ToonRenderer, ToonGlb, Camera3D, Matrix4, Vector3 } from "./vanilla.js";
 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
 * const renderer = new ToonRenderer(webGL2RenderingContext);
 * const arrayBuffer = await (await fetch("examples/ancientmountain/assets/fox.glb")).arrayBuffer();
 * const arrays = ToonGlb.readGlbArrays(arrayBuffer, { width: 1.5, addedParts: ["fox"] });
 * const mesh = renderer.createMesh(arrays);
 * const skeleton = arrays.skeleton;
 * const jointMatrices = skeleton !== null ? new Float32Array(skeleton.joints.length * 16) : null;
 * if (skeleton !== null) {
 * 	ToonGlb.writeSkinPose(skeleton, "Survey", 0.5, jointMatrices);
 * }
 * const camera = new Camera3D();
 * camera.setPerspective(0.8, 0.1, 100);
 * camera.lookAt(Vector3.create(0, 1, 3), Vector3.create(0, 0.4, 0), Vector3.create(0, 1, 0));
 * renderer.beginFrameWithCamera(camera);
 * renderer.drawMesh(mesh, Matrix4.createScale(0.01, 0.01, 0.01), { jointMatrices: jointMatrices });
 * renderer.endFrame();
 */


//==============================================================================
// 점토 모형(GLB) 읽기와 뼈대 자세. (툰 3D 의 MeshBuilder 꼭짓점 배열로, 외계행성 광부 키우기에서 왔다)
//
// 재질 색으로 칠하는 모형을 읽는다. 텍스처 좌표와 재질 텍스처가 있으면 그것도 읽는다.
//   - 부품 하나가 노드 하나이고, 노드의 메시는 색마다 프리미티브 하나이다. 꼭짓점은 위치와 노멀, 뼈대가 있으면 본 번호와 무게이다.
//   - 재질의 baseColorFactor 는 선형 색이라 sRGB 로 바꿔 담고, emissiveFactor 가 있으면 빛남으로 담는다. (emissiveTexture 가 있으면 빛남은 재질 범위로만 넘긴다)
//   - TEXCOORD_0 이 있으면 uvData 로, TEXCOORD_1 이 있으면 uv1Data(2 번 UV, 천사 고리)로 담는다. 프리미티브마다 재질 범위(materialRanges)를 담는다.
//     { name 재질 이름, materialIndex, nodeName, indexStart, indexCount, extras 재질 extras, alphaMode, alphaCutoff, baseColorFactor 선형, emissiveFactor 선형, baseColorImage, emissiveImage (images 차례, 없으면 -1), hasUv }
//     부품 안에서 칸을 갈라 칠할 때(강조색 칸, 표시판) 재질 이름이나 extras 로 고르고 ToonRenderer.drawMesh 의 indexStart, indexCount 로 그 칸만 그린다.
//   - 그림은 readGlbImages 로 읽고 decodeGlbImage 로 풀어 ToonRenderer.createTexture 에 넘긴다.
//   - 재질 extras 의 outline 은 바깥선 껍데기(뒷면만 그림), basic 은 빛을 받지 않는 부품이다.
//     outlineOptions 를 주면 그 껍데기는 담지 않고, ".outline" 짝이 있는 노드의 몸으로 점마다 같은 굵기의 껍데기를 새로 짓는다. (MeshBuilder.addTriangleShell)
//   - 뼈대(skin)가 있으면 본 노드와 그 거꾸로 묶는 행렬, 움직임(animations)과 그 extras(치기의 hitAt, 한 번만 트는 loop "once" 등)를 함께 읽는다. 자세는 writeSkinPose 가 셈한다.
//   - 부품을 따로 숨기거나 칠하는 모형(무더기의 결정 여럿처럼)은 readGlbNodeArrays 로 노드마다 따로 읽는다.
//     노드 extras(문과 다리가 도는 자리 pivot 등)는 그 부품의 extras 로 함께 담는다.
//   - 한 덩이로 읽은 뼈대 모형(탈것 같은)의 노드 extras 와 부품의 자리, 따르는 본은 readGlbNodeInfos 로 따로 읽는다.
// 엔진의 GLB 읽기는 엔진의 PBR 모형(SkinnedModel) 안에 묶여 있어, 툰 그리기에 쓸 꼭짓점 배열만 여기서 뽑는다.
//==============================================================================

// GLB 의 머리와 덩어리 종류.
const GLB_MAGIC = 0x46546c67;
const CHUNK_TYPE_JSON = 0x4e4f534a;
const CHUNK_TYPE_BINARY = 0x004e4942;
// 접근자의 수 종류와 개수.
const COMPONENT_ARRAYS = System.Object.freeze({
	5120: System.Int8Array,
	5121: System.Uint8Array,
	5122: System.Int16Array,
	5123: System.Uint16Array,
	5125: System.Uint32Array,
	5126: System.Float32Array,
});
// 정수로 담긴 무게를 0 ~ 1 로 바꿀 때 나눌 수. (normalized 접근자)
const NORMALIZED_DIVISORS = System.Object.freeze({
	5121: 255,
	5123: 65535,
});
const TYPE_COMPONENT_COUNTS = System.Object.freeze({
	SCALAR: 1,
	VEC2: 2,
	VEC3: 3,
	VEC4: 4,
	MAT4: 16,
});
// 삼각형 프리미티브. (glTF 의 mode 4, 없으면 4)
const TRIANGLES_MODE = 4;
// 바깥선 껍데기 노드의 이름 끝. (readGlbNodeArrays 가 앞 이름의 노드에 함께 담음)
const OUTLINE_NODE_SUFFIX = ".outline";
// 한 번만 트는 움직임의 extras.loop. (끝 시각에 묶어 끝 자세를 둠)
const LOOP_ONCE = "once";


//==============================================================================
// 접근자 하나 읽기. (촘촘한 것과 byteStride 로 띄운 것)
//==============================================================================
/**
 * @param { object } json - glTF 의 JSON 덩어리.
 * @param { ArrayBuffer } binaryBuffer - GLB 의 바이너리 덩어리.
 * @param { number } accessorIndex - 접근자 차례.
 * @returns { ArrayLike<number> } 접근자의 수. (촘촘히 이은 형식 배열)
 */
function readAccessor(json, binaryBuffer, accessorIndex) {
	const accessor = json.accessors[accessorIndex];
	const componentCount = TYPE_COMPONENT_COUNTS[accessor.type];
	const ArrayConstructor = COMPONENT_ARRAYS[accessor.componentType];
	const bufferView = json.bufferViews[accessor.bufferView];
	const elementOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
	const tightByteSize = componentCount * ArrayConstructor.BYTES_PER_ELEMENT;
	const byteStride = bufferView.byteStride || 0;
	if (byteStride === 0 || byteStride === tightByteSize) {
		return new ArrayConstructor(binaryBuffer.slice(elementOffset, elementOffset + accessor.count * tightByteSize));
	}
	const result = new ArrayConstructor(accessor.count * componentCount);
	for (let elementIndex = 0; elementIndex < accessor.count; ++elementIndex) {
		const source = new ArrayConstructor(binaryBuffer.slice(elementOffset + elementIndex * byteStride, elementOffset + elementIndex * byteStride + tightByteSize));
		result.set(source, elementIndex * componentCount);
	}
	return result;
}

//==============================================================================
// 무게 접근자 읽기. (정수로 담겼으면 0 ~ 1 로)
//==============================================================================
/**
 * @param { object } json - glTF 의 JSON 덩어리.
 * @param { ArrayBuffer } binaryBuffer - GLB 의 바이너리 덩어리.
 * @param { number } accessorIndex - 접근자 차례.
 * @returns { ArrayLike<number> } 무게. (정수로 담겼으면 0 ~ 1 로 나눈 Float32Array)
 */
function readWeightAccessor(json, binaryBuffer, accessorIndex) {
	const values = readAccessor(json, binaryBuffer, accessorIndex);
	const divisor = NORMALIZED_DIVISORS[json.accessors[accessorIndex].componentType];
	if (divisor === undefined) {
		return values;
	}
	return System.Float32Array.from(values, (value) => {
		return value / divisor;
	});
}

//==============================================================================
// 자리, 돌림(사원수), 크기로 행렬 짓기.
//==============================================================================
/**
 * @param { ArrayLike<number> } translation - [x, y, z] 자리.
 * @param { ArrayLike<number> } rotation - [x, y, z, w] 사원수.
 * @param { ArrayLike<number> } scale - [x, y, z] 크기.
 * @returns { Matrix4 } 자리 x 돌림 x 크기 행렬.
 */
function createTransformMatrix(translation, rotation, scale) {
	const matrix = Matrix4.createTranslation(translation[0], translation[1], translation[2]);
	const rotationMatrix = Matrix4.createRotationFromQuaternion({ x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3] });
	matrix.multiply(rotationMatrix);
	matrix.scale(scale[0], scale[1], scale[2]);
	return matrix;
}

//==============================================================================
// 노드의 자기 행렬. (matrix 가 있으면 그것, 아니면 자리, 돌림, 크기)
//==============================================================================
/**
 * @param { object } node - glTF 노드.
 * @returns { Matrix4 } 노드의 자기 행렬. (부모 행렬은 곱하지 않음)
 */
function readNodeMatrix(node) {
	if (System.Array.isArray(node.matrix)) {
		const matrix = Matrix4.createIdentity();
		const elements = matrix.getElements();
		elements.set(node.matrix);
		return matrix;
	}
	const translation = node.translation !== undefined ? node.translation : [0, 0, 0];
	const rotation = node.rotation !== undefined ? node.rotation : [0, 0, 0, 1];
	const scale = node.scale !== undefined ? node.scale : [1, 1, 1];
	return createTransformMatrix(translation, rotation, scale);
}

//==============================================================================
// 프리미티브 하나 담기. (바깥선 껍데기는 바깥선 배열에, 나머지는 색과 빛남과 함께)
//   - 뼈대로 움직이는 프리미티브는 노드 행렬을 쓰지 않는다. (glTF 의 약속, 자리는 본이 정함)
//==============================================================================
/**
 * @param { MeshBuilder } builder - 담을 MeshBuilder.
 * @param { object } json - glTF 의 JSON 덩어리.
 * @param { ArrayBuffer } binaryBuffer - GLB 의 바이너리 덩어리.
 * @param { object } node - 프리미티브가 든 노드.
 * @param { object } primitive - glTF 프리미티브.
 * @param { Matrix4 } matrix - 부모까지 곱한 노드 행렬. (뼈대 프리미티브는 쓰지 않음)
 * @param { boolean } [isOutlineRebuilt] 바깥선 껍데기를 몸으로 새로 지으면 GLB 의 껍데기는 담지 않는다.
 */
function addPrimitive(builder, json, binaryBuffer, node, primitive, matrix, isOutlineRebuilt = false) {
	const mode = primitive.mode !== undefined ? primitive.mode : TRIANGLES_MODE;
	const attributes = primitive.attributes;
	if (mode !== TRIANGLES_MODE || attributes.POSITION === undefined) {
		return;
	}
	const positions = readAccessor(json, binaryBuffer, attributes.POSITION);
	let indices = null;
	if (primitive.indices !== undefined) {
		indices = readAccessor(json, binaryBuffer, primitive.indices);
	}
	else {
		indices = System.Array.from({ length: positions.length / 3 }, (value, index) => {
			return index;
		});
	}
	const isSkinned = node.skin !== undefined && attributes.JOINTS_0 !== undefined && attributes.WEIGHTS_0 !== undefined;
	const partMatrix = isSkinned ? Matrix4.createIdentity() : matrix;
	const joints = isSkinned ? readAccessor(json, binaryBuffer, attributes.JOINTS_0) : null;
	const weights = isSkinned ? readWeightAccessor(json, binaryBuffer, attributes.WEIGHTS_0) : null;
	const material = primitive.material !== undefined && json.materials !== undefined ? json.materials[primitive.material] : {};
	const extras = material.extras !== undefined ? material.extras : {};
	if (extras.outline === true) {
		if (isOutlineRebuilt) {
			return;
		}
		builder.addOutlineTriangles(positions, indices, partMatrix, joints, weights);
		return;
	}
	if (attributes.NORMAL === undefined) {
		return;
	}
	const normals = readAccessor(json, binaryBuffer, attributes.NORMAL);
	const uvs = attributes.TEXCOORD_0 !== undefined ? readWeightAccessor(json, binaryBuffer, attributes.TEXCOORD_0) : null;
	const uvs1 = attributes.TEXCOORD_1 !== undefined ? readWeightAccessor(json, binaryBuffer, attributes.TEXCOORD_1) : null;
	const pbrMetallicRoughness = material.pbrMetallicRoughness !== undefined ? material.pbrMetallicRoughness : {};
	const baseColor = pbrMetallicRoughness.baseColorFactor !== undefined ? pbrMetallicRoughness.baseColorFactor : [1, 1, 1, 1];
	const color = [0, 1, 2].map((channelIndex) => {
		return System.Math.pow(System.Math.max(0, baseColor[channelIndex]), 1 / 2.2);
	});
	// 빛남은 바탕색에 곱하는 세기로 담는다. (셰이더는 바탕색 x 세기를 더함)
	let glow = 0;
	const emissiveImage = readTextureImage(json, material.emissiveTexture);
	if (System.Array.isArray(material.emissiveFactor) && emissiveImage < 0) {
		const emissiveMaximum = System.Math.max(material.emissiveFactor[0], material.emissiveFactor[1], material.emissiveFactor[2]);
		const baseMaximum = System.Math.max(baseColor[0], baseColor[1], baseColor[2], 0.001);
		glow = emissiveMaximum / baseMaximum;
	}
	const indexStart = builder.getIndexCount();
	builder.addTriangles(positions, normals, indices, partMatrix, color, glow, extras.basic === true, joints, weights, uvs, uvs1);
	const emissiveFactor = System.Array.isArray(material.emissiveFactor) ? material.emissiveFactor.slice(0, 3) : [0, 0, 0];
	builder.addMaterialRange({
		name: typeof material.name === "string" ? material.name : "",
		materialIndex: primitive.material !== undefined ? primitive.material : -1,
		nodeName: typeof node.name === "string" ? node.name : "",
		indexStart: indexStart,
		indexCount: builder.getIndexCount() - indexStart,
		extras: extras,
		alphaMode: typeof material.alphaMode === "string" ? material.alphaMode : "OPAQUE",
		alphaCutoff: typeof material.alphaCutoff === "number" ? material.alphaCutoff : 0.5,
		baseColorFactor: baseColor.slice(0, 4),
		emissiveFactor: emissiveFactor,
		baseColorImage: readTextureImage(json, pbrMetallicRoughness.baseColorTexture),
		emissiveImage: emissiveImage,
		hasUv: uvs !== null,
	});
}

//==============================================================================
// 재질의 텍스처 정보가 가리키는 그림 차례. (textures[index].source, 없으면 -1)
//==============================================================================
/**
 * @param { object } json - glTF 의 JSON 덩어리.
 * @param { object | undefined } textureInfo { index, texCoord }
 * @returns { number } images 의 차례. (없으면 -1)
 */
function readTextureImage(json, textureInfo) {
	if (textureInfo === undefined || textureInfo === null || typeof textureInfo.index !== "number" || json.textures === undefined) {
		return -1;
	}
	const texture = json.textures[textureInfo.index];
	if (texture === undefined || typeof texture.source !== "number") {
		return -1;
	}
	return texture.source;
}

//==============================================================================
// 몸으로 새로 지을 바깥선 껍데기의 굵기. (그 노드에 이름 끝이 ".outline" 인 짝이 없고 addedParts 에도 없으면 null, 부품마다 따로 준 굵기가 있으면 그것, 굵기가 0 이하면 짓지 않아 null)
//==============================================================================
/**
 * @param { object } node - glTF 노드.
 * @param { Set<string> } nodeNames - GLB 의 모든 노드 이름.
 * @param { object } outlineOptions { width, partWidths, addedParts }
 * @returns { number | null } 껍데기 굵기. (짓지 않으면 null)
 */
function readRebuiltOutlineWidth(node, nodeNames, outlineOptions) {
	const nodeName = typeof node.name === "string" ? node.name : "";
	const addedParts = outlineOptions.addedParts !== undefined ? outlineOptions.addedParts : [];
	if (!nodeNames.has(nodeName + OUTLINE_NODE_SUFFIX) && !addedParts.includes(nodeName)) {
		return null;
	}
	const partWidths = outlineOptions.partWidths !== undefined ? outlineOptions.partWidths : {};
	const partWidth = partWidths[nodeName];
	const width = partWidth !== undefined ? partWidth : outlineOptions.width;
	return width > 0 ? width : null;
}

//==============================================================================
// 노드의 몸으로 바깥선 껍데기 짓기. (색마다 나뉜 프리미티브를 이어 붙여 한 번에 넘김, 바깥선 재질과 노멀이 없는 것은 뺌)
//==============================================================================
/**
 * @param { MeshBuilder } builder - 담을 MeshBuilder.
 * @param { object } json - glTF 의 JSON 덩어리.
 * @param { ArrayBuffer } binaryBuffer - GLB 의 바이너리 덩어리.
 * @param { object } node - 껍데기를 지을 메시 노드.
 * @param { Matrix4 } matrix - 부모까지 곱한 노드 행렬. (뼈대 노드는 쓰지 않음)
 * @param { number } outlineWidth - 껍데기 굵기. (모형 좌표)
 */
function addRebuiltOutline(builder, json, binaryBuffer, node, matrix, outlineWidth) {
	const positions = [];
	const normals = [];
	const indices = [];
	const isSkinned = node.skin !== undefined;
	const joints = isSkinned ? [] : null;
	const weights = isSkinned ? [] : null;
	for (const primitive of json.meshes[node.mesh].primitives) {
		const mode = primitive.mode !== undefined ? primitive.mode : TRIANGLES_MODE;
		const attributes = primitive.attributes;
		if (mode !== TRIANGLES_MODE || attributes.POSITION === undefined || attributes.NORMAL === undefined) {
			continue;
		}
		const material = primitive.material !== undefined && json.materials !== undefined ? json.materials[primitive.material] : {};
		const extras = material.extras !== undefined ? material.extras : {};
		const hasSkin = attributes.JOINTS_0 !== undefined && attributes.WEIGHTS_0 !== undefined;
		if (extras.outline === true || hasSkin !== isSkinned) {
			continue;
		}
		const startIndex = positions.length / 3;
		const primitivePositions = readAccessor(json, binaryBuffer, attributes.POSITION);
		const primitiveNormals = readAccessor(json, binaryBuffer, attributes.NORMAL);
		for (let valueIndex = 0; valueIndex < primitivePositions.length; ++valueIndex) {
			positions.push(primitivePositions[valueIndex]);
			normals.push(primitiveNormals[valueIndex]);
		}
		if (primitive.indices !== undefined) {
			const primitiveIndices = readAccessor(json, binaryBuffer, primitive.indices);
			for (const index of primitiveIndices) {
				indices.push(startIndex + index);
			}
		}
		else {
			for (let pointIndex = 0; pointIndex < primitivePositions.length / 3; ++pointIndex) {
				indices.push(startIndex + pointIndex);
			}
		}
		if (isSkinned) {
			const primitiveJoints = readAccessor(json, binaryBuffer, attributes.JOINTS_0);
			const primitiveWeights = readWeightAccessor(json, binaryBuffer, attributes.WEIGHTS_0);
			for (let valueIndex = 0; valueIndex < primitiveJoints.length; ++valueIndex) {
				joints.push(primitiveJoints[valueIndex]);
				weights.push(primitiveWeights[valueIndex]);
			}
		}
	}
	if (indices.length === 0) {
		return;
	}
	const partMatrix = isSkinned ? Matrix4.createIdentity() : matrix;
	builder.addTriangleShell(positions, normals, indices, partMatrix, outlineWidth, joints, weights);
}

//==============================================================================
// 노드 이름 모음. (이름이 없는 노드는 빈 글자)
//==============================================================================
/**
 * @param { object } json - glTF 의 JSON 덩어리.
 * @returns { Set<string> } 노드 이름 모음.
 */
function readNodeNames(json) {
	const nodeNames = json.nodes.map((node) => {
		return typeof node.name === "string" ? node.name : "";
	});
	return new System.Set(nodeNames);
}

//==============================================================================
// 뼈대와 움직임 읽기. (없으면 null, 첫 skin 만)
//   - { joints: 본 노드 번호, inverseBindMatrices: 본마다 16, nodes: [{ name, parentIndex, translation, rotation, scale, matrix }], animations: { 이름: { duration, channels, extras } } }
//==============================================================================
/**
 * @param { object } json - glTF 의 JSON 덩어리.
 * @param { ArrayBuffer } binaryBuffer - GLB 의 바이너리 덩어리.
 * @returns { object | null } { joints, inverseBindMatrices, nodes, animations } 뼈대와 움직임. (skin 이 없으면 null)
 */
function readSkeleton(json, binaryBuffer) {
	if (!System.Array.isArray(json.skins) || json.skins.length === 0) {
		return null;
	}
	const skin = json.skins[0];
	const parentIndices = json.nodes.map(() => {
		return -1;
	});
	json.nodes.forEach((node, nodeIndex) => {
		if (System.Array.isArray(node.children)) {
			for (const childIndex of node.children) {
				parentIndices[childIndex] = nodeIndex;
			}
		}
	});
	const nodes = json.nodes.map((node, nodeIndex) => {
		return {
			name: typeof node.name === "string" ? node.name : "",
			parentIndex: parentIndices[nodeIndex],
			translation: node.translation !== undefined ? node.translation : [0, 0, 0],
			rotation: node.rotation !== undefined ? node.rotation : [0, 0, 0, 1],
			scale: node.scale !== undefined ? node.scale : [1, 1, 1],
			matrix: System.Array.isArray(node.matrix) ? node.matrix : null,
		};
	});
	let inverseBindMatrices = null;
	if (skin.inverseBindMatrices !== undefined) {
		inverseBindMatrices = System.Float32Array.from(readAccessor(json, binaryBuffer, skin.inverseBindMatrices));
	}
	else {
		inverseBindMatrices = new System.Float32Array(skin.joints.length * 16);
		for (let jointIndex = 0; jointIndex < skin.joints.length; ++jointIndex) {
			const identityElements = Matrix4.createIdentity().getElements();
			inverseBindMatrices.set(identityElements, jointIndex * 16);
		}
	}
	const animations = {};
	const sourceAnimations = System.Array.isArray(json.animations) ? json.animations : [];
	for (const animation of sourceAnimations) {
		const channels = [];
		let duration = 0;
		for (const channel of animation.channels) {
			const sampler = animation.samplers[channel.sampler];
			const times = readAccessor(json, binaryBuffer, sampler.input);
			const values = readAccessor(json, binaryBuffer, sampler.output);
			duration = System.Math.max(duration, times[times.length - 1]);
			channels.push({ nodeIndex: channel.target.node, path: channel.target.path, times: times, values: values, isStep: sampler.interpolation === "STEP" });
		}
		const extras = animation.extras !== undefined && animation.extras !== null ? animation.extras : {};
		animations[animation.name] = { duration: duration, channels: channels, extras: extras };
	}
	return { joints: skin.joints, inverseBindMatrices: inverseBindMatrices, nodes: nodes, animations: animations };
}

//==============================================================================
// GLB 의 덩어리 읽기. ({ json, binaryBuffer })
//==============================================================================
/**
 * @param { ArrayBuffer } arrayBuffer - GLB 파일 전체.
 * @returns { object } { json, binaryBuffer } 풀어 읽은 JSON 과 바이너리 덩어리.
 */
function readGlbChunks(arrayBuffer) {
	const dataView = new System.DataView(arrayBuffer);
	if (dataView.getUint32(0, true) !== GLB_MAGIC) {
		throw new System.Error("GLB 가 아닙니다.");
	}
	let json = null;
	let binaryBuffer = null;
	let chunkOffset = 12;
	while (chunkOffset < arrayBuffer.byteLength) {
		const chunkLength = dataView.getUint32(chunkOffset, true);
		const chunkType = dataView.getUint32(chunkOffset + 4, true);
		const chunkStart = chunkOffset + 8;
		if (chunkType === CHUNK_TYPE_JSON) {
			const jsonBytes = new System.Uint8Array(arrayBuffer, chunkStart, chunkLength);
			const jsonText = new System.TextDecoder().decode(jsonBytes);
			json = System.JSON.parse(jsonText);
		}
		else if (chunkType === CHUNK_TYPE_BINARY) {
			binaryBuffer = arrayBuffer.slice(chunkStart, chunkStart + chunkLength);
		}
		chunkOffset = chunkStart + chunkLength;
	}
	if (json === null || binaryBuffer === null) {
		throw new System.Error("GLB 의 덩어리가 모자랍니다.");
	}
	return { json: json, binaryBuffer: binaryBuffer };
}

//==============================================================================
// 장면의 메시 노드를 차례로 돌기. (노드마다 부모까지 곱한 행렬과 함께 visitEvent(node, matrix) 를 부름)
//==============================================================================
/**
 * @param { object } json - glTF 의 JSON 덩어리.
 * @param { Function } visitEvent - (node, matrix) => void. 메시가 있는 노드마다 부른다.
 */
function visitMeshNodes(json, visitEvent) {
	const sceneIndex = json.scene !== undefined ? json.scene : 0;
	const rootNodes = json.scenes !== undefined && json.scenes[sceneIndex] !== undefined ? json.scenes[sceneIndex].nodes : json.nodes.map((node, nodeIndex) => {
		return nodeIndex;
	});
	const visit = (nodeIndex, parentMatrix) => {
		const node = json.nodes[nodeIndex];
		const matrix = parentMatrix.clone();
		const nodeMatrix = readNodeMatrix(node);
		matrix.multiply(nodeMatrix);
		if (node.mesh !== undefined) {
			visitEvent(node, matrix);
		}
		if (System.Array.isArray(node.children)) {
			for (const childIndex of node.children) {
				visit(childIndex, matrix);
			}
		}
	};
	for (const nodeIndex of rootNodes) {
		visit(nodeIndex, Matrix4.createIdentity());
	}
}

//==============================================================================
// GLB 하나를 꼭짓점 배열로. (MeshBuilder.readArrays 의 꼴, 뼈대가 있으면 skeleton 도)
//==============================================================================
/**
 * @param { ArrayBuffer } arrayBuffer - GLB 파일 전체.
 * @param { object | null } [outlineOptions] { width, partWidths, addedParts, innerParts, innerOverParts, innerWidth } 주면 GLB 의 바깥선 껍데기 대신 ".outline" 짝이 있는 노드의 몸으로 껍데기를 새로 짓는다. (모형 좌표의 굵기, partWidths 는 노드 이름마다, addedParts 는 짝이 없어도 껍데기를 지을 노드 이름)
 *   width 가 0 이면 껍데기를 하나도 짓지 않는다. (GLB 의 껍데기도 담지 않음)
 *   innerParts(노드 이름들)는 innerWidth 가 0 보다 크면 그 굵기의 껍데기를 하나 더 지어 바깥선 껍데기 끝에 담고, 그 자리를 innerOutlineRanges({ start, count } 들)로 돌려준다. (몸을 그린 뒤 그 부위를 둘레의 가는 선과 함께 한 번 더 그림)
 *   innerParts 와 그 위에 얹힌 innerOverParts(노드 이름들, 유리 위의 빛 반사 등)의 몸이 든 자리는 GLB 의 노드 차례대로 innerBodyRanges 로 돌려준다. (innerParts 가 없으면 빔)
 * @returns { object } MeshBuilder.readArrays 의 꼴과 skeleton (없으면 null), innerOutlineRanges, innerBodyRanges. (ToonRenderer.createMesh 에 넘긴다)
 * @example <caption>재질 범위마다 따로 칠하기</caption>
 * import { ToonRenderer, ToonGlb, Camera3D, Matrix4, Vector3 } from "./vanilla.js";
 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
 * const renderer = new ToonRenderer(webGL2RenderingContext);
 * const arrayBuffer = await (await fetch("examples/ancientmountain/assets/soldier.glb")).arrayBuffer();
 * const arrays = ToonGlb.readGlbArrays(arrayBuffer, { width: 1.5, partWidths: { vanguard_visor: 0.8 }, addedParts: ["vanguard_Mesh", "vanguard_visor"] });
 * const mesh = renderer.createMesh(arrays);
 * const modelMatrix = Matrix4.createScale(0.01, 0.01, 0.01);
 * const camera = new Camera3D();
 * camera.setPerspective(0.8, 0.1, 100);
 * camera.lookAt(Vector3.create(0, 1.5, 4), Vector3.create(0, 1, 0), Vector3.create(0, 1, 0));
 * renderer.beginFrameWithCamera(camera);
 * for (const materialRange of arrays.materialRanges) {
 * 	const tintColor = materialRange.name === "Vanguard_VisorMat" ? [1, 0.4, 0.3, 1] : [1, 1, 1, 1];
 * 	renderer.drawMesh(mesh, modelMatrix, { indexStart: materialRange.indexStart, indexCount: materialRange.indexCount, tintColor: tintColor, hasOutline: false });
 * }
 * renderer.drawMeshOutline(mesh, modelMatrix);
 * renderer.endFrame();
 */
export function readGlbArrays(arrayBuffer, outlineOptions = null) {
	const chunks = readGlbChunks(arrayBuffer);
	const json = chunks.json;
	const binaryBuffer = chunks.binaryBuffer;
	const builder = new MeshBuilder();
	const isOutlineRebuilt = outlineOptions !== null;
	const nodeNames = readNodeNames(json);
	const innerParts = isOutlineRebuilt && outlineOptions.innerParts !== undefined ? outlineOptions.innerParts : [];
	const innerOverParts = isOutlineRebuilt && outlineOptions.innerOverParts !== undefined ? outlineOptions.innerOverParts : [];
	const innerNodes = [];
	const innerBodyRanges = [];
	visitMeshNodes(json, (node, matrix) => {
		const bodyStart = builder.getIndexCount();
		for (const primitive of json.meshes[node.mesh].primitives) {
			addPrimitive(builder, json, binaryBuffer, node, primitive, matrix, isOutlineRebuilt);
		}
		if (!isOutlineRebuilt) {
			return;
		}
		const outlineWidth = readRebuiltOutlineWidth(node, nodeNames, outlineOptions);
		if (outlineWidth !== null) {
			addRebuiltOutline(builder, json, binaryBuffer, node, matrix, outlineWidth);
		}
		const nodeName = typeof node.name === "string" ? node.name : "";
		if (innerParts.includes(nodeName)) {
			innerNodes.push({ node: node, matrix: matrix });
		}
		const bodyCount = builder.getIndexCount() - bodyStart;
		const isInnerBody = innerParts.includes(nodeName) || innerOverParts.includes(nodeName);
		if (isInnerBody && bodyCount > 0) {
			innerBodyRanges.push({ start: bodyStart, count: bodyCount });
		}
	});
	const innerOutlineRanges = [];
	const innerWidth = isOutlineRebuilt && outlineOptions.innerWidth !== undefined ? outlineOptions.innerWidth : 0;
	for (const innerNode of innerNodes) {
		if (innerWidth <= 0) {
			break;
		}
		const innerStart = builder.getOutlineIndexCount();
		addRebuiltOutline(builder, json, binaryBuffer, innerNode.node, innerNode.matrix, innerWidth);
		const innerCount = builder.getOutlineIndexCount() - innerStart;
		if (innerCount > 0) {
			innerOutlineRanges.push({ start: innerStart, count: innerCount });
		}
	}
	const arrays = builder.readArrays();
	arrays.skeleton = readSkeleton(json, binaryBuffer);
	arrays.innerOutlineRanges = innerOutlineRanges;
	arrays.innerBodyRanges = innerNodes.length > 0 ? innerBodyRanges : [];
	return arrays;
}

//==============================================================================
// GLB 에 든 그림들. ([{ name, mimeType, data: Uint8Array }], images 의 차례, 재질 범위의 baseColorImage, emissiveImage 가 가리킴)
//   - 바이너리 덩어리의 bufferView 로 담긴 그림만 읽는다. (바깥 파일 uri 는 data 가 빈 배열)
//   - 텍스처로 쓰려면 decodeGlbImage 로 풀어 ToonRenderer.createTexture 에 넘긴다.
//==============================================================================
/**
 * @param { ArrayBuffer } arrayBuffer - GLB 파일 전체.
 * @returns { Array<object> } [{ name, mimeType, data: Uint8Array }] images 차례의 그림.
 * @example <caption>재질의 바탕 그림을 텍스처로 올려 그리기</caption>
 * import { ToonRenderer, ToonGlb, Matrix4 } from "./vanilla.js";
 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
 * const renderer = new ToonRenderer(webGL2RenderingContext);
 * const arrayBuffer = await (await fetch("examples/ancientmountain/assets/soldier.glb")).arrayBuffer();
 * const arrays = ToonGlb.readGlbArrays(arrayBuffer);
 * const mesh = renderer.createMesh(arrays);
 * const images = ToonGlb.readGlbImages(arrayBuffer);
 * const textures = await Promise.all(images.map(async (image) => image.data.length > 0 ? renderer.createTexture(await ToonGlb.decodeGlbImage(image)) : null));
 * const texturedRange = arrays.materialRanges.find((materialRange) => materialRange.hasUv && materialRange.baseColorImage >= 0);
 * if (texturedRange !== undefined) {
 * 	renderer.drawMesh(mesh, Matrix4.createIdentity(), { indexStart: texturedRange.indexStart, indexCount: texturedRange.indexCount, baseColorTexture: textures[texturedRange.baseColorImage] });
 * }
 */
export function readGlbImages(arrayBuffer) {
	const chunks = readGlbChunks(arrayBuffer);
	const json = chunks.json;
	const images = System.Array.isArray(json.images) ? json.images : [];
	return images.map((image) => {
		const name = typeof image.name === "string" ? image.name : "";
		const mimeType = typeof image.mimeType === "string" ? image.mimeType : "";
		if (typeof image.bufferView !== "number") {
			return { name: name, mimeType: mimeType, data: new System.Uint8Array(0) };
		}
		const bufferView = json.bufferViews[image.bufferView];
		const byteOffset = bufferView.byteOffset !== undefined ? bufferView.byteOffset : 0;
		return { name: name, mimeType: mimeType, data: new System.Uint8Array(chunks.binaryBuffer.slice(byteOffset, byteOffset + bufferView.byteLength)) };
	});
}

//==============================================================================
// readGlbImages 의 그림 하나를 풀기. (ImageBitmap, 알파를 미리 곱하지 않고 색 공간을 바꾸지 않음)
//==============================================================================
/**
 * @param { object } image { mimeType, data }
 * @returns { Promise<ImageBitmap> } 풀어 낸 그림. (ToonRenderer.createTexture 에 넘긴다)
 * @example <caption>첫 그림 하나를 풀어 텍스처로</caption>
 * import { ToonRenderer, ToonGlb } from "./vanilla.js";
 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
 * const arrayBuffer = await (await fetch("examples/ancientmountain/assets/soldier.glb")).arrayBuffer();
 * const images = ToonGlb.readGlbImages(arrayBuffer);
 * if (images.length > 0 && images[0].data.length > 0) {
 * 	const imageBitmap = await ToonGlb.decodeGlbImage(images[0]);
 * 	const texture = renderer.createTexture(imageBitmap, { isRepeated: false });
 * }
 */
export function decodeGlbImage(image) {
	const blob = new System.Blob([image.data], { type: image.mimeType });
	return System.createImageBitmap(blob, { premultiplyAlpha: "none", colorSpaceConversion: "none" });
}

//==============================================================================
// GLB 하나를 노드 이름마다의 꼭짓점 배열로. ({ 이름: MeshBuilder.readArrays 의 꼴 }, 뼈대는 읽지 않음)
//   - 이름 끝의 ".outline" 노드(바깥선 껍데기)는 그 앞 이름의 노드에 함께 담는다. (crystal1 과 crystal1.outline 은 crystal1 하나)
//   - 부품마다 그 노드의 extras 를 extras 로 담는다. (없으면 빈 것)
//   - 부품마다 비치는 재질(alphaMode BLEND)의 가장 작은 불투명도를 alpha 로 담는다. (없으면 1)
//==============================================================================
/**
 * @param { ArrayBuffer } arrayBuffer - GLB 파일 전체.
 * @param { object | null } [outlineOptions] readGlbArrays 와 같음.
 * @returns { object } { 노드 이름: MeshBuilder.readArrays 의 꼴과 extras, alpha } 부품마다의 배열.
 * @example <caption>부품마다 메시를 따로 올려 바이저만 숨기기</caption>
 * import { ToonRenderer, ToonGlb, Camera3D, Matrix4, Vector3 } from "./vanilla.js";
 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
 * const arrayBuffer = await (await fetch("examples/ancientmountain/assets/soldier.glb")).arrayBuffer();
 * const partArrays = ToonGlb.readGlbNodeArrays(arrayBuffer, { width: 1.5, addedParts: ["vanguard_Mesh", "vanguard_visor"] });
 * const parts = Object.entries(partArrays).map(([partName, arrays]) => {
 * 	return { name: partName, mesh: renderer.createMesh(arrays), pivot: arrays.extras.pivot, alpha: arrays.alpha };
 * });
 * const camera = new Camera3D();
 * camera.setPerspective(0.8, 0.1, 100);
 * camera.lookAt(Vector3.create(0, 1.5, 4), Vector3.create(0, 1, 0), Vector3.create(0, 1, 0));
 * renderer.beginFrameWithCamera(camera);
 * for (const part of parts) {
 * 	if (part.name === "vanguard_visor") {
 * 		continue;
 * 	}
 * 	const modelMatrix = Matrix4.createScale(0.01, 0.01, 0.01);
 * 	if (Array.isArray(part.pivot)) {
 * 		modelMatrix.multiply(Matrix4.createTranslation(part.pivot[0], part.pivot[1], part.pivot[2]));
 * 	}
 * 	renderer.drawMesh(part.mesh, modelMatrix);
 * }
 * renderer.endFrame();
 */
export function readGlbNodeArrays(arrayBuffer, outlineOptions = null) {
	const chunks = readGlbChunks(arrayBuffer);
	const json = chunks.json;
	const binaryBuffer = chunks.binaryBuffer;
	const builders = {};
	const partExtras = {};
	const partAlphas = {};
	const isOutlineRebuilt = outlineOptions !== null;
	const nodeNames = readNodeNames(json);
	visitMeshNodes(json, (node, matrix) => {
		const nodeName = typeof node.name === "string" ? node.name : "";
		const partName = nodeName.endsWith(OUTLINE_NODE_SUFFIX) ? nodeName.slice(0, nodeName.length - OUTLINE_NODE_SUFFIX.length) : nodeName;
		if (builders[partName] === undefined) {
			builders[partName] = new MeshBuilder();
		}
		if (partName === nodeName && node.extras !== undefined && node.extras !== null) {
			partExtras[partName] = node.extras;
		}
		for (const primitive of json.meshes[node.mesh].primitives) {
			addPrimitive(builders[partName], json, binaryBuffer, node, primitive, matrix, isOutlineRebuilt);
			const material = primitive.material !== undefined && json.materials !== undefined ? json.materials[primitive.material] : {};
			if (material.alphaMode === "BLEND") {
				const pbrMetallicRoughness = material.pbrMetallicRoughness !== undefined ? material.pbrMetallicRoughness : {};
				const baseColor = pbrMetallicRoughness.baseColorFactor !== undefined ? pbrMetallicRoughness.baseColorFactor : [1, 1, 1, 1];
				const previousAlpha = partAlphas[partName] !== undefined ? partAlphas[partName] : 1;
				partAlphas[partName] = System.Math.min(previousAlpha, baseColor[3]);
			}
		}
		if (!isOutlineRebuilt) {
			return;
		}
		const outlineWidth = readRebuiltOutlineWidth(node, nodeNames, outlineOptions);
		if (outlineWidth !== null) {
			addRebuiltOutline(builders[partName], json, binaryBuffer, node, matrix, outlineWidth);
		}
	});
	const partArrays = {};
	for (const [partName, builder] of System.Object.entries(builders)) {
		const arrays = builder.readArrays();
		arrays.extras = partExtras[partName] !== undefined ? partExtras[partName] : {};
		arrays.alpha = partAlphas[partName] !== undefined ? partAlphas[partName] : 1;
		partArrays[partName] = arrays;
	}
	return partArrays;
}

//==============================================================================
// GLB 의 메시 노드마다의 extras, 가운데, 따르는 본. ({ 이름: { extras, center, jointIndex } }, 이름 끝이 ".outline" 인 노드와 바깥선 재질은 뺌)
//   - readGlbArrays 로 한 덩이에 읽은 뼈대 모형에서 노드 extras(body 의 height 등)와 부품의 자리(헬멧 불 등)를 따로 읽을 때 쓴다.
//   - center 는 꼭짓점이 놓인 범위의 가운데이다. (모형 좌표, 뼈대로 움직이는 노드는 쉬는 자세의 자리, 꼭짓점이 없으면 원점)
//   - jointIndex 는 그 노드의 꼭짓점이 가장 무겁게 딸린 본의 skin 안 차례이다. (writeSkinPose 가 쓴 본 행렬의 차례, 뼈대가 없으면 -1)
//     자세를 세운 뒤의 자리는 그 본 행렬로 center 를 옮긴 것이다.
//==============================================================================
/**
 * @param { ArrayBuffer } arrayBuffer - GLB 파일 전체.
 * @returns { object } { 노드 이름: { extras, center [x, y, z], jointIndex } } 메시 노드마다의 정보.
 * @example <caption>걷는 모형의 바이저 자리 읽기</caption>
 * import { ToonGlb, Matrix4 } from "./vanilla.js";
 * const arrayBuffer = await (await fetch("examples/ancientmountain/assets/soldier.glb")).arrayBuffer();
 * const skeleton = ToonGlb.readGlbArrays(arrayBuffer).skeleton;
 * const visorInfo = ToonGlb.readGlbNodeInfos(arrayBuffer)["vanguard_visor"];
 * if (skeleton !== null && visorInfo !== undefined && visorInfo.jointIndex >= 0) {
 * 	const jointMatrices = new Float32Array(skeleton.joints.length * 16);
 * 	ToonGlb.writeSkinPose(skeleton, "Walk", 0.25, jointMatrices);
 * 	const jointMatrix = Matrix4.createIdentity();
 * 	jointMatrix.getElements().set(jointMatrices.subarray(visorInfo.jointIndex * 16, visorInfo.jointIndex * 16 + 16));
 * 	const visorPosition = jointMatrix.transformPoint(visorInfo.center[0], visorInfo.center[1], visorInfo.center[2]);
 * }
 */
export function readGlbNodeInfos(arrayBuffer) {
	const chunks = readGlbChunks(arrayBuffer);
	const json = chunks.json;
	const binaryBuffer = chunks.binaryBuffer;
	const nodeInfos = {};
	visitMeshNodes(json, (node, matrix) => {
		const nodeName = typeof node.name === "string" ? node.name : "";
		if (nodeName.endsWith(OUTLINE_NODE_SUFFIX)) {
			return;
		}
		const minimum = [System.Infinity, System.Infinity, System.Infinity];
		const maximum = [-System.Infinity, -System.Infinity, -System.Infinity];
		const jointWeights = new System.Map();
		for (const primitive of json.meshes[node.mesh].primitives) {
			const attributes = primitive.attributes;
			if (attributes.POSITION === undefined) {
				continue;
			}
			const material = primitive.material !== undefined && json.materials !== undefined ? json.materials[primitive.material] : {};
			const materialExtras = material.extras !== undefined ? material.extras : {};
			if (materialExtras.outline === true) {
				continue;
			}
			const isSkinned = node.skin !== undefined && attributes.JOINTS_0 !== undefined && attributes.WEIGHTS_0 !== undefined;
			const positions = readAccessor(json, binaryBuffer, attributes.POSITION);
			for (let offset = 0; offset + 3 <= positions.length; offset += 3) {
				let point = [positions[offset], positions[offset + 1], positions[offset + 2]];
				if (!isSkinned) {
					const transformedPoint = matrix.transformPoint(point[0], point[1], point[2]);
					point = [transformedPoint.x, transformedPoint.y, transformedPoint.z];
				}
				for (let axis = 0; axis < 3; ++axis) {
					minimum[axis] = System.Math.min(minimum[axis], point[axis]);
					maximum[axis] = System.Math.max(maximum[axis], point[axis]);
				}
			}
			if (isSkinned) {
				const joints = readAccessor(json, binaryBuffer, attributes.JOINTS_0);
				const weights = readWeightAccessor(json, binaryBuffer, attributes.WEIGHTS_0);
				for (let valueIndex = 0; valueIndex < joints.length; ++valueIndex) {
					const jointIndex = joints[valueIndex];
					const previousWeight = jointWeights.has(jointIndex) ? jointWeights.get(jointIndex) : 0;
					jointWeights.set(jointIndex, previousWeight + weights[valueIndex]);
				}
			}
		}
		let center = [0, 0, 0];
		if (minimum[0] <= maximum[0]) {
			center = [(minimum[0] + maximum[0]) / 2, (minimum[1] + maximum[1]) / 2, (minimum[2] + maximum[2]) / 2];
		}
		let heaviestJointIndex = -1;
		let heaviestWeight = 0;
		for (const [jointIndex, weight] of jointWeights) {
			if (weight > heaviestWeight) {
				heaviestJointIndex = jointIndex;
				heaviestWeight = weight;
			}
		}
		const extras = node.extras !== undefined && node.extras !== null ? node.extras : {};
		nodeInfos[nodeName] = { extras: extras, center: center, jointIndex: heaviestJointIndex };
	});
	return nodeInfos;
}

//==============================================================================
// 움직임의 한 갈래를 그 시각에서 읽기. (LINEAR 는 사이를 섞고 돌림은 사원수를 정규화해 섞음, STEP 은 앞 키)
//==============================================================================
/**
 * @param { object } channel { times, values, path, isStep }
 * @param { number } time - 움직임 안의 시각. (초)
 * @returns { Array<number> } 그 시각의 값. (돌림은 사원수 4, 자리와 크기는 3)
 */
function sampleChannel(channel, time) {
	const times = channel.times;
	const componentCount = channel.path === "rotation" ? 4 : 3;
	const values = channel.values;
	if (time <= times[0] || times.length === 1) {
		return System.Array.from(values.slice(0, componentCount));
	}
	const lastIndex = times.length - 1;
	if (time >= times[lastIndex]) {
		return System.Array.from(values.slice(lastIndex * componentCount, lastIndex * componentCount + componentCount));
	}
	let keyIndex = 0;
	while (keyIndex < lastIndex - 1 && times[keyIndex + 1] <= time) {
		++keyIndex;
	}
	const startOffset = keyIndex * componentCount;
	const endOffset = startOffset + componentCount;
	if (channel.isStep) {
		return System.Array.from(values.slice(startOffset, endOffset));
	}
	const ratio = (time - times[keyIndex]) / (times[keyIndex + 1] - times[keyIndex]);
	const result = [];
	// 사원수는 가까운 쪽으로 섞는다. (q 와 -q 는 같은 돌림)
	let sign = 1;
	if (componentCount === 4) {
		let dot = 0;
		for (let componentIndex = 0; componentIndex < 4; ++componentIndex) {
			dot += values[startOffset + componentIndex] * values[endOffset + componentIndex];
		}
		sign = dot < 0 ? -1 : 1;
	}
	for (let componentIndex = 0; componentIndex < componentCount; ++componentIndex) {
		const startValue = values[startOffset + componentIndex];
		const endValue = values[endOffset + componentIndex] * sign;
		result.push(startValue + (endValue - startValue) * ratio);
	}
	if (componentCount === 4) {
		const length = System.Math.hypot(result[0], result[1], result[2], result[3]);
		if (length > 0) {
			return result.map((value) => {
				return value / length;
			});
		}
	}
	return result;
}

//==============================================================================
// 움직임을 그 시각에서 읽은 노드마다의 자리, 돌림, 크기. (움직임이 없으면 쉬는 자세)
//==============================================================================
/**
 * @param { object } skeleton - readSkeleton 의 결과.
 * @param { string } animationName - 움직임 이름. (없으면 쉬는 자세)
 * @param { number } time 초. (움직임 길이로 되풀이, extras.loop 가 "once" 면 끝 시각에 묶음)
 * @param { object | null } [swingScales] 흔들림 배율. (writeSkinPose)
 * @returns { Array<object> } [{ translation, rotation, scale, matrix }]
 */
function readAnimationLocals(skeleton, animationName, time, swingScales = null) {
	const locals = skeleton.nodes.map((node) => {
		return { translation: node.translation, rotation: node.rotation, scale: node.scale, matrix: node.matrix };
	});
	const animation = skeleton.animations[animationName];
	if (animation !== undefined) {
		const isOnce = animation.extras.loop === LOOP_ONCE;
		let localTime = 0;
		if (animation.duration > 0) {
			localTime = isOnce ? System.Math.max(0, System.Math.min(animation.duration, time)) : time % animation.duration;
		}
		for (const channel of animation.channels) {
			const local = locals[channel.nodeIndex];
			if (local === undefined || local.matrix !== null) {
				continue;
			}
			const sampled = sampleChannel(channel, localTime);
			if (channel.path === "translation" || channel.path === "rotation" || channel.path === "scale") {
				local[channel.path] = sampled;
			}
		}
		// 흔들림 배율을 받은 노드는 돌림을 쉬는 자세 쪽으로 그 몫만큼만 둔다.
		const scales = swingScales !== null && swingScales[animationName] !== undefined ? swingScales[animationName] : [];
		for (const swingScale of scales) {
			const local = locals[swingScale.nodeIndex];
			if (local === undefined || local.matrix !== null) {
				continue;
			}
			const restRotation = skeleton.nodes[swingScale.nodeIndex].rotation;
			local.rotation = mixRotation(restRotation, local.rotation, swingScale.scale);
		}
	}
	return locals;
}

//==============================================================================
// 두 돌림 섞기. (가까운 쪽으로 섞어 정규화, ratio 가 1 이면 other)
//==============================================================================
/**
 * @param { Array<number> } rotation - [x, y, z, w] 앞 돌림.
 * @param { Array<number> } otherRotation - [x, y, z, w] 뒤 돌림.
 * @param { number } ratio - 섞는 몫. (0 이면 rotation, 1 이면 otherRotation)
 * @returns { Array<number> } 섞은 단위 사원수.
 */
function mixRotation(rotation, otherRotation, ratio) {
	let dot = 0;
	for (let componentIndex = 0; componentIndex < 4; ++componentIndex) {
		dot += rotation[componentIndex] * otherRotation[componentIndex];
	}
	const sign = dot < 0 ? -1 : 1;
	const mixed = rotation.map((value, componentIndex) => {
		return value + (otherRotation[componentIndex] * sign - value) * ratio;
	});
	const length = System.Math.hypot(mixed[0], mixed[1], mixed[2], mixed[3]);
	if (length <= 0) {
		return System.Array.from(rotation);
	}
	return mixed.map((value) => {
		return value / length;
	});
}

//==============================================================================
// 움직임에서 한 노드의 돌림이 쉬는 자세에서 가장 벗어난 각. (라디안, 열쇠 프레임마다 보고, 그 노드의 돌림이 없으면 0)
//==============================================================================
/**
 * @param { object } skeleton readGlbArrays 의 skeleton.
 * @param { string } animationName - 움직임 이름.
 * @param { number } nodeIndex - skeleton.nodes 의 차례.
 * @returns { number } 쉬는 자세에서 가장 벗어난 각. (라디안, 없으면 0)
 * @example <caption>꼬리가 크게 흔들리는 만큼만 줄여 자세 셈하기</caption>
 * import { ToonGlb } from "./vanilla.js";
 * const arrayBuffer = await (await fetch("examples/ancientmountain/assets/fox.glb")).arrayBuffer();
 * const skeleton = ToonGlb.readGlbArrays(arrayBuffer).skeleton;
 * if (skeleton !== null) {
 * 	const tailIndex = skeleton.nodes.findIndex((node) => node.name === "b_Tail01_012");
 * 	const swing = ToonGlb.readAnimationSwing(skeleton, "Run", tailIndex);
 * 	const swingScale = swing > 0.5 ? 0.5 / swing : 1;
 * 	const jointMatrices = new Float32Array(skeleton.joints.length * 16);
 * 	ToonGlb.writeSkinPose(skeleton, "Run", 0.3, jointMatrices, null, { Run: [{ nodeIndex: tailIndex, scale: swingScale }] });
 * }
 */
export function readAnimationSwing(skeleton, animationName, nodeIndex) {
	const animation = skeleton.animations[animationName];
	const node = skeleton.nodes[nodeIndex];
	if (animation === undefined || node === undefined) {
		return 0;
	}
	const restRotation = node.rotation;
	let largestAngle = 0;
	for (const channel of animation.channels) {
		if (channel.nodeIndex !== nodeIndex || channel.path !== "rotation") {
			continue;
		}
		const values = channel.values;
		for (let offset = 0; offset + 4 <= values.length; offset += 4) {
			let dot = 0;
			for (let componentIndex = 0; componentIndex < 4; ++componentIndex) {
				dot += values[offset + componentIndex] * restRotation[componentIndex];
			}
			const angle = 2 * System.Math.acos(System.Math.min(1, System.Math.abs(dot)));
			largestAngle = System.Math.max(largestAngle, angle);
		}
	}
	return largestAngle;
}

//==============================================================================
// 두 자세 섞기. (자리와 크기는 곧게, 돌림은 가까운 쪽으로 섞어 정규화, ratio 가 1 이면 other)
//==============================================================================
/**
 * @param { Array<object> } locals 섞은 것을 여기에 씀.
 * @param { Array<object> } otherLocals - 섞을 자세. (readAnimationLocals 의 결과)
 * @param { number } ratio - 섞는 몫. (0 ~ 1)
 */
function mixLocals(locals, otherLocals, ratio) {
	for (let nodeIndex = 0; nodeIndex < locals.length; ++nodeIndex) {
		const local = locals[nodeIndex];
		const other = otherLocals[nodeIndex];
		if (local.matrix !== null || other === undefined) {
			continue;
		}
		local.translation = local.translation.map((value, componentIndex) => {
			return value + (other.translation[componentIndex] - value) * ratio;
		});
		local.scale = local.scale.map((value, componentIndex) => {
			return value + (other.scale[componentIndex] - value) * ratio;
		});
		let dot = 0;
		for (let componentIndex = 0; componentIndex < 4; ++componentIndex) {
			dot += local.rotation[componentIndex] * other.rotation[componentIndex];
		}
		const sign = dot < 0 ? -1 : 1;
		const rotation = local.rotation.map((value, componentIndex) => {
			return value + (other.rotation[componentIndex] * sign - value) * ratio;
		});
		const length = System.Math.hypot(rotation[0], rotation[1], rotation[2], rotation[3]);
		if (length > 0) {
			local.rotation = rotation.map((value) => {
				return value / length;
			});
		}
	}
}

//==============================================================================
// 뼈대 자세 셈하기. (움직임을 그 시각에서 읽어 본마다 행렬을 target 에 16 씩 씀, 움직임이 없으면 쉬는 자세)
//   - blend 를 주면 앞 움직임의 자세를 그 무게만큼 섞는다. (움직임이 바뀔 때 잠깐)
//   - swingScales 를 주면 그 움직임의 그 노드는 돌림을 쉬는 자세 쪽으로 줄인다. (움직임을 다시 뽑지 않고 흔들림만 줄일 때, 섞는 앞 자세에도 같이)
//==============================================================================
/**
 * @param { object } skeleton readGlbArrays 의 skeleton.
 * @param { string } animationName - 움직임 이름. (없으면 쉬는 자세)
 * @param { number } time 초. (움직임 길이로 되풀이, 한 번만 트는 움직임은 끝 시각에 묶음)
 * @param { Float32Array } target - 본마다 16 씩 쓸 곳. (skeleton.joints.length x 16 이상, ToonRenderer.drawMesh 의 jointMatrices)
 * @param { object | null } [blend] { animationName, time, weight } 섞을 앞 자세와 그 무게. (0 ~ 1)
 * @param { object | null } [swingScales] { 움직임 이름: [{ nodeIndex, scale }] } 흔들림 배율. (1 이면 그대로, 0 이면 쉬는 자세)
 * @example <caption>움직임이 바뀔 때 앞 자세를 잠깐 섞기</caption>
 * import { ToonGlb } from "./vanilla.js";
 * const arrayBuffer = await (await fetch("examples/ancientmountain/assets/fox.glb")).arrayBuffer();
 * const skeleton = ToonGlb.readGlbArrays(arrayBuffer).skeleton;
 * if (skeleton !== null) {
 * 	const jointMatrices = new Float32Array(skeleton.joints.length * 16);
 * 	const blendDuration = 0.2;
 * 	const timeSinceChange = 0.05;
 * 	const blend = { animationName: "Survey", time: 1.4, weight: 1 - timeSinceChange / blendDuration };
 * 	ToonGlb.writeSkinPose(skeleton, "Run", timeSinceChange, jointMatrices, blend);
 * }
 */
export function writeSkinPose(skeleton, animationName, time, target, blend = null, swingScales = null) {
	const locals = readAnimationLocals(skeleton, animationName, time, swingScales);
	if (blend !== null && blend.weight > 0) {
		const blendLocals = readAnimationLocals(skeleton, blend.animationName, blend.time, swingScales);
		mixLocals(locals, blendLocals, System.Math.min(1, blend.weight));
	}
	const globals = [];
	const readGlobal = (nodeIndex) => {
		if (globals[nodeIndex] !== undefined) {
			return globals[nodeIndex];
		}
		const local = locals[nodeIndex];
		let localMatrix = null;
		if (local.matrix !== null) {
			localMatrix = Matrix4.createIdentity();
			const localElements = localMatrix.getElements();
			localElements.set(local.matrix);
		}
		else {
			localMatrix = createTransformMatrix(local.translation, local.rotation, local.scale);
		}
		const parentIndex = skeleton.nodes[nodeIndex].parentIndex;
		let globalMatrix = localMatrix;
		if (parentIndex >= 0) {
			globalMatrix = readGlobal(parentIndex).clone();
			globalMatrix.multiply(localMatrix);
		}
		globals[nodeIndex] = globalMatrix;
		return globalMatrix;
	};
	const inverseBindMatrix = Matrix4.createIdentity();
	const inverseBindElements = inverseBindMatrix.getElements();
	for (let jointIndex = 0; jointIndex < skeleton.joints.length; ++jointIndex) {
		const jointMatrix = readGlobal(skeleton.joints[jointIndex]).clone();
		inverseBindElements.set(skeleton.inverseBindMatrices.subarray(jointIndex * 16, jointIndex * 16 + 16));
		jointMatrix.multiply(inverseBindMatrix);
		const jointElements = jointMatrix.getElements();
		target.set(jointElements, jointIndex * 16);
	}
}
