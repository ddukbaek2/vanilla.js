//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 처지는 기기 가리기. (처음 몇 초의 프레임 간격을 재어, 무거운 효과를 끄는 가벼운 길을 저절로 켤 때 쓴다)
// - 재기 시작하고 기다리는 초가 지난 뒤 재는 초 동안 매 프레임의 간격을 본다. (처음 몇 초는 모형과 그림을 받느라 끊긴다)
// - 목표 간격(최대 프레임의 한 칸, 무제한이면 60 프레임의 한 칸)의 처진 배를 넘긴 프레임이 처진 몫 이상이면 처지는 기기다.
//   - 한 칸이 아니라 1.4 배로 보는 까닭: 90 Hz 화면은 최대 60 에서 엔진이 한 장 걸러 그려 늘 22 ms 간격이고, 그것은 기기가 처지는 것이 아니다.
//   - 60 Hz 와 120 Hz 화면에서 한 장을 놓친 프레임(33 ms, 25 ms)은 처진 것으로 센다. 넷에 하나 꼴이면 48 fps 밑이다.
// - 처지는 기기로 정하면 다시 재지 않는다. 다 재기 전에 창이 가려지면 restart() 로 처음부터 다시 잰다.
//   처지지 않았으면 무거운 장면에서 measureAgain() 으로 한 번 더 잴 수 있다.
// - 엔진과 브라우저를 들여오지 않는다. 프레임 간격과 최대 프레임은 부르는 쪽이 넘긴다.
//==============================================================================
/**
 * @example <caption>프레임 간격을 넘겨 처지는 기기 가리기</caption>
 * import { FrameProbe } from "./build/vanilla.js";
 *
 * const frameProbe = new FrameProbe();
 * frameProbe.setSeconds(0.5, 1);
 * let isFinished = false;
 * for (let frame = 0; frame < 120 && !isFinished; ++frame) {
 * 	const frameSeconds = frame % 3 === 0 ? 1 / 30 : 1 / 60;
 * 	isFinished = frameProbe.measureFrame(frameSeconds, 60);
 * }
 * console.log(frameProbe.isFinished(), frameProbe.isSlow(), frameProbe.readSlowFrameShare());
 */
