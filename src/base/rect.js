//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VObject } from "./object.js";
import { VVector2 } from "./vector2.js";


//==============================================================================
// 사각 영역.
//==============================================================================
export class VRect extends VObject {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @public @type { VVector2 } */ position; // left-top.
	/** @public @type { VVector2 } */ size;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { VVector2 } position
	 * @param { VVector2 } size
	 */
	constructor() {
		super();

		this.position = VVector2.zero();
		this.size = VVector2.zero();
	}

	//==============================================================================
	// 겹치는지 여부.
	//==============================================================================
	/**
	 * @constructor
	 * @param { VVector2 | VRect } other
	 * @returns { boolean }
	 */
	overlaps(other) {
		if (other instanceof VVector2) {
			if (other.x < this.position.x || other.x > this.position.x + this.size.x)
				return false;
			if (other.y < this.position.y || other.y > this.position.y + this.size.y)
				return false;
			return true;
		}
		else if (other instanceof VRect) {
			if (this.position.x + this.size.x < other.position.x || this.position.x > other.position.x + other.size.x)
				return false;
			if (this.position.y + this.size.y < other.position.y || this.position.y > other.position.y + other.size.y)
				return false;
			return true;
		}
		
		throw new Error("Invalid type: 'other' must be an instance of VVector2 or VRect.");
	}

	//==============================================================================
	// 중앙 위치 설정.
	//==============================================================================
	/**
	 * @param { VVector2 } other
	 */
	set center(value) {
		this.position.x = value.x - this.width / 2;
		this.position.y = value.y - this.height / 2;
	}

	//==============================================================================
	// 가운데 반환.
	//==============================================================================
	/**
	 * @returns { VVector2 }
	 */
	get center() {
		const origin = this.position.clone();
		origin.x += this.width / 2;
		origin.y += this.height / 2;
		return origin;
	}

	//==============================================================================
	// 왼쪽 설정.
	//==============================================================================
	set left(value) {
		this.position.x = value;
	}

	//==============================================================================
	// 왼쪽 반환.
	//==============================================================================
	get left() {
		return this.position.x;
	}

	//==============================================================================
	// 위쪽 설정.
	//==============================================================================
	set top(value) {
		this.position.y = value;
	}

	//==============================================================================
	// 위쪽 반환.
	//==============================================================================
	get top() {
		return this.position.y;
	}

	//==============================================================================
	// 오른쪽 설정.
	//==============================================================================
	set right(value) {
		this.position.x = value - this.width;
	}
	
	//==============================================================================
	// 오른쪽 반환.
	//==============================================================================
	get right() {
		return this.position.x + this.width;
	}

	//==============================================================================
	// 아래쪽 설정.
	//==============================================================================
	set bottom(value) {
		this.position.y = value - this.height;
	}

	//==============================================================================
	// 아래쪽 반환.
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
			if (other instanceof VRect) {
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
	//  * @param { VVector2 } position
	//  * @param { VVector2 } size
	//  * @returns { VRect }
	//  */
	// static create(position, size) {
	// 	var obj = new VRect();
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
	 * @returns { VRect }
	 */
	static create(x, y, width, height) {
		var obj = new VRect();
		obj.position = VVector2.create(x, y);
		obj.size = VVector2.create(width, height);
		return obj;
	}

	//==============================================================================
	// 크기가 없는 빈 사각 영역 생성.
	//==============================================================================
	/**
	 * @returns { VRect }
	 */
	static zero() {
		return VRect.create(0, 0, 0, 0);
	}
}