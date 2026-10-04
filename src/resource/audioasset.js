//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Asset, AssetType } from "../core/asset.js";


// OfflineAudioContext 로 디코딩할 때의 샘플레이트. (재생하는 AudioContext 의 샘플레이트가 다르면 재생할 때 맞춰진다)
const DECODE_SAMPLE_RATE = 44100;


//==============================================================================
// 오디오 애셋.
//==============================================================================
export class AudioAsset extends Asset {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { AudioBuffer | null } */ #audioBuffer;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setAssetType(AssetType.audio);
		this.#audioBuffer = null;
	}

	//==============================================================================
	// 비동기 애셋 로드.
	//==============================================================================
	/**
	 * @override
	 * @param { string } assetPath
	 */
	async load(assetPath) {
		// 이미 로드 된 상태라면.
		const isLoaded = this.isLoaded();
		if (isLoaded) {
			return Promise.resolve();
		}

		// 디코딩은 OfflineAudioContext 로 한다. (스피커를 잡지 않고, user gesture 전에 만들어도 자동재생 경고가 없으며,
		//  여러 애셋을 한꺼번에 받아도 실시간 AudioContext 의 개수 제한에 걸리지 않는다) 없으면 잠시 쓰는 AudioContext 로 한다.
		const offlineAudioContextType = System.window.OfflineAudioContext || System.window.webkitOfflineAudioContext;
		const audioContextType = System.window.AudioContext || System.window.webkitAudioContext;
		if (!offlineAudioContextType && !audioContextType) {
			console.error(`AudioContext is not supported.`);
			return;
		}

		try {
			const response = await System.fetch(assetPath);
			const arrayBuffer = await response.arrayBuffer();
			if (offlineAudioContextType) {
				const decodeAudioContext = new offlineAudioContextType(1, 1, DECODE_SAMPLE_RATE);
				this.#audioBuffer = await decodeAudioContext.decodeAudioData(arrayBuffer);
			}
			else {
				const tempAudioContext = new audioContextType();
				this.#audioBuffer = await tempAudioContext.decodeAudioData(arrayBuffer);
				await tempAudioContext.close();
			}
			this.setLoaded(true);
		}
		catch (error) {
			console.error(`Error loading sound: ${assetPath}`, error);
			throw error;
		}
	}

	//==============================================================================
	// 오디오 버퍼 반환.
	//==============================================================================
	/**
	 * @returns { AudioBuffer | null }
	 */
	getAudioBuffer() {
		return this.#audioBuffer;
	}

	//==============================================================================
	// 재생 시간 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getDuration() {
		if (this.#audioBuffer !== null && this.#audioBuffer !== undefined) {
			return this.#audioBuffer.duration;
		}
		return 0.0;
	}
}
