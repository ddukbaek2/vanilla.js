//==============================================================================
// glTF KHR_mesh_quantization 읽기 시험. (node tests/graphics3d/meshquantization.test.mjs)
// - 같은 모형을 실수 GLB 와 양자화 GLB(명세의 공식으로 이 시험이 직접 지음) 둘로 지어, 두 읽기(툰의 readGlbArrays 들, PBR 의 SkinnedModel)가 양자화 칸 크기 안에서 같은 꼭짓점을 내는지 본다.
//   - 갈래 A: 위치 UNSIGNED_SHORT(정규화 아님, 칸 8 바이트) + 되풀이 잎 노드, 노멀 BYTE 정규화(칸 4 바이트), UV UNSIGNED_SHORT 정규화 + KHR_texture_transform.
//   - 갈래 B: 위치 SHORT 정규화, 노멀 SHORT 정규화(-32768 은 -1 로 자름), UV BYTE(정규화 아님) + KHR_texture_transform.
//   - 뼈대: 위치 UNSIGNED_SHORT 를 inverseBindMatrices 로 되풀이, 무게 UNSIGNED_BYTE 정규화, 돌림 움직임 SHORT 정규화.
// - extensionsRequired 의 EXT_meshopt_compression 과 모르는 확장, 바이너리 덩어리 밖 버퍼(meshopt 의 fallback 버퍼)는 분명한 오류를 던진다.
//==============================================================================
import { readGlbArrays, readGlbNodeArrays, readGlbNodeInfos, writeSkinPose } from "../../src/graphics3d/toon/glbmeshreader.js";
import { SkinnedModel } from "../../src/graphics3d/skinnedmodel.js";
import { VERTEX_FLOAT_COUNT } from "../../src/graphics3d/toon/meshbuilder.js";
import { check, checkEqual, checkNear, finish } from "../testcheck.mjs";

const POSITIONS = [[0.1, -0.3, 0.5], [1.2, 0.4, -0.2], [-0.7, 0.9, 0.3], [0.5, 0.5, 1.1]];
const NORMALS = [[0, 0, 1], [0.6, 0, 0.8], [0, -1, 0], [-0.48, 0.6, 0.64]];
const UVS = [[0.1, 0.2], [0.9, 0.3], [0.4, 0.8], [0.6, 0.55]];
const INDICES = [0, 1, 2, 0, 2, 3];
const PART_EXTRAS = { line: 0.06, anchors: { nose: [0, 1, 2] } };

//==============================================================================
// GLB 짓기. (json 과 바이너리 조각들, 조각마다 bufferView 하나, 4 바이트 맞춤)
//==============================================================================
function createGlb(json, viewByteList) {
	let byteLength = 0;
	json.bufferViews = viewByteList.map((viewBytes) => {
		const bufferView = { buffer: 0, byteOffset: byteLength, byteLength: viewBytes.bytes.length };
		if (viewBytes.byteStride !== undefined) {
			bufferView.byteStride = viewBytes.byteStride;
		}
		byteLength += Math.ceil(viewBytes.bytes.length / 4) * 4;
		return bufferView;
	});
	json.buffers = [{ byteLength: byteLength }];
	json.asset = { version: "2.0" };
	const binaryBytes = new Uint8Array(byteLength);
	viewByteList.forEach((viewBytes, viewIndex) => {
		binaryBytes.set(viewBytes.bytes, json.bufferViews[viewIndex].byteOffset);
	});
	let jsonText = JSON.stringify(json);
	while (jsonText.length % 4 !== 0) {
		jsonText += " ";
	}
	const jsonBytes = new TextEncoder().encode(jsonText);
	const totalLength = 12 + 8 + jsonBytes.length + 8 + binaryBytes.length;
	const arrayBuffer = new ArrayBuffer(totalLength);
	const dataView = new DataView(arrayBuffer);
	dataView.setUint32(0, 0x46546c67, true);
	dataView.setUint32(4, 2, true);
	dataView.setUint32(8, totalLength, true);
	dataView.setUint32(12, jsonBytes.length, true);
	dataView.setUint32(16, 0x4e4f534a, true);
	new Uint8Array(arrayBuffer, 20, jsonBytes.length).set(jsonBytes);
	dataView.setUint32(20 + jsonBytes.length, binaryBytes.length, true);
	dataView.setUint32(24 + jsonBytes.length, 0x004e4942, true);
	new Uint8Array(arrayBuffer, 28 + jsonBytes.length, binaryBytes.length).set(binaryBytes);
	return arrayBuffer;
}

