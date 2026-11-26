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
/**
 * @example <caption>이동과 회전을 쌓아 점 변환하기</caption>
 * import { TransformMatrix } from "./build/vanilla.js";
 *
 * const transformMatrix = new TransformMatrix();
 * transformMatrix.translate(10, 20);
 * transformMatrix.scale(2, 2);
 * const point = transformMatrix.transformPoint(1, 1);
 * console.log(point.x, point.y);
 */
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
	 * @returns { number } a 성분. (x 의 x 방향 크기, 가로 배율 겸 회전 성분)
	 */
	get a() {
		return this.#a;
	}

	//==============================================================================
	// b 성분 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number } b 성분. (x 의 y 방향 기울기, 회전 성분)
	 */
	get b() {
		return this.#b;
	}

	//==============================================================================
	// c 성분 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number } c 성분. (y 의 x 방향 기울기, 회전 성분)
	 */
	get c() {
		return this.#c;
	}

	//==============================================================================
	// d 성분 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number } d 성분. (y 의 y 방향 크기, 세로 배율 겸 회전 성분)
	 */
	get d() {
		return this.#d;
	}

	//==============================================================================
	// e 성분 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number } e 성분. (x 방향 이동량)
	 */
	get e() {
		return this.#e;
	}

	//==============================================================================
	// f 성분 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number } f 성분. (y 방향 이동량)
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
	 * @param { number } a 행렬의 a 성분.
	 * @param { number } b 행렬의 b 성분.
	 * @param { number } c 행렬의 c 성분.
	 * @param { number } d 행렬의 d 성분.
	 * @param { number } e 행렬의 e 성분. (x 방향 이동량)
	 * @param { number } f 행렬의 f 성분. (y 방향 이동량)
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
	 * @param { TransformMatrix } other 성분을 복사해 올 행렬.
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
	 * @returns { this } 같은 성분을 가진 새 행렬.
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
	 * @param { number } x x 방향 이동량.
	 * @param { number } y y 방향 이동량.
	 */
	translate(x, y) {
		this.#e = this.#a * x + this.#c * y + this.#e;
		this.#f = this.#b * x + this.#d * y + this.#f;
	}

	//==============================================================================
	// 회전 변환 누적. (Canvas2D rotate 와 동일한 로컬 공간 우측 곱)
	//==============================================================================
	/**
	 * @param { number } radian 회전각. (라디안)
	 */
	rotate(radian) {
		// 회전이 없으면 행렬이 그대로다. (회전하지 않는 노드도 그릴 때마다 부른다)
		if (radian === 0) {
			return;
		}

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
	 * @param { number } x x 방향 배율.
	 * @param { number } y y 방향 배율.
	 */
	scale(x, y) {
		// 크기가 그대로면 행렬도 그대로다.
		if (x === 1 && y === 1) {
			return;
		}

		this.#a = this.#a * x;
		this.#b = this.#b * x;
		this.#c = this.#c * y;
		this.#d = this.#d * y;
	}

	//==============================================================================
	// 다른 행렬을 우측에 곱해 누적. (this = this x other)
	//==============================================================================
	/**
	 * @param { TransformMatrix } other 우측에 곱할 행렬.
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
	// 역행렬. (새 행렬을 돌려주고 이 행렬은 그대로 둔다, 행렬식이 0 이면 null)
	//==============================================================================
	/**
	 * @returns { TransformMatrix | null } 역행렬. 행렬식이 0 이면 null.
	 * @example <caption>역행렬로 점을 되돌리기</caption>
	 * import { TransformMatrix } from "./build/vanilla.js";
	 *
	 * const transformMatrix = new TransformMatrix();
	 * transformMatrix.translate(10, 20);
	 * const inverseMatrix = transformMatrix.invert();
	 * const point = inverseMatrix.transformPoint(10, 20);
	 * console.log(point.x, point.y);
	 */
	invert() {
		const determinant = this.#a * this.#d - this.#b * this.#c;
		if (determinant === 0) {
			return null;
		}
		const inverseDeterminant = 1 / determinant;
		const inverseMatrix = new TransformMatrix();
		const a = this.#d * inverseDeterminant;
		const b = -this.#b * inverseDeterminant;
		const c = -this.#c * inverseDeterminant;
		const d = this.#a * inverseDeterminant;
		const e = (this.#c * this.#f - this.#d * this.#e) * inverseDeterminant;
		const f = (this.#b * this.#e - this.#a * this.#f) * inverseDeterminant;
		inverseMatrix.setTransform(a, b, c, d, e, f);
		return inverseMatrix;
	}

	//==============================================================================
	// 점 변환.
	//==============================================================================
	/**
	 * @param { number } x 변환할 점의 x 좌표.
	 * @param { number } y 변환할 점의 y 좌표.
	 * @returns { { x: number, y: number } } 변환된 점.
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
	 * @returns { number } x 축과 y 축 배율 중 큰 값.
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
	 * @param { Float32Array } target 기록할 길이 9 이상의 배열.
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
