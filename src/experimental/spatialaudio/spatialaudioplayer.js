//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector3 } from "../../base/vector3.js";
import { AudioPlayer } from "../../core/audioplayer.js";
import { AudioAsset } from "../../resource/audioasset.js";
import { PannerSettings, calculateDistanceConeGain } from "./spatialaudiomath.js";


//==============================================================================
// 공간 소리 플레이어.
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - AudioPlayer 의 GainNode 뒤에 WebAudio PannerNode 를 끼운다. (소스 → GainNode → PannerNode → 버스나 출력) 음량, 음소거, 루프, 재생 위치, 빠르기는 AudioPlayer 그대로다.
// - 버스를 주면 그 버스로 낸다. SoundSystem 의 효과음 버스(getEffectBus)로 내면 설정의 효과음 크기와 음소거를 따른다.
// - 자리와 방향은 PannerNode 의 positionX ~ orientationZ 에 값으로 대입한다. (바뀐 칸만)
// - 설정은 WebAudio 가 받는 값만 받는다. (기준 거리 0 이상, 최대 거리 0 보다 큼, rolloff 0 이상, 원뿔 바깥 이득 0 ~ 1, 모두 유한) 아니면 거짓을 돌려주고 앞 값을 둔다.
// - 러스트 판(vanilla-engine)의 SpatialAudioPlayer 와 같은 꼴이다. (데스크탑은 엔진 믹서의 PannerNode 가 크롬과 같은 셈을 한다)
//==============================================================================
/**
 * @example <caption>효과음 버스로 내는 공간 소리</caption>
 * import { Engine, EngineConfiguration, AudioAsset, Vector3, Experimental } from "./build/vanilla.js";
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const audioManager = engine.getAudioManager();
 * const audioBus = audioManager.createAudioBus();
 * const player = new Experimental.SpatialAudioPlayer(audioManager, audioBus);
 * const audioAsset = new AudioAsset();
 * await audioAsset.load("examples/assets/beep.wav");
 * player.setAudioAsset(audioAsset);
 * player.setPanningModel(Experimental.PanningModel.Hrtf);
 * player.setCone(90, 240, 0.3);
 * player.setPosition(Vector3.create(2, 0, -1));
 * player.setVolume(0.8);
 * player.play(true);
 * console.log(player.getPosition().x, player.getSettings().coneOuterGain, player.setReferenceDistance(-1));
 */
export class SpatialAudioPlayer {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { AudioPlayer } */ #audioPlayer;
	/** @private @type { PannerNode | null } */ #pannerNode; // PannerNode. (AudioContext 가 없으면 null)
	/** @private @type { PannerSettings } */ #settings;
	/** @private @type { Vector3 } */ #position;
	/** @private @type { Vector3 } */ #orientation;

	//==============================================================================
	// 생성. (버스를 주면 그 버스로, 없으면 출력으로 낸다. AudioContext 가 없으면 소리 없는 플레이어)
	// - PannerNode 는 WebAudio 기본값이다. (등력, 역수, 기준 1, 최대 10000, rolloff 1, 원뿔 360 / 360 / 0, 자리 (0, 0, 0), 방향 (1, 0, 0))
	//==============================================================================
	/**
	 * @constructor
	 * @param { object } audioManager 엔진의 AudioManager. (engine.getAudioManager())
	 * @param { object | null } [audioBus] 소리를 낼 버스. (AudioBus, null 이면 출력)
	 */
	constructor(audioManager, audioBus = null) {
		let audioContext = null;
		let outputNode = null;
		if (audioBus !== null) {
			outputNode = audioBus.getGainNode();
			audioContext = outputNode !== null ? outputNode.context : null;
		}
		else {
			audioContext = audioManager.ensureAudioContext();
			outputNode = audioContext !== null ? audioContext.destination : null;
		}
		this.#pannerNode = null;
		if (audioContext !== null && outputNode !== null) {
			this.#pannerNode = audioContext.createPanner();
			this.#pannerNode.connect(outputNode);
		}
		this.#audioPlayer = new AudioPlayer(this.#pannerNode !== null ? audioContext : null, this.#pannerNode);
		this.#settings = new PannerSettings();
		this.#position = Vector3.create(0, 0, 0);
		this.#orientation = Vector3.create(1, 0, 0);
		this.#applySettings();
	}

	//==============================================================================
	// 안의 AudioPlayer. (음소거, 재생 위치, 빠르기 같은 나머지 기능)
	//==============================================================================
	/**
	 * @returns { AudioPlayer } 안의 플레이어.
	 */
	getAudioPlayer() {
		return this.#audioPlayer;
	}

