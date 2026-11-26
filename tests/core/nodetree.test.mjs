//==============================================================================
// 노드 트리 시험. (node tests/core/nodetree.test.mjs)
// - 러스트 판 짝: src/core/node/nodetree.rs 의 original_hierarchy_functions, sibling_order, active_and_visible_in_hierarchy,
//   global_transform_round_trip, global_position_follows_parent_pivot, world_corners_and_bounds_match_original.
// - 러스트 판은 노드를 NodeTree 의 번호로 다루고 원본은 노드 객체로 다룬다. 같은 차례로 만들고 같은 값을 본다.
//   (없음은 러스트 판 None, 원본 null 또는 undefined, 자리 없음은 원본 -1)
//==============================================================================
import { WorldNode } from "../../src/core/node/worldnode.js";
import { Vector2 } from "../../src/base/vector2.js";
import { check, checkEqual, checkJson, checkNear, finish, knownDifference } from "../testcheck.mjs";

function isNothing(value) {
	return value === null || value === undefined;
}

function createNode(name) {
	const node = new WorldNode();
	node.setName(name);
	return node;
}

function createChild(parentNode, name) {
	const childNode = createNode(name);
	parentNode.addChild(childNode);
	return childNode;
}

function getNameList(nodeList) {
	return nodeList.map((node) => node.getName());
}

// 원본 Node 의 계층 함수: 부모 설정, 떼기(지우지 않음), 조건 찾기, 뿌리와 잎.
{
	const rootNode = createNode("root");
	const layerNode = createChild(rootNode, "layer");
	const firstNode = createChild(layerNode, "first");
	const secondNode = createChild(layerNode, "second");
	const deepNode = createChild(secondNode, "deep");
	checkEqual(rootNode.isRoot(), true, "isRoot");
	checkEqual(firstNode.isLeaf(), true, "isLeaf");
	checkEqual(secondNode.hasParent(), true, "hasParent");
	checkEqual(layerNode.getChild(1), secondNode, "getChild(1)");
	check(isNothing(layerNode.getChild(2)), "getChild(2) 는 없음");
	checkEqual(layerNode.hasChild(firstNode), true, "hasChild");
	checkEqual(layerNode.findChild((node) => node.getName().startsWith("sec")), secondNode, "findChild");
	checkEqual(rootNode.findChildRecursive((node) => node.getName() === "deep"), deepNode, "findChildRecursive");
	checkEqual(rootNode.findChildRecursiveByName("deep"), deepNode, "findChildRecursiveByName");
	layerNode.removeChild(firstNode);
	checkEqual(firstNode.isRoot(), true, "뗀 노드는 뿌리");
	checkEqual(firstNode.setParent(secondNode), true, "setParent");
	checkEqual(firstNode.getParent(), secondNode, "setParent 뒤 부모");
	checkEqual(secondNode.setParent(deepNode), false, "자기 자손 밑으로 붙이기 막기");
	secondNode.removeChildByName("deep");
	checkEqual(deepNode.isRoot(), true, "removeChildByName");
	secondNode.removeChildAt(0);
	checkEqual(secondNode.isLeaf(), true, "removeChildAt");
	rootNode.removeChildren();
	checkEqual(rootNode.isLeaf(), true, "removeChildren");
	checkEqual(layerNode.setParent(null), true, "setParent(null)");
}

// 형제 순서: 자리 읽기, 옮기기(끝을 넘으면 맨 뒤), 부모가 없으면 없음이고 옮기지 않는다.
{
	const rootNode = createNode("root");
	const parentNode = createChild(rootNode, "parent");
	const firstNode = createChild(parentNode, "first");
	const secondNode = createChild(parentNode, "second");
	const thirdNode = createChild(parentNode, "third");
	const detachedNode = createNode("detached");
	checkEqual(secondNode.getSiblingIndex(), 1, "getSiblingIndex");
	checkEqual(parentNode.getChildIndex(thirdNode), 2, "getChildIndex");
	checkEqual(parentNode.getChildIndex(detachedNode), -1, "남의 getChildIndex");
	checkJson(getNameList(firstNode.getSiblings()), ["first", "second", "third"], "getSiblings");
	checkEqual(detachedNode.getSiblingIndex(), -1, "부모 없는 getSiblingIndex");
	checkEqual(rootNode.getSiblingIndex(), -1, "뿌리 getSiblingIndex");
	thirdNode.setSiblingIndex(0);
	checkJson(getNameList(parentNode.getChildren()), ["third", "first", "second"], "setSiblingIndex(0)");
	thirdNode.setSiblingIndex(100);
	checkJson(getNameList(parentNode.getChildren()), ["first", "second", "third"], "setSiblingIndex(100) 은 맨 뒤");
	firstNode.setSiblingIndex(1);
	checkJson(getNameList(parentNode.getChildren()), ["second", "first", "third"], "setSiblingIndex(1)");
	firstNode.setSiblingIndex(1);
	checkJson(getNameList(parentNode.getChildren()), ["second", "first", "third"], "같은 자리 setSiblingIndex");
	detachedNode.setSiblingIndex(0);
	check(isNothing(detachedNode.getParent()), "부모 없는 setSiblingIndex 는 옮기지 않음");
}

