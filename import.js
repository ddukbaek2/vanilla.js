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
export { Vector3 } from "./src/base/vector3.js";
export { Matrix4 } from "./src/base/matrix4.js";
export { TransformMatrix } from "./src/base/transformmatrix.js";
export { Quaternion } from "./src/base/quaternion.js";
export { Pivot } from "./src/base/pivot.js";
export { Rect } from "./src/base/rect.js";
export { OBB } from "./src/base/obb.js";
export { Platform, PlatformType, BrowserType } from "./src/base/platform.js";
export { Identifier, Enum } from "./src/base/identifier.js";
export { Version } from "./src/base/version.js";
export { Node } from "./src/base/node.js";


//==============================================================================
// 코어 목록.
//==============================================================================
export { EngineConfiguration, Engine } from "./src/core/engine.js";
export { ModalDialogKind, ModalDialogResult, ModalDialogHandle } from "./src/core/modaldialog.js";
export { Asset, AssetType } from "./src/core/asset.js";
export { TimeManager } from "./src/core/timemanager.js";
export { ViewScaleMode, ViewManager } from "./src/core/viewmanager.js";
export { InputManager, KeyCode } from "./src/core/inputmanager.js";
export { PointerCursor } from "./src/core/pointercursor.js";
export { TouchRaycaster } from "./src/core/touchraycaster.js";
export { TouchRecognizer } from "./src/ui/touchrecognizer.js";
export { Graphic } from "./src/core/graphic.js";
export { GeometryKey } from "./src/core/graphic.js";
export { Scene } from "./src/core/scene.js";
export { GameScene, ScreenFadeHold } from "./src/game/gamescene.js";
export { ComponentNode } from "./src/core/node/componentnode.js";
export { TransformNode } from "./src/core/node/transformnode.js";
export { WorldNode } from "./src/core/node/worldnode.js";
// export { AnchoredWorldNode } from "./src/core/node/anchoredworldmnode.js";
export { UINode } from "./src/ui/uinode.js";
export { Tween } from "./src/core/tween.js";
export { Component } from "./src/core/component.js";
export { Frame } from "./src/core/frame.js";
export { Animation } from "./src/core/animation.js";


//==============================================================================
// 기본 컴포넌트 목록.
//==============================================================================
export { Paint } from "./src/core/component/paint.js";
export { Outline } from "./src/core/component/outline.js";
export { SoftShade, SoftShadeShape } from "./src/core/component/softshade.js";
export { ShadowText } from "./src/core/component/shadowtext.js";
export { ShadowImage } from "./src/core/component/shadowimage.js";
export { Sprite, SpriteDrawMode, SpriteBlendMode } from "./src/core/component/sprite.js";
export { Text, TextAlign, TextBaseline } from "./src/core/component/text.js";
export { RichText } from "./src/core/component/richtext.js";
export { Mask } from "./src/core/component/mask.js";


//==============================================================================
// UI/컴포넌트 목록.
//==============================================================================
export { UIScene } from "./src/ui/uiscene.js";
export { UIView, isViewPositionInsideNode } from "./src/ui/uiview.js";
export { UIImageView } from "./src/ui/uiimageview.js";
export { UILabel } from "./src/ui/uilabel.js";
export { UIControl } from "./src/ui/uicontrol.js";
export { UIButton, ButtonState } from "./src/ui/uibutton.js";
export { UIToggleButton } from "./src/ui/uitogglebutton.js";
export { UIScrollView, ScrollMode } from "./src/ui/uiscrollview.js";
export { UIProgressView, ProgressDirection } from "./src/ui/uiprogressview.js";
export { UIProgressRing } from "./src/ui/uiprogressring.js";
export { UIHitArea } from "./src/ui/uihitarea.js";
export { ButtonMotion, ButtonMotionStyle, attachButtonMotion, setButtonMotionArea, shakeButton } from "./src/ui/buttonmotion.js";
export { UIScrollBar, ScrollBarAxis } from "./src/ui/uiscrollbar.js";
export { UIInputField } from "./src/ui/uiinputfield.js";
export { LayoutStrength } from "./src/ui/autolayout/layoutstrength.js";
export { LayoutPriority } from "./src/ui/autolayout/layoutpriority.js";
export { LayoutConstraintAxis } from "./src/ui/autolayout/layoutconstraintaxis.js";
export { LayoutVariable } from "./src/ui/autolayout/layoutvariable.js";
export { LayoutTerm } from "./src/ui/autolayout/layoutterm.js";
export { LayoutExpression } from "./src/ui/autolayout/layoutexpression.js";
export { LayoutRelation } from "./src/ui/autolayout/layoutrelation.js";
export { LayoutConstraint } from "./src/ui/autolayout/layoutconstraint.js";
export { LayoutSolver } from "./src/ui/autolayout/layoutsolver.js";
export { UISlider } from "./src/ui/uislider.js";
export { UIDocument } from "./src/ui/uidocument.js";
export { UISnapScrollView } from "./src/ui/uisnapscrollview.js";


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
export { VisualAsset } from "./src/resource/visualasset.js";
export { BunchAsset } from "./src/resource/bunchasset.js";