//==============================================================================
// 정수 꼭짓점 칸 짓기. (요소마다 byteStride 바이트, 값은 setter 로 씀)
//==============================================================================
function createStridedBytes(elementList, byteStride, componentByteSize, writeComponent) {
	const bytes = new Uint8Array(elementList.length * byteStride);
	const dataView = new DataView(bytes.buffer);
	elementList.forEach((element, elementIndex) => {
		element.forEach((value, componentIndex) => {
			writeComponent(dataView, elementIndex * byteStride + componentIndex * componentByteSize, value);
		});
	});
	return bytes;
}

//==============================================================================
// 실수 칸 짓기.
//==============================================================================
function createFloatBytes(elementList) {
	return new Uint8Array(new Float32Array(elementList.flat()).buffer);
}

//==============================================================================
// 재질과 그림. (바탕 텍스처에 KHR_texture_transform 을 줄 수 있다)
//==============================================================================
function createMaterialJson(textureTransform) {
	const baseColorTexture = { index: 0 };
	if (textureTransform !== null) {
		baseColorTexture.extensions = { KHR_texture_transform: textureTransform };
	}
	return [{ name: "paint", pbrMetallicRoughness: { baseColorFactor: [0.5, 0.25, 0.125, 1], baseColorTexture: baseColorTexture } }];
}

//==============================================================================
// 실수 모형. (이름 있는 노드 하나에 메시)
//==============================================================================
function createFloatModel() {
	const json = {
		scene: 0,
		scenes: [{ nodes: [0] }],
		nodes: [{ name: "hull", mesh: 0, extras: PART_EXTRAS }],
		meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
		materials: createMaterialJson(null),
		textures: [{ source: 0 }],
		images: [{ bufferView: 4, mimeType: "image/png" }],
		accessors: [
			{ bufferView: 0, componentType: 5126, count: 4, type: "VEC3" },
			{ bufferView: 1, componentType: 5126, count: 4, type: "VEC3" },
			{ bufferView: 2, componentType: 5126, count: 4, type: "VEC2" },
			{ bufferView: 3, componentType: 5123, count: 6, type: "SCALAR" },
		],
	};
	const viewByteList = [
		{ bytes: createFloatBytes(POSITIONS) },
		{ bytes: createFloatBytes(NORMALS) },
		{ bytes: createFloatBytes(UVS) },
		{ bytes: new Uint8Array(new Uint16Array(INDICES).buffer) },
		{ bytes: new Uint8Array([137, 80, 78, 71]) },
	];
	return createGlb(json, viewByteList);
}

//==============================================================================
// 축마다의 가장 작은 값과 가장 큰 칸. (균일한 되풀이 크기를 쓴다, 명세의 권고)
//==============================================================================
function readBounds(elementList) {
	const componentCount = elementList[0].length;
	const minimum = Array.from({ length: componentCount }, (value, axis) => Math.min(...elementList.map((element) => element[axis])));
	const maximum = Array.from({ length: componentCount }, (value, axis) => Math.max(...elementList.map((element) => element[axis])));
	const extent = Math.max(...maximum.map((value, axis) => value - minimum[axis]));
	return { minimum: minimum, maximum: maximum, extent: extent };
}

