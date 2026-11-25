# 소리

받은 소리 파일을 틀고, 배경음악과 효과음을 나눠 크기와 음소거를 다루는 방법을 봅니다. 소리 하나를 트는 `AudioPlayer`, 여러 소리를 한 길로 모으는 `AudioBus`, 소리 표로 배경음악과 효과음을 한꺼번에 다루는 `SoundSystem`, 같은 효과음을 겹쳐 트는 `SoundEffectPool`, 파일 없이 짧은 음을 합성하는 `BeepPlayer` 차례입니다. 소리 파일을 받는 `AudioAsset` 은 "애셋 불러오기" 장에 있습니다.

모든 소리는 엔진의 `AudioManager` 가 가진 `AudioContext` 하나로 납니다. `engine.getAudioManager()` 로 꺼냅니다.

## 브라우저의 오디오 깨우기

브라우저는 사람이 페이지를 처음 누르기 전에는 소리를 내지 못하게 합니다. 그 전에 `AudioContext` 를 만들면 콘솔에 경고가 나고 컨텍스트는 멈춘(suspended) 채로 있습니다. 엔진은 이렇게 맞춥니다.

- `AudioManager` 는 `AudioContext` 를 처음 쓸 때 만듭니다. `resumeContext()` 는 첫 사용자 입력 전에는 아무것도 하지 않습니다.
- 엔진은 창의 `click`, `touchstart`, `keydown` 에서 사용자 입력을 알리고(`markUserGesture`) 컨텍스트를 깨웁니다(`resumeContext`). 창이 포커스를 얻거나 페이지가 다시 보일 때도 깨우기를 해 봅니다(첫 입력 뒤에만 됩니다).
- `EngineConfiguration.resumeAudioOnTouchEnd` 를 `true` 로 두면 `touchend` 와 `pointerup` 에서도 깨웁니다. 기본은 `false` 이고 엔진을 만들 때 읽습니다. `touchstart` 는 브라우저가 사용자 활성화로 치지 않아서, 화면을 끌기만 하는 게임은 iOS 에서 앱 전환이나 전면 광고로 멈춘 컨텍스트를 다시 깨우지 못했습니다. 캔버스 조작이 기본 동작을 막아 `click` 이 생기지 않는 게임에서 켭니다.
- iOS(iPadOS 포함)에서는 깨운 컨텍스트가 "running" 이어도 0.5 초 동안 시계(`currentTime`)가 흐르는지 확인하고, 멈춰 있으면 멈췄다가 다시 깨웁니다.
- `AudioManager.createAudioPlayer()` 와 `createAudioBus()` 는 컨텍스트가 없으면 그 자리에서 만듭니다. 첫 입력 전에 부르면 경고가 날 수 있으므로 플레이어는 첫 입력 뒤에 만드는 것이 좋습니다.

```javascript
import { Engine, EngineConfiguration, Scene } from "./build/vanilla.js";

class MainScene extends Scene {
	touchPress(viewInputPosition) {
		super.touchPress(viewInputPosition);
		const engine = this.getEngine();
		const audioManager = engine.getAudioManager();
		console.log(audioManager.hasUserGesture(), audioManager.getContextTime());
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.resumeAudioOnTouchEnd = true;
const engine = new Engine(engineConfiguration);
engine.run(new MainScene());
```

## AudioPlayer 로 소리 하나 틀기

`AudioPlayer` 는 `AudioAsset` 하나를 틉니다. `setAudioAsset` 으로 애셋을 싣고 `play(loop)` 로 틉니다. 아래 예제는 `load` 에서 소리를 받아 두고, 처음 누를 때 플레이어를 만들어 누를 때마다 틉니다.

```javascript
import { Engine, EngineConfiguration, Scene, AudioAsset } from "./build/vanilla.js";

class SoundScene extends Scene {
	#audioAsset;
	#audioPlayer;

	constructor() {
		super();
		this.#audioAsset = new AudioAsset();
		this.#audioPlayer = null;
	}

	async load(engine) {
		await super.load(engine);
		await this.#audioAsset.load("examples/assets/beep.wav");
	}

	touchPress(viewInputPosition) {
		super.touchPress(viewInputPosition);
		if (this.#audioPlayer === null) {
			const engine = this.getEngine();
			const audioManager = engine.getAudioManager();
			this.#audioPlayer = audioManager.createAudioPlayer();
			this.#audioPlayer.setAudioAsset(this.#audioAsset);
			this.#audioPlayer.setVolume(0.8);
		}
		this.#audioPlayer.play(false);
	}
}

const engineConfiguration = new EngineConfiguration();
const engine = new Engine(engineConfiguration);
engine.run(new SoundScene());
```

