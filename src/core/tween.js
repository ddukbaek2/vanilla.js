//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import * as Math from "../base/math.js";
import { Vector2 } from "../base/vector2.js";


//==============================================================================
// 트윈이 바로 쓰는 노드 속성 이름. (setTarget 으로 대상 노드를 정했을 때, 값 이름이 이 이름이면 그 노드에 쓴다)
// - Vector2 속성에 숫자를 주면 두 축에 같이 쓴다. (예: { localScale: 0 } → setLocalScale(Vector2.create(0, 0)))
// - 숫자 속성에 Vector2 를 주면 쓰지 않는다.
//==============================================================================
export const TweenProperty = System.Object.freeze({
	localPosition: "localPosition",
	localScale: "localScale",
	localRotation: "localRotation",
	localOpacity: "localOpacity",
	contentSize: "contentSize",
});


//==============================================================================
// 노드에 트윈 속성 값 쓰기. (노드 속성 이름이 아니면 아무것도 하지 않는다)
//==============================================================================
/**
 * @param { WorldNode } node
 * @param { string } tweenProperty TweenProperty 의 값.
 * @param { number | Vector2 } value
 */
export function applyTweenProperty(node, tweenProperty, value) {
	const vector = (typeof value === "number") ? Vector2.create(value, value) : value;
	switch (tweenProperty) {
		case TweenProperty.localPosition: {
			node.setLocalPosition(vector);
			break;
		}
		case TweenProperty.localScale: {
			node.setLocalScale(vector);
			break;
		}
		case TweenProperty.contentSize: {
			node.setContentSize(vector);
			break;
		}
		case TweenProperty.localRotation: {
			if (typeof value === "number") {
				node.setLocalRotation(value);
			}
			break;
		}
		case TweenProperty.localOpacity: {
			if (typeof value === "number") {
				node.setLocalOpacity(value);
			}
			break;
		}
		default: {
			break;
		}
	}
}


