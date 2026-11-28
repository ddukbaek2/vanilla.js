//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Rect } from "../base/rect.js";


//==============================================================================
// 방향 포커스 내비게이터.
// - 게임패드 십자키 / 키보드 화살표로 UI 항목 사이를 옮겨 다닐 때,
//   "이동 방향 앞쪽에 있으면서 축에서 벗어난 정도에 벌점을 준 거리" 가 가장 가까운
//   항목으로 포커스를 옮긴다. (콘솔 UI 내비게이션의 표준 방식)
// - 항목은 { id, rect } 로 등록한다. 렌더 방식과 무관한 순수 좌표 알고리즘이다.
//==============================================================================
/**
 * @example <caption>메뉴 항목 사이를 방향으로 옮겨 다니기</caption>
 * import { FocusNavigator, Rect } from "./build/vanilla.js";
 *
 * const focusNavigator = new FocusNavigator({ crossAxisPenalty: 2.5 });
 * focusNavigator.addItem("start", Rect.create(100, 100, 200, 60));
 * focusNavigator.addItem("options", Rect.create(100, 180, 200, 60));
 * focusNavigator.addItem("credits", Rect.create(320, 180, 200, 60));
 * console.log(focusNavigator.moveFocus(0, 1));
 * console.log(focusNavigator.moveFocus(0, 1));
 * console.log(focusNavigator.moveFocus(1, 0));
 * console.log(focusNavigator.moveFocus(1, 0));
 * console.log(focusNavigator.getFocusedId());
 */
export class FocusNavigator extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object[] } */ #itemList;
	/** @private @type { string | null } */ #focusedId;
	/** @private @type { number } */ #crossAxisPenalty;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { object } options { crossAxisPenalty = 2.5 }
	 */
	constructor(options = {}) {
		super();

		this.#itemList = [];
		this.#focusedId = null;
		this.#crossAxisPenalty = (options.crossAxisPenalty !== undefined) ? options.crossAxisPenalty : 2.5;
	}

	//==============================================================================
	// 항목 등록.
	//==============================================================================
	/**
	 * @param { string } id 항목 식별자.
	 * @param { Rect } rect 항목의 사각형. (가운데끼리 거리를 잰다)
	 */
	addItem(id, rect) {
		this.#itemList.push({ id: id, rect: rect });
	}

	//==============================================================================
	// 항목 전부 제거.
	//==============================================================================
	clear() {
		this.#itemList.length = 0;
		this.#focusedId = null;
	}

	//==============================================================================
	// 포커스 지정.
	//==============================================================================
	/**
	 * @param { string | null } id 포커스할 항목 식별자. (null 이면 포커스 없음)
	 */
	setFocusedId(id) {
		this.#focusedId = id;
	}

	//==============================================================================
	// 현재 포커스 반환.
	//==============================================================================
	/**
	 * @returns { string | null } 지금 포커스된 항목 식별자. (없으면 null)
	 */
	getFocusedId() {
		return this.#focusedId;
	}

	//==============================================================================
	// 방향 이동.
	// - directionX / directionY 는 -1, 0, 1. (예: 오른쪽 = (1, 0))
	// - 포커스가 없으면 방향과 무관하게 가장 왼쪽 위 항목을 고른다.
	// - 이동할 곳이 없으면 포커스를 그대로 두고 null 을 반환한다.
	//==============================================================================
	/**
	 * @param { number } directionX 가로 방향. (-1, 0, 1)
	 * @param { number } directionY 세로 방향. (-1, 0, 1)
	 * @returns { string | null } 새로 포커스된 항목 id.
	 */
	moveFocus(directionX, directionY) {
		if (this.#itemList.length === 0) {
			return null;
		}
		if (this.#focusedId === null) {
			let firstItem = this.#itemList[0];
			for (const item of this.#itemList) {
				const itemScore = item.rect.position.y * 10000 + item.rect.position.x;
				const firstScore = firstItem.rect.position.y * 10000 + firstItem.rect.position.x;
				if (itemScore < firstScore) {
					firstItem = item;
				}
			}
			this.#focusedId = firstItem.id;
			return this.#focusedId;
		}

		const currentItem = this.#itemList.find((item) => item.id === this.#focusedId);
		if (!currentItem) {
			this.#focusedId = this.#itemList[0].id;
			return this.#focusedId;
		}
		const currentCenterX = currentItem.rect.position.x + currentItem.rect.size.x * 0.5;
		const currentCenterY = currentItem.rect.position.y + currentItem.rect.size.y * 0.5;

		let bestItem = null;
		let bestScore = System.Number.POSITIVE_INFINITY;
		for (const item of this.#itemList) {
			if (item.id === this.#focusedId) {
				continue;
			}
			const itemCenterX = item.rect.position.x + item.rect.size.x * 0.5;
			const itemCenterY = item.rect.position.y + item.rect.size.y * 0.5;
			const deltaX = itemCenterX - currentCenterX;
			const deltaY = itemCenterY - currentCenterY;

			// 이동 방향 앞쪽에 있는 항목만 후보로 삼는다.
			const forwardDistance = deltaX * directionX + deltaY * directionY;
			if (forwardDistance <= 0) {
				continue;
			}
			const crossDistance = System.Math.abs(deltaX * directionY) + System.Math.abs(deltaY * directionX);
			const score = forwardDistance + crossDistance * this.#crossAxisPenalty;
			if (score < bestScore) {
				bestScore = score;
				bestItem = item;
			}
		}
		if (!bestItem) {
			return null;
		}
		this.#focusedId = bestItem.id;
		return this.#focusedId;
	}
}
