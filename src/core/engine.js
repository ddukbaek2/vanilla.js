//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VObject } from "../base/object.js";
import { VColors } from "../base/colors.js";
import { VTime } from "./time.js";
import { VView } from "./view.js";
import { VInput } from "./input.js";
import { VGameInstance } from "./gameinstance.js";
import { VPlatform, PlatformType, BrowserType } from "../base/platform.js";
import { VRenderer } from "./renderer.js";


//==============================================================================
// 엔진.
//==============================================================================
export class VEngine extends VObject {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { HTMLCanvasElement } */ #canvas;
	/** @private @type { VPlatform } */ #platform;
	/** @private @type { VTime } */ #time;
	/** @private @type { VView } */ #view;
	/** @private @type { VInput } */ #input;
	/** @private @type { VRenderer } */ #renderer;

	/** @private @type { () => void  } */ #onResizeCallback;
	/** @private @type { FrameRequestCallback } */ #onEngineUpdateCallback;
	/** @private @type { VGameInstance } */ #gameInstance;
	/** @private @type { VScene } */ #scene;
	/** @private @type { boolean } */ #isDevelopment;


	//==============================================================================
	// 생성.
	//==============================================================================
	constructor(width, height, canvasId, isDevelopment = true) {
		super();

		this.#canvas = document.getElementById(canvasId);
		const canvasContext = this.#canvas.getContext("2d", { alpha: false });

		this.#platform = new VPlatform();
		this.#time = new VTime(this);
		this.#view = new VView(this);
		this.#view.resolution.x = width;
		this.#view.resolution.y = height;
		this.#input = new VInput(this);
		this.#renderer = new VRenderer(this, canvasContext);

		this.#onResizeCallback = this.#resized.bind(this);
		this.#onEngineUpdateCallback = this.#updateEngine.bind(this);
		this.#gameInstance = null;
		this.#scene = null;
		this.#isDevelopment = isDevelopment;
		
		this.#setupAllEvents();
		this.#resized();
	}

	//==============================================================================
	// 게임 인스턴스 설정.
	//==============================================================================
	/**
	 * @method
	 * @public
	 * @param { VGameInstance } gameInstance
	 */
	setGameInstance(gameInstance) {
		this.#gameInstance = gameInstance;
		if (this.#gameInstance && typeof this.#gameInstance.initialize === "function") {
			this.#gameInstance.initialize(this);
		}
	}

