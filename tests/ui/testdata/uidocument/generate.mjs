//==============================================================================
// UIDocument 시험의 기대값 뽑기. (원본 vanilla.js 를 node 로 돌려 원본이 실제로 적는 JSON 을 쓴다)
// - 사용: node generate.mjs <vanilla.js 저장소 경로> <쓸 폴더>
// - editor_components.json: 원본 에디터가 등록하는 컴포넌트(엔진이 내보내는 Component 하위 클래스)마다 빈 노드에 붙인 serializeNode.
// - editor_node_types.json: 원본 에디터가 등록하는 노드 종류(WorldNode 하위 클래스)마다 new 한 serializeNode.
// - editor_palette.json, editor_palette_before_tick.json: 원본 에디터 addWidgetNode 의 팔레트 15 종을 팔레트 차례로 지은 toJsonText. (한 번 tick 한 뒤, 하기 전)
// - inspector_getters.json: 원본 DevTools.getComponentProperties 가 보이는 게터 이름. (노드에 붙인 컴포넌트)
// - reflected_properties.json: 원본 UIDocument.getReflectedProperties 의 이름과 saveByReflection. (노드에 붙인 컴포넌트)
//==============================================================================
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const repositoryPath = path.resolve(process.argv[2]);
const outputPath = path.resolve(process.argv[3]);
// 윈도우의 절대 경로(D:\...)는 import 가 못 받아 file:// 주소로 바꿔 넘긴다.
const Engine = await import(url.pathToFileURL(path.join(repositoryPath, "import.js")).href);
const { UIDocument, WorldNode, Component, Pivot, Vector2, Color } = Engine;
// 문서 하나로 뽑는다. (엔진 기본 종류만 등록한 새 문서, 에디터 종류는 등록하지 않는다)
const uiDocument = new UIDocument();

// 원본 에디터가 등록하는 종류. (tools/uieditor/uieditor.js 의 등록 고리와 같은 판정, 내보낸 이름 차례)
const componentTypeNames = [];
const nodeTypeNames = [];
for (const exportName of Object.keys(Engine)) {
	const candidateType = Engine[exportName];
	if (typeof candidateType !== "function" || !candidateType.prototype) {
		continue;
	}
	if (candidateType.prototype instanceof Component) {
		componentTypeNames.push(exportName);
	}
	else if (candidateType.prototype instanceof WorldNode) {
		nodeTypeNames.push(exportName);
	}
}

// 원본 misc/devtools.js 의 getComponentProperties 를 그대로 부른다. (부르기만 하고 이름을 모은다, 인스턴스 상태를 쓰지 않는 함수)
const { DevTools } = await import(url.pathToFileURL(path.join(repositoryPath, "src/misc/devtools.js")).href);
function collectGetterNames(component) {
	return DevTools.prototype.getComponentProperties.call(null, component).map((property) => property.name);
}

const componentDocuments = {};
const inspectorGetters = {};
const reflectedProperties = {};
for (const typeName of componentTypeNames) {
	const documentNode = new WorldNode();
	documentNode.setName(typeName);
	documentNode.addComponent(Engine[typeName]);
	componentDocuments[typeName] = uiDocument.serializeNode(documentNode);
	const inspectedNode = new WorldNode();
	const component = inspectedNode.addComponent(Engine[typeName]);
	inspectorGetters[typeName] = collectGetterNames(component);
	reflectedProperties[typeName] = {
		properties: UIDocument.getReflectedProperties(component).map((property) => property.name),
		save: uiDocument.saveByReflection(component),
	};
}
const nodeTypeDocuments = {};
for (const typeName of nodeTypeNames) {
	nodeTypeDocuments[typeName] = uiDocument.serializeNode(new Engine[typeName]());
}

