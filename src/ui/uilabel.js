//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Color } from "../base/color.js";
import { ComponentNode } from "../core/node/componentnode.js";
import { Text } from "../core/component/text.js";
import { RichText } from "../core/component/richtext.js";
import { FontAsset } from "../resource/fontasset.js";
import { UIView } from "./uiview.js";


//==============================================================================
// UI 라벨.
// - 표시 전용. 입력을 받지 않으므로 UIView 를 상속한다.
// - 노드에 부착되면 내부적으로 Text 와 RichText 두 컴포넌트를 모두 부착한다.
//   (RichText 는 Text 를 상속하므로 컴포넌트 추가 순서는 Text → RichText 고정)
// - 기본 모드는 plain text. useRichText(true) 호출 시 RichText 가 활성화되어
//   <b> / <i> / <u> / <s> / <color=...> / <size=N> 등 마크업이 해석된다.
// - 모든 텍스트 / 폰트 / 스타일 setter 는 Text / RichText 양쪽에 동기화된다.
//   (모드 토글 시 텍스트가 유지되도록)
// - setText 시 호스트 노드의 invalidateIntrinsicContentSize 를 자동 호출.
//==============================================================================
/**
 * @example <caption>외곽선 있는 여러 줄 라벨</caption>
 * import { Engine, EngineConfiguration, UIScene, UILabel, WorldNode, Pivot, Vector2, Color } from "./build/vanilla.js";
 *
 * class MainScene extends UIScene {
 * 	constructor() {
 * 		super();
 * 		this.setLoadingMinDurationMs(0);
 * 	}
 *
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		const labelNode = new WorldNode();
 * 		labelNode.setPivot(Pivot.topLeft);
 * 		labelNode.setAnchor(Pivot.topLeft);
 * 		labelNode.setLocalPosition(Vector2.create(40, 40));
 * 		labelNode.setContentSize(Vector2.create(280, 120));
 * 		const label = labelNode.addComponent(UILabel);
 * 		label.setFontSize(22);
 * 		label.setTextColor(new Color(1, 0.95, 0.8, 1));
 * 		label.setStrokeColor(new Color(0.1, 0.1, 0.15, 1));
 * 		label.setStrokeWidth(3);
 * 		label.setTextAlign("left");
 * 		label.setWordWrapWidth(280);
 * 		label.setLineSpacing(1.4);
 * 		label.setText("A long line of text wraps inside the label width.");
 * 		const root = this.getRoot();
 * 		root.addChild(labelNode);
 * 		console.log(label.getText(), label.measureText());
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.canvasId = "mainCanvas";
 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
 * engineConfiguration.autoResizeOnWindowResize = true;
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class UILabel extends UIView {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Text | null } */ #text;
	/** @private @type { RichText | null } */ #richText;
	/** @private @type { boolean } */ #useRichText;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("UILabel");
		this.#text = null;
		this.#richText = null;
		this.#useRichText = false;
	}

	//==============================================================================
	// 의존 컴포넌트, Text 가 먼저 부착되어야 RichText 가 별도 인스턴스로 추가된다.
	// (RichText extends Text 라 순서를 뒤집으면 RichText 단일로만 잡힘)
	//==============================================================================
	/**
	 * @override
	 * @returns { Function[] } 먼저 붙일 컴포넌트 목록. ([Text, RichText])
	 */
	require() {
		return [Text, RichText];
	}

	//==============================================================================
	// 노드에 붙음. (Text / RichText 컴포넌트 참조 확보 + 활성 상태 적용)
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node 붙을 노드.
	 */
	attach(node) {
		super.attach(node);
		this.#text = node.getOrAddComponent(Text);
		this.#richText = node.getOrAddComponent(RichText);
		this.applyActiveComponent();
	}

	//==============================================================================
	// 노드에서 떨어짐.
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node 떨어질 노드.
	 */
	detach(node) {
		this.#text = null;
		this.#richText = null;
		super.detach(node);
	}

	//==============================================================================
	// 호스트 노드에 invalidateIntrinsicContentSize 가 있으면 호출.
	//==============================================================================
	invalidateIntrinsicContentSize() {
		const node = this.getNode();
		if (node && typeof node.invalidateIntrinsicContentSize === "function") {
			node.invalidateIntrinsicContentSize();
		}
	}

	//==============================================================================
	// 활성 컴포넌트 적용. (현재 모드에 맞춰 Text / RichText 의 setEnable 을 토글)
	//==============================================================================
	applyActiveComponent() {
		if (this.#text) {
			this.#text.setEnable(this.#useRichText === false);
		}
		if (this.#richText) {
			this.#richText.setEnable(this.#useRichText === true);
		}
		this.invalidateIntrinsicContentSize();
	}

	//==============================================================================
	// 리치텍스트 모드 설정. true 면 RichText 컴포넌트가 활성화되어 마크업을 해석.
	//==============================================================================
	/**
	 * @param { boolean } useRichText 참이면 리치텍스트 모드. (true 일 때만 켠다)
	 * @example <caption>마크업으로 일부만 꾸미기</caption>
	 * import { Engine, EngineConfiguration, UIScene, UILabel, WorldNode, Pivot, Vector2 } from "./build/vanilla.js";
	 *
	 * class MainScene extends UIScene {
	 * 	constructor() {
	 * 		super();
	 * 		this.setLoadingMinDurationMs(0);
	 * 	}
	 *
	 * 	initialize(engine) {
	 * 		super.initialize(engine);
	 * 		const labelNode = new WorldNode();
	 * 		labelNode.setPivot(Pivot.topLeft);
	 * 		labelNode.setAnchor(Pivot.topLeft);
	 * 		labelNode.setLocalPosition(Vector2.create(40, 40));
	 * 		labelNode.setContentSize(Vector2.create(320, 40));
	 * 		const label = labelNode.addComponent(UILabel);
	 * 		label.setFontSize(24);
	 * 		label.useRichText(true);
	 * 		label.setText("Gold <b>120</b> <color=yellow>+30</color> <size=16>bonus</size>");
	 * 		const root = this.getRoot();
	 * 		root.addChild(labelNode);
	 * 		console.log(label.isUsingRichText(), label.getText());
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.canvasId = "mainCanvas";
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * engineConfiguration.autoResizeOnWindowResize = true;
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	useRichText(useRichText) {
		this.#useRichText = useRichText === true;
		this.applyActiveComponent();
	}

	//==============================================================================
	// 리치텍스트 모드 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 리치텍스트 모드면 참.
	 */
	isUsingRichText() {
		return this.#useRichText;
	}

	//==============================================================================
	// 텍스트 설정. Text 와 RichText 양쪽에 동기화 (모드 토글 시 보존).
	//==============================================================================
	/**
	 * @param { string } text 보일 글. (리치텍스트 모드에서는 마크업으로 읽는다)
	 */
	setText(text) {
		// 같은 글이면 건너뛴다. (내재 크기를 다시 셈하게 하지 않는다, 리치텍스트는 조각을 따로 쌓았을 수 있어 늘 넣는다)
		const isSameText = !this.#useRichText && this.#text !== null && this.#text.getText() === text && this.#richText !== null && this.#richText.getText() === text;
		if (isSameText) {
			return;
		}
		if (this.#text) {
			this.#text.setText(text);
		}
		if (this.#richText) {
			this.#richText.setText(text);
		}
		this.invalidateIntrinsicContentSize();
	}

	//==============================================================================
	// 텍스트 반환. (활성 컴포넌트의 plain 텍스트)
	//==============================================================================
	/**
	 * @returns { string } 지금 모드의 글. (노드에 붙기 전이면 빈 글)
	 */
	getText() {
		if (this.#useRichText && this.#richText) {
			return this.#richText.getText();
		}
		if (this.#text) {
			return this.#text.getText();
		}
		return "";
	}

	//==============================================================================
	// 리치텍스트 segment 1 개 추가. (RichText 컴포넌트에 직접 적용)
	// - useRichText(true) 가 켜져있어야 화면에 반영된다.
	//==============================================================================
	/**
	 * @param { string } text 덧붙일 글.
	 * @param { object } [attributes] 그 조각의 서식. ({ fontFace, fontSize, textColor, strokeColor, strokeWidth, bold, italic, underline, strikethrough }, 색은 Color, 빠진 것은 라벨의 값)
	 * @returns { UILabel } 이 라벨. (이어 부를 수 있다)
	 * @example <caption>서식이 다른 조각을 이어 붙이기</caption>
	 * import { Engine, EngineConfiguration, UIScene, UILabel, WorldNode, Pivot, Vector2, Color } from "./build/vanilla.js";
	 *
	 * class MainScene extends UIScene {
	 * 	constructor() {
	 * 		super();
	 * 		this.setLoadingMinDurationMs(0);
	 * 	}
	 *
	 * 	initialize(engine) {
	 * 		super.initialize(engine);
	 * 		const labelNode = new WorldNode();
	 * 		labelNode.setPivot(Pivot.topLeft);
	 * 		labelNode.setAnchor(Pivot.topLeft);
	 * 		labelNode.setLocalPosition(Vector2.create(40, 40));
	 * 		labelNode.setContentSize(Vector2.create(320, 40));
	 * 		const label = labelNode.addComponent(UILabel);
	 * 		label.setFontSize(22);
	 * 		label.useRichText(true);
	 * 		label.clearSegments();
	 * 		label.appendSegment("HP ", { bold: true });
	 * 		label.appendSegment("80", { textColor: new Color(1, 0.3, 0.3, 1), fontSize: 28 });
	 * 		label.appendSegment(" / 100");
	 * 		const root = this.getRoot();
	 * 		root.addChild(labelNode);
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.canvasId = "mainCanvas";
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * engineConfiguration.autoResizeOnWindowResize = true;
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	appendSegment(text, attributes) {
		if (this.#richText) {
			this.#richText.appendSegment(text, attributes);
			this.invalidateIntrinsicContentSize();
		}
		return this;
	}

	//==============================================================================
	// 리치텍스트 segment 모두 제거.
	//==============================================================================
	clearSegments() {
		if (this.#richText) {
			this.#richText.clearSegments();
			this.invalidateIntrinsicContentSize();
		}
	}

	//==============================================================================
	// 폰트 크기 설정.
	//==============================================================================
	/**
	 * @param { number } fontSize 글자 크기. (내용 크기 단위, 처음은 32)
	 */
	setFontSize(fontSize) {
		if (this.#text) {
			this.#text.setFontSize(fontSize);
		}
		if (this.#richText) {
			this.#richText.setFontSize(fontSize);
		}
		this.invalidateIntrinsicContentSize();
	}

	//==============================================================================
	// 한 줄 글을 너비에 맞추기 설정. (넘치면 처음 크기에서 최소 비율까지 줄여 그린다, Text.setFitWidth)
	// - 리치텍스트 모드는 맞추지 않는다. width 가 0 이하면 맞추지 않는다.
	//==============================================================================
	/**
	 * @param { number } width 맞출 너비. (내용 크기 단위, 0 이하면 맞추지 않는다)
	 * @param { number } minimumRatio 0 ~ 1, 기본 0.55.
	 * @example <caption>긴 글을 칸 너비에 맞춰 줄이기</caption>
	 * import { Engine, EngineConfiguration, UIScene, UILabel, WorldNode, Pivot, Vector2 } from "./build/vanilla.js";
	 *
	 * class MainScene extends UIScene {
	 * 	constructor() {
	 * 		super();
	 * 		this.setLoadingMinDurationMs(0);
	 * 	}
	 *
	 * 	initialize(engine) {
	 * 		super.initialize(engine);
	 * 		const labelNode = new WorldNode();
	 * 		labelNode.setPivot(Pivot.topLeft);
	 * 		labelNode.setAnchor(Pivot.topLeft);
	 * 		labelNode.setLocalPosition(Vector2.create(40, 40));
	 * 		labelNode.setContentSize(Vector2.create(160, 40));
	 * 		const label = labelNode.addComponent(UILabel);
	 * 		label.setFontSize(24);
	 * 		label.setText("Continue the adventure");
	 * 		label.setFitWidth(160, 0.5);
	 * 		const root = this.getRoot();
	 * 		root.addChild(labelNode);
	 * 		console.log(label.getFontSize(), label.calculateFittedFontSize());
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.canvasId = "mainCanvas";
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * engineConfiguration.autoResizeOnWindowResize = true;
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	setFitWidth(width, minimumRatio = 0.55) {
		if (this.#text) {
			this.#text.setFitWidth(width, minimumRatio);
		}
	}

	//==============================================================================
	// 맞출 너비 반환. (0 이면 맞추지 않는다)
	//==============================================================================
	/**
	 * @returns { number } 맞출 너비. (0 이면 맞추지 않는다, 노드에 붙기 전이면 0)
	 */
	getFitWidth() {
		if (this.#text) {
			return this.#text.getFitWidth();
		}
		return 0;
	}

	//==============================================================================
	// 그릴 때의 크기 반환. (맞춰 줄였으면 줄인 크기)
	//==============================================================================
	/**
	 * @returns { number } 그릴 때의 글자 크기. (노드에 붙기 전이면 0)
	 */
	getFittedFontSize() {
		if (this.#text) {
			return this.#text.getFittedFontSize();
		}
		return 0;
	}

	//==============================================================================
	// 그릴 때의 크기를 그 자리에서 재어 반환. (Text.calculateFittedFontSize)
	//==============================================================================
	/**
	 * @returns { number } 지금 잰 그릴 때의 글자 크기. (노드에 붙기 전이면 0)
	 */
	calculateFittedFontSize() {
		if (this.#text) {
			return this.#text.calculateFittedFontSize();
		}
		return 0;
	}

	//==============================================================================
	// 글의 너비 재기. (이 라벨의 글꼴, 굵게, 기울임으로, 주지 않으면 지금 글과 정한 크기로, Text.measureText)
	//==============================================================================
	/**
	 * @param { string } text 잴 글. (주지 않으면 지금 글)
	 * @param { number } fontSize 글자 크기. (주지 않으면 정한 크기)
	 * @returns { number } 글 너비. (내용 크기 단위, 글이 비었거나 노드에 붙기 전이거나 문서가 없으면 0)
	 */
	measureText(text = this.getText(), fontSize = this.getFontSize()) {
		if (this.#text) {
			return this.#text.measureText(text, fontSize);
		}
		return 0;
	}

	//==============================================================================
	// 내용 영역 안에서만 그리는지. (라벨 자신은 내용 영역에 바탕만 칠한다, 글은 Text 가 따로 알린다)
	//==============================================================================
	/**
	 * @override
	 * @returns { boolean } 늘 참.
	 */
	isDrawnInsideContent() {
		return true;
	}

	//==============================================================================
	// 폰트 크기 반환.
	//==============================================================================
	/**
	 * @returns { number } 정한 글자 크기. (노드에 붙기 전이면 0)
	 */
	getFontSize() {
		if (this.#text) {
			return this.#text.getFontSize();
		}
		return 0;
	}

	//==============================================================================
	// 폰트 설정.
	//==============================================================================
	/**
	 * @param { FontFace | FontAsset | null } font
	 */
	//==============================================================================
	// 자동 줄바꿈 폭 설정. (일반 텍스트 모드 전용, 0 이면 한 줄)
	//==============================================================================
	/**
	 * @param { number } wordWrapWidth 자동 줄바꿈 폭. (내용 크기 단위, 음수는 0, 0 이면 한 줄)
	 */
	setWordWrapWidth(wordWrapWidth) {
		if (this.#text) {
			this.#text.setWordWrapWidth(wordWrapWidth);
		}
		this.invalidateIntrinsicContentSize();
	}

	//==============================================================================
	// 줄바꿈 방식 설정. ("word" | "char")
	//==============================================================================
	/**
	 * @param { string } wrapMode word 면 공백 단위(넘치는 단어는 글자 단위), char 면 글자 단위.
	 */
	setWrapMode(wrapMode) {
		if (this.#text) {
			this.#text.setWrapMode(wrapMode);
		}
	}

	//==============================================================================
	// 줄바꿈 방식 반환. ("word" | "char", 글이 없으면 "word")
	//==============================================================================
	/**
	 * @returns { string } 줄바꿈 방식. (word 나 char)
	 */
	getWrapMode() {
		if (this.#text) {
			return this.#text.getWrapMode();
		}
		return "word";
	}

	//==============================================================================
	// 줄 간격 배율 설정.
	//==============================================================================
	/**
	 * @param { number } lineSpacing 줄 간격 배율. (글자 크기에 곱한다, 0.1 보다 작으면 0.1, 처음은 1.25)
	 */
	setLineSpacing(lineSpacing) {
		if (this.#text) {
			this.#text.setLineSpacing(lineSpacing);
		}
		this.invalidateIntrinsicContentSize();
	}

	//==============================================================================
	// 표시 글자 수 설정. (-1 이면 전체, 타자기 연출용, 일반 텍스트 모드 전용. 글자 묶음 단위)
	//==============================================================================
	/**
	 * @param { number } visibleCharacterCount 표시 글자 수. (글자 묶음 단위, 내림, -1 이면 전체)
	 * @example <caption>타자기처럼 한 글자씩 보이기</caption>
	 * import { Engine, EngineConfiguration, UIScene, UILabel, WorldNode, Pivot, Vector2 } from "./build/vanilla.js";
	 *
	 * class MainScene extends UIScene {
	 * 	constructor() {
	 * 		super();
	 * 		this.setLoadingMinDurationMs(0);
	 * 		this.label = null;
	 * 		this.elapsedSeconds = 0;
	 * 	}
	 *
	 * 	initialize(engine) {
	 * 		super.initialize(engine);
	 * 		const labelNode = new WorldNode();
	 * 		labelNode.setPivot(Pivot.topLeft);
	 * 		labelNode.setAnchor(Pivot.topLeft);
	 * 		labelNode.setLocalPosition(Vector2.create(40, 40));
	 * 		labelNode.setContentSize(Vector2.create(400, 40));
	 * 		const label = labelNode.addComponent(UILabel);
	 * 		label.setFontSize(22);
	 * 		label.setTextAlign("left");
	 * 		label.setText("Welcome to the village.");
	 * 		label.setVisibleCharacterCount(0);
	 * 		this.label = label;
	 * 		const root = this.getRoot();
	 * 		root.addChild(labelNode);
	 * 	}
	 *
	 * 	tick(timeDelta) {
	 * 		super.tick(timeDelta);
	 * 		if (this.label !== null) {
	 * 			this.elapsedSeconds += timeDelta;
	 * 			const characterCount = Math.floor(this.elapsedSeconds * 20);
	 * 			this.label.setVisibleCharacterCount(characterCount);
	 * 		}
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.canvasId = "mainCanvas";
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * engineConfiguration.autoResizeOnWindowResize = true;
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	setVisibleCharacterCount(visibleCharacterCount) {
		if (this.#text) {
			this.#text.setVisibleCharacterCount(visibleCharacterCount);
		}
	}

	//==============================================================================
	// 표시 글자 수 반환. (-1 이면 전체, 붙기 전이면 -1)
	//==============================================================================
	/**
	 * @returns { number } 표시 글자 수. (-1 이면 전체)
	 */
	getVisibleCharacterCount() {
		if (this.#text) {
			return this.#text.getVisibleCharacterCount();
		}
		return -1;
	}

	//==============================================================================
	// 폰트 설정.
	//==============================================================================
	/**
	 * @param { FontFace | FontAsset | null } font 글꼴. (FontAsset 이면 그 fontFace, null 이면 시스템 글꼴, 그 밖의 꼴은 무시한다)
	 */
	setFont(font) {
		if (this.#text) {
			this.#text.setFont(font);
		}
		if (this.#richText) {
			this.#richText.setFont(font);
		}
		this.invalidateIntrinsicContentSize();
	}

	//==============================================================================
	// 텍스트 색 설정.
	//==============================================================================
	/**
	 * @param { Color | string } color 글 색. (Color 나 "#rrggbb(aa)", "rgb(a)(...)" 글, null 이나 undefined 면 투명, 처음은 흰색)
	 */
	setTextColor(color) {
		if (this.#text) {
			this.#text.setTextColor(color);
		}
		if (this.#richText) {
			this.#richText.setTextColor(color);
		}
	}

	//==============================================================================
	// 텍스트 색 반환.
	//==============================================================================
	/**
	 * @returns { Color | null } 글 색. (노드에 붙기 전이면 null)
	 */
	getTextColor() {
		if (this.#text) {
			return this.#text.getTextColor();
		}
		return null;
	}

	//==============================================================================
	// 텍스트 외곽선 색 설정.
	//==============================================================================
	/**
	 * @param { Color | string } color 외곽선 색. (Color 나 "#rrggbb(aa)", "rgb(a)(...)" 글, null 이나 undefined 면 투명)
	 */
	setStrokeColor(color) {
		if (this.#text) {
			this.#text.setStrokeColor(color);
		}
		if (this.#richText) {
			this.#richText.setStrokeColor(color);
		}
	}

	//==============================================================================
	// 텍스트 외곽선 두께 설정.
	//==============================================================================
	/**
	 * @param { number } width 외곽선 두께. (내용 크기 단위, 0 이하면 외곽선을 그리지 않는다)
	 */
	setStrokeWidth(width) {
		if (this.#text) {
			this.#text.setStrokeWidth(width);
		}
		if (this.#richText) {
			this.#richText.setStrokeWidth(width);
		}
	}

	//==============================================================================
	// 볼드 설정.
	//==============================================================================
	/**
	 * @param { boolean } bold 굵게 할지. (true 일 때만 굵게)
	 */
	setBold(bold) {
		if (this.#text) {
			this.#text.setBold(bold);
		}
		if (this.#richText) {
			this.#richText.setBold(bold);
		}
		this.invalidateIntrinsicContentSize();
	}

	//==============================================================================
	// 볼드 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 굵게면 참.
	 */
	isBold() {
		if (this.#text) {
			return this.#text.isBold();
		}
		return false;
	}

	//==============================================================================
	// 이탤릭 설정.
	//==============================================================================
	/**
	 * @param { boolean } italic 기울일지. (true 일 때만 기울인다)
	 */
	setItalic(italic) {
		if (this.#text) {
			this.#text.setItalic(italic);
		}
		if (this.#richText) {
			this.#richText.setItalic(italic);
		}
		this.invalidateIntrinsicContentSize();
	}

	//==============================================================================
	// 이탤릭 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 기울임이면 참.
	 */
	isItalic() {
		if (this.#text) {
			return this.#text.isItalic();
		}
		return false;
	}

	//==============================================================================
	// 밑줄 설정.
	//==============================================================================
	/**
	 * @param { boolean } underline 밑줄을 그을지. (true 일 때만 긋는다)
	 */
	setUnderline(underline) {
		if (this.#text) {
			this.#text.setUnderline(underline);
		}
		if (this.#richText) {
			this.#richText.setUnderline(underline);
		}
	}

	//==============================================================================
	// 밑줄 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 밑줄이면 참.
	 */
	isUnderline() {
		if (this.#text) {
			return this.#text.isUnderline();
		}
		return false;
	}

	//==============================================================================
	// 취소선 설정.
	//==============================================================================
	/**
	 * @param { boolean } strikethrough 취소선을 그을지. (true 일 때만 긋는다)
	 */
	setStrikethrough(strikethrough) {
		if (this.#text) {
			this.#text.setStrikethrough(strikethrough);
		}
		if (this.#richText) {
			this.#richText.setStrikethrough(strikethrough);
		}
	}

	//==============================================================================
	// 취소선 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 취소선이면 참.
	 */
	isStrikethrough() {
		if (this.#text) {
			return this.#text.isStrikethrough();
		}
		return false;
	}

	//==============================================================================
	// 가로 정렬 설정.
	//==============================================================================
	/**
	 * @param { "left" | "center" | "right" | "start" | "end" } align 가로 정렬. ("start", "end" 는 글 방향을 따른다, 처음은 "center")
	 */
	setTextAlign(align) {
		if (this.#text) {
			this.#text.setTextAlign(align);
		}
		if (this.#richText) {
			this.#richText.setTextAlign(align);
		}
	}

	//==============================================================================
	// 글자 방향 설정. ("inherit" | "ltr" | "rtl" | "auto", Text.setTextDirection 과 같다)
	// - 서식 조각(segment)으로 그리는 리치 텍스트는 방향과 상관없이 왼쪽에서 오른쪽으로 잇는다.
	//==============================================================================
	/**
	 * @param { "inherit" | "ltr" | "rtl" | "auto" } textDirection 글자 방향. (처음은 "inherit")
	 */
	setTextDirection(textDirection) {
		if (this.#text) {
			this.#text.setTextDirection(textDirection);
		}
		if (this.#richText) {
			this.#richText.setTextDirection(textDirection);
		}
	}

	//==============================================================================
	// 글자 방향 반환.
	//==============================================================================
	/**
	 * @returns { string } 글자 방향. (노드에 붙기 전이면 "inherit")
	 */
	getTextDirection() {
		if (this.#text) {
			return this.#text.getTextDirection();
		}
		return "inherit";
	}

	//==============================================================================
	// 세로 정렬 설정.
	//==============================================================================
	/**
	 * @param { "top" | "middle" | "bottom" | "alphabetic" | "hanging" | "ideographic" } baseline 세로 정렬. (여러 줄 글은 줄 묶음의 세로 자리로 쓴다, 처음은 "middle")
	 */
	setTextBaseline(baseline) {
		if (this.#text) {
			this.#text.setTextBaseline(baseline);
		}
		if (this.#richText) {
			this.#richText.setTextBaseline(baseline);
		}
	}

	//==============================================================================
	// 가로 정렬 반환.
	//==============================================================================
	/**
	 * @returns { string } 가로 정렬. (노드에 붙기 전이면 "center")
	 */
	getTextAlign() {
		if (this.#text) {
			return this.#text.getTextAlign();
		}
		return "center";
	}

	//==============================================================================
	// 세로 정렬 반환.
	//==============================================================================
	/**
	 * @returns { string } 세로 정렬. (노드에 붙기 전이면 "middle")
	 */
	getTextBaseline() {
		if (this.#text) {
			return this.#text.getTextBaseline();
		}
		return "middle";
	}
}
