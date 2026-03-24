// @ts-check
//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Object } from "./object.js";
import * as Math from "../base/math.js";


//==============================================================================
// 2차원 벡터.
//==============================================================================
export class Vector2 extends Object
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
			if (other instanceof Vector2) {
				if (this.x === other.x && this.y === other.y) {
					return true;
				}
			}
		}

		return false;
	}
	
	//==============================================================================
	// 대입.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 */
	set(x, y) {
		this.x = x;
		this.y = y;
	}

	//==============================================================================
	// 가로축 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getX() {
		return this.x;
	}

	//==============================================================================
	// 세로축 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getY() {
		return this.y;
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
	 * @returns { Vector2 }
	 */
	normalize() {
		const origin = Vector2.create(this.x, this.y);
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
	 * @param { Vector2 | number } other
	 * @returns { Vector2 }
	 */
	add(other) {
		const obj = this.clone();
		if (typeof other === "number") {
			obj.x += other;
			obj.y += other;
			return obj;
		}
		else if (other instanceof Vector2) {
			obj.x += other.x;
			obj.y += other.y;
			return obj;
		}
		
		throw new Error("Invalid type: 'other' must be a number or an instance of Vector2.");
	}

	//==============================================================================
	// 빼기.
	//==============================================================================
	/**
	 * @param { Vector2 | number } other
	 * @returns { Vector2 }
	 */
	subtract(other) {
		const obj = this.clone();
		if (typeof other === "number") {
			obj.x -= other;
			obj.y -= other;
			return obj;
		}
		else if (other instanceof Vector2) {
			obj.x -= other.x;
			obj.y -= other.y;
			return obj;
		}
		
		throw new Error("Invalid type: 'other' must be a number or an instance of Vector2.");
	}

	//==============================================================================
	// 곱하기.
	//==============================================================================
	/**
	 * @param { Vector2 | number } other
	 * @returns { Vector2 }
	 */
	multiply(other) {
		const obj = this.clone();
		if (typeof other === "number") {
			obj.x *= other;
			obj.y *= other;
			return obj;
		}
		else if (other instanceof Vector2) {
			obj.x *= other.x;
			obj.y *= other.y;
			return obj;
		}
		
		throw new Error("Invalid type: 'other' must be a number or an instance of Vector2.");
	}

	//==============================================================================
	// 나누기.
	//==============================================================================
	/**
	 * @param { Vector2 | number } other
	 * @returns { Vector2 }
	 */
	divide(other) {
		const obj = this.clone();
		if (typeof other === "number") {
			obj.x /= other;
			obj.y /= other;
			return obj;
		}
		else if (other instanceof Vector2) {
			obj.x /= other.x;
			obj.y /= other.y;
			return obj;
		}
		
		throw new Error("Invalid type: 'other' must be a number or an instance of Vector2.");
	}

	//==============================================================================
	// 나머지.
	//==============================================================================
	/**
	 * @param { Vector2 | number } other
	 * @returns { Vector2 }
	 */
	modulo(other) {
		const obj = this.clone();
		if (typeof other === "number") {
			obj.x /= other;
			obj.y /= other;
			return obj;
		}
		else if (other instanceof Vector2) {
			obj.x /= other.x;
			obj.y /= other.y;
			return obj;
		}
		
		throw new Error("Invalid type: 'other' must be a number or an instance of Vector2.");
	}

	//==============================================================================
	// 절반.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	half() {
		const obj = this.divide(0.5);
		return obj;
	}
	
	//==============================================================================
	// 빼기.
	//==============================================================================
	/**
	 * @param { Vector2 | number } other
	 * @returns { Vector2 }
	 */
	sub(other) {
		return this.subtract(other);
	}

	//==============================================================================
	// 곱하기.
	//==============================================================================
	/**
	 * @param { Vector2 | number } other
	 * @returns { Vector2 }
	 */
	mul(other) {
		return this.multiply(other);
	}

	//==============================================================================
	// 나누기.
	//==============================================================================
	/**
	 * @param { Vector2 | number } other
	 * @returns { Vector2 }
	 */
	div(other) {
		return this.divide(other);
	}

	//==============================================================================
	// 나머지.
	//==============================================================================
	/**
	 * @param { Vector2 | number } other
	 * @returns { Vector2 }
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
	 * @returns { Vector2 }
	 */
	static create(x, y) {
		var obj = new Vector2();
		obj.x = x;
		obj.y = y;
		return obj;
	}

	//==============================================================================
	// 0의 값을 가진 벡터 생성.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	static zero() {
		return Vector2.create(0, 0);
	}

	//==============================================================================
	// 1의 값을 가진 벡터 생성.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	static one() {
		return Vector2.create(1, 1);
	}

	//==============================================================================
	// 최대값 벡터 생성.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	static positiveInfinity() {
		return Vector2.create(Infinity, Infinity);
	}

	//==============================================================================
	// 최소값 벡터 생성.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	static negativeInfinity() {
		return Vector2.create(-Infinity, -Infinity);
	}

	//==============================================================================
	// 선형 보간.
	//==============================================================================
	/**
	 * @param { Vector2 } from
	 * @param { Vector2 } to
	 * @param { number } normalizedTime
	 * @returns { Vector2 }
	 */
	static lerp(from, to, normalizedTime) {		
		const x = Math.lerp(from.x, to.x, normalizedTime);
		const y = Math.lerp(from.y, to.y, normalizedTime);
		return Vector2.create(x, y);
	}
}