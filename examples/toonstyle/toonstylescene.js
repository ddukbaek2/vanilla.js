//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Matrix4, Vector3, Camera3D, ToonRenderer, ToonDrawQueue, ToonMesh, ToonScreenOutline, ToonMatcapBlend, ShadowMap, ShadowAtlas } from "../../import.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 해가 비추는 방향. (빛이 나아가는 쪽)
const SUN_DIRECTION = [-0.45, -1.0, -0.55];

// 결정 덩이 꼭짓점 열둘의 반지름 배.
const CHUNK_SCALES = [1.0, 0.85, 1.1, 0.95, 1.05, 0.9, 1.0, 1.12, 0.88, 1.0, 0.95, 1.08];


//==============================================================================
// 도형 하나로 지은 배열. (hasShell 이면 껍데기 바깥선도)
//==============================================================================
/**
 * @param { object } geometry
 * @param { string } colorText
 * @param { boolean } hasShell
 * @returns { object }
 */
function buildArrays(geometry, colorText, hasShell) {
	if (geometry.uvs !== undefined && geometry.uvs1 === undefined) {
		geometry.uvs1 = geometry.uvs;
	}
	const builder = new ToonMesh.MeshBuilder();
	builder.addPart(geometry, Matrix4.createIdentity(), colorText, { hasOutline: hasShell, outlineWidth: 0.025 });
	return builder.readArrays();
}

//==============================================================================
// 매트캡 그림. (64x64, 왼쪽 위의 밝은 점과 둘레로 갈수록 엷어지는 빛, 더하기로 쓴다)
//==============================================================================
/**
 * @returns { object } { width, height, data }
 */
function createMatcapPixels() {
	const size = 64;
	const data = new System.Uint8Array(size * size * 4);
	for (let pixelY = 0; pixelY < size; ++pixelY) {
		for (let pixelX = 0; pixelX < size; ++pixelX) {
			const normalX = (pixelX + 0.5) / size * 2 - 1;
			const normalY = 1 - (pixelY + 0.5) / size * 2;
			const spot = System.Math.max(0, 1 - System.Math.hypot(normalX + 0.35, normalY - 0.4) / 0.32);
			const glow = System.Math.max(0, 1 - System.Math.hypot(normalX, normalY)) * 0.25;
			const value = System.Math.min(255, System.Math.round((System.Math.pow(spot, 1.5) + glow) * 255));
			const offset = (pixelY * size + pixelX) * 4;
			data[offset] = value;
			data[offset + 1] = value;
			data[offset + 2] = value;
			data[offset + 3] = 255;
		}
	}
	return { width: size, height: size, data: data };
}

//==============================================================================
// 천사 고리 그림. (64x64, 가로로 긴 밝은 띠 하나, v 0.3 둘레, 가운데가 가장 밝고 양옆으로 엷어짐)
//==============================================================================
/**
 * @returns { object } { width, height, data }
 */
function createAngelRingPixels() {
	const size = 64;
	const data = new System.Uint8Array(size * size * 4);
	for (let pixelY = 0; pixelY < size; ++pixelY) {
		for (let pixelX = 0; pixelX < size; ++pixelX) {
			const u = (pixelX + 0.5) / size;
			const v = (pixelY + 0.5) / size;
			const band = System.Math.max(0, 1 - System.Math.abs(v - 0.3) / 0.06);
			const across = System.Math.max(0, 1 - System.Math.abs(u - 0.5) / 0.4);
			const value = System.Math.min(255, System.Math.round(band * across * 255));
			const offset = (pixelY * size + pixelX) * 4;
			data[offset] = value;
			data[offset + 1] = value;
			data[offset + 2] = value;
			data[offset + 3] = 255;
		}
	}
	return { width: size, height: size, data: data };
}

//==============================================================================
// 자리, 돌림(y 다음 x), 크기의 행렬.
//==============================================================================
/**
 * @param { Array<number> } translation
 * @param { number } rotationX
 * @param { number } rotationY
 * @param { Array<number> } scale
 * @returns { Matrix4 }
 */
function createPlaced(translation, rotationX, rotationY, scale) {
	const matrix = Matrix4.createTranslation(translation[0], translation[1], translation[2]);
	matrix.rotateY(rotationY);
	matrix.rotateX(rotationX);
	matrix.scale(scale[0], scale[1], scale[2]);
	return matrix;
}


