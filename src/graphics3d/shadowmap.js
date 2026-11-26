//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Matrix4 } from "../base/matrix4.js";
import { Vector3 } from "../base/vector3.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 그림자 아틀라스가 받는 점광과 스포트라이트 수의 상한. (셰이더의 유니폼 배열 크기)
export const SHADOW_ATLAS_MAXIMUM_LIGHTS = 4;

// 점광 큐브 여섯 면의 앞쪽과 위쪽. (+x, -x, +y, -y, +z, -z 차례, 오른쪽은 앞쪽 x 위쪽, 셰이더의 면 고르기와 같다)
const CUBE_FACE_FORWARDS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const CUBE_FACE_UPS = [[0, 1, 0], [0, 1, 0], [0, 0, 1], [0, 0, 1], [0, 1, 0], [0, 1, 0]];


//==============================================================================
// 깊이 판 짓기. (하드웨어 비교 샘플링 sampler2DShadow 의 DEPTH_COMPONENT24 텍스처와 컬러 없는 프레임버퍼, 앞의 텍스처와 프레임버퍼 묶음은 돌린다)
// - 깊이 텍스처를 묶은 채로 두면, 그 유닛을 읽는 프로그램이 이 프레임버퍼에 그릴 때 WebGL 이 되먹임 고리로 보고 INVALID_OPERATION 을 낸다.
//==============================================================================
/**
 * @param { WebGL2RenderingContext } webGL2RenderingContext - 렌더링 컨텍스트.
 * @param { number } resolution - 한 변의 크기. (픽셀)
 * @returns { object } { framebuffer, depthTexture }
 */
function createDepthTarget(webGL2RenderingContext, resolution) {
	const previousTexture = webGL2RenderingContext.getParameter(webGL2RenderingContext.TEXTURE_BINDING_2D);
	const previousFramebuffer = webGL2RenderingContext.getParameter(webGL2RenderingContext.FRAMEBUFFER_BINDING);
	const depthTexture = webGL2RenderingContext.createTexture();
	webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, depthTexture);
	webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.DEPTH_COMPONENT24, resolution, resolution, 0, webGL2RenderingContext.DEPTH_COMPONENT, webGL2RenderingContext.UNSIGNED_INT, null);
	webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.LINEAR);
	webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.LINEAR);
	webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
	webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
	webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_COMPARE_MODE, webGL2RenderingContext.COMPARE_REF_TO_TEXTURE);
	webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_COMPARE_FUNC, webGL2RenderingContext.LEQUAL);
	const framebuffer = webGL2RenderingContext.createFramebuffer();
	webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, framebuffer);
	webGL2RenderingContext.framebufferTexture2D(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.DEPTH_ATTACHMENT, webGL2RenderingContext.TEXTURE_2D, depthTexture, 0);
	webGL2RenderingContext.drawBuffers([webGL2RenderingContext.NONE]);
	webGL2RenderingContext.readBuffer(webGL2RenderingContext.NONE);
	webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, previousFramebuffer);
	webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, previousTexture);
	return { framebuffer: framebuffer, depthTexture: depthTexture };
}

//==============================================================================
// 앞쪽, 위쪽, 자리로 보기 행렬 짓기. (오른쪽은 앞쪽 x 위쪽, 카메라는 앞쪽을 본다, 셰이더가 같은 바탕으로 칸 자리를 셈한다)
//==============================================================================
/**
 * @param { Array<number> } position - 눈의 자리. [x, y, z]
 * @param { Array<number> } forward - 보는 쪽. (길이 1)
 * @param { Array<number> } up - 위쪽. (길이 1, 앞쪽에 수직)
 * @returns { Matrix4 } 보기 행렬.
 */
function createBasisViewMatrix(position, forward, up) {
	const right = [forward[1] * up[2] - forward[2] * up[1], forward[2] * up[0] - forward[0] * up[2], forward[0] * up[1] - forward[1] * up[0]];
	const back = [-forward[0], -forward[1], -forward[2]];
	const dot = (axis) => {
		return axis[0] * position[0] + axis[1] * position[1] + axis[2] * position[2];
	};
	const matrix = Matrix4.createIdentity();
	const elements = matrix.getElements();
	elements[0] = right[0];
	elements[4] = right[1];
	elements[8] = right[2];
	elements[12] = -dot(right);
	elements[1] = up[0];
	elements[5] = up[1];
	elements[9] = up[2];
	elements[13] = -dot(up);
	elements[2] = back[0];
	elements[6] = back[1];
	elements[10] = back[2];
	elements[14] = -dot(back);
	elements[3] = 0;
	elements[7] = 0;
	elements[11] = 0;
	elements[15] = 1;
	return matrix;
}


