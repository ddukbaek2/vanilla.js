//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Matrix4 } from "../base/matrix4.js";
import { Vector3 } from "../base/vector3.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 카메라 앞으로 칠 가장 작은 깊이. (이보다 가까우면 투영하지 않는다)
const MINIMUM_FRONT_DEPTH = 0.0001;


//==============================================================================
// 3D 카메라. (원근이나 직교 투영과 보는 자리를 들고, 보기와 투영 행렬을 바뀔 때만 다시 셈한다)
// - 좌표는 엔진 Matrix4 와 같은 y 가 위인 오른손 좌표다. 카메라는 -Z 를 본다. (createLookAt, createPerspective)
// - 원근: setPerspective(시야각, 가까운 거리, 먼 거리), 직교: setOrthographic(보이는 높이, 가까운 거리, 먼 거리).
//   가로 세로 비는 setAspectRatio 로 따로 준다. (그리는 사각형이 바뀔 때마다 고쳐 넣는다, 직교의 너비는 높이 x 비)
// - lookAt(눈, 보는 곳, 위) 로 보는 자리를 정한다.
// - getViewProjectionMatrix 는 담아 둔 행렬을 돌려준다. 값을 바꾸는 함수를 부른 뒤 처음 읽을 때만 다시 셈한다.
//   돌려받은 행렬을 고치지 않는다. (고칠 것은 clone)
// - 같은 카메라를 렌더러(ToonRenderer.beginFrameWithCamera)와 2D 표시(projectToView)가 함께 써, 3D 점 위에 글이나 단추를 얹는다.
// - projectToView(x, y, z, viewRect): 월드 점을 viewRect 안의 자리로. viewRect 는 3D 를 그리는 사각형을 부르는 쪽의 좌표(보통 뷰 좌표)로 준 것이다.
// - unprojectToPlane(viewPosition, planeHeight, viewRect): viewRect 안의 자리에서 나간 시선이 높이 planeHeight 의 수평면(y = planeHeight)과 만나는 점.
// - 원 행렬: setMatrices(보기, 투영) 로 게임이 셈한 행렬을 그대로 쓴다. (기울인 직교, 화면 변환을 곱한 투영 같은 것) 위 함수들이 모두 그 행렬로 돈다.
//   보기 행렬은 월드 → 카메라의 강체 변환(카메라는 -Z 를 봄)으로 준다. 눈, 보는 곳(눈 앞 1), 위쪽과 isOrthographic 은 그 행렬에서 뽑는다.
//   시야각, 보이는 높이, 가까운 거리, 먼 거리, 가로 세로 비는 마지막으로 준 값 그대로다. setPerspective, setOrthographic, lookAt 을 부르면 원 행렬을 버리고 셈하는 길로 돌아간다.
//==============================================================================
/**
 * @example <caption>원근 카메라로 월드 점을 화면 자리로 옮기기</caption>
 * import { Camera3D, Rect, Vector3 } from "./build/vanilla.js";
 *
 * const camera = new Camera3D();
 * camera.setPerspective(Math.PI / 3, 0.1, 500);
 * camera.setAspectRatio(640 / 360);
 * const eyePosition = Vector3.create(0, 8, 12);
 * const targetPosition = Vector3.create(0, 0, 0);
 * camera.lookAt(eyePosition, targetPosition);
 * const viewRect = Rect.create(0, 0, 640, 360);
 * const screenPoint = camera.projectToView(0, 1, 0, viewRect);
 * console.log(screenPoint.x, screenPoint.y, screenPoint.isInFront);
 * const viewProjectionMatrix = camera.getViewProjectionMatrix();
 * const elements = viewProjectionMatrix.getElements();
 * console.log(elements.length);
 */
