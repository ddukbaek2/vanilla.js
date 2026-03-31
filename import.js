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
export { Vector2 } from "./src/base/vector2.js";
export { Rect } from "./src/base/rect.js";
export { OBB } from "./src/base/obb.js";
export { Platform, PlatformType, BrowserType } from "./src/base/platform.js";
export { Pivot } from "./src/base/pivot.js";
export { Colors } from "./src/base/colors.js";
export { Singleton } from "./src/base/singleton.js";
export { Identifier, Enum } from "./src/base/identifier.js";
export { Version } from "./src/base/version.js";


//==============================================================================
// 자료구조 목록.
//==============================================================================
export { List } from "./src/collection/list.js";
export { Dictionary } from "./src/collection/dictionary.js";
export { Queue } from "./src/collection/queue.js";
export { Stack } from "./src/collection/stack.js";
export { Set } from "./src/collection/set.js";


//==============================================================================
// 코어 목록.
//==============================================================================
export { EngineConfiguration, Engine } from "./src/core/engine.js";
export { Asset } from "./src/core/asset.js";
export { SceneManager } from "./src/core/scenemanager.js";
export { TimeManager } from "./src/core/timemanager.js";
export { ViewScaleMode, ViewManager } from "./src/core/viewmanager.js";
export { InputManager } from "./src/core/inputmanager.js";
export { Graphic } from "./src/core/graphic.js";
export { Scene } from "./src/core/scene.js";
export { Node } from "./src/core/node.js";
export { UINode } from "./src/core/uinode.js";
export { Tween } from "./src/core/tween.js";
export { Component } from "./src/core/component.js";
export { Frame } from "./src/core/frame.js";
export { Animation } from "./src/core/animation.js";


//==============================================================================
// 컴포넌트 목록.
//==============================================================================
export { ColorComponent } from "./src/component/colorcomponent.js";
export { SpriteComponent } from "./src/component/spritecomponent.js";
export { LabelComponent } from "./src/component/labelcomponent.js";
export { ButtonComponent } from "./src/component/buttoncomponent.js";


//==============================================================================
// 리소스 목록.
//==============================================================================
export { FontAsset } from "./src/resource/fontasset.js";
export { ImageAsset } from "./src/resource/imageasset.js";
export { AudioAsset } from "./src/resource/audioasset.js";
export { TextAsset } from "./src/resource/textasset.js";
export { JsonAsset } from "./src/resource/jsonasset.js";
export { AnimationClip } from "./src/resource/animationclip.js";


//==============================================================================
// 그 외 목록.
//==============================================================================
export { ImageScroller } from "./src/misc/imagescroller.js";
export { TouchParticle, TouchEffect } from "./src/misc/toucheffect.js";