//==============================================================================
// 비치는 상자가 겹친 툰 장면. (애버런트의 비치는 홀로그램처럼 화면을 여러 겹 덮어 그리고, 점광 하나를 켜고 끌 수 있다)
// - 엔진만으로 짠다. 바닥 하나, 같은 자리를 비스듬히 겹쳐 덮는 비치는 큰 상자(알파 0.5) 여럿, 점광 0 개나 1 개.
// - 점광이 켜지면 겹친 면마다 조각 셰이더의 점광 고리가 돈다. (점광 하나당 화소 비용을 보는 장면)
// - 쓰는 법: const scene = createTranslucentScene(vanilla, webGL2RenderingContext, width, height, { layerCount: 12, hasPointLight: true }); scene.drawFrame();
//==============================================================================
const System = globalThis;

/**
 * @param { object } vanilla - import.js 의 모듈.
 * @param { WebGL2RenderingContext } webGL2RenderingContext - 그릴 컨텍스트.
 * @param { number } width - 캔버스 너비.
 * @param { number } height - 캔버스 높이.
 * @param { object } [options] - { layerCount (기본 12), hasPointLight (기본 true), alpha (기본 0.5) }
 * @returns { object } { renderer, queue, drawFrame() }
 */
export function createTranslucentScene(vanilla, webGL2RenderingContext, width, height, options = {}) {
	const { ToonRenderer, ToonDrawQueue, MeshBuilder, createBoxGeometry, Camera3D, Matrix4, Vector3 } = vanilla;
	const layerCount = options.layerCount ?? 12;
	const hasPointLight = options.hasPointLight ?? true;
	const alpha = options.alpha ?? 0.5;
	const renderer = new ToonRenderer(webGL2RenderingContext);
	const createMesh = (geometry, matrix, color) => {
		const builder = new MeshBuilder();
		builder.addPart(geometry, matrix, color, { hasOutline: false });
		return renderer.createMesh(builder.readArrays());
	};
	const groundMesh = createMesh(createBoxGeometry(24, 0.2, 24), Matrix4.createTranslation(0, -0.1, 0), "#8a7a64");
	const slabMesh = createMesh(createBoxGeometry(14, 0.3, 14), Matrix4.createTranslation(0, 0.15, 0), "#7fb6d8");
	renderer.setPointLights(hasPointLight ? [{ position: [0, 2.5, 0], color: [1, 0.85, 0.6], intensity: 4, range: 12 }] : []);
	const queue = new ToonDrawQueue();
	const camera = new Camera3D();
	camera.setPerspective(0.75, 0.1, 80);
	camera.setAspectRatio(width / height);
	camera.lookAt(Vector3.create(0, 11, 11), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
	return {
		renderer: renderer,
		queue: queue,
		// 한 프레임. (바닥, 비치는 큰 판을 높이를 조금씩 달리해 겹쳐 담고 그린다)
		drawFrame() {
			queue.clear();
			queue.addMesh(groundMesh, Matrix4.createIdentity(), { hasScreenOutline: false, hasCreaseLine: false });
			for (let index = 0; index < layerCount; ++index) {
				queue.addMesh(slabMesh, Matrix4.createTranslation(0, 0.05 * index, 0), { alpha: alpha, hasScreenOutline: false, hasCreaseLine: false });
			}
			webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, null);
			webGL2RenderingContext.viewport(0, 0, width, height);
			webGL2RenderingContext.clearColor(0.42, 0.55, 0.62, 1);
			webGL2RenderingContext.clear(webGL2RenderingContext.COLOR_BUFFER_BIT | webGL2RenderingContext.DEPTH_BUFFER_BIT);
			queue.draw(renderer, camera);
		},
	};
}
