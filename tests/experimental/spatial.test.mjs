//==============================================================================
// 공간 나누기 초안 시험. (node tests/experimental/spatial.test.mjs)
// - 러스트 판 src/experimental/spatial/dynamictree.rs 의 tree_insert_move_remove_query, tree_ray_cast 와 같은 입력, 같은 기댓값.
//   (같은 64 비트 선형 합동 난수로 상자를 짓는다)
//==============================================================================
import * as Experimental from "../../src/experimental/experimental.js";

const { AABB2D, DynamicTree } = Experimental;
let checkCount = 0;
function check(condition, message) {
	checkCount++;
	if (!condition) {
		throw new Error("시험 실패: " + message);
	}
}

// 러스트 판 next_random 과 같은 난수. (seed = seed * 6364136223846793005 + 1442695040888963407 mod 2^64, 위 53 비트)
let seed = 7n;
function nextRandom() {
	seed = (seed * 6364136223846793005n + 1442695040888963407n) & 0xFFFFFFFFFFFFFFFFn;
	return Number(seed >> 11n) / 2 ** 53;
}

// 넣고, 옮기고, 빼도 나무가 맞고, 질의 결과가 모두 훑기와 같다.
{
	const tree = new DynamicTree();
	const boxList = [];
	const proxyList = [];
	for (let index = 0; index < 300; ++index) {
		const x = nextRandom() * 1000;
		const y = nextRandom() * 1000;
		const size = 1 + nextRandom() * 30;
		const aabb = AABB2D.create(x, y, x + size, y + size);
		proxyList.push(tree.createProxy(aabb, 1 << (index % 3), index));
		boxList.push(aabb);
	}
	check(tree.validate(), "넣은 뒤 나무");
	for (let index = 0; index < 300; ++index) {
		if (index % 3 === 0) {
			const x = nextRandom() * 1000;
			const y = nextRandom() * 1000;
			const aabb = AABB2D.create(x, y, x + 10, y + 10);
			tree.moveProxy(proxyList[index], aabb);
			boxList[index] = aabb;
		}
	}
	for (let index = 0; index < 300; index += 7) {
		tree.destroyProxy(proxyList[index]);
	}
	check(tree.validate(), "옮기고 뺀 뒤 나무");
	check(tree.getProxyCount() === 300 - 43, "남은 상자 수");
	check(tree.getHeight() < 20, "균형: 높이 " + tree.getHeight());
	const queryBox = AABB2D.create(200, 200, 500, 450);
	const foundList = [];
	tree.query(queryBox, 0b101, (proxyId) => {
		foundList.push(tree.getUserData(proxyId));
		return true;
	});
	foundList.sort((left, right) => left - right);
	const expectedList = [];
	for (let index = 0; index < 300; ++index) {
		if (index % 7 === 0 || ((1 << (index % 3)) & 0b101) === 0) {
			continue;
		}
		if (boxList[index].overlaps(queryBox)) {
			expectedList.push(index);
		}
	}
	check(foundList.join(",") === expectedList.join(","), "질의 결과");
}

// 광선은 가장 가까운 상자를 찾고, 0 을 돌려주면 멈춘다.
{
	const tree = new DynamicTree();
	for (let index = 0; index < 20; ++index) {
		const x = 100 + index * 50;
		tree.createProxy(AABB2D.create(x, -10, x + 20, 10), 1, index);
	}
	let closest = null;
	let visitCount = 0;
	tree.rayCast(0, 0, 2000, 0, 1, (proxyId, maximumFraction) => {
		visitCount++;
		const fraction = tree.getAabb(proxyId).minX / 2000;
		if (fraction <= maximumFraction) {
			closest = tree.getUserData(proxyId);
			return fraction;
		}
		return maximumFraction;
	});
	check(closest === 0 && visitCount < 20, "가장 가까운 상자");
	let stopCount = 0;
	tree.rayCast(0, 0, 2000, 0, 1, () => {
		stopCount++;
		return 0;
	});
	check(stopCount === 1, "0 이면 멈춤");
	let missCount = 0;
	tree.rayCast(0, 50, 2000, 0, 1, (proxyId, maximumFraction) => {
		missCount++;
		return maximumFraction;
	});
	check(missCount === 0, "비켜난 광선");
}

console.log(`공간 나누기 시험 ${checkCount} 개 통과`);