export class Camera3D {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { boolean } */ #isOrthographic;
	/** @private @type { number } */ #fieldOfViewRadian; // 원근의 세로 시야각.
	/** @private @type { number } */ #orthographicHeight; // 직교의 보이는 높이. (월드 단위)
	/** @private @type { number } */ #aspectRatio; // 너비 / 높이.
	/** @private @type { number } */ #nearDistance;
	/** @private @type { number } */ #farDistance;
	/** @private @type { Vector3 } */ #eyePosition;
	/** @private @type { Vector3 } */ #targetPosition;
	/** @private @type { Vector3 } */ #upDirection;
	/** @private @type { Matrix4 } */ #viewMatrix;
	/** @private @type { Matrix4 } */ #projectionMatrix;
	/** @private @type { Matrix4 } */ #viewProjectionMatrix;
	/** @private @type { Matrix4 } */ #inverseViewProjectionMatrix;
	/** @private @type { boolean } */ #isMatrixDirty; // 값을 바꾼 뒤 아직 다시 셈하지 않았는지.
	/** @private @type { Matrix4 | null } */ #rawViewMatrix; // setMatrices 로 받은 보기 행렬. (null 이면 셈하는 길)
	/** @private @type { Matrix4 | null } */ #rawProjectionMatrix;

	//==============================================================================
	// 생성. (원근 시야각 0.8 라디안, 비 1, 거리 0.1 ~ 1000, 눈 (0, 0, 10) 에서 원점을 본다)
	//==============================================================================
	constructor() {
		this.#isOrthographic = false;
		this.#fieldOfViewRadian = 0.8;
		this.#orthographicHeight = 10;
		this.#aspectRatio = 1;
		this.#nearDistance = 0.1;
		this.#farDistance = 1000;
		this.#eyePosition = Vector3.create(0, 0, 10);
		this.#targetPosition = Vector3.create(0, 0, 0);
		this.#upDirection = Vector3.create(0, 1, 0);
		this.#viewMatrix = Matrix4.createIdentity();
		this.#projectionMatrix = Matrix4.createIdentity();
		this.#viewProjectionMatrix = Matrix4.createIdentity();
		this.#inverseViewProjectionMatrix = Matrix4.createIdentity();
		this.#isMatrixDirty = true;
		this.#rawViewMatrix = null;
		this.#rawProjectionMatrix = null;
	}

	//==============================================================================
	// 원근 투영 설정.
	//==============================================================================
	/**
	 * @param { number } fieldOfViewRadian 세로 시야각.
	 * @param { number } nearDistance 가까운 거리. (월드 단위)
	 * @param { number } farDistance 먼 거리. (월드 단위)
	 */
	setPerspective(fieldOfViewRadian, nearDistance, farDistance) {
		this.clearRawMatrices();
		this.#isOrthographic = false;
		this.#fieldOfViewRadian = fieldOfViewRadian;
		this.#nearDistance = nearDistance;
		this.#farDistance = farDistance;
		this.#isMatrixDirty = true;
	}

	//==============================================================================
	// 직교 투영 설정. (보이는 높이, 너비는 높이 x 가로 세로 비)
	//==============================================================================
	/**
	 * @param { number } orthographicHeight 보이는 높이. (월드 단위, 너비는 높이 x 가로 세로 비)
	 * @param { number } nearDistance 가까운 거리. (월드 단위)
	 * @param { number } farDistance 먼 거리. (월드 단위)
	 */
	setOrthographic(orthographicHeight, nearDistance, farDistance) {
		this.clearRawMatrices();
		this.#isOrthographic = true;
		this.#orthographicHeight = orthographicHeight;
		this.#nearDistance = nearDistance;
		this.#farDistance = farDistance;
		this.#isMatrixDirty = true;
	}

	//==============================================================================
	// 직교 투영인지.
	//==============================================================================
	/**
	 * @returns { boolean } 직교 투영이면 참.
	 */
	isOrthographic() {
		return this.#isOrthographic;
	}

