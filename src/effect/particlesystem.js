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
import { SeededRandom } from "../base/seededrandom.js";


//==============================================================================
// 방출 모양.
// - point: 노드 원점 한 점.
// - circle: 반지름 안 무작위 위치, 바깥 방향.
// - cone: 위쪽(-y) 기준 각도 부채꼴 방향, 반지름 안 위치.
// - box: 사각 영역 안 무작위 위치, 위쪽 방향.
// - edge: 가로 선분 위 무작위 위치, 위쪽 방향. (눈 / 비처럼 위에서 뿌릴 때)
//==============================================================================
export const ParticleEmitterShape = {
	point: "point", // 노드 원점 한 점에서 무작위 방향.
	circle: "circle", // 반지름 안 무작위 위치에서 중심 바깥 방향.
	cone: "cone", // 반지름 안 위치에서 위쪽(-y) 기준 반각 안 부채꼴 방향.
	box: "box", // 사각 영역 안 무작위 위치에서 위쪽(-y) 방향.
	edge: "edge", // 가로 선분 위 무작위 위치에서 아래쪽(+y) 방향.
};


//==============================================================================
// 파티클 렌더 모양.
// - circle: 부드러운 원. (기본)
// - rect: 사각형. (색종이 조각처럼 회전하는 판)
// - streak: 진행 방향으로 늘인 띠. (비 / 유성)
// - image: setImage 로 넣은 이미지.
//==============================================================================
export const ParticleRenderShape = {
	circle: "circle", // 부드러운 원. (기본)
	rect: "rect", // 사각형. (회전하는 판)
	streak: "streak", // 진행 방향으로 늘인 띠.
	image: "image", // setImage 로 넣은 이미지.
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
/**
 * @example <caption>노드에 붙여 불꽃 뿜기</caption>
 * import { Engine, EngineConfiguration, Scene, WorldNode, ParticleSystem, ParticleEmitterShape, Color, Vector2 } from "./build/vanilla.js";
 *
 * class MainScene extends Scene {
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		const node = new WorldNode();
 * 		node.setLocalPosition(Vector2.create(320, 300));
 * 		const root = this.getRoot();
 * 		root.addChild(node);
 * 		const particleSystem = node.addComponent(ParticleSystem);
 * 		particleSystem.setEmitterShape(ParticleEmitterShape.cone);
 * 		particleSystem.setShapeRadius(10);
 * 		particleSystem.setConeAngle(0.3);
 * 		particleSystem.setEmissionRate(60);
 * 		particleSystem.setStartLifetime(0.6, 1.2);
 * 		particleSystem.setStartSpeed(40, 120);
 * 		particleSystem.setStartSize(10, 18);
 * 		particleSystem.setSizeOverLifetime(1, 0.2);
 * 		particleSystem.setColorOverLifetime([
 * 			{ time: 0, color: new Color(1, 0.8, 0.3, 1) },
 * 			{ time: 1, color: new Color(1, 0.2, 0, 0) },
 * 		]);
 * 		particleSystem.setAdditive(true);
 * 		particleSystem.play();
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class ParticleSystem extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object[] } */ #particleList;
	/** @private @type { object[] } */ #freeList;
	/** @private @type { number[] } */ #colorChannelBuffer; // 색 계산 재사용 버퍼.
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

	// 힘.
	/** @private @type { Vector2 | null } */ #attractorPosition; // 끌림 중심. (로컬 좌표, null 이면 안 씀)
	/** @private @type { number } */ #attractorStrength; // 중심 방향 가속. (음수면 밀어냄)
	/** @private @type { number } */ #attractorSwirl; // 중심 접선 방향 가속. (소용돌이)
	/** @private @type { number } */ #wobbleAmplitude; // 좌우 살랑임 폭. (그리기 오프셋)
	/** @private @type { number } */ #wobbleFrequency; // 살랑임 초당 각속도.

	// 렌더.
	/** @private @type { string } */ #renderShape; // ParticleRenderShape 값.
	/** @private @type { * } */ #image;
	/** @private @type { string } */ #blendMode; // Graphic.setBlendMode 가 받는 이름. ("source-over" | "lighter" | "multiply" | "screen" 등 SpriteBlendMode 26 가지)
	/** @private @type { number } */ #streakScale; // streak 길이 = 속도 x 이 값.
	/** @private @type { boolean } */ #isWorldSpace; // 참이면 방출 후 노드 이동의 영향을 받지 않는다.
	/** @private @type { boolean } */ #isManualTick; // 참이면 노드 갱신에서 진행하지 않고 simulate() 로만 진행한다. (타임라인 등 외부 시간)
	/** @private @type { SeededRandom | null } */ #random; // 시드가 있으면 이 난수로 스폰한다. (stop(true) 로 비우면 시드로 되돌아가 같은 결과가 나온다, 타임라인 스크럽)
	/** @private @type { number | null } */ #randomSeed;

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
		this.#colorChannelBuffer = [1, 1, 1, 1];
		this.#isPlaying = true;
		this.#isLooping = true;
		this.#isManualTick = false;
		this.#random = null;
		this.#randomSeed = null;
		this.#duration = 1;
		this.#playElapsedSeconds = 0;
		this.#maxParticleCount = 512;

		this.#emissionRate = 20;
		this.#emissionAccumulator = 0;
		this.#burstList = [];
		this.#emitterShape = ParticleEmitterShape.point;
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

		this.#attractorPosition = null;
		this.#attractorStrength = 0;
		this.#attractorSwirl = 0;
		this.#wobbleAmplitude = 0;
		this.#wobbleFrequency = 4;
		this.#renderShape = ParticleRenderShape.circle;
		this.#image = null;
		this.#blendMode = "source-over";
		this.#streakScale = 0.06;
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

	//==============================================================================
	// 정지. (방출을 멈춘다, 살아 있는 파티클은 isClearing 이 아니면 수명까지 움직인다)
	//==============================================================================
	/**
	 * @param { boolean } isClearing 참이면 살아 있는 파티클도 지운다.
	 */
	stop(isClearing = false) {
		this.#isPlaying = false;
		if (isClearing) {
			this.#particleList.length = 0;
			this.#emissionAccumulator = 0;
			if (this.#random) {
				this.#random.setSeed(this.#randomSeed);
			}
		}
	}

	//==============================================================================
	// 한 번에 여러 개 방출. (버튼 클릭 등 이벤트성 연출)
	//==============================================================================
	/**
	 * @param { number } count 방출할 수. (최대 수에 닿으면 더 만들지 않는다)
	 * @param { Vector2 | null } worldOffset 방출 원점 보정. (노드 로컬 기준)
	 */
	emit(count, worldOffset = null) {
		for (let emitIndex = 0; emitIndex < count; ++emitIndex) {
			this.spawnParticle(worldOffset);
		}
	}

	//==============================================================================
	// 갱신. (노드 갱신, 수동 틱이면 건너뛴다)
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta 지난 시간. (초)
	 */
	tick(timeDelta) {
		if (this.#isManualTick) {
			return;
		}
		this.simulate(timeDelta);
	}

	//==============================================================================
	// 시간 진행. (방출 + 적분, 수동 틱 모드에서는 외부가 부른다)
	//==============================================================================
	/**
	 * @param { number } timeDelta 진행할 시간. (초)
	 */
	simulate(timeDelta) {
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
		// 수명이 다한 것은 splice 로 하나씩 빼지 않고(뒤를 매번 당긴다), 살아 있는 것을 앞으로 당겨 담은 뒤 길이를 줄인다. (차례는 그대로)
		const particleList = this.#particleList;
		let aliveCount = 0;
		for (let particleIndex = 0; particleIndex < particleList.length; ++particleIndex) {
			const particle = particleList[particleIndex];
			particle.age += timeDelta;
			if (particle.age >= particle.lifetime) {
				this.#freeList.push(particle);
				continue;
			}
			particleList[aliveCount] = particle;
			aliveCount += 1;
			particle.velocityX += this.#gravity.x * timeDelta;
			particle.velocityY += this.#gravity.y * timeDelta;
			if (this.#attractorPosition) {
				const toCenterX = this.#attractorPosition.x - particle.x;
				const toCenterY = this.#attractorPosition.y - particle.y;
				const centerDistance = System.Math.max(System.Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY), 4);
				const directionX = toCenterX / centerDistance;
				const directionY = toCenterY / centerDistance;
				particle.velocityX += directionX * this.#attractorStrength * timeDelta;
				particle.velocityY += directionY * this.#attractorStrength * timeDelta;
				particle.velocityX += -directionY * this.#attractorSwirl * timeDelta;
				particle.velocityY += directionX * this.#attractorSwirl * timeDelta;
			}
			if (this.#damping > 0) {
				const dampingBlend = System.Math.max(0, 1 - this.#damping * timeDelta);
				particle.velocityX *= dampingBlend;
				particle.velocityY *= dampingBlend;
			}
			particle.x += particle.velocityX * timeDelta;
			particle.y += particle.velocityY * timeDelta;
			particle.rotation += particle.angularVelocity * timeDelta;
		}
		particleList.length = aliveCount;
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
		if (shape === ParticleEmitterShape.circle) {
			const angle = this.randomRange(0, System.Math.PI * 2);
			const radius = this.#shapeRadius * System.Math.sqrt(this.randomRange(0, 1));
			spawnX = System.Math.cos(angle) * radius;
			spawnY = System.Math.sin(angle) * radius;
			directionX = System.Math.cos(angle);
			directionY = System.Math.sin(angle);
		}
		else if (shape === ParticleEmitterShape.cone) {
			const angle = -System.Math.PI * 0.5 + this.randomRange(-this.#coneAngleRadian, this.#coneAngleRadian);
			const radius = this.randomRange(0, this.#shapeRadius);
			spawnX = System.Math.cos(angle) * radius;
			spawnY = System.Math.sin(angle) * radius;
			directionX = System.Math.cos(angle);
			directionY = System.Math.sin(angle);
		}
		else if (shape === ParticleEmitterShape.box) {
			spawnX = this.randomRange(-this.#boxSize.x * 0.5, this.#boxSize.x * 0.5);
			spawnY = this.randomRange(-this.#boxSize.y * 0.5, this.#boxSize.y * 0.5);
		}
		else if (shape === ParticleEmitterShape.edge) {
			spawnX = this.randomRange(-this.#edgeWidth * 0.5, this.#edgeWidth * 0.5);
			directionY = 1;
		}
		else {
			const angle = this.randomRange(0, System.Math.PI * 2);
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

		const speed = this.randomRange(this.#startSpeedMin, this.#startSpeedMax);
		const colorBlend = this.randomRange(0, 1);
		const particle = this.#freeList.pop() || {};
		particle.x = spawnX;
		particle.y = spawnY;
		particle.velocityX = directionX * speed;
		particle.velocityY = directionY * speed;
		particle.age = 0;
		particle.lifetime = this.randomRange(this.#startLifetimeMin, this.#startLifetimeMax);
		particle.size = this.randomRange(this.#startSizeMin, this.#startSizeMax);
		particle.rotation = this.randomRange(this.#startRotationMin, this.#startRotationMax);
		particle.angularVelocity = this.randomRange(this.#angularVelocityMin, this.#angularVelocityMax);
		particle.wobblePhase = this.randomRange(0, System.Math.PI * 2);
		particle.red = this.#startColorA.red + (this.#startColorB.red - this.#startColorA.red) * colorBlend;
		particle.green = this.#startColorA.green + (this.#startColorB.green - this.#startColorA.green) * colorBlend;
		particle.blue = this.#startColorA.blue + (this.#startColorB.blue - this.#startColorA.blue) * colorBlend;
		particle.alpha = this.#startColorA.alpha + (this.#startColorB.alpha - this.#startColorA.alpha) * colorBlend;
		this.#particleList.push(particle);
	}

	//==============================================================================
	// 수명 비율에 따른 색 계산. (재사용 버퍼에 r, g, b, a 를 채운다)
	//==============================================================================
	/**
	 * @private
	 * @param { object } particle
	 * @param { number } lifeRatio
	 * @param { number[] } outChannels 길이 4 배열.
	 */
	evaluateColorChannels(particle, lifeRatio, outChannels) {
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
		outChannels[0] = red;
		outChannels[1] = green;
		outChannels[2] = blue;
		outChannels[3] = System.Math.max(0, System.Math.min(1, alpha));
	}

	//==============================================================================
	// 출력. (정점 색 배치, 파티클 수와 무관하게 시스템당 드로우 한 번)
	// - circle 은 부드러운 원 텍스처, rect / streak 은 흰 텍스처 쿼드로 그린다.
	//   image 는 파티클 수가 적다는 가정으로 개별 드로우를 유지한다.
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic 그릴 그래픽.
	 */
	draw(graphic) {
		const particleCount = this.#particleList.length;
		if (particleCount === 0) {
			return;
		}
		if (this.#blendMode !== "source-over") {
			graphic.setBlendMode(this.#blendMode);
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

		if (this.#renderShape === ParticleRenderShape.image && this.#image) {
			this.drawImageParticles(graphic, baseOffsetX, baseOffsetY);
		}
		else {
			this.drawBatchedParticles(graphic, baseOffsetX, baseOffsetY);
		}

		if (this.#blendMode !== "source-over") {
			graphic.setBlendMode("source-over");
		}
	}

	//==============================================================================
	// 배치 출력 본체. (circle / rect / streak)
	//==============================================================================
	/**
	 * @private
	 * @param { Graphic } graphic
	 * @param { number } baseOffsetX
	 * @param { number } baseOffsetY
	 */
	drawBatchedParticles(graphic, baseOffsetX, baseOffsetY) {
		const particleCount = this.#particleList.length;
		const vertexData = graphic.getParticleVertexData(particleCount * 48);
		const colorChannels = this.#colorChannelBuffer;
		const isStreak = this.#renderShape === ParticleRenderShape.streak;
		const isRect = this.#renderShape === ParticleRenderShape.rect;
		let floatOffset = 0;

		const writeVertex = (x, y, u, v) => {
			vertexData[floatOffset++] = x;
			vertexData[floatOffset++] = y;
			vertexData[floatOffset++] = u;
			vertexData[floatOffset++] = v;
			vertexData[floatOffset++] = colorChannels[0];
			vertexData[floatOffset++] = colorChannels[1];
			vertexData[floatOffset++] = colorChannels[2];
			vertexData[floatOffset++] = colorChannels[3];
		};

		for (const particle of this.#particleList) {
			const lifeRatio = particle.age / particle.lifetime;
			const sizeScale = this.#sizeOverLifetimeStart + (this.#sizeOverLifetimeEnd - this.#sizeOverLifetimeStart) * lifeRatio;
			const drawSize = System.Math.max(0.1, particle.size * sizeScale);
			this.evaluateColorChannels(particle, lifeRatio, colorChannels);
			let drawX = particle.x + baseOffsetX;
			const drawY = particle.y + baseOffsetY;
			if (this.#wobbleAmplitude > 0) {
				drawX += System.Math.sin(particle.age * this.#wobbleFrequency + particle.wobblePhase) * this.#wobbleAmplitude;
			}

			if (isStreak) {

				// 속도 방향으로 길게 늘인 쿼드. (비 / 유성)
				const speed = System.Math.sqrt(particle.velocityX * particle.velocityX + particle.velocityY * particle.velocityY);
				const safeSpeed = System.Math.max(speed, 0.001);
				const directionX = particle.velocityX / safeSpeed;
				const directionY = particle.velocityY / safeSpeed;
				const tailX = drawX - particle.velocityX * this.#streakScale;
				const tailY = drawY - particle.velocityY * this.#streakScale;
				const halfWidth = drawSize * 0.5;
				const sideX = -directionY * halfWidth;
				const sideY = directionX * halfWidth;
				writeVertex(drawX + sideX, drawY + sideY, 0, 0);
				writeVertex(drawX - sideX, drawY - sideY, 1, 0);
				writeVertex(tailX - sideX, tailY - sideY, 1, 1);
				writeVertex(drawX + sideX, drawY + sideY, 0, 0);
				writeVertex(tailX - sideX, tailY - sideY, 1, 1);
				writeVertex(tailX + sideX, tailY + sideY, 0, 1);
			}
			else if (isRect && particle.rotation !== 0) {

				// 회전 사각형.
				const halfSize = drawSize * 0.5;
				const cosValue = System.Math.cos(particle.rotation);
				const sinValue = System.Math.sin(particle.rotation);
				const axisX1 = cosValue * halfSize;
				const axisY1 = sinValue * halfSize;
				const axisX2 = -sinValue * halfSize;
				const axisY2 = cosValue * halfSize;
				writeVertex(drawX - axisX1 - axisX2, drawY - axisY1 - axisY2, 0, 0);
				writeVertex(drawX + axisX1 - axisX2, drawY + axisY1 - axisY2, 1, 0);
				writeVertex(drawX + axisX1 + axisX2, drawY + axisY1 + axisY2, 1, 1);
				writeVertex(drawX - axisX1 - axisX2, drawY - axisY1 - axisY2, 0, 0);
				writeVertex(drawX + axisX1 + axisX2, drawY + axisY1 + axisY2, 1, 1);
				writeVertex(drawX - axisX1 + axisX2, drawY - axisY1 + axisY2, 0, 1);
			}
			else {

				// 축 정렬 쿼드. (circle 은 부드러운 원 텍스처가 모양을 만든다)
				const halfSize = drawSize * 0.5;
				writeVertex(drawX - halfSize, drawY - halfSize, 0, 0);
				writeVertex(drawX + halfSize, drawY - halfSize, 1, 0);
				writeVertex(drawX + halfSize, drawY + halfSize, 1, 1);
				writeVertex(drawX - halfSize, drawY - halfSize, 0, 0);
				writeVertex(drawX + halfSize, drawY + halfSize, 1, 1);
				writeVertex(drawX - halfSize, drawY + halfSize, 0, 1);
			}
		}

		const texture = (this.#renderShape === ParticleRenderShape.circle) ? graphic.getSoftDiscTexture() : graphic.getWhiteTexture();
		graphic.drawColoredQuads(floatOffset / 8, texture);
	}

	//==============================================================================
	// 이미지 파티클 출력. (개별 드로우, 파티클 수가 적은 연출용)
	//==============================================================================
	/**
	 * @private
	 * @param { Graphic } graphic
	 * @param { number } baseOffsetX
	 * @param { number } baseOffsetY
	 */
	drawImageParticles(graphic, baseOffsetX, baseOffsetY) {
		for (const particle of this.#particleList) {
			const lifeRatio = particle.age / particle.lifetime;
			const sizeScale = this.#sizeOverLifetimeStart + (this.#sizeOverLifetimeEnd - this.#sizeOverLifetimeStart) * lifeRatio;
			const drawSize = System.Math.max(0.1, particle.size * sizeScale);
			let drawX = particle.x + baseOffsetX;
			const drawY = particle.y + baseOffsetY;
			if (this.#wobbleAmplitude > 0) {
				drawX += System.Math.sin(particle.age * this.#wobbleFrequency + particle.wobblePhase) * this.#wobbleAmplitude;
			}
			graphic.pushState();
			graphic.translate(drawX, drawY);
			graphic.rotate(particle.rotation);
			graphic.multiplyGlobalAlpha(System.Math.max(0, System.Math.min(1, particle.alpha * (1 - lifeRatio))));
			// drawImage 와 같은 그리기를 벡터를 만들지 않고 한다.
			const image = this.#image;
			graphic.drawImageWithSourceAndDestination(image, 0, 0, image.width, image.height, -drawSize * 0.5, -drawSize * 0.5, drawSize, drawSize);
			graphic.popState();
		}
	}

	//==============================================================================
	// 설정 메서드 목록. (유니티 모듈 대응)
	//==============================================================================

	//==============================================================================
	// 초당 방출 수 설정. (기본 20)
	//==============================================================================
	/**
	 * @param { number } emissionRate 초당 방출 수.
	 */
	setEmissionRate(emissionRate) {
		this.#emissionRate = emissionRate;
	}

	//==============================================================================
	// 버스트 목록 설정. (정한 때에 한꺼번에 방출한다, 루프면 duration 마다 되풀이)
	//==============================================================================
	/**
	 * @param { object[] } burstList [{ time, count }]
	 * @example <caption>한 번 터지고 끝나는 폭죽</caption>
	 * import { Engine, EngineConfiguration, Scene, WorldNode, ParticleSystem, ParticleEmitterShape, Vector2 } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	initialize(engine) {
	 * 		super.initialize(engine);
	 * 		const node = new WorldNode();
	 * 		node.setLocalPosition(Vector2.create(320, 180));
	 * 		const root = this.getRoot();
	 * 		root.addChild(node);
	 * 		const particleSystem = node.addComponent(ParticleSystem);
	 * 		particleSystem.setLooping(false);
	 * 		particleSystem.setDuration(0.5);
	 * 		particleSystem.setEmissionRate(0);
	 * 		particleSystem.setBurstList([
	 * 			{ time: 0, count: 40 },
	 * 			{ time: 0.3, count: 20 },
	 * 		]);
	 * 		particleSystem.setEmitterShape(ParticleEmitterShape.circle);
	 * 		particleSystem.setShapeRadius(4);
	 * 		particleSystem.setStartSpeed(80, 200);
	 * 		particleSystem.setGravity(0, 300);
	 * 		particleSystem.play();
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	setBurstList(burstList) {
		this.#burstList = burstList.map((burst) => {
			return { time: burst.time, count: burst.count, fired: false };
		});
	}

	//==============================================================================
	// 방출 모양 설정. (기본 point)
	//==============================================================================
	/**
	 * @param { string } emitterShape ParticleEmitterShape 값.
	 */
	setEmitterShape(emitterShape) {
		this.#emitterShape = emitterShape;
	}

	//==============================================================================
	// 방출 반지름 설정. (픽셀, 기본 0)
	//==============================================================================
	/**
	 * @param { number } shapeRadius circle / cone 반지름.
	 */
	setShapeRadius(shapeRadius) {
		this.#shapeRadius = shapeRadius;
	}

	//==============================================================================
	// cone 반각 설정. (기본 0.5 라디안)
	//==============================================================================
	/**
	 * @param { number } coneAngleRadian cone 반각. (라디안)
	 */
	setConeAngle(coneAngleRadian) {
		this.#coneAngleRadian = coneAngleRadian;
	}

	//==============================================================================
	// box 크기 설정. (픽셀, 기본 0, 0)
	//==============================================================================
	/**
	 * @param { number } width box 가로.
	 * @param { number } height box 크기.
	 */
	setBoxSize(width, height) {
		this.#boxSize = Vector2.create(width, height);
	}

	//==============================================================================
	// edge 길이 설정. (픽셀, 기본 0)
	//==============================================================================
	/**
	 * @param { number } edgeWidth edge 가로 길이.
	 */
	setEdgeWidth(edgeWidth) {
		this.#edgeWidth = edgeWidth;
	}

	//==============================================================================
	// 시작 수명 범위 설정. (기본 1 초)
	//==============================================================================
	/**
	 * @param { number } minSeconds 수명 최솟값. (초)
	 * @param { number } maxSeconds 수명 최댓값. (초, 주지 않으면 최솟값)
	 */
	setStartLifetime(minSeconds, maxSeconds = minSeconds) {
		this.#startLifetimeMin = minSeconds;
		this.#startLifetimeMax = maxSeconds;
	}

	//==============================================================================
	// 시작 속력 범위 설정. (기본 60)
	//==============================================================================
	/**
	 * @param { number } minSpeed 속력 최솟값. (초당 픽셀)
	 * @param { number } maxSpeed 속력 최댓값. (초당 픽셀, 주지 않으면 최솟값)
	 */
	setStartSpeed(minSpeed, maxSpeed = minSpeed) {
		this.#startSpeedMin = minSpeed;
		this.#startSpeedMax = maxSpeed;
	}

	//==============================================================================
	// 시작 크기 범위 설정. (기본 6)
	//==============================================================================
	/**
	 * @param { number } minSize 크기 최솟값. (픽셀)
	 * @param { number } maxSize 크기 최댓값. (픽셀, 주지 않으면 최솟값)
	 */
	setStartSize(minSize, maxSize = minSize) {
		this.#startSizeMin = minSize;
		this.#startSizeMax = maxSize;
	}

	//==============================================================================
	// 시작 회전 범위 설정. (기본 0)
	//==============================================================================
	/**
	 * @param { number } minRadian 회전 최솟값. (라디안)
	 * @param { number } maxRadian 회전 최댓값. (라디안, 주지 않으면 최솟값)
	 */
	setStartRotation(minRadian, maxRadian = minRadian) {
		this.#startRotationMin = minRadian;
		this.#startRotationMax = maxRadian;
	}

	//==============================================================================
	// 시작 색 범위 설정. (기본 흰색)
	//==============================================================================
	/**
	 * @param { Color } colorA 시작 색. (복사해 둔다)
	 * @param { Color } colorB 둘 사이 무작위.
	 */
	setStartColor(colorA, colorB = colorA) {
		this.#startColorA = colorA.clone();
		this.#startColorB = colorB.clone();
	}

	//==============================================================================
	// 수명에 따른 색 설정. (시작 색에 곱한다, 키 사이는 선형 보간)
	//==============================================================================
	/**
	 * @param { object[] } gradient [{ time: 0~1, color }]
	 */
	setColorOverLifetime(gradient) {
		this.#colorOverLifetime = gradient.map((key) => {
			return { time: key.time, color: key.color.clone() };
		});
	}

	//==============================================================================
	// 수명에 따른 크기 배율 설정. (시작에서 끝으로 선형, 기본 1, 1)
	//==============================================================================
	/**
	 * @param { number } startScale 태어날 때의 크기 배율.
	 * @param { number } endScale 수명이 다할 때의 크기 배율.
	 */
	setSizeOverLifetime(startScale, endScale) {
		this.#sizeOverLifetimeStart = startScale;
		this.#sizeOverLifetimeEnd = endScale;
	}

	//==============================================================================
	// 회전 속도 범위 설정. (기본 0)
	//==============================================================================
	/**
	 * @param { number } minRadianPerSecond 회전 속도 최솟값. (초당 라디안)
	 * @param { number } maxRadianPerSecond 회전 속도 최댓값. (초당 라디안, 주지 않으면 최솟값)
	 */
	setAngularVelocity(minRadianPerSecond, maxRadianPerSecond = minRadianPerSecond) {
		this.#angularVelocityMin = minRadianPerSecond;
		this.#angularVelocityMax = maxRadianPerSecond;
	}

	//==============================================================================
	// 중력 설정. (기본 0, 0)
	//==============================================================================
	/**
	 * @param { number } gravityX 가로 가속. (매초 속도에 더하는 초당 픽셀)
	 * @param { number } gravityY 세로 가속. (매초 속도에 더하는 초당 픽셀, 양수가 아래)
	 */
	setGravity(gravityX, gravityY) {
		this.#gravity = Vector2.create(gravityX, gravityY);
	}

	//==============================================================================
	// 감쇠 설정. (기본 0)
	//==============================================================================
	/**
	 * @param { number } damping 초당 감쇠 계수. (0 = 없음)
	 */
	setDamping(damping) {
		this.#damping = damping;
	}

	//==============================================================================
	// 렌더 모양 설정. (기본 circle)
	//==============================================================================
	/**
	 * @param { string } renderShape ParticleRenderShape 값.
	 */
	setRenderShape(renderShape) {
		this.#renderShape = renderShape;
	}

	//==============================================================================
	// 파티클 이미지 설정.
	//==============================================================================
	/**
	 * @param { * } image 엔진 이미지. (renderShape image 전용)
	 */
	setImage(image) {
		this.#image = image;
	}

	//==============================================================================
	// 가산 합성 설정.
	//==============================================================================
	/**
	 * @param { boolean } isAdditive 가산 합성 여부. (setBlendMode("lighter") 의 설탕)
	 */
	setAdditive(isAdditive) {
		this.#blendMode = isAdditive ? "lighter" : "source-over";
	}

	//==============================================================================
	// 블렌드 모드 설정. (기본 "source-over")
	//==============================================================================
	/**
	 * @param { string } blendMode Graphic.setBlendMode 가 받는 이름. ("source-over" | "lighter" | "multiply" | "screen" 등 SpriteBlendMode 26 가지, 셰이더 섞기 모드는 서로 겹치지 않는 파티클끼리 모아 그린다)
	 */
	setBlendMode(blendMode) {
		this.#blendMode = blendMode;
	}

	//==============================================================================
	// 끌개 설정. (중심으로 끌거나 밀고, 접선으로 돌린다)
	//==============================================================================
	/**
	 * @param { number } x 끌림 중심 x. (노드 로컬 픽셀)
	 * @param { number } y 끌림 중심 y. (노드 로컬 픽셀)
	 * @param { number } strength 중심 가속.
	 * @param { number } swirl 접선 가속.
	 */
	setAttractor(x, y, strength, swirl = 0) {
		this.#attractorPosition = Vector2.create(x, y);
		this.#attractorStrength = strength;
		this.#attractorSwirl = swirl;
	}

	/** 어트랙터 해제. */
	clearAttractor() {
		this.#attractorPosition = null;
	}

	//==============================================================================
	// 살랑임 설정. (그릴 때만 좌우로 흔들고 움직임에는 넣지 않는다)
	//==============================================================================
	/**
	 * @param { number } amplitude 살랑임 폭.
	 * @param { number } frequency 초당 각속도.
	 */
	setWobble(amplitude, frequency = 4) {
		this.#wobbleAmplitude = amplitude;
		this.#wobbleFrequency = frequency;
	}

	//==============================================================================
	// streak 길이 배율 설정. (기본 0.06)
	//==============================================================================
	/**
	 * @param { number } streakScale streak 길이 = 속도 x 이 값.
	 */
	setStreakScale(streakScale) {
		this.#streakScale = streakScale;
	}

	//==============================================================================
	// 월드 공간 설정. (기본 거짓)
	//==============================================================================
	/**
	 * @param { boolean } isWorldSpace 참이면 방출 뒤 노드 이동의 영향을 받지 않는다.
	 */
	setWorldSpace(isWorldSpace) {
		this.#isWorldSpace = isWorldSpace;
	}

	//==============================================================================
	// 반복 방출 설정.
	//==============================================================================
	/**
	 * @param { boolean } isLooping 참이면 계속 방출한다. (기본 참, 거짓이면 duration 동안만)
	 */
	setLooping(isLooping) {
		this.#isLooping = isLooping;
	}

	//==============================================================================
	// 방출 시간 설정. (초, 기본 1)
	//==============================================================================
	/**
	 * @param { number } duration 루프 꺼짐일 때 방출 시간. (버스트 반복 주기)
	 */
	setDuration(duration) {
		this.#duration = duration;
	}

	//==============================================================================
	// 최대 파티클 수 설정.
	//==============================================================================
	/**
	 * @param { number } maxParticleCount 살아 있을 수 있는 최대 수. (기본 512)
	 */
	setMaxParticleCount(maxParticleCount) {
		this.#maxParticleCount = maxParticleCount;
	}

	//==============================================================================
	// 서술(JSON) 적용., vfx 애셋 로드 / 파티클 편집기 공용.
	// - 모든 항목은 선택 사항이며 준 것만 반영한다. 색은 [r, g, b, a] 배열.
	//==============================================================================
	/**
	 * @param { object } description 서술 객체. (looping, duration, maxParticleCount, emissionRate, bursts, shape, shapeRadius, coneAngle, boxSize, edgeWidth, lifetime, speed, size, rotation, angularVelocity, startColorA, startColorB, colorOverLifetime, sizeOverLifetime, gravity, damping, attractor, wobble, renderShape, blendMode, streakScale, worldSpace)
	 * @example <caption>JSON 서술로 설정하기</caption>
	 * import { ParticleSystem } from "./build/vanilla.js";
	 *
	 * const particleSystem = new ParticleSystem();
	 * particleSystem.applyDescription({
	 * 	looping: false,
	 * 	duration: 0.2,
	 * 	emissionRate: 50,
	 * 	shape: "box",
	 * 	boxSize: [200, 10],
	 * 	lifetime: [0.5, 1],
	 * 	speed: [20, 40],
	 * 	startColorA: [0.6, 0.8, 1, 1],
	 * 	colorOverLifetime: [
	 * 		{ time: 0, color: [1, 1, 1, 1] },
	 * 		{ time: 1, color: [1, 1, 1, 0] },
	 * 	],
	 * 	gravity: [0, 98],
	 * 	renderShape: "streak",
	 * });
	 * particleSystem.simulate(0.1);
	 * console.log(particleSystem.getParticleCount());
	 */
	applyDescription(description) {
		const toColor = (channels) => new Color(channels[0], channels[1], channels[2], (channels[3] !== undefined) ? channels[3] : 1);
		if (description.looping !== undefined) {
			this.setLooping(description.looping);
		}
		if (description.duration !== undefined) {
			this.setDuration(description.duration);
		}
		if (description.maxParticleCount !== undefined) {
			this.setMaxParticleCount(description.maxParticleCount);
		}
		if (description.emissionRate !== undefined) {
			this.setEmissionRate(description.emissionRate);
		}
		if (description.bursts !== undefined) {
			this.setBurstList(description.bursts);
		}
		if (description.shape !== undefined) {
			this.setEmitterShape(description.shape);
		}
		if (description.shapeRadius !== undefined) {
			this.setShapeRadius(description.shapeRadius);
		}
		if (description.coneAngle !== undefined) {
			this.setConeAngle(description.coneAngle);
		}
		if (description.boxSize !== undefined) {
			this.setBoxSize(description.boxSize[0], description.boxSize[1]);
		}
		if (description.edgeWidth !== undefined) {
			this.setEdgeWidth(description.edgeWidth);
		}
		if (description.lifetime !== undefined) {
			this.setStartLifetime(description.lifetime[0], description.lifetime[1]);
		}
		if (description.speed !== undefined) {
			this.setStartSpeed(description.speed[0], description.speed[1]);
		}
		if (description.size !== undefined) {
			this.setStartSize(description.size[0], description.size[1]);
		}
		if (description.rotation !== undefined) {
			this.setStartRotation(description.rotation[0], description.rotation[1]);
		}
		if (description.angularVelocity !== undefined) {
			this.setAngularVelocity(description.angularVelocity[0], description.angularVelocity[1]);
		}
		if (description.startColorA !== undefined) {
			this.setStartColor(toColor(description.startColorA), toColor(description.startColorB !== undefined ? description.startColorB : description.startColorA));
		}
		if (description.colorOverLifetime !== undefined) {
			this.setColorOverLifetime(description.colorOverLifetime.map((key) => {
				return { time: key.time, color: toColor(key.color) };
			}));
		}
		if (description.sizeOverLifetime !== undefined) {
			this.setSizeOverLifetime(description.sizeOverLifetime[0], description.sizeOverLifetime[1]);
		}
		if (description.gravity !== undefined) {
			this.setGravity(description.gravity[0], description.gravity[1]);
		}
		if (description.damping !== undefined) {
			this.setDamping(description.damping);
		}
		if (description.attractor !== undefined) {
			if (description.attractor) {
				this.setAttractor(description.attractor.x, description.attractor.y, description.attractor.strength, description.attractor.swirl !== undefined ? description.attractor.swirl : 0);
			}
			else {
				this.clearAttractor();
			}
		}
		if (description.wobble !== undefined) {
			this.setWobble(description.wobble[0], description.wobble[1] !== undefined ? description.wobble[1] : 4);
		}
		if (description.renderShape !== undefined) {
			this.setRenderShape(description.renderShape);
		}
		if (description.blendMode !== undefined) {
			this.setBlendMode(description.blendMode);
		}
		if (description.streakScale !== undefined) {
			this.setStreakScale(description.streakScale);
		}
		if (description.worldSpace !== undefined) {
			this.setWorldSpace(description.worldSpace);
		}
	}

	//==============================================================================
	// 조회 메서드 목록.
	//==============================================================================

	//==============================================================================
	// 살아 있는 파티클 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 살아 있는 파티클 수.
	 */
	getParticleCount() {
		return this.#particleList.length;
	}

	//==============================================================================
	// 입자 자리 목록. (노드 로컬, 흔들림을 넣지 않은 적분 자리. 같은 씨앗 비교와 시험용)
	//==============================================================================
	/**
	 * @returns { Vector2[] } 파티클 자리 목록. (새로 만든 Vector2)
	 */
	getParticlePositionList() {
		return this.#particleList.map((particle) => Vector2.create(particle.x, particle.y));
	}

	//==============================================================================
	// 방출 중인지 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 방출 중이면 참. (생성 직후 참)
	 */
	isPlaying() {
		return this.#isPlaying;
	}

	//==============================================================================
	// 다 끝났는지. (방출할 것이 더 없고 남은 입자도 없음, 일회성 노드를 치울 때)
	// - 정지했거나, 루프가 아니고 duration 이 지났으며 버스트를 다 냈으면 방출할 것이 없다.
	//==============================================================================
	/**
	 * @returns { boolean } 다 끝났으면 참.
	 */
	isFinished() {
		if (this.#particleList.length > 0) {
			return false;
		}
		if (!this.#isPlaying) {
			return true;
		}
		return !this.#isLooping && this.#playElapsedSeconds > this.#duration && this.#burstList.every((burst) => burst.fired);
	}

	//==============================================================================
	// 수동 틱 설정. (참이면 노드 갱신 대신 simulate() 로만 진행, 타임라인이 시간을 다룬다)
	//==============================================================================
	/**
	 * @param { boolean } isManualTick 참이면 노드 갱신에서 진행하지 않는다. (기본 거짓)
	 */
	setManualTick(isManualTick) {
		this.#isManualTick = isManualTick;
	}

	//==============================================================================
	// 수동 틱인지 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 수동 틱이면 참.
	 */
	isManualTick() {
		return this.#isManualTick;
	}

	//==============================================================================
	// 난수 시드 설정. (설정하면 스폰 난수가 시드 난수로 바뀌고 stop(true) 마다 시드로 되돌아간다, 되감기 재현용)
	//==============================================================================
	/**
	 * @param { number } seed 난수 시드.
	 * @example <caption>시드로 같은 방출 되풀이하기</caption>
	 * import { ParticleSystem } from "./build/vanilla.js";
	 *
	 * const particleSystem = new ParticleSystem();
	 * particleSystem.setManualTick(true);
	 * particleSystem.setRandomSeed(7);
	 * particleSystem.setEmissionRate(30);
	 * particleSystem.simulate(0.5);
	 * const firstPositionList = particleSystem.getParticlePositionList();
	 * particleSystem.stop(true);
	 * particleSystem.play();
	 * particleSystem.simulate(0.5);
	 * const secondPositionList = particleSystem.getParticlePositionList();
	 * console.log(firstPositionList.length, secondPositionList[0].x === firstPositionList[0].x);
	 */
	setRandomSeed(seed) {
		this.#randomSeed = seed;
		this.#random = new SeededRandom(seed);
	}

	//==============================================================================
	// 난수 시드 반환.
	//==============================================================================
	/**
	 * @returns { number | null } 난수 시드. (설정하지 않았으면 null)
	 */
	getRandomSeed() {
		return this.#randomSeed;
	}

	//==============================================================================
	// 스폰용 난수. (시드가 있으면 시드 난수, 없으면 전역 난수)
	//==============================================================================
	/**
	 * @param { number } minValue 최솟값.
	 * @param { number } maxValue 최댓값.
	 * @returns { number } 최솟값과 최댓값 사이의 난수.
	 */
	randomRange(minValue, maxValue) {
		if (this.#random) {
			return this.#random.nextRange(minValue, maxValue);
		}
		return Math.randomRange(minValue, maxValue);
	}
}
