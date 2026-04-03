//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Asset } from "../core/asset.js";


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

		const audioContextType = System.window.AudioContext || System.window.webkitAudioContext;
		if (!audioContextType) {
			console.error(`AudioContext is not supported.`);
			return;
		}

		try {
			const response = await System.fetch(assetPath);
			const arrayBuffer = await response.arrayBuffer();
			const tempAudioContext = new audioContextType();
			this.#audioBuffer = await tempAudioContext.decodeAudioData(arrayBuffer);
			await tempAudioContext.close();
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
