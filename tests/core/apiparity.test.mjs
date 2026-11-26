//==============================================================================
// 두 엔진 공개 API 짝 시험. (node tests/core/apiparity.test.mjs)
// - 러스트 판에만 있던 공개 함수와 동작을 원본에 둔 것이 러스트 판과 같은 값을 내는지 본다.
// - 러스트 판 짝: src/base/color.rs 의 From<&str>, src/core/node/nodetree.rs 의 active_and_visible_in_hierarchy 와 convert_node_position_to_view_position,
//   src/ui/uiview.rs 의 is_view_position_inside_node 예제, src/ui/uidropdown.rs 의 get_option_nodes, src/ui/uidialog.rs 의 get_confirm_node,
//   src/core/component/sprite.rs 의 get_image_path, lib.rs 의 GameScene 맨 위 내보내기.
// - 크롬이 있어야 하는 것(UIScene 세이프 에어리어, 개발자 도구, 씬 배경, 뷰 스케일 모드, ToonVfx)은 tests/ui/sceneparitychrome.test.mjs 에서 본다.
//==============================================================================
import * as Vanilla from "../../import.js";
import { check, checkEqual, checkJson, checkNear, finish } from "../testcheck.mjs";

const { Color, Paint, Outline, UIView, UISlider, WorldNode, Vector2, Sprite, ShadowImage, UIImageView, UIDropdown, UIDialog, UIDocument, isViewPositionInsideNode, GameScene, Scene, UIScene } = Vanilla;

// GameScene 도 맨 위에서 나간다. (러스트 판 vanilla::GameScene)
{
	checkEqual(typeof GameScene, "function", "GameScene 내보내기");
	check(new GameScene() instanceof Scene, "GameScene 은 Scene");
}

// 색 인자: Color 와 색 글을 같은 자리에 받는다. (러스트 판 impl Into<Color>)
{
	const fromText = Color.from("#ff8000");
	checkEqual(fromText.toHEXString(), "#ff8000", "Color.from 색 글");
	const red = new Color(1, 0, 0, 1);
	checkEqual(Color.from(red), red, "Color.from Color 는 그대로");
	check(Color.from("#336699") !== Color.fromCache("#336699"), "Color.from 색 글은 공유 캐시가 아닌 새 색");
	checkEqual(Color.from("hsl(0, 0%, 0%)").toHEXString(), "#ffffff", "읽지 못하는 색 글은 흰색 (러스트 판 from_cache 와 같다)");

	const paint = new Paint();
	paint.setColor("#336699");
	checkEqual(paint.getColor().toHEXString(), "#336699", "Paint.setColor 색 글");
	paint.setColor("hsl(0, 0%, 0%)");
	checkEqual(paint.getColor().toHEXString(), "#ffffff", "Paint.setColor 읽지 못하는 색 글은 흰색");
	const outline = new Outline();
	outline.setColor("#102030");
	checkEqual(outline.getColor().toHEXString(), "#102030", "Outline.setColor 색 글");

	const view = new UIView();
	view.setBackgroundColor("#203040");
	checkEqual(view.getBackgroundColor().toHEXString(), "#203040", "UIView.setBackgroundColor 색 글 (전에는 clone 오류)");
	const slider = new UISlider();
	slider.setTrackColor("#112233");
	checkEqual(slider.getTrackColor().toHEXString(), "#112233", "UISlider.setTrackColor 색 글");

	const scene = new Scene();
	checkEqual(scene.getSceneBackgroundColor().toHEXString(), "#000000", "씬 배경 기본 검정");
	scene.setSceneBackgroundColor("#203040");
	checkEqual(scene.getSceneBackgroundColor().toHEXString(), "#203040", "Scene.setSceneBackgroundColor 색 글");
	const uiScene = new UIScene();
	uiScene.setSceneBackgroundColor(new Color(0, 1, 0, 1));
	checkEqual(uiScene.getSceneBackgroundColor().toHEXString(), "#00ff00", "UIScene 은 Scene 의 배경색을 쓴다");
	checkEqual(typeof uiScene.drawSceneBackground, "function", "drawSceneBackground");
}

// 보이기 플래그: 켜짐, 투명도와 따로. (러스트 판 active_and_visible_in_hierarchy 의 set_visible 대목)
{
	const rootNode = new WorldNode();
	const parentNode = new WorldNode();
	const childNode = new WorldNode();
	rootNode.addChild(parentNode);
	parentNode.addChild(childNode);
	checkEqual(childNode.isVisible(), true, "보이기 기본 참");
	parentNode.setLocalOpacity(0);
	checkEqual(parentNode.isVisible(), true, "isVisible 은 투명도를 보지 않는다 (플래그만)");
	checkEqual(childNode.isVisibleInHierarchy(), false, "부모 투명도 0 은 계층에서 안 보임");
	parentNode.setLocalOpacity(1);
	parentNode.setActive(false);
	checkEqual(parentNode.isVisible(), true, "isVisible 은 켜짐을 보지 않는다 (플래그만)");
	parentNode.setActive(true);
	childNode.setVisible(false);
	checkEqual(childNode.isVisible(), false, "setVisible(false)");
	checkEqual(childNode.isVisibleInHierarchy(), false, "숨긴 노드는 계층에서 안 보임");
	checkEqual(parentNode.isVisibleInHierarchy(), true, "숨긴 자식의 부모는 보임");
	checkEqual(childNode.isActiveInHierarchy(), true, "숨겨도 켜짐은 그대로");
}

