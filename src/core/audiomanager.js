//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Engine } from "./engine.js";
import { AudioPlayer } from "./audioplayer.js";
import { PlatformType } from "../base/platform.js";


//==============================================================================
// 오디오 매니저.
// 공유 AudioContext를 소유하며 AudioPlayer 생성을 담당한다.
//
// 브라우저 자동재생 정책 대응:
//  - 첫 user gesture (click/touch/keydown) 전에 AudioContext 를 만들면
//    브라우저가 console 경고("AudioContext was not allowed to start ...")를 띄운다.
//  - 그래서 AudioContext 는 lazy 생성 + user gesture 가 발생한 뒤에만 만든다.
//  - resumeContext() 도 user gesture 이전에는 silently no-op 한다.
//  - createAudioPlayer() 가 user gesture 전에 호출될 수 있는 경우를 위해
//    플레이어 생성 시점에는 (마지못해) AudioContext 를 만든다 — 이때만 경고가 날 수 있음.
//
// iOS 버전업 대응 (2026-10-22 03:41, iOS 26.6.2 에서 확인):
//  - iOS 에서는 resumeContext() 로 복원된 컨텍스트가 "running" 이면 verifyContextClock() 으로 시계가 실제로 흐르는지 확인한다.
//  - 옵션이 아니라 iOS(iPadOS 포함) 에서 늘 한다. 다른 플랫폼은 지금까지와 같다.
//==============================================================================
// iOS 에서 복원 뒤 시계(currentTime)가 흐르는지 보는 간격. (초, 2026-10-22 03:41, iOS 26.6.2 버전업 대응)
const CONTEXT_CLOCK_CHECK_INTERVAL = 0.5;
// 그 간격 동안 시계가 이 비율보다 덜 흐르면 멈춘 것으로 본다. (2026-10-22 03:41, iOS 26.6.2 버전업 대응)
const CONTEXT_CLOCK_MINIMUM_RATIO = 0.25;


