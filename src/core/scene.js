//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Engine } from "./engine.js";
import { Renderer } from "./renderer.js";
import { Node } from "./node.js";
import { Tween } from "./tween.js";
import { TouchEffect } from "../misc/toucheffect.js";


//==============================================================================
// 씬.
//==============================================================================
export class Scene extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Engine } */ #engine;
	/** @private @type { Node } */ #root;
	/** @private @type { VTweeneen[] } */ #tweens;
	/** @private @type { TouchEffect } */ #touchEffect;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.create();
	}
	
	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @virtual
	 */
	create() {
		this.#root = Node.create();
		this.#tweens = [];
	}

	//==============================================================================
	// 초기화.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Engine } engine 
	 */
	initialize(engine) {
		this.#engine = engine;

		// 터치 효과 초기화.
		this.#touchEffect = new TouchEffect(engine);
	}

	
	//==============================================================================
	// 이후 초기화.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Engine } engine 
	 */
	postInitialize(engine) {
		this.#engine = engine;

		// 터치 효과 초기화.
		this.#touchEffect = new TouchEffect(engine);
	}

	//==============================================================================
	// 파괴.
	//==============================================================================
	/**
	 * @virtual
	 */
	finalize() {

	}

	//==============================================================================
	// 비동기 로딩.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Engine } engine 
	 */
	async load(engine) {
		await Promise.resolve();
	}

	//==============================================================================
	// 비동기 로딩 해제.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Engine } engine 
	 */
	async unload(engine) {
		await Promise.resolve();
	}

	//==============================================================================
	// 화면 크기 변경됨.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } screenSize
	 */
	resize(screenSize) {
		console.log(`Scene.resize(${screenSize.x}, ${screenSize.y})`);
		// this.#root.
	}

	//==============================================================================
	// 주기적 갱신.
	//==============================================================================
	/**
	 * @virtual
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		if (this.#root.isActive()) {
			this.#root.tick(timeDelta);
		}

		// 터치 갱신.
		this.tickTouch(timeDelta);

		// 트윈 목록 갱신.
		for (let i = this.#tweens.length - 1; i >= 0; --i) {
			const tween = this.#tweens[i];
			tween.tick(timeDelta);
			if (tween.isFinished()) {
				this.#tweens.splice(i, 1);
			}
		}
	}

	//==============================================================================
	// 터치 갱신.
	//==============================================================================
	/**
	 * @virtual
	 * @param { number } timeDelta 
	 */
	tickTouch(timeDelta) {
		const engine = this.getEngine();
		const inputManager = engine.getInputManager();
		const inputPosition = inputManager.getInputPosition();

		// 터치 처리.
		if (inputManager.justPressed) {
			this.touchPress(inputPosition);
		}
		else if (inputManager.justReleased) {
			this.touchRelease(inputPosition);
		}
		else if (inputManager.justMoved) {
			this.touchMove(inputPosition);
		}

		// 터치 효과 갱신.
		this.#touchEffect.tick(timeDelta);
	}

	//==============================================================================
	// 터치 누름.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } worldPosition
	 */
	touchPress(worldPosition) {

	}

	//==============================================================================
	// 터치 이동.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } worldPosition
	 */
	touchMove(worldPosition) {
		// 터치 효과 처리.
		this.#touchEffect.createTouchParticle(worldPosition.x, worldPosition.y);
	}

	//==============================================================================
	// 터치 뗌.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } worldPosition
	 */
	touchRelease(worldPosition) {

	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Renderer } renderer 
	 */
	preDraw(renderer) {
		// // 노드 출력.
		// renderer.drawNode(this.#root);
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Renderer } renderer 
	 */
	draw(renderer) {
		// 노드 출력.
		renderer.drawNode(this.#root);
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Renderer } renderer 
	 */
	postDraw(renderer) {
		// 터치 효과 출력.
		renderer.drawNode(this.#touchEffect);
	}

	//==============================================================================
	// 트윈 시작.
	//==============================================================================
	/**
	 * @param { Tween } tween 
	 */
	startTween(tween) {
		const index = this.#tweens.indexOf(tween);
		if (index !== -1) {
			return;
		}

		tween.start();
		this.#tweens.push(tween);
	}

	//==============================================================================
	// 트윈 중단.
	//==============================================================================
	/**
	 * @param { Tween } tween 
	 */
	stopTween(tween) {
		const index = this.#tweens.indexOf(tween);
		if (index === -1) {
			return;
		}

		tween.stop();
		this.#tweens.splice(index, 1);
	}

	//==============================================================================
	// 모든 트윈 중단.
	//==============================================================================
	stopAllTweens() {
		for (let i = this.#tweens.length - 1; i >= 0; --i) {
			const tween = this.#tweens[i];
			tween.stop();
			this.#tweens.splice(i, 1);
		}
	}

	//==============================================================================
	// 엔진 반환.
	//==============================================================================
	/**
	 * @returns { Engine } 
	 */
	getEngine() {
		return this.#engine;
	}
	
	//==============================================================================
	// 루트 노드 반환.
	//==============================================================================
	/**
	 * @returns { Renderer } 
	 */
	getRoot() {
		return this.#root;
	}

	//==============================================================================
	// 캔버스 렌더링 컨텍스트 반환.
	//==============================================================================
	/**
	 * @returns { CanvasRenderingContext2D } 
	 */
	getCanvasContext() {
		const engine = this.getEngine();
		const renderer = engine.getRenderer();
		return renderer.getCanvasContext();
	}
}