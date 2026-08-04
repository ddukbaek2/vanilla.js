//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../../base/vector2.js";
import { Graphic } from "../graphic.js";
import * as Math from "../../base/math.js";
import { Pivot } from "../../base/pivot.js";
import { Rect } from "../../base/rect.js";
import { OBB } from "../../base/obb.js";
import { TransformNode } from "./transformnode.js";
import { Engine } from "../engine.js";
import { Mask } from "../component/mask.js";


//==============================================================================
// 계층적 영역 객체.
// - Anchor, Pivot, ConetentSize 기능.
//==============================================================================
export class WorldNode extends TransformNode {
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @private @type { Vector2 } */ #pivot; // 기준점.
    /** @private @type { Vector2 } */ #contentSize; // 크기.
    /** @private @type { Vector2 } */ #anchor; // 앵커 (부모 영역 내 기준점).
    /** @private @type { boolean } */ #isInteractable; // 터치 인터랙션 활성화 여부.

    //==============================================================================
    // 생성.
    //==============================================================================
    /**
     * @constructor
     */
    constructor() {
        super();
		this.nodeType = "WorldNode";
        this.#pivot = Pivot.middleCenter.clone();
        this.#contentSize = Vector2.zero();
        this.#anchor = Pivot.middleCenter.clone();
        this.#isInteractable = false;
    }

    //==============================================================================
    // 출력 상태 시작.
    //==============================================================================
    /**
     * @override
     * @param { Graphic } graphic
     */
    pushTransform(graphic) {

        // 피봇과 컨텐트사이즈에 의한 로컬 포지션 변동으로 사용 안함.
        // super.pushTransform(graphic);

        if (graphic) {
            graphic.pushState();

            // 트랜스폼 반영.
            // localPosition 은 부모 영역 내 자기 객체의 중심점 좌표 (anchor / pivot 영향 없음).
            // anchor 는 anchoredPosition 계산용 메타데이터일 뿐 렌더에 직접 영향 주지 않는다.
            const localPosition = this.getLocalPosition();
            const localRotation = this.getLocalRotation();
            const radian = Math.degreeToRadian(localRotation);
            const localScale = this.getLocalScale();
            graphic.translate(localPosition.x, localPosition.y);
            graphic.rotate(radian);
            graphic.scale(localScale.x, localScale.y);

            // 현재 노드의 피봇 반영.
            // 캔버스2D는 기준점을 좌상으로 여기고 우하방향으로 그림을 그리므로.
            // 마지막 원점에서 현재 컨텐트사이즈 크기를 기준으로한 피봇만큼 상대적으로 당김.
            const pivot = this.getPivot();
            const contentSize = this.getContentSize();
            const pivotPosition = Vector2.create(contentSize.x * pivot.x, contentSize.y * pivot.y);
            graphic.translate(-pivotPosition.x, -pivotPosition.y);

            // 투명도 반영.
            const localOpacity = this.getLocalOpacity();
            graphic.multiplyGlobalAlpha(localOpacity);
        }
    }

    //==============================================================================
    // 출력. (오버라이드: Mask 컴포넌트가 부착돼 있으면 자식을 그 영역으로 크롭)
    //==============================================================================
    /**
     * @override
     * @param { Graphic } graphic
     */
    draw(graphic) {
        const isVisible = this.isVisible();
        if (!isVisible) {
            return;
        }

        // 컴포넌트 출력. 동시에 Mask 컴포넌트가 있는지 확인.
        const components = this.getAllComponents();
        let maskComponent = null;
        for (const component of components) {
            component.draw(graphic);
            if (component instanceof Mask) {
                maskComponent = component;
            }
        }

        // 마스크가 있으면 자식 출력 전에 클리핑 시작.
        if (maskComponent) {
            maskComponent.beginClip(graphic);
        }

        // 자식 출력.
        const children = this.getChildren();
        for (const child of children) {
            graphic.drawNode(child);
        }

        // 마스크가 있으면 클리핑 종료.
        if (maskComponent) {
            maskComponent.endClip(graphic);
        }
    }

