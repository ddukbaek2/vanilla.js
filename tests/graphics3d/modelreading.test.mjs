//==============================================================================
// 예제 FBX, glb 읽기 결과 요약값 시험. (node tests/graphics3d/modelreading.test.mjs)
// - 러스트 판 짝: src/graphics3d/fbxloader.rs 의 mannequin_fbx_materials_from_examples, walk_fbx_from_examples,
//   src/graphics3d/skinnedmodel.rs 의 fox_glb_from_examples.
// - 파일은 examples/ancientmountain/assets 의 mannequin.fbx, anims/walk.fbx, fox.glb. (러스트 판도 이 자리를 읽는다)
// - GL 없이 SkinnedModel.createWithoutShaderProgram 으로 해석과 update 만 쓴다. (텍스처 PNG 풀기는 브라우저 일이라 머리 글만 본다)
//==============================================================================
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { FbxLoader } from "../../src/graphics3d/fbxloader.js";
import { SkinnedModel } from "../../src/graphics3d/skinnedmodel.js";
import { check, checkEqual, checkJson, checkNear, finish } from "../testcheck.mjs";

const repositoryPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const exampleAssetPath = path.join(repositoryPath, "examples/ancientmountain/assets");

function readArrayBuffer(filePath) {
	const fileBuffer = fs.readFileSync(filePath);
	return fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
}

// 예제 마네킹: 재질 M_Main, M_Joints 둘, 재질마다 삼각형 수.
{
	const sceneData = await new FbxLoader().parse(readArrayBuffer(path.join(exampleAssetPath, "mannequin.fbx")));
	const skinnedModel = SkinnedModel.createWithoutShaderProgram();
	const { meshDescriptionList, materialDescriptionList } = skinnedModel.interpretFbxContent(sceneData);
	checkEqual(materialDescriptionList.length, 2, "마네킹 재질 수");
	checkJson(meshDescriptionList.map((meshDescription) => [meshDescription.materialName, meshDescription.positions.length / 9]), [["M_Main", 5732], ["M_Joints", 8012]], "마네킹 재질마다 삼각형 수");
}

// 걷기 FBX: 7.4 형식, 최상위 노드, 본 계층, 걷기 스택, 이름 매칭으로 붙인 이동 없는 클립.
{
	const walkArrayBuffer = readArrayBuffer(path.join(exampleAssetPath, "anims/walk.fbx"));
	checkEqual(FbxLoader.readVersion(walkArrayBuffer), 7400, "walk.fbx 판");
	const topNodeList = await new FbxLoader().parseNodeRecords(walkArrayBuffer);
	const topNodeNameList = topNodeList.map((node) => node.name);
	for (const topNodeName of ["FBXHeaderExtension", "Objects", "Connections"]) {
		check(topNodeNameList.includes(topNodeName), "최상위 노드 " + topNodeName);
	}
	const sceneData = await new FbxLoader().interpret(topNodeList);
	const hipsIndex = sceneData.nodeList.findIndex((node) => node.name === "pelvis");
	check(hipsIndex >= 0, "pelvis 노드");
	checkEqual(sceneData.nodeList[hipsIndex].isBone, true, "pelvis 는 본");
	check(sceneData.animationList.length > 0, "애니메이션 있음");
	const walkAnimation = sceneData.animationList.reduce((best, animation) => animation.channels.length > best.channels.length ? animation : best);
	check(walkAnimation.channels.length > 10, "걷기 채널 수 " + walkAnimation.channels.length);
	check(walkAnimation.duration > 0.5 && walkAnimation.duration < 10, "걷기 길이 " + walkAnimation.duration);
	check(walkAnimation.channels.some((channel) => channel.nodeIndex === hipsIndex && channel.path === "translation"), "pelvis 이동 채널");
	const skinnedModel = SkinnedModel.createWithoutShaderProgram();
	skinnedModel.interpretFbxContent(sceneData);
	const originalAnimationCount = skinnedModel.getAnimationList().length;
	skinnedModel.addAnimationsFromFbxSceneData(sceneData, "WalkInPlace", true);
	const animationList = skinnedModel.getAnimationList();
	check(animationList.length > originalAnimationCount, "클립 붙임");
	const addedClip = animationList[animationList.length - 1];
	checkEqual(addedClip.name, "WalkInPlace", "붙인 클립 이름");
	check(addedClip.channels.every((channel) => channel.path !== "translation"), "붙인 클립에 이동 없음");
	skinnedModel.playAnimation("WalkInPlace", 0);
	skinnedModel.update(0.4);
	check(Array.from(skinnedModel.getNodeList()[hipsIndex].worldMatrix.getElements()).every((value) => Number.isFinite(value)), "pelvis 전역 행렬 유한");
}

// 여우 glb: 조인트 24, 클립 Survey/Walk/Run, 노멀과 인덱스 없음, PNG 텍스처, 걷기 중간 조인트 행렬은 바인드 포즈와 다르다.
{
	const { json, binaryBuffer } = SkinnedModel.readGlbChunks(readArrayBuffer(path.join(exampleAssetPath, "fox.glb")));
	const skinnedModel = SkinnedModel.createWithoutShaderProgram();
	const { meshDescriptionList, materialDescriptionList } = skinnedModel.interpretContent(json, binaryBuffer);
	checkJson(skinnedModel.getAnimationNameList(), ["Survey", "Walk", "Run"], "여우 클립 이름");
	checkEqual(skinnedModel.getSkinList()[0].jointNodeIndices.length, 24, "여우 조인트 수");
	checkEqual(meshDescriptionList.length, 1, "여우 메시 수");
	const foxMesh = meshDescriptionList[0];
	check(!foxMesh.normals && !foxMesh.indices, "여우 노멀과 인덱스 없음");
	checkEqual(foxMesh.positions.length / 3, foxMesh.weights.length / 4, "정점 수와 가중치 수");
	const normals = skinnedModel.generateSmoothNormals(foxMesh.positions, null);
	checkNear(Math.hypot(normals[0], normals[1], normals[2]), 1, 1e-4, "부드러운 노멀 길이");
	const baseColorImage = materialDescriptionList[0].baseColorImage;
	checkEqual(baseColorImage.mimeType, "image/png", "여우 텍스처 형식");
	checkJson(Array.from(new Uint8Array(baseColorImage.bytes.buffer || baseColorImage.bytes, baseColorImage.bytes.byteOffset || 0, 8)), [137, 80, 78, 71, 13, 10, 26, 10], "여우 텍스처 PNG 머리");
	skinnedModel.playAnimation("Walk", 0);
	skinnedModel.update(0);
	const restMatrixArray = Array.from(skinnedModel.getSkinList()[0].jointMatrixArray);
	skinnedModel.update(0.3);
	const walkMatrixArray = Array.from(skinnedModel.getSkinList()[0].jointMatrixArray);
	check(walkMatrixArray.every((value) => Number.isFinite(value)), "걷기 조인트 행렬 유한");
	check(restMatrixArray.some((restValue, index) => Math.abs(restValue - walkMatrixArray[index]) > 1e-3), "걷기 조인트 행렬은 바인드 포즈와 다름");
}

finish("tests/graphics3d/modelreading.test.mjs");
