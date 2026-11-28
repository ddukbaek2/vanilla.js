//==============================================================================
// 툰 GLB 접근자 읽기 범위 시험. (node tests/graphics3d/glbaccessorrange.test.mjs)
// - 버퍼 밖을 읽는 접근자(시작이 밖, 끝이 덩어리를 넘음)는 빈 모형이 아니라 분명한 오류를 던진다. (러스트 판 tests/glbquantization.rs toon_reader_rejects_accessor_outside_binary_chunk 와 같은 뜻)
// - bufferView 가 없는 접근자는 glTF 명세대로 0 으로 채운 값이다.
//==============================================================================
import { readGlbArrays } from "../../src/graphics3d/toon/glbmeshreader.js";
import { check, checkEqual, finish } from "../testcheck.mjs";

const POSITIONS = [[0.1, -0.3, 0.5], [1.2, 0.4, -0.2], [-0.7, 0.9, 0.3], [0.5, 0.5, 1.1]];
const INDICES = [0, 1, 2, 0, 2, 3];

//==============================================================================
// GLB 짓기. (위치 네 개와 색인 여섯 개, 접근자를 고칠 수 있다)
//==============================================================================
function createGlb(changeAccessors) {
	const positionBytes = new Uint8Array(new Float32Array(POSITIONS.flat()).buffer);
	const indexBytes = new Uint8Array(new Uint16Array(INDICES).buffer);
	const binaryBytes = new Uint8Array(positionBytes.length + 12);
	binaryBytes.set(positionBytes, 0);
	binaryBytes.set(indexBytes, positionBytes.length);
	const json = {
		asset: { version: "2.0" },
		scene: 0,
		scenes: [{ nodes: [0] }],
		nodes: [{ name: "hull", mesh: 0 }],
		meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
		accessors: [
			{ bufferView: 0, componentType: 5126, count: 4, type: "VEC3" },
			{ bufferView: 1, componentType: 5123, count: 6, type: "SCALAR" },
		],
		bufferViews: [
			{ buffer: 0, byteOffset: 0, byteLength: positionBytes.length },
			{ buffer: 0, byteOffset: positionBytes.length, byteLength: 12 },
		],
		buffers: [{ byteLength: binaryBytes.length }],
	};
	changeAccessors(json);
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
// 던진 오류의 글. (안 던지면 null)
//==============================================================================
function readErrorMessage(arrayBuffer) {
	try {
		readGlbArrays(arrayBuffer);
	}
	catch (error) {
		return error.message;
	}
	return null;
}

const insideMessage = readErrorMessage(createGlb(() => {}));
check(insideMessage === null, "범위 안의 접근자는 오류 없이 읽어야 한다. " + insideMessage);

const offsetMessage = readErrorMessage(createGlb((json) => {
	json.accessors[0].byteOffset = 100000;
}));
checkEqual(offsetMessage, "GLB 접근자 0 가 바이너리 덩어리 밖을 읽습니다. (바이트 100000 ~ 100048, 바이너리 덩어리 60 바이트)", "시작이 덩어리 밖인 접근자는 분명한 오류");

const overMessage = readErrorMessage(createGlb((json) => {
	json.accessors[0].count = 6;
}));
checkEqual(overMessage, "GLB 접근자 0 가 바이너리 덩어리 밖을 읽습니다. (바이트 0 ~ 72, 바이너리 덩어리 60 바이트)", "끝이 덩어리를 넘는 접근자는 분명한 오류");

const missingMessage = readErrorMessage(createGlb((json) => {
	delete json.accessors[0].bufferView;
}));
check(missingMessage === null, "bufferView 가 없는 접근자는 오류 없이 0 으로 읽어야 한다. " + missingMessage);
const zeroArrays = readGlbArrays(createGlb((json) => {
	delete json.accessors[0].bufferView;
}));
check(zeroArrays.vertexData.length > 0, "bufferView 없는 위치도 꼭짓점이 나와야 한다.");
for (let index = 0; index < 3; ++index) {
	checkEqual(zeroArrays.vertexData[index], 0, "bufferView 없는 위치는 0 으로 채움 " + index);
}

finish("glbaccessorrange");
