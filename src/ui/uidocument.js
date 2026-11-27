//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";
import { Color } from "../base/color.js";
import { WorldNode } from "../core/node/worldnode.js";
import { Paint } from "../core/component/paint.js";
import { Sprite } from "../core/component/sprite.js";
import { Text } from "../core/component/text.js";
import { RichText } from "../core/component/richtext.js";
import { Mask } from "../core/component/mask.js";
import { Outline } from "../core/component/outline.js";
import { SoftShade } from "../core/component/softshade.js";
import { ShadowText } from "../core/component/shadowtext.js";
import { ShadowImage } from "../core/component/shadowimage.js";
import { UIView } from "./uiview.js";
import { UILabel } from "./uilabel.js";
import { UIImageView } from "./uiimageview.js";
import { UIButton } from "./uibutton.js";
import { UIToggleButton } from "./uitogglebutton.js";
import { UIProgressView } from "./uiprogressview.js";
import { UISlider } from "./uislider.js";
import { UIScrollView } from "./uiscrollview.js";
import { UIProgressRing } from "./uiprogressring.js";
import { ButtonMotion } from "./buttonmotion.js";
import { HeatHazeEffect } from "../effect/heathazeeffect.js";
import { ParticleSystem } from "../effect/particlesystem.js";
import { ShaderSprite } from "../effect/shadersprite.js";
import { TrailRenderer } from "../effect/trailrenderer.js";
import { PlatformerBody } from "../misc/platformerbody.js";
import { SpriteAnimator } from "../misc/spriteanimator.js";
import { FloatingText } from "../misc/floatingtext.js";
import { TouchEffect } from "../misc/toucheffect.js";
import { ToastMotion } from "./toastmotion.js";
import { ToonView3D } from "../graphics3d/toon/toonview3d.js";
import { Visual } from "../misc/visual.js";
import { UIBarChart, UILineChart } from "./uichart.js";
import { UIControl } from "./uicontrol.js";
import { UIDraggable } from "./uidraggable.js";
import { UIHitArea } from "./uihitarea.js";
import { UIListView } from "./uilistview.js";
import { UISnapScrollView } from "./uisnapscrollview.js";
import { UIConfirmWindow } from "./uiconfirmwindow.js";
import { UIContextMenu } from "./uicontextmenu.js";
import { UIDialog } from "./uidialog.js";
import { UIDropdown } from "./uidropdown.js";
import { UIInputField } from "./uiinputfield.js";
import { UIScrollBar } from "./uiscrollbar.js";
import { UISpinner } from "./uispinner.js";
import { UIToast } from "./uitoast.js";
import { UIWindow } from "./uiwindow.js";
import { UIWindowLayer } from "./uiwindowlayer.js";
import { ImageAsset } from "../resource/imageasset.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// UI 문서 포맷 버전.
const UIDOCUMENT_VERSION = 1;

// 기본 노드 타입 테이블. (문서에 기록되는 이름 → 생성자, 문서마다 이것을 베껴 제 표로 든다)
// - registerNodeType() 으로 그 문서에 종류를 더할 수 있다.
// - 적을 때도 이 표의 이름을 쓴다. (클래스 이름은 번들러가 줄이면 바뀌므로 기대지 않는다)
const DEFAULT_NODE_TYPE_TABLE = {
	WorldNode: WorldNode,
};

// 노드 참조를 문서에 적을 때 쓰는 표시.
const NODE_REFERENCE_KEY = "$nodeRef";

// 속성 목록에서 빼는 이름. (다른 객체를 가리키거나 문서로 옮길 수 없는 것)
const REFLECTED_PROPERTY_EXCLUDE_NAMES = new System.Set([
	"Parent", "Node", "Owner", "Scene", "Content", "Children", "AllComponents",
	"Component", "Components", "Root", "Graphic", "Camera", "Target",
	"ImagePath", // 그림 경로는 전용 핸들러가 imagePath 로 적는다. (러스트 판 #[reflect(skip)])
]);

// 기본 컴포넌트 타입 테이블. (문서에 기록되는 이름 → 생성자, 문서마다 이것을 베껴 제 표로 든다)
// - 런타임이 늘 쓰는 종류만 둔다. 에디터가 다루는 나머지는 registerEditorTypes() 로 더한다.
const DEFAULT_COMPONENT_TYPE_TABLE = {
	Paint: Paint,
	Sprite: Sprite,
	Text: Text,
	RichText: RichText,
	Mask: Mask,
	Outline: Outline,
	SoftShade: SoftShade,
	ShadowText: ShadowText,
	UIProgressRing: UIProgressRing,
	UILabel: UILabel,
	UIImageView: UIImageView,
	UIButton: UIButton,
	UIToggleButton: UIToggleButton,
	UIProgressView: UIProgressView,
	UISlider: UISlider,
	UIScrollView: UIScrollView,
	ShadowImage: ShadowImage,
};


//==============================================================================
// 전역 함수 목록.
//==============================================================================
//==============================================================================
// 짝이 맞는 get/set 속성 수집. (핸들러가 없는 컴포넌트에 쓴다)
//==============================================================================
/**
 * @param { object } targetObject
 * @returns { object[] }
 */
function collectReflectedProperties(targetObject) {
	const propertyList = [];
	const visitedNameSet = new System.Set();
	let prototypeObject = System.Object.getPrototypeOf(targetObject);
	while (prototypeObject && prototypeObject !== System.Object.prototype) {
		for (const memberName of System.Object.getOwnPropertyNames(prototypeObject)) {
			let baseName = "";
			if (memberName.indexOf("get") === 0) {
				baseName = memberName.substring(3);
			}
			else if (memberName.indexOf("is") === 0) {
				baseName = memberName.substring(2);
			}
			else {
				continue;
			}
			if (baseName.length === 0 || visitedNameSet.has(baseName) || REFLECTED_PROPERTY_EXCLUDE_NAMES.has(baseName)) {
				continue;
			}
			if (typeof targetObject["set" + baseName] !== "function") {
				continue;
			}
			const getterFunction = prototypeObject[memberName];
			if (typeof getterFunction !== "function" || getterFunction.length !== 0) {
				continue;
			}
			visitedNameSet.add(baseName);
			propertyList.push({ name: baseName, getterName: memberName, setterName: "set" + baseName });
		}
		prototypeObject = System.Object.getPrototypeOf(prototypeObject);
	}
	return propertyList;
}


//==============================================================================
// 생성자로 표에 등록한 이름 찾기.
// - 문서에 적는 종류 이름은 등록한 이름이다. 클래스 이름(constructor.name)은 번들러가 줄이면(--minify) 바뀌므로
//   등록하지 않은 종류에만 쓴다. (같은 생성자를 여러 이름으로 등록했으면 먼저 등록한 이름)
//==============================================================================
/**
 * @param { object } typeTable 이름 → 생성자 표.
 * @param { Function } targetType 찾을 생성자.
 * @returns { string }
 */
function findRegisteredTypeName(typeTable, targetType) {
	for (const typeName of System.Object.keys(typeTable)) {
		if (typeTable[typeName] === targetType) {
			return typeName;
		}
	}
	return targetType.name;
}

//==============================================================================
// 문서 데이터의 그림 경로 모으기. (재귀, imagePath 칸의 빈 글이 아닌 글, 겹치면 한 번)
//==============================================================================
/**
 * @param { * } value 문서 데이터. (객체, 배열, 그 밖의 값)
 * @param { string[] } imagePathList 모은 경로를 넣을 목록.
 */
function collectImagePaths(value, imagePathList) {
	if (System.Array.isArray(value)) {
		for (const childValue of value) {
			collectImagePaths(childValue, imagePathList);
		}
		return;
	}
	if (!value || typeof value !== "object") {
		return;
	}
	for (const key of System.Object.keys(value)) {
		const childValue = value[key];
		if (key === "imagePath") {
			if (typeof childValue === "string" && childValue.length > 0 && !imagePathList.includes(childValue)) {
				imagePathList.push(childValue);
			}
			continue;
		}
		collectImagePaths(childValue, imagePathList);
	}
}

