//==============================================================================
// 스킨드 모델 자산 캐시 시험. (node tests/graphics3d/skinnedmodelasset.test.mjs)
// - 가짜 WebGL2 컨텍스트로 GL 객체가 몇 개 지어지고 지워지는지 센다. (러스트 판 src/graphics3d/skinnedmodelasset.rs 시험과 같은 값)
// - 같은 자산 두 번 읽기에 받기와 올리기 한 번, 해제 차례에 따른 해제, 머티리얼 갈라짐, 모프 타깃 갈라짐, 캐시 비우기, 키 정규화.
//==============================================================================
import { SkinnedModel } from "../../src/graphics3d/skinnedmodel.js";
import { SkinnedModelAsset } from "../../src/graphics3d/skinnedmodelasset.js";

let checkCount = 0;
function check(condition, message) {
	checkCount++;
	if (!condition) {
		throw new Error("시험 실패: " + message);
	}
}

//==============================================================================
// 가짜 GL. (종류별 살아 있는 객체 수와 bufferData, texImage2D 부른 수)
//==============================================================================
function createFakeGl() {
	const liveTable = { buffer: new Set(), vertexArray: new Set(), texture: new Set() };
	const callTable = { bufferData: 0, texImage2D: 0 };
	let lastName = 0;
	const gl = {
		liveTable: liveTable,
		callTable: callTable,
		ARRAY_BUFFER: 0x8892, ELEMENT_ARRAY_BUFFER: 0x8893, STATIC_DRAW: 0x88e4, FLOAT: 0x1406, UNSIGNED_SHORT: 0x1403, UNSIGNED_INT: 0x1405,
		TEXTURE_2D: 0x0de1, RGBA: 0x1908, RGBA8: 0x8058, RGBA32F: 0x8814, UNSIGNED_BYTE: 0x1401, NEAREST: 0x2600, CLAMP_TO_EDGE: 0x812f,
		TEXTURE_MIN_FILTER: 0x2801, TEXTURE_MAG_FILTER: 0x2800, TEXTURE_WRAP_S: 0x2802, TEXTURE_WRAP_T: 0x2803,
		createBuffer() { const name = { kind: "buffer", name: ++lastName }; liveTable.buffer.add(name); return name; },
		deleteBuffer(name) { liveTable.buffer.delete(name); },
		createVertexArray() { const name = { kind: "vertexArray", name: ++lastName }; liveTable.vertexArray.add(name); return name; },
		deleteVertexArray(name) { liveTable.vertexArray.delete(name); },
		createTexture() { const name = { kind: "texture", name: ++lastName }; liveTable.texture.add(name); return name; },
		deleteTexture(name) { liveTable.texture.delete(name); },
		bufferData() { callTable.bufferData++; },
		texImage2D() { callTable.texImage2D++; },
		bindBuffer() {}, bindVertexArray() {}, bindTexture() {}, enableVertexAttribArray() {}, vertexAttribPointer() {}, vertexAttribIPointer() {}, texParameteri() {},
	};
	return gl;
}

//==============================================================================
// 가짜 렌더러. (어트리뷰트는 모두 있는 셈, 셰이더 프로그램 하나)
//==============================================================================
function createFakeRenderer() {
	const shaderProgram = {
		getAttributeLocation(attributeName) { return ["vertexPosition", "vertexNormal", "vertexTextureCoordinate", "vertexJoints", "vertexWeights"].indexOf(attributeName); },
		getUniformLocation() { return null; },
	};
	return { getShaderProgram() { return shaderProgram; } };
}

