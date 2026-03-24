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
	/** @public @type { Vector2 } */ position; // 좌상.
	/** @public @type { Vector2 } */ size; // 좌상-우하.

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
	// 겹치는지 여부.
	//==============================================================================
	/**
	 * @constructor
	 * @param { Vector2 | Rect } other
	 * @returns { boolean }
	 */
	overlaps(other) {
		if (other instanceof Vector2) {
			if (other.x < this.position.x || other.x > this.position.x + this.size.x)
				return false;
			if (other.y < this.position.y || other.y > this.position.y + this.size.y)
				return false;
			return true;
		}
		else if (other instanceof Rect) {
			if (this.position.x + this.size.x < other.position.x || this.position.x > other.position.x + other.size.x)
				return false;
			if (this.position.y + this.size.y < other.position.y || this.position.y > other.position.y + other.size.y)
				return false;
			return true;
		}
		
		throw new Error("Invalid type: 'other' must be an instance of Vector2 or Rect.");
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

	//==============================================================================
	// 비교.
	//==============================================================================
	/**
	 * @override
	 * @method
	 * @public
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
}