	//==============================================================================
	// 시작.
	//==============================================================================
	/**
	 * @param { VGameInstance } gameInstance
	 */
	run(gameInstance) {
		if (gameInstance != null)
			this.setGameInstance(gameInstance);

		window.addEventListener("resize", this.#onResizeCallback);
		window.requestAnimationFrame(this.#onEngineUpdateCallback);
	}

	//==============================================================================
	// 해상도 변경됨.
	//==============================================================================
	/**
	 * @private
	 * @method
	 */
	#resized() {
		const devicePixelRatio = window.devicePixelRatio || 1;
		const clientWidth = window.innerWidth;
		const clientHeight = window.innerHeight;
		this.#canvas.width = Math.round(clientWidth * devicePixelRatio);
		this.#canvas.height = Math.round(clientHeight * devicePixelRatio);
		this.#canvas.style.width = `${clientWidth}px`;
		this.#canvas.style.height = `${clientHeight}px`;

		// 전체 화면 설정.
		const scale = Math.min(clientWidth / this.#view.resolution.x, clientHeight / this.#view.resolution.y);
		const viewWidth = Math.round(this.#view.resolution.x * scale);
		const viewHeight = Math.round(this.#view.resolution.y * scale);
		const viewX = Math.floor((clientWidth - viewWidth) * 0.5);
		const viewY = Math.floor((clientHeight - viewHeight) * 0.5);

		// 뷰 화면 설정.
		this.#view.devicePixelRatio = devicePixelRatio;
		this.#view.scale = scale;
		this.#view.screen.x = clientWidth;
		this.#view.screen.y = clientHeight;
		this.#view.view.position.x = viewX;
		this.#view.view.position.y = viewY;
		this.#view.view.size.x = viewWidth;
		this.#view.view.size.y = viewHeight;

		if (this.#gameInstance && typeof this.#gameInstance.resized === "function") {
			this.#gameInstance.resized(this);
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

				this.#input.isDown = true;
				this.#input.justPressed = true;
				this.#updatePointer(touchEvent.clientX, touchEvent.clientY);
			});

		window.addEventListener("mousemove", (touchEvent) => {
				this.#updatePointer(touchEvent.clientX, touchEvent.clientY);
			});

		window.addEventListener("mouseup", (touchEvent) => {
				this.#input.isDown = false;
				this.#input.justReleased = true;
				this.#updatePointer(touchEvent.clientX, touchEvent.clientY);
			});

		this.#canvas.addEventListener("touchstart", (touchEvent) => {
				const touch = touchEvent.changedTouches[0];
				if (!touch) return;

				// if (!this.#view.isInsideView(touch.clientX, touch.clientY)) {
				// 	return;
				// }

				this.#input.isDown = true;
				this.#input.justPressed = true;
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

				this.#input.isDown = false;
				this.#input.justReleased = true;
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
		this.#input.position.x = ((clientX - this.#view.view.position.x) / this.#view.view.size.x) * this.#view.resolution.x;
		this.#input.position.y = ((clientY - this.#view.view.position.y) / this.#view.view.size.y) * this.#view.resolution.y;
	}
	
	//==============================================================================
	// 개발모드 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasContext 
	 */
	#drawDevelopment(canvasContext) {
		if (!this.#isDevelopment)
			return;
	
		const engine = this;
		const SYSTEM_FONT_STRING = '-apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
		if (this.terminalFont !== null) {
			// this.terminalFont = new FontFace(`VT323`, `url('https://fonts.gstatic.com/s/vt323/v17/pxiKyp0ihIEF2isfFJU.woff2')`);
			this.terminalFont = new FontFace(`DOSGothic`, `url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_eight@1.0/DOSGothic.woff')`);
			this.terminalFont.load().then((loadedFont) => {
				document.fonts.add(loadedFont);
			});
		}

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
		canvasContext.fillStyle = VColors.white; // Colors.lightVanilla
		// canvasContext.fillStyle = Colors.white; // Colors.lightVanilla;
		// canvasContext.lineWidth = 4;
		// canvasContext.strokeStyle = Colors.black; // Colors.darkVanilla;
		// canvasContext.textRendering = "auto"; //optimizeLegibility"; //"geometricPrecision";
		// canvasContext.shadowColor = Colors.white;
		// canvasContext.shadowOffsetX = 0.5;
		// canvasContext.shadowOffsetY = 0.5;
		canvasContext.textAlign = "left";
		canvasContext.imageSmoothingEnabled = false;
		canvasContext.scale(1.6, 1.6);

		// 초당 프레임 체크.
		drawOutlineText(`framePerSecond: ${engine.#time.fps}`);

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

		// 시간 갱신.
		this.#time.update(timestamp);

		// // 화면 더 부드럽게.
		// this.CanvasContext.scale(this.#view.devicePixelRatio, this.#view.devicePixelRatio);
		// this.CanvasContext.imageSmoothingEnabled = true;
    	// this.CanvasContext.imageSmoothingQuality = 'high';
		// this.canvasContext.canvas.style.textRendering = 'optimizeLegibility';

		if (this.#gameInstance) {
			if (typeof this.#gameInstance.update === "function") {
				this.#gameInstance.update(this.#time.timeDelta);
			}
			if (typeof this.#gameInstance.preDraw === "function") {
				this.#gameInstance.preDraw(this.#renderer);
			}
			if (typeof this.#gameInstance.draw === "function") {
				this.#gameInstance.draw(this.#renderer);
			}
			if (typeof this.#gameInstance.postDraw === "function") {
				this.#gameInstance.postDraw(this.#renderer);
			}
		}
		if (this.#isDevelopment) {
			const canvasContext = this.#renderer.getCanvasContext();
			this.#drawDevelopment(canvasContext);
		}
		
		this.#input.justPressed = false;
		this.#input.justReleased = false;

		window.requestAnimationFrame(this.#onEngineUpdateCallback);
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
		const canvasContext = this.#renderer.getCanvasContext();

		// 좌표계 초기화.
		canvasContext.setTransform(1, 0, 0, 1, 0, 0);

		// 영역 전체 칠하기.
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
		const devicePixelRatio = this.#view.devicePixelRatio;
		const a = this.#view.scale * devicePixelRatio;
		const e = this.#view.view.position.x * devicePixelRatio;
		const f = this.#view.view.position.y * devicePixelRatio;
		canvasContext.setTransform(a, 0, 0, a, e, f);

		// 영역 전체 칠하기.
		canvasContext.fillStyle = color;
		canvasContext.fillRect(0, 0, this.#view.resolution.x, this.#view.resolution.y);;
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
	 * @returns { VPlatform }
	 */
	getCanvas() {
		return this.#platform;
	}

	//==============================================================================
	// 시간 정보 반환.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @returns { VTime }
	 */
	getTime() {
		return this.#time;
	}
	
	//==============================================================================
	// 뷰 정보 반환.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @returns { VView }
	 */
	getView() {
		return this.#view;
	}

	//==============================================================================
	// 입력 정보 반환.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @returns { VInput }
	 */
	getInput() {
		return this.#input;
	}

	//==============================================================================
	// 렌더러 정보 반환.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @returns { VRenderer }
	 */
	getRenderer() {
		return this.#renderer;
	}
}