//==============================================================================
// 시험 GLB. (삼각형 하나, 인덱스, 머티리얼 하나, 모프 타깃 하나, 클립 하나)
//==============================================================================
function buildTestGlb() {
	const floatValues = [
		0, 0, 0, 1, 0, 0, 0, 1, 0,          // 위치 (36 바이트)
		0, 0, 1, 0, 0, 1, 0, 0, 1,          // 모프 위치 델타 (36 바이트)
		0, 1,                               // 클립 시간 (8 바이트)
		0, 0, 0, 0, 2, 0,                   // 클립 이동 (24 바이트)
	];
	const floatBytes = new Uint8Array(new Float32Array(floatValues).buffer);
	const indexBytes = new Uint8Array(new Uint16Array([0, 1, 2, 0]).buffer); // 넷째는 4 바이트 맞춤
	const binaryBytes = new Uint8Array(floatBytes.length + indexBytes.length);
	binaryBytes.set(floatBytes, 0);
	binaryBytes.set(indexBytes, floatBytes.length);
	const json = {
		asset: { version: "2.0" },
		scenes: [{ nodes: [0] }],
		nodes: [{ name: "Triangle", mesh: 0 }],
		meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 4, material: 0, targets: [{ POSITION: 1 }] }], extras: { targetNames: ["Lift"] } }],
		materials: [{ name: "Body", pbrMetallicRoughness: { baseColorFactor: [0.25, 0.5, 0.75, 1] } }],
		accessors: [
			{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
			{ bufferView: 1, componentType: 5126, count: 3, type: "VEC3" },
			{ bufferView: 2, componentType: 5126, count: 2, type: "SCALAR" },
			{ bufferView: 3, componentType: 5126, count: 2, type: "VEC3" },
			{ bufferView: 4, componentType: 5123, count: 3, type: "SCALAR" },
		],
		bufferViews: [
			{ buffer: 0, byteOffset: 0, byteLength: 36 },
			{ buffer: 0, byteOffset: 36, byteLength: 36 },
			{ buffer: 0, byteOffset: 72, byteLength: 8 },
			{ buffer: 0, byteOffset: 80, byteLength: 24 },
			{ buffer: 0, byteOffset: 104, byteLength: 6 },
		],
		buffers: [{ byteLength: binaryBytes.length }],
		animations: [{ name: "Rise", samplers: [{ input: 2, output: 3 }], channels: [{ sampler: 0, target: { node: 0, path: "translation" } }] }],
	};
	let jsonText = JSON.stringify(json);
	while (jsonText.length % 4 !== 0) {
		jsonText += " ";
	}
	const jsonBytes = new TextEncoder().encode(jsonText);
	const totalLength = 12 + 8 + jsonBytes.length + 8 + binaryBytes.length;
	const glbBytes = new Uint8Array(totalLength);
	const dataView = new DataView(glbBytes.buffer);
	dataView.setUint32(0, 0x46546c67, true);
	dataView.setUint32(4, 2, true);
	dataView.setUint32(8, totalLength, true);
	dataView.setUint32(12, jsonBytes.length, true);
	dataView.setUint32(16, 0x4e4f534a, true);
	glbBytes.set(jsonBytes, 20);
	const binaryHeaderOffset = 20 + jsonBytes.length;
	dataView.setUint32(binaryHeaderOffset, binaryBytes.length, true);
	dataView.setUint32(binaryHeaderOffset + 4, 0x004e4942, true);
	glbBytes.set(binaryBytes, binaryHeaderOffset + 8);
	return glbBytes.buffer;
}

// 받기 흉내. (부른 수를 센다)
const glbBuffer = buildTestGlb();
let fetchCount = 0;
globalThis.fetch = async (url) => {
	fetchCount++;
	return { ok: true, arrayBuffer: async () => glbBuffer.slice(0) };
};

const gl = createFakeGl();
const renderer = createFakeRenderer();