    //==============================================================================
    // 출력.
    //==============================================================================
    /**
     * @override
     * @param { Graphic } graphic
     */
    drawGizmos(graphic) {
        // const isGizmoVisible = this.isGizmoVisible();
        // if (!isGizmoVisible) {
        //     return;
        // }

        super.drawGizmos(graphic);

        // 영역 및 기준점 출력.
        if (graphic) {
            // 기존 투명도 무효화 및 색상 설정.
            const originalAlpha = graphic.getGlobalAlpha();
            graphic.setGlobalAlpha(1.0);

            // 좌표.
            const contentSize = this.getContentSize();
            const pivot = this.getPivot();
            const origin = Vector2.create(contentSize.x * pivot.x, contentSize.y * pivot.y);
            const left = 0;
            const top = 0;
            const right = left + contentSize.x;
            const bottom = top + contentSize.y;

            // 기존 투명도 무효화 및 색상 설정.
            graphic.setFillColor("#00ff00");
            graphic.setStrokeColor("#00ff00");

            // 범위.
            graphic.drawLine([
                Vector2.create(left, top),
                Vector2.create(right, top),
                Vector2.create(right, bottom),
                Vector2.create(left, bottom),
                Vector2.create(left, top),
            ], 1);

            // 기준점.
            const pointSize = 4;
            graphic.drawCircle(origin, pointSize);

            // 기존 투명도 복원.
            graphic.setGlobalAlpha(originalAlpha);
        }
    }

    //==============================================================================
    // 기준점 설정.
    //==============================================================================
    /**
     * @param { Vector2 } pivot
     */
    setPivot(pivot) {
        this.#pivot = pivot.clone();
        this.#pivot.x = Math.clamp(pivot.x, 0, 1);
        this.#pivot.y = Math.clamp(pivot.y, 0, 1);
    }

    //==============================================================================
    // 기준점 반환.
    //==============================================================================
    /**
     * @returns { Vector2 }
     */
    getPivot() {
        return this.#pivot.clone();
    }

    //==============================================================================
    // 실제 내용 크기 설정.
    //==============================================================================
    /**
     * @param { Vector2 } contentSize
     */
    setContentSize(contentSize) {
        this.#contentSize = contentSize.clone();
    }

    //==============================================================================
    // 실제 내용 크기 반환.
    // - 부모가 없고(루트 노드) 명시적으로 설정된 적 없으면 현재 뷰 크기를 반환한다.
    //==============================================================================
    /**
     * @returns { Vector2 }
     */
    getContentSize() {
        return this.#contentSize.clone();
    }

    //==============================================================================
    // 앵커 설정.
    //==============================================================================
    /**
     * @param { Vector2 } anchor
     */
    setAnchor(anchor) {
        this.#anchor = anchor.clone();
        this.#anchor.x = Math.clamp(anchor.x, 0, 1);
        this.#anchor.y = Math.clamp(anchor.y, 0, 1);
    }

    //==============================================================================
    // 앵커 반환.
    //==============================================================================
    /**
     * @returns { Vector2 }
     */
    getAnchor() {
        return this.#anchor;
    }

    //==============================================================================
    // 앵커 기준 위치 설정.
    // - anchoredPosition: 부모 영역 내 anchor 기준점(= parentContentSize * anchor)에서의 상대 위치.
    // - 내부적으로 localPosition = anchorRef + anchoredPosition 으로 변환해 저장한다.
    //   (localPosition 은 anchor 와 무관하게 부모 영역 내 자기 중심점 좌표를 나타냄)
    //==============================================================================
    /**
     * @param { Vector2 } anchoredPosition
     */
    setAnchoredPosition(anchoredPosition) {
        if (anchoredPosition === null || anchoredPosition === undefined) {
            return;
        }
        const parent = this.getParent();
        if (!(parent instanceof WorldNode)) {
            // 부모가 없거나 WorldNode 가 아니면 anchor 기준점을 정의할 수 없으므로 그대로 위임.
            const newLocalPosition = Vector2.create(anchoredPosition.x, anchoredPosition.y);
            this.setLocalPosition(newLocalPosition);
            return;
        }
        const parentContentSize = parent.getContentSize();
        const anchor = this.getAnchor();
        const anchorRefX = parentContentSize.x * anchor.x;
        const anchorRefY = parentContentSize.y * anchor.y;
        const newLocalPosition = Vector2.create(anchorRefX + anchoredPosition.x, anchorRefY + anchoredPosition.y);
        this.setLocalPosition(newLocalPosition);
    }