//==============================================================================
// 기타 기능 목록.
//==============================================================================
export { ImageScroller } from "./src/misc/imagescroller.js";
export { TouchParticle, TouchEffect } from "./src/misc/toucheffect.js";
export { VirtualPad } from "./src/misc/virtualpad.js";
export { NodeLayout } from "./src/misc/nodelayout.js";
export { Visual } from "./src/misc/visual.js";


//==============================================================================
// 컬렉션 목록. (src/base/collection, 러스트 판에서는 표준 Vec, HashMap 같은 것이 맡는다)
//==============================================================================
export { Set } from "./src/base/collection/set.js";


//==============================================================================
// 애니메이션 목록. (src/animation)
//==============================================================================
export { Animator, AnimationState, AnimationTransition, AnimationConditionMode } from "./src/animation/animator.js";
export { Action } from "./src/animation/action.js";


//==============================================================================
// 셰이더와 풀스크린 패스 목록. (src/core)
//==============================================================================
export { ShaderProgram } from "./src/core/graphic/shaderprogram.js";
export { ShaderWarmer } from "./src/core/graphic/shaderwarmer.js";
export { FullscreenPass } from "./src/core/fullscreenpass.js";


//==============================================================================
// 3D 그래픽스 목록. (src/graphics3d, 툰 3D 는 src/graphics3d/toon)
//==============================================================================
export { RenderTarget } from "./src/graphics3d/rendertarget.js";
export { BloomEffect } from "./src/graphics3d/bloomeffect.js";
export { SkinnedModel, MORPH_TARGET_MAXIMUM } from "./src/graphics3d/skinnedmodel.js";
export { SkinnedModelAsset } from "./src/graphics3d/skinnedmodelasset.js";
export { SkinnedModelRenderer, MORPH_GLSL } from "./src/graphics3d/skinnedmodelrenderer.js";
export { MeshBuilder, VERTEX_FLOAT_COUNT, SKIN_FLOAT_COUNT, readColorValues, createPartMatrix, createBoxGeometry, createRoundedBoxGeometry, createCylinderGeometry, createSphereGeometry, createLatheGeometry, createCapsuleGeometry, createTorusGeometry, createOctahedronGeometry, createFacetedChunkGeometry } from "./src/graphics3d/toon/meshbuilder.js";
export { readGlbArrays, readGlbImages, decodeGlbImage, readGlbNodeArrays, readGlbNodeInfos, readAnimationSwing, writeSkinPose } from "./src/graphics3d/toon/glbmeshreader.js";
export { ToonRenderer, extractFrustumPlanes, TOON_MAXIMUM_JOINTS, TOON_ATTRIBUTE_LOCATIONS, TOON_INSTANCE_FLOAT_COUNT } from "./src/graphics3d/toon/toonrenderer.js";
export { ToonPostProcess } from "./src/graphics3d/toon/toonpostprocess.js";
export { HumanSkinRenderer, SKIN_SHADING_SKIN, SKIN_SHADING_EYE, SKIN_SHADING_HAIR, SKIN_SHADING_OCCLUSION, SKIN_SHADING_FLUID, SKIN_SHADING_FACIALHAIR, SKIN_TEXTURE_UNIT_DETAILHEIGHT, SKIN_TEXTURE_UNIT_MICRO, SKIN_TEXTURE_UNIT_MASKATLAS, SKIN_TEXTURE_UNIT_LAYERNORMAL, SKIN_TEXTURE_UNIT_LAYERCOLOR, SKIN_TEXTURE_UNIT_AUXILIARY, WRINKLE_CHANNEL_COUNT } from "./src/graphics3d/humanskinrenderer.js";
export { AmbientOcclusionEffect } from "./src/graphics3d/ambientocclusioneffect.js";
export { SubsurfaceScatteringEffect } from "./src/graphics3d/subsurfacescatteringeffect.js";
export { Material } from "./src/graphics3d/material.js";
export { ShadowMap, ShadowAtlas, ShadowUpdateMode, SHADOW_ATLAS_MAXIMUM_LIGHTS } from "./src/graphics3d/shadowmap.js";