//==============================================================================
// 툰 셰이딩과 바깥선 견주기 장면. (러스트 예제 toonstyle 과 같은 장면, 같은 값)
// - 각진 상자, 둥근 공, 큰 면 결정(팔면체), 잔 면 결정 덩이, 고리, 비스듬한 판, 바닥을 해와 그림자, 점광, 스포트라이트, 림, 하이라이트로 칠한다.
// - 그늘은 바탕, 1 차 그늘(서늘한 보라), 2 차 그늘 셋이고, 그림자는 그늘 색으로 들어간다. 결정은 매트캡을 더한다.
// - 점광(고리 곁)과 스포트라이트(상자 위)는 그림자 아틀라스로 그림자를 드리운다. 그늘 쪽에는 푸른 림, 짙은 공에는 2 번 UV 로 읽는 천사 고리(머리카락 꼴의 반사 띠).
// - 껍데기 바깥선은 8 미터에서 화면 굵기를 맞추고, 16 미터에서 사라지며, 카메라 쪽 깊이로 조금 민다.
// - 화면 공간 바깥선은 그리기 줄에 맡긴다. lineScale 은 선의 판 해상도 몫, isToggled 면 바닥은 선 없이 가리기만, 덩이는 꺾임 선 없이.
// - isShell 이면 화면 공간 바깥선 대신 껍데기 바깥선(거리 배를 건 inverted hull, 모형마다 색과 굵기 배)으로 그린다.
//==============================================================================
export class ToonStyleScene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { ToonRenderer } */ #renderer;
	/** @private @type { ToonScreenOutline | null } */ #outline;
	/** @private @type { WebGLTexture } */ #matcapTexture;
	/** @private @type { WebGLTexture } */ #angelRingTexture;
	/** @private @type { ShadowAtlas } */ #shadowAtlas;
	/** @private @type { ShadowMap } */ #shadowMap;
	/** @private @type { Camera3D } */ #camera;
	/** @private @type { Array<object> } */ #itemList;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 * @param { number } lineScale - 선의 판 해상도 몫.
	 * @param { boolean } isToggled - 모형마다 바깥선 꼴을 바꿔 보일지.
	 * @param { boolean } isShell - 껍데기 바깥선으로 그릴지.
	 */
	constructor(webGL2RenderingContext, lineScale, isToggled, isShell) {
		this.#webGL2RenderingContext = webGL2RenderingContext;
		const renderer = new ToonRenderer(webGL2RenderingContext);
		this.#renderer = renderer;
		renderer.setSunDirection(SUN_DIRECTION);
		renderer.setShade({ step: 0.5, feather: 0.02, color: [0.55, 0.52, 0.72], secondStep: 0.2, secondFeather: 0.02, secondColor: [0.38, 0.35, 0.56] });
		renderer.setRimLight([0.42, 0.48, 0.62], 2.6, 0.1, 0.6);
		renderer.setSpecular(0.6, 56, 0);
		renderer.setShadeRimLight([0.18, 0.3, 0.62], 2.2);
		renderer.setPointLights([
			{ position: [0.9, 1.2, 2.6], color: [1.0, 0.55, 0.25], intensity: 2.0, range: 3.5, castsShadow: true },
			{ position: [-2.6, 3.4, 2.4], color: [0.45, 0.7, 1.0], intensity: 6.0, range: 7.0, direction: [0.25, -1.0, -0.6], innerConeAngle: 0.2, outerConeAngle: 0.38, castsShadow: true },
		]);
		renderer.setOutlineDistanceScale(8, 0.5, 3);
		renderer.setOutlineFadeDistance(9, 16);
		this.#shadowAtlas = new ShadowAtlas(webGL2RenderingContext, 2048);
		this.#shadowAtlas.updateLights(renderer.getLightSet().getPointLights());
		renderer.setLocalShadows(this.#shadowAtlas, 1);
		this.#angelRingTexture = renderer.createTexture(createAngelRingPixels(), { isMipmapped: false, isRepeated: false });
		this.#matcapTexture = renderer.createTexture(createMatcapPixels(), { isMipmapped: false, isRepeated: false });
		const outline = new ToonScreenOutline(webGL2RenderingContext);
		outline.setResolutionScale(lineScale);
		this.#outline = isShell ? null : outline;
		this.#shadowMap = new ShadowMap(webGL2RenderingContext, 2048);
		this.#shadowMap.updateLightMatrix(Vector3.create(0, 0, 0), Vector3.create(SUN_DIRECTION[0], SUN_DIRECTION[1], SUN_DIRECTION[2]), 7, 0.5, 40);
		renderer.setShadow(this.#shadowMap, 1);
		const camera = new Camera3D();
		camera.setPerspective(0.7, 0.1, 100);
		camera.lookAt(Vector3.create(0, 3.4, 7.8), Vector3.create(0, 0.55, 0.3), Vector3.create(0, 1, 0));
		this.#camera = camera;
		const meshOf = (geometry, colorText) => {
			return renderer.createMesh(buildArrays(geometry, colorText, isShell));
		};
		this.#itemList = [
			{ mesh: meshOf(ToonMesh.createBoxGeometry(14, 0.2, 10), "#9aa4b4"), matrix: Matrix4.createTranslation(0, -0.1, 0), options: { lineId: 1, hasScreenOutline: !isToggled, hasOutline: false, specularScale: 0, rimScale: 0 } },
			{ mesh: meshOf(ToonMesh.createBoxGeometry(2.4, 0.1, 3.0), "#86a07e"), matrix: createPlaced([-3.4, 0.55, -1.6], 0.5, 0.25, [1, 1, 1]), options: { lineId: 2, specularScale: 0 } },
			{ mesh: meshOf(ToonMesh.createBoxGeometry(1.2, 1.2, 1.2), "#e8a860"), matrix: createPlaced([-2.0, 0.6, 0.7], 0, 0.55, [1, 1, 1]), options: { lineId: 3 } },
			{ mesh: meshOf(ToonMesh.createSphereGeometry(0.8, 48, 32), "#4a5a8a"), matrix: Matrix4.createTranslation(-0.2, 0.8, 0.2), options: { lineId: 4, angelRingTexture: this.#angelRingTexture, angelRingColor: [0.9, 0.85, 0.7], angelRingOffsetV: 0.3, outlineOffsetZ: 0.02 } },
			{ mesh: meshOf(ToonMesh.createOctahedronGeometry(0.6), "#80c8ff"), matrix: createPlaced([1.5, 0.96, 0.6], 0, 0.4, [1, 1.6, 1]), options: { lineId: 5, matcapTexture: this.#matcapTexture, matcapStrength: 0.7, matcapBlend: ToonMatcapBlend.add, outlineColor: [0.1, 0.22, 0.4, 1] } },
			{ mesh: meshOf(ToonMesh.createFacetedChunkGeometry(0.55, CHUNK_SCALES, [1, 0.8, 1]), "#b0a0d0"), matrix: Matrix4.createTranslation(3.0, 0.45, 0.2), options: { lineId: 6, hasCreaseLine: !isToggled } },
			{ mesh: meshOf(ToonMesh.createTorusGeometry(0.45, 0.17, 16, 40), "#d06070"), matrix: createPlaced([0.9, 0.3, 2.1], 1.2, 0.3, [1, 1, 1]), options: { lineId: 7, outlineColor: [0.35, 0.08, 0.12, 1], outlineWidthScale: 1.4 } },
		];
	}

	//==============================================================================
	// 한 프레임 그리기. (그림자 → 그리기 줄, 그리기 줄이 선의 판과 화면 공간 바깥선을 스스로)
	//==============================================================================
	/**
	 * @param { number } width - 드로잉 버퍼 너비.
	 * @param { number } height - 드로잉 버퍼 높이.
	 */
	draw(width, height) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const renderer = this.#renderer;
		const camera = this.#camera;
		camera.setAspectRatio(width / height);
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, null);
		webGL2RenderingContext.viewport(0, 0, width, height);
		webGL2RenderingContext.clearColor(0.125, 0.15, 0.2, 1);
		webGL2RenderingContext.clearDepth(1);
		webGL2RenderingContext.clear(webGL2RenderingContext.COLOR_BUFFER_BIT | webGL2RenderingContext.DEPTH_BUFFER_BIT);
		const queue = new ToonDrawQueue();
		if (this.#outline !== null) {
			queue.setScreenOutline(this.#outline);
		}
		for (const item of this.#itemList) {
			queue.addMesh(item.mesh, item.matrix, item.options);
		}
		queue.drawShadows(renderer, this.#shadowMap);
		queue.drawLocalShadows(renderer, this.#shadowAtlas);
		queue.draw(renderer, camera);
	}
}
