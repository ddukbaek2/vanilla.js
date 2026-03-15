//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VObject } from "../base/object.js";
import { VVector2 } from "../base/vector2.js";
import { VNode } from "../core/node.js";


export class VParticle extends VObject {
	/** @type { VVector2 } */ position;
	/** @type { VVector2 } */ velocity;
	/** @type { number } */ life;
	/** @type { number } */ maxLife;
	/** @type { number } */ radius;
	constructor() {
		super();
		this.position = VVector2.zero();
		this.velocity = VVector2.zero();
		this.life = 1.0;
		this.maxLife = 1.0;
		this.radius = 0;
	}
}

//==============================================================================
// 터치 효과.
//==============================================================================
export class VTouchEffect extends VNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { VParticle[] } */ touchParticles;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.touchParticles = [];
	}

	//==============================================================================
	// 터치 파티클 생성.
	//==============================================================================
	createTouchParticle(x, y) {
		const particle = new VParticle();
		particle.position = VVector2.create(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10);
		particle.velocity = VVector2.create((Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120);
		particle.life = 1.0;
		particle.maxLife = 1.0;
		particle.radius = Math.random() * 25 + 10;
		this.touchParticles.push(particle);
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta 
	 */
	update(timeDelta) {
		super.update(timeDelta);
		this.updateTouchParticles(timeDelta);
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @override
	 * @param { VRenderer } renderer 
	 */
	draw(renderer) {
		super.draw(renderer);
		this.drawTouchParticles(renderer);
	}

	//==============================================================================
	// 터치 파티클 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 
	 */
	updateTouchParticles(timeDelta) {
		for (let i = this.touchParticles.length - 1; i >= 0; --i) {
			const particle = this.touchParticles[i];
			particle.life -= timeDelta * 2.5;
			particle.position.x += particle.velocity.x * timeDelta;
			particle.position.y += particle.velocity.y * timeDelta;
			if (particle.life <= 0.0) {
				this.touchParticles.splice(i, 1);
			}
		}
	}

	//==============================================================================
	// 터치 파티클 출력.
	//==============================================================================
	/**
	 * @param { VRenderer } renderer 
	 */
	drawTouchParticles(renderer) {
		if (this.touchParticles.length === 0) {
			return;
		}

		const canvasContext = renderer.getCanvasContext();
		canvasContext.globalCompositeOperation = "lighter";
		for (let i = 0; i < this.touchParticles.length; ++i) {
			const particle = this.touchParticles[i];
			const alpha = Math.max(0, particle.life / particle.maxLife);

			const gradient = canvasContext.createRadialGradient(
				particle.position.x, particle.position.y, 0, 
				particle.position.x, particle.position.y, 
				particle.radius);
			gradient.addColorStop(0, `rgba(100, 200, 255, ${alpha * 0.8})`);
			gradient.addColorStop(1, `rgba(100, 200, 255, 0)`);

			canvasContext.beginPath();
			canvasContext.arc(particle.position.x, particle.position.y, particle.radius, 0, Math.PI * 2);
			canvasContext.fillStyle = gradient;
			canvasContext.fill();
		}
	}
}