// 원본 에디터 addWidgetNode 의 팔레트. (PALETTE_DEFINITIONS 차례, 형제 수로 어긋난 자리)
const DEFAULT_ROUND_SIZE = 16;
const PALETTE_KINDS = ["empty", "panel", "divider", "text", "richText", "image", "button", "toggleButton", "inputField", "progress", "slider", "scrollView", "snapScrollView", "scrollBar", "mask"];
function buildPaletteDocument(isTicked) {
	const documentRoot = new WorldNode();
	documentRoot.setName("documentRoot");
	documentRoot.setPivot(Pivot.topLeft.clone());
	documentRoot.setAnchor(Pivot.topLeft.clone());
	let nodeSerialNumber = 0;
	for (const widgetKind of PALETTE_KINDS) {
		nodeSerialNumber += 1;
		let newNode = null;
		if (widgetKind === "inputField") {
			newNode = new Engine.UIInputField();
		}
		else if (widgetKind === "scrollBar") {
			newNode = new Engine.UIScrollBar();
		}
		else {
			newNode = new WorldNode();
		}
		newNode.setPivot(Pivot.topLeft.clone());
		newNode.setAnchor(Pivot.topLeft.clone());
		newNode.setLocalPosition(Vector2.create(60, 60));
		const addPaint = (color, roundSize) => {
			const paint = newNode.addComponent(Engine.Paint);
			paint.setColor(color);
			if (roundSize !== undefined) {
				paint.setRoundSize(roundSize);
			}
		};
		const addLabel = (text, fontSize, textColor) => {
			const label = newNode.addComponent(Engine.UILabel);
			label.setText(text);
			label.setFontSize(fontSize);
			label.setTextColor(textColor);
		};
		if (widgetKind === "text") {
			newNode.setName("Label" + nodeSerialNumber);
			newNode.setContentSize(Vector2.create(200, 36));
			addLabel("Label", 20, new Color(0.15, 0.15, 0.15, 1));
		}
		else if (widgetKind === "button" || widgetKind === "toggleButton") {
			newNode.setName((widgetKind === "button" ? "Button" : "Toggle") + nodeSerialNumber);
			newNode.setContentSize(Vector2.create(180, 52));
			newNode.setInteractable(true);
			addPaint(new Color(0.000, 0.471, 0.831, 1), DEFAULT_ROUND_SIZE);
			newNode.addComponent(widgetKind === "button" ? Engine.UIButton : Engine.UIToggleButton);
			addLabel(widgetKind === "button" ? "Button" : "Toggle", 18, new Color(1, 1, 1, 1));
		}
		else if (widgetKind === "scrollView") {
			newNode.setName("ScrollView" + nodeSerialNumber);
			newNode.setContentSize(Vector2.create(320, 220));
			newNode.setInteractable(true);
			addPaint(new Color(0.965, 0.965, 0.965, 1), DEFAULT_ROUND_SIZE);
			newNode.addComponent(Engine.UIScrollView).setScrollContentSize(Vector2.create(320, 660));
		}
		else if (widgetKind === "progress") {
			newNode.setName("Progress" + nodeSerialNumber);
			newNode.setContentSize(Vector2.create(260, 20));
			const progressView = newNode.addComponent(Engine.UIProgressView);
			progressView.setRange(0, 1);
			progressView.setValue(0.6);
		}
		else if (widgetKind === "slider") {
			newNode.setName("Slider" + nodeSerialNumber);
			newNode.setContentSize(Vector2.create(260, 24));
			newNode.setInteractable(true);
			const slider = newNode.addComponent(Engine.UISlider);
			slider.setThumbRadius(9);
			slider.setTrackThickness(6);
		}
		else if (widgetKind === "divider") {
			newNode.setName("Divider" + nodeSerialNumber);
			newNode.setContentSize(Vector2.create(260, 1));
			addPaint(new Color(0.812, 0.812, 0.812, 1));
		}
		else if (widgetKind === "richText") {
			newNode.setName("RichText" + nodeSerialNumber);
			newNode.setContentSize(Vector2.create(240, 40));
			const richText = newNode.addComponent(Engine.RichText);
			richText.setText("Rich Text");
			richText.setFontSize(18);
		}
		else if (widgetKind === "image") {
			newNode.setName("Image" + nodeSerialNumber);
			newNode.setContentSize(Vector2.create(160, 160));
			addPaint(new Color(0.910, 0.910, 0.910, 1));
			newNode.addComponent(Engine.UIImageView);
		}
		else if (widgetKind === "inputField") {
			newNode.setName("InputField" + nodeSerialNumber);
			newNode.setContentSize(Vector2.create(260, 40));
			newNode.setInteractable(true);
		}
		else if (widgetKind === "snapScrollView") {
			newNode.setName("SnapScrollView" + nodeSerialNumber);
			newNode.setContentSize(Vector2.create(320, 220));
			newNode.setInteractable(true);
			addPaint(new Color(0.965, 0.965, 0.965, 1), DEFAULT_ROUND_SIZE);
			newNode.addComponent(Engine.UISnapScrollView).setScrollContentSize(Vector2.create(960, 220));
		}
		else if (widgetKind === "scrollBar") {
			newNode.setName("ScrollBar" + nodeSerialNumber);
			newNode.setContentSize(Vector2.create(12, 220));
			newNode.setInteractable(true);
		}
		else if (widgetKind === "empty") {
			newNode.setName("Node" + nodeSerialNumber);
			newNode.setContentSize(Vector2.create(120, 80));
		}
		else if (widgetKind === "mask") {
			newNode.setName("Mask" + nodeSerialNumber);
			newNode.setContentSize(Vector2.create(240, 180));
			newNode.addComponent(Engine.Mask);
		}
		else {
			newNode.setName("Panel" + nodeSerialNumber);
			newNode.setContentSize(Vector2.create(220, 140));
			addPaint(new Color(0.910, 0.910, 0.910, 1), DEFAULT_ROUND_SIZE);
		}
		documentRoot.addChild(newNode);
		const cascadeOffset = ((documentRoot.getChildren().length - 1) % 8) * 20;
		newNode.setLocalPosition(Vector2.create(60 + cascadeOffset, 60 + cascadeOffset));
	}
	if (isTicked) {
		documentRoot.tick(0.016);
	}
	return uiDocument.toJsonText(documentRoot, false);
}

fs.mkdirSync(outputPath, { recursive: true });
// 난수(ShaderSprite 의 EffectSeed, 원본도 Math.random)는 다시 뽑아도 파일이 같게 0 으로 적는다. (시험도 두 쪽 모두 0 으로 두고 견준다)
function clearRandomValues(value) {
	if (Array.isArray(value)) {
		value.forEach(clearRandomValues);
	}
	else if (value !== null && typeof value === "object") {
		for (const key of Object.keys(value)) {
			if (key === "EffectSeed") {
				value[key] = 0;
			}
			else {
				clearRandomValues(value[key]);
			}
		}
	}
}
clearRandomValues(componentDocuments);
clearRandomValues(reflectedProperties);

fs.writeFileSync(path.join(outputPath, "editor_components.json"), JSON.stringify(componentDocuments) + "\n");
fs.writeFileSync(path.join(outputPath, "editor_node_types.json"), JSON.stringify(nodeTypeDocuments) + "\n");
fs.writeFileSync(path.join(outputPath, "editor_palette.json"), buildPaletteDocument(true) + "\n");
fs.writeFileSync(path.join(outputPath, "editor_palette_before_tick.json"), buildPaletteDocument(false) + "\n");
fs.writeFileSync(path.join(outputPath, "inspector_getters.json"), JSON.stringify(inspectorGetters) + "\n");
fs.writeFileSync(path.join(outputPath, "reflected_properties.json"), JSON.stringify(reflectedProperties) + "\n");
