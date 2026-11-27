//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 테마 상수 정의.
//==============================================================================
export const PaneTheme = {
    color: {
        background: "#1e1e1e",
        panel: "#252526",
        toolbar: "#2d2d30",
        border: "#444",
        text: "#ccc",
        textDim: "#aaaaaa",
        accent: "#0e639c",
        accentHover: "#1177bb",
        warning: "#d97706", // 주황색 (Orange)
        warningHover: "#f59e0b",
        error: "#f44336",
        success: "#4CAF50",
        inputBg: "#3c3c3c",
        resizer: "#333",
        resizerHover: "#007acc"
    }, // 색. (CSS 색 글)
    size: {
        resizer: 5
    }, // 크기. (픽셀)
    font: {
        family: "sans-serif",
        mono: "\"Consolas\", monospace",
        size: "13px",
        sizeSmall: "12px"
    } // 글꼴과 글 크기.
};


//==============================================================================
// 스타일 및 요소 생성 유틸리티.
//==============================================================================
/**
 * @example <caption>테마 스타일이 적용된 단추 만들기</caption>
 * import { PaneStyle, PaneTheme } from "./build/vanilla.js";
 *
 * const button = PaneStyle.create("button", "button", { text: "OK", accent: true });
 * PaneStyle.apply(button, { margin: "8px" });
 * document.body.appendChild(button);
 * console.log(button.style.margin, PaneTheme.color.accent);
 */
export class PaneStyle {
    /**
     * 엘리먼트에 여러 스타일을 한꺼번에 적용한다. (엘리먼트나 스타일이 없으면 아무것도 하지 않는다)
     * @param { HTMLElement } el 스타일을 적용할 엘리먼트.
     * @param { Object } styles 적용할 CSS 속성 이름과 값. (camelCase)
     */
    static apply(el, styles) {
        if (!el || !styles) return;
        Object.assign(el.style, styles);
    }

    /**
     * 스타일 프리셋이 적용된 엘리먼트를 만든다.
     * @param { string } tagName 만들 태그 이름.
     * @param { string } preset 프리셋 이름. ("panel", "toolbar", "button", "input", "textarea", "text", 빈 글이면 공통 스타일만)
     * @param { Object } options { id, text, style, type, placeholder, accent, warning }. (accent 나 warning 이 참인 단추는 그 색 바탕)
     * @returns { HTMLElement } 만든 엘리먼트.
     */
    static create(tagName, preset = "", options = {}) {
        const el = System.document.createElement(tagName);
        if (options.id) el.id = options.id;
        if (options.text) el.innerText = options.text;
        if (options.type) el.type = options.type;
        if (options.placeholder) el.placeholder = options.placeholder;

        // 공통 기본 스타일 (Absolute 레이아웃 최적화)
        this.apply(el, {
            position: "absolute",
            left: "0",
            top: "0",
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            fontFamily: PaneTheme.font.family,
            fontSize: PaneTheme.font.size,
            color: PaneTheme.color.text,
            margin: "0",
            padding: "0"
        });

        // 프리셋별 스타일 적용
        switch (preset) {
            case "toolbar":
                this.apply(el, {
                    backgroundColor: PaneTheme.color.toolbar,
                    borderBottom: `1px solid ${PaneTheme.color.border}`,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "10px"
                });
                break;
            case "panel":
                this.apply(el, {
                    backgroundColor: PaneTheme.color.panel,
                    padding: "10px"
                });
                break;
            case "button":
                let bgColor = PaneTheme.color.resizer;
                if (options.accent) bgColor = PaneTheme.color.accent;
                if (options.warning) bgColor = PaneTheme.color.warning;

                this.apply(el, {
                    position: "relative",
                    width: "auto",
                    height: "auto",
                    padding: "6px 16px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    backgroundColor: bgColor
                });
                el.addEventListener("mouseenter", () => el.style.filter = "brightness(1.2)");
                el.addEventListener("mouseleave", () => el.style.filter = "none");
                break;
            case "input":
                this.apply(el, {
                    position: "relative",
                    height: "auto",
                    background: PaneTheme.color.inputBg,
                    border: `1px solid ${PaneTheme.color.resizer}`,
                    padding: "4px"
                });
                break;
            case "textarea":
                this.apply(el, {
                    backgroundColor: PaneTheme.color.background,
                    color: "#d4d4d4",
                    fontFamily: PaneTheme.font.mono,
                    fontSize: "14px",
                    padding: "15px",
                    border: "none",
                    resize: "none",
                    outline: "none",
                    tabSize: "4"
                });
                break;
            case "text":
                this.apply(el, {
                    position: "relative",
                    width: "auto",
                    height: "auto",
                    fontWeight: "bold"
                });
                break;
        }

        // 추가 커스텀 스타일 적용
        if (options.style) this.apply(el, options.style);
        
        return el;
    }
}


