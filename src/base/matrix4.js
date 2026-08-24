//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "./object.js";
import { Vector3 } from "./vector3.js";
import * as Math from "./math.js";


//==============================================================================
// 4x4 변환 행렬. (열우선 — WebGL uniformMatrix4fv 에 그대로 업로드 가능)
// - 열우선 배열 인덱스: elements[column * 4 + row]
// - 점 변환: transformed = matrix x (x, y, z, 1)
//==============================================================================
export class Matrix4 extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Float32Array } */ #elements;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();

		this.#elements = new System.Float32Array(16);
		this.setIdentity();
	}

	//==============================================================================
	// 단위 행렬로 초기화.
	//==============================================================================
	setIdentity() {
		const elements = this.getElements();
		elements.fill(0);
		elements[0] = 1;
		elements[5] = 1;
		elements[10] = 1;
		elements[15] = 1;
	}

	//==============================================================================
	// 다른 행렬로부터 복사.
	//==============================================================================
	/**
	 * @param { Matrix4 } other
	 */
	copyFrom(other) {
		const elements = this.getElements();
		const otherElements = other.getElements();
		elements.set(otherElements);
	}

	//==============================================================================
	// 복제.
	//==============================================================================
	/**
	 * @override
	 * @returns { this }
	 */
	clone() {
		const matrix = /** @type { this } */ (new Matrix4());
		matrix.copyFrom(this);
		return matrix;
	}

	//==============================================================================
	// 다른 행렬을 우측에 곱해 누적. (this = this x other)
	//==============================================================================
	/**
	 * @param { Matrix4 } other
	 */
	multiply(other) {
		const elements = this.getElements();
		const otherElements = other.getElements();
		const resultElements = new System.Float32Array(16);
		for (let columnIndex = 0; columnIndex < 4; ++columnIndex) {
			for (let rowIndex = 0; rowIndex < 4; ++rowIndex) {
				let sum = 0;
				for (let termIndex = 0; termIndex < 4; ++termIndex) {
					sum += elements[termIndex * 4 + rowIndex] * otherElements[columnIndex * 4 + termIndex];
				}
				resultElements[columnIndex * 4 + rowIndex] = sum;
			}
		}
		elements.set(resultElements);
	}

	//==============================================================================
	// 이동 변환 누적. (로컬 공간 우측 곱)
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @param { number } z
	 */
	translate(x, y, z) {
		const translationMatrix = Matrix4.createTranslation(x, y, z);
		this.multiply(translationMatrix);
	}

	//==============================================================================
	// X축 회전 변환 누적. (로컬 공간 우측 곱)
	//==============================================================================
	/**
	 * @param { number } radian
	 */
	rotateX(radian) {
		const rotationMatrix = Matrix4.createRotationX(radian);
		this.multiply(rotationMatrix);
	}

	//==============================================================================
	// Y축 회전 변환 누적. (로컬 공간 우측 곱)
	//==============================================================================
	/**
	 * @param { number } radian
	 */
	rotateY(radian) {
		const rotationMatrix = Matrix4.createRotationY(radian);
		this.multiply(rotationMatrix);
	}

	//==============================================================================
	// Z축 회전 변환 누적. (로컬 공간 우측 곱)
	//==============================================================================
	/**
	 * @param { number } radian
	 */
	rotateZ(radian) {
		const rotationMatrix = Matrix4.createRotationZ(radian);
		this.multiply(rotationMatrix);
	}

	//==============================================================================
	// 크기 변환 누적. (로컬 공간 우측 곱)
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @param { number } z
	 */
	scale(x, y, z) {
		const scaleMatrix = Matrix4.createScale(x, y, z);
		this.multiply(scaleMatrix);
	}

	//==============================================================================
	// 점 변환. (w 성분 포함 — 원근 분할은 호출자가 수행)
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @param { number } z
	 * @returns { { x: number, y: number, z: number, w: number } }
	 */
	transformPoint(x, y, z) {
		const elements = this.getElements();
		const transformedX = elements[0] * x + elements[4] * y + elements[8] * z + elements[12];
		const transformedY = elements[1] * x + elements[5] * y + elements[9] * z + elements[13];
		const transformedZ = elements[2] * x + elements[6] * y + elements[10] * z + elements[14];
		const transformedW = elements[3] * x + elements[7] * y + elements[11] * z + elements[15];
		return { x: transformedX, y: transformedY, z: transformedZ, w: transformedW };
	}

	//==============================================================================
	// 방향 변환. (이동 성분 무시 — 회전/크기만 적용)
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @param { number } z
	 * @returns { { x: number, y: number, z: number } }
	 */
	transformDirection(x, y, z) {
		const elements = this.getElements();
		const transformedX = elements[0] * x + elements[4] * y + elements[8] * z;
		const transformedY = elements[1] * x + elements[5] * y + elements[9] * z;
		const transformedZ = elements[2] * x + elements[6] * y + elements[10] * z;
		return { x: transformedX, y: transformedY, z: transformedZ };
	}

	//==============================================================================
	// 열우선 요소 배열 반환.
	//==============================================================================
	/**
	 * @returns { Float32Array }
	 */
	getElements() {
		return this.#elements;
	}

	//==============================================================================
	// 단위 행렬 생성. (정적)
	//==============================================================================
	/**
	 * @returns { Matrix4 }
	 */
	static createIdentity() {
		const matrix = new Matrix4();
		return matrix;
	}

	//==============================================================================
	// 이동 행렬 생성. (정적)
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @param { number } z
	 * @returns { Matrix4 }
	 */
	static createTranslation(x, y, z) {
		const matrix = new Matrix4();
		const elements = matrix.getElements();
		elements[12] = x;
		elements[13] = y;
		elements[14] = z;
		return matrix;
	}

	//==============================================================================
	// X축 회전 행렬 생성. (정적)
	//==============================================================================
	/**
	 * @param { number } radian
	 * @returns { Matrix4 }
	 */
	static createRotationX(radian) {
		const cosRadian = Math.cos(radian);
		const sinRadian = Math.sin(radian);
		const matrix = new Matrix4();
		const elements = matrix.getElements();
		elements[5] = cosRadian;
		elements[6] = sinRadian;
		elements[9] = -sinRadian;
		elements[10] = cosRadian;
		return matrix;
	}

	//==============================================================================
	// Y축 회전 행렬 생성. (정적)
	//==============================================================================
	/**
	 * @param { number } radian
	 * @returns { Matrix4 }
	 */
	static createRotationY(radian) {
		const cosRadian = Math.cos(radian);
		const sinRadian = Math.sin(radian);
		const matrix = new Matrix4();
		const elements = matrix.getElements();
		elements[0] = cosRadian;
		elements[2] = -sinRadian;
		elements[8] = sinRadian;
		elements[10] = cosRadian;
		return matrix;
	}

	//==============================================================================
	// Z축 회전 행렬 생성. (정적)
	//==============================================================================
	/**
	 * @param { number } radian
	 * @returns { Matrix4 }
	 */
	static createRotationZ(radian) {
		const cosRadian = Math.cos(radian);
		const sinRadian = Math.sin(radian);
		const matrix = new Matrix4();
		const elements = matrix.getElements();
		elements[0] = cosRadian;
		elements[1] = sinRadian;
		elements[4] = -sinRadian;
		elements[5] = cosRadian;
		return matrix;
	}

	//==============================================================================
	// 쿼터니언 회전 행렬 생성. (정적)
	//==============================================================================
	/**
	 * @param { { x: number, y: number, z: number, w: number } } quaternion
	 * @returns { Matrix4 }
	 */
	static createRotationFromQuaternion(quaternion) {
		const x = quaternion.x;
		const y = quaternion.y;
		const z = quaternion.z;
		const w = quaternion.w;
		const matrix = new Matrix4();
		const elements = matrix.getElements();
		elements[0] = 1 - 2 * (y * y + z * z);
		elements[1] = 2 * (x * y + z * w);
		elements[2] = 2 * (x * z - y * w);
		elements[4] = 2 * (x * y - z * w);
		elements[5] = 1 - 2 * (x * x + z * z);
		elements[6] = 2 * (y * z + x * w);
		elements[8] = 2 * (x * z + y * w);
		elements[9] = 2 * (y * z - x * w);
		elements[10] = 1 - 2 * (x * x + y * y);
		return matrix;
	}

	//==============================================================================
	// 크기 행렬 생성. (정적)
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @param { number } z
	 * @returns { Matrix4 }
	 */
	static createScale(x, y, z) {
		const matrix = new Matrix4();
		const elements = matrix.getElements();
		elements[0] = x;
		elements[5] = y;
		elements[10] = z;
		return matrix;
	}

	//==============================================================================
	// 원근 투영 행렬 생성. (정적)
	//==============================================================================
	/**
	 * @param { number } fieldOfViewRadian
	 * @param { number } aspectRatio
	 * @param { number } nearDistance
	 * @param { number } farDistance
	 * @returns { Matrix4 }
	 */
	static createPerspective(fieldOfViewRadian, aspectRatio, nearDistance, farDistance) {
		const focalLength = 1.0 / Math.tan(fieldOfViewRadian / 2);
		const rangeInverse = 1.0 / (nearDistance - farDistance);
		const matrix = new Matrix4();
		const elements = matrix.getElements();
		elements.fill(0);
		elements[0] = focalLength / aspectRatio;
		elements[5] = focalLength;
		elements[10] = (nearDistance + farDistance) * rangeInverse;
		elements[11] = -1;
		elements[14] = nearDistance * farDistance * rangeInverse * 2;
		return matrix;
	}

	//==============================================================================
	// 직교 투영 행렬 생성. (정적)
	//==============================================================================
	/**
	 * @param { number } left
	 * @param { number } right
	 * @param { number } bottom
	 * @param { number } top
	 * @param { number } nearDistance
	 * @param { number } farDistance
	 * @returns { Matrix4 }
	 */
	static createOrthographic(left, right, bottom, top, nearDistance, farDistance) {
		const matrix = new Matrix4();
		const elements = matrix.getElements();
		elements.fill(0);
		elements[0] = 2 / (right - left);
		elements[5] = 2 / (top - bottom);
		elements[10] = -2 / (farDistance - nearDistance);
		elements[12] = -(right + left) / (right - left);
		elements[13] = -(top + bottom) / (top - bottom);
		elements[14] = -(farDistance + nearDistance) / (farDistance - nearDistance);
		elements[15] = 1;
		return matrix;
	}

	//==============================================================================
	// 시점 행렬 생성. (정적 — 지정 위치에서 대상을 바라보는 뷰 행렬)
	//==============================================================================
	/**
	 * @param { Vector3 } eyePosition
	 * @param { Vector3 } targetPosition
	 * @param { Vector3 } upDirection
	 * @returns { Matrix4 }
	 */
	static createLookAt(eyePosition, targetPosition, upDirection) {
		const eyeToTarget = eyePosition.subtract(targetPosition);
		const backAxis = eyeToTarget.normalize();
		const upCrossBack = upDirection.cross(backAxis);
		const rightAxis = upCrossBack.normalize();
		const upAxis = backAxis.cross(rightAxis);

		const matrix = new Matrix4();
		const elements = matrix.getElements();
		elements[0] = rightAxis.x;
		elements[1] = upAxis.x;
		elements[2] = backAxis.x;
		elements[3] = 0;
		elements[4] = rightAxis.y;
		elements[5] = upAxis.y;
		elements[6] = backAxis.y;
		elements[7] = 0;
		elements[8] = rightAxis.z;
		elements[9] = upAxis.z;
		elements[10] = backAxis.z;
		elements[11] = 0;
		elements[12] = -rightAxis.dot(eyePosition);
		elements[13] = -upAxis.dot(eyePosition);
		elements[14] = -backAxis.dot(eyePosition);
		elements[15] = 1;
		return matrix;
	}

	//==============================================================================
	// 역행렬 생성. (정적 — 일반 4x4 여인수 전개, 비가역 시 단위 행렬)
	//==============================================================================
	/**
	 * @param { Matrix4 } matrix
	 * @returns { Matrix4 }
	 */
	static createInverse(matrix) {
		const sourceElements = matrix.getElements();
		const m00 = sourceElements[0];
		const m01 = sourceElements[1];
		const m02 = sourceElements[2];
		const m03 = sourceElements[3];
		const m04 = sourceElements[4];
		const m05 = sourceElements[5];
		const m06 = sourceElements[6];
		const m07 = sourceElements[7];
		const m08 = sourceElements[8];
		const m09 = sourceElements[9];
		const m10 = sourceElements[10];
		const m11 = sourceElements[11];
		const m12 = sourceElements[12];
		const m13 = sourceElements[13];
		const m14 = sourceElements[14];
		const m15 = sourceElements[15];

		const cofactor00 = m00 * m05 - m01 * m04;
		const cofactor01 = m00 * m06 - m02 * m04;
		const cofactor02 = m00 * m07 - m03 * m04;
		const cofactor03 = m01 * m06 - m02 * m05;
		const cofactor04 = m01 * m07 - m03 * m05;
		const cofactor05 = m02 * m07 - m03 * m06;
		const cofactor06 = m08 * m13 - m09 * m12;
		const cofactor07 = m08 * m14 - m10 * m12;
		const cofactor08 = m08 * m15 - m11 * m12;
		const cofactor09 = m09 * m14 - m10 * m13;
		const cofactor10 = m09 * m15 - m11 * m13;
		const cofactor11 = m10 * m15 - m11 * m14;

		const determinant = cofactor00 * cofactor11 - cofactor01 * cofactor10 + cofactor02 * cofactor09 + cofactor03 * cofactor08 - cofactor04 * cofactor07 + cofactor05 * cofactor06;
		if (determinant === 0) {
			const identityMatrix = Matrix4.createIdentity();
			return identityMatrix;
		}
		const inverseDeterminant = 1 / determinant;

		const resultMatrix = new Matrix4();
		const resultElements = resultMatrix.getElements();
		resultElements[0] = (m05 * cofactor11 - m06 * cofactor10 + m07 * cofactor09) * inverseDeterminant;
		resultElements[1] = (m02 * cofactor10 - m01 * cofactor11 - m03 * cofactor09) * inverseDeterminant;
		resultElements[2] = (m13 * cofactor05 - m14 * cofactor04 + m15 * cofactor03) * inverseDeterminant;
		resultElements[3] = (m10 * cofactor04 - m09 * cofactor05 - m11 * cofactor03) * inverseDeterminant;
		resultElements[4] = (m06 * cofactor08 - m04 * cofactor11 - m07 * cofactor07) * inverseDeterminant;
		resultElements[5] = (m00 * cofactor11 - m02 * cofactor08 + m03 * cofactor07) * inverseDeterminant;
		resultElements[6] = (m14 * cofactor02 - m12 * cofactor05 - m15 * cofactor01) * inverseDeterminant;
		resultElements[7] = (m08 * cofactor05 - m10 * cofactor02 + m11 * cofactor01) * inverseDeterminant;
		resultElements[8] = (m04 * cofactor10 - m05 * cofactor08 + m07 * cofactor06) * inverseDeterminant;
		resultElements[9] = (m01 * cofactor08 - m00 * cofactor10 - m03 * cofactor06) * inverseDeterminant;
		resultElements[10] = (m12 * cofactor04 - m13 * cofactor02 + m15 * cofactor00) * inverseDeterminant;
		resultElements[11] = (m09 * cofactor02 - m08 * cofactor04 - m11 * cofactor00) * inverseDeterminant;
		resultElements[12] = (m05 * cofactor07 - m04 * cofactor09 - m06 * cofactor06) * inverseDeterminant;
		resultElements[13] = (m00 * cofactor09 - m01 * cofactor07 + m02 * cofactor06) * inverseDeterminant;
		resultElements[14] = (m13 * cofactor01 - m12 * cofactor03 - m14 * cofactor00) * inverseDeterminant;
		resultElements[15] = (m08 * cofactor03 - m09 * cofactor01 + m10 * cofactor00) * inverseDeterminant;
		return resultMatrix;
	}
}
