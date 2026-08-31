//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";
import { Color } from "../base/color.js";
import { Component } from "../core/component.js";
import { Graphic } from "../core/graphic.js";
import * as Math from "../base/math.js";


//==============================================================================
// 방출 모양.
// - point: 노드 원점 한 점.
// - circle: 반지름 안 무작위 위치, 바깥 방향.
// - cone: 위쪽(-y) 기준 각도 부채꼴 방향, 반지름 안 위치.
// - box: 사각 영역 안 무작위 위치, 위쪽 방향.
// - edge: 가로 선분 위 무작위 위치, 위쪽 방향. (눈 / 비처럼 위에서 뿌릴 때)
//==============================================================================
export const EmitterShape = {
	point: "point",
	circle: "circle",
	cone: "cone",
	box: "box",
	edge: "edge",
};


//==============================================================================
// 파티클 시스템.
// - 유니티 ParticleSystem 의 자주 쓰는 부분을 2D 로 옮긴 컴포넌트.
//   방출(rate / burst), 모양(shape), 수명 / 속도 / 크기 / 회전 / 색의 시작 범위,
//   수명에 따른 크기 / 색 / 회전 변화, 중력 / 감쇠, 가산 합성, 이미지 스프라이트를 지원한다.
// - 사용:
//     const particleSystem = node.addComponent(ParticleSystem);
//     particleSystem.setEmissionRate(40);
//     particleSystem.setStartLifetime(0.6, 1.2);
//     particleSystem.setStartSpeed(40, 120);
//     particleSystem.setColorOverLifetime([
//         { time: 0, color: new Color(1, 0.8, 0.3, 1) },
//         { time: 1, color: new Color(1, 0.2, 0, 0) },
//     ]);
//     particleSystem.play();
//==============================================================================
export class ParticleSystem extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object[] } */ #particleList;
	/** @private @type { object[] } */ #freeList;
	/** @private @type { boolean } */ #isPlaying;
	/** @private @type { boolean } */ #isLooping;
	/** @private @type { number } */ #duration; // 루프 꺼짐일 때 방출이 이어지는 시간.
	/** @private @type { number } */ #playElapsedSeconds;
	/** @private @type { number } */ #maxParticleCount;

	// 방출.
	/** @private @type { number } */ #emissionRate; // 초당 방출 수.
	/** @private @type { number } */ #emissionAccumulator;
	/** @private @type { object[] } */ #burstList; // { time, count, fired }
	/** @private @type { string } */ #emitterShape;
	/** @private @type { number } */ #shapeRadius;
	/** @private @type { number } */ #coneAngleRadian; // cone 전용 반각.
	/** @private @type { Vector2 } */ #boxSize;
	/** @private @type { number } */ #edgeWidth;

	// 시작 범위.
	/** @private @type { number } */ #startLifetimeMin;
	/** @private @type { number } */ #startLifetimeMax;
	/** @private @type { number } */ #startSpeedMin;
	/** @private @type { number } */ #startSpeedMax;
	/** @private @type { number } */ #startSizeMin;
	/** @private @type { number } */ #startSizeMax;
	/** @private @type { number } */ #startRotationMin; // 라디안.
	/** @private @type { number } */ #startRotationMax;
	/** @private @type { Color } */ #startColorA;
	/** @private @type { Color } */ #startColorB; // A~B 사이 무작위.

	// 수명 동안 변화.
	/** @private @type { object[] | null } */ #colorOverLifetime; // [{ time, color }]
	/** @private @type { number } */ #sizeOverLifetimeStart; // 곱 계수.
	/** @private @type { number } */ #sizeOverLifetimeEnd;
	/** @private @type { number } */ #angularVelocityMin; // 초당 라디안.
	/** @private @type { number } */ #angularVelocityMax;

	// 물리.
	/** @private @type { Vector2 } */ #gravity;
	/** @private @type { number } */ #damping; // 초당 속도 감쇠 비율 계수.

	// 렌더.
	/** @private @type { string } */ #renderShape; // "circle" | "rect" | "image"
	/** @private @type { * } */ #image;
	/** @private @type { boolean } */ #isAdditive;
	/** @private @type { boolean } */ #isWorldSpace; // 참이면 방출 후 노드 이동의 영향을 받지 않는다.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.setComponentType("ParticleSystem");
		this.#particleList = [];
		this.#freeList = [];
		this.#isPlaying = true;
		this.#isLooping = true;
		this.#duration = 1;
		this.#playElapsedSeconds = 0;
		this.#maxParticleCount = 512;

		this.#emissionRate = 20;
		this.#emissionAccumulator = 0;
		this.#burstList = [];
		this.#emitterShape = EmitterShape.point;
		this.#shapeRadius = 0;
		this.#coneAngleRadian = 0.5;
		this.#boxSize = Vector2.create(0, 0);
		this.#edgeWidth = 0;

		this.#startLifetimeMin = 1;
		this.#startLifetimeMax = 1;
		this.#startSpeedMin = 60;
		this.#startSpeedMax = 60;
		this.#startSizeMin = 6;
		this.#startSizeMax = 6;
		this.#startRotationMin = 0;
		this.#startRotationMax = 0;
		this.#startColorA = new Color(1, 1, 1, 1);
		this.#startColorB = new Color(1, 1, 1, 1);

		this.#colorOverLifetime = null;
		this.#sizeOverLifetimeStart = 1;
		this.#sizeOverLifetimeEnd = 1;
		this.#angularVelocityMin = 0;
		this.#angularVelocityMax = 0;

		this.#gravity = Vector2.create(0, 0);
		this.#damping = 0;

		this.#renderShape = "circle";
		this.#image = null;
		this.#isAdditive = false;
		this.#isWorldSpace = false;
	}

	//==============================================================================
	// 재생 / 정지.
	//==============================================================================
	play() {
		this.#isPlaying = true;
		this.#playElapsedSeconds = 0;
		for (const burst of this.#burstList) {
			burst.fired = false;
		}
	}

	/**
	 * @param { boolean } isClearing 참이면 살아 있는 파티클도 지운다.
	 */
	stop(isClearing = false) {
		this.#isPlaying = false;
		if (isClearing) {
			this.#particleList.length = 0;
		}
	}

	//==============================================================================
	// 한 번에 여러 개 방출. (버튼 클릭 등 이벤트성 연출)
	//==============================================================================
	/**
	 * @param { number } count
	 * @param { Vector2 | null } worldOffset 방출 원점 보정. (노드 로컬 기준)
	 */
	emit(count, worldOffset = null) {
		for (let emitIndex = 0; emitIndex < count; ++emitIndex) {
			this.spawnParticle(worldOffset);
		}
	}

	//==============================================================================
	// 갱신. (방출 + 적분)
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		// 방출.
		if (this.#isPlaying) {
			const previousElapsed = this.#playElapsedSeconds;
			this.#playElapsedSeconds += timeDelta;

			const isEmitWindow = this.#isLooping || this.#playElapsedSeconds <= this.#duration;
			if (isEmitWindow && this.#emissionRate > 0) {
				this.#emissionAccumulator += this.#emissionRate * timeDelta;
				while (this.#emissionAccumulator >= 1) {
					this.#emissionAccumulator -= 1;
					this.spawnParticle(null);
				}
			}

			// 버스트. (루프면 duration 주기로 반복)
			for (const burst of this.#burstList) {
				let burstTime = burst.time;
				let currentTime = this.#playElapsedSeconds;
				let previousTime = previousElapsed;
				if (this.#isLooping && this.#duration > 0) {
					currentTime = this.#playElapsedSeconds % this.#duration;
					previousTime = previousElapsed % this.#duration;
					if (currentTime < previousTime) {
						burst.fired = false;
					}
				}
				if (!burst.fired && previousTime <= burstTime && currentTime >= burstTime) {
					burst.fired = this.#isLooping ? false : true;
					if (this.#isLooping && currentTime >= burstTime) {
						burst.fired = true;
					}
					this.emit(burst.count);
				}
			}
		}

		// 적분.
		for (let particleIndex = this.#particleList.length - 1; particleIndex >= 0; --particleIndex) {
			const particle = this.#particleList[particleIndex];
			particle.age += timeDelta;
			if (particle.age >= particle.lifetime) {
				this.#freeList.push(particle);
				this.#particleList.splice(particleIndex, 1);
				continue;
			}
			particle.velocityX += this.#gravity.x * timeDelta;
			particle.velocityY += this.#gravity.y * timeDelta;
			if (this.#damping > 0) {
				const dampingBlend = System.Math.max(0, 1 - this.#damping * timeDelta);
				particle.velocityX *= dampingBlend;
				particle.velocityY *= dampingBlend;
			}
			particle.x += particle.velocityX * timeDelta;
			particle.y += particle.velocityY * timeDelta;
			particle.rotation += particle.angularVelocity * timeDelta;
		}
	}

	//==============================================================================
	// 파티클 하나 생성.
	//==============================================================================
	/**
	 * @private
	 * @param { Vector2 | null } originOffset
	 */
	spawnParticle(originOffset) {
		if (this.#particleList.length >= this.#maxParticleCount) {
			return;
		}
		let spawnX = 0;
		let spawnY = 0;
		let directionX = 0;
		let directionY = -1;
		const shape = this.#emitterShape;
		if (shape === EmitterShape.circle) {
			const angle = Math.randomRange(0, System.Math.PI * 2);
			const radius = this.#shapeRadius * System.Math.sqrt(Math.randomRange(0, 1));
			spawnX = System.Math.cos(angle) * radius;
			spawnY = System.Math.sin(angle) * radius;
			directionX = System.Math.cos(angle);
			directionY = System.Math.sin(angle);
		}
		else if (shape === EmitterShape.cone) {
			const angle = -System.Math.PI * 0.5 + Math.randomRange(-this.#coneAngleRadian, this.#coneAngleRadian);
			const radius = Math.randomRange(0, this.#shapeRadius);
			spawnX = System.Math.cos(angle) * radius;
			spawnY = System.Math.sin(angle) * radius;
			directionX = System.Math.cos(angle);
			directionY = System.Math.sin(angle);
		}
		else if (shape === EmitterShape.box) {
			spawnX = Math.randomRange(-this.#boxSize.x * 0.5, this.#boxSize.x * 0.5);
			spawnY = Math.randomRange(-this.#boxSize.y * 0.5, this.#boxSize.y * 0.5);
		}
		else if (shape === EmitterShape.edge) {
			spawnX = Math.randomRange(-this.#edgeWidth * 0.5, this.#edgeWidth * 0.5);
			directionY = 1;
		}
		else {
			const angle = Math.randomRange(0, System.Math.PI * 2);
			directionX = System.Math.cos(angle);
			directionY = System.Math.sin(angle);
		}

		if (originOffset) {
			spawnX += originOffset.x;
			spawnY += originOffset.y;
		}

		// 월드 공간이면 노드의 현재 위치를 더해 고정한다.
		if (this.#isWorldSpace) {
			const node = this.getNode();
			const nodePosition = node.getLocalPosition();
			spawnX += nodePosition.x;
			spawnY += nodePosition.y;
		}

		const speed = Math.randomRange(this.#startSpeedMin, this.#startSpeedMax);
		const colorBlend = Math.randomRange(0, 1);
		const particle = this.#freeList.pop() || {};
		particle.x = spawnX;
		particle.y = spawnY;
		particle.velocityX = directionX * speed;
		particle.velocityY = directionY * speed;
		particle.age = 0;
		particle.lifetime = Math.randomRange(this.#startLifetimeMin, this.#startLifetimeMax);
		particle.size = Math.randomRange(this.#startSizeMin, this.#startSizeMax);
		particle.rotation = Math.randomRange(this.#startRotationMin, this.#startRotationMax);
		particle.angularVelocity = Math.randomRange(this.#angularVelocityMin, this.#angularVelocityMax);
		particle.red = this.#startColorA.red + (this.#startColorB.red - this.#startColorA.red) * colorBlend;
		particle.green = this.#startColorA.green + (this.#startColorB.green - this.#startColorA.green) * colorBlend;
		particle.blue = this.#startColorA.blue + (this.#startColorB.blue - this.#startColorA.blue) * colorBlend;
		particle.alpha = this.#startColorA.alpha + (this.#startColorB.alpha - this.#startColorA.alpha) * colorBlend;
		this.#particleList.push(particle);
	}

	//==============================================================================
	// 수명 비율에 따른 색 계산.
	//==============================================================================
	/**
	 * @private
	 * @param { object } particle
	 * @param { number } lifeRatio
	 * @returns { string } rgba 문자열.
	 */
	evaluateColor(particle, lifeRatio) {
		let red = particle.red;
		let green = particle.green;
		let blue = particle.blue;
		let alpha = particle.alpha;
		const gradient = this.#colorOverLifetime;
		if (gradient && gradient.length > 0) {
			let previousKey = gradient[0];
			let nextKey = gradient[gradient.length - 1];
			for (let keyIndex = 0; keyIndex < gradient.length; ++keyIndex) {
				if (gradient[keyIndex].time <= lifeRatio) {
					previousKey = gradient[keyIndex];
				}
				else {
					nextKey = gradient[keyIndex];
					break;
				}
			}
			const keySpan = System.Math.max(nextKey.time - previousKey.time, 0.0001);
			const keyBlend = System.Math.max(0, System.Math.min(1, (lifeRatio - previousKey.time) / keySpan));
			red *= previousKey.color.red + (nextKey.color.red - previousKey.color.red) * keyBlend;
			green *= previousKey.color.green + (nextKey.color.green - previousKey.color.green) * keyBlend;
			blue *= previousKey.color.blue + (nextKey.color.blue - previousKey.color.blue) * keyBlend;
			alpha *= previousKey.color.alpha + (nextKey.color.alpha - previousKey.color.alpha) * keyBlend;
		}
		const redByte = System.Math.round(System.Math.max(0, System.Math.min(1, red)) * 255);
		const greenByte = System.Math.round(System.Math.max(0, System.Math.min(1, green)) * 255);
		const blueByte = System.Math.round(System.Math.max(0, System.Math.min(1, blue)) * 255);
		return `rgba(${redByte}, ${greenByte}, ${blueByte}, ${System.Math.max(0, System.Math.min(1, alpha))})`;
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		if (this.#particleList.length === 0) {
			return;
		}
		if (this.#isAdditive) {
			graphic.setBlendMode("lighter");
		}

		// 월드 공간이면 노드 이동을 상쇄해 방출 시점 위치에 고정한다.
		let baseOffsetX = 0;
		let baseOffsetY = 0;
		if (this.#isWorldSpace) {
			const node = this.getNode();
			const nodePosition = node.getLocalPosition();
			baseOffsetX = -nodePosition.x;
			baseOffsetY = -nodePosition.y;
		}

		for (const particle of this.#particleList) {
			const lifeRatio = particle.age / particle.lifetime;
			const sizeScale = this.#sizeOverLifetimeStart + (this.#sizeOverLifetimeEnd - this.#sizeOverLifetimeStart) * lifeRatio;
			const drawSize = System.Math.max(0.1, particle.size * sizeScale);
			const colorText = this.evaluateColor(particle, lifeRatio);
			const drawX = particle.x + baseOffsetX;
			const drawY = particle.y + baseOffsetY;
			if (this.#renderShape === "circle") {
				graphic.setFillColor(colorText);
				graphic.drawCircle(Vector2.create(drawX, drawY), drawSize * 0.5);
			}
			else if (this.#renderShape === "image" && this.#image) {
				graphic.pushState();
				graphic.translate(drawX, drawY);
				graphic.rotate(particle.rotation);
				graphic.multiplyGlobalAlpha(System.Math.max(0, System.Math.min(1, particle.alpha * (1 - lifeRatio))));
				graphic.drawImage(this.#image, Vector2.create(-drawSize * 0.5, -drawSize * 0.5), Vector2.create(drawSize, drawSize));
				graphic.popState();
			}
			else {
				graphic.pushState();
				graphic.translate(drawX, drawY);
				graphic.rotate(particle.rotation);
				graphic.setFillColor(colorText);
				graphic.drawRect(Rect.create(-drawSize * 0.5, -drawSize * 0.5, drawSize, drawSize));
				graphic.popState();
			}
		}

		if (this.#isAdditive) {
			graphic.setBlendMode("source-over");
		}
	}

	//==============================================================================
	// 설정 메서드 목록. (유니티 모듈 대응)
	//==============================================================================
	/** @param { number } emissionRate 초당 방출 수. */
	setEmissionRate(emissionRate) {
		this.#emissionRate = emissionRate;
	}

	/** @param { object[] } burstList [{ time, count }] */
	setBurstList(burstList) {
		this.#burstList = burstList.map((burst) => {
			return { time: burst.time, count: burst.count, fired: false };
		});
	}

	/** @param { string } emitterShape EmitterShape 값. */
	setEmitterShape(emitterShape) {
		this.#emitterShape = emitterShape;
	}

	/** @param { number } shapeRadius circle / cone 반지름. */
	setShapeRadius(shapeRadius) {
		this.#shapeRadius = shapeRadius;
	}

	/** @param { number } coneAngleRadian cone 반각. (라디안) */
	setConeAngle(coneAngleRadian) {
		this.#coneAngleRadian = coneAngleRadian;
	}

	/** @param { number } width @param { number } height box 크기. */
	setBoxSize(width, height) {
		this.#boxSize = Vector2.create(width, height);
	}

	/** @param { number } edgeWidth edge 가로 길이. */
	setEdgeWidth(edgeWidth) {
		this.#edgeWidth = edgeWidth;
	}

	/** @param { number } minSeconds @param { number } maxSeconds */
	setStartLifetime(minSeconds, maxSeconds = minSeconds) {
		this.#startLifetimeMin = minSeconds;
		this.#startLifetimeMax = maxSeconds;
	}

	/** @param { number } minSpeed @param { number } maxSpeed */
	setStartSpeed(minSpeed, maxSpeed = minSpeed) {
		this.#startSpeedMin = minSpeed;
		this.#startSpeedMax = maxSpeed;
	}

	/** @param { number } minSize @param { number } maxSize */
	setStartSize(minSize, maxSize = minSize) {
		this.#startSizeMin = minSize;
		this.#startSizeMax = maxSize;
	}

	/** @param { number } minRadian @param { number } maxRadian */
	setStartRotation(minRadian, maxRadian = minRadian) {
		this.#startRotationMin = minRadian;
		this.#startRotationMax = maxRadian;
	}

	/** @param { Color } colorA @param { Color } colorB 둘 사이 무작위. */
	setStartColor(colorA, colorB = colorA) {
		this.#startColorA = colorA.clone();
		this.#startColorB = colorB.clone();
	}

	/** @param { object[] } gradient [{ time: 0~1, color }] */
	setColorOverLifetime(gradient) {
		this.#colorOverLifetime = gradient.map((key) => {
			return { time: key.time, color: key.color.clone() };
		});
	}

	/** @param { number } startScale @param { number } endScale */
	setSizeOverLifetime(startScale, endScale) {
		this.#sizeOverLifetimeStart = startScale;
		this.#sizeOverLifetimeEnd = endScale;
	}

	/** @param { number } minRadianPerSecond @param { number } maxRadianPerSecond */
	setAngularVelocity(minRadianPerSecond, maxRadianPerSecond = minRadianPerSecond) {
		this.#angularVelocityMin = minRadianPerSecond;
		this.#angularVelocityMax = maxRadianPerSecond;
	}

	/** @param { number } gravityX @param { number } gravityY */
	setGravity(gravityX, gravityY) {
		this.#gravity = Vector2.create(gravityX, gravityY);
	}

	/** @param { number } damping 초당 감쇠 계수. (0 = 없음) */
	setDamping(damping) {
		this.#damping = damping;
	}

	/** @param { string } renderShape "circle" | "rect" | "image" */
	setRenderShape(renderShape) {
		this.#renderShape = renderShape;
	}

	/** @param { * } image 엔진 이미지. (renderShape "image" 전용) */
	setImage(image) {
		this.#image = image;
	}

	/** @param { boolean } isAdditive 가산 합성 여부. */
	setAdditive(isAdditive) {
		this.#isAdditive = isAdditive;
	}

	/** @param { boolean } isWorldSpace 참이면 방출 뒤 노드 이동의 영향을 받지 않는다. */
	setWorldSpace(isWorldSpace) {
		this.#isWorldSpace = isWorldSpace;
	}

	/** @param { boolean } isLooping */
	setLooping(isLooping) {
		this.#isLooping = isLooping;
	}

	/** @param { number } duration 루프 꺼짐일 때 방출 시간. (버스트 반복 주기) */
	setDuration(duration) {
		this.#duration = duration;
	}

	/** @param { number } maxParticleCount */
	setMaxParticleCount(maxParticleCount) {
		this.#maxParticleCount = maxParticleCount;
	}

	//==============================================================================
	// 조회 메서드 목록.
	//==============================================================================
	/** @returns { number } */
	getParticleCount() {
		return this.#particleList.length;
	}

	/** @returns { boolean } */
	isPlaying() {
		return this.#isPlaying;
	}
}
