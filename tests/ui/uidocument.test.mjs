//==============================================================================
// UIDocument 저장과 읽기 시험. (node tests/ui/uidocument.test.mjs)
// - 러스트 판 짝: src/ui/uidocument.rs 의 editor_scene_round_trip_is_same_text, widget_scene_round_trip_is_same_text,
//   shadow_text_round_trip_keeps_reflected_keys, reflected_components_match_original_defaults, editor_document_types_round_trip,
//   invalid_document_is_error, node_path_round_trip, editor_components_match_original, editor_node_types_match_original,
//   editor_palette_matches_original, inspector_getters_match_original, reflected_properties_match_original.
// - testdata/uidocument 는 러스트 판 src/ui/testdata/uidocument 와 같은 자료다. (두 저장소에 같은 글로 둔다)
//   *.json 가운데 editor_*, inspector_getters, reflected_properties 는 generate.mjs 가 원본을 돌려 쓴 것이고,
//   나머지(editor_scene 같은)는 러스트 판 시험 안의 글(원본 toJsonText 가 낸 글)을 옮긴 것이다.
// - generate.mjs 를 지금 원본으로 다시 돌려 testdata 와 글자까지 같은지 본다. (원본이 바뀌면 여기서 먼저 걸린다)
//==============================================================================
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import * as Engine from "../../import.js";
import { check, checkEqual, finish } from "../testcheck.mjs";

const { UIDocument, WorldNode, Paint, Text, Sprite, ShadowText, UIProgressRing, UISlider, UIScrollView, Mask, UIButton, SoftShade } = Engine;
const repositoryPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const testdataPath = path.join(repositoryPath, "tests/ui/testdata/uidocument");
// 시험 문서. (엔진 기본 종류를 등록한 새 문서, 에디터 종류는 아래에서 등록한다)
const uiDocument = new UIDocument();

function readTestdata(name) {
	return fs.readFileSync(path.join(testdataPath, name + ".json"), "utf8");
}

// 두 문서 값이 같은지. (러스트 판 assert_same_document_value 와 같은 판정, 수는 f32 로 맞춰 비교)
function checkSameDocumentValue(leftValue, rightValue, valuePath) {
	if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
		checkEqual(leftValue.length, rightValue.length, "배열 길이가 다르다: " + valuePath);
		for (let itemIndex = 0; itemIndex < leftValue.length; itemIndex++) {
			checkSameDocumentValue(leftValue[itemIndex], rightValue[itemIndex], valuePath + "[" + itemIndex + "]");
		}
		return;
	}
	if (leftValue !== null && rightValue !== null && typeof leftValue === "object" && typeof rightValue === "object") {
		checkEqual(Object.keys(leftValue).join(","), Object.keys(rightValue).join(","), "키가 다르다: " + valuePath);
		for (const key of Object.keys(leftValue)) {
			checkSameDocumentValue(leftValue[key], rightValue[key], valuePath + "/" + key);
		}
		return;
	}
	if (typeof leftValue === "number" && typeof rightValue === "number") {
		checkEqual(Math.fround(leftValue), Math.fround(rightValue), "수가 다르다: " + valuePath);
		return;
	}
	checkEqual(leftValue, rightValue, "값이 다르다: " + valuePath);
}

// generate.mjs 를 지금 원본으로 다시 돌려 testdata 와 글자까지 같은지.
const generatedPath = fs.mkdtempSync(path.join(os.tmpdir(), "uidocument-"));
const generateResult = spawnSync(process.execPath, [path.join(testdataPath, "generate.mjs"), repositoryPath, generatedPath], { encoding: "utf8" });
check(generateResult.status === 0, "generate.mjs: " + generateResult.stdout.slice(-300) + generateResult.stderr.slice(-300));
for (const name of ["editor_components", "editor_node_types", "editor_palette", "editor_palette_before_tick", "inspector_getters", "reflected_properties"]) {
	const generatedText = fs.readFileSync(path.join(generatedPath, name + ".json"), "utf8");
	check(generatedText === readTestdata(name), name + ".json 이 원본을 다시 돌린 값과 다르다");
}
fs.rmSync(generatedPath, { recursive: true, force: true });

