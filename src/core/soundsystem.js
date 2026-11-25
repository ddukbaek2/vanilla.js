//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { AudioAsset } from "../resource/audioasset.js";


//==============================================================================
// 소리. (배경음악과 효과음)
//
// 엔진의 AudioManager(공유 AudioContext)와 AudioAsset(MP3)을 쓴다. 받은 소리 버퍼를 Web Audio 로 튼다. (소리를 합성하지 않고 파일만 튼다)
// 소리 표를 넘긴다. 줄마다 { id, path 나 paths, volume, minimumInterval, isMusic, maximumVoices, pitchVariation, playSeconds, fadeOutSeconds } 이다.
//   volume: 소리마다의 크기. (0 ~ 1)  minimumInterval: 같은 소리를 다시 낼 수 있는 간격. (초, 한꺼번에 몰려 시끄럽지 않게)
//   paths: 같은 소리를 여러 번 녹음한 무리. 낼 때마다 하나를 고르고 바로 앞과 같은 것은 고르지 않는다. (하나면 path)
//   maximumVoices: 같은 소리가 한꺼번에 날 수 있는 수. (넘으면 가장 오래된 것을 끊음, 없으면 효과음 전체의 수까지)
//   pitchVariation: 낼 때마다 음 높이를 흔드는 비. (0.05 면 ±5%, 없으면 0)
//   playSeconds, fadeOutSeconds: 효과음을 앞의 playSeconds 초만 틀고 fadeOutSeconds 초 동안 줄여 끈다. (긴 파일, 없거나 0 이면 끝까지)
//
// 크기: 배경음악 = 설정의 음악 크기 × 음악의 비(멈춤 창의 반 크기 등) × 소리의 크기, 효과음 = 설정의 효과음 크기 × 소리의 크기 × 부를 때의 크기(거리에 따른 줄임 등).
// 배경음악은 겹쳐 바꿀 수 있고(fadeSeconds), 멈췄던 자리를 소리마다 기억해 이어 틀 수 있다. (isResumed)
// 음소거는 설정한 크기보다 먼저이다. 아래 가운데 하나라도 맞으면 설정과 상관없이 소리가 나지 않는다.
//   - 플랫폼의 음소거. (setExternalMuteProvider 로 준 함수, 플랫폼 SDK 의 음소거 설정, 보상형 광고를 보이는 동안 등)
//   - 사용자의 음소거 단추. (setUserMuted)
//   - 페이지가 가려짐. (다른 탭, 앱 전환)
//   - 터치가 주된 기기에서 창이 포커스를 잃음. (blur, 앱을 내리기 시작할 때)
//     아이폰은 페이지가 가려졌다는 알림이 앱이 내려간 뒤에 와서, 그때는 오디오가 멈추지 못한 채 얼어 마지막 소리 조각이 되풀이된다.
//     창이 포커스를 잃는 알림은 그보다 먼저 온다. 데스크탑은 캔버스 바깥(바깥 페이지)을 누를 때도 포커스를 잃으므로 따르지 않는다.
// 플랫폼의 음소거는 매 프레임(update) 읽고, 페이지가 가려지는 것은 그 순간에 적용한다. (가려지면 프레임이 멈춘다)
// 음소거인 동안은 AudioContext 도 멈춘다. (suspend, 풀리면 resume) 아이폰은 돌던 AudioContext 를 앱 전환이나 전면 광고가 가로채면
// 돌아와서 깨워도 소리가 나지 않는다. 그 전에 스스로 멈춰 두면 돌아올 때 다시 난다.
// 풀린 뒤에도 AudioContext 가 돌지 않으면 돌 때까지 잠깐마다 다시 깨워 본다. (아이폰은 앱으로 돌아온 순간의 깨우기를 듣지 않는 일이 있음)
//
// 허락하면(setAutoplayAllowedProvider, 주지 않으면 허락) 누르기 전에도 한 번 깨워 본다. 막히면 아래처럼 첫 누름에 켜진다.
// 브라우저는 사람이 처음 누르기 전에는 소리를 내지 못하게 한다. 엔진이 첫 누름에 AudioContext 를 만들고 깨우므로,
// 그 뒤에 소리의 길(음악과 효과음의 크기 노드)을 만들고, AudioContext 가 돌고 있을 때만 소리를 낸다. (멈춘 동안 부른 소리가 깨어날 때 한꺼번에 나지 않게)
// 소리 파일은 놀이를 막지 않게 뒤에서 받는다. 아직 못 받았거나 못 받은 소리는 나지 않을 뿐이다.
//==============================================================================
// 효과음을 동시에 낼 수 있는 수. (넘으면 가장 오래된 것을 끊음)
const EFFECT_VOICE_COUNT = 12;
// 음소거가 아닌데 AudioContext 가 돌지 않을 때 다시 깨워 보는 간격. (초)
const CONTEXT_RESUME_RETRY_INTERVAL = 0.5;
// 크기를 바꿀 때 따라가는 시간. (초, 툭 끊기지 않게)
const VOLUME_SMOOTHING_SECONDS = 0.05;
// 효과음을 좌우로 나누는 가장 큰 값. (-1 ~ 1)
const MAXIMUM_PAN = 1;