- `play(loop)` 는 이미 나고 있으면 끊고 처음부터(또는 `setTime` 으로 정한 자리부터) 다시 틉니다. 컨텍스트가 멈춰 있으면 깨운 뒤 틉니다.
- `stop()`, `isPlaying()`, `getDuration()`(초) 이 있습니다.
- `setVolume(volume)` 은 0 ~ 1 로 자릅니다. `mute()` 하면 크기가 0 이 되고, `unmute()` 하면 설정한 크기로 돌아갑니다. 음소거 중에 바꾼 크기는 음소거를 풀 때 걸립니다.
- `setPlaybackRate(rate)` 은 빠르기와 음 높이를 함께 바꿉니다. 다음 `play` 부터 걸리고, 0 이하이거나 숫자가 아니면 1 입니다.
- `setTime(seconds)` 는 `play` 가 시작할 자리를 정합니다. 나고 있는 중이면 그 자리부터 바로 다시 틉니다. `getTime()` 은 정한 시작 자리를 돌려주고, 재생하면서 늘지는 않습니다.

## AudioBus 로 묶기

`AudioBus` 는 여러 플레이어의 소리를 한 길로 모아 크기와 음소거를 한꺼번에 겁니다. `audioManager.createAudioBus()` 로 만들고, 그 버스로 트는 플레이어는 `bus.createAudioPlayer()` 로 만듭니다. 크기와 음소거 규칙은 `AudioPlayer` 와 같습니다.

```javascript
import { Engine, EngineConfiguration, Scene, AudioAsset } from "./build/vanilla.js";

class BusScene extends Scene {
	#audioAsset;
	#effectBus;
	#effectPlayer;

	constructor() {
		super();
		this.#audioAsset = new AudioAsset();
		this.#effectBus = null;
		this.#effectPlayer = null;
	}

	async load(engine) {
		await super.load(engine);
		await this.#audioAsset.load("examples/assets/beep.wav");
	}

	touchPress(viewInputPosition) {
		super.touchPress(viewInputPosition);
		if (this.#effectBus === null) {
			const engine = this.getEngine();
			const audioManager = engine.getAudioManager();
			this.#effectBus = audioManager.createAudioBus();
			this.#effectBus.setVolume(0.5);
			this.#effectPlayer = this.#effectBus.createAudioPlayer();
			this.#effectPlayer.setAudioAsset(this.#audioAsset);
		}
		this.#effectPlayer.play(false);
	}
}

const engineConfiguration = new EngineConfiguration();
const engine = new Engine(engineConfiguration);
engine.run(new BusScene());
```

`isAvailable()` 은 컨텍스트가 있을 때 만든 버스인지 알려 줍니다. 컨텍스트 없이 만든 버스와 그 버스로 만든 플레이어는 소리를 내지 않습니다. `getGainNode()` 는 버스의 `GainNode` 를 돌려주어 다른 Web Audio 노드를 버스에 이을 때 씁니다.

## SoundSystem 으로 배경음악과 효과음 다루기

게임 하나의 소리를 모두 맡는 클래스입니다. 소리 표를 넘기면 배경음악 버스와 효과음 버스를 만들고, 설정 크기, 음소거, 컨텍스트 깨우기를 알아서 챙깁니다.

소리 표의 줄마다 다음 칸을 둡니다.

| 칸 | 뜻 |
| --- | --- |
| `id` | 소리 이름 |
| `path` 또는 `paths` | 파일 하나, 또는 같은 소리를 여러 번 녹음한 무리. 효과음은 낼 때마다 무리에서 하나를 고르고 바로 앞과 같은 것은 고르지 않습니다. 배경음악은 첫 파일만 씁니다 |
| `volume` | 소리마다의 크기 (0 ~ 1). 숫자가 아니면 0 으로 칩니다 |
| `isMusic` | 배경음악이면 `true` |
| `minimumInterval` | 같은 효과음을 다시 낼 수 있는 간격 (초) |
| `maximumVoices` | 같은 효과음이 한꺼번에 날 수 있는 수. 넘으면 가장 오래된 것을 끊습니다. 없으면 효과음 전체 상한(12)까지 |
| `pitchVariation` | 낼 때마다 음 높이를 흔드는 비. 0.05 면 위아래 5% (없으면 0) |
| `playSeconds`, `fadeOutSeconds` | 효과음의 앞 `playSeconds` 초만 틀고 `fadeOutSeconds` 초 동안 줄여 끕니다. 없거나 0 이면 끝까지 |

