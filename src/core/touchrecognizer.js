//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { TouchRaycaster } from "./touchraycaster.js";
import { UIScrollView } from "../ui/uiscrollview.js";


//==============================================================================
// 드래그로 전환되었다고 판정할 거리(px).
//==============================================================================
const DRAG_THRESHOLD = 10;


//==============================================================================
// 부모에 ScrollView 가 있을 때 hit 노드로의 touchPress 전달을 지연시키는 시간(ms).
// 이 시간 안에 드래그로 전환되면 hit 노드는 press 자체를 받지 않으므로 cancel 도
// 발생하지 않는다. UIKit 의 UIScrollView.delaysContentTouches 와 동일한 사상.
//==============================================================================
const DELAY_PRESS_MS = 150;


//==============================================================================
// 터치 인식기.
// - TouchRaycaster 를 확장해 UIKit 스타일 제스처 인식을 한다.
// - 누른 노드의 부모 체인에서 UIScrollView 를 가진 노드를 찾아두고,
//   드래그 임계를 넘으면:
//     1) 누른 노드에 touchCancel 을 보내 클릭을 취소
//     2) 그 위 ScrollView 에 touchPress(최초 누른 위치) → touchMove(현재) 를
//        순서대로 보내 스크롤을 인계한다.
// - 임계 이내면 누른 노드에만 touch* 를 보낸다. (기본 버튼처럼 동작)
// - 부모에 ScrollView 가 있을 때는 hit 노드의 touchPress 전달을 DELAY_PRESS_MS
//   만큼 지연시킨다. 그 사이 드래그로 판명나면 press 가 아예 전달되지 않으므로
//   "프레스 트렌지션 도중 취소" 가 발생하지 않는다. 짧은 탭은 release 시점에
//   보류된 press 를 즉시 발동 후 release 를 이어 보내 보정한다.
//==============================================================================
export class TouchRecognizer extends TouchRaycaster {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { * } */ #target;            // 누른 hit 노드.
	/** @private @type { UIScrollView | null } */ #scrollView; // 부모 체인의 ScrollView.
	/** @private @type { Vector2 | null } */ #pressPosition;
	/** @private @type { boolean } */ #isDragging;
	/** @private @type { * } */ #pressTimerId;      // 지연 press 타이머 핸들. 없으면 null.
	/** @private @type { boolean } */ #pressDelivered; // hit 노드에 touchPress 가 실제로 전달됐는가.

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#target = null;
		this.#scrollView = null;
		this.#pressPosition = null;
		this.#isDragging = false;
		this.#pressTimerId = null;
		this.#pressDelivered = false;
	}

	//==============================================================================
	// 터치 누름.
	// - hit 노드와, 그 부모 체인에서 ScrollView 를 보유한 노드를 찾아둔다.
	// - 부모에 ScrollView 가 없으면 hit 노드에 즉시 touchPress 를 전달한다.
	// - 부모에 ScrollView 가 있으면 DELAY_PRESS_MS 후에 전달하도록 예약한다.
	//   그 사이 드래그가 시작되면 예약된 press 는 취소된다.
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition
	 */
	touchPress(viewInputPosition) {
		const target = this.raycast(viewInputPosition);
		this.#target = target;
		this.#pressPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
		this.#isDragging = false;
		this.#scrollView = this.findAncestorScrollView(target);
		this.#pressDelivered = false;
		this.#pressTimerId = null;

		if (!target) {
			return;
		}

		if (this.#scrollView) {
			const pressPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
			this.#pressTimerId = System.setTimeout(() => {
				this.#pressTimerId = null;
				if (this.#isDragging) return;
				if (this.#target !== target) return;
				this.#pressDelivered = true;
				target.touchPress(pressPosition);
			}, DELAY_PRESS_MS);
		}
		else {
			this.#pressDelivered = true;
			target.touchPress(viewInputPosition);
		}
	}

	//==============================================================================
	// 터치 이동.
	// - 드래그 모드면 ScrollView 에만 전달.
	// - 드래그 모드가 아니고, ScrollView 가 있고, 임계를 넘었다면 모드 전환:
	//   (1) 지연 press 가 보류 중이면 취소(전달 자체를 안 함),
	//       이미 press 가 전달되었으면 hit 노드에 touchCancel,
	//   (2) ScrollView 에 touchPress(최초 위치) → touchMove(현재 위치).
	// - 그 외에는 hit 노드에 touchMove. 단 press 가 아직 전달되지 않았다면
	//   touchMove 도 전달하지 않는다.
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition
	 */
	touchMove(viewInputPosition) {
		if (this.#isDragging) {
			if (this.#scrollView) {
				this.#scrollView.touchMove(viewInputPosition);
			}
			return;
		}

		if (this.#scrollView && this.#pressPosition) {
			const dx = viewInputPosition.x - this.#pressPosition.x;
			const dy = viewInputPosition.y - this.#pressPosition.y;
			if (System.Math.abs(dx) > DRAG_THRESHOLD || System.Math.abs(dy) > DRAG_THRESHOLD) {
				this.#isDragging = true;
				// 보류 중인 지연 press 가 있다면 취소. press 자체를 보내지 않으므로 cancel 도 불필요.
				if (this.#pressTimerId !== null) {
					System.clearTimeout(this.#pressTimerId);
					this.#pressTimerId = null;
				}
				else if (this.#pressDelivered && this.#target) {
					this.#target.touchCancel(viewInputPosition);
				}
				// 버튼 입장에선 더 이상 추적하지 않으므로 #target 도 비운다.
				this.#target = null;
				this.#pressDelivered = false;
				// ScrollView 가 자연스러운 시작 위치를 갖도록 최초 누른 위치부터 재생.
				this.#scrollView.touchPress(this.#pressPosition);
				this.#scrollView.touchMove(viewInputPosition);
				return;
			}
		}

		if (this.#pressDelivered && this.#target) {
			this.#target.touchMove(viewInputPosition);
		}
	}

	//==============================================================================
	// 터치 뗌.
	// - 드래그 모드면 ScrollView 에 release.
	// - 아니면 hit 노드에 release.
	//   단, 짧은 탭이라 지연 press 가 아직 발동되지 않았다면 보류된 press 를 즉시
	//   발동한 뒤 release 를 이어 보내, 시각효과가 한 프레임이라도 들어가게 한다.
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition
	 */
	touchRelease(viewInputPosition) {
		if (this.#isDragging) {
			if (this.#scrollView) {
				this.#scrollView.touchRelease(viewInputPosition);
			}
		}
		else if (this.#target) {
			if (this.#pressTimerId !== null) {
				System.clearTimeout(this.#pressTimerId);
				this.#pressTimerId = null;
				this.#target.touchPress(this.#pressPosition || viewInputPosition);
				this.#pressDelivered = true;
			}
			this.#target.touchRelease(viewInputPosition);
		}
		this.reset();
	}

	//==============================================================================
	// 터치 취소.
	// - 지연 press 가 보류 중이면 hit 노드에 cancel 을 보내지 않는다 (press 자체가
	//   전달되지 않았으므로).
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition
	 */
	touchCancel(viewInputPosition) {
		if (this.#isDragging) {
			if (this.#scrollView) {
				this.#scrollView.touchCancel(viewInputPosition);
			}
		}
		else if (this.#target && this.#pressDelivered) {
			this.#target.touchCancel(viewInputPosition);
		}
		this.reset();
	}

	//==============================================================================
	// 트래킹 상태 초기화.
	//==============================================================================
	reset() {
		if (this.#pressTimerId !== null) {
			System.clearTimeout(this.#pressTimerId);
			this.#pressTimerId = null;
		}
		this.#target = null;
		this.#scrollView = null;
		this.#pressPosition = null;
		this.#isDragging = false;
		this.#pressDelivered = false;
	}

	//==============================================================================
	// 노드의 부모 체인에서 UIScrollView 컴포넌트를 가진 가장 가까운 노드의
	// ScrollView 컴포넌트를 반환한다. 없으면 null.
	// - 단, target 이 자신이 컨트롤하는 ScrollView 의 위젯(getScrollView 보유)이면
	//   그 ScrollView 는 검색에서 제외한다. (스크롤바 자신은 자기 부모 ScrollView 의
	//   드래그 핸들러로 인계되면 안 되기 때문.)
	//==============================================================================
	/**
	 * @param { * } target
	 * @returns { UIScrollView | null }
	 */
	findAncestorScrollView(target) {
		if (!target) return null;
		const ownedScrollView = (typeof target.getScrollView === "function") ? target.getScrollView() : null;
		let node = typeof target.getParent === "function" ? target.getParent() : null;
		while (node) {
			if (typeof node.getComponent === "function") {
				const sv = node.getComponent(UIScrollView);
				if (sv && sv !== ownedScrollView) return sv;
			}
			node = typeof node.getParent === "function" ? node.getParent() : null;
		}
		return null;
	}
}
