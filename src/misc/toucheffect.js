//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Color } from "../base/color.js";
import * as Math from "../base/math.js";
import { WorldNode } from "../core/node/worldnode.js";


//==============================================================================
// 파티클용 방사형 그라디언트 텍스처. (흰색으로 구워 셰이더 틴트로 착색)
// - WebGL2 에는 그라디언트 API 가 없으므로 오프스크린 2D 캔버스에 1회만 굽는다.
//==============================================================================
const PARTICLE_GRADIENT_CANVAS_SIZE = 64;
let particleGradientCanvas = null;

//==============================================================================
// 방사형 그라디언트 캔버스 반환. (없으면 1회 생성)
//==============================================================================
/**
 * @returns { HTMLCanvasElement }
 */
function getParticleGradientCanvas() {
	if (particleGradientCanvas === null) {
		const canvas = System.document.createElement("canvas");
		canvas.width = PARTICLE_GRADIENT_CANVAS_SIZE;
		canvas.height = PARTICLE_GRADIENT_CANVAS_SIZE;
		const canvasRenderingContext = canvas.getContext("2d");
		const halfSize = PARTICLE_GRADIENT_CANVAS_SIZE * 0.5;
		const radialGradient = canvasRenderingContext.createRadialGradient(halfSize, halfSize, 0, halfSize, halfSize, halfSize);
		radialGradient.addColorStop(0, "rgba(255, 255, 255, 1)");
		radialGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
		canvasRenderingContext.fillStyle = radialGradient;
		canvasRenderingContext.fillRect(0, 0, PARTICLE_GRADIENT_CANVAS_SIZE, PARTICLE_GRADIENT_CANVAS_SIZE);
		particleGradientCanvas = canvas;
	}
	return particleGradientCanvas;
}


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
export class TouchEffect extends WorldNode {
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
	 * @param { Graphic } graphic 
	 */
	pushTransform(graphic) {
		super.pushTransform(graphic);

		if (graphic) {
			this.#originalCompositeOperation = graphic.getBlendMode();
			graphic.setBlendMode("lighter");
		}
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic 
	 */
	draw(graphic) {
		super.draw(graphic);
		this.drawTouchParticles(graphic);
	}

	//==============================================================================
	// 출력 상태 종료.
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic 
	 */
	popTransform(graphic) {
		if (graphic) {
			// graphic.setBlendMode("source-over");
			graphic.setBlendMode(this.#originalCompositeOperation);
		}

		super.popTransform(graphic);
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
	 * @param { Graphic } graphic 
	 */
	drawTouchParticles(graphic) {
		if (this.#touchParticles.length === 0) {
			return;
		}

		// 흰색 그라디언트 텍스처를 파티클 색으로 틴트해 출력.
		const gradientCanvas = getParticleGradientCanvas();
		const particleColor = Color.createFromRGBA("rgb(100, 200, 255)");
		const originalAlpha = graphic.getGlobalAlpha();
		graphic.setImageTintColor(particleColor);
		for (let i = 0; i < this.#touchParticles.length; ++i) {
			const particle = this.#touchParticles[i];
			const opacity = Math.max(0, particle.life / particle.maxLife);

			// 원 출력.
			graphic.setGlobalAlpha(originalAlpha * opacity * 0.8);
			const drawPosition = Vector2.create(particle.position.x - particle.radius, particle.position.y - particle.radius);
			const drawSize = Vector2.create(particle.radius * 2, particle.radius * 2);
			graphic.drawImage(gradientCanvas, drawPosition, drawSize);
		}
		graphic.setImageTintColor(null);
		graphic.setGlobalAlpha(originalAlpha);
	}
}