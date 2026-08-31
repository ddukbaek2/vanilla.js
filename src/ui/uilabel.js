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
	// 의존 컴포넌트 — Text 가 먼저 부착되어야 RichText 가 별도 인스턴스로 추가된다.
	// (RichText extends Text 라 순서를 뒤집으면 RichText 단일로만 잡힘)
	//==============================================================================
	/**
	 * @override
	 * @returns { Function[] }
	 */
	require() {
		return [Text, RichText];
	}

	//==============================================================================
	// 노드에 붙음. (Text / RichText 컴포넌트 참조 확보 + 활성 상태 적용)
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node
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
	 * @param { ComponentNode } node
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
	 * @param { boolean } useRichText
	 */
	useRichText(useRichText) {
		this.#useRichText = useRichText === true;
		this.applyActiveComponent();
	}

	//==============================================================================
	// 리치텍스트 모드 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isUsingRichText() {
		return this.#useRichText;
	}

	//==============================================================================
	// 텍스트 설정. Text 와 RichText 양쪽에 동기화 (모드 토글 시 보존).
	//==============================================================================
	/**
	 * @param { string } text
	 */
	setText(text) {
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
	 * @returns { string }
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
	 * @param { string } text
	 * @param { object } [attributes]
	 * @returns { UILabel }
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
	 * @param { number } fontSize
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
	// 폰트 크기 반환.
	//==============================================================================
	/**
	 * @returns { number }
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
	// 자동 줄바꿈 폭 설정. (일반 텍스트 모드 전용 — 0 이면 한 줄)
	//==============================================================================
	/**
	 * @param { number } wordWrapWidth
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
	 * @param { string } wrapMode
	 */
	setWrapMode(wrapMode) {
		if (this.#text) {
			this.#text.setWrapMode(wrapMode);
		}
	}

	//==============================================================================
	// 줄 간격 배율 설정.
	//==============================================================================
	/**
	 * @param { number } lineSpacing
	 */
	setLineSpacing(lineSpacing) {
		if (this.#text) {
			this.#text.setLineSpacing(lineSpacing);
		}
		this.invalidateIntrinsicContentSize();
	}

	//==============================================================================
	// 표시 글자 수 설정. (-1 이면 전체 — 타자기 연출용, 일반 텍스트 모드 전용)
	//==============================================================================
	/**
	 * @param { number } visibleCharacterCount
	 */
	setVisibleCharacterCount(visibleCharacterCount) {
		if (this.#text) {
			this.#text.setVisibleCharacterCount(visibleCharacterCount);
		}
	}

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
	 * @param { Color | string } color
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
	 * @returns { Color | null }
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
	 * @param { Color | string } color
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
	 * @param { number } width
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
	 * @param { boolean } bold
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
	 * @returns { boolean }
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
	 * @param { boolean } italic
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
	 * @returns { boolean }
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
	 * @param { boolean } underline
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
	 * @returns { boolean }
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
	 * @param { boolean } strikethrough
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
	 * @returns { boolean }
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
	 * @param { "left" | "center" | "right" | "start" | "end" } align
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
	// 세로 정렬 설정.
	//==============================================================================
	/**
	 * @param { "top" | "middle" | "bottom" | "alphabetic" | "hanging" | "ideographic" } baseline
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
	 * @returns { string }
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
	 * @returns { string }
	 */
	getTextBaseline() {
		if (this.#text) {
			return this.#text.getTextBaseline();
		}
		return "middle";
	}
}