//==============================================================================
// 폐기 예정 목록. (다음 판에서 빠진다)
//==============================================================================


//==============================================================================
// 실험 기능 목록. (src/experimental, 0.4.0 뒤 기능의 초안이라 API 가 바뀔 수 있다)
// - 진입점과 묶음(build/vanilla.js, vanilla.min.js, 웹 도구 html)에는 넣지 않는다. 초안을 쓰는 쪽이 src/experimental/experimental.js 를 직접 불러온다.
//   (import * as Experimental from "./src/experimental/experimental.js", 초안이 src 의 엔진 모듈을 불러오므로 엔진도 묶음이 아닌 이 import.js 로 불러야 클래스가 하나다)
//==============================================================================


// 이번 확장에서 추가 / 공개된 모듈. (게임 프로젝트들에서 반복 구현되던 범용 기능)
export { SeededRandom } from "./src/base/seededrandom.js";
export { Cooldown, RepeatTimer } from "./src/base/timer.js";
export { ObjectPool } from "./src/base/objectpool.js";
export { FiniteStateMachine } from "./src/base/fsm.js";
export * as Format from "./src/base/format.js";
export { LocalStorage } from "./src/misc/localstorage.js";
export { PersistedStore } from "./src/misc/persistedstore.js";
export { Localization } from "./src/misc/localization.js";
export { PathFinder } from "./src/misc/pathfinder.js";
export { Grid } from "./src/misc/grid.js";
export { Collision2D } from "./src/misc/collision2d.js";
export { Steering2D } from "./src/misc/steering2d.js";
export { PointerGesture } from "./src/misc/pointergesture.js";
export { FrameProbe } from "./src/misc/frameprobe.js";
export { CameraGestures } from "./src/misc/cameragestures.js";
export * as LanguagePack from "./src/misc/languagepack.js";
export * as UIFont from "./src/misc/uifont.js";
export { FocusNavigator } from "./src/misc/focusnavigator.js";
export { Shaker } from "./src/misc/shaker.js";
export { Camera2D } from "./src/misc/camera2d.js";
export { Typewriter } from "./src/misc/typewriter.js";
export { DialogueRunner, DialogueScriptParser } from "./src/misc/dialogue.js";
export { SpriteAnimator } from "./src/misc/spriteanimator.js";
export { PlatformerBody } from "./src/misc/platformerbody.js";
export { FloatingText } from "./src/misc/floatingtext.js";
export { BeepPlayer } from "./src/misc/beepplayer.js";
export { SoundEffectPool } from "./src/core/soundeffectpool.js";
export { SoundSystem, setSoundSystem, readSoundSystem } from "./src/core/soundsystem.js";
export { GamepadManager, GamepadButtonCode, GamepadAnalogStickCode, GamepadTriggerCode } from "./src/core/gamepadmanager.js";
export { AudioPlayer } from "./src/core/audioplayer.js";
export { AudioBus } from "./src/core/audiobus.js";
export { PopupMotion, PopupMotionState } from "./src/ui/popupmotion.js";
export { ParticleSystem, ParticleEmitterShape, ParticleRenderShape } from "./src/effect/particlesystem.js";
export { TrailRenderer } from "./src/effect/trailrenderer.js";
export { ShaderSprite, ShaderSpriteEffect } from "./src/effect/shadersprite.js";
export { ScreenEffect, ScreenEffectType, SCREEN_EFFECT_PARAMETER_NAMES } from "./src/effect/screeneffect.js";
export { Timeline, TIMELINE_EASING_NAMES, TIMELINE_PROPERTY_DEFINITIONS, TIMELINE_NODE_DEFAULTS, resolveTimelineEasing, createBezierEasing, parseTimelineColor, composeTimelineColor } from "./src/animation/timeline.js";
export { UIListView } from "./src/ui/uilistview.js";
export { UILineChart, UIBarChart } from "./src/ui/uichart.js";
export { UIDropdown } from "./src/ui/uidropdown.js";
export { UIContextMenu } from "./src/ui/uicontextmenu.js";
export { UIDraggable } from "./src/ui/uidraggable.js";
export { UISpinner } from "./src/ui/uispinner.js";
export { UIToast } from "./src/ui/uitoast.js";
export { ToastMotion, attachToastMotion, readToastSeconds } from "./src/ui/toastmotion.js";
export { UIDialog } from "./src/ui/uidialog.js";
export { MouseButton, TouchPhase, TouchPoint, InputDevice } from "./src/core/inputmanager.js";
export { InputActions } from "./src/core/inputactions.js";
export { GamepadKind, readGamepadKind } from "./src/core/gamepadmanager.js";
export { Camera3D } from "./src/graphics3d/camera3d.js";
export { ToonDrawQueue } from "./src/graphics3d/toon/toondrawqueue.js";
export { ToonView3D } from "./src/graphics3d/toon/toonview3d.js";
export { GraphicsQualityGovernor, GraphicsQuality } from "./src/misc/graphicsqualitygovernor.js";
export { FixedStepper } from "./src/misc/fixedstepper.js";
export { AssetLoader } from "./src/resource/assetloader.js";
export { LoadingProgress } from "./src/misc/loadingprogress.js";
export { BuildInfo } from "./src/misc/buildinfo.js";
export { ToonScreenOutline, ToonOutlineWidthUnit, TOON_SCREEN_OUTLINE_MAXIMUM_LINE_ID, readJumpFloodSteps } from "./src/graphics3d/toon/toonscreenoutline.js";
export { ToonVfx, ToonVfxSlot, ToonVfxLook, ToonVfxShape, ToonVfxDecalMode, TOON_VFX_MAXIMUM_RAMPS, TOON_VFX_DEFAULT_PARTICLE_CAPACITY } from "./src/graphics3d/toon/toonvfx.js";
export { UIScale } from "./src/ui/uiscale.js";
export { UIWindow } from "./src/ui/uiwindow.js";
export { UIWindowLayer } from "./src/ui/uiwindowlayer.js";
export { UIConfirmWindow } from "./src/ui/uiconfirmwindow.js";

