//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VObject } from "../base/object.js";
import { VVector2 } from "../base/vector2.js";
import { VEngine } from "./engine.js";
import { VRenderer } from "./renderer.js";
import { VNode } from "./node.js";
import { VTween } from "./tween.js";
import { VTouchEffect } from "../misc/toucheffect.js";


//==============================================================================
// 씬.
//==============================================================================
export class VScene extends VObject {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { VEngine } */ #engine;
	/** @private @type { VNode } */ #root;
	/** @private @type { VTweeneen[] } */ #tweens;
	/** @private @type { VTouchEffect } */ #touchEffect;

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
		this.#root = VNode.create();
		this.#tweens = [];
	}

	//==============================================================================
	// 초기화.
	//==============================================================================
	/**
	 * @virtual
	 * @param { VEngine } engine 
	 */
	initialize(engine) {
		this.#engine = engine;

		// 터치 효과 초기화.
		this.#touchEffect = new VTouchEffect(engine);
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
	 * @param { VEngine } engine 
	 */
	async load(engine) {
		await Promise.resolve();
	}

	//==============================================================================
	// 비동기 로딩 해제.
	//==============================================================================
	/**
	 * @virtual
	 * @param { VEngine } engine 
	 */
	async unload(engine) {
		await Promise.resolve();
	}

	//==============================================================================
	// 주기적 갱신.
	//==============================================================================
	/**
	 * @virtual
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		this.#root.tick(timeDelta);		
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
		const input = engine.getInput();

		// 터치 처리.
		if (input.justPressed) {
			this.touchPress(input.x, input.y);
		}
		else if (input.justReleased) {
			this.touchRelease(input.x, input.y);
		}
		else if (input.justMoved) {
			this.touchMove(input.position);
		}

		// 터치 효과 갱신.
		this.#touchEffect.tick(timeDelta);
	}

	//==============================================================================
	// 터치 누름.
	//==============================================================================
	/**
	 * @virtual
	 * @param { VVector2 } worldPosition
	 */
	touchPress(worldPosition) {

	}

	//==============================================================================
	// 터치 이동.
	//==============================================================================
	/**
	 * @virtual
	 * @param { VVector2 } worldPosition
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
	 * @param { VVector2 } worldPosition
	 */
	touchRelease(worldPosition) {

	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @virtual
	 * @param { VRenderer } renderer 
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
	 * @param { VRenderer } renderer 
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
	 * @param { VRenderer } renderer 
	 */
	postDraw(renderer) {
		// 터치 효과 출력.
		renderer.drawNode(this.#touchEffect);
	}

	//==============================================================================
	// 트윈 시작.
	//==============================================================================
	/**
	 * @param { VTween } tween 
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
	 * @param { VTween } tween 
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
	 * @returns { VEngine } 
	 */
	getEngine() {
		return this.#engine;
	}
	
	//==============================================================================
	// 루트 노드 반환.
	//==============================================================================
	/**
	 * @returns { VRenderer } 
	 */
	getRoot() {
		return this.#root;
	}
}