```javascript
import { Engine, EngineConfiguration, Scene, SoundSystem, setSoundSystem, readSoundSystem } from "./build/vanilla.js";

const soundTable = [
	{ id: "music", path: "examples/assets/beep.wav", volume: 0.4, isMusic: true },
	{ id: "click", paths: ["examples/assets/beep.wav"], volume: 1, minimumInterval: 0.05, maximumVoices: 4, pitchVariation: 0.05 },
];

class MusicScene extends Scene {
	async load(engine) {
		await super.load(engine);
		const audioManager = engine.getAudioManager();
		const soundSystem = new SoundSystem(audioManager, soundTable);
		setSoundSystem(soundSystem);
		soundSystem.setMusicVolume(0.8);
		soundSystem.setSoundEffectVolume(1);
		await soundSystem.loadSounds();
		soundSystem.playMusic("music", 1);
	}

	tick(timeDelta) {
		super.tick(timeDelta);
		const soundSystem = readSoundSystem();
		if (soundSystem !== null) {
			soundSystem.update();
		}
	}

	touchPress(viewInputPosition) {
		super.touchPress(viewInputPosition);
		const soundSystem = readSoundSystem();
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		const viewSize = viewManager.getViewSize();
		const pan = (viewInputPosition.x / viewSize.x) * 2 - 1;
		soundSystem.playEffect("click", 1, pan);
	}
}

const engineConfiguration = new EngineConfiguration();
const engine = new Engine(engineConfiguration);
engine.run(new MusicScene());
```

- 생성자는 `new SoundSystem(engine.getAudioManager(), soundTable)` 입니다. 줄을 더 넣을 때는 `addSounds(soundTable)`(같은 `id` 는 바꿈)를 쓰고, 파일로 받지 않는 소리는 `addSoundAsset(soundId, audioAsset)` 으로 그 `id` 의 무리에 덧붙입니다. 크기와 간격은 같은 `id` 의 표 줄을 따르므로 줄이 있어야 납니다.
- `loadSounds()` 는 효과음을 먼저 함께 받고 배경음악을 나중에 하나씩 받습니다. 못 받은 파일은 경고만 내고 건너뛰고, 이미 받은 것은 다시 받지 않습니다.
- `update()` 는 매 프레임 직접 불러야 합니다. 엔진이 대신 부르지 않습니다. 첫 입력 뒤 버스 만들기, 음소거 따르기, 컨텍스트 다시 깨우기(0.5 초마다), 배경음악 틀기가 여기서 일어납니다.
- `playMusic(soundId, fadeSeconds, isResumed)` 는 배경음악을 반복해 틉니다. `fadeSeconds` 동안 앞 음악은 줄고 새 음악은 0 에서 오릅니다(기본 0, 바로 바꿈). `isResumed` 가 `true` 면 그 음악을 멈췄던 자리에서 잇습니다. `""` 를 주면 끕니다. 아직 받기 전이거나 첫 입력 전이면 기억해 두었다가 그때 틉니다.
- `playEffect(soundId, volume, pan)` 은 효과음을 냅니다. `volume` 은 이번 크기(0 ~ 1, 기본 1), `pan` 은 좌우(-1 왼쪽 ~ 1 오른쪽, 기본 0)입니다. 음소거, 첫 입력 전, 받기 전, `minimumInterval` 안이면 내지 않고 넘어갑니다. 효과음은 모두 합쳐 12 개까지 나고, 넘으면 가장 오래된 것을 끊습니다.
- `stopEffects()` 는 나는 효과음을 모두 끊고, `fadeOutEffects(soundId, fadeSeconds)` 는 줄여 끕니다(`soundId` 가 `""` 이면 모두). `getEffectVoiceCount()` 는 나고 있는 효과음 수입니다.
- `setSoundSystem(soundSystem)` 과 `readSoundSystem()` 은 함께 쓰는 `SoundSystem` 하나를 담아 두는 모듈 함수입니다. 씬이 바뀌어도 같은 소리를 쓸 때 편합니다.

### 크기

