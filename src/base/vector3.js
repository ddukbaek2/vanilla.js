//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "./object.js";
import * as Math from "./math.js";


//==============================================================================
// 3차원 벡터.
//==============================================================================
/**
 * @example <caption>만들고 외적, 정규화하기</caption>
 * import { Vector3 } from "./build/vanilla.js";
 *
 * const right = Vector3.create(1, 0, 0);
 * const up = Vector3.up();
 * const forward = right.cross(up);
 * const offset = Vector3.create(3, 0, 4);
 * const direction = offset.normalize();
 * console.log(forward.x, forward.y, forward.z);
 * console.log(direction.x, direction.z, direction.length());
 */
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
	 * @param { any } other 비교할 값.
	 * @returns { boolean } 같은 객체이거나 x, y, z 가 모두 같은 Vector3 면 참.
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
	 * @returns { this } x, y, z 가 같은 새 벡터.
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
	 * @returns { number } X 좌표.
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
	 * @returns { number } Y 좌표.
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
	 * @returns { number } Z 좌표.
	 */
	get z() {
		return this.#z;
	}

	//==============================================================================
	// 대입.
	//==============================================================================
	/**
	 * @param { number } x X 좌표.
	 * @param { number } y Y 좌표.
	 * @param { number } z Z 좌표.
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
	 * @returns { number } X 좌표.
	 */
	getX() {
		return this.x;
	}

	//==============================================================================
	// 세로축 반환.
	//==============================================================================
	/**
	 * @returns { number } Y 좌표.
	 */
	getY() {
		return this.y;
	}

	//==============================================================================
	// 깊이축 반환.
	//==============================================================================
	/**
	 * @returns { number } Z 좌표.
	 */
	getZ() {
		return this.z;
	}

	//==============================================================================
	// 길이.
	//==============================================================================
	/**
	 * @returns { number } 벡터의 길이.
	 */
	length() {
		const length = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
		return length;
	}

	//==============================================================================
	// 길이 제곱.
	//==============================================================================
	/**
	 * @returns { number } 길이의 제곱.
	 */
	lengthSquared() {
		const lengthSquared = this.x * this.x + this.y * this.y + this.z * this.z;
		return lengthSquared;
	}

	//==============================================================================
	// 정규화.
	//==============================================================================
	/**
	 * @returns { Vector3 } 길이를 1 로 맞춘 새 벡터. (길이가 0 이면 그대로 복사한다)
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
	 * @param { Vector3 | number } other 더할 벡터나 수. (수면 세 성분에 같은 수를 더한다, 그 밖의 꼴이면 오류를 던진다)
	 * @returns { Vector3 } 계산한 새 벡터. (자신은 바뀌지 않는다)
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
	 * @param { Vector3 | number } other 뺄 벡터나 수. (수면 세 성분에 같은 수를 뺀다, 그 밖의 꼴이면 오류를 던진다)
	 * @returns { Vector3 } 계산한 새 벡터. (자신은 바뀌지 않는다)
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
	 * @param { Vector3 | number } other 곱할 벡터나 수. (수면 세 성분에 같은 수를 곱한다, 그 밖의 꼴이면 오류를 던진다)
	 * @returns { Vector3 } 계산한 새 벡터. (자신은 바뀌지 않는다)
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
	 * @param { Vector3 | number } other 나눌 벡터나 수. (수면 세 성분을 같은 수로 나눈다, 그 밖의 꼴이면 오류를 던진다)
	 * @returns { Vector3 } 계산한 새 벡터. (자신은 바뀌지 않는다)
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
	// 수 더하기. (모든 성분에 같은 수, add(number) 와 같다)
	//==============================================================================
	/**
	 * @param { number } scalar 더할 수.
	 * @returns { Vector3 } 계산한 새 벡터.
	 */
	addScalar(scalar) {
		const result = this.add(scalar);
		return result;
	}

	//==============================================================================
	// 수 빼기. (모든 성분에 같은 수, subtract(number) 와 같다)
	//==============================================================================
	/**
	 * @param { number } scalar 뺄 수.
	 * @returns { Vector3 } 계산한 새 벡터.
	 */
	subtractScalar(scalar) {
		const result = this.subtract(scalar);
		return result;
	}

	//==============================================================================
	// 수 곱하기. (모든 성분에 같은 수, multiply(number) 와 같다)
	//==============================================================================
	/**
	 * @param { number } scalar 곱할 수.
	 * @returns { Vector3 } 계산한 새 벡터.
	 */
	multiplyScalar(scalar) {
		const result = this.multiply(scalar);
		return result;
	}

	//==============================================================================
	// 수 나누기. (모든 성분에 같은 수, divide(number) 와 같다)
	//==============================================================================
	/**
	 * @param { number } scalar 나눌 수.
	 * @returns { Vector3 } 계산한 새 벡터.
	 */
	divideScalar(scalar) {
		const result = this.divide(scalar);
		return result;
	}

	//==============================================================================
	// 내적.
	//==============================================================================
	/**
	 * @param { Vector3 } other 내적할 벡터.
	 * @returns { number } 내적 값.
	 */
	dot(other) {
		const dot = this.x * other.x + this.y * other.y + this.z * other.z;
		return dot;
	}

	//==============================================================================
	// 외적.
	//==============================================================================
	/**
	 * @param { Vector3 } other 외적할 벡터.
	 * @returns { Vector3 } this 와 other 에 수직인 새 벡터. (this × other)
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
	 * @param { Vector3 } other 거리를 잴 벡터.
	 * @returns { number } 두 점 사이의 거리.
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
	 * @param { number } x X 좌표.
	 * @param { number } y Y 좌표.
	 * @param { number } z Z 좌표.
	 * @returns { Vector3 } 새 벡터.
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
	 * @returns { Vector3 } (0, 0, 0) 벡터.
	 */
	static zero() {
		const vector = Vector3.create(0.0, 0.0, 0.0);
		return vector;
	}

	//==============================================================================
	// 일벡터 생성. (정적)
	//==============================================================================
	/**
	 * @returns { Vector3 } (1, 1, 1) 벡터.
	 */
	static one() {
		const vector = Vector3.create(1.0, 1.0, 1.0);
		return vector;
	}

	//==============================================================================
	// 위쪽 단위벡터 생성. (정적)
	//==============================================================================
	/**
	 * @returns { Vector3 } (0, 1, 0) 벡터.
	 */
	static up() {
		const vector = Vector3.create(0.0, 1.0, 0.0);
		return vector;
	}

	//==============================================================================
	// 선형 보간. (정적)
	//==============================================================================
	/**
	 * @param { Vector3 } from 시작 벡터.
	 * @param { Vector3 } to 끝 벡터.
	 * @param { number } normalizedTime 0 이면 from, 1 이면 to. (0 ~ 1 밖이어도 자르지 않고 늘여 보간한다)
	 * @returns { Vector3 } 보간한 새 벡터.
	 */
	static lerp(from, to, normalizedTime) {
		const lerpX = Math.lerp(from.x, to.x, normalizedTime);
		const lerpY = Math.lerp(from.y, to.y, normalizedTime);
		const lerpZ = Math.lerp(from.z, to.z, normalizedTime);
		const vector = Vector3.create(lerpX, lerpY, lerpZ);
		return vector;
	}
}
