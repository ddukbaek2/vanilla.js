//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Object } from "./object.js";
import * as Math from "./math.js";


//==============================================================================
// 2차원 어파인 변환 행렬. (Canvas2D 호환 3x2 형식)
// - | a c e |
//   | b d f |
// - 점 변환: x' = a*x + c*y + e, y' = b*x + d*y + f
//==============================================================================
export class TransformMatrix extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #a;
	/** @private @type { number } */ #b;
	/** @private @type { number } */ #c;
	/** @private @type { number } */ #d;
	/** @private @type { number } */ #e;
	/** @private @type { number } */ #f;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();

		this.#a = 1;
		this.#b = 0;
		this.#c = 0;
		this.#d = 1;
		this.#e = 0;
		this.#f = 0;
	}

	//==============================================================================
	// a 성분 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number }
	 */
	get a() {
		return this.#a;
	}

	//==============================================================================
	// b 성분 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number }
	 */
	get b() {
		return this.#b;
	}

	//==============================================================================
	// c 성분 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number }
	 */
	get c() {
		return this.#c;
	}

	//==============================================================================
	// d 성분 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number }
	 */
	get d() {
		return this.#d;
	}

	//==============================================================================
	// e 성분 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number }
	 */
	get e() {
		return this.#e;
	}

	//==============================================================================
	// f 성분 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number }
	 */
	get f() {
		return this.#f;
	}

	//==============================================================================
	// 항등 행렬로 재설정.
	//==============================================================================
	setIdentity() {
		this.#a = 1;
		this.#b = 0;
		this.#c = 0;
		this.#d = 1;
		this.#e = 0;
		this.#f = 0;
	}

	//==============================================================================
	// 행렬 성분 직접 설정. (Canvas2D setTransform 인자 순서와 동일)
	//==============================================================================
	/**
	 * @param { number } a
	 * @param { number } b
	 * @param { number } c
	 * @param { number } d
	 * @param { number } e
	 * @param { number } f
	 */
	setTransform(a, b, c, d, e, f) {
		this.#a = a;
		this.#b = b;
		this.#c = c;
		this.#d = d;
		this.#e = e;
		this.#f = f;
	}

	//==============================================================================
	// 다른 행렬의 성분 복사.
	//==============================================================================
	/**
	 * @param { TransformMatrix } other
	 */
	copyFrom(other) {
		this.#a = other.a;
		this.#b = other.b;
		this.#c = other.c;
		this.#d = other.d;
		this.#e = other.e;
		this.#f = other.f;
	}

	//==============================================================================
	// 복제.
	//==============================================================================
	/**
	 * @override
	 * @returns { this }
	 */
	clone() {
		const transformMatrix = /** @type { this } */ (new TransformMatrix());
		transformMatrix.copyFrom(this);
		return transformMatrix;
	}

	//==============================================================================
	// 이동 변환 누적. (Canvas2D translate 와 동일한 로컬 공간 우측 곱)
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 */
	translate(x, y) {
		this.#e = this.#a * x + this.#c * y + this.#e;
		this.#f = this.#b * x + this.#d * y + this.#f;
	}

	//==============================================================================
	// 회전 변환 누적. (Canvas2D rotate 와 동일한 로컬 공간 우측 곱)
	//==============================================================================
	/**
	 * @param { number } radian
	 */
	rotate(radian) {
		const cosRadian = Math.cos(radian);
		const sinRadian = Math.sin(radian);
		const a = this.#a;
		const b = this.#b;
		const c = this.#c;
		const d = this.#d;
		this.#a = a * cosRadian + c * sinRadian;
		this.#b = b * cosRadian + d * sinRadian;
		this.#c = -a * sinRadian + c * cosRadian;
		this.#d = -b * sinRadian + d * cosRadian;
	}

	//==============================================================================
	// 크기 변환 누적. (Canvas2D scale 과 동일한 로컬 공간 우측 곱)
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 */
	scale(x, y) {
		this.#a = this.#a * x;
		this.#b = this.#b * x;
		this.#c = this.#c * y;
		this.#d = this.#d * y;
	}

	//==============================================================================
	// 다른 행렬을 우측에 곱해 누적. (this = this x other)
	//==============================================================================
	/**
	 * @param { TransformMatrix } other
	 */
	multiply(other) {
		const a = this.#a;
		const b = this.#b;
		const c = this.#c;
		const d = this.#d;
		const e = this.#e;
		const f = this.#f;
		this.#a = a * other.a + c * other.b;
		this.#b = b * other.a + d * other.b;
		this.#c = a * other.c + c * other.d;
		this.#d = b * other.c + d * other.d;
		this.#e = a * other.e + c * other.f + e;
		this.#f = b * other.e + d * other.f + f;
	}

	//==============================================================================
	// 점 변환.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @returns { { x: number, y: number } }
	 */
	transformPoint(x, y) {
		const transformedX = this.#a * x + this.#c * y + this.#e;
		const transformedY = this.#b * x + this.#d * y + this.#f;
		return { x: transformedX, y: transformedY };
	}

	//==============================================================================
	// 행렬이 담고 있는 축별 스케일 중 최대값 반환. (텍스트 선명도 계산용)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getMaximumScale() {
		const scaleX = Math.sqrt(this.#a * this.#a + this.#b * this.#b);
		const scaleY = Math.sqrt(this.#c * this.#c + this.#d * this.#d);
		return Math.max(scaleX, scaleY);
	}

	//==============================================================================
	// mat3 유니폼 업로드용 열우선(column-major) 배열 기록.
	//==============================================================================
	/**
	 * @param { Float32Array } target
	 */
	writeToFloat32Array(target) {
		target[0] = this.#a;
		target[1] = this.#b;
		target[2] = 0;
		target[3] = this.#c;
		target[4] = this.#d;
		target[5] = 0;
		target[6] = this.#e;
		target[7] = this.#f;
		target[8] = 1;
	}
}