//==============================================================================
// 트윈.
// - setTarget(node) 로 대상 노드를 정하면 값 이름이 TweenProperty 이름인 값을 tick 마다 그 노드에 바로 쓴다.
//   대상 노드가 트윈이 처음 돈 때의 노드 트리에서 떨어지면(removeChild 등) 콜백 없이 조용히 끝난다.
// - duration 이 0 이하이면 바로 끝(진행률 1)으로 친다.
//==============================================================================
export class Tween extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
    /** @private @type { System.Object } */ #valuesStart;
    /** @private @type { System.Object } */ #valuesEnd;
    /** @private @type { number } */ #duration;
    /** @private @type { number } */ #delay;
    /** @private @type { number } */ #elapsedTime;
    /** @private @type { Function } */ #easingFunction;
    /** @private @type { Function } */ #tickCallback;
    /** @private @type { Function } */ #completeCallback;
    /** @private @type { boolean } */ #isPlaying;
    /** @private @type { boolean } */ #isFinished;
    /** @private @type { WorldNode | null } */ #targetNode;
    /** @private @type { Node | null } */ #targetRootNode;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * 
	 * @param { Object } initialValues 
	 */
	constructor(initialValues) {
		super();

        this.#valuesStart = { ...initialValues };
		this.#valuesEnd = { };
		this.#duration = 1.0;
		this.#delay = 0;
		this.#elapsedTime = 0;
		this.#easingFunction = Tween.easingFunction.linear;
		this.#tickCallback = null;
		this.#completeCallback = null;
		this.#isPlaying = false;
		this.#isFinished = false;
		this.#targetNode = null;
		this.#targetRootNode = null;
    }

	//==============================================================================
	// 노드 속성 하나를 움직이는 트윈 생성. (정적)
	// - new Tween(시작값).to(목표값, duration).setTarget(node) 와 같다. 값 이름은 속성 이름이다.
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @param { string } tweenProperty TweenProperty 의 값.
	 * @param { number | Vector2 } startValue
	 * @param { number | Vector2 } endValue
	 * @param { number } duration
	 * @returns { Tween }
	 */
	static createNodeTween(node, tweenProperty, startValue, endValue, duration) {
		const initialValues = {};
		initialValues[tweenProperty] = startValue;
		const targetValues = {};
		targetValues[tweenProperty] = endValue;
		return new Tween(initialValues).to(targetValues, duration).setTarget(node);
	}

	//==============================================================================
	// 노드의 맨 위 노드 반환.
	//==============================================================================
	/**
	 * @param { Node } node
	 * @returns { Node }
	 */
	static findRootNode(node) {
		let currentNode = node;
		let parentNode = currentNode.getParent();
		while (parentNode) {
			currentNode = parentNode;
			parentNode = currentNode.getParent();
		}
		return currentNode;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
        if (!this.#isPlaying || this.#isFinished) {
            return;
        }

		// 대상 노드가 처음 돈 때의 노드 트리에서 떨어졌으면 콜백 없이 끝낸다.
		const targetNode = this.getTarget();
		if (targetNode) {
			const targetRootNode = Tween.findRootNode(targetNode);
			if (this.#targetRootNode === null) {
				this.#targetRootNode = targetRootNode;
			}
			else if (this.#targetRootNode !== targetRootNode) {
				this.stop();
				return;
			}
		}

        this.#elapsedTime += timeDelta;
        if (this.#elapsedTime < this.#delay) {
            return;
        }

        let progress = 1;
        if (this.#duration > 0) {
            progress = (this.#elapsedTime - this.#delay) / this.#duration;
            progress = Math.clamp(progress, 0, 1);
        }
        
        const easedProgress = this.#easingFunction(progress);

        const newValues = {};
        for (const key in this.#valuesEnd) {
            const startValue = this.#valuesStart[key];
            const endValue = this.#valuesEnd[key];

            if (startValue === undefined) {
                continue;
            }

            // 일반 숫자.
            if (typeof startValue === "number" && typeof endValue === "number") {
                newValues[key] = startValue + (endValue - startValue) * easedProgress;
            }
            // 2차원 벡터.
            else if (startValue instanceof Vector2 && endValue instanceof Vector2) {
                newValues[key] = Vector2.lerp(startValue, endValue, easedProgress);
            }
        }
        
        // 대상 노드에 쓰기.
        if (targetNode) {
            for (const key in newValues) {
                applyTweenProperty(targetNode, key, newValues[key]);
            }
        }

        if (this.#tickCallback) {
            this.#tickCallback(newValues);
        }

        if (progress >= 1) {
            this.stop();
            if (this.#completeCallback) {
                this.#completeCallback();
            }
        }
    }

	//==============================================================================
	// 목표값 설정.
	//==============================================================================
	/**
	 * @param { System.Object } properties
	 * @param { number } duration 
	 * @returns { Tween }
	 */
    to(properties, duration) {
        this.#valuesEnd = properties;
        if (duration !== undefined) {
            this.#duration = duration;
        }
        return this;
    }

	//==============================================================================
	// 시작 전 대기 시간 설정.
	//==============================================================================
	/**
	 * @param { number } amount 
	 * @returns { Tween }
	 */
    delay(amount) {
        this.#delay = amount;
        return this;
    }

	//==============================================================================
	// 트윈 함수 설정.
	//==============================================================================
	/**
	 * @param { Function } easingFunction
	 * @returns { Tween }
	 */
    easing(easingFunction) {
        this.#easingFunction = easingFunction;
        return this;
    }

	//==============================================================================
	// 갱신 콜백 설정.
	//==============================================================================
	/**
	 * @param { Function } callback
	 * @returns { Tween }
	 */
    setUpdate(callback) {
        this.#tickCallback = callback;
        return this;
    }

	//==============================================================================
	// 완료 콜백 설정.
	//==============================================================================
	/**
	 * @param { Function } callback
	 * @returns { Tween }
	 */
    setComplete(callback) {
        this.#completeCallback = callback;
        return this;
    }

	//==============================================================================
	// 대상 노드 설정. (값 이름이 TweenProperty 이름이면 이 노드에 쓴다)
	//==============================================================================
	/**
	 * @param { WorldNode | null } node
	 * @returns { Tween }
	 */
    setTarget(node) {
        this.#targetNode = node;
        this.#targetRootNode = null;
        return this;
    }

	//==============================================================================
	// 대상 노드 반환. (setTarget 을 하지 않았으면 null)
	//==============================================================================
	/**
	 * @returns { WorldNode | null }
	 */
    getTarget() {
        return this.#targetNode;
    }

	//==============================================================================
	// 시작.
	//==============================================================================
    start() {
        if (this.#isPlaying) {
            return;
        }

        this.#isPlaying = true;
        this.#isFinished = false;
        this.#elapsedTime = 0;
        this.#targetRootNode = null;
    }

	//==============================================================================
	// 정지.
	//==============================================================================
    stop() {
        this.#isPlaying = false;
        this.#isFinished = true;
    }
    
	//==============================================================================
	// 완료 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 
	 */
    isFinished() {
        return this.#isFinished;
    }
}