	//==============================================================================
	// 가로 세로 비 설정. (너비 / 높이, 같으면 그대로)
	//==============================================================================
	/**
	 * @param { number } aspectRatio 가로 세로 비. (너비 / 높이, 0 이하나 NaN 이면 무시한다)
	 */
	setAspectRatio(aspectRatio) {
		if (!(aspectRatio > 0) || aspectRatio === this.#aspectRatio) {
			return;
		}
		this.#aspectRatio = aspectRatio;
		this.#isMatrixDirty = true;
	}

	//==============================================================================
	// 가로 세로 비 반환.
	//==============================================================================
	/**
	 * @returns { number } 가로 세로 비. (너비 / 높이)
	 */
	getAspectRatio() {
		return this.#aspectRatio;
	}

	//==============================================================================
	// 원근의 세로 시야각 반환.
	//==============================================================================
	/**
	 * @returns { number } 원근의 세로 시야각. (라디안)
	 */
	getFieldOfView() {
		return this.#fieldOfViewRadian;
	}

	//==============================================================================
	// 직교의 보이는 높이 반환.
	//==============================================================================
	/**
	 * @returns { number } 직교의 보이는 높이. (월드 단위)
	 */
	getOrthographicHeight() {
		return this.#orthographicHeight;
	}

	//==============================================================================
	// 가까운 거리 반환.
	//==============================================================================
	/**
	 * @returns { number } 가까운 거리. (월드 단위)
	 */
	getNearDistance() {
		return this.#nearDistance;
	}

	//==============================================================================
	// 먼 거리 반환.
	//==============================================================================
	/**
	 * @returns { number } 먼 거리. (월드 단위)
	 */
	getFarDistance() {
		return this.#farDistance;
	}

	//==============================================================================
	// 보는 자리 설정. (값을 복사해 둔다)
	//==============================================================================
	/**
	 * @param { Vector3 } eyePosition 눈의 월드 자리.
	 * @param { Vector3 } targetPosition 보는 곳의 월드 자리.
	 * @param { Vector3 } [upDirection] 기본 (0, 1, 0).
	 */
	lookAt(eyePosition, targetPosition, upDirection = Vector3.up()) {
		this.clearRawMatrices();
		this.#eyePosition = Vector3.create(eyePosition.x, eyePosition.y, eyePosition.z);
		this.#targetPosition = Vector3.create(targetPosition.x, targetPosition.y, targetPosition.z);
		this.#upDirection = Vector3.create(upDirection.x, upDirection.y, upDirection.z);
		this.#isMatrixDirty = true;
	}

	//==============================================================================
	// 눈의 자리 반환.
	//==============================================================================
	/**
	 * @returns { Vector3 } 눈의 월드 자리. (담아 둔 벡터, 고치지 않는다)
	 */
	getEyePosition() {
		return this.#eyePosition;
	}

	//==============================================================================
	// 보는 곳 반환.
	//==============================================================================
	/**
	 * @returns { Vector3 } 보는 곳의 월드 자리. (담아 둔 벡터, 고치지 않는다)
	 */
	getTargetPosition() {
		return this.#targetPosition;
	}

	//==============================================================================
	// 위쪽 반환.
	//==============================================================================
	/**
	 * @returns { Vector3 } 위쪽 방향. (담아 둔 벡터, 고치지 않는다)
	 */
	getUpDirection() {
		return this.#upDirection;
	}

