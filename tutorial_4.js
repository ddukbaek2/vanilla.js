//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import * as Math from "./src/base/math.js";
import { Object } from "./src/base/object.js";
import { Vector2 } from "./src/base/vector2.js";
import { Pivot } from "./src/base/pivot.js";
import { Engine } from "./src/core/engine.js";
import { Graphic } from "./src/core/graphic.js";
import { Tween } from "./src/core/tween.js";
import { Enum } from "./src/base/identifier.js";
import { Sprite as SpriteComponent } from "./src/component/sprite.js";
import { Label as LabelComponent } from "./src/component/label.js";
import { ImageAsset } from "./src/resource/imageasset.js";
import { AudioAsset } from "./src/resource/audioasset.js";
import { FontAsset } from "./src/resource/fontasset.js";
import { TransformNode } from "./src/core/node/transformnode.js";
import { AnchoredWorldNode } from "./src/core/node/anchoredworldmnode.js";
import { Scene } from "./src/core/scene.js";


//==============================================================================
// 튜토리얼4: UI.
//==============================================================================
class Tutorial_4 extends Scene {
	async load(engine) {
		await super.load(engine);

		const root = this.getRoot();
		root.setLocalOpacity(1);

		const node = new AnchoredWorldNode();
		// 추가.
		root.addChild(node);
	}
}


// 엔진 실행.
const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vec2.create(800, 1280);
engineConfiguration.canvasId = "tutorialCanvas";
engineConfiguration.useStatistics = true;
const engine = new Engine(engineConfiguration);
document.title = "vanilla.js - Tutorial_4";
const tutorial = new Tutorial_4();
engine.run(tutorial);