// 1. 같은 자산을 다르게 적어 두 번(하나는 함께) 받으면 받기, 올리기 한 번.
const [firstModel, secondModel] = await Promise.all([
	SkinnedModel.loadFromUrl(gl, "models/../models/triangle.glb", renderer),
	SkinnedModel.loadFromUrl(gl, "./models/triangle.glb", renderer),
]);
const thirdModel = await SkinnedModel.loadFromUrl(gl, "models\\triangle.glb", renderer);
const asset = firstModel.getAsset();
check(fetchCount === 1, "받기 한 번: " + fetchCount);
check(asset === secondModel.getAsset() && asset === thirdModel.getAsset(), "자산 하나");
check(asset.getKey() === "models/triangle.glb", "정규화한 키: " + asset.getKey());
check(asset.getReferenceCount() === 3, "참조 수 3");
check(SkinnedModelAsset.getCachedCount() === 1, "캐시 하나");
check(gl.liveTable.vertexArray.size === 1, "버텍스 어레이 하나: " + gl.liveTable.vertexArray.size);
// 삼각형에 노멀이 없어 glTF 2.0 명세대로 평평한 노멀로 풀고 번호 없이 그린다. (인덱스 버퍼 없음)
check(gl.liveTable.buffer.size === 4, "버퍼 넷(위치, 노멀, 조인트, 가중치): " + gl.liveTable.buffer.size);
// 머티리얼 둘(Body, 기본) x 슬롯 8 + 모프 텍스처 1
check(gl.liveTable.texture.size === 17, "텍스처 17: " + gl.liveTable.texture.size);
const uploadBufferDataCount = gl.callTable.bufferData;
const uploadTexImageCount = gl.callTable.texImage2D;
check(uploadBufferDataCount === 4 && uploadTexImageCount === 17, "올리기 한 벌: " + uploadBufferDataCount + ", " + uploadTexImageCount);
// 위치 36 + 노멀 36 + 조인트 24 + 가중치 48 + 모프 텍스처 3 x 2 x 16 + 머티리얼 텍스처 16 x 4 (번호 없이 그려 인덱스 버퍼 없음)
const expectedGpuByteCount = 36 + 36 + 24 + 48 + 3 * 2 * 16 + 16 * 4;
check(asset.getGpuByteCount() === expectedGpuByteCount, "GPU 바이트: " + asset.getGpuByteCount() + " != " + expectedGpuByteCount);

// 인스턴스는 포즈와 재생 상태가 따로다. (첫 클립을 돌리고 한 쪽만 움직인다)
firstModel.update(0.5);
check(firstModel.getNodeList()[0].currentTranslation[1] === 1, "첫 모델은 움직임");
check(secondModel.getNodeList()[0].currentTranslation[1] === 0, "둘째 모델은 그대로");
check(firstModel.getAnimationList() === secondModel.getAnimationList(), "클립 목록 나눠 씀");

// 2. 머티리얼 갈라짐. (텍스처는 새로 짓지 않고 값만 따로)
const sharedMaterial = secondModel.getSharedMaterial(0);
check(sharedMaterial === asset.getMaterialList()[0], "낀 머티리얼은 자산 원형");
const instanceMaterial = secondModel.getMaterial(0);
check(instanceMaterial !== sharedMaterial && secondModel.getMaterial(0) === instanceMaterial, "한 번만 갈라짐");
instanceMaterial.setBaseColorFactor([1, 0, 0]);
check(sharedMaterial.getBaseColorFactor().join(",") === "0.25,0.5,0.75", "원형 값 그대로");
check(firstModel.getSharedMaterial(0) === sharedMaterial, "다른 인스턴스는 원형");
check(gl.liveTable.texture.size === 17 && gl.callTable.texImage2D === uploadTexImageCount, "갈라져도 텍스처 그대로");
check(instanceMaterial.getTextureBindings()[0][2] === sharedMaterial.getTextureBindings()[0][2], "텍스처 빌려 씀");

// 3. 모프 타깃 갈라짐. (더한 인스턴스만 제 텍스처를 짓는다)
const sharedMorphTexture = thirdModel.getDrawableList()[0].morphTexture;
thirdModel.addMorphTarget(0, "Push", new Float32Array(9));
thirdModel.update(0);
const ownMorphTexture = thirdModel.getDrawableList()[0].morphTexture;
check(ownMorphTexture !== sharedMorphTexture && gl.liveTable.texture.size === 18, "모프 텍스처 갈라짐");
check(firstModel.getDrawableList()[0].morphTargetList.length === 1 && thirdModel.getDrawableList()[0].morphTargetList.length === 2, "타깃 목록 갈라짐");