    //==============================================================================
    // 앵커 기준 위치 반환.
    // - localPosition - anchorRef 로 역산해서 반환한다.
    //==============================================================================
    /**
     * @returns { Vector2 }
     */
    getAnchoredPosition() {
        const localPosition = this.getLocalPosition();
        const parent = this.getParent();
        if (!(parent instanceof WorldNode)) {
            return Vector2.create(localPosition.x, localPosition.y);
        }
        const parentContentSize = parent.getContentSize();
        const anchor = this.getAnchor();
        const anchorRefX = parentContentSize.x * anchor.x;
        const anchorRefY = parentContentSize.y * anchor.y;
        return Vector2.create(localPosition.x - anchorRefX, localPosition.y - anchorRefY);
    }

    //==============================================================================
    // 글로벌 위치 반환.
    // - localPosition 은 부모 content top-left 기준 자기 객체 중심 좌표.
    // - 부모의 pivot 점은 (parentContentSize * parentPivot) 위치이므로
    //   parent.getPosition() (= 부모 pivot 점의 월드 좌표) 기준 오프셋으로 변환 후
    //   부모 회전/스케일을 적용한다. (anchor 는 위치 계산에 직접 영향 없음)
    //==============================================================================
    /**
     * @override
     * @returns { Vector2 }
     */
    getPosition() {
        const parent = this.getParent();
        if (!(parent instanceof WorldNode)) {
            return super.getPosition();
        }

        const localPosition = this.getLocalPosition();
        const parentPosition = parent.getPosition();
        const parentContentSize = parent.getContentSize();
        const parentPivot = parent.getPivot();
        const parentRotation = parent.getRotation();
        const parentScale = parent.getScale();

        // 부모 pivot 점 기준 오프셋으로 변환.
        const totalLocalX = localPosition.x - parentContentSize.x * parentPivot.x;
        const totalLocalY = localPosition.y - parentContentSize.y * parentPivot.y;

        const radian = Math.degreeToRadian(parentRotation);
        const cosRadian = Math.cos(radian);
        const sinRadian = Math.sin(radian);
        const sx = totalLocalX * parentScale.x;
        const sy = totalLocalY * parentScale.y;
        const rx = sx * cosRadian - sy * sinRadian;
        const ry = sx * sinRadian + sy * cosRadian;
        return Vector2.create(parentPosition.x + rx, parentPosition.y + ry);
    }

    //==============================================================================
    // 실제 화면에 그려지는 영역 반환. (OBB)
    //==============================================================================
    /**
     * @returns { Vector2[] }
     */
    getWorldCorners() {
        const position = this.getPosition();
        const scale = this.getScale();
        const rotation = this.getRotation();
        const contentSize = this.getContentSize();
        const pivot = this.getPivot();

        const width = contentSize.x * Math.abs(scale.x);
        const height = contentSize.y * Math.abs(scale.y);

        const left = -(width * pivot.x);
        const right = width * (1 - pivot.x);
        const top = -(height * pivot.y);
        const bottom = height * (1 - pivot.y);

        const radian = Math.degreeToRadian(rotation);
        const cosR = Math.cos(radian);
        const sinR = Math.sin(radian);

        return [
            Vector2.create(left * cosR - top * sinR + position.x, left * sinR + top * cosR + position.y),
            Vector2.create(right * cosR - top * sinR + position.x, right * sinR + top * cosR + position.y),
            Vector2.create(right * cosR - bottom * sinR + position.x, right * sinR + bottom * cosR + position.y),
            Vector2.create(left * cosR - bottom * sinR + position.x, left * sinR + bottom * cosR + position.y)
        ];
    }

