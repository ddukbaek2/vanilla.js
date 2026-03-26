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
// - new() ==> create() ==> async load(engine) ==> initialize(engine)
// - finalize(engine) ==> async unload(engine) ==> destroy()
// - resize(canvasNativeSize)
// - tick(timeDelta)
// - preDraw(renderer) ==> draw(renderer) ==> postDraw(renderer)
// - touchPress(viewInputPosition) ==> touchMove(viewInputPosition) ==> touchRelease(viewInputPosition)
// - reset()
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
	// 파괴.
	//==============================================================================
	/**
	 * @virtual
	 */
	destroy() {
	}

	//==============================================================================
	// 비동기 로딩.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Engine } engine 
	 */
	async load(engine) {
		this.#engine = engine;
		await Promise.resolve();
	}

	//==============================================================================
	// 초기화.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Engine } engine 
	 */
	initialize(engine) {
		// 터치 효과 초기화.
		this.#touchEffect = new TouchEffect(engine);
	}

	//==============================================================================
	// 종료처리.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Engine } engine 
	 */
	finalize(engine) {

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
	 * @param { Vector2 } canvasNativeSize
	 */
	resize(canvasNativeSize) {
		console.log(`Scene.resize(${canvasNativeSize.x}, ${canvasNativeSize.y})`);
	}

	//==============================================================================
	// 주기적 갱신.
	//==============================================================================
	/**
	 * @virtual
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		// 노드 갱신.
		try {
			if (this.#root.isActive()) {
				this.#root.tick(timeDelta);
			}
		}
		catch (error) {
			console.error(error);
		}

		// 터치 갱신.
		try {
			this.tickTouch(timeDelta);
		}
		catch (error) {
			console.error(error);
		}

		// 트윈 목록 갱신.
		for (let i = this.#tweens.length - 1; i >= 0; --i) {
			const tween = this.#tweens[i];
			try {
				if (tween) {
					tween.tick(timeDelta);
					if (tween.isFinished()) {
						this.#tweens.splice(i, 1);
					}
				}
				else {
					this.#tweens.splice(i, 1);
					continue;
				}
			}
			catch (error) {
				console.error(error);
			}
		}
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
	postDraw(renderer) {
		// 터치 효과 출력.
		renderer.drawNode(this.#touchEffect);
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
		const viewInputPosition = inputManager.getViewInputPosition();

		// 누름.
		if (inputManager.isTouchPressed()) {
			try {
				this.touchPress(viewInputPosition);
			}
			catch (error) {
				console.error(error);
			}
		}
		// 뗌.
		else if (inputManager.isTouchReleased()) {
			try {
				this.touchRelease(viewInputPosition);
			}
			catch (error) {
				console.error(error);
			}
		}
		// 누르고 있음.
		else if (inputManager.isTouchMoved()) {
			try {
				this.touchMove(viewInputPosition);
			}
			catch (error) {
				console.error(error);
			}
		}

		// 터치 효과 갱신.
		this.#touchEffect.tick(timeDelta);
	}

	//==============================================================================
	// 터치 누름.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition
	 */
	touchPress(viewInputPosition) {

	}

	//==============================================================================
	// 터치 이동.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition
	 */
	touchMove(viewInputPosition) {
		// 터치 효과 처리.
		this.#touchEffect.createTouchParticle(viewInputPosition.x, viewInputPosition.y);
	}

	//==============================================================================
	// 터치 뗌.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition
	 */
	touchRelease(viewInputPosition) {

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