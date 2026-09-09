//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";
import { Matrix4 } from "../../base/matrix4.js";
import { Vector3 } from "../../base/vector3.js";


//==============================================================================
// 섀도우 맵. (방향광 실시간 그림자 — 깊이 텍스처 + 직교 광원 행렬)
// - beginRender() 로 깊이 패스를 시작하고, 결과 텍스처를 본 패스에서 샘플링한다.
// - 광원 행렬은 텍셀 단위로 스냅해 이동 시 그림자 가장자리 떨림을 줄인다.
//==============================================================================
export class ShadowMap extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { WebGLFramebuffer } */ #framebuffer;
	/** @private @type { WebGLTexture } */ #depthTexture;
	/** @private @type { number } */ #resolution;
	/** @private @type { Matrix4 } */ #lightViewProjectionMatrix;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 * @param { number } resolution
	 */
	constructor(webGL2RenderingContext, resolution = 2048) {
		super();

		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#resolution = resolution;
		this.#lightViewProjectionMatrix = Matrix4.createIdentity();

		// 깊이 텍스처. (하드웨어 비교 샘플링 — sampler2DShadow)
		const depthTexture = webGL2RenderingContext.createTexture();
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, depthTexture);
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.DEPTH_COMPONENT24, resolution, resolution, 0, webGL2RenderingContext.DEPTH_COMPONENT, webGL2RenderingContext.UNSIGNED_INT, null);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.LINEAR);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.LINEAR);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_COMPARE_MODE, webGL2RenderingContext.COMPARE_REF_TO_TEXTURE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_COMPARE_FUNC, webGL2RenderingContext.LEQUAL);

		// 프레임버퍼. (컬러 어태치먼트 없음 — 깊이 전용)
		const framebuffer = webGL2RenderingContext.createFramebuffer();
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, framebuffer);
		webGL2RenderingContext.framebufferTexture2D(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.DEPTH_ATTACHMENT, webGL2RenderingContext.TEXTURE_2D, depthTexture, 0);
		webGL2RenderingContext.drawBuffers([webGL2RenderingContext.NONE]);
		webGL2RenderingContext.readBuffer(webGL2RenderingContext.NONE);
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, null);

		this.#framebuffer = framebuffer;
		this.#depthTexture = depthTexture;
	}

	//==============================================================================
	// 광원 행렬 갱신. (초점 주변을 덮는 직교 투영 — 텍셀 스냅)
	//==============================================================================
	/**
	 * @param { Vector3 } focusPosition
	 * @param { Vector3 } lightDirection 빛이 나아가는 방향.
	 * @param { number } extent 초점 기준 절반 커버 범위.
	 * @param { number } nearDistance
	 * @param { number } farDistance
	 */
	updateLightMatrix(focusPosition, lightDirection, extent, nearDistance, farDistance) {
		const normalizedDirection = lightDirection.normalize();
		const eyeDistance = (nearDistance + farDistance) * 0.5;
		const eyeOffset = normalizedDirection.multiply(-eyeDistance);
		const eyePosition = focusPosition.add(eyeOffset);
		const upDirection = Vector3.up();
		const viewMatrix = Matrix4.createLookAt(eyePosition, focusPosition, upDirection);

		// 텍셀 스냅. (광원 공간 이동 성분을 텍셀 크기로 양자화 — 떨림 방지)
		const worldUnitsPerTexel = (extent * 2) / this.getResolution();
		const viewElements = viewMatrix.getElements();
		viewElements[12] = System.Math.round(viewElements[12] / worldUnitsPerTexel) * worldUnitsPerTexel;
		viewElements[13] = System.Math.round(viewElements[13] / worldUnitsPerTexel) * worldUnitsPerTexel;

		const orthographicMatrix = Matrix4.createOrthographic(-extent, extent, -extent, extent, nearDistance, farDistance);
		const lightViewProjectionMatrix = orthographicMatrix.clone();
		lightViewProjectionMatrix.multiply(viewMatrix);
		this.#lightViewProjectionMatrix = lightViewProjectionMatrix;
	}

	//==============================================================================
	// 깊이 패스 시작. (프레임버퍼 바인드 + 뷰포트 + 깊이 클리어)
	//==============================================================================
	beginRender() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const framebuffer = this.getFramebuffer();
		const resolution = this.getResolution();
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, framebuffer);
		webGL2RenderingContext.viewport(0, 0, resolution, resolution);
		webGL2RenderingContext.enable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.depthMask(true);
		webGL2RenderingContext.clear(webGL2RenderingContext.DEPTH_BUFFER_BIT);
	}

	//==============================================================================
	// 렌더링 컨텍스트 반환.
	//==============================================================================
	/**
	 * @returns { WebGL2RenderingContext }
	 */
	getWebGL2RenderingContext() {
		return this.#webGL2RenderingContext;
	}

	//==============================================================================
	// 프레임버퍼 반환.
	//==============================================================================
	/**
	 * @returns { WebGLFramebuffer }
	 */
	getFramebuffer() {
		return this.#framebuffer;
	}

	//==============================================================================
	// 깊이 텍스처 반환.
	//==============================================================================
	/**
	 * @returns { WebGLTexture }
	 */
	getDepthTexture() {
		return this.#depthTexture;
	}

	//==============================================================================
	// 해상도 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getResolution() {
		return this.#resolution;
	}

	//==============================================================================
	// 광원 뷰 투영 행렬 반환.
	//==============================================================================
	/**
	 * @returns { Matrix4 }
	 */
	getLightViewProjectionMatrix() {
		return this.#lightViewProjectionMatrix;
	}
}
