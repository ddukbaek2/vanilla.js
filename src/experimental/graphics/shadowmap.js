//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";
import { Matrix4 } from "../../base/matrix4.js";
import { Vector3 } from "../../base/vector3.js";


//==============================================================================
// 섀도우 맵. (방향광 실시간 그림자, 깊이 텍스처 + 직교 광원 행렬)
// - beginRender() 로 깊이 패스를 시작하고, 결과 텍스처를 본 패스에서 샘플링한다.
// - 광원 행렬은 텍셀 단위로 스냅해 이동 시 그림자 가장자리 떨림을 줄인다.
//==============================================================================
/**
 * @example <caption>깊이 패스로 그림자를 굽고 본 패스에서 받기</caption>
 * import { ShadowMap, SkinnedModel, SkinnedModelRenderer, Camera3D, Matrix4, Vector3 } from "./build/vanilla.js";
 *
 * const width = 640;
 * const height = 360;
 * const canvas = document.createElement("canvas");
 * canvas.width = width;
 * canvas.height = height;
 * document.body.appendChild(canvas);
 * const webGL2RenderingContext = canvas.getContext("webgl2");
 * const shadowMap = new ShadowMap(webGL2RenderingContext, 1024);
 * const skinnedModelRenderer = new SkinnedModelRenderer(webGL2RenderingContext);
 * const skinnedModel = await SkinnedModel.loadFromUrl(webGL2RenderingContext, "examples/ancientmountain/assets/fox.glb", skinnedModelRenderer);
 * skinnedModel.update(0);
 * const modelMatrix = Matrix4.createIdentity();
 * const modelMatrixElements = modelMatrix.getElements();
 *
 * const focusPosition = Vector3.create(0, 40, 0);
 * const lightDirection = Vector3.create(-0.45, -0.76, -0.47);
 * shadowMap.updateLightMatrix(focusPosition, lightDirection, 150, 1, 600);
 * const lightViewProjectionMatrix = shadowMap.getLightViewProjectionMatrix();
 * const lightViewProjectionElements = lightViewProjectionMatrix.getElements();
 * shadowMap.beginRender();
 * skinnedModelRenderer.drawDepth(skinnedModel, lightViewProjectionElements, modelMatrixElements);
 *
 * const depthTexture = shadowMap.getDepthTexture();
 * const resolution = shadowMap.getResolution();
 * skinnedModelRenderer.setShadowMap(depthTexture, lightViewProjectionElements, 1 / resolution);
 * skinnedModelRenderer.setShadowStrength(0.8);
 * skinnedModelRenderer.setSunDirection(0.45, 0.76, 0.47);
 * const cameraX = 0;
 * const cameraY = 80;
 * const cameraZ = 220;
 * const camera = new Camera3D();
 * camera.setPerspective(Math.PI / 3, 1, 2000);
 * camera.setAspectRatio(width / height);
 * const eyePosition = Vector3.create(cameraX, cameraY, cameraZ);
 * const targetPosition = Vector3.create(0, 45, 0);
 * camera.lookAt(eyePosition, targetPosition);
 * const viewProjectionMatrix = camera.getViewProjectionMatrix();
 * const viewProjectionElements = viewProjectionMatrix.getElements();
 * webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, null);
 * webGL2RenderingContext.viewport(0, 0, width, height);
 * webGL2RenderingContext.clearColor(0.16, 0.2, 0.26, 1);
 * webGL2RenderingContext.clear(webGL2RenderingContext.COLOR_BUFFER_BIT | webGL2RenderingContext.DEPTH_BUFFER_BIT);
 * skinnedModelRenderer.draw(skinnedModel, viewProjectionElements, modelMatrixElements, cameraX, cameraY, cameraZ);
 */
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
	 * @param { WebGL2RenderingContext } webGL2RenderingContext WebGL2 렌더링 컨텍스트.
	 * @param { number } resolution 깊이 텍스처 한 변의 크기. (픽셀, 기본 2048)
	 */
	constructor(webGL2RenderingContext, resolution = 2048) {
		super();

		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#resolution = resolution;
		this.#lightViewProjectionMatrix = Matrix4.createIdentity();

		// 깊이 텍스처. (하드웨어 비교 샘플링, sampler2DShadow)
		const depthTexture = webGL2RenderingContext.createTexture();
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, depthTexture);
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.DEPTH_COMPONENT24, resolution, resolution, 0, webGL2RenderingContext.DEPTH_COMPONENT, webGL2RenderingContext.UNSIGNED_INT, null);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.LINEAR);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.LINEAR);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_COMPARE_MODE, webGL2RenderingContext.COMPARE_REF_TO_TEXTURE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_COMPARE_FUNC, webGL2RenderingContext.LEQUAL);

		// 프레임버퍼. (컬러 어태치먼트 없음, 깊이 전용)
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
	// 광원 행렬 갱신. (초점 주변을 덮는 직교 투영, 텍셀 스냅)
	//==============================================================================
	/**
	 * @param { Vector3 } focusPosition 그림자를 덮을 가운데 월드 자리.
	 * @param { Vector3 } lightDirection 빛이 나아가는 방향.
	 * @param { number } extent 초점 기준 절반 커버 범위.
	 * @param { number } nearDistance 광원 직교 투영의 가까운 거리. (월드 단위)
	 * @param { number } farDistance 광원 직교 투영의 먼 거리. (월드 단위, 광원 눈은 초점에서 빛 반대쪽으로 (가까운 거리 + 먼 거리) / 2 만큼 떨어진다)
	 * @example <caption>움직이는 초점을 따라가는 광원 행렬</caption>
	 * import { ShadowMap, Vector3 } from "./build/vanilla.js";
	 *
	 * const canvas = document.createElement("canvas");
	 * const webGL2RenderingContext = canvas.getContext("webgl2");
	 * const shadowMap = new ShadowMap(webGL2RenderingContext, 2048);
	 * const playerPosition = Vector3.create(12, 0, -4);
	 * const sunTravelDirection = Vector3.create(-0.4, -1.0, -0.3);
	 * shadowMap.updateLightMatrix(playerPosition, sunTravelDirection, 30, 0.5, 200);
	 * const lightViewProjectionMatrix = shadowMap.getLightViewProjectionMatrix();
	 * const clipPoint = lightViewProjectionMatrix.transformPoint(12, 0, -4);
	 * console.log(clipPoint.x, clipPoint.y, clipPoint.z);
	 * shadowMap.destroy();
	 */
	updateLightMatrix(focusPosition, lightDirection, extent, nearDistance, farDistance) {
		const normalizedDirection = lightDirection.normalize();
		const eyeDistance = (nearDistance + farDistance) * 0.5;
		const eyeOffset = normalizedDirection.multiply(-eyeDistance);
		const eyePosition = focusPosition.add(eyeOffset);
		const upDirection = Vector3.up();
		const viewMatrix = Matrix4.createLookAt(eyePosition, focusPosition, upDirection);

		// 텍셀 스냅. (광원 공간 이동 성분을 텍셀 크기로 양자화, 떨림 방지)
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
	 * @returns { WebGL2RenderingContext } 렌더링 컨텍스트.
	 */
	getWebGL2RenderingContext() {
		return this.#webGL2RenderingContext;
	}

	//==============================================================================
	// 프레임버퍼 반환.
	//==============================================================================
	/**
	 * @returns { WebGLFramebuffer } 깊이 전용 프레임버퍼.
	 */
	getFramebuffer() {
		return this.#framebuffer;
	}

	//==============================================================================
	// 깊이 텍스처 반환.
	//==============================================================================
	/**
	 * @returns { WebGLTexture } 비교 샘플링(sampler2DShadow)용 깊이 텍스처. (DEPTH_COMPONENT24)
	 */
	getDepthTexture() {
		return this.#depthTexture;
	}

	//==============================================================================
	// 해상도 반환.
	//==============================================================================
	/**
	 * @returns { number } 깊이 텍스처 한 변의 크기. (픽셀)
	 */
	getResolution() {
		return this.#resolution;
	}

	//==============================================================================
	// 광원 뷰 투영 행렬 반환.
	//==============================================================================
	/**
	 * @returns { Matrix4 } 광원 뷰 투영 행렬. (updateLightMatrix 전에는 단위 행렬)
	 */
	getLightViewProjectionMatrix() {
		return this.#lightViewProjectionMatrix;
	}

	//==============================================================================
	// 파괴. (프레임버퍼와 깊이 텍스처를 지운다)
	//==============================================================================
	destroy() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.deleteFramebuffer(this.#framebuffer);
		webGL2RenderingContext.deleteTexture(this.#depthTexture);
	}
}