export class AudioManager extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { AudioContext | null } */ #audioContext;
	/** @private @type { boolean } */ #hasUserGesture;
	/** @private @type { boolean } */ #isIOS; // iOS(iPadOS 포함) 인지. (2026-10-22 03:41, iOS 26.6.2 버전업 대응)
	/** @private @type { boolean } */ #isVerifyingContextClock; // 시계 확인이 돌고 있는지. (한 번에 하나만, 2026-10-22 03:41)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { Engine } engine
	 */
	constructor(engine) {
		super();
		this.#audioContext = null;
		this.#hasUserGesture = false;
		// AudioContext 는 user gesture 후에 lazy 생성 (브라우저 자동재생 정책).

		// iOS(iPadOS 포함) 인지. 데스크탑 모드의 iPad 는 Macintosh 로 보이므로 터치 지점 수로 가린다. (2026-10-22 03:41, iOS 26.6.2 버전업 대응)
		const platform = engine.getPlatform();
		const platformInfo = platform.getPlatformInfo();
		const platformName = platformInfo.platformName;
		const isDesktopModeIPad = platformName === PlatformType.macOS && System.navigator.maxTouchPoints > 1;
		this.#isIOS = platformName === PlatformType.iOS || platformName === PlatformType.iPadOS || isDesktopModeIPad;
		this.#isVerifyingContextClock = false;
	}

	//==============================================================================
	// 첫 user gesture 가 발생했음을 알린다. (Engine 의 click/touchstart/keydown 핸들러에서 호출)
	//==============================================================================
	markUserGesture() {
		this.#hasUserGesture = true;
	}

	//==============================================================================
	// user gesture 이후인지 여부.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	hasUserGesture() {
		return this.#hasUserGesture;
	}

	//==============================================================================
	// AudioContext 를 보장 (없으면 생성).
	//==============================================================================
	/**
	 * @private
	 * @returns { AudioContext | null }
	 */
	ensureAudioContext() {
		if (this.#audioContext) {
			return this.#audioContext;
		}
		const audioContextType = System.window.AudioContext || System.window.webkitAudioContext;
		if (audioContextType) {
			this.#audioContext = new audioContextType();
		}
		return this.#audioContext;
	}

	//==============================================================================
	// 오디오 컨텍스트 재개.
	// - user gesture 전에는 silently no-op (브라우저 경고 회피).
	// - resume() 의 promise rejection 도 silently 처리.
	//==============================================================================
	resumeContext() {
		if (!this.#hasUserGesture) {
			return;
		}
		const audioContext = this.ensureAudioContext();
		if (!audioContext) {
			return;
		}
		// iOS WebKit 은 표준 "suspended" 외에 비표준 "interrupted" 상태를 쓴다.
		// (앱 전환·시스템 팝업·오디오 세션 경합 등) 두 상태만 명시적으로 재개를 시도한다 —
		// "interrupted" 는 iOS 에만 존재하는 값이라 다른 플랫폼 동작은 기존과 완전히 동일하다.
		if (audioContext.state !== "suspended" && audioContext.state !== "interrupted") {
			return;
		}
		try {
			const result = audioContext.resume();
			if (result && typeof result.then === "function") {
				result.then(() => {
					// iOS 는 복원된 뒤 "running" 이어도 시계가 멈춰 소리가 나지 않는 일이 있어 확인한다. (2026-10-22 03:41, iOS 26.6.2 버전업 대응)
					if (this.#isIOS && audioContext.state === "running") {
						this.verifyContextClock(audioContext);
					}
				}, () => {
					// user gesture 직후라도 일시적으로 거부될 수 있음. 다음 호출에서 재시도되므로 무시.
				});
			}
		}
		catch (error) {
			// 동기 예외도 무시.
		}
	}

	//==============================================================================
	// 복원 뒤 시계 확인. (iOS 전용, 2026-10-22 03:41 추가)
	// iOS 버전업으로 생긴 문제다. (iOS 26.6.2, 아이폰 15 프로 맥스, 토스 앱인토스의 웹뷰와 Capacitor 앱에서 확인.
	//  같은 앱이 그 전의 iOS 에서는 돌아오면 소리가 났고, 2026-04 의 엔진으로 만든 판도 지금은 같은 증상이라 엔진의 변화가 아니다)
	//  - 앱을 내리면 WebKit 이 페이지가 가려짐을 알기 전에 컨텍스트를 끊고("interrupted"),
	//    돌아오면 스스로 되살리지 않고 "suspended" 로 둔다.
	//  - 돌아온 직후의 resume() 은 "Failed to start the audio device" 로 거부되거나,
	//    "running" 으로 끝나도 currentTime 이 흐르지 않아 소리가 나지 않는다. (상태로는 알 수 없다)
	//  - 그 상태에서 suspend() 후 resume() 하면 시계가 흐르고 소리가 난다.
	// 그래서 "running" 으로 복원된 뒤 CONTEXT_CLOCK_CHECK_INTERVAL 동안 currentTime 이 흐르는지 보고,
	// 멈춰 있으면 suspend() 후 resume() 하고 다시 확인한다. 그 resume() 이 거부되면 같은 간격 뒤 resumeContext() 로 다시 복원한다.
	// 확인은 한 번에 하나만 돌고, 페이지가 가려지거나 컨텍스트가 "running" 이 아니게 되면(게임이 멈춘 경우 포함) 그만둔다.
	//==============================================================================
	/**
	 * @private
	 * @param { AudioContext } audioContext
	 */
	verifyContextClock(audioContext) {
		if (this.#isVerifyingContextClock) {
			return;
		}
		this.#isVerifyingContextClock = true;
		const startTime = System.performance.now() / 1000;
		const startContextTime = audioContext.currentTime;
		System.setTimeout(() => {
			this.#isVerifyingContextClock = false;
			if (audioContext !== this.#audioContext || audioContext.state !== "running" || System.document.visibilityState !== "visible") {
				return;
			}
			const elapsedTime = System.performance.now() / 1000 - startTime;
			const contextElapsedTime = audioContext.currentTime - startContextTime;
			if (contextElapsedTime >= elapsedTime * CONTEXT_CLOCK_MINIMUM_RATIO) {
				return;
			}
			console.warn(`[AudioManager] iOS: 복원 뒤 running 인데 시계가 멈춰 있어 suspend 후 resume 한다. (${elapsedTime.toFixed(2)}초 동안 ${contextElapsedTime.toFixed(2)}초)`);
			audioContext.suspend().then(() => {
				return audioContext.resume();
			}).then(() => {
				if (audioContext.state === "running") {
					this.verifyContextClock(audioContext);
				}
			}).catch(() => {
				// 거부되면 같은 간격 뒤 다시 복원한다. (스스로 멈춘 것이므로)
				System.setTimeout(() => {
					this.resumeContext();
				}, CONTEXT_CLOCK_CHECK_INTERVAL * 1000);
			});
		}, CONTEXT_CLOCK_CHECK_INTERVAL * 1000);
	}

	//==============================================================================
	// 오디오 플레이어 생성.
	//==============================================================================
	/**
	 * @returns { AudioPlayer }
	 */
	createAudioPlayer() {
		const audioContext = this.ensureAudioContext();
		return new AudioPlayer(audioContext);
	}

	//==============================================================================
	// 오디오 컨텍스트 반환. (없으면 null)
	//==============================================================================
	/**
	 * @returns { AudioContext | null }
	 */
	getAudioContext() {
		return this.#audioContext;
	}
}
