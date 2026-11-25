# Sound

This chapter shows how to play loaded sound files and how to handle volume and muting separately for music and sound effects. It covers `AudioPlayer` for playing one sound, `AudioBus` for routing many sounds through one path, `SoundSystem` for handling music and effects together from a sound table, `SoundEffectPool` for overlapping the same effect, and `BeepPlayer` for synthesizing short tones without files. `AudioAsset`, which loads sound files, is in the "Loading Assets" chapter.

All sounds go through the single `AudioContext` owned by the engine's `AudioManager`. Get it with `engine.getAudioManager()`.

## Waking browser audio

Browsers do not let a page make sound until the person first interacts with it. Creating an `AudioContext` before that prints a console warning and leaves the context suspended. The engine handles this as follows.

- `AudioManager` creates the `AudioContext` the first time it is needed. `resumeContext()` does nothing before the first user input.
- The engine reports user input (`markUserGesture`) and wakes the context (`resumeContext`) on the window's `click`, `touchstart`, and `keydown`. It also tries to wake the context when the window gains focus or the page becomes visible again (this only works after the first input).
- Setting `EngineConfiguration.resumeAudioOnTouchEnd` to `true` also wakes on `touchend` and `pointerup`. The default is `false`, and it is read when the engine is created. Browsers do not treat `touchstart` as user activation, so games that are only dragged could not wake a context that iOS had suspended after an app switch or a fullscreen ad. Turn it on in games whose canvas handling prevents default actions so no `click` is produced.
- On iOS (including iPadOS), even when a woken context reports "running", the engine checks for 0.5 seconds whether its clock (`currentTime`) advances, and if it is stuck, suspends and wakes it again.
- `AudioManager.createAudioPlayer()` and `createAudioBus()` create the context on the spot if it does not exist. Calling them before the first input can print a warning, so it is best to create players after the first input.

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

## Playing one sound with AudioPlayer

`AudioPlayer` plays one `AudioAsset`. Load the asset into it with `setAudioAsset` and play it with `play(loop)`. The example below loads the sound in `load`, creates the player on the first press, and plays it on every press.

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

- `play(loop)` stops the sound if it is already playing and starts again from the beginning (or from the position set with `setTime`). If the context is suspended, it wakes it first and then plays.
- There are also `stop()`, `isPlaying()`, and `getDuration()` (seconds).
- `setVolume(volume)` clamps to 0 to 1. `mute()` sets the volume to 0, and `unmute()` returns to the set volume. A volume changed while muted takes effect on unmute.
- `setPlaybackRate(rate)` changes speed and pitch together. It applies from the next `play`, and values of 0 or less or non-numbers become 1.
- `setTime(seconds)` sets where `play` starts. If the sound is playing, it restarts from that position right away. `getTime()` returns the set start position and does not advance during playback.

## Grouping with AudioBus

`AudioBus` routes the sound of several players through one path and applies volume and mute to all of them at once. Create one with `audioManager.createAudioBus()`, and create players that play through it with `bus.createAudioPlayer()`. Volume and mute follow the same rules as `AudioPlayer`.

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

`isAvailable()` tells whether the bus was created while a context existed. A bus created without a context, and players created from it, make no sound. `getGainNode()` returns the bus's `GainNode`, for connecting other Web Audio nodes to the bus.

## Music and effects with SoundSystem

This class takes care of all the sound in a game. Give it a sound table, and it creates a music bus and an effect bus and handles volume settings, muting, and waking the context.

Each row of the sound table has these fields.

| Field | Meaning |
| --- | --- |
| `id` | Sound name |
| `path` or `paths` | One file, or a group of several recordings of the same sound. Effects pick one from the group each time and never the same one as last time. Music uses only the first file |
| `volume` | Per-sound volume (0 to 1). Non-numbers count as 0 |
| `isMusic` | `true` for music |
| `minimumInterval` | Interval before the same effect can play again (seconds) |
| `maximumVoices` | How many of the same effect can play at once. Beyond that, the oldest is cut. If omitted, up to the overall effect limit (12) |
| `pitchVariation` | Ratio by which pitch varies on each play. 0.05 means up or down 5% (0 if omitted) |
| `playSeconds`, `fadeOutSeconds` | Play only the first `playSeconds` seconds of an effect and fade it out over `fadeOutSeconds` seconds. If omitted or 0, plays to the end |

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

- The constructor is `new SoundSystem(engine.getAudioManager(), soundTable)`. To add rows later, use `addSounds(soundTable)` (rows with the same `id` are replaced), and for sounds not loaded from files, append them to that `id`'s group with `addSoundAsset(soundId, audioAsset)`. Volume and interval come from the table row with the same `id`, so the row must exist for it to play.
- `loadSounds()` loads effects together first and then music one at a time. Files that fail to load are skipped with a warning, and sounds already loaded are not loaded again.
- `update()` must be called by you every frame. The engine does not call it for you. Creating the buses after the first input, following mute state, re-waking the context (every 0.5 seconds), and starting music all happen here.
- `playMusic(soundId, fadeSeconds, isResumed)` plays music on loop. Over `fadeSeconds`, the previous music fades out and the new music rises from 0 (default 0, switch immediately). If `isResumed` is `true`, the music continues from where it stopped. Pass `""` to turn music off. If the sound is not loaded yet or there has been no input yet, it remembers the request and plays it then.
- `playEffect(soundId, volume, pan)` plays an effect. `volume` is the volume for this play (0 to 1, default 1), and `pan` is left to right (-1 left to 1 right, default 0). It silently does nothing while muted, before the first input, before loading, or within `minimumInterval`. Up to 12 effects play in total; beyond that, the oldest is cut.
- `stopEffects()` cuts all playing effects, and `fadeOutEffects(soundId, fadeSeconds)` fades them out (all of them when `soundId` is `""`). `getEffectVoiceCount()` is the number of effects playing.
- `setSoundSystem(soundSystem)` and `readSoundSystem()` are module functions that hold one shared `SoundSystem`. They are handy when several scenes use the same sounds.