//==============================================================================
// 섀도우 맵. (방향광 실시간 그림자, 깊이 텍스처 + 직교 광원 행렬)
// - beginRender() 로 깊이 패스를 시작하고, 결과 텍스처를 본 패스에서 샘플링한다.
// - 광원 행렬은 텍셀 단위로 스냅해 이동 시 그림자 가장자리 떨림을 줄인다.
// - 지을 때 앞의 텍스처와 프레임버퍼 묶음을 돌린다. (모형을 지은 뒤에 지어도 깊이 텍스처가 텍스처 유닛에 남아 그리기가 INVALID_OPERATION 이 되지 않게)
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
		const depthTarget = createDepthTarget(webGL2RenderingContext, resolution);
		this.#framebuffer = depthTarget.framebuffer;
		this.#depthTexture = depthTarget.depthTexture;
	}

	//==============================================================================
	// 광원 행렬 갱신. (초점 주변을 덮는 직교 투영, 텍셀 스냅, 빛이 거의 바로 위나 아래로 나아가면 위쪽을 z 축으로 잡아 행렬이 깨지지 않게)
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
		const upDirection = System.Math.abs(normalizedDirection.y) > 0.99 ? Vector3.create(0, 0, 1) : Vector3.up();
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


//==============================================================================
// 그림자 아틀라스. (점광과 스포트라이트의 실시간 그림자를 깊이 텍스처 한 장에 칸으로 나눠 담는다)
// - 유니티 URP 의 추가 빛 그림자 아틀라스 꼴이다. 스포트라이트는 원근 그림자 맵 한 칸, 점광은 큐브 여섯 면을 칸 여섯에 (면마다 90 도 원근) 그린다.
// - updateLights(빛 목록) 이 castsShadow 가 true 인 빛을 SHADOW_ATLAS_MAXIMUM_LIGHTS 까지 골라 칸을 나누고 칸마다 보기와 투영을 셈한다.
//   빛은 ToonLightSet.setPointLights 의 꼴이다. { position, direction (있으면 스포트라이트), outerConeAngle, range (먼 거리, 0 이면 30), shadowNear (가까운 거리, 기본 0.05), castsShadow }
//   목록에서의 차례(lightIndex)를 적어 두어, ToonRenderer 가 그 점광에 이 그림자를 붙인다. (아틀라스는 기본 빛 묶음의 점광 목록으로 짓는다)
// - 칸은 한 변 gridSize 의 격자다. (gridSize = 올림(칸 수의 제곱근), 칸 한 변 = 내림(해상도 / gridSize))
// - 그리기: beginRender() 로 판을 비우고, 칸마다 beginTile(칸 번호) 로 뷰포트를 그 칸에 건 뒤 getTile(칸 번호).viewProjectionMatrix 로 깊이를 그린다. (ToonRenderer.beginShadowAtlasPass 와 setShadowAtlasTile 이 이 차례를 한다)
// - 받기: 셰이더는 빛의 자리에서 면으로의 쪽으로 점광의 면을 고르고(가장 큰 축), 앞쪽, 위쪽, 오른쪽 바탕과 가까운 거리, 먼 거리로 칸 안 자리와 깊이를 셈해 3x3 PCF 로 견준다.
//   받는 자리는 노멀 쪽으로 그 거리의 칸 텍셀 (1 + 3 x (1 - dot(N, L))) 개만큼 밀어 견준다. (빛에 비스듬한 면일수록 크게, 빛과 그늘 경계의 톱니 같은 그림자 여드름을 막는다)
//==============================================================================
/**
 * @example <caption>점광 하나와 스포트라이트 하나의 그림자 칸 짓기</caption>
 * import { ShadowAtlas } from "./vanilla.js";
 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
 * const shadowAtlas = new ShadowAtlas(webGL2RenderingContext, 2048);
 * shadowAtlas.updateLights([
 * 	{ position: [0, 3, 0], range: 8, castsShadow: true },
 * 	{ position: [2, 4, 1], direction: [0, -1, 0], outerConeAngle: 0.5, range: 10, castsShadow: true },
 * ]);
 * const tileCount = shadowAtlas.getTileCount();
 * const firstTile = shadowAtlas.getTile(0);
 * console.log(tileCount, shadowAtlas.getGridSize(), firstTile.size);
 * shadowAtlas.destroy();
 */
