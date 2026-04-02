//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Object } from "./object.js";
import { Vector2 } from "./vector2.js";


//==============================================================================
// 사각 영역.
//==============================================================================
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

		this.position = Vector2.zero();
		this.size = Vector2.zero();
	}

	//==============================================================================
	// 동등성 비교.
	//==============================================================================
	/**
	 * @param { any } other
	 * @returns { boolean }
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
	 * @returns { this }
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
	 * @param { Vector2 } value
	 */
	set position(value) {
		this.#position = value;
	}

	//==============================================================================
	// 위치 반환 프로퍼티.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	get position() {
		return this.#position;
	}

	//==============================================================================
	// 크기 설정 프로퍼티.
	//==============================================================================
	/**
	 * @param { Vector2 } value
	 */
	set size(value) {
		this.#size = value;
	}

	//==============================================================================
	// 크기 반환 프로퍼티.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	get size() {
		return this.#size;
	}

	//==============================================================================
	// 겹치는지 여부.
	//==============================================================================
	/**
	 * @param { Vector2 } value
	 * @returns { boolean }
	 */
	contains(value) {
		if (value !== null && canvas !== undefined && value instanceof Vector2) {
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
	 * @param { Rect } value
	 * @returns { boolean }
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
	 * @param { number } value
	 */
	set width(value) {
		this.size.x = value;
	}

	/**
	 * @returns { number }
	 */
	get width() {
		return this.size.x;
	}

	//==============================================================================
	// 세로 크기 프로퍼티.
	//==============================================================================
	/**
	 * @param { number } value
	 */
	set height(value) {
		this.size.y = value;
	}

	/**
	 * @returns { number }
	 */
	get height() {
		return this.size.y;
	}

	//==============================================================================
	// 최소 좌표 프로퍼티 (좌상단).
	//==============================================================================
	/**
	 * @param { Vector2 } value
	 */
	set min(value) {
		const oldMax = this.max;
		this.position.x = value.x;
		this.position.y = value.y;
		this.size.x = oldMax.x - this.position.x;
		this.size.y = oldMax.y - this.position.y;
	}

	/**
	 * @returns { Vector2 }
	 */
	get min() {
		return Vector2.create(this.position.x, this.position.y);
	}

	//==============================================================================
	// 최대 좌표 프로퍼티 (우하단).
	//==============================================================================
	/**
	 * @param { Vector2 } value
	 */
	set max(value) {
		this.size.x = value.x - this.position.x;
		this.size.y = value.y - this.position.y;
	}

	/**
	 * @returns { Vector2 }
	 */
	get max() {
		return Vector2.create(this.position.x + this.size.x, this.position.y + this.size.y);
	}

	//==============================================================================
	// 교집합 (두 사각형이 겹치는 영역 반환).
	//==============================================================================
	/**
	 * @param { Rect } other
	 * @returns { Rect }
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
	 * @param { Rect } other
	 * @returns { Rect }
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
	 * @param { Vector2 } other
	 */
	set center(value) {
		this.position.x = value.x - this.width / 2;
		this.position.y = value.y - this.height / 2;
	}

	//==============================================================================
	// 가운데 반환 프로퍼티.
	//==============================================================================
	/**
	 * @returns { Vector2 }
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
	set left(value) {
		this.position.x = value;
	}

	//==============================================================================
	// 왼쪽 반환 프로퍼티.
	//==============================================================================
	get left() {
		return this.position.x;
	}

	//==============================================================================
	// 위쪽 설정 프로퍼티.
	//==============================================================================
	set top(value) {
		this.position.y = value;
	}

	//==============================================================================
	// 위쪽 반환 프로퍼티.
	//==============================================================================
	get top() {
		return this.position.y;
	}

	//==============================================================================
	// 오른쪽 설정 프로퍼티.
	//==============================================================================
	set right(value) {
		this.position.x = value - this.width;
	}
	
	//==============================================================================
	// 오른쪽 반환 프로퍼티.
	//==============================================================================
	get right() {
		return this.position.x + this.width;
	}

	//==============================================================================
	// 아래쪽 설정 프로퍼티.
	//==============================================================================
	set bottom(value) {
		this.position.y = value - this.height;
	}

	//==============================================================================
	// 아래쪽 반환 프로퍼티.
	//==============================================================================
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
	 * @param { number } x
	 * @param { number } y
	 * @param { number } width
	 * @param { number } height
	 * @returns { Rect }
	 */
	static create(x, y, width, height) {
		var obj = new Rect();
		obj.position = Vector2.create(x, y);
		obj.size = Vector2.create(width, height);
		return obj;
	}

	//==============================================================================
	// 크기가 없는 빈 사각 영역 생성.
	//==============================================================================
	/**
	 * @returns { Rect }
	 */
	static zero() {
		return Rect.create(0, 0, 0, 0);
	}

	//==============================================================================
	// 범위 제한.
	//==============================================================================
	/**
	 * @param { Rect } value
	 * @param { Rect } min
	 * @param { Rect } max
	 * @returns { Rect }
	 */
	static clamp(value, min, max) {
		const position = Vector2.clamp(value.position, min.position, max.position);
		const size = Vector2.clamp(value.size, min.size, max.size);
		return Rect.create(position.x, position.y, size.x, size.y);
	}
}