//==============================================================================
// 트윈 함수.
//==============================================================================
Tween.easingFunction = {
    linear: function(k) { return k; },
    quadratic: {
        in: function(k) { return k * k; },
        out: function(k) { return k * (2 - k); },
        inOut: function(k) {
            if ((k *= 2) < 1) { return 0.5 * k * k; }
            return -0.5 * (--k * (k - 2) - 1);
        }
    },
    cubic: {
		in: function ( k ) { return k * k * k; },
		out: function ( k ) { return --k * k * k + 1; },
		inOut: function ( k ) {
			if ( ( k *= 2 ) < 1 ) return 0.5 * k * k * k;
			return 0.5 * ( ( k -= 2 ) * k * k + 2 );
		}
	},
    quartic: {
        in: function ( k ) { return k * k * k * k; },
        out: function ( k ) { return 1 - ( --k * k * k * k ); },
        inOut: function ( k ) {
            if ( ( k *= 2 ) < 1) return 0.5 * k * k * k * k;
            return - 0.5 * ( ( k -= 2 ) * k * k * k - 2 );
        }
    },
    quintic: {
        in: function ( k ) { return k * k * k * k * k; },
        out: function ( k ) { return --k * k * k * k * k + 1; },
        inOut: function ( k ) {
            if ( ( k *= 2 ) < 1 ) return 0.5 * k * k * k * k * k;
            return 0.5 * ( ( k -= 2 ) * k * k * k * k + 2 );
        }
    },
    sinusoidal: {
		in: function ( k ) { return 1 - Math.cos( k * Math.PI / 2 ); },
		out: function ( k ) { return Math.sin( k * Math.PI / 2 ); },
		inOut: function ( k ) { return 0.5 * ( 1 - Math.cos( Math.PI * k ) ); }
	},
    exponential: {
        in: function(k) { return k === 0 ? 0 : Math.pow(1024, k - 1); },
        out: function(k) { return k === 1 ? 1 : 1 - Math.pow(2, -10 * k); },
        inOut: function(k) {
            if (k === 0) return 0;
            if (k === 1) return 1;
            if ((k *= 2) < 1) return 0.5 * Math.pow(1024, k - 1);
            return 0.5 * (-Math.pow(2, -10 * (k - 1)) + 2);
        }
    },
    circular: {
        in: function(k) { return 1 - Math.sqrt(1 - k * k); },
        out: function(k) { return Math.sqrt(1 - (--k * k)); },
        inOut: function(k) {
            if ((k *= 2) < 1) return -0.5 * (Math.sqrt(1 - k * k) - 1);
            return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1);
        }
    },
    elastic: {
        in: function(k) {
            let s, a = 0.1, p = 0.4;
            if (k === 0) return 0;
            if (k === 1) return 1;
            if (!a || a < 1) { a = 1; s = p / 4; }
            else s = p * Math.asin(1 / a) / (2 * Math.PI);
            return -(a * Math.pow(2, 10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p));
        },
        out: function(k) {
            let s, a = 0.1, p = 0.4;
            if (k === 0) return 0;
            if (k === 1) return 1;
            if (!a || a < 1) { a = 1; s = p / 4; }
            else s = p * Math.asin(1 / a) / (2 * Math.PI);
            return (a * Math.pow(2, -10 * k) * Math.sin((k - s) * (2 * Math.PI) / p) + 1);
        },
        inOut: function(k) {
            let s, a = 0.1, p = 0.4;
            if (k === 0) return 0;
            if (k === 1) return 1;
            if (!a || a < 1) { a = 1; s = p / 4; }
            else s = p * Math.asin(1 / a) / (2 * Math.PI);
            if ((k *= 2) < 1) return -0.5 * (a * Math.pow(2, 10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p));
            return a * Math.pow(2, -10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p) * 0.5 + 1;
        }
    },
    back: {
        in: function(k) {
            const s = 1.70158;
            return k * k * ((s + 1) * k - s);
        },
        out: function(k) {
            const s = 1.70158;
            return --k * k * ((s + 1) * k + s) + 1;
        },
        inOut: function(k) {
            const s = 1.70158 * 1.525;
            if ((k *= 2) < 1) return 0.5 * (k * k * ((s + 1) * k - s));
            return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);
        }
    },
    bounce: {
        in: function(k) { return 1 - Tween.easingFunction.bounce.out(1 - k); },
        out: function(k) {
            if (k < (1 / 2.75)) {
                return 7.5625 * k * k;
            } else if (k < (2 / 2.75)) {
                return 7.5625 * (k -= (1.5 / 2.75)) * k + 0.75;
            } else if (k < (2.5 / 2.75)) {
                return 7.5625 * (k -= (2.25 / 2.75)) * k + 0.9375;
            } else {
                return 7.5625 * (k -= (2.625 / 2.75)) * k + 0.984375;
            }
        },
        inOut: function(k) {
            if (k < 0.5) return Tween.easingFunction.bounce.in(k * 2) * 0.5;
            return Tween.easingFunction.bounce.out(k * 2 - 1) * 0.5 + 0.5;
        }
    }
};