	//==============================================================================
	// 원 행렬 설정. (게임이 셈한 보기와 투영을 그대로 쓴다, 값을 복사해 둔다, 머리말)
	//==============================================================================
	/**
	 * @param { Matrix4 } viewMatrix 월드 → 카메라.
	 * @param { Matrix4 } projectionMatrix 카메라 → 클립.
	 * @example <caption>게임이 셈한 직교 행렬을 그대로 쓰기</caption>
	 * import { Camera3D, Matrix4, Vector3 } from "./build/vanilla.js";
	 *
	 * const eyePosition = Vector3.create(10, 10, 10);
	 * const targetPosition = Vector3.create(0, 0, 0);
	 * const upDirection = Vector3.up();
	 * const viewMatrix = Matrix4.createLookAt(eyePosition, targetPosition, upDirection);
	 * const projectionMatrix = Matrix4.createOrthographic(-8, 8, -4.5, 4.5, 0.1, 100);
	 * const camera = new Camera3D();
	 * camera.setMatrices(viewMatrix, projectionMatrix);
	 * const recoveredEyePosition = camera.getEyePosition();
	 * const isOrthographic = camera.isOrthographic();
	 * console.log(isOrthographic, recoveredEyePosition.x, recoveredEyePosition.y, recoveredEyePosition.z);
	 * camera.setPerspective(0.8, 0.1, 100);
	 * const hasRawMatrices = camera.hasRawMatrices();
	 * console.log(hasRawMatrices);
	 */
	setMatrices(viewMatrix, projectionMatrix) {
		const rawViewMatrix = viewMatrix.clone();
		const rawProjectionMatrix = projectionMatrix.clone();
		const viewElements = rawViewMatrix.getElements();
		const projectionElements = rawProjectionMatrix.getElements();
		const translationX = viewElements[12];
		const translationY = viewElements[13];
		const translationZ = viewElements[14];
		const eyeX = -(viewElements[0] * translationX + viewElements[1] * translationY + viewElements[2] * translationZ);
		const eyeY = -(viewElements[4] * translationX + viewElements[5] * translationY + viewElements[6] * translationZ);
		const eyeZ = -(viewElements[8] * translationX + viewElements[9] * translationY + viewElements[10] * translationZ);
		this.#rawViewMatrix = rawViewMatrix;
		this.#rawProjectionMatrix = rawProjectionMatrix;
		this.#isOrthographic = System.Math.abs(projectionElements[11]) < 0.5;
		this.#eyePosition = Vector3.create(eyeX, eyeY, eyeZ);
		this.#targetPosition = Vector3.create(eyeX - viewElements[2], eyeY - viewElements[6], eyeZ - viewElements[10]);
		this.#upDirection = Vector3.create(viewElements[1], viewElements[5], viewElements[9]);
		this.#isMatrixDirty = true;
	}

	//==============================================================================
	// 원 행렬을 쓰는지.
	//==============================================================================
	/**
	 * @returns { boolean } setMatrices 로 받은 원 행렬을 쓰면 참.
	 */
	hasRawMatrices() {
		return this.#rawViewMatrix !== null;
	}

	//==============================================================================
	// 원 행렬 버리기. (셈하는 길로)
	//==============================================================================
	clearRawMatrices() {
		if (this.#rawViewMatrix === null) {
			return;
		}
		this.#rawViewMatrix = null;
		this.#rawProjectionMatrix = null;
		this.#isMatrixDirty = true;
	}

	//==============================================================================
	// 바뀐 값이 있으면 행렬 넷을 다시 셈하기. (원 행렬이 있으면 그것으로)
	//==============================================================================
	#refreshMatrices() {
		if (!this.#isMatrixDirty) {
			return;
		}
		const aspectRatio = this.#aspectRatio;
		const nearDistance = this.#nearDistance;
		const farDistance = this.#farDistance;
		const rawViewMatrix = this.#rawViewMatrix;
		const rawProjectionMatrix = this.#rawProjectionMatrix;
		if (rawViewMatrix !== null && rawProjectionMatrix !== null) {
			this.#viewMatrix = rawViewMatrix.clone();
			this.#projectionMatrix = rawProjectionMatrix.clone();
		}
		else {
			this.#viewMatrix = Matrix4.createLookAt(this.#eyePosition, this.#targetPosition, this.#upDirection);
			if (this.#isOrthographic) {
				const halfHeight = this.#orthographicHeight * 0.5;
				const halfWidth = halfHeight * aspectRatio;
				this.#projectionMatrix = Matrix4.createOrthographic(-halfWidth, halfWidth, -halfHeight, halfHeight, nearDistance, farDistance);
			}
			else {
				this.#projectionMatrix = Matrix4.createPerspective(this.#fieldOfViewRadian, aspectRatio, nearDistance, farDistance);
			}
		}
		const viewProjectionMatrix = this.#projectionMatrix.clone();
		viewProjectionMatrix.multiply(this.#viewMatrix);
		this.#viewProjectionMatrix = viewProjectionMatrix;
		this.#inverseViewProjectionMatrix = Matrix4.createInverse(viewProjectionMatrix);
		this.#isMatrixDirty = false;
	}