### Volume

- Music volume is `setMusicVolume` (the music volume setting) times `setMusicScale` (the music scale) times the row's `volume`. The music scale is for lowering music separately from the setting, such as halving it while a pause window is open.
- Effect volume is `setSoundEffectVolume` times the row's `volume` times the `volume` passed to `playEffect`.
- All values are clamped to 0 to 1, and changes follow smoothly with a 0.05-second time constant so they do not cut abruptly.
- You can get the buses with `getMusicBus()` and `getEffectBus()` (`null` before the first input). Players created from the effect bus (`getEffectBus().createAudioPlayer()`) also follow the volume settings and muting. The volume settings are applied directly to the bus's `GainNode`, so values set with the bus's `setVolume` or `mute` only last until `SoundSystem` applies the volume again.

### Mute rules

Muting takes precedence over volume settings. If any of the following is true, no sound plays regardless of volume.

- Platform mute: the function given with `setExternalMuteProvider(() => boolean)` returns `true` (a platform SDK's mute setting, while a rewarded ad is showing, and so on). It is read every frame in `update`.
- The user's mute button: `setUserMuted(true)`.
- The page is hidden (another tab, app switch). This applies immediately.
- On touch-first devices (`(pointer: coarse)`), the window loses focus. On iPhone, the notification that the page is hidden arrives after the app has gone to the background, by which time audio is frozen, so the earlier focus loss is followed instead. Desktops do not follow this.

When muted, playing effects are cut, and music keeps running silently so it is heard again when unmuted. While muted, the `AudioContext` is also suspended, and it is woken when unmuted. Read the state with `isUserMuted()`, `isPageHidden()`, and `readMuted()`.

`setAutoplayAllowedProvider(() => boolean)` decides whether the system may try to wake audio once before the first input. If not given, it counts as allowed and tries once on the first `update`. On platforms whose web view blocks this, give a function that returns `false`.

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

Rotates through several `AudioPlayer`s so the same effect is not cut off when it overlaps itself. Create it with `new SoundEffectPool(audioManager, voiceCount)` (default 6). `play(audioAsset, volume)` loads the asset into the next player in turn and plays it; if that player was playing, it is cut and restarted. The volume for this play (0 to 1, default 1) is multiplied by the pool volume (`setVolume`), and changing the pool volume also applies to sounds already playing. There are also `setMuted`, `isMuted`, `stopAll`, and `getVoiceCount`.

The constructor creates its players right away, which creates the `AudioContext`. Create the pool after the first input, as below.

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

Synthesizes UI sound effects with `OscillatorNode` and `GainNode`, without sound files. It applies a short rise and fall at the start and end so tones do not click.

- Create it with `new BeepPlayer(audioManager, volume)`. The default volume is 0.35.
- Preset names for `playPreset(name)` are `"click"`, `"confirm"`, `"cancel"`, `"error"`, `"success"`, `"warning"`, and `"notification"`. Unknown names play the same sound as `"click"`.
- `playTone(frequency, durationSeconds, waveform, delaySeconds, volumeScale)` plays one tone. Frequency is in Hz, duration and delay in seconds. Defaults are duration 0.08, `"sine"`, delay 0, and scale 1; waveforms are `"sine"`, `"square"`, `"sawtooth"`, and `"triangle"`.
- `playSequence([{ frequency, duration, waveform, volumeScale }])` plays tones one after another (`waveform` and `volumeScale` may be omitted).
- There are also `setVolume`, `getVolume`, `setMuted`, and `isMuted`.

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

`BeepPlayer` only makes sound while the context is running (it tries to wake it when called). It sends sound straight to the output without a bus, so it does not follow `SoundSystem` volume and muting.

## Things to watch out for

- If a sound table row omits `volume`, it counts as 0 and the sound does not play. Always set it on every row.
- If `SoundSystem.update()` is not called, the buses are never created and nothing plays.
- Players created with `audioManager.createAudioPlayer()` and `BeepPlayer` connect straight to the output, so they do not follow `SoundSystem` volume settings and muting. To make them follow, create players with `soundSystem.getEffectBus().createAudioPlayer()`.
- `AudioAsset` may be loaded before the first input (decoding does not take the speakers). Only playback waits for the first input.
- The only example sound file in the repository is `examples/assets/beep.wav` (a short sound).

## Related classes

AudioAsset, AudioPlayer, AudioBus, SoundSystem, SoundEffectPool, BeepPlayer, EngineConfiguration, Engine
