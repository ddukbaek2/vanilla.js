//==============================================================================
// 2D 뼈대 애니메이션 초안 내보내기 목록. (experimental.js 가 이 파일 하나를 다시 내보낸다)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 뼈대 자료(Skeleton2DData, 엔진 JSON 과 DragonBones 5.x 읽기), 인스턴스(Skeleton2D, 뼈, 슬롯, IK), 클립과 곡선,
//   애니메이션 상태(트랙, 크로스페이드, 층), 노드에 붙는 컴포넌트(Skeleton2DAnimator).
//==============================================================================

/**
 * @example <caption>엔진 JSON 으로 자료를 짓고 걷기를 반 초 돌린 뒤 뼈의 월드 자리 읽기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const skeletonData = Experimental.Skeleton2DData.createFromJson({
 * 	bones: [{ name: "root" }, { name: "leg", parent: "root", rotation: 90, length: 30 }],
 * 	animations: { walk: { bones: { leg: { rotate: [{ time: 0, value: -20 }, { time: 1, value: 20 }] } } } },
 * });
 * const skeleton = new Experimental.Skeleton2D(skeletonData);
 * const animationState = new Experimental.Skeleton2DAnimationState(skeletonData);
 * animationState.setAnimation(0, "walk", true, 0);
 * animationState.update(0.5);
 * animationState.apply(skeleton);
 * skeleton.updateWorldTransform();
 * const tip = skeleton.findBone("leg").localToWorld(30, 0);
 * console.log(tip.x.toFixed(3), tip.y.toFixed(3));
 */

export { SKELETON2D_BONE_VALUE_COUNT, Skeleton2DCurveType, Skeleton2DTimelineType, evaluateSkeleton2DCurve, Skeleton2DEvent, Skeleton2DPose, Skeleton2DTimeline, Skeleton2DAnimation } from "./skeleton2danimation.js";
export { Skeleton2DAttachmentType, Skeleton2DBoneData, Skeleton2DSlotData, Skeleton2DIkConstraintData, Skeleton2DRegionAttachment, Skeleton2DMeshAttachment, Skeleton2DSkin, Skeleton2DData } from "./skeleton2ddata.js";
export { Skeleton2DBone, Skeleton2DSlot, Skeleton2DIkConstraint, Skeleton2D } from "./skeleton2d.js";
export { Skeleton2DTrackEntry, Skeleton2DFiredEvent, Skeleton2DAnimationState } from "./skeleton2danimationstate.js";
export { Skeleton2DAnimator } from "./skeleton2danimator.js";