export class ShadowAtlas extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { WebGLFramebuffer } */ #framebuffer;
	/** @private @type { WebGLTexture } */ #depthTexture;
	/** @private @type { number } */ #resolution;
	/** @private @type { number } */ #gridSize; // 격자 한 변의 칸 수.
	/** @private @type { number } */ #tileSize; // 칸 한 변. (픽셀)
	/** @private @type { Array<object> } */ #lights; // { lightIndex, position, forward, up, tangent (0 이면 점광), near, far, firstTile }
	/** @private @type { Array<object> } */ #tiles; // { viewProjectionMatrix, x, y, size }

	//==============================================================================
	// 생성. (깊이 텍스처와 컬러 없는 프레임버퍼, 앞의 묶음은 돌린다)
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext - 렌더링 컨텍스트.
	 * @param { number } [resolution] - 아틀라스 한 변의 크기. (픽셀, 기본 2048)
	 */
	constructor(webGL2RenderingContext, resolution = 2048) {
		super();
		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#resolution = resolution;
		const depthTarget = createDepthTarget(webGL2RenderingContext, resolution);
		this.#framebuffer = depthTarget.framebuffer;
		this.#depthTexture = depthTarget.depthTexture;
		this.#gridSize = 1;
		this.#tileSize = resolution;
		this.#lights = [];
		this.#tiles = [];
	}

	//==============================================================================
	// 빛 목록으로 칸 나누기. (castsShadow 가 true 인 것을 SHADOW_ATLAS_MAXIMUM_LIGHTS 까지, 스포트라이트 한 칸, 점광 여섯 칸)
	//==============================================================================
	/**
	 * @param { Array<object> } pointLights - ToonLightSet.setPointLights 의 꼴의 배열. (getPointLights 를 그대로 주면 된다)
	 */
	updateLights(pointLights) {
		this.#lights = [];
		let tileCount = 0;
		for (let lightIndex = 0; lightIndex < pointLights.length; ++lightIndex) {
			const pointLight = pointLights[lightIndex];
			if (pointLight.castsShadow !== true || this.#lights.length >= SHADOW_ATLAS_MAXIMUM_LIGHTS) {
				continue;
			}
			const near = pointLight.shadowNear !== undefined ? System.Math.max(0.001, pointLight.shadowNear) : 0.05;
			const far = System.Math.max(near + 0.01, pointLight.range !== undefined && pointLight.range > 0 ? pointLight.range : 30);
			const direction = pointLight.direction !== undefined && pointLight.direction !== null ? normalizeDirection(pointLight.direction) : null;
			const light = { lightIndex: lightIndex, position: pointLight.position.slice(), forward: [0, 0, 1], up: [0, 1, 0], tangent: 0, near: near, far: far, firstTile: tileCount };
			if (direction !== null) {
				const outerConeAngle = pointLight.outerConeAngle !== undefined ? pointLight.outerConeAngle : System.Math.PI / 4;
				const helper = System.Math.abs(direction[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
				const along = helper[0] * direction[0] + helper[1] * direction[1] + helper[2] * direction[2];
				light.forward = direction;
				light.up = normalizeDirection([helper[0] - direction[0] * along, helper[1] - direction[1] * along, helper[2] - direction[2] * along]);
				light.tangent = System.Math.tan(System.Math.min(System.Math.max(0.01, outerConeAngle) + 0.05, 1.45));
				tileCount += 1;
			}
			else {
				tileCount += 6;
			}
			this.#lights.push(light);
		}
		this.#gridSize = System.Math.max(1, System.Math.ceil(System.Math.sqrt(tileCount)));
		this.#tileSize = System.Math.floor(this.#resolution / this.#gridSize);
		this.#tiles = [];
		for (const light of this.#lights) {
			if (light.tangent > 0) {
				this.#tiles.push(this.createTile(light.position, light.forward, light.up, light.tangent, light.near, light.far));
				continue;
			}
			for (let faceIndex = 0; faceIndex < 6; ++faceIndex) {
				this.#tiles.push(this.createTile(light.position, CUBE_FACE_FORWARDS[faceIndex], CUBE_FACE_UPS[faceIndex], 1, light.near, light.far));
			}
		}
	}

	//==============================================================================
	// 칸 하나 짓기. (지금까지 지은 칸 수로 격자 자리를 정하고, 바탕 보기 행렬과 원근 투영을 곱한다)
	//==============================================================================
	/**
	 * @param { Array<number> } position - 빛의 자리.
	 * @param { Array<number> } forward - 보는 쪽.
	 * @param { Array<number> } up - 위쪽.
	 * @param { number } tangent - 반각의 탄젠트. (점광 면은 1, 90 도)
	 * @param { number } near - 가까운 거리.
	 * @param { number } far - 먼 거리.
	 * @returns { object } { viewProjectionMatrix, x, y, size }
	 */
	createTile(position, forward, up, tangent, near, far) {
		const tileIndex = this.#tiles.length;
		const viewProjectionMatrix = Matrix4.createPerspective(2 * System.Math.atan(tangent), 1, near, far);
		viewProjectionMatrix.multiply(createBasisViewMatrix(position, forward, up));
		return { viewProjectionMatrix: viewProjectionMatrix, x: (tileIndex % this.#gridSize) * this.#tileSize, y: System.Math.floor(tileIndex / this.#gridSize) * this.#tileSize, size: this.#tileSize };
	}

	//==============================================================================
	// 깊이 패스 시작. (프레임버퍼를 묶고 판 전체를 비운다, 칸마다 beginTile)
	//==============================================================================
	beginRender() {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, this.#framebuffer);
		webGL2RenderingContext.viewport(0, 0, this.#resolution, this.#resolution);
		webGL2RenderingContext.disable(webGL2RenderingContext.SCISSOR_TEST);
		webGL2RenderingContext.enable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.depthMask(true);
		webGL2RenderingContext.clear(webGL2RenderingContext.DEPTH_BUFFER_BIT);
	}

	//==============================================================================
	// 칸 하나에 뷰포트 걸기.
	//==============================================================================
	/**
	 * @param { number } tileIndex - 칸 번호. (0 ~ getTileCount() - 1)
	 */
	beginTile(tileIndex) {
		const tile = this.#tiles[tileIndex];
		this.#webGL2RenderingContext.viewport(tile.x, tile.y, tile.size, tile.size);
	}

	//==============================================================================
	// 그림자를 받는 빛 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 칸을 받은 빛 수. (0 ~ SHADOW_ATLAS_MAXIMUM_LIGHTS)
	 */
	getLightCount() {
		return this.#lights.length;
	}

	//==============================================================================
	// 그림자를 받는 빛 반환. (셰이더에 올릴 값)
	//==============================================================================
	/**
	 * @returns { Array<object> } { lightIndex (빛 목록의 차례), position, forward, up, tangent (0 이면 점광), near, far, firstTile } 의 배열.
	 */
	getLights() {
		return this.#lights;
	}

	//==============================================================================
	// 칸 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 지은 칸 수. (스포트라이트 하나, 점광 여섯)
	 */
	getTileCount() {
		return this.#tiles.length;
	}

	//==============================================================================
	// 칸 반환.
	//==============================================================================
	/**
	 * @param { number } tileIndex - 칸 번호.
	 * @returns { object } { viewProjectionMatrix (Matrix4), x, y, size (픽셀) }
	 */
	getTile(tileIndex) {
		return this.#tiles[tileIndex];
	}

	//==============================================================================
	// 격자 한 변의 칸 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 격자 한 변의 칸 수.
	 */
	getGridSize() {
		return this.#gridSize;
	}

	//==============================================================================
	// 칸 한 변 반환. (픽셀)
	//==============================================================================
	/**
	 * @returns { number } 칸 한 변. (픽셀)
	 */
	getTileSize() {
		return this.#tileSize;
	}

	//==============================================================================
	// 해상도 반환.
	//==============================================================================
	/**
	 * @returns { number } 아틀라스 한 변. (픽셀)
	 */
	getResolution() {
		return this.#resolution;
	}

	//==============================================================================
	// 깊이 텍스처 반환. (비교 샘플링 sampler2DShadow)
	//==============================================================================
	/**
	 * @returns { WebGLTexture } 아틀라스의 깊이 텍스처.
	 */
	getDepthTexture() {
		return this.#depthTexture;
	}

	//==============================================================================
	// 프레임버퍼 반환.
	//==============================================================================
	/**
	 * @returns { WebGLFramebuffer } 아틀라스의 깊이 프레임버퍼.
	 */
	getFramebuffer() {
		return this.#framebuffer;
	}

	//==============================================================================
	// 파괴. (프레임버퍼와 깊이 텍스처를 지운다)
	//==============================================================================
	destroy() {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		webGL2RenderingContext.deleteFramebuffer(this.#framebuffer);
		webGL2RenderingContext.deleteTexture(this.#depthTexture);
	}
}


//==============================================================================
// 3 수 벡터 길이를 1 로. (길이 0 이면 아래쪽)
//==============================================================================
/**
 * @param { Array<number> } direction - [x, y, z]
 * @returns { Array<number> } 길이 1 인 [x, y, z].
 */
function normalizeDirection(direction) {
	const length = System.Math.hypot(direction[0], direction[1], direction[2]);
	if (length <= 0) {
		return [0, -1, 0];
	}
	return [direction[0] / length, direction[1] / length, direction[2] / length];
}
