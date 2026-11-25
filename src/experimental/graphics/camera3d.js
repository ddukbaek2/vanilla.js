//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Matrix4 } from "../../base/matrix4.js";
import { Vector3 } from "../../base/vector3.js";


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
//==============================================================================
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
	}

	//==============================================================================
	// 원근 투영 설정.
	//==============================================================================
	/**
	 * @param { number } fieldOfViewRadian 세로 시야각.
	 * @param { number } nearDistance
	 * @param { number } farDistance
	 */
	setPerspective(fieldOfViewRadian, nearDistance, farDistance) {
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
	 * @param { number } orthographicHeight
	 * @param { number } nearDistance
	 * @param { number } farDistance
	 */
	setOrthographic(orthographicHeight, nearDistance, farDistance) {
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
	 * @returns { boolean }
	 */
	isOrthographic() {
		return this.#isOrthographic;
	}

	//==============================================================================
	// 가로 세로 비 설정. (너비 / 높이, 같으면 그대로)
	//==============================================================================
	/**
	 * @param { number } aspectRatio
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
	 * @returns { number }
	 */
	getAspectRatio() {
		return this.#aspectRatio;
	}

	//==============================================================================
	// 원근의 세로 시야각 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getFieldOfView() {
		return this.#fieldOfViewRadian;
	}

	//==============================================================================
	// 직교의 보이는 높이 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getOrthographicHeight() {
		return this.#orthographicHeight;
	}

	//==============================================================================
	// 가까운 거리 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getNearDistance() {
		return this.#nearDistance;
	}

	//==============================================================================
	// 먼 거리 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getFarDistance() {
		return this.#farDistance;
	}

	//==============================================================================
	// 보는 자리 설정. (값을 복사해 둔다)
	//==============================================================================
	/**
	 * @param { Vector3 } eyePosition
	 * @param { Vector3 } targetPosition
	 * @param { Vector3 } [upDirection] 기본 (0, 1, 0).
	 */
	lookAt(eyePosition, targetPosition, upDirection = Vector3.up()) {
		this.#eyePosition = Vector3.create(eyePosition.x, eyePosition.y, eyePosition.z);
		this.#targetPosition = Vector3.create(targetPosition.x, targetPosition.y, targetPosition.z);
		this.#upDirection = Vector3.create(upDirection.x, upDirection.y, upDirection.z);
		this.#isMatrixDirty = true;
	}

	//==============================================================================
	// 눈의 자리 반환.
	//==============================================================================
	/**
	 * @returns { Vector3 }
	 */
	getEyePosition() {
		return this.#eyePosition;
	}

	//==============================================================================
	// 보는 곳 반환.
	//==============================================================================
	/**
	 * @returns { Vector3 }
	 */
	getTargetPosition() {
		return this.#targetPosition;
	}

	//==============================================================================
	// 위쪽 반환.
	//==============================================================================
	/**
	 * @returns { Vector3 }
	 */
	getUpDirection() {
		return this.#upDirection;
	}

	//==============================================================================
	// 바뀐 값이 있으면 행렬 넷을 다시 셈하기.
	//==============================================================================
	refreshMatrices() {
		if (!this.#isMatrixDirty) {
			return;
		}
		const aspectRatio = this.#aspectRatio;
		const nearDistance = this.#nearDistance;
		const farDistance = this.#farDistance;
		this.#viewMatrix = Matrix4.createLookAt(this.#eyePosition, this.#targetPosition, this.#upDirection);
		if (this.#isOrthographic) {
			const halfHeight = this.#orthographicHeight * 0.5;
			const halfWidth = halfHeight * aspectRatio;
			this.#projectionMatrix = Matrix4.createOrthographic(-halfWidth, halfWidth, -halfHeight, halfHeight, nearDistance, farDistance);
		}
		else {
			this.#projectionMatrix = Matrix4.createPerspective(this.#fieldOfViewRadian, aspectRatio, nearDistance, farDistance);
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
	 * @returns { Matrix4 }
	 */
	getViewMatrix() {
		this.refreshMatrices();
		return this.#viewMatrix;
	}

	//==============================================================================
	// 투영 행렬 반환. (카메라 → 클립)
	//==============================================================================
	/**
	 * @returns { Matrix4 }
	 */
	getProjectionMatrix() {
		this.refreshMatrices();
		return this.#projectionMatrix;
	}

	//==============================================================================
	// 보기와 투영 행렬 반환. (월드 → 클립)
	//==============================================================================
	/**
	 * @returns { Matrix4 }
	 */
	getViewProjectionMatrix() {
		this.refreshMatrices();
		return this.#viewProjectionMatrix;
	}

	//==============================================================================
	// 보기와 투영의 역행렬 반환. (클립 → 월드)
	//==============================================================================
	/**
	 * @returns { Matrix4 }
	 */
	getInverseViewProjectionMatrix() {
		this.refreshMatrices();
		return this.#inverseViewProjectionMatrix;
	}

	//==============================================================================
	// 월드 점의 카메라 앞 깊이. (보는 쪽으로 잰 거리, 눈의 면보다 뒤면 음수, 비치는 것을 먼 것부터 그릴 때)
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @param { number } z
	 * @returns { number }
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
	 * @param { number } x
	 * @param { number } y
	 * @param { number } z
	 * @param { Rect } viewRect
	 * @param { object } [result] { x, y, depth, isInFront }
	 * @returns { object } { x, y, depth, isInFront }
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
	 * @param { number } planeHeight
	 * @param { Rect } viewRect
	 * @returns { Vector3 | null }
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