// 함께 쓰는 소리. (setSoundSystem 으로 정한다)
let currentSoundSystem = null;


export class SoundSystem {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { function(): boolean | null } */ #externalMuteProvider; // 바깥(플랫폼 SDK, 광고)의 음소거를 읽는 함수. (null 이면 없음)
	/** @private @type { function(): boolean | null } */ #autoplayAllowedProvider; // 누르기 전에 깨워 봐도 되는지 읽는 함수. (null 이면 허락)
	/** @private @type { object } */ #audioManager; // 엔진의 AudioManager
	/** @private @type { Map<string, object> } */ #soundById; // 소리 표의 줄.
	/** @private @type { Map<string, Array<AudioAsset | null>> } */ #assetsById; // 받은 소리. (무리의 차례대로, 못 받은 것은 null)
	/** @private @type { Map<string, number> } */ #lastPlayTimeById; // 소리마다 마지막으로 낸 때. (초)
	/** @private @type { Map<string, number> } */ #lastVariantById; // 소리마다 마지막으로 고른 무리의 번호.
	/** @private @type { GainNode | null } */ #musicBus; // 배경음악의 크기 노드. (첫 누름 전에는 null)
	/** @private @type { GainNode | null } */ #effectBus; // 효과음의 크기 노드.
	/** @private @type { Array<object> } */ #voices; // 나고 있는 효과음. ({ soundId, source, startTime })
	/** @private @type { string } */ #musicId; // 틀어 달라고 한 배경음악. (없으면 "")
	/** @private @type { number } */ #musicFadeSeconds; // 그 음악으로 바꿀 때 겹치는 초.
	/** @private @type { boolean } */ #isMusicResumed; // 그 음악을 멈췄던 자리에서 이어 트는지.
	/** @private @type { object | null } */ #playingMusic; // 틀고 있는 배경음악. ({ soundId, source, gain, startTime, offset, duration })
	/** @private @type { Map<string, number> } */ #musicPositions; // 음악마다 멈췄던 자리. (초)
	/** @private @type { number } */ #musicVolume; // 설정의 음악 크기. (0 ~ 1)
	/** @private @type { number } */ #musicScale; // 음악의 비. (멈춤 창이 뜨면 반 등, 0 ~ 1)
	/** @private @type { number } */ #soundEffectVolume; // 설정의 효과음 크기. (0 ~ 1)
	/** @private @type { boolean } */ #isUserMuted; // 사용자의 음소거 단추.
	/** @private @type { boolean } */ #isPageHidden;
	/** @private @type { boolean } */ #isMuted; // 소리의 길에 적용한 음소거.
	/** @private @type { boolean } */ #isContextPaused; // 음소거로 AudioContext 를 멈춰 두었는지.
	/** @private @type { boolean } */ #isBlurMuteEnabled; // 창이 포커스를 잃으면 음소거하는지. (터치가 주된 기기)
	/** @private @type { boolean } */ #isWindowBlurred; // 창이 포커스를 잃었는지. (음소거하는 기기에서만 true)
	/** @private @type { boolean } */ #isAutoplayTried; // 누르기 전에 깨워 보기를 했는지.
	/** @private @type { number } */ #lastContextResumeTime; // 마지막으로 다시 깨워 본 때. (초)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { object } audioManager 엔진의 AudioManager (engine.getAudioManager())
	 * @param { object[] } soundTable [{ id, path 나 paths, volume, minimumInterval, isMusic, maximumVoices, pitchVariation, playSeconds, fadeOutSeconds }]
	 */
	constructor(audioManager, soundTable) {
		this.#externalMuteProvider = null;
		this.#autoplayAllowedProvider = null;
		this.#audioManager = audioManager;
		this.#soundById = new System.Map();
		this.#assetsById = new System.Map();
		this.addSounds(soundTable);
		this.#lastPlayTimeById = new System.Map();
		this.#lastVariantById = new System.Map();
		this.#musicBus = null;
		this.#effectBus = null;
		this.#voices = [];
		this.#musicId = "";
		this.#musicFadeSeconds = 0;
		this.#isMusicResumed = false;
		this.#playingMusic = null;
		this.#musicPositions = new System.Map();
		this.#musicVolume = 1;
		this.#musicScale = 1;
		this.#soundEffectVolume = 1;
		this.#isUserMuted = false;
		this.#isPageHidden = System.document.visibilityState === "hidden";
		this.#isMuted = false;
		this.#isContextPaused = false;
		const coarsePointerQuery = typeof System.window.matchMedia === "function" ? System.window.matchMedia("(pointer: coarse)") : null;
		this.#isBlurMuteEnabled = coarsePointerQuery !== null && coarsePointerQuery.matches;
		this.#isWindowBlurred = false;
		this.#isAutoplayTried = false;
		this.#lastContextResumeTime = System.Number.NEGATIVE_INFINITY;
		System.document.addEventListener("visibilitychange", () => {
			this.#isPageHidden = System.document.visibilityState === "hidden";
			const isPageHidden = this.isPageHidden();
			if (!isPageHidden) {
				this.#isWindowBlurred = false;
			}
			this.applyMute();
			this.applyContextPause();
		});
		System.window.addEventListener("blur", () => {
			if (!this.isBlurMuteEnabled()) {
				return;
			}
			this.#isWindowBlurred = true;
			this.applyMute();
			this.applyContextPause();
		});
		const clearWindowBlurred = () => {
			if (!this.isWindowBlurred()) {
				return;
			}
			this.#isWindowBlurred = false;
			this.applyMute();
			this.applyContextPause();
		};
		System.window.addEventListener("focus", clearWindowBlurred);
		// 포커스가 돌아왔다는 알림이 오지 않아도 화면을 누르면 창은 포커스를 가진 것이다.
		System.window.addEventListener("pointerdown", clearWindowBlurred);
	}

