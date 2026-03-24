//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Colors } from "../base/colors.js";
import { Vector2 } from "../base/vector2.js";
import { TimeManager } from "./timemanager.js";
import { ViewManager } from "./viewmanager.js";
import { InputManager } from "./inputmanager.js";
import { Platform, PlatformType, BrowserType } from "../base/platform.js";
import { Renderer } from "./renderer.js";
import { Scene } from "./scene.js";


//==============================================================================
// 엔진 설정.
//==============================================================================
export class EngineConfiguration extends Object {
	// /** @type { Scene } */ scene;
	/** @type { Vector2 } */ referenceResolution;
	/** @type { string } */ canvasId;
	/** @type { boolean } */ isDevelopment;
	constructor() {
		super();
		// this.scene = null;
		this.referenceResolution = Vector2.zero();
		this.canvasId = "";
		this.isDevelopment = false;
	}
}

//==============================================================================
// 엔진.
//==============================================================================
export class Engine extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { EngineConfiguration } */ #engineConfiguration;
	/** @private @type { HTMLCanvasElement } */ #canvas;
	/** @private @type { Platform } */ #platform;
	/** @private @type { TimeManager } */ #timeManager;
	/** @private @type { ViewManager } */ #viewManager;
	/** @private @type { InputManager } */ #inputManager;
	/** @private @type { Renderer } */ #renderer;
	/** @private @type { () => void  } */ #resizeCallback;
	/** @private @type { FrameRequestCallback } */ #updateEngineCallback;
	/** @private @type { Scene[] } */ #scenes;
	/** @private @type { boolean } */ #isDevelopment;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { EngineConfiguration } engineConfiguration
	 */
	constructor(engineConfiguration) {
		super();
		if (engineConfiguration === null || engineConfiguration instanceof EngineConfiguration === false) {
			throw new System.Error(`engineConfiguration is invalid.`);
		}
		this.#engineConfiguration = engineConfiguration;
		this.#canvas = this.getOrAddCanvas(engineConfiguration.canvasId);
		const canvasContext = this.#canvas.getContext("2d", { alpha: false });

		this.#platform = new Platform();
		this.#timeManager = new TimeManager(this);
		this.#viewManager = new ViewManager(this, engineConfiguration.resolution);
		this.#inputManager = new InputManager(this);
		this.#renderer = new Renderer(this, canvasContext);

		this.#resizeCallback = this.#resize.bind(this);
		this.#updateEngineCallback = this.#updateEngine.bind(this);
		this.#scenes = [];
		this.#isDevelopment = engineConfiguration.isDevelopment;
		
		if (this.terminalFont !== null) {
			// this.terminalFont = new FontFace(`VT323`, `url('https://fonts.gstatic.com/s/vt323/v17/pxiKyp0ihIEF2isfFJU.woff2')`);
			this.terminalFont = new FontFace(`DOSGothic`, `url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_eight@1.0/DOSGothic.woff')`);
			this.terminalFont.load().then((loadedFont) => {
				document.fonts.add(loadedFont);
			});
		}

		this.#setupAllEvents();
		this.#resize();
	}

	//==============================================================================
	// 시작.
	//==============================================================================
	/**
	 * @param { Scene } scene
	 */
	run(scene) {
		this.loadScene(scene);
		window.addEventListener("resize", this.#resizeCallback);
		window.requestAnimationFrame(this.#updateEngineCallback);
	}

	//==============================================================================
	// 해상도 변경됨.
	//==============================================================================
	/**
	 * @private
	 * @method
	 */
	#resize() {
		const viewManager = this.getViewManager();
		viewManager.calculateViewRect();
		const clientSize = viewManager.getClientSize();
		const canvasSize = viewManager.getCanvasSize();
		this.#canvas.width = canvasSize.x; 
		this.#canvas.height = canvasSize.y;
		this.#canvas.style.width = `${clientSize.x}px`;
		this.#canvas.style.height = `${clientSize.y}px`;

		// if (this.#gameInstance && typeof this.#gameInstance.resize === "function") {
		// 	this.#gameInstance.resize(this);
		// }
		// 씬 리사이즈.
		for (let i = 0; i < this.#scenes.length; ++i) {
			const scene = this.#scenes[i];			
			try {
				scene.resize(clientSize);
			}
			catch (error) {
				console.error(error);
			}
		}
	}

	//==============================================================================
	// 이벤트 설정.
	//==============================================================================
	/**
	 * @private
	 * @method
	 */
	#setupAllEvents() {
		this.#canvas.addEventListener("mousedown", (touchEvent) => {
				// if (!this.#view.isInsideView(touchEvent.clientX, touchEvent.clientY)) {
				// 	return;
				// }

				const inputManager = this.getInputManager();
				inputManager.justMoved = true;
				inputManager.justPressed = true;
				this.updatePointer(touchEvent.clientX, touchEvent.clientY);
			});

		window.addEventListener("mousemove", (touchEvent) => {
				this.updatePointer(touchEvent.clientX, touchEvent.clientY);
			});

		window.addEventListener("mouseup", (touchEvent) => {
				const inputManager = this.getInputManager();
				inputManager.justMoved = false;
				inputManager.justReleased = true;
				this.updatePointer(touchEvent.clientX, touchEvent.clientY);
			});

		this.#canvas.addEventListener("touchstart", (touchEvent) => {
				const touch = touchEvent.changedTouches[0];
				if (!touch) return;

				// if (!this.#view.isInsideView(touch.clientX, touch.clientY)) {
				// 	return;
				// }

				const inputManager = this.getInputManager();
				inputManager.justMoved = true;
				inputManager.justPressed = true;
				this.updatePointer(touch.clientX, touch.clientY);
				touchEvent.preventDefault();
			}, { passive: false });

		window.addEventListener("touchmove", (touchEvent) => {
				const touch = touchEvent.changedTouches[0];
				if (!touch) return;

				this.updatePointer(touch.clientX, touch.clientY);
				touchEvent.preventDefault();
			}, { passive: false });

		window.addEventListener("touchend", (touchEvent) => {
				const touch = touchEvent.changedTouches[0];
				if (touch) {
					this.updatePointer(touch.clientX, touch.clientY);
				}

				const inputManager = this.getInputManager();
				inputManager.justMoved = false;
				inputManager.justReleased = true;
				touchEvent.preventDefault();
			}, { passive: false });

		// 커서 상태 변경 감지.
		document.addEventListener("pointerlockchange", () => {
			if (document.pointerLockElement === canvas) {
				// console.log('커서가 숨겨졌습니다.');
			} else {
				// console.log('커서가 다시 나타났습니다.');
			}
		});
	}

	//==============================================================================
	// 입력 좌표 갱신.
	//==============================================================================
	/**
	 * @private
	 * @method
	 * @param { number } clientX
	 * @param { number } clientY
	 */
	updatePointer(clientX, clientY) {
		const canvasRect = this.#canvas.getBoundingClientRect();
		const inputManager = this.getInputManager();
		const viewManager = this.getViewManager();
		const clientPoint = Vector2.create(clientX - canvasRect.left, clientY - canvasRect.top);
		const inputPosition = viewManager.transformToViewPoint(clientPoint);
		inputManager.setInputPosition(inputPosition);
	}
	
	//==============================================================================
	// 개발 관련 정보 출력.
	//==============================================================================
	/**
	 * @param { Renderer } renderer 
	 */
	drawStatistics(renderer) {
		if (!this.#isDevelopment) {
			return;
		}
	
		const canvasContext = renderer.getCanvasContext();
		const timeManager = this.getTimeManager();
		const viewManager = this.getViewManager();
		const inputManager = this.getInputManager();

		const SYSTEM_FONT_STRING = '-apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';


		let textOffsetX = 16;
		let textOffsetY = 16;
		const drawOutlineText = (text) => {
			canvasContext.fillText(text, textOffsetX, textOffsetY);

			// 자동 외곽선 출력.
			// canvasContext.strokeText(text, textOffsetX, textOffsetY);
			// canvasContext.fillText(text, textOffsetX, textOffsetY);

			// 수동 외곽선 출력.
			// const offsets = [
			// 	[-2, -2], [2, -2], [-2, 2], [2, 2], 
			// 	[-2, 0], [2, 0], [0, -2], [0, 2]
			// ];

			// canvasContext.fillStyle = Colors.black;
			// for (let i = 0; i < offsets.length; ++i) {
			// 	canvasContext.fillText(text, textOffsetX + offsets[i][0], textOffsetY + offsets[i][1]);
			// }

			// canvasContext.fillStyle = Colors.white;
			// canvasContext.fillText(text, textOffsetX, textOffsetY);

			textOffsetY += 16;

			// 영역 출력.
			const metrics = canvasContext.measureText(text);
			const width = metrics.width; // metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight)
			const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
			return { width, height };
		};

		const formatSizeString = (bytes) => {
			let killo = bytes / 1024;
			let mega = killo / 1024;
			let value =  mega.toFixed(2);
			return `${value} MB`;

			// if (mega < 1) {
			// 	let value = killo.toFixed(2);
			// 	return `${value} KB`;
			// }
			// else {
			// 	let value =  mega.toFixed(2);
			// 	return `${value} MB`;
			// }
		};


		// 배경 출력.
		// 기본 위치인 화면 좌상단으로 이동.
		canvasContext.setTransform(1, 0, 0, 1, 0, 0);
		canvasContext.fillStyle = "rgba(0, 0, 0, 0.6)";
		canvasContext.fillRect(10, 10, 480, 640);
		// canvasContext.letterSpacing = "-1px";
		canvasContext.font = `16px DOSGothic`;//${SYSTEM_FONT_STRING}`;
		canvasContext.textBaseline = "top";
		canvasContext.fillStyle = Colors.white; // Colors.lightVanilla
		// canvasContext.fillStyle = Colors.white; // Colors.lightVanilla;
		// canvasContext.lineWidth = 4;
		// canvasContext.strokeStyle = Colors.black; // Colors.darkVanilla;
		// canvasContext.textRendering = "auto"; //optimizeLegibility"; //"geometricPrecision";
		// canvasContext.shadowColor = Colors.white;
		// canvasContext.shadowOffsetX = 0.5;
		// canvasContext.shadowOffsetY = 0.5;
		canvasContext.textAlign = "left";
		// canvasContext.imageSmoothingEnabled = false;
		canvasContext.scale(1.6, 1.6);

		// 플랫폼 정보 출력.
		this.#platform.getPlatformInfo();
		drawOutlineText(`platformName: ${this.#platform.platformName}`);
		drawOutlineText(`browserName: ${this.#platform.browserName}`);
		drawOutlineText(``);

		// 화면 정보 출력.
		const clientSize = viewManager.getClientSize();
		const canvasSize = viewManager.getCanvasSize();
		const referenceResolutionSize = viewManager.getReferenceResolutionSize();
		const viewScaleMode = viewManager.getViewScaleMode();
		const screenSize = viewManager.getScreenSize();
		screenSize.x = Math.round(screenSize.x);
		screenSize.y = Math.round(screenSize.y);
		const viewRect = viewManager.getViewRect();
		const inputPosition = inputManager.getInputPosition();
		inputPosition.x = Math.round(inputPosition.x);
		inputPosition.y = Math.round(inputPosition.y);
		drawOutlineText(`clientSize: ${clientSize.x}x${clientSize.y}`);
		drawOutlineText(`canvasSize: ${canvasSize.x}x${canvasSize.y}`);
		drawOutlineText(`referenceResolutionSize: ${referenceResolutionSize.x}x${referenceResolutionSize.y}`);
		drawOutlineText(`viewScaleMode: ${viewScaleMode}`);
		drawOutlineText(`screenSize: ${screenSize.x}x${screenSize.y}`);
		drawOutlineText(`viewRectSize: ${viewRect.size.x}x${viewRect.size.y}`);
		drawOutlineText(`inputPosition: ${inputPosition.x}x${inputPosition.y}`);
		drawOutlineText(``);

		// 초당 프레임 정보 출력.
		const realtimeScinceStartup = timeManager.getRealtimeSinceStartup().toFixed(2);
		const time = timeManager.getTime().toFixed(2);
		const framePerSecond = timeManager.getFramePerSecond();
		const timeDelta = timeManager.getTimeDelta().toFixed(3);
		drawOutlineText(`realtimeScinceStartup: ${realtimeScinceStartup}`);
		drawOutlineText(`time: ${time}`);
		drawOutlineText(`framePerSecond: ${framePerSecond}`);
		drawOutlineText(`timeDelta: ${timeDelta}`);
		drawOutlineText(``);

		// // 메모리 사용 정보 출력.
		// // 크로미움 기반 API. (비표준)
		// const memory = performance.memory;
		// if (memory)
		// {
		// 	const usedJSHeapSize = formatSizeString(memory.usedJSHeapSize);
		// 	const totalJSHeapSize = formatSizeString(memory.totalJSHeapSize);
		// 	const jsHeapSizeLimit = formatSizeString(memory.jsHeapSizeLimit);
		// 	drawOutlineText(`usedJSHeapSize: ${usedJSHeapSize}`);
		// 	drawOutlineText(`totalJSHeapSize: ${totalJSHeapSize}`);
		// 	drawOutlineText(`jsHeapSizeLimit: ${jsHeapSizeLimit}`);
		// }

		var resourceUsage = this.#platform.getResouceUsage();
		const totalTransferSize = formatSizeString(resourceUsage.totalTransferSize);
		const totalDecodedSize = formatSizeString(resourceUsage.totalDecodedSize);
		const loadedFiles = resourceUsage.loadedFiles;

		// // 다운 로드된 리소스 목록.
		// y += 26; drawOutlineText(`totalTransferSize: ${totalTransferSize}`, x, y);
		// for (let i = 0; i < loadedFiles.length; ++i)
		// {
		// 	const loadedFile = loadedFiles[i];
		// 	const name = loadedFile.name;
		// 	if (loadedFile.transferSize < 1024)
		// 		continue;

		// 	const transferSizeString = formatSizeString(loadedFile.transferSize);
		// 	y += 26; drawOutlineText(` - ${name} (${transferSizeString})`, x, y);
		// }

		// 로드된 리소스 목록.
		drawOutlineText(`totalDecodedSize: ${totalDecodedSize}`);
		// for (let i = 0; i < loadedFiles.length; ++i)
		// {
		// 	const loadedFile = loadedFiles[i];
		// 	const name = loadedFile.name;
		// 	if (loadedFile.decodedSize < 1024)
		// 		continue;

		// 	const decodedSizeString = formatSizeString(loadedFile.decodedSize);
		// 	y += 26; drawOutlineText(` - ${name} (${decodedSizeString})`, x, y);
		// }
	}

	//==============================================================================
	// 엔진 갱신.
	//==============================================================================
	/**
	 * @private
	 * @method
	 * @param { number } timestamp
	 */
	#updateEngine(timestamp) {

		// 렌더러 갱신.
		const renderer = this.getRenderer();
		renderer.update(this);

		// 시간 갱신.
		const timeManager = this.getTimeManager();
		timeManager.calculateTime(timestamp);

		// // 화면 더 부드럽게.
		// this.CanvasContext.scale(this.#view.devicePixelRatio, this.#view.devicePixelRatio);
		// this.CanvasContext.imageSmoothingEnabled = true;
    	// this.CanvasContext.imageSmoothingQuality = 'high';
		// this.canvasContext.canvas.style.textRendering = 'optimizeLegibility';

		// 씬 출력.
		const timeDelta = timeManager.getTimeDelta();
		for (let i = 0; i < this.#scenes.length; ++i) {
			const scene = this.#scenes[i];
			
			try {
				// 주기적 갱신.
				scene.tick(timeDelta);

				// 출력.
				scene.preDraw(renderer);
				scene.draw(renderer);
				scene.postDraw(renderer);
			}
			catch (error) {
				console.error(error);
			}
		}

		// 개발 정보 출력.
		if (this.#isDevelopment) {
			this.drawStatistics(renderer);
		}
		
		// 입력 처리.
		const inputManager = this.getInputManager();
		inputManager.justPressed = false;
		inputManager.justReleased = false;

		// 다음 프레임 호출 요청.
		window.requestAnimationFrame(this.#updateEngineCallback);
	}

	//==============================================================================
	// 씬 로드.
	//==============================================================================
	/**
	 * 
	 * @param { Scene } scene 
	 */
	async loadScene(scene) {
		if (scene && scene instanceof Scene) {
			scene.initialize(this);
			await scene.load(this);
			scene.postInitialize(this);
			this.#scenes.push(scene);
		}
	}

	//==============================================================================
	// 씬 언로드.
	//==============================================================================
	/**
	 * 
	 * @param { Scene } scene 
	 */
	async unloadScene(scene) {
		if (scene && scene instanceof Scene) {
			await scene.unload(this);
			scene.finalize();
			this.#scenes.splice(this.#scenes.indexOf(scene), 1);
		}
	}

	//==============================================================================
	// 모든 씬 언로드.
	//==============================================================================
	async unloadAllScenes() {
		while (this.#scenes.length > 0) {
			const scene = this.#scenes[0];
			await this.unloadScene(scene);
		}
	}

	//==============================================================================
	// 커서 보이기 설정.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @param { boolean } visibled 
	 */
	setVisibleCursor(visibled) {
		if (visibled) {
			document.body.style.cursor = 'default';
		}
		else {
			document.body.style.cursor = 'none';
		}
	}

	//==============================================================================
	// 화면 비우기.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @param { string } color
	 */
	clear(color = "#000000") {
		const renderer = this.getRenderer();
		const canvasContext = renderer.getCanvasContext();
		const viewManager = this.getViewManager();
		const canvasSize = viewManager.getCanvasSize();
		viewManager.applyCanvasRect(canvasContext);

		// 영역 전체 칠하기.
		canvasContext.beginPath();
		canvasContext.fillStyle = color;
		canvasContext.fillRect(0, 0, canvasSize.x, canvasSize.y);
	}

	//==============================================================================
	// 게임 영역 좌표계 정리.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @param { string } color
	 */
	gameViewIdentity(color = "#000000") {
		const canvasContext = this.#renderer.getCanvasContext();
		const viewManager = this.getViewManager();
		const referenceResolutionSize = viewManager.getReferenceResolutionSize();
		viewManager.applyViewRect(canvasContext);

		// 영역 전체 칠하기.
		canvasContext.beginPath();
		canvasContext.fillStyle = color;
		canvasContext.fillRect(0, 0, referenceResolutionSize.x, referenceResolutionSize.y);
	}

	//==============================================================================
	// 캔버스 정보 반환.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @returns { HTMLCanvasElement }
	 */
	getCanvas() {
		return this.#canvas;
	}

	//==============================================================================
	// 플랫폼 정보 반환.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @returns { Platform }
	 */
	getPlatform() {
		return this.#platform;
	}

	//==============================================================================
	// 시간 정보 반환.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @returns { TimeManager }
	 */
	getTimeManager() {
		return this.#timeManager;
	}
	
	//==============================================================================
	// 뷰 정보 반환.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @returns { ViewManager }
	 */
	getViewManager() {
		return this.#viewManager;
	}

	//==============================================================================
	// 입력 정보 반환.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @returns { InputManager }
	 */
	getInputManager() {
		return this.#inputManager;
	}

	//==============================================================================
	// 렌더러 정보 반환.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @returns { Renderer }
	 */
	getRenderer() {
		return this.#renderer;
	}

	//==============================================================================
	// 개발 모드 여부 반환.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @returns { boolean }
	 */
	isDevelopment() {
		return this.#isDevelopment;
	}

	//==============================================================================
	// 캔버스 생성 or 반환.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @param { string } canvasId
	 * @returns { HTMLCanvasElement }
	 */
	getOrAddCanvas(canvasId) {
		let canvas = document.getElementById(canvasId);
		if (canvas === null) {
			canvas = document.createElement("canvas");
			canvas.id = canvasId;
			document.body.appendChild(canvas);
		}

		return canvas;
	}
}
