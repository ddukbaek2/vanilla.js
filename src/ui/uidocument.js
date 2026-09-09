//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Color } from "../base/color.js";
import { WorldNode } from "../core/node/worldnode.js";
import { Paint } from "../core/component/paint.js";
import { Sprite } from "../core/component/sprite.js";
import { Text } from "../core/component/text.js";
import { RichText } from "../core/component/richtext.js";
import { Mask } from "../core/component/mask.js";
import { UIView } from "./uiview.js";
import { UILabel } from "./uilabel.js";
import { UIImageView } from "./uiimageview.js";
import { UIButton } from "./uibutton.js";
import { UIToggleButton } from "./uitogglebutton.js";
import { UIProgressView } from "./uiprogressview.js";
import { UISlider } from "./uislider.js";
import { UIScrollView } from "./uiscrollview.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// UI 문서 포맷 버전.
const UIDOCUMENT_VERSION = 1;

// 노드 타입 테이블. (문서에 기록되는 이름 → 생성자)
// - registerNodeType() 으로 바깥에서 종류를 더할 수 있다.
const NODE_TYPE_TABLE = {
	WorldNode: WorldNode,
};

// 노드 참조를 문서에 적을 때 쓰는 표시.
const NODE_REFERENCE_KEY = "$nodeRef";

// 속성 목록에서 빼는 이름. (다른 객체를 가리키거나 문서로 옮길 수 없는 것)
const REFLECTED_PROPERTY_EXCLUDE_NAMES = new System.Set([
	"Parent", "Node", "Owner", "Scene", "Content", "Children", "AllComponents",
	"Component", "Components", "Root", "Graphic", "Camera", "Target",
]);

// 컴포넌트 타입 테이블. (문서에 기록되는 이름 → 생성자)
const COMPONENT_TYPE_TABLE = {
	Paint: Paint,
	Sprite: Sprite,
	Text: Text,
	RichText: RichText,
	Mask: Mask,
	UILabel: UILabel,
	UIImageView: UIImageView,
	UIButton: UIButton,
	UIToggleButton: UIToggleButton,
	UIProgressView: UIProgressView,
	UISlider: UISlider,
	UIScrollView: UIScrollView,
};