//==============================================================================
// 색상 → 배열. (문서 기록용)
//==============================================================================
/**
 * @param { Color } color
 * @returns { number[] }
 */
function colorToArray(color) {
	return [color.red, color.green, color.blue, color.alpha];
}

//==============================================================================
// 배열 → 색상.
//==============================================================================
/**
 * @param { number[] } values
 * @returns { Color }
 */
function arrayToColor(values) {
	return new Color(values[0], values[1], values[2], values[3]);
}

//==============================================================================
// 텍스트 속성 저장. (UILabel / Text 공용, 같은 표현을 공유한다)
//==============================================================================
/**
 * @param { * } component
 * @returns { object }
 */
function saveTextProperties(component) {
	const textColor = component.getTextColor();
	const strokeColor = component.getStrokeColor();
	return {
		text: component.getText(),
		fontSize: component.getFontSize(),
		textColor: colorToArray(textColor),
		strokeColor: colorToArray(strokeColor),
		strokeWidth: component.getStrokeWidth(),
		textAlign: component.getTextAlign(),
		textBaseline: component.getTextBaseline(),
	};
}

//==============================================================================
// 텍스트 속성 적용.
//==============================================================================
/**
 * @param { * } component
 * @param { object } data
 */
function loadTextProperties(component, data) {
	if (data.text !== undefined) {
		component.setText(data.text);
	}
	if (data.fontSize !== undefined) {
		component.setFontSize(data.fontSize);
	}
	if (data.textColor) {
		component.setTextColor(arrayToColor(data.textColor));
	}
	if (data.strokeColor) {
		component.setStrokeColor(arrayToColor(data.strokeColor));
	}
	if (data.strokeWidth !== undefined) {
		component.setStrokeWidth(data.strokeWidth);
	}
	if (data.textAlign !== undefined) {
		component.setTextAlign(data.textAlign);
	}
	if (data.textBaseline !== undefined) {
		component.setTextBaseline(data.textBaseline);
	}
}

//==============================================================================
// 컴포넌트 속성 입출력 테이블. (타입 이름 → { save, load })
// - 이미지 원본은 문서에 담지 않고 경로(imagePath)만 기록한다. 그림은 load 의 loadContext.bindImage 로 문서에 맡기고,
//   문서가 해석기(setImageResolver)나 loadImages 로 요청한 애셋에서 찾아 bindPendingImages 로 넣는다.
// - save(component, document), load(component, data, loadContext). loadContext 는 { document, bindImage(component, imagePath) } 다.
//==============================================================================
const COMPONENT_PROPERTY_TABLE = {
	Paint: {
		save(component) {
			return { color: colorToArray(component.getColor()), roundSize: component.getRoundSize() };
		},
		load(component, data) {
			if (data.color) {
				component.setColor(arrayToColor(data.color));
			}
			if (data.roundSize !== undefined) {
				component.setRoundSize(data.roundSize);
			}
		},
	},
	Sprite: {
		save(component) {
			const nineSlice = component.getNineSlice();
			return {
				color: colorToArray(component.getColor()),
				roundSize: component.getRoundSize(),
				imagePath: component.getImagePath(),
				nineSlice: nineSlice ? [nineSlice.left, nineSlice.top, nineSlice.right, nineSlice.bottom] : null,
				spriteDrawMode: component.getSpriteDrawMode(),
				spriteBlendMode: component.getSpriteBlendMode(),
			};
		},
		load(component, data, loadContext) {
			if (data.color) {
				component.setColor(arrayToColor(data.color));
			}
			if (data.roundSize !== undefined) {
				component.setRoundSize(data.roundSize);
			}
			if (data.imagePath) {
				component.setImagePath(data.imagePath);
				loadContext.bindImage(component, data.imagePath);
			}
			// 쓸 때의 꼴(Rect 의 left, top, right, bottom = [왼쪽, 위, 왼쪽 + 오른쪽, 위 + 아래])을 거꾸로 풀어 읽는다.
			if (System.Array.isArray(data.nineSlice) && data.nineSlice.length === 4) {
				const nineSliceLeft = data.nineSlice[0];
				const nineSliceTop = data.nineSlice[1];
				const nineSliceRight = data.nineSlice[2] - nineSliceLeft;
				const nineSliceBottom = data.nineSlice[3] - nineSliceTop;
				component.setNineSlice(Rect.create(nineSliceLeft, nineSliceTop, nineSliceRight, nineSliceBottom));
			}
			if (data.spriteDrawMode !== undefined) {
				component.setSpriteDrawMode(data.spriteDrawMode);
			}
			if (data.spriteBlendMode !== undefined) {
				component.setSpriteBlendMode(data.spriteBlendMode);
			}
		},
	},
	Text: {
		save(component) {
			return saveTextProperties(component);
		},
		load(component, data) {
			loadTextProperties(component, data);
		},
	},
	RichText: {
		save(component) {
			return saveTextProperties(component);
		},
		load(component, data) {
			loadTextProperties(component, data);
		},
	},
	Mask: {
		save() {
			return {};
		},
		load() {
		},
	},
	UILabel: {
		save(component) {
			return {
				text: component.getText(),
				fontSize: component.getFontSize(),
				textColor: colorToArray(component.getTextColor()),
				backgroundColor: colorToArray(component.getBackgroundColor()),
				textAlign: component.getTextAlign(),
				textBaseline: component.getTextBaseline(),
			};
		},
		load(component, data) {
			if (data.text !== undefined) {
				component.setText(data.text);
			}
			if (data.fontSize !== undefined) {
				component.setFontSize(data.fontSize);
			}
			if (data.textColor) {
				component.setTextColor(arrayToColor(data.textColor));
			}
			if (data.backgroundColor) {
				component.setBackgroundColor(arrayToColor(data.backgroundColor));
			}
			if (data.textAlign !== undefined) {
				component.setTextAlign(data.textAlign);
			}
			if (data.textBaseline !== undefined) {
				component.setTextBaseline(data.textBaseline);
			}
		},
	},
	UIImageView: {
		save(component) {
			return { imagePath: component.getImagePath() };
		},
		load(component, data, loadContext) {
			if (data.imagePath) {
				component.setImagePath(data.imagePath);
				loadContext.bindImage(component, data.imagePath);
			}
		},
	},
	UIButton: {
		save(component) {
			return { pressedTintColor: colorToArray(component.getPressedTintColor()) };
		},
		load(component, data) {
			if (data.pressedTintColor) {
				component.setPressedTintColor(arrayToColor(data.pressedTintColor));
			}
		},
	},
	UIToggleButton: {
		save(component) {
			return { pressedTintColor: colorToArray(component.getPressedTintColor()) };
		},
		load(component, data) {
			if (data.pressedTintColor) {
				component.setPressedTintColor(arrayToColor(data.pressedTintColor));
			}
		},
	},
	UIProgressView: {
		save(component) {
			return {
				value: component.getValue(),
				minValue: component.getMinValue(),
				maxValue: component.getMaxValue(),
			};
		},
		load(component, data) {
			if (data.minValue !== undefined && data.maxValue !== undefined) {
				component.setRange(data.minValue, data.maxValue);
			}
			if (data.value !== undefined) {
				component.setValue(data.value);
			}
		},
	},
	UISlider: {
		save(component) {
			return {
				value: component.getValue(),
				thumbRadius: component.getThumbRadius(),
				trackThickness: component.getTrackThickness(),
			};
		},
		load(component, data) {
			if (data.value !== undefined) {
				component.setValue(data.value);
			}
			if (data.thumbRadius !== undefined) {
				component.setThumbRadius(data.thumbRadius);
			}
			if (data.trackThickness !== undefined) {
				component.setTrackThickness(data.trackThickness);
			}
		},
	},
	ShadowImage: {
		// 그림 경로 뒤에 반사 저장 꼴. (그림 원본은 문서에 담지 않고 Sprite 처럼 경로만 적는다)
		save(component, document) {
			const componentData = { imagePath: component.getImagePath() };
			System.Object.assign(componentData, document.saveByReflection(component));
			return componentData;
		},
		load(component, data, loadContext) {
			if (data.imagePath) {
				component.setImagePath(data.imagePath);
				loadContext.bindImage(component, data.imagePath);
			}
			loadContext.document.loadByReflection(component, data);
		},
	},
	UIScrollView: {
		save(component) {
			const scrollContentSize = component.getScrollContentSize();
			return {
				scrollContentSize: [scrollContentSize.x, scrollContentSize.y],
				scrollMode: component.getScrollMode(),
				dragSensitivity: component.getDragSensitivity(),
				horizontal: component.isHorizontal(),
				vertical: component.isVertical(),
				backgroundColor: colorToArray(component.getBackgroundColor()),
			};
		},
		load(component, data) {
			if (data.scrollContentSize) {
				component.setScrollContentSize(Vector2.create(data.scrollContentSize[0], data.scrollContentSize[1]));
			}
			if (data.horizontal !== undefined) {
				component.setHorizontal(data.horizontal);
			}
			if (data.vertical !== undefined) {
				component.setVertical(data.vertical);
			}
			if (data.scrollMode !== undefined) {
				component.setScrollMode(data.scrollMode);
			}
			if (data.dragSensitivity !== undefined) {
				component.setDragSensitivity(data.dragSensitivity);
			}
			if (data.backgroundColor) {
				component.setBackgroundColor(arrayToColor(data.backgroundColor));
			}
		},
	},
};