//==============================================================================
// 화면 분할 패널(Pane) 클래스.
//==============================================================================
/**
 * @example <caption>좌우로 나누고 부모 요소에 붙이기</caption>
 * import { Pane } from "./build/vanilla.js";
 *
 * const rootPane = new Pane({ direction: "horizontal" });
 * const leftPane = new Pane({ size: 200, minSize: 100 });
 * const rightPane = new Pane({ size: "flex" });
 * rootPane.addPane(leftPane);
 * rootPane.addPane(rightPane);
 * rootPane.attachTo(document.body);
 * console.log(leftPane.getInitialSize(), rightPane.isFlex(), leftPane.getMinSize());
 */
export class Pane {
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @private @type { HTMLElement } */ #container;
    /** @private @type { string } */ #direction;
    /** @private @type { Pane[] } */ #children;
    /** @private @type { HTMLElement[] } */ #resizers;
    
    /** @private @type { number } */ #initialSize; 
    /** @private @type { number } */ #fixedSize;
    /** @private @type { number } */ #resizeGrabOffset;
    /** @private @type { number } */ #minSize;
    /** @private @type { number } */ #maxSize;
    
    /** @private @type { boolean } */ #isResizable; 
    /** @private @type { Object } */ #resizableEdges; 
    /** @private @type { boolean } */ #isVisible;
    
    /** @private @type { Function } */ #onResizeCallback;
    /** @private @type { Pane } */ #parentPane;

    // 리사이즈 드래그 관련
    /** @private @type { boolean } */ #isResizing;
    /** @private @type { Pane } */ #activePrevPane;
    /** @private @type { Pane } */ #activeNextPane;
    /** @private @type { Function } */ #onMouseMoveBind;
    /** @private @type { Function } */ #onMouseUpBind;

    //==============================================================================
    // 생성.
    //==============================================================================
    /**
     * @constructor
     * @param { { direction?: string, size?: number | string, minSize?: number, maxSize?: number, isResizable?: boolean, resizableEdges?: { top: boolean, bottom: boolean, left: boolean, right: boolean } } } options 나누는 방향(horizontal 이나 vertical), 처음 크기(픽셀, 1 이하의 비율, 퍼센트 글, flex), 가장 작고 큰 크기, 조절 가능 여부와 가장자리.
     */
    constructor(options = {}) {
        this.#direction = options.direction || "horizontal";
        
        let size = options.size !== undefined ? options.size : 0;
        if (size === "flex") size = 0;
        this.#initialSize = typeof size === "string" && size.endsWith("%") ? parseFloat(size) / 100 : parseFloat(size);
        
        this.#fixedSize = (this.#initialSize > 1) ? this.#initialSize : 0;
        this.#resizeGrabOffset = 0;
        this.#minSize = options.minSize !== undefined ? options.minSize : 50;
        this.#maxSize = options.maxSize !== undefined ? options.maxSize : Number.MAX_VALUE;
        
        // 리사이즈 설정
        this.#isResizable = options.isResizable !== undefined ? options.isResizable : true;
        this.#resizableEdges = options.resizableEdges || { top: true, bottom: true, left: true, right: true };

        this.#isVisible = true;
        this.#children = [];
        this.#resizers = [];
        this.#parentPane = null;
        this.#onResizeCallback = null;
        this.#isResizing = false;

        this.#onMouseMoveBind = this.#onMouseMove.bind(this);
        this.#onMouseUpBind = this.#onMouseUp.bind(this);

        this.#createContainer();
    }

