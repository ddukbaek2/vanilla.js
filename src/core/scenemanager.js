//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Engine } from "./engine.js";
import { Scene } from "./scene.js";


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
			await scene.load(engine);
			// 로딩 완료 후 추가 대기. (로딩 화면을 최소 0.3초 더 노출)
			await new System.Promise((resolve) => {
				System.setTimeout(resolve, 300);
			});
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