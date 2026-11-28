//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Matrix4, Vector3, readGlbArrays, ToonRenderer } from "../../import.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 꼭짓점 하나의 실수 수. (위치 3, 법선 3, 색 3, 재질 2, 무늬 4)
const VERTEX_FLOAT_COUNT = 15;

// 카메라 시야각. (라디안)
const FIELD_OF_VIEW = 35 * System.Math.PI / 180;


//==============================================================================
// GLB 모델 미리보기. (인스펙터 안의 캔버스 하나에 툰 렌더러로 그리고, 끌면 돌린다)
// - 모델 크기에 맞춰 카메라 거리를 정한다. (꼭짓점 위치로 잰 경계 상자)
// - 뼈대가 있는 모델은 묶인 자세(bind pose) 그대로 그린다.
// - 쓰고 나면 dispose 로 그리기를 멈추고 GL 자원을 놓는다.
//==============================================================================
export class ModelPreview {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { HTMLCanvasElement } */ #canvas;
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { ToonRenderer | null } */ #renderer;
	/** @private @type { object | null } */ #mesh;
	/** @private @type { Array<number> } */ #center;
	/** @private @type { number } */ #radius;
	/** @private @type { number } */ #yaw;
	/** @private @type { number } */ #pitch;
	/** @private @type { boolean } */ #isDragging;
	/** @private @type { number } */ #frameRequest;
	/** @private @type { boolean } */ #isDisposed;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { HTMLCanvasElement } canvas
	 */
	constructor(canvas) {
		this.#canvas = canvas;
		this.#webGL2RenderingContext = canvas.getContext("webgl2", { antialias: true });
		this.#renderer = null;
		this.#mesh = null;
		this.#center = [0, 0, 0];
		this.#radius = 1;
		this.#yaw = 0.6;
		this.#pitch = 0.25;
		this.#isDragging = false;
		this.#frameRequest = 0;
		this.#isDisposed = false;
		canvas.addEventListener("pointerdown", (pointerEvent) => {
			this.#isDragging = true;
			canvas.setPointerCapture(pointerEvent.pointerId);
		});
		canvas.addEventListener("pointermove", (pointerEvent) => {
			if (!this.#isDragging) {
				return;
			}
			this.#yaw += pointerEvent.movementX * 0.01;
			this.#pitch = System.Math.max(-1.4, System.Math.min(1.4, this.#pitch + pointerEvent.movementY * 0.01));
		});
		canvas.addEventListener("pointerup", () => {
			this.#isDragging = false;
		});
	}

	//==============================================================================
	// GLB 읽어 그리기 시작. (읽은 정보 { vertexCount, triangleCount, hasSkeleton } 를 돌려준다)
	//==============================================================================
	/**
	 * @param { ArrayBuffer } arrayBuffer
	 * @returns { object }
	 */
	load(arrayBuffer) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		if (!webGL2RenderingContext) {
			throw new Error("WebGL2 를 쓸 수 없다.");
		}
		const arrays = readGlbArrays(arrayBuffer);
		const vertexData = arrays.vertexData;
		const minimum = [System.Infinity, System.Infinity, System.Infinity];
		const maximum = [-System.Infinity, -System.Infinity, -System.Infinity];
		for (let offset = 0; offset < vertexData.length; offset += VERTEX_FLOAT_COUNT) {
			for (let axis = 0; axis < 3; ++axis) {
				minimum[axis] = System.Math.min(minimum[axis], vertexData[offset + axis]);
				maximum[axis] = System.Math.max(maximum[axis], vertexData[offset + axis]);
			}
		}
		this.#center = [(minimum[0] + maximum[0]) * 0.5, (minimum[1] + maximum[1]) * 0.5, (minimum[2] + maximum[2]) * 0.5];
		this.#radius = System.Math.max(0.0001, System.Math.hypot(maximum[0] - minimum[0], maximum[1] - minimum[1], maximum[2] - minimum[2]) * 0.5);
		this.#renderer = new ToonRenderer(webGL2RenderingContext);
		this.#mesh = this.#renderer.createMesh(arrays);
		this.requestFrame();
		return {
			vertexCount: vertexData.length / VERTEX_FLOAT_COUNT,
			triangleCount: arrays.indexData.length / 3,
			hasSkeleton: arrays.skeleton !== null && arrays.skeleton !== undefined,
			size: [maximum[0] - minimum[0], maximum[1] - minimum[1], maximum[2] - minimum[2]] };
	}

	//==============================================================================
	// 다음 장 예약.
	//==============================================================================
	requestFrame() {
		this.#frameRequest = System.requestAnimationFrame(() => {
			if (this.#isDisposed) {
				return;
			}
			this.draw();
			this.requestFrame();
		});
	}

	//==============================================================================
	// 한 장 그리기. (안 끄는 동안은 천천히 돈다)
	//==============================================================================
	draw() {
		const canvas = this.#canvas;
		if (!canvas.isConnected) {
			this.dispose();
			return;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const pixelRatio = System.window.devicePixelRatio || 1;
		const width = System.Math.max(1, System.Math.round(canvas.clientWidth * pixelRatio));
		const height = System.Math.max(1, System.Math.round(canvas.clientHeight * pixelRatio));
		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
		}
		if (!this.#isDragging) {
			this.#yaw += 0.005;
		}
		webGL2RenderingContext.viewport(0, 0, width, height);
		webGL2RenderingContext.clearColor(0.12, 0.13, 0.15, 1);
		webGL2RenderingContext.clear(webGL2RenderingContext.COLOR_BUFFER_BIT | webGL2RenderingContext.DEPTH_BUFFER_BIT);
		const renderer = this.#renderer;
		if (renderer === null || this.#mesh === null) {
			return;
		}
		const center = this.#center;
		const radius = this.#radius;
		const distance = radius / System.Math.sin(FIELD_OF_VIEW * 0.5) * 1.1;
		const cosinePitch = System.Math.cos(this.#pitch);
		const eyePosition = Vector3.create(
			center[0] + System.Math.sin(this.#yaw) * cosinePitch * distance,
			center[1] + System.Math.sin(this.#pitch) * distance,
			center[2] + System.Math.cos(this.#yaw) * cosinePitch * distance,
		);
		const viewMatrix = Matrix4.createLookAt(eyePosition, Vector3.create(center[0], center[1], center[2]), Vector3.create(0, 1, 0));
		const viewProjectionMatrix = Matrix4.createPerspective(FIELD_OF_VIEW, width / height, distance * 0.01, distance * 4);
		viewProjectionMatrix.multiply(viewMatrix);
		renderer.beginFrame(viewProjectionMatrix);
		renderer.drawMesh(this.#mesh, Matrix4.createIdentity(), { isCulled: false });
		renderer.endFrame();
	}

	//==============================================================================
	// 그리기 멈추기.
	//==============================================================================
	dispose() {
		this.#isDisposed = true;
		System.cancelAnimationFrame(this.#frameRequest);
		const loseContextExtension = this.#webGL2RenderingContext ? this.#webGL2RenderingContext.getExtension("WEBGL_lose_context") : null;
		if (loseContextExtension !== null) {
			loseContextExtension.loseContext();
		}
	}
}