//==============================================================================
// 전역 함수 목록.
//==============================================================================
// 복원 중 노드 참조를 뒤에 잇기 위한 임시 보관.
let deserializeRootNode = null;
const pendingNodeReferenceList = [];


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
// 텍스트 속성 저장. (UILabel / Text 공용 — 같은 표현을 공유한다)
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
// - 이미지 원본은 문서에 담지 않고 경로(imagePath)만 기록한다. 실제 이미지 연결은
//   런타임이 setImageResolver 로 등록한 해석기가 담당한다.
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
				imagePath: component.imagePath || "",
				nineSlice: nineSlice ? [nineSlice.left, nineSlice.top, nineSlice.right, nineSlice.bottom] : null,
				spriteDrawMode: component.getSpriteDrawMode(),
				spriteBlendMode: component.getSpriteBlendMode(),
			};
		},
		load(component, data) {
			if (data.color) {
				component.setColor(arrayToColor(data.color));
			}
			if (data.roundSize !== undefined) {
				component.setRoundSize(data.roundSize);
			}
			if (data.imagePath) {
				component.imagePath = data.imagePath;
				const resolvedImage = UIDocument.resolveImage(data.imagePath);
				if (resolvedImage) {
					component.setImage(resolvedImage);
				}
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
			return { imagePath: component.imagePath || "" };
		},
		load(component, data) {
			if (data.imagePath) {
				component.imagePath = data.imagePath;
				const resolvedImage = UIDocument.resolveImage(data.imagePath);
				if (resolvedImage) {
					component.setImage(resolvedImage);
				}
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

// 이미지 경로 해석기. (런타임이 등록한다 — 미등록이면 이미지 없이 복원)
let imageResolver = null;


//==============================================================================
// UI 문서. (WorldNode 트리 ↔ JSON 상호 변환)
// - UI 편집 도구가 저장한 문서를 런타임에서 그대로 복원하기 위한 계층이다.
// - UIView 계열 위젯은 부착 시 content 노드와 의존 컴포넌트를 스스로 만든다.
//   따라서 문서에는 위젯만 기록하고, 사용자가 content 안에 넣은 자식은
//   contentChildren 으로 따로 보존한다. (스크롤뷰의 목록 항목 등)
//==============================================================================
export class UIDocument extends Object {
	//==============================================================================
	// 이미지 경로 해석기 등록. (정적 — 경로 → HTMLImageElement)
	//==============================================================================
	/**
	 * @param { function(string): HTMLImageElement | null } resolver
	 */
	static setImageResolver(resolver) {
		imageResolver = resolver;
	}

	//==============================================================================
	// 이미지 경로 해석. (정적)
	//==============================================================================
	/**
	 * @param { string } imagePath
	 * @returns { HTMLImageElement | null }
	 */
	static resolveImage(imagePath) {
		if (!imageResolver) {
			return null;
		}
		const resolvedImage = imageResolver(imagePath);
		return resolvedImage;
	}

	//==============================================================================
	// 노드 트리 → 문서 데이터. (정적 — 재귀)
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @returns { object }
	 */
	static serializeNode(node) {
		const pivot = node.getPivot();
		const anchor = node.getAnchor();
		const contentSize = node.getContentSize();
		const localPosition = node.getLocalPosition();
		const localScale = node.getLocalScale();
		const nodeData = {
			type: node.constructor.name,
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
		const generatedTypeSet = UIDocument.collectGeneratedComponentTypes(componentList);
		// 위젯마다 content 노드를 하나씩 만들므로 전부 모아 둔다.
		const widgetContentNodeSet = new System.Set();
		for (const component of componentList) {
			const componentTypeName = component.constructor.name;
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
			const componentData = propertyHandler ? propertyHandler.save(component) : UIDocument.saveByReflection(component);
			if (propertyHandler) {
				// 전용 핸들러는 노드 참조를 다루지 않으므로 여기에서 따로 얹는다.
				UIDocument.saveNodeReferences(component, componentData);
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
					nodeData.contentChildren = grandChildNodeList.map((grandChildNode) => UIDocument.serializeNode(grandChildNode));
				}
				continue;
			}
			nodeData.children.push(UIDocument.serializeNode(childNode));
		}
		return nodeData;
	}

	//==============================================================================
	// 위젯이 생성한 컴포넌트 타입 수집. (정적 — UIView 계열의 require 목록)
	//==============================================================================
	/**
	 * @param { object[] } componentList
	 * @returns { Set<string> }
	 */
	static collectGeneratedComponentTypes(componentList) {
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
				generatedTypeSet.add(requiredType.name);
			}
		}
		return generatedTypeSet;
	}

	//==============================================================================
	// 문서 데이터 → 노드 트리. (정적 — 재귀)
	//==============================================================================
	/**
	 * @param { object } nodeData
	 * @returns { WorldNode }
	 */
	static deserializeNode(nodeData) {
		const nodeType = NODE_TYPE_TABLE[nodeData.type] || WorldNode;
		const node = new nodeType();
		node.setName(nodeData.name || "");
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

		const componentDataList = nodeData.components || [];
		let widgetComponent = null;
		for (const componentData of componentDataList) {
			const componentType = COMPONENT_TYPE_TABLE[componentData.type];
			const propertyHandler = COMPONENT_PROPERTY_TABLE[componentData.type];
			if (!componentType) {
				continue;
			}
			const component = node.addComponent(componentType);
			if (propertyHandler) {
				propertyHandler.load(component, componentData);
				UIDocument.loadNodeReferences(component, componentData);
			}
			else {
				UIDocument.loadByReflection(component, componentData);
			}
			if (component instanceof UIView) {
				widgetComponent = component;
			}
		}

		const childDataList = nodeData.children || [];
		for (const childData of childDataList) {
			node.addChild(UIDocument.deserializeNode(childData));
		}

		// 위젯 content 안의 자식 복원. (스크롤뷰 목록 항목 등)
		const contentChildDataList = nodeData.contentChildren || [];
		if (widgetComponent && contentChildDataList.length > 0) {
			const contentNode = widgetComponent.getContent();
			if (contentNode) {
				for (const contentChildData of contentChildDataList) {
					contentNode.addChild(UIDocument.deserializeNode(contentChildData));
				}
			}
		}
		return node;
	}

	//==============================================================================
	// 노드 트리 → JSON 문자열. (정적)
	//==============================================================================
	/**
	 * @param { WorldNode } rootNode
	 * @param { boolean } isPretty
	 * @returns { string }
	 */
	static toJsonText(rootNode, isPretty = true) {
		// 노드 참조를 절대 경로로 적기 위해 기준 뿌리를 잡아 둔다.
		deserializeRootNode = rootNode;
		const documentData = {
			version: UIDOCUMENT_VERSION,
			root: UIDocument.serializeNode(rootNode),
		};
		deserializeRootNode = null;
		const jsonText = isPretty ? System.JSON.stringify(documentData, null, "\t") : System.JSON.stringify(documentData);
		return jsonText;
	}

	//==============================================================================
	// JSON 문자열 → 노드 트리. (정적)
	//==============================================================================
	/**
	 * @param { string } jsonText
	 * @returns { WorldNode }
	 */
	static fromJsonText(jsonText) {
		const documentData = System.JSON.parse(jsonText);
		if (!documentData || !documentData.root) {
			throw new Error("UIDocument: invalid document.");
		}
		pendingNodeReferenceList.length = 0;
		const rootNode = UIDocument.deserializeNode(documentData.root);

		// 트리를 다 만든 뒤에 노드 참조를 잇는다.
		for (const pendingReference of pendingNodeReferenceList) {
			const referencedNode = UIDocument.findNodeByPath(rootNode, pendingReference.path);
			if (referencedNode) {
				pendingReference.target[pendingReference.setterName](referencedNode);
			}
		}
		pendingNodeReferenceList.length = 0;
		return rootNode;
	}

	//==============================================================================
	// 지원 컴포넌트 타입 이름 목록 반환. (정적 — 편집 도구의 컴포넌트 추가 메뉴용)
	//==============================================================================
	/**
	 * @returns { string[] }
	 */
	static getComponentTypeNames() {
		const typeNames = System.Object.keys(COMPONENT_TYPE_TABLE);
		return typeNames;
	}

	//==============================================================================
	// 컴포넌트 타입 이름으로 생성자 반환. (정적)
	//==============================================================================
	/**
	 * @param { string } typeName
	 * @returns { * }
	 */
	static getComponentType(typeName) {
		const componentType = COMPONENT_TYPE_TABLE[typeName];
		return componentType;
	}

	//==============================================================================
	// 노드를 가리키는 속성만 따로 적는다.
	//==============================================================================
	/**
	 * @param { Component } component
	 * @param { object } componentData
	 */
	static saveNodeReferences(component, componentData) {
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
			const referencePath = UIDocument.findNodePath(UIDocument.getSerializeRootNode(), currentValue);
			if (referencePath !== null) {
				componentData[property.name] = { [NODE_REFERENCE_KEY]: referencePath };
			}
		}
	}

	//==============================================================================
	// 노드를 가리키는 속성만 따로 잇는다.
	//==============================================================================
	/**
	 * @param { Component } component
	 * @param { object } componentData
	 */
	static loadNodeReferences(component, componentData) {
		for (const propertyName of System.Object.keys(componentData)) {
			const storedValue = componentData[propertyName];
			if (!storedValue || typeof storedValue !== "object" || storedValue[NODE_REFERENCE_KEY] === undefined) {
				continue;
			}
			const setterName = "set" + propertyName;
			if (typeof component[setterName] !== "function") {
				continue;
			}
			pendingNodeReferenceList.push({
				target: component,
				setterName: setterName,
				path: storedValue[NODE_REFERENCE_KEY],
			});
		}
	}

	//==============================================================================
	// UI 뿌리 기준 절대 경로 계산. (노드 참조를 문서에 적을 때 쓴다)
	//==============================================================================
	/**
	 * @param { WorldNode } rootNode
	 * @param { WorldNode } node
	 * @returns { string | null }
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
	// UI 뿌리 기준 절대 경로로 노드 찾기.
	//==============================================================================
	/**
	 * @param { WorldNode } rootNode
	 * @param { string } pathText
	 * @returns { WorldNode | null }
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
	// 경로 계산 기준이 되는 뿌리 반환.
	//==============================================================================
	/**
	 * @returns { WorldNode }
	 */
	static getSerializeRootNode() {
		return deserializeRootNode;
	}

	//==============================================================================
	// 노드 종류 등록.
	// - 엔진에 노드가 늘어나면 등록만으로 문서가 그 종류를 다룬다.
	//==============================================================================
	/**
	 * @param { string } typeName
	 * @param { * } nodeType
	 */
	static registerNodeType(typeName, nodeType) {
		NODE_TYPE_TABLE[typeName] = nodeType;
	}

	//==============================================================================
	// 컴포넌트 종류 등록.
	//==============================================================================
	/**
	 * @param { string } typeName
	 * @param { * } componentType
	 */
	static registerComponentType(typeName, componentType) {
		COMPONENT_TYPE_TABLE[typeName] = componentType;
	}

	//==============================================================================
	// 짝이 맞는 get/set 속성으로 컴포넌트 저장.
	// - 전용 핸들러가 없는 컴포넌트에 쓴다. 옮길 수 있는 값만 담는다.
	//==============================================================================
	/**
	 * @param { Component } component
	 * @returns { object }
	 */
	static saveByReflection(component) {
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
				const referencePath = UIDocument.findNodePath(UIDocument.getSerializeRootNode(), currentValue);
				if (referencePath !== null) {
					componentData[property.name] = { [NODE_REFERENCE_KEY]: referencePath };
				}
			}
		}
		return componentData;
	}

	//==============================================================================
	// 짝이 맞는 get/set 속성으로 컴포넌트 복원.
	//==============================================================================
	/**
	 * @param { Component } component
	 * @param { object } componentData
	 */
	static loadByReflection(component, componentData) {
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
				pendingNodeReferenceList.push({
					target: component,
					setterName: property.setterName,
					path: storedValue[NODE_REFERENCE_KEY],
				});
				continue;
			}
			if (System.Array.isArray(storedValue)) {
				if (currentValue instanceof Color && storedValue.length === 4) {
					component[property.setterName](arrayToColor(storedValue));
				}
				else if (currentValue instanceof Vector2 && storedValue.length === 2) {
					component[property.setterName](Vector2.create(storedValue[0], storedValue[1]));
				}
				continue;
			}
			if (typeof storedValue === typeof currentValue) {
				component[property.setterName](storedValue);
			}
		}
	}
}