// 에디터 처음 씬: frameSize 를 더해 읽어도 다시 쓰면 같은 글. (예쁘게 쓰기)
const editorSceneText = readTestdata("editor_scene");
const editorSceneData = JSON.parse(editorSceneText);
editorSceneData.frameSize = [1280, 720];
const editorRootNode = uiDocument.fromJsonText(JSON.stringify(editorSceneData));
checkEqual(uiDocument.toJsonText(editorRootNode, true), editorSceneText, "에디터 씬 왕복 글");
const panelNode = editorRootNode.findChildByName("Panel");
checkEqual(panelNode.getComponent(Paint).getRoundSize(), 24, "Panel 둥근 크기");
checkEqual(panelNode.findChildByName("Title").getComponent(Text).getText(), "vanilla.js", "Title 글");
const emblemNode = panelNode.findChildByName("emblem");
checkEqual(emblemNode.getComponent(Sprite).getImagePath(), "emblem.png", "emblem 그림 경로 (UIDocument 가 imagePath 칸을 setImagePath 로 넣는다, 러스트 판 get_image_path)");
checkEqual(emblemNode.getLocalRotation(), 15, "emblem 회전");
checkEqual(emblemNode.getAnchor().x + "," + emblemNode.getAnchor().y, "0,1", "emblem 앵커");

// 위젯 씬: 다시 쓰면 같은 글, 노드 참조와 내용 자식.
const widgetSceneText = readTestdata("widget_scene");
const widgetRootNode = uiDocument.fromJsonText(widgetSceneText);
checkEqual(uiDocument.toJsonText(widgetRootNode, false), widgetSceneText, "위젯 씬 왕복 글");
const sliderNode = widgetRootNode.findChildByName("slider");
checkEqual(sliderNode.getComponent(UISlider).getThumbNode(), sliderNode.findChildByName("thumb"), "슬라이더 손잡이 노드 참조");
const scrollNode = widgetRootNode.findChildByName("scroll");
check(scrollNode.getComponent(Mask) !== null && scrollNode.getComponent(Mask) !== undefined, "스크롤 마스크");
check(scrollNode.getComponent(UIScrollView).getContent().findChildByName("item"), "스크롤 내용 자식");
const buttonNode = widgetRootNode.findChildByName("button");
check(buttonNode.getComponent(UIButton).getContent().findChildByName("caption"), "버튼 내용 자식");
const ringNode = widgetRootNode.findChildByName("ring");
checkEqual(ringNode.isActive(), false, "ring 꺼짐");
checkEqual(ringNode.getComponent(UIProgressRing).getRatio(), 0.25, "ring 비율");
checkEqual(widgetRootNode.findChildByName("shade").getComponent(SoftShade).isEnable(), false, "shade 꺼짐");

// 그림자 글: 반사 키를 지킨다.
const shadowTextSceneText = readTestdata("shadow_text_scene");
const shadowRootNode = uiDocument.fromJsonText(shadowTextSceneText);
checkEqual(uiDocument.toJsonText(shadowRootNode, false), shadowTextSceneText, "그림자 글 씬 왕복 글");
const shadowText = shadowRootNode.findChildByName("shadowText").getComponent(ShadowText);
checkEqual(shadowText.getTextDirection(), "rtl", "그림자 글 방향");
checkEqual(shadowText.isItalic(), true, "그림자 글 기울임");
checkEqual(shadowText.isStrikethrough(), true, "그림자 글 취소선");
const createdNode = new WorldNode();
check(uiDocument.createComponent(createdNode, "UIProgressRing") === createdNode.getComponent(UIProgressRing), "이름으로 컴포넌트 붙이기");
checkEqual(uiDocument.createComponent(createdNode, "Unknown"), null, "모르는 컴포넌트 종류");
checkEqual(uiDocument.getNodeTypeName(createdNode), "WorldNode", "노드 종류 이름");

