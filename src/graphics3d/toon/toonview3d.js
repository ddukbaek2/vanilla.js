//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Component } from "../../core/component.js";
import { Rect } from "../../base/rect.js";
import { Camera3D } from "../camera3d.js";
import { ToonRenderer } from "./toonrenderer.js";
import { reportShaderBuildFailure } from "../../core/graphic/shaderprogram.js";
import { RenderTarget } from "../rendertarget.js";


/**
 * @example <caption>노드 사각형 안에 툰 3D 장면 그리기</caption>
 * import { WorldNode, ToonView3D, ToonDrawQueue, MeshBuilder, createSphereGeometry, Matrix4, Vector3 } from "./vanilla.js";
 * const node = new WorldNode();
 * node.setContentSizeXY(320, 240);
 * const view = node.addComponent(ToonView3D);
 * view.getCamera().setPerspective(0.8, 0.1, 100);
 * view.getCamera().lookAt(Vector3.create(0, 1.5, 3), Vector3.create(0, 0.5, 0), Vector3.create(0, 1, 0));
 * const builder = new MeshBuilder();
 * builder.addPart(createSphereGeometry(0.5, 24, 16), Matrix4.createTranslation(0, 0.5, 0), "#f0b080");
 * const arrays = builder.readArrays();
 * const queue = new ToonDrawQueue();
 * let mesh = null;
 * view.setDrawCallback((renderer, camera) => {
 * 	if (mesh === null) {
 * 		mesh = renderer.createMesh(arrays);
 * 	}
 * 	queue.clear();
 * 	queue.addMesh(mesh, Matrix4.createIdentity());
 * 	queue.draw(renderer, camera);
 * });
 */


//==============================================================================
// 툰 3D 를 노드 사각형 안에 그리는 컴포넌트. (2D 노드 트리 사이에 3D 패스를 끼운다)
// - draw 에서: 노드의 내용 영역(0, 0, 내용 크기)을 지금 변환으로 드로잉 버퍼 픽셀의 사각형으로 옮기고(돌았으면 감싸는 사각형),
//   Graphic.runExternalPass 로 앞의 2D 묶음을 그리고 깊이를 비운 뒤, 렌더러의 화면 사각형(setScreenRect)을 걸고 그리기 함수를 부른다.
//   끝나면 화면 사각형을 풀고 restoreRenderState 로 2D 상태를 되돌린다.
// - 게임이 draw 앞에 같은 컨텍스트로 WebGL 을 직접 써도(그림자 지도 같은 것) 된다. 게임 프레임 버퍼를 묶었으면 들어올 때 것으로 돌려 두고 스텐실은 바꾸지 않는다. (Graphic.runExternalPass 머리말)
// - 렌더러는 처음 그릴 때 짓는다. 셰이더를 짓지 못하는 기기면 다시 짓지 않고 대체 그리기 함수(setFallbackDrawCallback)로 2D 를 그린다.
//   여러 노드가 렌더러 하나를 함께 쓰려면 setRenderer 로 넣는다.
// - 카메라(getCamera)의 가로 세로 비는 그릴 때마다 사각형의 비로 맞춘다. 3D 점 위의 2D 표시는 같은 카메라의 projectToView 로 셈한다.
// - 깊이 비우기: 부모 Mask 의 자르기 안이면 Adreno 660 함정(Graphic.clearDepthBuffer 머리말)이 있다. 자르기를 거는 쪽이
//   beginClipRect 앞에서 clearDepthBuffer 를 부르고 이 컴포넌트는 setDepthCleared(false) 로 둔다.
// - 그리기 함수: (renderer, camera, screenRect, webGL2RenderingContext, output) => void. screenRect 는 지금 프레임 버퍼에서 그릴 사각형(Rect, 픽셀, 왼쪽 위 원점)이다.
//   output 은 { outputFramebuffer, outputViewport } 다. 지금 묶인 프레임 버퍼(null 이면 캔버스)와 그 안의 GL 뷰포트([x, y, 너비, 높이], 정수, 왼쪽 아래 원점).
//   보통 ToonDrawQueue 에 담아 queue.draw(renderer, camera) 하거나 renderer.beginFrameWithCamera 와 endFrame 사이에 그린다.
//   ToonPostProcess 를 쓰면 renderer.clearScreenRect() 를 부르고 실수 렌더 타겟에 그린 뒤 end 에 output 의 프레임 버퍼와 뷰포트를 준다.
//   (그래야 렌더 스케일, 투명도 층과 상관없이 맞는 자리에 낸다)
//==============================================================================
/**
 * @example <caption>3D 점 위에 2D 표시를 띄울 자리 셈하기</caption>
 * import { WorldNode, ToonView3D, Rect, Vector3 } from "./vanilla.js";
 * const node = new WorldNode();
 * node.setContentSizeXY(400, 300);
 * const view = node.addComponent(ToonView3D);
 * const camera = view.getCamera();
 * camera.setPerspective(0.8, 0.1, 100);
 * camera.setAspectRatio(400 / 300);
 * camera.lookAt(Vector3.create(0, 2, 4), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
 * const labelPosition = camera.projectToView(0, 1, 0, Rect.create(0, 0, 400, 300));
 * const isLabelShown = labelPosition.isInFront && labelPosition.x >= 0 && labelPosition.x <= 400;
 */