//==============================================================================
// UI 문서. (WorldNode 트리 ↔ JSON 상호 변환)
// - UI 편집 도구가 저장한 문서를 런타임에서 그대로 복원하기 위한 계층이다.
// - UIView 계열 위젯은 부착 시 content 노드와 의존 컴포넌트를 스스로 만든다.
//   따라서 문서에는 위젯만 기록하고, 사용자가 content 안에 넣은 자식은
//   contentChildren 으로 따로 보존한다. (스크롤뷰의 목록 항목 등)
// - 전역 상태가 없는 인스턴스다. 문서마다 종류 표(컴포넌트, 노드)와 그림 찾기 상태(해석기, 요청한 그림 애셋, 맡아 둔 그림)를 든다.
//   new UIDocument() 는 엔진 기본 종류를 등록해 둔다. 게임 종류는 그 문서에 registerComponentType, registerNodeType 으로 더한다.
// - 그림: 해석기(setImageResolver)가 있으면 그것으로, 없으면 loadImages 로 요청한 애셋에서 찾는다. 아직 읽히는 그림은
//   맡아 두었다가 bindPendingImages 가 넣는다. (fromJsonText, deserializeNode 가 끝에 한 번 부른다)
//==============================================================================
/**
 * @example <caption>UI Editor 가 저장한 uiasset 불러와 단추 잇기</caption>
 * import { Engine, EngineConfiguration, UIScene, UIDocument, UIButton } from "./build/vanilla.js";
 *
 * class DocumentScene extends UIScene {
 * 	async loadAssets() {
 * 		await super.loadAssets();
 * 		const response = await fetch("examples/uisample/assets/title.uiasset.json");
 * 		const jsonText = await response.text();
 * 		const uiDocument = new UIDocument();
 * 		await Promise.all(uiDocument.loadImages(jsonText));
 * 		const documentRootNode = uiDocument.fromJsonText(jsonText);
 * 		const root = this.getRoot();
 * 		root.addChild(documentRootNode);
 * 		const startButtonNode = UIDocument.findNodeByPath(documentRootNode, "/Panel/StartButton");
 * 		const startButton = startButtonNode.getComponent(UIButton);
 * 		startButton.setClickedEvent(() => {
 * 			console.log("start");
 * 		});
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const scene = new DocumentScene();
 * scene.setLoadingMinDurationMs(0);
 * engine.run(scene);
 */
