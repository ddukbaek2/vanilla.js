//==============================================================================
// 포함 모듈 목록.
//==============================================================================
// 옮긴 원문: tween.js 와 Robert Penner 의 이징 식에서 옮김, MIT 와 BSD-3-Clause, THIRD_PARTY_LICENSES.md
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
	localPosition: "localPosition", // 로컬 위치. (Vector2, setLocalPosition)
	localScale: "localScale", // 로컬 크기 배율. (Vector2, setLocalScale)
	localRotation: "localRotation", // 로컬 회전. (숫자, 도, setLocalRotation)
	localOpacity: "localOpacity", // 로컬 불투명도. (숫자, 0 ~ 1, setLocalOpacity)
	contentSize: "contentSize", // 내용 크기. (Vector2, 픽셀, setContentSize)
});


//==============================================================================
// 노드에 트윈 속성 값 쓰기. (노드 속성 이름이 아니면 아무것도 하지 않는다)
//==============================================================================
/**
 * @param { WorldNode } node 값을 쓸 노드.
 * @param { string } tweenProperty TweenProperty 의 값.
 * @param { number | Vector2 } value 쓸 값. (Vector2 속성에 숫자를 주면 두 축에 같이 쓴다, 숫자 속성에 Vector2 를 주면 쓰지 않는다)
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
/**
 * @example <caption>값 두 개를 0.5 초 동안 바꾸기</caption>
 * import { Tween } from "./build/vanilla.js";
 *
 * const tween = new Tween({ x: 0, alpha: 1 });
 * tween.to({ x: 100, alpha: 0 }, 0.5);
 * tween.easing(Tween.easingFunction.quadratic.easeOut);
 * tween.setUpdate((values) => {
 * 	console.log(values.x, values.alpha);
 * });
 * tween.setComplete(() => {
 * 	console.log("complete");
 * });
 * tween.start();
 * for (let step = 0; step < 5; ++step) {
 * 	tween.tick(0.1);
 * }
 * console.log(tween.isFinished());
 */
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
	 * @param { Object } initialValues 시작 값 객체. (이름마다 숫자나 Vector2, 얕게 복사해 둔다)
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
	 * @param { WorldNode } node 움직일 노드.
	 * @param { string } tweenProperty TweenProperty 의 값.
	 * @param { number | Vector2 } startValue 시작 값.
	 * @param { number | Vector2 } endValue 목표 값.
	 * @param { number } duration 걸리는 시간. (초, 0 이하이면 바로 끝)
	 * @returns { Tween } 만든 트윈. (아직 돌지 않는다, Scene.startTween 이나 start 로 시작한다)
	 * @example <caption>씬에서 노드 위치를 움직이기</caption>
	 * import { Engine, EngineConfiguration, Scene, WorldNode, Tween, TweenProperty, Vector2 } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	initialize(engine) {
	 * 		super.initialize(engine);
	 * 		const node = new WorldNode();
	 * 		const root = this.getRoot();
	 * 		root.addChild(node);
	 * 		const tween = Tween.createNodeTween(node, TweenProperty.localPosition, Vector2.create(0, 0), Vector2.create(200, 100), 0.5);
	 * 		tween.easing(Tween.easingFunction.cubic.easeInOut);
	 * 		tween.setComplete(() => {
	 * 			const localPosition = node.getLocalPosition();
	 * 			console.log(localPosition.x, localPosition.y);
	 * 		});
	 * 		this.startTween(tween);
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
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
	 * @param { Node } node 시작 노드.
	 * @returns { Node } 부모를 끝까지 따라 올라간 노드. (부모가 없으면 그 노드)
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
	 * @param { number } timeDelta 지난 시간. (초, 시작했고 끝나지 않았을 때만 넘긴다)
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
	 * @param { System.Object } properties 목표 값 객체. (시작 값에 같은 이름이 있고 꼴이 같은 것만 바뀐다, 숫자끼리나 Vector2 끼리)
	 * @param { number } duration 걸리는 시간. (초, 주지 않으면 그대로, 기본 1)
	 * @returns { Tween } 이 트윈. (이어 부르기)
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
	 * @param { number } amount 시작 전 대기 시간. (초)
	 * @returns { Tween } 이 트윈. (이어 부르기)
	 */
    delay(amount) {
        this.#delay = amount;
        return this;
    }

	//==============================================================================
	// 트윈 함수 설정.
	//==============================================================================
	/**
	 * @param { Function } easingFunction 진행률(0 ~ 1)을 받아 바뀐 진행률을 돌려주는 함수. (Tween.easingFunction 의 것, 기본 linear)
	 * @returns { Tween } 이 트윈. (이어 부르기)
	 */
    easing(easingFunction) {
        this.#easingFunction = easingFunction;
        return this;
    }

	//==============================================================================
	// 갱신 콜백 설정.
	//==============================================================================
	/**
	 * @param { Function } callback tick 마다 이번 값 객체를 받는 함수. (대기 시간 동안은 부르지 않는다)
	 * @returns { Tween } 이 트윈. (이어 부르기)
	 */
    setUpdate(callback) {
        this.#tickCallback = callback;
        return this;
    }

	//==============================================================================
	// 완료 콜백 설정.
	//==============================================================================
	/**
	 * @param { Function } callback 진행률이 1 에 닿으면 한 번 부를 함수. (인자 없음, 대상 노드가 떨어져 끝날 때는 부르지 않는다)
	 * @returns { Tween } 이 트윈. (이어 부르기)
	 */
    setComplete(callback) {
        this.#completeCallback = callback;
        return this;
    }

	//==============================================================================
	// 대상 노드 설정. (값 이름이 TweenProperty 이름이면 이 노드에 쓴다)
	//==============================================================================
	/**
	 * @param { WorldNode | null } node 대상 노드. (null 이면 노드에 쓰지 않고 콜백으로만 값을 준다)
	 * @returns { Tween } 이 트윈. (이어 부르기)
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
	 * @returns { WorldNode | null } 대상 노드. (없으면 null)
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
	 * @returns { boolean } 끝났으면 참. (stop 을 불렀거나 진행률이 1 에 닿았을 때)
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
        easeIn: function(k) { return k * k; },
        easeOut: function(k) { return k * (2 - k); },
        easeInOut: function(k) {
            if ((k *= 2) < 1) { return 0.5 * k * k; }
            return -0.5 * (--k * (k - 2) - 1);
        }
    },
    cubic: {
		easeIn: function ( k ) { return k * k * k; },
		easeOut: function ( k ) { return --k * k * k + 1; },
		easeInOut: function ( k ) {
			if ( ( k *= 2 ) < 1 ) return 0.5 * k * k * k;
			return 0.5 * ( ( k -= 2 ) * k * k + 2 );
		}
	},
    quartic: {
        easeIn: function ( k ) { return k * k * k * k; },
        easeOut: function ( k ) { return 1 - ( --k * k * k * k ); },
        easeInOut: function ( k ) {
            if ( ( k *= 2 ) < 1) return 0.5 * k * k * k * k;
            return - 0.5 * ( ( k -= 2 ) * k * k * k - 2 );
        }
    },
    quintic: {
        easeIn: function ( k ) { return k * k * k * k * k; },
        easeOut: function ( k ) { return --k * k * k * k * k + 1; },
        easeInOut: function ( k ) {
            if ( ( k *= 2 ) < 1 ) return 0.5 * k * k * k * k * k;
            return 0.5 * ( ( k -= 2 ) * k * k * k * k + 2 );
        }
    },
    sinusoidal: {
		easeIn: function ( k ) { return 1 - Math.cos( k * Math.PI / 2 ); },
		easeOut: function ( k ) { return Math.sin( k * Math.PI / 2 ); },
		easeInOut: function ( k ) { return 0.5 * ( 1 - Math.cos( Math.PI * k ) ); }
	},
    exponential: {
        easeIn: function(k) { return k === 0 ? 0 : Math.pow(1024, k - 1); },
        easeOut: function(k) { return k === 1 ? 1 : 1 - Math.pow(2, -10 * k); },
        easeInOut: function(k) {
            if (k === 0) return 0;
            if (k === 1) return 1;
            if ((k *= 2) < 1) return 0.5 * Math.pow(1024, k - 1);
            return 0.5 * (-Math.pow(2, -10 * (k - 1)) + 2);
        }
    },
    circular: {
        easeIn: function(k) { return 1 - Math.sqrt(1 - k * k); },
        easeOut: function(k) { return Math.sqrt(1 - (--k * k)); },
        easeInOut: function(k) {
            if ((k *= 2) < 1) return -0.5 * (Math.sqrt(1 - k * k) - 1);
            return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1);
        }
    },
    elastic: {
        easeIn: function(k) {
            let s, a = 0.1, p = 0.4;
            if (k === 0) return 0;
            if (k === 1) return 1;
            if (!a || a < 1) { a = 1; s = p / 4; }
            else s = p * Math.asin(1 / a) / (2 * Math.PI);
            return -(a * Math.pow(2, 10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p));
        },
        easeOut: function(k) {
            let s, a = 0.1, p = 0.4;
            if (k === 0) return 0;
            if (k === 1) return 1;
            if (!a || a < 1) { a = 1; s = p / 4; }
            else s = p * Math.asin(1 / a) / (2 * Math.PI);
            return (a * Math.pow(2, -10 * k) * Math.sin((k - s) * (2 * Math.PI) / p) + 1);
        },
        easeInOut: function(k) {
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
        easeIn: function(k) {
            const s = 1.70158;
            return k * k * ((s + 1) * k - s);
        },
        easeOut: function(k) {
            const s = 1.70158;
            return --k * k * ((s + 1) * k + s) + 1;
        },
        easeInOut: function(k) {
            const s = 1.70158 * 1.525;
            if ((k *= 2) < 1) return 0.5 * (k * k * ((s + 1) * k - s));
            return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);
        }
    },
    bounce: {
        easeIn: function(k) { return 1 - Tween.easingFunction.bounce.easeOut(1 - k); },
        easeOut: function(k) {
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
        easeInOut: function(k) {
            if (k < 0.5) return Tween.easingFunction.bounce.easeIn(k * 2) * 0.5;
            return Tween.easingFunction.bounce.easeOut(k * 2 - 1) * 0.5 + 0.5;
        }
    }
};
