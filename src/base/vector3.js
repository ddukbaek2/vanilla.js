//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "./object.js";
import * as Math from "./math.js";


//==============================================================================
// 3차원 벡터.
//==============================================================================
export class Vector3 extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #x;
	/** @private @type { number } */ #y;
	/** @private @type { number } */ #z;

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
		this.z = 0.0;
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
			if (other instanceof Vector3) {
				if (this.x === other.x && this.y === other.y && this.z === other.z) {
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
		const obj = /** @type { this } */ (Vector3.create(this.x, this.y, this.z));
		return obj;
	}

	//==============================================================================
	// X 좌표 설정 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { number } value
	 */
	set x(value) {
		this.#x = value;
	}

	//==============================================================================
	// X 좌표 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number }
	 */
	get x() {
		return this.#x;
	}

	//==============================================================================
	// Y 좌표 설정 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { number } value
	 */
	set y(value) {
		this.#y = value;
	}

	//==============================================================================
	// Y 좌표 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number }
	 */
	get y() {
		return this.#y;
	}

	//==============================================================================
	// Z 좌표 설정 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { number } value
	 */
	set z(value) {
		this.#z = value;
	}

	//==============================================================================
	// Z 좌표 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number }
	 */
	get z() {
		return this.#z;
	}

	//==============================================================================
	// 대입.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @param { number } z
	 */
	set(x, y, z) {
		this.x = x;
		this.y = y;
		this.z = z;
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
	// 깊이축 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getZ() {
		return this.z;
	}

	//==============================================================================
	// 길이.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	length() {
		const length = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
		return length;
	}

	//==============================================================================
	// 길이 제곱.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	lengthSquared() {
		const lengthSquared = this.x * this.x + this.y * this.y + this.z * this.z;
		return lengthSquared;
	}

	//==============================================================================
	// 정규화.
	//==============================================================================
	/**
	 * @returns { Vector3 }
	 */
	normalize() {
		const origin = Vector3.create(this.x, this.y, this.z);
		const length = this.length();
		if (length > 0)
		{
			origin.x /= length;
			origin.y /= length;
			origin.z /= length;
		}

		return origin;
	}

	//==============================================================================
	// 더하기.
	//==============================================================================
	/**
	 * @param { Vector3 | number } other
	 * @returns { Vector3 }
	 */
	add(other) {
		const origin = this.clone();
		if (typeof other === "number") {
			origin.x += other;
			origin.y += other;
			origin.z += other;
			return origin;
		}
		else if (other instanceof Vector3) {
			origin.x += other.x;
			origin.y += other.y;
			origin.z += other.z;
			return origin;
		}

		throw new Error("Invalid type: \"other\" must be a number or an instance of Vector3.");
	}

	//==============================================================================
	// 빼기.
	//==============================================================================
	/**
	 * @param { Vector3 | number } other
	 * @returns { Vector3 }
	 */
	subtract(other) {
		const origin = this.clone();
		if (typeof other === "number") {
			origin.x -= other;
			origin.y -= other;
			origin.z -= other;
			return origin;
		}
		else if (other instanceof Vector3) {
			origin.x -= other.x;
			origin.y -= other.y;
			origin.z -= other.z;
			return origin;
		}

		throw new Error("Invalid type: \"other\" must be a number or an instance of Vector3.");
	}

	//==============================================================================
	// 곱하기.
	//==============================================================================
	/**
	 * @param { Vector3 | number } other
	 * @returns { Vector3 }
	 */
	multiply(other) {
		const origin = this.clone();
		if (typeof other === "number") {
			origin.x *= other;
			origin.y *= other;
			origin.z *= other;
			return origin;
		}
		else if (other instanceof Vector3) {
			origin.x *= other.x;
			origin.y *= other.y;
			origin.z *= other.z;
			return origin;
		}

		throw new Error("Invalid type: \"other\" must be a number or an instance of Vector3.");
	}

	//==============================================================================
	// 나누기.
	//==============================================================================
	/**
	 * @param { Vector3 | number } other
	 * @returns { Vector3 }
	 */
	divide(other) {
		const origin = this.clone();
		if (typeof other === "number") {
			origin.x /= other;
			origin.y /= other;
			origin.z /= other;
			return origin;
		}
		else if (other instanceof Vector3) {
			origin.x /= other.x;
			origin.y /= other.y;
			origin.z /= other.z;
			return origin;
		}

		throw new Error("Invalid type: \"other\" must be a number or an instance of Vector3.");
	}

	//==============================================================================
	// 내적.
	//==============================================================================
	/**
	 * @param { Vector3 } other
	 * @returns { number }
	 */
	dot(other) {
		const dot = this.x * other.x + this.y * other.y + this.z * other.z;
		return dot;
	}

	//==============================================================================
	// 외적.
	//==============================================================================
	/**
	 * @param { Vector3 } other
	 * @returns { Vector3 }
	 */
	cross(other) {
		const crossX = this.y * other.z - this.z * other.y;
		const crossY = this.z * other.x - this.x * other.z;
		const crossZ = this.x * other.y - this.y * other.x;
		const cross = Vector3.create(crossX, crossY, crossZ);
		return cross;
	}

	//==============================================================================
	// 거리.
	//==============================================================================
	/**
	 * @param { Vector3 } other
	 * @returns { number }
	 */
	distance(other) {
		const difference = this.subtract(other);
		const distance = difference.length();
		return distance;
	}

	//==============================================================================
	// 생성. (정적)
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @param { number } z
	 * @returns { Vector3 }
	 */
	static create(x, y, z) {
		const vector = new Vector3();
		vector.set(x, y, z);
		return vector;
	}

	//==============================================================================
	// 영벡터 생성. (정적)
	//==============================================================================
	/**
	 * @returns { Vector3 }
	 */
	static zero() {
		const vector = Vector3.create(0.0, 0.0, 0.0);
		return vector;
	}

	//==============================================================================
	// 일벡터 생성. (정적)
	//==============================================================================
	/**
	 * @returns { Vector3 }
	 */
	static one() {
		const vector = Vector3.create(1.0, 1.0, 1.0);
		return vector;
	}

	//==============================================================================
	// 위쪽 단위벡터 생성. (정적)
	//==============================================================================
	/**
	 * @returns { Vector3 }
	 */
	static up() {
		const vector = Vector3.create(0.0, 1.0, 0.0);
		return vector;
	}

	//==============================================================================
	// 선형 보간. (정적)
	//==============================================================================
	/**
	 * @param { Vector3 } from
	 * @param { Vector3 } to
	 * @param { number } normalizedTime
	 * @returns { Vector3 }
	 */
	static lerp(from, to, normalizedTime) {
		const lerpX = Math.lerp(from.x, to.x, normalizedTime);
		const lerpY = Math.lerp(from.y, to.y, normalizedTime);
		const lerpZ = Math.lerp(from.z, to.z, normalizedTime);
		const vector = Vector3.create(lerpX, lerpY, lerpZ);
		return vector;
	}
}
