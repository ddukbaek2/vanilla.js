//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "./object.js";
import * as Math from "./math.js";


//==============================================================================
// 쿼터니언. (3차원 회전 — 골격 애니메이션 보간의 기본 단위)
//==============================================================================
export class Quaternion extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #x;
	/** @private @type { number } */ #y;
	/** @private @type { number } */ #z;
	/** @private @type { number } */ #w;

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
		this.w = 1.0;
	}

	//==============================================================================
	// 복제.
	//==============================================================================
	/**
	 * @override
	 * @returns { this }
	 */
	clone() {
		const obj = /** @type { this } */ (Quaternion.create(this.x, this.y, this.z, this.w));
		return obj;
	}

	//==============================================================================
	// X 성분 설정 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { number } value
	 */
	set x(value) {
		this.#x = value;
	}

	//==============================================================================
	// X 성분 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number }
	 */
	get x() {
		return this.#x;
	}

	//==============================================================================
	// Y 성분 설정 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { number } value
	 */
	set y(value) {
		this.#y = value;
	}

	//==============================================================================
	// Y 성분 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number }
	 */
	get y() {
		return this.#y;
	}

	//==============================================================================
	// Z 성분 설정 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { number } value
	 */
	set z(value) {
		this.#z = value;
	}

	//==============================================================================
	// Z 성분 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number }
	 */
	get z() {
		return this.#z;
	}

	//==============================================================================
	// W 성분 설정 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { number } value
	 */
	set w(value) {
		this.#w = value;
	}

	//==============================================================================
	// W 성분 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number }
	 */
	get w() {
		return this.#w;
	}

	//==============================================================================
	// 대입.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @param { number } z
	 * @param { number } w
	 */
	set(x, y, z, w) {
		this.x = x;
		this.y = y;
		this.z = z;
		this.w = w;
	}

	//==============================================================================
	// 정규화.
	//==============================================================================
	/**
	 * @returns { Quaternion }
	 */
	normalize() {
		const length = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
		if (length > 0) {
			const quaternion = Quaternion.create(this.x / length, this.y / length, this.z / length, this.w / length);
			return quaternion;
		}
		const identity = Quaternion.identity();
		return identity;
	}

	//==============================================================================
	// 곱하기. (this 회전 뒤에 other 회전을 로컬로 누적)
	//==============================================================================
	/**
	 * @param { Quaternion } other
	 * @returns { Quaternion }
	 */
	multiply(other) {
		const resultX = this.w * other.x + this.x * other.w + this.y * other.z - this.z * other.y;
		const resultY = this.w * other.y - this.x * other.z + this.y * other.w + this.z * other.x;
		const resultZ = this.w * other.z + this.x * other.y - this.y * other.x + this.z * other.w;
		const resultW = this.w * other.w - this.x * other.x - this.y * other.y - this.z * other.z;
		const result = Quaternion.create(resultX, resultY, resultZ, resultW);
		return result;
	}

	//==============================================================================
	// 생성. (정적)
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @param { number } z
	 * @param { number } w
	 * @returns { Quaternion }
	 */
	static create(x, y, z, w) {
		const quaternion = new Quaternion();
		quaternion.set(x, y, z, w);
		return quaternion;
	}

	//==============================================================================
	// 단위 쿼터니언 생성. (정적)
	//==============================================================================
	/**
	 * @returns { Quaternion }
	 */
	static identity() {
		const quaternion = Quaternion.create(0.0, 0.0, 0.0, 1.0);
		return quaternion;
	}

	//==============================================================================
	// 오일러 각으로 생성. (정적 — XYZ 순서 라디안)
	//==============================================================================
	/**
	 * @param { number } xRadian
	 * @param { number } yRadian
	 * @param { number } zRadian
	 * @returns { Quaternion }
	 */
	static createFromEuler(xRadian, yRadian, zRadian) {
		const halfX = xRadian * 0.5;
		const halfY = yRadian * 0.5;
		const halfZ = zRadian * 0.5;
		const cosX = Math.cos(halfX);
		const sinX = Math.sin(halfX);
		const cosY = Math.cos(halfY);
		const sinY = Math.sin(halfY);
		const cosZ = Math.cos(halfZ);
		const sinZ = Math.sin(halfZ);
		const quaternion = Quaternion.create(
			sinX * cosY * cosZ + cosX * sinY * sinZ,
			cosX * sinY * cosZ - sinX * cosY * sinZ,
			cosX * cosY * sinZ + sinX * sinY * cosZ,
			cosX * cosY * cosZ - sinX * sinY * sinZ
		);
		return quaternion;
	}

	//==============================================================================
	// 구면 선형 보간. (정적 — 최단 경로)
	//==============================================================================
	/**
	 * @param { Quaternion } from
	 * @param { Quaternion } to
	 * @param { number } normalizedTime
	 * @returns { Quaternion }
	 */
	static slerp(from, to, normalizedTime) {
		let dotProduct = from.x * to.x + from.y * to.y + from.z * to.z + from.w * to.w;
		let toX = to.x;
		let toY = to.y;
		let toZ = to.z;
		let toW = to.w;
		if (dotProduct < 0) {
			dotProduct = -dotProduct;
			toX = -toX;
			toY = -toY;
			toZ = -toZ;
			toW = -toW;
		}

		let fromWeight = 1 - normalizedTime;
		let toWeight = normalizedTime;
		if (dotProduct < 0.9995) {
			const angle = Math.acos(Math.clamp(dotProduct, -1, 1));
			const sinAngle = Math.sin(angle);
			fromWeight = Math.sin((1 - normalizedTime) * angle) / sinAngle;
			toWeight = Math.sin(normalizedTime * angle) / sinAngle;
		}

		const blended = Quaternion.create(
			from.x * fromWeight + toX * toWeight,
			from.y * fromWeight + toY * toWeight,
			from.z * fromWeight + toZ * toWeight,
			from.w * fromWeight + toW * toWeight
		);
		const normalized = blended.normalize();
		return normalized;
	}
}