    //==============================================================================
    // 컨테이너 요소 만들기. (절대 자리, 넘치는 것은 숨긴다)
    //==============================================================================
    /** @private */
    #createContainer() {
        this.#container = System.document.createElement("div");
        this.#container.style.position = "absolute";
        this.#container.style.overflow = "hidden";
        this.#container.style.boxSizing = "border-box";
        this.#container.style.backgroundColor = PaneTheme.color.background;
    }

    //==============================================================================
    // 자식 추가.
    //==============================================================================
    /**
     * @param { Pane } pane 자식으로 붙일 패널. (앞 자식과의 사이에 리사이저가 생긴다)
     */
    addPane(pane) {
        if (!(pane instanceof Pane)) return;
        pane.#parentPane = this;

        if (this.#children.length > 0) {
            const prev = this.#children[this.#children.length - 1];
            const resizer = this.#createResizer(prev, pane);
            this.#resizers.push(resizer);
            this.#container.appendChild(resizer);
        }

        this.#children.push(pane);
        this.#container.appendChild(pane.getContainer());
    }

    //==============================================================================
    // 앞 패널과 뒤 패널 사이의 리사이저 요소 만들기. (부모와 두 패널이 모두 조절할 수 있을 때만 끌린다)
    //==============================================================================
    /** @private */
    #createResizer(prev, next) {
        const resizer = System.document.createElement("div");
        resizer.style.position = "absolute";
        resizer.style.backgroundColor = PaneTheme.color.resizer;
        resizer.style.zIndex = "1000";

        // 조절 가능 여부 판단
        let canResize = this.#isResizable && prev.isResizable() && next.isResizable();
        if (this.#direction === "horizontal") {
            if (!prev.getResizableEdges().right || !next.getResizableEdges().left) canResize = false;
        } else {
            if (!prev.getResizableEdges().bottom || !next.getResizableEdges().top) canResize = false;
        }

        const thickness = canResize ? PaneTheme.size.resizer : 1;

        if (this.#direction === "horizontal") {
            resizer.style.width = `${thickness}px`;
            if (canResize) resizer.style.cursor = "col-resize";
        } else {
            resizer.style.height = `${thickness}px`;
            if (canResize) resizer.style.cursor = "row-resize";
        }

        if (canResize) {
            resizer.addEventListener("mouseenter", () => resizer.style.backgroundColor = PaneTheme.color.resizerHover);
            resizer.addEventListener("mouseleave", () => { if(!this.#isResizing) resizer.style.backgroundColor = PaneTheme.color.resizer; });
            
            resizer.addEventListener("mousedown", (e) => {
                // 첫 이동에서 레이아웃이 바뀌며 누른 자리에 draggable 요소가 오면
                // 브라우저가 그 요소의 끌기를 시작해 mousemove/mouseup 을 삼킨다. 기본 동작을 막는다.
                e.preventDefault();
                this.#isResizing = true;
                this.#activePrevPane = prev;
                this.#activeNextPane = next;

                // 잡은 지점과 경계 사이 간격을 기억해 두어야 처음 끌 때 크기가 튀지 않는다.
                const grabRect = resizer.getBoundingClientRect();
                this.#resizeGrabOffset = (this.#direction === "horizontal")
                    ? (e.clientX - grabRect.left) : (e.clientY - grabRect.top);
                resizer.style.backgroundColor = PaneTheme.color.resizerHover;
                System.document.body.style.cursor = resizer.style.cursor;
                System.document.body.style.userSelect = "none";
                System.document.addEventListener("mousemove", this.#onMouseMoveBind);
                System.document.addEventListener("mouseup", this.#onMouseUpBind);
            });
        }
        
        resizer.dataset.thickness = thickness;
        return resizer;
    }

    //==============================================================================
    // 마우스 이동
    //==============================================================================
    /** @private */
    #onMouseMove(e) {
        if (!this.#isResizing) return;

        const prevRect = this.#activePrevPane.getContainer().getBoundingClientRect();
        const nextRect = this.#activeNextPane.getContainer().getBoundingClientRect();
        
        const activeResizerIdx = this.#children.indexOf(this.#activeNextPane) - 1;
        const thick = parseInt(this.#resizers[activeResizerIdx].dataset.thickness);

        const totalAvail = (this.#direction === "horizontal") ? 
            (nextRect.right - prevRect.left) - thick : (nextRect.bottom - prevRect.top) - thick;

        let newPrevSize = (this.#direction === "horizontal") ? 
            (e.clientX - this.#resizeGrabOffset) - prevRect.left : (e.clientY - this.#resizeGrabOffset) - prevRect.top;

        newPrevSize = Math.max(this.#activePrevPane.getMinSize(), Math.min(newPrevSize, totalAvail - this.#activeNextPane.getMinSize()));

        if (this.#activePrevPane.isFlex() && !this.#activeNextPane.isFlex()) {
            this.#activeNextPane.setFixedSize(totalAvail - newPrevSize);
        } else {
            this.#activePrevPane.setFixedSize(newPrevSize);
        }

        let root = this;
        while (root.#parentPane) root = root.#parentPane;
        root.refresh();
    }

    //==============================================================================
    // 마우스 놓기. (크기 조절을 끝내고 문서에 건 이벤트를 뗀다)
    //==============================================================================
    /** @private */
    #onMouseUp() {
        this.#isResizing = false;
        System.document.body.style.cursor = "default";
        System.document.body.style.userSelect = "auto";
        System.document.removeEventListener("mousemove", this.#onMouseMoveBind);
        System.document.removeEventListener("mouseup", this.#onMouseUpBind);
        for(const r of this.#resizers) r.style.backgroundColor = PaneTheme.color.resizer;
    }

    //==============================================================================
    // 레이아웃 엔진
    //==============================================================================
    /**
     * @param { number } x 왼쪽 자리. (픽셀)
     * @param { number } y 위쪽 자리. (픽셀)
     * @param { number } w 너비. (픽셀)
     * @param { number } h 높이. (픽셀)
     */
    updateLayout(x, y, w, h) {
        this.#container.style.left = `${x}px`;
        this.#container.style.top = `${y}px`;
        this.#container.style.width = `${w}px`;
        this.#container.style.height = `${h}px`;

        if (this.#children.length === 0) return;

        // 숨긴 자식과 맞닿은 리사이저는 숨기고 두께에서 뺀다.
        let totalResizerThick = 0;
        for (let i = 0; i < this.#resizers.length; i++) {
            const isResizerVisible = this.#children[i].isVisible() && this.#children[i + 1].isVisible();
            this.#resizers[i].style.display = isResizerVisible ? "" : "none";
            if (isResizerVisible) totalResizerThick += parseInt(this.#resizers[i].dataset.thickness);
        }

        const avail = (this.#direction === "horizontal" ? w : h) - totalResizerThick;
        
        let used = 0;
        let flexCount = 0;
        let lastVisibleIndex = -1;
        const sizes = new Array(this.#children.length).fill(0);

        for (let i = 0; i < this.#children.length; i++) {
            const child = this.#children[i];
            if (!child.isVisible()) continue;
            lastVisibleIndex = i;
            if (child.isFlex()) {
                flexCount++;
            } else {
                let s = child.getFixedSize();
                if (s === 0) {
                    s = (child.getInitialSize() <= 1) ? avail * child.getInitialSize() : child.getInitialSize();
                }
                s = Math.max(child.getMinSize(), Math.min(s, child.getMaxSize()));
                sizes[i] = s;
                used += s;
            }
        }

        const perFlex = flexCount > 0 ? Math.max(0, avail - used) / flexCount : 0;
        for (let i = 0; i < this.#children.length; i++) {
            if (this.#children[i].isVisible() && this.#children[i].isFlex()) sizes[i] = perFlex;
        }

        let offset = 0;
        for (let i = 0; i < this.#children.length; i++) {
            if (!this.#children[i].isVisible()) continue;
            const childSize = (i === lastVisibleIndex) ? 
                (this.#direction === "horizontal" ? w : h) - offset : sizes[i];
            
            if (this.#direction === "horizontal") {
                this.#children[i].updateLayout(offset, 0, childSize, h);
            } else {
                this.#children[i].updateLayout(0, offset, w, childSize);
            }
            
            offset += childSize;
            if (i < this.#resizers.length && this.#resizers[i].style.display !== "none") {
                const r = this.#resizers[i];
                const thick = parseInt(r.dataset.thickness);
                if (this.#direction === "horizontal") {
                    r.style.left = `${offset}px`; r.style.top = "0px"; r.style.width = `${thick}px`; r.style.height = `${h}px`;
                } else {
                    r.style.left = "0px"; r.style.top = `${offset}px`; r.style.width = `${w}px`; r.style.height = `${thick}px`;
                }
                offset += thick;
            }
        }
        if (this.#onResizeCallback) this.#onResizeCallback();
    }

    //==============================================================================
    // 레이아웃 초기화 (드래그한 크기 삭제)
    //==============================================================================
    resetLayout() {
        this.#fixedSize = 0;
        for (const child of this.#children) {
            child.resetLayout();
        }
    }

    //==============================================================================
    // 부모 요소의 크기로 다시 배치. (부모가 없으면 아무것도 하지 않는다)
    //==============================================================================
    refresh() {
        const p = this.#container.parentElement;
        if (!p) return;
        this.updateLayout(0, 0, p.clientWidth || System.window.innerWidth, p.clientHeight || System.window.innerHeight);
    }

    //==============================================================================
    // 부모 요소에 붙이기. (창 크기가 바뀔 때마다 다시 배치한다)
    //==============================================================================
    /**
     * @param { HTMLElement } p 붙일 부모 요소.
     */
    attachTo(p) {
        p.appendChild(this.#container);
        const run = () => this.refresh();
        System.window.addEventListener("resize", run);
        run();
        System.requestAnimationFrame(run);
    }

    //==============================================================================
    // 보이기 / 숨기기. (숨긴 패널은 자리를 차지하지 않고, 맞닿은 리사이저도 숨는다)
    //==============================================================================
    /**
     * @param { boolean } isVisible 보이면 참, 숨기면 거짓.
     */
    setVisible(isVisible) {
        this.#isVisible = isVisible;
        this.#container.style.display = isVisible ? "" : "none";
        let root = this;
        while (root.#parentPane) root = root.#parentPane;
        root.refresh();
    }

    //==============================================================================
    // 보이는지 반환.
    //==============================================================================
    /**
     * @returns { boolean } 보이면 참.
     */
    isVisible() { return this.#isVisible; }

    //==============================================================================
    // 남는 자리를 나눠 갖는지 반환. (처음 크기가 0 이면 참)
    //==============================================================================
    /**
     * @returns { boolean } 남는 자리를 나눠 가지면 참.
     */
    isFlex() { return this.#initialSize === 0; }

    //==============================================================================
    // 처음 크기 반환. (1 이하이면 부모에 대한 비율, 넘으면 픽셀)
    //==============================================================================
    /**
     * @returns { number } 처음 크기. (1 이하이면 부모에 대한 비율, 넘으면 픽셀)
     */
    getInitialSize() { return this.#initialSize; }

    //==============================================================================
    // 정해진 크기 반환. (끌어서 정했거나 처음 크기가 픽셀이면 그 값, 아니면 0)
    //==============================================================================
    /**
     * @returns { number } 정해진 크기. (픽셀, 정해진 것이 없으면 0)
     */
    getFixedSize() { return this.#fixedSize; }

    //==============================================================================
    // 정해진 크기 설정. (픽셀)
    //==============================================================================
    /**
     * @param { number } s 정해 둘 크기. (픽셀)
     */
    setFixedSize(s) { this.#fixedSize = s; }

    //==============================================================================
    // 가장 작은 크기 반환. (픽셀)
    //==============================================================================
    /**
     * @returns { number } 가장 작은 크기. (픽셀)
     */
    getMinSize() { return this.#minSize; }

    //==============================================================================
    // 가장 큰 크기 반환. (픽셀)
    //==============================================================================
    /**
     * @returns { number } 가장 큰 크기. (픽셀)
     */
    getMaxSize() { return this.#maxSize; }

    //==============================================================================
    // 컨테이너 요소 반환.
    //==============================================================================
    /**
     * @returns { HTMLElement } 컨테이너 요소.
     */
    getContainer() { return this.#container; }

    //==============================================================================
    // 배치가 바뀔 때마다 부를 함수 설정.
    //==============================================================================
    /**
     * @param { Function | null } c 배치가 바뀔 때마다 부를 함수.
     */
    setCallback(c) { this.#onResizeCallback = c; }

    //==============================================================================
    // 크기를 조절할 수 있는지 반환.
    //==============================================================================
    /**
     * @returns { boolean } 크기를 조절할 수 있으면 참.
     */
    isResizable() { return this.#isResizable; }

    //==============================================================================
    // 조절할 수 있는 가장자리 반환. ({ top, right, bottom, left })
    //==============================================================================
    /**
     * @returns { { top: boolean, bottom: boolean, left: boolean, right: boolean } } 조절할 수 있는 가장자리.
     */
    getResizableEdges() { return this.#resizableEdges; }
}