    //==============================================================================
    // getWorldCorners()를 기반으로 최소, 최대위치를 만들어 바운딩박스를 형성.
    //==============================================================================
    /**
     * @returns { Rect }
     */
    getWorldBounds() {
        const worldCorners = this.getWorldCorners();

        let min = Vector2.positiveInfinity();
        let max = Vector2.negativeInfinity();
        for (let i = 1; i < worldCorners.length; ++i) {
            const worldCorner = worldCorners[i];
            if (min.x > worldCorner.x) {
                min.x = worldCorner.x;
            }
            if (min.y > worldCorner.y) {
                min.y = worldCorner.y;
            }
            if (max.x < worldCorner.x) {
                max.x = worldCorner.x;
            }
            if (max.y < worldCorner.y) {
                max.y = worldCorner.y;
            }
        }

        return Rect.create(min.x, min.y, max.x - min.x, max.y - min.y);
    }

    //==============================================================================
    // getWorldCorners() 를 통한 충돌 검출.
    //==============================================================================
    /**
     * @param { Vector2 } viewPosition
     * @returns { boolean }
     */
    contains(viewPosition) {
        if (viewPosition === null || viewPosition === undefined) {
            return false;
        }
        const worldCorners = this.getWorldCorners();
        const obb = new OBB();
        obb.setEdges(worldCorners);
        const inside = obb.contains(viewPosition);
        return inside;
    }

    //==============================================================================
    // 터치 인터랙션 활성화 설정.
    //==============================================================================
    /**
     * @param { boolean } isInteractable
     */
    setInteractable(isInteractable) {
        this.#isInteractable = isInteractable;
    }

    //==============================================================================
    // 터치 인터랙션 활성화 여부 반환.
    //==============================================================================
    /**
     * @returns { boolean }
     */
    isInteractable() {
        return this.#isInteractable;
    }

    //==============================================================================
    // 터치 누름. (TouchRaycaster에 의해 호출, 컴포넌트에 전달)
    //==============================================================================
    /**
     * @virtual
     * @param { Vector2 } viewInputPosition
     */
    touchPress(viewInputPosition) {
        const components = this.getAllComponents();
        for (const component of components) {
            if (typeof component.touchPress === "function") {
                component.touchPress(viewInputPosition);
            }
        }
    }

    //==============================================================================
    // 터치 이동. (TouchRaycaster에 의해 호출, 컴포넌트에 전달)
    //==============================================================================
    /**
     * @virtual
     * @param { Vector2 } viewInputPosition
     */
    touchMove(viewInputPosition) {
        const components = this.getAllComponents();
        for (const component of components) {
            if (typeof component.touchMove === "function") {
                component.touchMove(viewInputPosition);
            }
        }
    }

    //==============================================================================
    // 터치 뗌. (TouchRaycaster에 의해 호출, 컴포넌트에 전달)
    //==============================================================================
    /**
     * @virtual
     * @param { Vector2 } viewInputPosition
     */
    touchRelease(viewInputPosition) {
        const components = this.getAllComponents();
        for (const component of components) {
            if (typeof component.touchRelease === "function") {
                component.touchRelease(viewInputPosition);
            }
        }
    }

    //==============================================================================
    // 터치 취소. (TouchRaycaster에 의해 호출, 컴포넌트에 전달)
    //==============================================================================
    /**
     * @virtual
     * @param { Vector2 } viewInputPosition
     */
    touchCancel(viewInputPosition) {
        const components = this.getAllComponents();
        for (const component of components) {
            if (typeof component.touchCancel === "function") {
                component.touchCancel(viewInputPosition);
            }
        }
    }
}