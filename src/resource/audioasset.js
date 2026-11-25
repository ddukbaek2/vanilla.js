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
/**
 * @example <caption>소리 파일 읽고 길이 보기</caption>
 * import { AudioAsset } from "./build/vanilla.js";
 *
 * const audioAsset = new AudioAsset();
 * await audioAsset.load("examples/assets/beep.wav");
 * const audioBuffer = audioAsset.getAudioBuffer();
 * console.log(audioAsset.getDuration(), audioBuffer.sampleRate, audioAsset.getLoadError());
 */
export class AudioAsset extends Asset {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { AudioBuffer | null } */ #audioBuffer;
	/** @private @type { string | null } */ #loadError; // 마지막 읽기 실패의 까닭. (없으면 null)

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setAssetType(AssetType.audio);
		this.#audioBuffer = null;
		this.#loadError = null;
	}

	//==============================================================================
	// 비동기 애셋 로드.
	//==============================================================================
	/**
	 * @override
	 * @param { string } assetPath 소리 파일 경로. (이미 읽혔으면 아무것도 하지 않는다)
	 * @returns { Promise<void> } 다 읽으면 풀리는 프로미스. (받기나 디코딩이 실패하면 getLoadError 에 까닭을 남기고 거부된다, 디코딩할 수 없는 환경이면 까닭만 남기고 풀린다)
	 */
	async load(assetPath) {
		// 이미 로드 된 상태라면.
		const isLoaded = this.isLoaded();
		if (isLoaded) {
			return Promise.resolve();
		}

		this.#loadError = null;
		if (!isAudioDecodingSupported()) {
			this.#loadError = "AudioContext is not supported.";
			console.error(`AudioContext is not supported.`);
			return;
		}

		try {
			const response = await System.fetch(assetPath);
			// 실패 응답(404 등)은 디코딩 전에 실패로 친다.
			if (!response.ok) {
				throw new System.Error(`HTTP ${response.status}`);
			}
			const arrayBuffer = await response.arrayBuffer();
			await this.decodeArrayBuffer(arrayBuffer);
		}
		catch (error) {
			this.#loadError = `Error loading sound: ${assetPath} (${error})`;
			console.error(`Error loading sound: ${assetPath}`, error);
			throw error;
		}
	}

	//==============================================================================
	// 이미 가진 바이트로 읽기. (내장 자료나 직접 받은 파일, 디코딩이 끝나면 isLoaded() 가 참, 이미 읽혔으면 아무것도 하지 않는다)
	//==============================================================================
	/**
	 * @param { ArrayBuffer | ArrayBufferView } bytes 소리 파일의 바이트. (넘긴 것은 바뀌지 않는다)
	 * @example <caption>받아 둔 바이트로 소리 읽기</caption>
	 * import { AudioAsset } from "./build/vanilla.js";
	 *
	 * const response = await fetch("examples/assets/beep.wav");
	 * const bytes = await response.arrayBuffer();
	 * const audioAsset = new AudioAsset();
	 * await audioAsset.loadFromBytes(bytes);
	 * console.log(audioAsset.isLoaded(), audioAsset.getDuration(), bytes.byteLength);
	 */
	async loadFromBytes(bytes) {
		const isLoaded = this.isLoaded();
		if (isLoaded) {
			return;
		}
		this.#loadError = null;
		if (!isAudioDecodingSupported()) {
			this.#loadError = "AudioContext is not supported.";
			console.error(`AudioContext is not supported.`);
			return;
		}
		try {
			const arrayBuffer = copyToArrayBuffer(bytes);
			await this.decodeArrayBuffer(arrayBuffer);
		}
		catch (error) {
			this.#loadError = `Error loading sound from memory (${error})`;
			console.error(`Error loading sound from bytes`, error);
			throw error;
		}
	}

	//==============================================================================
	// 소리 바이트 디코딩. (다 되면 오디오 버퍼를 들고 읽힌 것으로 둔다)
	// - 디코딩은 OfflineAudioContext 로 한다. (스피커를 잡지 않고, user gesture 전에 만들어도 자동재생 경고가 없으며,
	//   여러 애셋을 한꺼번에 받아도 실시간 AudioContext 의 개수 제한에 걸리지 않는다) 없으면 잠시 쓰는 AudioContext 로 한다.
	//==============================================================================
	/**
	 * @param { ArrayBuffer } arrayBuffer 디코딩이 떼어 가므로 뒤에 다시 쓰지 않는다.
	 */
	async decodeArrayBuffer(arrayBuffer) {
		const offlineAudioContextType = System.window.OfflineAudioContext || System.window.webkitOfflineAudioContext;
		const audioContextType = System.window.AudioContext || System.window.webkitAudioContext;
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

	//==============================================================================
	// 마지막 읽기 실패의 까닭. (받기나 디코딩이 실패했으면 글, 아니면 null, 다시 읽기 시작하면 지운다)
	//==============================================================================
	/**
	 * @returns { string | null } 실패 까닭. (없으면 null)
	 */
	getLoadError() {
		return this.#loadError;
	}

	//==============================================================================
	// 오디오 버퍼 반환.
	//==============================================================================
	/**
	 * @returns { AudioBuffer | null } 디코딩한 오디오 버퍼. (읽기 전이면 null)
	 */
	getAudioBuffer() {
		return this.#audioBuffer;
	}

	//==============================================================================
	// 재생 시간 반환.
	//==============================================================================
	/**
	 * @returns { number } 재생 시간. (초, 읽기 전이면 0)
	 */
	getDuration() {
		if (this.#audioBuffer !== null && this.#audioBuffer !== undefined) {
			return this.#audioBuffer.duration;
		}
		return 0.0;
	}
}

//==============================================================================
// 바이트를 새 ArrayBuffer 로 복사. (ArrayBuffer 나 Uint8Array 같은 형식 배열, 디코딩이 받은 버퍼를 떼어 가도 넘긴 쪽은 그대로다)
//==============================================================================
/**
 * @param { ArrayBuffer | ArrayBufferView } bytes
 * @returns { ArrayBuffer }
 */
function copyToArrayBuffer(bytes) {
	if (bytes instanceof System.ArrayBuffer) {
		return bytes.slice(0);
	}
	const byteOffset = bytes.byteOffset;
	const byteLength = bytes.byteLength;
	return bytes.buffer.slice(byteOffset, byteOffset + byteLength);
}


//==============================================================================
// 소리를 디코딩할 수 있는지. (OfflineAudioContext 나 AudioContext 가 있으면)
//==============================================================================
/**
 * @returns { boolean }
 */
function isAudioDecodingSupported() {
	const offlineAudioContextType = System.window.OfflineAudioContext || System.window.webkitOfflineAudioContext;
	const audioContextType = System.window.AudioContext || System.window.webkitAudioContext;
	return offlineAudioContextType !== undefined || audioContextType !== undefined;
}