	//==============================================================================
	// 틀 소리 애셋 설정. (다음 play 부터)
	//==============================================================================
	/**
	 * @param { AudioAsset } audioAsset 틀 소리 애셋.
	 */
	setAudioAsset(audioAsset) {
		this.#audioPlayer.setAudioAsset(audioAsset);
	}

	//==============================================================================
	// 재생. (AudioPlayer.play)
	//==============================================================================
	/**
	 * @param { boolean } [loop] 되풀이하면 참. (기본 거짓)
	 */
	play(loop = false) {
		this.#audioPlayer.play(loop);
	}

	//==============================================================================
	// 정지.
	//==============================================================================
	stop() {
		this.#audioPlayer.stop();
	}

	//==============================================================================
	// 재생 중인지. (끝까지 틀면 거짓)
	//==============================================================================
	/**
	 * @returns { boolean } 재생 중이면 참.
	 */
	isPlaying() {
		return this.#audioPlayer.isPlaying();
	}

	//==============================================================================
	// 음량 설정. (0 ~ 1 로 자르고, 유한하지 않으면 1. 거리와 원뿔 이득 앞의 GainNode)
	//==============================================================================
	/**
	 * @param { number } volume 음량.
	 */
	setVolume(volume) {
		this.#audioPlayer.setVolume(volume);
	}

	//==============================================================================
	// 음량. (0 ~ 1, 기본 1)
	//==============================================================================
	/**
	 * @returns { number } 음량.
	 */
	getVolume() {
		return this.#audioPlayer.getVolume();
	}

	//==============================================================================
	// 자리 설정. (WebAudio 좌표, 유한하지 않은 칸은 받지 않는다)
	//==============================================================================
	/**
	 * @param { Vector3 } position 자리.
	 */
	setPosition(position) {
		this.#position = this.#writeVector(this.#position, position, ["positionX", "positionY", "positionZ"]);
	}

	//==============================================================================
	// 자리. (기본 (0, 0, 0))
	//==============================================================================
	/**
	 * @returns { Vector3 } 자리의 복제본.
	 */
	getPosition() {
		return this.#position.clone();
	}

	//==============================================================================
	// 소리가 보는 방향 설정. (원뿔의 축, 길이는 상관없고 (0, 0, 0)이면 원뿔을 쓰지 않는다, 유한하지 않은 칸은 받지 않는다)
	//==============================================================================
	/**
	 * @param { Vector3 } orientation 방향.
	 */
	setOrientation(orientation) {
		this.#orientation = this.#writeVector(this.#orientation, orientation, ["orientationX", "orientationY", "orientationZ"]);
	}

	//==============================================================================
	// 소리가 보는 방향. (기본 (1, 0, 0))
	//==============================================================================
	/**
	 * @returns { Vector3 } 방향의 복제본.
	 */
	getOrientation() {
		return this.#orientation.clone();
	}

