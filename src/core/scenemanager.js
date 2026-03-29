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
     * @param { Engine } engine 
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
	 * @param { Scene } scene 
	 */
	async loadScene(scene) {
        const engine = this.getEngine();
		if (scene && scene instanceof Scene && !this.#loadedScenes.includes(scene)) {
			scene.create();
			await scene.load(engine);
			scene.initialize(engine);
			this.#loadedScenes.push(scene);
		}
	}

	//==============================================================================
	// 씬 언로드.
	//==============================================================================
	/**
	 * 
	 * @param { Scene } scene 
	 */
	async unloadScene(scene) {
        const engine = this.getEngine();
		if (scene && scene instanceof Scene && this.#loadedScenes.includes(scene)) {
			scene.finalize(engine);
			await scene.unload(engine);
			// scene.destroy();
			this.#loadedScenes.splice(this.#loadedScenes.indexOf(scene), 1);
		}
	}

	//==============================================================================
	// 모든 로드된 씬 언로드.
	//==============================================================================
	async unloadAllScenes() {
		while (this.#loadedScenes.length > 0) {
			const loadedScene = this.#loadedScenes[0];
			await this.unloadScene(loadedScene);
		}
	}

    //==============================================================================
	// 엔진 반환.
	//==============================================================================
    /**
     * @returns { Engine }
     */
    getEngine() {
        return this.#engine;
    }

	//==============================================================================
	// 모든 로드된 씬 반환.
	//==============================================================================
    /**
     * @returns { Scene[] }
     */
    getAllLoadedScenes() {
        return this.#loadedScenes;
    }
}