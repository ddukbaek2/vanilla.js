//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Object } from "./object.js";
import { Vector2 } from "./vector2.js";


//==============================================================================
// 사각 영역.
//==============================================================================
/**
 * @example <caption>점과 영역 검사, 겹친 영역 구하기</caption>
 * import { Rect, Vector2 } from "./build/vanilla.js";
 *
 * const panel = Rect.create(0, 0, 100, 50);
 * const button = Rect.create(80, 40, 40, 20);
 * const point = Vector2.create(10, 10);
 * console.log(panel.contains(point), panel.overlaps(button));
 * const overlap = panel.intersection(button);
 * console.log(overlap.left, overlap.top, overlap.width, overlap.height);
 * const bounds = panel.union(button);
 * console.log(bounds.right, bounds.bottom);
 */
export class Rect extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Vector2 } */ #position; // 좌상.
	/** @private @type { Vector2 } */ #size; // 좌상-우하.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { Vector2 } position
	 * @param { Vector2 } size
	 */
	constructor() {
		super();

		// 갓 만든 벡터라 setter 로 한 번 더 복제하지 않는다.
		this.#position = Vector2.zero();
		this.#size = Vector2.zero();
	}

	//==============================================================================
	// 동등성 비교.
	//==============================================================================
	/**
	 * @param { any } other 비교할 값.
	 * @returns { boolean } 같은 객체이거나 위치와 크기가 모두 같은 Rect 면 참.
	 */
	equals(other) {
		if (super.equals(other)) {
			return true;
		}
		
		if (other) {
			if (other instanceof Rect) {
				if (this.position.equals(other.position) && this.size.equals(other.size)) {
					return true;
				}
			}
		}

		return false;
	}

	//==============================================================================
	// 복제.
	//==============================================================================
	/**
	 * @override
	 * @returns { this } 위치와 크기가 같은 새 사각 영역.
	 */
	clone() {
		// const obj = super.clone();
		const obj = /** @type { this } */ (Rect.create(this.position.x, this.position.y, this.size.x, this.size.y));
		return obj;
	}

	//==============================================================================
	// 위치 설정 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { Vector2 } value
	 */
	set position(value) {
		this.#position = value.clone();
	}

	//==============================================================================
	// 위치 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { Vector2 } 좌상단 위치. (내부 벡터를 그대로 돌려준다)
	 */
	get position() {
		return this.#position;
	}

	//==============================================================================
	// 크기 설정 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { Vector2 } value
	 */
	set size(value) {
		this.#size = value.clone();
	}

	//==============================================================================
	// 크기 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { Vector2 } 가로, 세로 크기. (내부 벡터를 그대로 돌려준다)
	 */
	get size() {
		return this.#size;
	}

	//==============================================================================
	// 겹치는지 여부.
	//==============================================================================
	/**
	 * @param { Vector2 } value 검사할 점.
	 * @returns { boolean } 점이 영역 안이나 변 위에 있으면 참. (Vector2 가 아니면 거짓)
	 */
	contains(value) {
		if (value !== null && value !== undefined && value instanceof Vector2) {
			if (value.x < this.position.x || value.x > this.position.x + this.size.x)
				return false;
			if (value.y < this.position.y || value.y > this.position.y + this.size.y)
				return false;
			return true;
		}

		return false;
	}

	//==============================================================================
	// 겹치는지 여부.
	//==============================================================================
	/**
	 * @param { Rect } value 검사할 사각 영역.
	 * @returns { boolean } 겹치거나 변이 닿으면 참. (Rect 가 아니면 거짓)
	 */
	overlaps(value) {
		if (value !== null && value !== undefined && value instanceof Rect) {
			if (this.position.x + this.size.x < value.position.x || this.position.x > value.position.x + value.size.x)
				return false;
			if (this.position.y + this.size.y < value.position.y || this.position.y > value.position.y + value.size.y)
				return false;
			return true;
		}
		
		return false;
	}

	//==============================================================================
	// 가로 크기 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { number } value
	 */
	set width(value) {
		this.size.x = value;
	}

	//==============================================================================
	// 가로 크기 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number } 가로 크기.
	 */
	get width() {
		return this.size.x;
	}

	//==============================================================================
	// 세로 크기 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { number } value
	 */
	set height(value) {
		this.size.y = value;
	}

	//==============================================================================
	// 세로 크기 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number } 세로 크기.
	 */
	get height() {
		return this.size.y;
	}

	//==============================================================================
	// 최소 좌표 프로퍼티 (좌상단).
	//==============================================================================
	/**
	 * @property
	 * @param { Vector2 } value
	 */
	set min(value) {
		const oldMax = this.max;
		this.position.x = value.x;
		this.position.y = value.y;
		this.size.x = oldMax.x - this.position.x;
		this.size.y = oldMax.y - this.position.y;
	}

	//==============================================================================
	// 최소 좌표 프로퍼티 (좌상단).
	//==============================================================================
	/**
	 * @property
	 * @returns { Vector2 } 좌상단 좌표의 새 벡터.
	 */
	get min() {
		return Vector2.create(this.position.x, this.position.y);
	}

	//==============================================================================
	// 최대 좌표 프로퍼티 (우하단).
	//==============================================================================
	/**
	 * @property
	 * @param { Vector2 } value
	 */
	set max(value) {
		this.size.x = value.x - this.position.x;
		this.size.y = value.y - this.position.y;
	}

	//==============================================================================
	// 최대 좌표 프로퍼티 (우하단).
	//==============================================================================
	/**
	 * @property
	 * @returns { Vector2 } 우하단 좌표의 새 벡터.
	 */
	get max() {
		return Vector2.create(this.position.x + this.size.x, this.position.y + this.size.y);
	}

	//==============================================================================
	// 다른 사각형과 겹치는지. (변이 닿기만 한 것은 겹친 것이 아니다, overlaps 는 닿기만 해도 겹친 것으로 본다)
	//==============================================================================
	/**
	 * @param { Rect } other 검사할 사각 영역.
	 * @returns { boolean } 넓이가 있는 겹침이 있으면 참.
	 * @example <caption>변이 닿은 두 사각 영역 비교하기</caption>
	 * import { Rect } from "./build/vanilla.js";
	 *
	 * const leftRect = Rect.create(0, 0, 10, 10);
	 * const rightRect = Rect.create(10, 0, 10, 10);
	 * console.log(leftRect.overlaps(rightRect), leftRect.intersects(rightRect));
	 */
	intersects(other) {
		const rightX = this.position.x + this.size.x;
		const bottomY = this.position.y + this.size.y;
		const otherRightX = other.position.x + other.size.x;
		const otherBottomY = other.position.y + other.size.y;
		return this.position.x < otherRightX && rightX > other.position.x && this.position.y < otherBottomY && bottomY > other.position.y;
	}

	//==============================================================================
	// 교집합 (두 사각형이 겹치는 영역 반환).
	//==============================================================================
	/**
	 * @param { Rect } other 겹침을 구할 사각 영역.
	 * @returns { Rect } 겹친 부분의 새 사각 영역. (겹치지 않으면 Rect.zero())
	 */
	intersection(other) {
		if (!this.overlaps(other)) {
			return Rect.zero();
		}
		const x1 = Math.max(this.position.x, other.position.x);
		const y1 = Math.max(this.position.y, other.position.y);
		const x2 = Math.min(this.max.x, other.max.x);
		const y2 = Math.min(this.max.y, other.max.y);
		return Rect.create(x1, y1, x2 - x1, y2 - y1);
	}

	//==============================================================================
	// 합집합 (두 사각형을 모두 포함하는 최소 사각형 반환).
	//==============================================================================
	/**
	 * @param { Rect } other 합칠 사각 영역.
	 * @returns { Rect } 두 영역을 모두 담는 가장 작은 새 사각 영역.
	 */
	union(other) {
		const x1 = Math.min(this.position.x, other.position.x);
		const y1 = Math.min(this.position.y, other.position.y);
		const x2 = Math.max(this.max.x, other.max.x);
		const y2 = Math.max(this.max.y, other.max.y);
		return Rect.create(x1, y1, x2 - x1, y2 - y1);
	}

	//==============================================================================
	// 가운데 설정 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { Vector2 } value
	 */
	set center(value) {
		this.position.x = value.x - this.width / 2;
		this.position.y = value.y - this.height / 2;
	}

	//==============================================================================
	// 가운데 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { Vector2 } 가운데 좌표의 새 벡터.
	 */
	get center() {
		const origin = this.position.clone();
		origin.x += this.width / 2;
		origin.y += this.height / 2;
		return origin;
	}

	//==============================================================================
	// 왼쪽 설정 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { number } value
	 */
	set left(value) {
		this.position.x = value;
	}

	//==============================================================================
	// 왼쪽 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number } 왼쪽 X 좌표.
	 */
	get left() {
		return this.position.x;
	}

	//==============================================================================
	// 위쪽 설정 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { number } value
	 */
	set top(value) {
		this.position.y = value;
	}

	//==============================================================================
	// 위쪽 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number } 위쪽 Y 좌표.
	 */
	get top() {
		return this.position.y;
	}

	//==============================================================================
	// 오른쪽 설정 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { number } value
	 */
	set right(value) {
		this.position.x = value - this.width;
	}

	//==============================================================================
	// 오른쪽 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number } 오른쪽 X 좌표.
	 */
	get right() {
		return this.position.x + this.width;
	}

	//==============================================================================
	// 아래쪽 설정 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { number } value
	 */
	set bottom(value) {
		this.position.y = value - this.height;
	}

	//==============================================================================
	// 아래쪽 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number } 아래쪽 Y 좌표.
	 */
	get bottom() {
		return this.position.y + this.height;
	}

	// //==============================================================================
	// // 새로운 사각 영역 생성.
	// //==============================================================================
	// /**
	//  * @param { Vector2 } position
	//  * @param { Vector2 } size
	//  * @returns { Rect }
	//  */
	// static create(position, size) {
	// 	var obj = new Rect();
	// 	obj.position = position;
	// 	obj.size = size;
	// 	return obj;
	// }

	//==============================================================================
	// 새로운 사각 영역 생성.
	//==============================================================================
	/**
	 * @param { number } x 좌상단 X 좌표.
	 * @param { number } y 좌상단 Y 좌표.
	 * @param { number } width 가로 크기.
	 * @param { number } height 세로 크기.
	 * @returns { Rect } 새 사각 영역.
	 */
	static create(x, y, width, height) {
		// 생성자가 만든 벡터에 값만 적는다. (Vector2 를 새로 만들어 setter 로 다시 복제하지 않는다)
		var obj = new Rect();
		obj.position.set(x, y);
		obj.size.set(width, height);
		return obj;
	}

	//==============================================================================
	// 위치와 크기가 모두 0 인지. (Rect.zero() 와 같은지를 새 객체를 만들지 않고 본다)
	//==============================================================================
	/**
	 * @returns { boolean } 위치와 크기가 모두 0 이면 참.
	 */
	isZero() {
		return this.position.x === 0 && this.position.y === 0 && this.size.x === 0 && this.size.y === 0;
	}

	//==============================================================================
	// 크기가 없는 빈 사각 영역 생성.
	//==============================================================================
	/**
	 * @returns { Rect } 위치와 크기가 모두 0 인 사각 영역.
	 */
	static zero() {
		return Rect.create(0, 0, 0, 0);
	}

	//==============================================================================
	// 범위 제한.
	//==============================================================================
	/**
	 * @param { Rect } value 자를 사각 영역.
	 * @param { Rect } min 위치와 크기의 최솟값.
	 * @param { Rect } max 위치와 크기의 최댓값.
	 * @returns { Rect } 위치와 크기를 성분마다 자른 새 사각 영역.
	 */
	static clamp(value, min, max) {
		const position = Vector2.clamp(value.position, min.position, max.position);
		const size = Vector2.clamp(value.size, min.size, max.size);
		return Rect.create(position.x, position.y, size.x, size.y);
	}
}