	//==============================================================================
	// 소리 표의 줄 더하기. (같은 id 는 바꿈, 받기는 loadSounds 가 함)
	//==============================================================================
	/**
	 * @param { object[] } soundTable
	 */
	addSounds(soundTable) {
		for (const soundRow of soundTable) {
			this.#soundById.set(soundRow.id, soundRow);
		}
	}

	//==============================================================================
	// 소리 애셋 직접 더하기. (메모리에서 지은 소리처럼 파일로 받지 않는 것, 같은 id 의 녹음 무리에 덧붙인다)
	// - 크기와 간격은 소리 표(addSounds)의 같은 id 줄을 따른다. (줄이 없으면 내지 않는다) 받기(loadSounds)는 이 id 를 다시 받지 않는다.
	//==============================================================================
	/**
	 * @param { string } soundId
	 * @param { AudioAsset } audioAsset
	 */
	addSoundAsset(soundId, audioAsset) {
		let assets = this.#assetsById.get(soundId);
		if (assets === undefined) {
			assets = [];
			this.#assetsById.set(soundId, assets);
		}
		assets.push(audioAsset);
	}

	//==============================================================================
	// 엔진의 AudioManager.
	//==============================================================================
	// 바깥의 음소거를 읽는 함수 설정. (플랫폼 SDK 의 음소거, 보상형 광고를 보이는 동안 등, 매 프레임 읽는다, null 이면 없음)
	//==============================================================================
	/**
	 * @param { function(): boolean | null } externalMuteProvider
	 */
	setExternalMuteProvider(externalMuteProvider) {
		this.#externalMuteProvider = externalMuteProvider;
	}

	//==============================================================================
	// 바깥의 음소거를 읽는 함수 반환.
	//==============================================================================
	/**
	 * @returns { function(): boolean | null }
	 */
	getExternalMuteProvider() {
		return this.#externalMuteProvider;
	}

	//==============================================================================
	// 누르기 전에 깨워 봐도 되는지 읽는 함수 설정. (웹뷰가 막는 플랫폼이면 false 를 돌려주는 함수, null 이면 허락)
	//==============================================================================
	/**
	 * @param { function(): boolean | null } autoplayAllowedProvider
	 */
	setAutoplayAllowedProvider(autoplayAllowedProvider) {
		this.#autoplayAllowedProvider = autoplayAllowedProvider;
	}

	//==============================================================================
	// 누르기 전에 깨워 봐도 되는지 읽는 함수 반환.
	//==============================================================================
	/**
	 * @returns { function(): boolean | null }
	 */
	getAutoplayAllowedProvider() {
		return this.#autoplayAllowedProvider;
	}

	//==============================================================================
	/**
	 * @returns { object }
	 */
	getAudioManager() {
		return this.#audioManager;
	}

	//==============================================================================
	// 배경음악과 효과음의 크기 노드. (첫 누름 전에는 null)
	//==============================================================================
	/**
	 * @returns { GainNode | null }
	 */
	getMusicBus() {
		return this.#musicBus;
	}

	/**
	 * @returns { GainNode | null }
	 */
	getEffectBus() {
		return this.#effectBus;
	}

	//==============================================================================
	// 틀어 달라고 한 배경음악. (없으면 "")
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getMusicId() {
		return this.#musicId;
	}