//==============================================================================
// 양자화 모형 갈래 A. (gltfpack 의 기본 꼴과 같은 종류)
//==============================================================================
function createQuantizedModelA() {
	const positionBounds = readBounds(POSITIONS);
	const positionScale = positionBounds.extent / 16383;
	const quantizedPositions = POSITIONS.map((position) => position.map((value, axis) => Math.round((value - positionBounds.minimum[axis]) / positionScale)));
	const quantizedNormals = NORMALS.map((normal) => normal.map((value) => Math.round(value * 127)));
	const uvBounds = readBounds(UVS);
	const quantizedUvs = UVS.map((uv) => uv.map((value, axis) => Math.round((value - uvBounds.minimum[axis]) / uvBounds.extent * 65535)));
	const textureTransform = { offset: uvBounds.minimum, scale: [uvBounds.extent, uvBounds.extent] };
	const json = {
		extensionsUsed: ["KHR_mesh_quantization", "KHR_texture_transform"],
		extensionsRequired: ["KHR_mesh_quantization"],
		scene: 0,
		scenes: [{ nodes: [0] }],
		nodes: [{ name: "hull", children: [1], extras: PART_EXTRAS }, { mesh: 0, translation: positionBounds.minimum, scale: [positionScale, positionScale, positionScale] }],
		meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
		materials: createMaterialJson(textureTransform),
		textures: [{ source: 0 }],
		images: [{ bufferView: 4, mimeType: "image/png" }],
		accessors: [
			{ bufferView: 0, componentType: 5123, count: 4, type: "VEC3" },
			{ bufferView: 1, componentType: 5120, normalized: true, count: 4, type: "VEC3" },
			{ bufferView: 2, componentType: 5123, normalized: true, count: 4, type: "VEC2" },
			{ bufferView: 3, componentType: 5123, count: 6, type: "SCALAR" },
		],
	};
	const viewByteList = [
		{ bytes: createStridedBytes(quantizedPositions, 8, 2, (dataView, offset, value) => dataView.setUint16(offset, value, true)), byteStride: 8 },
		{ bytes: createStridedBytes(quantizedNormals, 4, 1, (dataView, offset, value) => dataView.setInt8(offset, value)), byteStride: 4 },
		{ bytes: createStridedBytes(quantizedUvs, 4, 2, (dataView, offset, value) => dataView.setUint16(offset, value, true)), byteStride: 4 },
		{ bytes: new Uint8Array(new Uint16Array(INDICES).buffer) },
		{ bytes: new Uint8Array([137, 80, 78, 71]) },
	];
	return { arrayBuffer: createGlb(json, viewByteList), positionCellSize: positionScale, uvCellSize: uvBounds.extent / 65535 };
}

//==============================================================================
// 양자화 모형 갈래 B. (부호 있는 정규화 위치와 노멀, 정규화 아닌 BYTE 텍스처 좌표)
//==============================================================================
function createQuantizedModelB() {
	const positionBounds = readBounds(POSITIONS);
	const positionCenter = positionBounds.minimum.map((value, axis) => (value + positionBounds.maximum[axis]) / 2);
	const positionHalfExtent = positionBounds.extent / 2;
	const quantizedPositions = POSITIONS.map((position) => position.map((value, axis) => Math.round((value - positionCenter[axis]) / positionHalfExtent * 32767)));
	const quantizedNormals = NORMALS.map((normal) => normal.map((value) => (value === -1 ? -32768 : Math.round(value * 32767))));
	const uvBounds = readBounds(UVS);
	const uvScale = uvBounds.extent / 127;
	const quantizedUvs = UVS.map((uv) => uv.map((value, axis) => Math.round((value - uvBounds.minimum[axis]) / uvScale)));
	const textureTransform = { offset: uvBounds.minimum, scale: [uvScale, uvScale] };
	const json = {
		extensionsUsed: ["KHR_mesh_quantization", "KHR_texture_transform"],
		extensionsRequired: ["KHR_mesh_quantization", "KHR_texture_transform"],
		scene: 0,
		scenes: [{ nodes: [0] }],
		nodes: [{ name: "hull", children: [1], extras: PART_EXTRAS }, { mesh: 0, translation: positionCenter, scale: [positionHalfExtent, positionHalfExtent, positionHalfExtent] }],
		meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
		materials: createMaterialJson(textureTransform),
		textures: [{ source: 0 }],
		images: [{ bufferView: 4, mimeType: "image/png" }],
		accessors: [
			{ bufferView: 0, componentType: 5122, normalized: true, count: 4, type: "VEC3" },
			{ bufferView: 1, componentType: 5122, normalized: true, count: 4, type: "VEC3" },
			{ bufferView: 2, componentType: 5120, count: 4, type: "VEC2" },
			{ bufferView: 3, componentType: 5123, count: 6, type: "SCALAR" },
		],
	};
	const viewByteList = [
		{ bytes: createStridedBytes(quantizedPositions, 8, 2, (dataView, offset, value) => dataView.setInt16(offset, value, true)), byteStride: 8 },
		{ bytes: createStridedBytes(quantizedNormals, 8, 2, (dataView, offset, value) => dataView.setInt16(offset, value, true)), byteStride: 8 },
		{ bytes: createStridedBytes(quantizedUvs, 4, 1, (dataView, offset, value) => dataView.setInt8(offset, value)), byteStride: 4 },
		{ bytes: new Uint8Array(new Uint16Array(INDICES).buffer) },
		{ bytes: new Uint8Array([137, 80, 78, 71]) },
	];
	return { arrayBuffer: createGlb(json, viewByteList), positionCellSize: positionHalfExtent / 32767, uvCellSize: uvScale };
}