// 4. 해제 차례. (마지막 인스턴스가 지울 때까지 자산 자원은 남는다)
thirdModel.destroy();
check(gl.liveTable.texture.size === 17 && asset.getReferenceCount() === 2, "셋째 해제: 제 모프 텍스처만");
firstModel.destroy();
check(gl.liveTable.vertexArray.size === 1 && gl.liveTable.buffer.size === 4 && gl.liveTable.texture.size === 17, "첫째 해제: 자산 그대로");
check(asset.getReferenceCount() === 1 && !asset.isDestroyed(), "참조 수 1");
// 남은 인스턴스로 새 인스턴스를 지어도 올리지 않는다.
const fourthModel = secondModel.createInstance();
check(asset.getReferenceCount() === 2 && gl.callTable.bufferData === uploadBufferDataCount, "createInstance 는 올리지 않음");
fourthModel.destroy();
secondModel.destroy();
check(asset.isDestroyed() && asset.getReferenceCount() === 0, "마지막 해제: 자산 지움");
check(gl.liveTable.vertexArray.size === 0 && gl.liveTable.buffer.size === 0 && gl.liveTable.texture.size === 0, "GL 객체 모두 지움: " + gl.liveTable.vertexArray.size + ", " + gl.liveTable.buffer.size + ", " + gl.liveTable.texture.size);
check(SkinnedModelAsset.getCachedCount() === 0 && asset.getKey() === null, "캐시에서 빠짐");
let isCreateFailed = false;
try {
	SkinnedModel.createFromAsset(asset);
}
catch (error) {
	isCreateFailed = true;
}
check(isCreateFailed, "지워진 자산으로는 못 지음");

// 5. 다 지운 뒤 다시 받으면 새로 받고 올린다. 캐시를 비우면 다음 받기는 새 자산, 쓰던 인스턴스는 그대로.
const reloadedModel = await SkinnedModel.loadFromUrl(gl, "models/triangle.glb", renderer);
check(fetchCount === 2 && reloadedModel.getAsset() !== asset, "다시 받기");
SkinnedModelAsset.clearCache();
check(SkinnedModelAsset.getCachedCount() === 0 && reloadedModel.getAsset().getKey() === null, "캐시 비움");
const freshModel = await SkinnedModel.loadFromUrl(gl, "models/triangle.glb", renderer);
check(fetchCount === 3 && freshModel.getAsset() !== reloadedModel.getAsset(), "비운 뒤 새 자산");
check(!reloadedModel.getAsset().isDestroyed(), "비워도 쓰던 자산은 살아 있음");
reloadedModel.destroy();
freshModel.destroy();
check(gl.liveTable.vertexArray.size === 0 && gl.liveTable.buffer.size === 0 && gl.liveTable.texture.size === 0, "모두 지움");

// 6. 이름으로 넣고 찾기. (바이트로 지은 모델)
const bytesModel = await SkinnedModel.loadFromBytes(gl, glbBuffer.slice(0), renderer);
check(bytesModel.getAsset().getKey() === null, "바이트로 지은 모델은 캐시 밖");
SkinnedModelAsset.register("Triangle", bytesModel.getAsset());
const foundAsset = SkinnedModelAsset.find("./Triangle", renderer.getShaderProgram());
check(foundAsset === bytesModel.getAsset(), "이름으로 찾기");
check(SkinnedModelAsset.find("Triangle", {}) === null, "다른 셰이더는 따로");
bytesModel.destroy();
check(SkinnedModelAsset.find("Triangle", renderer.getShaderProgram()) === null, "해제하면 빠짐");

// 7. 키 정규화.
check(SkinnedModelAsset.normalizeKey("./a/b/../c.glb") === "a/c.glb", "키 1");
check(SkinnedModelAsset.normalizeKey("a\\\\b//c.glb") === "a/b/c.glb", "키 2");
check(SkinnedModelAsset.normalizeKey("/a/./b.glb") === "/a/b.glb", "키 3");
check(SkinnedModelAsset.normalizeKey("../a.glb") === "../a.glb", "키 4");
check(SkinnedModelAsset.normalizeKey("https://example.com/a/./b/../c.glb?v=1#x") === "https://example.com/a/c.glb?v=1#x", "키 5");

console.log("skinnedmodelasset 시험 " + checkCount + " 개 통과");
