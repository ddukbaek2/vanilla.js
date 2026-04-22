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
        this.#anchor = Pivot.topLeft.clone();
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

        const canvasRenderingContext = graphic.getCanvasRenderingContext();
        if (canvasRenderingContext) {
            canvasRenderingContext.save();

            // 자신의 앵커를 통해 부모 영역 내 기준점 반영.
            const parent = this.getParent();
            if (parent && parent instanceof WorldNode) {
                const parentContentSize = parent.getContentSize();
                const anchor = this.getAnchor();
                const anchorPosition = Vector2.create(parentContentSize.x * anchor.x, parentContentSize.y * anchor.y);
                canvasRenderingContext.translate(anchorPosition.x, anchorPosition.y);
            }

            // 트랜스폼 반영.
            const localPosition = this.getLocalPosition();
            const localRotation = this.getLocalRotation();
            const radian = Math.degreeToRadian(localRotation);
            const localScale = this.getLocalScale();
            canvasRenderingContext.translate(localPosition.x, localPosition.y);
            canvasRenderingContext.rotate(radian);
            canvasRenderingContext.scale(localScale.x, localScale.y);

            // 현재 노드의 피봇 반영.
            // 캔버스2D는 기준점을 좌상으로 여기고 우하방향으로 그림을 그리므로.
            // 마지막 원점에서 현재 컨텐트사이즈 크기를 기준으로한 피봇만큼 상대적으로 당김.
            const pivot = this.getPivot();
            const contentSize = this.getContentSize();
            const pivotPosition = Vector2.create(contentSize.x * pivot.x, contentSize.y * pivot.y);
            canvasRenderingContext.translate(-pivotPosition.x, -pivotPosition.y);

            // 투명도 반영.
            const localOpacity = this.getLocalOpacity();
            canvasRenderingContext.globalAlpha *= localOpacity;
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
        const canvasRenderingContext = graphic.getCanvasRenderingContext();
        if (canvasRenderingContext) {
            // 기존 투명도 무효화 및 색상 설정.
            const originalAlpha = canvasRenderingContext.globalAlpha;
            canvasRenderingContext.globalAlpha = 1.0;

            // 좌표.
            const contentSize = this.getContentSize();
            const pivot = this.getPivot();
            const origin = Vector2.create(contentSize.x * pivot.x, contentSize.y * pivot.y);
            const left = 0;
            const top = 0;
            const right = left + contentSize.x;
            const bottom = top + contentSize.y;

            // 기존 투명도 무효화 및 색상 설정.
            canvasRenderingContext.fillStyle = "#00ff00";
            canvasRenderingContext.strokeStyle = "#00ff00";

            // 범위.
            canvasRenderingContext.lineWidth = 1;
            canvasRenderingContext.beginPath();
            canvasRenderingContext.moveTo(left, top);
            canvasRenderingContext.lineTo(right, top);
            canvasRenderingContext.lineTo(right, bottom);
            canvasRenderingContext.lineTo(left, bottom);
            canvasRenderingContext.lineTo(left, top);
            canvasRenderingContext.stroke();

            // 기준점.
            const pointSize = 4;
            canvasRenderingContext.beginPath();
            canvasRenderingContext.arc(origin.x, origin.y, pointSize, 0, Math.PI * 2);
            canvasRenderingContext.fill();

            // 기존 투명도 복원.
            canvasRenderingContext.globalAlpha = originalAlpha;
        }
    }

    //==============================================================================
    // 기준점 설정.
    //==============================================================================
    /**
     * @param { Vector2 } pivot
     */
    setPivot(pivot) {
        this.#pivot = pivot;
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
        return this.#pivot;
    }

    //==============================================================================
    // 실제 내용 크기 설정.
    //==============================================================================
    /**
     * @param { Vector2 } contentSize
     */
    setContentSize(contentSize) {
        this.#contentSize = contentSize;
    }

    //==============================================================================
    // 실제 내용 크기 반환.
    // - 부모가 없고(루트 노드) 명시적으로 설정된 적 없으면 현재 뷰 크기를 반환한다.
    //==============================================================================
    /**
     * @returns { Vector2 }
     */
    getContentSize() {
        return this.#contentSize;
    }

    //==============================================================================
    // 앵커 설정.
    //==============================================================================
    /**
     * @param { Vector2 } anchor
     */
    setAnchor(anchor) {
        this.#anchor = anchor;
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
    // - 별도 변수를 보관하지 않고, 현재 anchor 상태에 맞춰 localPosition을 조작한다.
    // - WorldNode의 anchor는 부모 영역 내 비율 위치이며, localPosition은 그 anchor 지점에서의 추가 오프셋이다.
    //   따라서 anchoredPosition === localPosition.
    //==============================================================================
    /**
     * @param { Vector2 } anchoredPosition
     */
    setAnchoredPosition(anchoredPosition) {
        this.setLocalPosition(anchoredPosition);
    }

    //==============================================================================
    // 앵커 기준 위치 반환.
    // - 별도 변수를 보관하지 않고, 현재 anchor 상태에 맞춰 계산된 localPosition을 반환한다.
    //==============================================================================
    /**
     * @returns { Vector2 }
     */
    getAnchoredPosition() {
        return this.getLocalPosition();
    }

    //==============================================================================
    // 글로벌 위치 반환. (앵커 오프셋 반영)
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
        const anchor = this.getAnchor();

        // 앵커 기준점과 부모 피봇의 차이 (부모 로컬 공간).
        const anchorOffsetX = parentContentSize.x * (anchor.x - parentPivot.x);
        const anchorOffsetY = parentContentSize.y * (anchor.y - parentPivot.y);

        // 앵커 오프셋과 로컬 포지션의 합산.
        const totalLocalX = anchorOffsetX + localPosition.x;
        const totalLocalY = anchorOffsetY + localPosition.y;

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