export class FrameProbe {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #warmupSeconds; // 재기 전에 기다리는 초. (프레임 간격의 합)
	/** @private @type { number } */ #probeSeconds; // 재는 초.
	/** @private @type { number } */ #slowFrameRatio; // 처진 프레임으로 셀 간격. (목표 간격의 배)
	/** @private @type { number } */ #slowFrameShare; // 처지는 기기로 볼 처진 프레임의 몫.
	/** @private @type { number } */ #unlimitedTargetFramePerSecond; // 최대 프레임이 무제한일 때의 목표.
	/** @private @type { number } */ #elapsedSeconds; // 재기 시작(또는 다시 시작)부터 흐른 초.
	/** @private @type { number } */ #frameCount; // 잰 프레임 수.
	/** @private @type { number } */ #slowFrameCount; // 그 가운데 처진 프레임 수.
	/** @private @type { boolean } */ #isFinished; // 다 쟀는지.
	/** @private @type { boolean } */ #isSlow; // 처지는 기기인지. (다 잰 뒤에만 뜻이 있다)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		this.#warmupSeconds = 2;
		this.#probeSeconds = 4;
		this.#slowFrameRatio = 1.4;
		this.#slowFrameShare = 0.25;
		this.#unlimitedTargetFramePerSecond = 60;
		this.#elapsedSeconds = 0;
		this.#frameCount = 0;
		this.#slowFrameCount = 0;
		this.#isFinished = false;
		this.#isSlow = false;
	}

	//==============================================================================
	// 한 프레임 재기. (다 재는 프레임에 true 를 돌려준다)
	//==============================================================================
	/**
	 * @param { number } frameSeconds - 지난 프레임과의 간격. (초)
	 * @param { number } maximumFramePerSecond - 최대 프레임. (0 이면 무제한)
	 * @returns { boolean } 이 프레임에서 다 쟀으면 참. (다 쟀거나 간격이 0 이하이면 거짓)
	 */
	measureFrame(frameSeconds, maximumFramePerSecond) {
		if (this.isFinished() || !(frameSeconds > 0)) {
			return false;
		}
		const warmupSeconds = this.getWarmupSeconds();
		const probeSeconds = this.getProbeSeconds();
		this.#elapsedSeconds += frameSeconds;
		if (this.#elapsedSeconds <= warmupSeconds) {
			return false;
		}
		const unlimitedTargetFramePerSecond = this.getUnlimitedTargetFramePerSecond();
		const targetFramePerSecond = maximumFramePerSecond > 0 ? maximumFramePerSecond : unlimitedTargetFramePerSecond;
		const slowFrameRatio = this.getSlowFrameRatio();
		const slowFrameSeconds = slowFrameRatio / targetFramePerSecond;
		this.#frameCount += 1;
		if (frameSeconds > slowFrameSeconds) {
			this.#slowFrameCount += 1;
		}
		if (this.#elapsedSeconds < warmupSeconds + probeSeconds) {
			return false;
		}
		const slowFrameShare = this.getSlowFrameShare();
		this.#isFinished = true;
		this.#isSlow = this.#slowFrameCount >= this.#frameCount * slowFrameShare;
		return true;
	}

	//==============================================================================
	// 처음부터 다시 재기. (다 재기 전에 창이 가려졌을 때, 다 잰 뒤면 그대로 둔다)
	//==============================================================================
	restart() {
		if (this.isFinished()) {
			return;
		}
		this.#elapsedSeconds = 0;
		this.#frameCount = 0;
		this.#slowFrameCount = 0;
	}

	//==============================================================================
	// 다 잰 재기를 한 번 더 열기. (처지지 않았을 때만, 기다리는 초부터 처음처럼)
	// - 켤 때의 가벼운 장면 뒤 무거운 장면에서 다시 잴 때 쓴다.
	//==============================================================================
	measureAgain() {
		if (!this.isFinished() || this.isSlow()) {
			return;
		}
		this.#isFinished = false;
		this.#elapsedSeconds = 0;
		this.#frameCount = 0;
		this.#slowFrameCount = 0;
	}

	//==============================================================================
	// 다 쟀는지 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 다 쟀으면 참.
	 */
	isFinished() {
		return this.#isFinished;
	}

	//==============================================================================
	// 처지는 기기인지 반환. (다 재기 전에는 false)
	//==============================================================================
	/**
	 * @returns { boolean } 처지는 기기로 정했으면 참.
	 */
	isSlow() {
		return this.#isSlow;
	}

	//==============================================================================
	// 지금까지의 처진 프레임 몫 반환. (잰 프레임이 없으면 0)
	//==============================================================================
	/**
	 * @returns { number } 처진 프레임 수를 잰 프레임 수로 나눈 몫. (0 ~ 1)
	 */
	readSlowFrameShare() {
		return this.#frameCount > 0 ? this.#slowFrameCount / this.#frameCount : 0;
	}

	//==============================================================================
	// 기다리는 초와 재는 초 설정. (재기 전에 정한다)
	//==============================================================================
	/**
	 * @param { number } warmupSeconds 재기 전에 기다리는 초. (음수면 0, 처음은 2)
	 * @param { number } probeSeconds 재는 초. (음수면 0, 처음은 4)
	 */
	setSeconds(warmupSeconds, probeSeconds) {
		this.#warmupSeconds = System.Math.max(0, warmupSeconds);
		this.#probeSeconds = System.Math.max(0, probeSeconds);
	}

	//==============================================================================
	// 기다리는 초 반환.
	//==============================================================================
	/**
	 * @returns { number } 재기 전에 기다리는 초.
	 */
	getWarmupSeconds() {
		return this.#warmupSeconds;
	}

	//==============================================================================
	// 재는 초 반환.
	//==============================================================================
	/**
	 * @returns { number } 재는 초.
	 */
	getProbeSeconds() {
		return this.#probeSeconds;
	}

	//==============================================================================
	// 처진 프레임의 판정 설정. (목표 간격의 배, 처지는 기기로 볼 몫)
	//==============================================================================
	/**
	 * @param { number } slowFrameRatio 처진 프레임으로 셀 간격. (목표 간격의 배, 처음은 1.4)
	 * @param { number } slowFrameShare 처지는 기기로 볼 처진 프레임의 몫. (0 ~ 1, 처음은 0.25)
	 */
	setSlowFrameThreshold(slowFrameRatio, slowFrameShare) {
		this.#slowFrameRatio = slowFrameRatio;
		this.#slowFrameShare = slowFrameShare;
	}

	//==============================================================================
	// 처진 프레임으로 셀 간격의 배 반환.
	//==============================================================================
	/**
	 * @returns { number } 처진 프레임으로 셀 간격의 배.
	 */
	getSlowFrameRatio() {
		return this.#slowFrameRatio;
	}

	//==============================================================================
	// 처지는 기기로 볼 처진 프레임의 몫 반환.
	//==============================================================================
	/**
	 * @returns { number } 처지는 기기로 볼 처진 프레임의 몫.
	 */
	getSlowFrameShare() {
		return this.#slowFrameShare;
	}

	//==============================================================================
	// 최대 프레임이 무제한일 때의 목표 설정.
	//==============================================================================
	/**
	 * @param { number } unlimitedTargetFramePerSecond 최대 프레임이 0(무제한)일 때 목표로 볼 초당 프레임. (처음은 60)
	 */
	setUnlimitedTargetFramePerSecond(unlimitedTargetFramePerSecond) {
		this.#unlimitedTargetFramePerSecond = unlimitedTargetFramePerSecond;
	}

	//==============================================================================
	// 최대 프레임이 무제한일 때의 목표 반환.
	//==============================================================================
	/**
	 * @returns { number } 최대 프레임이 무제한일 때의 목표 초당 프레임.
	 */
	getUnlimitedTargetFramePerSecond() {
		return this.#unlimitedTargetFramePerSecond;
	}
}
