//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";
import { AABB2D } from "./aabb2d.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 비어 있는 노드 번호.
const NULL_NODE = -1;


//==============================================================================
// 나무의 노드 하나. (잎은 프록시 하나, 안쪽 노드는 두 자식을 감싼 상자)
//==============================================================================
class TreeNode extends Object {
	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.minX = 0;
		this.minY = 0;
		this.maxX = 0;
		this.maxY = 0;
		this.parent = NULL_NODE; // 부모. (빈 노드면 다음 빈 노드)
		this.child1 = NULL_NODE;
		this.child2 = NULL_NODE;
		this.height = 0; // 잎은 0, 빈 노드는 -1.
		this.categoryBits = 0; // 잎은 제 값, 안쪽 노드는 자식들의 합.
		this.userData = null;
	}
}


//==============================================================================
// 동적 AABB 나무. (2D, 넓은 단계와 공간 거르기)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - Box2D 의 b2DynamicTree 와 같은 꼴의 이진 경계 부피 계층(BVH)이다. 잎 하나가 프록시 하나(상자, 분류 비트, 사용자 값)다.
//   넣을 때는 표면적 휴리스틱(SAH, 2D 는 둘레)으로 형제를 고르고, 올라가며 나무 돌리기(Kensler 2008)로 둘레 합을 줄인다.
// - 물리의 넓은 단계뿐 아니라 노드 거르기(화면 상자로 query), 터치 맞추기(점 상자로 query), 광선 맞추기(rayCast)에도 쓴다.
// - 상자는 넣은 그대로 담는다. 움직임마다 다시 넣지 않으려면 쓰는 쪽이 여유를 더한 상자(뚱뚱한 상자)를 주고,
//   새 상자가 담긴 상자를 벗어날 때만 moveProxy 를 부른다. (2D 물리가 그렇게 한다)
// - 러스트 vanilla-engine 의 experimental::spatial::DynamicTree 와 같은 API, 같은 셈이다. 같은 차례로 넣고 빼면 두 엔진의 나무 모양이 같다.
//==============================================================================
/**
 * @example <caption>프록시를 넣고 상자와 광선으로 찾기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const tree = new Experimental.DynamicTree();
 * for (let index = 0; index < 10; ++index) {
 * 	const x = index * 30;
 * 	tree.createProxy(Experimental.AABB2D.create(x, 0, x + 20, 20), 0xffffffff, "box" + index);
 * }
 * const foundList = [];
 * tree.query(Experimental.AABB2D.create(25, 5, 95, 15), 0xffffffff, (proxyId) => {
 * 	foundList.push(tree.getUserData(proxyId));
 * 	return true;
 * });
 * console.log(foundList.sort().join(","));
 *
 * let firstHit = null;
 * tree.rayCast(-10, 10, 400, 0, 0xffffffff, (proxyId, maximumFraction) => {
 * 	const aabb = tree.getAabb(proxyId);
 * 	const fraction = (aabb.minX + 10) / 400;
 * 	if (fraction < maximumFraction) {
 * 		firstHit = tree.getUserData(proxyId);
 * 		return fraction;
 * 	}
 * 	return maximumFraction;
 * });
 * console.log(firstHit, tree.getHeight(), tree.validate());
 */