// 글자, 노드, 그리기 갈래. (출시 게임들이 따로 만들어 쓰던 아틀라스 읽기)
export { SpriteAtlas } from "./src/resource/spriteatlas.js";

// 코어, 플랫폼, 기반 갈래. (러스트 판과 맞춘 페이지 이벤트)
export { PageEvent } from "./src/core/engine.js";
// 효과 갈래. (아지랑이 컴포넌트)
export { HeatHazeEffect } from "./src/effect/heathazeeffect.js";
export { TweenProperty, applyTweenProperty } from "./src/core/tween.js";
export { Indicator } from "./src/misc/indicator.js";
export { ToastPhase } from "./src/ui/toastmotion.js";
// 글자, 글꼴 갈래. (글자 아틀라스, 글자 묶음과 낱말 나누기, 글의 첫 강한 방향)
export { DynamicFont, GlyphInfo } from "./src/misc/dynamicfont.js";
export { splitGraphemes, splitWords, countGraphemes, sliceGraphemes } from "./src/core/component/text.js";
export { detectTextDirection } from "./src/core/graphic.js";
// 입력 필드 문맥 메뉴 항목.
export { UIInputFieldMenuAction } from "./src/ui/uiinputfield.js";
export { MultiLevelBloomEffect } from "./src/graphics3d/multilevelbloomeffect.js";
// 글자, 그리기 갈래. (러스트 판에만 있던 Graphic 없이 글 재기)
export { measureTextWithoutGraphic } from "./src/core/graphic/textstringtexturecache.js";
// 툰 3D 확장 자리와 빛. (빛 묶음, 머티리얼 셰이더 조각, 인스턴스 꼴과 영구 버퍼, 섞는 방식, 그리기 단계, 평면 거울 행렬)
export { ToonLightSet, TOON_MAXIMUM_POINT_LIGHTS, TOON_MAXIMUM_BAND_STEPS } from "./src/graphics3d/toon/toonlightset.js";
export { ToonMaterial, ToonInstanceLayout, ToonBlendMode, ToonMatcapBlend, ToonBufferUsage, TOON_MAXIMUM_INSTANCE_ATTRIBUTES, TOON_FIRST_INSTANCE_ATTRIBUTE_LOCATION, TOON_INSTANCE_MATRIX_NAME, TOON_INSTANCE_TINT_NAME } from "./src/graphics3d/toon/toonmaterial.js";
export { ToonProgramKind, TOON_MAXIMUM_MATERIAL_TEXTURES, composeToonProgramSources, createReflectionMatrix, readFrameCamera, readMatrixDeterminant, readViewRotation, readCameraRoll, readOutlineVertexData, readUvData } from "./src/graphics3d/toon/toonrenderer.js";
export { ToonDrawStage } from "./src/graphics3d/toon/toondrawqueue.js";
export { AudioManager } from "./src/core/audiomanager.js";
export { DevTools } from "./src/misc/devtools.js";
export { Pane, PaneStyle, PaneTheme } from "./src/web/pane.js";
export { WebSocketClient } from "./src/web/websocketclient.js";