// 노드 영역 안의 점과 뷰 좌표. (러스트 판 convert_node_position_to_view_position, convert_view_position_to_node_position)
{
	const rootNode = new WorldNode();
	const parentNode = new WorldNode();
	const childNode = new WorldNode();
	rootNode.addChild(parentNode);
	parentNode.addChild(childNode);
	parentNode.setLocalPosition(Vector2.create(100, 50));
	parentNode.setContentSize(Vector2.create(40, 20));
	parentNode.setLocalRotation(90);
	parentNode.setLocalScale(Vector2.create(2, 2));
	childNode.setContentSize(Vector2.create(10, 10));
	childNode.setLocalPosition(Vector2.create(30, 10));
	// 내용 영역 가운데(피봇)는 전역 위치와 같다.
	const center = childNode.convertNodePositionToViewPosition(Vector2.create(5, 5));
	const position = childNode.getPosition();
	checkNear([center.x, center.y], [position.x, position.y], 1e-6, "피봇 점의 뷰 자리는 getPosition");
	// 네 귀퉁이도 getWorldCorners 와 같다.
	const corners = childNode.getWorldCorners();
	const topLeft = childNode.convertNodePositionToViewPosition(Vector2.create(0, 0));
	const bottomRight = childNode.convertNodePositionToViewPosition(Vector2.create(10, 10));
	checkNear([topLeft.x, topLeft.y, bottomRight.x, bottomRight.y], [corners[0].x, corners[0].y, corners[2].x, corners[2].y], 1e-6, "귀퉁이의 뷰 자리는 getWorldCorners");
	const back = childNode.convertViewPositionToNodePosition(bottomRight);
	checkNear([back.x, back.y], [10, 10], 1e-6, "뷰 자리를 노드 자리로 되돌리기");
	const local = childNode.convertViewToLocal(bottomRight);
	checkNear([local.x, local.y], [back.x, back.y], 1e-6, "convertViewToLocal 과 같은 값");
	parentNode.setLocalScale(Vector2.create(0, 1));
	checkEqual(childNode.convertViewPositionToNodePosition(Vector2.create(0, 0)), null, "배율 0 이면 null (러스트 판 None)");
}

// 뷰 좌표의 점이 노드 안인지. (러스트 판 is_view_position_inside_node 예제와 같은 값)
{
	const rootNode = new WorldNode();
	const buttonNode = new WorldNode();
	rootNode.addChild(buttonNode);
	buttonNode.setLocalPosition(Vector2.create(100, 100));
	buttonNode.setContentSize(Vector2.create(40, 20));
	checkEqual(isViewPositionInsideNode(buttonNode, Vector2.create(100, 100)), true, "가운데는 안");
	checkEqual(isViewPositionInsideNode(buttonNode, Vector2.create(81, 91)), true, "귀퉁이 가까이는 안");
	checkEqual(isViewPositionInsideNode(buttonNode, Vector2.create(79, 100)), false, "왼쪽 밖");
	checkEqual(isViewPositionInsideNode(null, Vector2.create(100, 100)), false, "노드가 없으면 거짓");
}

// 펼침 목록과 대화 상자의 노드. (러스트 판 get_option_nodes, get_confirm_node 들)
{
	const dropdown = new UIDropdown({ width: 160 });
	dropdown.setOptionList(["낮음", "보통", "높음"]);
	const optionNodes = dropdown.getOptionNodes();
	checkEqual(optionNodes.length, 3, "선택지 행 셋");
	checkEqual(optionNodes[1].getName(), "DropdownOption1", "둘째 행 이름");
	checkJson(dropdown.getOptionList(), ["낮음", "보통", "높음"], "getOptionList");
	check(dropdown.getPopupNode() === optionNodes[0].getParent(), "행은 펼침 목록 노드 밑");
	dropdown.setOptionList(["하나"]);
	checkEqual(dropdown.getOptionNodes().length, 1, "setOptionList 마다 다시 만든다");

	const dialog = new UIDialog({ confirmText: "좋아요", cancelText: "아니요" });
	checkEqual(dialog.getConfirmNode().getName(), "DialogConfirm", "확인 단추 노드");
	checkEqual(dialog.getCancelNode().getName(), "DialogCancel", "취소 단추 노드");
	checkEqual(dialog.getPanelNode().getName(), "DialogPanel", "판 노드");
	check(dialog.getOverlayNode() instanceof WorldNode, "막 노드");
	checkEqual(dialog.getPopupMotion().isVisible(), false, "닫힌 연출");
}

// 그림 경로. (러스트 판 get_image_path, 그리기에는 쓰지 않고 UIDocument 가 적고 읽는다)
{
	for (const ComponentType of [Sprite, ShadowImage, UIImageView]) {
		const component = new ComponentType();
		checkEqual(component.getImagePath(), "", ComponentType.name + " 그림 경로 기본 빈 글");
		component.setImagePath("images/coin.png");
		checkEqual(component.getImagePath(), "images/coin.png", ComponentType.name + " setImagePath");
	}
	const documentData = {
		version: 1,
		root: { type: "WorldNode", name: "Root", contentSize: [128, 128], components: [{ type: "Sprite", imagePath: "images/coin.png" }], children: [] },
	};
	const rootNode = UIDocument.fromJsonText(JSON.stringify(documentData));
	checkEqual(rootNode.getComponent(Sprite).getImagePath(), "images/coin.png", "UIDocument 가 읽은 그림 경로");
	const savedText = UIDocument.toJsonText(rootNode);
	check(savedText.includes("\"imagePath\": \"images/coin.png\"") || savedText.includes("\"imagePath\":\"images/coin.png\""), "UIDocument 가 적은 그림 경로");
}

finish("두 엔진 공개 API 짝");
