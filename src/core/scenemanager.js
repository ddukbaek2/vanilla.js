//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Engine } from "./engine.js";
import { Scene } from "./scene.js";


//==============================================================================
// 상수 목록.
//==============================================================================
// 로딩 화면 동안 프레임마다 그림을 올리는 데 쓰는 시간. (밀리초, 유니티 QualitySettings.asyncUploadTimeSlice 기본값 2 와 같다)
const IMAGE_UPLOAD_TIME_SLICE_MILLISECONDS = 2;
// 씬을 다 불러온 뒤에도 로딩 화면을 더 보이는 시간. (초, 러스트 판 SCENE_LOAD_EXTRA_WAIT_SECONDS 와 같다)
const SCENE_LOAD_EXTRA_WAIT_SECONDS = 0.3;


//==============================================================================
// 씬 매니저.
//==============================================================================
/**
 * @example <caption>씬을 겹쳐 불러오고 목록 보기</caption>
 * import { Engine, EngineConfiguration, Scene } from "./build/vanilla.js";
 *
 * class GameScene extends Scene {
 * }
 *
 * class HudScene extends Scene {
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * engine.run(new GameScene());
 * const sceneManager = engine.getSceneManager();
 * const hudScene = new HudScene();
 * await sceneManager.loadScene(hudScene);
 * const loadedScenes = sceneManager.getAllLoadedScenes();
 * const isHudSceneLoaded = hudScene.isLoaded();
 * console.log(loadedScenes.length, isHudSceneLoaded);
 * await sceneManager.unloadScene(hudScene);
 * console.log(loadedScenes.length);
 */
export class SceneManager extends Object {
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @private @type { Engine } */ #engine;
    /** @private @type { Scene[] } */ #loadedScenes;

    //==============================================================================
    // 생성.
    //==============================================================================
    /**
     * @constructor
     * @param { Engine } engine 씬을 불러올 때 넘길 엔진.
     */
    constructor(engine) {
        super();
        this.#engine = engine;
        this.#loadedScenes = [];
    }

	//==============================================================================
	// 씬 로드.
	//==============================================================================
	/**
	 * 
	 * @param { Scene } scene 불러올 씬. (Scene 이 아니거나 이미 불러온 씬이면 아무것도 하지 않는다)
	 */
	async loadScene(scene) {
        const engine = this.getEngine();
		const loadedScenes = this.getAllLoadedScenes();
		if (scene && scene instanceof Scene && !loadedScenes.includes(scene)) {
			scene.create();
			scene.setEngine(engine);
			loadedScenes.push(scene);
			// 찍기 모드는 불러오는 동안(애셋 받기처럼 실제 시간이 드는 것) 엔진 프레임 번호와 시계를 세운다. (다 받은 뒤부터 세어 받는 빠르기와 상관없이 같은 프레임에 같은 그림)
			// GameScene 과 UIScene 은 애셋을 다 받으면 스스로 풀고 최소 노출 시간을 엔진 시계로 센다.
			scene.setCaptureFrameHeld(true);
			try {
				await scene.load(engine);
			}
			finally {
				scene.setCaptureFrameHeld(false);
			}
			// 씬이 읽은 그림을 로딩 화면 동안 GPU 에 올린다. (첫 그리기 프레임에 풀기와 올리기가 몰리지 않게, 유니티와 언리얼의 로딩 때 올리기)
			const graphic = engine ? engine.getGraphic() : null;
			if (engine && engine.isCaptureTimeStepFixed()) {
				// 찍기 모드: 다 받은 뒤부터 로딩 화면 0.3 초를 엔진 시계(프레임마다 1/60 초)로 센다. (실제 시각으로 세면 씬이 처음 그려지는 프레임이 실행마다 밀린다, 러스트 판 찍기 모드와 같다)
				// 그림은 한 번에 다 올린다. (시간 한도로 나누면 기계 빠르기에 따라 프레임 수가 달라진다)
				if (graphic) {
					graphic.prepareLoadedImages();
				}
				// 다 센 프레임의 머리(씬 갱신 앞)에서 initialize 해 그 프레임부터 씬을 그린다. (러스트 판 initialize_scene_if_ready 와 같은 자리)
				const timeManager = engine.getTimeManager();
				const waitStartTime = timeManager.getRealtimeSinceStartup();
				await new System.Promise((resolve) => {
					engine.addEngineFrameCallback(() => {
						if (timeManager.getRealtimeSinceStartup() - waitStartTime < SCENE_LOAD_EXTRA_WAIT_SECONDS) {
							return false;
						}
						scene.setLoaded(true);
						scene.initialize(engine);
						resolve();
						return true;
					});
				});
			}
			else {
				// 로딩 완료 후 추가 대기. (로딩 화면을 최소 0.3초 더 노출, 그동안 그림을 올린다)
				const minimumWaitPromise = new System.Promise((resolve) => {
					System.setTimeout(resolve, SCENE_LOAD_EXTRA_WAIT_SECONDS * 1000);
				});
				// 프레임마다 시간 한도만큼 나눠 올려 로딩 화면이 멈추지 않게 한다.
				if (graphic) {
					while (graphic.prepareLoadedImages(IMAGE_UPLOAD_TIME_SLICE_MILLISECONDS) > 0) {
						// 다음 프레임까지 기다린다. (탭이 숨어 프레임이 멈추면 50 밀리초 뒤 이어 간다)
						await new System.Promise((resolve) => {
							const timeoutIdentifier = System.setTimeout(resolve, 50);
							if (typeof System.requestAnimationFrame === "function") {
								System.requestAnimationFrame(() => {
									System.clearTimeout(timeoutIdentifier);
									resolve();
								});
							}
						});
					}
				}
				await minimumWaitPromise;
				scene.setLoaded(true);
				scene.initialize(engine);
			}
		}
	}

	//==============================================================================
	// 씬 언로드.
	//==============================================================================
	/**
	 * 
	 * @param { Scene } scene 내릴 씬. (불러온 씬이 아니면 아무것도 하지 않는다)
	 */
	async unloadScene(scene) {
        const engine = this.getEngine();
		const loadedScenes = this.getAllLoadedScenes();
		if (scene && scene instanceof Scene && loadedScenes.includes(scene)) {
			scene.finalize(engine);
			await scene.unload(engine);
			// scene.destroy();
			const loadedSceneIndex = loadedScenes.indexOf(scene);
			loadedScenes.splice(loadedSceneIndex, 1);
		}
	}

	//==============================================================================
	// 모든 로드된 씬 언로드.
	//==============================================================================
	async unloadAllScenes() {
		const loadedScenes = this.getAllLoadedScenes();
		while (loadedScenes.length > 0) {
			const loadedScene = loadedScenes[0];
			await this.unloadScene(loadedScene);
		}
	}

    //==============================================================================
	// 엔진 반환.
	//==============================================================================
    /**
     * @returns { Engine } 이 매니저를 가진 엔진.
     */
    getEngine() {
        return this.#engine;
    }

	//==============================================================================
	// 모든 로드된 씬 반환.
	//==============================================================================
    /**
     * @returns { Scene[] } 불러온 씬 목록. (불러오기 시작한 차례, 안의 배열 그대로)
     */
    getAllLoadedScenes() {
        return this.#loadedScenes;
    }
}