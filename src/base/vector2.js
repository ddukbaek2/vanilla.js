// @ts-check
//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VObject } from "./object.js";


//==============================================================================
// 2차원 벡터.
//==============================================================================
export class VVector2 extends VObject
{
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @public @type { number } */ x;
	/** @public @type { number } */ y;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();

		this.x = 0.0;
		this.y = 0.0;
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
			if (other instanceof VVector2) {
				if (this.x === other.x && this.y === other.y) {
					return true;
				}
			}
		}

		return false;
	}

	//==============================================================================
	// 길이.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	length() {
		const length = Math.sqrt(this.x * this.x + this.y * this.y);
		return length;
	}

	//==============================================================================
	// 정규화.
	//==============================================================================
	/**
	 * @returns { VVector2 }
	 */
	normalize() {
		const origin = VVector2.create(this.x, this.y);
		const length = this.length();		
		if (length > 0)
		{
			origin.x /= length;
			origin.y /= length;
		}

		return origin;
	}

	//==============================================================================
	// 더하기.
	//==============================================================================
	/**
	 * @param { VVector2 | number } other
	 * @returns { VVector2 }
	 */
	add(other) {
		const obj = this.clone();
		if (typeof other === "number") {
			obj.x += other;
			obj.y += other;
			return obj;
		}
		else if (other instanceof VVector2) {
			obj.x += other.x;
			obj.y += other.y;
			return obj;
		}
		
		throw new Error("Invalid type: 'other' must be a number or an instance of VVector2.");
	}

	//==============================================================================
	// 빼기.
	//==============================================================================
	/**
	 * @param { VVector2 | number } other
	 * @returns { VVector2 }
	 */
	subtract(other) {
		const obj = this.clone();
		if (typeof other === "number") {
			obj.x -= other;
			obj.y -= other;
			return obj;
		}
		else if (other instanceof VVector2) {
			obj.x -= other.x;
			obj.y -= other.y;
			return obj;
		}
		
		throw new Error("Invalid type: 'other' must be a number or an instance of VVector2.");
	}

	//==============================================================================
	// 곱하기.
	//==============================================================================
	/**
	 * @param { VVector2 | number } other
	 * @returns { VVector2 }
	 */
	multiply(other) {
		const obj = this.clone();
		if (typeof other === "number") {
			obj.x *= other;
			obj.y *= other;
			return obj;
		}
		else if (other instanceof VVector2) {
			obj.x *= other.x;
			obj.y *= other.y;
			return obj;
		}
		
		throw new Error("Invalid type: 'other' must be a number or an instance of VVector2.");
	}

	//==============================================================================
	// 나누기.
	//==============================================================================
	/**
	 * @param { VVector2 | number } other
	 * @returns { VVector2 }
	 */
	divide(other) {
		const obj = this.clone();
		if (typeof other === "number") {
			obj.x /= other;
			obj.y /= other;
			return obj;
		}
		else if (other instanceof VVector2) {
			obj.x /= other.x;
			obj.y /= other.y;
			return obj;
		}
		
		throw new Error("Invalid type: 'other' must be a number or an instance of VVector2.");
	}

	//==============================================================================
	// 나머지.
	//==============================================================================
	/**
	 * @param { VVector2 | number } other
	 * @returns { VVector2 }
	 */
	modulo(other) {
		const obj = this.clone();
		if (typeof other === "number") {
			obj.x /= other;
			obj.y /= other;
			return obj;
		}
		else if (other instanceof VVector2) {
			obj.x /= other.x;
			obj.y /= other.y;
			return obj;
		}
		
		throw new Error("Invalid type: 'other' must be a number or an instance of VVector2.");
	}

	//==============================================================================
	// 빼기.
	//==============================================================================
	/**
	 * @param { VVector2 | number } other
	 * @returns { VVector2 }
	 */
	sub(other) {
		return this.subtract(other);
	}

	//==============================================================================
	// 곱하기.
	//==============================================================================
	/**
	 * @param { VVector2 | number } other
	 * @returns { VVector2 }
	 */
	mul(other) {
		return this.multiply(other);
	}

	//==============================================================================
	// 나누기.
	//==============================================================================
	/**
	 * @param { VVector2 | number } other
	 * @returns { VVector2 }
	 */
	div(other) {
		return this.divide(other);
	}

	//==============================================================================
	// 나머지.
	//==============================================================================
	/**
	 * @param { VVector2 | number } other
	 * @returns { VVector2 }
	 */
	mod(other) {
		return this.modulo(other);
	}

	// //==============================================================================
	// // 내적.
	// //==============================================================================
	// dot() {

	// }

	// //==============================================================================
	// // 외적.
	// //==============================================================================
	// cross() {
	// }
	
	//==============================================================================
	// 새로운 벡터 생성.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @returns { VVector2 }
	 */
	static create(x, y) {
		var obj = new VVector2();
		obj.x = x;
		obj.y = y;
		return obj;
	}

	//==============================================================================
	// 0의 값을 가진 벡터 생성.
	//==============================================================================
	/**
	 * @returns { VVector2 }
	 */
	static zero() {
		return VVector2.create(0, 0);
	}

	//==============================================================================
	// 1의 값을 가진 벡터 생성.
	//==============================================================================
	/**
	 * @returns { VVector2 }
	 */
	static one() {
		return VVector2.create(1, 1);
	}
}