export class VTween {
    /** @private */ _valuesStart = {};
    /** @private */ _valuesEnd = {};
    /** @private */ _duration = 1000;
    /** @private */ _delayTime = 0;
    /** @private */ _startTime = 0;
    /** @private */ _easingFunction = VTween.Easing.Linear.None;
    /** @private */ _onUpdateCallback = null;
    /** @private */ _onCompleteCallback = null;
    /** @private */ _isPlaying = false;
    /** @private */ _isFinished = false;

    constructor(initialValues) {
        this._valuesStart = { ...initialValues };
    }

    to(properties, duration) {
        this._valuesEnd = properties;
        if (duration !== undefined) {
            this._duration = duration * 1000; // seconds to ms
        }
        return this;
    }

    delay(amount) {
        this._delayTime = amount * 1000; // seconds to ms
        return this;
    }

    easing(easingFunction) {
        this._easingFunction = easingFunction;
        return this;
    }

    onUpdate(callback) {
        this._onUpdateCallback = callback;
        return this;
    }

    onComplete(callback) {
        this._onCompleteCallback = callback;
        return this;
    }

    start() {
        if (this._isPlaying) {
            return;
        }

        this._isPlaying = true;
        this._isFinished = false;
        this._startTime = Date.now() + this._delayTime;
        
        return this;
    }

    stop() {
        this._isPlaying = false;
        this._isFinished = true;
        return this;
    }

    tick(timeDelta) {
        if (!this._isPlaying) {
            return;
        }

        const now = Date.now();
        if (now < this._startTime) {
            return;
        }
        
        let elapsed = (now - this._startTime) / this._duration;
        elapsed = elapsed > 1 ? 1 : elapsed;
        
        const value = this._easingFunction(elapsed);

        const newValues = {};
        for (const property in this._valuesEnd) {
            const start = this._valuesStart[property];
            const end = this._valuesEnd[property];
            newValues[property] = start + (end - start) * value;
        }
        
        if (this._onUpdateCallback !== null) {
            this._onUpdateCallback(newValues);
        }

        if (elapsed === 1) {
            this._isPlaying = false;
            this._isFinished = true;
            if (this._onCompleteCallback !== null) {
                this._onCompleteCallback();
            }
        }
    }
    
    isFinished() {
        return this._isFinished;
    }
}

VTween.Easing = {
    Linear: {
        None: function(k) { return k; }
    },
    Quadratic: {
        In: function(k) { return k * k; },
        Out: function(k) { return k * (2 - k); },
        InOut: function(k) {
            if ((k *= 2) < 1) { return 0.5 * k * k; }
            return -0.5 * (--k * (k - 2) - 1);
        }
    },
    Cubic: {
		In: function ( k ) { return k * k * k; },
		Out: function ( k ) { return --k * k * k + 1; },
		InOut: function ( k ) {
			if ( ( k *= 2 ) < 1 ) return 0.5 * k * k * k;
			return 0.5 * ( ( k -= 2 ) * k * k + 2 );
		}
	},
    Quartic: {
        In: function ( k ) { return k * k * k * k; },
        Out: function ( k ) { return 1 - ( --k * k * k * k ); },
        InOut: function ( k ) {
            if ( ( k *= 2 ) < 1) return 0.5 * k * k * k * k;
            return - 0.5 * ( ( k -= 2 ) * k * k * k - 2 );
        }
    },
    Quintic: {
        In: function ( k ) { return k * k * k * k * k; },
        Out: function ( k ) { return --k * k * k * k * k + 1; },
        InOut: function ( k ) {
            if ( ( k *= 2 ) < 1 ) return 0.5 * k * k * k * k * k;
            return 0.5 * ( ( k -= 2 ) * k * k * k * k + 2 );
        }
    },
    Sinusoidal: {
		In: function ( k ) { return 1 - Math.cos( k * Math.PI / 2 ); },
		Out: function ( k ) { return Math.sin( k * Math.PI / 2 ); },
		InOut: function ( k ) { return 0.5 * ( 1 - Math.cos( Math.PI * k ) ); }
	},
    Exponential: {
        In: function(k) { return k === 0 ? 0 : Math.pow(1024, k - 1); },
        Out: function(k) { return k === 1 ? 1 : 1 - Math.pow(2, -10 * k); },
        InOut: function(k) {
            if (k === 0) return 0;
            if (k === 1) return 1;
            if ((k *= 2) < 1) return 0.5 * Math.pow(1024, k - 1);
            return 0.5 * (-Math.pow(2, -10 * (k - 1)) + 2);
        }
    },
    Circular: {
        In: function(k) { return 1 - Math.sqrt(1 - k * k); },
        Out: function(k) { return Math.sqrt(1 - (--k * k)); },
        InOut: function(k) {
            if ((k *= 2) < 1) return -0.5 * (Math.sqrt(1 - k * k) - 1);
            return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1);
        }
    },
    Elastic: {
        In: function(k) {
            let s, a = 0.1, p = 0.4;
            if (k === 0) return 0;
            if (k === 1) return 1;
            if (!a || a < 1) { a = 1; s = p / 4; }
            else s = p * Math.asin(1 / a) / (2 * Math.PI);
            return -(a * Math.pow(2, 10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p));
        },
        Out: function(k) {
            let s, a = 0.1, p = 0.4;
            if (k === 0) return 0;
            if (k === 1) return 1;
            if (!a || a < 1) { a = 1; s = p / 4; }
            else s = p * Math.asin(1 / a) / (2 * Math.PI);
            return (a * Math.pow(2, -10 * k) * Math.sin((k - s) * (2 * Math.PI) / p) + 1);
        },
        InOut: function(k) {
            let s, a = 0.1, p = 0.4;
            if (k === 0) return 0;
            if (k === 1) return 1;
            if (!a || a < 1) { a = 1; s = p / 4; }
            else s = p * Math.asin(1 / a) / (2 * Math.PI);
            if ((k *= 2) < 1) return -0.5 * (a * Math.pow(2, 10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p));
            return a * Math.pow(2, -10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p) * 0.5 + 1;
        }
    },
    Back: {
        In: function(k) {
            const s = 1.70158;
            return k * k * ((s + 1) * k - s);
        },
        Out: function(k) {
            const s = 1.70158;
            return --k * k * ((s + 1) * k + s) + 1;
        },
        InOut: function(k) {
            const s = 1.70158 * 1.525;
            if ((k *= 2) < 1) return 0.5 * (k * k * ((s + 1) * k - s));
            return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);
        }
    },
    Bounce: {
        In: function(k) { return 1 - VTween.Easing.Bounce.Out(1 - k); },
        Out: function(k) {
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
        InOut: function(k) {
            if (k < 0.5) return VTween.Easing.Bounce.In(k * 2) * 0.5;
            return VTween.Easing.Bounce.Out(k * 2 - 1) * 0.5 + 0.5;
        }
    }
};
