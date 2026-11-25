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
/**
 * @example <caption>입자 하나의 수명과 자리를 한 걸음 줄이고 옮기기</caption>
 * import { TouchParticle, Vector2 } from "./build/vanilla.js";
 *
 * const touchParticle = new TouchParticle();
 * touchParticle.position = Vector2.create(100, 100);
 * touchParticle.velocity = Vector2.create(30, -60);
 * touchParticle.radius = 20;
 * const timeDelta = 0.1;
 * touchParticle.life -= timeDelta * 2.5;
 * const step = touchParticle.velocity.multiply(timeDelta);
 * touchParticle.position = touchParticle.position.add(step);
 * const opacity = touchParticle.life / touchParticle.maxLife;
 * console.log(opacity, touchParticle.position.x, touchParticle.position.y);
 */
export class TouchParticle extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { Vector2 } */ position; // 자리. (픽셀, TouchEffect 노드 기준)
	/** @type { Vector2 } */ velocity; // 속도. (픽셀 / 초)
	/** @type { number } */ life; // 남은 수명. (1 에서 시작해 초당 2.5 씩 줄고 0 이하면 지운다)
	/** @type { number } */ maxLife; // 처음 수명. (불투명도는 life / maxLife)
	/** @type { number } */ radius; // 반지름. (픽셀)

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
/**
 * @example <caption>누른 자리에 빛 입자 뿌리기</caption>
 * import { Engine, EngineConfiguration, Scene, TouchEffect } from "./build/vanilla.js";
 *
 * const touchEffect = new TouchEffect();
 *
 * class MainScene extends Scene {
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		const root = this.getRoot();
 * 		root.addChild(touchEffect);
 * 		for (let index = 0; index < 8; ++index) {
 * 			touchEffect.createTouchParticle(320, 180);
 * 		}
 * 	}
 *
 * 	touchPress(viewInputPosition) {
 * 		super.touchPress(viewInputPosition);
 * 		for (let index = 0; index < 8; ++index) {
 * 			touchEffect.createTouchParticle(viewInputPosition.x, viewInputPosition.y);
 * 		}
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
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
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
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
	 * @param { Graphic } graphic 그릴 그래픽.
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
	 * @param { Graphic } graphic 그릴 그래픽.
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
	 * @param { Graphic } graphic 그릴 그래픽.
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
	/**
	 * @param { number } x 입자를 낼 X. (이 노드 기준 좌표, 10 픽셀 안에서 흔든다)
	 * @param { number } y 입자를 낼 Y. (이 노드 기준 좌표, 10 픽셀 안에서 흔든다)
	 */
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
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
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
	 * @param { Graphic } graphic 그릴 그래픽.
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