//==============================================================================
// 뼈대 모형. (본 하나, 위치는 실수 또는 inverseBindMatrices 로 되풀이하는 UNSIGNED_SHORT, 돌림 움직임은 실수 또는 SHORT 정규화)
//==============================================================================
function createSkinnedModel(isQuantized) {
	const positionBounds = readBounds(POSITIONS);
	const positionScale = positionBounds.extent / 16383;
	const rotationTimes = [0, 1];
	const halfAngle = 0.6;
	const rotationValues = [[0, 0, 0, 1], [0, Math.sin(halfAngle), 0, Math.cos(halfAngle)]];
	const quantizedRotations = rotationValues.map((rotation) => rotation.map((value) => Math.round(value * 32767)));
	const inverseBindMatrix = isQuantized ? [positionScale, 0, 0, 0, 0, positionScale, 0, 0, 0, 0, positionScale, 0, positionBounds.minimum[0], positionBounds.minimum[1], positionBounds.minimum[2], 1] : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
	const json = {
		scene: 0,
		scenes: [{ nodes: [0, 1] }],
		nodes: [{ name: "bone" }, { name: "skin", mesh: 0, skin: 0 }],
		skins: [{ joints: [0], inverseBindMatrices: 4 }],
		meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, JOINTS_0: 2, WEIGHTS_0: 3 }, indices: 7 }] }],
		animations: [{ name: "Turn", channels: [{ sampler: 0, target: { node: 0, path: "rotation" } }], samplers: [{ input: 5, output: 6, interpolation: "LINEAR" }] }],
		accessors: [
			isQuantized ? { bufferView: 0, componentType: 5123, count: 4, type: "VEC3" } : { bufferView: 0, componentType: 5126, count: 4, type: "VEC3" },
			isQuantized ? { bufferView: 1, componentType: 5120, normalized: true, count: 4, type: "VEC3" } : { bufferView: 1, componentType: 5126, count: 4, type: "VEC3" },
			{ bufferView: 2, componentType: 5121, count: 4, type: "VEC4" },
			{ bufferView: 3, componentType: 5121, normalized: true, count: 4, type: "VEC4" },
			{ bufferView: 4, componentType: 5126, count: 1, type: "MAT4" },
			{ bufferView: 5, componentType: 5126, count: 2, type: "SCALAR" },
			isQuantized ? { bufferView: 6, componentType: 5122, normalized: true, count: 2, type: "VEC4" } : { bufferView: 6, componentType: 5126, count: 2, type: "VEC4" },
			{ bufferView: 7, componentType: 5123, count: 6, type: "SCALAR" },
		],
	};
	if (isQuantized) {
		json.extensionsUsed = ["KHR_mesh_quantization"];
		json.extensionsRequired = ["KHR_mesh_quantization"];
	}
	const quantizedPositions = POSITIONS.map((position) => position.map((value, axis) => Math.round((value - positionBounds.minimum[axis]) / positionScale)));
	const quantizedNormals = NORMALS.map((normal) => normal.map((value) => Math.round(value * 127)));
	const viewByteList = [
		isQuantized ? { bytes: createStridedBytes(quantizedPositions, 8, 2, (dataView, offset, value) => dataView.setUint16(offset, value, true)), byteStride: 8 } : { bytes: createFloatBytes(POSITIONS) },
		isQuantized ? { bytes: createStridedBytes(quantizedNormals, 4, 1, (dataView, offset, value) => dataView.setInt8(offset, value)), byteStride: 4 } : { bytes: createFloatBytes(NORMALS) },
		{ bytes: new Uint8Array(16) },
		{ bytes: new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0]) },
		{ bytes: createFloatBytes([inverseBindMatrix]) },
		{ bytes: createFloatBytes([rotationTimes]) },
		isQuantized ? { bytes: new Uint8Array(new Int16Array(quantizedRotations.flat()).buffer) } : { bytes: createFloatBytes(rotationValues) },
		{ bytes: new Uint8Array(new Uint16Array(INDICES).buffer) },
	];
	return { arrayBuffer: createGlb(json, viewByteList), positionCellSize: positionScale };
}

