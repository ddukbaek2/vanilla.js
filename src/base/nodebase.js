//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "./object.js";


//==============================================================================
// 계층 구조 객체.
//==============================================================================
/**
 * @template T
 */
export class Nodebase extends Object {
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @private @type { Nodebase } */ #parent;
    /** @private @type { Nodebase[] } */ #children;
    /** @private @type { T } */ #value;

    //==============================================================================
    // 생성.
    //==============================================================================
    /**
     * @constructor
     */
    constructor() {
        super();
        this.#parent = null;
        this.#children = [];
        this.#value = undefined;
    }

    //==============================================================================
    // 자식 추가.
    //==============================================================================
    /**
     * @param { Nodebase } nodebase 
     * @returns { boolean }
     */
    addChild(nodebase) {
        const childIndex = this.getChildIndex(nodebase);
        if (childIndex !== -1) {
            return false;
        }

        const parent = nodebase.getParent();
        if (parent) {
            parent.removeChild(nodebase);
        }

        this.#children.push(nodebase);
        return true;
    }

    //==============================================================================
    // 자식 제거.
    //==============================================================================
    /**
     * @param { Nodebase } nodebase
     * @returns { boolean }
     */
    removeChild(nodebase) {
        const childIndex = this.getChildIndex(nodebase);
        if (childIndex !== -1) {
            const removed = this.removeChildAt(nodebase);
            return removed;
        }
        return false;
    }

    //==============================================================================
    // 자식 제거.
    //==============================================================================
    /**
     * @param { number } childIndex
     * @returns { boolean }
     */
    removeChildAt(childIndex) {
        const childCount = this.getChildCount();
        if (childIndex < 0 || childIndex >= childCount) {
            return false;
        }
        
        const nodebase = this.getFChild(childIndex);
        nodebase.#parent = null;
        this.#children.splice(childIndex, 1);
        return true;
    }

    //==============================================================================
    // 모든 자식 제거.
    //==============================================================================
    removeChildren() {
        while (this.getChildCount() > 0) {
            this.removeChildAt(0);
        }
    }

    //==============================================================================
    // 부모 반환.
    //==============================================================================
    /**
     * @returns { Nodebase }
     */
    getParent() {
        return this.#parent;
    }

    //==============================================================================
    // 모든 자식 반환.
    //==============================================================================
    /**
     * @returns { Nodebase[] }
     */
    getChildren() {
        return this.#children;
    }

    //==============================================================================
    // 자식 갯수 반환.
    //==============================================================================
    /**
     * @returns { number }
     */
    getChildCount() {
        return this.#children.length;
    }

    //==============================================================================
    // 자식 반환.
    //==============================================================================
    /**
     * @param { number } childIndex 
     * @returns { Nodebase | undefined }
     */
    getChild(childIndex) {
        return this.#children.at(childIndex);
    }

    //==============================================================================
    // 자식 인덱스 반환.
    //==============================================================================
    /**
     * @param { Nodebase } node 
     * @returns { number }
     */
    getChildIndex(node) {
        if (node === null || node === undefined) {
            return -1;
        }

        const childIndex = this.#children.indexOf(node);
        return childIndex;
    }

    //==============================================================================
    // 자식 포함 여부 반환.
    //==============================================================================
    /**
     * @param { Nodebase } node 
     * @returns { boolean }
     */
    contains(node) {
        const childIndex = this.getChildIndex(node);
        if (childIndex !== -1) {
            return true;
        }

        return false;
    }

    //==============================================================================
    // 값 설정.
    //==============================================================================
    /**
     * 
     * @param { T } value 
     */
    setValue(value) {
        this.#value = value;
    }

    //==============================================================================
    // 값 반환.
    //==============================================================================
    /**
     * @returns { T }
     */ 
    getValue() {
        return this.#value;
    }
}