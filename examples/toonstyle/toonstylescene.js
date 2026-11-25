//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Matrix4, Vector3, Camera3D, ToonRenderer, ToonDrawQueue, ToonMesh, ToonScreenOutline, ShadowMap } from "../../import.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 해가 비추는 방향. (빛이 나아가는 쪽)
const SUN_DIRECTION = [-0.45, -1.0, -0.55];

// 결정 덩이 꼭짓점 열둘의 반지름 배.
const CHUNK_SCALES = [1.0, 0.85, 1.1, 0.95, 1.05, 0.9, 1.0, 1.12, 0.88, 1.0, 0.95, 1.08];


//==============================================================================
// 도형 하나로 지은 배열. (껍데기 바깥선 없이)
//==============================================================================
/**
 * @param { object } geometry
 * @param { string } colorText
 * @returns { object }
 */
function buildArrays(geometry, colorText) {
	const builder = new ToonMesh.MeshBuilder();
	builder.addPart(geometry, Matrix4.createIdentity(), colorText, { hasOutline: false });
	return builder.readArrays();
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
// - 각진 상자, 둥근 공, 큰 면 결정(팔면체), 잔 면 결정 덩이, 고리, 비스듬한 판, 바닥을 해와 그림자, 점광, 림, 정반사로 칠한다.
// - 화면 공간 바깥선은 그리기 줄에 맡긴다. lineScale 은 선의 판 해상도 몫, isToggled 면 바닥은 선 없이 가리기만, 덩이는 꺾임 선 없이.
//==============================================================================
export class ToonStyleScene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { ToonRenderer } */ #renderer;
	/** @private @type { ToonScreenOutline } */ #outline;
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
	 */
	constructor(webGL2RenderingContext, lineScale, isToggled) {
		this.#webGL2RenderingContext = webGL2RenderingContext;
		const renderer = new ToonRenderer(webGL2RenderingContext);
		this.#renderer = renderer;
		renderer.setLight(SUN_DIRECTION, [1.0, 0.95, 0.88], [0.42, 0.48, 0.6], [0.18, 0.16, 0.14]);
		renderer.setRimLight([0.35, 0.4, 0.5], 3);
		renderer.setSpecular(0.5, 40);
		renderer.setPointLights([{ position: [0.9, 1.2, 2.6], color: [1.0, 0.55, 0.25], intensity: 2.0, range: 3.5 }]);
		const outline = new ToonScreenOutline(webGL2RenderingContext);
		outline.setResolutionScale(lineScale);
		this.#outline = outline;
		this.#shadowMap = new ShadowMap(webGL2RenderingContext, 2048);
		this.#shadowMap.updateLightMatrix(Vector3.create(0, 0, 0), Vector3.create(SUN_DIRECTION[0], SUN_DIRECTION[1], SUN_DIRECTION[2]), 7, 0.5, 40);
		renderer.setShadow(this.#shadowMap, 1);
		const camera = new Camera3D();
		camera.setPerspective(0.7, 0.1, 100);
		camera.lookAt(Vector3.create(0, 3.4, 7.8), Vector3.create(0, 0.55, 0.3), Vector3.create(0, 1, 0));
		this.#camera = camera;
		const meshOf = (geometry, colorText) => {
			return renderer.createMesh(buildArrays(geometry, colorText));
		};
		this.#itemList = [
			{ mesh: meshOf(ToonMesh.createBoxGeometry(14, 0.2, 10), "#9aa4b4"), matrix: Matrix4.createTranslation(0, -0.1, 0), options: { lineId: 1, hasScreenOutline: !isToggled } },
			{ mesh: meshOf(ToonMesh.createBoxGeometry(2.4, 0.1, 3.0), "#86a07e"), matrix: createPlaced([-3.4, 0.55, -1.6], 0.5, 0.25, [1, 1, 1]), options: { lineId: 2 } },
			{ mesh: meshOf(ToonMesh.createBoxGeometry(1.2, 1.2, 1.2), "#e8a860"), matrix: createPlaced([-2.0, 0.6, 0.7], 0, 0.55, [1, 1, 1]), options: { lineId: 3 } },
			{ mesh: meshOf(ToonMesh.createSphereGeometry(0.8, 48, 32), "#f2f0ec"), matrix: Matrix4.createTranslation(-0.2, 0.8, 0.2), options: { lineId: 4 } },
			{ mesh: meshOf(ToonMesh.createOctahedronGeometry(0.6), "#80c8ff"), matrix: createPlaced([1.5, 0.96, 0.6], 0, 0.4, [1, 1.6, 1]), options: { lineId: 5 } },
			{ mesh: meshOf(ToonMesh.createFacetedChunkGeometry(0.55, CHUNK_SCALES, [1, 0.8, 1]), "#b0a0d0"), matrix: Matrix4.createTranslation(3.0, 0.45, 0.2), options: { lineId: 6, hasCreaseLine: !isToggled } },
			{ mesh: meshOf(ToonMesh.createTorusGeometry(0.45, 0.17, 16, 40), "#d06070"), matrix: createPlaced([0.9, 0.3, 2.1], 1.2, 0.3, [1, 1, 1]), options: { lineId: 7 } },
		];
	}

	//==============================================================================
	// 한 프레임 그리기. (그림자 → 그리기 줄, 그리기 줄이 선의 판과 바깥선을 스스로)
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
		queue.setScreenOutline(this.#outline);
		for (const item of this.#itemList) {
			queue.addMesh(item.mesh, item.matrix, item.options);
		}
		queue.drawShadows(renderer, this.#shadowMap);
		queue.draw(renderer, camera);
	}
}
