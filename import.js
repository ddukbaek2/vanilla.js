//==============================================================================
// 기반 목록.
//==============================================================================
export * as VWait from "./src/base/wait.js";
export * as VMath from "./src/base/math.js";
export * as VReflection from "./src/base/reflection.js";
export { VObject } from "./src/base/object.js";
export { VColor } from "./src/base/color.js";
export { VVector2 } from "./src/base/vector2.js";
export { VRect } from "./src/base/rect.js";
export { VOBB } from "./src/base/obb.js";
export { VPlatform, VPlatformType, VBrowserType } from "./src/base/platform.js";
export { VPivot } from "./src/base/pivot.js";
export { VColors } from "./src/base/colors.js";


//==============================================================================
// 코어 목록.
//==============================================================================
export { VEngine } from "./src/core/engine.js";
export { VAsset } from "./src/core/asset.js";
export { VTime } from "./src/core/time.js";
export { VView } from "./src/core/view.js";
export { VInput } from "./src/core/input.js";
export { VRenderer } from "./src/core/renderer.js";
export { VScene } from "./src/core/scene.js";
export { VNode } from "./src/core/node.js";
export { VTween } from "./src/core/tween.js";
export { VComponent } from "./src/core/component.js";


//==============================================================================
// 컴포넌트 목록.
//==============================================================================
export { VBoundsComponent } from "./src/component/bounds.js";
export { VColorDrawerComponent } from "./src/component/colordrawer.js";
export { VSpriteDrawerComponent } from "./src/component/spritedrawer.js";
export { VTextDrawerComponent } from "./src/component/textdrawer.js";
export { VButtonComponent } from "./src/component/button.js";


//==============================================================================
// 렌더링 목록.
//==============================================================================
export { VSprite } from "./src/rendering/sprite.js";
export { VAnimatedSprite } from "./src/rendering/animatedsprite.js";


//==============================================================================
// 리소스 목록.
//==============================================================================
export { VFontAsset } from "./src/resource/fontasset.js";
export { VImageAsset } from "./src/resource/imageasset.js";
export { VAudioAsset } from "./src/resource/audioasset.js";
export { VTextAsset } from "./src/resource/textasset.js";
export { VJsonAsset } from "./src/resource/jsonasset.js";


//==============================================================================
// UI 목록.
//==============================================================================
export { UINode } from "./src/ui/uinode.js";
export { UIButton } from "./src/ui/uibutton.js";
export { UILabel } from "./src/ui/uilabel.js";
export { UIImage } from "./src/ui/uiimage.js";


//==============================================================================
// 그 외 목록.
//==============================================================================
export { VIdentifier, VEnum } from "./src/misc/identifier.js";
export { VTouchParticle, VTouchEffect } from "./src/misc/toucheffect.js";


//==============================================================================
// 네임스페이스 재구성 목록.
//==============================================================================
export const VanilaJS = {
	Object: VObject,
	Color: VColor,
	Vector2: VVector2,
	Rect: VRect,
	OBB: VOBB,
	Platform: VPlatform,
	Pivot: VPivot,
	Colors: VColors,
	Wait: VWait,
	Math: VMath,
	Reflection: VReflection,
	Engine: VEngine,
	Asset: VAsset,
	Time: VTime,
	View: VView,
	Input: VInput,
	Renderer: VRenderer,
	Scene: VScene,
	Node: VNode,
	Tween: VTween,
	Component: VComponent,
	Bounds: VBoundsComponent,
	ColorDrawer: VColorDrawerComponent,
	SpriteDrawer: VSpriteDrawerComponent,
	TextDrawer: VTextDrawerComponent,
	Button: VButtonComponent,
	// Sprite: VSprite,
	// AnimatedSprite: VAnimatedSprite,
	FontAsset: VFontAsset,
	ImageAsset: VImageAsset,
	AudioAsset: VAudioAsset,
	TextAsset: VTextAsset,
	JsonAsset: VJsonAsset,
	// UINode: UINode,
	// UIButton: UIButton,
	// UILabel: UILabel,
	// UIImage: UIImage,
	Identifier: VIdentifier,
	Enum: VEnum,
	TouchEffect: VTouchEffect
};