	//==============================================================================
	// 보기 행렬 반환. (월드 → 카메라)
	//==============================================================================
	/**
	 * @returns { Matrix4 } 보기 행렬. (담아 둔 행렬, 고칠 것은 clone)
	 */
	getViewMatrix() {
		this.#refreshMatrices();
		return this.#viewMatrix;
	}

	//==============================================================================
	// 투영 행렬 반환. (카메라 → 클립)
	//==============================================================================
	/**
	 * @returns { Matrix4 } 투영 행렬. (담아 둔 행렬, 고칠 것은 clone)
	 */
	getProjectionMatrix() {
		this.#refreshMatrices();
		return this.#projectionMatrix;
	}

	//==============================================================================
	// 보기와 투영 행렬 반환. (월드 → 클립)
	//==============================================================================
	/**
	 * @returns { Matrix4 } 투영 x 보기 행렬. (담아 둔 행렬, 고칠 것은 clone)
	 */
	getViewProjectionMatrix() {
		this.#refreshMatrices();
		return this.#viewProjectionMatrix;
	}

	//==============================================================================
	// 보기와 투영의 역행렬 반환. (클립 → 월드)
	//==============================================================================
	/**
	 * @returns { Matrix4 } 보기와 투영의 역행렬. (담아 둔 행렬, 고칠 것은 clone)
	 */
	getInverseViewProjectionMatrix() {
		this.#refreshMatrices();
		return this.#inverseViewProjectionMatrix;
	}

	//==============================================================================
	// 월드 점의 카메라 앞 깊이. (보는 쪽으로 잰 거리, 눈의 면보다 뒤면 음수, 비치는 것을 먼 것부터 그릴 때)
	//==============================================================================
	/**
	 * @param { number } x 월드 X.
	 * @param { number } y 월드 Y.
	 * @param { number } z 월드 Z.
	 * @returns { number } 카메라가 보는 쪽으로 잰 깊이. (월드 단위, 눈의 면보다 뒤면 음수)
	 */
	readViewDepth(x, y, z) {
		const viewElements = this.getViewMatrix().getElements();
		return -(viewElements[2] * x + viewElements[6] * y + viewElements[10] * z + viewElements[14]);
	}

	//==============================================================================
	// 월드 점을 viewRect 안의 자리로. (viewRect 의 좌표, 왼쪽 위가 원점이고 아래로 늘어남)
	// - isInFront 는 점이 눈의 면보다 앞인지다. 뒤면 x, y 는 0 이다. 화면 밖인지는 부르는 쪽이 x, y 를 보고 정한다.
	// - result 를 주면 거기에 담아 돌려준다. (매 프레임 새 객체를 만들지 않게)
	//==============================================================================
	/**
	 * @param { number } x 월드 X.
	 * @param { number } y 월드 Y.
	 * @param { number } z 월드 Z.
	 * @param { Rect } viewRect 3D 를 그리는 사각형. (부르는 쪽 좌표, 보통 뷰 좌표)
	 * @param { object } [result] { x, y, depth, isInFront }
	 * @returns { object } { x, y, depth, isInFront }
	 * @example <caption>결과 객체를 다시 쓰며 여러 점 옮기기</caption>
	 * import { Camera3D, Rect } from "./build/vanilla.js";
	 *
	 * const camera = new Camera3D();
	 * const viewRect = Rect.create(0, 0, 640, 360);
	 * const projected = { x: 0, y: 0, depth: 0, isInFront: false };
	 * const pointList = [[0, 0, 0], [2, 1, 0], [0, 0, 20]];
	 * for (const point of pointList) {
	 * 	camera.projectToView(point[0], point[1], point[2], viewRect, projected);
	 * 	console.log(projected.x, projected.y, projected.depth, projected.isInFront);
	 * }
	 */
	projectToView(x, y, z, viewRect, result = { x: 0, y: 0, depth: 0, isInFront: false }) {
		const clip = this.getViewProjectionMatrix().transformPoint(x, y, z);
		const depth = this.readViewDepth(x, y, z);
		result.depth = depth;
		if (depth < MINIMUM_FRONT_DEPTH || System.Math.abs(clip.w) < MINIMUM_FRONT_DEPTH) {
			result.x = 0;
			result.y = 0;
			result.isInFront = false;
			return result;
		}
		const normalizedX = clip.x / clip.w;
		const normalizedY = clip.y / clip.w;
		result.x = viewRect.position.x + (normalizedX * 0.5 + 0.5) * viewRect.size.x;
		result.y = viewRect.position.y + (0.5 - normalizedY * 0.5) * viewRect.size.y;
		result.isInFront = true;
		return result;
	}