	//==============================================================================
	// 설정의 음악 크기.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getMusicVolume() {
		return this.#musicVolume;
	}

	//==============================================================================
	// 음악의 비. (멈춤 창의 반 크기 등)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getMusicScale() {
		return this.#musicScale;
	}

	//==============================================================================
	// 설정의 효과음 크기.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getSoundEffectVolume() {
		return this.#soundEffectVolume;
	}

	//==============================================================================
	// 사용자의 음소거 단추를 눌러 두었는지.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isUserMuted() {
		return this.#isUserMuted;
	}

	//==============================================================================
	// 페이지가 가려져 있는지.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isPageHidden() {
		return this.#isPageHidden;
	}

	//==============================================================================
	// 창이 포커스를 잃으면 음소거하는지. (터치가 주된 기기)
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isBlurMuteEnabled() {
		return this.#isBlurMuteEnabled;
	}

	//==============================================================================
	// 창이 포커스를 잃었는지. (음소거하는 기기에서만 true)
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isWindowBlurred() {
		return this.#isWindowBlurred;
	}

	//==============================================================================
	// 음소거로 AudioContext 를 멈춰 두었는지.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isContextPaused() {
		return this.#isContextPaused;
	}

	//==============================================================================
	// 마지막으로 다시 깨워 본 때. (초)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getLastContextResumeTime() {
		return this.#lastContextResumeTime;
	}

	//==============================================================================
	// 지금 음소거여야 하는지. (플랫폼의 음소거, 사용자의 음소거 단추, 페이지가 가려짐, 창이 포커스를 잃음, 설정한 크기보다 먼저이다)
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	readMuted() {
		const externalMuteProvider = this.getExternalMuteProvider();
		const isPlatformMuted = externalMuteProvider !== null && externalMuteProvider() === true;
		const isUserMuted = this.isUserMuted();
		const isPageHidden = this.isPageHidden();
		const isWindowBlurred = this.isWindowBlurred();
		return isPlatformMuted || isUserMuted || isPageHidden || isWindowBlurred;
	}

	//==============================================================================
	// AudioContext 가 돌고 있는지. (돌지 않으면 소리를 내지 않는다)
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isContextRunning() {
		const audioManager = this.getAudioManager();
		const audioContext = audioManager.getAudioContext();
		return audioContext !== null && audioContext.state === "running";
	}

	//==============================================================================
	// 소리 받기. (효과음을 먼저 함께 받고, 큰 배경음악을 나중에 받는다, 못 받은 소리는 건너뜁다, 이미 받은 것은 다시 받지 않음)
	//==============================================================================
	async loadSounds() {
		const effectRows = [];
		const musicRows = [];
		for (const soundRow of this.#soundById.values()) {
			if (this.#assetsById.has(soundRow.id)) {
				continue;
			}
			if (soundRow.isMusic) {
				musicRows.push(soundRow);
			}
			else {
				effectRows.push(soundRow);
			}
		}
		const effectLoads = effectRows.map((soundRow) => {
			return this.loadSound(soundRow);
		});
		await System.Promise.all(effectLoads);
		for (const musicRow of musicRows) {
			await this.loadSound(musicRow);
		}
		this.update();
	}

	//==============================================================================
	// 소리 하나 받기. (무리면 모두, 못 받은 것은 null 로 두고 건너뜀)
	//==============================================================================
	/**
	 * @param { object } soundRow
	 */
	async loadSound(soundRow) {
		const paths = readSoundPaths(soundRow);
		const assets = paths.map(() => {
			return null;
		});
		this.#assetsById.set(soundRow.id, assets);
		const loads = paths.map(async (path, pathIndex) => {
			const audioAsset = new AudioAsset();
			try {
				await audioAsset.load(path);
				assets[pathIndex] = audioAsset;
			}
			catch (error) {
				console.warn("[sound] 소리를 받지 못했습니다. " + path, error);
			}
		});
		await System.Promise.all(loads);
	}

	//==============================================================================
	// 설정의 음악 크기. (0 ~ 1)
	//==============================================================================
	/**
	 * @param { number } volume
	 */
	setMusicVolume(volume) {
		this.#musicVolume = clampVolume(volume);
		this.applyVolumes();
	}

	//==============================================================================
	// 음악의 비. (0 ~ 1, 멈춤 창이 떠 있는 동안 반 크기처럼 설정과 따로 줄일 때)
	//==============================================================================
	/**
	 * @param { number } scale
	 */
	setMusicScale(scale) {
		this.#musicScale = clampVolume(scale);
		this.applyVolumes();
	}

	//==============================================================================
	// 설정의 효과음 크기. (0 ~ 1)
	//==============================================================================
	/**
	 * @param { number } volume
	 */
	setSoundEffectVolume(volume) {
		this.#soundEffectVolume = clampVolume(volume);
		this.applyVolumes();
	}

	//==============================================================================
	// 사용자의 음소거 단추. (음악과 효과음을 한꺼번에)
	//==============================================================================
	/**
	 * @param { boolean } isMuted
	 */
	setUserMuted(isMuted) {
		this.#isUserMuted = isMuted === true;
		this.applyMute();
		this.applyContextPause();
	}

	//==============================================================================
	// 배경음악 틀기. (반복한다, "" 이면 끈다, 받기 전이거나 첫 누름 전이면 그때 튼다)
	//   - fadeSeconds 동안 앞 음악은 줄고 새 음악은 0 에서 오른다. (0 이면 바로)
	//   - isResumed 면 그 음악을 멈췄던 자리에서 잇는다. (아니면 처음부터)
	//==============================================================================
	/**
	 * @param { string } soundId
	 * @param { number } [fadeSeconds]
	 * @param { boolean } [isResumed]
	 */
	playMusic(soundId, fadeSeconds = 0, isResumed = false) {
		if (soundId === this.#musicId) {
			return;
		}
		this.#musicId = soundId;
		this.#musicFadeSeconds = System.Math.max(0, fadeSeconds);
		this.#isMusicResumed = isResumed;
		this.update();
	}

	//==============================================================================
	// 효과음 내기. (음소거, 첫 누름 전, 받기 전, 다시 낼 간격 안이면 내지 않는다)
	//==============================================================================
	/**
	 * @param { string } soundId
	 * @param { number } volume 이번의 크기. (0 ~ 1, 소리의 크기와 설정의 효과음 크기에 곱한다)
	 * @param { number } [pan] 좌우. (-1 왼쪽 ~ 1 오른쪽, 0 가운데)
	 */
	playEffect(soundId, volume = 1, pan = 0) {
		const effectBus = this.getEffectBus();
		if (effectBus === null || this.#isMuted || !this.isContextRunning()) {
			return;
		}
		const soundRow = this.#soundById.get(soundId);
		const assets = this.#assetsById.get(soundId);
		if (soundRow === undefined || assets === undefined) {
			return;
		}
		const effectVolume = clampVolume(soundRow.volume * volume);
		if (effectVolume <= 0.001) {
			return;
		}
		const now = System.performance.now() / 1000;
		const lastPlayTime = this.#lastPlayTimeById.has(soundId) ? this.#lastPlayTimeById.get(soundId) : System.Number.NEGATIVE_INFINITY;
		const minimumInterval = typeof soundRow.minimumInterval === "number" ? soundRow.minimumInterval : 0;
		if (now - lastPlayTime < minimumInterval) {
			return;
		}
		const audioAsset = this.pickVariant(soundId, assets);
		if (audioAsset === null) {
			return;
		}
		const audioBuffer = audioAsset.getAudioBuffer();
		if (!audioBuffer) {
			return;
		}
		this.#lastPlayTimeById.set(soundId, now);
		// 같은 소리가 maximumVoices 를 넘거나 효과음 전체가 EFFECT_VOICE_COUNT 를 넘으면 가장 오래된 것을 끊는다.
		const maximumVoices = typeof soundRow.maximumVoices === "number" ? soundRow.maximumVoices : EFFECT_VOICE_COUNT;
		this.trimVoices(soundId, maximumVoices - 1);
		this.trimVoices("", EFFECT_VOICE_COUNT - 1);
		const audioContext = this.getAudioManager().getAudioContext();
		const source = audioContext.createBufferSource();
		source.buffer = audioBuffer;
		const pitchVariation = typeof soundRow.pitchVariation === "number" ? soundRow.pitchVariation : 0;
		if (pitchVariation > 0) {
			source.playbackRate.value = 1 + (System.Math.random() * 2 - 1) * pitchVariation;
		}
		const gainNode = audioContext.createGain();
		gainNode.gain.value = effectVolume;
		source.connect(gainNode);
		const clampedPan = System.Math.max(-MAXIMUM_PAN, System.Math.min(MAXIMUM_PAN, pan));
		if (clampedPan !== 0 && typeof audioContext.createStereoPanner === "function") {
			const pannerNode = audioContext.createStereoPanner();
			pannerNode.pan.value = clampedPan;
			gainNode.connect(pannerNode);
			pannerNode.connect(effectBus);
		}
		else {
			gainNode.connect(effectBus);
		}
		const voice = { soundId: soundId, source: source, gainNode: gainNode, startTime: now };
		source.onended = () => {
			const voiceIndex = this.#voices.indexOf(voice);
			if (voiceIndex >= 0) {
				this.#voices.splice(voiceIndex, 1);
			}
		};
		this.#voices.push(voice);
		source.start(0);
		// 앞만 틀고 줄여 끄는 소리.
		const playSeconds = typeof soundRow.playSeconds === "number" ? soundRow.playSeconds : 0;
		if (playSeconds > 0) {
			const fadeOutSeconds = typeof soundRow.fadeOutSeconds === "number" ? System.Math.max(0, soundRow.fadeOutSeconds) : 0;
			const fadeStartTime = audioContext.currentTime + playSeconds;
			gainNode.gain.setValueAtTime(effectVolume, fadeStartTime);
			gainNode.gain.linearRampToValueAtTime(0, fadeStartTime + fadeOutSeconds);
			source.stop(fadeStartTime + fadeOutSeconds + 0.02);
		}
	}

	//==============================================================================
	// 무리에서 하나 고르기. (받은 것 가운데 바로 앞과 다른 것, 하나뿐이면 그것, 없으면 null)
	//==============================================================================
	/**
	 * @param { string } soundId
	 * @param { Array<AudioAsset | null> } assets
	 * @returns { AudioAsset | null }
	 */
	pickVariant(soundId, assets) {
		const loadedIndices = [];
		assets.forEach((audioAsset, assetIndex) => {
			if (audioAsset !== null) {
				loadedIndices.push(assetIndex);
			}
		});
		if (loadedIndices.length === 0) {
			return null;
		}
		const lastIndex = this.#lastVariantById.has(soundId) ? this.#lastVariantById.get(soundId) : -1;
		const candidates = loadedIndices.length > 1 ? loadedIndices.filter((assetIndex) => {
			return assetIndex !== lastIndex;
		}) : loadedIndices;
		const pickedIndex = candidates[System.Math.floor(System.Math.random() * candidates.length)];
		this.#lastVariantById.set(soundId, pickedIndex);
		return assets[pickedIndex];
	}

	//==============================================================================
	// 나는 효과음을 그 수까지 줄이기. (오래된 것부터 끊음, soundId 가 "" 이면 모든 효과음)
	//==============================================================================
	/**
	 * @param { string } soundId
	 * @param { number } keepCount
	 */
	trimVoices(soundId, keepCount) {
		const matchingVoices = this.#voices.filter((voice) => {
			return soundId === "" || voice.soundId === soundId;
		});
		const removeCount = matchingVoices.length - System.Math.max(0, keepCount);
		for (let voiceIndex = 0; voiceIndex < removeCount; ++voiceIndex) {
			this.stopVoice(matchingVoices[voiceIndex]);
		}
	}

	//==============================================================================
	// 효과음 하나 끊기.
	//==============================================================================
	/**
	 * @param { object } voice
	 */
	stopVoice(voice) {
		const voiceIndex = this.#voices.indexOf(voice);
		if (voiceIndex >= 0) {
			this.#voices.splice(voiceIndex, 1);
		}
		voice.source.onended = null;
		try {
			voice.source.stop();
		}
		catch (error) {
			// 이미 끝난 소리는 무시한다.
		}
	}

	//==============================================================================
	// 나는 효과음을 줄여 끄기. (soundId 가 "" 이면 모든 효과음, 줄이는 초가 0 이면 바로 끊음)
	//==============================================================================
	/**
	 * @param { string } soundId
	 * @param { number } fadeSeconds
	 */
	fadeOutEffects(soundId, fadeSeconds) {
		const matchingVoices = this.#voices.filter((voice) => {
			return soundId === "" || voice.soundId === soundId;
		});
		if (matchingVoices.length === 0) {
			return;
		}
		const audioContext = this.getAudioManager().getAudioContext();
		const clampedFadeSeconds = System.Math.max(0, fadeSeconds);
		for (const voice of matchingVoices) {
			if (clampedFadeSeconds <= 0 || audioContext === null || audioContext === undefined) {
				this.stopVoice(voice);
				continue;
			}
			const voiceIndex = this.#voices.indexOf(voice);
			if (voiceIndex >= 0) {
				this.#voices.splice(voiceIndex, 1);
			}
			voice.source.onended = null;
			const currentTime = audioContext.currentTime;
			const gain = voice.gainNode.gain;
			const currentGain = gain.value;
			gain.cancelScheduledValues(currentTime);
			gain.setValueAtTime(currentGain, currentTime);
			gain.linearRampToValueAtTime(0, currentTime + clampedFadeSeconds);
			try {
				voice.source.stop(currentTime + clampedFadeSeconds + 0.02);
			}
			catch (error) {
				// 이미 끝난 소리는 무시한다.
			}
		}
	}

	//==============================================================================
	// 나고 있는 효과음 수. (시험과 기록용)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getEffectVoiceCount() {
		return this.#voices.length;
	}

	//==============================================================================
	// 나는 효과음을 모두 끊기. (멈춤 창이 뜰 때 등)
	//==============================================================================
	stopEffects() {
		const voices = this.#voices.slice();
		for (const voice of voices) {
			this.stopVoice(voice);
		}
	}

	//==============================================================================
	// 매 프레임. (첫 누름 뒤 소리의 길 만들기, 플랫폼의 음소거 따르기, 배경음악 틀기)
	//==============================================================================
	update() {
		this.tryAutoplay();
		this.ensurePlayers();
		this.applyMute();
		this.applyContextPause();
		this.retryContextResume();
		this.updateMusic();
	}

	//==============================================================================
	// 다시 깨워 보기. (음소거가 아닌데 AudioContext 가 돌지 않으면 CONTEXT_RESUME_RETRY_INTERVAL 마다)
	// 아이폰은 앱으로 돌아온 순간(다시 보임)에 부른 resume() 을 오디오가 아직 돌아오기 전이라 듣지 않는 일이 있다.
	// 그 뒤로는 끌기만 하는 손가락이 사람의 누름으로 치이지 않아, 버튼을 누르기 전까지 소리가 나지 않았다.
	// 다시 깨운 뒤 돈다고 하는데 소리가 나지 않는 것(시계가 멈춤)은 엔진의 AudioManager 가 iOS 에서 확인한다. (엔진 v0.3.2, iOS 26.6.2 버전업 대응)
	//==============================================================================
	retryContextResume() {
		const audioManager = this.getAudioManager();
		const audioContext = audioManager.getAudioContext();
		const isContextPaused = this.isContextPaused();
		if (audioContext === null || isContextPaused || audioContext.state === "running") {
			return;
		}
		const now = System.performance.now() / 1000;
		const lastContextResumeTime = this.getLastContextResumeTime();
		if (now - lastContextResumeTime < CONTEXT_RESUME_RETRY_INTERVAL) {
			return;
		}
		this.#lastContextResumeTime = now;
		audioManager.resumeContext();
	}

	//==============================================================================
	// 누르기 전에 깨워 보기. (플랫폼이 허락할 때 처음 한 번, 웹뷰가 막으면 AudioContext 가 멈춘 채로 남고 첫 누름에 엔진이 깨운다)
	//==============================================================================
	tryAutoplay() {
		if (this.#isAutoplayTried) {
			return;
		}
		this.#isAutoplayTried = true;
		const autoplayAllowedProvider = this.getAutoplayAllowedProvider();
		if (autoplayAllowedProvider !== null && autoplayAllowedProvider() !== true) {
			return;
		}
		const audioManager = this.getAudioManager();
		audioManager.markUserGesture();
		audioManager.resumeContext();
	}

	//==============================================================================
	// 소리의 길 만들기. (첫 누름 뒤 한 번, AudioContext 를 그 전에 만들지 않게)
	//   - 엔진은 플레이어를 만들 때 AudioContext 를 만든다. 그 플레이어는 쓰지 않고 AudioContext 만 쓴다.
	//==============================================================================
	ensurePlayers() {
		if (this.getEffectBus() !== null) {
			return;
		}
		const audioManager = this.getAudioManager();
		if (!audioManager.hasUserGesture()) {
			return;
		}
		audioManager.createAudioPlayer();
		const audioContext = audioManager.getAudioContext();
		if (audioContext === null) {
			return;
		}
		this.#musicBus = audioContext.createGain();
		this.#musicBus.connect(audioContext.destination);
		this.#effectBus = audioContext.createGain();
		this.#effectBus.connect(audioContext.destination);
		this.#isMuted = false;
		this.applyVolumes();
	}

	//==============================================================================
	// 크기 적용. (음소거면 0)
	//==============================================================================
	applyVolumes() {
		const musicBus = this.getMusicBus();
		const effectBus = this.getEffectBus();
		if (musicBus === null || effectBus === null) {
			return;
		}
		const muteScale = this.#isMuted ? 0 : 1;
		const musicVolume = this.getMusicVolume();
		const musicScale = this.getMusicScale();
		const soundEffectVolume = this.getSoundEffectVolume();
		const currentTime = musicBus.context.currentTime;
		musicBus.gain.setTargetAtTime(musicVolume * musicScale * muteScale, currentTime, VOLUME_SMOOTHING_SECONDS);
		effectBus.gain.setTargetAtTime(soundEffectVolume * muteScale, currentTime, VOLUME_SMOOTHING_SECONDS);
	}

	//==============================================================================
	// 음소거 적용. (바뀔 때만, 음소거가 되면 나는 효과음을 끊음)
	//==============================================================================
	applyMute() {
		if (this.getEffectBus() === null) {
			return;
		}
		const isMuted = this.readMuted();
		if (isMuted === this.#isMuted) {
			return;
		}
		this.#isMuted = isMuted;
		if (isMuted) {
			this.stopEffects();
		}
		this.applyVolumes();
	}

	//==============================================================================
	// 음소거인 동안 AudioContext 멈추기와 풀리면 깨우기. (바뀔 때만, 첫 누름 전에는 AudioContext 가 없어 하지 않는다)
	//==============================================================================
	applyContextPause() {
		const audioManager = this.getAudioManager();
		const audioContext = audioManager.getAudioContext();
		if (audioContext === null) {
			return;
		}
		const isPaused = this.readMuted();
		if (isPaused === this.#isContextPaused) {
			return;
		}
		this.#isContextPaused = isPaused;
		if (isPaused) {
			if (audioContext.state === "running") {
				audioContext.suspend().catch((error) => {
					console.warn("[sound] AudioContext 를 멈추지 못했습니다.", error);
				});
			}
		}
		else {
			audioManager.resumeContext();
		}
	}

	//==============================================================================
	// 배경음악 틀기와 바꾸기. (AudioContext 가 돌고 받아 둔 것만, 음소거 중에도 소리 없이 돌아 풀면 이어 들립다)
	//   - 바꾸라고 하면 앞 음악은 곧바로 줄이기 시작하고(멈춘 자리를 기억), 새 음악은 받아 두었으면 0 에서 올린다.
	//==============================================================================
	updateMusic() {
		const musicBus = this.getMusicBus();
		if (musicBus === null || !this.isContextRunning()) {
			return;
		}
		const musicId = this.getMusicId();
		const playingMusic = this.#playingMusic;
		if (playingMusic !== null && playingMusic.soundId === musicId) {
			return;
		}
		const fadeSeconds = this.#musicFadeSeconds;
		if (playingMusic !== null) {
			this.fadeOutMusic(playingMusic, fadeSeconds);
			this.#playingMusic = null;
		}
		if (musicId === "") {
			return;
		}
		const soundRow = this.#soundById.get(musicId);
		const assets = this.#assetsById.get(musicId);
		if (soundRow === undefined || assets === undefined || assets[0] === null) {
			return;
		}
		const audioBuffer = assets[0].getAudioBuffer();
		if (!audioBuffer) {
			return;
		}
		const audioContext = musicBus.context;
		const now = audioContext.currentTime;
		const duration = audioBuffer.duration;
		const storedPosition = this.#musicPositions.has(musicId) ? this.#musicPositions.get(musicId) : 0;
		const offset = this.#isMusicResumed && duration > 0 ? storedPosition % duration : 0;
		const source = audioContext.createBufferSource();
		source.buffer = audioBuffer;
		source.loop = true;
		const gainNode = audioContext.createGain();
		const rowVolume = clampVolume(soundRow.volume);
		if (fadeSeconds > 0) {
			gainNode.gain.setValueAtTime(0, now);
			gainNode.gain.linearRampToValueAtTime(rowVolume, now + fadeSeconds);
		}
		else {
			gainNode.gain.value = rowVolume;
		}
		source.connect(gainNode);
		gainNode.connect(musicBus);
		source.start(0, offset);
		this.#playingMusic = { soundId: musicId, source: source, gain: gainNode, startTime: now, offset: offset, duration: duration };
	}

	//==============================================================================
	// 틀던 배경음악을 줄여 끄기. (fadeSeconds 동안, 다 줄어든 때의 자리를 기억)
	//==============================================================================
	/**
	 * @param { object } playingMusic
	 * @param { number } fadeSeconds
	 */
	fadeOutMusic(playingMusic, fadeSeconds) {
		const audioContext = playingMusic.gain.context;
		const now = audioContext.currentTime;
		const stopTime = now + fadeSeconds;
		if (playingMusic.duration > 0) {
			this.#musicPositions.set(playingMusic.soundId, (playingMusic.offset + stopTime - playingMusic.startTime) % playingMusic.duration);
		}
		const gainParameter = playingMusic.gain.gain;
		gainParameter.cancelScheduledValues(now);
		gainParameter.setValueAtTime(gainParameter.value, now);
		if (fadeSeconds > 0) {
			gainParameter.linearRampToValueAtTime(0, stopTime);
		}
		else {
			gainParameter.setValueAtTime(0, now);
		}
		try {
			playingMusic.source.stop(stopTime + VOLUME_SMOOTHING_SECONDS);
		}
		catch (error) {
			// 이미 멈춘 소리는 무시한다.
		}
	}
}


//==============================================================================
// 소리 줄의 파일들. (paths 가 있으면 그것, 없으면 path 하나)
//==============================================================================
/**
 * @param { object } soundRow
 * @returns { Array<string> }
 */
function readSoundPaths(soundRow) {
	if (System.Array.isArray(soundRow.paths)) {
		return soundRow.paths;
	}
	if (typeof soundRow.path === "string") {
		return [soundRow.path];
	}
	return [];
}

//==============================================================================
// 0 ~ 1 로 다듬기. (숫자가 아니면 0)
//==============================================================================
/**
 * @param { number } volume
 * @returns { number }
 */
function clampVolume(volume) {
	if (typeof volume !== "number" || !System.Number.isFinite(volume)) {
		return 0;
	}
	return System.Math.max(0, System.Math.min(1, volume));
}

//==============================================================================
// 함께 쓰는 소리 정하기.
//==============================================================================
/**
 * @param { SoundSystem } soundSystem
 */
export function setSoundSystem(soundSystem) {
	currentSoundSystem = soundSystem;
}

//==============================================================================
// 함께 쓰는 소리. (아직 없으면 null)
//==============================================================================
/**
 * @returns { SoundSystem | null }
 */
export function readSoundSystem() {
	return currentSoundSystem;
}
