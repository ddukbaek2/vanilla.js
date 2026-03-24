//==============================================================================
// 포함 모듈 목록.
//==============================================================================
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
	/** @type { Scene } */ scene;
	/** @type { Vector2 } */ referenceResolution;
	/** @type { string } */ canvasId;
	/** @type { boolean } */ isDevelopment;
	constructor() {
		super();
		this.scene = null;
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
		this.#viewManager = new ViewManager(this);
		this.#viewManager.resolution = engineConfiguration.resolution;
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
	 * @param { VGameInstance } gameInstance
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
		const devicePixelRatio = window.devicePixelRatio || 1;
		const clientSize = Vector2.create(window.innerWidth, window.innerHeight);
		const canvasSize = Vector2.create(Math.round(clientSize.x * devicePixelRatio), Math.round(clientSize.y * devicePixelRatio));
		this.#canvas.width = canvasSize.x; 
		this.#canvas.height = canvasSize.y;
		this.#canvas.style.width = `${clientSize.x}px`;
		this.#canvas.style.height = `${clientSize.y}px`;

		// 전체 화면 설정.
		const scale = Math.min(clientSize.x / this.#viewManager.resolution.x, clientSize.y / this.#viewManager.resolution.y);
		const viewWidth = Math.round(this.#viewManager.resolution.x * scale);
		const viewHeight = Math.round(this.#viewManager.resolution.y * scale);
		const viewX = Math.floor((clientSize.x - viewWidth) * 0.5);
		const viewY = Math.floor((clientSize.y - viewHeight) * 0.5);

		// 뷰 화면 설정.
		this.#viewManager.devicePixelRatio = devicePixelRatio;
		this.#viewManager.scale = scale;
		this.#viewManager.screen.x = clientSize.x;
		this.#viewManager.screen.y = clientSize.y;
		this.#viewManager.view.position.x = viewX;
		this.#viewManager.view.position.y = viewY;
		this.#viewManager.view.size.x = viewWidth;
		this.#viewManager.view.size.y = viewHeight;

		// if (this.#gameInstance && typeof this.#gameInstance.resize === "function") {
		// 	this.#gameInstance.resize(this);
		// }
		// 씬 리사이즈.
		for (let i = 0; i < this.#scenes.length; ++i) {
			const scene = this.#scenes[i];
			
			try {
				// 주기적 갱신.
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

				this.#inputManager.justMoved = true;
				this.#inputManager.justPressed = true;
				this.#updatePointer(touchEvent.clientX, touchEvent.clientY);
			});

		window.addEventListener("mousemove", (touchEvent) => {
				this.#updatePointer(touchEvent.clientX, touchEvent.clientY);
			});

		window.addEventListener("mouseup", (touchEvent) => {
				this.#inputManager.justMoved = false;
				this.#inputManager.justReleased = true;
				this.#updatePointer(touchEvent.clientX, touchEvent.clientY);
			});

		this.#canvas.addEventListener("touchstart", (touchEvent) => {
				const touch = touchEvent.changedTouches[0];
				if (!touch) return;

				// if (!this.#view.isInsideView(touch.clientX, touch.clientY)) {
				// 	return;
				// }

				this.#inputManager.justMoved = true;
				this.#inputManager.justPressed = true;
				this.#updatePointer(touch.clientX, touch.clientY);
				touchEvent.preventDefault();
			}, { passive: false });

		window.addEventListener("touchmove", (touchEvent) => {
				const touch = touchEvent.changedTouches[0];
				if (!touch) return;

				this.#updatePointer(touch.clientX, touch.clientY);
				touchEvent.preventDefault();
			}, { passive: false });

		window.addEventListener("touchend", (touchEvent) => {
				const touch = touchEvent.changedTouches[0];
				if (touch) {
					this.#updatePointer(touch.clientX, touch.clientY);
				}

				this.#inputManager.justMoved = false;
				this.#inputManager.justReleased = true;
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
	#updatePointer(clientX, clientY) {
		this.#inputManager.position.x = ((clientX - this.#viewManager.view.position.x) / this.#viewManager.view.size.x) * this.#viewManager.resolution.x;
		this.#inputManager.position.y = ((clientY - this.#viewManager.view.position.y) / this.#viewManager.view.size.y) * this.#viewManager.resolution.y;
	}
	
	//==============================================================================
	// 개발모드 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasContext 
	 */
	drawDevelopment(canvasContext) {
		if (!this.#isDevelopment)
			return;
	
		const engine = this;
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


		// 기본 위치인 화면 좌상단으로 이동.
		canvasContext.setTransform(1, 0, 0, 1, 0, 0);
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

		// 초당 프레임 체크.
		drawOutlineText(`framePerSecond: ${engine.#timeManager.fps}`);

		// 메모리 사용량 체크.
		// 크로미움 기반 API. (비표준)
		const memory = performance.memory;
		if (memory)
		{
			const usedJSHeapSize = formatSizeString(memory.usedJSHeapSize);
			const totalJSHeapSize = formatSizeString(memory.totalJSHeapSize);
			const jsHeapSizeLimit = formatSizeString(memory.jsHeapSizeLimit);
			drawOutlineText(`usedJSHeapSize: ${usedJSHeapSize}`);
			drawOutlineText(`totalJSHeapSize: ${totalJSHeapSize}`);
			drawOutlineText(`jsHeapSizeLimit: ${jsHeapSizeLimit}`);
		}
		else
		{
			drawOutlineText(`usedJSHeapSize: Not Supported`);
			drawOutlineText(`totalJSHeapSize: Not Supported`);
			drawOutlineText(`jsHeapSizeLimit: Not Supported`);
		}

		this.#platform.getPlatformInfo();
		drawOutlineText(`platformName: ${this.#platform.platformName}`);
		drawOutlineText(`browserName: ${this.#platform.browserName}`);

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
		this.#renderer.update(this);

		// 시간 갱신.
		this.#timeManager.update(timestamp);

		// // 화면 더 부드럽게.
		// this.CanvasContext.scale(this.#view.devicePixelRatio, this.#view.devicePixelRatio);
		// this.CanvasContext.imageSmoothingEnabled = true;
    	// this.CanvasContext.imageSmoothingQuality = 'high';
		// this.canvasContext.canvas.style.textRendering = 'optimizeLegibility';

		// 씬 처리.
		for (let i = 0; i < this.#scenes.length; ++i) {
			const scene = this.#scenes[i];
			
			try {
				// 주기적 갱신.
				scene.tick(this.#timeManager.timeDelta);

				// 출력.
				scene.preDraw(this.#renderer);
				scene.draw(this.#renderer);
				scene.postDraw(this.#renderer);
			}
			catch (error) {
				console.error(error);
			}
		}

		if (this.#isDevelopment) {
			const canvasContext = this.#renderer.getCanvasContext();
			this.drawDevelopment(canvasContext);
		}
		
		// 입력 처리.
		this.#inputManager.justPressed = false;
		this.#inputManager.justReleased = false;

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
	viewIdentity(color = "#000000") {
		const renderer = this.getRenderer();
		const canvasContext = renderer.getCanvasContext();

		// 좌표계 초기화.
		canvasContext.setTransform(1, 0, 0, 1, 0, 0);
		
		// 상태 초기화.
		// canvasContext.save();

		// 영역 전체 칠하기.
		canvasContext.beginPath();
		canvasContext.fillStyle = color;
		canvasContext.fillRect(0, 0, this.#canvas.width, this.#canvas.height);
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

		// 좌표계 초기화.
		const devicePixelRatio = this.#viewManager.devicePixelRatio;
		const a = this.#viewManager.scale * devicePixelRatio;
		const e = this.#viewManager.view.position.x * devicePixelRatio;
		const f = this.#viewManager.view.position.y * devicePixelRatio;
		canvasContext.setTransform(a, 0, 0, a, e, f);

		// 영역 전체 칠하기.
		if (color !== null) {
			canvasContext.fillStyle = color;
			canvasContext.fillRect(0, 0, this.#viewManager.resolution.x, this.#viewManager.resolution.y);
		}
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