	//==============================================================================
	// viewRect 안의 자리에서 나간 시선이 수평면 y = planeHeight 와 만나는 점. (나란하거나 눈 뒤에서 만나면 null)
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition viewRect 와 같은 좌표.
	 * @param { number } planeHeight 수평면의 높이. (월드 y)
	 * @param { Rect } viewRect 3D 를 그리는 사각형. (viewPosition 과 같은 좌표)
	 * @returns { Vector3 | null } 시선과 수평면이 만나는 월드 점. (나란하거나 눈 뒤에서 만나거나 viewRect 크기가 0 이하면 null)
	 * @example <caption>화면 가운데가 가리키는 바닥 자리 찾기</caption>
	 * import { Camera3D, Rect, Vector2, Vector3 } from "./build/vanilla.js";
	 *
	 * const camera = new Camera3D();
	 * camera.setAspectRatio(640 / 360);
	 * const eyePosition = Vector3.create(0, 10, 10);
	 * const targetPosition = Vector3.create(0, 0, 0);
	 * camera.lookAt(eyePosition, targetPosition);
	 * const viewRect = Rect.create(0, 0, 640, 360);
	 * const viewPosition = Vector2.create(320, 180);
	 * const groundPoint = camera.unprojectToPlane(viewPosition, 0, viewRect);
	 * if (groundPoint !== null) {
	 * 	console.log(groundPoint.x, groundPoint.y, groundPoint.z);
	 * }
	 */
	unprojectToPlane(viewPosition, planeHeight, viewRect) {
		if (viewRect.size.x <= 0 || viewRect.size.y <= 0) {
			return null;
		}
		const normalizedX = (viewPosition.x - viewRect.position.x) / viewRect.size.x * 2 - 1;
		const normalizedY = 1 - (viewPosition.y - viewRect.position.y) / viewRect.size.y * 2;
		const inverseMatrix = this.getInverseViewProjectionMatrix();
		const nearPoint = inverseMatrix.transformPoint(normalizedX, normalizedY, -1);
		const farPoint = inverseMatrix.transformPoint(normalizedX, normalizedY, 1);
		if (nearPoint.w === 0 || farPoint.w === 0) {
			return null;
		}
		const nearX = nearPoint.x / nearPoint.w;
		const nearY = nearPoint.y / nearPoint.w;
		const nearZ = nearPoint.z / nearPoint.w;
		const farX = farPoint.x / farPoint.w;
		const farY = farPoint.y / farPoint.w;
		const farZ = farPoint.z / farPoint.w;
		const deltaY = farY - nearY;
		if (System.Math.abs(deltaY) < 0.000001) {
			return null;
		}
		const ratio = (planeHeight - nearY) / deltaY;
		if (ratio < 0) {
			return null;
		}
		return Vector3.create(nearX + (farX - nearX) * ratio, planeHeight, nearZ + (farZ - nearZ) * ratio);
	}
}