- 배경음악 크기는 `setMusicVolume`(설정의 음악 크기) 곱하기 `setMusicScale`(음악의 비) 곱하기 줄의 `volume` 입니다. 음악의 비는 멈춤 창이 떠 있는 동안 반으로 줄이는 것처럼 설정과 따로 줄일 때 씁니다.
- 효과음 크기는 `setSoundEffectVolume` 곱하기 줄의 `volume` 곱하기 `playEffect` 의 `volume` 입니다.
- 모두 0 ~ 1 로 자르고, 바꿀 때 시간 상수 0.05 초로 부드럽게 따라가 툭 끊기지 않습니다.
- `getMusicBus()`, `getEffectBus()` 로 버스를 꺼낼 수 있습니다(첫 입력 전에는 `null`). 효과음 버스로 만든 플레이어(`getEffectBus().createAudioPlayer()`)도 설정 크기와 음소거를 따릅니다. 설정 크기는 버스의 `GainNode` 에 직접 걸므로, 버스의 `setVolume`, `mute` 로 건 값은 `SoundSystem` 이 크기를 다시 걸 때까지만 갑니다.

### 음소거 규칙

음소거는 설정한 크기보다 먼저입니다. 아래 가운데 하나라도 맞으면 크기 설정과 상관없이 소리가 나지 않습니다.

- 플랫폼의 음소거. `setExternalMuteProvider(() => boolean)` 로 준 함수가 `true` 를 돌려줄 때입니다(플랫폼 SDK 의 음소거 설정, 보상형 광고를 보이는 동안 같은 것). 매 프레임 `update` 에서 읽습니다.
- 사용자의 음소거 단추. `setUserMuted(true)`.
- 페이지가 가려짐(다른 탭, 앱 전환). 그 순간에 걸립니다.
- 터치가 주된 기기(`(pointer: coarse)`)에서 창이 포커스를 잃음. 아이폰은 페이지가 가려졌다는 알림이 앱이 내려간 뒤에 와서 오디오가 얼어 버리므로, 그보다 먼저 오는 포커스 잃음을 따릅니다. 데스크탑은 따르지 않습니다.

음소거가 되면 나는 효과음을 끊고, 배경음악은 소리 없이 계속 돌아 풀리면 이어 들립니다. 음소거인 동안은 `AudioContext` 도 멈추고(suspend) 풀리면 깨웁니다. `isUserMuted()`, `isPageHidden()`, `readMuted()` 로 상태를 읽습니다.

`setAutoplayAllowedProvider(() => boolean)` 는 첫 입력 전에 한 번 깨워 봐도 되는지 정합니다. 주지 않으면 허락으로 치고 첫 `update` 에서 한 번 깨워 봅니다. 웹뷰가 막는 플랫폼이면 `false` 를 돌려주는 함수를 줍니다.

```javascript
import { Engine, EngineConfiguration, Scene, SoundSystem } from "./build/vanilla.js";

const engineConfiguration = new EngineConfiguration();
const engine = new Engine(engineConfiguration);
const audioManager = engine.getAudioManager();
const soundSystem = new SoundSystem(audioManager, [
	{ id: "click", path: "examples/assets/beep.wav", volume: 1 },
]);
let isAdShowing = false;
soundSystem.setExternalMuteProvider(() => {
	return isAdShowing;
});
soundSystem.setAutoplayAllowedProvider(() => {
	return true;
});
soundSystem.setUserMuted(false);
soundSystem.setMusicScale(0.5);
console.log(soundSystem.readMuted(), soundSystem.getMusicScale());

class MainScene extends Scene {
	async load(engine) {
		await super.load(engine);
		await soundSystem.loadSounds();
	}

	tick(timeDelta) {
		super.tick(timeDelta);
		soundSystem.update();
	}

	touchPress(viewInputPosition) {
		super.touchPress(viewInputPosition);
		isAdShowing = !isAdShowing;
	}
}

engine.run(new MainScene());
```

## SoundEffectPool

같은 효과음이 연달아 겹쳐 나도 끊기지 않게 `AudioPlayer` 여러 개를 돌려 가며 틉니다. `new SoundEffectPool(audioManager, voiceCount)` 로 만들고(기본 6), `play(audioAsset, volume)` 는 다음 차례 플레이어에 애셋을 실어 틉니다. 그 플레이어가 나고 있었으면 끊고 새로 틉니다. 이번 크기(0 ~ 1, 기본 1)에 풀 전체 크기(`setVolume`)를 곱하며, 풀 크기를 바꾸면 나고 있는 것에도 바로 곱해집니다. `setMuted`, `isMuted`, `stopAll`, `getVoiceCount` 도 있습니다.

생성자가 플레이어를 바로 만들므로 이때 `AudioContext` 가 생깁니다. 아래처럼 첫 입력 뒤에 만듭니다.

