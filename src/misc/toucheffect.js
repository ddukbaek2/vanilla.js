//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import * as Math from "../base/math.js";
import { Node } from "../core/node.js";


//==============================================================================
// 터치 입자.
//==============================================================================
export class TouchParticle extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { Vector2 } */ position;
	/** @type { Vector2 } */ velocity;
	/** @type { number } */ life;
	/** @type { number } */ maxLife;
	/** @type { number } */ radius;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.position = Vector2.zero();
		this.velocity = Vector2.zero();
		this.life = 1.0;
		this.maxLife = 1.0;
		this.radius = 0;
	}
}


//==============================================================================
// 터치 효과.
//==============================================================================
export class TouchEffect extends Node {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #originalCompositeOperation;
	/** @private @type { TouchParticle[] } */ #touchParticles;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#originalCompositeOperation = "";
		this.#touchParticles = [];
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		this.updateTouchParticles(timeDelta);
	}

	//==============================================================================
	// 출력 상태 시작.
	//==============================================================================
	/**
	 * @override
	 * @param { Renderer } renderer 
	 */
	beginCanvasState(renderer) {
		super.beginCanvasState(renderer);
		const canvasContext = renderer.getCanvasContext();
		this.#originalCompositeOperation = canvasContext.globalCompositeOperation;
		canvasContext.globalCompositeOperation = "lighter";
	}

	//==============================================================================
	// 출력 상태 종료.
	//==============================================================================
	/**
	 * @override
	 * @param { Renderer } renderer 
	 */
	endCanvasState(renderer) {
		const canvasContext = renderer.getCanvasContext();
		// canvasContext.globalCompositeOperation = "source-over";
		canvasContext.globalCompositeOperation = this.#originalCompositeOperation;
		super.endCanvasState(renderer);
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @override
	 * @param { Renderer } renderer 
	 */
	draw(renderer) {
		super.draw(renderer);
		this.drawTouchParticles(renderer);
	}

	//==============================================================================
	// 터치 파티클 생성.
	//==============================================================================
	createTouchParticle(x, y) {
		const particle = new TouchParticle();
		particle.position = Vector2.create(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10);
		particle.velocity = Vector2.create((Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120);
		particle.life = 1.0;
		particle.maxLife = 1.0;
		particle.radius = Math.random() * 25 + 10;
		this.#touchParticles.push(particle);
	}

	//==============================================================================
	// 터치 파티클 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 
	 */
	updateTouchParticles(timeDelta) {
		for (let i = this.#touchParticles.length - 1; i >= 0; --i) {
			const particle = this.#touchParticles[i];
			particle.life -= timeDelta * 2.5;
			particle.position.x += particle.velocity.x * timeDelta;
			particle.position.y += particle.velocity.y * timeDelta;
			if (particle.life <= 0.0) {
				this.#touchParticles.splice(i, 1);
			}
		}
	}

	//==============================================================================
	// 터치 파티클 출력.
	//==============================================================================
	/**
	 * @param { Renderer } renderer 
	 */
	drawTouchParticles(renderer) {
		if (this.#touchParticles.length === 0) {
			return;
		}

		const canvasContext = renderer.getCanvasContext();
		for (let i = 0; i < this.#touchParticles.length; ++i) {
			const particle = this.#touchParticles[i];
			const opacity = Math.max(0, particle.life / particle.maxLife);

			const radialGradient = canvasContext.createRadialGradient(
				particle.position.x, particle.position.y, 0, 
				particle.position.x, particle.position.y, particle.radius);
				
			radialGradient.addColorStop(0, `rgba(100, 200, 255, ${opacity * 0.8})`);
			radialGradient.addColorStop(1, `rgba(100, 200, 255, 0)`);

			// 원 출력.
			canvasContext.beginPath();
			canvasContext.arc(particle.position.x, particle.position.y, particle.radius, 0, Math.PI * 2);
			canvasContext.fillStyle = radialGradient;
			canvasContext.fill();
		}
	}
}