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
// 전역 상수 목록.
//==============================================================================
// 화면 밖 거르기 판정에 고쳐 쓰는 칸. (graphic.isLocalRectVisible 은 받은 영역을 그 자리에서 읽기만 한다)
const cullContentSize = Vector2.zero();
const cullRect = new Rect();
const cullDrawnRect = new Rect();
// 뷰 좌표를 로컬 좌표로 바꿀 때 내용 크기를 읽어 두는 칸. (convertViewToLocal)
const convertContentSize = Vector2.zero();


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
            this.applyLocalTransform(graphic);

            // 현재 노드의 피봇 반영.
            // 캔버스2D는 기준점을 좌상으로 여기고 우하방향으로 그림을 그리므로.
            // 마지막 원점에서 현재 컨텐트사이즈 크기를 기준으로한 피봇만큼 상대적으로 당김.
            // 피봇과 내용 크기는 복제하지 않고 읽는다. getPivot() / getContentSize() 를 덮어쓴 하위 클래스면 그 함수로 읽는다.
            const isPivotOverridden = this.getPivot !== WorldNode.prototype.getPivot;
            const isContentSizeOverridden = this.getContentSize !== WorldNode.prototype.getContentSize;
            if (isPivotOverridden || isContentSizeOverridden) {
                const pivot = this.getPivot();
                const contentSize = this.getContentSize();
                graphic.translate(-contentSize.x * pivot.x, -contentSize.y * pivot.y);
            }
            else {
                graphic.translate(-this.#contentSize.x * this.#pivot.x, -this.#contentSize.y * this.#pivot.y);
            }

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
        // 화면 밖이라 걸러진 노드는 컴포넌트만 건너뛴다. (마스크의 클립과 자식은 그대로)
        const components = this.getAllComponents();
        const isComponentDrawCulled = this.isComponentDrawCulled(graphic, components);
        if (isComponentDrawCulled) {
            graphic.addCulledNodeCount(1);
        }
        let maskComponent = null;
        for (const component of components) {
            if (!component.isEnable()) {
                continue;
            }
            if (!isComponentDrawCulled) {
                component.draw(graphic);
            }
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
    // 화면 밖이라 이 노드의 컴포넌트 그리기를 건너뛸지 반환. (draw 가 부른다)
    // - Graphic 의 화면 밖 거르기가 켜져 있고, 켜진 컴포넌트가 하나 이상이며 모두 그리는 곳을 알리고,
    //   그 사각형들을 합쳐 지금 변환으로 옮긴 사각형이 화면에 걸치지 않으면 true.
    // - 내용 영역 안에서만 그린다고 알리는 컴포넌트(Component.isDrawnInsideContent)는 내용 영역을 한 단위씩 넓혀 본다. (나인 슬라이스가 크기를 올림해 한 단위 안쪽으로 넘칠 수 있다)
    // - 밖까지 그리는 컴포넌트는 Component.calculateDrawnRect 가 알려 준 사각형으로 본다. (넘친 글 등, 모르면 거르지 않는다)
    // - 자식은 여기서 보지 않는다. 자식은 저마다 따로 본다.
    //==============================================================================
    /**
     * @param { Graphic } graphic
     * @param { Component[] } components
     * @returns { boolean }
     */
    isComponentDrawCulled(graphic, components) {
        if (!graphic.isCullingEnabled()) {
            return false;
        }

        // 켜진 컴포넌트가 모두 그리는 곳을 알리는지. (내용 영역 안이거나 알려 준 사각형)
        let enabledComponentCount = 0;
        let isInsideContentReported = false;
        let isDrawnRectFound = false;
        let minimumX = 0;
        let minimumY = 0;
        let maximumX = 0;
        let maximumY = 0;
        const drawnRect = cullDrawnRect;
        for (const component of components) {
            if (!component.isEnable()) {
                continue;
            }
            enabledComponentCount += 1;
            if (component.isDrawnInsideContent()) {
                isInsideContentReported = true;
                continue;
            }
            if (!component.calculateDrawnRect(drawnRect)) {
                return false;
            }
            if (!(drawnRect.size.x > 0 && drawnRect.size.y > 0)) {
                continue;
            }
            const drawnRightX = drawnRect.position.x + drawnRect.size.x;
            const drawnBottomY = drawnRect.position.y + drawnRect.size.y;
            if (!isDrawnRectFound) {
                minimumX = drawnRect.position.x;
                minimumY = drawnRect.position.y;
                maximumX = drawnRightX;
                maximumY = drawnBottomY;
                isDrawnRectFound = true;
            }
            else {
                minimumX = System.Math.min(minimumX, drawnRect.position.x);
                minimumY = System.Math.min(minimumY, drawnRect.position.y);
                maximumX = System.Math.max(maximumX, drawnRightX);
                maximumY = System.Math.max(maximumY, drawnBottomY);
            }
        }
        if (enabledComponentCount === 0) {
            return false;
        }

        // 내용 영역. (복제본 없이 읽는다)
        if (isInsideContentReported) {
            const contentSize = cullContentSize;
            this.copyContentSizeTo(contentSize);
            if (!(contentSize.x > 0 && contentSize.y > 0)) {
                return false;
            }
            if (!isDrawnRectFound) {
                minimumX = -1;
                minimumY = -1;
                maximumX = contentSize.x + 1;
                maximumY = contentSize.y + 1;
                isDrawnRectFound = true;
            }
            else {
                minimumX = System.Math.min(minimumX, -1);
                minimumY = System.Math.min(minimumY, -1);
                maximumX = System.Math.max(maximumX, contentSize.x + 1);
                maximumY = System.Math.max(maximumY, contentSize.y + 1);
            }
        }
        if (!isDrawnRectFound) {
            return false;
        }
        const rect = cullRect;
        rect.position.set(minimumX, minimumY);
        rect.size.set(maximumX - minimumX, maximumY - minimumY);
        const isVisible = graphic.isLocalRectVisible(rect);
        return !isVisible;
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
        // 복제본을 새로 만들지 않고 가진 벡터에 값을 옮겨 적는다. (getPivot() 은 복제해 준다)
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
        // 복제본을 새로 만들지 않고 가진 벡터에 값을 옮겨 적는다. (getContentSize() 는 복제해 준다)
        this.#contentSize.x = contentSize.x;
        this.#contentSize.y = contentSize.y;
    }

    //==============================================================================
    // 실제 내용 크기 설정. (너비, 높이를 바로 받는다, Vector2 를 만들지 않는다)
    // - setContentSize() 를 덮어쓴 하위 클래스면 setContentSize 로 넘긴다.
    //==============================================================================
    /**
     * @param { number } width
     * @param { number } height
     */
    setContentSizeXY(width, height) {
        const isContentSizeOverridden = this.setContentSize !== WorldNode.prototype.setContentSize;
        if (isContentSizeOverridden) {
            this.setContentSize(Vector2.create(width, height));
            return;
        }
        this.#contentSize.x = width;
        this.#contentSize.y = height;
    }

    //==============================================================================
    // 부모 영역 안의 사각형에 놓기. (x, y 는 이 노드의 왼쪽 위, 부모 내용 영역의 왼쪽 위가 원점)
    // - 내용 크기를 width, height 로 두고, 피봇이 어디든 왼쪽 위가 (x, y) 에 오게 로컬 위치를 정한다. (x + width * pivot.x, y + height * pivot.y)
    // - 앵커는 바꾸지 않는다. 로컬 위치는 앵커와 무관하게 부모 왼쪽 위 기준이라 앵커가 어디든 같은 자리다. (getAnchoredPosition 은 그 앵커 기준으로 다시 셈해 준다)
    // - 로컬 배율과 회전은 보지 않는다. (배율 1, 회전 0 일 때 화면에서도 그 사각형이다)
    //==============================================================================
    /**
     * @param { number } x
     * @param { number } y
     * @param { number } width
     * @param { number } height
     */
    setRect(x, y, width, height) {
        this.setContentSizeXY(width, height);
        const isPivotOverridden = this.getPivot !== WorldNode.prototype.getPivot;
        let pivotX = this.#pivot.x;
        let pivotY = this.#pivot.y;
        if (isPivotOverridden) {
            const pivot = this.getPivot();
            pivotX = pivot.x;
            pivotY = pivot.y;
        }
        this.setLocalPositionXY(x + width * pivotX, y + height * pivotY);
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
    // 실제 내용 크기를 target 에 적는다. (복제본을 만들지 않는다, Paint 가 그릴 때마다 쓴다)
    // - getContentSize() 를 덮어쓴 하위 클래스면 그 함수가 주는 값을 적는다.
    //==============================================================================
    /**
     * @param { Vector2 } target
     */
    copyContentSizeTo(target) {
        const isContentSizeOverridden = this.getContentSize !== WorldNode.prototype.getContentSize;
        if (isContentSizeOverridden) {
            const contentSize = this.getContentSize();
            target.x = contentSize.x;
            target.y = contentSize.y;
            return;
        }

        target.x = this.#contentSize.x;
        target.y = this.#contentSize.y;
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
    // 글로벌 위치 설정. (getPosition 의 거꾸로)
    // - parent.getPosition() (= 부모 pivot 점의 월드 좌표) 에서 본 차이를 부모 회전/스케일을 풀어 부모 pivot 점 기준 오프셋으로 되돌린 뒤
    //   부모 content top-left 기준(localPosition)으로 옮긴다. 부모 스케일이 0 인 축은 부모 pivot 점에 놓는다.
    //==============================================================================
    /**
     * @override
     * @param { Vector2 } position
     */
    setPosition(position) {
        const parent = this.getParent();
        if (!(parent instanceof WorldNode)) {
            super.setPosition(position);
            return;
        }

        const parentPosition = parent.getPosition();
        const parentContentSize = parent.getContentSize();
        const parentPivot = parent.getPivot();
        const parentRotation = parent.getRotation();
        const parentScale = parent.getScale();

        // 부모 pivot 점 기준 차이.
        const dx = position.x - parentPosition.x;
        const dy = position.y - parentPosition.y;

        // 역회전, 역스케일.
        const radian = Math.degreeToRadian(-parentRotation);
        const cosRadian = Math.cos(radian);
        const sinRadian = Math.sin(radian);
        const rx = dx * cosRadian - dy * sinRadian;
        const ry = dx * sinRadian + dy * cosRadian;
        const sx = parentScale.x !== 0 ? rx / parentScale.x : 0;
        const sy = parentScale.y !== 0 ? ry / parentScale.y : 0;

        // 부모 content top-left 기준으로 옮김.
        const newLocalPosition = Vector2.create(sx + parentContentSize.x * parentPivot.x, sy + parentContentSize.y * parentPivot.y);
        this.setLocalPosition(newLocalPosition);
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
        for (let i = 0; i < worldCorners.length; ++i) {
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
    // 뷰 좌표 → 이 노드의 로컬 좌표. (내용 영역의 왼쪽 위가 원점, 오른쪽 아래가 내용 크기)
    // - 부모들의 위치, 배율, 회전을 모두 거친 네 귀퉁이(getWorldCorners)로 셈하므로 contains 와 같은 판정이다.
    // - 내용 크기가 0 인 축은 0 을 돌려준다.
    //==============================================================================
    /**
     * @param { Vector2 } viewPosition
     * @returns { Vector2 }
     */
    convertViewToLocal(viewPosition) {
        const worldCorners = this.getWorldCorners();
        const topLeft = worldCorners[0];
        const topRight = worldCorners[1];
        const bottomLeft = worldCorners[3];
        const contentSize = convertContentSize;
        this.copyContentSizeTo(contentSize);
        const axisXX = topRight.x - topLeft.x;
        const axisXY = topRight.y - topLeft.y;
        const axisYX = bottomLeft.x - topLeft.x;
        const axisYY = bottomLeft.y - topLeft.y;
        const axisXLengthSquared = axisXX * axisXX + axisXY * axisXY;
        const axisYLengthSquared = axisYX * axisYX + axisYY * axisYY;
        const offsetX = viewPosition.x - topLeft.x;
        const offsetY = viewPosition.y - topLeft.y;
        let ratioX = 0;
        if (axisXLengthSquared > 0) {
            ratioX = (offsetX * axisXX + offsetY * axisXY) / axisXLengthSquared;
        }
        let ratioY = 0;
        if (axisYLengthSquared > 0) {
            ratioY = (offsetX * axisYX + offsetY * axisYY) / axisYLengthSquared;
        }
        return Vector2.create(ratioX * contentSize.x, ratioY * contentSize.y);
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