export class DynamicTree extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { TreeNode[] } */ #nodes;
	/** @private @type { number } */ #root;
	/** @private @type { number } */ #freeList;
	/** @private @type { number } */ #proxyCount;

	//==============================================================================
	// 생성. (빈 나무)
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#nodes = [];
		this.#root = NULL_NODE;
		this.#freeList = NULL_NODE;
		this.#proxyCount = 0;
	}

	//==============================================================================
	// 노드 목록 반환. (안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @returns { TreeNode[] }
	 */
	getNodes() {
		return this.#nodes;
	}

	//==============================================================================
	// 뿌리 노드 번호 반환. (비었으면 -1)
	//==============================================================================
	/**
	 * @returns { number } 뿌리 노드 번호. (비었으면 -1)
	 */
	getRoot() {
		return this.#root;
	}

	//==============================================================================
	// 빈 노드 목록의 첫 번호 반환. (안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @returns { number }
	 */
	getFreeList() {
		return this.#freeList;
	}

	//==============================================================================
	// 프록시 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 들어 있는 프록시(잎)의 수.
	 */
	getProxyCount() {
		return this.#proxyCount;
	}

	//==============================================================================
	// 빈 노드 하나 얻기. (빈 목록에서 꺼내거나 새로 만든다, 안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @returns { number }
	 */
	allocateNode() {
		const nodes = this.getNodes();
		const freeList = this.getFreeList();
		if (freeList === NULL_NODE) {
			const node = new TreeNode();
			nodes.push(node);
			return nodes.length - 1;
		}
		const node = nodes[freeList];
		this.#freeList = node.parent;
		node.parent = NULL_NODE;
		node.child1 = NULL_NODE;
		node.child2 = NULL_NODE;
		node.height = 0;
		node.categoryBits = 0;
		node.userData = null;
		return freeList;
	}

	//==============================================================================
	// 노드 돌려주기. (빈 목록 맨 앞에 넣는다, 안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } nodeIndex
	 */
	freeNode(nodeIndex) {
		const nodes = this.getNodes();
		const node = nodes[nodeIndex];
		node.parent = this.getFreeList();
		node.height = -1;
		node.userData = null;
		this.#freeList = nodeIndex;
	}

	//==============================================================================
	// 프록시 만들기.
	//==============================================================================
	/**
	 * @param { AABB2D } aabb 프록시의 상자. (그대로 담는다)
	 * @param { number } categoryBits 분류 비트. (query, rayCast 의 maskBits 와 겹쳐야 찾힌다, 32 비트)
	 * @param { any } userData 사용자 값.
	 * @returns { number } 프록시 번호.
	 */
	createProxy(aabb, categoryBits, userData) {
		const proxyId = this.allocateNode();
		const nodes = this.getNodes();
		const node = nodes[proxyId];
		node.minX = aabb.minX;
		node.minY = aabb.minY;
		node.maxX = aabb.maxX;
		node.maxY = aabb.maxY;
		node.categoryBits = categoryBits >>> 0;
		node.userData = userData;
		node.height = 0;
		this.insertLeaf(proxyId);
		this.#proxyCount += 1;
		return proxyId;
	}

	//==============================================================================
	// 프록시 없애기. (잘못된 번호면 아무것도 하지 않는다)
	//==============================================================================
	/**
	 * @param { number } proxyId 없앨 프록시 번호.
	 */
	destroyProxy(proxyId) {
		const isLeaf = this.isProxy(proxyId);
		if (!isLeaf) {
			return;
		}
		this.removeLeaf(proxyId);
		this.freeNode(proxyId);
		this.#proxyCount -= 1;
	}

	//==============================================================================
	// 프록시 옮기기. (상자를 바꿔 다시 넣는다)
	//==============================================================================
	/**
	 * @param { number } proxyId 옮길 프록시 번호.
	 * @param { AABB2D } aabb 새 상자.
	 */
	moveProxy(proxyId, aabb) {
		const isLeaf = this.isProxy(proxyId);
		if (!isLeaf) {
			return;
		}
		this.removeLeaf(proxyId);
		const nodes = this.getNodes();
		const node = nodes[proxyId];
		node.minX = aabb.minX;
		node.minY = aabb.minY;
		node.maxX = aabb.maxX;
		node.maxY = aabb.maxY;
		this.insertLeaf(proxyId);
	}

	//==============================================================================
	// 살아 있는 프록시 번호인지.
	//==============================================================================
	/**
	 * @param { number } proxyId 볼 번호.
	 * @returns { boolean } 잎 노드 번호면 참.
	 */
	isProxy(proxyId) {
		const nodes = this.getNodes();
		if (!System.Number.isInteger(proxyId) || proxyId < 0 || proxyId >= nodes.length) {
			return false;
		}
		return nodes[proxyId].height === 0;
	}

	//==============================================================================
	// 프록시의 상자 반환. (복사본)
	//==============================================================================
	/**
	 * @param { number } proxyId 프록시 번호.
	 * @returns { AABB2D } 담긴 상자. (잘못된 번호면 모두 0)
	 */
	getAabb(proxyId) {
		const isLeaf = this.isProxy(proxyId);
		if (!isLeaf) {
			return new AABB2D();
		}
		const nodes = this.getNodes();
		const node = nodes[proxyId];
		return AABB2D.create(node.minX, node.minY, node.maxX, node.maxY);
	}

	//==============================================================================
	// 프록시의 사용자 값 반환.
	//==============================================================================
	/**
	 * @param { number } proxyId 프록시 번호.
	 * @returns { any } 사용자 값. (잘못된 번호면 null)
	 */
	getUserData(proxyId) {
		const isLeaf = this.isProxy(proxyId);
		if (!isLeaf) {
			return null;
		}
		const nodes = this.getNodes();
		return nodes[proxyId].userData;
	}

	//==============================================================================
	// 프록시의 분류 비트 반환.
	//==============================================================================
	/**
	 * @param { number } proxyId 프록시 번호.
	 * @returns { number } 분류 비트. (잘못된 번호면 0)
	 */
	getCategoryBits(proxyId) {
		const isLeaf = this.isProxy(proxyId);
		if (!isLeaf) {
			return 0;
		}
		const nodes = this.getNodes();
		return nodes[proxyId].categoryBits;
	}

	//==============================================================================
	// 나무 높이 반환. (비었으면 0, 잎 하나면 0)
	//==============================================================================
	/**
	 * @returns { number } 뿌리의 높이.
	 */
	getHeight() {
		const root = this.getRoot();
		if (root === NULL_NODE) {
			return 0;
		}
		const nodes = this.getNodes();
		return nodes[root].height;
	}

	//==============================================================================
	// 둘레 비 반환. (안쪽 노드 둘레의 합 / 뿌리 둘레, 작을수록 나무가 좋다)
	//==============================================================================
	/**
	 * @returns { number } 둘레 비. (비었으면 0)
	 */
	getAreaRatio() {
		const root = this.getRoot();
		if (root === NULL_NODE) {
			return 0;
		}
		const nodes = this.getNodes();
		const rootNode = nodes[root];
		const rootPerimeter = 2 * ((rootNode.maxX - rootNode.minX) + (rootNode.maxY - rootNode.minY));
		if (rootPerimeter <= 0) {
			return 0;
		}
		let totalPerimeter = 0;
		for (const node of nodes) {
			if (node.height <= 0) {
				continue;
			}
			totalPerimeter += 2 * ((node.maxX - node.minX) + (node.maxY - node.minY));
		}
		return totalPerimeter / rootPerimeter;
	}

	//==============================================================================
	// 잎 넣기. (표면적 휴리스틱으로 형제를 고르고 올라가며 상자와 높이를 고친다, 안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } leaf
	 */
	insertLeaf(leaf) {
		const nodes = this.getNodes();
		if (this.getRoot() === NULL_NODE) {
			this.#root = leaf;
			nodes[leaf].parent = NULL_NODE;
			return;
		}

		// 형제 고르기. (새 부모를 지금 노드에 두는 값과, 더 내려갈 때 자식마다 드는 값을 견준다)
		const leafNode = nodes[leaf];
		let index = this.getRoot();
		while (nodes[index].height > 0) {
			const node = nodes[index];
			const child1 = node.child1;
			const child2 = node.child2;
			const perimeter = 2 * ((node.maxX - node.minX) + (node.maxY - node.minY));
			const combinedPerimeter = 2 * ((System.Math.max(node.maxX, leafNode.maxX) - System.Math.min(node.minX, leafNode.minX)) + (System.Math.max(node.maxY, leafNode.maxY) - System.Math.min(node.minY, leafNode.minY)));
			const cost = 2 * combinedPerimeter;
			const inheritanceCost = 2 * (combinedPerimeter - perimeter);
			const cost1 = this.calculateDescendCost(child1, leafNode) + inheritanceCost;
			const cost2 = this.calculateDescendCost(child2, leafNode) + inheritanceCost;
			if (cost < cost1 && cost < cost2) {
				break;
			}
			if (cost1 < cost2) {
				index = child1;
			}
			else {
				index = child2;
			}
		}
		const sibling = index;

		// 새 부모.
		const siblingNode = nodes[sibling];
		const oldParent = siblingNode.parent;
		const newParent = this.allocateNode();
		const newParentNode = nodes[newParent];
		newParentNode.parent = oldParent;
		newParentNode.userData = null;
		newParentNode.minX = System.Math.min(leafNode.minX, siblingNode.minX);
		newParentNode.minY = System.Math.min(leafNode.minY, siblingNode.minY);
		newParentNode.maxX = System.Math.max(leafNode.maxX, siblingNode.maxX);
		newParentNode.maxY = System.Math.max(leafNode.maxY, siblingNode.maxY);
		newParentNode.categoryBits = (leafNode.categoryBits | siblingNode.categoryBits) >>> 0;
		newParentNode.height = siblingNode.height + 1;
		newParentNode.child1 = sibling;
		newParentNode.child2 = leaf;
		siblingNode.parent = newParent;
		leafNode.parent = newParent;
		if (oldParent !== NULL_NODE) {
			const oldParentNode = nodes[oldParent];
			if (oldParentNode.child1 === sibling) {
				oldParentNode.child1 = newParent;
			}
			else {
				oldParentNode.child2 = newParent;
			}
		}
		else {
			this.#root = newParent;
		}

		// 올라가며 고치고 돌린다.
		this.refitAncestors(leafNode.parent);
	}

	//==============================================================================
	// 잎을 child 쪽으로 더 내려 보낼 때 드는 값. (안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } child
	 * @param { TreeNode } leafNode
	 * @returns { number }
	 */
	calculateDescendCost(child, leafNode) {
		const nodes = this.getNodes();
		const childNode = nodes[child];
		const combinedPerimeter = 2 * ((System.Math.max(childNode.maxX, leafNode.maxX) - System.Math.min(childNode.minX, leafNode.minX)) + (System.Math.max(childNode.maxY, leafNode.maxY) - System.Math.min(childNode.minY, leafNode.minY)));
		if (childNode.height === 0) {
			return combinedPerimeter;
		}
		const childPerimeter = 2 * ((childNode.maxX - childNode.minX) + (childNode.maxY - childNode.minY));
		return combinedPerimeter - childPerimeter;
	}

	//==============================================================================
	// 잎 빼기. (부모를 없애고 형제를 그 자리에 올린다, 안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } leaf
	 */
	removeLeaf(leaf) {
		const nodes = this.getNodes();
		if (leaf === this.getRoot()) {
			this.#root = NULL_NODE;
			return;
		}
		const parent = nodes[leaf].parent;
		const parentNode = nodes[parent];
		const grandParent = parentNode.parent;
		let sibling = parentNode.child1;
		if (sibling === leaf) {
			sibling = parentNode.child2;
		}
		if (grandParent !== NULL_NODE) {
			const grandParentNode = nodes[grandParent];
			if (grandParentNode.child1 === parent) {
				grandParentNode.child1 = sibling;
			}
			else {
				grandParentNode.child2 = sibling;
			}
			nodes[sibling].parent = grandParent;
			this.freeNode(parent);
			this.refitAncestors(grandParent);
		}
		else {
			this.#root = sibling;
			nodes[sibling].parent = NULL_NODE;
			this.freeNode(parent);
		}
		nodes[leaf].parent = NULL_NODE;
	}

	//==============================================================================
	// index 부터 뿌리까지 상자, 분류 비트, 높이를 고치고 노드마다 돌리기를 해 본다. (안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } startIndex
	 */
	refitAncestors(startIndex) {
		const nodes = this.getNodes();
		let index = startIndex;
		while (index !== NULL_NODE) {
			const node = nodes[index];
			const child1Node = nodes[node.child1];
			const child2Node = nodes[node.child2];
			node.minX = System.Math.min(child1Node.minX, child2Node.minX);
			node.minY = System.Math.min(child1Node.minY, child2Node.minY);
			node.maxX = System.Math.max(child1Node.maxX, child2Node.maxX);
			node.maxY = System.Math.max(child1Node.maxY, child2Node.maxY);
			node.categoryBits = (child1Node.categoryBits | child2Node.categoryBits) >>> 0;
			node.height = 1 + System.Math.max(child1Node.height, child2Node.height);
			this.rotateNodes(index);
			index = node.parent;
		}
	}

	//==============================================================================
	// 나무 돌리기. (자식 하나와 반대쪽 손자 하나를 바꿔 바뀌는 자식의 둘레가 가장 많이 줄면 바꾼다, 안에서 쓴다)
	// - A 의 자식이 B, C 이고 B 의 자식이 D, E, C 의 자식이 F, G 일 때 B 와 F, B 와 G, C 와 D, C 와 E 네 가지를 견준다.
	//==============================================================================
	/**
	 * @private
	 * @param { number } indexA
	 */
	rotateNodes(indexA) {
		const nodes = this.getNodes();
		const nodeA = nodes[indexA];
		if (nodeA.height < 2) {
			return;
		}
		const indexB = nodeA.child1;
		const indexC = nodeA.child2;
		const nodeB = nodes[indexB];
		const nodeC = nodes[indexC];

		// 0: 바꾸지 않음, 1: B 와 F, 2: B 와 G, 3: C 와 D, 4: C 와 E.
		let bestRotation = 0;
		let bestReduction = 0;
		if (nodeC.height > 0) {
			const perimeterC = 2 * ((nodeC.maxX - nodeC.minX) + (nodeC.maxY - nodeC.minY));
			const nodeF = nodes[nodeC.child1];
			const nodeG = nodes[nodeC.child2];
			const perimeterBG = 2 * ((System.Math.max(nodeB.maxX, nodeG.maxX) - System.Math.min(nodeB.minX, nodeG.minX)) + (System.Math.max(nodeB.maxY, nodeG.maxY) - System.Math.min(nodeB.minY, nodeG.minY)));
			const perimeterBF = 2 * ((System.Math.max(nodeB.maxX, nodeF.maxX) - System.Math.min(nodeB.minX, nodeF.minX)) + (System.Math.max(nodeB.maxY, nodeF.maxY) - System.Math.min(nodeB.minY, nodeF.minY)));
			const reductionBF = perimeterC - perimeterBG;
			const reductionBG = perimeterC - perimeterBF;
			if (reductionBF > bestReduction) {
				bestReduction = reductionBF;
				bestRotation = 1;
			}
			if (reductionBG > bestReduction) {
				bestReduction = reductionBG;
				bestRotation = 2;
			}
		}
		if (nodeB.height > 0) {
			const perimeterB = 2 * ((nodeB.maxX - nodeB.minX) + (nodeB.maxY - nodeB.minY));
			const nodeD = nodes[nodeB.child1];
			const nodeE = nodes[nodeB.child2];
			const perimeterCE = 2 * ((System.Math.max(nodeC.maxX, nodeE.maxX) - System.Math.min(nodeC.minX, nodeE.minX)) + (System.Math.max(nodeC.maxY, nodeE.maxY) - System.Math.min(nodeC.minY, nodeE.minY)));
			const perimeterCD = 2 * ((System.Math.max(nodeC.maxX, nodeD.maxX) - System.Math.min(nodeC.minX, nodeD.minX)) + (System.Math.max(nodeC.maxY, nodeD.maxY) - System.Math.min(nodeC.minY, nodeD.minY)));
			const reductionCD = perimeterB - perimeterCE;
			const reductionCE = perimeterB - perimeterCD;
			if (reductionCD > bestReduction) {
				bestReduction = reductionCD;
				bestRotation = 3;
			}
			if (reductionCE > bestReduction) {
				bestReduction = reductionCE;
				bestRotation = 4;
			}
		}

		switch (bestRotation) {
			case 1: {
				this.swapChildWithGrandchild(indexA, indexB, indexC, true);
				break;
			}
			case 2: {
				this.swapChildWithGrandchild(indexA, indexB, indexC, false);
				break;
			}
			case 3: {
				this.swapChildWithGrandchild(indexA, indexC, indexB, true);
				break;
			}
			case 4: {
				this.swapChildWithGrandchild(indexA, indexC, indexB, false);
				break;
			}
			default: {
				break;
			}
		}
	}

	//==============================================================================
	// A 의 자식 child 와 A 의 다른 자식 other 의 자식(isFirst 면 첫째, 아니면 둘째)을 바꾼다. (안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } indexA
	 * @param { number } child
	 * @param { number } other
	 * @param { boolean } isFirst
	 */
	swapChildWithGrandchild(indexA, child, other, isFirst) {
		const nodes = this.getNodes();
		const nodeA = nodes[indexA];
		const otherNode = nodes[other];
		const grandchild = isFirst ? otherNode.child1 : otherNode.child2;
		if (nodeA.child1 === child) {
			nodeA.child1 = grandchild;
		}
		else {
			nodeA.child2 = grandchild;
		}
		if (isFirst) {
			otherNode.child1 = child;
		}
		else {
			otherNode.child2 = child;
		}
		nodes[child].parent = other;
		nodes[grandchild].parent = indexA;

		const child1Node = nodes[otherNode.child1];
		const child2Node = nodes[otherNode.child2];
		otherNode.minX = System.Math.min(child1Node.minX, child2Node.minX);
		otherNode.minY = System.Math.min(child1Node.minY, child2Node.minY);
		otherNode.maxX = System.Math.max(child1Node.maxX, child2Node.maxX);
		otherNode.maxY = System.Math.max(child1Node.maxY, child2Node.maxY);
		otherNode.categoryBits = (child1Node.categoryBits | child2Node.categoryBits) >>> 0;
		otherNode.height = 1 + System.Math.max(child1Node.height, child2Node.height);
		const aChild1Node = nodes[nodeA.child1];
		const aChild2Node = nodes[nodeA.child2];
		nodeA.height = 1 + System.Math.max(aChild1Node.height, aChild2Node.height);
	}

	//==============================================================================
	// 상자와 겹치는 프록시 찾기.
	// - 분류 비트가 maskBits 와 겹치고 상자가 닿거나 겹치는 잎마다 callback(proxyId) 를 부른다. false 를 돌려주면 멈춘다.
	//==============================================================================
	/**
	 * @param { AABB2D } aabb 찾을 상자.
	 * @param { number } maskBits 찾을 분류. (32 비트)
	 * @param { Function } callback (proxyId) => boolean, 거짓이면 멈춘다.
	 */
	query(aabb, maskBits, callback) {
		const root = this.getRoot();
		if (root === NULL_NODE) {
			return;
		}
		const nodes = this.getNodes();
		const stack = [root];
		while (stack.length > 0) {
			const index = stack.pop();
			const node = nodes[index];
			if ((node.categoryBits & maskBits) === 0) {
				continue;
			}
			if (aabb.minX > node.maxX || aabb.minY > node.maxY || node.minX > aabb.maxX || node.minY > aabb.maxY) {
				continue;
			}
			if (node.height === 0) {
				const isContinued = callback(index);
				if (isContinued === false) {
					return;
				}
			}
			else {
				stack.push(node.child1);
				stack.push(node.child2);
			}
		}
	}

	//==============================================================================
	// 광선(선분)이 지나는 프록시 찾기.
	// - 선분은 origin 에서 origin + translation 까지다. 상자와 선분이 겹칠 수 있는 잎마다 callback(proxyId, maximumFraction) 을 부른다.
	// - callback 이 돌려주는 값: 0 이면 멈춘다, 0 보다 작으면 그 잎을 무시한다, 그 밖에는 그 값(지금 maximumFraction 보다 작을 때)으로 선분을 줄인다.
	//   가장 가까운 것만 찾을 때는 맞은 몫을, 모두 찾을 때는 받은 maximumFraction 을 그대로 돌려준다.
	//==============================================================================
	/**
	 * @param { number } originX 시작점 x.
	 * @param { number } originY 시작점 y.
	 * @param { number } translationX 끝점까지의 x 이동.
	 * @param { number } translationY 끝점까지의 y 이동.
	 * @param { number } maskBits 찾을 분류. (32 비트)
	 * @param { Function } callback (proxyId, maximumFraction) => number
	 */
	rayCast(originX, originY, translationX, translationY, maskBits, callback) {
		const root = this.getRoot();
		if (root === NULL_NODE) {
			return;
		}
		const lengthSquared = translationX * translationX + translationY * translationY;
		if (lengthSquared <= 0) {
			return;
		}
		const length = System.Math.sqrt(lengthSquared);
		const directionX = translationX / length;
		const directionY = translationY / length;
		// 선분에 수직인 축. (선분이 상자와 떨어져 있는지 이 축으로 본다)
		const perpendicularX = -directionY;
		const perpendicularY = directionX;
		const absolutePerpendicularX = System.Math.abs(perpendicularX);
		const absolutePerpendicularY = System.Math.abs(perpendicularY);

		let maximumFraction = 1;
		let endX = originX + maximumFraction * translationX;
		let endY = originY + maximumFraction * translationY;
		let segmentMinX = System.Math.min(originX, endX);
		let segmentMinY = System.Math.min(originY, endY);
		let segmentMaxX = System.Math.max(originX, endX);
		let segmentMaxY = System.Math.max(originY, endY);

		const nodes = this.getNodes();
		const stack = [root];
		while (stack.length > 0) {
			const index = stack.pop();
			const node = nodes[index];
			if ((node.categoryBits & maskBits) === 0) {
				continue;
			}
			if (segmentMinX > node.maxX || segmentMinY > node.maxY || node.minX > segmentMaxX || node.minY > segmentMaxY) {
				continue;
			}
			const centerX = 0.5 * (node.minX + node.maxX);
			const centerY = 0.5 * (node.minY + node.maxY);
			const extentX = 0.5 * (node.maxX - node.minX);
			const extentY = 0.5 * (node.maxY - node.minY);
			const separation = System.Math.abs(perpendicularX * (originX - centerX) + perpendicularY * (originY - centerY)) - (absolutePerpendicularX * extentX + absolutePerpendicularY * extentY);
			if (separation > 0) {
				continue;
			}
			if (node.height === 0) {
				const value = callback(index, maximumFraction);
				if (value === 0) {
					return;
				}
				if (value > 0 && value <= maximumFraction) {
					maximumFraction = value;
					endX = originX + maximumFraction * translationX;
					endY = originY + maximumFraction * translationY;
					segmentMinX = System.Math.min(originX, endX);
					segmentMinY = System.Math.min(originY, endY);
					segmentMaxX = System.Math.max(originX, endX);
					segmentMaxY = System.Math.max(originY, endY);
				}
			}
			else {
				stack.push(node.child1);
				stack.push(node.child2);
			}
		}
	}

	//==============================================================================
	// 나무 검사. (부모와 자식 연결, 높이, 상자 감싸기, 분류 비트, 프록시 수가 맞는지, 시험용)
	//==============================================================================
	/**
	 * @returns { boolean } 모두 맞으면 참.
	 */
	validate() {
		const root = this.getRoot();
		if (root === NULL_NODE) {
			return this.getProxyCount() === 0;
		}
		const nodes = this.getNodes();
		if (nodes[root].parent !== NULL_NODE) {
			return false;
		}
		let leafCount = 0;
		const stack = [root];
		while (stack.length > 0) {
			const index = stack.pop();
			const node = nodes[index];
			if (node.height === 0) {
				leafCount += 1;
				continue;
			}
			const child1Node = nodes[node.child1];
			const child2Node = nodes[node.child2];
			if (child1Node.parent !== index || child2Node.parent !== index) {
				return false;
			}
			if (node.height !== 1 + System.Math.max(child1Node.height, child2Node.height)) {
				return false;
			}
			if (node.minX !== System.Math.min(child1Node.minX, child2Node.minX) || node.minY !== System.Math.min(child1Node.minY, child2Node.minY)) {
				return false;
			}
			if (node.maxX !== System.Math.max(child1Node.maxX, child2Node.maxX) || node.maxY !== System.Math.max(child1Node.maxY, child2Node.maxY)) {
				return false;
			}
			if (node.categoryBits !== ((child1Node.categoryBits | child2Node.categoryBits) >>> 0)) {
				return false;
			}
			stack.push(node.child1);
			stack.push(node.child2);
		}
		return leafCount === this.getProxyCount();
	}
}