// 계층 판정: 조상 하나라도 꺼지거나 안 보이면(불투명도 0) 거짓.
{
	const rootNode = createNode("root");
	const parentNode = createChild(rootNode, "parent");
	const childNode = createChild(parentNode, "child");
	checkEqual(childNode.isActiveInHierarchy(), true, "처음 활성");
	checkEqual(childNode.isVisibleInHierarchy(), true, "처음 보임");
	parentNode.setActive(false);
	checkEqual(childNode.isActiveInHierarchy(), false, "부모 꺼짐은 비활성");
	checkEqual(childNode.isVisibleInHierarchy(), false, "부모 꺼짐은 안 보임");
	checkEqual(rootNode.isActiveInHierarchy(), true, "뿌리 활성");
	parentNode.setActive(true);
	parentNode.setLocalOpacity(0);
	checkEqual(childNode.isActiveInHierarchy(), true, "불투명도 0 도 활성");
	checkEqual(childNode.isVisibleInHierarchy(), false, "부모 불투명도 0 은 안 보임");
	parentNode.setLocalOpacity(0.5);
	checkEqual(childNode.isVisibleInHierarchy(), true, "부모 불투명도 0.5 는 보임");
	if (typeof childNode.setVisible !== "function") {
		// 러스트 판에는 활성, 불투명도와 따로 보이기 플래그(set_visible)가 있고 원본 TransformNode 에는 없다.
		knownDifference("src/core/node/nodetree.rs::active_and_visible_in_hierarchy", "보이기 플래그 set_visible 이 원본에 없음", "setVisible 없음", "set_visible(false) 면 is_visible_in_hierarchy 거짓");
	}
}

// 전역 위치, 크기, 회전, 투명도. (설정한 값이 다시 읽힌다)
{
	const rootNode = createNode("root");
	const parentNode = createChild(rootNode, "parent");
	const childNode = createChild(parentNode, "child");
	parentNode.setLocalPosition(Vector2.create(100, 50));
	parentNode.setLocalRotation(90);
	parentNode.setLocalScale(Vector2.create(2, 2));
	parentNode.setLocalOpacity(0.5);
	childNode.setLocalPosition(Vector2.create(10, 0));
	childNode.setLocalOpacity(0.5);
	const position = childNode.getPosition();
	checkNear([position.x, position.y], [100, 70], 1e-3, "전역 위치");
	childNode.setPosition(Vector2.create(80, 50));
	checkNear([childNode.getLocalPosition().x, childNode.getLocalPosition().y], [0, 10], 1e-3, "setPosition 뒤 로컬 위치");
	checkNear([childNode.getScale().x, childNode.getScale().y], [2, 2], 1e-6, "전역 크기");
	childNode.setScale(Vector2.create(4, 1));
	checkNear([childNode.getLocalScale().x, childNode.getLocalScale().y], [2, 0.5], 1e-6, "setScale 뒤 로컬 크기");
	childNode.setRotation(30);
	checkNear(childNode.getLocalRotation(), -60, 1e-6, "setRotation 뒤 로컬 회전");
	checkNear(childNode.getRotation(), 30, 1e-6, "전역 회전");
	checkNear(childNode.getOpacity(), 0.25, 1e-6, "전역 투명도");
}

// 전역 위치는 부모 피벗 점 기준으로 셈한 피벗 점의 자리다.
{
	const rootNode = createNode("root");
	const parentNode = createChild(rootNode, "parent");
	const childNode = createChild(parentNode, "child");
	parentNode.setLocalPosition(Vector2.create(300, 200));
	parentNode.setContentSize(Vector2.create(100, 60));
	parentNode.setPivot(Vector2.create(0.5, 0.5));
	parentNode.setLocalRotation(90);
	parentNode.setLocalScale(Vector2.create(2, 2));
	childNode.setContentSize(Vector2.create(20, 10));
	childNode.setPivot(Vector2.create(0.5, 0.5));
	childNode.setLocalPosition(Vector2.create(60, 30));
	const position = childNode.getPosition();
	checkNear([position.x, position.y], [300, 220], 1e-3, "부모 피벗 기준 전역 위치");
	const worldCorners = childNode.getWorldCorners();
	checkNear([(worldCorners[0].x + worldCorners[2].x) * 0.5, (worldCorners[0].y + worldCorners[2].y) * 0.5], [position.x, position.y], 1e-3, "모서리 가운데는 전역 위치");
	childNode.setPosition(Vector2.create(280, 200));
	checkNear([childNode.getLocalPosition().x, childNode.getLocalPosition().y], [50, 40], 1e-3, "setPosition 뒤 로컬 위치");
	checkNear([childNode.getPosition().x, childNode.getPosition().y], [280, 200], 1e-3, "setPosition 왕복");
}

// 네 모서리와 감싸는 사각형.
{
	const rootNode = createNode("root");
	rootNode.setContentSize(Vector2.create(200, 100));
	rootNode.setPivot(Vector2.create(0.5, 0.5));
	const boxNode = createChild(rootNode, "box");
	boxNode.setLocalPosition(Vector2.create(150, 50));
	boxNode.setContentSize(Vector2.create(20, 10));
	boxNode.setPivot(Vector2.create(0.5, 0.5));
	boxNode.setLocalScale(Vector2.create(-2, 1));
	const worldCorners = boxNode.getWorldCorners();
	checkNear([worldCorners[0].x, worldCorners[0].y], [30, -5], 1e-6, "모서리 0");
	checkNear([worldCorners[2].x, worldCorners[2].y], [70, 5], 1e-6, "모서리 2");
	const worldBounds = boxNode.getWorldBounds();
	checkNear([worldBounds.position.x, worldBounds.position.y, worldBounds.size.x, worldBounds.size.y], [30, -5, 40, 10], 1e-6, "감싸는 사각형");
	boxNode.setLocalRotation(90);
	const rotatedBounds = boxNode.getWorldBounds();
	checkNear([rotatedBounds.position.x, rotatedBounds.position.y, rotatedBounds.size.x, rotatedBounds.size.y], [45, -20, 10, 40], 1e-4, "돌린 감싸는 사각형");
}

finish("tests/core/nodetree.test.mjs");
