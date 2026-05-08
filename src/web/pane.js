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
    },
    font: {
        family: "sans-serif",
        mono: "\"Consolas\", monospace",
        size: "13px",
        sizeSmall: "12px"
    }
};


//==============================================================================
// 스타일 및 요소 생성 유틸리티.
//==============================================================================
export class PaneStyle {
    /**
     * 엘리먼트에 여러 스타일을 일괄 적용합니다.
     * @param { HTMLElement } el 
     * @param { Object } styles 
     */
    static apply(el, styles) {
        if (!el || !styles) return;
        Object.assign(el.style, styles);
    }

    /**
     * 스타일 프리셋이 적용된 엘리먼트를 생성합니다.
     * @param { string } tagName 
     * @param { string } preset - "panel" | "toolbar" | "button" | "input" | "textarea" | "text"
     * @param { Object } options - { id, text, style, type, placeholder, accent, warning }
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
    /** @private @type { number } */ #minSize;
    /** @private @type { number } */ #maxSize;
    
    /** @private @type { boolean } */ #isResizable; 
    /** @private @type { Object } */ #resizableEdges; 
    
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
    constructor(options = {}) {
        this.#direction = options.direction || "horizontal";
        
        let size = options.size !== undefined ? options.size : 0;
        if (size === "flex") size = 0;
        this.#initialSize = typeof size === "string" && size.endsWith("%") ? parseFloat(size) / 100 : parseFloat(size);
        
        this.#fixedSize = (this.#initialSize > 1) ? this.#initialSize : 0;
        this.#minSize = options.minSize !== undefined ? options.minSize : 50;
        this.#maxSize = options.maxSize !== undefined ? options.maxSize : Number.MAX_VALUE;
        
        // 리사이즈 설정
        this.#isResizable = options.isResizable !== undefined ? options.isResizable : true;
        this.#resizableEdges = options.resizableEdges || { top: true, bottom: true, left: true, right: true };

        this.#children = [];
        this.#resizers = [];
        this.#parentPane = null;
        this.#onResizeCallback = null;
        this.#isResizing = false;

        this.#onMouseMoveBind = this.#onMouseMove.bind(this);
        this.#onMouseUpBind = this.#onMouseUp.bind(this);

        this.#createContainer();
    }

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

        const thickness = canResize ? 5 : 1;

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
                this.#isResizing = true;
                this.#activePrevPane = prev;
                this.#activeNextPane = next;
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
            e.clientX - prevRect.left : e.clientY - prevRect.top;

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
    updateLayout(x, y, w, h) {
        this.#container.style.left = `${x}px`;
        this.#container.style.top = `${y}px`;
        this.#container.style.width = `${w}px`;
        this.#container.style.height = `${h}px`;

        if (this.#children.length === 0) return;

        let totalResizerThick = 0;
        this.#resizers.forEach(r => totalResizerThick += parseInt(r.dataset.thickness));

        const avail = (this.#direction === "horizontal" ? w : h) - totalResizerThick;
        
        let used = 0;
        let flexCount = 0;
        const sizes = new Array(this.#children.length).fill(0);

        for (let i = 0; i < this.#children.length; i++) {
            const child = this.#children[i];
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
            if (this.#children[i].isFlex()) sizes[i] = perFlex;
        }

        let offset = 0;
        for (let i = 0; i < this.#children.length; i++) {
            const childSize = (i === this.#children.length - 1) ? 
                (this.#direction === "horizontal" ? w : h) - offset : sizes[i];
            
            if (this.#direction === "horizontal") {
                this.#children[i].updateLayout(offset, 0, childSize, h);
            } else {
                this.#children[i].updateLayout(0, offset, w, childSize);
            }
            
            offset += childSize;
            if (i < this.#resizers.length) {
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

    refresh() {
        const p = this.#container.parentElement;
        if (!p) return;
        this.updateLayout(0, 0, p.clientWidth || System.window.innerWidth, p.clientHeight || System.window.innerHeight);
    }

    attachTo(p) {
        p.appendChild(this.#container);
        const run = () => this.refresh();
        System.window.addEventListener("resize", run);
        run();
        System.requestAnimationFrame(run);
    }

    isFlex() { return this.#initialSize === 0; }
    getInitialSize() { return this.#initialSize; }
    getFixedSize() { return this.#fixedSize; }
    setFixedSize(s) { this.#fixedSize = s; }
    getMinSize() { return this.#minSize; }
    getMaxSize() { return this.#maxSize; }
    getContainer() { return this.#container; }
    setCallback(c) { this.#onResizeCallback = c; }
    isResizable() { return this.#isResizable; }
    getResizableEdges() { return this.#resizableEdges; }
}