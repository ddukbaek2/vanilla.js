//==============================================================================
// 자바스크립트 내장 클래스 목록.
//==============================================================================
export const System = globalThis;
// System.Math
// System.Object
// HTMLCanvasElement
// CanvasRenderingContext2D
// HTMLImageElement


//==============================================================================
// 기반 목록.
//==============================================================================
export * as Wait from "./src/base/wait.js";
export * as Math from "./src/base/math.js";
export * as Reflection from "./src/base/reflection.js";
export { Object } from "./src/base/object.js";
export { Color } from "./src/base/color.js";
export { Colors } from "./src/base/colors.js";
export { Vector2 } from "./src/base/vector2.js";
export { Pivot } from "./src/base/pivot.js";
export { Rect } from "./src/base/rect.js";
export { OBB } from "./src/base/obb.js";
export { Platform, PlatformType, BrowserType } from "./src/base/platform.js";
export { Singleton } from "./src/base/singleton.js";
export { Identifier, Enum } from "./src/base/identifier.js";
export { Version } from "./src/base/version.js";
export { Node } from "./src/base/node.js";


//==============================================================================
// 인터페이스 목록.
//==============================================================================
export { ITickable } from "./src/core/interface/itickable.js";
export { IDrawable } from "./src/core/interface/idrawable.js";
export { ITouchable } from "./src/core/interface/itouchable.js";


//==============================================================================
// 코어 목록.
//==============================================================================
export { EngineConfiguration, Engine } from "./src/core/engine.js";
export { Asset } from "./src/core/asset.js";
export { SceneManager } from "./src/core/scenemanager.js";
export { TimeManager } from "./src/core/timemanager.js";
export { ViewScaleMode, ViewManager } from "./src/core/viewmanager.js";
export { InputManager } from "./src/core/inputmanager.js";
export { TouchRaycaster } from "./src/core/touchraycaster.js";
export { Graphic } from "./src/core/graphic.js";
export { Scene } from "./src/core/scene.js";
export { ComponentNode } from "./src/core/node/componentnode.js";
export { TransformNode } from "./src/core/node/transformnode.js";
export { WorldNode } from "./src/core/node/worldnode.js";
export { AnchoredWorldNode } from "./src/core/node/anchoredworldmnode.js";
export { UINode } from "./src/core/node/uinode.js";
export { Tween } from "./src/core/tween.js";
export { Component } from "./src/core/component.js";
export { Frame } from "./src/core/frame.js";
export { Animation } from "./src/core/animation.js";


//==============================================================================
// 컴포넌트 목록.
//==============================================================================
export { Paint } from "./src/component/paint.js";
export { Sprite } from "./src/component/sprite.js";
export { Label } from "./src/component/label.js";


//==============================================================================
// UI/컴포넌트 목록.
//==============================================================================
export { UIComponent } from "./src/component/uicomponent.js";
export { UIButton } from "./src/component/uibutton.js";
export { UIToggleButton } from "./src/component/uitogglebutton.js";
export { UIView } from "./src/component/uiview.js";
export { UIScrollView } from "./src/component/uiscrollview.js";
export { UISnapScrollView } from "./src/component/uisnapscrollview.js";


//==============================================================================
// 리소스 목록.
//==============================================================================
export { AnimationClip } from "./src/resource/animationclip.js";
export { AudioAsset } from "./src/resource/audioasset.js";
export { BlobAsset } from "./src/resource/blobasset.js";
export { FontAsset } from "./src/resource/fontasset.js";
export { ImageAsset } from "./src/resource/imageasset.js";
export { JsonAsset } from "./src/resource/jsonasset.js";
export { TextAsset } from "./src/resource/textasset.js";


//==============================================================================
// 기타 기능 목록.
//==============================================================================
export { ImageScroller } from "./src/misc/imagescroller.js";
export { TouchParticle, TouchEffect } from "./src/misc/toucheffect.js";
export { VirtualPad } from "./src/misc/virtualpad.js";
export { UIBuilder } from "./src/misc/uibuilder.js";


//==============================================================================
// 실험적 기능 목록.
//==============================================================================
export { List } from "./src/experimental/collection/list.js";
export { Dictionary } from "./src/experimental/collection/dictionary.js";
export { Queue } from "./src/experimental/collection/queue.js";
export { Stack } from "./src/experimental/collection/stack.js";
export { Set } from "./src/experimental/collection/set.js";
export { Animator, AnimationState, AnimationTransition } from "./src/experimental/animation/animator.js";
export { Visual } from "./src/experimental/visual/visual.js";
export { VisualAsset } from "./src/experimental/visual/visualasset.js";
export { Camera } from "./src/experimental/camera.js";
export { Action } from "./src/experimental/action.js";
export { BunchAsset } from "./src/experimental/bunchasset.js";