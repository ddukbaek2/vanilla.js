//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Object } from "./object.js";
import * as Math from "./math.js";


//==============================================================================
// 2차원 벡터.
//==============================================================================
export class Vector2 extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #x;
	/** @private @type { number } */ #y;

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
	// 복제.
	//==============================================================================
	/**
	 * @override
	 * @returns { this }
	 */
	clone() {
		// const obj = super.clone();
		const obj = /** @type { this } */ (Vector2.create(this.x, this.y));
		return obj;
	}
	
	//==============================================================================
	// X 좌표 설정 프로퍼티.
	//==============================================================================
	/**
	 * @param { number } value
	 */
	set x(value) {
		this.#x = value;
	}

	//==============================================================================
	// X 좌표 반환 프로퍼티.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	get x() {
		return this.#x;
	}

	//==============================================================================
	// Y 좌표 설정 프로퍼티.
	//==============================================================================
	/**
	 * @param { number } value
	 */
	set y(value) {
		this.#y = value;
	}

	//==============================================================================
	// Y 좌표 반환 프로퍼티.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	get y() {
		return this.#y;
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
		const origin = this.clone();
		if (typeof other === "number") {
			origin.x += other;
			origin.y += other;
			return origin;
		}
		else if (other instanceof Vector2) {
			origin.x += other.x;
			origin.y += other.y;
			return origin;
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
		const origin = this.clone();
		if (typeof other === "number") {
			origin.x -= other;
			origin.y -= other;
			return origin;
		}
		else if (other instanceof Vector2) {
			origin.x -= other.x;
			origin.y -= other.y;
			return origin;
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
		const origin = this.clone();
		if (typeof other === "number") {
			origin.x *= other;
			origin.y *= other;
			return origin;
		}
		else if (other instanceof Vector2) {
			origin.x *= other.x;
			origin.y *= other.y;
			return origin;
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
		const origin = this.clone();
		if (typeof other === "number") {
			origin.x /= other;
			origin.y /= other;
			return origin;
		}
		else if (other instanceof Vector2) {
			origin.x /= other.x;
			origin.y /= other.y;
			return origin;
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
		const origin = this.clone();
		if (typeof other === "number") {
			origin.x /= other;
			origin.y /= other;
			return origin;
		}
		else if (other instanceof Vector2) {
			origin.x /= other.x;
			origin.y /= other.y;
			return origin;
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
	// 내적.
	//==============================================================================
	/**
	 * @param { Vector2 } other
	 * @returns { number }
	 */
	dot(other) {
		return this.x * other.x + this.y * other.y;
	}

	//==============================================================================
	// 외적 (2D cross product -> 스칼라 반환).
	//==============================================================================
	/**
	 * @param { Vector2 } other
	 * @returns { number }
	 */
	cross(other) {
		return this.x * other.y - this.y * other.x;
	}

	//==============================================================================
	// 두 벡터 사이의 거리.
	//==============================================================================
	/**
	 * @param { Vector2 } other
	 * @returns { number }
	 */
	distance(other) {
		const dx = this.x - other.x;
		const dy = this.y - other.y;
		return Math.sqrt(dx * dx + dy * dy);
	}

	//==============================================================================
	// 길이의 제곱 (루트 연산 최적화).
	//==============================================================================
	/**
	 * @returns { number }
	 */
	lengthSquared() {
		return this.x * this.x + this.y * this.y;
	}

	//==============================================================================
	// 두 벡터 사이의 각도 반환 (라디안).
	//==============================================================================
	/**
	 * @param { Vector2 } other
	 * @returns { number }
	 */
	angle(other) {
		return Math.acos(this.dot(other) / (this.length() * other.length()));
	}
	
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

	//==============================================================================
	// 범위 제한.
	//==============================================================================
	/**
	 * @param { Vector2 } value
	 * @param { Vector2 } min
	 * @param { Vector2 } max
	 * @returns { Vector2 }
	 */
	static clamp(value, min, max) {
		const x = Math.clamp(value.x, min.x, max.x);
		const y = Math.clamp(value.y, min.y, max.y);
		return Vector2.create(x, y);
	}
}