//==============================================================================
// 꼭짓점 배열의 자리와 노멀. (MeshBuilder 꼭짓점 VERTEX_FLOAT_COUNT 칸의 앞 여섯)
//==============================================================================
function readVertexColumns(vertexData, firstColumn) {
	const values = [];
	for (let offset = 0; offset < vertexData.length; offset += VERTEX_FLOAT_COUNT) {
		values.push(vertexData[offset + firstColumn], vertexData[offset + firstColumn + 1], vertexData[offset + firstColumn + 2]);
	}
	return values;
}

const floatArrays = readGlbArrays(createFloatModel());
const floatPositions = readVertexColumns(floatArrays.vertexData, 0);
const floatNormals = readVertexColumns(floatArrays.vertexData, 3);
checkNear(floatPositions, POSITIONS.flat(), 1e-6, "실수 모형 위치");

// 툰 읽기: 위치는 칸 크기(셋 축의 반 칸 대각 안), 노멀은 정규화 정수의 칸, UV 는 칸 크기 안.
for (const [label, model, normalTolerance] of [["갈래 A", createQuantizedModelA(), 1.5 / 127], ["갈래 B", createQuantizedModelB(), 1.5 / 32767]]) {
	const quantizedArrays = readGlbArrays(model.arrayBuffer);
	checkEqual(quantizedArrays.vertexData.length, floatArrays.vertexData.length, label + " 꼭짓점 수");
	checkNear(readVertexColumns(quantizedArrays.vertexData, 0), floatPositions, model.positionCellSize, label + " 툰 위치");
	checkNear(readVertexColumns(quantizedArrays.vertexData, 3), floatNormals, normalTolerance * 2, label + " 툰 노멀");
	checkNear(quantizedArrays.uvData, UVS.flat(), model.uvCellSize, label + " 툰 UV (KHR_texture_transform)");
	checkEqual(quantizedArrays.materialRanges[0].nodeName, "hull", label + " 재질 범위의 부품 이름 (이름 없는 되풀이 잎 노드는 부모 부품)");
	const partArrays = readGlbNodeArrays(model.arrayBuffer, { width: 0.02, addedParts: ["hull"] });
	checkEqual(Object.keys(partArrays).join(","), "hull", label + " 부품 이름");
	checkEqual(partArrays.hull.extras.line, PART_EXTRAS.line, label + " 부품 extras");
	check(partArrays.hull.outlineIndexData.length > 0, label + " 부품 바깥선 껍데기");
	const nodeInfos = readGlbNodeInfos(model.arrayBuffer);
	const floatNodeInfos = readGlbNodeInfos(createFloatModel());
	checkNear(nodeInfos.hull.center, floatNodeInfos.hull.center, model.positionCellSize, label + " 부품 가운데");

	// PBR 읽기: 위치는 노드의 되풀이 변환을 곱하면 칸 안, 노멀과 UV 는 그대로 칸 안.
	const skinnedModel = SkinnedModel.createWithoutShaderProgram();
	const meshDescription = skinnedModel.interpretContent(...readChunks(model.arrayBuffer)).meshDescriptionList[0];
	const json = readChunks(model.arrayBuffer)[0];
	const leafNode = json.nodes[1];
	const dequantizedPositions = Array.from(meshDescription.positions, (value, valueIndex) => value * leafNode.scale[valueIndex % 3] + leafNode.translation[valueIndex % 3]);
	checkNear(dequantizedPositions, POSITIONS.flat(), model.positionCellSize, label + " PBR 위치");
	checkNear(meshDescription.normals, NORMALS.flat(), normalTolerance, label + " PBR 노멀");
	checkNear(meshDescription.textureCoordinates, UVS.flat(), model.uvCellSize, label + " PBR UV (KHR_texture_transform)");
}

// 부호 있는 정규화의 -1 자르기. (-32768 / 32767 은 -1 아래라 -1)
{
	const meshDescription = SkinnedModel.createWithoutShaderProgram().interpretContent(...readChunks(createQuantizedModelB().arrayBuffer)).meshDescriptionList[0];
	checkEqual(meshDescription.normals[7], -1, "SHORT 정규화 -32768 은 -1");
}