export class ToonView3D extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { ToonRenderer | null } */ #renderer;
	/** @private @type { boolean } */ #isRendererFailed; // 렌더러를 짓지 못함. (다시 짓지 않음)
	/** @private @type { Camera3D } */ #camera;
	/** @private @type { Function | null } */ #drawCallback;
	/** @private @type { Function | null } */ #fallbackDrawCallback; // (graphic, contentSize) => void
	/** @private @type { boolean } */ #isDepthCleared;
	/** @private @type { Rect } */ #screenRect; // 이번 그리기의 화면 사각형. (드로잉 버퍼 픽셀, 왼쪽 위 원점)
	/** @private @type { number } */ #renderScale; // 3D 를 그리는 판의 배율. (1 이면 화면에 바로, 아니면 그 배율의 판에 그려 선형으로 늘여 얹는다)
	/** @private @type { RenderTarget | null } */ #renderScaleTarget; // 배율 판. (처음 쓸 때 짓는다)
	/** @private @type { Rect } */ #drawScreenRect; // 그리기 함수에 넘기는 사각형. (배율 판에 그리면 판 전체)
	/** @private @type { object } */ #output; // 그리기 함수에 넘기는 출력. ({ outputFramebuffer, outputViewport }, 러스트 판 ToonViewOutput)

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("ToonView3D");
		this.#renderer = null;
		this.#isRendererFailed = false;
		this.#camera = new Camera3D();
		this.#drawCallback = null;
		this.#fallbackDrawCallback = null;
		this.#isDepthCleared = true;
		this.#screenRect = Rect.create(0, 0, 0, 0);
		this.#renderScale = 1;
		this.#renderScaleTarget = null;
		this.#drawScreenRect = Rect.create(0, 0, 0, 0);
		this.#output = { outputFramebuffer: null, outputViewport: [0, 0, 0, 0] };
	}

	//==============================================================================
	// 렌더 스케일 설정. (3D 만 이 배율의 판에 그려 선형 거르기로 늘여 얹는다, UI 는 기기 화소 그대로. 유니티 URP renderScale, 언리얼 화면 비율과 같은 뜻)
	// - 1(기본)이면 지금처럼 화면에 바로 그린다. 1 이 아니면 판(내용 영역의 화면 크기 x 배율, 깊이 포함, 캔버스가 안티에일리어싱이면 멀티샘플 4)에
	//   투명하게 비운 뒤 그리고, 2D 그리기 길로 source-over 로 얹는다. (2D 자르기를 따르고, 3D 가 덮지 않은 곳은 아래 2D 가 비친다)
	// - 판은 제 깊이를 쓰므로 setDepthCleared(false) 로 앞의 3D 깊이를 이어 쓰던 것은 배율이 1 일 때만 된다.
	// - 그리기 함수는 넘겨받은 출력(output)의 프레임 버퍼와 뷰포트로 내야 배율과 상관없이 맞는 자리에 낸다. (ToonPostProcess.end 같은 것)
	//==============================================================================
	/**
	 * @param { number } renderScale - 배율. (0.05 ~ 4, 1 이면 화면에 바로, 수가 아니면 1)
	 * @example <caption>3D 만 반 해상도로 그리기</caption>
	 * import { WorldNode, ToonView3D } from "./vanilla.js";
	 * const node = new WorldNode();
	 * node.setContentSizeXY(320, 240);
	 * const view = node.addComponent(ToonView3D);
	 * view.setRenderScale(0.5);
	 * const renderScale = view.getRenderScale();
	 */
	setRenderScale(renderScale) {
		if (typeof renderScale !== "number" || !System.Number.isFinite(renderScale)) {
			this.#renderScale = 1;
			return;
		}
		this.#renderScale = System.Math.max(0.05, System.Math.min(4, renderScale));
	}

	//==============================================================================
	// 렌더 스케일 반환.
	//==============================================================================
	/**
	 * @returns { number } 배율. (1 이면 화면에 바로 그린다)
	 */
	getRenderScale() {
		return this.#renderScale;
	}

	//==============================================================================
	// 그리기 함수 설정. ((renderer, camera, screenRect, webGL2RenderingContext, output) => void, null 이면 그리지 않음)
	// - screenRect 는 지금 프레임 버퍼에서 그릴 사각형(Rect, 픽셀, 왼쪽 위 원점, 그리기마다 고쳐 쓰는 같은 객체)이다.
	// - output 은 { outputFramebuffer, outputViewport } 다. outputFramebuffer 는 지금 묶인 프레임 버퍼(null 이면 캔버스),
	//   outputViewport 는 그 안의 GL 뷰포트([x, y, 너비, 높이], 정수, 왼쪽 아래 원점)다. (러스트 판 ToonViewOutput 의 output_framebuffer, output_viewport)
	//   ToonPostProcess.end 처럼 따로 내는 것은 이 둘로 내야 렌더 스케일, 투명도 층과 상관없이 맞는 자리에 낸다.
	//==============================================================================
	/**
	 * @param { Function | null } drawCallback - (renderer, camera, screenRect, webGL2RenderingContext, output) => void. (null 이면 그리지 않음)
	 * @example <caption>노드 사각형 안에 HDR 마무리를 걸어 그리기</caption>
	 * import { WorldNode, ToonView3D, ToonPostProcess } from "./vanilla.js";
	 * const node = new WorldNode();
	 * node.setContentSizeXY(320, 240);
	 * const view = node.addComponent(ToonView3D);
	 * let postProcess = null;
	 * view.setDrawCallback((renderer, camera, screenRect, webGL2RenderingContext, output) => {
	 * 	if (postProcess === null) {
	 * 		postProcess = new ToonPostProcess(webGL2RenderingContext, screenRect.size.x, screenRect.size.y);
	 * 		renderer.setHdrOutput(postProcess.getUseFloatColor());
	 * 	}
	 * 	renderer.clearScreenRect();
	 * 	postProcess.resize(screenRect.size.x, screenRect.size.y);
	 * 	postProcess.begin([0.05, 0.05, 0.08]);
	 * 	renderer.beginFrameWithCamera(camera);
	 * 	renderer.endFrame();
	 * 	postProcess.end(output.outputFramebuffer, output.outputViewport);
	 * });
	 */
	setDrawCallback(drawCallback) {
		this.#drawCallback = drawCallback;
	}

	//==============================================================================
	// 대체 그리기 함수 설정. (렌더러를 짓지 못한 기기에서 2D 로, (graphic, contentSize) => void)
	//==============================================================================
	/**
	 * @param { Function | null } fallbackDrawCallback - (graphic, contentSize) => void. 렌더러를 짓지 못한 기기에서 부른다. (null 이면 그리지 않음)
	 * @example <caption>툰 렌더러를 못 짓는 기기에서는 바탕만 칠하기</caption>
	 * import { WorldNode, ToonView3D, Rect } from "./vanilla.js";
	 * const node = new WorldNode();
	 * node.setContentSizeXY(320, 240);
	 * const view = node.addComponent(ToonView3D);
	 * view.setFallbackDrawCallback((graphic, contentSize) => {
	 * 	graphic.setFillColor("#203040");
	 * 	graphic.drawRect(Rect.create(0, 0, contentSize.x, contentSize.y));
	 * });
	 */
	setFallbackDrawCallback(fallbackDrawCallback) {
		this.#fallbackDrawCallback = fallbackDrawCallback;
	}

	//==============================================================================
	// 그리기 전에 깊이를 비울지 설정. (기본 true)
	//==============================================================================
	/**
	 * @param { boolean } isDepthCleared - 그리기 전에 깊이를 비울지. (부모 Mask 의 자르기 안이면 false 로 두고 자르는 쪽이 비운다)
	 * @example <caption>자르기 안에서 깊이 비우기를 맡기기</caption>
	 * import { WorldNode, ToonView3D } from "./vanilla.js";
	 * const node = new WorldNode();
	 * node.setContentSizeXY(200, 200);
	 * const view = node.addComponent(ToonView3D);
	 * view.setDepthCleared(false);
	 */
	setDepthCleared(isDepthCleared) {
		this.#isDepthCleared = isDepthCleared;
	}

	//==============================================================================
	// 그리기 전에 깊이를 비우는지 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 그리기 전에 깊이를 비우면 true.
	 */
	isDepthCleared() {
		return this.#isDepthCleared;
	}

	//==============================================================================
	// 렌더러 넣기. (여러 노드가 하나를 함께 쓸 때, null 이면 처음 그릴 때 짓는다)
	//==============================================================================
	/**
	 * @param { ToonRenderer | null } renderer - 함께 쓸 렌더러. (null 이면 처음 그릴 때 짓는다)
	 * @example <caption>두 노드가 렌더러 하나를 함께 쓰기</caption>
	 * import { WorldNode, ToonView3D } from "./vanilla.js";
	 * const leftNode = new WorldNode();
	 * leftNode.setContentSizeXY(200, 200);
	 * const rightNode = new WorldNode();
	 * rightNode.setContentSizeXY(200, 200);
	 * const leftView = leftNode.addComponent(ToonView3D);
	 * const rightView = rightNode.addComponent(ToonView3D);
	 * leftView.setDrawCallback((renderer) => {
	 * 	if (rightView.getRenderer() === null) {
	 * 		rightView.setRenderer(renderer);
	 * 	}
	 * });
	 */
	setRenderer(renderer) {
		this.#renderer = renderer;
		this.#isRendererFailed = false;
	}

	//==============================================================================
	// 렌더러 반환. (아직 짓지 않았거나 짓지 못했으면 null)
	//==============================================================================
	/**
	 * @returns { ToonRenderer | null } 렌더러. (아직 짓지 않았거나 짓지 못했으면 null)
	 */
	getRenderer() {
		return this.#renderer;
	}

	//==============================================================================
	// 렌더러를 짓지 못했는지.
	//==============================================================================
	/**
	 * @returns { boolean } 렌더러를 짓지 못했으면 true. (그때는 대체 그리기 함수로 그린다)
	 */
	isRendererFailed() {
		return this.#isRendererFailed;
	}

	//==============================================================================
	// 카메라 반환.
	//==============================================================================
	/**
	 * @returns { Camera3D } 이 컴포넌트의 카메라. (가로 세로 비는 그릴 때마다 사각형에 맞춘다)
	 */
	getCamera() {
		return this.#camera;
	}

	//==============================================================================
	// 지난 그리기의 화면 사각형 반환. (드로잉 버퍼 픽셀)
	//==============================================================================
	/**
	 * @returns { Rect } 드로잉 버퍼 픽셀의 사각형. (왼쪽 위가 원점, 아직 그리지 않았으면 빈 사각형, 복사본)
	 */
	getScreenRect() {
		return this.#screenRect.clone();
	}

	//==============================================================================
	// 렌더러 읽기. (처음이면 짓고, 짓지 못하면 null 이고 다시 짓지 않는다)
	//==============================================================================
	/**
	 * @param { object } graphic - Graphic
	 * @returns { ToonRenderer | null } 렌더러. (짓지 못했으면 null)
	 */
	readRenderer(graphic) {
		if (this.#renderer !== null || this.#isRendererFailed) {
			return this.#renderer;
		}
		graphic.flushBatch();
		try {
			const webGL2RenderingContext = graphic.getWebGL2RenderingContext();
			this.#renderer = new ToonRenderer(webGL2RenderingContext);
		}
		catch (error) {
			System.console.error("[ToonView3D] 툰 렌더러를 짓지 못해 대체 그리기로 갑니다.", error);
			this.#renderer = null;
			// 셰이더 탓이면 게임에 한 번 알리고 다시 짓지 않는다. 컨텍스트를 잃은 탓이면 알리지도 기억하지도 않고, 되살린 뒤 다시 짓는다.
			if (reportShaderBuildFailure(graphic.getWebGL2RenderingContext(), "ToonRenderer", error)) {
				this.#isRendererFailed = true;
			}
		}
		graphic.restoreRenderState();
		return this.#renderer;
	}

	//==============================================================================
	// 내용 영역을 드로잉 버퍼 픽셀의 사각형으로. (지금 변환으로 네 귀를 옮겨 감싸는 사각형)
	//==============================================================================
	/**
	 * @param { object } graphic - Graphic. (지금 변환을 읽는다)
	 * @param { object } contentSize - Vector2
	 */
	refreshScreenRect(graphic, contentSize) {
		const transformMatrix = graphic.getTransformMatrix();
		const cornerXList = [0, contentSize.x, 0, contentSize.x];
		const cornerYList = [0, 0, contentSize.y, contentSize.y];
		let minimumX = System.Infinity;
		let minimumY = System.Infinity;
		let maximumX = -System.Infinity;
		let maximumY = -System.Infinity;
		for (let cornerIndex = 0; cornerIndex < 4; ++cornerIndex) {
			const cornerX = cornerXList[cornerIndex];
			const cornerY = cornerYList[cornerIndex];
			const screenX = transformMatrix.a * cornerX + transformMatrix.c * cornerY + transformMatrix.e;
			const screenY = transformMatrix.b * cornerX + transformMatrix.d * cornerY + transformMatrix.f;
			minimumX = System.Math.min(minimumX, screenX);
			minimumY = System.Math.min(minimumY, screenY);
			maximumX = System.Math.max(maximumX, screenX);
			maximumY = System.Math.max(maximumY, screenY);
		}
		const screenRect = this.#screenRect;
		screenRect.position.x = minimumX;
		screenRect.position.y = minimumY;
		screenRect.size.x = maximumX - minimumX;
		screenRect.size.y = maximumY - minimumY;
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @override
	 * @param { object } graphic - Graphic
	 */
	draw(graphic) {
		const node = this.getNode();
		const contentSize = node.getContentSize();
		if (contentSize.x <= 0 || contentSize.y <= 0) {
			return;
		}
		const renderer = this.readRenderer(graphic);
		if (renderer === null) {
			const fallbackDrawCallback = this.#fallbackDrawCallback;
			if (fallbackDrawCallback !== null) {
				fallbackDrawCallback(graphic, contentSize);
			}
			return;
		}
		const drawCallback = this.#drawCallback;
		if (drawCallback === null) {
			return;
		}
		this.refreshScreenRect(graphic, contentSize);
		const screenRect = this.#screenRect;
		const screenX = screenRect.position.x;
		const screenY = screenRect.position.y;
		const screenWidth = screenRect.size.x;
		const screenHeight = screenRect.size.y;
		if (screenWidth <= 0 || screenHeight <= 0) {
			return;
		}
		const camera = this.#camera;
		camera.setAspectRatio(screenWidth / screenHeight);
		if (this.#renderScale !== 1) {
			this.drawWithRenderScale(graphic, renderer, drawCallback);
			return;
		}
		const drawScreenRect = this.#drawScreenRect;
		const output = this.#output;
		graphic.runExternalPass((webGL2RenderingContext) => {
			this.#writeOutput(graphic, screenX, screenY, screenWidth, screenHeight);
			renderer.setScreenRect(screenX, screenY, screenWidth, screenHeight);
			try {
				drawCallback(renderer, camera, drawScreenRect, webGL2RenderingContext, output);
			}
			finally {
				renderer.clearScreenRect();
			}
		}, { clearDepth: this.#isDepthCleared });
	}

	//==============================================================================
	// 그리기 함수에 넘길 사각형과 출력 채우기. (출력은 지금 묶인 프레임 버퍼와 그 안의 GL 뷰포트, 왼쪽 아래 원점, 러스트 판 read_output)
	// - 사각형은 지금 뷰포트 안의 픽셀(왼쪽 위 원점)이다. 뷰포트는 정수 픽셀로 반올림한다. (GL 뷰포트는 정수)
	//==============================================================================
	/**
	 * @private
	 * @param { object } graphic - Graphic
	 * @param { number } x - 왼쪽. (뷰포트 픽셀, 왼쪽 위 원점)
	 * @param { number } y - 위. (뷰포트 픽셀, 왼쪽 위 원점)
	 * @param { number } width - 너비.
	 * @param { number } height - 높이.
	 */
	#writeOutput(graphic, x, y, width, height) {
		const drawScreenRect = this.#drawScreenRect;
		drawScreenRect.position.x = x;
		drawScreenRect.position.y = y;
		drawScreenRect.size.x = width;
		drawScreenRect.size.y = height;
		const output = this.#output;
		const viewport = graphic.getCurrentViewport();
		output.outputFramebuffer = graphic.getCurrentFramebuffer();
		const outputWidth = System.Math.max(1, System.Math.round(width));
		const outputHeight = System.Math.max(1, System.Math.round(height));
		const outputViewport = output.outputViewport;
		outputViewport[0] = viewport.position.x + System.Math.round(x);
		outputViewport[1] = viewport.position.y + viewport.height - System.Math.round(y) - outputHeight;
		outputViewport[2] = outputWidth;
		outputViewport[3] = outputHeight;
	}

	//==============================================================================
	// 배율 판 읽기. (없거나 크기가 다르면 짓거나 고친다, 못 지으면 null)
	//==============================================================================
	/**
	 * @private
	 * @param { WebGL2RenderingContext } webGL2RenderingContext - 컨텍스트.
	 * @param { number } width - 판 너비. (픽셀)
	 * @param { number } height - 판 높이. (픽셀)
	 * @returns { RenderTarget | null } 배율 판.
	 */
	readRenderScaleTarget(webGL2RenderingContext, width, height) {
		let target = this.#renderScaleTarget;
		if (target === null) {
			try {
				// 캔버스가 안티에일리어싱이면 판도 멀티샘플로 그린다. (러스트 데스크탑의 캔버스 표본 수 4 와 같게)
				const contextAttributes = webGL2RenderingContext.getContextAttributes();
				const sampleCount = contextAttributes && contextAttributes.antialias ? 4 : 0;
				target = new RenderTarget(webGL2RenderingContext, width, height, true, { sampleCount: sampleCount, depthBits: 24 });
			}
			catch (error) {
				System.console.error("[ToonView3D] 렌더 스케일 판을 짓지 못해 화면에 바로 그립니다.", error);
				this.#renderScale = 1;
				return null;
			}
			this.#renderScaleTarget = target;
			return target;
		}
		if (target.getWidth() !== width || target.getHeight() !== height) {
			target.resize(width, height);
		}
		return target;
	}

	//==============================================================================
	// 배율 판에 그려 늘여 얹기.
	//==============================================================================
	/**
	 * @private
	 * @param { object } graphic - Graphic
	 * @param { ToonRenderer } renderer - 렌더러.
	 * @param { Function } drawCallback - 그리기 함수.
	 */
	drawWithRenderScale(graphic, renderer, drawCallback) {
		const screenRect = this.#screenRect;
		const camera = this.#camera;
		const renderScale = this.#renderScale;
		const targetWidth = System.Math.max(1, System.Math.round(screenRect.size.x * renderScale));
		const targetHeight = System.Math.max(1, System.Math.round(screenRect.size.y * renderScale));
		const drawScreenRect = this.#drawScreenRect;
		const output = this.#output;
		let colorTexture = null;
		graphic.runExternalPass((webGL2RenderingContext) => {
			const target = this.readRenderScaleTarget(webGL2RenderingContext, targetWidth, targetHeight);
			if (target === null) {
				return;
			}
			const outputFramebuffer = graphic.getCurrentFramebuffer();
			// 2D 자르기의 스텐실과 가위는 화면 것이라 판에는 걸지 않는다. (얹을 때 2D 길이 자른다)
			const isStencilTestEnabled = webGL2RenderingContext.isEnabled(webGL2RenderingContext.STENCIL_TEST);
			const isScissorTestEnabled = webGL2RenderingContext.isEnabled(webGL2RenderingContext.SCISSOR_TEST);
			const clearColor = webGL2RenderingContext.getParameter(webGL2RenderingContext.COLOR_CLEAR_VALUE);
			const colorWriteMask = webGL2RenderingContext.getParameter(webGL2RenderingContext.COLOR_WRITEMASK);
			webGL2RenderingContext.disable(webGL2RenderingContext.STENCIL_TEST);
			webGL2RenderingContext.disable(webGL2RenderingContext.SCISSOR_TEST);
			target.bind();
			webGL2RenderingContext.colorMask(true, true, true, true);
			webGL2RenderingContext.depthMask(true);
			webGL2RenderingContext.clearColor(0, 0, 0, 0);
			webGL2RenderingContext.clear(webGL2RenderingContext.COLOR_BUFFER_BIT | webGL2RenderingContext.DEPTH_BUFFER_BIT);
			webGL2RenderingContext.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
			this.#writeOutput(graphic, 0, 0, targetWidth, targetHeight);
			renderer.setScreenRect(0, 0, targetWidth, targetHeight);
			try {
				drawCallback(renderer, camera, drawScreenRect, webGL2RenderingContext, output);
			}
			finally {
				renderer.clearScreenRect();
				target.resolve();
				webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, outputFramebuffer);
				webGL2RenderingContext.colorMask(colorWriteMask[0], colorWriteMask[1], colorWriteMask[2], colorWriteMask[3]);
				if (isStencilTestEnabled) {
					webGL2RenderingContext.enable(webGL2RenderingContext.STENCIL_TEST);
				}
				if (isScissorTestEnabled) {
					webGL2RenderingContext.enable(webGL2RenderingContext.SCISSOR_TEST);
				}
			}
			colorTexture = target.getColorTexture();
		}, { clearDepth: false });
		if (colorTexture === null) {
			return;
		}

		// 판을 화면 사각형에 단위 행렬, 흰색, 틴트 없이 source-over 로 얹는다. (판은 미리 곱한 알파, 텍스처는 아래가 0 행, 선형 거르기)
		// 3D 를 화면에 바로 그릴 때처럼 전역 알파는 걸지 않는다.
		graphic.pushState();
		graphic.resetTransform();
		graphic.setGlobalAlpha(1);
		graphic.setImageTintColor(null);
		graphic.setBlendMode("source-over");
		const floatCount = graphic.writeQuad(0, screenRect.position.x, screenRect.position.y, screenRect.position.x + screenRect.size.x, screenRect.position.y + screenRect.size.y, 0, 1, 1, 0);
		graphic.drawVertices(floatCount / 4, colorTexture, graphic.getWhiteColor());
		graphic.popState();
	}

	//==============================================================================
	// 노드에서 떨어짐. (배율 판을 지운다, 다시 붙으면 처음 쓸 때 다시 짓는다)
	//==============================================================================
	/**
	 * @override
	 * @param { object } node - 떨어진 노드.
	 */
	detach(node) {
		super.detach(node);
		if (this.#renderScaleTarget !== null) {
			this.#renderScaleTarget.destroy();
			this.#renderScaleTarget = null;
		}
	}

	//==============================================================================
	// 내용 영역 안에서만 그리는지 반환. (가위로 자른다)
	//==============================================================================
	/**
	 * @override
	 * @returns { boolean } 늘 true.
	 */
	isDrawnInsideContent() {
		return true;
	}
}