export class UIDocument extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object } */ #componentTypeTable; // 컴포넌트 종류 표. (문서 이름 → 생성자, 등록 차례)
	/** @private @type { object } */ #nodeTypeTable; // 노드 종류 표. (문서 이름 → 생성자)
	/** @private @type { Function | null } */ #imageResolver; // 그림 경로 해석기. (경로 → 그림, null 이면 loadImages 로 요청한 애셋에서 찾는다)
	/** @private @type { Map<string, object> } */ #imageAssetMap; // loadImages 로 요청한 그림. (경로 → { asset, isFinished })
	/** @private @type { object[] } */ #pendingImageList; // 맡아 둔 그림. ({ component, imagePath })
	/** @private @type { object[] } */ #pendingNodeReferenceList; // 트리를 다 지은 뒤 이을 노드 참조. ({ target, setterName, path })
	/** @private @type { WorldNode | null } */ #serializeRootNode; // 적고 있는 문서의 뿌리. (노드 참조 경로의 기준, 적는 동안만)
	/** @private @type { object } */ #loadContext; // 속성 표의 load 에 넘기는 것. ({ document, bindImage(component, imagePath) })

	//==============================================================================
	// 생성. (엔진 기본 종류를 등록해 둔다)
	//==============================================================================
	/**
	 * @example <caption>문서 하나를 지어 트리를 글로 적고 되살리기</caption>
	 * import { UIDocument, WorldNode, Paint, Color, Vector2 } from "./build/vanilla.js";
	 *
	 * const panelNode = new WorldNode();
	 * panelNode.setName("Panel");
	 * panelNode.setContentSize(Vector2.create(320, 200));
	 * panelNode.addComponent(Paint).setColor(new Color(0.2, 0.4, 0.8, 1));
	 * const uiDocument = new UIDocument();
	 * const jsonText = uiDocument.toJsonText(panelNode, true);
	 * const loadedNode = uiDocument.fromJsonText(jsonText);
	 * console.log(loadedNode.getContentSize().x, uiDocument.toJsonText(loadedNode, true) === jsonText);
	 */
	constructor() {
		super();
		this.#componentTypeTable = System.Object.assign({}, DEFAULT_COMPONENT_TYPE_TABLE);
		this.#nodeTypeTable = System.Object.assign({}, DEFAULT_NODE_TYPE_TABLE);
		this.#imageResolver = null;
		this.#imageAssetMap = new System.Map();
		this.#pendingImageList = [];
		this.#pendingNodeReferenceList = [];
		this.#serializeRootNode = null;
		this.#loadContext = {
			document: this,
			bindImage: (component, imagePath) => {
				this.#pendingImageList.push({ component: component, imagePath: imagePath });
			},
		};
	}

	//==============================================================================
	// 이미지 경로 해석기 등록. (경로 → HTMLImageElement, 등록하면 loadImages 로 요청한 애셋 대신 이것으로 찾는다)
	//==============================================================================
	/**
	 * @param { function(string): HTMLImageElement | null } resolver 문서의 이미지 경로를 받아 그림을 돌려주는 함수. (null 을 돌려주면 그 그림은 찾지 못한 것이다)
	 * @example <caption>미리 받은 그림으로 이미지 경로 잇기</caption>
	 * import { UIDocument, Sprite } from "./build/vanilla.js";
	 *
	 * const imagePath = "examples/assets/spritesheet.png";
	 * const image = new Image();
	 * image.src = imagePath;
	 * await image.decode();
	 * const imageTable = new Map([[imagePath, image]]);
	 * const uiDocument = new UIDocument();
	 * uiDocument.setImageResolver((path) => {
	 * 	const foundImage = imageTable.get(path);
	 * 	return foundImage !== undefined ? foundImage : null;
	 * });
	 * const documentData = {
	 * 	version: 1,
	 * 	root: { type: "WorldNode", name: "Root", contentSize: [128, 128], components: [{ type: "Sprite", imagePath: imagePath }], children: [] },
	 * };
	 * const jsonText = JSON.stringify(documentData);
	 * const rootNode = uiDocument.fromJsonText(jsonText);
	 * const sprite = rootNode.getComponent(Sprite);
	 * console.log(sprite.getImagePath(), sprite.getImage() === image, uiDocument.resolveImage("missing.png"));
	 */
	setImageResolver(resolver) {
		this.#imageResolver = resolver;
	}

	//==============================================================================
	// 이미지 경로 해석. (찾지 못했거나 아직 읽히는 중이면 null)
	//==============================================================================
	/**
	 * @param { string } imagePath 문서에 적힌 이미지 경로.
	 * @returns { HTMLImageElement | null } 찾은 그림. (해석기가 null 을 주었거나, 해석기가 없고 loadImages 로 요청하지 않았거나 아직 읽히는 중이거나 읽기에 실패했으면 null)
	 */
	resolveImage(imagePath) {
		const imageLookup = this.#findImage(imagePath);
		return imageLookup.image;
	}

	//==============================================================================
	// 그림 찾기. (해석기가 있으면 해석기, 없으면 loadImages 로 요청한 애셋)
	//==============================================================================
	/**
	 * @private
	 * @param { string } imagePath 그림 경로.
	 * @returns { object } { image, isWaiting }. (image 가 null 이고 isWaiting 이 참이면 아직 읽히는 중)
	 */
	#findImage(imagePath) {
		const imageResolver = this.#imageResolver;
		if (imageResolver !== null) {
			const resolvedImage = imageResolver(imagePath);
			return { image: resolvedImage ? resolvedImage : null, isWaiting: false };
		}
		const imageEntry = this.#imageAssetMap.get(imagePath);
		if (imageEntry === undefined) {
			return { image: null, isWaiting: false };
		}
		if (imageEntry.asset.isLoaded()) {
			return { image: imageEntry.asset.getImage(), isWaiting: false };
		}
		return { image: null, isWaiting: !imageEntry.isFinished };
	}

	//==============================================================================
	// 문서의 그림 읽기 요청. (imagePath 마다 ImageAsset 을 요청해 문서에 든다. 이미 요청한 경로는 건너뛴다)
	// - 새로 요청한 그림마다 다 읽히면(읽지 못해도) 풀리는 프로미스를 돌려준다. 씬의 loadAssets 에서 Promise.all 로 기다린 뒤 fromJsonText 하면 그림이 다 붙는다.
	// - 기다리지 않고 지으면 아직 읽히는 그림은 맡아 두므로, 씬의 update 에서 bindPendingImages 를 남은 수가 0 이 될 때까지 부른다.
	//==============================================================================
	/**
	 * @param { string } jsonText 문서 글.
	 * @returns { Promise<void>[] } 새로 요청한 그림의 읽기 프로미스 목록. (읽지 못해도 풀린다, JSON 이 아니거나 새로 요청할 경로가 없으면 빈 목록)
	 * @example <caption>문서의 그림을 읽은 뒤 짓기</caption>
	 * import { UIDocument, Sprite } from "./build/vanilla.js";
	 *
	 * const jsonText = JSON.stringify({ version: 1, root: { name: "Icons", components: [{ type: "Sprite", imagePath: "examples/assets/spritesheet.png" }] } });
	 * const uiDocument = new UIDocument();
	 * const loadPromiseList = uiDocument.loadImages(jsonText);
	 * await Promise.all(loadPromiseList);
	 * const iconsNode = uiDocument.fromJsonText(jsonText);
	 * console.log(loadPromiseList.length, uiDocument.bindPendingImages(), iconsNode.getComponent(Sprite).getImage() !== null);
	 */
	loadImages(jsonText) {
		let documentData = null;
		try {
			documentData = System.JSON.parse(jsonText);
		}
		catch (exception) {
			return [];
		}
		const imagePathList = [];
		collectImagePaths(documentData, imagePathList);
		const loadPromiseList = [];
		for (const imagePath of imagePathList) {
			if (this.#imageAssetMap.has(imagePath)) {
				continue;
			}
			const imageEntry = { asset: new ImageAsset(), isFinished: false };
			this.#imageAssetMap.set(imagePath, imageEntry);
			const loadPromise = imageEntry.asset.load(imagePath).then(() => {
				imageEntry.isFinished = true;
			}, () => {
				// 읽지 못한 그림은 bindPendingImages 가 경고를 내고 버린다.
				imageEntry.isFinished = true;
			});
			loadPromiseList.push(loadPromise);
		}
		return loadPromiseList;
	}

	//==============================================================================
	// 맡아 둔 그림 붙이기. (찾은 그림은 넣고, 아직 읽히는 그림은 남긴다. 남은 수를 돌려준다)
	// - fromJsonText, deserializeNode 가 끝에 한 번 부른다. 그림을 기다리지 않고 지었으면 씬의 update 에서 남은 수가 0 이 될 때까지 부른다.
	// - 찾지 못한 그림(해석기가 null, 애셋이 없거나 실패)은 경고를 내고 버린다. 그 컴포넌트는 그림 없이 남는다.
	//==============================================================================
	/**
	 * @returns { number } 아직 읽히는 중이라 남은 그림 수. (0 이면 다 붙였거나 버렸다)
	 */
	bindPendingImages() {
		const pendingImageList = this.#pendingImageList;
		this.#pendingImageList = [];
		for (const pendingImage of pendingImageList) {
			const imageLookup = this.#findImage(pendingImage.imagePath);
			if (imageLookup.image !== null) {
				pendingImage.component.setImage(imageLookup.image);
			}
			else if (imageLookup.isWaiting) {
				this.#pendingImageList.push(pendingImage);
			}
			else {
				System.console.warn(`UIDocument: 그림을 찾지 못했습니다 (${pendingImage.imagePath})`);
			}
		}
		return this.#pendingImageList.length;
	}

	//==============================================================================
	// 노드 트리 → 문서 데이터. (노드 참조는 이 노드 기준 경로로 적는다)
	//==============================================================================
	/**
	 * @param { WorldNode } node 적을 노드. (자식까지)
	 * @returns { object } 노드 데이터. ({ type, name, active, position, scale, rotation, opacity, pivot, anchor, contentSize, interactable, components, children, contentChildren? })
	 * @example <caption>노드를 문서 값으로 떠서 복제본 짓기</caption>
	 * import { UIDocument, WorldNode, Vector2 } from "./build/vanilla.js";
	 *
	 * const cardNode = new WorldNode();
	 * cardNode.setName("Card");
	 * cardNode.setContentSize(Vector2.create(120, 80));
	 * const iconNode = new WorldNode();
	 * iconNode.setName("Icon");
	 * cardNode.addChild(iconNode);
	 * const uiDocument = new UIDocument();
	 * const cardData = uiDocument.serializeNode(cardNode);
	 * const copyNode = uiDocument.deserializeNode(cardData);
	 * console.log(cardData.name, copyNode !== cardNode, copyNode.getContentSize().x, UIDocument.findNodeByPath(copyNode, "/Icon") !== null);
	 */
	serializeNode(node) {
		const previousRootNode = this.#serializeRootNode;
		this.#serializeRootNode = node;
		try {
			return this.#serializeNodeFromRoot(node);
		}
		finally {
			this.#serializeRootNode = previousRootNode;
		}
	}

	//==============================================================================
	// 노드 하나 적기. (재귀, 노드 참조는 #serializeRootNode 기준 경로)
	//==============================================================================
	/**
	 * @private
	 * @param { WorldNode } node 적을 노드.
	 * @returns { object } 노드 데이터.
	 */
	#serializeNodeFromRoot(node) {
		const pivot = node.getPivot();
		const anchor = node.getAnchor();
		const contentSize = node.getContentSize();
		const localPosition = node.getLocalPosition();
		const localScale = node.getLocalScale();
		const nodeTypeName = this.getNodeTypeName(node);
		const nodeData = {
			type: nodeTypeName,
			name: node.getName(),
			active: node.isActive(),
			position: [localPosition.x, localPosition.y],
			scale: [localScale.x, localScale.y],
			rotation: node.getLocalRotation(),
			opacity: node.getLocalOpacity(),
			pivot: [pivot.x, pivot.y],
			anchor: [anchor.x, anchor.y],
			contentSize: [contentSize.x, contentSize.y],
			interactable: node.isInteractable(),
			components: [],
			children: [],
		};

		// 위젯이 스스로 만든 컴포넌트는 문서에 담지 않는다. (복원 시 다시 생성된다)
		const componentList = node.getAllComponents();
		const generatedTypeSet = this.collectGeneratedComponentTypes(componentList);
		// 위젯마다 content 노드를 하나씩 만들므로 전부 모아 둔다.
		const widgetContentNodeSet = new System.Set();
		for (const component of componentList) {
			const componentTypeName = findRegisteredTypeName(this.#componentTypeTable, component.constructor);
			const propertyHandler = COMPONENT_PROPERTY_TABLE[componentTypeName];
			if (component instanceof UIView) {
				const contentNode = component.getContent();
				if (contentNode) {
					widgetContentNodeSet.add(contentNode);
				}
			}
			if (generatedTypeSet.has(componentTypeName)) {
				continue;
			}
			const componentData = propertyHandler ? propertyHandler.save(component, this) : this.saveByReflection(component);
			if (propertyHandler) {
				// 전용 핸들러는 노드 참조를 다루지 않으므로 여기에서 따로 얹는다.
				this.#saveNodeReferences(component, componentData);
			}
			componentData.type = componentTypeName;
			nodeData.components.push(componentData);
		}

		// 위젯의 content 노드는 복원 시 위젯이 다시 만든다. 그 안의 자식만 보존한다.
		const childNodeList = node.getChildren();
		for (const childNode of childNodeList) {
			if (widgetContentNodeSet.has(childNode)) {
				const grandChildNodeList = childNode.getChildren();
				if (grandChildNodeList.length > 0) {
					nodeData.contentChildren = grandChildNodeList.map((grandChildNode) => this.#serializeNodeFromRoot(grandChildNode));
				}
				continue;
			}
			nodeData.children.push(this.#serializeNodeFromRoot(childNode));
		}
		return nodeData;
	}

	//==============================================================================
	// 위젯이 생성한 컴포넌트 타입 수집. (UIView 계열의 require 목록)
	//==============================================================================
	/**
	 * @param { object[] } componentList 한 노드의 컴포넌트 목록.
	 * @returns { Set<string> } UIView 계열이 require 로 함께 붙이는 컴포넌트의 문서 이름 모음. (등록한 이름, 등록하지 않았으면 클래스 이름)
	 */
	collectGeneratedComponentTypes(componentList) {
		const generatedTypeSet = new System.Set();
		for (const component of componentList) {
			if (!(component instanceof UIView)) {
				continue;
			}
			const requiredTypes = component.require();
			if (!requiredTypes) {
				continue;
			}
			for (const requiredType of requiredTypes) {
				const requiredTypeName = findRegisteredTypeName(this.#componentTypeTable, requiredType);
				generatedTypeSet.add(requiredTypeName);
			}
		}
		return generatedTypeSet;
	}

	//==============================================================================
	// 문서 데이터 → 노드 트리. (어느 부모에도 붙지 않은 노드를 돌려준다)
	// - 노드 참조는 이 노드 기준 경로로 잇고, 찾을 수 있는 그림을 넣는다. (bindPendingImages)
	//==============================================================================
	/**
	 * @param { object } nodeData serializeNode 꼴의 노드 데이터. (모르는 노드 종류는 WorldNode 로 만들고, 모르는 컴포넌트는 건너뛴다, 둘 다 경고를 낸다)
	 * @returns { WorldNode } 만든 노드. (노드 생성자가 만든 컴포넌트와 자식에는 문서 값을 넣고 겹쳐 만들지 않는다)
	 */
	deserializeNode(nodeData) {
		const previousReferenceList = this.#pendingNodeReferenceList;
		this.#pendingNodeReferenceList = [];
		let rootNode = null;
		try {
			rootNode = this.#buildNode(nodeData);

			// 트리를 다 만든 뒤에 노드 참조를 잇는다.
			for (const pendingReference of this.#pendingNodeReferenceList) {
				const referencedNode = UIDocument.findNodeByPath(rootNode, pendingReference.path);
				if (referencedNode) {
					pendingReference.target[pendingReference.setterName](referencedNode);
				}
			}
		}
		finally {
			this.#pendingNodeReferenceList = previousReferenceList;
		}
		this.bindPendingImages();
		return rootNode;
	}

	//==============================================================================
	// 노드 하나 짓기. (재귀, 노드 참조는 맡아 두기만 한다)
	//==============================================================================
	/**
	 * @private
	 * @param { object } nodeData 노드 데이터.
	 * @returns { WorldNode } 만든 노드.
	 */
	#buildNode(nodeData) {
		let nodeType = this.#nodeTypeTable[nodeData.type];
		if (!nodeType) {
			if (nodeData.type !== undefined) {
				System.console.warn(`UIDocument: unregistered node type "${nodeData.type}" is read as WorldNode. (call registerEditorTypes() on the document for documents saved by the editor)`);
			}
			nodeType = WorldNode;
		}
		const node = new nodeType();
		node.setName(nodeData.name || "");
		this.#fillNode(node, nodeData);
		return node;
	}

	//==============================================================================
	// 문서 값을 노드 하나에 넣기. (재귀)
	// - 노드에 이미 있는 컴포넌트와 자식(노드 생성자나 위젯이 만든 것, 붙을 때 함께 붙은 것)은 문서의 앞에서부터
	//   차례와 종류(자식은 이름)가 맞으면 그것에 문서 값을 넣고 다시 만들지 않는다. 맞지 않으면 새로 만들어 붙인다.
	//   (새로 만들면 다시 읽을 때마다 생성자가 만든 것과 문서의 것이 겹친다)
	//==============================================================================
	/**
	 * @private
	 * @param { WorldNode } node 값을 넣을 노드.
	 * @param { object } nodeData serializeNode 꼴의 노드 데이터.
	 */
	#fillNode(node, nodeData) {
		if (nodeData.active !== undefined) {
			node.setActive(nodeData.active);
		}
		if (nodeData.position) {
			node.setLocalPosition(Vector2.create(nodeData.position[0], nodeData.position[1]));
		}
		if (nodeData.scale) {
			node.setLocalScale(Vector2.create(nodeData.scale[0], nodeData.scale[1]));
		}
		if (nodeData.rotation !== undefined) {
			node.setLocalRotation(nodeData.rotation);
		}
		if (nodeData.opacity !== undefined) {
			node.setLocalOpacity(nodeData.opacity);
		}
		if (nodeData.pivot) {
			node.setPivot(Vector2.create(nodeData.pivot[0], nodeData.pivot[1]));
		}
		if (nodeData.anchor) {
			node.setAnchor(Vector2.create(nodeData.anchor[0], nodeData.anchor[1]));
		}
		if (nodeData.contentSize) {
			node.setContentSize(Vector2.create(nodeData.contentSize[0], nodeData.contentSize[1]));
		}
		if (nodeData.interactable !== undefined) {
			node.setInteractable(nodeData.interactable);
		}

		// 이미 있는 컴포넌트와 자식. (위젯이 require 로 붙인 컴포넌트와 위젯의 content 노드는 문서에 적히지 않으므로 뺀다)
		const currentComponentList = node.getAllComponents().slice();
		let generatedTypeSet = this.collectGeneratedComponentTypes(currentComponentList);
		const existingComponentList = [];
		const widgetContentNodeSet = new System.Set();
		let widgetComponent = null;
		for (const component of currentComponentList) {
			const componentTypeName = findRegisteredTypeName(this.#componentTypeTable, component.constructor);
			if (!generatedTypeSet.has(componentTypeName)) {
				existingComponentList.push(component);
			}
			if (component instanceof UIView) {
				const contentNode = component.getContent();
				if (contentNode) {
					widgetContentNodeSet.add(contentNode);
				}
				widgetComponent = component;
			}
		}
		const existingChildList = node.getChildren().filter((childNode) => !widgetContentNodeSet.has(childNode));

		// 컴포넌트. (이미 있는 것 가운데 맨 앞이 같은 종류면 그것에 넣고, 아니면 붙인 다음 문서 값을 넣는다)
		const componentDataList = nodeData.components || [];
		for (const componentData of componentDataList) {
			const frontComponent = existingComponentList.length > 0 ? existingComponentList[0] : null;
			const frontTypeName = frontComponent ? findRegisteredTypeName(this.#componentTypeTable, frontComponent.constructor) : "";
			let component = null;
			if (frontComponent && frontTypeName === componentData.type) {
				component = existingComponentList.shift();
			}
			else {
				const componentType = this.#componentTypeTable[componentData.type];
				if (!componentType) {
					System.console.warn(`UIDocument: unregistered component type "${componentData.type}" is skipped. (call registerEditorTypes() on the document for documents saved by the editor)`);
					continue;
				}
				const previousComponentCount = node.getAllComponents().length;
				component = node.addComponent(componentType);

				// 붙으면서 함께 붙은 컴포넌트는 뒤따르는 문서 값을 받을 자리다. (위젯이 require 로 붙여 문서에 적히지 않는 것은 뺀다)
				const addedComponentList = node.getAllComponents().slice(previousComponentCount);
				generatedTypeSet = this.collectGeneratedComponentTypes(node.getAllComponents());
				for (const addedComponent of addedComponentList) {
					const addedTypeName = findRegisteredTypeName(this.#componentTypeTable, addedComponent.constructor);
					if (addedComponent !== component && !generatedTypeSet.has(addedTypeName)) {
						existingComponentList.push(addedComponent);
					}
				}
			}
			const propertyHandler = COMPONENT_PROPERTY_TABLE[componentData.type];
			if (propertyHandler) {
				propertyHandler.load(component, componentData, this.#loadContext);
				this.#loadNodeReferences(component, componentData);
			}
			else {
				this.loadByReflection(component, componentData);
			}
			if (component instanceof UIView) {
				widgetComponent = component;
			}
		}

		// 자식.
		const childDataList = nodeData.children || [];
		this.#fillChildren(node, childDataList, existingChildList);

		// 위젯 content 안의 자식 복원. (스크롤뷰 목록 항목 등)
		const contentChildDataList = nodeData.contentChildren || [];
		if (widgetComponent && contentChildDataList.length > 0) {
			const contentNode = widgetComponent.getContent();
			if (contentNode) {
				const existingContentChildList = contentNode.getChildren().slice();
				this.#fillChildren(contentNode, contentChildDataList, existingContentChildList);
			}
		}
	}

	//==============================================================================
	// 자식 문서 값 넣기. (이미 있는 자식은 차례와 이름이 맞으면 그것에 넣고, 아니면 만들어 붙인다)
	//==============================================================================
	/**
	 * @private
	 * @param { WorldNode } parentNode 자식을 붙일 노드.
	 * @param { object[] } childDataList 자식 노드 데이터 목록.
	 * @param { WorldNode[] } existingChildList 이미 있던 자식 목록. (문서 값을 받을 자리)
	 */
	#fillChildren(parentNode, childDataList, existingChildList) {
		let existingChildIndex = 0;
		for (const childData of childDataList) {
			const childName = childData.name || "";
			const existingChild = existingChildIndex < existingChildList.length ? existingChildList[existingChildIndex] : null;
			if (existingChild && existingChild.getName() === childName) {
				++existingChildIndex;
				this.#fillNode(existingChild, childData);
			}
			else {
				const childNode = this.#buildNode(childData);
				parentNode.addChild(childNode);
			}
		}
	}


	//==============================================================================
	// 노드 트리 → JSON 문자열.
	//==============================================================================
	/**
	 * @param { WorldNode } rootNode 문서의 뿌리 노드. (노드 참조 경로의 기준)
	 * @param { boolean } isPretty 참이면 탭으로 들여 쓴다. (기본 참)
	 * @returns { string } { version, root } 꼴의 JSON 글.
	 * @example <caption>노드 트리를 글로 적고 되살리기</caption>
	 * import { UIDocument, UILabel, WorldNode, Paint, Color, Vector2 } from "./build/vanilla.js";
	 *
	 * const rootNode = new WorldNode();
	 * rootNode.setName("Root");
	 * const panelNode = new WorldNode();
	 * panelNode.setName("Panel");
	 * panelNode.setContentSize(Vector2.create(300, 200));
	 * const panelPaint = panelNode.addComponent(Paint);
	 * panelPaint.setColor(new Color(0.1, 0.12, 0.16, 1));
	 * rootNode.addChild(panelNode);
	 * const titleNode = new WorldNode();
	 * titleNode.setName("Title");
	 * const titleLabel = titleNode.addComponent(UILabel);
	 * titleLabel.setText("Hello");
	 * panelNode.addChild(titleNode);
	 *
	 * const uiDocument = new UIDocument();
	 * const jsonText = uiDocument.toJsonText(rootNode, false);
	 * const restoredRootNode = uiDocument.fromJsonText(jsonText);
	 * const restoredTitleNode = UIDocument.findNodeByPath(restoredRootNode, "/Panel/Title");
	 * const restoredTitleLabel = restoredTitleNode.getComponent(UILabel);
	 * const restoredText = restoredTitleLabel.getText();
	 * const restoredPath = UIDocument.findNodePath(restoredRootNode, restoredTitleNode);
	 * console.log(restoredText, restoredPath);
	 */
	toJsonText(rootNode, isPretty = true) {
		const documentData = {
			version: UIDOCUMENT_VERSION,
			root: this.serializeNode(rootNode),
		};
		const jsonText = isPretty ? System.JSON.stringify(documentData, null, "\t") : System.JSON.stringify(documentData);
		return jsonText;
	}

	//==============================================================================
	// JSON 문자열 → 노드 트리. (어느 부모에도 붙지 않은 뿌리를 돌려준다, 씬에 보이려면 addChild 로 붙인다)
	//==============================================================================
	/**
	 * @param { string } jsonText { version, root } 꼴의 JSON 글. (JSON 이 아니거나 root 가 없으면 예외를 던진다)
	 * @returns { WorldNode } 되살린 뿌리 노드. (노드 참조까지 잇고, 찾을 수 있는 그림을 넣은 것)
	 */
	fromJsonText(jsonText) {
		const documentData = System.JSON.parse(jsonText);
		if (!documentData || !documentData.root) {
			throw new Error("UIDocument: invalid document.");
		}
		const rootNode = this.deserializeNode(documentData.root);
		return rootNode;
	}

	//==============================================================================
	// 지원 컴포넌트 타입 이름 목록 반환. (등록 차례, 편집 도구의 컴포넌트 추가 메뉴용)
	//==============================================================================
	/**
	 * @returns { string[] } 이 문서가 다루는 컴포넌트 이름 목록. (registerComponentType 으로 더한 것 포함, 노드 종류 이름은 들지 않는다)
	 */
	getComponentTypeNames() {
		const typeNames = System.Object.keys(this.#componentTypeTable);
		return typeNames;
	}

	//==============================================================================
	// 이름으로 컴포넌트를 지어 노드에 붙인다. (등록하지 않은 이름이면 null)
	//==============================================================================
	/**
	 * @param { WorldNode } node 컴포넌트를 붙일 노드.
	 * @param { string } typeName 등록한 컴포넌트 종류 이름.
	 * @returns { * } 붙인 컴포넌트. (등록하지 않은 이름이면 null)
	 * @example <caption>이름으로 Paint 붙이기</caption>
	 * import { UIDocument, WorldNode, Paint } from "./build/vanilla.js";
	 *
	 * const uiDocument = new UIDocument();
	 * const node = new WorldNode();
	 * const paint = uiDocument.createComponent(node, "Paint");
	 * console.log(paint === node.getComponent(Paint), uiDocument.createComponent(node, "Unknown"));
	 */
	createComponent(node, typeName) {
		if (!System.Object.hasOwn(this.#componentTypeTable, typeName)) {
			return null;
		}
		const componentType = this.#componentTypeTable[typeName];
		const component = node.addComponent(componentType);
		return component;
	}

	//==============================================================================
	// 노드의 문서 종류 이름 반환. (등록한 노드 종류 이름, 등록하지 않은 클래스면 클래스 이름)
	//==============================================================================
	/**
	 * @param { WorldNode } node 볼 노드.
	 * @returns { string } 문서에 적힐 노드 종류 이름.
	 * @example <caption>에디터 종류를 등록한 문서에서 노드 종류 보기</caption>
	 * import { UIDocument, WorldNode, FloatingText } from "./build/vanilla.js";
	 *
	 * const uiDocument = new UIDocument();
	 * uiDocument.registerEditorTypes();
	 * console.log(uiDocument.getNodeTypeName(new WorldNode()), uiDocument.getNodeTypeName(new FloatingText()));
	 */
	getNodeTypeName(node) {
		return findRegisteredTypeName(this.#nodeTypeTable, node.constructor);
	}

	//==============================================================================
	// 컴포넌트의 편집할 수 있는 속성 목록. (정적, 짝이 맞는 get 또는 is 와 set, 에디터의 인스펙터가 쓴다)
	//==============================================================================
	/**
	 * @param { * } component 볼 컴포넌트.
	 * @returns { Array<object> } { name, getterName, setterName } 의 배열.
	 */
	static getReflectedProperties(component) {
		return collectReflectedProperties(component);
	}

	//==============================================================================
	// 노드를 가리키는 속성만 따로 적는다. (전용 핸들러가 있는 컴포넌트)
	//==============================================================================
	/**
	 * @private
	 * @param { Component } component 적을 컴포넌트.
	 * @param { object } componentData 덧붙일 컴포넌트 데이터. (노드를 돌려주는 속성을 { $nodeRef: 경로 } 로 적는다)
	 */
	#saveNodeReferences(component, componentData) {
		for (const property of collectReflectedProperties(component)) {
			let currentValue = null;
			try {
				currentValue = component[property.getterName]();
			}
			catch (exception) {
				continue;
			}
			if (!(currentValue instanceof WorldNode)) {
				continue;
			}
			const referencePath = UIDocument.findNodePath(this.#serializeRootNode, currentValue);
			if (referencePath !== null) {
				componentData[property.name] = { [NODE_REFERENCE_KEY]: referencePath };
			}
		}
	}

	//==============================================================================
	// 노드를 가리키는 속성만 따로 잇는다. (전용 핸들러가 있는 컴포넌트)
	//==============================================================================
	/**
	 * @private
	 * @param { Component } component 되살릴 컴포넌트.
	 * @param { object } componentData 컴포넌트 데이터. ({ $nodeRef } 값을 찾아 트리를 다 만든 뒤 이을 목록에 넣는다)
	 */
	#loadNodeReferences(component, componentData) {
		for (const propertyName of System.Object.keys(componentData)) {
			const storedValue = componentData[propertyName];
			if (!storedValue || typeof storedValue !== "object" || storedValue[NODE_REFERENCE_KEY] === undefined) {
				continue;
			}
			const setterName = "set" + propertyName;
			if (typeof component[setterName] !== "function") {
				continue;
			}
			this.#pendingNodeReferenceList.push({
				target: component,
				setterName: setterName,
				path: storedValue[NODE_REFERENCE_KEY],
			});
		}
	}

	//==============================================================================
	// UI 뿌리 기준 절대 경로 계산. (정적, 노드 참조를 문서에 적을 때 쓴다)
	//==============================================================================
	/**
	 * @param { WorldNode } rootNode 기준 뿌리 노드. (경로에 넣지 않는다)
	 * @param { WorldNode } node 경로를 구할 노드.
	 * @returns { string | null } /Panel/Title 꼴의 경로. (뿌리 자신이면 /, 뿌리 아래가 아니면 null)
	 */
	static findNodePath(rootNode, node) {
		if (!rootNode || !node) {
			return null;
		}
		const nameList = [];
		let currentNode = node;
		while (currentNode && currentNode !== rootNode) {
			nameList.unshift(currentNode.getName());
			currentNode = currentNode.getParent();
		}
		if (currentNode !== rootNode) {
			return null;
		}
		return "/" + nameList.join("/");
	}

	//==============================================================================
	// UI 뿌리 기준 절대 경로로 노드 찾기. (정적)
	//==============================================================================
	/**
	 * @param { WorldNode } rootNode 기준 뿌리 노드.
	 * @param { string } pathText /Panel/Title 꼴의 경로. (앞의 / 는 없어도 된다, 이름이 같은 형제가 있으면 앞의 것)
	 * @returns { WorldNode | null } 찾은 노드. (빈 경로면 뿌리, 없으면 null)
	 */
	static findNodeByPath(rootNode, pathText) {
		if (!rootNode || typeof pathText !== "string") {
			return null;
		}
		const trimmedPath = pathText.replace(/^\//, "");
		if (trimmedPath.length === 0) {
			return rootNode;
		}
		let currentNode = rootNode;
		for (const nodeName of trimmedPath.split("/")) {
			let foundNode = null;
			for (const childNode of currentNode.getChildren()) {
				if (childNode.getName() === nodeName) {
					foundNode = childNode;
					break;
				}
			}
			if (!foundNode) {
				return null;
			}
			currentNode = foundNode;
		}
		return currentNode;
	}


	//==============================================================================
	// 노드 종류 등록.
	// - 엔진에 노드가 늘어나면 등록만으로 문서가 그 종류를 다룬다.
	//==============================================================================
	/**
	 * @param { string } typeName 문서에 적힐 이름. (읽을 때 이 이름으로 찾고, 적을 때도 이 이름을 쓴다)
	 * @param { * } nodeType 노드 클래스. (인자 없이 new 한다)
	 */
	registerNodeType(typeName, nodeType) {
		this.#nodeTypeTable[typeName] = nodeType;
	}

	//==============================================================================
	// 컴포넌트 종류 등록.
	//==============================================================================
	/**
	 * @param { string } typeName 문서에 적힐 이름. (읽을 때 이 이름으로 찾고, 적을 때도 이 이름을 쓴다)
	 * @param { * } componentType 컴포넌트 클래스. (전용 입출력이 없으므로 짝이 맞는 get, set 속성으로 적고 되살린다)
	 * @example <caption>게임의 컴포넌트를 문서에 담기</caption>
	 * import { UIDocument, Component, WorldNode } from "./build/vanilla.js";
	 *
	 * class Blinker extends Component {
	 * 	#speed = 1;
	 *
	 * 	getSpeed() {
	 * 		return this.#speed;
	 * 	}
	 *
	 * 	setSpeed(speed) {
	 * 		this.#speed = speed;
	 * 	}
	 * }
	 *
	 * const uiDocument = new UIDocument();
	 * uiDocument.registerComponentType("Blinker", Blinker);
	 * const rootNode = new WorldNode();
	 * const lampNode = new WorldNode();
	 * lampNode.setName("Lamp");
	 * const blinker = lampNode.addComponent(Blinker);
	 * blinker.setSpeed(3);
	 * rootNode.addChild(lampNode);
	 * const jsonText = uiDocument.toJsonText(rootNode);
	 * const restoredRootNode = uiDocument.fromJsonText(jsonText);
	 * const restoredLampNode = UIDocument.findNodeByPath(restoredRootNode, "/Lamp");
	 * const restoredBlinker = restoredLampNode.getComponent(Blinker);
	 * const speed = restoredBlinker.getSpeed();
	 * console.log(speed);
	 */
	registerComponentType(typeName, componentType) {
		this.#componentTypeTable[typeName] = componentType;
	}

	//==============================================================================
	// 에디터가 다루는 종류 모두 이 문서에 등록.
	// - UI 에디터(tools/uieditor)는 엔진이 내보내는 모든 Component 와 WorldNode 하위 클래스를 등록해 문서에 적는다.
	//   기본 표에는 런타임이 늘 쓰는 종류만 있으므로, 에디터가 저장한 문서를 읽는 게임은 이것을 한 번 부른다.
	// - 이름 차례(abc)로 등록하고, 이미 등록한 이름은 그대로 둔다. (기본 표의 전용 입출력과 게임이 등록한 종류를 지킨다)
	//==============================================================================
	/**
	 * @example <caption>에디터가 저장한 입력 필드와 스냅 스크롤을 읽기</caption>
	 * import { UIDocument, UIInputField, UISnapScrollView, WorldNode } from "./build/vanilla.js";
	 *
	 * const uiDocument = new UIDocument();
	 * uiDocument.registerEditorTypes();
	 * const rootNode = new WorldNode();
	 * const inputFieldNode = new UIInputField();
	 * inputFieldNode.setName("Name");
	 * rootNode.addChild(inputFieldNode);
	 * const pageNode = new WorldNode();
	 * pageNode.setName("Pages");
	 * pageNode.addComponent(UISnapScrollView);
	 * rootNode.addChild(pageNode);
	 * const jsonText = uiDocument.toJsonText(rootNode);
	 * const restoredRootNode = uiDocument.fromJsonText(jsonText);
	 * const restoredInputFieldNode = UIDocument.findNodeByPath(restoredRootNode, "/Name");
	 * const restoredPageNode = UIDocument.findNodeByPath(restoredRootNode, "/Pages");
	 * const restoredSnapScrollView = restoredPageNode.getComponent(UISnapScrollView);
	 * console.log(restoredInputFieldNode instanceof UIInputField, restoredSnapScrollView !== null);
	 */
	registerEditorTypes() {
		// 표를 함수 안에서 만든다. (uilistview.js 가 이 모듈을 불러 서로 부르므로 모듈을 읽을 때는 아직 클래스가 없을 수 있다)
		const editorComponentTypeList = [
			["ButtonMotion", ButtonMotion],
			["HeatHazeEffect", HeatHazeEffect],
			["Mask", Mask],
			["Outline", Outline],
			["Paint", Paint],
			["ParticleSystem", ParticleSystem],
			["PlatformerBody", PlatformerBody],
			["RichText", RichText],
			["ShaderSprite", ShaderSprite],
			["ShadowImage", ShadowImage],
			["ShadowText", ShadowText],
			["SoftShade", SoftShade],
			["Sprite", Sprite],
			["SpriteAnimator", SpriteAnimator],
			["Text", Text],
			["ToastMotion", ToastMotion],
			["ToonView3D", ToonView3D],
			["TrailRenderer", TrailRenderer],
			["UIBarChart", UIBarChart],
			["UIButton", UIButton],
			["UIControl", UIControl],
			["UIDraggable", UIDraggable],
			["UIHitArea", UIHitArea],
			["UIImageView", UIImageView],
			["UILabel", UILabel],
			["UILineChart", UILineChart],
			["UIListView", UIListView],
			["UIProgressRing", UIProgressRing],
			["UIProgressView", UIProgressView],
			["UIScrollView", UIScrollView],
			["UISlider", UISlider],
			["UISnapScrollView", UISnapScrollView],
			["UIToggleButton", UIToggleButton],
			["UIView", UIView],
			["Visual", Visual],
		];
		const editorNodeTypeList = [
			["FloatingText", FloatingText],
			["TouchEffect", TouchEffect],
			["UIConfirmWindow", UIConfirmWindow],
			["UIContextMenu", UIContextMenu],
			["UIDialog", UIDialog],
			["UIDropdown", UIDropdown],
			["UIInputField", UIInputField],
			["UIScrollBar", UIScrollBar],
			["UISpinner", UISpinner],
			["UIToast", UIToast],
			["UIWindow", UIWindow],
			["UIWindowLayer", UIWindowLayer],
		];
		for (const [typeName, componentType] of editorComponentTypeList) {
			if (!System.Object.hasOwn(this.#componentTypeTable, typeName)) {
				this.#componentTypeTable[typeName] = componentType;
			}
		}
		for (const [typeName, nodeType] of editorNodeTypeList) {
			if (!System.Object.hasOwn(this.#nodeTypeTable, typeName)) {
				this.#nodeTypeTable[typeName] = nodeType;
			}
		}
	}

	//==============================================================================
	// 짝이 맞는 get/set 속성으로 컴포넌트 저장.
	// - 전용 핸들러가 없는 컴포넌트에 쓴다. 옮길 수 있는 값만 담는다.
	// - 노드 참조는 serializeNode, toJsonText 가 적고 있는 뿌리 기준 경로로 적는다. (그 밖에서 부르면 노드 참조는 빠진다)
	//==============================================================================
	/**
	 * @param { Component } component 적을 컴포넌트.
	 * @returns { object } 속성 이름과 값. (수, 글, 참거짓은 그대로, Color 와 Vector2 는 배열, 노드는 { $nodeRef })
	 */
	saveByReflection(component) {
		const componentData = {};
		for (const property of collectReflectedProperties(component)) {
			let currentValue = null;
			try {
				currentValue = component[property.getterName]();
			}
			catch (exception) {
				continue;
			}
			if (typeof currentValue === "number" || typeof currentValue === "string" || typeof currentValue === "boolean") {
				componentData[property.name] = currentValue;
			}
			else if (currentValue instanceof Color) {
				componentData[property.name] = colorToArray(currentValue);
			}
			else if (currentValue instanceof Vector2) {
				componentData[property.name] = [currentValue.x, currentValue.y];
			}
			else if (currentValue instanceof WorldNode) {
				const referencePath = UIDocument.findNodePath(this.#serializeRootNode, currentValue);
				if (referencePath !== null) {
					componentData[property.name] = { [NODE_REFERENCE_KEY]: referencePath };
				}
			}
		}
		return componentData;
	}

	//==============================================================================
	// 짝이 맞는 get/set 속성으로 컴포넌트 복원.
	// - 지금 값의 꼴로 받을지 가린다. 지금 값이 없으면(null) 저장할 때의 꼴로 받는다.
	//   (saveByReflection 은 Color 만 수 넷 배열로, Vector2 만 수 둘 배열로, 그 밖은 수, 글, 불 그대로 적는다)
	// - 노드 참조는 맡아 두었다가 deserializeNode, fromJsonText 가 트리를 다 지은 뒤 잇는다. (그 밖에서 부르면 잇지 않는다)
	//==============================================================================
	/**
	 * @param { Component } component 되살릴 컴포넌트.
	 * @param { object } componentData saveByReflection 꼴의 데이터. (지금 값과 꼴이 같은 것만 넣는다)
	 */
	loadByReflection(component, componentData) {
		for (const property of collectReflectedProperties(component)) {
			const storedValue = componentData[property.name];
			if (storedValue === undefined) {
				continue;
			}
			let currentValue = null;
			try {
				currentValue = component[property.getterName]();
			}
			catch (exception) {
				continue;
			}
			if (storedValue && typeof storedValue === "object" && storedValue[NODE_REFERENCE_KEY] !== undefined) {
				this.#pendingNodeReferenceList.push({
					target: component,
					setterName: property.setterName,
					path: storedValue[NODE_REFERENCE_KEY],
				});
				continue;
			}
			const isCurrentEmpty = currentValue === null || currentValue === undefined;
			if (System.Array.isArray(storedValue)) {
				if ((currentValue instanceof Color || isCurrentEmpty) && storedValue.length === 4) {
					component[property.setterName](arrayToColor(storedValue));
				}
				else if ((currentValue instanceof Vector2 || isCurrentEmpty) && storedValue.length === 2) {
					component[property.setterName](Vector2.create(storedValue[0], storedValue[1]));
				}
				continue;
			}
			const isStoredPrimitive = typeof storedValue === "number" || typeof storedValue === "string" || typeof storedValue === "boolean";
			if (typeof storedValue === typeof currentValue || (isCurrentEmpty && isStoredPrimitive)) {
				component[property.setterName](storedValue);
			}
		}
	}
}