// 뼈대: 위치의 되풀이는 inverseBindMatrices 가 맡고, SHORT 정규화 돌림 움직임은 실수와 같다.
{
	const floatSkinned = readGlbArrays(createSkinnedModel(false).arrayBuffer);
	const quantizedModel = createSkinnedModel(true);
	const quantizedSkinned = readGlbArrays(quantizedModel.arrayBuffer);
	const floatJointMatrices = new Float32Array(16);
	const quantizedJointMatrices = new Float32Array(16);
	writeSkinPose(floatSkinned.skeleton, "Turn", 0.5, floatJointMatrices);
	writeSkinPose(quantizedSkinned.skeleton, "Turn", 0.5, quantizedJointMatrices);
	const skinPoints = (arrays, jointMatrices) => {
		const points = [];
		const positions = readVertexColumns(arrays.vertexData, 0);
		for (let offset = 0; offset < positions.length; offset += 3) {
			for (let row = 0; row < 3; ++row) {
				points.push(jointMatrices[row] * positions[offset] + jointMatrices[4 + row] * positions[offset + 1] + jointMatrices[8 + row] * positions[offset + 2] + jointMatrices[12 + row]);
			}
		}
		return points;
	};
	checkNear(skinPoints(quantizedSkinned, quantizedJointMatrices), skinPoints(floatSkinned, floatJointMatrices), quantizedModel.positionCellSize * 2, "뼈대 툰 자세 위치");
	// 몸으로 새로 지은 바깥선: 정수 위치 뼈대 메시도 굵기가 모형 좌표다. (inverseBindMatrices 의 되풀이 크기로 나눔)
	const outlineOptions = { width: 0.05, addedParts: ["skin"] };
	const floatOutlined = readGlbArrays(createSkinnedModel(false).arrayBuffer, outlineOptions);
	const quantizedOutlined = readGlbArrays(quantizedModel.arrayBuffer, outlineOptions);
	const outlinePoints = (arrays, jointMatrices) => {
		const points = [];
		const positions = arrays.outlineVertexData;
		for (let offset = 0; offset < positions.length; offset += 3) {
			for (let row = 0; row < 3; ++row) {
				points.push(jointMatrices[row] * positions[offset] + jointMatrices[4 + row] * positions[offset + 1] + jointMatrices[8 + row] * positions[offset + 2] + jointMatrices[12 + row]);
			}
		}
		return points;
	};
	check(floatOutlined.outlineVertexData.length > 0, "뼈대 바깥선 껍데기");
	checkNear(outlinePoints(quantizedOutlined, quantizedJointMatrices), outlinePoints(floatOutlined, floatJointMatrices), 0.05 * 0.05 + quantizedModel.positionCellSize * 2, "뼈대 바깥선 껍데기 자리 (굵기 0.05)");
	checkNear(quantizedSkinned.skeleton.animations.Turn.channels[0].values, floatSkinned.skeleton.animations.Turn.channels[0].values, 1 / 32767, "툰 SHORT 정규화 돌림 값");
	checkNear(Array.from(quantizedSkinned.skinData).slice(0, 8), Array.from(floatSkinned.skinData).slice(0, 8), 1e-6, "툰 UNSIGNED_BYTE 정규화 무게");
	const floatModel = SkinnedModel.createWithoutShaderProgram();
	floatModel.interpretContent(...readChunks(createSkinnedModel(false).arrayBuffer));
	const quantizedSkinnedModel = SkinnedModel.createWithoutShaderProgram();
	quantizedSkinnedModel.interpretContent(...readChunks(quantizedModel.arrayBuffer));
	checkNear(quantizedSkinnedModel.getAnimationList()[0].channels[0].values, floatModel.getAnimationList()[0].channels[0].values, 1 / 32767, "PBR SHORT 정규화 돌림 값");
}

// 필수 확장: meshopt 압축과 모르는 확장은 분명한 오류.
for (const [extensionName, expectedText] of [["EXT_meshopt_compression", "EXT_meshopt_compression"], ["KHR_draco_mesh_compression", "KHR_draco_mesh_compression"], ["VENDOR_unknown_thing", "VENDOR_unknown_thing"]]) {
	const sourceChunks = readChunks(createQuantizedModelA().arrayBuffer);
	const json = sourceChunks[0];
	json.extensionsRequired.push(extensionName);
	const arrayBuffer = rebuildGlb(json, sourceChunks[1]);
	for (const [readerName, readEvent] of [["readGlbArrays", () => readGlbArrays(arrayBuffer)], ["readGlbNodeArrays", () => readGlbNodeArrays(arrayBuffer)], ["SkinnedModel", () => SkinnedModel.createWithoutShaderProgram().interpretContent(...readChunks(arrayBuffer))]]) {
		let errorMessage = "";
		try {
			readEvent();
		}
		catch (error) {
			errorMessage = String(error.message);
		}
		check(errorMessage.includes(expectedText), readerName + " 의 " + extensionName + " 오류 글: " + errorMessage);
	}
}