// 문서마다 따로인 상태. (등록 표와 그림 해석기는 그 문서에만, 러스트 판 UIDocument::new 처럼 전역 상태가 없다)
const otherDocument = new UIDocument();
otherDocument.registerComponentType("RenamedRing", UIProgressRing);
check(otherDocument.getComponentTypeNames().includes("RenamedRing"), "등록한 문서에는 그 이름");
check(!uiDocument.getComponentTypeNames().includes("RenamedRing"), "다른 문서에는 그 이름이 없다");
// node 에는 그릴 수 있는 그림이 없어 Sprite 는 가짜 그림을 받지 않는다. 해석기가 읽을 때 불렸는지로 본다.
const resolvedImage = { width: 1, height: 1 };
const resolvedPathList = [];
otherDocument.setImageResolver((imagePath) => {
	resolvedPathList.push(imagePath);
	return imagePath === "star.png" ? resolvedImage : null;
});
checkEqual(otherDocument.resolveImage("star.png"), resolvedImage, "해석기로 그림 찾기");
checkEqual(otherDocument.resolveImage("missing.png"), null, "해석기가 null 이면 못 찾음");
checkEqual(uiDocument.resolveImage("star.png"), null, "해석기 없는 문서는 못 찾음");
const imageDocumentText = "{\"version\":1,\"root\":{\"name\":\"star\",\"components\":[{\"imagePath\":\"star.png\",\"type\":\"Sprite\"}]}}";
resolvedPathList.length = 0;
const starNode = otherDocument.fromJsonText(imageDocumentText);
checkEqual(resolvedPathList.join(","), "star.png", "읽을 때 해석기로 그림을 찾는다");
checkEqual(starNode.getComponent(Sprite).getImagePath(), "star.png", "그림 경로");
checkEqual(otherDocument.bindPendingImages(), 0, "맡아 둔 그림 없음");
checkEqual(uiDocument.loadImages("not json").length, 0, "JSON 이 아니면 그림 요청 없음");

// 반사 컴포넌트 기본값. (러스트 판은 ShadowImage 앞에 imagePath 를 더 적는다)
const defaultsNode = new WorldNode();
defaultsNode.setName("root");
for (const componentType of [Engine.Outline, SoftShade, ShadowText, UIProgressRing, Engine.ShadowImage]) {
	defaultsNode.addComponent(componentType);
}
const expectedDefaultList = JSON.parse(readTestdata("reflected_defaults"));
expectedDefaultList[4] = { imagePath: "", ...expectedDefaultList[4] };
checkSameDocumentValue(uiDocument.serializeNode(defaultsNode).components, expectedDefaultList, "반사 기본값");

// 에디터 문서 종류 왕복. (노드 종류를 등록하고 읽어 다시 쓰면 같은 값)
uiDocument.registerEditorTypes();
for (const name of ["editor_types_scene", "editor_types_custom_scene"]) {
	const documentText = readTestdata(name);
	const documentRootNode = uiDocument.fromJsonText(documentText);
	checkSameDocumentValue(JSON.parse(uiDocument.toJsonText(documentRootNode, false)), JSON.parse(documentText), name);
}

// 틀린 문서는 오류.
for (const invalidText of ["{\"version\":1}", "not json"]) {
	let isError = false;
	try {
		const invalidRootNode = uiDocument.fromJsonText(invalidText);
		isError = invalidRootNode === null || invalidRootNode === undefined;
	}
	catch (error) {
		isError = true;
	}
	check(isError, "틀린 문서는 오류: " + invalidText);
}

// 노드 경로 왕복.
const pathRootNode = new WorldNode();
pathRootNode.setName("root");
const pathPanelNode = new WorldNode();
pathPanelNode.setName("panel");
const pathButtonNode = new WorldNode();
pathButtonNode.setName("button");
const outsideNode = new WorldNode();
outsideNode.setName("outside");
pathRootNode.addChild(pathPanelNode);
pathPanelNode.addChild(pathButtonNode);
checkEqual(UIDocument.findNodePath(pathRootNode, pathButtonNode), "/panel/button", "findNodePath");
checkEqual(UIDocument.findNodePath(pathRootNode, pathRootNode), "/", "뿌리 findNodePath");
check(UIDocument.findNodePath(pathRootNode, outsideNode) === null || UIDocument.findNodePath(pathRootNode, outsideNode) === undefined, "밖 노드 findNodePath");
checkEqual(UIDocument.findNodeByPath(pathRootNode, "/panel/button"), pathButtonNode, "findNodeByPath");
checkEqual(UIDocument.findNodeByPath(pathRootNode, "/"), pathRootNode, "뿌리 findNodeByPath");
check(UIDocument.findNodeByPath(pathRootNode, "/panel/missing") === null || UIDocument.findNodeByPath(pathRootNode, "/panel/missing") === undefined, "없는 경로 findNodeByPath");

finish("tests/ui/uidocument.test.mjs");