	//==============================================================================
	// 바뀐 칸만 AudioParam 에 대입하고 새 값을 돌려준다. (러스트 판처럼 float 로)
	//==============================================================================
	/**
	 * @private
	 * @param { Vector3 } previous 앞 값.
	 * @param { Vector3 } next 새 값.
	 * @param { string[] } paramNameList AudioParam 이름 셋.
	 * @returns { Vector3 } 받아들인 값.
	 */
	#writeVector(previous, next, paramNameList) {
		const previousList = [previous.x, previous.y, previous.z];
		const nextList = [next.x, next.y, next.z].map((value) => System.Math.fround(value));
		for (let index = 0; index < 3; ++index) {
			if (!System.Number.isFinite(nextList[index])) {
				nextList[index] = previousList[index];
				continue;
			}
			if (nextList[index] !== previousList[index] && this.#pannerNode !== null) {
				this.#pannerNode[paramNameList[index]].value = nextList[index];
			}
		}
		return Vector3.create(nextList[0], nextList[1], nextList[2]);
	}

	//==============================================================================
	// 설정 한꺼번에. (WebAudio 가 받지 않는 값이 하나라도 있으면 거짓을 돌려주고 아무것도 바꾸지 않는다)
	//==============================================================================
	/**
	 * @param { PannerSettings } settings 설정.
	 * @returns { boolean } 받았으면 참.
	 */
	setSettings(settings) {
		if (!(settings instanceof PannerSettings) || !settings.isValid()) {
			return false;
		}
		this.#settings = settings.clone();
		this.#applySettings();
		return true;
	}

	//==============================================================================
	// 설정을 PannerNode 에 건다.
	//==============================================================================
	/**
	 * @private
	 */
	#applySettings() {
		const pannerNode = this.#pannerNode;
		if (pannerNode === null) {
			return;
		}
		const settings = this.#settings;
		pannerNode.panningModel = settings.panningModel;
		pannerNode.distanceModel = settings.distanceModel;
		pannerNode.refDistance = settings.referenceDistance;
		pannerNode.maxDistance = settings.maximumDistance;
		pannerNode.rolloffFactor = settings.rolloffFactor;
		pannerNode.coneInnerAngle = settings.coneInnerAngle;
		pannerNode.coneOuterAngle = settings.coneOuterAngle;
		pannerNode.coneOuterGain = settings.coneOuterGain;
	}

	//==============================================================================
	// 설정.
	//==============================================================================
	/**
	 * @returns { PannerSettings } 설정의 복제본.
	 */
	getSettings() {
		return this.#settings.clone();
	}

	//==============================================================================
	// 한 칸만 바꾼 설정 걸기.
	//==============================================================================
	/**
	 * @private
	 * @param { object } change 바꿀 칸들.
	 * @returns { boolean } 받았으면 참.
	 */
	#changeSettings(change) {
		const settings = this.#settings.clone();
		System.Object.assign(settings, change);
		return this.setSettings(settings);
	}

	//==============================================================================
	// 좌우 방식 설정. (PanningModel, 러스트 데스크탑의 HRTF 는 아직 등력으로 셈한다)
	//==============================================================================
	/**
	 * @param { string } panningModel 좌우 방식.
	 */
	setPanningModel(panningModel) {
		this.#changeSettings({ panningModel });
	}

	//==============================================================================
	// 거리 모델 설정. (DistanceModel, 크롬은 이것만 바꾸면 자리나 다른 거리 값이 바뀔 때까지 앞 이득을 쓴다)
	//==============================================================================
	/**
	 * @param { string } distanceModel 거리 모델.
	 */
	setDistanceModel(distanceModel) {
		this.#changeSettings({ distanceModel });
	}

	//==============================================================================
	// 기준 거리 설정. (0 이상, 이 거리 안에서는 줄지 않는다)
	//==============================================================================
	/**
	 * @param { number } referenceDistance 기준 거리.
	 * @returns { boolean } 받았으면 참.
	 */
	setReferenceDistance(referenceDistance) {
		return this.#changeSettings({ referenceDistance });
	}

	//==============================================================================
	// 최대 거리 설정. (0 보다 큼, linear 는 여기서 가장 작아지고 나머지는 여기서 더 줄지 않는다)
	//==============================================================================
	/**
	 * @param { number } maximumDistance 최대 거리.
	 * @returns { boolean } 받았으면 참.
	 */
	setMaximumDistance(maximumDistance) {
		return this.#changeSettings({ maximumDistance });
	}

	//==============================================================================
	// 줄어드는 빠르기 설정. (0 이상)
	//==============================================================================
	/**
	 * @param { number } rolloffFactor 줄어드는 빠르기.
	 * @returns { boolean } 받았으면 참.
	 */
	setRolloffFactor(rolloffFactor) {
		return this.#changeSettings({ rolloffFactor });
	}

	//==============================================================================
	// 원뿔 설정. (안쪽 각과 바깥쪽 각은 도로 잰 각 전체, 바깥 이득은 0 ~ 1)
	//==============================================================================
	/**
	 * @param { number } innerAngle 안쪽 각.
	 * @param { number } outerAngle 바깥쪽 각.
	 * @param { number } outerGain 바깥 이득.
	 * @returns { boolean } 받았으면 참.
	 */
	setCone(innerAngle, outerAngle, outerGain) {
		return this.#changeSettings({ coneInnerAngle: innerAngle, coneOuterAngle: outerAngle, coneOuterGain: outerGain });
	}

	//==============================================================================
	// 지금 자리와 설정으로 본 거리 x 원뿔 이득. (크롬과 같은 셈, 음량과 버스는 넣지 않는다. 멀어 들리지 않는 소리를 거를 때)
	//==============================================================================
	/**
	 * @param { object } listener 리스너. (SpatialAudioListener)
	 * @returns { number } 거리 x 원뿔 이득.
	 */
	calculateGain(listener) {
		return calculateDistanceConeGain(this.#settings, this.#position, this.#orientation, listener.getPosition());
	}
}