```javascript
import { Engine, EngineConfiguration, Scene, AudioAsset, SoundEffectPool } from "./build/vanilla.js";

class PoolScene extends Scene {
	#audioAsset;
	#soundEffectPool;

	constructor() {
		super();
		this.#audioAsset = new AudioAsset();
		this.#soundEffectPool = null;
	}

	async load(engine) {
		await super.load(engine);
		await this.#audioAsset.load("examples/assets/beep.wav");
	}

	touchPress(viewInputPosition) {
		super.touchPress(viewInputPosition);
		if (this.#soundEffectPool === null) {
			const engine = this.getEngine();
			const audioManager = engine.getAudioManager();
			this.#soundEffectPool = new SoundEffectPool(audioManager, 6);
			this.#soundEffectPool.setVolume(0.8);
		}
		this.#soundEffectPool.play(this.#audioAsset, 0.5);
	}
}

const engineConfiguration = new EngineConfiguration();
const engine = new Engine(engineConfiguration);
engine.run(new PoolScene());
```

## BeepPlayer

소리 파일 없이 `OscillatorNode` 와 `GainNode` 로 UI 효과음을 합성합니다. 소리가 툭 튀지 않게 시작과 끝에 짧은 오르내림을 겁니다.

- `new BeepPlayer(audioManager, volume)` 로 만듭니다. 기본 크기는 0.35 입니다.
- `playPreset(name)` 의 이름은 `"click"`, `"confirm"`, `"cancel"`, `"error"`, `"success"`, `"warning"`, `"notification"` 입니다. 모르는 이름이면 `"click"` 과 같은 소리를 냅니다.
- `playTone(frequency, durationSeconds, waveform, delaySeconds, volumeScale)` 은 음 하나를 냅니다. 주파수는 Hz, 길이와 지연은 초입니다. 기본값은 길이 0.08, `"sine"`, 지연 0, 배율 1 이고, 파형은 `"sine"`, `"square"`, `"sawtooth"`, `"triangle"` 입니다.
- `playSequence([{ frequency, duration, waveform, volumeScale }])` 은 음을 차례로 잇습니다(`waveform`, `volumeScale` 은 빼도 됩니다).
- `setVolume`, `getVolume`, `setMuted`, `isMuted` 가 있습니다.

```javascript
import { Engine, EngineConfiguration, Scene, BeepPlayer } from "./build/vanilla.js";

const engineConfiguration = new EngineConfiguration();
const engine = new Engine(engineConfiguration);
const audioManager = engine.getAudioManager();
const beepPlayer = new BeepPlayer(audioManager, 0.3);

class BeepScene extends Scene {
	touchPress(viewInputPosition) {
		super.touchPress(viewInputPosition);
		beepPlayer.playPreset("confirm");
		beepPlayer.playSequence([
			{ frequency: 523, duration: 0.1 },
			{ frequency: 659, duration: 0.1, waveform: "triangle" },
			{ frequency: 784, duration: 0.2, volumeScale: 0.6 },
		]);
	}
}

engine.run(new BeepScene());
```

`BeepPlayer` 는 컨텍스트가 돌고 있을 때만 소리를 냅니다(부를 때 깨우기를 해 봅니다). 소리를 버스를 거치지 않고 출력에 바로 내므로 `SoundSystem` 의 크기와 음소거를 따르지 않습니다.

## 주의할 점

- 소리 표 줄의 `volume` 을 빼면 0 으로 쳐서 그 소리가 나지 않습니다. 줄마다 꼭 적습니다.
- `SoundSystem.update()` 를 부르지 않으면 버스가 만들어지지 않아 아무 소리도 나지 않습니다.
- `audioManager.createAudioPlayer()` 로 만든 플레이어와 `BeepPlayer` 는 출력에 바로 이어지므로 `SoundSystem` 의 설정 크기와 음소거를 따르지 않습니다. 따르게 하려면 `soundSystem.getEffectBus().createAudioPlayer()` 로 만듭니다.
- `AudioAsset` 은 첫 입력 전에 받아도 됩니다(디코딩은 스피커를 잡지 않습니다). 트는 것만 첫 입력 뒤에 됩니다.
- 저장소의 예제 소리 파일은 `examples/assets/beep.wav`(짧은 소리) 하나입니다.

## 관련 클래스

AudioAsset, AudioPlayer, AudioBus, SoundSystem, SoundEffectPool, BeepPlayer, EngineConfiguration, Engine
