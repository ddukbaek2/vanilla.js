//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Engine } from "./engine.js";
import { Scene } from "./scene.js";
import { DecodedImageStore } from "./graphic/decodedimagestore.js";


//==============================================================================
// 상수 목록.
//==============================================================================
// 로딩 화면 동안 프레임마다 그림을 올리는 데 쓰는 시간. (밀리초, 유니티 QualitySettings.asyncUploadTimeSlice 기본값 2 와 같다)
const IMAGE_UPLOAD_TIME_SLICE_MILLISECONDS = 2;


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
			// 씬이 load 동안 읽기 시작한 그림은 이 엔진의 Graphic 이 주인이다. (엔진이 둘이면 남의 그림을 미리 올리지 않는다)
			const loadingGraphic = engine ? engine.getGraphic() : null;
			const loadingOwner = loadingGraphic ? loadingGraphic.getWebGL2RenderingContext() : null;
			if (loadingOwner !== null) {
				DecodedImageStore.beginLoading(loadingOwner);
			}
			try {
				await scene.load(engine);
			}
			finally {
				if (loadingOwner !== null) {
					DecodedImageStore.endLoading(loadingOwner);
				}
			}
			// 로딩 완료 후 추가 대기. (로딩 화면을 최소 0.3초 더 노출, 그동안 그림을 올린다)
			const minimumWaitPromise = new System.Promise((resolve) => {
				System.setTimeout(resolve, 300);
			});
			// 씬이 읽은 그림을 로딩 화면 동안 GPU 에 올린다. (첫 그리기 프레임에 풀기와 올리기가 몰리지 않게, 유니티와 언리얼의 로딩 때 올리기)
			// 프레임마다 시간 한도만큼 나눠 올려 로딩 화면이 멈추지 않게 한다.
			const graphic = engine ? engine.getGraphic() : null;
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