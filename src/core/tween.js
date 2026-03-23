//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VObject } from "../base/object.js";
import * as VMath from "../base/math.js";
import { VVector2 } from "../base/vector2.js";


//==============================================================================
// 트윈.
//==============================================================================
export class VTween extends VObject {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
    /** @private @type { Object } */ #valuesStart;
    /** @private @type { Object } */ #valuesEnd;
    /** @private @type { number } */ #duration;
    /** @private @type { number } */ #delay;
    /** @private @type { number } */ #elapsedTime;
    /** @private @type { Function } */ #easingFunction;
    /** @private @type { Function } */ #tickCallback;
    /** @private @type { Function } */ #completeCallback;
    /** @private @type { boolean } */ #isPlaying;
    /** @private @type { boolean } */ #isFinished;

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
		this.#easingFunction = VTween.easingFunction.linear;
		this.#tickCallback = null;
		this.#completeCallback = null;
		this.#isPlaying = false;
		this.#isFinished = false;
    }

	//==============================================================================
	// 목표값 설정.
	//==============================================================================
	/**
	 * @param { Object } properties
	 * @param { number } duration 
	 * @returns { VTween }
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
	 * @returns { VTween }
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
	 * @returns { VTween }
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
	 * @returns { VTween }
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
	 * @returns { VTween }
	 */
    setComplete(callback) {
        this.#completeCallback = callback;
        return this;
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
    }

	//==============================================================================
	// 정지.
	//==============================================================================
    stop() {
        this.#isPlaying = false;
        this.#isFinished = true;
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

        this.#elapsedTime += timeDelta;
        if (this.#elapsedTime < this.#delay) {
            return;
        }

        let progress = (this.#elapsedTime - this.#delay) / this.#duration;
        progress = VMath.clamp(progress, 0, 1);
        
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
            else if (startValue instanceof VVector2 && endValue instanceof VVector2) {
                newValues[key] = VVector2.lerp(startValue, endValue, easedProgress);
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
VTween.easingFunction = {
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
		in: function ( k ) { return 1 - Math.cos( k * VMath.PI / 2 ); },
		out: function ( k ) { return VMath.sin( k * VMath.PI / 2 ); },
		inOut: function ( k ) { return 0.5 * ( 1 - VMath.cos( VMath.PI * k ) ); }
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
        in: function(k) { return 1 - VMath.sqrt(1 - k * k); },
        out: function(k) { return VMath.sqrt(1 - (--k * k)); },
        inOut: function(k) {
            if ((k *= 2) < 1) return -0.5 * (VMath.sqrt(1 - k * k) - 1);
            return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1);
        }
    },
    elastic: {
        in: function(k) {
            let s, a = 0.1, p = 0.4;
            if (k === 0) return 0;
            if (k === 1) return 1;
            if (!a || a < 1) { a = 1; s = p / 4; }
            else s = p * Math.asin(1 / a) / (2 * VMath.PI);
            return -(a * Math.pow(2, 10 * (k -= 1)) * VMath.sin((k - s) * (2 * VMath.PI) / p));
        },
        out: function(k) {
            let s, a = 0.1, p = 0.4;
            if (k === 0) return 0;
            if (k === 1) return 1;
            if (!a || a < 1) { a = 1; s = p / 4; }
            else s = p * Math.asin(1 / a) / (2 * VMath.PI);
            return (a * Math.pow(2, -10 * k) * VMath.sin((k - s) * (2 * VMath.PI) / p) + 1);
        },
        inOut: function(k) {
            let s, a = 0.1, p = 0.4;
            if (k === 0) return 0;
            if (k === 1) return 1;
            if (!a || a < 1) { a = 1; s = p / 4; }
            else s = p * Math.asin(1 / a) / (2 * VMath.PI);
            if ((k *= 2) < 1) return -0.5 * (a * VMath.pow(2, 10 * (k -= 1)) * VMath.sin((k - s) * (2 * VMath.PI) / p));
            return a * Math.pow(2, -10 * (k -= 1)) * VMath.sin((k - s) * (2 * VMath.PI) / p) * 0.5 + 1;
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
        in: function(k) { return 1 - VTween.easingFunction.bounce.out(1 - k); },
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
            if (k < 0.5) return VTween.easingFunction.bounce.in(k * 2) * 0.5;
            return VTween.easingFunction.bounce.out(k * 2 - 1) * 0.5 + 0.5;
        }
    }
};