// 필수가 아닌 meshopt 압축(fallback 버퍼를 가리키는 bufferView)도 엉뚱한 값을 읽지 않고 오류.
{
	const sourceChunks = readChunks(createQuantizedModelA().arrayBuffer);
	const json = sourceChunks[0];
	json.extensionsUsed.push("EXT_meshopt_compression");
	const arrayBuffer = rebuildGlb(json, sourceChunks[1]);
	const fallbackJson = readChunks(arrayBuffer)[0];
	fallbackJson.buffers.push({ byteLength: fallbackJson.buffers[0].byteLength, extensions: { EXT_meshopt_compression: { fallback: true } } });
	fallbackJson.bufferViews[0].buffer = 1;
	const fallbackArrayBuffer = rebuildGlbKeepingBuffers(fallbackJson, readChunks(arrayBuffer)[1]);
	for (const [readerName, readEvent] of [["readGlbArrays", () => readGlbArrays(fallbackArrayBuffer)], ["SkinnedModel", () => SkinnedModel.createWithoutShaderProgram().interpretContent(...readChunks(fallbackArrayBuffer))]]) {
		let errorMessage = "";
		try {
			readEvent();
		}
		catch (error) {
			errorMessage = String(error.message);
		}
		check(errorMessage.includes("buffers[1]"), readerName + " 의 바깥 버퍼 오류 글: " + errorMessage);
	}
}

//==============================================================================
// json 을 그대로 두고 GLB 다시 짓기. (bufferViews, buffers 를 고치지 않음)
//==============================================================================
function rebuildGlbKeepingBuffers(json, binaryBuffer) {
	let jsonText = JSON.stringify(json);
	while (jsonText.length % 4 !== 0) {
		jsonText += " ";
	}
	const jsonBytes = new TextEncoder().encode(jsonText);
	const binaryBytes = new Uint8Array(binaryBuffer);
	const totalLength = 12 + 8 + jsonBytes.length + 8 + binaryBytes.length;
	const arrayBuffer = new ArrayBuffer(totalLength);
	const dataView = new DataView(arrayBuffer);
	dataView.setUint32(0, 0x46546c67, true);
	dataView.setUint32(4, 2, true);
	dataView.setUint32(8, totalLength, true);
	dataView.setUint32(12, jsonBytes.length, true);
	dataView.setUint32(16, 0x4e4f534a, true);
	new Uint8Array(arrayBuffer, 20, jsonBytes.length).set(jsonBytes);
	dataView.setUint32(20 + jsonBytes.length, binaryBytes.length, true);
	dataView.setUint32(24 + jsonBytes.length, 0x004e4942, true);
	new Uint8Array(arrayBuffer, 28 + jsonBytes.length, binaryBytes.length).set(binaryBytes);
	return arrayBuffer;
}

//==============================================================================
// GLB 를 [json, binaryBuffer] 로. (SkinnedModel.readGlbChunks)
//==============================================================================
function readChunks(arrayBuffer) {
	const glbChunks = SkinnedModel.readGlbChunks(arrayBuffer);
	return [glbChunks.json, glbChunks.binaryBuffer];
}

//==============================================================================
// json 을 바꾼 GLB 다시 짓기. (바이너리 덩어리는 그대로)
//==============================================================================
function rebuildGlb(json, binaryBuffer) {
	const bufferViews = json.bufferViews;
	const viewByteList = bufferViews.map((bufferView) => {
		const viewBytes = { bytes: new Uint8Array(binaryBuffer, bufferView.byteOffset, bufferView.byteLength) };
		if (bufferView.byteStride !== undefined) {
			viewBytes.byteStride = bufferView.byteStride;
		}
		return viewBytes;
	});
	return createGlb(json, viewByteList);
}

finish("meshquantization");
