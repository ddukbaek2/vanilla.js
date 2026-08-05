var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/base/wait.js
var wait_exports = {};
__export(wait_exports, {
  nextFrame: () => nextFrame,
  seconds: () => seconds
});
var System = globalThis;
async function seconds(seconds2) {
  const promise = new System.Promise((resolve) => System.setTimeout(resolve, seconds2 * 1e3));
  await promise;
}
__name(seconds, "seconds");
async function nextFrame() {
  new Promise((resolve) => System.window.requestAnimationFrame(resolve));
}
__name(nextFrame, "nextFrame");

// src/base/math.js
var math_exports = {};
__export(math_exports, {
  NegativeInfinity: () => NegativeInfinity,
  PI: () => PI,
  PositiveInfinity: () => PositiveInfinity,
  abs: () => abs,
  acos: () => acos,
  asin: () => asin,
  ceil: () => ceil,
  clamp: () => clamp,
  clamp01: () => clamp01,
  cos: () => cos,
  degreeToRadian: () => degreeToRadian,
  floor: () => floor,
  lerp: () => lerp,
  max: () => max,
  min: () => min,
  pow: () => pow,
  radianToDegree: () => radianToDegree,
  random: () => random,
  round: () => round,
  sin: () => sin,
  sqrt: () => sqrt,
  tan: () => tan
});
var System2 = globalThis;
var PI = 3.141592653589793;
var PositiveInfinity = Infinity;
var NegativeInfinity = -Infinity;
function min(left, right) {
  return left < right ? left : right;
}
__name(min, "min");
function max(left, right) {
  return left > right ? left : right;
}
__name(max, "max");
function clamp(value, minValue, maxValue) {
  return max(minValue, min(maxValue, value));
}
__name(clamp, "clamp");
function clamp01(value) {
  return max(0, min(1, value));
}
__name(clamp01, "clamp01");
function lerp(source, destination, normalizedTime) {
  return source * (1 - normalizedTime) + destination * normalizedTime;
}
__name(lerp, "lerp");
function random() {
  return System2.Math.random();
}
__name(random, "random");
function floor(value) {
  const r = value % 1;
  return value < 0 && r !== 0 ? value - r - 1 : value - r;
}
__name(floor, "floor");
function ceil(value) {
  const r = value % 1;
  return value > 0 && r !== 0 ? value - r + 1 : value - r;
}
__name(ceil, "ceil");
function round(value) {
  const r = value % 1;
  if (value >= 0) {
    return r >= 0.5 ? value - r + 1 : value - r;
  } else {
    return r < -0.5 ? value - r - 1 : value - r;
  }
}
__name(round, "round");
function sqrt(value) {
  if (value < 0) {
    return NaN;
  }
  if (value === 0) {
    return 0;
  }
  let result = value > 1 ? value : 1;
  for (let i = 0; i < 10; ++i) {
    result = (result + value / result) / 2;
  }
  return result;
}
__name(sqrt, "sqrt");
function abs(value) {
  if (value < 0) {
    return -value;
  }
  return value;
}
__name(abs, "abs");
function sin(value) {
  let val = value % (2 * PI);
  if (val > PI) val -= 2 * PI;
  if (val < -PI) val += 2 * PI;
  let result = 0;
  let term = val;
  for (let i = 1; i <= 10; ++i) {
    result += term;
    term *= -val * val / (2 * i * (2 * i + 1));
  }
  return result;
}
__name(sin, "sin");
function cos(value) {
  let val = value % (2 * PI);
  if (val > PI) val -= 2 * PI;
  if (val < -PI) val += 2 * PI;
  let result = 0;
  let term = 1;
  for (let i = 1; i <= 10; ++i) {
    result += term;
    term *= -val * val / ((2 * i - 1) * 2 * i);
  }
  return result;
}
__name(cos, "cos");
function tan(value) {
  const result = sin(value) / cos(value);
  return result;
}
__name(tan, "tan");
function asin(value) {
  if (value < -1 || value > 1) return NaN;
  if (value === 1) return PI / 2;
  if (value === -1) return -PI / 2;
  let result = value;
  let term = value;
  for (let i = 1; i < 100; i++) {
    term *= value * value * (2 * i - 1) * (2 * i - 1) / (2 * i * (2 * i + 1));
    result += term;
    if (abs(term) < 1e-15) break;
  }
  return result;
}
__name(asin, "asin");
function acos(value) {
  if (value < -1 || value > 1) return NaN;
  return PI / 2 - asin(value);
}
__name(acos, "acos");
function pow(base, exponent) {
  if (exponent === 0) return 1;
  if (exponent < 0) return 1 / pow(base, -exponent);
  let result = 1;
  let currentBase = base;
  let currentExponent = exponent;
  while (currentExponent > 0) {
    if (currentExponent % 2 === 1) {
      result *= currentBase;
    }
    currentBase *= currentBase;
    currentExponent = floor(currentExponent / 2);
  }
  return result;
}
__name(pow, "pow");
function degreeToRadian(degree) {
  const radian = degree * (PI / 180);
  return radian;
}
__name(degreeToRadian, "degreeToRadian");
function radianToDegree(radian) {
  const degree = radian / (PI / 180);
  return degree;
}
__name(radianToDegree, "radianToDegree");

// src/base/reflection.js
var reflection_exports = {};
__export(reflection_exports, {
  clone: () => clone,
  createGUID: () => createGUID,
  isArrayType: () => isArrayType,
  isChildren: () => isChildren,
  isClassInstance: () => isClassInstance,
  isFunctionType: () => isFunctionType,
  isParent: () => isParent,
  isPrimitiveType: () => isPrimitiveType,
  isReferenceType: () => isReferenceType,
  isType: () => isType,
  isValidate: () => isValidate,
  structuredClone: () => structuredClone
});
var System3 = globalThis;
function isValidate(target) {
  if (target === void 0 || target === null) {
    return false;
  }
  return true;
}
__name(isValidate, "isValidate");
function clone(target) {
  if (!isValidate(target) || typeof target !== "object") {
    throw new System3.Error();
  }
  const obj = new target.constructor();
  System3.Object.assign(obj, target);
  let currentProto = System3.Object.getPrototypeOf(target);
  while (currentProto && currentProto !== System3.Object.prototype) {
    const props = System3.Object.getOwnPropertyNames(currentProto);
    for (const prop of props) {
      if (prop !== "constructor") {
        const descriptor = System3.Object.getOwnPropertyDescriptor(currentProto, prop);
        if (descriptor && descriptor.get && descriptor.set) {
          obj[prop] = target[prop];
        }
      }
    }
    currentProto = System3.Object.getPrototypeOf(currentProto);
  }
  return obj;
}
__name(clone, "clone");
function structuredClone(target) {
  if (!isValidate(target) || typeof target !== "object")
    throw new System3.Error();
  const obj = new target.constructor();
  const deepCopy = /* @__PURE__ */ __name((destination, source) => {
    for (const name in source) {
      if (!System3.Object.prototype.hasOwnProperty.call(source, name))
        continue;
      const value = source[name];
      if (System3.Array.isArray(value)) {
        destination[name] = [];
        deepCopy(destination[name], value);
      } else if (value !== null && typeof value === "object" && value.constructor === System3.Object) {
        destination[name] = {};
        deepCopy(destination[name], value);
      } else {
        destination[name] = value;
      }
    }
    let currentProto = System3.Object.getPrototypeOf(source);
    while (currentProto && currentProto !== System3.Object.prototype) {
      const props = System3.Object.getOwnPropertyNames(currentProto);
      for (const prop of props) {
        if (prop !== "constructor") {
          const descriptor = System3.Object.getOwnPropertyDescriptor(currentProto, prop);
          if (descriptor && descriptor.get && descriptor.set) {
            const value = source[prop];
            if (System3.Array.isArray(value)) {
              destination[prop] = [];
              deepCopy(destination[prop], value);
            } else if (value !== null && typeof value === "object" && value.constructor === System3.Object) {
              destination[prop] = {};
              deepCopy(destination[prop], value);
            } else {
              destination[prop] = value;
            }
          }
        }
      }
      currentProto = System3.Object.getPrototypeOf(currentProto);
    }
  }, "deepCopy");
  deepCopy(obj, target);
  return obj;
}
__name(structuredClone, "structuredClone");
function createGUID() {
  const ts = Date.now().toString(16).padStart(12, "0");
  const r = /* @__PURE__ */ __name(() => (Math.random() * 16 | 0).toString(16), "r");
  const y = /* @__PURE__ */ __name(() => (Math.random() * 4 | 8).toString(16), "y");
  return `${ts.slice(0, 8)}-${ts.slice(8, 12)}-4${r()}${r()}${r()}-${y()}${r()}${r()}${r()}-${r()}${r()}${r()}${r()}${r()}${r()}${r()}${r()}${r()}${r()}${r()}${r()}`;
}
__name(createGUID, "createGUID");
function isPrimitiveType(target) {
  if (target === null) {
    return true;
  }
  const typeText = typeof target;
  if (typeText === "object" || typeText === "function") {
    return false;
  }
  return true;
}
__name(isPrimitiveType, "isPrimitiveType");
function isReferenceType(target) {
  if (target === null) {
    return false;
  }
  const typeText = typeof target;
  if (typeText === "object" || typeText === "function") {
    return true;
  }
  return false;
}
__name(isReferenceType, "isReferenceType");
function isArrayType(target) {
  return System3.Array.isArray(target);
}
__name(isArrayType, "isArrayType");
function isFunctionType(target) {
  return typeof target === "function";
}
__name(isFunctionType, "isFunctionType");
function isType(target) {
  if (typeof target !== "function") {
    return false;
  }
  if (target.prototype === void 0 || target.prototype === null) {
    return false;
  }
  return true;
}
__name(isType, "isType");
function isClassInstance(target, type) {
  if (!isReferenceType(target)) {
    return false;
  }
  if (!isType(type)) {
    return false;
  }
  return target instanceof type;
}
__name(isClassInstance, "isClassInstance");
function isParent(parentType, targetType) {
  if (!isType(parentType) || !isType(targetType)) {
    return false;
  }
  if (parentType === targetType) {
    return false;
  }
  return targetType.prototype instanceof parentType;
}
__name(isParent, "isParent");
function isChildren(targetType, parentType) {
  if (!isType(targetType) || !isType(parentType)) {
    return false;
  }
  if (targetType === parentType) {
    return false;
  }
  return targetType.prototype instanceof parentType;
}
__name(isChildren, "isChildren");

// src/base/object.js
var Object2 = class {
  static {
    __name(this, "Object");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { string } */
  #instanceId;
  // 고유식별자.
  /** @private @type { boolean } */
  #isDestroyed;
  // 고유식별자.
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constant
   */
  constructor() {
    this.#instanceId = createGUID();
    this.#isDestroyed = false;
  }
  //==============================================================================
  // 파괴. (현재 객체의 멤버 변수 목록을 무효화)
  //==============================================================================
  /**
   * @virtual
   */
  destroy() {
    const isDestroyed = this.isDestroyed();
    if (isDestroyed) {
      return;
    }
  }
  //==============================================================================
  // 동등성 비교.
  //==============================================================================
  /**
   * @virtual
   * @param { any } other
   * @returns { boolean }
   */
  equals(other) {
    if (other === null) {
      return false;
    } else if (this === other) {
      return true;
    }
    return false;
  }
  //==============================================================================
  // 인스턴스 고유식별자 반환.
  //==============================================================================
  /**
   * @virtual
   * @returns { string }
   */
  getInstanceId() {
    return this.#instanceId;
  }
  //==============================================================================
  // 파괴 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isDestroyed() {
    return this.#isDestroyed;
  }
  //==============================================================================
  // 인스턴스 얕은 복제.
  //==============================================================================
  /**
   * @returns { this }
   */
  clone() {
    const obj = clone(this);
    return obj;
  }
  //==============================================================================
  // 인스턴스 깊은 복제.
  //==============================================================================
  /**
   * @returns { this }
   */
  structuredClone() {
    const obj = structuredClone(this);
    return obj;
  }
  // //==============================================================================
  // // 새 인스턴스 생성.
  // //==============================================================================
  // /**
  //  * @static
  //  * @returns { this }
  //  */
  // static create() {
  // 	return new this();
  // }
  //==============================================================================
  // 유효한 객체인지 여부 반환.
  //==============================================================================
  /**
   * @static
   * @returns { boolean }
   */
  static isValidate(target) {
    return isValidate(target);
  }
};

// src/base/color.js
var System4 = globalThis;
var Color = class _Color extends Object2 {
  static {
    __name(this, "Color");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { number } */
  #red;
  /** @private @type { number } */
  #green;
  /** @private @type { number } */
  #blue;
  /** @private @type { number } */
  #alpha;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   * @param { number } red
   * @param { number } green
   * @param { number } blue
   * @param { number } alpha
   */
  constructor(red = 1, green = 1, blue = 1, alpha = 1) {
    super();
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.alpha = alpha;
  }
  //==============================================================================
  // 적색 설정 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @param { number } value
   */
  set red(value) {
    this.#red = clamp(value, 0, 1);
  }
  //==============================================================================
  // 적색 반환 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @returns { number }
   */
  get red() {
    return this.#red;
  }
  //==============================================================================
  // 청색 설정 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @param { number } value
   */
  set blue(value) {
    this.#blue = clamp(value, 0, 1);
  }
  //==============================================================================
  // 청색 반환 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @returns { number }
   */
  get blue() {
    return this.#blue;
  }
  //==============================================================================
  // 녹색 설정 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @param { number } value
   */
  set green(value) {
    this.#green = clamp(value, 0, 1);
  }
  //==============================================================================
  // 녹색 반환 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @returns { number }
   */
  get green() {
    return this.#green;
  }
  //==============================================================================
  // 투명색 설정 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @param { number } value
   */
  set alpha(value) {
    this.#alpha = clamp(value, 0, 1);
  }
  //==============================================================================
  // 투명색 반환 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @returns { number }
   */
  get alpha() {
    return this.#alpha;
  }
  //==============================================================================
  // RGBA 문자열 반환 프로퍼티.
  // - rgba(255, 255, 255, 1.0)
  //==============================================================================
  /**
   * @returns { string }
   */
  toRGBAString() {
    const red = round(this.red * 255);
    const green = round(this.green * 255);
    const blue = round(this.blue * 255);
    if (this.alpha < 1) {
      const alpha = this.alpha;
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    } else {
      return `rgb(${red}, ${green}, ${blue})`;
    }
  }
  //==============================================================================
  // HEX 문자열 반환 프로퍼티.
  // - #ffffff
  // - #ffffffff
  //==============================================================================
  /**
   * @returns { string }
   */
  toHEXString() {
    const red = round(this.red * 255).toString(16).padStart(2, "0");
    const green = round(this.green * 255).toString(16).padStart(2, "0");
    const blue = round(this.blue * 255).toString(16).padStart(2, "0");
    if (this.alpha < 1) {
      const alpha = round(this.alpha * 255).toString(16).padStart(2, "0");
      return `#${red}${green}${blue}${alpha}`;
    } else {
      return `#${red}${green}${blue}`;
    }
  }
  //==============================================================================
  // 복제.
  //==============================================================================
  /**
   * @override
   * @returns { this }
   */
  clone() {
    const obj = super.clone();
    return obj;
  }
  //==============================================================================
  // 하얀색 생성.
  //==============================================================================
  /**
   * @returns { Color }
   */
  static white() {
    const color = new _Color(1, 1, 1, 1);
    return color;
  }
  //==============================================================================
  // 검은색 생성.
  //==============================================================================
  /**
   * @returns { Color }
   */
  static black() {
    const color = new _Color(0, 0, 0, 1);
    return color;
  }
  //==============================================================================
  // 투명색 생성.
  //==============================================================================
  /**
   * @returns { Color }
   */
  static transparent() {
    const color = new _Color(0, 0, 0, 0);
    return color;
  }
  //==============================================================================
  // 생성.
  // - #fff
  // - #ffff
  // - #ffffff
  // - #ffffffff
  //==============================================================================
  /**
   * @param { string } colorString 
   * @returns { Color }
   */
  static createFromHEX(colorString) {
    const color = new _Color(1, 1, 1, 1);
    colorString = colorString.trim().toLowerCase();
    if (colorString.startsWith("#")) {
      let hex = colorString.substring(1);
      if (hex.length === 3 || hex.length === 4) {
        hex = System4.Array.from(hex).map((char) => char + char).join("");
      }
      color.red = System4.Number.parseInt(hex.substring(0, 2), 16) / 255;
      color.green = System4.Number.parseInt(hex.substring(2, 4), 16) / 255;
      color.blue = System4.Number.parseInt(hex.substring(4, 6), 16) / 255;
      if (hex.length === 8) {
        color.alpha = System4.Number.parseInt(hex.substring(6, 8), 16) / 255;
      }
    }
    return color;
  }
  //==============================================================================
  // 랜덤 색상 생성. (알파값은 1)
  //==============================================================================
  /**
   * @returns { Color }
   */
  static random() {
    const color = new _Color(random(), random(), random(), 1);
    return color;
  }
  //==============================================================================
  // 생성.
  // - rgb(255, 255, 255)
  // - rgba(255, 255, 255, 1.0)
  //==============================================================================
  /**
   * @param { string } colorString 
   * @returns { Color }
   */
  static createFromRGBA(colorString) {
    const color = new _Color(1, 1, 1, 1);
    colorString = colorString.trim().toLowerCase();
    if (colorString.startsWith("rgb")) {
      const match = colorString.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
      if (match) {
        color.red = System4.Number.parseInt(match[1], 10) / 255;
        color.green = System4.Number.parseInt(match[2], 10) / 255;
        color.blue = System4.Number.parseInt(match[3], 10) / 255;
        if (match[4] !== void 0) {
          color.alpha = System4.Number.parseFloat(match[4]);
        }
      }
    }
    return color;
  }
};

// src/base/colors.js
var Colors = {
  /** @public @type { string } */
  black: "#000000",
  /** @public @type { string } */
  white: "#ffffff",
  /** @public @type { string } */
  vanilla: "#f3e5ab",
  /** @public @type { string } */
  darkVanilla: "#d1c1b2",
  /** @public @type { string } */
  lightVanilla: "#f1e9d8"
};

// src/base/vector2.js
var Vector2 = class _Vector2 extends Object2 {
  static {
    __name(this, "Vector2");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { number } */
  #x;
  /** @private @type { number } */
  #y;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.x = 0;
    this.y = 0;
  }
  //==============================================================================
  // 비교.
  //==============================================================================
  /**
   * @override
   * @param { any } other
   * @returns { boolean }
   */
  equals(other) {
    if (super.equals(other)) {
      return true;
    }
    if (other) {
      if (other instanceof _Vector2) {
        if (this.x === other.x && this.y === other.y) {
          return true;
        }
      }
    }
    return false;
  }
  //==============================================================================
  // 복제.
  //==============================================================================
  /**
   * @override
   * @returns { this }
   */
  clone() {
    const obj = (
      /** @type { this } */
      _Vector2.create(this.x, this.y)
    );
    return obj;
  }
  //==============================================================================
  // X 좌표 설정 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @param { number } value
   */
  set x(value) {
    this.#x = value;
  }
  //==============================================================================
  // X 좌표 반환 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @returns { number }
   */
  get x() {
    return this.#x;
  }
  //==============================================================================
  // Y 좌표 설정 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @param { number } value
   */
  set y(value) {
    this.#y = value;
  }
  //==============================================================================
  // Y 좌표 반환 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @returns { number }
   */
  get y() {
    return this.#y;
  }
  //==============================================================================
  // 대입.
  //==============================================================================
  /**
   * @param { number } x
   * @param { number } y
   */
  set(x, y) {
    this.x = x;
    this.y = y;
  }
  //==============================================================================
  // 가로축 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getX() {
    return this.x;
  }
  //==============================================================================
  // 세로축 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getY() {
    return this.y;
  }
  //==============================================================================
  // 길이.
  //==============================================================================
  /**
   * @returns { number }
   */
  length() {
    const length = sqrt(this.x * this.x + this.y * this.y);
    return length;
  }
  //==============================================================================
  // 정규화.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  normalize() {
    const origin = _Vector2.create(this.x, this.y);
    const length = this.length();
    if (length > 0) {
      origin.x /= length;
      origin.y /= length;
    }
    return origin;
  }
  //==============================================================================
  // 더하기.
  //==============================================================================
  /**
   * @param { Vector2 | number } other
   * @returns { Vector2 }
   */
  add(other) {
    const origin = this.clone();
    if (typeof other === "number") {
      origin.x += other;
      origin.y += other;
      return origin;
    } else if (other instanceof _Vector2) {
      origin.x += other.x;
      origin.y += other.y;
      return origin;
    }
    throw new Error('Invalid type: "other" must be a number or an instance of Vector2.');
  }
  //==============================================================================
  // 빼기.
  //==============================================================================
  /**
   * @param { Vector2 | number } other
   * @returns { Vector2 }
   */
  subtract(other) {
    const origin = this.clone();
    if (typeof other === "number") {
      origin.x -= other;
      origin.y -= other;
      return origin;
    } else if (other instanceof _Vector2) {
      origin.x -= other.x;
      origin.y -= other.y;
      return origin;
    }
    throw new Error('Invalid type: "other" must be a number or an instance of Vector2.');
  }
  //==============================================================================
  // 곱하기.
  //==============================================================================
  /**
   * @param { Vector2 | number } other
   * @returns { Vector2 }
   */
  multiply(other) {
    const origin = this.clone();
    if (typeof other === "number") {
      origin.x *= other;
      origin.y *= other;
      return origin;
    } else if (other instanceof _Vector2) {
      origin.x *= other.x;
      origin.y *= other.y;
      return origin;
    }
    throw new Error('Invalid type: "other" must be a number or an instance of Vector2.');
  }
  //==============================================================================
  // 나누기.
  //==============================================================================
  /**
   * @param { Vector2 | number } other
   * @returns { Vector2 }
   */
  divide(other) {
    const origin = this.clone();
    if (typeof other === "number") {
      origin.x /= other;
      origin.y /= other;
      return origin;
    } else if (other instanceof _Vector2) {
      origin.x /= other.x;
      origin.y /= other.y;
      return origin;
    }
    throw new Error('Invalid type: "other" must be a number or an instance of Vector2.');
  }
  //==============================================================================
  // 나머지.
  //==============================================================================
  /**
   * @param { Vector2 | number } other
   * @returns { Vector2 }
   */
  modulo(other) {
    const origin = this.clone();
    if (typeof other === "number") {
      origin.x /= other;
      origin.y /= other;
      return origin;
    } else if (other instanceof _Vector2) {
      origin.x /= other.x;
      origin.y /= other.y;
      return origin;
    }
    throw new Error('Invalid type: "other" must be a number or an instance of Vector2.');
  }
  //==============================================================================
  // 절반.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  half() {
    const obj = this.divide(0.5);
    return obj;
  }
  //==============================================================================
  // 내적.
  //==============================================================================
  /**
   * @param { Vector2 } other
   * @returns { number }
   */
  dot(other) {
    return this.x * other.x + this.y * other.y;
  }
  //==============================================================================
  // 외적 (2D cross product -> 스칼라 반환).
  //==============================================================================
  /**
   * @param { Vector2 } other
   * @returns { number }
   */
  cross(other) {
    return this.x * other.y - this.y * other.x;
  }
  //==============================================================================
  // 두 벡터 사이의 거리.
  //==============================================================================
  /**
   * @param { Vector2 } other
   * @returns { number }
   */
  distance(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return sqrt(dx * dx + dy * dy);
  }
  //==============================================================================
  // 길이의 제곱 (루트 연산 최적화).
  //==============================================================================
  /**
   * @returns { number }
   */
  lengthSquared() {
    return this.x * this.x + this.y * this.y;
  }
  //==============================================================================
  // 두 벡터 사이의 각도 반환 (라디안).
  //==============================================================================
  /**
   * @param { Vector2 } other
   * @returns { number }
   */
  angle(other) {
    return acos(this.dot(other) / (this.length() * other.length()));
  }
  //==============================================================================
  // 새로운 벡터 생성.
  //==============================================================================
  /**
   * @param { number } x
   * @param { number } y
   * @returns { Vector2 }
   */
  static create(x, y) {
    var obj = new _Vector2();
    obj.x = x;
    obj.y = y;
    return obj;
  }
  //==============================================================================
  // 0의 값을 가진 벡터 생성.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  static zero() {
    return _Vector2.create(0, 0);
  }
  //==============================================================================
  // 1의 값을 가진 벡터 생성.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  static one() {
    return _Vector2.create(1, 1);
  }
  //==============================================================================
  // -1의 값을 가진 벡터 생성.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  static minusOne() {
    return _Vector2.create(-1, -1);
  }
  //==============================================================================
  // 최대값 벡터 생성.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  static positiveInfinity() {
    return _Vector2.create(Infinity, Infinity);
  }
  //==============================================================================
  // 최소값 벡터 생성.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  static negativeInfinity() {
    return _Vector2.create(-Infinity, -Infinity);
  }
  //==============================================================================
  // 선형 보간.
  //==============================================================================
  /**
   * @param { Vector2 } from
   * @param { Vector2 } to
   * @param { number } normalizedTime
   * @returns { Vector2 }
   */
  static lerp(from, to, normalizedTime) {
    const x = lerp(from.x, to.x, normalizedTime);
    const y = lerp(from.y, to.y, normalizedTime);
    return _Vector2.create(x, y);
  }
  //==============================================================================
  // 범위 제한.
  //==============================================================================
  /**
   * @param { Vector2 } value
   * @param { Vector2 } min
   * @param { Vector2 } max
   * @returns { Vector2 }
   */
  static clamp(value, min2, max2) {
    const x = clamp(value.x, min2.x, max2.x);
    const y = clamp(value.y, min2.y, max2.y);
    return _Vector2.create(x, y);
  }
};

// src/base/pivot.js
var Pivot = {
  topLeft: Vector2.create(0, 0),
  topCenter: Vector2.create(0.5, 0),
  topRight: Vector2.create(1, 0),
  middleLeft: Vector2.create(0, 0.5),
  middleCenter: Vector2.create(0.5, 0.5),
  middleRight: Vector2.create(1, 0.5),
  bottomLeft: Vector2.create(0, 1),
  bottomCenter: Vector2.create(0.5, 1),
  bottomRight: Vector2.create(1, 1)
};

// src/base/rect.js
var Rect = class _Rect extends Object2 {
  static {
    __name(this, "Rect");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Vector2 } */
  #position;
  // 좌상.
  /** @private @type { Vector2 } */
  #size;
  // 좌상-우하.
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   * @param { Vector2 } position
   * @param { Vector2 } size
   */
  constructor() {
    super();
    this.position = Vector2.zero();
    this.size = Vector2.zero();
  }
  //==============================================================================
  // 동등성 비교.
  //==============================================================================
  /**
   * @param { any } other
   * @returns { boolean }
   */
  equals(other) {
    if (super.equals(other)) {
      return true;
    }
    if (other) {
      if (other instanceof _Rect) {
        if (this.position.equals(other.position) && this.size.equals(other.size)) {
          return true;
        }
      }
    }
    return false;
  }
  //==============================================================================
  // 복제.
  //==============================================================================
  /**
   * @override
   * @returns { this }
   */
  clone() {
    const obj = (
      /** @type { this } */
      _Rect.create(this.position.x, this.position.y, this.size.x, this.size.y)
    );
    return obj;
  }
  //==============================================================================
  // 위치 설정 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @param { Vector2 } value
   */
  set position(value) {
    this.#position = value.clone();
  }
  //==============================================================================
  // 위치 반환 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @returns { Vector2 }
   */
  get position() {
    return this.#position;
  }
  //==============================================================================
  // 크기 설정 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @param { Vector2 } value
   */
  set size(value) {
    this.#size = value.clone();
  }
  //==============================================================================
  // 크기 반환 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @returns { Vector2 }
   */
  get size() {
    return this.#size;
  }
  //==============================================================================
  // 겹치는지 여부.
  //==============================================================================
  /**
   * @param { Vector2 } value
   * @returns { boolean }
   */
  contains(value) {
    if (value !== null && value !== void 0 && value instanceof Vector2) {
      if (value.x < this.position.x || value.x > this.position.x + this.size.x)
        return false;
      if (value.y < this.position.y || value.y > this.position.y + this.size.y)
        return false;
      return true;
    }
    return false;
  }
  //==============================================================================
  // 겹치는지 여부.
  //==============================================================================
  /**
   * @param { Rect } value
   * @returns { boolean }
   */
  overlaps(value) {
    if (value !== null && value !== void 0 && value instanceof _Rect) {
      if (this.position.x + this.size.x < value.position.x || this.position.x > value.position.x + value.size.x)
        return false;
      if (this.position.y + this.size.y < value.position.y || this.position.y > value.position.y + value.size.y)
        return false;
      return true;
    }
    return false;
  }
  //==============================================================================
  // 가로 크기 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @param { number } value
   */
  set width(value) {
    this.size.x = value;
  }
  //==============================================================================
  // 가로 크기 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @returns { number }
   */
  get width() {
    return this.size.x;
  }
  //==============================================================================
  // 세로 크기 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @param { number } value
   */
  set height(value) {
    this.size.y = value;
  }
  //==============================================================================
  // 세로 크기 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @returns { number }
   */
  get height() {
    return this.size.y;
  }
  //==============================================================================
  // 최소 좌표 프로퍼티 (좌상단).
  //==============================================================================
  /**
   * @property
   * @param { Vector2 } value
   */
  set min(value) {
    const oldMax = this.max;
    this.position.x = value.x;
    this.position.y = value.y;
    this.size.x = oldMax.x - this.position.x;
    this.size.y = oldMax.y - this.position.y;
  }
  //==============================================================================
  // 최소 좌표 프로퍼티 (좌상단).
  //==============================================================================
  /**
   * @property
   * @returns { Vector2 }
   */
  get min() {
    return Vector2.create(this.position.x, this.position.y);
  }
  //==============================================================================
  // 최대 좌표 프로퍼티 (우하단).
  //==============================================================================
  /**
   * @property
   * @param { Vector2 } value
   */
  set max(value) {
    this.size.x = value.x - this.position.x;
    this.size.y = value.y - this.position.y;
  }
  //==============================================================================
  // 최대 좌표 프로퍼티 (우하단).
  //==============================================================================
  /**
   * @property
   * @returns { Vector2 }
   */
  get max() {
    return Vector2.create(this.position.x + this.size.x, this.position.y + this.size.y);
  }
  //==============================================================================
  // 교집합 (두 사각형이 겹치는 영역 반환).
  //==============================================================================
  /**
   * @param { Rect } other
   * @returns { Rect }
   */
  intersection(other) {
    if (!this.overlaps(other)) {
      return _Rect.zero();
    }
    const x1 = Math.max(this.position.x, other.position.x);
    const y1 = Math.max(this.position.y, other.position.y);
    const x2 = Math.min(this.max.x, other.max.x);
    const y2 = Math.min(this.max.y, other.max.y);
    return _Rect.create(x1, y1, x2 - x1, y2 - y1);
  }
  //==============================================================================
  // 합집합 (두 사각형을 모두 포함하는 최소 사각형 반환).
  //==============================================================================
  /**
   * @param { Rect } other
   * @returns { Rect }
   */
  union(other) {
    const x1 = Math.min(this.position.x, other.position.x);
    const y1 = Math.min(this.position.y, other.position.y);
    const x2 = Math.max(this.max.x, other.max.x);
    const y2 = Math.max(this.max.y, other.max.y);
    return _Rect.create(x1, y1, x2 - x1, y2 - y1);
  }
  //==============================================================================
  // 가운데 설정 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @param { Vector2 } value
   */
  set center(value) {
    this.position.x = value.x - this.width / 2;
    this.position.y = value.y - this.height / 2;
  }
  //==============================================================================
  // 가운데 반환 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @returns { Vector2 }
   */
  get center() {
    const origin = this.position.clone();
    origin.x += this.width / 2;
    origin.y += this.height / 2;
    return origin;
  }
  //==============================================================================
  // 왼쪽 설정 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @param { number } value
   */
  set left(value) {
    this.position.x = value;
  }
  //==============================================================================
  // 왼쪽 반환 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @returns { number }
   */
  get left() {
    return this.position.x;
  }
  //==============================================================================
  // 위쪽 설정 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @param { number } value
   */
  set top(value) {
    this.position.y = value;
  }
  //==============================================================================
  // 위쪽 반환 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @returns { number }
   */
  get top() {
    return this.position.y;
  }
  //==============================================================================
  // 오른쪽 설정 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @param { number } value
   */
  set right(value) {
    this.position.x = value - this.width;
  }
  //==============================================================================
  // 오른쪽 반환 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @returns { number }
   */
  get right() {
    return this.position.x + this.width;
  }
  //==============================================================================
  // 아래쪽 설정 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @param { number } value
   */
  set bottom(value) {
    this.position.y = value - this.height;
  }
  //==============================================================================
  // 아래쪽 반환 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @returns { number }
   */
  get bottom() {
    return this.position.y + this.height;
  }
  // //==============================================================================
  // // 새로운 사각 영역 생성.
  // //==============================================================================
  // /**
  //  * @param { Vector2 } position
  //  * @param { Vector2 } size
  //  * @returns { Rect }
  //  */
  // static create(position, size) {
  // 	var obj = new Rect();
  // 	obj.position = position;
  // 	obj.size = size;
  // 	return obj;
  // }
  //==============================================================================
  // 새로운 사각 영역 생성.
  //==============================================================================
  /**
   * @param { number } x
   * @param { number } y
   * @param { number } width
   * @param { number } height
   * @returns { Rect }
   */
  static create(x, y, width, height) {
    var obj = new _Rect();
    obj.position = Vector2.create(x, y);
    obj.size = Vector2.create(width, height);
    return obj;
  }
  //==============================================================================
  // 크기가 없는 빈 사각 영역 생성.
  //==============================================================================
  /**
   * @returns { Rect }
   */
  static zero() {
    return _Rect.create(0, 0, 0, 0);
  }
  //==============================================================================
  // 범위 제한.
  //==============================================================================
  /**
   * @param { Rect } value
   * @param { Rect } min
   * @param { Rect } max
   * @returns { Rect }
   */
  static clamp(value, min2, max2) {
    const position = Vector2.clamp(value.position, min2.position, max2.position);
    const size = Vector2.clamp(value.size, min2.size, max2.size);
    return _Rect.create(position.x, position.y, size.x, size.y);
  }
};

// src/base/obb.js
var System5 = globalThis;
var OBB = class _OBB extends Object2 {
  static {
    __name(this, "OBB");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @type { Vector2[] } */
  #edges;
  // 4개의 모서리.
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.#edges = [
      Vector2.zero(),
      Vector2.zero(),
      Vector2.zero(),
      Vector2.zero()
    ];
  }
  //==============================================================================
  // 좌표와 충돌 검출.
  //==============================================================================
  /**
   * @param { Vector2 } viewPosition
   * @returns { boolean }
   */
  contains(viewPosition) {
    if (!_OBB.isValidate(viewPosition)) {
      return false;
    } else if (viewPosition instanceof Vector2) {
      const edges = this.getEdges();
      let isInside = false;
      for (let i = 0, j = edges.length - 1; i < edges.length; j = i++) {
        const xi = edges[i].x;
        const yi = edges[i].y;
        const xj = edges[j].x;
        const yj = edges[j].y;
        const intersect = yi > viewPosition.y !== yj > viewPosition.y && viewPosition.x < (xj - xi) * (viewPosition.y - yi) / (yj - yi) + xi;
        if (intersect) {
          isInside = !isInside;
        }
      }
      return isInside;
    }
    return false;
  }
  //==============================================================================
  // 분리축 정리(SAT)를 이용한 다각형(OBB) 간의 충돌 검출.
  //==============================================================================
  /**
   * @param { OBB } other
   * @returns { boolean }
   */
  overlaps(other) {
    const edges = this.getEdges();
    const polygons = [edges, other.getEdges()];
    for (let i = 0; i < polygons.length; ++i) {
      const polygon = polygons[i];
      for (let j = 0; j < polygon.length; ++j) {
        const p1 = polygon[j];
        const p2 = polygon[(j + 1) % polygon.length];
        const edgeX = p2.x - p1.x;
        const edgeY = p2.y - p1.y;
        const axisX = -edgeY;
        const axisY = edgeX;
        let myMin = Infinity;
        let myMax = -Infinity;
        for (let k = 0; k < edges.length; ++k) {
          const projection = edges[k].x * axisX + edges[k].y * axisY;
          if (projection < myMin) myMin = projection;
          if (projection > myMax) myMax = projection;
        }
        let otherMin = Infinity;
        let otherMax = -Infinity;
        for (let k = 0; k < other.length; ++k) {
          const projection = other[k].x * axisX + other[k].y * axisY;
          if (projection < otherMin) otherMin = projection;
          if (projection > otherMax) otherMax = projection;
        }
        if (myMax < otherMin || otherMax < myMin) {
          return false;
        }
      }
    }
    return true;
  }
  //==============================================================================
  // 모서리 목록 설정.
  //==============================================================================
  /**
   * @returns { Vector2[] }
   */
  setEdges(edges) {
    if (!_OBB.isValidate(edges)) {
      throw new System5.Error(`edges is null.`);
    }
    if (!System5.Array.isArray(edges)) {
      throw new System5.Error(`edges is not Array.`);
    }
    if (this.#edges.length !== edges.length) {
      throw new System5.Error(`edges.length !== this.#edges.length.`);
    }
    for (let i = 0; i < this.#edges.length; ++i) {
      this.#edges[i] = edges[i];
    }
  }
  //==============================================================================
  // 모서리 목록 반환.
  //==============================================================================
  /**
   * @returns { Vector2[] }
   */
  getEdges() {
    return this.#edges;
  }
};

// src/base/platform.js
var System6 = globalThis;
var SYSTEM_FONT_STRING = '-apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
var PlatformType = {
  //System.Object.freeze({
  windows: "Windows",
  macOS: "macOS",
  android: "Android",
  steamDeck: "SteamDeck",
  // 스팀덱 추가
  iPadOS: "iPadOS",
  // iPadOS 추가
  iOS: "iOS",
  linux: "Linux",
  unknown: "Unknown"
};
var BrowserType = {
  //System.freeze({
  chrome: "Chrome",
  edge: "Edge",
  firefox: "Firefox",
  internetExplorer: "Internet Explorer",
  safari: "Safari",
  unknown: "Unknown"
};
var Platform = class extends Object2 {
  static {
    __name(this, "Platform");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @type { string } */
  platformName = PlatformType.unknown;
  /** @type { string } */
  browserName = BrowserType.unknown;
  /** @type { boolean } */
  isMobile = false;
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.platformName = PlatformType.unknown;
    this.browserName = BrowserType.unknown;
    this.isMobile = false;
  }
  //==============================================================================
  // 캔버스 생성 or 반환.
  //==============================================================================
  /**
   * @param { string } canvasId
   * @returns { HTMLCanvasElement }
   */
  getOrAddCanvas(canvasId) {
    let canvas = document.getElementById(canvasId);
    if (canvas === null || canvas === void 0) {
      canvas = document.createElement("canvas");
      canvas.id = canvasId;
      System6.document.body.appendChild(canvas);
    }
    return canvas;
  }
  //==============================================================================
  // 플랫폼 정보 탐지 및 적용.
  //==============================================================================
  /**
   * @returns { { platformName: string, browserName: string } }
  */
  getPlatformInfo() {
    const userAgent = System6.navigator.userAgent;
    this.isMobile = /Mobi|Android|iPhone|iPad/i.test(userAgent);
    if (/Windows/i.test(userAgent)) this.platformName = PlatformType.windows;
    else if (/Valve Steam GameOverlay/i.test(userAgent)) this.platformName = PlatformType.steamDeck;
    else if (/iPad/i.test(userAgent)) this.platformName = PlatformType.iPadOS;
    else if (/iPhone|iPod/i.test(userAgent)) this.platformName = PlatformType.iOS;
    else if (/Macintosh|Mac OS X/i.test(userAgent)) this.platformName = PlatformType.macOS;
    else if (/Android/i.test(userAgent)) this.platformName = PlatformType.android;
    else if (/Linux/i.test(userAgent)) this.platformName = PlatformType.linux;
    else this.platformName = PlatformType.unknown;
    if (/Edg/i.test(userAgent)) this.browserName = BrowserType.edge;
    else if (/Chrome/i.test(userAgent) && !/Edg/i.test(userAgent)) this.browserName = BrowserType.chrome;
    else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent) && !/Edg/i.test(userAgent)) this.browserName = BrowserType.safari;
    else if (/Firefox/i.test(userAgent)) this.browserName = BrowserType.firefox;
    else if (/MSIE|Trident/i.test(userAgent)) this.browserName = BrowserType.internetExplorer;
    else this.browserName = BrowserType.unknown;
    return {
      platformName: this.platformName,
      browserName: this.browserName
    };
  }
  //==============================================================================
  // 리소스 사용량 반환.
  //==============================================================================
  /**
   * @returns { { totalTransferSize: number, totalDecodedSize: number, loadedFiles: array } }
  */
  getResouceUsage() {
    const resources = performance.getEntriesByType("resource");
    let totalTransferSize = 0;
    let totalDecodedSize = 0;
    let loadedFiles = [];
    resources.forEach((resource) => {
      totalTransferSize += resource.transferSize;
      totalDecodedSize += resource.decodedBodySize;
      loadedFiles.push({
        path: resource.name,
        name: resource.name.split("/").pop(),
        type: resource.initiatorType,
        transferSize: resource.transferSize,
        decodedSize: resource.decodedBodySize
      });
    });
    return {
      totalTransferSize,
      totalDecodedSize,
      loadedFiles
    };
  }
  //==============================================================================
  // 세이프 에어리어 반환.
  //==============================================================================
  /**
      * @param @type { HTMLCanvasElement | null } canvas
   * @returns { Rect }
  */
  getSafeAreaRect(canvas) {
    const div = System6.document.createElement("div");
    div.style.position = "absolute";
    div.style.visibility = "hidden";
    div.style.paddingTop = "env(safe-area-inset-top)";
    div.style.paddingRight = "env(safe-area-inset-right)";
    div.style.paddingBottom = "env(safe-area-inset-bottom)";
    div.style.paddingLeft = "env(safe-area-inset-left)";
    System6.document.body.appendChild(div);
    const style = Window.getComputedStyle(div);
    const top = Number.parseInt(style.paddingTop) || 0;
    const right = Number.parseInt(style.paddingRight) || 0;
    const bottom = Number.parseInt(style.paddingBottom) || 0;
    const left = Number.parseInt(style.paddingLeft) || 0;
    System6.document.body.removeChild(div);
    if (canvas === null || canvas === void 0) {
      return Rect.create(left, top, System6.window.innerWidth - left - right, System6.window.innerHeight - top - bottom);
    } else {
      return Rect.create(left, top, canvas.width - left - right, canvas.height - top - bottom);
    }
  }
};

// src/base/singleton.js
var Singleton = class _Singleton extends Object2 {
  static {
    __name(this, "Singleton");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @static @type { Map } */
  static #instances = /* @__PURE__ */ new Map();
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    const T = this.constructor;
    if (_Singleton.#instances.has(T)) {
      return _Singleton.#instances.get(T);
    }
    _Singleton.#instances.set(T, this);
  }
  //==============================================================================
  // 공유 인스턴스 반환.
  //==============================================================================
  /**
   * @static
   */
  static getInstance() {
    const T = this;
    if (!_Singleton.#instances.has(T)) {
      const obj = new T();
    }
    return _Singleton.#instances.get(T);
  }
};

// src/base/identifier.js
var System7 = globalThis;
var Identifier = class extends Object2 {
  static {
    __name(this, "Identifier");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { number } */
  #serialNumber;
  // 누적.
  /** @private @type { number } */
  #increaseNumber;
  // 증가.
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @param { number} initialSerialNumber  
   * @param { number} initialIncreaseNumber 
   */
  constructor(initialSerialNumber = 0, initialIncreaseNumber = 1) {
    super();
    this.#serialNumber = initialSerialNumber;
    this.#increaseNumber = initialIncreaseNumber;
  }
  //==============================================================================
  // 초기 상태로 되돌림.
  //==============================================================================
  reset() {
    this.#serialNumber = this.#serialNumber;
  }
  //==============================================================================
  // 호출마다 (1 or custom)씩 증가되는 식별자 반환.
  //==============================================================================
  /**
   * @description 아이디 자동 생성 후 반환.
   * @param { number } increaseNumber
   * @returns { number }
   */
  auto(increaseNumber = 0) {
    if (increaseNumber) {
      this.#serialNumber += increaseNumber;
    } else {
      this.#serialNumber += this.#increaseNumber;
    }
    return this.#serialNumber;
  }
};
var Enum = class _Enum extends Object2 {
  static {
    __name(this, "Enum");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @static @type { Identifier } */
  static #identifier = new Identifier(0, 1);
  //==============================================================================
  // 시작값으로 출발.
  //==============================================================================
  /**
   * @static
   * @returns { number }
   */
  static begin() {
    _Enum.#identifier.reset();
    return _Enum.auto();
  }
  //==============================================================================
  // 값을 증가시켜서 반환.
  //==============================================================================
  /**
   * @static
   * @returns { number }
   */
  static auto() {
    return _Enum.#identifier.auto();
  }
  //==============================================================================
  // 고정 열거체 생성.
  //==============================================================================
  /**
   * @static
   * @returns { System.Object }
   */
  static readonly(dictionary) {
    System7.Object.freeze(dictionary);
  }
};

// src/base/version.js
var Version = class _Version extends Object {
  static {
    __name(this, "Version");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { number } */
  #major;
  /** @private @type { number } */
  #minor;
  /** @private @type { number } */
  #patch;
  /** @private @type { string } */
  #branch;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.#major = 0;
    this.#minor = 0;
    this.#patch = 0;
    this.#branch = "";
  }
  //==============================================================================
  // 메이저 설정.
  //==============================================================================
  /**
   * @param { number } major
   */
  setMajor(major) {
    this.#major = major;
  }
  //==============================================================================
  // 메이저 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getMajor() {
    return this.#major;
  }
  //==============================================================================
  // 마이너 설정.
  //==============================================================================
  /**
   * @param { number } minor
   */
  setMinor(minor) {
    this.#minor = minor;
  }
  //==============================================================================
  // 마이너 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getMinor() {
    return this.#minor;
  }
  //==============================================================================
  // 패치 설정.
  //==============================================================================
  /**
   * @param { number } patch
   */
  setPatch(patch) {
    this.#patch = patch;
  }
  //==============================================================================
  // 패치 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getPatch() {
    return this.#patch;
  }
  //==============================================================================
  // 브랜치 설정.
  //==============================================================================
  /**
   * @param { string } branch
   */
  setBranch(branch) {
    this.#branch = branch;
  }
  //==============================================================================
  // 브랜치 반환.
  //==============================================================================
  /**
   * @returns { string }
   */
  getBranch() {
    return this.#branch;
  }
  //==============================================================================
  // 버전 문자열 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getVersionString() {
    const major = this.getMajor();
    const minor = this.getMinor();
    const patch = this.getPatch();
    const branch = this.getBranch();
    if (branch === "") {
      return `${major}.${minor}.${patch}`;
    } else {
      return `${major}.${minor}.${patch}-${branch}`;
    }
  }
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @param { number } major 
   * @param { number } minor
   * @param { number } patch
   * @param { string } branch
   */
  static create(major, minor, patch, branch = "") {
    const version = new _Version();
    version.setMajor(major);
    version.setMinor(minor);
    version.setPatch(patch);
    version.setBranch(branch);
    return version;
  }
};

// src/base/node.js
var Node = class _Node extends Object2 {
  static {
    __name(this, "Node");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Node | null } */
  #parent;
  // 부모 노드.
  /** @private @type { Node[] } */
  #children;
  // 자식 노드 목록.
  /** @private @type { boolean } */
  #isActive;
  // 활성화 여부.
  /** @private @type { string } */
  #name;
  // 노드 이름.
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
    this.#isActive = true;
    this.#name = "";
  }
  //==============================================================================
  // 부모 설정.
  //==============================================================================
  /**
   * @param { Node } parent 
   */
  setParent(parent) {
    if (this === parent) {
      throw new Error("");
    }
    const currentParent = this.getParent();
    if (currentParent) {
      if (currentParent === parent) {
        return;
      }
      const currentParentChildren = currentParent.getChildren();
      const childIndex = currentParentChildren.indexOf(this);
      currentParentChildren.splice(childIndex, 1);
      this.#parent = null;
    }
    if (parent) {
      this.#parent = parent;
      const newParentChildren = parent.getChildren();
      newParentChildren.push(this);
    }
  }
  //==============================================================================
  // 자식 추가.
  //==============================================================================
  /**
   * @param { Node } child 
   */
  addChild(child) {
    child.setParent(this);
  }
  //==============================================================================
  // 자식 제거.
  //==============================================================================
  /**
   * @param { Node } child 
   */
  removeChild(child) {
    child.setParent(null);
  }
  //==============================================================================
  // 자식 제거.
  //==============================================================================
  /**
   * @param { number } childIndex 
   */
  removeChildAt(childIndex) {
    if (childIndex !== -1) {
      const child = this.getChild(childIndex);
      if (child) {
        this.removeChild(child);
      }
    }
  }
  //==============================================================================
  // 모든 자식 제거. (직계 자식 목록만 비우기 때문에 자식들이 소유한 계층 구조는 유지됨)
  //==============================================================================
  removeChildren() {
    const children = this.getChildren();
    while (children.length > 0) {
      const child = children.at(0);
      this.removeChild(child);
    }
  }
  //==============================================================================
  // 부모가 없는지 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean } 
   */
  isRoot() {
    const parent = this.getParent();
    return !_Node.isValidate(parent);
  }
  //==============================================================================
  // 자식이 없는지 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean } 
   */
  isLeaf() {
    const children = this.getChildren();
    return children.length === 0;
  }
  //==============================================================================
  // 부모 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean } 
   */
  hasParent() {
    const parent = this.getParent();
    return parent !== null;
  }
  //==============================================================================
  // 부모 반환.
  //==============================================================================
  /**
   * @returns { Node } 
   */
  getParent() {
    return this.#parent;
  }
  //==============================================================================
  // 형제 목록 반환.
  //==============================================================================
  /**
   * @returns { Node[] | null } 
   */
  getSiblings() {
    const parent = this.getParent();
    if (!parent) {
      return null;
    }
    const children = parent.getChildren();
    return children;
  }
  //==============================================================================
  // 자식 목록 반환.
  //==============================================================================
  /**
   * @returns { Node[] } 
   */
  getChildren() {
    return this.#children;
  }
  //==============================================================================
  // 자식 수 반환.
  //==============================================================================
  /**
   * @returns { number } 
   */
  getChildCount() {
    const children = this.getChildren();
    return children.length;
  }
  //==============================================================================
  // 자식 반환.
  //==============================================================================
  /**
   * @returns { Node | null } 
   */
  getChild(childIndex) {
    const children = this.getChildren();
    if (childIndex < 0 || childIndex >= children.length) {
      return null;
    }
    return children[childIndex];
  }
  //==============================================================================
  // 자식의 위치 반환.
  //==============================================================================
  /**
   * @param { Node } child
   * @returns { number } 
   */
  getChildIndex(child) {
    const children = this.getChildren();
    return children.indexOf(child);
  }
  //==============================================================================
  // 자식 포함 여부 반환.
  //==============================================================================
  /**
   * @param { Node } child 
   * @returns { boolean }
   */
  hasChild(child) {
    const childIndex = this.getChildIndex(child);
    if (childIndex !== -1) {
      return true;
    }
    return false;
  }
  //==============================================================================
  // 활성화 상태 설정.
  //==============================================================================
  /**
   * @param { boolean } active 
   */
  setActive(active) {
    this.#isActive = active;
  }
  //==============================================================================
  // 활성화 상태 반환.
  //==============================================================================
  /**
   * @returns { boolean } 
   */
  isActive() {
    return this.#isActive;
  }
  //==============================================================================
  // 현재부터 루트까지 계층 전체의 활성화 상태 반환. (루트까지 하나라도 비활성화상태면 false 반환)
  //==============================================================================
  /**
   * @returns { boolean } 
   */
  isActiveInHierarchy() {
    if (this.isActive()) {
      let current = this;
      while (current !== null && current !== void 0) {
        if (current.isActive()) {
          current = current.getParent();
        } else {
          return false;
        }
      }
      return true;
    } else {
      return false;
    }
  }
  //==============================================================================
  // 이름 설정.
  //==============================================================================
  /**
   * @param { string } name
   */
  setName(name) {
    this.#name = name;
  }
  //==============================================================================
  // 이름 반환.
  //==============================================================================
  /**
   * @returns { string }
   */
  getName() {
    return this.#name;
  }
  //==============================================================================
  // 조건으로 직계 자식 찾기.
  //==============================================================================
  /**
   * @param { function(Node): boolean } predicate
   * @returns { Node | null }
   */
  findChild(predicate) {
    if (predicate) {
      const children = this.getChildren();
      for (const child of children) {
        if (predicate(child)) {
          return child;
        }
      }
    }
    return null;
  }
  //==============================================================================
  // 조건으로 직계 자식 찾기. (깊이 우선)
  //==============================================================================
  /**
   * @param { function(Node): boolean } predicate
   * @returns { Node | null }
   */
  findChildRecursive(predicate) {
    const children = this.getChildren();
    for (const child of children) {
      if (predicate(child)) {
        return child;
      }
      const found = child.findChildRecursive(predicate);
      if (found !== null) {
        return found;
      }
    }
    return null;
  }
  //==============================================================================
  // 이름으로 직계 자식 찾기.
  //==============================================================================
  /**
   * @param { string } name
   * @returns { Node | null }
   */
  findChildByName(name) {
    return this.findChild((child) => {
      return child.getName() === name;
    });
  }
  //==============================================================================
  // 이름으로 하위 계층 전체에서 찾기. (깊이 우선)
  //==============================================================================
  /**
   * @param { string } name
   * @returns { Node | null }
   */
  findChildRecursiveByName(name) {
    return this.findChildRecursive((child) => {
      return child.getName() === name;
    });
  }
  //==============================================================================
  // 이름으로 직계 자식 제거.
  //==============================================================================
  /**
   * @param { string } name
   */
  removeChildByName(name) {
    const child = this.findChildByName(name);
    if (child !== null) {
      this.removeChild(child);
    }
  }
  //==============================================================================
  // 형제간의 위치 설정.
  //==============================================================================
  /**
   * @param { number } childIndex
   */
  setSiblingIndex(childIndex) {
    if (!this.hasParent()) {
      return;
    }
    const parent = this.getParent();
    const children = parent.getChildren();
    const oldChildIndex = children.indexOf(this);
    const newChildIndex = clamp(childIndex, 0, children.length - 1);
    if (oldChildIndex === newChildIndex) {
      return;
    }
    children.splice(oldChildIndex, 1);
    children.splice(newChildIndex, 0, this);
  }
  //==============================================================================
  // 형제간의 위치 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getSiblingIndex() {
    if (!this.hasParent()) {
      return -1;
    }
    const parent = this.getParent();
    const childIndex = parent.getChildIndex(this);
    return childIndex;
  }
  // //==============================================================================
  // // 새로운 노드 생성.
  // //==============================================================================
  // /**
  //  * @returns { Node }
  //  */
  // static create() {
  // 	var obj = new Node();
  // 	return obj;
  // }
};

// src/core/timemanager.js
var TimeManager = class extends Object2 {
  static {
    __name(this, "TimeManager");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { number } */
  #realtimeSinceStartup;
  /** @private @type { number } */
  #time;
  /** @private @type { number } */
  #unscaledTimeDelta;
  /** @private @type { number } */
  #fps;
  /** @private @type { number } */
  #framesThisSecond;
  /** @private @type { number } */
  #previousFrameCheckTime;
  /** @private @type { number } */
  #timeScale;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   * @param { Engine } engine 
   */
  constructor(engine) {
    super();
    this.#realtimeSinceStartup = 0;
    this.#time = 0;
    this.#unscaledTimeDelta = 0;
    this.#fps = 0;
    this.#framesThisSecond = 0;
    this.#previousFrameCheckTime = 0;
    this.#timeScale = 1;
  }
  //==============================================================================
  // 시간 계산.
  //==============================================================================
  /**
   * @param { number } timestamp
   */
  update(timestamp) {
    const realtimeSinceStartup = timestamp * 1e-3;
    if (this.#realtimeSinceStartup === 0) {
      this.#realtimeSinceStartup = realtimeSinceStartup;
      this.#previousFrameCheckTime = realtimeSinceStartup;
    }
    const unscaledTimeDelta = realtimeSinceStartup - this.#realtimeSinceStartup;
    this.#realtimeSinceStartup = realtimeSinceStartup;
    this.#time += unscaledTimeDelta;
    this.#unscaledTimeDelta = unscaledTimeDelta;
    if (realtimeSinceStartup >= this.#previousFrameCheckTime + 1) {
      this.#fps = this.#framesThisSecond;
      this.#framesThisSecond = 0;
      this.#previousFrameCheckTime = realtimeSinceStartup;
    }
    ++this.#framesThisSecond;
  }
  //==============================================================================
  // 현재 프라우저가 시작 된 이후 시간 반환. (초 단위)
  //==============================================================================
  /**
   * @returns { number }
   */
  getRealtimeSinceStartup() {
    return this.#realtimeSinceStartup;
  }
  //==============================================================================
  // 현재 엔진이 시작 된 이후 시간 반환. (초 단위)
  //==============================================================================
  /**
   * @returns { number }
   */
  getTime() {
    return this.#time;
  }
  //==============================================================================
  // 현재 프레임과 이전 프레임 사이의 경과 시간 반환. (초 단위)
  //==============================================================================
  /**
   * @returns { number }
   */
  getUnscaleDeltaTime() {
    return this.#unscaledTimeDelta;
  }
  //==============================================================================
  // 현재 프레임과 이전 프레임 사이의 경과 시간 반환. (초 단위)
  //==============================================================================
  /**
   * @returns { number }
   */
  getTimeDelta() {
    const unscaledTimeDelta = this.getUnscaleDeltaTime();
    const timeScale = this.getTimeScale();
    return unscaledTimeDelta * timeScale;
  }
  //==============================================================================
  // 현재 초당 프레임 수 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getFramePerSecond() {
    return this.#fps;
  }
  //==============================================================================
  // 시간 배율 설정.
  //==============================================================================
  /**
   * @param { number } timeScale
   */
  setTimeScale(timeScale) {
    this.#timeScale = timeScale;
  }
  //==============================================================================
  // 시간 배율 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getTimeScale() {
    return this.#timeScale;
  }
};

// src/core/component.js
var Component = class extends Object2 {
  static {
    __name(this, "Component");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { string } */
  #componentType;
  // 컴포넌트 타입.
  /** @private @type { ComponentNode } */
  #node;
  // 소유권자.
  /** @private @type { boolean } */
  #isEnable;
  // 활성화 여부.
  /** @private @type { boolean } */
  #isGizmoVisible;
  // 기즈모 출력 여부.
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.#componentType = "Component";
    this.#node = null;
    this.#isEnable = true;
    this.#isGizmoVisible = false;
  }
  //==============================================================================
  // 갱신.
  //==============================================================================
  /**
   * @virtual
   * @param { number } timeDelta
   */
  tick(timeDelta) {
  }
  //==============================================================================
  // 출력.
  //==============================================================================
  /**
   * @virtual
   * @param { Graphic } graphic
   */
  draw(graphic) {
  }
  //==============================================================================
  // 기즈모 출력.
  //==============================================================================
  /**
   * @virtual
   * @param { Graphic } graphic
   */
  drawGizmos(graphic) {
    const isGizmoVisible = this.isGizmoVisible();
    if (!isGizmoVisible) {
      return;
    }
  }
  //==============================================================================
  // 의존 컴포넌트 목록 반환. (자식 클래스가 오버라이드)
  // - addComponent 가 본 컴포넌트를 부착하기 직전에 호출하여, 반환된 클래스 목록을
  //   같은 노드에 자동으로 추가한다 (이미 있으면 건너뜀).
  // - Unity 의 RequireComponent 와 같은 사상.
  //==============================================================================
  /**
   * @virtual
   * @returns { Function[] }
   */
  require() {
    return [];
  }
  //==============================================================================
  // 노드에 붙음.
  //==============================================================================
  /**
   * @virtual
   * @param { ComponentNode } node
   */
  attach(node) {
  }
  //==============================================================================
  // 노드에서 떨어짐.
  //==============================================================================
  /**
   * @virtual
   * @param { ComponentNode } node
   */
  detach(node) {
  }
  //==============================================================================
  // 소유권자 설정.
  //==============================================================================
  /**
   * @param { ComponentNode } node
   */
  setNode(node) {
    this.#node = node;
  }
  //==============================================================================
  // 소유권자 반환.
  //==============================================================================
  /**
   * @returns { ComponentNode }
   */
  getNode() {
    return this.#node;
  }
  //==============================================================================
  // 기즈모 그리기 여부 설정.
  //==============================================================================
  /**
   * @param { boolean } isVisible
   */
  setGizmoVisible(isVisible) {
    this.#isGizmoVisible = isVisible;
  }
  //==============================================================================
  // 기즈모 그리기 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isGizmoVisible() {
    return this.#isGizmoVisible;
  }
  //==============================================================================
  // 활성화 여부 설정.
  //==============================================================================
  /**
   * @param { boolean } isEnable
   */
  setEnable(isEnable) {
    this.#isEnable = isEnable;
  }
  //==============================================================================
  // 활성화 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isEnable() {
    return this.#isEnable;
  }
  //==============================================================================
  // 컴포넌트 타입 설정.
  //==============================================================================
  /**
   * @param { string } componentType
   */
  setComponentType(componentType) {
    this.#componentType = componentType;
  }
  //==============================================================================
  // 컴포넌트 타입 반환.
  //==============================================================================
  /**
   * @returns { string }
   */
  getComponentType() {
    return this.#componentType;
  }
};

// src/core/node/componentnode.js
var ComponentNode = class extends Node {
  static {
    __name(this, "ComponentNode");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Component[] } */
  #components;
  // 컴포넌트 목록.
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.#components = [];
  }
  //==============================================================================
  // 갱신.
  //==============================================================================
  /**
   * @virtual
   * @param { number } timeDelta 
   */
  tick(timeDelta) {
    const isActive = this.isActive();
    if (isActive) {
      const components = this.getAllComponents();
      for (const component of components) {
        component.tick(timeDelta);
      }
      const children = this.getChildren();
      for (const child of children) {
        const isActive2 = child.isActive();
        if (isActive2) {
          child.tick(timeDelta);
        }
      }
    }
  }
  //==============================================================================
  // 타입으로 컴포넌트 추가.
  //==============================================================================
  /**
   * @param { Function } componentType  
   */
  getOrAddComponent(componentType) {
    if (componentType === null || componentType === void 0) {
      return null;
    }
    const hasComponent = this.hasComponent(componentType);
    if (hasComponent) {
      return this.getComponent(componentType);
    } else {
      return this.addComponent(componentType);
    }
  }
  //==============================================================================
  // 타입으로 컴포넌트 추가.
  //==============================================================================
  /**
   * @param { Function } componentType  
   */
  addComponent(componentType) {
    if (componentType === null || componentType === void 0) {
      return null;
    }
    const component = new componentType();
    component.setNode(this);
    const components = this.getAllComponents();
    components.push(component);
    const requiredTypes = component.require();
    if (Array.isArray(requiredTypes)) {
      for (const requiredType of requiredTypes) {
        this.getOrAddComponent(requiredType);
      }
    }
    component.attach(this);
    return component;
  }
  //==============================================================================
  // 객체로 컴포넌트 제거.
  //==============================================================================
  /**
   * @param { Component } component 
   */
  removeComponent(component) {
    const components = this.getAllComponents();
    const index = components.indexOf(component);
    if (index === -1) {
      return;
    }
    component.setNode(null);
    components.splice(index, 1);
    component.detach(this);
  }
  //==============================================================================
  // 컴포넌트 보유 여부..
  //==============================================================================
  /**
   * @returns { boolean }
   */
  hasComponent(componentType) {
    const component = this.getComponent(componentType);
    return component !== null && component !== void 0;
  }
  //==============================================================================
  // 모든 컴포넌트 목록 반환.
  //==============================================================================
  /**
   * @returns { Component[] }
   */
  getAllComponents() {
    return this.#components;
  }
  //==============================================================================
  // 타입에 대한 컴포넌트 반환.
  //==============================================================================
  /**
   * @param { Function } componentType 
   * @returns { Component | null }
   */
  getComponent(componentType) {
    const component = this.#components.find((component2) => component2 instanceof componentType);
    if (component === null || component === void 0) {
      return null;
    }
    return component;
  }
  //==============================================================================
  // 타입에 대한 모든 컴포넌트 반환.
  //==============================================================================
  /**
   * @param { Function } componentType 
   * @returns { Component[] }
   */
  getComponents(componentType) {
    const result = [];
    const components = this.getAllComponents();
    for (const component of components) {
      if (component instanceof componentType) {
        result.push(component);
      }
    }
    return result;
  }
};

// src/core/node/transformnode.js
var TransformNode = class extends ComponentNode {
  static {
    __name(this, "TransformNode");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Vector2 } */
  #localPosition;
  // 로컬 위치.
  /** @private @type { Vector2 } */
  #localScale;
  // 로컬 크기.
  /** @private @type { number } */
  #localRotation;
  // 로컬 회전값. (degree)
  /** @private @type { number } */
  #localOpacity;
  // 투명도.
  /** @private @type { boolean } */
  #isGizmoVisible;
  // 기즈모 출력 여부.
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.nodeType = "TransformNode";
    this.#localPosition = Vector2.zero();
    this.#localScale = Vector2.one();
    this.#localRotation = 0;
    this.#isGizmoVisible = false;
    this.#localOpacity = 1;
  }
  //==============================================================================
  // 출력 상태 시작.
  //==============================================================================
  /**
   * @virtual
   * @param { Graphic } graphic
   */
  pushTransform(graphic) {
    if (graphic) {
      graphic.pushState();
      const localPosition = this.getLocalPosition();
      const localRotation = this.getLocalRotation();
      const radian = degreeToRadian(localRotation);
      const localScale = this.getLocalScale();
      graphic.translate(localPosition.x, localPosition.y);
      graphic.rotate(radian);
      graphic.scale(localScale.x, localScale.y);
      const localOpacity = this.getLocalOpacity();
      graphic.multiplyGlobalAlpha(localOpacity);
    }
  }
  //==============================================================================
  // 출력.
  //==============================================================================
  /**
   * @virtual
   * @param { Graphic } graphic 
   */
  draw(graphic) {
    const isVisible = this.isVisible();
    if (isVisible) {
      const components = this.getAllComponents();
      for (const component of components) {
        component.draw(graphic);
      }
      const children = this.getChildren();
      for (const child of children) {
        graphic.drawNode(child);
      }
    }
  }
  //==============================================================================
  // 출력.
  //==============================================================================
  /**
   * @virtual
   * @param { Graphic } graphic 
   */
  drawGizmos(graphic) {
    if (graphic) {
      const originalAlpha = graphic.getGlobalAlpha();
      graphic.setGlobalAlpha(1);
      const components = this.getAllComponents();
      for (const component of components) {
        const isGizmoVisible = component.isGizmoVisible();
        if (isGizmoVisible) {
          component.drawGizmos(graphic);
        }
      }
      graphic.setGlobalAlpha(originalAlpha);
    }
  }
  //==============================================================================
  // 출력 상태 종료.
  //==============================================================================
  /**
   * @virtual
   * @param { Graphic } graphic 
   */
  popTransform(graphic) {
    if (graphic) {
      graphic.popState();
    }
  }
  //==============================================================================
  // 글로벌 위치 설정.
  //==============================================================================
  /**
   * @param { Vector2 } position 
   */
  setPosition(position) {
    const parent = this.getParent();
    if (!parent) {
      this.setLocalPosition(position);
      return;
    }
    const parentPosition = parent.getPosition();
    const parentRotation = parent.getRotation();
    const parentScale = parent.getScale();
    const dx = position.x - parentPosition.x;
    const dy = position.y - parentPosition.y;
    const radian = degreeToRadian(-parentRotation);
    const cosRadian = cos(radian);
    const sinRadian = sin(radian);
    const rx = dx * cosRadian - dy * sinRadian;
    const ry = dx * sinRadian + dy * cosRadian;
    const sx = parentScale.x !== 0 ? rx / parentScale.x : 0;
    const sy = parentScale.y !== 0 ? ry / parentScale.y : 0;
    this.setLocalPosition(Vector2.create(sx, sy));
  }
  //==============================================================================
  // 글로벌 위치 반환.
  //==============================================================================
  /**
   * @returns { Vector2 } 
   */
  getPosition() {
    const parent = this.getParent();
    const localPosition = this.getLocalPosition();
    if (!parent) {
      return localPosition;
    }
    const parentPosition = parent.getPosition();
    const parentRotation = parent.getRotation();
    const parentScale = parent.getScale();
    const radian = degreeToRadian(parentRotation);
    const cosRadian = cos(radian);
    const sinRadian = sin(radian);
    const sx = localPosition.x * parentScale.x;
    const sy = localPosition.y * parentScale.y;
    const rx = sx * cosRadian - sy * sinRadian;
    const ry = sx * sinRadian + sy * cosRadian;
    return Vector2.create(parentPosition.x + rx, parentPosition.y + ry);
  }
  //==============================================================================
  // 글로벌 크기 설정.
  //==============================================================================
  /**
   * @param { Vector2 } scale 
   */
  setScale(scale) {
    const parent = this.getParent();
    if (!parent) {
      this.setLocalScale(scale);
    } else {
      const parentScale = parent.getScale();
      this.setLocalScale(Vector2.create(
        parentScale.x !== 0 ? scale.x / parentScale.x : 0,
        parentScale.y !== 0 ? scale.y / parentScale.y : 0
      ));
    }
  }
  //==============================================================================
  // 글로벌 크기 반환.
  //==============================================================================
  /**
   * @returns { Vector2 } 
   */
  getScale() {
    const parent = this.getParent();
    const localScale = this.getLocalScale();
    if (!parent) {
      return localScale;
    }
    const parentScale = parent.getScale();
    return Vector2.create(parentScale.x * localScale.x, parentScale.y * localScale.y);
  }
  //==============================================================================
  // 글로벌 회전 설정.
  //==============================================================================
  /**
   * @param { number } rotation 
   */
  setRotation(rotation) {
    const parent = this.getParent();
    if (!parent) {
      this.setLocalRotation(rotation);
    } else {
      const parentRotation = parent.getRotation();
      this.setLocalRotation(rotation - parentRotation);
    }
  }
  //==============================================================================
  // 글로벌 회전 반환.
  //==============================================================================
  /**
   * @returns { number } 
   */
  getRotation() {
    const parent = this.getParent();
    const localRotation = this.getLocalRotation();
    if (!parent) {
      return localRotation;
    }
    const parentRotation = parent.getRotation();
    return parentRotation + localRotation;
  }
  //==============================================================================
  // 로컬 위치 설정.
  //==============================================================================
  /**
   * @param { Vector2 } position 
   */
  setLocalPosition(position) {
    this.#localPosition = position.clone();
  }
  //==============================================================================
  // 로컬 위치 반환.
  //==============================================================================
  /**
   * @returns { Vector2 } 
   */
  getLocalPosition() {
    return this.#localPosition.clone();
  }
  //==============================================================================
  // 로컬 크기 설정.
  //==============================================================================
  /**
   * @param { Vector2 } scale 
   */
  setLocalScale(scale) {
    this.#localScale = scale.clone();
  }
  //==============================================================================
  // 로컬 크기 반환.
  //==============================================================================
  /**
   * @returns { Vector2 } 
   */
  getLocalScale() {
    return this.#localScale.clone();
  }
  //==============================================================================
  // 로컬 회전 설정.
  //==============================================================================
  /**
   * @param { number } rotation 
   */
  setLocalRotation(rotation) {
    this.#localRotation = rotation;
  }
  //==============================================================================
  // 로컬 회전 반환.
  //==============================================================================
  /**
   * @returns { number } 
   */
  getLocalRotation() {
    return this.#localRotation;
  }
  //==============================================================================
  // 가시 상태 반환.
  //==============================================================================
  /**
   * @returns { boolean } 
   */
  isVisible() {
    const isActive = this.isActive();
    if (isActive) {
      const opacity = this.getLocalOpacity();
      if (opacity > 0) {
        return true;
      }
    }
    return false;
  }
  //==============================================================================
  // 현재부터 루트까지 계층 전체의 가시 상태 반환. (루트까지 하나라도 비활성화상태면 false 반환)
  //==============================================================================
  /**
   * @returns { boolean } 
   */
  isVisibleInHierarchy() {
    const isVisible = this.isVisible();
    if (isVisible) {
      let current = this;
      while (current !== null && current !== void 0) {
        const isCurrentVisible = current.isVisible();
        if (isCurrentVisible) {
          current = current.getParent();
        } else {
          return false;
        }
      }
      return true;
    } else {
      return false;
    }
  }
  //==============================================================================
  // 글로벌 투명도 반환.
  //==============================================================================
  /**
   * @returns { number } 
   */
  getOpacity() {
    let globalOpacity = this.getLocalOpacity();
    let current = this;
    while (current !== null && current !== void 0) {
      current = current.getParent();
      if (current === null || current === void 0) {
        continue;
      }
      opcacity *= current.getLocalOpacity();
    }
    globalOpacity = clamp(globalOpacity, 0, 1);
    return globalOpacity;
  }
  //==============================================================================
  // 로컬 투명도 설정.
  //==============================================================================
  /**
   * @param { number } opacity 
   */
  setLocalOpacity(opacity) {
    this.#localOpacity = clamp(opacity, 0, 1);
  }
  //==============================================================================
  // 로컬 투명도 반환.
  //==============================================================================
  /**
   * @returns { number } 
   */
  getLocalOpacity() {
    return this.#localOpacity;
  }
  //==============================================================================
  // 기즈모 그리기 여부 설정.
  //==============================================================================
  /**
   * @param { boolean } isVisible 
   */
  setGizmoVisible(isVisible) {
    this.#isGizmoVisible = isVisible;
  }
  //==============================================================================
  // 기즈모 그리기 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isGizmoVisible() {
    return this.#isGizmoVisible;
  }
};

// src/base/transformmatrix.js
var TransformMatrix = class _TransformMatrix extends Object2 {
  static {
    __name(this, "TransformMatrix");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { number } */
  #a;
  /** @private @type { number } */
  #b;
  /** @private @type { number } */
  #c;
  /** @private @type { number } */
  #d;
  /** @private @type { number } */
  #e;
  /** @private @type { number } */
  #f;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.#a = 1;
    this.#b = 0;
    this.#c = 0;
    this.#d = 1;
    this.#e = 0;
    this.#f = 0;
  }
  //==============================================================================
  // a 성분 반환 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @returns { number }
   */
  get a() {
    return this.#a;
  }
  //==============================================================================
  // b 성분 반환 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @returns { number }
   */
  get b() {
    return this.#b;
  }
  //==============================================================================
  // c 성분 반환 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @returns { number }
   */
  get c() {
    return this.#c;
  }
  //==============================================================================
  // d 성분 반환 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @returns { number }
   */
  get d() {
    return this.#d;
  }
  //==============================================================================
  // e 성분 반환 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @returns { number }
   */
  get e() {
    return this.#e;
  }
  //==============================================================================
  // f 성분 반환 프로퍼티.
  //==============================================================================
  /**
   * @property
   * @returns { number }
   */
  get f() {
    return this.#f;
  }
  //==============================================================================
  // 항등 행렬로 재설정.
  //==============================================================================
  setIdentity() {
    this.#a = 1;
    this.#b = 0;
    this.#c = 0;
    this.#d = 1;
    this.#e = 0;
    this.#f = 0;
  }
  //==============================================================================
  // 행렬 성분 직접 설정. (Canvas2D setTransform 인자 순서와 동일)
  //==============================================================================
  /**
   * @param { number } a
   * @param { number } b
   * @param { number } c
   * @param { number } d
   * @param { number } e
   * @param { number } f
   */
  setTransform(a, b, c, d, e, f) {
    this.#a = a;
    this.#b = b;
    this.#c = c;
    this.#d = d;
    this.#e = e;
    this.#f = f;
  }
  //==============================================================================
  // 다른 행렬의 성분 복사.
  //==============================================================================
  /**
   * @param { TransformMatrix } other
   */
  copyFrom(other) {
    this.#a = other.a;
    this.#b = other.b;
    this.#c = other.c;
    this.#d = other.d;
    this.#e = other.e;
    this.#f = other.f;
  }
  //==============================================================================
  // 복제.
  //==============================================================================
  /**
   * @override
   * @returns { this }
   */
  clone() {
    const transformMatrix = (
      /** @type { this } */
      new _TransformMatrix()
    );
    transformMatrix.copyFrom(this);
    return transformMatrix;
  }
  //==============================================================================
  // 이동 변환 누적. (Canvas2D translate 와 동일한 로컬 공간 우측 곱)
  //==============================================================================
  /**
   * @param { number } x
   * @param { number } y
   */
  translate(x, y) {
    this.#e = this.#a * x + this.#c * y + this.#e;
    this.#f = this.#b * x + this.#d * y + this.#f;
  }
  //==============================================================================
  // 회전 변환 누적. (Canvas2D rotate 와 동일한 로컬 공간 우측 곱)
  //==============================================================================
  /**
   * @param { number } radian
   */
  rotate(radian) {
    const cosRadian = cos(radian);
    const sinRadian = sin(radian);
    const a = this.#a;
    const b = this.#b;
    const c = this.#c;
    const d = this.#d;
    this.#a = a * cosRadian + c * sinRadian;
    this.#b = b * cosRadian + d * sinRadian;
    this.#c = -a * sinRadian + c * cosRadian;
    this.#d = -b * sinRadian + d * cosRadian;
  }
  //==============================================================================
  // 크기 변환 누적. (Canvas2D scale 과 동일한 로컬 공간 우측 곱)
  //==============================================================================
  /**
   * @param { number } x
   * @param { number } y
   */
  scale(x, y) {
    this.#a = this.#a * x;
    this.#b = this.#b * x;
    this.#c = this.#c * y;
    this.#d = this.#d * y;
  }
  //==============================================================================
  // 다른 행렬을 우측에 곱해 누적. (this = this x other)
  //==============================================================================
  /**
   * @param { TransformMatrix } other
   */
  multiply(other) {
    const a = this.#a;
    const b = this.#b;
    const c = this.#c;
    const d = this.#d;
    const e = this.#e;
    const f = this.#f;
    this.#a = a * other.a + c * other.b;
    this.#b = b * other.a + d * other.b;
    this.#c = a * other.c + c * other.d;
    this.#d = b * other.c + d * other.d;
    this.#e = a * other.e + c * other.f + e;
    this.#f = b * other.e + d * other.f + f;
  }
  //==============================================================================
  // 점 변환.
  //==============================================================================
  /**
   * @param { number } x
   * @param { number } y
   * @returns { { x: number, y: number } }
   */
  transformPoint(x, y) {
    const transformedX = this.#a * x + this.#c * y + this.#e;
    const transformedY = this.#b * x + this.#d * y + this.#f;
    return { x: transformedX, y: transformedY };
  }
  //==============================================================================
  // 행렬이 담고 있는 축별 스케일 중 최대값 반환. (텍스트 선명도 계산용)
  //==============================================================================
  /**
   * @returns { number }
   */
  getMaximumScale() {
    const scaleX = sqrt(this.#a * this.#a + this.#b * this.#b);
    const scaleY = sqrt(this.#c * this.#c + this.#d * this.#d);
    return max(scaleX, scaleY);
  }
  //==============================================================================
  // mat3 유니폼 업로드용 열우선(column-major) 배열 기록.
  //==============================================================================
  /**
   * @param { Float32Array } target
   */
  writeToFloat32Array(target) {
    target[0] = this.#a;
    target[1] = this.#b;
    target[2] = 0;
    target[3] = this.#c;
    target[4] = this.#d;
    target[5] = 0;
    target[6] = this.#e;
    target[7] = this.#f;
    target[8] = 1;
  }
};

// src/core/graphic/shaderprogram.js
var ShaderProgram = class extends Object2 {
  static {
    __name(this, "ShaderProgram");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { WebGL2RenderingContext } */
  #webGL2RenderingContext;
  /** @private @type { WebGLProgram } */
  #program;
  /** @private @type { Map<string, GLint> } */
  #attributeLocations;
  /** @private @type { Map<string, WebGLUniformLocation> } */
  #uniformLocations;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   * @param { WebGL2RenderingContext } webGL2RenderingContext
   * @param { string } vertexShaderSource
   * @param { string } fragmentShaderSource
   */
  constructor(webGL2RenderingContext, vertexShaderSource, fragmentShaderSource) {
    super();
    this.#webGL2RenderingContext = webGL2RenderingContext;
    this.#attributeLocations = /* @__PURE__ */ new Map();
    this.#uniformLocations = /* @__PURE__ */ new Map();
    const vertexShader = this.createShader(webGL2RenderingContext.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.createShader(webGL2RenderingContext.FRAGMENT_SHADER, fragmentShaderSource);
    const program = webGL2RenderingContext.createProgram();
    webGL2RenderingContext.attachShader(program, vertexShader);
    webGL2RenderingContext.attachShader(program, fragmentShader);
    webGL2RenderingContext.linkProgram(program);
    if (!webGL2RenderingContext.getProgramParameter(program, webGL2RenderingContext.LINK_STATUS)) {
      const programError = webGL2RenderingContext.getProgramInfoLog(program);
      webGL2RenderingContext.deleteProgram(program);
      throw new Error(`ShaderProgram link failed: ${programError}`);
    }
    webGL2RenderingContext.deleteShader(vertexShader);
    webGL2RenderingContext.deleteShader(fragmentShader);
    this.#program = program;
  }
  //==============================================================================
  // 셰이더 객체 생성.
  //==============================================================================
  /**
   * @param { GLenum } shaderType
   * @param { string } shaderSource
   * @returns { WebGLShader }
   */
  createShader(shaderType, shaderSource) {
    const webGL2RenderingContext = this.getWebGL2RenderingContext();
    const shader = webGL2RenderingContext.createShader(shaderType);
    webGL2RenderingContext.shaderSource(shader, shaderSource);
    webGL2RenderingContext.compileShader(shader);
    if (!webGL2RenderingContext.getShaderParameter(shader, webGL2RenderingContext.COMPILE_STATUS)) {
      const shaderError = webGL2RenderingContext.getShaderInfoLog(shader);
      webGL2RenderingContext.deleteShader(shader);
      throw new Error(`ShaderProgram compile failed: ${shaderError}`);
    }
    return shader;
  }
  //==============================================================================
  // 프로그램 사용 시작.
  //==============================================================================
  use() {
    const webGL2RenderingContext = this.getWebGL2RenderingContext();
    const program = this.getProgram();
    webGL2RenderingContext.useProgram(program);
  }
  //==============================================================================
  // 어트리뷰트 로케이션 반환. (캐시)
  //==============================================================================
  /**
   * @param { string } attributeName
   * @returns { GLint }
   */
  getAttributeLocation(attributeName) {
    if (this.#attributeLocations.has(attributeName)) {
      return this.#attributeLocations.get(attributeName);
    }
    const webGL2RenderingContext = this.getWebGL2RenderingContext();
    const program = this.getProgram();
    const attributeLocation = webGL2RenderingContext.getAttribLocation(program, attributeName);
    this.#attributeLocations.set(attributeName, attributeLocation);
    return attributeLocation;
  }
  //==============================================================================
  // 유니폼 로케이션 반환. (캐시)
  //==============================================================================
  /**
   * @param { string } uniformName
   * @returns { WebGLUniformLocation }
   */
  getUniformLocation(uniformName) {
    if (this.#uniformLocations.has(uniformName)) {
      return this.#uniformLocations.get(uniformName);
    }
    const webGL2RenderingContext = this.getWebGL2RenderingContext();
    const program = this.getProgram();
    const uniformLocation = webGL2RenderingContext.getUniformLocation(program, uniformName);
    this.#uniformLocations.set(uniformName, uniformLocation);
    return uniformLocation;
  }
  //==============================================================================
  // 렌더링 컨텍스트 반환.
  //==============================================================================
  /**
   * @returns { WebGL2RenderingContext }
   */
  getWebGL2RenderingContext() {
    return this.#webGL2RenderingContext;
  }
  //==============================================================================
  // 프로그램 객체 반환.
  //==============================================================================
  /**
   * @returns { WebGLProgram }
   */
  getProgram() {
    return this.#program;
  }
};

// src/core/graphic/imagetexturecache.js
var ImageTextureCache = class extends Object2 {
  static {
    __name(this, "ImageTextureCache");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { WebGL2RenderingContext } */
  #webGL2RenderingContext;
  /** @private @type { WeakMap<object, { texture: WebGLTexture, isSmoothingApplied: boolean }> } */
  #entries;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   * @param { WebGL2RenderingContext } webGL2RenderingContext
   */
  constructor(webGL2RenderingContext) {
    super();
    this.#webGL2RenderingContext = webGL2RenderingContext;
    this.#entries = /* @__PURE__ */ new WeakMap();
  }
  //==============================================================================
  // 이미지에 대응하는 텍스처 반환. (없으면 업로드 후 반환)
  // - 아직 로드되지 않은 이미지(크기 0)는 null 을 반환한다.
  //==============================================================================
  /**
   * @param { HTMLImageElement | HTMLCanvasElement | OffscreenCanvas } image
   * @param { boolean } isSmoothingEnabled
   * @returns { WebGLTexture | null }
   */
  getTexture(image, isSmoothingEnabled) {
    if (image === null || image === void 0) {
      return null;
    }
    if (!image.width || !image.height) {
      return null;
    }
    const webGL2RenderingContext = this.getWebGL2RenderingContext();
    let entry = this.#entries.get(image);
    if (!entry) {
      const texture = webGL2RenderingContext.createTexture();
      webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
      webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, image);
      webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
      webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
      entry = { texture, isSmoothingApplied: !isSmoothingEnabled };
      this.#entries.set(image, entry);
    } else {
      webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, entry.texture);
    }
    if (entry.isSmoothingApplied !== isSmoothingEnabled) {
      const filter = isSmoothingEnabled ? webGL2RenderingContext.LINEAR : webGL2RenderingContext.NEAREST;
      webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, filter);
      webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, filter);
      entry.isSmoothingApplied = isSmoothingEnabled;
    }
    return entry.texture;
  }
  //==============================================================================
  // 렌더링 컨텍스트 반환.
  //==============================================================================
  /**
   * @returns { WebGL2RenderingContext }
   */
  getWebGL2RenderingContext() {
    return this.#webGL2RenderingContext;
  }
};

// src/core/graphic/textstringtexturecache.js
var System8 = globalThis;
var MAXIMUM_ENTRY_COUNT = 512;
var TextStringTextureCache = class extends Object2 {
  static {
    __name(this, "TextStringTextureCache");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { WebGL2RenderingContext } */
  #webGL2RenderingContext;
  /** @private @type { Map<string, object> } */
  #entries;
  /** @private @type { HTMLCanvasElement } */
  #bakeCanvas;
  /** @private @type { CanvasRenderingContext2D } */
  #bakeCanvasRenderingContext;
  /** @private @type { CanvasRenderingContext2D } */
  #measurementCanvasRenderingContext;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   * @param { WebGL2RenderingContext } webGL2RenderingContext
   */
  constructor(webGL2RenderingContext) {
    super();
    this.#webGL2RenderingContext = webGL2RenderingContext;
    this.#entries = /* @__PURE__ */ new Map();
    const bakeCanvas = System8.document.createElement("canvas");
    this.#bakeCanvas = bakeCanvas;
    this.#bakeCanvasRenderingContext = bakeCanvas.getContext("2d", { willReadFrequently: false });
    const measurementCanvas = System8.document.createElement("canvas");
    this.#measurementCanvasRenderingContext = measurementCanvas.getContext("2d");
  }
  //==============================================================================
  // 문자열 측정. (화면에 보이지 않는 오프스크린 컨텍스트 사용)
  //==============================================================================
  /**
   * @param { string } fontString
   * @param { string } text
   * @returns { TextMetrics }
   */
  measureText(fontString, text) {
    const measurementCanvasRenderingContext2 = this.getMeasurementCanvasRenderingContext();
    measurementCanvasRenderingContext2.font = fontString;
    const textMetrics = measurementCanvasRenderingContext2.measureText(text);
    return textMetrics;
  }
  //==============================================================================
  // 폰트 문자열의 픽셀 크기를 배율만큼 확대한 문자열 반환.
  //==============================================================================
  /**
   * @param { string } fontString
   * @param { number } scale
   * @returns { string }
   */
  buildScaledFontString(fontString, scale) {
    if (scale === 1) {
      return fontString;
    }
    return fontString.replace(/(\d+(?:\.\d+)?)px/, (matched, sizeText) => {
      const scaledSize = System8.Number.parseFloat(sizeText) * scale;
      return `${scaledSize}px`;
    });
  }
  //==============================================================================
  // 문자열 텍스처 엔트리 반환. (없으면 굽기 후 반환)
  // - mode: "fill" 또는 "stroke".
  // - 반환 필드는 전부 논리 좌표(스케일 나눔) 기준.
  //==============================================================================
  /**
   * @param { string } mode
   * @param { string } text
   * @param { string } fontString
   * @param { string } colorString
   * @param { number } lineWidth
   * @param { number } scale
   * @returns { object | null }
   */
  getEntry(mode, text, fontString, colorString, lineWidth, scale) {
    if (!text) {
      return null;
    }
    const entryKey = `${mode}|${scale}|${lineWidth}|${colorString}|${fontString}|${text}`;
    const entries = this.getEntries();
    if (entries.has(entryKey)) {
      const entry2 = entries.get(entryKey);
      entries.delete(entryKey);
      entries.set(entryKey, entry2);
      return entry2;
    }
    const entry = this.bakeEntry(mode, text, fontString, colorString, lineWidth, scale);
    if (!entry) {
      return null;
    }
    entries.set(entryKey, entry);
    const webGL2RenderingContext = this.getWebGL2RenderingContext();
    while (entries.size > MAXIMUM_ENTRY_COUNT) {
      const oldestEntryKey = entries.keys().next().value;
      const oldestEntry = entries.get(oldestEntryKey);
      webGL2RenderingContext.deleteTexture(oldestEntry.texture);
      entries.delete(oldestEntryKey);
    }
    return entry;
  }
  //==============================================================================
  // 문자열을 오프스크린 캔버스에 굽고 텍스처로 업로드.
  //==============================================================================
  /**
   * @param { string } mode
   * @param { string } text
   * @param { string } fontString
   * @param { string } colorString
   * @param { number } lineWidth
   * @param { number } scale
   * @returns { object | null }
   */
  bakeEntry(mode, text, fontString, colorString, lineWidth, scale) {
    const bakeCanvas = this.getBakeCanvas();
    const bakeCanvasRenderingContext = this.getBakeCanvasRenderingContext();
    const scaledFontString = this.buildScaledFontString(fontString, scale);
    bakeCanvasRenderingContext.font = scaledFontString;
    const scaledTextMetrics = bakeCanvasRenderingContext.measureText(text);
    const actualLeft = ceil(max(scaledTextMetrics.actualBoundingBoxLeft || 0, 0));
    const actualRight = ceil(max(scaledTextMetrics.actualBoundingBoxRight || scaledTextMetrics.width, 0));
    let scaledFontAscent = scaledTextMetrics.fontBoundingBoxAscent;
    if (scaledFontAscent === void 0) {
      scaledFontAscent = scaledTextMetrics.actualBoundingBoxAscent || 0;
    }
    let scaledFontDescent = scaledTextMetrics.fontBoundingBoxDescent;
    if (scaledFontDescent === void 0) {
      scaledFontDescent = scaledTextMetrics.actualBoundingBoxDescent || 0;
    }
    const scaledPadding = ceil(lineWidth * scale / 2) + 2;
    const scaledPenX = scaledPadding + actualLeft;
    const scaledBaselineY = scaledPadding + ceil(scaledFontAscent);
    const bakeWidth = scaledPenX + actualRight + scaledPadding;
    const bakeHeight = scaledBaselineY + ceil(scaledFontDescent) + scaledPadding;
    if (bakeWidth <= 0 || bakeHeight <= 0) {
      return null;
    }
    bakeCanvas.width = bakeWidth;
    bakeCanvas.height = bakeHeight;
    bakeCanvasRenderingContext.clearRect(0, 0, bakeWidth, bakeHeight);
    bakeCanvasRenderingContext.font = scaledFontString;
    bakeCanvasRenderingContext.textAlign = "left";
    bakeCanvasRenderingContext.textBaseline = "alphabetic";
    if (mode === "stroke") {
      bakeCanvasRenderingContext.strokeStyle = colorString;
      bakeCanvasRenderingContext.lineWidth = lineWidth * scale;
      bakeCanvasRenderingContext.strokeText(text, scaledPenX, scaledBaselineY);
    } else {
      bakeCanvasRenderingContext.fillStyle = colorString;
      bakeCanvasRenderingContext.fillText(text, scaledPenX, scaledBaselineY);
    }
    const webGL2RenderingContext = this.getWebGL2RenderingContext();
    const texture = webGL2RenderingContext.createTexture();
    webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
    webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, bakeCanvas);
    webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
    webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
    webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.LINEAR);
    webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.LINEAR);
    const entry = {
      texture,
      quadWidth: bakeWidth / scale,
      quadHeight: bakeHeight / scale,
      penOffsetX: scaledPenX / scale,
      baselineOffsetY: scaledBaselineY / scale,
      advanceWidth: scaledTextMetrics.width / scale,
      fontAscent: scaledFontAscent / scale,
      fontDescent: scaledFontDescent / scale
    };
    return entry;
  }
  //==============================================================================
  // 모든 엔트리 파기. (텍스처 삭제 포함)
  //==============================================================================
  clear() {
    const webGL2RenderingContext = this.getWebGL2RenderingContext();
    const entries = this.getEntries();
    for (const entry of entries.values()) {
      webGL2RenderingContext.deleteTexture(entry.texture);
    }
    entries.clear();
  }
  //==============================================================================
  // 렌더링 컨텍스트 반환.
  //==============================================================================
  /**
   * @returns { WebGL2RenderingContext }
   */
  getWebGL2RenderingContext() {
    return this.#webGL2RenderingContext;
  }
  //==============================================================================
  // 엔트리 맵 반환.
  //==============================================================================
  /**
   * @returns { Map<string, object> }
   */
  getEntries() {
    return this.#entries;
  }
  //==============================================================================
  // 굽기용 캔버스 반환.
  //==============================================================================
  /**
   * @returns { HTMLCanvasElement }
   */
  getBakeCanvas() {
    return this.#bakeCanvas;
  }
  //==============================================================================
  // 굽기용 캔버스 렌더링 컨텍스트 반환.
  //==============================================================================
  /**
   * @returns { CanvasRenderingContext2D }
   */
  getBakeCanvasRenderingContext() {
    return this.#bakeCanvasRenderingContext;
  }
  //==============================================================================
  // 측정용 캔버스 렌더링 컨텍스트 반환.
  //==============================================================================
  /**
   * @returns { CanvasRenderingContext2D }
   */
  getMeasurementCanvasRenderingContext() {
    return this.#measurementCanvasRenderingContext;
  }
};

// src/core/graphic.js
var VERTEXSHADER_SOURCE = `#version 300 es
in vec2 vertexPosition;
in vec2 vertexTextureCoordinate;
uniform mat3 projectionMatrix;
uniform mat3 modelMatrix;
out vec2 fragmentTextureCoordinate;
void main() {
	vec3 transformedPosition = projectionMatrix * (modelMatrix * vec3(vertexPosition, 1.0));
	gl_Position = vec4(transformedPosition.xy, 0.0, 1.0);
	fragmentTextureCoordinate = vertexTextureCoordinate;
}
`;
var FRAGMENTSHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
uniform sampler2D mainTexture;
uniform vec4 mainColor;
uniform vec4 tintColor;
uniform float globalAlpha;
out vec4 outputColor;
void main() {
	vec4 textureColor = texture(mainTexture, fragmentTextureCoordinate);
	vec3 tintedColor = mix(textureColor.rgb, tintColor.rgb * textureColor.a, tintColor.a);
	float finalAlpha = textureColor.a * mainColor.a * globalAlpha;
	vec3 finalColor = tintedColor * mainColor.rgb * mainColor.a * globalAlpha;
	outputColor = vec4(finalColor, finalAlpha);
}
`;
var FLOATS_PER_VERTEX = 4;
var VERTEX_CAPACITY = 4096;
var CORNER_SEGMENT_COUNT = 8;
var MAXIMUM_TEXT_BAKE_SCALE = 8;
function parseColorValue(colorValue) {
  if (colorValue instanceof Color) {
    return colorValue.clone();
  }
  if (typeof colorValue === "string") {
    const trimmedColorString = colorValue.trim().toLowerCase();
    if (trimmedColorString.startsWith("#")) {
      return Color.createFromHEX(trimmedColorString);
    }
    if (trimmedColorString.startsWith("rgb")) {
      return Color.createFromRGBA(trimmedColorString);
    }
  }
  return Color.white();
}
__name(parseColorValue, "parseColorValue");
var Graphic = class extends Object2 {
  static {
    __name(this, "Graphic");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { HTMLCanvasElement } */
  #canvas;
  /** @private @type { WebGL2RenderingContext } */
  #webGL2RenderingContext;
  /** @private @type { boolean } */
  #isForceGizmosVisible;
  /** @private @type { boolean } */
  #isImageSmoothingEnabled;
  /** @private @type { string } */
  #imageSmoothingQuality;
  /** @private @type { ShaderProgram } */
  #shaderProgram;
  /** @private @type { WebGLVertexArrayObject } */
  #vertexArray;
  /** @private @type { WebGLBuffer } */
  #vertexBuffer;
  /** @private @type { Float32Array } */
  #vertexData;
  /** @private @type { WebGLTexture } */
  #whiteTexture;
  /** @private @type { ImageTextureCache } */
  #imageTextureCache;
  /** @private @type { TextStringTextureCache } */
  #textStringTextureCache;
  /** @private @type { TransformMatrix } */
  #transformMatrix;
  /** @private @type { object[] } */
  #stateStack;
  /** @private @type { number } */
  #globalAlpha;
  /** @private @type { string } */
  #blendMode;
  /** @private @type { Map<string, number[]> } */
  #blendFunctionTable;
  /** @private @type { Set<string> } */
  #warnedBlendModes;
  /** @private @type { Color } */
  #fillColor;
  /** @private @type { Color } */
  #strokeColor;
  /** @private @type { Color } */
  #whiteColor;
  /** @private @type { Color | null } */
  #imageTintColor;
  /** @private @type { string } */
  #fontString;
  /** @private @type { string } */
  #textAlign;
  /** @private @type { string } */
  #textBaseline;
  /** @private @type { object[] } */
  #clipStack;
  /** @private @type { Float32Array } */
  #projectionMatrixArray;
  /** @private @type { Float32Array } */
  #modelMatrixArray;
  /** @private @type { number } */
  #appliedViewportWidth;
  /** @private @type { number } */
  #appliedViewportHeight;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   * @param { HTMLCanvasElement } canvas
   */
  constructor(canvas) {
    super();
    const webGL2RenderingContext = canvas.getContext("webgl2", { alpha: false, stencil: true, premultipliedAlpha: true });
    if (!webGL2RenderingContext) {
      throw new Error("WebGL2 Not Supported.");
    }
    this.#canvas = canvas;
    this.#webGL2RenderingContext = webGL2RenderingContext;
    this.#isForceGizmosVisible = false;
    this.#isImageSmoothingEnabled = true;
    this.#imageSmoothingQuality = "high";
    this.#shaderProgram = new ShaderProgram(webGL2RenderingContext, VERTEXSHADER_SOURCE, FRAGMENTSHADER_SOURCE);
    this.#vertexData = new Float32Array(VERTEX_CAPACITY * FLOATS_PER_VERTEX);
    this.#vertexArray = webGL2RenderingContext.createVertexArray();
    this.#vertexBuffer = webGL2RenderingContext.createBuffer();
    webGL2RenderingContext.bindVertexArray(this.#vertexArray);
    webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#vertexBuffer);
    webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, this.#vertexData.byteLength, webGL2RenderingContext.DYNAMIC_DRAW);
    const shaderProgram = this.getShaderProgram();
    const vertexPositionLocation = shaderProgram.getAttributeLocation("vertexPosition");
    const vertexTextureCoordinateLocation = shaderProgram.getAttributeLocation("vertexTextureCoordinate");
    const strideBytes = FLOATS_PER_VERTEX * 4;
    webGL2RenderingContext.enableVertexAttribArray(vertexPositionLocation);
    webGL2RenderingContext.vertexAttribPointer(vertexPositionLocation, 2, webGL2RenderingContext.FLOAT, false, strideBytes, 0);
    webGL2RenderingContext.enableVertexAttribArray(vertexTextureCoordinateLocation);
    webGL2RenderingContext.vertexAttribPointer(vertexTextureCoordinateLocation, 2, webGL2RenderingContext.FLOAT, false, strideBytes, 8);
    webGL2RenderingContext.bindVertexArray(null);
    this.#whiteTexture = webGL2RenderingContext.createTexture();
    webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, this.#whiteTexture);
    const whitePixel = new Uint8Array([255, 255, 255, 255]);
    webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA, 1, 1, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, whitePixel);
    webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.NEAREST);
    webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.NEAREST);
    this.#imageTextureCache = new ImageTextureCache(webGL2RenderingContext);
    this.#textStringTextureCache = new TextStringTextureCache(webGL2RenderingContext);
    this.#transformMatrix = new TransformMatrix();
    this.#stateStack = [];
    this.#globalAlpha = 1;
    this.#blendMode = "source-over";
    this.#warnedBlendModes = /* @__PURE__ */ new Set();
    this.#fillColor = Color.black();
    this.#strokeColor = Color.black();
    this.#whiteColor = Color.white();
    this.#imageTintColor = null;
    this.#fontString = "10px sans-serif";
    this.#textAlign = "start";
    this.#textBaseline = "alphabetic";
    this.#clipStack = [];
    this.#projectionMatrixArray = new Float32Array(9);
    this.#modelMatrixArray = new Float32Array(9);
    this.#appliedViewportWidth = 0;
    this.#appliedViewportHeight = 0;
    this.#blendFunctionTable = /* @__PURE__ */ new Map([
      ["source-over", [webGL2RenderingContext.ONE, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA]],
      ["lighter", [webGL2RenderingContext.ONE, webGL2RenderingContext.ONE]],
      ["multiply", [webGL2RenderingContext.DST_COLOR, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA]],
      ["screen", [webGL2RenderingContext.ONE, webGL2RenderingContext.ONE_MINUS_SRC_COLOR]],
      ["destination-over", [webGL2RenderingContext.ONE_MINUS_DST_ALPHA, webGL2RenderingContext.ONE]],
      ["destination-out", [webGL2RenderingContext.ZERO, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA]],
      ["source-in", [webGL2RenderingContext.DST_ALPHA, webGL2RenderingContext.ZERO]],
      ["destination-in", [webGL2RenderingContext.ZERO, webGL2RenderingContext.SRC_ALPHA]],
      ["copy", [webGL2RenderingContext.ONE, webGL2RenderingContext.ZERO]]
    ]);
    webGL2RenderingContext.enable(webGL2RenderingContext.BLEND);
    webGL2RenderingContext.blendFunc(webGL2RenderingContext.ONE, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA);
    webGL2RenderingContext.disable(webGL2RenderingContext.DEPTH_TEST);
    webGL2RenderingContext.disable(webGL2RenderingContext.CULL_FACE);
    shaderProgram.use();
    const mainTextureLocation = shaderProgram.getUniformLocation("mainTexture");
    webGL2RenderingContext.uniform1i(mainTextureLocation, 0);
    webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
  }
  //==============================================================================
  // 설정 반영. (매 프레임 시작 시 엔진이 호출)
  // - 캔버스 크기 변화 감지 및 뷰포트/프로젝션 갱신.
  // - 프레임 시작 기준 상태로 리셋.
  //==============================================================================
  /**
   * @param { Engine } engine
   */
  applySettings(engine) {
    const webGL2RenderingContext = this.getWebGL2RenderingContext();
    const shaderProgram = this.getShaderProgram();
    const drawingBufferWidth = webGL2RenderingContext.drawingBufferWidth;
    const drawingBufferHeight = webGL2RenderingContext.drawingBufferHeight;
    if (drawingBufferWidth !== this.#appliedViewportWidth || drawingBufferHeight !== this.#appliedViewportHeight) {
      webGL2RenderingContext.viewport(0, 0, drawingBufferWidth, drawingBufferHeight);
      this.#projectionMatrixArray[0] = 2 / drawingBufferWidth;
      this.#projectionMatrixArray[1] = 0;
      this.#projectionMatrixArray[2] = 0;
      this.#projectionMatrixArray[3] = 0;
      this.#projectionMatrixArray[4] = -2 / drawingBufferHeight;
      this.#projectionMatrixArray[5] = 0;
      this.#projectionMatrixArray[6] = -1;
      this.#projectionMatrixArray[7] = 1;
      this.#projectionMatrixArray[8] = 1;
      this.#appliedViewportWidth = drawingBufferWidth;
      this.#appliedViewportHeight = drawingBufferHeight;
    }
    shaderProgram.use();
    webGL2RenderingContext.bindVertexArray(this.getVertexArray());
    webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.getVertexBuffer());
    const projectionMatrixLocation = shaderProgram.getUniformLocation("projectionMatrix");
    webGL2RenderingContext.uniformMatrix3fv(projectionMatrixLocation, false, this.#projectionMatrixArray);
    this.#stateStack.length = 0;
    this.#transformMatrix.setIdentity();
    this.#globalAlpha = 1;
    this.#imageTintColor = null;
    this.setBlendMode("source-over");
    if (this.#clipStack.length > 0) {
      this.#clipStack.length = 0;
      webGL2RenderingContext.disable(webGL2RenderingContext.STENCIL_TEST);
    }
    webGL2RenderingContext.clearStencil(0);
    webGL2RenderingContext.clear(webGL2RenderingContext.STENCIL_BUFFER_BIT);
  }
  //==============================================================================
  // 이미지 스무딩 활성화 여부 설정.
  // - 도트(픽셀) 스프라이트 게임은 false 로 설정해 선명하게 렌더링.
  //==============================================================================
  /**
   * @param { boolean } value
   */
  setImageSmoothingEnabled(value) {
    this.#isImageSmoothingEnabled = value;
  }
  //==============================================================================
  // 이미지 스무딩 활성화 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isImageSmoothingEnabled() {
    return this.#isImageSmoothingEnabled;
  }
  //==============================================================================
  // 이미지 스무딩 퀄리티 설정. ("low", "medium", "high")
  // - WebGL2 에서는 LINEAR/NEAREST 이분법이라 보관만 한다.
  //==============================================================================
  /**
   * @param { string } value
   */
  setImageSmoothingQuality(value) {
    this.#imageSmoothingQuality = value;
  }
  //==============================================================================
  // 모든 기즈모 강제 표시 설정.
  //==============================================================================
  /**
   * @param { boolean } isForceGizmosVisible
   */
  setForceGizmosVisible(isForceGizmosVisible) {
    this.#isForceGizmosVisible = isForceGizmosVisible;
  }
  //==============================================================================
  // 모든 기즈모 강제 표시 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isForceGizmosVisible() {
    return this.#isForceGizmosVisible;
  }
  //==============================================================================
  // 상태 저장. (변환/알파/블렌드/색상/폰트/틴트 — Canvas2D save 대응)
  //==============================================================================
  pushState() {
    const stateSnapshot = {
      transformMatrix: this.#transformMatrix.clone(),
      globalAlpha: this.#globalAlpha,
      blendMode: this.#blendMode,
      fillColor: this.#fillColor,
      strokeColor: this.#strokeColor,
      imageTintColor: this.#imageTintColor,
      fontString: this.#fontString,
      textAlign: this.#textAlign,
      textBaseline: this.#textBaseline
    };
    this.#stateStack.push(stateSnapshot);
  }
  //==============================================================================
  // 상태 복원. (Canvas2D restore 대응)
  //==============================================================================
  popState() {
    const stateSnapshot = this.#stateStack.pop();
    if (!stateSnapshot) {
      return;
    }
    this.#transformMatrix = stateSnapshot.transformMatrix;
    this.#globalAlpha = stateSnapshot.globalAlpha;
    this.#fillColor = stateSnapshot.fillColor;
    this.#strokeColor = stateSnapshot.strokeColor;
    this.#imageTintColor = stateSnapshot.imageTintColor;
    this.#fontString = stateSnapshot.fontString;
    this.#textAlign = stateSnapshot.textAlign;
    this.#textBaseline = stateSnapshot.textBaseline;
    if (this.#blendMode !== stateSnapshot.blendMode) {
      this.setBlendMode(stateSnapshot.blendMode);
    }
  }
  //==============================================================================
  // 이동 변환 누적.
  //==============================================================================
  /**
   * @param { number } x
   * @param { number } y
   */
  translate(x, y) {
    this.#transformMatrix.translate(x, y);
  }
  //==============================================================================
  // 회전 변환 누적.
  //==============================================================================
  /**
   * @param { number } radian
   */
  rotate(radian) {
    this.#transformMatrix.rotate(radian);
  }
  //==============================================================================
  // 크기 변환 누적.
  //==============================================================================
  /**
   * @param { number } x
   * @param { number } y
   */
  scale(x, y) {
    this.#transformMatrix.scale(x, y);
  }
  //==============================================================================
  // 변환 행렬 직접 설정. (Canvas2D setTransform(a, b, c, d, e, f) 대응)
  //==============================================================================
  /**
   * @param { number } a
   * @param { number } b
   * @param { number } c
   * @param { number } d
   * @param { number } e
   * @param { number } f
   */
  setTransform(a, b, c, d, e, f) {
    this.#transformMatrix.setTransform(a, b, c, d, e, f);
  }
  //==============================================================================
  // 변환 행렬 초기화.
  //==============================================================================
  resetTransform() {
    this.#transformMatrix.setIdentity();
  }
  //==============================================================================
  // 현재 변환 행렬 반환.
  //==============================================================================
  /**
   * @returns { TransformMatrix }
   */
  getTransformMatrix() {
    return this.#transformMatrix;
  }
  //==============================================================================
  // 전역 투명도 설정.
  //==============================================================================
  /**
   * @param { number } value
   */
  setGlobalAlpha(value) {
    this.#globalAlpha = clamp01(value);
  }
  //==============================================================================
  // 전역 투명도 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getGlobalAlpha() {
    return this.#globalAlpha;
  }
  //==============================================================================
  // 전역 투명도 곱셈 누적. (노드 트리의 투명도 상속용)
  //==============================================================================
  /**
   * @param { number } value
   */
  multiplyGlobalAlpha(value) {
    this.#globalAlpha = clamp01(this.#globalAlpha * value);
  }
  //==============================================================================
  // 블렌드 모드 설정. (SpriteBlendMode 문자열 수용)
  // - 고정 블렌딩으로 재현 불가능한 모드는 source-over 로 폴백.
  //==============================================================================
  /**
   * @param { string } blendMode
   */
  setBlendMode(blendMode) {
    const webGL2RenderingContext = this.getWebGL2RenderingContext();
    let blendFunction = this.#blendFunctionTable.get(blendMode);
    if (!blendFunction) {
      if (!this.#warnedBlendModes.has(blendMode)) {
        this.#warnedBlendModes.add(blendMode);
        console.warn(`Graphic: unsupported blend mode "${blendMode}" \u2014 falling back to "source-over".`);
      }
      blendFunction = this.#blendFunctionTable.get("source-over");
    }
    this.#blendMode = blendMode;
    webGL2RenderingContext.blendFunc(blendFunction[0], blendFunction[1]);
  }
  //==============================================================================
  // 블렌드 모드 반환.
  //==============================================================================
  /**
   * @returns { string }
   */
  getBlendMode() {
    return this.#blendMode;
  }
  //==============================================================================
  // 이미지 틴트 색상 설정. (null 이면 해제)
  // - 이미지 실루엣(알파) 안쪽에만 tint.alpha 비율로 색을 덮는다.
  //==============================================================================
  /**
   * @param { Color | null } color
   */
  setImageTintColor(color) {
    if (color instanceof Color) {
      this.#imageTintColor = color.clone();
    } else {
      this.#imageTintColor = null;
    }
  }
  //==============================================================================
  // 이미지 틴트 색상 반환.
  //==============================================================================
  /**
   * @returns { Color | null }
   */
  getImageTintColor() {
    return this.#imageTintColor;
  }
  //==============================================================================
  // 색상 설정.
  //==============================================================================
  /**
   * @param { Color | string } color
   */
  setFillColor(color) {
    if (color) {
      this.#fillColor = parseColorValue(color);
    }
  }
  //==============================================================================
  // 채우기 색상 반환.
  //==============================================================================
  /**
   * @returns { Color }
   */
  getFillColor() {
    return this.#fillColor;
  }
  //==============================================================================
  // 색상 설정.
  //==============================================================================
  /**
   * @param { Color | string } color
   */
  setStrokeColor(color) {
    if (color) {
      this.#strokeColor = parseColorValue(color);
    }
  }
  //==============================================================================
  // 선 색상 반환.
  //==============================================================================
  /**
   * @returns { Color }
   */
  getStrokeColor() {
    return this.#strokeColor;
  }
  //==============================================================================
  // 버텍스 데이터에 쿼드(삼각형 2개, 버텍스 6개) 기록.
  // - 기록 후의 오프셋(플로트 단위)을 반환.
  //==============================================================================
  /**
   * @param { number } offset
   * @param { number } leftX
   * @param { number } topY
   * @param { number } rightX
   * @param { number } bottomY
   * @param { number } leftU
   * @param { number } topV
   * @param { number } rightU
   * @param { number } bottomV
   * @returns { number }
   */
  writeQuad(offset, leftX, topY, rightX, bottomY, leftU, topV, rightU, bottomV) {
    const vertexData = this.getVertexData();
    vertexData[offset++] = leftX;
    vertexData[offset++] = topY;
    vertexData[offset++] = leftU;
    vertexData[offset++] = topV;
    vertexData[offset++] = rightX;
    vertexData[offset++] = topY;
    vertexData[offset++] = rightU;
    vertexData[offset++] = topV;
    vertexData[offset++] = leftX;
    vertexData[offset++] = bottomY;
    vertexData[offset++] = leftU;
    vertexData[offset++] = bottomV;
    vertexData[offset++] = leftX;
    vertexData[offset++] = bottomY;
    vertexData[offset++] = leftU;
    vertexData[offset++] = bottomV;
    vertexData[offset++] = rightX;
    vertexData[offset++] = topY;
    vertexData[offset++] = rightU;
    vertexData[offset++] = topV;
    vertexData[offset++] = rightX;
    vertexData[offset++] = bottomY;
    vertexData[offset++] = rightU;
    vertexData[offset++] = bottomV;
    return offset;
  }
  //==============================================================================
  // 기록된 버텍스 출력. (모든 드로우가 수렴하는 단일 지점 — 추후 배칭 삽입 지점)
  //==============================================================================
  /**
   * @param { number } vertexCount
   * @param { WebGLTexture } texture
   * @param { Color } color
   */
  drawVertices(vertexCount, texture, color) {
    if (vertexCount <= 0) {
      return;
    }
    const webGL2RenderingContext = this.getWebGL2RenderingContext();
    const shaderProgram = this.getShaderProgram();
    webGL2RenderingContext.bufferSubData(webGL2RenderingContext.ARRAY_BUFFER, 0, this.getVertexData(), 0, vertexCount * FLOATS_PER_VERTEX);
    this.#transformMatrix.writeToFloat32Array(this.#modelMatrixArray);
    const modelMatrixLocation = shaderProgram.getUniformLocation("modelMatrix");
    webGL2RenderingContext.uniformMatrix3fv(modelMatrixLocation, false, this.#modelMatrixArray);
    const mainColorLocation = shaderProgram.getUniformLocation("mainColor");
    webGL2RenderingContext.uniform4f(mainColorLocation, color.red, color.green, color.blue, color.alpha);
    const tintColorLocation = shaderProgram.getUniformLocation("tintColor");
    const imageTintColor = this.getImageTintColor();
    if (imageTintColor) {
      webGL2RenderingContext.uniform4f(tintColorLocation, imageTintColor.red, imageTintColor.green, imageTintColor.blue, imageTintColor.alpha);
    } else {
      webGL2RenderingContext.uniform4f(tintColorLocation, 0, 0, 0, 0);
    }
    const globalAlphaLocation = shaderProgram.getUniformLocation("globalAlpha");
    webGL2RenderingContext.uniform1f(globalAlphaLocation, this.getGlobalAlpha());
    webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
    webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, vertexCount);
  }
  //==============================================================================
  // 선 출력.
  // - setStrokeColor()
  //==============================================================================
  /**
   * @param { Vector2[] } positions
   */
  drawLine(positions, size = 1) {
    this.drawPolyline(positions, size, false);
  }
  //==============================================================================
  // 닫힌 선 출력. (마지막 점과 첫 점을 잇는 루프)
  // - setStrokeColor()
  //==============================================================================
  /**
   * @param { Vector2[] } positions
   */
  drawLineLoop(positions, size = 1) {
    this.drawPolyline(positions, size, true);
  }
  //==============================================================================
  // 폴리라인 출력. (세그먼트별 두께 확장 쿼드)
  // - 내부 조인트는 반두께 연장으로 이음새를 메운다.
  //==============================================================================
  /**
   * @param { Vector2[] } positions
   * @param { number } size
   * @param { boolean } isClosed
   */
  drawPolyline(positions, size, isClosed) {
    if (!positions || positions.length < 2) {
      return;
    }
    const halfSize = size / 2;
    const vertexData = this.getVertexData();
    const segmentCount = isClosed ? positions.length : positions.length - 1;
    let offset = 0;
    let vertexCount = 0;
    for (let segmentIndex = 0; segmentIndex < segmentCount; ++segmentIndex) {
      const startPosition = positions[segmentIndex];
      const endPosition = positions[(segmentIndex + 1) % positions.length];
      const deltaX = endPosition.x - startPosition.x;
      const deltaY = endPosition.y - startPosition.y;
      const length = sqrt(deltaX * deltaX + deltaY * deltaY);
      if (length <= 0) {
        continue;
      }
      const directionX = deltaX / length;
      const directionY = deltaY / length;
      const normalX = -directionY * halfSize;
      const normalY = directionX * halfSize;
      const hasStartJoint = isClosed || segmentIndex > 0;
      const hasEndJoint = isClosed || segmentIndex < segmentCount - 1;
      const startExtension = hasStartJoint ? halfSize : 0;
      const endExtension = hasEndJoint ? halfSize : 0;
      const extendedStartX = startPosition.x - directionX * startExtension;
      const extendedStartY = startPosition.y - directionY * startExtension;
      const extendedEndX = endPosition.x + directionX * endExtension;
      const extendedEndY = endPosition.y + directionY * endExtension;
      if ((vertexCount + 6) * FLOATS_PER_VERTEX > vertexData.length) {
        break;
      }
      vertexData[offset++] = extendedStartX + normalX;
      vertexData[offset++] = extendedStartY + normalY;
      vertexData[offset++] = 0.5;
      vertexData[offset++] = 0.5;
      vertexData[offset++] = extendedEndX + normalX;
      vertexData[offset++] = extendedEndY + normalY;
      vertexData[offset++] = 0.5;
      vertexData[offset++] = 0.5;
      vertexData[offset++] = extendedStartX - normalX;
      vertexData[offset++] = extendedStartY - normalY;
      vertexData[offset++] = 0.5;
      vertexData[offset++] = 0.5;
      vertexData[offset++] = extendedStartX - normalX;
      vertexData[offset++] = extendedStartY - normalY;
      vertexData[offset++] = 0.5;
      vertexData[offset++] = 0.5;
      vertexData[offset++] = extendedEndX + normalX;
      vertexData[offset++] = extendedEndY + normalY;
      vertexData[offset++] = 0.5;
      vertexData[offset++] = 0.5;
      vertexData[offset++] = extendedEndX - normalX;
      vertexData[offset++] = extendedEndY - normalY;
      vertexData[offset++] = 0.5;
      vertexData[offset++] = 0.5;
      vertexCount += 6;
    }
    const strokeColor = this.getStrokeColor();
    this.drawVertices(vertexCount, this.getWhiteTexture(), strokeColor);
  }
  //==============================================================================
  // 사각형 출력.
  // - setFillColor()
  //==============================================================================
  /**
   * @param { Rect } rect
   */
  drawRect(rect) {
    const leftX = rect.position.x;
    const topY = rect.position.y;
    const rightX = leftX + rect.size.x;
    const bottomY = topY + rect.size.y;
    const vertexCountOffset = this.writeQuad(0, leftX, topY, rightX, bottomY, 0.5, 0.5, 0.5, 0.5);
    const fillColor = this.getFillColor();
    this.drawVertices(vertexCountOffset / FLOATS_PER_VERTEX, this.getWhiteTexture(), fillColor);
  }
  //==============================================================================
  // 사각형 외곽선 출력. (Canvas2D strokeRect 대응 — 선 중심이 경계선 위)
  // - setStrokeColor()
  //==============================================================================
  /**
   * @param { Rect } rect
   * @param { number } lineWidth
   */
  drawStrokeRect(rect, lineWidth = 1) {
    const leftX = rect.position.x;
    const topY = rect.position.y;
    const rightX = leftX + rect.size.x;
    const bottomY = topY + rect.size.y;
    const positions = [
      Vector2.create(leftX, topY),
      Vector2.create(rightX, topY),
      Vector2.create(rightX, bottomY),
      Vector2.create(leftX, bottomY)
    ];
    this.drawLineLoop(positions, lineWidth);
  }
  //==============================================================================
  // 라운드 사각형 경로 좌표 목록 생성. (시계 방향, 볼록 다각형)
  //==============================================================================
  /**
   * @param { Rect } rect
   * @param { number } roundSize
   * @returns { Vector2[] }
   */
  buildRoundRectPositions(rect, roundSize) {
    const leftX = rect.position.x;
    const topY = rect.position.y;
    const rightX = leftX + rect.size.x;
    const bottomY = topY + rect.size.y;
    const clampedRoundSize = min(roundSize, min(abs(rect.size.x), abs(rect.size.y)) / 2);
    const cornerCenters = [
      { x: rightX - clampedRoundSize, y: topY + clampedRoundSize, startRadian: -PI / 2 },
      { x: rightX - clampedRoundSize, y: bottomY - clampedRoundSize, startRadian: 0 },
      { x: leftX + clampedRoundSize, y: bottomY - clampedRoundSize, startRadian: PI / 2 },
      { x: leftX + clampedRoundSize, y: topY + clampedRoundSize, startRadian: PI }
    ];
    const positions = [];
    for (const cornerCenter of cornerCenters) {
      for (let segmentIndex = 0; segmentIndex <= CORNER_SEGMENT_COUNT; ++segmentIndex) {
        const radian = cornerCenter.startRadian + PI / 2 * (segmentIndex / CORNER_SEGMENT_COUNT);
        const positionX = cornerCenter.x + cos(radian) * clampedRoundSize;
        const positionY = cornerCenter.y + sin(radian) * clampedRoundSize;
        positions.push(Vector2.create(positionX, positionY));
      }
    }
    return positions;
  }
  //==============================================================================
  // 볼록 다각형 채움 출력. (첫 점 기준 팬 분할)
  //==============================================================================
  /**
   * @param { Vector2[] } positions
   * @param { Color } color
   */
  drawConvexPolygon(positions, color) {
    if (!positions || positions.length < 3) {
      return;
    }
    const vertexData = this.getVertexData();
    let offset = 0;
    let vertexCount = 0;
    const firstPosition = positions[0];
    for (let positionIndex = 1; positionIndex < positions.length - 1; ++positionIndex) {
      if ((vertexCount + 3) * FLOATS_PER_VERTEX > vertexData.length) {
        break;
      }
      const secondPosition = positions[positionIndex];
      const thirdPosition = positions[positionIndex + 1];
      vertexData[offset++] = firstPosition.x;
      vertexData[offset++] = firstPosition.y;
      vertexData[offset++] = 0.5;
      vertexData[offset++] = 0.5;
      vertexData[offset++] = secondPosition.x;
      vertexData[offset++] = secondPosition.y;
      vertexData[offset++] = 0.5;
      vertexData[offset++] = 0.5;
      vertexData[offset++] = thirdPosition.x;
      vertexData[offset++] = thirdPosition.y;
      vertexData[offset++] = 0.5;
      vertexData[offset++] = 0.5;
      vertexCount += 3;
    }
    this.drawVertices(vertexCount, this.getWhiteTexture(), color);
  }
  //==============================================================================
  // 라운드 사각형 출력.
  // - setFillColor()
  //==============================================================================
  /**
   * @param { Rect } rect
   * @param { number } roundSize
   */
  drawRoundRect(rect, roundSize) {
    if (roundSize > 0) {
      const positions = this.buildRoundRectPositions(rect, roundSize);
      const fillColor = this.getFillColor();
      this.drawConvexPolygon(positions, fillColor);
    } else {
      this.drawRect(rect);
    }
  }
  //==============================================================================
  // 라운드 사각형 외곽선 출력.
  // - setStrokeColor()
  //==============================================================================
  /**
   * @param { Rect } rect
   * @param { number } roundSize
   * @param { number } lineWidth
   */
  drawStrokeRoundRect(rect, roundSize, lineWidth = 1) {
    if (roundSize > 0) {
      const positions = this.buildRoundRectPositions(rect, roundSize);
      this.drawLineLoop(positions, lineWidth);
    } else {
      this.drawStrokeRect(rect, lineWidth);
    }
  }
  //==============================================================================
  // 원 출력.
  // - setFillColor()
  //==============================================================================
  /**
   * @param { Vector2 } center
   * @param { number } radius
   */
  drawCircle(center, radius) {
    if (radius <= 0) {
      return;
    }
    const maximumScale = this.#transformMatrix.getMaximumScale();
    const segmentCount = clamp(ceil(radius * maximumScale * 0.5), 16, 64);
    const positions = [];
    for (let segmentIndex = 0; segmentIndex < segmentCount; ++segmentIndex) {
      const radian = PI * 2 * (segmentIndex / segmentCount);
      const positionX = center.x + cos(radian) * radius;
      const positionY = center.y + sin(radian) * radius;
      positions.push(Vector2.create(positionX, positionY));
    }
    const fillColor = this.getFillColor();
    this.drawConvexPolygon(positions, fillColor);
  }
  //==============================================================================
  // 원 외곽선 출력.
  // - setStrokeColor()
  //==============================================================================
  /**
   * @param { Vector2 } center
   * @param { number } radius
   * @param { number } lineWidth
   */
  drawStrokeCircle(center, radius, lineWidth = 1) {
    if (radius <= 0) {
      return;
    }
    const maximumScale = this.#transformMatrix.getMaximumScale();
    const segmentCount = clamp(ceil(radius * maximumScale * 0.5), 16, 64);
    const positions = [];
    for (let segmentIndex = 0; segmentIndex < segmentCount; ++segmentIndex) {
      const radian = PI * 2 * (segmentIndex / segmentCount);
      const positionX = center.x + cos(radian) * radius;
      const positionY = center.y + sin(radian) * radius;
      positions.push(Vector2.create(positionX, positionY));
    }
    this.drawLineLoop(positions, lineWidth);
  }
  //==============================================================================
  // 이미지 출력.
  // - setFillColor() Not Supported.
  //==============================================================================
  /**
   * @param { HTMLImageElement | HTMLCanvasElement } image
   * @param { Vector2 } position
   * @param { Vector2 } contentSize
   */
  drawImage(image, position, contentSize) {
    if (image === null || image === void 0) {
      throw new Error("image is null");
    }
    this.drawImageWithSourceAndDestination(
      image,
      0,
      0,
      image.width,
      image.height,
      position.x,
      position.y,
      contentSize.x,
      contentSize.y
    );
  }
  //==============================================================================
  // 이미지의 일부만 출력.
  // - setFillColor() Not Supported.
  //==============================================================================
  /**
   * @param { HTMLImageElement | HTMLCanvasElement } image
   * @param { Vector2 } position
   * @param { Vector2 } contentSize
   * @param { Rect } imageRect
   */
  drawImageWithImageRect(image, position, contentSize, imageRect) {
    if (image === null || image === void 0) {
      throw new Error("image is null");
    }
    if (imageRect === null || imageRect === void 0 || imageRect.equals(Rect.zero())) {
      imageRect = Rect.create(0, 0, image.width, image.height);
    }
    this.drawImageWithSourceAndDestination(
      image,
      imageRect.position.x,
      imageRect.position.y,
      imageRect.size.x,
      imageRect.size.y,
      position.x,
      position.y,
      contentSize.x,
      contentSize.y
    );
  }
  //==============================================================================
  // 이미지의 소스 영역을 지정 영역에 출력. (Canvas2D drawImage 9인자 대응)
  //==============================================================================
  /**
   * @param { HTMLImageElement | HTMLCanvasElement } image
   * @param { number } sourceX
   * @param { number } sourceY
   * @param { number } sourceWidth
   * @param { number } sourceHeight
   * @param { number } destinationX
   * @param { number } destinationY
   * @param { number } destinationWidth
   * @param { number } destinationHeight
   */
  drawImageWithSourceAndDestination(image, sourceX, sourceY, sourceWidth, sourceHeight, destinationX, destinationY, destinationWidth, destinationHeight) {
    const imageTextureCache = this.getImageTextureCache();
    const isImageSmoothingEnabled = this.isImageSmoothingEnabled();
    const texture = imageTextureCache.getTexture(image, isImageSmoothingEnabled);
    if (!texture) {
      return;
    }
    const imageWidth = image.width;
    const imageHeight = image.height;
    const leftU = sourceX / imageWidth;
    const topV = sourceY / imageHeight;
    const rightU = (sourceX + sourceWidth) / imageWidth;
    const bottomV = (sourceY + sourceHeight) / imageHeight;
    const vertexCountOffset = this.writeQuad(
      0,
      destinationX,
      destinationY,
      destinationX + destinationWidth,
      destinationY + destinationHeight,
      leftU,
      topV,
      rightU,
      bottomV
    );
    const whiteColor = this.getWhiteColor();
    this.drawVertices(vertexCountOffset / FLOATS_PER_VERTEX, texture, whiteColor);
  }
  //==============================================================================
  // 이미지 나인패치 출력.
  // - setFillColor() Not Supported.
  //==============================================================================
  /**
   * @static
   * @param { HTMLImageElement | HTMLCanvasElement } image
   * @param { Vector2 } position
   * @param { Vector2 } size
   * @param { Rect } nineSlice
   */
  drawImageWithNineSlice(image, position, size, nineSlice) {
    const sw = image.width;
    const sh = image.height;
    const dx = floor(position.x);
    const dy = floor(position.y);
    const left = nineSlice.position.x;
    const top = nineSlice.position.y;
    const right = nineSlice.size.x;
    const bottom = nineSlice.size.y;
    const dw = max(ceil(size.x), left + right);
    const dh = max(ceil(size.y), top + bottom);
    const hasHorizontal = left > 0 || right > 0;
    const hasVertical = top > 0 || bottom > 0;
    if (hasHorizontal && hasVertical) {
      const centerSrcW = sw - left - right;
      const centerSrcH = sh - top - bottom;
      const centerDstW = dw - left - right;
      const centerDstH = dh - top - bottom;
      this.drawImageWithSourceAndDestination(image, 0, 0, left, top, dx, dy, left + 1, top + 1);
      this.drawImageWithSourceAndDestination(image, left, 0, centerSrcW, top, dx + left, dy, centerDstW + 1, top + 1);
      this.drawImageWithSourceAndDestination(image, sw - right, 0, right, top, dx + dw - right, dy, right, top + 1);
      this.drawImageWithSourceAndDestination(image, 0, top, left, centerSrcH, dx, dy + top, left + 1, centerDstH + 1);
      this.drawImageWithSourceAndDestination(image, left, top, centerSrcW, centerSrcH, dx + left, dy + top, centerDstW + 1, centerDstH + 1);
      this.drawImageWithSourceAndDestination(image, sw - right, top, right, centerSrcH, dx + dw - right, dy + top, right, centerDstH + 1);
      this.drawImageWithSourceAndDestination(image, 0, sh - bottom, left, bottom, dx, dy + dh - bottom, left + 1, bottom);
      this.drawImageWithSourceAndDestination(image, left, sh - bottom, centerSrcW, bottom, dx + left, dy + dh - bottom, centerDstW + 1, bottom);
      this.drawImageWithSourceAndDestination(image, sw - right, sh - bottom, right, bottom, dx + dw - right, dy + dh - bottom, right, bottom);
    } else if (hasHorizontal) {
      const centerSrcW = sw - left - right;
      const centerDstW = dw - left - right;
      this.drawImageWithSourceAndDestination(image, 0, 0, left, sh, dx, dy, left + 1, dh);
      this.drawImageWithSourceAndDestination(image, left, 0, centerSrcW, sh, dx + left, dy, centerDstW + 1, dh);
      this.drawImageWithSourceAndDestination(image, sw - right, 0, right, sh, dx + dw - right, dy, right, dh);
    } else if (hasVertical) {
      const centerSrcH = sh - top - bottom;
      const centerDstH = dh - top - bottom;
      this.drawImageWithSourceAndDestination(image, 0, 0, sw, top, dx, dy, dw, top + 1);
      this.drawImageWithSourceAndDestination(image, 0, top, sw, centerSrcH, dx, dy + top, dw, centerDstH + 1);
      this.drawImageWithSourceAndDestination(image, 0, sh - bottom, sw, bottom, dx, dy + dh - bottom, dw, bottom);
    } else {
      this.drawImageWithSourceAndDestination(image, 0, 0, sw, sh, dx, dy, dw, dh);
    }
  }
  //==============================================================================
  // 폰트 문자열 설정. (Canvas2D font 대응, 예: "16px DOSGothic")
  //==============================================================================
  /**
   * @param { string } fontString
   */
  setFontString(fontString) {
    if (fontString) {
      this.#fontString = fontString;
    }
  }
  //==============================================================================
  // 폰트 문자열 반환.
  //==============================================================================
  /**
   * @returns { string }
   */
  getFontString() {
    return this.#fontString;
  }
  //==============================================================================
  // 텍스트 가로 정렬 설정. ("left" | "center" | "right" | "start" | "end")
  //==============================================================================
  /**
   * @param { string } textAlign
   */
  setTextAlign(textAlign) {
    if (textAlign) {
      this.#textAlign = textAlign;
    }
  }
  //==============================================================================
  // 텍스트 가로 정렬 반환.
  //==============================================================================
  /**
   * @returns { string }
   */
  getTextAlign() {
    return this.#textAlign;
  }
  //==============================================================================
  // 텍스트 베이스라인 설정. ("top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom")
  //==============================================================================
  /**
   * @param { string } textBaseline
   */
  setTextBaseline(textBaseline) {
    if (textBaseline) {
      this.#textBaseline = textBaseline;
    }
  }
  //==============================================================================
  // 텍스트 베이스라인 반환.
  //==============================================================================
  /**
   * @returns { string }
   */
  getTextBaseline() {
    return this.#textBaseline;
  }
  //==============================================================================
  // 문자열 측정. (현재 폰트 기준, Canvas2D measureText 대응)
  //==============================================================================
  /**
   * @param { string } text
   * @returns { TextMetrics }
   */
  measureText(text) {
    const textStringTextureCache = this.getTextStringTextureCache();
    const fontString = this.getFontString();
    return textStringTextureCache.measureText(fontString, text);
  }
  //==============================================================================
  // 텍스트 베이크 스케일 계산. (현재 변환 행렬 기반, 0.25 단위 양자화)
  //==============================================================================
  /**
   * @returns { number }
   */
  calculateTextBakeScale() {
    const maximumScale = this.#transformMatrix.getMaximumScale();
    const quantizedScale = round(maximumScale * 4) / 4;
    return clamp(quantizedScale, 0.25, MAXIMUM_TEXT_BAKE_SCALE);
  }
  //==============================================================================
  // 문자열 텍스처 엔트리를 정렬/베이스라인에 맞춰 쿼드로 출력.
  //==============================================================================
  /**
   * @param { object } entry
   * @param { number } x
   * @param { number } y
   */
  drawTextEntry(entry, x, y) {
    const textAlign = this.getTextAlign();
    let alignOffset = 0;
    if (textAlign === "center") {
      alignOffset = -entry.advanceWidth / 2;
    } else if (textAlign === "right" || textAlign === "end") {
      alignOffset = -entry.advanceWidth;
    }
    const textBaseline = this.getTextBaseline();
    let baselineOffset = 0;
    if (textBaseline === "top") {
      baselineOffset = entry.fontAscent;
    } else if (textBaseline === "hanging") {
      baselineOffset = entry.fontAscent * 0.8;
    } else if (textBaseline === "middle") {
      baselineOffset = (entry.fontAscent - entry.fontDescent) / 2;
    } else if (textBaseline === "ideographic" || textBaseline === "bottom") {
      baselineOffset = -entry.fontDescent;
    }
    const quadX = x + alignOffset - entry.penOffsetX;
    const quadY = y + baselineOffset - entry.baselineOffsetY;
    const vertexCountOffset = this.writeQuad(
      0,
      quadX,
      quadY,
      quadX + entry.quadWidth,
      quadY + entry.quadHeight,
      0,
      0,
      1,
      1
    );
    const whiteColor = this.getWhiteColor();
    this.drawVertices(vertexCountOffset / FLOATS_PER_VERTEX, entry.texture, whiteColor);
  }
  //==============================================================================
  // 텍스트 채움 출력. (Canvas2D fillText 대응)
  // - setFillColor() / setFontString() / setTextAlign() / setTextBaseline()
  //==============================================================================
  /**
   * @param { string } text
   * @param { number } x
   * @param { number } y
   */
  drawFillText(text, x, y) {
    if (!text) {
      return;
    }
    const textStringTextureCache = this.getTextStringTextureCache();
    const fontString = this.getFontString();
    const fillColor = this.getFillColor();
    const fillColorString = fillColor.toHEXString();
    const bakeScale = this.calculateTextBakeScale();
    const entry = textStringTextureCache.getEntry("fill", text, fontString, fillColorString, 0, bakeScale);
    if (!entry) {
      return;
    }
    this.drawTextEntry(entry, x, y);
  }
  //==============================================================================
  // 텍스트 외곽선 출력. (Canvas2D strokeText 대응)
  // - setStrokeColor() / setFontString() / setTextAlign() / setTextBaseline()
  //==============================================================================
  /**
   * @param { string } text
   * @param { number } x
   * @param { number } y
   * @param { number } lineWidth
   */
  drawStrokeText(text, x, y, lineWidth = 1) {
    if (!text) {
      return;
    }
    const textStringTextureCache = this.getTextStringTextureCache();
    const fontString = this.getFontString();
    const strokeColor = this.getStrokeColor();
    const strokeColorString = strokeColor.toHEXString();
    const bakeScale = this.calculateTextBakeScale();
    const entry = textStringTextureCache.getEntry("stroke", text, fontString, strokeColorString, lineWidth, bakeScale);
    if (!entry) {
      return;
    }
    this.drawTextEntry(entry, x, y);
  }
  //==============================================================================
  // 노드 출력.
  //==============================================================================
  /**
   * @param { TransformNode } node
   */
  drawNode(node) {
    if (node === null || node == void 0 || !node.isActive()) {
      return;
    }
    try {
      node.pushTransform(this);
      node.draw(this);
      const isForceGizmosVisible = this.isForceGizmosVisible();
      const isGizmoVisible = isForceGizmosVisible || node.isGizmoVisible();
      if (isGizmoVisible) {
        node.drawGizmos(this);
      }
      node.popTransform(this);
    } catch (error) {
      throw error;
    }
  }
  //==============================================================================
  // 출력 영역 제한 시작.
  // - 스텐실 버퍼 기반이라 회전/스케일이 걸린 영역도 정확히 잘린다.
  //==============================================================================
  /**
   * @type { Rect } rect
   */
  beginClipRect(rect) {
    this.pushState();
    const webGL2RenderingContext = this.getWebGL2RenderingContext();
    const previousClipDepth = this.#clipStack.length;
    this.#clipStack.push({
      rect: rect.clone(),
      transformMatrix: this.#transformMatrix.clone()
    });
    if (previousClipDepth === 0) {
      webGL2RenderingContext.enable(webGL2RenderingContext.STENCIL_TEST);
    }
    webGL2RenderingContext.colorMask(false, false, false, false);
    webGL2RenderingContext.stencilFunc(webGL2RenderingContext.ALWAYS, 0, 255);
    webGL2RenderingContext.stencilOp(webGL2RenderingContext.KEEP, webGL2RenderingContext.KEEP, webGL2RenderingContext.INCR);
    this.drawRect(rect);
    webGL2RenderingContext.colorMask(true, true, true, true);
    webGL2RenderingContext.stencilOp(webGL2RenderingContext.KEEP, webGL2RenderingContext.KEEP, webGL2RenderingContext.KEEP);
    webGL2RenderingContext.stencilFunc(webGL2RenderingContext.EQUAL, previousClipDepth + 1, 255);
  }
  //==============================================================================
  // 출력 영역 제한 종료.
  //==============================================================================
  endClipRect() {
    const clipEntry = this.#clipStack.pop();
    if (!clipEntry) {
      return;
    }
    const webGL2RenderingContext = this.getWebGL2RenderingContext();
    this.#transformMatrix = clipEntry.transformMatrix;
    webGL2RenderingContext.colorMask(false, false, false, false);
    webGL2RenderingContext.stencilFunc(webGL2RenderingContext.ALWAYS, 0, 255);
    webGL2RenderingContext.stencilOp(webGL2RenderingContext.KEEP, webGL2RenderingContext.KEEP, webGL2RenderingContext.DECR);
    this.drawRect(clipEntry.rect);
    webGL2RenderingContext.colorMask(true, true, true, true);
    webGL2RenderingContext.stencilOp(webGL2RenderingContext.KEEP, webGL2RenderingContext.KEEP, webGL2RenderingContext.KEEP);
    const clipDepth = this.#clipStack.length;
    if (clipDepth === 0) {
      webGL2RenderingContext.disable(webGL2RenderingContext.STENCIL_TEST);
    } else {
      webGL2RenderingContext.stencilFunc(webGL2RenderingContext.EQUAL, clipDepth, 255);
    }
    this.popState();
  }
  //==============================================================================
  // 캔버스 반환.
  //==============================================================================
  /**
   * @returns { HTMLCanvasElement }
   */
  getCanvas() {
    return this.#canvas;
  }
  //==============================================================================
  // WebGL2 렌더링 컨텍스트 반환.
  //==============================================================================
  /**
   * @returns { WebGL2RenderingContext }
   */
  getWebGL2RenderingContext() {
    return this.#webGL2RenderingContext;
  }
  //==============================================================================
  // 셰이더 프로그램 반환.
  //==============================================================================
  /**
   * @returns { ShaderProgram }
   */
  getShaderProgram() {
    return this.#shaderProgram;
  }
  //==============================================================================
  // 버텍스 어레이 반환.
  //==============================================================================
  /**
   * @returns { WebGLVertexArrayObject }
   */
  getVertexArray() {
    return this.#vertexArray;
  }
  //==============================================================================
  // 버텍스 버퍼 반환.
  //==============================================================================
  /**
   * @returns { WebGLBuffer }
   */
  getVertexBuffer() {
    return this.#vertexBuffer;
  }
  //==============================================================================
  // 스크래치 버텍스 데이터 반환.
  //==============================================================================
  /**
   * @returns { Float32Array }
   */
  getVertexData() {
    return this.#vertexData;
  }
  //==============================================================================
  // 흰색 텍스처 반환. (단색 도형용)
  //==============================================================================
  /**
   * @returns { WebGLTexture }
   */
  getWhiteTexture() {
    return this.#whiteTexture;
  }
  //==============================================================================
  // 흰색 색상 반환. (이미지/텍스트 출력용 기본 색상)
  //==============================================================================
  /**
   * @returns { Color }
   */
  getWhiteColor() {
    return this.#whiteColor;
  }
  //==============================================================================
  // 이미지 텍스처 캐시 반환.
  //==============================================================================
  /**
   * @returns { ImageTextureCache }
   */
  getImageTextureCache() {
    return this.#imageTextureCache;
  }
  //==============================================================================
  // 문자열 텍스처 캐시 반환.
  //==============================================================================
  /**
   * @returns { TextStringTextureCache }
   */
  getTextStringTextureCache() {
    return this.#textStringTextureCache;
  }
};

// src/core/viewmanager.js
var System9 = globalThis;
var ViewScaleMode = {
  // 사용안함 (웹브라우저 크기가 변경되면 뷰 영역도 변경됨)
  none: "none",
  // 기준해상도로 뷰 영역 정의 (양쪽 축이 잘리거나 남을 수 있음)
  referenceResolution: "referenceResolution",
  // 기준해상도로 뷰 영역 정의 + 뷰의 비율을 유지한채 가로축으로 늘여붙임. (반대 축은 잘리거나 남을 수 있음)
  stretchWidth: "stretchWidth",
  // 기준해상도로 뷰 영역 정의 + 뷰의 비율을 유지한채 세로축으로 늘여붙임. (반대 축은 잘리거나 남을 수 있음)
  stretchHeight: "stretchHeight",
  // 기준해상도로 뷰 영역 정의 + 뷰의 비율을 유지한채 가로세로 중에서 짧은 축으로 늘여붙임. (반대 축은 남을 수 있음)
  stretchShort: "stretchShort",
  // 가로를 화면 전체에 늘여붙임 (기준해상도 가로 = 항상 고정). 세로는 화면 비율에 따라 자동 산출. 양쪽 여백 없음. (대신 세로 해상도는 디스플레이에 따라 바뀜)
  stretchWidthExpandHeight: "stretchWidthExpandHeight",
  // 세로를 화면 전체에 늘여붙임 (기준해상도 세로 = 항상 고정). 가로는 화면 비율에 따라 자동 산출. 양쪽 여백 없음. (대신 가로 해상도는 디스플레이에 따라 바뀜)
  stretchHeightExpandWidth: "stretchHeightExpandWidth",
  // 짧은 축 기준 스케일. 긴 축도 화면 전체에 늘여붙임. 양쪽 여백 없음. (대신 긴 축 해상도는 디스플레이에 따라 바뀜)
  stretchShortExpandLong: "stretchShortExpandLong"
};
var ViewManager = class extends Object2 {
  static {
    __name(this, "ViewManager");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { HTMLCanvasElement } */
  #canvas;
  // 캔버스.
  /** @private @type { number } */
  #devicePixelRatio;
  // 장치의 화면 배율.
  /** @private @type { number } */
  #targetResolutionScale;
  // 기준 해상도와 화면 해상도 사이의 크기 배율.
  /** @private @type { Vector2 } */
  #clientNativeSize;
  // 웹페이지 전체 영역.
  /** @private @type { Vector2 } */
  #canvasNativeSize;
  // 캔버스의 전체 영역. (기본 좌표계 기준)
  /** @private @type { Vector2 } */
  #canvasPixelSize;
  // 캔버스 영역 내부의 픽셀 렌더링 기준 전체 화면 영역.
  /** @private @type { ViewScaleMode } */
  #viewScaleMode;
  // 스케일 모드.
  /** @private @type { Vector2 } */
  #referenceResolutionSize;
  // 기준 화면 크기.
  // /** @private @type { Vector2 } */ #screenSize; // 스케일 모드가 반영된 전체 화면 영역.	
  /** @private @type { Rect } */
  #viewNativeRect;
  // 스케일 모드가 반영된 실제 화면 영역. (canvasNativeSize 내부의 실제 사각영역)
  /** @private @type { Vector2 } */
  #viewSize;
  // 실제 사용 화면 크기.
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   * @param { Engine } engine
   */
  constructor(engine) {
    super();
    this.#canvas = null;
    this.#devicePixelRatio = 1;
    this.#targetResolutionScale = 1;
    this.#clientNativeSize = Vector2.zero();
    this.#canvasNativeSize = Vector2.zero();
    this.#canvasPixelSize = Vector2.zero();
    this.#viewScaleMode = ViewScaleMode.none;
    this.#viewNativeRect = Rect.zero();
    this.#viewSize = Vector2.zero();
    const engineConfiguration = engine.getEngineConfiguration();
    this.#referenceResolutionSize = engineConfiguration.referenceResolutionSize;
  }
  //==============================================================================
  // 뷰 영역 계산.
  //==============================================================================
  calculateViewRect() {
    const canvas = this.getCanvas();
    if (canvas === null || canvas === void 0) {
      return;
    }
    const devicePixelRatio = System9.window.devicePixelRatio || 1;
    const clientNativeSize = Vector2.create(System9.window.innerWidth, System9.window.innerHeight);
    const canvasNativeRect = canvas.getBoundingClientRect();
    const canvasNativeSize = Vector2.create(Math.round(canvasNativeRect.width), Math.round(canvasNativeRect.height));
    const canvasPixelSize = Vector2.create(Math.round(canvasNativeSize.x * devicePixelRatio), Math.round(canvasNativeSize.y * devicePixelRatio));
    const referenceResolutionSize = this.getReferenceResolutionSize();
    this.#devicePixelRatio = devicePixelRatio;
    this.#clientNativeSize = clientNativeSize;
    this.#canvasNativeSize = canvasNativeSize;
    this.#canvasPixelSize = canvasPixelSize;
    this.#canvas.width = canvasPixelSize.x;
    this.#canvas.height = canvasPixelSize.y;
    const viewScaleMode = this.getViewScaleMode();
    switch (viewScaleMode) {
      case ViewScaleMode.none: {
        const targetResolutionScale = 1;
        const viewX = 0;
        const viewY = 0;
        const viewWidth = Math.round(canvasNativeSize.x * targetResolutionScale);
        const viewHeight = Math.round(canvasNativeSize.y * targetResolutionScale);
        this.#targetResolutionScale = targetResolutionScale;
        this.#viewNativeRect.position.set(viewX, viewY);
        this.#viewNativeRect.size.set(viewWidth, viewHeight);
        this.#viewSize.set(canvasNativeSize.x, canvasNativeSize.y);
        break;
      }
      case ViewScaleMode.referenceResolution: {
        const targetResolutionScale = 1;
        const viewWidth = Math.round(referenceResolutionSize.x * targetResolutionScale);
        const viewHeight = Math.round(referenceResolutionSize.y * targetResolutionScale);
        const viewX = Math.floor((canvasNativeSize.x - viewWidth) * 0.5);
        const viewY = Math.floor((canvasNativeSize.y - viewHeight) * 0.5);
        this.#targetResolutionScale = targetResolutionScale;
        this.#viewNativeRect.position.set(viewX, viewY);
        this.#viewNativeRect.size.set(viewWidth, viewHeight);
        this.#viewSize.set(referenceResolutionSize.x, referenceResolutionSize.y);
        break;
      }
      case ViewScaleMode.stretchWidth: {
        const targetResolutionScale = canvasNativeSize.x / referenceResolutionSize.x;
        const viewWidth = Math.round(canvasNativeSize.x);
        const viewHeight = Math.round(referenceResolutionSize.y * targetResolutionScale);
        const viewX = 0;
        const viewY = Math.round((canvasNativeSize.y - viewHeight) * 0.5);
        this.#targetResolutionScale = targetResolutionScale;
        this.#viewNativeRect.position.set(viewX, viewY);
        this.#viewNativeRect.size.set(viewWidth, viewHeight);
        this.#viewSize.set(referenceResolutionSize.x, referenceResolutionSize.y);
        break;
      }
      case ViewScaleMode.stretchHeight: {
        const targetResolutionScale = canvasNativeSize.y / referenceResolutionSize.y;
        const viewWidth = Math.round(referenceResolutionSize.x * targetResolutionScale);
        const viewHeight = Math.round(canvasNativeSize.y);
        const viewX = Math.round((canvasNativeSize.x - viewWidth) * 0.5);
        const viewY = 0;
        this.#targetResolutionScale = targetResolutionScale;
        this.#viewNativeRect.position.set(viewX, viewY);
        this.#viewNativeRect.size.set(viewWidth, viewHeight);
        this.#viewSize.set(referenceResolutionSize.x, referenceResolutionSize.y);
        break;
      }
      case ViewScaleMode.stretchShort: {
        const targetResolutionScale = Math.min(canvasNativeSize.x / referenceResolutionSize.x, canvasNativeSize.y / referenceResolutionSize.y);
        const viewWidth = Math.round(referenceResolutionSize.x * targetResolutionScale);
        const viewHeight = Math.round(referenceResolutionSize.y * targetResolutionScale);
        const viewX = Math.round((canvasNativeSize.x - viewWidth) * 0.5);
        const viewY = Math.round((canvasNativeSize.y - viewHeight) * 0.5);
        this.#targetResolutionScale = targetResolutionScale;
        this.#viewNativeRect.position.set(viewX, viewY);
        this.#viewNativeRect.size.set(viewWidth, viewHeight);
        this.#viewSize.set(referenceResolutionSize.x, referenceResolutionSize.y);
        break;
      }
      case ViewScaleMode.stretchWidthExpandHeight: {
        const targetResolutionScale = canvasNativeSize.x / referenceResolutionSize.x;
        const viewWidth = Math.round(canvasNativeSize.x);
        const viewHeight = Math.round(canvasNativeSize.y);
        const viewX = 0;
        const viewY = 0;
        this.#targetResolutionScale = targetResolutionScale;
        this.#viewNativeRect.position.set(viewX, viewY);
        this.#viewNativeRect.size.set(viewWidth, viewHeight);
        const viewSizeX = Math.ceil(this.#viewNativeRect.size.x / targetResolutionScale);
        const viewSizeY = Math.ceil(this.#viewNativeRect.size.y / targetResolutionScale);
        this.#viewSize.set(viewSizeX, viewSizeY);
        break;
      }
      case ViewScaleMode.stretchHeightExpandWidth: {
        const targetResolutionScale = canvasNativeSize.y / referenceResolutionSize.y;
        const viewWidth = Math.round(canvasNativeSize.x);
        const viewHeight = Math.round(canvasNativeSize.y);
        const viewX = 0;
        const viewY = 0;
        this.#targetResolutionScale = targetResolutionScale;
        this.#viewNativeRect.position.set(viewX, viewY);
        this.#viewNativeRect.size.set(viewWidth, viewHeight);
        const viewSizeX = Math.ceil(this.#viewNativeRect.size.x / targetResolutionScale);
        const viewSizeY = Math.ceil(this.#viewNativeRect.size.y / targetResolutionScale);
        this.#viewSize.set(viewSizeX, viewSizeY);
        break;
      }
      case ViewScaleMode.stretchShortExpandLong: {
        const targetResolutionScale = Math.min(canvasNativeSize.x / referenceResolutionSize.x, canvasNativeSize.y / referenceResolutionSize.y);
        const viewWidth = Math.round(canvasNativeSize.x);
        const viewHeight = Math.round(canvasNativeSize.y);
        const viewX = 0;
        const viewY = 0;
        this.#targetResolutionScale = targetResolutionScale;
        this.#viewNativeRect.position.set(viewX, viewY);
        this.#viewNativeRect.size.set(viewWidth, viewHeight);
        const viewSizeX = Math.ceil(this.#viewNativeRect.size.x / targetResolutionScale);
        const viewSizeY = Math.ceil(this.#viewNativeRect.size.y / targetResolutionScale);
        this.#viewSize.set(viewSizeX, viewSizeY);
        break;
      }
    }
  }
  //==============================================================================
  // 좌표계 적용.
  //==============================================================================
  /**
   * @public
   * @method
   * @param { Graphic } graphic
   * @param { number } scaleX
   * @param { number } scaleY
   * @param { number } skewX
   * @param { number } skewY
   * @param { number } translateX
   * @param { number } translateY
  *
   */
  applyTransform(graphic, scaleX, scaleY, skewX, skewY, translateX, translateY) {
    graphic.setTransform(scaleX, skewY, skewX, scaleY, translateX, translateY);
  }
  //==============================================================================
  // 화면 전체 영역 적용.
  // - ViewScaleMode.none 이 아닐 경우 출력 전 해당 화면 해상도를 처리하기 위한 초기화.
  // - getCanvasNativeSize()
  //==============================================================================
  /**
   * @public
   * @method
   * @param { Graphic } graphic
   */
  applyCanvasNativeRect(graphic) {
    const devicePixelRatio = this.getDevicePixelRatio();
    const scaleX = 1 * devicePixelRatio;
    const scaleY = 1 * devicePixelRatio;
    const skewX = 0;
    const skewY = 0;
    const translateX = 0;
    const translateY = 0;
    this.applyTransform(graphic, scaleX, scaleY, skewX, skewY, translateX, translateY);
  }
  //==============================================================================
  // 뷰 영역 적용.
  // - ViewScaleMode.none 이 아닐 경우 출력 전 해당 화면 해상도를 처리하기 위한 초기화.
  // - ViewScaleMode.none은 getCanvasNativeSize()를 사용하고 그 외의 모드에서는 getReferenceResolutionSize()를 사용한다.
  // - getViewSize()를 사용하면 모드를 구분하지 않아도 자동으로 항상 모드에 적합한 뷰포트 해상도를 얻을 수 있다.
  //==============================================================================
  /**
   * @public
   * @method
   * @param { Graphic } graphic
   */
  applyViewRect(graphic) {
    const devicePixelRatio = this.getDevicePixelRatio();
    const targetResolutionScale = this.getTargetResolutionScale();
    const viewNativeRect = this.getViewNativeRect();
    const scaleX = targetResolutionScale * devicePixelRatio;
    const scaleY = targetResolutionScale * devicePixelRatio;
    const skewX = 0;
    const skewY = 0;
    const translateX = viewNativeRect.position.x * devicePixelRatio;
    const translateY = viewNativeRect.position.y * devicePixelRatio;
    this.applyTransform(graphic, scaleX, scaleY, skewX, skewY, translateX, translateY);
  }
  //==============================================================================
  // 기준 해상도 크기 재설정.
  //==============================================================================
  /**
   * @param { Vector2 } referenceResolutionSize
   */
  applyReferenceResolutionSize(referenceResolutionSize) {
    this.#referenceResolutionSize = referenceResolutionSize;
    this.calculateViewRect();
  }
  //==============================================================================
  // 캔버스 설정.
  //==============================================================================
  /**
   * @param { HTMLCanvasElement } canvas 
   */
  setCanvas(canvas) {
    this.#canvas = canvas;
  }
  //==============================================================================
  // 캔버스 반환.
  //==============================================================================
  /**
   * @returns { HTMLCanvasElement }
   */
  getCanvas() {
    return this.#canvas;
  }
  //==============================================================================
  // 디바이스의 실제 픽셀 개수 비율을 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getDevicePixelRatio() {
    return this.#devicePixelRatio;
  }
  //==============================================================================
  // 뷰 스케일 모드 설정.
  //==============================================================================
  /**
   * @param { ViewScaleMode } viewScaleMode
   */
  setViewScaleMode(viewScaleMode) {
    if (this.#viewScaleMode === viewScaleMode) {
      return;
    }
    this.#viewScaleMode = viewScaleMode;
    this.calculateViewRect();
  }
  //==============================================================================
  // 뷰 스케일 모드 반환.
  //==============================================================================
  /**
   * @returns { ViewScaleMode }
   */
  getViewScaleMode() {
    return this.#viewScaleMode;
  }
  //==============================================================================
  // 웹페이지의 전체 크기 반환.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  getClientNativeSize() {
    return this.#clientNativeSize;
  }
  //==============================================================================
  // 캔버스의 요소 크기 반환.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  getCanvasNativeSize() {
    return this.#canvasNativeSize;
  }
  //==============================================================================
  // 캔버스의 픽셀 렌더링용 화면 크기 반환. (실제 캔버스 내부 해상도. 엔진, 컨텐츠 로직에서는 사용할 필요 없음)
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  getCanvasPixelSize() {
    return this.#canvasPixelSize;
  }
  //==============================================================================
  // 기준 해상도 크기 반환.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  getReferenceResolutionSize() {
    return this.#referenceResolutionSize;
  }
  //==============================================================================
  // 실제 사용 해상도 크기 반환.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  getViewSize() {
    return this.#viewSize;
  }
  // //==============================================================================
  // // 화면 전체 영역 반환.
  // //==============================================================================
  // /**
  //  * @returns { Vector2 }
  //  */
  // getScreenSize() {
  // 	return this.#screenSize;
  // }
  //==============================================================================
  // 캔버스 안에서 뷰가 존재하는 실제 영역 반환. (값은 canvasNativeSize 기준)
  //==============================================================================
  /**
   * @returns { Rect }
   */
  getViewNativeRect() {
    return this.#viewNativeRect;
  }
  //==============================================================================
  // 배율 반환.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  getTargetResolutionScale() {
    return this.#targetResolutionScale;
  }
  //==============================================================================
  // 캔버스 좌표를 뷰 좌표로 변환.
  //==============================================================================
  /**
   * @public
   * @method
   * @param { Vector2 } canvasPosition
   * @returns { Vector2 }
   */
  canvasPositionToViewPosition(canvasPosition) {
    const devicePixelRatio = this.getDevicePixelRatio();
    const targetResolutionScale = this.getTargetResolutionScale();
    const totalScale = targetResolutionScale * devicePixelRatio;
    if (totalScale === 0) {
      return Vector2.zero();
    }
    const viewNativeRect = this.getViewNativeRect();
    const viewX = Math.round((canvasPosition.x * devicePixelRatio - viewNativeRect.position.x * devicePixelRatio) / totalScale);
    const viewY = Math.round((canvasPosition.y * devicePixelRatio - viewNativeRect.position.y * devicePixelRatio) / totalScale);
    return Vector2.create(viewX, viewY);
  }
};

// src/core/gamepadmanager.js
var System10 = globalThis;
var GamepadButtonCode = {
  // Face Buttons
  A_CROSS: 0,
  B_CIRCLE: 1,
  X_SQUARE: 2,
  Y_TRIANGLE: 3,
  // Bumpers
  L1: 4,
  R1: 5,
  // Triggers (버튼으로도 인식됨)
  L2: 6,
  R2: 7,
  // System
  SHARE_VIEW: 8,
  OPTIONS_MENU: 9,
  // Stick Clicks
  L3: 10,
  R3: 11,
  // D-Pad
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
  // Center
  HOME_PS: 16,
  TOUCHPAD: 17
};
var GamepadManager = class extends Object2 {
  static {
    __name(this, "GamepadManager");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /**@private @type { number[] } */
  #connectedGamepadIndices;
  // 연결된 게임패드 식별자(index) 목록.
  /**@private @type { Map<number, Object> } */
  #connectedGamepadStates;
  // key: index, value: { buttons: Map, axes: Map }
  /**@private @type { Function | null } */
  #inputEventCallback;
  // 입력 콜백 함수.
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   * @param { Engine } engine 
   */
  constructor(engine) {
    super();
    this.#connectedGamepadIndices = [];
    this.#connectedGamepadStates = /* @__PURE__ */ new Map();
    this.#inputEventCallback = null;
  }
  //==============================================================================
  // 갱신.
  //==============================================================================
  /**
   * @param { number } timeDelta
   */
  tick(timeDelta) {
    this.updateAllGamepads();
  }
  //==============================================================================
  // 게임패드 연결.
  //==============================================================================
  /**
   * @param { Gamepad } gamepad
   */
  connect(gamepad) {
    if (gamepad === null || gamepad === void 0 || this.#connectedGamepadIndices.indexOf(gamepad.index) !== -1) {
      return;
    }
    const state = {
      buttons: /* @__PURE__ */ new Map(),
      // key: index, value: { pressed: boolean, value: number }
      axes: /* @__PURE__ */ new Map()
      // key: index, value: number
    };
    for (let i = 0; i < gamepad.buttons.length; i++) {
      state.buttons.set(i, { pressed: false, value: 0 });
    }
    for (let i = 0; i < gamepad.axes.length; i++) {
      state.axes.set(i, 0);
    }
    this.#connectedGamepadIndices.push(gamepad.index);
    this.#connectedGamepadStates.set(gamepad.index, state);
    console.log(`[GamepadManager] Connected: ${gamepad.id} at index ${gamepad.index}`);
  }
  //==============================================================================
  // 게임패드 연결 해제.
  //==============================================================================
  /**
   * @param { Gamepad } gamepad
   */
  disconnect(gamepad) {
    if (gamepad === null || gamepad === void 0) {
      return;
    }
    const listIndex = this.#connectedGamepadIndices.indexOf(gamepad.index);
    if (listIndex === -1) {
      return;
    }
    this.#connectedGamepadIndices.splice(listIndex, 1);
    this.#connectedGamepadStates.delete(gamepad.index);
    console.log(`[GamepadManager] Disconnected: index ${gamepad.index}`);
  }
  //==============================================================================
  // 콜백 설정.
  //==============================================================================
  /**
   * @param { (gamepadIndex: number, inputType: "button" | "value" | "axis", inputIndex: number, value: any) => void } callback
   */
  setCallback(callback) {
    this.#inputEventCallback = callback;
  }
  //==============================================================================
  // 모든 게임패드 갱신.
  //==============================================================================
  updateAllGamepads() {
    const gamepads = System10.navigator.getGamepads();
    for (const hardwareIndex of this.#connectedGamepadIndices) {
      const gamepad = gamepads[hardwareIndex];
      if (!gamepad) {
        continue;
      }
      const state = this.#connectedGamepadStates.get(hardwareIndex);
      if (!state) {
        continue;
      }
      for (let i = 0; i < gamepad.buttons.length; i++) {
        const currentButton = gamepad.buttons[i];
        const lastButtonState = state.buttons.get(i);
        if (!lastButtonState) {
          continue;
        }
        if (lastButtonState.pressed !== currentButton.pressed) {
          lastButtonState.pressed = currentButton.pressed;
          const text = i === GamepadButtonCode.L2 || i === GamepadButtonCode.R2 ? "Trigger" : "Button";
          console.log(`[GamepadManager] Pad ${hardwareIndex} ${text} ${i} ${currentButton.pressed ? "Pressed" : "Released"}`);
          if (this.#inputEventCallback) {
            this.#inputEventCallback(hardwareIndex, "button", i, currentButton.pressed);
          }
        }
        const currentValue = parseFloat(currentButton.value.toFixed(2));
        if (lastButtonState.value !== currentValue) {
          lastButtonState.value = currentValue;
          if (currentValue > 0) {
            const text = i === GamepadButtonCode.L2 || i === GamepadButtonCode.R2 ? "Trigger" : "Button";
            console.log(`[GamepadManager] Pad ${hardwareIndex} ${text} ${i} Value: ${currentValue}`);
            if (this.#inputEventCallback) {
              this.#inputEventCallback(hardwareIndex, "value", i, currentValue);
            }
          }
        }
      }
      for (let i = 0; i < gamepad.axes.length; i++) {
        const currentAxisValue = parseFloat(gamepad.axes[i].toFixed(2));
        const lastAxisValue = state.axes.get(i);
        if (Math.abs(lastAxisValue - currentAxisValue) > 0.01) {
          state.axes.set(i, currentAxisValue);
          console.log(`[GamepadManager] Pad ${hardwareIndex} Axis ${i} Value: ${currentAxisValue}`);
          if (this.#inputEventCallback) {
            this.#inputEventCallback(hardwareIndex, "axis", i, currentAxisValue);
          }
        }
      }
    }
  }
  //==============================================================================
  // 버튼 눌림 상태 반환.
  //==============================================================================
  /**
   * @param { number } gamepadIndex 
   * @param { number } buttonIndex 
   * @returns { boolean }
   */
  isButtonPressed(gamepadIndex, buttonIndex) {
    const state = this.#connectedGamepadStates.get(gamepadIndex);
    if (!state) return false;
    const button = state.buttons.get(buttonIndex);
    return button ? button.pressed : false;
  }
  //==============================================================================
  // 버튼/트리거 아날로그 값 반환 (0.0 ~ 1.0).
  //==============================================================================
  /**
   * @param { number } gamepadIndex 
   * @param { number } buttonIndex 
   * @returns { number }
   */
  getButtonValue(gamepadIndex, buttonIndex) {
    const state = this.#connectedGamepadStates.get(gamepadIndex);
    if (!state) return 0;
    const button = state.buttons.get(buttonIndex);
    return button ? button.value : 0;
  }
  //==============================================================================
  // 아날로그 스틱 축 값 반환 (-1.0 ~ 1.0).
  //==============================================================================
  /**
   * @param { number } gamepadIndex 
   * @param { number } axisIndex 
   * @returns { number }
   */
  getAxisValue(gamepadIndex, axisIndex) {
    const state = this.#connectedGamepadStates.get(gamepadIndex);
    if (!state) return 0;
    return state.axes.get(axisIndex) || 0;
  }
  //==============================================================================
  // 연결된 모든 게임패드 반환.
  //==============================================================================
  /**
   * @returns { Gamepad[] }
   */
  getAllConnectedGamepads() {
    const gamepads = System10.navigator.getGamepads();
    const connected = [];
    for (const hardwareIndex of this.#connectedGamepadIndices) {
      const gamepad = gamepads[hardwareIndex];
      if (gamepad) {
        connected.push(gamepad);
      }
    }
    return connected;
  }
  //==============================================================================
  // 연결된 게임패드 수 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getConnectedGamepadCount() {
    return this.#connectedGamepadIndices.length;
  }
  //==============================================================================
  // 연결된 게임패드 반환.
  //==============================================================================
  /**
   * @returns { Gamepad | undefined }
   */
  getConnectedGamepad(gamepadIndex) {
    if (gamepadIndex < 0 || gamepadIndex >= this.#connectedGamepadIndices.length) {
      return void 0;
    }
    const hardwareIndex = this.#connectedGamepadIndices.at(gamepadIndex);
    const gamepads = System10.navigator.getGamepads();
    return gamepads[hardwareIndex];
  }
};

// src/core/inputmanager.js
var KeyCode = {
  a: "KeyA",
  b: "KeyB",
  c: "KeyC",
  d: "KeyD",
  e: "KeyE",
  f: "KeyF",
  g: "KeyG",
  h: "KeyH",
  i: "KeyI",
  j: "KeyJ",
  k: "KeyK",
  l: "KeyL",
  m: "KeyM",
  n: "KeyN",
  o: "KeyO",
  p: "KeyP",
  q: "KeyQ",
  r: "KeyR",
  s: "KeyS",
  t: "KeyT",
  u: "KeyU",
  v: "KeyV",
  w: "KeyW",
  x: "KeyX",
  y: "KeyY",
  z: "KeyZ",
  "0": "Digit0",
  "1": "Digit1",
  "2": "Digit2",
  "3": "Digit3",
  "4": "Digit4",
  "5": "Digit5",
  "6": "Digit6",
  "7": "Digit7",
  "8": "Digit8",
  "9": "Digit9",
  backspace: "Backspace",
  tab: "Tab",
  enter: "Enter",
  shift: "ShiftLeft",
  ctrl: "ControlLeft",
  alt: "AltLeft",
  capslock: "CapsLock",
  escape: "Escape",
  space: "Space",
  pageup: "PageUp",
  pagedown: "PageDown",
  end: "End",
  home: "Home",
  arrowleft: "ArrowLeft",
  arrowup: "ArrowUp",
  arrowright: "ArrowRight",
  arrowdown: "ArrowDown",
  insert: "Insert",
  delete: "Delete",
  f1: "F1",
  f2: "F2",
  f3: "F3",
  f4: "F4",
  f5: "F5",
  f6: "F6",
  f7: "F7",
  f8: "F8",
  f9: "F9",
  f10: "F10",
  f11: "F11",
  f12: "F12",
  scrolllock: "ScrollLock",
  semicolon: "Semicolon",
  equal: "Equal",
  comma: "Comma",
  minus: "Minus",
  period: "Period",
  slash: "Slash",
  backquote: "Backquote",
  bracketleft: "BracketLeft",
  backslash: "Backslash",
  bracketright: "BracketRight",
  quote: "Quote",
  meta: "MetaLeft",
  command: "MetaLeft",
  pause: "Pause",
  audiovolumeup: "AudioVolumeUp",
  audiovolumedown: "AudioVolumeDown",
  audiomute: "AudioMute",
  audioplay: "MediaPlay",
  audiostop: "MediaStop",
  audioprev: "MediaTrackPrevious",
  audionext: "MediaTrackNext",
  numLock: "NumLock",
  numpadDivide: "NumpadDivide",
  // 텐키 나누기.
  numpadMultiply: "NumpadMultiply",
  // 텐키 곱하기.
  numpadSubtract: "NumpadSubtract",
  // 텐키 빼기.
  numpadDecimal: "NumpadDecimal",
  // 텐키 점.
  numpadAdd: "NumpadAdd",
  // 텐키 더하기.
  numpadEnter: "NumpadEnter",
  // 텐키 엔터.
  numpad0: "Numpad0",
  numpad1: "Numpad1",
  numpad2: "Numpad2",
  numpad3: "Numpad3",
  numpad4: "Numpad4",
  numpad5: "Numpad5",
  numpad6: "Numpad6",
  numpad7: "Numpad7",
  numpad8: "Numpad8",
  numpad9: "Numpad9"
};
var InputManager = class extends Object2 {
  static {
    __name(this, "InputManager");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Set<string> } */
  #keys;
  // 키 목록.
  /** @private @type { boolean } */
  #isTouchPressed;
  // 입력시 딱 한번 눌림.
  /** @private @type { boolean } */
  #isTouchReleased;
  // 입력시 딱 한번 뗌.
  /** @private @type { boolean } */
  #isTouchCancelled;
  // 입력시 딱 한번 취소됨.
  /** @private @type { boolean } */
  #isTouchMoved;
  // 입력시 뗄 때가지 계속 눌림.
  /** @private @type { Vector2 } */
  #canvasNativeInputPosition;
  // canvasNativeSize 기반 위치값.
  /** @private @type { Vector2 } */
  #viewInputPosition;
  // referenceResolutionSize 기반 위치값.
  /** @private @type { GamepadManager } */
  #gamepadManager;
  /** @private @type { number } */
  #wheelDeltaX;
  // 이번 프레임에 누적된 휠 가로.
  /** @private @type { number } */
  #wheelDeltaY;
  // 이번 프레임에 누적된 휠 세로.
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   * @param { Engine } engine 
   */
  constructor(engine) {
    super();
    this.#keys = /* @__PURE__ */ new Set();
    this.#isTouchPressed = false;
    this.#isTouchReleased = false;
    this.#isTouchCancelled = false;
    this.#isTouchMoved = false;
    this.#canvasNativeInputPosition = Vector2.zero();
    this.#viewInputPosition = Vector2.zero();
    this.#gamepadManager = new GamepadManager(engine);
    this.#wheelDeltaX = 0;
    this.#wheelDeltaY = 0;
  }
  //==============================================================================
  // 갱신.
  //==============================================================================
  /**
   * @param { number } timeDelta
   */
  tick(timeDelta) {
    const gamepadManager = this.getGamepadManager();
    if (gamepadManager) {
      gamepadManager.tick(timeDelta);
    }
  }
  //==============================================================================
  // 모든 입력 상태를 초기 상태로 되돌림. (페이지 프로세스 복원 시 stuck touch/key 방지용)
  //==============================================================================
  clear() {
    this.#keys.clear();
    this.#isTouchPressed = false;
    this.#isTouchReleased = false;
    this.#isTouchCancelled = false;
    this.#isTouchMoved = false;
    this.#wheelDeltaX = 0;
    this.#wheelDeltaY = 0;
  }
  //==============================================================================
  // 마우스 휠 누적값.
  // - addWheelDelta 로 들어온 값을 한 프레임 누적해서 들고 있다가, 프레임 종료 시
  //   엔진이 clearWheelDelta() 로 비운다.
  //==============================================================================
  addWheelDelta(deltaX, deltaY) {
    this.#wheelDeltaX += deltaX;
    this.#wheelDeltaY += deltaY;
  }
  getWheelDeltaX() {
    return this.#wheelDeltaX;
  }
  getWheelDeltaY() {
    return this.#wheelDeltaY;
  }
  hasWheelDelta() {
    return this.#wheelDeltaX !== 0 || this.#wheelDeltaY !== 0;
  }
  clearWheelDelta() {
    this.#wheelDeltaX = 0;
    this.#wheelDeltaY = 0;
  }
  //==============================================================================
  // 키 누름 여부 설정.
  //==============================================================================
  /**
   * @param { boolean } value
   */
  pushKey(key) {
    this.#keys.add(key);
  }
  //==============================================================================
  // 키 뗌 여부 설정.
  //==============================================================================
  /**
   * @param { boolean } value
   */
  popKey(key) {
    this.#keys.delete(key);
  }
  //==============================================================================
  // 키 누름 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isKeyPressed(key) {
    return this.#keys.has(key);
  }
  //==============================================================================
  // 누름 여부 설정.
  //==============================================================================
  /**
   * @param { boolean } value
   */
  setTouchPressed(value) {
    this.#isTouchPressed = value;
  }
  //==============================================================================
  // 뗌 여부 설정.
  //==============================================================================
  /**
   * @param { boolean } value
   */
  setTouchReleased(value) {
    this.#isTouchReleased = value;
  }
  //==============================================================================
  // 취소 여부 설정.
  //==============================================================================
  /**
   * @param { boolean } value
   */
  setTouchCancelled(value) {
    this.#isTouchCancelled = value;
  }
  //==============================================================================
  // 누르고 있는 중인지 여부 설정.
  //==============================================================================
  /**
   * @param { boolean } value
   */
  setTouchMoved(value) {
    this.#isTouchMoved = value;
  }
  //==============================================================================
  // 누름 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean } 
   */
  isTouchPressed() {
    return this.#isTouchPressed;
  }
  //==============================================================================
  // 뗌 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isTouchReleased() {
    return this.#isTouchReleased;
  }
  //==============================================================================
  // 취소 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isTouchCancelled() {
    return this.#isTouchCancelled;
  }
  //==============================================================================
  // 누르고 있는 중인지 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean } 
   */
  isTouchMoved() {
    return this.#isTouchMoved;
  }
  //==============================================================================
  // canvasNativeSize 기반 입력 위치 갱신.
  //==============================================================================
  /**
   * @param { Vector2 } position 
   */
  setCanvasNativeInputPosition(position) {
    position.x = Math.round(position.x);
    position.y = Math.round(position.y);
    this.#canvasNativeInputPosition = position;
  }
  //==============================================================================
  // canvasNativeSize 기반 입력 위치 반환.
  //==============================================================================
  /**
   * @returns { Vector2 } 
   */
  getCanvasNativeInputPosition() {
    return this.#canvasNativeInputPosition;
  }
  //==============================================================================
  // 뷰의 입력 위치 갱신.
  //==============================================================================
  /**
   * @param { Vector2 } position 
   */
  setViewInputPosition(position) {
    position.x = Math.round(position.x);
    position.y = Math.round(position.y);
    this.#viewInputPosition = position;
  }
  //==============================================================================
  // 뷰의 입력 위치 반환.
  //==============================================================================
  /**
   * @returns { Vector2 } 
   */
  getViewInputPosition() {
    return this.#viewInputPosition;
  }
  //==============================================================================
  // 모든 게임패드 갱신.
  //==============================================================================
  updateAllGamepads() {
    const gamepadManager = this.getGamepadManager();
    if (gamepadManager) {
      gamepadManager.updateAllGamepads();
    }
  }
  //==============================================================================
  // 게임패드 연결.
  //==============================================================================
  /**
   * @param { Gamepad } gamepad
   */
  connectGamepad(gamepad) {
    const gamepadManager = this.getGamepadManager();
    if (gamepadManager) {
      gamepadManager.connect(gamepad);
    }
  }
  //==============================================================================
  // 게임패드 연결 해제.
  //==============================================================================
  /**
   * @param { Gamepad } gamepad
   */
  disconnectGamepad(gamepad) {
    const gamepadManager = this.getGamepadManager();
    if (gamepadManager) {
      gamepadManager.disconnect(gamepad);
    }
  }
  //==============================================================================
  // 게임패드 매니저 반환.
  //==============================================================================
  /**
   * @returns { GamepadManager } 
   */
  getGamepadManager() {
    return this.#gamepadManager;
  }
};

// src/core/component/mask.js
var Mask = class extends Component {
  static {
    __name(this, "Mask");
  }
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.setComponentType("Mask");
  }
  //==============================================================================
  // 클리핑 시작. (노드의 draw 가 자식 그리기 직전에 호출)
  //==============================================================================
  /**
   * @param { Graphic } graphic
   */
  beginClip(graphic) {
    const node = this.getNode();
    if (!node) {
      return;
    }
    if (typeof node.getContentSize !== "function") {
      return;
    }
    const contentSize = node.getContentSize();
    const clipRect = Rect.create(0, 0, contentSize.x, contentSize.y);
    graphic.beginClipRect(clipRect);
  }
  //==============================================================================
  // 클리핑 종료. (노드의 draw 가 자식 그리기 직후에 호출)
  //==============================================================================
  /**
   * @param { Graphic } graphic
   */
  endClip(graphic) {
    graphic.endClipRect();
  }
};

// src/core/node/worldnode.js
var WorldNode = class _WorldNode extends TransformNode {
  static {
    __name(this, "WorldNode");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Vector2 } */
  #pivot;
  // 기준점.
  /** @private @type { Vector2 } */
  #contentSize;
  // 크기.
  /** @private @type { Vector2 } */
  #anchor;
  // 앵커 (부모 영역 내 기준점).
  /** @private @type { boolean } */
  #isInteractable;
  // 터치 인터랙션 활성화 여부.
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
    if (graphic) {
      graphic.pushState();
      const localPosition = this.getLocalPosition();
      const localRotation = this.getLocalRotation();
      const radian = degreeToRadian(localRotation);
      const localScale = this.getLocalScale();
      graphic.translate(localPosition.x, localPosition.y);
      graphic.rotate(radian);
      graphic.scale(localScale.x, localScale.y);
      const pivot = this.getPivot();
      const contentSize = this.getContentSize();
      const pivotPosition = Vector2.create(contentSize.x * pivot.x, contentSize.y * pivot.y);
      graphic.translate(-pivotPosition.x, -pivotPosition.y);
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
    const components = this.getAllComponents();
    let maskComponent = null;
    for (const component of components) {
      component.draw(graphic);
      if (component instanceof Mask) {
        maskComponent = component;
      }
    }
    if (maskComponent) {
      maskComponent.beginClip(graphic);
    }
    const children = this.getChildren();
    for (const child of children) {
      graphic.drawNode(child);
    }
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
    super.drawGizmos(graphic);
    if (graphic) {
      const originalAlpha = graphic.getGlobalAlpha();
      graphic.setGlobalAlpha(1);
      const contentSize = this.getContentSize();
      const pivot = this.getPivot();
      const origin = Vector2.create(contentSize.x * pivot.x, contentSize.y * pivot.y);
      const left = 0;
      const top = 0;
      const right = left + contentSize.x;
      const bottom = top + contentSize.y;
      graphic.setFillColor("#00ff00");
      graphic.setStrokeColor("#00ff00");
      graphic.drawLine([
        Vector2.create(left, top),
        Vector2.create(right, top),
        Vector2.create(right, bottom),
        Vector2.create(left, bottom),
        Vector2.create(left, top)
      ], 1);
      const pointSize = 4;
      graphic.drawCircle(origin, pointSize);
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
    this.#pivot.x = clamp(pivot.x, 0, 1);
    this.#pivot.y = clamp(pivot.y, 0, 1);
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
    this.#anchor.x = clamp(anchor.x, 0, 1);
    this.#anchor.y = clamp(anchor.y, 0, 1);
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
    if (anchoredPosition === null || anchoredPosition === void 0) {
      return;
    }
    const parent = this.getParent();
    if (!(parent instanceof _WorldNode)) {
      const newLocalPosition2 = Vector2.create(anchoredPosition.x, anchoredPosition.y);
      this.setLocalPosition(newLocalPosition2);
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
    if (!(parent instanceof _WorldNode)) {
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
    if (!(parent instanceof _WorldNode)) {
      return super.getPosition();
    }
    const localPosition = this.getLocalPosition();
    const parentPosition = parent.getPosition();
    const parentContentSize = parent.getContentSize();
    const parentPivot = parent.getPivot();
    const parentRotation = parent.getRotation();
    const parentScale = parent.getScale();
    const totalLocalX = localPosition.x - parentContentSize.x * parentPivot.x;
    const totalLocalY = localPosition.y - parentContentSize.y * parentPivot.y;
    const radian = degreeToRadian(parentRotation);
    const cosRadian = cos(radian);
    const sinRadian = sin(radian);
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
    const width = contentSize.x * abs(scale.x);
    const height = contentSize.y * abs(scale.y);
    const left = -(width * pivot.x);
    const right = width * (1 - pivot.x);
    const top = -(height * pivot.y);
    const bottom = height * (1 - pivot.y);
    const radian = degreeToRadian(rotation);
    const cosR = cos(radian);
    const sinR = sin(radian);
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
    let min2 = Vector2.positiveInfinity();
    let max2 = Vector2.negativeInfinity();
    for (let i = 1; i < worldCorners.length; ++i) {
      const worldCorner = worldCorners[i];
      if (min2.x > worldCorner.x) {
        min2.x = worldCorner.x;
      }
      if (min2.y > worldCorner.y) {
        min2.y = worldCorner.y;
      }
      if (max2.x < worldCorner.x) {
        max2.x = worldCorner.x;
      }
      if (max2.y < worldCorner.y) {
        max2.y = worldCorner.y;
      }
    }
    return Rect.create(min2.x, min2.y, max2.x - min2.x, max2.y - min2.y);
  }
  //==============================================================================
  // getWorldCorners() 를 통한 충돌 검출.
  //==============================================================================
  /**
   * @param { Vector2 } viewPosition
   * @returns { boolean }
   */
  contains(viewPosition) {
    if (viewPosition === null || viewPosition === void 0) {
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
};

// src/core/tween.js
var Tween = class _Tween extends Object2 {
  static {
    __name(this, "Tween");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { System.Object } */
  #valuesStart;
  /** @private @type { System.Object } */
  #valuesEnd;
  /** @private @type { number } */
  #duration;
  /** @private @type { number } */
  #delay;
  /** @private @type { number } */
  #elapsedTime;
  /** @private @type { Function } */
  #easingFunction;
  /** @private @type { Function } */
  #tickCallback;
  /** @private @type { Function } */
  #completeCallback;
  /** @private @type { boolean } */
  #isPlaying;
  /** @private @type { boolean } */
  #isFinished;
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
    this.#valuesEnd = {};
    this.#duration = 1;
    this.#delay = 0;
    this.#elapsedTime = 0;
    this.#easingFunction = _Tween.easingFunction.linear;
    this.#tickCallback = null;
    this.#completeCallback = null;
    this.#isPlaying = false;
    this.#isFinished = false;
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
    progress = clamp(progress, 0, 1);
    const easedProgress = this.#easingFunction(progress);
    const newValues = {};
    for (const key in this.#valuesEnd) {
      const startValue = this.#valuesStart[key];
      const endValue = this.#valuesEnd[key];
      if (startValue === void 0) {
        continue;
      }
      if (typeof startValue === "number" && typeof endValue === "number") {
        newValues[key] = startValue + (endValue - startValue) * easedProgress;
      } else if (startValue instanceof Vector2 && endValue instanceof Vector2) {
        newValues[key] = Vector2.lerp(startValue, endValue, easedProgress);
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
    if (duration !== void 0) {
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
  // 완료 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean } 
   */
  isFinished() {
    return this.#isFinished;
  }
};
Tween.easingFunction = {
  linear: /* @__PURE__ */ __name(function(k) {
    return k;
  }, "linear"),
  quadratic: {
    in: /* @__PURE__ */ __name(function(k) {
      return k * k;
    }, "in"),
    out: /* @__PURE__ */ __name(function(k) {
      return k * (2 - k);
    }, "out"),
    inOut: /* @__PURE__ */ __name(function(k) {
      if ((k *= 2) < 1) {
        return 0.5 * k * k;
      }
      return -0.5 * (--k * (k - 2) - 1);
    }, "inOut")
  },
  cubic: {
    in: /* @__PURE__ */ __name(function(k) {
      return k * k * k;
    }, "in"),
    out: /* @__PURE__ */ __name(function(k) {
      return --k * k * k + 1;
    }, "out"),
    inOut: /* @__PURE__ */ __name(function(k) {
      if ((k *= 2) < 1) return 0.5 * k * k * k;
      return 0.5 * ((k -= 2) * k * k + 2);
    }, "inOut")
  },
  quartic: {
    in: /* @__PURE__ */ __name(function(k) {
      return k * k * k * k;
    }, "in"),
    out: /* @__PURE__ */ __name(function(k) {
      return 1 - --k * k * k * k;
    }, "out"),
    inOut: /* @__PURE__ */ __name(function(k) {
      if ((k *= 2) < 1) return 0.5 * k * k * k * k;
      return -0.5 * ((k -= 2) * k * k * k - 2);
    }, "inOut")
  },
  quintic: {
    in: /* @__PURE__ */ __name(function(k) {
      return k * k * k * k * k;
    }, "in"),
    out: /* @__PURE__ */ __name(function(k) {
      return --k * k * k * k * k + 1;
    }, "out"),
    inOut: /* @__PURE__ */ __name(function(k) {
      if ((k *= 2) < 1) return 0.5 * k * k * k * k * k;
      return 0.5 * ((k -= 2) * k * k * k * k + 2);
    }, "inOut")
  },
  sinusoidal: {
    in: /* @__PURE__ */ __name(function(k) {
      return 1 - cos(k * PI / 2);
    }, "in"),
    out: /* @__PURE__ */ __name(function(k) {
      return sin(k * PI / 2);
    }, "out"),
    inOut: /* @__PURE__ */ __name(function(k) {
      return 0.5 * (1 - cos(PI * k));
    }, "inOut")
  },
  exponential: {
    in: /* @__PURE__ */ __name(function(k) {
      return k === 0 ? 0 : pow(1024, k - 1);
    }, "in"),
    out: /* @__PURE__ */ __name(function(k) {
      return k === 1 ? 1 : 1 - pow(2, -10 * k);
    }, "out"),
    inOut: /* @__PURE__ */ __name(function(k) {
      if (k === 0) return 0;
      if (k === 1) return 1;
      if ((k *= 2) < 1) return 0.5 * pow(1024, k - 1);
      return 0.5 * (-pow(2, -10 * (k - 1)) + 2);
    }, "inOut")
  },
  circular: {
    in: /* @__PURE__ */ __name(function(k) {
      return 1 - sqrt(1 - k * k);
    }, "in"),
    out: /* @__PURE__ */ __name(function(k) {
      return sqrt(1 - --k * k);
    }, "out"),
    inOut: /* @__PURE__ */ __name(function(k) {
      if ((k *= 2) < 1) return -0.5 * (sqrt(1 - k * k) - 1);
      return 0.5 * (sqrt(1 - (k -= 2) * k) + 1);
    }, "inOut")
  },
  elastic: {
    in: /* @__PURE__ */ __name(function(k) {
      let s, a = 0.1, p = 0.4;
      if (k === 0) return 0;
      if (k === 1) return 1;
      if (!a || a < 1) {
        a = 1;
        s = p / 4;
      } else s = p * asin(1 / a) / (2 * PI);
      return -(a * pow(2, 10 * (k -= 1)) * sin((k - s) * (2 * PI) / p));
    }, "in"),
    out: /* @__PURE__ */ __name(function(k) {
      let s, a = 0.1, p = 0.4;
      if (k === 0) return 0;
      if (k === 1) return 1;
      if (!a || a < 1) {
        a = 1;
        s = p / 4;
      } else s = p * asin(1 / a) / (2 * PI);
      return a * pow(2, -10 * k) * sin((k - s) * (2 * PI) / p) + 1;
    }, "out"),
    inOut: /* @__PURE__ */ __name(function(k) {
      let s, a = 0.1, p = 0.4;
      if (k === 0) return 0;
      if (k === 1) return 1;
      if (!a || a < 1) {
        a = 1;
        s = p / 4;
      } else s = p * asin(1 / a) / (2 * PI);
      if ((k *= 2) < 1) return -0.5 * (a * pow(2, 10 * (k -= 1)) * sin((k - s) * (2 * PI) / p));
      return a * pow(2, -10 * (k -= 1)) * sin((k - s) * (2 * PI) / p) * 0.5 + 1;
    }, "inOut")
  },
  back: {
    in: /* @__PURE__ */ __name(function(k) {
      const s = 1.70158;
      return k * k * ((s + 1) * k - s);
    }, "in"),
    out: /* @__PURE__ */ __name(function(k) {
      const s = 1.70158;
      return --k * k * ((s + 1) * k + s) + 1;
    }, "out"),
    inOut: /* @__PURE__ */ __name(function(k) {
      const s = 1.70158 * 1.525;
      if ((k *= 2) < 1) return 0.5 * (k * k * ((s + 1) * k - s));
      return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);
    }, "inOut")
  },
  bounce: {
    in: /* @__PURE__ */ __name(function(k) {
      return 1 - Tween.easingFunction.bounce.out(1 - k);
    }, "in"),
    out: /* @__PURE__ */ __name(function(k) {
      if (k < 1 / 2.75) {
        return 7.5625 * k * k;
      } else if (k < 2 / 2.75) {
        return 7.5625 * (k -= 1.5 / 2.75) * k + 0.75;
      } else if (k < 2.5 / 2.75) {
        return 7.5625 * (k -= 2.25 / 2.75) * k + 0.9375;
      } else {
        return 7.5625 * (k -= 2.625 / 2.75) * k + 0.984375;
      }
    }, "out"),
    inOut: /* @__PURE__ */ __name(function(k) {
      if (k < 0.5) return Tween.easingFunction.bounce.in(k * 2) * 0.5;
      return Tween.easingFunction.bounce.out(k * 2 - 1) * 0.5 + 0.5;
    }, "inOut")
  }
};

// src/core/scene.js
var Scene = class extends Object2 {
  static {
    __name(this, "Scene");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Engine } */
  #engine;
  /** @private @type { WorldNode } */
  #root;
  /** @private @type { VTweeneen[] } */
  #tweens;
  /** @private @type { boolean } */
  #isGizmoVisible;
  // 기즈모 출력 여부.
  /** @private @type { boolean } */
  #isLoaded;
  // 비동기 로딩 완료 여부.
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
  }
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @virtual
   */
  create() {
    this.#tweens = [];
    this.#isGizmoVisible = false;
    this.#isLoaded = false;
    this.#root = new WorldNode();
    const root = this.getRoot();
    root.setName("root");
  }
  //==============================================================================
  // 엔진 설정. (SceneManager가 load() 이전에 호출하여 drawOnLoad에서 접근 가능하게 함)
  //==============================================================================
  /**
   * @param { Engine } engine
   */
  setEngine(engine) {
    this.#engine = engine;
  }
  //==============================================================================
  // 로딩 완료 여부 설정. (SceneManager가 load+initialize 이후 true로 전환)
  //==============================================================================
  /**
   * @param { boolean } isLoaded
   */
  setLoaded(isLoaded) {
    this.#isLoaded = isLoaded;
  }
  //==============================================================================
  // 로딩 완료 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isLoaded() {
    return this.#isLoaded;
  }
  //==============================================================================
  // 로딩 중 출력. (비동기 load() 진행 중에만 호출되며, 씬의 일반 tick/draw는 호출되지 않음)
  //==============================================================================
  /**
   * @virtual
   * @param { Graphic } graphic
   */
  drawOnLoad(graphic) {
  }
  //==============================================================================
  // 파괴.
  //==============================================================================
  /**
   * @override
   */
  destroy() {
    super.destroy();
  }
  //==============================================================================
  // 비동기 로딩.
  //==============================================================================
  /**
   * @virtual
   * @param { Engine } engine 
   */
  async load(engine) {
    this.#engine = engine;
    await Promise.resolve();
    const viewManager = engine.getViewManager();
    const viewSize = viewManager.getViewSize();
    const root = this.getRoot();
    root.setPosition(Vector2.zero());
    root.setPivot(Pivot.topLeft);
    root.setContentSize(viewSize);
  }
  //==============================================================================
  // 초기화.
  //==============================================================================
  /**
   * @virtual
   * @param { Engine } engine 
   */
  initialize(engine) {
  }
  //==============================================================================
  // 종료처리.
  //==============================================================================
  /**
   * @virtual
   * @param { Engine } engine
   */
  finalize(engine) {
  }
  //==============================================================================
  // 페이지 프로세스 파기 후 복원 감지 (freeze/resume, bfcache 복원 등).
  // 엔진이 브라우저 이벤트를 감지하여 로드된 모든 씬에 호출한다.
  //==============================================================================
  /**
   * @virtual
   */
  onPageProcessRestored() {
  }
  //==============================================================================
  // 페이지 가시성 복원 감지 (백그라운드 → 포어그라운드).
  // 엔진이 visibilitychange 이벤트를 감지하여 로드된 모든 씬에 호출한다.
  //==============================================================================
  /**
   * @virtual
   */
  onPageVisibilityRestored() {
  }
  //==============================================================================
  // 비동기 로딩 해제.
  //==============================================================================
  /**
   * @virtual
   * @param { Engine } engine 
   */
  async unload(engine) {
    await Promise.resolve();
  }
  //==============================================================================
  // 화면 크기 변경됨.
  //==============================================================================
  /**
   * @virtual
   * @param { Vector2 } canvasNativeSize
   */
  resize(canvasNativeSize) {
    const engine = this.getEngine();
    const viewManager = engine.getViewManager();
    const viewSize = viewManager.getViewSize();
    const root = this.getRoot();
    root.setPosition(Vector2.zero());
    root.setPivot(Pivot.topLeft);
    root.setContentSize(viewSize);
  }
  //==============================================================================
  // 주기적 갱신.
  //==============================================================================
  /**
   * @virtual
   * @param { number } timeDelta 
   */
  tick(timeDelta) {
    try {
      const root = this.getRoot();
      if (root.isActive()) {
        root.tick(timeDelta);
      }
    } catch (error) {
      console.error(error);
    }
    try {
      this.tickTouch(timeDelta);
    } catch (error) {
      console.error(error);
    }
    for (let i = this.#tweens.length - 1; i >= 0; --i) {
      const tween = this.#tweens[i];
      try {
        if (tween) {
          tween.tick(timeDelta);
          if (tween.isFinished()) {
            this.#tweens.splice(i, 1);
          }
        } else {
          this.#tweens.splice(i, 1);
          continue;
        }
      } catch (error) {
        console.error(error);
      }
    }
  }
  //==============================================================================
  // 이전 출력.
  //==============================================================================
  /**
   * @virtual
   * @param { Graphic } graphic 
   */
  preDraw(graphic) {
  }
  //==============================================================================
  // 출력.
  //==============================================================================
  /**
   * @virtual
   * @param { Graphic } graphic 
   */
  draw(graphic) {
    const root = this.getRoot();
    graphic.drawNode(root);
  }
  //==============================================================================
  // 이후 출력.
  //==============================================================================
  /**
   * @virtual
   * @param { Graphic } graphic 
   */
  postDraw(graphic) {
  }
  //==============================================================================
  // 기즈모 출력.
  //==============================================================================
  /**
   * @virtual
   * @param { Graphic } graphic 
   */
  drawGizmos(graphic) {
    const isGizmoVisible = this.isGizmoVisible();
    if (!isGizmoVisible) {
      return;
    }
  }
  //==============================================================================
  // 터치 갱신.
  //==============================================================================
  /**
   * @virtual
   * @param { number } timeDelta 
   */
  tickTouch(timeDelta) {
    const engine = this.getEngine();
    const inputManager = engine.getInputManager();
    const viewInputPosition = inputManager.getViewInputPosition();
    if (inputManager.isTouchPressed()) {
      try {
        this.touchPress(viewInputPosition);
      } catch (error) {
        console.error(error);
      }
    } else if (inputManager.isTouchReleased()) {
      try {
        this.touchRelease(viewInputPosition);
      } catch (error) {
        console.error(error);
      }
    } else if (inputManager.isTouchMoved()) {
      try {
        this.touchMove(viewInputPosition);
      } catch (error) {
        console.error(error);
      }
    } else if (inputManager.isTouchCancelled()) {
      try {
        this.touchCancel(viewInputPosition);
      } catch (error) {
        console.error(error);
      }
    }
    if (typeof inputManager.hasWheelDelta === "function" && inputManager.hasWheelDelta()) {
      try {
        const wheelDelta = Vector2.create(inputManager.getWheelDeltaX(), inputManager.getWheelDeltaY());
        this.touchWheel(viewInputPosition, wheelDelta);
      } catch (error) {
        console.error(error);
      }
    }
  }
  //==============================================================================
  // 터치 누름.
  //==============================================================================
  /**
   * @virtual
   * @param { Vector2 } viewInputPosition
   */
  touchPress(viewInputPosition) {
  }
  //==============================================================================
  // 터치 이동.
  //==============================================================================
  /**
   * @virtual
   * @param { Vector2 } viewInputPosition
   */
  touchMove(viewInputPosition) {
  }
  //==============================================================================
  // 터치 뗌.
  //==============================================================================
  /**
   * @virtual
   * @param { Vector2 } viewInputPosition
   */
  touchRelease(viewInputPosition) {
  }
  //==============================================================================
  // 터치 취소됨.
  //==============================================================================
  /**
   * @virtual
   * @param { Vector2 } viewInputPosition
   */
  touchCancel(viewInputPosition) {
  }
  //==============================================================================
  // 마우스 휠.
  //==============================================================================
  /**
   * @virtual
   * @param { Vector2 } viewInputPosition
   * @param { Vector2 } wheelDelta
   */
  touchWheel(viewInputPosition, wheelDelta) {
  }
  //==============================================================================
  // 트윈 시작.
  //==============================================================================
  /**
   * @param { Tween } tween 
   */
  startTween(tween) {
    const index = this.#tweens.indexOf(tween);
    if (index !== -1) {
      return;
    }
    tween.start();
    this.#tweens.push(tween);
  }
  //==============================================================================
  // 트윈 중단.
  //==============================================================================
  /**
   * @param { Tween } tween 
   */
  stopTween(tween) {
    const index = this.#tweens.indexOf(tween);
    if (index === -1) {
      return;
    }
    tween.stop();
    this.#tweens.splice(index, 1);
  }
  //==============================================================================
  // 모든 트윈 중단.
  //==============================================================================
  stopAllTweens() {
    for (let i = this.#tweens.length - 1; i >= 0; --i) {
      const tween = this.#tweens[i];
      tween.stop();
      this.#tweens.splice(i, 1);
    }
  }
  //==============================================================================
  // 엔진 반환.
  //==============================================================================
  /**
   * @returns { Engine } 
   */
  getEngine() {
    return this.#engine;
  }
  //==============================================================================
  // 루트 노드 반환.
  //==============================================================================
  /**
   * @returns { WorldNode } 
   */
  getRoot() {
    return this.#root;
  }
  //==============================================================================
  // 기즈모 그리기 설정.
  //==============================================================================
  /**
   * @param { boolean } isVisible 
   */
  setGizmoVisible(isVisible) {
    this.#isGizmoVisible = isVisible;
  }
  //==============================================================================
  // 기즈모 그리기 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isGizmoVisible() {
    return this.#isGizmoVisible;
  }
};

// src/core/scenemanager.js
var System11 = globalThis;
var SceneManager = class extends Object2 {
  static {
    __name(this, "SceneManager");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Engine } */
  #engine;
  /** @private @type { Scene[] } */
  #loadedScenes;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   * @param { Engine } engine 
   */
  constructor(engine) {
    super();
    this.#engine = engine;
    this.#loadedScenes = [];
  }
  //==============================================================================
  // 씬 로드.
  //==============================================================================
  /**
   * 
   * @param { Scene } scene 
   */
  async loadScene(scene) {
    const engine = this.getEngine();
    const loadedScenes = this.getAllLoadedScenes();
    if (scene && scene instanceof Scene && !loadedScenes.includes(scene)) {
      scene.create();
      scene.setEngine(engine);
      loadedScenes.push(scene);
      await scene.load(engine);
      await new System11.Promise((resolve) => {
        System11.setTimeout(resolve, 300);
      });
      scene.setLoaded(true);
      scene.initialize(engine);
    }
  }
  //==============================================================================
  // 씬 언로드.
  //==============================================================================
  /**
   * 
   * @param { Scene } scene 
   */
  async unloadScene(scene) {
    const engine = this.getEngine();
    const loadedScenes = this.getAllLoadedScenes();
    if (scene && scene instanceof Scene && loadedScenes.includes(scene)) {
      scene.finalize(engine);
      await scene.unload(engine);
      const loadedSceneIndex = loadedScenes.indexOf(scene);
      loadedScenes.splice(loadedSceneIndex, 1);
    }
  }
  //==============================================================================
  // 모든 로드된 씬 언로드.
  //==============================================================================
  async unloadAllScenes() {
    const loadedScenes = this.getAllLoadedScenes();
    while (loadedScenes.length > 0) {
      const loadedScene = loadedScenes[0];
      await this.unloadScene(loadedScene);
    }
  }
  //==============================================================================
  // 엔진 반환.
  //==============================================================================
  /**
   * @returns { Engine }
   */
  getEngine() {
    return this.#engine;
  }
  //==============================================================================
  // 모든 로드된 씬 반환.
  //==============================================================================
  /**
   * @returns { Scene[] }
   */
  getAllLoadedScenes() {
    return this.#loadedScenes;
  }
};

// src/core/asset.js
var System12 = globalThis;
var AssetType = System12.Object.freeze({
  none: "none",
  image: "image",
  audio: "audio",
  json: "json",
  text: "text",
  font: "font",
  blob: "blob",
  bunch: "bunch",
  visual: "visual"
});
var Asset = class extends Object2 {
  static {
    __name(this, "Asset");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { string } */
  #assetPath;
  /** @private @type { boolean } */
  #isLoaded;
  /** @private @type { string } */
  #assetType;
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.#assetPath = "";
    this.#isLoaded = false;
    this.#assetType = AssetType.none;
  }
  //==============================================================================
  // 비동기 애셋 로드.
  //==============================================================================
  /**
   * @virtual
   * @param { string } assetPath 
   */
  async load(assetPath) {
    const isLoaded = this.isLoaded();
    if (isLoaded) {
      return;
    }
    this.setAssetPath(assetPath);
    System12.Promise.resolve();
  }
  //==============================================================================
  // 애셋 언로드.
  //==============================================================================
  /**
   * @virtual
   */
  unload() {
    const isLoaded = this.isLoaded();
    if (!isLoaded) {
      return Promise.resolve();
    }
    this.setAssetPath("");
    this.setLoaded(false);
  }
  //==============================================================================
  // 애셋 타입 설정.
  //==============================================================================
  /**
   * @param { string } assetType
   */
  setAssetType(assetType) {
    this.#assetType = assetType;
  }
  //==============================================================================
  // 애셋 타입 반환.
  //==============================================================================
  /**
   * @returns { string }
   */
  getAssetType() {
    return this.#assetType;
  }
  //==============================================================================
  // 로드 경로 설정.
  //==============================================================================
  /**
   * @param { string } assetPath
   */
  setAssetPath(assetPath) {
    this.#assetPath = assetPath;
  }
  //==============================================================================
  // 로드 경로 반환.
  //==============================================================================
  /**
   * @returns { string }
   */
  getAssetPath() {
    return this.#assetPath;
  }
  //==============================================================================
  // 로드 되었는지 여부 설정.
  //==============================================================================
  /**
   * @param { boolean } isLoaded
   */
  setLoaded(isLoaded) {
    this.#isLoaded = isLoaded;
  }
  //==============================================================================
  // 로드 되었는지 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isLoaded() {
    return this.#isLoaded;
  }
};

// src/resource/audioasset.js
var System13 = globalThis;
var AudioAsset = class extends Asset {
  static {
    __name(this, "AudioAsset");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { AudioBuffer | null } */
  #audioBuffer;
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.setAssetType(AssetType.audio);
    this.#audioBuffer = null;
  }
  //==============================================================================
  // 비동기 애셋 로드.
  //==============================================================================
  /**
   * @override
   * @param { string } assetPath
   */
  async load(assetPath) {
    const isLoaded = this.isLoaded();
    if (isLoaded) {
      return Promise.resolve();
    }
    const audioContextType = System13.window.AudioContext || System13.window.webkitAudioContext;
    if (!audioContextType) {
      console.error(`AudioContext is not supported.`);
      return;
    }
    try {
      const response = await System13.fetch(assetPath);
      const arrayBuffer = await response.arrayBuffer();
      const tempAudioContext = new audioContextType();
      this.#audioBuffer = await tempAudioContext.decodeAudioData(arrayBuffer);
      await tempAudioContext.close();
      this.setLoaded(true);
    } catch (error) {
      console.error(`Error loading sound: ${assetPath}`, error);
      throw error;
    }
  }
  //==============================================================================
  // 오디오 버퍼 반환.
  //==============================================================================
  /**
   * @returns { AudioBuffer | null }
   */
  getAudioBuffer() {
    return this.#audioBuffer;
  }
  //==============================================================================
  // 재생 시간 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getDuration() {
    if (this.#audioBuffer !== null && this.#audioBuffer !== void 0) {
      return this.#audioBuffer.duration;
    }
    return 0;
  }
};

// src/core/audioplayer.js
var AudioPlayer = class {
  static {
    __name(this, "AudioPlayer");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { AudioContext | null } */
  #audioContext;
  /** @private @type { AudioAsset | null } */
  #audioAsset;
  /** @private @type { AudioBufferSourceNode | null } */
  #audioSource;
  /** @private @type { GainNode | null } */
  #gainNode;
  /** @private @type { boolean } */
  #isPlaying;
  /** @private @type { boolean } */
  #isMuted;
  /** @private @type { boolean } */
  #isLoop;
  // 루프 여부.
  /** @private @type { number } */
  #time;
  // 재생 위치 (초). play() 호출 시 이 위치부터 재생.
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   * @param { AudioContext | null } audioContext
   */
  constructor(audioContext) {
    this.#audioContext = audioContext;
    this.#audioAsset = null;
    this.#audioSource = null;
    this.#gainNode = null;
    this.#isPlaying = false;
    this.#isMuted = false;
    this.#isLoop = false;
    this.#time = 0;
    if (audioContext) {
      this.#gainNode = audioContext.createGain();
      this.#gainNode.connect(audioContext.destination);
    }
  }
  //==============================================================================
  // 재생.
  //==============================================================================
  /**
   * @param { boolean } loop
   */
  play(loop = false) {
    const audioContext = this.getAudioContext();
    if (!audioContext || !this.#gainNode) {
      return;
    }
    const audioAsset = this.getAudioAsset();
    if (!audioAsset) {
      return;
    }
    const audioBuffer = audioAsset.getAudioBuffer();
    if (!audioBuffer) {
      return;
    }
    if (this.#audioSource) {
      this.#audioSource.onended = null;
      this.#audioSource.stop();
      this.#audioSource = null;
    }
    if (audioContext.state === "suspended") {
      audioContext.resume().then(() => {
        this.startPlayback(audioBuffer, loop);
      });
      return;
    }
    this.startPlayback(audioBuffer, loop);
  }
  //==============================================================================
  // 내부 재생 시작.
  //==============================================================================
  /**
   * @param { AudioBuffer } audioBuffer
   * @param { boolean } loop
   */
  startPlayback(audioBuffer, loop) {
    const audioContext = this.getAudioContext();
    if (!audioContext || !this.#gainNode) {
      return;
    }
    this.#isLoop = loop;
    this.#audioSource = audioContext.createBufferSource();
    this.#audioSource.buffer = audioBuffer;
    this.#audioSource.loop = loop;
    this.#audioSource.connect(this.#gainNode);
    this.#audioSource.onended = () => {
      this.#isPlaying = false;
      this.#audioSource = null;
    };
    this.#audioSource.start(0, this.#time);
    this.#isPlaying = true;
  }
  //==============================================================================
  // 정지.
  //==============================================================================
  stop() {
    if (this.#audioSource) {
      this.#audioSource.onended = null;
      this.#audioSource.stop();
      this.#audioSource = null;
    }
    this.#isPlaying = false;
  }
  //==============================================================================
  // 음소거.
  //==============================================================================
  mute() {
    if (this.#gainNode) {
      this.#gainNode.gain.value = 0;
      this.#isMuted = true;
    }
  }
  //==============================================================================
  // 음소거 해제.
  //==============================================================================
  unmute() {
    if (this.#gainNode) {
      this.#gainNode.gain.value = 1;
      this.#isMuted = false;
    }
  }
  //==============================================================================
  // 재생 위치 설정.
  // 재생 중이면 해당 위치부터 즉시 다시 재생.
  //==============================================================================
  /**
   * @param { number } time 재생 위치 (초).
   */
  setTime(time) {
    this.#time = time;
    if (this.#isPlaying) {
      this.play(this.#isLoop);
    }
  }
  //==============================================================================
  // 오디오 애셋 설정.
  //==============================================================================
  /**
   * @param { AudioAsset } audioAsset
   */
  setAudioAsset(audioAsset) {
    this.#audioAsset = audioAsset;
  }
  //==============================================================================
  // 오디오 애셋 반환.
  //==============================================================================
  /**
   * @returns { AudioAsset | null }
   */
  getAudioAsset() {
    return this.#audioAsset;
  }
  //==============================================================================
  // 재생 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isPlaying() {
    return this.#isPlaying;
  }
  //==============================================================================
  // 음소거 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isMuted() {
    return this.#isMuted;
  }
  //==============================================================================
  // 현재 시간 반환. (0~duration)
  //==============================================================================
  /**
   * @returns { number }
   */
  getTime() {
    return this.#time;
  }
  //==============================================================================
  // 재생 시간 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getDuration() {
    const audioAsset = this.getAudioAsset();
    if (!audioAsset) {
      return 0;
    }
    return audioAsset.getDuration();
  }
  //==============================================================================
  // 오디오 컨텍스트 반환.
  //==============================================================================
  /**
   * @returns { AudioContext | null }
   */
  getAudioContext() {
    return this.#audioContext;
  }
};

// src/core/audiomanager.js
var System14 = globalThis;
var AudioManager = class extends Object2 {
  static {
    __name(this, "AudioManager");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { AudioContext | null } */
  #audioContext;
  /** @private @type { boolean } */
  #hasUserGesture;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   * @param { Engine } engine
   */
  constructor(engine) {
    super();
    this.#audioContext = null;
    this.#hasUserGesture = false;
  }
  //==============================================================================
  // 첫 user gesture 가 발생했음을 알린다. (Engine 의 click/touchstart/keydown 핸들러에서 호출)
  //==============================================================================
  markUserGesture() {
    this.#hasUserGesture = true;
  }
  //==============================================================================
  // user gesture 이후인지 여부.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  hasUserGesture() {
    return this.#hasUserGesture;
  }
  //==============================================================================
  // AudioContext 를 보장 (없으면 생성).
  //==============================================================================
  /**
   * @private
   * @returns { AudioContext | null }
   */
  ensureAudioContext() {
    if (this.#audioContext) {
      return this.#audioContext;
    }
    const audioContextType = System14.window.AudioContext || System14.window.webkitAudioContext;
    if (audioContextType) {
      this.#audioContext = new audioContextType();
    }
    return this.#audioContext;
  }
  //==============================================================================
  // 오디오 컨텍스트 재개.
  // - user gesture 전에는 silently no-op (브라우저 경고 회피).
  // - resume() 의 promise rejection 도 silently 처리.
  //==============================================================================
  resumeContext() {
    if (!this.#hasUserGesture) {
      return;
    }
    const audioContext = this.ensureAudioContext();
    if (!audioContext) {
      return;
    }
    if (audioContext.state !== "suspended" && audioContext.state !== "interrupted") {
      return;
    }
    try {
      const result = audioContext.resume();
      if (result && typeof result.catch === "function") {
        result.catch(() => {
        });
      }
    } catch (error) {
    }
  }
  //==============================================================================
  // 오디오 플레이어 생성.
  //==============================================================================
  /**
   * @returns { AudioPlayer }
   */
  createAudioPlayer() {
    const audioContext = this.ensureAudioContext();
    return new AudioPlayer(audioContext);
  }
  //==============================================================================
  // 오디오 컨텍스트 반환. (없으면 null)
  //==============================================================================
  /**
   * @returns { AudioContext | null }
   */
  getAudioContext() {
    return this.#audioContext;
  }
};

// src/resource/fontasset.js
var FontAsset = class extends Asset {
  static {
    __name(this, "FontAsset");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @type { string } */
  family = "";
  /** @type { FontFace } */
  fontFace = null;
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.setAssetType(AssetType.font);
    this.family = "";
    this.fontFace = null;
  }
  //==============================================================================
  // 비동기 애셋 로드.
  //==============================================================================
  /**
   * @override
   * @param { string } assetPath 
   */
  async load(assetPath) {
    await super.load(assetPath);
    const isLoaded = this.isLoaded();
    if (isLoaded) {
      return Promise.resolve();
    }
  }
  //==============================================================================
  // 비동기 애셋 로드.
  //==============================================================================
  /**
   * @param { string } family 
   * @param { string } assetPath 
   */
  async loadFont(family, assetPath) {
    if (this.fontFace) {
      return Promise.resolve();
    }
    await super.load(assetPath);
    this.family = family;
    this.fontFace = new FontFace(this.family, `url(${assetPath})`);
    await this.fontFace.load();
    document.fonts.add(this.fontFace);
    this.setLoaded(true);
  }
  //==============================================================================
  // 애셋 언로드.
  //==============================================================================
  /**
   * @override
   * @method
   */
  unload() {
    super.unload();
    if (this.fontFace === null || this.fontFace === void 0)
      return;
    document.fonts.delete(this.fontFace);
    this.fontFace = null;
    this.setLoaded(false);
  }
};

// src/core/engine.js
var System15 = globalThis;
var EngineConfiguration = class extends Object2 {
  static {
    __name(this, "EngineConfiguration");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @type { Vector2 } */
  referenceResolutionSize;
  // 기준 해상도.
  // /** @type { ViewScaleMode } */ viewScaleMode; // 뷰 모드.
  /** @type { string } */
  canvasId;
  // 캔버스 식별자.
  /** @type { boolean } */
  useStatistics;
  // 정보창 출력 여부.
  /** @type { boolean } */
  autoResizeOnWindowResize;
  // 윈도우가 리사이즈 될 때 캔버스 사이즈 자동 반영.
  /** @type { string } */
  title;
  // 이름.
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.referenceResolutionSize = Vector2.zero();
    this.canvasId = "";
    this.useStatistics = false;
    this.autoResizeOnWindowResize = false;
    this.title = "";
  }
};
var Engine = class extends Object2 {
  static {
    __name(this, "Engine");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { EngineConfiguration } */
  #engineConfiguration;
  /** @private @type { Platform } */
  #platform;
  /** @private @type { Graphic } */
  #graphic;
  /** @private @type { SceneManager } */
  #sceneManager;
  /** @private @type { TimeManager } */
  #timeManager;
  /** @private @type { ViewManager } */
  #viewManager;
  /** @private @type { InputManager } */
  #inputManager;
  /** @private @type { AudioManager } */
  #audioManager;
  /** @private @type { () => void  } */
  #resizeCallback;
  /** @private @type { () => void  } */
  #resumeCallback;
  /** @private @type { FrameRequestCallback } */
  #updateEngineCallback;
  /** @private @type { number } */
  #frameNumber;
  /** @private @type { Rect } */
  #statisticsTextRect;
  /** @private @type { Version } */
  #version;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   * @param { EngineConfiguration } engineConfiguration
   */
  constructor(engineConfiguration) {
    super();
    if (engineConfiguration === null || engineConfiguration === void 0 || engineConfiguration instanceof EngineConfiguration === false) {
      throw new System15.Error(`engineConfiguration is invalid.`);
    }
    this.#engineConfiguration = engineConfiguration;
    this.#platform = new Platform();
    if (engineConfiguration.title !== "") {
      System15.document.title = engineConfiguration.title;
    }
    const canvasId = this.#engineConfiguration.canvasId;
    const canvas = this.#platform.getOrAddCanvas(canvasId);
    this.#graphic = new Graphic(canvas);
    this.#sceneManager = new SceneManager(this);
    this.#timeManager = new TimeManager(this);
    this.#viewManager = new ViewManager(this);
    this.#viewManager.setCanvas(canvas);
    this.#inputManager = new InputManager(this);
    this.#audioManager = new AudioManager(this);
    this.#resizeCallback = this.resize.bind(this);
    this.#resumeCallback = this.resume.bind(this);
    this.#updateEngineCallback = this.updateEngine.bind(this);
    this.#frameNumber = 0;
    this.#statisticsTextRect = Rect.zero();
    this.#version = Version.create(0, 2, 1);
    System15.vanillaEngine = this;
    this.setupAllDocumentEvents();
    this.resize();
  }
  //==============================================================================
  // 시작.
  //==============================================================================
  /**
   * @param { Scene } scene
   */
  run(scene) {
    if (scene === null || scene === void 0 || scene instanceof Scene === false) {
      throw new System15.Error(`scene is invalid.`);
    }
    const internalFontFace = new FontFace(`DOSGothic`, `url("https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_eight@1.0/DOSGothic.woff")`);
    internalFontFace.load().then((loadedFont) => {
      document.fonts.add(loadedFont);
      const sceneManager = this.getSceneManager();
      sceneManager.loadScene(scene).catch((error) => {
        console.error(error);
      });
      System15.window.addEventListener("resize", this.#resizeCallback);
      if (System15.window.visualViewport) {
        System15.window.visualViewport.addEventListener("resize", this.#resizeCallback);
        System15.window.visualViewport.addEventListener("scroll", this.#resizeCallback);
      }
      ++this.#frameNumber;
      System15.window.requestAnimationFrame(this.#updateEngineCallback);
    }).catch((error) => {
      console.error(error);
    });
  }
  //==============================================================================
  // 오디오 컨텍스트 재개.
  //==============================================================================
  resume() {
    const audioManager = this.getAudioManager();
    audioManager.resumeContext();
  }
  //==============================================================================
  // 첫 user gesture (click/touch/keydown) 핸들러.
  // AudioManager 에 user gesture 발생을 알리고 컨텍스트 재개를 시도한다.
  //==============================================================================
  resumeOnUserGesture() {
    const audioManager = this.getAudioManager();
    if (audioManager) {
      audioManager.markUserGesture();
      audioManager.resumeContext();
    }
  }
  //==============================================================================
  // 해상도 변경됨.
  //==============================================================================
  resize() {
    const engineConfiguration = this.getEngineConfiguration();
    const viewManager = this.getViewManager();
    if (engineConfiguration.autoResizeOnWindowResize) {
      const visualViewport = System15.window.visualViewport;
      const clientWidth = visualViewport ? visualViewport.width : System15.window.innerWidth;
      const clientHeight = visualViewport ? visualViewport.height : System15.window.innerHeight;
      const clientNativeSize = Vector2.create(clientWidth, clientHeight);
      const canvas = viewManager.getCanvas();
      canvas.style.width = `${clientNativeSize.x}px`;
      canvas.style.height = `${clientNativeSize.y}px`;
    }
    const beforeCanvasNativeSize = viewManager.getCanvasNativeSize();
    const beforeViewRect = viewManager.getViewNativeRect();
    viewManager.calculateViewRect();
    const afterCanvasNativeSize = viewManager.getCanvasNativeSize();
    const afterViewRect = viewManager.getViewNativeRect();
    const sceneManager = this.getSceneManager();
    const loadedScenes = sceneManager.getAllLoadedScenes();
    for (const loadedScene of loadedScenes) {
      try {
        loadedScene.resize(afterCanvasNativeSize);
      } catch (error) {
        console.error(error);
      }
    }
  }
  //==============================================================================
  // 웹페이지에 기반하는 이벤트 설정.
  //==============================================================================
  setupAllDocumentEvents() {
    const viewManager = this.getViewManager();
    const inputManager = this.getInputManager();
    const canvas = viewManager.getCanvas();
    const recoverEngineState = /* @__PURE__ */ __name(() => {
      const audioManager = this.getAudioManager();
      if (audioManager) {
        audioManager.resumeContext();
      }
      const inputManager2 = this.getInputManager();
      if (inputManager2) {
        inputManager2.clear();
      }
    }, "recoverEngineState");
    System15.document.addEventListener("resume", () => {
      console.log(`[Engine] resume: persisted`);
      recoverEngineState();
      const sceneManager = this.getSceneManager();
      const loadedScenes = sceneManager.getAllLoadedScenes();
      for (const loadedScene of loadedScenes) {
        loadedScene.onPageProcessRestored();
      }
    });
    System15.window.addEventListener("pageshow", (pageTransitionEvent) => {
      if (pageTransitionEvent.persisted) {
        console.log(`[Engine] pageshow: persisted`);
        dispatchPageProcessRestored();
      }
    });
    System15.document.addEventListener("visibilitychange", () => {
      if (System15.document.visibilityState === "visible") {
        console.log(`[Engine] visibilitychange: visible`);
        recoverEngineState();
        const sceneManager = this.getSceneManager();
        const loadedScenes = sceneManager.getAllLoadedScenes();
        for (const loadedScene of loadedScenes) {
          loadedScene.onPageVisibilityRestored();
        }
      }
    });
    System15.document.addEventListener("keydown", (keyboardEvent) => {
      const key = keyboardEvent.code;
      inputManager.pushKey(key);
    });
    System15.document.addEventListener("keyup", (keyboardEvent) => {
      const key = keyboardEvent.code;
      inputManager.popKey(key);
    });
    canvas.addEventListener("contextmenu", (touchEvent) => {
      touchEvent.preventDefault();
    });
    canvas.addEventListener("mousedown", (touchEvent) => {
      const inputManager2 = this.getInputManager();
      inputManager2.setTouchPressed(true);
      inputManager2.setTouchMoved(true);
      this.updateCanvasNativeInputPosition(touchEvent.clientX, touchEvent.clientY);
    });
    canvas.addEventListener("mousemove", (touchEvent) => {
      this.updateCanvasNativeInputPosition(touchEvent.clientX, touchEvent.clientY);
    });
    canvas.addEventListener("mouseup", (touchEvent) => {
      const inputManager2 = this.getInputManager();
      inputManager2.setTouchMoved(false);
      inputManager2.setTouchReleased(true);
      this.updateCanvasNativeInputPosition(touchEvent.clientX, touchEvent.clientY);
    });
    canvas.addEventListener("wheel", (wheelEvent) => {
      const inputManager2 = this.getInputManager();
      inputManager2.addWheelDelta(wheelEvent.deltaX, wheelEvent.deltaY);
      this.updateCanvasNativeInputPosition(wheelEvent.clientX, wheelEvent.clientY);
      wheelEvent.preventDefault();
    }, { passive: false });
    System15.window.addEventListener("mouseup", (touchEvent) => {
      const inputManager2 = this.getInputManager();
      if (!inputManager2.isTouchMoved()) {
        return;
      }
      inputManager2.setTouchMoved(false);
      inputManager2.setTouchReleased(true);
      this.updateCanvasNativeInputPosition(touchEvent.clientX, touchEvent.clientY);
    });
    canvas.addEventListener("touchstart", (touchEvent) => {
      const touch = touchEvent.changedTouches[0];
      if (!touch) {
        return;
      }
      const inputManager2 = this.getInputManager();
      inputManager2.setTouchMoved(true);
      inputManager2.setTouchPressed(true);
      this.updateCanvasNativeInputPosition(touch.clientX, touch.clientY);
      touchEvent.preventDefault();
    }, { passive: false });
    canvas.addEventListener("touchmove", (touchEvent) => {
      const touch = touchEvent.changedTouches[0];
      if (!touch) {
        return;
      }
      this.updateCanvasNativeInputPosition(touch.clientX, touch.clientY);
      touchEvent.preventDefault();
    }, { passive: false });
    canvas.addEventListener("touchend", (touchEvent) => {
      const touch = touchEvent.changedTouches[0];
      if (touch) {
        this.updateCanvasNativeInputPosition(touch.clientX, touch.clientY);
      }
      const inputManager2 = this.getInputManager();
      inputManager2.setTouchMoved(false);
      inputManager2.setTouchReleased(true);
      touchEvent.preventDefault();
    }, { passive: false });
    System15.window.addEventListener("touchmove", (touchEvent) => {
      const touch = touchEvent.changedTouches[0];
      if (!touch) {
        return;
      }
      const x = touch.clientX;
      const y = touch.clientY;
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
        inputManager.setTouchMoved(false);
        inputManager.setTouchReleased(true);
      }
    });
    canvas.addEventListener("touchcancel", (touchEvent) => {
      const touch = touchEvent.changedTouches[0];
      if (touch) {
        this.updateCanvasNativeInputPosition(touch.clientX, touch.clientY);
      }
      const inputManager2 = this.getInputManager();
      inputManager2.setTouchMoved(false);
      inputManager2.setTouchCancelled(true);
    });
    System15.window.addEventListener("blur", (focusEvent) => {
      const inputManager2 = this.getInputManager();
      inputManager2.setTouchMoved(false);
      inputManager2.setTouchReleased(true);
      focusEvent.preventDefault();
    }, { passive: false });
    const userGestureHandler = this.resumeOnUserGesture.bind(this);
    System15.window.addEventListener("click", userGestureHandler);
    System15.window.addEventListener("touchstart", userGestureHandler);
    System15.window.addEventListener("keydown", userGestureHandler);
    System15.window.addEventListener("focus", this.#resumeCallback);
    System15.document.addEventListener("visibilitychange", () => {
      if (System15.document.visibilityState === "visible") {
        this.resume();
      }
    });
    System15.document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === canvas) {
      } else {
      }
    });
    System15.window.addEventListener("gamepadconnected", (gamepadEvent) => {
      const gamepad = gamepadEvent.gamepad;
      const inputManager2 = this.getInputManager();
      inputManager2.connectGamepad(gamepad);
      console.log(`gamepadconnected: ${gamepad.id}`);
    });
    System15.window.addEventListener("gamepaddisconnected", (gamepadEvent) => {
      const gamepad = gamepadEvent.gamepad;
      const inputManager2 = this.getInputManager();
      inputManager2.disconnectGamepad(gamepad);
      console.log(`gamepaddisconnected: ${gamepad.id}`);
    });
  }
  //==============================================================================
  // 입력 좌표 갱신.
  //==============================================================================
  /**
   * @param { number } x
   * @param { number } y
   */
  updateCanvasNativeInputPosition(x, y) {
    const inputManager = this.getInputManager();
    const viewManager = this.getViewManager();
    const canvas = viewManager.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const canvasNativeInputPosition = Vector2.create(x - rect.left, y - rect.top);
    inputManager.setCanvasNativeInputPosition(canvasNativeInputPosition);
    const viewInputPosition = viewManager.canvasPositionToViewPosition(canvasNativeInputPosition);
    inputManager.setViewInputPosition(viewInputPosition);
  }
  //==============================================================================
  // 개발 관련 정보 출력.
  //==============================================================================
  /**
   * @param { Graphic } graphic 
   */
  drawStatistics(graphic) {
    const timeManager = this.getTimeManager();
    const viewManager = this.getViewManager();
    const inputManager = this.getInputManager();
    const textPosition = Vector2.create(16, 16);
    this.#statisticsTextRect.position = textPosition.clone();
    const drawStatisticsText = /* @__PURE__ */ __name((text) => {
      if (text) {
        graphic.drawFillText(text, textPosition.x, textPosition.y);
      }
      textPosition.y += 16;
      const metrics = graphic.measureText(text);
      const width = metrics.width;
      const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
      const textRect = Rect.create(textPosition.x, textPosition.y, width, height);
      this.#statisticsTextRect.size.x = Math.max(this.#statisticsTextRect.size.x, width);
      this.#statisticsTextRect.size.y += 16;
    }, "drawStatisticsText");
    const formatSizeString = /* @__PURE__ */ __name((bytes) => {
      let killo = bytes / 1024;
      let mega = killo / 1024;
      let value = mega.toFixed(2);
      return `${value} MB`;
    }, "formatSizeString");
    graphic.setTransform(1, 0, 0, 1, 0, 0);
    graphic.scale(1.4, 1.4);
    graphic.setFillColor("rgba(0, 0, 0, 0.6)");
    graphic.drawRoundRect(Rect.create(
      this.#statisticsTextRect.position.x - 10,
      this.#statisticsTextRect.position.y - 10,
      this.#statisticsTextRect.size.x + 20,
      this.#statisticsTextRect.size.y + 20
    ), 12);
    this.#statisticsTextRect.size.y = 0;
    graphic.setFontString(`16px DOSGothic`);
    graphic.setTextAlign("left");
    graphic.setTextBaseline("top");
    graphic.setFillColor(Colors.white);
    this.#platform.getPlatformInfo();
    const versionString = this.getVersionString();
    drawStatisticsText(`engineVersion: ${versionString}`);
    drawStatisticsText(`platformName: ${this.#platform.platformName}`);
    drawStatisticsText(`browserName: ${this.#platform.browserName}`);
    drawStatisticsText(``);
    const canvasNativeSize = viewManager.getCanvasNativeSize();
    const viewScaleMode = viewManager.getViewScaleMode();
    const referenceResolutionSize = viewManager.getReferenceResolutionSize();
    const viewNativeRect = viewManager.getViewNativeRect();
    const viewSize = viewManager.getViewSize();
    const canvasNativeInputPosition = inputManager.getCanvasNativeInputPosition();
    const viewInputPosition = inputManager.getViewInputPosition();
    drawStatisticsText(`canvasNativeSize: (${canvasNativeSize.x}, ${canvasNativeSize.y})`);
    drawStatisticsText(`referenceResolutionSize: (${referenceResolutionSize.x}, ${referenceResolutionSize.y})`);
    drawStatisticsText(`viewScaleMode: ${viewScaleMode}`);
    drawStatisticsText(`viewNativeRect: (${viewNativeRect.position.x}, ${viewNativeRect.position.y}) - (${viewNativeRect.size.x}, ${viewNativeRect.size.y})`);
    drawStatisticsText(`viewSize: (${viewSize.x}, ${viewSize.y})`);
    drawStatisticsText(`canvasNativeInputPosition: (${canvasNativeInputPosition.x}, ${canvasNativeInputPosition.y})`);
    drawStatisticsText(`viewInputPosition: (${viewInputPosition.x}, ${viewInputPosition.y})`);
    drawStatisticsText(``);
    const time = timeManager.getTime().toFixed(2);
    const framePerSecond = timeManager.getFramePerSecond();
    const timeDelta = timeManager.getTimeDelta().toFixed(3);
    drawStatisticsText(`time: ${time}s`);
    drawStatisticsText(`framePerSecond: ${framePerSecond}`);
    drawStatisticsText(`timeDelta: ${timeDelta}s`);
  }
  //==============================================================================
  // 엔진 갱신.
  //==============================================================================
  /**
   * @param { number } timestamp
   */
  updateEngine(timestamp) {
    const graphic = this.getGraphic();
    graphic.applySettings(this);
    const timeManager = this.getTimeManager();
    timeManager.update(timestamp);
    const timeDelta = timeManager.getTimeDelta();
    const inputManager = this.getInputManager();
    inputManager.tick(timeDelta);
    const sceneManager = this.getSceneManager();
    const loadedScenes = sceneManager.getAllLoadedScenes();
    for (const loadedScene of loadedScenes) {
      try {
        if (!loadedScene.isLoaded()) {
          loadedScene.drawOnLoad(graphic);
          continue;
        }
        loadedScene.tick(timeDelta);
        loadedScene.preDraw(graphic);
        loadedScene.draw(graphic);
        loadedScene.postDraw(graphic);
        const isGizmoVisible = loadedScene.isGizmoVisible();
        if (isGizmoVisible) {
          loadedScene.drawGizmos(graphic);
        }
      } catch (error) {
        console.error(error);
      }
    }
    const engineConfiguration = this.getEngineConfiguration();
    if (engineConfiguration.useStatistics) {
      this.drawStatistics(graphic);
    }
    inputManager.setTouchPressed(false);
    inputManager.setTouchReleased(false);
    inputManager.setTouchCancelled(false);
    inputManager.clearWheelDelta();
    ++this.#frameNumber;
    System15.window.requestAnimationFrame(this.#updateEngineCallback);
  }
  //==============================================================================
  // 커서 보이기 설정.
  //==============================================================================
  /**
   * @param { boolean } visibled 
   */
  setVisibleCursor(visibled) {
    if (visibled) {
      document.body.style.cursor = "default";
    } else {
      document.body.style.cursor = "none";
    }
  }
  //==============================================================================
  // 캔버스 정보 반환.
  //==============================================================================
  /**
   * @returns { HTMLCanvasElement }
   */
  getCanvas() {
    const viewManager = this.getViewManager();
    return viewManager.getCanvas();
  }
  //==============================================================================
  // 플랫폼 정보 반환.
  //==============================================================================
  /**
   * @returns { Platform }
   */
  getPlatform() {
    return this.#platform;
  }
  //==============================================================================
  // 씬 매니저 반환.
  //==============================================================================
  /**
   * @returns { SceneManager }
   */
  getSceneManager() {
    return this.#sceneManager;
  }
  //==============================================================================
  // 시간 매니저 반환.
  //==============================================================================
  /**
   * @returns { TimeManager }
   */
  getTimeManager() {
    return this.#timeManager;
  }
  //==============================================================================
  // 뷰 매니저 반환.
  //==============================================================================
  /**
   * @returns { ViewManager }
   */
  getViewManager() {
    return this.#viewManager;
  }
  //==============================================================================
  // 입력 매니저 반환.
  //==============================================================================
  /**
   * @returns { InputManager }
   */
  getInputManager() {
    return this.#inputManager;
  }
  //==============================================================================
  // 오디오 매니저 반환.
  //==============================================================================
  /**
   * @returns { AudioManager }
   */
  getAudioManager() {
    return this.#audioManager;
  }
  //==============================================================================
  // 렌더러 반환.
  //==============================================================================
  /**
   * @returns { Graphic }
   */
  getGraphic() {
    return this.#graphic;
  }
  //==============================================================================
  // 버전 반환.
  //==============================================================================
  /**
   * @returns { string }
   */
  getVersionString() {
    return this.#version.getVersionString();
  }
  //==============================================================================
  // 엔진 설정 반환.
  //==============================================================================
  /**
   * @returns { EngineConfiguration }
   */
  getEngineConfiguration() {
    return this.#engineConfiguration;
  }
  //==============================================================================
  // 현재 프레임 번호 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getFrameNumber() {
    return this.#frameNumber;
  }
  //==============================================================================
  // 전역 인스턴스 반환.
  //==============================================================================
  /**
   * @returns { Engine }
   */
  static getEngine() {
    return System15.vanillaEngine;
  }
};

// src/core/touchraycaster.js
var TouchRaycaster = class extends Object2 {
  static {
    __name(this, "TouchRaycaster");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { * } */
  #rootNode;
  /** @private @type { WorldNode | null } */
  #touchTarget;
  /** @private @type { boolean } */
  #hasEverTouched;
  /** @private @type { Function | null } */
  #firstTouchCallback;
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.#rootNode = null;
    this.#touchTarget = null;
    this.#hasEverTouched = false;
    this.#firstTouchCallback = null;
  }
  //==============================================================================
  // 터치 누름.
  // - raycast로 대상을 결정하고 touchPress를 전달한다.
  //==============================================================================
  /**
   * @param { Vector2 } viewInputPosition
   */
  touchPress(viewInputPosition) {
    if (!this.#hasEverTouched) {
      this.#hasEverTouched = true;
      if (this.#firstTouchCallback) {
        this.#firstTouchCallback();
      }
    }
    const hitNode = this.raycast(viewInputPosition);
    this.#touchTarget = hitNode;
    if (hitNode) {
      hitNode.touchPress(viewInputPosition);
    }
  }
  //==============================================================================
  // 터치 이동.
  // - press 시 결정된 대상에 touchMove를 전달한다.
  //==============================================================================
  /**
   * @param { Vector2 } viewInputPosition
   */
  touchMove(viewInputPosition) {
    const touchTarget = this.getTouchTarget();
    if (touchTarget) {
      touchTarget.touchMove(viewInputPosition);
    }
  }
  //==============================================================================
  // 터치 뗌.
  // - press 시 결정된 대상에 touchRelease를 전달하고 대상을 해제한다.
  //==============================================================================
  /**
   * @param { Vector2 } viewInputPosition
   */
  touchRelease(viewInputPosition) {
    const currentTarget = this.getTouchTarget();
    if (currentTarget) {
      currentTarget.touchRelease(viewInputPosition);
    }
    this.#touchTarget = null;
  }
  //==============================================================================
  // 터치 취소.
  // - press 시 결정된 대상에 touchCancel을 전달하고 대상을 해제한다.
  //==============================================================================
  /**
   * @param { Vector2 } viewInputPosition
   */
  touchCancel(viewInputPosition) {
    const currentTarget = this.getTouchTarget();
    if (currentTarget) {
      currentTarget.touchCancel(viewInputPosition);
    }
    this.#touchTarget = null;
  }
  //==============================================================================
  // 마우스 휠. (touchPress 와 무관하게 매번 viewInputPosition 으로 raycast 후
  //  부모 체인에서 첫 ScrollView 를 찾아 wheel 을 전달.)
  //==============================================================================
  /**
   * @param { Vector2 } viewInputPosition
   * @param { Vector2 } wheelDelta
   */
  touchWheel(viewInputPosition, wheelDelta) {
    const hitNode = this.raycast(viewInputPosition);
    if (!hitNode) return;
    const scrollView = this.findAncestorScrollViewForWheel(hitNode);
    if (scrollView && typeof scrollView.wheel === "function") {
      scrollView.wheel(wheelDelta);
    }
  }
  //==============================================================================
  // hitNode 자기 자신을 포함해 부모 체인에서 가장 가까운 UIScrollView 를 찾는다.
  // (TouchRecognizer 의 findAncestorScrollView 와 다른 점: target 자신도 후보)
  // - UIScrollView import 를 피하기 위해 컴포넌트 타입은 닥 타이핑으로 검사한다.
  //==============================================================================
  findAncestorScrollViewForWheel(target) {
    let node = target;
    while (node) {
      if (typeof node.getAllComponents === "function") {
        const components = node.getAllComponents();
        for (const component of components) {
          if (component && typeof component.wheel === "function" && typeof component.getScrollContentSize === "function") {
            return component;
          }
        }
      }
      node = typeof node.getParent === "function" ? node.getParent() : null;
    }
    return null;
  }
  //==============================================================================
  // 레이캐스트.
  // - 루트 노드로부터 draw() 호출 순서대로 번호를 매기며 순회한다.
  // - 활성화 상태이고 isInteractable()이 참이며 터치 좌표를 포함하는
  //   노드 중 가장 높은 번호의 노드를 반환한다.
  //==============================================================================
  /**
   * @param { Vector2 } viewInputPosition
   * @returns { WorldNode | null }
   */
  raycast(viewInputPosition) {
    const rootNode = this.getRootNode();
    if (!rootNode) {
      return null;
    }
    let drawOrderCounter = 0;
    let hitNode = null;
    let hitDrawOrder = -1;
    const traverse = /* @__PURE__ */ __name((node) => {
      if (!node) {
        return;
      }
      const isActive = node.isActive();
      if (!isActive) {
        return;
      }
      const currentDrawOrder = drawOrderCounter;
      ++drawOrderCounter;
      if (node instanceof WorldNode) {
        const isInteractable = node.isInteractable();
        if (isInteractable) {
          const isInside = node.contains(viewInputPosition);
          if (isInside) {
            if (currentDrawOrder > hitDrawOrder) {
              hitNode = node;
              hitDrawOrder = currentDrawOrder;
            }
          }
        }
      }
      const children = node.getChildren();
      for (const child of children) {
        traverse(child);
      }
    }, "traverse");
    traverse(rootNode);
    return hitNode;
  }
  //==============================================================================
  // 루트 노드 설정.
  //==============================================================================
  /**
   * @param { * } rootNode
   */
  setRootNode(rootNode) {
    this.#rootNode = rootNode;
  }
  //==============================================================================
  // 루트 노드 반환.
  //==============================================================================
  /**
   * @returns { * }
   */
  getRootNode() {
    return this.#rootNode;
  }
  //==============================================================================
  // 현재 터치 대상 반환.
  //==============================================================================
  /**
   * @returns { WorldNode | null }
   */
  getTouchTarget() {
    return this.#touchTarget;
  }
  //==============================================================================
  // 한 번이라도 터치된 적 있는지 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  hasEverTouched() {
    return this.#hasEverTouched;
  }
  //==============================================================================
  // 첫 터치 콜백 설정.
  //==============================================================================
  /**
   * @param { Function } callback
   */
  setFirstTouchCallback(callback) {
    this.#firstTouchCallback = callback;
  }
};

// src/ui/uiview.js
var UIView = class extends Component {
  static {
    __name(this, "UIView");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Engine } */
  #engine;
  /** @private @type { WorldNode | null } */
  #content;
  // 컨텐트 노드.
  /** @private @type { Color } */
  #backgroundColor;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.setComponentType("View");
    this.#engine = null;
    this.#content = null;
    this.#backgroundColor = new Color(1, 1, 1, 1);
  }
  //==============================================================================
  // 엔진 설정. (구 UIComponent 에서 이관)
  //==============================================================================
  /**
   * @param { Engine } engine
   */
  setEngine(engine) {
    this.#engine = engine;
  }
  //==============================================================================
  // 엔진 반환. (구 UIComponent 에서 이관)
  //==============================================================================
  /**
   * @returns { Engine | null }
   */
  getEngine() {
    return this.#engine;
  }
  //==============================================================================
  // 노드에 붙음.
  //==============================================================================
  /**
   * @override
   * @param { ComponentNode } node
   */
  attach(node) {
    super.attach(node);
    this.#content = new WorldNode();
    this.#content.setName("content");
    this.#content.setPivot(Pivot.topLeft);
    this.#content.setAnchor(Vector2.zero());
    this.#content.setAnchoredPosition(Vector2.zero());
    const content = this.getContent();
    node.addChild(content);
  }
  //==============================================================================
  // 노드에서 떨어짐.
  //==============================================================================
  /**
   * @override
   * @param { ComponentNode } node
   */
  detach(node) {
    super.detach(node);
  }
  //==============================================================================
  // 출력. (배경색이 설정된 경우 스크롤뷰 영역에 배경을 그린다)
  //==============================================================================
  /**
   * @override
   * @param { Graphic } graphic
   */
  draw(graphic) {
    const node = this.getNode();
    if (!node) {
      return;
    }
    const contentSize = node.getContentSize();
    const backgroundColor = this.getBackgroundColor();
    const backgroundRect = Rect.create(0, 0, contentSize.x, contentSize.y);
    graphic.setFillColor(backgroundColor);
    graphic.drawRect(backgroundRect);
  }
  //==============================================================================
  // 터치 누름. (TouchRaycaster → WorldNode)
  //==============================================================================
  /**
   * @virtual
   * @param { Vector2 } viewInputPosition
   */
  touchPress(viewInputPosition) {
  }
  //==============================================================================
  // 터치 이동. (TouchRaycaster → WorldNode)
  //==============================================================================
  /**
   * @virtual
   * @param { Vector2 } viewInputPosition
   */
  touchMove(viewInputPosition) {
  }
  //==============================================================================
  // 터치 뗌. (TouchRaycaster → WorldNode)
  //==============================================================================
  /**
   * @virtual
   * @param { Vector2 } viewInputPosition
   */
  touchRelease(viewInputPosition) {
  }
  //==============================================================================
  // 터치 취소. (TouchRaycaster → WorldNode)
  //==============================================================================
  /**
   * @virtual
   * @param { Vector2 } viewInputPosition
   */
  touchCancel(viewInputPosition) {
  }
  //==============================================================================
  // 콘텐츠 노드 반환. (자식 노드를 이 노드에 추가하면 스크롤 대상이 됨)
  //==============================================================================
  /**
   * @returns { WorldNode }
   */
  getContent() {
    return this.#content;
  }
  //==============================================================================
  // 배경색 설정.
  //==============================================================================
  /**
   * @param { Color | null } backgroundColor
   */
  setBackgroundColor(backgroundColor) {
    this.#backgroundColor = backgroundColor.clone();
  }
  //==============================================================================
  // 배경색 반환.
  //==============================================================================
  /**
   * @returns { Color }
   */
  getBackgroundColor() {
    return this.#backgroundColor;
  }
};

// src/core/component/paint.js
var Paint = class extends Component {
  static {
    __name(this, "Paint");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Color } */
  #color;
  // 컬러.
  /** @private @type { number } */
  #roundSize;
  // 라운드 사이즈.
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @construct
   */
  constructor() {
    super();
    this.setComponentType("Paint");
    this.#color = Color.white();
    this.#roundSize = 0;
  }
  //==============================================================================
  // 출력.
  //==============================================================================
  /**
   * @param { Graphic } graphic
   */
  draw(graphic) {
    const node = this.getNode();
    const contentSize = node.getContentSize();
    const color = this.getColor();
    const rect = Rect.create(0, 0, contentSize.x, contentSize.y);
    graphic.setFillColor(color);
    if (this.#roundSize > 0) {
      graphic.drawRoundRect(rect, this.#roundSize);
    } else {
      graphic.drawRect(rect);
    }
  }
  //==============================================================================
  // 색상 설정.
  //==============================================================================
  /**
   * @param { Color | string | CanvasGradient | CanvasPattern } other
   */
  setColor(other) {
    if (other === null || other === void 0) {
      this.#color = Color.transparent();
    } else if (typeof other === "string") {
      if (other.startsWith("#")) {
        this.#color = Color.createFromHEX(other);
      } else if (other.startsWith("rgb")) {
        this.#color = Color.createFromRGBA(other);
      }
    } else if (other instanceof Color) {
      this.#color = other;
    }
  }
  //==============================================================================
  // 색상 반환.
  //==============================================================================
  /**
   * @returns { Color }
   */
  getColor() {
    return this.#color;
  }
  //==============================================================================
  // 라운드 크기 설정.
  //==============================================================================
  /**
   * @param { number } roundSize
   */
  setRoundSize(roundSize) {
    this.#roundSize = roundSize;
  }
};

// src/ui/uiscrollbar.js
var ScrollBarAxis = {
  horizontal: "horizontal",
  vertical: "vertical"
};
var UIScrollBar = class extends WorldNode {
  static {
    __name(this, "UIScrollBar");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { * } */
  #scrollView;
  // 대상 UIScrollView 컴포넌트.
  /** @private @type { string } */
  #axis;
  /** @private @type { Paint } */
  #trackPaint;
  /** @private @type { WorldNode } */
  #thumbNode;
  /** @private @type { Paint } */
  #thumbPaint;
  /** @private @type { boolean } */
  #isDraggingThumb;
  /** @private @type { Vector2 } */
  #dragStartViewPosition;
  /** @private @type { Vector2 } */
  #dragStartScrollOffset;
  /** @private @type { number } */
  #minThumbSize;
  /** @private @type { boolean } */
  #autoHide;
  // 콘텐트가 가시영역에 들어오면 트랙까지 숨길지.
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.#scrollView = null;
    this.#axis = ScrollBarAxis.vertical;
    this.#isDraggingThumb = false;
    this.#dragStartViewPosition = Vector2.zero();
    this.#dragStartScrollOffset = Vector2.zero();
    this.#minThumbSize = 24;
    this.#autoHide = true;
    this.setPivot(Pivot.topLeft);
    this.setAnchor(Pivot.topLeft);
    this.setInteractable(true);
    this.#trackPaint = this.addComponent(Paint);
    this.#trackPaint.setColor(new Color(0, 0, 0, 0.15));
    this.#trackPaint.setRoundSize(4);
    this.#thumbNode = new WorldNode();
    this.#thumbNode.setName("thumb");
    this.#thumbNode.setPivot(Pivot.topLeft);
    this.#thumbNode.setAnchor(Pivot.topLeft);
    this.#thumbPaint = this.#thumbNode.addComponent(Paint);
    this.#thumbPaint.setColor(new Color(255, 255, 255, 0.6));
    this.#thumbPaint.setRoundSize(4);
    this.addChild(this.#thumbNode);
  }
  //==============================================================================
  // 대상 UIScrollView 설정.
  //==============================================================================
  setScrollView(scrollView) {
    this.#scrollView = scrollView;
  }
  //==============================================================================
  // 대상 UIScrollView 반환. (TouchRecognizer 가 자기 스크롤바의 ancestor scroll view
  //  인계 동작을 차단하는데 사용한다.)
  //==============================================================================
  getScrollView() {
    return this.#scrollView;
  }
  //==============================================================================
  // 축 설정. (ScrollBarAxis.vertical / horizontal)
  //==============================================================================
  setAxis(axis) {
    this.#axis = axis;
  }
  //==============================================================================
  // 트랙 색 설정.
  //==============================================================================
  setTrackColor(color) {
    this.#trackPaint.setColor(color);
  }
  //==============================================================================
  // 썸 색 설정.
  //==============================================================================
  setThumbColor(color) {
    this.#thumbPaint.setColor(color);
  }
  //==============================================================================
  // 썸 최소 길이 설정.
  //==============================================================================
  setMinThumbSize(size) {
    this.#minThumbSize = size;
  }
  //==============================================================================
  // 자동 숨김 설정. (콘텐트가 가시영역에 들어오면 트랙까지 숨김)
  //==============================================================================
  setAutoHide(autoHide) {
    this.#autoHide = autoHide;
  }
  //==============================================================================
  // 갱신.
  //==============================================================================
  tick(timeDelta) {
    super.tick(timeDelta);
    this.updateThumb();
  }
  //==============================================================================
  // 트랙 길이 / 가시 영역 / 콘텐트 크기로부터 썸의 위치와 크기를 갱신.
  //==============================================================================
  updateThumb() {
    const scrollView = this.#scrollView;
    if (!scrollView) {
      this.#thumbNode.setActive(false);
      return;
    }
    const scrollNode = scrollView.getNode();
    if (!scrollNode) {
      this.#thumbNode.setActive(false);
      return;
    }
    const viewportSize = scrollNode.getContentSize();
    const contentSize = scrollView.getScrollContentSize();
    const trackSize = this.getContentSize();
    const offset = scrollView.getScrollOffset();
    const isVertical = this.#axis === ScrollBarAxis.vertical;
    const viewportLength = isVertical ? viewportSize.y : viewportSize.x;
    const contentLength = isVertical ? contentSize.y : contentSize.x;
    const trackLength = isVertical ? trackSize.y : trackSize.x;
    const offsetAlongAxis = isVertical ? offset.y : offset.x;
    if (contentLength <= viewportLength || trackLength <= 0) {
      this.#thumbNode.setActive(false);
      if (this.#autoHide) {
        this.setActive(false);
      }
      return;
    }
    this.setActive(true);
    this.#thumbNode.setActive(true);
    const ratio = viewportLength / contentLength;
    const thumbLength = max(this.#minThumbSize, trackLength * ratio);
    const scrollableContent = contentLength - viewportLength;
    const scrollableTrack = trackLength - thumbLength;
    const progress = scrollableContent > 0 ? clamp01(-offsetAlongAxis / scrollableContent) : 0;
    const thumbPosAlongAxis = scrollableTrack * progress;
    if (isVertical) {
      this.#thumbNode.setLocalPosition(Vector2.create(0, thumbPosAlongAxis));
      this.#thumbNode.setContentSize(Vector2.create(trackSize.x, thumbLength));
    } else {
      this.#thumbNode.setLocalPosition(Vector2.create(thumbPosAlongAxis, 0));
      this.#thumbNode.setContentSize(Vector2.create(thumbLength, trackSize.y));
    }
  }
  //==============================================================================
  // 트랙 좌표(view) 위치를 받아 콘텐트 오프셋을 갱신. 트랙 클릭 시 사용.
  // - 썸 중앙이 클릭 위치에 오도록 진행도 계산.
  //==============================================================================
  applyTrackHitPosition(viewInputPosition) {
    const scrollView = this.#scrollView;
    if (!scrollView) return;
    const scrollNode = scrollView.getNode();
    if (!scrollNode) return;
    const viewportSize = scrollNode.getContentSize();
    const contentSize = scrollView.getScrollContentSize();
    const trackSize = this.getContentSize();
    const isVertical = this.#axis === ScrollBarAxis.vertical;
    const viewportLength = isVertical ? viewportSize.y : viewportSize.x;
    const contentLength = isVertical ? contentSize.y : contentSize.x;
    const trackLength = isVertical ? trackSize.y : trackSize.x;
    if (contentLength <= viewportLength || trackLength <= 0) return;
    const ratio = viewportLength / contentLength;
    const thumbLength = max(this.#minThumbSize, trackLength * ratio);
    const scrollableContent = contentLength - viewportLength;
    const scrollableTrack = trackLength - thumbLength;
    if (scrollableTrack <= 0) return;
    const trackGlobal = this.getPosition();
    const localOnAxis = isVertical ? viewInputPosition.y - trackGlobal.y : viewInputPosition.x - trackGlobal.x;
    const desiredThumbHead = clamp(localOnAxis - thumbLength * 0.5, 0, scrollableTrack);
    const progress = desiredThumbHead / scrollableTrack;
    const newOffsetOnAxis = -progress * scrollableContent;
    const currentOffset = scrollView.getScrollOffset();
    scrollView.setScrollOffset(Vector2.create(
      isVertical ? currentOffset.x : newOffsetOnAxis,
      isVertical ? newOffsetOnAxis : currentOffset.y
    ));
  }
  //==============================================================================
  // 썸이 viewInputPosition 안에 있는지.
  //==============================================================================
  isInsideThumb(viewInputPosition) {
    const thumbGlobalPos = this.#thumbNode.getPosition();
    const thumbSize = this.#thumbNode.getContentSize();
    return viewInputPosition.x >= thumbGlobalPos.x && viewInputPosition.x <= thumbGlobalPos.x + thumbSize.x && viewInputPosition.y >= thumbGlobalPos.y && viewInputPosition.y <= thumbGlobalPos.y + thumbSize.y;
  }
  //==============================================================================
  // 터치 누름. (썸 hit 이면 그 자리에서 드래그 시작, 트랙 hit 이면 점프 후 드래그)
  //==============================================================================
  touchPress(viewInputPosition) {
    if (!this.#scrollView) return;
    if (!this.isInsideThumb(viewInputPosition)) {
      this.applyTrackHitPosition(viewInputPosition);
    }
    this.#isDraggingThumb = true;
    this.#dragStartViewPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
    const offset = this.#scrollView.getScrollOffset();
    this.#dragStartScrollOffset = Vector2.create(offset.x, offset.y);
  }
  //==============================================================================
  // 터치 이동.
  //==============================================================================
  touchMove(viewInputPosition) {
    if (!this.#isDraggingThumb || !this.#scrollView) return;
    const scrollNode = this.#scrollView.getNode();
    if (!scrollNode) return;
    const viewportSize = scrollNode.getContentSize();
    const contentSize = this.#scrollView.getScrollContentSize();
    const trackSize = this.getContentSize();
    const isVertical = this.#axis === ScrollBarAxis.vertical;
    const viewportLength = isVertical ? viewportSize.y : viewportSize.x;
    const contentLength = isVertical ? contentSize.y : contentSize.x;
    const trackLength = isVertical ? trackSize.y : trackSize.x;
    if (contentLength <= viewportLength || trackLength <= 0) return;
    const ratio = viewportLength / contentLength;
    const thumbLength = max(this.#minThumbSize, trackLength * ratio);
    const scrollableContent = contentLength - viewportLength;
    const scrollableTrack = trackLength - thumbLength;
    if (scrollableTrack <= 0) return;
    const dragDelta = isVertical ? viewInputPosition.y - this.#dragStartViewPosition.y : viewInputPosition.x - this.#dragStartViewPosition.x;
    const offsetDelta = -dragDelta * (scrollableContent / scrollableTrack);
    const startOffset = this.#dragStartScrollOffset;
    this.#scrollView.setScrollOffset(Vector2.create(
      isVertical ? startOffset.x : startOffset.x + offsetDelta,
      isVertical ? startOffset.y + offsetDelta : startOffset.y
    ));
  }
  //==============================================================================
  // 터치 뗌.
  //==============================================================================
  touchRelease(viewInputPosition) {
    this.#isDraggingThumb = false;
  }
  //==============================================================================
  // 터치 취소.
  //==============================================================================
  touchCancel(viewInputPosition) {
    this.#isDraggingThumb = false;
  }
};

// src/ui/uiscrollview.js
var SCROLLBAR_THICKNESS = 12;
var SCROLLBAR_MARGIN = 6;
var WHEEL_SCROLL_SCALE = 1;
var ScrollMode = {
  clamp: "clamp",
  elastic: "elastic"
};
var UIScrollView = class extends UIView {
  static {
    __name(this, "UIScrollView");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Vector2 } */
  #scrollContentSize;
  // 스크롤 가능한 내부 컨텐트 영역.
  /** @private @type { string } */
  #scrollMode;
  // 스크롤 모드.
  /** @private @type { Vector2 } */
  #scrollVelocity;
  // 스크롤 속도.
  /** @private @type { Vector2 } */
  #previousViewInputPosition;
  /** @private @type { Vector2 } */
  #currentViewInputPosition;
  /** @private @type { boolean } */
  #horizontalEnabled;
  // 수평 이동 여부.
  /** @private @type { boolean } */
  #verticalEnabled;
  // 수직 이동 여부.
  /** @private @type { Vector2 } */
  #scrollOffset;
  // 스크롤 오프셋.
  /** @private @type { boolean } */
  #isDragging;
  // 드래그 중인지 여부.
  /** @private @type { Vector2 } */
  #dragStartViewPosition;
  /** @private @type { Vector2 } */
  #dragStartOffset;
  /** @private @type { number } */
  #dragSensitivity;
  // 드래그 반영량 배율.
  /** @private @type { UIScrollBar | null } */
  #verticalScrollBar;
  /** @private @type { UIScrollBar | null } */
  #horizontalScrollBar;
  /** @private @type { boolean } */
  #showsVerticalScrollBar;
  /** @private @type { boolean } */
  #showsHorizontalScrollBar;
  /** @private @type { number } */
  #wheelScrollScale;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @construct
   */
  constructor() {
    super();
    this.setComponentType("ScrollView");
    this.#scrollOffset = Vector2.zero();
    this.#scrollContentSize = Vector2.zero();
    this.#isDragging = false;
    this.#dragStartViewPosition = Vector2.zero();
    this.#dragStartOffset = Vector2.zero();
    this.#scrollMode = ScrollMode.clamp;
    this.#scrollVelocity = Vector2.zero();
    this.#previousViewInputPosition = Vector2.zero();
    this.#currentViewInputPosition = Vector2.zero();
    this.#horizontalEnabled = true;
    this.#verticalEnabled = true;
    this.#dragSensitivity = 1;
    this.#verticalScrollBar = null;
    this.#horizontalScrollBar = null;
    this.#showsVerticalScrollBar = false;
    this.#showsHorizontalScrollBar = false;
    this.#wheelScrollScale = WHEEL_SCROLL_SCALE;
  }
  //==============================================================================
  // 의존 컴포넌트 — 자식 클리핑을 위해 Mask 가 필요.
  //==============================================================================
  /**
   * @override
   * @returns { Function[] }
   */
  require() {
    return [Mask];
  }
  //==============================================================================
  // 노드에 붙음. (WorldNode 계열의 isInteractable 을 자동 활성화)
  //==============================================================================
  /**
   * @override
   * @param { ComponentNode } node
   */
  attach(node) {
    super.attach(node);
    if (node instanceof WorldNode) {
      node.setInteractable(true);
    }
  }
  //==============================================================================
  // 터치 누름. (TouchRaycaster → WorldNode → ScrollView)
  //==============================================================================
  /**
   * @override
   * @param { Vector2 } viewInputPosition
   */
  touchPress(viewInputPosition) {
    this.#isDragging = true;
    this.#dragStartViewPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
    const scrollOffset = this.getScrollOffset();
    this.#dragStartOffset = Vector2.create(scrollOffset.x, scrollOffset.y);
    this.#scrollVelocity = Vector2.zero();
    this.#previousViewInputPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
    this.#currentViewInputPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
  }
  //==============================================================================
  // 터치 이동. (TouchRaycaster → WorldNode → ScrollView)
  //==============================================================================
  /**
   * @override
   * @param { Vector2 } viewInputPosition
   */
  touchMove(viewInputPosition) {
    if (this.isDragging()) {
      this.#currentViewInputPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
    }
  }
  //==============================================================================
  // 터치 뗌. (TouchRaycaster → WorldNode → ScrollView)
  //==============================================================================
  /**
   * @override
   * @param { Vector2 } viewInputPosition
   */
  touchRelease(viewInputPosition) {
    this.#isDragging = false;
  }
  //==============================================================================
  // 터치 취소. (TouchRaycaster → WorldNode → ScrollView)
  //==============================================================================
  /**
   * @override
   * @param { Vector2 } viewInputPosition
   */
  touchCancel(viewInputPosition) {
    this.#isDragging = false;
  }
  //==============================================================================
  // 갱신.
  //==============================================================================
  /**
   * @override
   * @param { number } timeDelta
   */
  tick(timeDelta) {
    const node = this.getNode();
    if (!node) {
      return;
    }
    this.layoutScrollBars();
    if (this.isDragging()) {
      const viewInputPosition = this.#currentViewInputPosition;
      const dragSensitivity = this.getDragSensitivity();
      const rawDeltaX = (viewInputPosition.x - this.#dragStartViewPosition.x) * dragSensitivity;
      const rawDeltaY = (viewInputPosition.y - this.#dragStartViewPosition.y) * dragSensitivity;
      const deltaX = this.isHorizontal() ? rawDeltaX : 0;
      const deltaY = this.isVertical() ? rawDeltaY : 0;
      const proposedOffset = Vector2.create(
        this.#dragStartOffset.x + deltaX,
        this.#dragStartOffset.y + deltaY
      );
      const scrollMode2 = this.getScrollMode();
      if (scrollMode2 === ScrollMode.elastic) {
        const contentSize = node.getContentSize();
        const elasticMaxX = 0;
        const scrollContentSize = this.getScrollContentSize();
        const elasticMinX = min(0, contentSize.x - scrollContentSize.x);
        const elasticMaxY = 0;
        const elasticMinY = min(0, contentSize.y - scrollContentSize.y);
        const elasticResistance = 0.5;
        let elasticOffsetX = proposedOffset.x;
        let elasticOffsetY = proposedOffset.y;
        if (elasticOffsetX > elasticMaxX) {
          elasticOffsetX = elasticMaxX + (elasticOffsetX - elasticMaxX) * elasticResistance;
        } else if (elasticOffsetX < elasticMinX) {
          elasticOffsetX = elasticMinX + (elasticOffsetX - elasticMinX) * elasticResistance;
        }
        if (elasticOffsetY > elasticMaxY) {
          elasticOffsetY = elasticMaxY + (elasticOffsetY - elasticMaxY) * elasticResistance;
        } else if (elasticOffsetY < elasticMinY) {
          elasticOffsetY = elasticMinY + (elasticOffsetY - elasticMinY) * elasticResistance;
        }
        this.#scrollOffset = Vector2.create(elasticOffsetX, elasticOffsetY);
        const content = this.getContent();
        if (content) {
          const currentScrollOffset = this.getScrollOffset();
          content.setAnchoredPosition(currentScrollOffset);
        }
        if (timeDelta > 0) {
          const rawVelocityX = (viewInputPosition.x - this.#previousViewInputPosition.x) / timeDelta;
          const rawVelocityY = (viewInputPosition.y - this.#previousViewInputPosition.y) / timeDelta;
          const velocityX = this.isHorizontal() ? rawVelocityX : 0;
          const velocityY = this.isVertical() ? rawVelocityY : 0;
          this.#scrollVelocity = Vector2.create(velocityX, velocityY);
        }
      } else {
        this.applyScrollOffset(proposedOffset);
      }
      this.#previousViewInputPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
    }
    const scrollMode = this.getScrollMode();
    if (scrollMode === ScrollMode.elastic && !this.isDragging()) {
      const contentSize = node.getContentSize();
      const physicsBoundsMaxX = 0;
      const scrollContentSize = this.getScrollContentSize();
      const physicsBoundsMinX = this.isHorizontal() ? min(0, contentSize.x - scrollContentSize.x) : 0;
      const physicsBoundsMaxY = 0;
      const physicsBoundsMinY = this.isVertical() ? min(0, contentSize.y - scrollContentSize.y) : 0;
      const springConstant = 1200;
      const dampingCoefficient = 30;
      const frictionCoefficient = 5;
      const scrollVelocity = this.getScrollVelocity();
      let physicsVelocityX = scrollVelocity.x;
      let physicsVelocityY = scrollVelocity.y;
      const currentScrollOffset = this.getScrollOffset();
      let physicsOffsetX = currentScrollOffset.x;
      let physicsOffsetY = currentScrollOffset.y;
      const physicsClampedX = clamp(physicsOffsetX, physicsBoundsMinX, physicsBoundsMaxX);
      const physicsClampedY = clamp(physicsOffsetY, physicsBoundsMinY, physicsBoundsMaxY);
      const physicsDisplacementX = physicsOffsetX - physicsClampedX;
      const physicsDisplacementY = physicsOffsetY - physicsClampedY;
      const physicsIsOutOfBounds = physicsDisplacementX !== 0 || physicsDisplacementY !== 0;
      if (physicsIsOutOfBounds) {
        const physicsSpringForceX = -physicsDisplacementX * springConstant;
        const physicsSpringForceY = -physicsDisplacementY * springConstant;
        const physicsDampingForceX = -physicsVelocityX * dampingCoefficient;
        const physicsDampingForceY = -physicsVelocityY * dampingCoefficient;
        physicsVelocityX += (physicsSpringForceX + physicsDampingForceX) * timeDelta;
        physicsVelocityY += (physicsSpringForceY + physicsDampingForceY) * timeDelta;
      } else {
        const physicsFrictionFactor = max(0, 1 - frictionCoefficient * timeDelta);
        physicsVelocityX *= physicsFrictionFactor;
        physicsVelocityY *= physicsFrictionFactor;
      }
      physicsOffsetX += physicsVelocityX * timeDelta;
      physicsOffsetY += physicsVelocityY * timeDelta;
      if (physicsDisplacementX > 0 && physicsOffsetX < physicsBoundsMaxX) {
        physicsOffsetX = physicsBoundsMaxX;
        physicsVelocityX = 0;
      } else if (physicsDisplacementX < 0 && physicsOffsetX > physicsBoundsMinX) {
        physicsOffsetX = physicsBoundsMinX;
        physicsVelocityX = 0;
      }
      if (physicsDisplacementY > 0 && physicsOffsetY < physicsBoundsMaxY) {
        physicsOffsetY = physicsBoundsMaxY;
        physicsVelocityY = 0;
      } else if (physicsDisplacementY < 0 && physicsOffsetY > physicsBoundsMinY) {
        physicsOffsetY = physicsBoundsMinY;
        physicsVelocityY = 0;
      }
      const physicsNewClampedX = clamp(physicsOffsetX, physicsBoundsMinX, physicsBoundsMaxX);
      const physicsNewClampedY = clamp(physicsOffsetY, physicsBoundsMinY, physicsBoundsMaxY);
      const physicsNewDispX = physicsOffsetX - physicsNewClampedX;
      const physicsNewDispY = physicsOffsetY - physicsNewClampedY;
      const physicsSpeedSq = physicsVelocityX * physicsVelocityX + physicsVelocityY * physicsVelocityY;
      if (physicsSpeedSq < 1 && abs(physicsNewDispX) < 0.5 && abs(physicsNewDispY) < 0.5) {
        physicsOffsetX = physicsNewClampedX;
        physicsOffsetY = physicsNewClampedY;
        physicsVelocityX = 0;
        physicsVelocityY = 0;
      }
      this.#scrollOffset = Vector2.create(physicsOffsetX, physicsOffsetY);
      const content = this.getContent();
      if (content) {
        const updatedScrollOffset = this.getScrollOffset();
        content.setAnchoredPosition(updatedScrollOffset);
      }
      this.#scrollVelocity = Vector2.create(physicsVelocityX, physicsVelocityY);
    }
  }
  //==============================================================================
  // 스크롤 오프셋 적용. (클램핑 포함)
  //==============================================================================
  /**
   * @param { Vector2 } offset
   */
  applyScrollOffset(offset) {
    const node = this.getNode();
    const contentSize = node.getContentSize();
    const scrollContentSize = this.getScrollContentSize();
    const maxX = 0;
    const minX = this.isHorizontal() ? min(0, contentSize.x - scrollContentSize.x) : 0;
    const maxY = 0;
    const minY = this.isVertical() ? min(0, contentSize.y - scrollContentSize.y) : 0;
    this.#scrollOffset = Vector2.create(
      clamp(offset.x, minX, maxX),
      clamp(offset.y, minY, maxY)
    );
    const content = this.getContent();
    if (content) {
      const scrollOffset = this.getScrollOffset();
      content.setAnchoredPosition(scrollOffset);
    }
  }
  //==============================================================================
  // 스크롤 오프셋 설정.
  //==============================================================================
  /**
   * @param { Vector2 } offset
   */
  setScrollOffset(offset) {
    this.applyScrollOffset(offset);
  }
  //==============================================================================
  // 스크롤 오프셋 반환.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  getScrollOffset() {
    return this.#scrollOffset;
  }
  //==============================================================================
  // 가로 스크롤 활성 설정. (false = 가로 스크롤 비활성)
  //==============================================================================
  /**
   * @param { boolean } horizontal
   */
  setHorizontal(horizontal) {
    this.#horizontalEnabled = horizontal;
  }
  //==============================================================================
  // 가로 스크롤 활성 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isHorizontal() {
    return this.#horizontalEnabled;
  }
  //==============================================================================
  // 세로 스크롤 활성 설정. (false = 세로 스크롤 비활성)
  //==============================================================================
  /**
   * @param { boolean } vertical
   */
  setVertical(vertical) {
    this.#verticalEnabled = vertical;
  }
  //==============================================================================
  // 세로 스크롤 활성 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isVertical() {
    return this.#verticalEnabled;
  }
  //==============================================================================
  // 드래그 반영량 배율 설정. (1.0 = 기본, 2.0 = 두 배 빠르게)
  //==============================================================================
  /**
   * @param { number } dragSensitivity
   */
  setDragSensitivity(dragSensitivity) {
    this.#dragSensitivity = dragSensitivity;
  }
  //==============================================================================
  // 드래그 반영량 배율 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getDragSensitivity() {
    return this.#dragSensitivity;
  }
  //==============================================================================
  // 스크롤 모드 설정.
  //==============================================================================
  /**
   * @param { string } scrollMode
   */
  setScrollMode(scrollMode) {
    this.#scrollMode = scrollMode;
  }
  //==============================================================================
  // 스크롤 모드 반환.
  //==============================================================================
  /**
   * @returns { string }
   */
  getScrollMode() {
    return this.#scrollMode;
  }
  //==============================================================================
  // 스크롤 콘텐츠 크기 설정. (가시 영역보다 크게 설정해야 스크롤 가능)
  //==============================================================================
  /**
   * @param { Vector2 } scrollContentSize
   */
  setScrollContentSize(scrollContentSize) {
    scrollContentSize = scrollContentSize.clone();
    this.#scrollContentSize = scrollContentSize;
    const content = this.getContent();
    if (content) {
      content.setContentSize(scrollContentSize);
    }
  }
  //==============================================================================
  // 스크롤 콘텐츠 크기 반환.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  getScrollContentSize() {
    return this.#scrollContentSize;
  }
  //==============================================================================
  // 드래그 중 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isDragging() {
    return this.#isDragging;
  }
  //==============================================================================
  // 현재 스크롤 속도 반환.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  getScrollVelocity() {
    return this.#scrollVelocity;
  }
  //==============================================================================
  // 세로 스크롤바 노출 여부 설정. true 면 자동 생성하여 호스트 노드의 자식으로 추가.
  //==============================================================================
  /**
   * @param { boolean } shows
   */
  setShowsVerticalScrollBar(shows) {
    this.#showsVerticalScrollBar = !!shows;
    const node = this.getNode();
    if (this.#showsVerticalScrollBar) {
      if (!this.#verticalScrollBar && node) {
        const bar = new UIScrollBar();
        bar.setName("verticalScrollBar");
        bar.setAxis(ScrollBarAxis.vertical);
        bar.setScrollView(this);
        node.addChild(bar);
        this.#verticalScrollBar = bar;
      }
      if (this.#verticalScrollBar) this.#verticalScrollBar.setActive(true);
    } else {
      if (this.#verticalScrollBar) this.#verticalScrollBar.setActive(false);
    }
  }
  //==============================================================================
  // 가로 스크롤바 노출 여부 설정.
  //==============================================================================
  /**
   * @param { boolean } shows
   */
  setShowsHorizontalScrollBar(shows) {
    this.#showsHorizontalScrollBar = !!shows;
    const node = this.getNode();
    if (this.#showsHorizontalScrollBar) {
      if (!this.#horizontalScrollBar && node) {
        const bar = new UIScrollBar();
        bar.setName("horizontalScrollBar");
        bar.setAxis(ScrollBarAxis.horizontal);
        bar.setScrollView(this);
        node.addChild(bar);
        this.#horizontalScrollBar = bar;
      }
      if (this.#horizontalScrollBar) this.#horizontalScrollBar.setActive(true);
    } else {
      if (this.#horizontalScrollBar) this.#horizontalScrollBar.setActive(false);
    }
  }
  //==============================================================================
  // 세로 / 가로 스크롤바 인스턴스 반환. (커스터마이즈 용)
  //==============================================================================
  getVerticalScrollBar() {
    return this.#verticalScrollBar;
  }
  getHorizontalScrollBar() {
    return this.#horizontalScrollBar;
  }
  //==============================================================================
  // 스크롤바가 차지하는(reserved) 영역의 두께. (스크롤바가 활성/표시 중일 때만)
  //==============================================================================
  getVerticalScrollBarReservedWidth() {
    return this.#showsVerticalScrollBar && this.#verticalScrollBar ? SCROLLBAR_THICKNESS + SCROLLBAR_MARGIN * 2 : 0;
  }
  getHorizontalScrollBarReservedHeight() {
    return this.#showsHorizontalScrollBar && this.#horizontalScrollBar ? SCROLLBAR_THICKNESS + SCROLLBAR_MARGIN * 2 : 0;
  }
  //==============================================================================
  // 스크롤바를 제외한 실제 콘텐트가 그려질 수 있는 가시 영역 크기.
  // - 가로 스크롤바가 있으면 그 만큼 세로가 줄고, 세로 스크롤바가 있으면 가로가 준다.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  getInnerContentSize() {
    const node = this.getNode();
    if (!node) return Vector2.zero();
    const viewportSize = node.getContentSize();
    const reservedX = this.getVerticalScrollBarReservedWidth();
    const reservedY = this.getHorizontalScrollBarReservedHeight();
    return Vector2.create(
      max(0, viewportSize.x - reservedX),
      max(0, viewportSize.y - reservedY)
    );
  }
  //==============================================================================
  // 매 tick 마다 스크롤바 위치 / 크기 갱신.
  //==============================================================================
  layoutScrollBars() {
    const node = this.getNode();
    if (!node) return;
    const viewportSize = node.getContentSize();
    const reservedX = this.getVerticalScrollBarReservedWidth();
    const reservedY = this.getHorizontalScrollBarReservedHeight();
    if (this.#verticalScrollBar && this.#showsVerticalScrollBar) {
      const x = viewportSize.x - SCROLLBAR_THICKNESS - SCROLLBAR_MARGIN;
      const y = SCROLLBAR_MARGIN;
      const w = SCROLLBAR_THICKNESS;
      const h = max(0, viewportSize.y - SCROLLBAR_MARGIN * 2 - reservedY);
      this.#verticalScrollBar.setLocalPosition(Vector2.create(x, y));
      this.#verticalScrollBar.setContentSize(Vector2.create(w, h));
    }
    if (this.#horizontalScrollBar && this.#showsHorizontalScrollBar) {
      const x = SCROLLBAR_MARGIN;
      const y = viewportSize.y - SCROLLBAR_THICKNESS - SCROLLBAR_MARGIN;
      const w = max(0, viewportSize.x - SCROLLBAR_MARGIN * 2 - reservedX);
      const h = SCROLLBAR_THICKNESS;
      this.#horizontalScrollBar.setLocalPosition(Vector2.create(x, y));
      this.#horizontalScrollBar.setContentSize(Vector2.create(w, h));
    }
  }
  //==============================================================================
  // 휠 입력 처리. (TouchRaycaster → UIScrollView)
  // - delta: 마우스 휠 누적값 (DOM WheelEvent 의 deltaX/deltaY 와 동일 부호. 아래 = +y)
  //==============================================================================
  /**
   * @param { Vector2 } delta
   */
  wheel(delta) {
    if (!delta) return;
    const offset = this.getScrollOffset();
    const dx = this.isHorizontal() ? delta.x * this.#wheelScrollScale : 0;
    const dy = this.isVertical() ? delta.y * this.#wheelScrollScale : 0;
    this.applyScrollOffset(Vector2.create(offset.x - dx, offset.y - dy));
    this.#scrollVelocity = Vector2.zero();
  }
  //==============================================================================
  // 휠 스크롤 배율 설정.
  //==============================================================================
  setWheelScrollScale(scale) {
    this.#wheelScrollScale = scale;
  }
};

// src/ui/touchrecognizer.js
var System16 = globalThis;
var DRAG_THRESHOLD = 10;
var DELAY_PRESS_MS = 150;
var TouchRecognizer = class extends TouchRaycaster {
  static {
    __name(this, "TouchRecognizer");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { * } */
  #target;
  // 누른 hit 노드.
  /** @private @type { UIScrollView | null } */
  #scrollView;
  // 부모 체인의 ScrollView.
  /** @private @type { Vector2 | null } */
  #pressPosition;
  /** @private @type { boolean } */
  #isDragging;
  /** @private @type { * } */
  #pressTimerId;
  // 지연 press 타이머 핸들. 없으면 null.
  /** @private @type { boolean } */
  #pressDelivered;
  // hit 노드에 touchPress 가 실제로 전달됐는가.
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.#target = null;
    this.#scrollView = null;
    this.#pressPosition = null;
    this.#isDragging = false;
    this.#pressTimerId = null;
    this.#pressDelivered = false;
  }
  //==============================================================================
  // 터치 누름.
  // - hit 노드와, 그 부모 체인에서 ScrollView 를 보유한 노드를 찾아둔다.
  // - 부모에 ScrollView 가 없으면 hit 노드에 즉시 touchPress 를 전달한다.
  // - 부모에 ScrollView 가 있으면 DELAY_PRESS_MS 후에 전달하도록 예약한다.
  //   그 사이 드래그가 시작되면 예약된 press 는 취소된다.
  //==============================================================================
  /**
   * @override
   * @param { Vector2 } viewInputPosition
   */
  touchPress(viewInputPosition) {
    const target = this.raycast(viewInputPosition);
    this.#target = target;
    this.#pressPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
    this.#isDragging = false;
    this.#scrollView = this.findAncestorScrollView(target);
    this.#pressDelivered = false;
    this.#pressTimerId = null;
    if (!target) {
      return;
    }
    if (this.#scrollView) {
      const pressPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
      this.#pressTimerId = System16.setTimeout(() => {
        this.#pressTimerId = null;
        if (this.#isDragging) return;
        if (this.#target !== target) return;
        this.#pressDelivered = true;
        target.touchPress(pressPosition);
      }, DELAY_PRESS_MS);
    } else {
      this.#pressDelivered = true;
      target.touchPress(viewInputPosition);
    }
  }
  //==============================================================================
  // 터치 이동.
  // - 드래그 모드면 ScrollView 에만 전달.
  // - 드래그 모드가 아니고, ScrollView 가 있고, 임계를 넘었다면 모드 전환:
  //   (1) 지연 press 가 보류 중이면 취소(전달 자체를 안 함),
  //       이미 press 가 전달되었으면 hit 노드에 touchCancel,
  //   (2) ScrollView 에 touchPress(최초 위치) → touchMove(현재 위치).
  // - 그 외에는 hit 노드에 touchMove. 단 press 가 아직 전달되지 않았다면
  //   touchMove 도 전달하지 않는다.
  //==============================================================================
  /**
   * @override
   * @param { Vector2 } viewInputPosition
   */
  touchMove(viewInputPosition) {
    if (this.#isDragging) {
      if (this.#scrollView) {
        this.#scrollView.touchMove(viewInputPosition);
      }
      return;
    }
    if (this.#scrollView && this.#pressPosition) {
      const dx = viewInputPosition.x - this.#pressPosition.x;
      const dy = viewInputPosition.y - this.#pressPosition.y;
      if (System16.Math.abs(dx) > DRAG_THRESHOLD || System16.Math.abs(dy) > DRAG_THRESHOLD) {
        this.#isDragging = true;
        if (this.#pressTimerId !== null) {
          System16.clearTimeout(this.#pressTimerId);
          this.#pressTimerId = null;
        } else if (this.#pressDelivered && this.#target) {
          this.#target.touchCancel(viewInputPosition);
        }
        this.#target = null;
        this.#pressDelivered = false;
        this.#scrollView.touchPress(this.#pressPosition);
        this.#scrollView.touchMove(viewInputPosition);
        return;
      }
    }
    if (this.#pressDelivered && this.#target) {
      this.#target.touchMove(viewInputPosition);
    }
  }
  //==============================================================================
  // 터치 뗌.
  // - 드래그 모드면 ScrollView 에 release.
  // - 아니면 hit 노드에 release.
  //   단, 짧은 탭이라 지연 press 가 아직 발동되지 않았다면 보류된 press 를 즉시
  //   발동한 뒤 release 를 이어 보내, 시각효과가 한 프레임이라도 들어가게 한다.
  //==============================================================================
  /**
   * @override
   * @param { Vector2 } viewInputPosition
   */
  touchRelease(viewInputPosition) {
    if (this.#isDragging) {
      if (this.#scrollView) {
        this.#scrollView.touchRelease(viewInputPosition);
      }
    } else if (this.#target) {
      if (this.#pressTimerId !== null) {
        System16.clearTimeout(this.#pressTimerId);
        this.#pressTimerId = null;
        this.#target.touchPress(this.#pressPosition || viewInputPosition);
        this.#pressDelivered = true;
      }
      this.#target.touchRelease(viewInputPosition);
    }
    this.reset();
  }
  //==============================================================================
  // 터치 취소.
  // - 지연 press 가 보류 중이면 hit 노드에 cancel 을 보내지 않는다 (press 자체가
  //   전달되지 않았으므로).
  //==============================================================================
  /**
   * @override
   * @param { Vector2 } viewInputPosition
   */
  touchCancel(viewInputPosition) {
    if (this.#isDragging) {
      if (this.#scrollView) {
        this.#scrollView.touchCancel(viewInputPosition);
      }
    } else if (this.#target && this.#pressDelivered) {
      this.#target.touchCancel(viewInputPosition);
    }
    this.reset();
  }
  //==============================================================================
  // 트래킹 상태 초기화.
  //==============================================================================
  reset() {
    if (this.#pressTimerId !== null) {
      System16.clearTimeout(this.#pressTimerId);
      this.#pressTimerId = null;
    }
    this.#target = null;
    this.#scrollView = null;
    this.#pressPosition = null;
    this.#isDragging = false;
    this.#pressDelivered = false;
  }
  //==============================================================================
  // 노드의 부모 체인에서 UIScrollView 컴포넌트를 가진 가장 가까운 노드의
  // ScrollView 컴포넌트를 반환한다. 없으면 null.
  // - 단, target 이 자신이 컨트롤하는 ScrollView 의 위젯(getScrollView 보유)이면
  //   그 ScrollView 는 검색에서 제외한다. (스크롤바 자신은 자기 부모 ScrollView 의
  //   드래그 핸들러로 인계되면 안 되기 때문.)
  //==============================================================================
  /**
   * @param { * } target
   * @returns { UIScrollView | null }
   */
  findAncestorScrollView(target) {
    if (!target) return null;
    const ownedScrollView = typeof target.getScrollView === "function" ? target.getScrollView() : null;
    let node = typeof target.getParent === "function" ? target.getParent() : null;
    while (node) {
      if (typeof node.getComponent === "function") {
        const sv = node.getComponent(UIScrollView);
        if (sv && sv !== ownedScrollView) return sv;
      }
      node = typeof node.getParent === "function" ? node.getParent() : null;
    }
    return null;
  }
};

// src/ui/autolayout/layoutvariable.js
var LayoutVariable = class {
  static {
    __name(this, "LayoutVariable");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { string } */
  #name;
  /** @private @type { number } */
  #value;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   * @param { string } [name]
   */
  constructor(name) {
    this.#name = typeof name === "string" ? name : "";
    this.#value = 0;
  }
  //==============================================================================
  // 이름 설정.
  //==============================================================================
  /**
   * @param { string } name
   */
  setName(name) {
    this.#name = name;
  }
  //==============================================================================
  // 이름 반환.
  //==============================================================================
  /**
   * @returns { string }
   */
  getName() {
    return this.#name;
  }
  //==============================================================================
  // 값 설정. (솔버 내부에서 호출되며 외부 직접 호출은 권장하지 않는다.)
  //==============================================================================
  /**
   * @param { number } value
   */
  setValue(value) {
    this.#value = value;
  }
  //==============================================================================
  // 현재 값 반환. (updateVariables 후 유효)
  //==============================================================================
  /**
   * @returns { number }
   */
  getValue() {
    return this.#value;
  }
};

// src/ui/autolayout/layoutterm.js
var LayoutTerm = class {
  static {
    __name(this, "LayoutTerm");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { LayoutVariable | null } */
  #variable;
  /** @private @type { number } */
  #coefficient;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   * @param { LayoutVariable } variable
   * @param { number } [coefficient]
   */
  constructor(variable, coefficient) {
    this.#variable = variable !== void 0 && variable !== null ? variable : null;
    this.#coefficient = typeof coefficient === "number" ? coefficient : 1;
  }
  //==============================================================================
  // 변수 반환.
  //==============================================================================
  /**
   * @returns { LayoutVariable | null }
   */
  getVariable() {
    return this.#variable;
  }
  //==============================================================================
  // 계수 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getCoefficient() {
    return this.#coefficient;
  }
  //==============================================================================
  // 평가값 (coefficient * variable.value) 반환. variable 이 없으면 0.
  //==============================================================================
  /**
   * @returns { number }
   */
  getValue() {
    const variable = this.getVariable();
    if (variable === null) {
      return 0;
    }
    const coefficient = this.getCoefficient();
    const variableValue = variable.getValue();
    return coefficient * variableValue;
  }
};

// src/ui/autolayout/layoutrelation.js
var LayoutRelation = {
  equal: "==",
  lessThanOrEqual: "<=",
  greaterThanOrEqual: ">="
};

// src/ui/autolayout/layoutconstraint.js
var layoutconstraint_exports = {};
__export(layoutconstraint_exports, {
  LayoutConstraint: () => LayoutConstraint
});

// src/ui/autolayout/layoutstrength.js
var LayoutStrength = class _LayoutStrength {
  static {
    __name(this, "LayoutStrength");
  }
  //==============================================================================
  // 표준 강도 상수.
  //==============================================================================
  static required = 1001001e3;
  static strong = 1e6;
  static medium = 1e3;
  static weak = 1;
  //==============================================================================
  // 사용자 정의 강도 합성.
  // - 세 자리 강도 성분 (a, b, c) 와 가중치 (weight) 로 합성한다.
  // - 각 성분은 weight 곱한 뒤 0 ~ 1000 범위로 클램프된다.
  // - 합성 결과는 0 ~ required (1001001000) 범위가 된다.
  //==============================================================================
  /**
   * @param { number } a
   * @param { number } b
   * @param { number } c
   * @param { number } [weight]
   * @returns { number }
   */
  static createStrength(a, b, c, weight) {
    const finalWeight = weight ?? 1;
    const componentA = clamp(a * finalWeight, 0, 1e3) * 1e6;
    const componentB = clamp(b * finalWeight, 0, 1e3) * 1e3;
    const componentC = clamp(c * finalWeight, 0, 1e3);
    const result = componentA + componentB + componentC;
    return result;
  }
  //==============================================================================
  // 강도 클램프. (0 ~ required)
  //==============================================================================
  /**
   * @param { number } strength
   * @returns { number }
   */
  static clipStrength(strength) {
    return clamp(strength, 0, _LayoutStrength.required);
  }
  //==============================================================================
  // UIKit 의 UILayoutPriority (1 ~ 1000) 를 LayoutStrength 으로 변환.
  // - priority >= 1000 (required) 은 LayoutStrength.required 로 매핑.
  // - 1 ~ 999 는 medium tier 의 weight 로 매핑 (priority 750 → 750000).
  // - 0 이하는 0 으로 매핑.
  //==============================================================================
  /**
   * @param { number } priority
   * @returns { number }
   */
  static fromPriority(priority) {
    if (priority >= 1e3) {
      return _LayoutStrength.required;
    }
    if (priority <= 0) {
      return 0;
    }
    return _LayoutStrength.createStrength(0, priority, 0);
  }
};

// src/ui/autolayout/layoutconstraint.js
var System17 = globalThis;
var LayoutConstraint = class _LayoutConstraint {
  static {
    __name(this, "LayoutConstraint");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { LayoutExpression } */
  #expression;
  /** @private @type { string } */
  #relation;
  /** @private @type { number } */
  #strength;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   * @param { LayoutExpression } expression
   * @param { string } relation
   * @param { number } [strength]
   */
  constructor(expression, relation, strength) {
    if (!(expression instanceof LayoutExpression)) {
      throw new System17.Error("[LayoutConstraint] expression \uC740 LayoutExpression \uC774\uC5B4\uC57C \uD568.");
    }
    this.#expression = expression;
    this.#relation = relation;
    const requestedStrength = typeof strength === "number" ? strength : LayoutStrength.required;
    this.#strength = LayoutStrength.clipStrength(requestedStrength);
  }
  //==============================================================================
  // 식 반환.
  //==============================================================================
  /**
   * @returns { LayoutExpression }
   */
  getExpression() {
    return this.#expression;
  }
  //==============================================================================
  // 관계 반환.
  //==============================================================================
  /**
   * @returns { string }
   */
  getRelation() {
    return this.#relation;
  }
  //==============================================================================
  // 강도 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getStrength() {
    return this.#strength;
  }
  //==============================================================================
  // 강도만 다른 사본 반환. (제약 자체는 동일하지만 우선순위만 바꿔서 다시 등록할 때)
  //==============================================================================
  /**
   * @param { number } newStrength
   * @returns { LayoutConstraint }
   */
  withStrength(newStrength) {
    const expression = this.getExpression();
    const relation = this.getRelation();
    const constraint = new _LayoutConstraint(expression, relation, newStrength);
    return constraint;
  }
};

// src/ui/autolayout/layoutexpression.js
var System18 = globalThis;
var LayoutExpression = class _LayoutExpression {
  static {
    __name(this, "LayoutExpression");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { LayoutTerm[] } */
  #terms;
  /** @private @type { number } */
  #constant;
  //==============================================================================
  // 생성.
  // - terms: LayoutTerm 배열 (사본을 갖는다).
  // - constant: 상수항.
  //==============================================================================
  /**
   * @constructor
   * @param { LayoutTerm[] } [terms]
   * @param { number } [constant]
   */
  constructor(terms, constant) {
    this.#terms = System18.Array.isArray(terms) ? terms.slice() : [];
    this.#constant = typeof constant === "number" ? constant : 0;
  }
  //==============================================================================
  // 정적 팩토리: 단일 LayoutVariable 로부터 식 생성. (1 * variable + 0)
  //==============================================================================
  /**
   * @param { LayoutVariable } variable
   * @returns { LayoutExpression }
   */
  static fromVariable(variable) {
    const term = new LayoutTerm(variable, 1);
    const expression = new _LayoutExpression([term], 0);
    return expression;
  }
  //==============================================================================
  // 정적 팩토리: 상수만 가진 식 생성.
  //==============================================================================
  /**
   * @param { number } value
   * @returns { LayoutExpression }
   */
  static fromConstant(value) {
    const expression = new _LayoutExpression([], value);
    return expression;
  }
  //==============================================================================
  // 임의 입력 (number / LayoutVariable / LayoutTerm / LayoutExpression) 을
  // LayoutExpression 으로 정규화.
  //==============================================================================
  /**
   * @param { * } input
   * @returns { LayoutExpression }
   */
  static toExpression(input) {
    if (input instanceof _LayoutExpression) {
      return input;
    }
    if (input instanceof LayoutTerm) {
      return new _LayoutExpression([input], 0);
    }
    if (input instanceof LayoutVariable) {
      return _LayoutExpression.fromVariable(input);
    }
    if (typeof input === "number") {
      return _LayoutExpression.fromConstant(input);
    }
    throw new System18.Error("[LayoutExpression] toExpression: \uC9C0\uC6D0\uB418\uC9C0 \uC54A\uB294 \uC785\uB825 \uD0C0\uC785.");
  }
  //==============================================================================
  // 항 배열 반환.
  //==============================================================================
  /**
   * @returns { LayoutTerm[] }
   */
  getTerms() {
    return this.#terms;
  }
  //==============================================================================
  // 상수항 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getConstant() {
    return this.#constant;
  }
  //==============================================================================
  // 항이 없는지 (= 상수항만 있는지) 여부.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isConstant() {
    const terms = this.getTerms();
    return terms.length === 0;
  }
  //==============================================================================
  // 평가값 (sum(term.value) + constant) 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getValue() {
    let result = this.getConstant();
    const terms = this.getTerms();
    for (const term of terms) {
      result += term.getValue();
    }
    return result;
  }
  //==============================================================================
  // 산술: 덧셈.
  //==============================================================================
  /**
   * @param { * } input
   * @returns { LayoutExpression }
   */
  add(input) {
    const otherExpression = _LayoutExpression.toExpression(input);
    const otherTerms = otherExpression.getTerms();
    const otherConstant = otherExpression.getConstant();
    const ownTerms = this.getTerms();
    const newTerms = ownTerms.slice();
    for (const otherTerm of otherTerms) {
      newTerms.push(otherTerm);
    }
    const newConstant = this.getConstant() + otherConstant;
    const result = new _LayoutExpression(newTerms, newConstant);
    return result;
  }
  //==============================================================================
  // 산술: 뺄셈.
  //==============================================================================
  /**
   * @param { * } input
   * @returns { LayoutExpression }
   */
  subtract(input) {
    const otherExpression = _LayoutExpression.toExpression(input);
    const negated = otherExpression.multiply(-1);
    const result = this.add(negated);
    return result;
  }
  //==============================================================================
  // 산술: 곱셈 (스칼라).
  // - 변수×변수 같은 비선형 곱은 지원하지 않는다 (선형 시스템 한정).
  //==============================================================================
  /**
   * @param { number } coefficient
   * @returns { LayoutExpression }
   */
  multiply(coefficient) {
    if (typeof coefficient !== "number") {
      throw new System18.Error("[LayoutExpression] multiply: \uC2A4\uCE7C\uB77C(number) \uB9CC \uC9C0\uC6D0.");
    }
    const ownTerms = this.getTerms();
    const newTerms = [];
    for (const term of ownTerms) {
      const variable = term.getVariable();
      const oldCoefficient = term.getCoefficient();
      const newTerm = new LayoutTerm(variable, oldCoefficient * coefficient);
      newTerms.push(newTerm);
    }
    const newConstant = this.getConstant() * coefficient;
    const result = new _LayoutExpression(newTerms, newConstant);
    return result;
  }
  //==============================================================================
  // 산술: 나눗셈 (스칼라).
  //==============================================================================
  /**
   * @param { number } denominator
   * @returns { LayoutExpression }
   */
  divide(denominator) {
    if (typeof denominator !== "number") {
      throw new System18.Error("[LayoutExpression] divide: \uC2A4\uCE7C\uB77C(number) \uB9CC \uC9C0\uC6D0.");
    }
    if (denominator === 0) {
      throw new System18.Error("[LayoutExpression] divide: 0 \uC73C\uB85C \uB098\uB20C \uC218 \uC5C6\uC74C.");
    }
    const result = this.multiply(1 / denominator);
    return result;
  }
  //==============================================================================
  // 비교: 동등 제약 생성. (this == input)
  //==============================================================================
  /**
   * @param { * } input
   * @returns { import("./layoutconstraint.js").LayoutConstraint }
   */
  equalTo(input) {
    const otherExpression = _LayoutExpression.toExpression(input);
    const difference = this.subtract(otherExpression);
    const LayoutConstraintModule = layoutConstraintModule();
    const constraint = new LayoutConstraintModule.LayoutConstraint(difference, LayoutRelation.equal);
    return constraint;
  }
  //==============================================================================
  // 비교: 작거나 같음 제약 생성. (this <= input)
  //==============================================================================
  /**
   * @param { * } input
   * @returns { import("./layoutconstraint.js").LayoutConstraint }
   */
  lessThanOrEqualTo(input) {
    const otherExpression = _LayoutExpression.toExpression(input);
    const difference = this.subtract(otherExpression);
    const LayoutConstraintModule = layoutConstraintModule();
    const constraint = new LayoutConstraintModule.LayoutConstraint(difference, LayoutRelation.lessThanOrEqual);
    return constraint;
  }
  //==============================================================================
  // 비교: 크거나 같음 제약 생성. (this >= input)
  //==============================================================================
  /**
   * @param { * } input
   * @returns { import("./layoutconstraint.js").LayoutConstraint }
   */
  greaterThanOrEqualTo(input) {
    const otherExpression = _LayoutExpression.toExpression(input);
    const difference = this.subtract(otherExpression);
    const LayoutConstraintModule = layoutConstraintModule();
    const constraint = new LayoutConstraintModule.LayoutConstraint(difference, LayoutRelation.greaterThanOrEqual);
    return constraint;
  }
};
var cachedLayoutConstraintModule = null;
function layoutConstraintModule() {
  if (cachedLayoutConstraintModule === null) {
    cachedLayoutConstraintModule = require_layoutconstraint();
  }
  return cachedLayoutConstraintModule;
}
__name(layoutConstraintModule, "layoutConstraintModule");
function require_layoutconstraint() {
  return layoutconstraint_exports;
}
__name(require_layoutconstraint, "require_layoutconstraint");

// src/ui/autolayout/layoutsymboltype.js
var LayoutSymbolType = {
  invalid: 0,
  external: 1,
  slack: 2,
  error: 3,
  dummy: 4
};

// src/ui/autolayout/layoutsymbol.js
var LayoutSymbol = class _LayoutSymbol {
  static {
    __name(this, "LayoutSymbol");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { number } */
  #id;
  /** @private @type { number } */
  #type;
  //==============================================================================
  // 시퀀스 생성기.
  //==============================================================================
  /** @private @type { number } */
  static #nextId = 1;
  //==============================================================================
  // 생성. type 은 LayoutSymbolType 값 중 하나.
  //==============================================================================
  /**
   * @constructor
   * @param { number } type
   */
  constructor(type) {
    this.#id = _LayoutSymbol.#nextId;
    _LayoutSymbol.#nextId += 1;
    this.#type = typeof type === "number" ? type : LayoutSymbolType.invalid;
  }
  //==============================================================================
  // 무효 심볼 팩토리.
  //==============================================================================
  /**
   * @returns { LayoutSymbol }
   */
  static invalid() {
    const symbol = new _LayoutSymbol(LayoutSymbolType.invalid);
    return symbol;
  }
  //==============================================================================
  // 식별자 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getId() {
    return this.#id;
  }
  //==============================================================================
  // 타입 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getType() {
    return this.#type;
  }
  //==============================================================================
  // 타입 변경. (행 swap 등 내부 연산 중 일시적으로 사용)
  //==============================================================================
  /**
   * @param { number } type
   */
  setType(type) {
    this.#type = type;
  }
  //==============================================================================
  // 무효 심볼 여부.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isInvalid() {
    return this.getType() === LayoutSymbolType.invalid;
  }
};

// src/ui/autolayout/layoutrow.js
var System19 = globalThis;
var LayoutRow = class _LayoutRow {
  static {
    __name(this, "LayoutRow");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Map<import("./layoutsymbol.js").LayoutSymbol, number> } */
  #cells;
  /** @private @type { number } */
  #constant;
  //==============================================================================
  // 생성. constant 는 초기 상수항.
  //==============================================================================
  /**
   * @constructor
   * @param { number } [constant]
   */
  constructor(constant) {
    this.#cells = new System19.Map();
    this.#constant = typeof constant === "number" ? constant : 0;
  }
  //==============================================================================
  // 셀 맵 반환.
  //==============================================================================
  /**
   * @returns { Map<import("./layoutsymbol.js").LayoutSymbol, number> }
   */
  getCells() {
    return this.#cells;
  }
  //==============================================================================
  // 상수항 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getConstant() {
    return this.#constant;
  }
  //==============================================================================
  // 상수항 설정.
  //==============================================================================
  /**
   * @param { number } constant
   */
  setConstant(constant) {
    this.#constant = constant;
  }
  //==============================================================================
  // 사본 생성.
  //==============================================================================
  /**
   * @returns { LayoutRow }
   */
  copy() {
    const cloned = new _LayoutRow(this.getConstant());
    const ownCells = this.getCells();
    const clonedCells = cloned.getCells();
    for (const [symbol, coefficient] of ownCells) {
      clonedCells.set(symbol, coefficient);
    }
    return cloned;
  }
  //==============================================================================
  // 상수항에 값 추가. 새 상수 반환.
  //==============================================================================
  /**
   * @param { number } value
   * @returns { number }
   */
  addConstant(value) {
    const newConstant = this.getConstant() + value;
    this.setConstant(newConstant);
    return newConstant;
  }
  //==============================================================================
  // 심볼에 coefficient * value 만큼 값을 더한다.
  // - 결과가 0 에 매우 근접하면 셀에서 제거.
  //==============================================================================
  /**
   * @param { import("./layoutsymbol.js").LayoutSymbol } symbol
   * @param { number } [coefficient]
   */
  insertSymbol(symbol, coefficient) {
    const finalCoefficient = typeof coefficient === "number" ? coefficient : 1;
    const cells = this.getCells();
    const previous = cells.has(symbol) ? cells.get(symbol) : 0;
    const next = previous + finalCoefficient;
    if (nearZero(next)) {
      cells.delete(symbol);
    } else {
      cells.set(symbol, next);
    }
  }
  //==============================================================================
  // 다른 행을 coefficient 만큼 곱한 뒤 본 행에 더한다.
  //==============================================================================
  /**
   * @param { LayoutRow } otherRow
   * @param { number } [coefficient]
   */
  insertRow(otherRow, coefficient) {
    const finalCoefficient = typeof coefficient === "number" ? coefficient : 1;
    const otherConstant = otherRow.getConstant();
    this.addConstant(otherConstant * finalCoefficient);
    const otherCells = otherRow.getCells();
    for (const [symbol, otherValue] of otherCells) {
      this.insertSymbol(symbol, otherValue * finalCoefficient);
    }
  }
  //==============================================================================
  // 심볼 제거.
  //==============================================================================
  /**
   * @param { import("./layoutsymbol.js").LayoutSymbol } symbol
   */
  removeSymbol(symbol) {
    const cells = this.getCells();
    cells.delete(symbol);
  }
  //==============================================================================
  // 행의 부호 반전. constant 와 모든 cell coefficient 를 -1 곱.
  //==============================================================================
  reverseSign() {
    this.setConstant(-this.getConstant());
    const cells = this.getCells();
    for (const [symbol, value] of cells) {
      cells.set(symbol, -value);
    }
  }
  //==============================================================================
  // 행을 주어진 심볼 기준으로 풀이한다 (해당 cell 의 계수로 행 전체를 정규화).
  // - 결과: subject 의 계수가 -1 이 되도록 변환된다 (Kiwi 관례).
  // - subject 가 cells 에 없으면 동작 미정의 (호출자가 보장).
  //==============================================================================
  /**
   * @param { import("./layoutsymbol.js").LayoutSymbol } subject
   */
  solveFor(subject) {
    const cells = this.getCells();
    const subjectCoefficient = cells.get(subject);
    const inverse = -1 / subjectCoefficient;
    cells.delete(subject);
    this.setConstant(this.getConstant() * inverse);
    const updatedCells = new System19.Map();
    for (const [symbol, value] of cells) {
      updatedCells.set(symbol, value * inverse);
    }
    cells.clear();
    for (const [symbol, value] of updatedCells) {
      cells.set(symbol, value);
    }
  }
  //==============================================================================
  // lhs = rhs 형태로 본 행을 lhs 기준으로 풀고, rhs 기준으로 다시 푸는 헬퍼.
  // - solveFor(lhs, rhs): rhs 의 계수 / lhs 의 계수로 정규화 후 lhs 제거.
  // - 외부에서 잘 안 쓰지만 솔버 substitute 단계에서 호출.
  //==============================================================================
  /**
   * @param { import("./layoutsymbol.js").LayoutSymbol } lhs
   * @param { import("./layoutsymbol.js").LayoutSymbol } rhs
   */
  solveForPair(lhs, rhs) {
    this.insertSymbol(lhs, -1);
    this.solveFor(rhs);
  }
  //==============================================================================
  // 주어진 심볼의 계수 반환. 없으면 0.
  //==============================================================================
  /**
   * @param { import("./layoutsymbol.js").LayoutSymbol } symbol
   * @returns { number }
   */
  coefficientFor(symbol) {
    const cells = this.getCells();
    if (!cells.has(symbol)) {
      return 0;
    }
    return cells.get(symbol);
  }
  //==============================================================================
  // 다른 심볼이 본 행의 substitute 행으로 대체될 때, 본 행에 그 효과를 반영.
  //==============================================================================
  /**
   * @param { import("./layoutsymbol.js").LayoutSymbol } symbol
   * @param { LayoutRow } substitutionRow
   */
  substitute(symbol, substitutionRow) {
    const cells = this.getCells();
    if (!cells.has(symbol)) {
      return;
    }
    const coefficient = cells.get(symbol);
    cells.delete(symbol);
    this.insertRow(substitutionRow, coefficient);
  }
};
var NEAR_ZERO_EPS = 1e-8;
function nearZero(value) {
  return value < 0 ? -value < NEAR_ZERO_EPS : value < NEAR_ZERO_EPS;
}
__name(nearZero, "nearZero");

// src/ui/autolayout/layoutsolver.js
var System20 = globalThis;
var LayoutSolver = class {
  static {
    __name(this, "LayoutSolver");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Map<LayoutConstraint, LayoutTag> } */
  #constraintTags;
  /** @private @type { Map<LayoutSymbol, LayoutRow> } */
  #rows;
  /** @private @type { Map<LayoutVariable, LayoutSymbol> } */
  #variableSymbols;
  /** @private @type { Map<LayoutVariable, LayoutEditInfo> } */
  #editInfos;
  /** @private @type { LayoutSymbol[] } */
  #infeasibleRows;
  /** @private @type { LayoutRow } */
  #objective;
  /** @private @type { LayoutRow | null } */
  #artificial;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    this.#constraintTags = new System20.Map();
    this.#rows = new System20.Map();
    this.#variableSymbols = new System20.Map();
    this.#editInfos = new System20.Map();
    this.#infeasibleRows = [];
    this.#objective = new LayoutRow(0);
    this.#artificial = null;
  }
  //==============================================================================
  // 제약 추가.
  //==============================================================================
  /**
   * @param { LayoutConstraint } constraint
   */
  addConstraint(constraint) {
    if (this.#constraintTags.has(constraint)) {
      throw new System20.Error("[LayoutSolver] \uC774\uBBF8 \uCD94\uAC00\uB41C \uC81C\uC57D.");
    }
    const tag = new LayoutTag();
    const row = this.createRow(constraint, tag);
    let subject = this.chooseSubject(row, tag);
    if (subject.isInvalid() && allDummies(row)) {
      if (!nearZero2(row.getConstant())) {
        throw new System20.Error("[LayoutSolver] \uBAA8\uC21C \uC81C\uC57D: \uB9CC\uC871 \uBD88\uAC00\uB2A5.");
      }
      subject = tag.getMarker();
    }
    if (subject.isInvalid()) {
      const success = this.addWithArtificialVariable(row);
      if (!success) {
        throw new System20.Error("[LayoutSolver] \uBAA8\uC21C \uC81C\uC57D: \uB9CC\uC871 \uBD88\uAC00\uB2A5.");
      }
    } else {
      row.solveFor(subject);
      this.substitute(subject, row);
      this.#rows.set(subject, row);
    }
    this.#constraintTags.set(constraint, tag);
    this.optimize(this.#objective);
  }
  //==============================================================================
  // 제약 제거.
  //==============================================================================
  /**
   * @param { LayoutConstraint } constraint
   */
  removeConstraint(constraint) {
    const tag = this.#constraintTags.get(constraint);
    if (tag === void 0) {
      throw new System20.Error("[LayoutSolver] \uB4F1\uB85D\uB418\uC9C0 \uC54A\uC740 \uC81C\uC57D.");
    }
    this.#constraintTags.delete(constraint);
    this.removeConstraintEffects(constraint, tag);
    const marker = tag.getMarker();
    if (this.#rows.has(marker)) {
      this.#rows.delete(marker);
    } else {
      const leavingSymbol = this.getMarkerLeavingSymbol(marker);
      if (leavingSymbol.isInvalid()) {
        throw new System20.Error("[LayoutSolver] \uC81C\uC57D \uC81C\uAC70 \uC2E4\uD328 \u2014 leaving row \uC5C6\uC74C.");
      }
      const leavingRow = this.#rows.get(leavingSymbol);
      this.#rows.delete(leavingSymbol);
      leavingRow.solveForPair(leavingSymbol, marker);
      this.substitute(marker, leavingRow);
    }
    this.optimize(this.#objective);
  }
  //==============================================================================
  // 제약 등록 여부.
  //==============================================================================
  /**
   * @param { LayoutConstraint } constraint
   * @returns { boolean }
   */
  hasConstraint(constraint) {
    return this.#constraintTags.has(constraint);
  }
  //==============================================================================
  // 편집(edit) 변수 추가. suggestValue 사용 전 반드시 등록.
  //==============================================================================
  /**
   * @param { LayoutVariable } variable
   * @param { number } strength
   */
  addEditVariable(variable, strength) {
    if (this.#editInfos.has(variable)) {
      throw new System20.Error("[LayoutSolver] \uC774\uBBF8 \uD3B8\uC9D1 \uBCC0\uC218\uB85C \uB4F1\uB85D\uB428.");
    }
    const clipped = LayoutStrength.clipStrength(strength);
    if (clipped >= LayoutStrength.required) {
      throw new System20.Error("[LayoutSolver] \uD3B8\uC9D1 \uBCC0\uC218\uC5D0\uB294 required \uAC15\uB3C4\uB97C \uC4F8 \uC218 \uC5C6\uC74C.");
    }
    const expression = LayoutExpression.fromVariable(variable);
    const constraint = new LayoutConstraint(expression, LayoutRelation.equal, clipped);
    this.addConstraint(constraint);
    const tag = this.#constraintTags.get(constraint);
    const editInfo = new LayoutEditInfo(constraint, tag, 0);
    this.#editInfos.set(variable, editInfo);
  }
  //==============================================================================
  // 편집 변수 제거.
  //==============================================================================
  /**
   * @param { LayoutVariable } variable
   */
  removeEditVariable(variable) {
    const editInfo = this.#editInfos.get(variable);
    if (editInfo === void 0) {
      throw new System20.Error("[LayoutSolver] \uB4F1\uB85D\uB418\uC9C0 \uC54A\uC740 \uD3B8\uC9D1 \uBCC0\uC218.");
    }
    this.removeConstraint(editInfo.getConstraint());
    this.#editInfos.delete(variable);
  }
  //==============================================================================
  // 편집 변수 등록 여부.
  //==============================================================================
  /**
   * @param { LayoutVariable } variable
   * @returns { boolean }
   */
  hasEditVariable(variable) {
    return this.#editInfos.has(variable);
  }
  //==============================================================================
  // 편집 변수에 권장 값 제안. (드래그 갱신 등)
  // - 솔버는 가능한 그 값을 만족시키되 다른 제약과 충돌하면 강도에 따라 양보.
  //==============================================================================
  /**
   * @param { LayoutVariable } variable
   * @param { number } value
   */
  suggestValue(variable, value) {
    const editInfo = this.#editInfos.get(variable);
    if (editInfo === void 0) {
      throw new System20.Error("[LayoutSolver] \uB4F1\uB85D\uB418\uC9C0 \uC54A\uC740 \uD3B8\uC9D1 \uBCC0\uC218.");
    }
    const delta = value - editInfo.getConstant();
    editInfo.setConstant(value);
    const tag = editInfo.getTag();
    const markerSymbol = tag.getMarker();
    const otherSymbol = tag.getOther();
    if (this.#rows.has(markerSymbol)) {
      const row = this.#rows.get(markerSymbol);
      if (row.addConstant(-delta) < 0) {
        this.#infeasibleRows.push(markerSymbol);
      }
      this.dualOptimize();
      return;
    }
    if (this.#rows.has(otherSymbol)) {
      const row = this.#rows.get(otherSymbol);
      if (row.addConstant(delta) < 0) {
        this.#infeasibleRows.push(otherSymbol);
      }
      this.dualOptimize();
      return;
    }
    for (const [symbol, row] of this.#rows) {
      const coefficient = row.coefficientFor(markerSymbol);
      if (coefficient === 0) {
        continue;
      }
      if (row.addConstant(delta * coefficient) < 0 && symbol.getType() !== LayoutSymbolType.external) {
        this.#infeasibleRows.push(symbol);
      }
    }
    this.dualOptimize();
  }
  //==============================================================================
  // 변수 값 갱신. tableau 의 external 행 상수항을 각 LayoutVariable 에 반영.
  //==============================================================================
  updateVariables() {
    for (const [variable, symbol] of this.#variableSymbols) {
      if (this.#rows.has(symbol)) {
        const row = this.#rows.get(symbol);
        variable.setValue(row.getConstant());
      } else {
        variable.setValue(0);
      }
    }
  }
  //==============================================================================
  // 내부: LayoutVariable → LayoutSymbol 매핑 (없으면 생성).
  //==============================================================================
  /**
   * @param { LayoutVariable } variable
   * @returns { LayoutSymbol }
   */
  getOrCreateSymbol(variable) {
    if (this.#variableSymbols.has(variable)) {
      return this.#variableSymbols.get(variable);
    }
    const symbol = new LayoutSymbol(LayoutSymbolType.external);
    this.#variableSymbols.set(variable, symbol);
    return symbol;
  }
  //==============================================================================
  // 내부: 제약 → 행 생성. tag 에 marker / other 심볼을 채운다.
  //==============================================================================
  /**
   * @param { LayoutConstraint } constraint
   * @param { LayoutTag } tag
   * @returns { LayoutRow }
   */
  createRow(constraint, tag) {
    const expression = constraint.getExpression();
    const row = new LayoutRow(expression.getConstant());
    const terms = expression.getTerms();
    for (const term of terms) {
      const coefficient = term.getCoefficient();
      if (nearZero2(coefficient)) {
        continue;
      }
      const variable = term.getVariable();
      const symbol = this.getOrCreateSymbol(variable);
      if (this.#rows.has(symbol)) {
        const basicRow = this.#rows.get(symbol);
        row.insertRow(basicRow, coefficient);
      } else {
        row.insertSymbol(symbol, coefficient);
      }
    }
    const relation = constraint.getRelation();
    const strength = constraint.getStrength();
    if (relation === LayoutRelation.lessThanOrEqual || relation === LayoutRelation.greaterThanOrEqual) {
      const sign = relation === LayoutRelation.lessThanOrEqual ? 1 : -1;
      const slackSymbol = new LayoutSymbol(LayoutSymbolType.slack);
      tag.setMarker(slackSymbol);
      row.insertSymbol(slackSymbol, sign);
      if (strength < LayoutStrength.required) {
        const errorSymbol = new LayoutSymbol(LayoutSymbolType.error);
        tag.setOther(errorSymbol);
        row.insertSymbol(errorSymbol, -sign);
        this.#objective.insertSymbol(errorSymbol, strength);
      }
    } else {
      if (strength < LayoutStrength.required) {
        const errorPlus = new LayoutSymbol(LayoutSymbolType.error);
        const errorMinus = new LayoutSymbol(LayoutSymbolType.error);
        tag.setMarker(errorPlus);
        tag.setOther(errorMinus);
        row.insertSymbol(errorPlus, -1);
        row.insertSymbol(errorMinus, 1);
        this.#objective.insertSymbol(errorPlus, strength);
        this.#objective.insertSymbol(errorMinus, strength);
      } else {
        const dummySymbol = new LayoutSymbol(LayoutSymbolType.dummy);
        tag.setMarker(dummySymbol);
        row.insertSymbol(dummySymbol, 1);
      }
    }
    if (row.getConstant() < 0) {
      row.reverseSign();
    }
    return row;
  }
  //==============================================================================
  // 내부: 행에서 subject 심볼 선택.
  // 1) 외부 변수 우선. 2) slack/error 의 음수 계수 항. 3) 둘 다 없으면 invalid.
  //==============================================================================
  /**
   * @param { LayoutRow } row
   * @param { LayoutTag } tag
   * @returns { LayoutSymbol }
   */
  chooseSubject(row, tag) {
    const cells = row.getCells();
    for (const [symbol, _coefficient] of cells) {
      if (symbol.getType() === LayoutSymbolType.external) {
        return symbol;
      }
    }
    const markerSymbol = tag.getMarker();
    if (markerSymbol !== null && (markerSymbol.getType() === LayoutSymbolType.slack || markerSymbol.getType() === LayoutSymbolType.error)) {
      if (row.coefficientFor(markerSymbol) < 0) {
        return markerSymbol;
      }
    }
    const otherSymbol = tag.getOther();
    if (otherSymbol !== null && (otherSymbol.getType() === LayoutSymbolType.slack || otherSymbol.getType() === LayoutSymbolType.error)) {
      if (row.coefficientFor(otherSymbol) < 0) {
        return otherSymbol;
      }
    }
    return LayoutSymbol.invalid();
  }
  //==============================================================================
  // 내부: 인공 변수로 행 강제 추가. 성공 여부 반환.
  //==============================================================================
  /**
   * @param { LayoutRow } row
   * @returns { boolean }
   */
  addWithArtificialVariable(row) {
    const artificialSymbol = new LayoutSymbol(LayoutSymbolType.slack);
    this.#rows.set(artificialSymbol, row.copy());
    this.#artificial = row.copy();
    this.optimize(this.#artificial);
    const success = nearZero2(this.#artificial.getConstant());
    this.#artificial = null;
    if (this.#rows.has(artificialSymbol)) {
      const basicRow = this.#rows.get(artificialSymbol);
      this.#rows.delete(artificialSymbol);
      if (basicRow.getCells().size === 0) {
        return success;
      }
      const entering = anyPivotableSymbol(basicRow);
      if (entering.isInvalid()) {
        return false;
      }
      basicRow.solveForPair(artificialSymbol, entering);
      this.substitute(entering, basicRow);
      this.#rows.set(entering, basicRow);
    }
    for (const [_symbol, currentRow] of this.#rows) {
      currentRow.removeSymbol(artificialSymbol);
    }
    this.#objective.removeSymbol(artificialSymbol);
    return success;
  }
  //==============================================================================
  // 내부: 모든 행과 objective 에서 symbol 의 등장을 row 로 치환.
  //==============================================================================
  /**
   * @param { LayoutSymbol } symbol
   * @param { LayoutRow } row
   */
  substitute(symbol, row) {
    for (const [basicSymbol, basicRow] of this.#rows) {
      basicRow.substitute(symbol, row);
      if (basicSymbol.getType() !== LayoutSymbolType.external && basicRow.getConstant() < 0) {
        this.#infeasibleRows.push(basicSymbol);
      }
    }
    this.#objective.substitute(symbol, row);
    if (this.#artificial !== null) {
      this.#artificial.substitute(symbol, row);
    }
  }
  //==============================================================================
  // 내부: 1차 (primal) 최적화. objective 가 더 이상 음수 계수를 갖지 않을 때까지 반복.
  //==============================================================================
  /**
   * @param { LayoutRow } objective
   */
  optimize(objective) {
    const safeguard = 1e5;
    for (let i = 0; i < safeguard; i += 1) {
      const enteringSymbol = getEnteringSymbol(objective);
      if (enteringSymbol.isInvalid()) {
        return;
      }
      const leavingSymbol = this.getLeavingSymbol(enteringSymbol);
      if (leavingSymbol.isInvalid()) {
        throw new System20.Error("[LayoutSolver] \uBAA9\uC801\uD568\uC218\uAC00 \uBB34\uD55C\uB300 \u2014 bound \uAC00 \uBD80\uC871\uD568.");
      }
      const leavingRow = this.#rows.get(leavingSymbol);
      this.#rows.delete(leavingSymbol);
      leavingRow.solveForPair(leavingSymbol, enteringSymbol);
      this.substitute(enteringSymbol, leavingRow);
      this.#rows.set(enteringSymbol, leavingRow);
    }
    throw new System20.Error("[LayoutSolver] optimize \uBC18\uBCF5 \uD55C\uACC4 \uCD08\uACFC.");
  }
  //==============================================================================
  // 내부: dual simplex 최적화. infeasible 행을 처리.
  //==============================================================================
  dualOptimize() {
    const safeguard = 1e5;
    for (let i = 0; i < safeguard; i += 1) {
      if (this.#infeasibleRows.length === 0) {
        return;
      }
      const leavingSymbol = this.#infeasibleRows.pop();
      if (!this.#rows.has(leavingSymbol)) {
        continue;
      }
      const row = this.#rows.get(leavingSymbol);
      if (row.getConstant() >= 0) {
        continue;
      }
      const enteringSymbol = this.getDualEnteringSymbol(row);
      if (enteringSymbol.isInvalid()) {
        throw new System20.Error("[LayoutSolver] dual optimize \uC2E4\uD328 \u2014 entering \uC5C6\uC74C.");
      }
      this.#rows.delete(leavingSymbol);
      row.solveForPair(leavingSymbol, enteringSymbol);
      this.substitute(enteringSymbol, row);
      this.#rows.set(enteringSymbol, row);
    }
    throw new System20.Error("[LayoutSolver] dualOptimize \uBC18\uBCF5 \uD55C\uACC4 \uCD08\uACFC.");
  }
  //==============================================================================
  // 내부: leaving symbol 결정. (Bland's rule 변형 + 비율 테스트)
  //==============================================================================
  /**
   * @param { LayoutSymbol } enteringSymbol
   * @returns { LayoutSymbol }
   */
  getLeavingSymbol(enteringSymbol) {
    let ratio = System20.Number.POSITIVE_INFINITY;
    let result = LayoutSymbol.invalid();
    for (const [symbol, row] of this.#rows) {
      if (symbol.getType() === LayoutSymbolType.external) {
        continue;
      }
      const coefficient = row.coefficientFor(enteringSymbol);
      if (coefficient < 0) {
        const tentativeRatio = -row.getConstant() / coefficient;
        if (tentativeRatio < ratio) {
          ratio = tentativeRatio;
          result = symbol;
        }
      }
    }
    return result;
  }
  //==============================================================================
  // 내부: dual entering symbol 결정.
  //==============================================================================
  /**
   * @param { LayoutRow } row
   * @returns { LayoutSymbol }
   */
  getDualEnteringSymbol(row) {
    let ratio = System20.Number.POSITIVE_INFINITY;
    let result = LayoutSymbol.invalid();
    const cells = row.getCells();
    for (const [symbol, value] of cells) {
      if (value > 0 && symbol.getType() !== LayoutSymbolType.dummy) {
        const objectiveCoefficient = this.#objective.coefficientFor(symbol);
        const tentativeRatio = objectiveCoefficient / value;
        if (tentativeRatio < ratio) {
          ratio = tentativeRatio;
          result = symbol;
        }
      }
    }
    return result;
  }
  //==============================================================================
  // 내부: marker 가 leaving 으로 떠날 행 결정.
  //==============================================================================
  /**
   * @param { LayoutSymbol } marker
   * @returns { LayoutSymbol }
   */
  getMarkerLeavingSymbol(marker) {
    let ratio1 = System20.Number.POSITIVE_INFINITY;
    let ratio2 = System20.Number.POSITIVE_INFINITY;
    let result1 = LayoutSymbol.invalid();
    let result2 = LayoutSymbol.invalid();
    let result3 = LayoutSymbol.invalid();
    for (const [symbol, row] of this.#rows) {
      const coefficient = row.coefficientFor(marker);
      if (coefficient === 0) {
        continue;
      }
      if (symbol.getType() === LayoutSymbolType.external) {
        result3 = symbol;
      } else if (coefficient < 0) {
        const tentativeRatio = -row.getConstant() / coefficient;
        if (tentativeRatio < ratio1) {
          ratio1 = tentativeRatio;
          result1 = symbol;
        }
      } else {
        const tentativeRatio = row.getConstant() / coefficient;
        if (tentativeRatio < ratio2) {
          ratio2 = tentativeRatio;
          result2 = symbol;
        }
      }
    }
    if (!result1.isInvalid()) {
      return result1;
    }
    if (!result2.isInvalid()) {
      return result2;
    }
    return result3;
  }
  //==============================================================================
  // 내부: 제약의 오차 변수가 목적함수에 끼친 영향을 제거.
  //==============================================================================
  /**
   * @param { LayoutConstraint } constraint
   * @param { LayoutTag } tag
   */
  removeConstraintEffects(constraint, tag) {
    const markerSymbol = tag.getMarker();
    const otherSymbol = tag.getOther();
    if (markerSymbol !== null && markerSymbol.getType() === LayoutSymbolType.error) {
      this.removeMarkerEffect(markerSymbol, constraint.getStrength());
    }
    if (otherSymbol !== null && otherSymbol.getType() === LayoutSymbolType.error) {
      this.removeMarkerEffect(otherSymbol, constraint.getStrength());
    }
  }
  //==============================================================================
  // 내부: 단일 오차 변수 영향 제거.
  //==============================================================================
  /**
   * @param { LayoutSymbol } markerSymbol
   * @param { number } strength
   */
  removeMarkerEffect(markerSymbol, strength) {
    if (this.#rows.has(markerSymbol)) {
      const row = this.#rows.get(markerSymbol);
      this.#objective.insertRow(row, -strength);
    } else {
      this.#objective.insertSymbol(markerSymbol, -strength);
    }
  }
};
var LayoutTag = class {
  static {
    __name(this, "LayoutTag");
  }
  /** @private @type { LayoutSymbol | null } */
  #marker;
  /** @private @type { LayoutSymbol | null } */
  #other;
  constructor() {
    this.#marker = null;
    this.#other = null;
  }
  getMarker() {
    return this.#marker;
  }
  setMarker(marker) {
    this.#marker = marker;
  }
  getOther() {
    return this.#other;
  }
  setOther(other) {
    this.#other = other;
  }
};
var LayoutEditInfo = class {
  static {
    __name(this, "LayoutEditInfo");
  }
  /** @private @type { LayoutConstraint } */
  #constraint;
  /** @private @type { LayoutTag } */
  #tag;
  /** @private @type { number } */
  #constant;
  constructor(constraint, tag, constant) {
    this.#constraint = constraint;
    this.#tag = tag;
    this.#constant = constant;
  }
  getConstraint() {
    return this.#constraint;
  }
  getTag() {
    return this.#tag;
  }
  getConstant() {
    return this.#constant;
  }
  setConstant(constant) {
    this.#constant = constant;
  }
};
function getEnteringSymbol(objective) {
  const cells = objective.getCells();
  for (const [symbol, value] of cells) {
    if (symbol.getType() !== LayoutSymbolType.dummy && value < 0) {
      return symbol;
    }
  }
  return LayoutSymbol.invalid();
}
__name(getEnteringSymbol, "getEnteringSymbol");
function allDummies(row) {
  const cells = row.getCells();
  for (const [symbol, _value] of cells) {
    if (symbol.getType() !== LayoutSymbolType.dummy) {
      return false;
    }
  }
  return true;
}
__name(allDummies, "allDummies");
function anyPivotableSymbol(row) {
  const cells = row.getCells();
  for (const [symbol, _value] of cells) {
    const type = symbol.getType();
    if (type === LayoutSymbolType.slack || type === LayoutSymbolType.error) {
      return symbol;
    }
  }
  return LayoutSymbol.invalid();
}
__name(anyPivotableSymbol, "anyPivotableSymbol");
var NEAR_ZERO_EPS2 = 1e-8;
function nearZero2(value) {
  return value < 0 ? -value < NEAR_ZERO_EPS2 : value < NEAR_ZERO_EPS2;
}
__name(nearZero2, "nearZero");

// src/ui/autolayout/layoutpriority.js
var LayoutPriority = class {
  static {
    __name(this, "LayoutPriority");
  }
  //==============================================================================
  // 표준 우선순위 상수.
  //==============================================================================
  static required = 1e3;
  static defaultHigh = 750;
  static defaultLow = 250;
  static fittingSizeLevel = 50;
};

// src/ui/autolayout/layoutconstraintaxis.js
var System21 = globalThis;
var LayoutConstraintAxis = System21.Object.freeze({
  horizontal: "horizontal",
  vertical: "vertical"
});

// src/ui/uinode.js
var System22 = globalThis;
var NO_INTRINSIC_METRIC = -1;
var UINode = class _UINode extends TransformNode {
  static {
    __name(this, "UINode");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { LayoutSolver | null } */
  #solver;
  /** @private @type { LayoutVariable } */
  #leftVariable;
  /** @private @type { LayoutVariable } */
  #rightVariable;
  /** @private @type { LayoutVariable } */
  #topVariable;
  /** @private @type { LayoutVariable } */
  #bottomVariable;
  /** @private @type { LayoutVariable } */
  #widthVariable;
  /** @private @type { LayoutVariable } */
  #heightVariable;
  /** @private @type { LayoutVariable } */
  #centerXVariable;
  /** @private @type { LayoutVariable } */
  #centerYVariable;
  /** @private @type { LayoutConstraint[] } */
  #intrinsicConstraints;
  /** @private @type { LayoutConstraint[] } */
  #userConstraints;
  /** @private @type { LayoutConstraint[] } */
  #intrinsicSizeConstraints;
  /** @private @type { number } */
  #horizontalHuggingPriority;
  /** @private @type { number } */
  #verticalHuggingPriority;
  /** @private @type { number } */
  #horizontalCompressionResistancePriority;
  /** @private @type { number } */
  #verticalCompressionResistancePriority;
  /** @private @type { { top: number, left: number, bottom: number, right: number } } */
  #layoutMargins;
  /** @private @type { UINode | null } */
  #layoutMarginsGuide;
  /** @private @type { LayoutConstraint[] } */
  #layoutMarginsGuideConstraints;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.nodeType = "UINode";
    this.#solver = null;
    this.#leftVariable = new LayoutVariable("left");
    this.#rightVariable = new LayoutVariable("right");
    this.#topVariable = new LayoutVariable("top");
    this.#bottomVariable = new LayoutVariable("bottom");
    this.#widthVariable = new LayoutVariable("width");
    this.#heightVariable = new LayoutVariable("height");
    this.#centerXVariable = new LayoutVariable("centerX");
    this.#centerYVariable = new LayoutVariable("centerY");
    this.#intrinsicConstraints = this.buildIntrinsicConstraints();
    this.#userConstraints = [];
    this.#intrinsicSizeConstraints = [];
    this.#horizontalHuggingPriority = LayoutPriority.defaultLow;
    this.#verticalHuggingPriority = LayoutPriority.defaultLow;
    this.#horizontalCompressionResistancePriority = LayoutPriority.defaultHigh;
    this.#verticalCompressionResistancePriority = LayoutPriority.defaultHigh;
    this.#layoutMargins = { top: 8, left: 8, bottom: 8, right: 8 };
    this.#layoutMarginsGuide = null;
    this.#layoutMarginsGuideConstraints = [];
  }
  //==============================================================================
  // 출력 상태 시작.
  // - 솔버 변수 (left / top) 는 UI 트리 루트가 속한 좌표계 기준의 절대 위치로 간주된다.
  //   (UIKit 의 anchor 가 window 좌표계 기준인 것과 동일한 사상)
  // - 부모도 UINode 라면 부모가 이미 (parentLeft, parentTop) 만큼 변환을 적용해 두었으므로
  //   자식은 (left - parentLeft, top - parentTop) 만큼 추가 이동만 해야 한다.
  // - 회전 / 스케일 / 투명도는 기존 TransformNode 의 멤버를 그대로 사용한다.
  //   (UINode 의 영역 자체는 솔버 변수로 결정되므로 setLocalPosition 은 사용하지 않는다)
  //==============================================================================
  /**
   * @override
   * @param { Graphic } graphic
   */
  pushTransform(graphic) {
    if (graphic) {
      graphic.pushState();
      const left = this.getLeft();
      const top = this.getTop();
      let translateX = left;
      let translateY = top;
      const parent = this.getParent();
      if (parent instanceof _UINode) {
        const parentLeft = parent.getLeft();
        const parentTop = parent.getTop();
        translateX = left - parentLeft;
        translateY = top - parentTop;
      }
      const localRotation = this.getLocalRotation();
      const radian = degreeToRadian(localRotation);
      const localScale = this.getLocalScale();
      graphic.translate(translateX, translateY);
      graphic.rotate(radian);
      graphic.scale(localScale.x, localScale.y);
      const localOpacity = this.getLocalOpacity();
      graphic.multiplyGlobalAlpha(localOpacity);
    }
  }
  //==============================================================================
  // 컨텐트 사이즈 반환. (솔버가 풀어낸 width / height)
  // - WorldNode 의 getContentSize 와 동일 시그니처. Mask 등 컴포넌트가 그대로 사용 가능.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  getContentSize() {
    const width = this.getWidth();
    const height = this.getHeight();
    return Vector2.create(width, height);
  }
  //==============================================================================
  // 본질 제약 4 개 생성.
  // - right  == left + width
  // - bottom == top + height
  // - centerX == left + width/2
  // - centerY == top + height/2
  //==============================================================================
  /**
   * @returns { LayoutConstraint[] }
   */
  buildIntrinsicConstraints() {
    const leftExpression = this.leftAnchor;
    const rightExpression = this.rightAnchor;
    const topExpression = this.topAnchor;
    const bottomExpression = this.bottomAnchor;
    const widthExpression = this.widthAnchor;
    const heightExpression = this.heightAnchor;
    const centerXExpression = this.centerXAnchor;
    const centerYExpression = this.centerYAnchor;
    const rightConstraint = rightExpression.equalTo(leftExpression.add(widthExpression));
    const bottomConstraint = bottomExpression.equalTo(topExpression.add(heightExpression));
    const centerXConstraint = centerXExpression.equalTo(leftExpression.add(widthExpression.divide(2)));
    const centerYConstraint = centerYExpression.equalTo(topExpression.add(heightExpression.divide(2)));
    return [rightConstraint, bottomConstraint, centerXConstraint, centerYConstraint];
  }
  //==============================================================================
  // intrinsic content size 기반 제약 (hug / compression resistance) 4 개 생성.
  // - 축마다 intrinsic 값이 NO_INTRINSIC_METRIC (-1) 이면 그 축의 제약은 생성하지 않는다.
  // - hug:        widthAnchor.lessThanOrEqualTo(intrinsicWidth) @ huggingPriority
  // - compression: widthAnchor.greaterThanOrEqualTo(intrinsicWidth) @ compressionResistancePriority
  //==============================================================================
  /**
   * @returns { LayoutConstraint[] }
   */
  buildIntrinsicSizeConstraints() {
    const intrinsicSize = this.getIntrinsicContentSize();
    const result = [];
    if (intrinsicSize.x !== NO_INTRINSIC_METRIC) {
      const horizontalHuggingStrength = LayoutStrength.fromPriority(this.#horizontalHuggingPriority);
      const horizontalCompressionStrength = LayoutStrength.fromPriority(this.#horizontalCompressionResistancePriority);
      const widthHugConstraint = this.widthAnchor.lessThanOrEqualTo(intrinsicSize.x).withStrength(horizontalHuggingStrength);
      const widthCompressionConstraint = this.widthAnchor.greaterThanOrEqualTo(intrinsicSize.x).withStrength(horizontalCompressionStrength);
      result.push(widthHugConstraint);
      result.push(widthCompressionConstraint);
    }
    if (intrinsicSize.y !== NO_INTRINSIC_METRIC) {
      const verticalHuggingStrength = LayoutStrength.fromPriority(this.#verticalHuggingPriority);
      const verticalCompressionStrength = LayoutStrength.fromPriority(this.#verticalCompressionResistancePriority);
      const heightHugConstraint = this.heightAnchor.lessThanOrEqualTo(intrinsicSize.y).withStrength(verticalHuggingStrength);
      const heightCompressionConstraint = this.heightAnchor.greaterThanOrEqualTo(intrinsicSize.y).withStrength(verticalCompressionStrength);
      result.push(heightHugConstraint);
      result.push(heightCompressionConstraint);
    }
    return result;
  }
  //==============================================================================
  // 본 노드의 intrinsic content size 반환. 서브클래스가 override.
  // - x 또는 y 가 NO_INTRINSIC_METRIC (-1) 이면 그 축은 intrinsic 선호 없음.
  // - 기본 구현은 부착된 컴포넌트 중 getIntrinsicContentSize 를 가진 것들의
  //   값을 max 로 합산해 반환. (Text 등 컴포넌트가 자동으로 기여)
  //==============================================================================
  /**
   * @virtual
   * @returns { Vector2 }
   */
  getIntrinsicContentSize() {
    let maxWidth = NO_INTRINSIC_METRIC;
    let maxHeight = NO_INTRINSIC_METRIC;
    const components = this.getAllComponents();
    for (const component of components) {
      if (typeof component.getIntrinsicContentSize !== "function") {
        continue;
      }
      const componentSize = component.getIntrinsicContentSize();
      if (componentSize.x > maxWidth) {
        maxWidth = componentSize.x;
      }
      if (componentSize.y > maxHeight) {
        maxHeight = componentSize.y;
      }
    }
    return Vector2.create(maxWidth, maxHeight);
  }
  //==============================================================================
  // intrinsic content size 무효화. UIKit 의 invalidateIntrinsicContentSize 와 동일.
  // - 솔버에서 기존 intrinsicSize 제약을 제거하고 새 값으로 다시 등록한다.
  // - 텍스트 / 이미지 등 컨텐트가 바뀌어 intrinsic size 가 달라졌을 때 호출.
  //==============================================================================
  invalidateIntrinsicContentSize() {
    const solver = this.#solver;
    if (solver !== null) {
      for (const constraint of this.#intrinsicSizeConstraints) {
        if (solver.hasConstraint(constraint)) {
          solver.removeConstraint(constraint);
        }
      }
    }
    this.#intrinsicSizeConstraints = this.buildIntrinsicSizeConstraints();
    if (solver !== null) {
      for (const constraint of this.#intrinsicSizeConstraints) {
        solver.addConstraint(constraint);
      }
    }
  }
  //==============================================================================
  // content hugging 우선순위 반환. (UIKit 의 contentHuggingPriority(for:))
  //==============================================================================
  /**
   * @param { string } axis
   * @returns { number }
   */
  getContentHuggingPriority(axis) {
    if (axis === LayoutConstraintAxis.horizontal) {
      return this.#horizontalHuggingPriority;
    }
    if (axis === LayoutConstraintAxis.vertical) {
      return this.#verticalHuggingPriority;
    }
    throw new System22.Error("[UINode] getContentHuggingPriority: \uC9C0\uC6D0\uB418\uC9C0 \uC54A\uB294 \uCD95.");
  }
  //==============================================================================
  // content hugging 우선순위 설정. (UIKit 의 setContentHuggingPriority(_:for:))
  // - intrinsicSize 제약을 즉시 갱신.
  //==============================================================================
  /**
   * @param { number } priority
   * @param { string } axis
   */
  setContentHuggingPriority(priority, axis) {
    if (axis === LayoutConstraintAxis.horizontal) {
      this.#horizontalHuggingPriority = priority;
    } else if (axis === LayoutConstraintAxis.vertical) {
      this.#verticalHuggingPriority = priority;
    } else {
      throw new System22.Error("[UINode] setContentHuggingPriority: \uC9C0\uC6D0\uB418\uC9C0 \uC54A\uB294 \uCD95.");
    }
    this.invalidateIntrinsicContentSize();
  }
  //==============================================================================
  // content compression resistance 우선순위 반환.
  // (UIKit 의 contentCompressionResistancePriority(for:))
  //==============================================================================
  /**
   * @param { string } axis
   * @returns { number }
   */
  getContentCompressionResistancePriority(axis) {
    if (axis === LayoutConstraintAxis.horizontal) {
      return this.#horizontalCompressionResistancePriority;
    }
    if (axis === LayoutConstraintAxis.vertical) {
      return this.#verticalCompressionResistancePriority;
    }
    throw new System22.Error("[UINode] getContentCompressionResistancePriority: \uC9C0\uC6D0\uB418\uC9C0 \uC54A\uB294 \uCD95.");
  }
  //==============================================================================
  // content compression resistance 우선순위 설정.
  // (UIKit 의 setContentCompressionResistancePriority(_:for:))
  // - intrinsicSize 제약을 즉시 갱신.
  //==============================================================================
  /**
   * @param { number } priority
   * @param { string } axis
   */
  setContentCompressionResistancePriority(priority, axis) {
    if (axis === LayoutConstraintAxis.horizontal) {
      this.#horizontalCompressionResistancePriority = priority;
    } else if (axis === LayoutConstraintAxis.vertical) {
      this.#verticalCompressionResistancePriority = priority;
    } else {
      throw new System22.Error("[UINode] setContentCompressionResistancePriority: \uC9C0\uC6D0\uB418\uC9C0 \uC54A\uB294 \uCD95.");
    }
    this.invalidateIntrinsicContentSize();
  }
  //==============================================================================
  // layoutMargins 반환. (UIKit 의 UIView.layoutMargins)
  //==============================================================================
  /**
   * @returns { { top: number, left: number, bottom: number, right: number } }
   */
  getLayoutMargins() {
    const layoutMargins = this.#layoutMargins;
    return {
      top: layoutMargins.top,
      left: layoutMargins.left,
      bottom: layoutMargins.bottom,
      right: layoutMargins.right
    };
  }
  //==============================================================================
  // layoutMargins 설정. (UIKit 의 UIView.layoutMargins setter)
  // - layoutMarginsGuide 가 이미 생성됐다면 가이드 제약을 즉시 갱신.
  //==============================================================================
  /**
   * @param { { top: number, left: number, bottom: number, right: number } } layoutMargins
   */
  setLayoutMargins(layoutMargins) {
    this.#layoutMargins = {
      top: layoutMargins.top,
      left: layoutMargins.left,
      bottom: layoutMargins.bottom,
      right: layoutMargins.right
    };
    if (this.#layoutMarginsGuide !== null) {
      this.rebuildLayoutMarginsGuideConstraints();
    }
  }
  //==============================================================================
  // layoutMarginsGuide 반환. (UIKit 의 UIView.layoutMarginsGuide)
  // - 처음 호출 시 lazy 로 가이드 UINode 를 생성하고 4 개의 마진 제약을 솔버에 등록.
  // - 가이드는 트리에 들어가지 않아 렌더링되지 않으며, anchor 만 사용된다.
  //==============================================================================
  /**
   * @returns { UINode }
   */
  getLayoutMarginsGuide() {
    if (this.#layoutMarginsGuide === null) {
      this.#layoutMarginsGuide = new _UINode();
      this.#layoutMarginsGuide.setName("layoutMargins");
      if (this.#solver !== null) {
        this.#layoutMarginsGuide.setSolver(this.#solver);
      }
      this.rebuildLayoutMarginsGuideConstraints();
    }
    return this.#layoutMarginsGuide;
  }
  //==============================================================================
  // layoutMarginsGuide 의 마진 제약 (4 개) 재구축.
  // - 기존 마진 제약을 솔버에서 제거하고 현재 #layoutMargins 값으로 다시 구축 후 재등록.
  //==============================================================================
  rebuildLayoutMarginsGuideConstraints() {
    const guide = this.#layoutMarginsGuide;
    if (guide === null) {
      return;
    }
    const solver = this.#solver;
    if (solver !== null) {
      for (const constraint of this.#layoutMarginsGuideConstraints) {
        if (solver.hasConstraint(constraint)) {
          solver.removeConstraint(constraint);
        }
      }
    }
    const margins = this.#layoutMargins;
    const guideLeftConstraint = guide.leftAnchor.equalTo(this.leftAnchor.add(margins.left));
    const guideTopConstraint = guide.topAnchor.equalTo(this.topAnchor.add(margins.top));
    const guideRightConstraint = guide.rightAnchor.equalTo(this.rightAnchor.subtract(margins.right));
    const guideBottomConstraint = guide.bottomAnchor.equalTo(this.bottomAnchor.subtract(margins.bottom));
    this.#layoutMarginsGuideConstraints = [guideLeftConstraint, guideTopConstraint, guideRightConstraint, guideBottomConstraint];
    if (solver !== null) {
      for (const constraint of this.#layoutMarginsGuideConstraints) {
        solver.addConstraint(constraint);
      }
    }
  }
  //==============================================================================
  // 솔버 설정 / 변경 / 해제.
  // - 기존 솔버에서 본 노드의 모든 제약을 제거한 뒤, 새 솔버에 다시 등록한다.
  // - layoutMarginsGuide 가 이미 존재하면 그 가이드와 가이드 제약도 함께 이전 / 신규 솔버로 옮긴다.
  // - solver 가 null 이면 모두 해제만 한다.
  //==============================================================================
  /**
   * @param { LayoutSolver | null } solver
   */
  setSolver(solver) {
    const previousSolver = this.#solver;
    if (previousSolver !== null) {
      for (const constraint of this.#layoutMarginsGuideConstraints) {
        if (previousSolver.hasConstraint(constraint)) {
          previousSolver.removeConstraint(constraint);
        }
      }
      for (const constraint of this.#userConstraints) {
        if (previousSolver.hasConstraint(constraint)) {
          previousSolver.removeConstraint(constraint);
        }
      }
      for (const constraint of this.#intrinsicSizeConstraints) {
        if (previousSolver.hasConstraint(constraint)) {
          previousSolver.removeConstraint(constraint);
        }
      }
      for (const constraint of this.#intrinsicConstraints) {
        if (previousSolver.hasConstraint(constraint)) {
          previousSolver.removeConstraint(constraint);
        }
      }
    }
    this.#solver = solver;
    if (this.#layoutMarginsGuide !== null) {
      this.#layoutMarginsGuide.setSolver(solver);
    }
    if (solver !== null) {
      for (const constraint of this.#intrinsicConstraints) {
        solver.addConstraint(constraint);
      }
      for (const constraint of this.#intrinsicSizeConstraints) {
        solver.addConstraint(constraint);
      }
      for (const constraint of this.#userConstraints) {
        solver.addConstraint(constraint);
      }
      for (const constraint of this.#layoutMarginsGuideConstraints) {
        solver.addConstraint(constraint);
      }
    }
  }
  //==============================================================================
  // 솔버 반환.
  //==============================================================================
  /**
   * @returns { LayoutSolver | null }
   */
  getSolver() {
    return this.#solver;
  }
  //==============================================================================
  // 사용자 제약 추가. 솔버에 즉시 등록.
  //==============================================================================
  /**
   * @param { LayoutConstraint } constraint
   */
  addConstraint(constraint) {
    this.#userConstraints.push(constraint);
    const solver = this.getSolver();
    if (solver !== null) {
      solver.addConstraint(constraint);
    }
  }
  //==============================================================================
  // 사용자 제약 제거. 솔버에서도 제거.
  //==============================================================================
  /**
   * @param { LayoutConstraint } constraint
   */
  removeConstraint(constraint) {
    const index = this.#userConstraints.indexOf(constraint);
    if (index >= 0) {
      this.#userConstraints.splice(index, 1);
    }
    const solver = this.getSolver();
    if (solver !== null && solver.hasConstraint(constraint)) {
      solver.removeConstraint(constraint);
    }
  }
  //==============================================================================
  // 등록된 사용자 제약 목록 반환. (사본)
  //==============================================================================
  /**
   * @returns { LayoutConstraint[] }
   */
  getConstraints() {
    return this.#userConstraints.slice();
  }
  //==============================================================================
  // 좌측 변수 반환. (식 외 용도로 raw LayoutVariable 이 필요할 때)
  //==============================================================================
  /**
   * @returns { LayoutVariable }
   */
  getLeftVariable() {
    return this.#leftVariable;
  }
  //==============================================================================
  // 우측 변수 반환.
  //==============================================================================
  /**
   * @returns { LayoutVariable }
   */
  getRightVariable() {
    return this.#rightVariable;
  }
  //==============================================================================
  // 상단 변수 반환.
  //==============================================================================
  /**
   * @returns { LayoutVariable }
   */
  getTopVariable() {
    return this.#topVariable;
  }
  //==============================================================================
  // 하단 변수 반환.
  //==============================================================================
  /**
   * @returns { LayoutVariable }
   */
  getBottomVariable() {
    return this.#bottomVariable;
  }
  //==============================================================================
  // 너비 변수 반환.
  //==============================================================================
  /**
   * @returns { LayoutVariable }
   */
  getWidthVariable() {
    return this.#widthVariable;
  }
  //==============================================================================
  // 높이 변수 반환.
  //==============================================================================
  /**
   * @returns { LayoutVariable }
   */
  getHeightVariable() {
    return this.#heightVariable;
  }
  //==============================================================================
  // 가로 중심 변수 반환.
  //==============================================================================
  /**
   * @returns { LayoutVariable }
   */
  getCenterXVariable() {
    return this.#centerXVariable;
  }
  //==============================================================================
  // 세로 중심 변수 반환.
  //==============================================================================
  /**
   * @returns { LayoutVariable }
   */
  getCenterYVariable() {
    return this.#centerYVariable;
  }
  //==============================================================================
  // 좌측 앵커 식 반환. (UIKit 의 leftAnchor 와 같은 사상)
  // - 사용자 제약 작성 시 호출 — 새 LayoutExpression 인스턴스를 매 호출마다 반환.
  //   add / subtract / multiply / divide 가 불변이라 매번 새로 만들어도 안전.
  //==============================================================================
  /**
   * @returns { LayoutExpression }
   */
  get leftAnchor() {
    return LayoutExpression.fromVariable(this.#leftVariable);
  }
  //==============================================================================
  // 우측 앵커 식 반환. (UIKit 의 rightAnchor 와 같은 사상)
  //==============================================================================
  /**
   * @returns { LayoutExpression }
   */
  get rightAnchor() {
    return LayoutExpression.fromVariable(this.#rightVariable);
  }
  //==============================================================================
  // 상단 앵커 식 반환. (UIKit 의 topAnchor 와 같은 사상)
  //==============================================================================
  /**
   * @returns { LayoutExpression }
   */
  get topAnchor() {
    return LayoutExpression.fromVariable(this.#topVariable);
  }
  //==============================================================================
  // 하단 앵커 식 반환. (UIKit 의 bottomAnchor 와 같은 사상)
  //==============================================================================
  /**
   * @returns { LayoutExpression }
   */
  get bottomAnchor() {
    return LayoutExpression.fromVariable(this.#bottomVariable);
  }
  //==============================================================================
  // 너비 앵커 식 반환. (UIKit 의 widthAnchor 와 같은 사상)
  //==============================================================================
  /**
   * @returns { LayoutExpression }
   */
  get widthAnchor() {
    return LayoutExpression.fromVariable(this.#widthVariable);
  }
  //==============================================================================
  // 높이 앵커 식 반환. (UIKit 의 heightAnchor 와 같은 사상)
  //==============================================================================
  /**
   * @returns { LayoutExpression }
   */
  get heightAnchor() {
    return LayoutExpression.fromVariable(this.#heightVariable);
  }
  //==============================================================================
  // 가로 중심 앵커 식 반환. (UIKit 의 centerXAnchor 와 같은 사상)
  //==============================================================================
  /**
   * @returns { LayoutExpression }
   */
  get centerXAnchor() {
    return LayoutExpression.fromVariable(this.#centerXVariable);
  }
  //==============================================================================
  // 세로 중심 앵커 식 반환. (UIKit 의 centerYAnchor 와 같은 사상)
  //==============================================================================
  /**
   * @returns { LayoutExpression }
   */
  get centerYAnchor() {
    return LayoutExpression.fromVariable(this.#centerYVariable);
  }
  //==============================================================================
  // 시작 앵커 식 반환. (UIKit 의 leadingAnchor 와 같은 사상)
  // - LTR 환경에서는 leftAnchor 와 동일. RTL 미지원이라 항상 leftAnchor 를 반환.
  //==============================================================================
  /**
   * @returns { LayoutExpression }
   */
  get leadingAnchor() {
    return this.leftAnchor;
  }
  //==============================================================================
  // 끝 앵커 식 반환. (UIKit 의 trailingAnchor 와 같은 사상)
  // - LTR 환경에서는 rightAnchor 와 동일. RTL 미지원이라 항상 rightAnchor 를 반환.
  //==============================================================================
  /**
   * @returns { LayoutExpression }
   */
  get trailingAnchor() {
    return this.rightAnchor;
  }
  //==============================================================================
  // 첫 번째 baseline 앵커 식 반환. (UIKit 의 firstBaselineAnchor 와 같은 사상)
  // - 텍스트 컨텐트가 없는 일반 UINode 는 topAnchor 와 동일.
  // - UILabel 등 텍스트 노드는 서브클래스가 override 해 ascent 보정.
  //==============================================================================
  /**
   * @virtual
   * @returns { LayoutExpression }
   */
  get firstBaselineAnchor() {
    return this.topAnchor;
  }
  //==============================================================================
  // 마지막 baseline 앵커 식 반환. (UIKit 의 lastBaselineAnchor 와 같은 사상)
  // - 텍스트 컨텐트가 없는 일반 UINode 는 bottomAnchor 와 동일.
  // - UILabel 등 텍스트 노드는 서브클래스가 override 해 descent 보정.
  //==============================================================================
  /**
   * @virtual
   * @returns { LayoutExpression }
   */
  get lastBaselineAnchor() {
    return this.bottomAnchor;
  }
  //==============================================================================
  // 좌측 위치 반환. (LayoutSolver.updateVariables 호출 후 유효)
  //==============================================================================
  /**
   * @returns { number }
   */
  getLeft() {
    return this.#leftVariable.getValue();
  }
  //==============================================================================
  // 우측 위치 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getRight() {
    return this.#rightVariable.getValue();
  }
  //==============================================================================
  // 상단 위치 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getTop() {
    return this.#topVariable.getValue();
  }
  //==============================================================================
  // 하단 위치 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getBottom() {
    return this.#bottomVariable.getValue();
  }
  //==============================================================================
  // 너비 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getWidth() {
    return this.#widthVariable.getValue();
  }
  //==============================================================================
  // 높이 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getHeight() {
    return this.#heightVariable.getValue();
  }
  //==============================================================================
  // 가로 중심 위치 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getCenterX() {
    return this.#centerXVariable.getValue();
  }
  //==============================================================================
  // 세로 중심 위치 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getCenterY() {
    return this.#centerYVariable.getValue();
  }
};
UINode.noIntrinsicMetric = NO_INTRINSIC_METRIC;

// src/core/frame.js
var System23 = globalThis;
var Frame = class extends Object2 {
  static {
    __name(this, "Frame");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @type { HTMLImageElement } */
  #image;
  // 이미지.
  /** @type { Rect } */
  #rect;
  // 이미지 내부 영역.
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @param { HTMLImageElement } image
   * @param { Rect | null } rect
   */
  constructor(image, rect = null) {
    super();
    this.#image = image;
    if (image === null || image === void 0) {
      throw new System23.Error("image is null.");
    }
    if (rect === null || rect === void 0) {
      this.#rect = Rect.create(0, 0, image.width, image.height);
    } else {
      this.#rect = rect;
    }
  }
  //==============================================================================
  // 이미지 반환.
  //==============================================================================
  /**
   * @returns { HTMLImageElement }
   */
  getImage() {
    return this.#image;
  }
  //==============================================================================
  // 이미지 내부 영역 반환.
  //==============================================================================
  /**
   * @returns { Rect }
   */
  getImageRect() {
    return this.#rect;
  }
};

// src/core/animation.js
var Animation = class extends Object2 {
  static {
    __name(this, "Animation");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  // /** @private @type { AnimationClip[] } */ #clips; // 클립 목록.
  /** @private @type { Frame[] } */
  #frames;
  // 프레임 목록.
  /** @private @type { boolean } */
  #isPlaying;
  // 재생 중인지 여부.
  /** @private @type { number } */
  #currentFrameIndex;
  // 현재 프레임 번호.
  /** @private @type { number } */
  #frameTimeCounter;
  /** @private @type { number } */
  #animationSpeed;
  // 애니메이션 속도: 초당 프레임 수.
  /** @private @type { boolean } */
  #isLoop;
  /** @private @type { Function } */
  #onComplete;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.#frames = [];
    this.#currentFrameIndex = 0;
    this.#frameTimeCounter = 0;
    this.#animationSpeed = 10;
    this.#isLoop = true;
    this.#isPlaying = false;
    this.#onComplete = null;
  }
  //==============================================================================
  // 갱신.
  //==============================================================================
  /**
   * @param { number } timeDelta 
   */
  tick(timeDelta) {
    if (!this.#isPlaying || this.#frames.length === 0 || this.#animationSpeed <= 0) {
      return;
    }
    const frameDuration = 1 / this.#animationSpeed;
    this.#frameTimeCounter += timeDelta;
    if (this.#frameTimeCounter >= frameDuration) {
      const framesToAdvance = Math.floor(this.#frameTimeCounter / frameDuration);
      this.#frameTimeCounter %= frameDuration;
      this.#currentFrameIndex += framesToAdvance;
      if (this.#currentFrameIndex >= this.#frames.length) {
        if (this.#isLoop) {
          this.#currentFrameIndex %= this.#frames.length;
        } else {
          this.#currentFrameIndex = this.#frames.length - 1;
          this.#isPlaying = false;
          if (this.#onComplete) {
            this.#onComplete();
          }
        }
      }
    }
  }
  //==============================================================================
  // 재생.
  //==============================================================================
  play() {
    const isPlaying = this.isPlaying();
    if (isPlaying) {
      return;
    }
    this.#isPlaying = true;
  }
  //==============================================================================
  // 일시정지.
  //==============================================================================
  pause() {
  }
  //==============================================================================
  // 재개.
  //==============================================================================
  resume() {
  }
  //==============================================================================
  // 정지.
  //==============================================================================
  stop() {
    const isPlaying = this.isPlaying();
    if (!isPlaying) {
      return;
    }
    this.#isPlaying = false;
    this.#currentFrameIndex = 0;
    this.#frameTimeCounter = 0;
  }
  //==============================================================================
  // 프레임 설정.
  //==============================================================================
  /**
   * @param { Frame[] } frames
   */
  setFrames(frames) {
    if (frames === null || frames === void 0 || frames instanceof Array === false) {
      return;
    }
    this.#frames = frames;
    this.stop();
  }
  //==============================================================================
  // 프레임 설정. (낱장의 스프라이트 이미지 목록)
  //==============================================================================
  /**
   * @param { HTMLImageElement[] } images
   */
  setFramesFromImages(images) {
    if (images === null || images === void 0 || images instanceof Array === false || images.length === 0) {
      return;
    }
    const frames = images.map((image) => new Frame(image));
    this.setFrames(frames);
  }
  //==============================================================================
  // 프레임 설정. (스프라이트 시트)
  //==============================================================================
  /**
   * @param { HTMLImageElement } image
   * @param { Rect[] } rects
   */
  setFramesFromRects(image, rects) {
    if (image === null || image === void 0 || image instanceof HTMLImageElement === false || rects === null || rects === void 0 || rects instanceof Array === false || rects.length === 0) {
      return;
    }
    const frames = rects.map((rect) => new Frame(image, rect));
    this.setFrames(frames);
  }
  //==============================================================================
  // 초당 프레임 숫 설정.
  // - 예) 60으로 지정시 초당 이미지 60회 변경됨.
  //==============================================================================
  /**
   * @param { number } animationSpeed 
   */
  setAnimationSpeed(animationSpeed) {
    this.#animationSpeed = animationSpeed;
  }
  //==============================================================================
  // 반복 여부 설정.
  //==============================================================================
  /**
   * @param { boolean } value 
   */
  setLoop(value) {
    this.#isLoop = value;
  }
  //==============================================================================
  // 애니메이션 완료 콜백 설정.
  //==============================================================================
  /**
   * @param { Function } callback 
   */
  setOnComplete(callback) {
    this.#onComplete = callback;
  }
  /**
   * 특정 프레임으로 이동하여 재생합니다.
   * @param { number } index 
   */
  gotoAndPlay(index) {
    this.#currentFrameIndex = Math.max(0, Math.min(index, this.#frames.length - 1));
    this.#frameTimeCounter = 0;
    this.play();
  }
  /**
   * 특정 프레임으로 이동하여 정지합니다.
   * @param { number } index 
   */
  gotoAndStop(index) {
    this.#currentFrameIndex = Math.max(0, Math.min(index, this.#frames.length - 1));
    this.#frameTimeCounter = 0;
    this.pause();
  }
  //==============================================================================
  // 재생 중인지 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isPlaying() {
    return this.#isPlaying;
  }
  //==============================================================================
  // 현재 프레임 반환.
  //==============================================================================
  /**
   * @returns { Frame }
   */
  getCurrentFrame() {
    return this.#frames[this.#currentFrameIndex] || null;
  }
  //==============================================================================
  // 현재 이미지 반환.
  //==============================================================================
  /**
   * @returns { HTMLImageElement }
   */
  getCurrentImage() {
    const frame = this.getCurrentFrame();
    return frame ? frame.getImage() : null;
  }
  //==============================================================================
  // 현재 영역 반환.
  //==============================================================================
  getCurrentRect() {
    const frame = this.getCurrentFrame();
    return frame ? frame.getImageRect() : null;
  }
  //==============================================================================
  // 현재 프레임 번호 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getCurrentFrameIndex() {
    return this.#currentFrameIndex;
  }
  //==============================================================================
  // 모든 프레임 수 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getTotalFrameCount() {
    return this.#frames.length;
  }
};

// src/resource/imageasset.js
var System24 = globalThis;
var ImageAsset2 = class extends Asset {
  static {
    __name(this, "ImageAsset");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @type { HTMLImageElement } */
  image = null;
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.setAssetType(AssetType.image);
    this.image = new System24.window.Image();
  }
  //==============================================================================
  // 비동기 애셋 로드.
  //==============================================================================
  /**
   * @override
   * @param { string } assetPath 
   */
  async load(assetPath) {
    const isLoaded = this.isLoaded();
    if (isLoaded) {
      return Promise.resolve();
    }
    await super.load(assetPath);
    this.image = new System24.window.Image();
    this.image.src = assetPath;
    await new Promise((resolve, reject) => {
      this.image.onload = () => {
        this.setLoaded(true);
        resolve();
      };
      this.image.onerror = () => {
        reject(new Error(`Load fail: ${assetPath}`));
      };
    });
  }
  //==============================================================================
  // 이미지 반환.
  //==============================================================================
  /**
   * @returns { HTMLImageElement }
   */
  getImage() {
    return this.image;
  }
  //==============================================================================
  // 이미지 크기 반환.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  getImageSize() {
    return Vector2.create(this.image.width, this.image.height);
  }
};

// src/core/component/sprite.js
var SpriteDrawMode = {
  simple: "simple",
  sliced: "sliced",
  tiled: "tiled"
};
var SpriteBlendMode = {
  normal: "source-over",
  // 기본 알파 합성.
  sourceIn: "source-in",
  // 교차 영역만 출력 (배경 알파 마스크).
  sourceOut: "source-out",
  // 교차 외 영역만 출력.
  sourceAtop: "source-atop",
  // 배경 위에 교차 영역만 합성.
  destinationOver: "destination-over",
  // 배경 아래에 합성.
  destinationIn: "destination-in",
  // 배경에서 교차 영역만 유지.
  destinationOut: "destination-out",
  // 배경에서 교차 외 영역만 유지.
  destinationAtop: "destination-atop",
  // 배경 위에 교차 영역만 유지.
  lighter: "lighter",
  // 색상 덧셈 (Add).
  copy: "copy",
  // 소스만 출력 (배경 무시).
  xor: "xor",
  // 교차 영역 제외.
  multiply: "multiply",
  // 곱셈 합성 (어두워짐).
  screen: "screen",
  // 스크린 합성 (밝아짐).
  overlay: "overlay",
  // 오버레이 (명암 강조).
  darken: "darken",
  // 어두운 픽셀 선택.
  lighten: "lighten",
  // 밝은 픽셀 선택.
  colorDodge: "color-dodge",
  // 컬러 닷지 (밝아짐).
  colorBurn: "color-burn",
  // 컬러 번 (어두워짐).
  hardLight: "hard-light",
  // 하드 라이트.
  softLight: "soft-light",
  // 소프트 라이트.
  difference: "difference",
  // 차이값 합성.
  exclusion: "exclusion",
  // 차이값 합성 (낮은 대비).
  hue: "hue",
  // 색조만 적용.
  saturation: "saturation",
  // 채도만 적용.
  color: "color",
  // 색조+채도 적용.
  luminosity: "luminosity"
  // 밝기만 적용.
};
var Sprite = class extends Paint {
  static {
    __name(this, "Sprite");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { HTMLImageElement } */
  #image;
  /** @private @type { Rect } */
  #imageRect;
  /** @private @type { boolean } */
  #isHorizontalFlip;
  /** @private @type { boolean } */
  #isVerticalFlip;
  /** @private @type { string } */
  #spriteDrawMode;
  /** @private @type { string } */
  #spriteBlendMode;
  /** @private @type { Rect } */
  #nineSlice;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @construct
   */
  constructor() {
    super();
    this.setComponentType("Sprite");
    this.#image = null;
    this.#imageRect = Rect.zero();
    this.#isHorizontalFlip = false;
    this.#isVerticalFlip = false;
    this.#spriteDrawMode = SpriteDrawMode.simple;
    this.#spriteBlendMode = SpriteBlendMode.normal;
    this.#nineSlice = Rect.zero();
    super.setColor(Color.transparent());
  }
  //==============================================================================
  // 갱신.
  //==============================================================================
  /**
   * @param { number } timeDelta
   */
  tick(timeDelta) {
    super.tick(timeDelta);
  }
  //==============================================================================
  // 출력.
  //==============================================================================
  /**
   * @param { Graphic } graphic
   */
  draw(graphic) {
    const image = this.getImage();
    const color = super.getColor();
    if (image === null || image === void 0) {
      super.draw(graphic);
      return;
    }
    const node = this.getNode();
    if (!node) return;
    const position = Vector2.zero();
    const contentSize = node.getContentSize();
    const flip = this.getFlip();
    const imageSize = contentSize.multiply(flip);
    const spriteBlendMode = this.getSpriteBlendMode();
    const spriteDrawMode = this.getSpriteDrawMode();
    if (spriteDrawMode === SpriteDrawMode.sliced) {
      const nineSlice = this.getNineSlice();
      const left = nineSlice.position.x;
      const top = nineSlice.position.y;
      const right = nineSlice.size.x;
      const bottom = nineSlice.size.y;
      if (contentSize.x < left + right || contentSize.y < top + bottom) {
        return;
      }
    }
    graphic.setBlendMode(spriteBlendMode);
    if (color.alpha > 0) {
      graphic.setImageTintColor(color);
    }
    switch (spriteDrawMode) {
      case SpriteDrawMode.simple: {
        let imageRect = this.getImageRect();
        if (imageRect === null || imageRect === void 0 || imageRect.equals(Rect.zero())) {
          imageRect = Rect.create(0, 0, image.width, image.height);
        }
        graphic.drawImageWithImageRect(image, position, imageSize, imageRect);
        break;
      }
      case SpriteDrawMode.sliced: {
        const nineSlice = this.getNineSlice();
        graphic.drawImageWithNineSlice(image, position, imageSize, nineSlice);
        break;
      }
      case SpriteDrawMode.tiled: {
        let imageRect = this.getImageRect();
        if (imageRect === null || imageRect === void 0 || imageRect.equals(Rect.zero())) {
          imageRect = Rect.create(0, 0, image.width, image.height);
        }
        const tileWidth = ceil(imageRect.width);
        const tileHeight = ceil(imageRect.height);
        const fillWidth = abs(imageSize.x);
        const fillHeight = abs(imageSize.y);
        graphic.pushState();
        graphic.translate(position.x, position.y);
        graphic.beginClipRect(Rect.create(0, 0, fillWidth, fillHeight));
        for (let ty = 0; ty < fillHeight; ty += tileHeight) {
          for (let tx = 0; tx < fillWidth; tx += tileWidth) {
            graphic.drawImageWithSourceAndDestination(
              image,
              imageRect.position.x,
              imageRect.position.y,
              imageRect.width,
              imageRect.height,
              tx,
              ty,
              tileWidth,
              tileHeight
            );
          }
        }
        graphic.endClipRect();
        graphic.popState();
        break;
      }
    }
    if (color.alpha > 0) {
      graphic.setImageTintColor(null);
    }
    graphic.setBlendMode(SpriteBlendMode.normal);
  }
  //==============================================================================
  // 스프라이트 출력 모드 설정.
  //==============================================================================
  /**
   * @param { string } spriteDrawMode
   */
  setSpriteDrawMode(spriteDrawMode) {
    this.#spriteDrawMode = spriteDrawMode;
  }
  //==============================================================================
  // 스프라이트 출력 모드 반환.
  //==============================================================================
  /**
   * @returns { string }
   */
  getSpriteDrawMode() {
    return this.#spriteDrawMode;
  }
  //==============================================================================
  // 스프라이트 블렌드 모드 설정.
  //==============================================================================
  /**
   * @param { string } spriteBlendMode
   */
  setSpriteBlendMode(spriteBlendMode) {
    this.#spriteBlendMode = spriteBlendMode;
  }
  //==============================================================================
  // 스프라이트 블렌드 모드 반환.
  //==============================================================================
  /**
   * @returns { string }
   */
  getSpriteBlendMode() {
    return this.#spriteBlendMode;
  }
  //==============================================================================
  // 나인슬라이스 영역 설정.
  //==============================================================================
  /**
   * @param { Rect } nineSlice
   */
  setNineSlice(nineSlice) {
    this.#nineSlice = nineSlice;
  }
  //==============================================================================
  // 나인슬라이스 영역 반환.
  //==============================================================================
  /**
   * @returns { Rect }
   */
  getNineSlice() {
    return this.#nineSlice;
  }
  //==============================================================================
  // 이미지 설정.
  //==============================================================================
  /**
   * @param { HTMLImageElement | ImageAsset } image
   */
  setImage(image) {
    if (image === null || image === void 0) {
      this.#image = null;
    } else if (image instanceof HTMLImageElement) {
      this.#image = image;
    } else if (image instanceof ImageAsset2) {
      this.#image = image.image;
    }
  }
  //==============================================================================
  // 이미지 반환.
  //==============================================================================
  /**
   * @returns { HTMLImageElement }
   */
  getImage() {
    return this.#image;
  }
  //==============================================================================
  // 이미지 영역 설정.
  //==============================================================================
  /**
   * @param { Rect } imageRect
   */
  setImageRect(imageRect) {
    this.#imageRect = imageRect;
  }
  //==============================================================================
  // 이미지 영역 반환.
  //==============================================================================
  /**
   * @returns { Rect }
   */
  getImageRect() {
    return this.#imageRect;
  }
  //==============================================================================
  // 이미지 뒤집기 여부 설정.
  //==============================================================================
  /**
   * @param { boolean } flip
   */
  setHorizontalFlip(flip) {
    this.#isHorizontalFlip = flip;
  }
  //==============================================================================
  // 이미지 뒤집기 여부 설정.
  //==============================================================================
  /**
   * @param { boolean } flip
   */
  setVerticalFlip(flip) {
    this.#isVerticalFlip = flip;
  }
  //==============================================================================
  // 이미지 뒤집기 여부 반환.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  isHorizontalFlip() {
    return this.#isHorizontalFlip;
  }
  //==============================================================================
  // 이미지 뒤집기 여부 반환.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  isVerticalFlip() {
    return this.#isVerticalFlip;
  }
  //==============================================================================
  // 이미지 뒤집히는 값 반환.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  getFlip() {
    const isHorizontalFlip = this.isHorizontalFlip();
    const isVerticalFlip = this.isVerticalFlip();
    if (isHorizontalFlip) {
      if (isVerticalFlip) {
        return Vector2.create(-1, -1);
      } else {
        return Vector2.create(-1, 1);
      }
    } else {
      if (isVerticalFlip) {
        return Vector2.create(1, -1);
      } else {
        return Vector2.create(1, 1);
      }
    }
  }
};

// src/core/component/text.js
var System25 = globalThis;
var TextAlign = {
  left: "left",
  center: "center",
  right: "right",
  start: "start",
  end: "end"
};
var TextBaseline = {
  top: "top",
  middle: "middle",
  bottom: "bottom",
  ideographic: "ideographic",
  hanging: "hanging",
  alphabetic: "alphabetic"
};
var measurementCanvasRenderingContext = null;
function getMeasurementCanvasRenderingContext() {
  if (measurementCanvasRenderingContext === null) {
    const document2 = System25.document;
    if (document2 === null || document2 === void 0) {
      return null;
    }
    const canvas = document2.createElement("canvas");
    measurementCanvasRenderingContext = canvas.getContext("2d");
  }
  return measurementCanvasRenderingContext;
}
__name(getMeasurementCanvasRenderingContext, "getMeasurementCanvasRenderingContext");
function buildFontString(fontFace, fontSize, bold, italic) {
  const fontFamily = fontFace ? fontFace.family : SYSTEM_FONT_STRING;
  const styleParts = [];
  if (italic) {
    styleParts.push("italic");
  }
  if (bold) {
    styleParts.push("bold");
  }
  styleParts.push(`${fontSize}px`);
  styleParts.push(fontFamily);
  return styleParts.join(" ");
}
__name(buildFontString, "buildFontString");
var Text = class extends Component {
  static {
    __name(this, "Text");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { FontFace } */
  #fontFace;
  /** @private @type { string } */
  #text;
  /** @private @type { number } */
  #fontSize;
  /** @private @type { Color } */
  #textColor;
  /** @private @type { Color } */
  #strokeColor;
  /** @private @type { number } */
  #strokeWidth;
  /** @private @type { boolean } */
  #bold;
  /** @private @type { boolean } */
  #italic;
  /** @private @type { boolean } */
  #underline;
  /** @private @type { boolean } */
  #strikethrough;
  /** @private @type { string } */
  #textAlign;
  /** @private @type { string } */
  #textBaseline;
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.setComponentType("Text");
    this.#fontFace = null;
    this.#text = "";
    this.#fontSize = 32;
    this.#textColor = Color.white();
    this.#strokeColor = Color.white();
    this.#strokeWidth = 0;
    this.#bold = false;
    this.#italic = false;
    this.#underline = false;
    this.#strikethrough = false;
    this.#textAlign = "center";
    this.#textBaseline = "middle";
  }
  //==============================================================================
  // 갱신.
  //==============================================================================
  /**
   * @override
   * @param { number } timeDelta
   */
  tick(timeDelta) {
    super.tick(timeDelta);
  }
  //==============================================================================
  // 출력. (비활성화면 건너뜀)
  //==============================================================================
  /**
   * @override
   * @param { Graphic } graphic
   */
  draw(graphic) {
    if (this.isEnable() === false) {
      return;
    }
    const text = this.getText();
    if (!text) {
      return;
    }
    const node = this.getNode();
    const contentSize = node.getContentSize();
    this.drawPlainText(graphic, contentSize, text);
  }
  //==============================================================================
  // 일반 텍스트 그리기.
  //==============================================================================
  /**
   * @param { Graphic } graphic
   * @param { Vector2 } contentSize
   * @param { string } text
   */
  drawPlainText(graphic, contentSize, text) {
    let drawX;
    if (this.#textAlign === "left" || this.#textAlign === "start") {
      drawX = 0;
    } else if (this.#textAlign === "right" || this.#textAlign === "end") {
      drawX = contentSize.x;
    } else {
      drawX = contentSize.x * 0.5;
    }
    let drawY;
    if (this.#textBaseline === "top" || this.#textBaseline === "hanging") {
      drawY = 0;
    } else if (this.#textBaseline === "bottom" || this.#textBaseline === "ideographic" || this.#textBaseline === "alphabetic") {
      drawY = contentSize.y;
    } else {
      drawY = contentSize.y * 0.5;
    }
    graphic.setFontString(buildFontString(this.#fontFace, this.#fontSize, this.#bold, this.#italic));
    graphic.setTextAlign(this.#textAlign);
    graphic.setTextBaseline(this.#textBaseline);
    const strokeColor = this.getStrokeColor();
    if (strokeColor && this.#strokeWidth > 0) {
      graphic.setStrokeColor(strokeColor.toHEXString());
      graphic.drawStrokeText(text, drawX, drawY, this.#strokeWidth);
    }
    const textColor = this.getTextColor();
    graphic.setFillColor(textColor.toHEXString());
    graphic.drawFillText(text, drawX, drawY);
    if (this.#underline || this.#strikethrough) {
      const textWidth = this.measurePlainTextWidth(text);
      const startX = this.computeUnderlineStartX(drawX, textWidth);
      const fontSize = this.#fontSize;
      graphic.setStrokeColor(textColor.toHEXString());
      const lineWidth = System25.Math.max(1, fontSize / 16);
      if (this.#underline) {
        const underlineY = drawY + this.computeUnderlineOffsetY(fontSize);
        this.strokeHorizontalLine(graphic, startX, underlineY, textWidth, lineWidth);
      }
      if (this.#strikethrough) {
        const strikeY = drawY + this.computeStrikethroughOffsetY(fontSize);
        this.strokeHorizontalLine(graphic, startX, strikeY, textWidth, lineWidth);
      }
    }
  }
  //==============================================================================
  // 일반 텍스트의 픽셀 너비 측정. (오프스크린 컨텍스트 사용)
  //==============================================================================
  /**
   * @param { string } text
   * @returns { number }
   */
  measurePlainTextWidth(text) {
    const measurementContext = getMeasurementCanvasRenderingContext();
    if (measurementContext === null) {
      return 0;
    }
    measurementContext.save();
    measurementContext.font = buildFontString(this.#fontFace, this.#fontSize, this.#bold, this.#italic);
    const width = measurementContext.measureText(text).width;
    measurementContext.restore();
    return width;
  }
  //==============================================================================
  // 밑줄 시작 X 좌표 계산. (textAlign 기준 캔버스 fillText 의 cursor 위치 보정)
  //==============================================================================
  /**
   * @param { number } drawX
   * @param { number } textWidth
   * @returns { number }
   */
  computeUnderlineStartX(drawX, textWidth) {
    if (this.#textAlign === "left" || this.#textAlign === "start") {
      return drawX;
    }
    if (this.#textAlign === "right" || this.#textAlign === "end") {
      return drawX - textWidth;
    }
    return drawX - textWidth * 0.5;
  }
  //==============================================================================
  // 밑줄 Y 오프셋. (baseline 기준 텍스트 아래쪽으로의 거리)
  //==============================================================================
  /**
   * @param { number } fontSize
   * @returns { number }
   */
  computeUnderlineOffsetY(fontSize) {
    if (this.#textBaseline === "top" || this.#textBaseline === "hanging") {
      return fontSize + 2;
    }
    if (this.#textBaseline === "middle") {
      return fontSize * 0.5 + 2;
    }
    return 4;
  }
  //==============================================================================
  // 취소선 Y 오프셋.
  //==============================================================================
  /**
   * @param { number } fontSize
   * @returns { number }
   */
  computeStrikethroughOffsetY(fontSize) {
    if (this.#textBaseline === "top" || this.#textBaseline === "hanging") {
      return fontSize * 0.55;
    }
    if (this.#textBaseline === "middle") {
      return 0;
    }
    return -fontSize * 0.35;
  }
  //==============================================================================
  // 가로 라인 stroke.
  //==============================================================================
  /**
   * @param { Graphic } graphic
   * @param { number } x
   * @param { number } y
   * @param { number } width
   * @param { number } lineWidth
   */
  strokeHorizontalLine(graphic, x, y, width, lineWidth = 1) {
    graphic.drawLine([
      Vector2.create(x, y),
      Vector2.create(x + width, y)
    ], lineWidth);
  }
  //==============================================================================
  // 텍스트의 자연 크기 반환. (UIKit 의 intrinsicContentSize 와 동일 사상)
  // - 비활성화 상태면 (-1, -1) 반환 (가이드 영향 없음).
  // - 측정 불가 (document 없음 등) 면 (-1, -1).
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  getIntrinsicContentSize() {
    if (this.isEnable() === false) {
      return Vector2.create(-1, -1);
    }
    const measurementContext = getMeasurementCanvasRenderingContext();
    if (measurementContext === null) {
      return Vector2.create(-1, -1);
    }
    const text = this.#text;
    if (!text || text.length === 0) {
      return Vector2.create(0, this.#fontSize);
    }
    measurementContext.save();
    measurementContext.font = buildFontString(this.#fontFace, this.#fontSize, this.#bold, this.#italic);
    const width = measurementContext.measureText(text).width;
    measurementContext.restore();
    return Vector2.create(width, this.#fontSize);
  }
  //==============================================================================
  // 폰트 설정.
  //==============================================================================
  /**
   * @param { FontFace | FontAsset } font
   */
  setFont(font) {
    if (font === null || font === void 0) {
      this.#fontFace = null;
    } else if (font instanceof FontFace) {
      this.#fontFace = font;
    } else if (font instanceof FontAsset) {
      this.#fontFace = font.fontFace;
    }
  }
  //==============================================================================
  // 폰트 반환.
  //==============================================================================
  /**
   * @returns { FontFace }
   */
  getFontFace() {
    return this.#fontFace;
  }
  //==============================================================================
  // 텍스트 설정.
  //==============================================================================
  /**
   * @param { string } text
   */
  setText(text) {
    this.#text = text;
  }
  //==============================================================================
  // 텍스트 반환.
  //==============================================================================
  /**
   * @returns { string }
   */
  getText() {
    return this.#text;
  }
  //==============================================================================
  // 텍스트 크기 설정.
  //==============================================================================
  /**
   * @param { number } fontSize
   */
  setFontSize(fontSize) {
    this.#fontSize = fontSize;
  }
  //==============================================================================
  // 텍스트 크기 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getFontSize() {
    return this.#fontSize;
  }
  //==============================================================================
  // 텍스트 색상 설정.
  //==============================================================================
  /**
   * @param { Color | string | CanvasGradient | CanvasPattern } color
   */
  setTextColor(color) {
    if (color === null || color === void 0) {
      this.#textColor = Color.transparent();
    } else if (typeof color === "string") {
      if (color.startsWith("#")) {
        this.#textColor = Color.createFromHEX(color);
      } else if (color.startsWith("rgb")) {
        this.#textColor = Color.createFromRGBA(color);
      }
    } else if (color instanceof Color) {
      this.#textColor = color;
    }
  }
  //==============================================================================
  // 텍스트 색상 반환.
  //==============================================================================
  /**
   * @returns { Color }
   */
  getTextColor() {
    return this.#textColor;
  }
  //==============================================================================
  // 텍스트 외곽선 색상 설정.
  //==============================================================================
  /**
   * @param { Color | string | CanvasGradient | CanvasPattern } color
   */
  setStrokeColor(color) {
    if (color === null || color === void 0) {
      this.#strokeColor = Color.transparent();
    } else if (typeof color === "string") {
      if (color.startsWith("#")) {
        this.#strokeColor = Color.createFromHEX(color);
      } else if (color.startsWith("rgb")) {
        this.#strokeColor = Color.createFromRGBA(color);
      }
    } else if (color instanceof Color) {
      this.#strokeColor = color;
    }
  }
  //==============================================================================
  // 텍스트 외곽선 색상 반환.
  //==============================================================================
  /**
   * @returns { Color }
   */
  getStrokeColor() {
    return this.#strokeColor;
  }
  //==============================================================================
  // 텍스트 외곽선 두께 설정.
  //==============================================================================
  /**
   * @param { number } width
   */
  setStrokeWidth(width) {
    this.#strokeWidth = width;
  }
  //==============================================================================
  // 외곽선 두께 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getStrokeWidth() {
    return this.#strokeWidth;
  }
  //==============================================================================
  // 볼드 여부 설정.
  //==============================================================================
  /**
   * @param { boolean } bold
   */
  setBold(bold) {
    this.#bold = bold === true;
  }
  //==============================================================================
  // 볼드 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isBold() {
    return this.#bold;
  }
  //==============================================================================
  // 이탤릭 여부 설정.
  //==============================================================================
  /**
   * @param { boolean } italic
   */
  setItalic(italic) {
    this.#italic = italic === true;
  }
  //==============================================================================
  // 이탤릭 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isItalic() {
    return this.#italic;
  }
  //==============================================================================
  // 밑줄 여부 설정.
  //==============================================================================
  /**
   * @param { boolean } underline
   */
  setUnderline(underline) {
    this.#underline = underline === true;
  }
  //==============================================================================
  // 밑줄 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isUnderline() {
    return this.#underline;
  }
  //==============================================================================
  // 취소선 여부 설정.
  //==============================================================================
  /**
   * @param { boolean } strikethrough
   */
  setStrikethrough(strikethrough) {
    this.#strikethrough = strikethrough === true;
  }
  //==============================================================================
  // 취소선 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isStrikethrough() {
    return this.#strikethrough;
  }
  //==============================================================================
  // 폰트 가로 정렬 설정.
  //==============================================================================
  /**
   * @param { "left" | "center" | "right" | "start" | "end" } align
   */
  setTextAlign(align) {
    this.#textAlign = align;
  }
  //==============================================================================
  // 폰트 가로 정렬 반환.
  //==============================================================================
  /**
   * @returns { string }
   */
  getTextAlign() {
    return this.#textAlign;
  }
  //==============================================================================
  // 폰트 세로 정렬 설정.
  //==============================================================================
  /**
   * @param { "top" | "middle" | "bottom" | "alphabetic" | "hanging" | "ideographic" } baseline
   */
  setTextBaseline(baseline) {
    this.#textBaseline = baseline;
  }
  //==============================================================================
  // 폰트 세로 정렬 반환.
  //==============================================================================
  /**
   * @returns { string }
   */
  getTextBaseline() {
    return this.#textBaseline;
  }
  //==============================================================================
  // 텍스트가 출력되는 영역을 Rect로 반환. (호환용)
  //==============================================================================
  /**
   * @param { Graphic } graphic
   * @param { Text } textComponent
   * @returns { Rect }
   */
  static calculateTextBounds(graphic, textComponent) {
    const fontFace = textComponent.getFontFace();
    const fontSize = textComponent.getFontSize();
    const text = textComponent.getText();
    const measurementContext = getMeasurementCanvasRenderingContext();
    if (measurementContext === null) {
      return Rect.create(0, 0, 0, 0);
    }
    measurementContext.save();
    measurementContext.font = buildFontString(fontFace, fontSize, false, false);
    const metrics = measurementContext.measureText(text);
    const width = metrics.width;
    const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    measurementContext.restore();
    return Rect.create(0, 0, width, height);
  }
};

// src/core/component/richtext.js
var System26 = globalThis;
var NAMED_COLORS = {
  red: "#ff0000",
  green: "#00ff00",
  blue: "#0000ff",
  white: "#ffffff",
  black: "#000000",
  yellow: "#ffff00",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  gray: "#808080",
  grey: "#808080",
  orange: "#ffa500",
  purple: "#800080",
  brown: "#a52a2a",
  pink: "#ffc0cb",
  silver: "#c0c0c0",
  maroon: "#800000",
  olive: "#808000",
  navy: "#000080",
  teal: "#008080",
  lime: "#00ff00",
  aqua: "#00ffff",
  fuchsia: "#ff00ff"
};
function parseColorValue2(value) {
  if (value === null || value === void 0) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.startsWith("#")) {
    return Color.createFromHEX(trimmed);
  }
  const lowered = trimmed.toLowerCase();
  const namedHex = NAMED_COLORS[lowered];
  if (namedHex !== void 0) {
    return Color.createFromHEX(namedHex);
  }
  return null;
}
__name(parseColorValue2, "parseColorValue");
function buildAttributesForTag(tagName, value) {
  switch (tagName) {
    case "color": {
      const textColor = parseColorValue2(value);
      if (textColor === null) {
        return null;
      }
      return { textColor };
    }
    case "size": {
      const trimmed = value !== void 0 && value !== null ? value.trim() : "";
      const fontSize = System26.parseInt(trimmed, 10);
      if (System26.Number.isFinite(fontSize) === false || fontSize <= 0) {
        return null;
      }
      return { fontSize };
    }
    case "b": {
      return { bold: true };
    }
    case "i": {
      return { italic: true };
    }
    case "u": {
      return { underline: true };
    }
    case "s": {
      return { strikethrough: true };
    }
    default: {
      return null;
    }
  }
}
__name(buildAttributesForTag, "buildAttributesForTag");
function mergeAttributeStack(stack) {
  const result = {};
  for (const attributes of stack) {
    for (const key of System26.Object.keys(attributes)) {
      if (key === "__tagName") {
        continue;
      }
      result[key] = attributes[key];
    }
  }
  return result;
}
__name(mergeAttributeStack, "mergeAttributeStack");
function parseMarkupToSegments(input) {
  if (input === null || input === void 0 || input.length === 0) {
    return null;
  }
  if (input.indexOf("<") === -1) {
    return null;
  }
  const tagRegex = /<(\/?)([a-zA-Z]+)(?:=([^>]+))?>/g;
  const segments = [];
  const stack = [];
  let lastIndex = 0;
  let match;
  let foundKnownTag = false;
  while ((match = tagRegex.exec(input)) !== null) {
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;
    const isClose = match[1] === "/";
    const tagName = match[2].toLowerCase();
    const tagValue = match[3];
    const precedingText = input.substring(lastIndex, matchStart);
    if (precedingText.length > 0) {
      segments.push({ text: precedingText, attributes: mergeAttributeStack(stack) });
    }
    if (isClose) {
      for (let stackIndex = stack.length - 1; stackIndex >= 0; --stackIndex) {
        if (stack[stackIndex].__tagName === tagName) {
          stack.splice(stackIndex, 1);
          foundKnownTag = true;
          break;
        }
      }
      lastIndex = matchEnd;
      continue;
    }
    const tagAttributes = buildAttributesForTag(tagName, tagValue);
    if (tagAttributes === null) {
      segments.push({ text: match[0], attributes: mergeAttributeStack(stack) });
      lastIndex = matchEnd;
      continue;
    }
    tagAttributes.__tagName = tagName;
    stack.push(tagAttributes);
    foundKnownTag = true;
    lastIndex = matchEnd;
  }
  const trailingText = input.substring(lastIndex);
  if (trailingText.length > 0) {
    segments.push({ text: trailingText, attributes: mergeAttributeStack(stack) });
  }
  if (foundKnownTag === false) {
    return null;
  }
  return segments;
}
__name(parseMarkupToSegments, "parseMarkupToSegments");
var RichText = class extends Text {
  static {
    __name(this, "RichText");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { { text: string, attributes: object }[] } */
  #segments;
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.setComponentType("RichText");
    this.#segments = [];
  }
  //==============================================================================
  // 텍스트 설정 — 마크업 자동 파싱.
  // - 알려진 태그가 있으면 segment 배열로 분해해 보관.
  // - 마크업이 없으면 segment 비우고 plain text 동작으로 fallback.
  //==============================================================================
  /**
   * @override
   * @param { string } text
   */
  setText(text) {
    super.setText(text);
    const parsed = parseMarkupToSegments(text);
    this.#segments = parsed !== null ? parsed : [];
  }
  //==============================================================================
  // segment 1 개 추가. (편의 API — 마크업 외에 프로그래밍 방식으로 segment 쌓기)
  //==============================================================================
  /**
   * @param { string } text
   * @param { object } [attributes]
   * @returns { RichText }
   */
  appendSegment(text, attributes) {
    const finalAttributes = attributes !== null && attributes !== void 0 ? attributes : {};
    this.#segments.push({ text, attributes: finalAttributes });
    return this;
  }
  //==============================================================================
  // segment 모두 제거.
  //==============================================================================
  clearSegments() {
    this.#segments = [];
  }
  //==============================================================================
  // segment 목록 반환. (사본)
  //==============================================================================
  /**
   * @returns { { text: string, attributes: object }[] }
   */
  getSegments() {
    return this.#segments.slice();
  }
  //==============================================================================
  // segment 보유 여부.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  hasSegments() {
    const segments = this.#segments;
    if (segments.length === 0) {
      return false;
    }
    for (const segment of segments) {
      if (segment.text && segment.text.length > 0) {
        return true;
      }
    }
    return false;
  }
  //==============================================================================
  // 출력. (비활성화면 건너뜀, segment 가 비어있으면 부모의 plain text 동작)
  //==============================================================================
  /**
   * @override
   * @param { Graphic } graphic
   */
  draw(graphic) {
    if (this.isEnable() === false) {
      return;
    }
    if (this.hasSegments() === false) {
      super.draw(graphic);
      return;
    }
    const node = this.getNode();
    const contentSize = node.getContentSize();
    this.drawSegments(graphic, contentSize);
  }
  //==============================================================================
  // segment 별로 폰트 / 색 / 스타일을 적용해 좌→우 누적 그리기.
  // - 정렬 / baseline 은 합산 폭 / 최대 폰트 크기 기준.
  //==============================================================================
  /**
   * @param { Graphic } graphic
   * @param { Vector2 } contentSize
   */
  drawSegments(graphic, contentSize) {
    const segments = this.#segments;
    const fallbackFontFace = this.getFontFace();
    const fallbackFontSize = this.getFontSize();
    const fallbackTextColor = this.getTextColor();
    const fallbackStrokeColor = this.getStrokeColor();
    const fallbackStrokeWidth = this.getStrokeWidth();
    const fallbackBold = this.isBold();
    const fallbackItalic = this.isItalic();
    const fallbackUnderline = this.isUnderline();
    const fallbackStrikethrough = this.isStrikethrough();
    const textAlign = this.getTextAlign();
    const textBaseline = this.getTextBaseline();
    let totalWidth = 0;
    let maxFontSize = 0;
    for (const segment of segments) {
      const segmentText = segment.text;
      if (!segmentText || segmentText.length === 0) {
        continue;
      }
      const segmentFontSize = typeof segment.attributes.fontSize === "number" ? segment.attributes.fontSize : fallbackFontSize;
      const segmentFontFace = this.resolveSegmentFontFace(segment.attributes.fontFace, fallbackFontFace);
      const segmentBold = segment.attributes.bold === true || fallbackBold;
      const segmentItalic = segment.attributes.italic === true || fallbackItalic;
      graphic.setFontString(buildFontString(segmentFontFace, segmentFontSize, segmentBold, segmentItalic));
      totalWidth += graphic.measureText(segmentText).width;
      if (segmentFontSize > maxFontSize) {
        maxFontSize = segmentFontSize;
      }
    }
    let cursorX;
    if (textAlign === "left" || textAlign === "start") {
      cursorX = 0;
    } else if (textAlign === "right" || textAlign === "end") {
      cursorX = contentSize.x - totalWidth;
    } else {
      cursorX = (contentSize.x - totalWidth) * 0.5;
    }
    let baselineY;
    if (textBaseline === "top" || textBaseline === "hanging") {
      baselineY = 0;
    } else if (textBaseline === "bottom" || textBaseline === "ideographic" || textBaseline === "alphabetic") {
      baselineY = contentSize.y;
    } else {
      baselineY = contentSize.y * 0.5;
    }
    graphic.setTextAlign("left");
    graphic.setTextBaseline(textBaseline);
    for (const segment of segments) {
      const segmentText = segment.text;
      if (!segmentText || segmentText.length === 0) {
        continue;
      }
      const segmentFontSize = typeof segment.attributes.fontSize === "number" ? segment.attributes.fontSize : fallbackFontSize;
      const segmentFontFace = this.resolveSegmentFontFace(segment.attributes.fontFace, fallbackFontFace);
      const segmentTextColor = segment.attributes.textColor instanceof Color ? segment.attributes.textColor : fallbackTextColor;
      const segmentStrokeColor = segment.attributes.strokeColor instanceof Color ? segment.attributes.strokeColor : fallbackStrokeColor;
      const segmentStrokeWidth = typeof segment.attributes.strokeWidth === "number" ? segment.attributes.strokeWidth : fallbackStrokeWidth;
      const segmentBold = segment.attributes.bold === true || fallbackBold;
      const segmentItalic = segment.attributes.italic === true || fallbackItalic;
      const segmentUnderline = segment.attributes.underline === true || fallbackUnderline;
      const segmentStrikethrough = segment.attributes.strikethrough === true || fallbackStrikethrough;
      graphic.setFontString(buildFontString(segmentFontFace, segmentFontSize, segmentBold, segmentItalic));
      if (segmentStrokeColor && segmentStrokeWidth > 0) {
        graphic.setStrokeColor(segmentStrokeColor.toHEXString());
        graphic.drawStrokeText(segmentText, cursorX, baselineY, segmentStrokeWidth);
      }
      graphic.setFillColor(segmentTextColor.toHEXString());
      graphic.drawFillText(segmentText, cursorX, baselineY);
      const segmentWidth = graphic.measureText(segmentText).width;
      const segmentLineWidth = System26.Math.max(1, segmentFontSize / 16);
      if (segmentUnderline) {
        const underlineY = baselineY + this.computeUnderlineOffsetY(segmentFontSize);
        graphic.setStrokeColor(segmentTextColor.toHEXString());
        this.strokeHorizontalLine(graphic, cursorX, underlineY, segmentWidth, segmentLineWidth);
      }
      if (segmentStrikethrough) {
        const strikeY = baselineY + this.computeStrikethroughOffsetY(segmentFontSize);
        graphic.setStrokeColor(segmentTextColor.toHEXString());
        this.strokeHorizontalLine(graphic, cursorX, strikeY, segmentWidth, segmentLineWidth);
      }
      cursorX += segmentWidth;
    }
  }
  //==============================================================================
  // segment 의 fontFace 입력값을 해석해 적용 가능한 FontFace 로 변환.
  //==============================================================================
  /**
   * @param { FontFace | FontAsset | null | undefined } input
   * @param { FontFace | null } fallback
   * @returns { FontFace | null }
   */
  resolveSegmentFontFace(input, fallback) {
    if (input === null || input === void 0) {
      return fallback;
    }
    if (input instanceof FontAsset) {
      return input.fontFace;
    }
    return input;
  }
  //==============================================================================
  // 텍스트의 자연 크기 반환.
  // - segment 가 있으면 segment 합산 폭 + 최대 폰트 크기.
  // - 없으면 부모 (Text) 의 plain text 측정.
  //==============================================================================
  /**
   * @override
   * @returns { Vector2 }
   */
  getIntrinsicContentSize() {
    if (this.isEnable() === false) {
      return Vector2.create(-1, -1);
    }
    if (this.hasSegments() === false) {
      return super.getIntrinsicContentSize();
    }
    const measurementContext = getMeasurementCanvasRenderingContext();
    if (measurementContext === null) {
      return Vector2.create(-1, -1);
    }
    const fallbackFontFace = this.getFontFace();
    const fallbackFontSize = this.getFontSize();
    const fallbackBold = this.isBold();
    const fallbackItalic = this.isItalic();
    let totalWidth = 0;
    let maxFontSize = 0;
    for (const segment of this.#segments) {
      const segmentText = segment.text;
      if (!segmentText || segmentText.length === 0) {
        continue;
      }
      const segmentFontSize = typeof segment.attributes.fontSize === "number" ? segment.attributes.fontSize : fallbackFontSize;
      const segmentFontFace = this.resolveSegmentFontFace(segment.attributes.fontFace, fallbackFontFace);
      const segmentBold = segment.attributes.bold === true || fallbackBold;
      const segmentItalic = segment.attributes.italic === true || fallbackItalic;
      measurementContext.save();
      measurementContext.font = buildFontString(segmentFontFace, segmentFontSize, segmentBold, segmentItalic);
      totalWidth += measurementContext.measureText(segmentText).width;
      measurementContext.restore();
      if (segmentFontSize > maxFontSize) {
        maxFontSize = segmentFontSize;
      }
    }
    if (maxFontSize === 0) {
      maxFontSize = fallbackFontSize;
    }
    return Vector2.create(totalWidth, maxFontSize);
  }
};

// src/misc/localstorage.js
var System27 = globalThis;
var LocalStorage = class _LocalStorage extends Object2 {
  static {
    __name(this, "LocalStorage");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
  }
  //==============================================================================
  // 전체 제거.
  //==============================================================================
  static clear() {
    System27.window.localStorage.clear();
  }
  //==============================================================================
  // 문자열 값 설정.
  //==============================================================================
  /**
   * @param { string } key 
   * @param { string } stringValue
   */
  static setString(key, stringValue) {
    System27.window.localStorage.setItem(key, stringValue);
  }
  //==============================================================================
  // 논리 값 설정.
  //==============================================================================
  /**
   * @param { string } key 
   * @param { boolean } booleanValue
   */
  static setBoolean(key, booleanValue) {
    _LocalStorage.setString(key, booleanValue ? "true" : "false");
  }
  //==============================================================================
  // 숫자 값 설정.
  //==============================================================================
  /**
   * @param { string } key 
   * @param { number } numberValue
   */
  static setNumber(key, numberValue) {
    _LocalStorage.setString(key, String(numberValue));
  }
  //==============================================================================
  // 값 제거.
  //==============================================================================
  /**
   * @param { string } key 
   */
  static remove(key) {
    System27.window.localStorage.removeItem(key);
  }
  //==============================================================================
  // 문자열 값 반환.
  //==============================================================================
  /**
   * @param { string } key 
   * @param { string } defaultStringValue 
   * @returns { string }
   */
  static getString(key, defaultStringValue = "") {
    const value = System27.window.localStorage.getItem(key);
    if (value === null || value === void 0) {
      _LocalStorage.setString(key, defaultStringValue);
      return defaultStringValue;
    }
    return value;
  }
  //==============================================================================
  // 논리 값 반환.
  //==============================================================================
  /**
   * @param { string } key 
   * @param { boolean } defaultBooleanValue 
   * @returns { boolean }
   */
  static getBoolean(key, defaultBooleanValue = false) {
    const stringValue = _LocalStorage.getString(key);
    if (stringValue === "") {
      _LocalStorage.setBoolean(key, defaultBooleanValue);
      return defaultBooleanValue;
    } else {
      return stringValue === "true";
    }
  }
  //==============================================================================
  // 숫자 값 반환.
  //==============================================================================
  /**
   * @param { string } key 
   * @param { number } defaultNumberValue 
   * @returns { number }
   */
  static getNumber(key, defaultNumberValue = 0) {
    const stringValue = _LocalStorage.getString(key);
    if (stringValue === "") {
      _LocalStorage.setNumber(key, defaultNumberValue);
      return defaultNumberValue;
    } else {
      return Number(stringValue);
    }
  }
  //==============================================================================
  // 존재 여부 반환.
  //==============================================================================
  /**
   * @param { string } key 
   * @returns { boolean }
   */
  static containsKey(key) {
    return System27.window.localStorage.getItem(key) !== null;
  }
  //==============================================================================
  // 모든 키 반환.
  //==============================================================================
  /**
   * @returns { string[] }
   */
  static getKeys() {
    const keys = [];
    for (let i = 0; i < System27.window.localStorage.length; ++i) {
      const key = System27.window.localStorage.key(i);
      keys.push(key);
    }
    keys.sort();
    return keys;
  }
};

// src/misc/devtools.js
var System28 = globalThis;
var TITLE_HEIGHT = 28;
var TAB_HEIGHT = 24;
var ITEM_HEIGHT = 20;
var INDENT_WIDTH = 14;
var SCROLL_BAR_WIDTH = 6;
var GIZMO_CHECKBOX_SIZE = 12;
var GIZMO_CHECKBOX_MARGIN = 4;
var FONT_SIZE = 12;
var PADDING = 7;
var LABEL_COLUMN_WIDTH = 144;
var RESIZE_HANDLE_SIZE = 10;
var SPLITTER_HIT_SIZE = 8;
var MIN_PANEL_WIDTH = 300;
var MIN_PANEL_HEIGHT = 200;
var MIN_LEFT_WIDTH = 80;
var TABS = ["Statistics", "Node Hierarchy", "Local Storage", "Settings"];
var DEFAULT_PANEL_WIDTH = 810;
var DEFAULT_PANEL_HEIGHT = 520;
var DEFAULT_LEFT_WIDTH = 405;
var SETTINGS_STORAGE_KEY = "hierarchy.settings";
var COLOR_BACKGROUND = "rgba(22, 18, 12, 0.97)";
var COLOR_TITLE_BACKGROUND = "rgba(40, 32, 18, 1)";
var COLOR_BORDER_NORMAL = "rgba(110, 88, 50, 1)";
var COLOR_BORDER_ACTIVE = "rgba(212, 180, 106, 0.9)";
var COLOR_SPLITTER = "rgba(75, 60, 35, 1)";
var COLOR_SPLITTER_ACTIVE = "rgba(212, 180, 106, 0.85)";
var COLOR_ITEM_SELECTED = "rgba(120, 90, 35, 0.85)";
var COLOR_SECTION_HEADER_BACKGROUND = "rgba(48, 38, 20, 0.9)";
var COLOR_COMPONENT_HEADER_BACKGROUND = "rgba(36, 28, 14, 0.85)";
var COLOR_TEXT = "#d4b896";
var COLOR_TEXT_DIM = "#7a6a50";
var COLOR_ACCENT = "#d4b46a";
var COLOR_COMPONENT = "#a8c870";
var COLOR_PROPERTY_VALUE = "#e8d5a3";
var COLOR_CLOSE_BUTTON = "rgba(140, 55, 28, 0.95)";
var COLOR_INACTIVE_TEXT = "#8c7455";
var COLOR_SCROLLBAR = "rgba(110, 88, 50, 0.55)";
var COLOR_TRUE = "#8cc878";
var COLOR_FALSE = "#c87878";
var ResizeMode = {
  none: "none",
  top: "top",
  bottom: "bottom",
  left: "left",
  right: "right",
  topLeft: "topLeft",
  bottomLeft: "bottomLeft",
  bottomRight: "bottomRight",
  splitter: "splitter"
};
var DEVToolsFlatItem = class {
  static {
    __name(this, "DEVToolsFlatItem");
  }
  /** @type { TransformNode } */
  node;
  /** @type { number } */
  depth;
  /** @type { boolean } */
  effectiveActive;
  /**
   * @param { TransformNode } node
   * @param { number } depth
   * @param { boolean } effectiveActive
   */
  constructor(node, depth, effectiveActive) {
    this.node = node;
    this.depth = depth;
    this.effectiveActive = effectiveActive;
  }
};
var InspectorLine = class {
  static {
    __name(this, "InspectorLine");
  }
  /** @type { string | null } */
  text;
  /** @type { string } */
  value;
  /** @type { string } */
  color;
  /** @type { boolean } */
  isSeparator;
  /** @type { boolean } */
  isSectionHeader;
  /** @type { boolean } */
  isComponentHeader;
  /** @type { Component | null } */
  componentRef;
  /** @type { boolean } */
  isComponentProperty;
  /**
   * @param { string | null } text
   * @param { string } value
   * @param { string } color
   * @param { boolean } isSeparator
   * @param { boolean } isSectionHeader
   * @param { boolean } isComponentHeader
   * @param { Component | null } componentRef
   * @param { boolean } isComponentProperty
   */
  constructor(text, value, color, isSeparator, isSectionHeader, isComponentHeader, componentRef, isComponentProperty) {
    this.text = text;
    this.value = value;
    this.color = color || COLOR_TEXT;
    this.isSeparator = isSeparator || false;
    this.isSectionHeader = isSectionHeader || false;
    this.isComponentHeader = isComponentHeader || false;
    this.componentRef = componentRef || null;
    this.isComponentProperty = isComponentProperty || false;
  }
};
var DEVTools = class extends Object2 {
  static {
    __name(this, "DEVTools");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Engine } */
  #engine;
  /** @private @type { TransformNode[] } */
  #rootNodes;
  /** @private @type { boolean } */
  #isVisible;
  /** @private @type { number } */
  #panelX;
  /** @private @type { number } */
  #panelY;
  /** @private @type { number } */
  #panelWidth;
  /** @private @type { number } */
  #panelHeight;
  /** @private @type { number } */
  #leftWidth;
  /** @private @type { boolean } */
  #isDraggingPanel;
  /** @private @type { number } */
  #dragStartMouseX;
  /** @private @type { number } */
  #dragStartMouseY;
  /** @private @type { number } */
  #dragStartPanelX;
  /** @private @type { number } */
  #dragStartPanelY;
  /** @private @type { string } */
  #resizeMode;
  /** @private @type { number } */
  #resizeDragStartMouseX;
  /** @private @type { number } */
  #resizeDragStartMouseY;
  /** @private @type { number } */
  #resizeDragStartPanelX;
  /** @private @type { number } */
  #resizeDragStartPanelY;
  /** @private @type { number } */
  #resizeDragStartPanelWidth;
  /** @private @type { number } */
  #resizeDragStartPanelHeight;
  /** @private @type { number } */
  #resizeDragStartLeftWidth;
  /** @private @type { TransformNode | null } */
  #selectedNode;
  /** @private @type { number } */
  #treeScrollY;
  /** @private @type { number } */
  #inspectorScrollY;
  /** @private @type { boolean } */
  #prevIsKeyF2;
  /** @private @type { DEVToolsFlatItem[] } */
  #flatList;
  /** @private @type { Set } */
  #expandedNodes;
  /** @private @type { Set } */
  #collapsedComponents;
  /** @private @type { InspectorLine[] } */
  #cachedInspectorLines;
  /** @private @type { boolean } */
  #isTreeScrollDragging;
  /** @private @type { number } */
  #treeScrollDragStartMouseY;
  /** @private @type { number } */
  #treeScrollDragStartScrollY;
  /** @private @type { boolean } */
  #isInspectorScrollDragging;
  /** @private @type { number } */
  #inspectorScrollDragStartMouseY;
  /** @private @type { number } */
  #inspectorScrollDragStartScrollY;
  /** @private @type { number } */
  #activeTab;
  /** @private @type { number } */
  #localStorageScrollY;
  /** @private @type { boolean } */
  #isLocalStorageScrollDragging;
  /** @private @type { number } */
  #localStorageScrollDragStartMouseY;
  /** @private @type { number } */
  #localStorageScrollDragStartScrollY;
  /** @private @type { string | null } */
  #selectedLocalStorageKey;
  /** @private @type { boolean } */
  #isDimEnabled;
  /** @private @type { boolean } */
  #isAllGizmosVisible;
  /** @private @type { boolean } */
  #isHeightAspectGuideVisible;
  /** @private @type { boolean } */
  #isWidthAspectGuideVisible;
  /** @private @type { boolean } */
  #isFramePerSecondVisible;
  /** @private @type { { x: number, y: number, width: number, height: number }[] } */
  #ctxButtonRects;
  /** @private @type { string | null } */
  #selectedStatisticsKey;
  /** @private @type { number } */
  #statisticsScrollY;
  /** @private @type { boolean } */
  #isStatisticsScrollDragging;
  /** @private @type { number } */
  #statisticsScrollDragStartMouseY;
  /** @private @type { number } */
  #statisticsScrollDragStartScrollY;
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.#engine = null;
    this.#rootNodes = [];
    this.#isVisible = false;
    this.#panelX = 10;
    this.#panelY = 50;
    this.#panelWidth = DEFAULT_PANEL_WIDTH;
    this.#panelHeight = DEFAULT_PANEL_HEIGHT;
    this.#leftWidth = DEFAULT_LEFT_WIDTH;
    this.#isDraggingPanel = false;
    this.#dragStartMouseX = 0;
    this.#dragStartMouseY = 0;
    this.#dragStartPanelX = 0;
    this.#dragStartPanelY = 0;
    this.#resizeMode = ResizeMode.none;
    this.#resizeDragStartMouseX = 0;
    this.#resizeDragStartMouseY = 0;
    this.#resizeDragStartPanelX = 0;
    this.#resizeDragStartPanelY = 0;
    this.#resizeDragStartPanelWidth = 0;
    this.#resizeDragStartPanelHeight = 0;
    this.#resizeDragStartLeftWidth = 0;
    this.#selectedNode = null;
    this.#treeScrollY = 0;
    this.#inspectorScrollY = 0;
    this.#prevIsKeyF2 = false;
    this.#flatList = [];
    this.#expandedNodes = /* @__PURE__ */ new Set();
    this.#collapsedComponents = /* @__PURE__ */ new Set();
    this.#cachedInspectorLines = [];
    this.#isTreeScrollDragging = false;
    this.#treeScrollDragStartMouseY = 0;
    this.#treeScrollDragStartScrollY = 0;
    this.#isInspectorScrollDragging = false;
    this.#inspectorScrollDragStartMouseY = 0;
    this.#inspectorScrollDragStartScrollY = 0;
    this.#activeTab = 1;
    this.#localStorageScrollY = 0;
    this.#isLocalStorageScrollDragging = false;
    this.#localStorageScrollDragStartMouseY = 0;
    this.#localStorageScrollDragStartScrollY = 0;
    this.#selectedLocalStorageKey = null;
    this.#isDimEnabled = false;
    this.#isAllGizmosVisible = true;
    this.#isHeightAspectGuideVisible = false;
    this.#isWidthAspectGuideVisible = false;
    this.#isFramePerSecondVisible = false;
    this.#ctxButtonRects = [];
    this.loadSettings();
    this.#selectedStatisticsKey = null;
    this.#statisticsScrollY = 0;
    this.#isStatisticsScrollDragging = false;
    this.#statisticsScrollDragStartMouseY = 0;
    this.#statisticsScrollDragStartScrollY = 0;
  }
  //==============================================================================
  // 엔진 설정.
  //==============================================================================
  /**
   * @param { Engine } engine
   */
  setEngine(engine) {
    this.#engine = engine;
    const graphic = this.#engine.getGraphic();
    graphic.setForceGizmosVisible(false);
  }
  //==============================================================================
  // 루트 노드 목록 설정.
  //==============================================================================
  /**
   * @param { TransformNode[] } rootNodes
   */
  setRootNodes(rootNodes) {
    this.#rootNodes = rootNodes;
    for (let rootIndex = 0; rootIndex < rootNodes.length; ++rootIndex) {
      this.#expandedNodes.add(rootNodes[rootIndex]);
    }
  }
  //==============================================================================
  // 표시 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isVisible() {
    return this.#isVisible;
  }
  //==============================================================================
  // 현재 터치 위치가 패널 내부에 있는지 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isPointerInsidePanel() {
    if (!this.#isVisible || !this.#engine) {
      return false;
    }
    const inputManager = this.#engine.getInputManager();
    const touchPosition = inputManager.getCanvasNativeInputPosition();
    const touchX = touchPosition.x;
    const touchY = touchPosition.y;
    const isInsideX = touchX >= this.#panelX && touchX <= this.#panelX + this.#panelWidth;
    const isInsideY = touchY >= this.#panelY && touchY <= this.#panelY + this.#panelHeight;
    return isInsideX && isInsideY;
  }
  //==============================================================================
  // 갱신.
  //==============================================================================
  /**
   * @param { number } timeDelta
   */
  tick(timeDelta) {
    if (!this.#engine) {
      return;
    }
    const inputManager = this.#engine.getInputManager();
    const isKeyF2 = inputManager.isKeyPressed(KeyCode.f2);
    if (isKeyF2 && !this.#prevIsKeyF2) {
      this.#isVisible = !this.#isVisible;
      const graphic = this.#engine.getGraphic();
      const isForceGizmosVisible = this.#isVisible && this.#isAllGizmosVisible;
      graphic.setForceGizmosVisible(isForceGizmosVisible);
      if (this.#isVisible) {
        const viewManager = this.#engine.getViewManager();
        const canvasNativeSize = viewManager.getCanvasNativeSize();
        this.#panelX = canvasNativeSize.x - this.#panelWidth;
        this.#panelY = canvasNativeSize.y - this.#panelHeight;
      }
    }
    this.#prevIsKeyF2 = isKeyF2;
    if (!this.#isVisible) {
      return;
    }
    this.rebuildFlatList();
    const isTouchPressed = inputManager.isTouchPressed();
    const isTouchReleased = inputManager.isTouchReleased();
    const isTouchMoved = inputManager.isTouchMoved();
    const touchPosition = inputManager.getCanvasNativeInputPosition();
    const touchX = touchPosition.x;
    const touchY = touchPosition.y;
    if (isTouchPressed) {
      this.handlePress(touchX, touchY);
    } else if (isTouchMoved) {
      this.handleMove(touchX, touchY);
    } else if (isTouchReleased) {
      this.handleRelease(touchX, touchY);
    }
  }
  //==============================================================================
  // 리사이즈 드래그 시작.
  //==============================================================================
  /**
   * @param { string } mode
   * @param { number } touchX
   * @param { number } touchY
   */
  startResize(mode, touchX, touchY) {
    this.#resizeMode = mode;
    this.#resizeDragStartMouseX = touchX;
    this.#resizeDragStartMouseY = touchY;
    this.#resizeDragStartPanelX = this.#panelX;
    this.#resizeDragStartPanelY = this.#panelY;
    this.#resizeDragStartPanelWidth = this.#panelWidth;
    this.#resizeDragStartPanelHeight = this.#panelHeight;
    this.#resizeDragStartLeftWidth = this.#leftWidth;
  }
  //==============================================================================
  // 눌림 처리.
  //==============================================================================
  /**
   * @param { number } touchX
   * @param { number } touchY
   */
  handlePress(touchX, touchY) {
    const panelX = this.#panelX;
    const panelY = this.#panelY;
    const panelWidth = this.#panelWidth;
    const panelHeight = this.#panelHeight;
    const leftWidth = this.#leftWidth;
    const isInsideX = touchX >= panelX && touchX <= panelX + panelWidth;
    const isInsideY = touchY >= panelY && touchY <= panelY + panelHeight;
    if (!isInsideX || !isInsideY) {
      return;
    }
    const nearLeft = touchX <= panelX + RESIZE_HANDLE_SIZE;
    const nearRight = touchX >= panelX + panelWidth - RESIZE_HANDLE_SIZE;
    const nearTop = touchY <= panelY + RESIZE_HANDLE_SIZE;
    const nearBottom = touchY >= panelY + panelHeight - RESIZE_HANDLE_SIZE;
    const inCloseButton = touchY <= panelY + TITLE_HEIGHT && touchX >= panelX + panelWidth - TITLE_HEIGHT;
    if (nearLeft && nearTop && !inCloseButton) {
      this.startResize(ResizeMode.topLeft, touchX, touchY);
      return;
    }
    if (nearLeft && nearBottom) {
      this.startResize(ResizeMode.bottomLeft, touchX, touchY);
      return;
    }
    if (nearRight && nearBottom) {
      this.startResize(ResizeMode.bottomRight, touchX, touchY);
      return;
    }
    if (nearLeft) {
      this.startResize(ResizeMode.left, touchX, touchY);
      return;
    }
    if (nearRight && !inCloseButton) {
      this.startResize(ResizeMode.right, touchX, touchY);
      return;
    }
    if (nearTop && !inCloseButton) {
      this.startResize(ResizeMode.top, touchX, touchY);
      return;
    }
    if (nearBottom) {
      this.startResize(ResizeMode.bottom, touchX, touchY);
      return;
    }
    if (touchY <= panelY + TITLE_HEIGHT) {
      if (inCloseButton) {
        this.#isVisible = false;
        const graphic = this.#engine.getGraphic();
        graphic.setForceGizmosVisible(false);
        return;
      }
      this.#isDraggingPanel = true;
      this.#dragStartMouseX = touchX;
      this.#dragStartMouseY = touchY;
      this.#dragStartPanelX = panelX;
      this.#dragStartPanelY = panelY;
      return;
    }
    if (touchY <= panelY + TITLE_HEIGHT + TAB_HEIGHT) {
      const tabWidth = panelWidth / TABS.length;
      const tabIndex = System28.Math.floor((touchX - panelX) / tabWidth);
      if (tabIndex >= 0 && tabIndex < TABS.length) {
        this.#activeTab = tabIndex;
      }
      return;
    }
    const contentY = panelY + TITLE_HEIGHT + TAB_HEIGHT + 1;
    const contentHeight = panelHeight - TITLE_HEIGHT - TAB_HEIGHT - 1;
    if (this.#activeTab === 0) {
      this.handleStatisticsPress(touchX, touchY, panelX, contentY, panelWidth, contentHeight);
      return;
    }
    if (this.#activeTab === 2) {
      this.handleLocalStoragePress(touchX, touchY, panelX, contentY, panelWidth, contentHeight);
      return;
    }
    if (this.#activeTab === 3) {
      this.handleSettingsPress(touchX, touchY, panelX, contentY, panelWidth, contentHeight);
      return;
    }
    if (this.#activeTab !== 1) {
      return;
    }
    const splitterX = panelX + leftWidth;
    const isNearSplitter = touchX >= splitterX - SPLITTER_HIT_SIZE / 2 && touchX <= splitterX + SPLITTER_HIT_SIZE / 2;
    if (isNearSplitter) {
      this.startResize(ResizeMode.splitter, touchX, touchY);
      return;
    }
    if (touchX < panelX + leftWidth) {
      const treeItemsY = contentY + ITEM_HEIGHT * 2;
      const localY2 = touchY - treeItemsY + this.#treeScrollY;
      const clickedIndex = System28.Math.floor(localY2 / ITEM_HEIGHT);
      if (clickedIndex >= 0 && clickedIndex < this.#flatList.length) {
        const clickedItem = this.#flatList[clickedIndex];
        const clickedNode = clickedItem.node;
        const childCount = clickedNode.getChildren().length;
        const checkboxRightX = panelX + leftWidth - SCROLL_BAR_WIDTH - GIZMO_CHECKBOX_MARGIN;
        const checkboxX = checkboxRightX - GIZMO_CHECKBOX_SIZE;
        const itemTopY = treeItemsY + clickedIndex * ITEM_HEIGHT - this.#treeScrollY;
        const itemMidY = itemTopY + ITEM_HEIGHT * 0.5;
        const checkboxY = itemMidY - GIZMO_CHECKBOX_SIZE * 0.5;
        const isCheckboxHit = touchX >= checkboxX && touchX <= checkboxX + GIZMO_CHECKBOX_SIZE && touchY >= checkboxY && touchY <= checkboxY + GIZMO_CHECKBOX_SIZE;
        if (isCheckboxHit) {
          clickedNode.setGizmoVisible(!clickedNode.isGizmoVisible());
          return;
        }
        const activeCheckboxRightX = checkboxX - GIZMO_CHECKBOX_MARGIN;
        const activeCheckboxX = activeCheckboxRightX - GIZMO_CHECKBOX_SIZE;
        const isActiveCheckboxHit = touchX >= activeCheckboxX && touchX <= activeCheckboxX + GIZMO_CHECKBOX_SIZE && touchY >= checkboxY && touchY <= checkboxY + GIZMO_CHECKBOX_SIZE;
        if (isActiveCheckboxHit) {
          clickedNode.setActive(!clickedNode.isActive());
          return;
        }
        if (childCount > 0) {
          if (this.#expandedNodes.has(clickedNode)) {
            this.#expandedNodes.delete(clickedNode);
          } else {
            this.#expandedNodes.add(clickedNode);
          }
        }
        this.#selectedNode = clickedNode;
        this.#inspectorScrollY = 0;
      }
      this.#isTreeScrollDragging = true;
      this.#treeScrollDragStartMouseY = touchY;
      this.#treeScrollDragStartScrollY = this.#treeScrollY;
      return;
    }
    const localY = touchY - contentY + this.#inspectorScrollY;
    const clickedLineIndex = System28.Math.floor(localY / ITEM_HEIGHT);
    if (clickedLineIndex >= 0 && clickedLineIndex < this.#cachedInspectorLines.length) {
      const clickedLine = this.#cachedInspectorLines[clickedLineIndex];
      if (clickedLine.isComponentHeader && clickedLine.componentRef) {
        const componentRef = clickedLine.componentRef;
        if (this.#collapsedComponents.has(componentRef)) {
          this.#collapsedComponents.delete(componentRef);
        } else {
          this.#collapsedComponents.add(componentRef);
        }
        return;
      }
    }
    this.#isInspectorScrollDragging = true;
    this.#inspectorScrollDragStartMouseY = touchY;
    this.#inspectorScrollDragStartScrollY = this.#inspectorScrollY;
  }
  //==============================================================================
  // 이동 처리.
  //==============================================================================
  /**
   * @param { number } touchX
   * @param { number } touchY
   */
  handleMove(touchX, touchY) {
    if (this.#isDraggingPanel) {
      const deltaX = touchX - this.#dragStartMouseX;
      const deltaY = touchY - this.#dragStartMouseY;
      this.#panelX = this.#dragStartPanelX + deltaX;
      this.#panelY = this.#dragStartPanelY + deltaY;
    }
    if (this.#resizeMode !== ResizeMode.none) {
      const deltaX = touchX - this.#resizeDragStartMouseX;
      const deltaY = touchY - this.#resizeDragStartMouseY;
      const isRightMode = this.#resizeMode === ResizeMode.right || this.#resizeMode === ResizeMode.bottomRight;
      if (isRightMode) {
        const newWidth = this.#resizeDragStartPanelWidth + deltaX;
        this.#panelWidth = System28.Math.max(MIN_PANEL_WIDTH, newWidth);
      }
      const isLeftMode = this.#resizeMode === ResizeMode.left || this.#resizeMode === ResizeMode.topLeft || this.#resizeMode === ResizeMode.bottomLeft;
      if (isLeftMode) {
        const newWidth = this.#resizeDragStartPanelWidth - deltaX;
        if (newWidth >= MIN_PANEL_WIDTH) {
          this.#panelWidth = newWidth;
          this.#panelX = this.#resizeDragStartPanelX + deltaX;
        }
      }
      const isBottomMode = this.#resizeMode === ResizeMode.bottom || this.#resizeMode === ResizeMode.bottomRight || this.#resizeMode === ResizeMode.bottomLeft;
      if (isBottomMode) {
        const newHeight = this.#resizeDragStartPanelHeight + deltaY;
        this.#panelHeight = System28.Math.max(MIN_PANEL_HEIGHT, newHeight);
      }
      const isTopMode = this.#resizeMode === ResizeMode.top || this.#resizeMode === ResizeMode.topLeft;
      if (isTopMode) {
        const newHeight = this.#resizeDragStartPanelHeight - deltaY;
        if (newHeight >= MIN_PANEL_HEIGHT) {
          this.#panelHeight = newHeight;
          this.#panelY = this.#resizeDragStartPanelY + deltaY;
        }
      }
      if (this.#resizeMode === ResizeMode.splitter) {
        const newLeftWidth = this.#resizeDragStartLeftWidth + deltaX;
        const maxLeftWidth = this.#panelWidth - MIN_LEFT_WIDTH;
        this.#leftWidth = System28.Math.max(MIN_LEFT_WIDTH, System28.Math.min(maxLeftWidth, newLeftWidth));
      }
    }
    if (this.#isTreeScrollDragging) {
      const deltaY = touchY - this.#treeScrollDragStartMouseY;
      const newScrollY = this.#treeScrollDragStartScrollY - deltaY;
      this.#treeScrollY = System28.Math.max(0, newScrollY);
    }
    if (this.#isInspectorScrollDragging) {
      const deltaY = touchY - this.#inspectorScrollDragStartMouseY;
      const newScrollY = this.#inspectorScrollDragStartScrollY - deltaY;
      this.#inspectorScrollY = System28.Math.max(0, newScrollY);
    }
    if (this.#isLocalStorageScrollDragging) {
      const deltaY = touchY - this.#localStorageScrollDragStartMouseY;
      const newScrollY = this.#localStorageScrollDragStartScrollY - deltaY;
      this.#localStorageScrollY = System28.Math.max(0, newScrollY);
    }
    if (this.#isStatisticsScrollDragging) {
      const deltaY = touchY - this.#statisticsScrollDragStartMouseY;
      const newScrollY = this.#statisticsScrollDragStartScrollY - deltaY;
      this.#statisticsScrollY = System28.Math.max(0, newScrollY);
    }
  }
  //==============================================================================
  // 뗌 처리.
  //==============================================================================
  /**
   * @param { number } touchX
   * @param { number } touchY
   */
  handleRelease(touchX, touchY) {
    this.#isDraggingPanel = false;
    this.#resizeMode = ResizeMode.none;
    this.#isTreeScrollDragging = false;
    this.#isInspectorScrollDragging = false;
    this.#isLocalStorageScrollDragging = false;
    this.#isStatisticsScrollDragging = false;
  }
  //==============================================================================
  // 로컬 스토리지 탭 눌림 처리.
  //==============================================================================
  /**
   * @param { number } touchX
   * @param { number } touchY
   * @param { number } panelX
   * @param { number } panelY
   * @param { number } panelWidth
   * @param { number } panelHeight
   */
  handleLocalStoragePress(touchX, touchY, panelX, panelY, panelWidth, panelHeight) {
    const addBtnWidth = 48;
    const clearBtnWidth = 48;
    const btnHeight = ITEM_HEIGHT - 4;
    const btnY = panelY + 2;
    const clearBtnX = panelX + panelWidth - PADDING - clearBtnWidth;
    const addBtnX = clearBtnX - PADDING - addBtnWidth;
    if (touchX >= addBtnX && touchX <= addBtnX + addBtnWidth && touchY >= btnY && touchY <= btnY + btnHeight) {
      const newKey = System28.window.prompt("\uD0A4 \uC785\uB825:");
      if (newKey !== null && newKey.trim() !== "") {
        const newValue = System28.window.prompt("\uAC12 \uC785\uB825:") || "";
        LocalStorage.setString(newKey.trim(), newValue);
      }
      return;
    }
    if (touchX >= clearBtnX && touchX <= clearBtnX + clearBtnWidth && touchY >= btnY && touchY <= btnY + btnHeight) {
      if (System28.window.confirm("\uBAA8\uB4E0 \uB85C\uCEEC \uC2A4\uD1A0\uB9AC\uC9C0 \uD56D\uBAA9\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?")) {
        LocalStorage.clear();
        this.#selectedLocalStorageKey = null;
      }
      return;
    }
    const contextMenuHeight = ITEM_HEIGHT + 8;
    const hasSelection = this.#selectedLocalStorageKey !== null;
    if (hasSelection) {
      const contextMenuY = panelY + panelHeight - contextMenuHeight;
      if (touchY >= contextMenuY) {
        const selectedKey = this.#selectedLocalStorageKey;
        let buttonIndex = -1;
        for (let rectIndex = 0; rectIndex < this.#ctxButtonRects.length; ++rectIndex) {
          const buttonRect = this.#ctxButtonRects[rectIndex];
          const isHitX = touchX >= buttonRect.x && touchX <= buttonRect.x + buttonRect.width;
          const isHitY = touchY >= buttonRect.y && touchY <= buttonRect.y + buttonRect.height;
          if (isHitX && isHitY) {
            buttonIndex = rectIndex;
            break;
          }
        }
        if (buttonIndex >= 0) {
          switch (buttonIndex) {
            case 0: {
              const newKey = System28.window.prompt("\uD0A4 \uC774\uB984 \uC218\uC815:", selectedKey);
              if (newKey !== null && newKey.trim() !== "" && newKey.trim() !== selectedKey) {
                const existingValue = LocalStorage.getString(selectedKey) || "";
                LocalStorage.remove(selectedKey);
                LocalStorage.setString(newKey.trim(), existingValue);
                this.#selectedLocalStorageKey = newKey.trim();
              }
              break;
            }
            case 1: {
              const currentValue = LocalStorage.getString(selectedKey) || "";
              const newValue = System28.window.prompt(`"${selectedKey}" \uAC12 \uC218\uC815:`, currentValue);
              if (newValue !== null) {
                LocalStorage.setString(selectedKey, newValue);
              }
              break;
            }
            case 2: {
              const cloneKey = selectedKey + " (Clone)";
              const cloneValue = LocalStorage.getString(selectedKey) || "";
              LocalStorage.setString(cloneKey, cloneValue);
              this.#selectedLocalStorageKey = cloneKey;
              break;
            }
            case 3: {
              if (System28.window.confirm(`"${selectedKey}" \uD56D\uBAA9\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`)) {
                LocalStorage.remove(selectedKey);
                this.#selectedLocalStorageKey = null;
              }
              break;
            }
          }
        }
        return;
      }
    }
    const itemsY = panelY + ITEM_HEIGHT * 2;
    const keys = LocalStorage.getKeys();
    const delColWidth = 24;
    const localY = touchY - itemsY + this.#localStorageScrollY;
    const clickedIndex = System28.Math.floor(localY / ITEM_HEIGHT);
    if (touchY >= itemsY && clickedIndex >= 0 && clickedIndex < keys.length) {
      const clickedKey = keys[clickedIndex];
      const delBtnX = panelX + panelWidth - SCROLL_BAR_WIDTH - delColWidth;
      if (touchX >= delBtnX) {
        if (System28.window.confirm(`"${clickedKey}" \uD56D\uBAA9\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`)) {
          LocalStorage.remove(clickedKey);
          if (this.#selectedLocalStorageKey === clickedKey) {
            this.#selectedLocalStorageKey = null;
          }
        }
        return;
      }
      if (this.#selectedLocalStorageKey === clickedKey) {
        this.#selectedLocalStorageKey = null;
      } else {
        this.#selectedLocalStorageKey = clickedKey;
      }
    } else if (touchY >= itemsY) {
      this.#selectedLocalStorageKey = null;
    }
    if (touchY >= itemsY) {
      this.#isLocalStorageScrollDragging = true;
      this.#localStorageScrollDragStartMouseY = touchY;
      this.#localStorageScrollDragStartScrollY = this.#localStorageScrollY;
    }
  }
  //==============================================================================
  // 트리 목록 재구성.
  //==============================================================================
  rebuildFlatList() {
    this.#flatList = [];
    for (let rootIndex = 0; rootIndex < this.#rootNodes.length; ++rootIndex) {
      const rootNode = this.#rootNodes[rootIndex];
      this.collectNode(rootNode, 0, true);
    }
  }
  //==============================================================================
  // 노드를 플랫 목록에 재귀 추가.
  //==============================================================================
  /**
   * @param { TransformNode } node
   * @param { number } depth
   * @param { boolean } parentActive
   */
  collectNode(node, depth, parentActive) {
    const isNodeActive = node.isActive();
    const effectiveActive = parentActive && isNodeActive;
    const flatItem = new DEVToolsFlatItem(node, depth, effectiveActive);
    this.#flatList.push(flatItem);
    const isExpanded = this.#expandedNodes.has(node);
    if (!isExpanded) {
      return;
    }
    const children = node.getChildren();
    for (let childIndex = 0; childIndex < children.length; ++childIndex) {
      this.collectNode(children[childIndex], depth + 1, effectiveActive);
    }
  }
  //==============================================================================
  // 컴포넌트의 get*/is* 프로퍼티 목록 수집.
  //==============================================================================
  /**
   * @param { Component } component
   * @returns { { name: string, value: * }[] }
   */
  getComponentProperties(component) {
    const properties = [];
    const seenNames = /* @__PURE__ */ new Set();
    let proto = System28.Object.getPrototypeOf(component);
    while (proto && proto.constructor && proto.constructor !== Component && proto !== System28.Object.prototype) {
      const methodNames = System28.Object.getOwnPropertyNames(proto);
      for (let i = 0; i < methodNames.length; ++i) {
        const methodName = methodNames[i];
        if (seenNames.has(methodName)) {
          continue;
        }
        seenNames.add(methodName);
        if (typeof component[methodName] !== "function") {
          continue;
        }
        if (component[methodName].length !== 0) {
          continue;
        }
        const isGetter = methodName.startsWith("get") || methodName.startsWith("is");
        if (!isGetter) {
          continue;
        }
        if (methodName === "constructor" || methodName === "getNode") {
          continue;
        }
        try {
          const value = component[methodName]();
          properties.push({ name: methodName, value });
        } catch (error) {
        }
      }
      proto = System28.Object.getPrototypeOf(proto);
    }
    return properties;
  }
  //==============================================================================
  // get* 메서드명을 프로퍼티명 형식으로 변환. (getTextColor → textColor)
  //==============================================================================
  /**
   * @param { string } methodName
   * @returns { string }
   */
  formatMethodName(methodName) {
    if (methodName.startsWith("get") && methodName.length > 3) {
      const trimmed = methodName.slice(3);
      return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
    }
    return methodName;
  }
  //==============================================================================
  // 프로퍼티 값을 문자열로 포맷.
  //==============================================================================
  /**
   * @param { * } value
   * @returns { string }
   */
  formatPropertyValue(value) {
    if (value === null) {
      return "null";
    }
    if (value === void 0) {
      return "undefined";
    }
    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }
    if (typeof value === "number") {
      return value.toFixed(2);
    }
    if (typeof value === "string") {
      const truncated = value.length > 28 ? value.slice(0, 25) + "..." : value;
      return `"${truncated}"`;
    }
    if (typeof value === "object") {
      if (typeof value.x === "number" && typeof value.y === "number" && !("width" in value)) {
        return `(${value.x.toFixed(2)}, ${value.y.toFixed(2)})`;
      }
      if (typeof value.width === "number" && typeof value.height === "number") {
        let rawX = value.x;
        let rawY = value.y;
        if (typeof rawX !== "number" && value.position) {
          rawX = value.position.x;
        }
        if (typeof rawY !== "number" && value.position) {
          rawY = value.position.y;
        }
        const rectX = typeof rawX === "number" ? rawX.toFixed(1) : "?";
        const rectY = typeof rawY === "number" ? rawY.toFixed(1) : "?";
        return `(${rectX}, ${rectY}, ${value.width.toFixed(1)}, ${value.height.toFixed(1)})`;
      }
      if (typeof value.red === "number" && typeof value.green === "number" && typeof value.blue === "number") {
        const r = System28.Math.round(value.red * 255);
        const g = System28.Math.round(value.green * 255);
        const b = System28.Math.round(value.blue * 255);
        const a = typeof value.alpha === "number" ? value.alpha.toFixed(2) : "1";
        return `rgba(${r}, ${g}, ${b}, ${a})`;
      }
      const typeName = value.constructor ? value.constructor.name : "object";
      return `[${typeName}]`;
    }
    return String(value);
  }
  //==============================================================================
  // 인스펙터 라인 목록 구성.
  //==============================================================================
  /**
   * @param { TransformNode } node
   * @returns { InspectorLine[] }
   */
  buildInspectorLines(node) {
    const lines = [];
    lines.push(new InspectorLine("Node", "", COLOR_ACCENT, false, true, false, null, false));
    const nodeName = node.getName() || "(unnamed)";
    const nodeTypeName = node.nodeType || node.constructor.name;
    const isActive = node.isActive();
    const childCount = node.getChildren().length;
    lines.push(new InspectorLine("name", nodeName, COLOR_TEXT, false, false, false, null, false));
    lines.push(new InspectorLine("type", nodeTypeName, COLOR_ACCENT, false, false, false, null, false));
    lines.push(new InspectorLine("active", isActive ? "true" : "false", isActive ? COLOR_TRUE : COLOR_FALSE, false, false, false, null, false));
    lines.push(new InspectorLine("children", String(childCount), COLOR_TEXT, false, false, false, null, false));
    if (typeof node.getLocalPosition === "function") {
      const localPosition = node.getLocalPosition();
      const positionText = `(${localPosition.x.toFixed(1)}, ${localPosition.y.toFixed(1)})`;
      lines.push(new InspectorLine("localPos", positionText, COLOR_TEXT, false, false, false, null, false));
    }
    if (typeof node.getLocalScale === "function") {
      const localScale = node.getLocalScale();
      const scaleText = `(${localScale.x.toFixed(3)}, ${localScale.y.toFixed(3)})`;
      lines.push(new InspectorLine("localScale", scaleText, COLOR_TEXT, false, false, false, null, false));
    }
    if (typeof node.getLocalRotation === "function") {
      const localRotation = node.getLocalRotation();
      lines.push(new InspectorLine("localRot", `${localRotation.toFixed(2)} deg`, COLOR_TEXT, false, false, false, null, false));
    }
    if (typeof node.getLocalOpacity === "function") {
      const localOpacity = node.getLocalOpacity();
      lines.push(new InspectorLine("opacity", localOpacity.toFixed(3), COLOR_TEXT, false, false, false, null, false));
    }
    if (typeof node.getContentSize === "function") {
      const contentSize = node.getContentSize();
      const sizeText = `(${contentSize.x.toFixed(1)}, ${contentSize.y.toFixed(1)})`;
      lines.push(new InspectorLine("contentSize", sizeText, COLOR_TEXT, false, false, false, null, false));
    }
    if (typeof node.getPivot === "function") {
      const pivot = node.getPivot();
      const pivotText = `(${pivot.x.toFixed(3)}, ${pivot.y.toFixed(3)})`;
      lines.push(new InspectorLine("pivot", pivotText, COLOR_TEXT, false, false, false, null, false));
    }
    lines.push(new InspectorLine(null, "", COLOR_TEXT, true, false, false, null, false));
    lines.push(new InspectorLine("Components", "", COLOR_ACCENT, false, true, false, null, false));
    if (typeof node.getAllComponents === "function") {
      const components = node.getAllComponents();
      if (components.length === 0) {
        lines.push(new InspectorLine(null, "(\uC5C6\uC74C)", COLOR_TEXT_DIM, false, false, false, null, false));
      } else {
        for (let componentIndex = 0; componentIndex < components.length; ++componentIndex) {
          const component = components[componentIndex];
          const componentTypeName = component.getComponentType() || component.constructor.name;
          const isExpanded = !this.#collapsedComponents.has(component);
          lines.push(new InspectorLine(null, componentTypeName, COLOR_COMPONENT, false, false, true, component, false));
          if (isExpanded) {
            const componentProperties = this.getComponentProperties(component);
            if (componentProperties.length === 0) {
              lines.push(new InspectorLine(null, "(\uD504\uB85C\uD37C\uD2F0 \uC5C6\uC74C)", COLOR_TEXT_DIM, false, false, false, null, true));
            } else {
              for (let propIndex = 0; propIndex < componentProperties.length; ++propIndex) {
                const componentProperty = componentProperties[propIndex];
                const propName = this.formatMethodName(componentProperty.name);
                const propValue = this.formatPropertyValue(componentProperty.value);
                lines.push(new InspectorLine(propName, propValue, COLOR_PROPERTY_VALUE, false, false, false, null, true));
              }
            }
          }
        }
      }
    } else {
      lines.push(new InspectorLine(null, "(\uC5C6\uC74C)", COLOR_TEXT_DIM, false, false, false, null, false));
    }
    this.#cachedInspectorLines = lines;
    return lines;
  }
  //==============================================================================
  // 출력.
  //==============================================================================
  /**
   * @param { Graphic } graphic
   */
  draw(graphic) {
    if (!this.#isVisible) {
      return;
    }
    graphic.pushState();
    const panelX = this.#panelX;
    const panelY = this.#panelY;
    const panelWidth = this.#panelWidth;
    const panelHeight = this.#panelHeight;
    const leftWidth = this.#leftWidth;
    if (this.#isDimEnabled) {
      graphic.pushState();
      graphic.setTransform(1, 0, 0, 1, 0, 0);
      graphic.setFillColor("rgba(0, 0, 0, 0.5)");
      const canvas = graphic.getCanvas();
      graphic.drawRect(Rect.create(0, 0, canvas.width, canvas.height));
      graphic.popState();
    }
    this.drawAspectGuide(graphic);
    const viewManager = this.#engine.getViewManager();
    viewManager.applyCanvasNativeRect(graphic);
    graphic.setFillColor(COLOR_BACKGROUND);
    graphic.drawRect(Rect.create(panelX, panelY, panelWidth, panelHeight));
    graphic.setFillColor(COLOR_TITLE_BACKGROUND);
    graphic.drawRect(Rect.create(panelX, panelY, panelWidth, TITLE_HEIGHT));
    graphic.setFillColor(COLOR_ACCENT);
    graphic.setFontString(`bold ${FONT_SIZE}px monospace`);
    graphic.setTextAlign("left");
    graphic.setTextBaseline("middle");
    graphic.drawFillText("Runtime DEV Tools", panelX + PADDING, panelY + TITLE_HEIGHT * 0.5);
    const closeBtnX = panelX + panelWidth - TITLE_HEIGHT;
    graphic.setFillColor(COLOR_CLOSE_BUTTON);
    graphic.drawRect(Rect.create(closeBtnX, panelY, TITLE_HEIGHT, TITLE_HEIGHT));
    graphic.setFillColor("#ffffff");
    graphic.setFontString(`bold ${FONT_SIZE}px monospace`);
    graphic.setTextAlign("center");
    graphic.setTextBaseline("middle");
    graphic.drawFillText("X", closeBtnX + TITLE_HEIGHT * 0.5, panelY + TITLE_HEIGHT * 0.5);
    graphic.setStrokeColor(COLOR_SPLITTER);
    graphic.drawLine([
      Vector2.create(panelX, panelY + TITLE_HEIGHT + 0.5),
      Vector2.create(panelX + panelWidth, panelY + TITLE_HEIGHT + 0.5)
    ], 1);
    const tabWidth = panelWidth / TABS.length;
    for (let tabIndex = 0; tabIndex < TABS.length; ++tabIndex) {
      const tabX = panelX + tabIndex * tabWidth;
      const isActiveTab = tabIndex === this.#activeTab;
      graphic.setFillColor(isActiveTab ? COLOR_SECTION_HEADER_BACKGROUND : COLOR_COMPONENT_HEADER_BACKGROUND);
      graphic.drawRect(Rect.create(tabX, panelY + TITLE_HEIGHT, tabWidth, TAB_HEIGHT));
      graphic.setFillColor(isActiveTab ? COLOR_ACCENT : COLOR_TEXT_DIM);
      graphic.setFontString(`${FONT_SIZE}px monospace`);
      graphic.setTextAlign("center");
      graphic.setTextBaseline("middle");
      graphic.drawFillText(TABS[tabIndex], tabX + tabWidth * 0.5, panelY + TITLE_HEIGHT + TAB_HEIGHT * 0.5);
    }
    graphic.setStrokeColor(COLOR_SPLITTER);
    graphic.drawLine([
      Vector2.create(panelX, panelY + TITLE_HEIGHT + TAB_HEIGHT + 0.5),
      Vector2.create(panelX + panelWidth, panelY + TITLE_HEIGHT + TAB_HEIGHT + 0.5)
    ], 1);
    const contentY = panelY + TITLE_HEIGHT + TAB_HEIGHT + 1;
    const contentHeight = panelHeight - TITLE_HEIGHT - TAB_HEIGHT - 1;
    const rightPanelX = panelX + leftWidth + 1;
    const rightPanelWidth = panelWidth - leftWidth - 1;
    if (this.#activeTab === 0) {
      this.drawStatisticsPanel(graphic, panelX, contentY, panelWidth, contentHeight);
    } else if (this.#activeTab === 1) {
      this.drawTreePanel(graphic, panelX, contentY, leftWidth, contentHeight);
      const isSplitterActive = this.#resizeMode === ResizeMode.splitter;
      graphic.setFillColor(isSplitterActive ? COLOR_SPLITTER_ACTIVE : COLOR_SPLITTER);
      graphic.drawRect(Rect.create(panelX + leftWidth, contentY, 1, contentHeight));
      this.drawInspectorPanel(graphic, rightPanelX, contentY, rightPanelWidth, contentHeight);
    } else if (this.#activeTab === 2) {
      this.drawLocalStoragePanel(graphic, panelX, contentY, panelWidth, contentHeight);
    } else if (this.#activeTab === 3) {
      this.drawSettingsPanel(graphic, panelX, contentY, panelWidth, contentHeight);
    } else {
      graphic.setFillColor(COLOR_TEXT_DIM);
      graphic.setFontString(`${FONT_SIZE}px monospace`);
      graphic.setTextAlign("center");
      graphic.setTextBaseline("middle");
      graphic.drawFillText(TABS[this.#activeTab], panelX + panelWidth * 0.5, contentY + contentHeight * 0.5);
    }
    const isResizing = this.#resizeMode !== ResizeMode.none && this.#resizeMode !== ResizeMode.splitter;
    graphic.setStrokeColor(isResizing ? COLOR_BORDER_ACTIVE : COLOR_BORDER_NORMAL);
    graphic.drawStrokeRect(Rect.create(panelX + 0.5, panelY + 0.5, panelWidth - 1, panelHeight - 1), isResizing ? 2 : 1);
    graphic.popState();
  }
  //==============================================================================
  // 트리 패널 출력.
  //==============================================================================
  /**
   * @param { Graphic } graphic
   * @param { number } panelX
   * @param { number } panelY
   * @param { number } panelWidth
   * @param { number } panelHeight
   */
  drawTreePanel(graphic, panelX, panelY, panelWidth, panelHeight) {
    graphic.beginClipRect(Rect.create(panelX, panelY, panelWidth, panelHeight));
    graphic.setFillColor(COLOR_SECTION_HEADER_BACKGROUND);
    graphic.drawRect(Rect.create(panelX, panelY, panelWidth, ITEM_HEIGHT));
    graphic.setFillColor(COLOR_ACCENT);
    graphic.setFontString(`bold ${FONT_SIZE}px monospace`);
    graphic.setTextBaseline("middle");
    graphic.setTextAlign("left");
    graphic.drawFillText("Hierarchy", panelX + PADDING, panelY + ITEM_HEIGHT * 0.5);
    const columnHeaderY = panelY + ITEM_HEIGHT;
    const columnHeaderMidY = columnHeaderY + ITEM_HEIGHT * 0.5;
    graphic.setFillColor(COLOR_COMPONENT_HEADER_BACKGROUND);
    graphic.drawRect(Rect.create(panelX, columnHeaderY, panelWidth, ITEM_HEIGHT));
    const headerCheckboxRightX = panelX + panelWidth - SCROLL_BAR_WIDTH - GIZMO_CHECKBOX_MARGIN;
    const headerGizmoCheckboxX = headerCheckboxRightX - GIZMO_CHECKBOX_SIZE;
    const headerActiveCheckboxX = headerGizmoCheckboxX - GIZMO_CHECKBOX_MARGIN - GIZMO_CHECKBOX_SIZE;
    graphic.setFontString(`${FONT_SIZE - 1}px monospace`);
    graphic.setTextBaseline("middle");
    graphic.setFillColor(COLOR_TEXT_DIM);
    graphic.setTextAlign("left");
    graphic.drawFillText("Name", panelX + PADDING + 12, columnHeaderMidY);
    graphic.setTextAlign("right");
    graphic.drawFillText("Type", headerActiveCheckboxX - GIZMO_CHECKBOX_MARGIN, columnHeaderMidY);
    graphic.setTextAlign("center");
    graphic.drawFillText("A", headerActiveCheckboxX + GIZMO_CHECKBOX_SIZE * 0.5, columnHeaderMidY);
    graphic.drawFillText("G", headerGizmoCheckboxX + GIZMO_CHECKBOX_SIZE * 0.5, columnHeaderMidY);
    const itemsY = panelY + ITEM_HEIGHT * 2;
    const itemsHeight = panelHeight - ITEM_HEIGHT * 2;
    const totalItemsHeight = this.#flatList.length * ITEM_HEIGHT;
    if (totalItemsHeight > itemsHeight) {
      const maxTreeScrollY = totalItemsHeight - itemsHeight;
      this.#treeScrollY = System28.Math.min(this.#treeScrollY, maxTreeScrollY);
    } else {
      this.#treeScrollY = 0;
    }
    graphic.beginClipRect(Rect.create(panelX, itemsY, panelWidth, itemsHeight));
    for (let itemIndex = 0; itemIndex < this.#flatList.length; ++itemIndex) {
      try {
        const flatItem = this.#flatList[itemIndex];
        const itemY = itemsY + itemIndex * ITEM_HEIGHT - this.#treeScrollY;
        if (itemY + ITEM_HEIGHT < itemsY || itemY > itemsY + itemsHeight) {
          continue;
        }
        const node = flatItem.node;
        const depth = flatItem.depth;
        const isSelected = node === this.#selectedNode;
        const hasChildren = node.getChildren().length > 0;
        const isExpanded = this.#expandedNodes.has(node);
        const isActive = node.isActive();
        const effectiveActive = flatItem.effectiveActive;
        const itemMidY = itemY + ITEM_HEIGHT * 0.5;
        if (isSelected) {
          graphic.setFillColor(COLOR_ITEM_SELECTED);
          graphic.drawRect(Rect.create(panelX, itemY, panelWidth, ITEM_HEIGHT));
        }
        const indentX = panelX + PADDING + depth * INDENT_WIDTH;
        if (hasChildren) {
          graphic.setFillColor(isExpanded ? COLOR_ACCENT : COLOR_TEXT_DIM);
          graphic.setFontString(`${FONT_SIZE}px monospace`);
          graphic.setTextBaseline("middle");
          graphic.setTextAlign("left");
          const triangleText = isExpanded ? "v" : ">";
          graphic.drawFillText(triangleText, indentX, itemMidY);
        }
        const nodeName = node.getName() || "(unnamed)";
        graphic.setFillColor(effectiveActive ? COLOR_TEXT : COLOR_INACTIVE_TEXT);
        graphic.setFontString(`${FONT_SIZE}px monospace`);
        graphic.setTextBaseline("middle");
        graphic.setTextAlign("left");
        graphic.drawFillText(nodeName, indentX + 12, itemMidY);
        const nodeTypeName = node.nodeType || node.constructor.name;
        graphic.setFillColor(COLOR_TEXT_DIM);
        graphic.setFontString(`${FONT_SIZE - 1}px monospace`);
        graphic.setTextAlign("right");
        const checkboxRightX = panelX + panelWidth - SCROLL_BAR_WIDTH - GIZMO_CHECKBOX_MARGIN;
        const checkboxX = checkboxRightX - GIZMO_CHECKBOX_SIZE;
        const checkboxY = System28.Math.floor(itemMidY - GIZMO_CHECKBOX_SIZE * 0.5);
        const isGizmoVisible = typeof node.isGizmoVisible === "function" ? node.isGizmoVisible() : false;
        graphic.setFillColor(COLOR_ACCENT);
        graphic.drawRect(Rect.create(checkboxX, checkboxY, GIZMO_CHECKBOX_SIZE, GIZMO_CHECKBOX_SIZE));
        if (!isGizmoVisible) {
          graphic.setFillColor("#16120a");
          graphic.drawRect(Rect.create(checkboxX + 2, checkboxY + 2, GIZMO_CHECKBOX_SIZE - 4, GIZMO_CHECKBOX_SIZE - 4));
        }
        const activeCheckboxRightX = checkboxX - GIZMO_CHECKBOX_MARGIN;
        const activeCheckboxX = activeCheckboxRightX - GIZMO_CHECKBOX_SIZE;
        graphic.setFillColor(isActive ? COLOR_TRUE : COLOR_FALSE);
        graphic.drawRect(Rect.create(activeCheckboxX, checkboxY, GIZMO_CHECKBOX_SIZE, GIZMO_CHECKBOX_SIZE));
        if (!isActive) {
          graphic.setFillColor("#16120a");
          graphic.drawRect(Rect.create(activeCheckboxX + 2, checkboxY + 2, GIZMO_CHECKBOX_SIZE - 4, GIZMO_CHECKBOX_SIZE - 4));
        }
        graphic.setFillColor(COLOR_TEXT_DIM);
        graphic.drawFillText(nodeTypeName, activeCheckboxX - GIZMO_CHECKBOX_MARGIN, itemMidY);
      } catch (error) {
      }
    }
    graphic.endClipRect();
    if (totalItemsHeight > itemsHeight) {
      const maxTreeScrollY = totalItemsHeight - itemsHeight;
      const scrollRatio = this.#treeScrollY / maxTreeScrollY;
      const barHeight = System28.Math.max(20, itemsHeight * itemsHeight / totalItemsHeight);
      const barY = itemsY + scrollRatio * (itemsHeight - barHeight);
      graphic.setFillColor(COLOR_SCROLLBAR);
      graphic.drawRect(Rect.create(panelX + panelWidth - SCROLL_BAR_WIDTH, barY, SCROLL_BAR_WIDTH, barHeight));
    }
    graphic.endClipRect();
  }
  //==============================================================================
  // 인스펙터 패널 출력.
  //==============================================================================
  /**
   * @param { Graphic } graphic
   * @param { number } panelX
   * @param { number } panelY
   * @param { number } panelWidth
   * @param { number } panelHeight
   */
  drawInspectorPanel(graphic, panelX, panelY, panelWidth, panelHeight) {
    graphic.beginClipRect(Rect.create(panelX, panelY, panelWidth, panelHeight));
    if (!this.#selectedNode) {
      graphic.setFillColor(COLOR_TEXT_DIM);
      graphic.setFontString(`${FONT_SIZE}px monospace`);
      graphic.setTextAlign("center");
      graphic.setTextBaseline("middle");
      graphic.drawFillText("\uB178\uB4DC\uB97C \uC120\uD0DD\uD558\uC138\uC694", panelX + panelWidth * 0.5, panelY + panelHeight * 0.5);
      graphic.endClipRect();
      return;
    }
    const inspectorLines = this.buildInspectorLines(this.#selectedNode);
    const totalContentHeight = inspectorLines.length * ITEM_HEIGHT;
    if (totalContentHeight > panelHeight) {
      const maxInspectorScrollY = totalContentHeight - panelHeight;
      this.#inspectorScrollY = System28.Math.min(this.#inspectorScrollY, maxInspectorScrollY);
    } else {
      this.#inspectorScrollY = 0;
    }
    for (let lineIndex = 0; lineIndex < inspectorLines.length; ++lineIndex) {
      try {
        const line = inspectorLines[lineIndex];
        const lineY = panelY + lineIndex * ITEM_HEIGHT - this.#inspectorScrollY;
        if (lineY + ITEM_HEIGHT < panelY || lineY > panelY + panelHeight) {
          continue;
        }
        const lineMidY = lineY + ITEM_HEIGHT * 0.5;
        if (line.isSeparator) {
          graphic.setStrokeColor("rgba(75, 60, 35, 0.8)");
          graphic.drawLine([
            Vector2.create(panelX + PADDING, lineMidY + 0.5),
            Vector2.create(panelX + panelWidth - PADDING, lineMidY + 0.5)
          ], 1);
          continue;
        }
        if (line.isSectionHeader) {
          graphic.setFillColor(COLOR_SECTION_HEADER_BACKGROUND);
          graphic.drawRect(Rect.create(panelX, lineY, panelWidth, ITEM_HEIGHT));
          graphic.setFillColor(line.color);
          graphic.setFontString(`bold ${FONT_SIZE}px monospace`);
          graphic.setTextBaseline("middle");
          graphic.setTextAlign("left");
          graphic.drawFillText(line.text, panelX + PADDING, lineMidY);
          continue;
        }
        if (line.isComponentHeader) {
          graphic.setFillColor(COLOR_COMPONENT_HEADER_BACKGROUND);
          graphic.drawRect(Rect.create(panelX, lineY, panelWidth, ITEM_HEIGHT));
          const isExpanded = !this.#collapsedComponents.has(line.componentRef);
          graphic.setFillColor(isExpanded ? COLOR_ACCENT : COLOR_TEXT_DIM);
          graphic.setFontString(`${FONT_SIZE}px monospace`);
          graphic.setTextBaseline("middle");
          graphic.setTextAlign("left");
          const expandText = isExpanded ? "v" : ">";
          graphic.drawFillText(expandText, panelX + PADDING, lineMidY);
          graphic.setFillColor(line.color);
          graphic.setFontString(`bold ${FONT_SIZE}px monospace`);
          graphic.drawFillText(line.value, panelX + PADDING + 14, lineMidY);
          continue;
        }
        graphic.setFontString(`${FONT_SIZE}px monospace`);
        graphic.setTextBaseline("middle");
        if (line.isComponentProperty) {
          graphic.setFillColor(COLOR_TEXT_DIM);
          graphic.setTextAlign("left");
          graphic.drawFillText(line.text, panelX + PADDING, lineMidY);
          graphic.setFillColor(line.color);
          graphic.drawFillText(line.value, panelX + PADDING + LABEL_COLUMN_WIDTH, lineMidY);
          continue;
        }
        if (line.text) {
          graphic.setFillColor(COLOR_TEXT_DIM);
          graphic.setTextAlign("left");
          graphic.drawFillText(line.text, panelX + PADDING, lineMidY);
          graphic.setFillColor(line.color);
          graphic.drawFillText(line.value, panelX + PADDING + LABEL_COLUMN_WIDTH, lineMidY);
          continue;
        }
        graphic.setFillColor(line.color);
        graphic.setTextAlign("left");
        graphic.drawFillText(line.value, panelX + PADDING, lineMidY);
      } catch (error) {
      }
    }
    if (totalContentHeight > panelHeight) {
      const maxInspectorScrollY = totalContentHeight - panelHeight;
      const scrollRatio = this.#inspectorScrollY / maxInspectorScrollY;
      const barHeight = System28.Math.max(20, panelHeight * panelHeight / totalContentHeight);
      const barY = panelY + scrollRatio * (panelHeight - barHeight);
      graphic.setFillColor(COLOR_SCROLLBAR);
      graphic.drawRect(Rect.create(panelX + panelWidth - SCROLL_BAR_WIDTH, barY, SCROLL_BAR_WIDTH, barHeight));
    }
    graphic.endClipRect();
  }
  //==============================================================================
  // 로컬 스토리지 패널 출력.
  //==============================================================================
  /**
   * @param { Graphic } graphic
   * @param { number } panelX
   * @param { number } panelY
   * @param { number } panelWidth
   * @param { number } panelHeight
   */
  drawLocalStoragePanel(graphic, panelX, panelY, panelWidth, panelHeight) {
    graphic.beginClipRect(Rect.create(panelX, panelY, panelWidth, panelHeight));
    graphic.setFillColor(COLOR_SECTION_HEADER_BACKGROUND);
    graphic.drawRect(Rect.create(panelX, panelY, panelWidth, ITEM_HEIGHT));
    graphic.setFillColor(COLOR_ACCENT);
    graphic.setFontString(`bold ${FONT_SIZE}px monospace`);
    graphic.setTextAlign("left");
    graphic.setTextBaseline("middle");
    graphic.drawFillText("Local Storage", panelX + PADDING, panelY + ITEM_HEIGHT * 0.5);
    const addBtnWidth = 48;
    const clearBtnWidth = 48;
    const btnHeight = ITEM_HEIGHT - 4;
    const btnY = panelY + 2;
    const clearBtnX = panelX + panelWidth - PADDING - clearBtnWidth;
    const addBtnX = clearBtnX - PADDING - addBtnWidth;
    graphic.setFillColor("rgba(60, 100, 60, 0.9)");
    graphic.drawRect(Rect.create(addBtnX, btnY, addBtnWidth, btnHeight));
    graphic.setFillColor("#8cc878");
    graphic.setFontString(`${FONT_SIZE - 1}px monospace`);
    graphic.setTextAlign("center");
    graphic.drawFillText("+ Add", addBtnX + addBtnWidth * 0.5, panelY + ITEM_HEIGHT * 0.5);
    graphic.setFillColor("rgba(100, 40, 30, 0.9)");
    graphic.drawRect(Rect.create(clearBtnX, btnY, clearBtnWidth, btnHeight));
    graphic.setFillColor("#c87878");
    graphic.setTextAlign("center");
    graphic.drawFillText("Clear", clearBtnX + clearBtnWidth * 0.5, panelY + ITEM_HEIGHT * 0.5);
    const columnHeaderY = panelY + ITEM_HEIGHT;
    graphic.setFillColor(COLOR_COMPONENT_HEADER_BACKGROUND);
    graphic.drawRect(Rect.create(panelX, columnHeaderY, panelWidth, ITEM_HEIGHT));
    const delColWidth = 24;
    const availableWidth = panelWidth - delColWidth - SCROLL_BAR_WIDTH;
    const keyColWidth = System28.Math.floor(availableWidth * 0.4);
    const valueColWidth = availableWidth - keyColWidth;
    graphic.setFillColor(COLOR_TEXT_DIM);
    graphic.setFontString(`${FONT_SIZE - 1}px monospace`);
    graphic.setTextAlign("left");
    graphic.setTextBaseline("middle");
    graphic.drawFillText("Key", panelX + PADDING, columnHeaderY + ITEM_HEIGHT * 0.5);
    graphic.drawFillText("Value", panelX + keyColWidth + PADDING, columnHeaderY + ITEM_HEIGHT * 0.5);
    graphic.setTextAlign("center");
    graphic.drawFillText("\xD7", panelX + panelWidth - SCROLL_BAR_WIDTH - delColWidth * 0.5, columnHeaderY + ITEM_HEIGHT * 0.5);
    const keys = LocalStorage.getKeys();
    const itemsY = panelY + ITEM_HEIGHT * 2;
    const contextMenuHeight = ITEM_HEIGHT + 8;
    const hasSelection = this.#selectedLocalStorageKey !== null;
    const itemsHeight = panelHeight - ITEM_HEIGHT * 2 - (hasSelection ? contextMenuHeight : 0);
    const totalItemsHeight = keys.length * ITEM_HEIGHT;
    if (totalItemsHeight > itemsHeight) {
      const maxScrollY = totalItemsHeight - itemsHeight;
      this.#localStorageScrollY = System28.Math.min(this.#localStorageScrollY, maxScrollY);
    } else {
      this.#localStorageScrollY = 0;
    }
    graphic.beginClipRect(Rect.create(panelX, itemsY, panelWidth, itemsHeight));
    for (let keyIndex = 0; keyIndex < keys.length; ++keyIndex) {
      const key = keys[keyIndex];
      const rawValue = LocalStorage.getString(key);
      const itemY = itemsY + keyIndex * ITEM_HEIGHT - this.#localStorageScrollY;
      if (itemY + ITEM_HEIGHT < itemsY || itemY > itemsY + itemsHeight) {
        continue;
      }
      const itemMidY = itemY + ITEM_HEIGHT * 0.5;
      const isSelected = key === this.#selectedLocalStorageKey;
      if (isSelected) {
        graphic.setFillColor(COLOR_ITEM_SELECTED);
        graphic.drawRect(Rect.create(panelX, itemY, panelWidth - SCROLL_BAR_WIDTH, ITEM_HEIGHT));
      }
      graphic.setStrokeColor(COLOR_SPLITTER);
      graphic.drawLine([
        Vector2.create(panelX, itemY + ITEM_HEIGHT - 0.5),
        Vector2.create(panelX + panelWidth - SCROLL_BAR_WIDTH, itemY + ITEM_HEIGHT - 0.5)
      ], 1);
      graphic.setFillColor(COLOR_ACCENT);
      graphic.setFontString(`${FONT_SIZE}px monospace`);
      graphic.setTextAlign("left");
      graphic.setTextBaseline("middle");
      const maxKeyChars = System28.Math.floor(keyColWidth / 7);
      const keyText = key.length > maxKeyChars ? key.slice(0, maxKeyChars - 3) + "..." : key;
      graphic.drawFillText(keyText, panelX + PADDING, itemMidY);
      graphic.setFillColor(COLOR_PROPERTY_VALUE);
      const valueStr = rawValue !== null ? rawValue : "(null)";
      const maxValueChars = System28.Math.floor(valueColWidth / 7);
      const valueText = valueStr.length > maxValueChars ? valueStr.slice(0, maxValueChars - 3) + "..." : valueStr;
      graphic.drawFillText(valueText, panelX + keyColWidth + PADDING, itemMidY);
      const delBtnX = panelX + panelWidth - SCROLL_BAR_WIDTH - delColWidth;
      graphic.setFillColor("rgba(100, 40, 30, 0.6)");
      graphic.drawRect(Rect.create(delBtnX + 2, itemY + 2, delColWidth - 4, ITEM_HEIGHT - 4));
      graphic.setFillColor("#c87878");
      graphic.setFontString(`${FONT_SIZE}px monospace`);
      graphic.setTextAlign("center");
      graphic.drawFillText("\xD7", delBtnX + delColWidth * 0.5, itemMidY);
    }
    if (keys.length === 0) {
      graphic.setFillColor(COLOR_TEXT_DIM);
      graphic.setFontString(`${FONT_SIZE}px monospace`);
      graphic.setTextAlign("center");
      graphic.setTextBaseline("middle");
      graphic.drawFillText("(\uBE44\uC5B4\uC788\uC74C)", panelX + panelWidth * 0.5, itemsY + itemsHeight * 0.5);
    }
    graphic.endClipRect();
    if (totalItemsHeight > itemsHeight) {
      const maxScrollY = totalItemsHeight - itemsHeight;
      const scrollRatio = this.#localStorageScrollY / maxScrollY;
      const barHeight = System28.Math.max(20, itemsHeight * itemsHeight / totalItemsHeight);
      const barY = itemsY + scrollRatio * (itemsHeight - barHeight);
      graphic.setFillColor(COLOR_SCROLLBAR);
      graphic.drawRect(Rect.create(panelX + panelWidth - SCROLL_BAR_WIDTH, barY, SCROLL_BAR_WIDTH, barHeight));
    }
    if (hasSelection) {
      const contextMenuY = panelY + panelHeight - contextMenuHeight;
      graphic.setFillColor(COLOR_COMPONENT_HEADER_BACKGROUND);
      graphic.drawRect(Rect.create(panelX, contextMenuY, panelWidth, contextMenuHeight));
      graphic.setStrokeColor(COLOR_BORDER_NORMAL);
      graphic.drawLine([
        Vector2.create(panelX, contextMenuY + 0.5),
        Vector2.create(panelX + panelWidth, contextMenuY + 0.5)
      ], 1);
      const contextButtonTexts = ["Edit Key", "Edit Value", "Duplicate", "Remove"];
      const contextButtonColors = ["rgba(50,80,50,0.9)", "rgba(40,60,90,0.9)", "rgba(40,70,100,0.9)", "rgba(100,40,30,0.9)"];
      const contextButtonTextColors = ["#8cc878", "#a8c8e8", "#78b4c8", "#c87878"];
      const contextButtonCount = contextButtonTexts.length;
      const contextButtonGap = 4;
      const contextButtonHeight = contextMenuHeight - 8;
      const contextButtonTextPadding = 10;
      graphic.setFontString(`${FONT_SIZE - 1}px monospace`);
      const contextButtonWidths = [];
      for (let labelIndex = 0; labelIndex < contextButtonCount; ++labelIndex) {
        const measuredTextWidth = graphic.measureText(contextButtonTexts[labelIndex]).width;
        contextButtonWidths.push(System28.Math.ceil(measuredTextWidth) + contextButtonTextPadding * 2);
      }
      let totalContextButtonWidth = contextButtonGap * (contextButtonCount - 1);
      for (let widthIndex = 0; widthIndex < contextButtonWidths.length; ++widthIndex) {
        totalContextButtonWidth += contextButtonWidths[widthIndex];
      }
      const contextButtonStartX = panelX + panelWidth - PADDING - totalContextButtonWidth;
      const contextButtonY = contextMenuY + (contextMenuHeight - contextButtonHeight) * 0.5;
      graphic.setTextBaseline("middle");
      graphic.setTextAlign("center");
      this.#ctxButtonRects = [];
      let currentContextButtonX = contextButtonStartX;
      for (let buttonIndex = 0; buttonIndex < contextButtonCount; ++buttonIndex) {
        const contextButtonX = currentContextButtonX;
        const contextButtonWidth = contextButtonWidths[buttonIndex];
        this.#ctxButtonRects.push({ x: contextButtonX, y: contextButtonY, width: contextButtonWidth, height: contextButtonHeight });
        graphic.setFillColor(contextButtonColors[buttonIndex]);
        graphic.drawRect(Rect.create(contextButtonX, contextButtonY, contextButtonWidth, contextButtonHeight));
        graphic.setFillColor(contextButtonTextColors[buttonIndex]);
        graphic.drawFillText(contextButtonTexts[buttonIndex], contextButtonX + contextButtonWidth * 0.5, contextMenuY + contextMenuHeight * 0.5);
        currentContextButtonX += contextButtonWidth + contextButtonGap;
      }
    }
    graphic.endClipRect();
  }
  //==============================================================================
  // 화면 비율 가이드라인 출력.
  //==============================================================================
  /**
   * @param { Graphic } graphic
   */
  drawAspectGuide(graphic) {
    if (!this.#isHeightAspectGuideVisible && !this.#isWidthAspectGuideVisible) {
      return;
    }
    if (!this.#engine) {
      return;
    }
    const viewManager = this.#engine.getViewManager();
    const viewScaleMode = viewManager.getViewScaleMode();
    const isStretchMode = viewScaleMode === ViewScaleMode.stretchWidth || viewScaleMode === ViewScaleMode.stretchHeight || viewScaleMode === ViewScaleMode.stretchShort || viewScaleMode === ViewScaleMode.stretchWidthExpandHeight || viewScaleMode === ViewScaleMode.stretchHeightExpandWidth || viewScaleMode === ViewScaleMode.stretchShortExpandLong;
    if (!isStretchMode) {
      return;
    }
    const viewSize = viewManager.getViewSize();
    const viewWidth = viewSize.x;
    const viewHeight = viewSize.y;
    const centerX = viewWidth * 0.5;
    const centerY = viewHeight * 0.5;
    graphic.pushState();
    if (this.#isHeightAspectGuideVisible) {
      const heightFixed = viewHeight;
      const heightBasedWidth100 = viewHeight * 1;
      const heightBasedWidth75 = viewHeight * 0.75;
      const heightBasedWidth50 = viewHeight * 0.5;
      graphic.setStrokeColor("rgba(80, 200, 240, 1)");
      graphic.drawStrokeRect(Rect.create(centerX - heightBasedWidth100 * 0.5, centerY - heightFixed * 0.5, heightBasedWidth100, heightFixed), 2);
      graphic.drawStrokeRect(Rect.create(centerX - heightBasedWidth75 * 0.5, centerY - heightFixed * 0.5, heightBasedWidth75, heightFixed), 2);
      graphic.drawStrokeRect(Rect.create(centerX - heightBasedWidth50 * 0.5, centerY - heightFixed * 0.5, heightBasedWidth50, heightFixed), 2);
    }
    if (this.#isWidthAspectGuideVisible) {
      const widthFixed = viewWidth;
      const widthBasedHeight100 = viewWidth * 1;
      const widthBasedHeight75 = viewWidth * 0.75;
      const widthBasedHeight50 = viewWidth * 0.5;
      graphic.setStrokeColor("rgba(240, 180, 80, 1)");
      graphic.drawStrokeRect(Rect.create(centerX - widthFixed * 0.5, centerY - widthBasedHeight100 * 0.5, widthFixed, widthBasedHeight100), 2);
      graphic.drawStrokeRect(Rect.create(centerX - widthFixed * 0.5, centerY - widthBasedHeight75 * 0.5, widthFixed, widthBasedHeight75), 2);
      graphic.drawStrokeRect(Rect.create(centerX - widthFixed * 0.5, centerY - widthBasedHeight50 * 0.5, widthFixed, widthBasedHeight50), 2);
    }
    graphic.popState();
  }
  //==============================================================================
  // 세팅 패널 출력.
  //==============================================================================
  /**
   * @param { Graphic } graphic
   * @param { number } panelX
   * @param { number } panelY
   * @param { number } panelWidth
   * @param { number } panelHeight
   */
  drawSettingsPanel(graphic, panelX, panelY, panelWidth, panelHeight) {
    graphic.beginClipRect(Rect.create(panelX, panelY, panelWidth, panelHeight));
    graphic.setFillColor(COLOR_SECTION_HEADER_BACKGROUND);
    graphic.drawRect(Rect.create(panelX, panelY, panelWidth, ITEM_HEIGHT));
    graphic.setFillColor(COLOR_ACCENT);
    graphic.setFontString(`bold ${FONT_SIZE}px monospace`);
    graphic.setTextAlign("left");
    graphic.setTextBaseline("middle");
    graphic.drawFillText("Settings", panelX + PADDING, panelY + ITEM_HEIGHT * 0.5);
    const dimRowY = panelY + ITEM_HEIGHT;
    const dimRowMidY = dimRowY + ITEM_HEIGHT * 0.5;
    graphic.setFillColor(COLOR_TEXT);
    graphic.setFontString(`${FONT_SIZE}px monospace`);
    graphic.setTextAlign("left");
    graphic.setTextBaseline("middle");
    graphic.drawFillText("Dim Background", panelX + PADDING, dimRowMidY);
    const dimCheckboxX = panelX + PADDING + 120;
    const dimCheckboxY = System28.Math.floor(dimRowMidY - GIZMO_CHECKBOX_SIZE * 0.5);
    graphic.setFillColor(this.#isDimEnabled ? COLOR_TRUE : COLOR_ACCENT);
    graphic.drawRect(Rect.create(dimCheckboxX, dimCheckboxY, GIZMO_CHECKBOX_SIZE, GIZMO_CHECKBOX_SIZE));
    if (!this.#isDimEnabled) {
      graphic.setFillColor("#16120a");
      graphic.drawRect(Rect.create(dimCheckboxX + 2, dimCheckboxY + 2, GIZMO_CHECKBOX_SIZE - 4, GIZMO_CHECKBOX_SIZE - 4));
    }
    const gizmosRowY = panelY + ITEM_HEIGHT * 2;
    const gizmosRowMidY = gizmosRowY + ITEM_HEIGHT * 0.5;
    graphic.setFillColor(COLOR_TEXT);
    graphic.setFontString(`${FONT_SIZE}px monospace`);
    graphic.setTextAlign("left");
    graphic.setTextBaseline("middle");
    graphic.drawFillText("Show All Gizmos", panelX + PADDING, gizmosRowMidY);
    const gizmosCheckboxX = panelX + PADDING + 120;
    const gizmosCheckboxY = System28.Math.floor(gizmosRowMidY - GIZMO_CHECKBOX_SIZE * 0.5);
    graphic.setFillColor(this.#isAllGizmosVisible ? COLOR_TRUE : COLOR_ACCENT);
    graphic.drawRect(Rect.create(gizmosCheckboxX, gizmosCheckboxY, GIZMO_CHECKBOX_SIZE, GIZMO_CHECKBOX_SIZE));
    if (!this.#isAllGizmosVisible) {
      graphic.setFillColor("#16120a");
      graphic.drawRect(Rect.create(gizmosCheckboxX + 2, gizmosCheckboxY + 2, GIZMO_CHECKBOX_SIZE - 4, GIZMO_CHECKBOX_SIZE - 4));
    }
    const heightAspectGuideRowY = panelY + ITEM_HEIGHT * 3;
    const heightAspectGuideRowMidY = heightAspectGuideRowY + ITEM_HEIGHT * 0.5;
    graphic.setFillColor(COLOR_TEXT);
    graphic.setFontString(`${FONT_SIZE}px monospace`);
    graphic.setTextAlign("left");
    graphic.setTextBaseline("middle");
    graphic.drawFillText("Show Height Aspect Guide", panelX + PADDING, heightAspectGuideRowMidY);
    const heightAspectGuideCheckboxX = panelX + PADDING + 168;
    const heightAspectGuideCheckboxY = System28.Math.floor(heightAspectGuideRowMidY - GIZMO_CHECKBOX_SIZE * 0.5);
    graphic.setFillColor(this.#isHeightAspectGuideVisible ? COLOR_TRUE : COLOR_ACCENT);
    graphic.drawRect(Rect.create(heightAspectGuideCheckboxX, heightAspectGuideCheckboxY, GIZMO_CHECKBOX_SIZE, GIZMO_CHECKBOX_SIZE));
    if (!this.#isHeightAspectGuideVisible) {
      graphic.setFillColor("#16120a");
      graphic.drawRect(Rect.create(heightAspectGuideCheckboxX + 2, heightAspectGuideCheckboxY + 2, GIZMO_CHECKBOX_SIZE - 4, GIZMO_CHECKBOX_SIZE - 4));
    }
    const widthAspectGuideRowY = panelY + ITEM_HEIGHT * 4;
    const widthAspectGuideRowMidY = widthAspectGuideRowY + ITEM_HEIGHT * 0.5;
    graphic.setFillColor(COLOR_TEXT);
    graphic.setFontString(`${FONT_SIZE}px monospace`);
    graphic.setTextAlign("left");
    graphic.setTextBaseline("middle");
    graphic.drawFillText("Show Width Aspect Guide", panelX + PADDING, widthAspectGuideRowMidY);
    const widthAspectGuideCheckboxX = panelX + PADDING + 168;
    const widthAspectGuideCheckboxY = System28.Math.floor(widthAspectGuideRowMidY - GIZMO_CHECKBOX_SIZE * 0.5);
    graphic.setFillColor(this.#isWidthAspectGuideVisible ? COLOR_TRUE : COLOR_ACCENT);
    graphic.drawRect(Rect.create(widthAspectGuideCheckboxX, widthAspectGuideCheckboxY, GIZMO_CHECKBOX_SIZE, GIZMO_CHECKBOX_SIZE));
    if (!this.#isWidthAspectGuideVisible) {
      graphic.setFillColor("#16120a");
      graphic.drawRect(Rect.create(widthAspectGuideCheckboxX + 2, widthAspectGuideCheckboxY + 2, GIZMO_CHECKBOX_SIZE - 4, GIZMO_CHECKBOX_SIZE - 4));
    }
    const framePerSecondRowY = panelY + ITEM_HEIGHT * 5;
    const framePerSecondRowMidY = framePerSecondRowY + ITEM_HEIGHT * 0.5;
    graphic.setFillColor(COLOR_TEXT);
    graphic.setFontString(`${FONT_SIZE}px monospace`);
    graphic.setTextAlign("left");
    graphic.setTextBaseline("middle");
    graphic.drawFillText("Show FPS", panelX + PADDING, framePerSecondRowMidY);
    const framePerSecondCheckboxX = panelX + PADDING + 120;
    const framePerSecondCheckboxY = System28.Math.floor(framePerSecondRowMidY - GIZMO_CHECKBOX_SIZE * 0.5);
    graphic.setFillColor(this.#isFramePerSecondVisible ? COLOR_TRUE : COLOR_ACCENT);
    graphic.drawRect(Rect.create(framePerSecondCheckboxX, framePerSecondCheckboxY, GIZMO_CHECKBOX_SIZE, GIZMO_CHECKBOX_SIZE));
    if (!this.#isFramePerSecondVisible) {
      graphic.setFillColor("#16120a");
      graphic.drawRect(Rect.create(framePerSecondCheckboxX + 2, framePerSecondCheckboxY + 2, GIZMO_CHECKBOX_SIZE - 4, GIZMO_CHECKBOX_SIZE - 4));
    }
    graphic.endClipRect();
  }
  //==============================================================================
  // 세팅 탭 눌림 처리.
  //==============================================================================
  /**
   * @param { number } touchX
   * @param { number } touchY
   * @param { number } panelX
   * @param { number } panelY
   * @param { number } panelWidth
   * @param { number } panelHeight
   */
  handleSettingsPress(touchX, touchY, panelX, panelY, panelWidth, panelHeight) {
    const dimRowY = panelY + ITEM_HEIGHT;
    const dimRowMidY = dimRowY + ITEM_HEIGHT * 0.5;
    const dimCheckboxX = panelX + PADDING + 120;
    const dimCheckboxY = System28.Math.floor(dimRowMidY - GIZMO_CHECKBOX_SIZE * 0.5);
    const isDimCheckboxHit = touchX >= dimCheckboxX && touchX <= dimCheckboxX + GIZMO_CHECKBOX_SIZE && touchY >= dimCheckboxY && touchY <= dimCheckboxY + GIZMO_CHECKBOX_SIZE;
    if (isDimCheckboxHit) {
      this.#isDimEnabled = !this.#isDimEnabled;
      this.saveSettings();
      return;
    }
    const gizmosRowY = panelY + ITEM_HEIGHT * 2;
    const gizmosRowMidY = gizmosRowY + ITEM_HEIGHT * 0.5;
    const gizmosCheckboxX = panelX + PADDING + 120;
    const gizmosCheckboxY = System28.Math.floor(gizmosRowMidY - GIZMO_CHECKBOX_SIZE * 0.5);
    const isGizmosCheckboxHit = touchX >= gizmosCheckboxX && touchX <= gizmosCheckboxX + GIZMO_CHECKBOX_SIZE && touchY >= gizmosCheckboxY && touchY <= gizmosCheckboxY + GIZMO_CHECKBOX_SIZE;
    if (isGizmosCheckboxHit) {
      this.#isAllGizmosVisible = !this.#isAllGizmosVisible;
      const graphic = this.#engine.getGraphic();
      graphic.setForceGizmosVisible(this.#isAllGizmosVisible);
      this.saveSettings();
      return;
    }
    const heightAspectGuideRowY = panelY + ITEM_HEIGHT * 3;
    const heightAspectGuideRowMidY = heightAspectGuideRowY + ITEM_HEIGHT * 0.5;
    const heightAspectGuideCheckboxX = panelX + PADDING + 168;
    const heightAspectGuideCheckboxY = System28.Math.floor(heightAspectGuideRowMidY - GIZMO_CHECKBOX_SIZE * 0.5);
    const isHeightAspectGuideCheckboxHit = touchX >= heightAspectGuideCheckboxX && touchX <= heightAspectGuideCheckboxX + GIZMO_CHECKBOX_SIZE && touchY >= heightAspectGuideCheckboxY && touchY <= heightAspectGuideCheckboxY + GIZMO_CHECKBOX_SIZE;
    if (isHeightAspectGuideCheckboxHit) {
      this.#isHeightAspectGuideVisible = !this.#isHeightAspectGuideVisible;
      this.saveSettings();
      return;
    }
    const widthAspectGuideRowY = panelY + ITEM_HEIGHT * 4;
    const widthAspectGuideRowMidY = widthAspectGuideRowY + ITEM_HEIGHT * 0.5;
    const widthAspectGuideCheckboxX = panelX + PADDING + 168;
    const widthAspectGuideCheckboxY = System28.Math.floor(widthAspectGuideRowMidY - GIZMO_CHECKBOX_SIZE * 0.5);
    const isWidthAspectGuideCheckboxHit = touchX >= widthAspectGuideCheckboxX && touchX <= widthAspectGuideCheckboxX + GIZMO_CHECKBOX_SIZE && touchY >= widthAspectGuideCheckboxY && touchY <= widthAspectGuideCheckboxY + GIZMO_CHECKBOX_SIZE;
    if (isWidthAspectGuideCheckboxHit) {
      this.#isWidthAspectGuideVisible = !this.#isWidthAspectGuideVisible;
      this.saveSettings();
      return;
    }
    const framePerSecondRowY = panelY + ITEM_HEIGHT * 5;
    const framePerSecondRowMidY = framePerSecondRowY + ITEM_HEIGHT * 0.5;
    const framePerSecondCheckboxX = panelX + PADDING + 120;
    const framePerSecondCheckboxY = System28.Math.floor(framePerSecondRowMidY - GIZMO_CHECKBOX_SIZE * 0.5);
    const isFramePerSecondCheckboxHit = touchX >= framePerSecondCheckboxX && touchX <= framePerSecondCheckboxX + GIZMO_CHECKBOX_SIZE && touchY >= framePerSecondCheckboxY && touchY <= framePerSecondCheckboxY + GIZMO_CHECKBOX_SIZE;
    if (isFramePerSecondCheckboxHit) {
      this.#isFramePerSecondVisible = !this.#isFramePerSecondVisible;
      this.saveSettings();
    }
  }
  //==============================================================================
  // 설정 불러오기.
  //==============================================================================
  loadSettings() {
    if (!LocalStorage.containsKey(SETTINGS_STORAGE_KEY)) {
      return;
    }
    const settingsJson = LocalStorage.getString(SETTINGS_STORAGE_KEY);
    try {
      const settingsObject = System28.JSON.parse(settingsJson);
      if (typeof settingsObject.dimEnabled === "boolean") {
        this.#isDimEnabled = settingsObject.dimEnabled;
      }
      if (typeof settingsObject.allGizmosVisible === "boolean") {
        this.#isAllGizmosVisible = settingsObject.allGizmosVisible;
      }
      if (typeof settingsObject.heightAspectGuideVisible === "boolean") {
        this.#isHeightAspectGuideVisible = settingsObject.heightAspectGuideVisible;
      }
      if (typeof settingsObject.widthAspectGuideVisible === "boolean") {
        this.#isWidthAspectGuideVisible = settingsObject.widthAspectGuideVisible;
      }
      if (typeof settingsObject.framePerSecondVisible === "boolean") {
        this.#isFramePerSecondVisible = settingsObject.framePerSecondVisible;
      }
    } catch (error) {
    }
  }
  //==============================================================================
  // 설정 저장.
  //==============================================================================
  saveSettings() {
    const settingsObject = { dimEnabled: this.#isDimEnabled, allGizmosVisible: this.#isAllGizmosVisible, heightAspectGuideVisible: this.#isHeightAspectGuideVisible, widthAspectGuideVisible: this.#isWidthAspectGuideVisible, framePerSecondVisible: this.#isFramePerSecondVisible };
    const settingsJson = System28.JSON.stringify(settingsObject);
    LocalStorage.setString(SETTINGS_STORAGE_KEY, settingsJson);
  }
  //==============================================================================
  // FPS 표시 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isFramePerSecondVisible() {
    return this.#isFramePerSecondVisible;
  }
  //==============================================================================
  // 통계 항목 수집.
  //==============================================================================
  gatherStatisticsItems() {
    const items = [];
    const platform = this.#engine.getPlatform();
    const viewManager = this.#engine.getViewManager();
    const inputManager = this.#engine.getInputManager();
    const timeManager = this.#engine.getTimeManager();
    platform.getPlatformInfo();
    items.push({ key: "Platform", value: "", isSeparator: false, isSectionHeader: true });
    const versionString = this.#engine.getVersionString();
    items.push({ key: "engineVersion", value: versionString, isSeparator: false, isSectionHeader: false });
    const platformName = platform.platformName;
    items.push({ key: "platformName", value: platformName, isSeparator: false, isSectionHeader: false });
    const browserName = platform.browserName;
    items.push({ key: "browserName", value: browserName, isSeparator: false, isSectionHeader: false });
    items.push({ key: "Screen", value: "", isSeparator: false, isSectionHeader: true });
    const clientNativeSize = viewManager.getClientNativeSize();
    const clientNativeSizeText = `(${clientNativeSize.x}, ${clientNativeSize.y})`;
    items.push({ key: "clientNativeSize", value: clientNativeSizeText, isSeparator: false, isSectionHeader: false });
    const canvasNativeSize = viewManager.getCanvasNativeSize();
    const canvasNativeSizeText = `(${canvasNativeSize.x}, ${canvasNativeSize.y})`;
    items.push({ key: "canvasNativeSize", value: canvasNativeSizeText, isSeparator: false, isSectionHeader: false });
    const canvasPixelSize = viewManager.getCanvasPixelSize();
    const canvasPixelSizeText = `(${canvasPixelSize.x}, ${canvasPixelSize.y})`;
    items.push({ key: "canvasPixelSize", value: canvasPixelSizeText, isSeparator: false, isSectionHeader: false });
    const referenceResolutionSize = viewManager.getReferenceResolutionSize();
    const referenceResolutionSizeText = `(${referenceResolutionSize.x}, ${referenceResolutionSize.y})`;
    items.push({ key: "referenceResolutionSize", value: referenceResolutionSizeText, isSeparator: false, isSectionHeader: false });
    items.push({ key: "screenSize", value: "(N/A)", isSeparator: false, isSectionHeader: false });
    const viewScaleMode = viewManager.getViewScaleMode();
    items.push({ key: "viewScaleMode", value: viewScaleMode, isSeparator: false, isSectionHeader: false });
    const viewNativeRect = viewManager.getViewNativeRect();
    const viewNativeRectText = `(${viewNativeRect.position.x}, ${viewNativeRect.position.y}) - (${viewNativeRect.size.x}, ${viewNativeRect.size.y})`;
    items.push({ key: "viewNativeRect", value: viewNativeRectText, isSeparator: false, isSectionHeader: false });
    const viewSize = viewManager.getViewSize();
    const viewSizeText = `(${viewSize.x}, ${viewSize.y})`;
    items.push({ key: "viewSize", value: viewSizeText, isSeparator: false, isSectionHeader: false });
    const canvasNativeInputPosition = inputManager.getCanvasNativeInputPosition();
    const canvasNativeInputPositionText = `(${canvasNativeInputPosition.x}, ${canvasNativeInputPosition.y})`;
    items.push({ key: "canvasNativeInputPosition", value: canvasNativeInputPositionText, isSeparator: false, isSectionHeader: false });
    const viewInputPosition = inputManager.getViewInputPosition();
    const viewInputPositionText = `(${viewInputPosition.x}, ${viewInputPosition.y})`;
    items.push({ key: "viewInputPosition", value: viewInputPositionText, isSeparator: false, isSectionHeader: false });
    items.push({ key: "Time", value: "", isSeparator: false, isSectionHeader: true });
    const realtimeSinceStartup = timeManager.getRealtimeSinceStartup();
    const realtimeSinceStartupText = `${realtimeSinceStartup.toFixed(2)}s`;
    items.push({ key: "realtimeSinceStartup", value: realtimeSinceStartupText, isSeparator: false, isSectionHeader: false });
    const time = timeManager.getTime();
    const timeText = `${time.toFixed(2)}s`;
    items.push({ key: "time", value: timeText, isSeparator: false, isSectionHeader: false });
    const framePerSecond = timeManager.getFramePerSecond();
    const framePerSecondText = `${framePerSecond}`;
    items.push({ key: "framePerSecond", value: framePerSecondText, isSeparator: false, isSectionHeader: false });
    const timeDelta = timeManager.getTimeDelta();
    const timeDeltaText = `${timeDelta.toFixed(3)}s`;
    items.push({ key: "timeDelta", value: timeDeltaText, isSeparator: false, isSectionHeader: false });
    items.push({ key: "Memory (Chrome Only)", value: "", isSeparator: false, isSectionHeader: true });
    const performanceMemory = System28.window.performance ? System28.window.performance.memory : null;
    if (performanceMemory) {
      const usedHeapMegabytes = (performanceMemory.usedJSHeapSize / (1024 * 1024)).toFixed(2);
      items.push({ key: "usedJSHeapSize", value: `${usedHeapMegabytes} MB`, isSeparator: false, isSectionHeader: false });
      const totalHeapMegabytes = (performanceMemory.totalJSHeapSize / (1024 * 1024)).toFixed(2);
      items.push({ key: "totalJSHeapSize", value: `${totalHeapMegabytes} MB`, isSeparator: false, isSectionHeader: false });
      const heapLimitMegabytes = (performanceMemory.jsHeapSizeLimit / (1024 * 1024)).toFixed(2);
      items.push({ key: "jsHeapSizeLimit", value: `${heapLimitMegabytes} MB`, isSeparator: false, isSectionHeader: false });
    } else {
      items.push({ key: "usedJSHeapSize", value: "(N/A)", isSeparator: false, isSectionHeader: false });
      items.push({ key: "totalJSHeapSize", value: "(N/A)", isSeparator: false, isSectionHeader: false });
      items.push({ key: "jsHeapSizeLimit", value: "(N/A)", isSeparator: false, isSectionHeader: false });
    }
    return items;
  }
  //==============================================================================
  // 통계 패널 출력.
  //==============================================================================
  /**
   * @param { Graphic } graphic
   * @param { number } panelX
   * @param { number } panelY
   * @param { number } panelWidth
   * @param { number } panelHeight
   */
  drawStatisticsPanel(graphic, panelX, panelY, panelWidth, panelHeight) {
    graphic.beginClipRect(Rect.create(panelX, panelY, panelWidth, panelHeight));
    graphic.setFillColor(COLOR_SECTION_HEADER_BACKGROUND);
    graphic.drawRect(Rect.create(panelX, panelY, panelWidth, ITEM_HEIGHT));
    graphic.setFillColor(COLOR_ACCENT);
    graphic.setFontString(`bold ${FONT_SIZE}px monospace`);
    graphic.setTextAlign("left");
    graphic.setTextBaseline("middle");
    graphic.drawFillText("Statistics", panelX + PADDING, panelY + ITEM_HEIGHT * 0.5);
    const availableWidth = panelWidth - SCROLL_BAR_WIDTH;
    const keyColumnWidth = System28.Math.floor(availableWidth * 0.4);
    const statisticsItems = this.gatherStatisticsItems();
    const itemsY = panelY + ITEM_HEIGHT;
    const itemsHeight = panelHeight - ITEM_HEIGHT;
    const totalItemsHeight = statisticsItems.length * ITEM_HEIGHT;
    if (totalItemsHeight > itemsHeight) {
      const maxStatisticsScrollY = totalItemsHeight - itemsHeight;
      this.#statisticsScrollY = System28.Math.min(this.#statisticsScrollY, maxStatisticsScrollY);
    } else {
      this.#statisticsScrollY = 0;
    }
    const valueColumnWidth = availableWidth - keyColumnWidth;
    const maxKeyCharacters = System28.Math.floor(keyColumnWidth / 7);
    const maxValueCharacters = System28.Math.floor(valueColumnWidth / 7);
    graphic.beginClipRect(Rect.create(panelX, itemsY, panelWidth, itemsHeight));
    for (let itemIndex = 0; itemIndex < statisticsItems.length; ++itemIndex) {
      const statisticsItem = statisticsItems[itemIndex];
      const itemY = itemsY + itemIndex * ITEM_HEIGHT - this.#statisticsScrollY;
      if (itemY + ITEM_HEIGHT < itemsY || itemY > itemsY + itemsHeight) {
        continue;
      }
      const itemMidY = itemY + ITEM_HEIGHT * 0.5;
      if (statisticsItem.isSeparator) {
        graphic.setStrokeColor(COLOR_SPLITTER);
        graphic.drawLine([
          Vector2.create(panelX, itemMidY + 0.5),
          Vector2.create(panelX + availableWidth, itemMidY + 0.5)
        ], 1);
        continue;
      }
      if (statisticsItem.isSectionHeader) {
        graphic.setFillColor(COLOR_COMPONENT_HEADER_BACKGROUND);
        graphic.drawRect(Rect.create(panelX, itemY, availableWidth, ITEM_HEIGHT));
        graphic.setFillColor(COLOR_ACCENT);
        graphic.drawRect(Rect.create(panelX + PADDING, itemY + 4, 2, ITEM_HEIGHT - 8));
        graphic.setFillColor(COLOR_TEXT);
        graphic.setFontString(`${FONT_SIZE}px monospace`);
        graphic.setTextAlign("left");
        graphic.setTextBaseline("middle");
        graphic.drawFillText(statisticsItem.key, panelX + PADDING + 8, itemMidY);
        continue;
      }
      const isSelected = statisticsItem.key === this.#selectedStatisticsKey;
      if (isSelected) {
        graphic.setFillColor(COLOR_ITEM_SELECTED);
        graphic.drawRect(Rect.create(panelX, itemY, availableWidth, ITEM_HEIGHT));
      }
      graphic.setStrokeColor(COLOR_SPLITTER);
      graphic.drawLine([
        Vector2.create(panelX, itemY + ITEM_HEIGHT - 0.5),
        Vector2.create(panelX + availableWidth, itemY + ITEM_HEIGHT - 0.5)
      ], 1);
      graphic.setFontString(`${FONT_SIZE}px monospace`);
      graphic.setTextAlign("left");
      graphic.setTextBaseline("middle");
      graphic.setFillColor(COLOR_ACCENT);
      const keyText = statisticsItem.key.length > maxKeyCharacters ? statisticsItem.key.slice(0, maxKeyCharacters - 3) + "..." : statisticsItem.key;
      graphic.drawFillText(keyText, panelX + PADDING, itemMidY);
      graphic.setFillColor(COLOR_PROPERTY_VALUE);
      const valueText = statisticsItem.value.length > maxValueCharacters ? statisticsItem.value.slice(0, maxValueCharacters - 3) + "..." : statisticsItem.value;
      graphic.drawFillText(valueText, panelX + keyColumnWidth + PADDING, itemMidY);
    }
    graphic.endClipRect();
    if (totalItemsHeight > itemsHeight) {
      const maxStatisticsScrollY = totalItemsHeight - itemsHeight;
      const scrollRatio = this.#statisticsScrollY / maxStatisticsScrollY;
      const barHeight = System28.Math.max(20, itemsHeight * itemsHeight / totalItemsHeight);
      const barY = itemsY + scrollRatio * (itemsHeight - barHeight);
      graphic.setFillColor(COLOR_SCROLLBAR);
      graphic.drawRect(Rect.create(panelX + panelWidth - SCROLL_BAR_WIDTH, barY, SCROLL_BAR_WIDTH, barHeight));
    }
    graphic.endClipRect();
  }
  //==============================================================================
  // 통계 탭 눌림 처리.
  //==============================================================================
  /**
   * @param { number } touchX
   * @param { number } touchY
   * @param { number } panelX
   * @param { number } panelY
   * @param { number } panelWidth
   * @param { number } panelHeight
   */
  handleStatisticsPress(touchX, touchY, panelX, panelY, panelWidth, panelHeight) {
    const statisticsItems = this.gatherStatisticsItems();
    const itemsY = panelY + ITEM_HEIGHT;
    const localY = touchY - itemsY + this.#statisticsScrollY;
    const clickedIndex = System28.Math.floor(localY / ITEM_HEIGHT);
    if (touchY >= itemsY && clickedIndex >= 0 && clickedIndex < statisticsItems.length) {
      const clickedItem = statisticsItems[clickedIndex];
      if (!clickedItem.isSeparator && !clickedItem.isSectionHeader) {
        if (this.#selectedStatisticsKey === clickedItem.key) {
          this.#selectedStatisticsKey = null;
        } else {
          this.#selectedStatisticsKey = clickedItem.key;
        }
      }
    } else if (touchY >= itemsY) {
      this.#selectedStatisticsKey = null;
    }
    if (touchY >= itemsY) {
      this.#isStatisticsScrollDragging = true;
      this.#statisticsScrollDragStartMouseY = touchY;
      this.#statisticsScrollDragStartScrollY = this.#statisticsScrollY;
    }
  }
};

// src/ui/uiscene.js
var System29 = globalThis;
var UIScene = class extends Scene {
  static {
    __name(this, "UIScene");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { DEVTools } */
  #devtools;
  /** @private @type { TouchRecognizer } */
  #touchRaycaster;
  /** @private @type { number } */
  #lastViewSizeX;
  /** @private @type { number } */
  #lastViewSizeY;
  /** @private @type { ImageAsset | null } */
  #loadingImageAsset;
  /** @private @type { string } */
  #loadingImageUrl;
  /** @private @type { number } */
  #loadStartTime;
  /** @private @type { number } */
  #loadMinDurationMs;
  /** @private @type { boolean } */
  #loadTouchedToSkip;
  /** @private @type { Color } */
  #sceneBackgroundColor;
  /** @private @type { string } */
  #viewScaleMode;
  /** @private @type { LayoutSolver } */
  #solver;
  /** @private @type { UINode } */
  #screenNode;
  /** @private @type { UINode } */
  #safeAreaLayoutGuide;
  /** @private @type { { top: number, left: number, bottom: number, right: number } } */
  #safeAreaInsets;
  /** @private @type { LayoutConstraint[] } */
  #safeAreaLayoutGuideConstraints;
  //==============================================================================
  // 생성자.
  //==============================================================================
  constructor() {
    super();
    this.#loadingImageAsset = null;
    this.#loadingImageUrl = "";
    this.#loadStartTime = 0;
    this.#loadMinDurationMs = 3e3;
    this.#loadTouchedToSkip = false;
    this.#sceneBackgroundColor = Color.black();
    this.#viewScaleMode = ViewScaleMode.none;
  }
  //==============================================================================
  // ViewScaleMode 설정. 프로젝트별로 자유롭게 지정 가능.
  // - 디폴트는 ViewScaleMode.none. 엔진 기동 전 / 후 어디서든 호출 가능.
  // - 호출 시점에 엔진이 이미 attach 되어 있으면 즉시 viewManager 에 반영하고,
  //   아니면 initialize() 에서 일괄 적용된다.
  //==============================================================================
  /**
   * @param { string } viewScaleMode
   */
  setViewScaleMode(viewScaleMode) {
    this.#viewScaleMode = viewScaleMode;
    const engine = this.getEngine();
    if (engine) {
      engine.getViewManager().setViewScaleMode(viewScaleMode);
    }
  }
  //==============================================================================
  // 현재 ViewScaleMode 반환.
  //==============================================================================
  /**
   * @returns { string }
   */
  getViewScaleMode() {
    return this.#viewScaleMode;
  }
  //==============================================================================
  // 로딩 화면 중앙 이미지 URL 설정. (빈 문자열이면 이미지 없이 게이지만 노출)
  //==============================================================================
  /**
   * @param { string } url
   */
  setLoadingImageUrl(url) {
    this.#loadingImageUrl = url || "";
  }
  //==============================================================================
  // 로딩 화면 최소 노출 시간 (ms) 설정.
  //==============================================================================
  /**
   * @param { number } milliseconds
   */
  setLoadingMinDurationMs(milliseconds) {
    this.#loadMinDurationMs = milliseconds;
  }
  //==============================================================================
  // 캔버스 배경색 설정. (preDraw 단계에서 캔버스 전체에 적용)
  //==============================================================================
  /**
   * @param { Color } color
   */
  setSceneBackgroundColor(color) {
    this.#sceneBackgroundColor = color;
  }
  //==============================================================================
  // 생성. 솔버 / screenNode / safeAreaLayoutGuide 셋업.
  //==============================================================================
  /**
   * @override
   */
  create() {
    super.create();
    this.#solver = new LayoutSolver();
    this.#screenNode = new UINode();
    this.#screenNode.setName("screen");
    this.#screenNode.setSolver(this.#solver);
    const screenLeftAnchor = this.#screenNode.leftAnchor;
    const screenLeftConstraint = screenLeftAnchor.equalTo(0);
    this.#screenNode.addConstraint(screenLeftConstraint);
    const screenTopAnchor = this.#screenNode.topAnchor;
    const screenTopConstraint = screenTopAnchor.equalTo(0);
    this.#screenNode.addConstraint(screenTopConstraint);
    const screenWidthVariable = this.#screenNode.getWidthVariable();
    const screenHeightVariable = this.#screenNode.getHeightVariable();
    this.#solver.addEditVariable(screenWidthVariable, LayoutStrength.strong);
    this.#solver.addEditVariable(screenHeightVariable, LayoutStrength.strong);
    this.#safeAreaInsets = { top: 0, left: 0, bottom: 0, right: 0 };
    this.#safeAreaLayoutGuide = new UINode();
    this.#safeAreaLayoutGuide.setName("safeArea");
    this.#safeAreaLayoutGuide.setSolver(this.#solver);
    this.#safeAreaLayoutGuideConstraints = [];
    this.rebuildSafeAreaLayoutGuideConstraints();
  }
  //==============================================================================
  // 비동기 로드.
  // - 자체 자산을 로드 (loadAssets) 한 뒤 최소 노출 시간을 보장한다.
  // - 화면 터치 시 즉시 단축. drawOnLoad 단계에서는 씬의 touchPress 가
  //   호출된다는 보장이 없어 window 이벤트로 직접 캡처.
  // - 로드 완료 후 viewSize 를 솔버에 즉시 반영한다.
  //==============================================================================
  /**
   * @override
   * @param { Engine } engine
   */
  async load(engine) {
    await super.load(engine);
    this.#loadStartTime = System29.Date.now();
    this.#loadTouchedToSkip = false;
    const skipHandler = /* @__PURE__ */ __name(() => {
      this.#loadTouchedToSkip = true;
    }, "skipHandler");
    System29.window.addEventListener("pointerdown", skipHandler, { once: true });
    try {
      await this.loadAssets();
      while (System29.Date.now() - this.#loadStartTime < this.#loadMinDurationMs && !this.#loadTouchedToSkip) {
        await new Promise((resolve) => System29.setTimeout(resolve, 50));
      }
    } finally {
      System29.window.removeEventListener("pointerdown", skipHandler);
    }
    const viewManager = engine.getViewManager();
    const viewSize = viewManager.getViewSize();
    this.suggestScreenSize(viewSize);
    this.#solver.updateVariables();
  }
  //==============================================================================
  // 자산 로드 hook.
  // - 서브클래스가 오버라이드해서 자체 자산을 비동기 로드한다. super 호출 필수.
  //==============================================================================
  async loadAssets() {
    if (this.#loadingImageUrl) {
      const loadingImageAsset = new ImageAsset2();
      this.#loadingImageAsset = loadingImageAsset;
      try {
        await loadingImageAsset.load(this.#loadingImageUrl);
      } catch (error) {
        console.error("[UIScene] \uB85C\uB529 \uC774\uBBF8\uC9C0 \uB85C\uB4DC \uC2E4\uD328:", error);
      }
    }
  }
  //==============================================================================
  // 로딩 화면 출력. (엔진이 isLoaded() === false 인 동안 매 프레임 호출)
  // - 검은 배경 + 중앙 로딩 이미지 + 하단 게이지.
  //==============================================================================
  /**
   * @override
   * @param { Graphic } graphic
   */
  drawOnLoad(graphic) {
    super.drawOnLoad(graphic);
    const engine = this.getEngine();
    if (!engine) {
      return;
    }
    const viewManager = engine.getViewManager();
    const canvasNativeSize = viewManager.getCanvasNativeSize();
    const viewSize = viewManager.getViewSize();
    viewManager.applyCanvasNativeRect(graphic);
    graphic.setFillColor(Color.black());
    graphic.drawRect(Rect.create(0, 0, canvasNativeSize.x, canvasNativeSize.y));
    viewManager.applyViewRect(graphic);
    graphic.setFillColor(Color.black());
    graphic.drawRect(Rect.create(0, 0, viewSize.x, viewSize.y));
    const loadingImageAsset = this.#loadingImageAsset;
    if (loadingImageAsset && loadingImageAsset.isLoaded()) {
      const image = loadingImageAsset.image;
      const targetWidth = viewSize.x * 0.7;
      const ratio = image.height / image.width;
      const targetHeight = targetWidth * ratio;
      const positionX = (viewSize.x - targetWidth) * 0.5;
      const positionY = (viewSize.y - targetHeight) * 0.5;
      graphic.drawImage(image, Vector2.create(positionX, positionY), Vector2.create(targetWidth, targetHeight));
    }
    const elapsed = System29.Date.now() - this.#loadStartTime;
    const progress = System29.Math.min(1, System29.Math.max(0, elapsed / this.#loadMinDurationMs));
    const barWidth = viewSize.x * 0.6;
    const barHeight = 24;
    const barX = (viewSize.x - barWidth) * 0.5;
    const barY = viewSize.y * 0.78;
    graphic.setFillColor("#333333");
    graphic.drawRect(Rect.create(barX, barY, barWidth, barHeight));
    graphic.setFillColor("#ffffff");
    graphic.drawRect(Rect.create(barX, barY, barWidth * progress, barHeight));
  }
  //==============================================================================
  // 초기화. 개발자 도구 + 터치 레이캐스터 셋업.
  //==============================================================================
  /**
   * @override
   * @param { Engine } engine
   */
  initialize(engine) {
    super.initialize(engine);
    engine.getViewManager().setViewScaleMode(this.#viewScaleMode);
    this.#devtools = new DEVTools();
    this.#devtools.setEngine(engine);
    this.#devtools.setRootNodes([this.getRoot()]);
    this.#touchRaycaster = new TouchRecognizer();
    this.#touchRaycaster.setRootNode(this.getRoot());
    this.#lastViewSizeX = 0;
    this.#lastViewSizeY = 0;
  }
  //==============================================================================
  // 화면 크기 변경됨.
  //==============================================================================
  /**
   * @override
   * @param { Vector2 } canvasNativeSize
   */
  resize(canvasNativeSize) {
    super.resize(canvasNativeSize);
    this.layout();
  }
  //==============================================================================
  // 레이아웃.
  // - viewSize 를 솔버에 suggest 하고, env() 인셋을 자체 safeAreaInsets 에 동기화.
  // - 변화가 있을 때만 setSafeAreaInsets 호출 (제약 재구축 비용 절감).
  //==============================================================================
  layout() {
    const engine = this.getEngine();
    if (!engine) {
      return;
    }
    const viewManager = engine.getViewManager();
    const viewSize = viewManager.getViewSize();
    this.suggestScreenSize(viewSize);
    const safeAreaRect = this.computeSafeAreaRect();
    const insetTop = safeAreaRect.position.y;
    const insetLeft = safeAreaRect.position.x;
    const insetRight = System29.Math.max(viewSize.x - (safeAreaRect.position.x + safeAreaRect.size.x), 0);
    const insetBottom = System29.Math.max(viewSize.y - (safeAreaRect.position.y + safeAreaRect.size.y), 0);
    const previousInsets = this.#safeAreaInsets;
    if (previousInsets.top !== insetTop || previousInsets.left !== insetLeft || previousInsets.right !== insetRight || previousInsets.bottom !== insetBottom) {
      this.setSafeAreaInsets({
        top: insetTop,
        left: insetLeft,
        right: insetRight,
        bottom: insetBottom
      });
    }
    this.#solver.updateVariables();
  }
  //==============================================================================
  // env(safe-area-inset-*) 기준 영역 계산. (뷰 좌표계)
  //==============================================================================
  /**
   * @returns { Rect }
   */
  computeSafeAreaRect() {
    const engine = this.getEngine();
    const viewManager = engine.getViewManager();
    const viewSize = viewManager.getViewSize();
    const targetScale = viewManager.getTargetResolutionScale();
    const div = System29.document.createElement("div");
    div.style.position = "absolute";
    div.style.visibility = "hidden";
    div.style.paddingTop = "env(safe-area-inset-top)";
    div.style.paddingRight = "env(safe-area-inset-right)";
    div.style.paddingBottom = "env(safe-area-inset-bottom)";
    div.style.paddingLeft = "env(safe-area-inset-left)";
    System29.document.body.appendChild(div);
    const computedStyle = System29.window.getComputedStyle(div);
    const insetTopCss = System29.Number.parseInt(computedStyle.paddingTop) || 0;
    const insetRightCss = System29.Number.parseInt(computedStyle.paddingRight) || 0;
    const insetBottomCss = System29.Number.parseInt(computedStyle.paddingBottom) || 0;
    const insetLeftCss = System29.Number.parseInt(computedStyle.paddingLeft) || 0;
    System29.document.body.removeChild(div);
    const scale = targetScale > 0 ? targetScale : 1;
    const insetTop = insetTopCss / scale;
    const insetRight = insetRightCss / scale;
    const insetBottom = insetBottomCss / scale;
    const insetLeft = insetLeftCss / scale;
    const x = insetLeft;
    const y = insetTop;
    const width = System29.Math.max(viewSize.x - insetLeft - insetRight, 0);
    const height = System29.Math.max(viewSize.y - insetTop - insetBottom, 0);
    return Rect.create(x, y, width, height);
  }
  //==============================================================================
  // 주기적 갱신.
  // - viewSize 변화 감지 → layout 자동 호출.
  //   (모바일 주소창 토글로 100vh 가 동적으로 변하는 경우 등에서 resize 이벤트만으론
  //    누락될 수 있어 매 tick 보정.)
  // - 트리 내 새로 추가된 UINode 들을 솔버에 자동 부착 후 솔버 한 번 풀이.
  // - DEVTools tick.
  //==============================================================================
  /**
   * @override
   * @param { number } timeDelta
   */
  tick(timeDelta) {
    super.tick(timeDelta);
    const engine = this.getEngine();
    const viewManager = engine.getViewManager();
    const viewSize = viewManager.getViewSize();
    if (viewSize.x !== this.#lastViewSizeX || viewSize.y !== this.#lastViewSizeY) {
      this.#lastViewSizeX = viewSize.x;
      this.#lastViewSizeY = viewSize.y;
      this.layout();
    }
    const root = this.getRoot();
    this.attachPendingUINodes(root);
    this.#solver.updateVariables();
    const timeManager = engine.getTimeManager();
    const unscaledTimeDelta = timeManager.getUnscaleDeltaTime();
    this.#devtools.tick(unscaledTimeDelta);
  }
  //==============================================================================
  // 트리를 순회하며 솔버가 부착되지 않은 UINode 들을 본 씬의 솔버에 부착.
  //==============================================================================
  /**
   * @param { TransformNode } node
   */
  attachPendingUINodes(node) {
    if (node === null || node === void 0) {
      return;
    }
    if (node instanceof UINode) {
      const currentSolver = node.getSolver();
      if (currentSolver === null) {
        node.setSolver(this.#solver);
      }
    }
    const children = node.getChildren();
    for (const child of children) {
      this.attachPendingUINodes(child);
    }
  }
  //==============================================================================
  // 화면 가이드 UINode 의 너비/높이 값 제안.
  //==============================================================================
  /**
   * @param { Vector2 } size
   */
  suggestScreenSize(size) {
    const screenWidthVariable = this.#screenNode.getWidthVariable();
    const screenHeightVariable = this.#screenNode.getHeightVariable();
    this.#solver.suggestValue(screenWidthVariable, size.x);
    this.#solver.suggestValue(screenHeightVariable, size.y);
  }
  //==============================================================================
  // safeAreaInsets 반환. (UIKit 의 UIView.safeAreaInsets)
  //==============================================================================
  /**
   * @returns { { top: number, left: number, bottom: number, right: number } }
   */
  getSafeAreaInsets() {
    const safeAreaInsets = this.#safeAreaInsets;
    return {
      top: safeAreaInsets.top,
      left: safeAreaInsets.left,
      bottom: safeAreaInsets.bottom,
      right: safeAreaInsets.right
    };
  }
  //==============================================================================
  // safeAreaInsets 설정. (모바일 노치 / 홈 인디케이터 회피용 영역 정의)
  // - safeAreaLayoutGuide 의 4 개 제약을 즉시 갱신한다.
  //==============================================================================
  /**
   * @param { { top: number, left: number, bottom: number, right: number } } insets
   */
  setSafeAreaInsets(insets) {
    this.#safeAreaInsets = {
      top: insets.top,
      left: insets.left,
      bottom: insets.bottom,
      right: insets.right
    };
    this.rebuildSafeAreaLayoutGuideConstraints();
  }
  //==============================================================================
  // safeAreaLayoutGuide 의 4 개 제약 재구축.
  // - 기존 제약을 솔버에서 제거하고 현재 #safeAreaInsets 로 다시 구축 후 재등록.
  //==============================================================================
  rebuildSafeAreaLayoutGuideConstraints() {
    const guide = this.#safeAreaLayoutGuide;
    const screen = this.#screenNode;
    const solver = this.#solver;
    for (const constraint of this.#safeAreaLayoutGuideConstraints) {
      if (solver.hasConstraint(constraint)) {
        solver.removeConstraint(constraint);
      }
    }
    const insets = this.#safeAreaInsets;
    const screenLeftAnchor = screen.leftAnchor;
    const leftOffsetExpression = screenLeftAnchor.add(insets.left);
    const guideLeftAnchor = guide.leftAnchor;
    const guideLeftConstraint = guideLeftAnchor.equalTo(leftOffsetExpression);
    const screenTopAnchor = screen.topAnchor;
    const topOffsetExpression = screenTopAnchor.add(insets.top);
    const guideTopAnchor = guide.topAnchor;
    const guideTopConstraint = guideTopAnchor.equalTo(topOffsetExpression);
    const screenRightAnchor = screen.rightAnchor;
    const rightOffsetExpression = screenRightAnchor.subtract(insets.right);
    const guideRightAnchor = guide.rightAnchor;
    const guideRightConstraint = guideRightAnchor.equalTo(rightOffsetExpression);
    const screenBottomAnchor = screen.bottomAnchor;
    const bottomOffsetExpression = screenBottomAnchor.subtract(insets.bottom);
    const guideBottomAnchor = guide.bottomAnchor;
    const guideBottomConstraint = guideBottomAnchor.equalTo(bottomOffsetExpression);
    this.#safeAreaLayoutGuideConstraints = [guideLeftConstraint, guideTopConstraint, guideRightConstraint, guideBottomConstraint];
    for (const constraint of this.#safeAreaLayoutGuideConstraints) {
      solver.addConstraint(constraint);
    }
  }
  //==============================================================================
  // 디브툴이 입력을 가져가는 중인지 여부.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isDevToolsCapturingInput() {
    return this.#devtools.isVisible() && this.#devtools.isPointerInsidePanel();
  }
  //==============================================================================
  // touchPress.
  //==============================================================================
  /**
   * @override
   * @param { Vector2 } viewInputPosition
   */
  touchPress(viewInputPosition) {
    if (this.isDevToolsCapturingInput()) {
      return;
    }
    this.#touchRaycaster.touchPress(viewInputPosition);
  }
  //==============================================================================
  // touchMove.
  //==============================================================================
  /**
   * @override
   * @param { Vector2 } viewInputPosition
   */
  touchMove(viewInputPosition) {
    if (this.isDevToolsCapturingInput()) {
      return;
    }
    this.#touchRaycaster.touchMove(viewInputPosition);
  }
  //==============================================================================
  // touchRelease.
  //==============================================================================
  /**
   * @override
   * @param { Vector2 } viewInputPosition
   */
  touchRelease(viewInputPosition) {
    if (this.isDevToolsCapturingInput()) {
      return;
    }
    this.#touchRaycaster.touchRelease(viewInputPosition);
  }
  //==============================================================================
  // touchCancel.
  //==============================================================================
  /**
   * @override
   * @param { Vector2 } viewInputPosition
   */
  touchCancel(viewInputPosition) {
    if (this.isDevToolsCapturingInput()) {
      return;
    }
    this.#touchRaycaster.touchCancel(viewInputPosition);
  }
  //==============================================================================
  // touchWheel.
  //==============================================================================
  /**
   * @override
   * @param { Vector2 } viewInputPosition
   * @param { Vector2 } wheelDelta
   */
  touchWheel(viewInputPosition, wheelDelta) {
    if (this.isDevToolsCapturingInput()) {
      return;
    }
    this.#touchRaycaster.touchWheel(viewInputPosition, wheelDelta);
  }
  //==============================================================================
  // preDraw. 캔버스 전체를 sceneBackgroundColor 로 칠한다 (세이프 에어리어 바깥 영역 포함).
  //==============================================================================
  /**
   * @override
   * @param { Graphic } graphic
   */
  preDraw(graphic) {
    super.preDraw(graphic);
    const engine = this.getEngine();
    const viewManager = engine.getViewManager();
    const canvasNativeSize = viewManager.getCanvasNativeSize();
    viewManager.applyCanvasNativeRect(graphic);
    graphic.setFillColor(this.#sceneBackgroundColor);
    graphic.drawRect(Rect.create(0, 0, canvasNativeSize.x, canvasNativeSize.y));
    viewManager.applyViewRect(graphic);
  }
  //==============================================================================
  // postDraw. DEVTools 를 화면 위에 그린다.
  //==============================================================================
  /**
   * @override
   * @param { Graphic } graphic
   */
  postDraw(graphic) {
    super.postDraw(graphic);
    this.#devtools.draw(graphic);
  }
  //==============================================================================
  // 솔버 반환.
  //==============================================================================
  /**
   * @returns { LayoutSolver }
   */
  getSolver() {
    return this.#solver;
  }
  //==============================================================================
  // 화면 가이드 UINode 반환.
  // - 트리에는 들어가지 않는 가이드 노드. left/top 은 0 고정, width/height 는
  //   현재 viewSize 와 동기화된 편집 변수.
  // - 사용자가 자기 UINode 의 제약을 화면 기준으로 작성할 때 앵커 소스로 사용.
  //==============================================================================
  /**
   * @returns { UINode }
   */
  getScreenNode() {
    return this.#screenNode;
  }
  //==============================================================================
  // safeAreaLayoutGuide 반환. (UIKit 의 UIView.safeAreaLayoutGuide 와 동일 사상)
  // - screenNode 에서 safeAreaInsets 만큼 안쪽으로 들어간 가이드 UINode.
  // - 사용자가 자기 UINode 의 제약을 safeArea 기준으로 작성할 때 앵커 소스로 사용.
  //==============================================================================
  /**
   * @returns { UINode }
   */
  getSafeAreaLayoutGuide() {
    return this.#safeAreaLayoutGuide;
  }
};

// src/ui/uiimageview.js
var UIImageView = class extends UIView {
  static {
    __name(this, "UIImageView");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Sprite | null } */
  #sprite;
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.setComponentType("UIImageView");
    this.#sprite = null;
  }
  //==============================================================================
  // 노드에 붙음. (내부 Sprite 컴포넌트 부착)
  //==============================================================================
  /**
   * @override
   * @param { ComponentNode } node
   */
  attach(node) {
    super.attach(node);
    this.#sprite = node.getOrAddComponent(Sprite);
  }
  //==============================================================================
  // 노드에서 떨어짐. (내부 Sprite 컴포넌트 제거)
  //==============================================================================
  /**
   * @override
   * @param { ComponentNode } node
   */
  detach(node) {
    if (this.#sprite) {
      this.#sprite = null;
    }
    super.detach(node);
  }
  //==============================================================================
  // 내부 Sprite 컴포넌트 반환. (디테일 제어가 필요할 때 직접 접근)
  //==============================================================================
  /**
   * @returns { Sprite | null }
   */
  getSprite() {
    return this.#sprite;
  }
  //==============================================================================
  // 이미지 설정. (HTMLImageElement / OffscreenCanvas / ImageAsset 모두 허용)
  //==============================================================================
  /**
   * @param { HTMLImageElement | OffscreenCanvas | ImageAsset | null } image
   */
  setImage(image) {
    if (!this.#sprite) {
      return;
    }
    if (image instanceof ImageAsset2) {
      this.#sprite.setImage(image.image);
    } else {
      this.#sprite.setImage(image);
    }
  }
  //==============================================================================
  // 이미지 반환.
  //==============================================================================
  /**
   * @returns { HTMLImageElement | OffscreenCanvas | null }
   */
  getImage() {
    return this.#sprite ? this.#sprite.getImage() : null;
  }
  //==============================================================================
  // 이미지 부분 영역(소스 사각형) 설정.
  //==============================================================================
  /**
   * @param { Rect } imageRect
   */
  setImageRect(imageRect) {
    if (this.#sprite) {
      this.#sprite.setImageRect(imageRect);
    }
  }
  //==============================================================================
  // 색상 설정. (스프라이트 틴트)
  //==============================================================================
  /**
   * @param { Color | string } color
   */
  setColor(color) {
    if (this.#sprite) {
      this.#sprite.setColor(color);
    }
  }
  //==============================================================================
  // 가로 플립 설정.
  //==============================================================================
  /**
   * @param { boolean } isHorizontalFlip
   */
  setHorizontalFlip(isHorizontalFlip) {
    if (this.#sprite && typeof this.#sprite.setHorizontalFlip === "function") {
      this.#sprite.setHorizontalFlip(isHorizontalFlip);
    }
  }
  //==============================================================================
  // 세로 플립 설정.
  //==============================================================================
  /**
   * @param { boolean } isVerticalFlip
   */
  setVerticalFlip(isVerticalFlip) {
    if (this.#sprite && typeof this.#sprite.setVerticalFlip === "function") {
      this.#sprite.setVerticalFlip(isVerticalFlip);
    }
  }
  //==============================================================================
  // 드로우 모드 설정. (simple / sliced / tiled)
  //==============================================================================
  /**
   * @param { string } mode
   */
  setDrawMode(mode) {
    if (this.#sprite && typeof this.#sprite.setSpriteDrawMode === "function") {
      this.#sprite.setSpriteDrawMode(mode);
    }
  }
  //==============================================================================
  // 블렌드 모드 설정.
  //==============================================================================
  /**
   * @param { string } mode
   */
  setBlendMode(mode) {
    if (this.#sprite && typeof this.#sprite.setSpriteBlendMode === "function") {
      this.#sprite.setSpriteBlendMode(mode);
    }
  }
  //==============================================================================
  // 나인패치 영역 설정.
  //==============================================================================
  /**
   * @param { Rect } nineSlice
   */
  setNineSlice(nineSlice) {
    if (this.#sprite && typeof this.#sprite.setNineSlice === "function") {
      this.#sprite.setNineSlice(nineSlice);
    }
  }
};

// src/ui/uilabel.js
var UILabel = class extends UIView {
  static {
    __name(this, "UILabel");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Text | null } */
  #text;
  /** @private @type { RichText | null } */
  #richText;
  /** @private @type { boolean } */
  #useRichText;
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.setComponentType("UILabel");
    this.#text = null;
    this.#richText = null;
    this.#useRichText = false;
  }
  //==============================================================================
  // 의존 컴포넌트 — Text 가 먼저 부착되어야 RichText 가 별도 인스턴스로 추가된다.
  // (RichText extends Text 라 순서를 뒤집으면 RichText 단일로만 잡힘)
  //==============================================================================
  /**
   * @override
   * @returns { Function[] }
   */
  require() {
    return [Text, RichText];
  }
  //==============================================================================
  // 노드에 붙음. (Text / RichText 컴포넌트 참조 확보 + 활성 상태 적용)
  //==============================================================================
  /**
   * @override
   * @param { ComponentNode } node
   */
  attach(node) {
    super.attach(node);
    this.#text = node.getOrAddComponent(Text);
    this.#richText = node.getOrAddComponent(RichText);
    this.applyActiveComponent();
  }
  //==============================================================================
  // 노드에서 떨어짐.
  //==============================================================================
  /**
   * @override
   * @param { ComponentNode } node
   */
  detach(node) {
    this.#text = null;
    this.#richText = null;
    super.detach(node);
  }
  //==============================================================================
  // 호스트 노드에 invalidateIntrinsicContentSize 가 있으면 호출.
  //==============================================================================
  invalidateIntrinsicContentSize() {
    const node = this.getNode();
    if (node && typeof node.invalidateIntrinsicContentSize === "function") {
      node.invalidateIntrinsicContentSize();
    }
  }
  //==============================================================================
  // 활성 컴포넌트 적용. (현재 모드에 맞춰 Text / RichText 의 setEnable 을 토글)
  //==============================================================================
  applyActiveComponent() {
    if (this.#text) {
      this.#text.setEnable(this.#useRichText === false);
    }
    if (this.#richText) {
      this.#richText.setEnable(this.#useRichText === true);
    }
    this.invalidateIntrinsicContentSize();
  }
  //==============================================================================
  // 리치텍스트 모드 설정. true 면 RichText 컴포넌트가 활성화되어 마크업을 해석.
  //==============================================================================
  /**
   * @param { boolean } useRichText
   */
  useRichText(useRichText) {
    this.#useRichText = useRichText === true;
    this.applyActiveComponent();
  }
  //==============================================================================
  // 리치텍스트 모드 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isUsingRichText() {
    return this.#useRichText;
  }
  //==============================================================================
  // 텍스트 설정. Text 와 RichText 양쪽에 동기화 (모드 토글 시 보존).
  //==============================================================================
  /**
   * @param { string } text
   */
  setText(text) {
    if (this.#text) {
      this.#text.setText(text);
    }
    if (this.#richText) {
      this.#richText.setText(text);
    }
    this.invalidateIntrinsicContentSize();
  }
  //==============================================================================
  // 텍스트 반환. (활성 컴포넌트의 plain 텍스트)
  //==============================================================================
  /**
   * @returns { string }
   */
  getText() {
    if (this.#useRichText && this.#richText) {
      return this.#richText.getText();
    }
    if (this.#text) {
      return this.#text.getText();
    }
    return "";
  }
  //==============================================================================
  // 리치텍스트 segment 1 개 추가. (RichText 컴포넌트에 직접 적용)
  // - useRichText(true) 가 켜져있어야 화면에 반영된다.
  //==============================================================================
  /**
   * @param { string } text
   * @param { object } [attributes]
   * @returns { UILabel }
   */
  appendSegment(text, attributes) {
    if (this.#richText) {
      this.#richText.appendSegment(text, attributes);
      this.invalidateIntrinsicContentSize();
    }
    return this;
  }
  //==============================================================================
  // 리치텍스트 segment 모두 제거.
  //==============================================================================
  clearSegments() {
    if (this.#richText) {
      this.#richText.clearSegments();
      this.invalidateIntrinsicContentSize();
    }
  }
  //==============================================================================
  // 폰트 크기 설정.
  //==============================================================================
  /**
   * @param { number } fontSize
   */
  setFontSize(fontSize) {
    if (this.#text) {
      this.#text.setFontSize(fontSize);
    }
    if (this.#richText) {
      this.#richText.setFontSize(fontSize);
    }
    this.invalidateIntrinsicContentSize();
  }
  //==============================================================================
  // 폰트 크기 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getFontSize() {
    if (this.#text) {
      return this.#text.getFontSize();
    }
    return 0;
  }
  //==============================================================================
  // 폰트 설정.
  //==============================================================================
  /**
   * @param { FontFace | FontAsset | null } font
   */
  setFont(font) {
    if (this.#text) {
      this.#text.setFont(font);
    }
    if (this.#richText) {
      this.#richText.setFont(font);
    }
    this.invalidateIntrinsicContentSize();
  }
  //==============================================================================
  // 텍스트 색 설정.
  //==============================================================================
  /**
   * @param { Color | string } color
   */
  setTextColor(color) {
    if (this.#text) {
      this.#text.setTextColor(color);
    }
    if (this.#richText) {
      this.#richText.setTextColor(color);
    }
  }
  //==============================================================================
  // 텍스트 색 반환.
  //==============================================================================
  /**
   * @returns { Color | null }
   */
  getTextColor() {
    if (this.#text) {
      return this.#text.getTextColor();
    }
    return null;
  }
  //==============================================================================
  // 텍스트 외곽선 색 설정.
  //==============================================================================
  /**
   * @param { Color | string } color
   */
  setStrokeColor(color) {
    if (this.#text) {
      this.#text.setStrokeColor(color);
    }
    if (this.#richText) {
      this.#richText.setStrokeColor(color);
    }
  }
  //==============================================================================
  // 텍스트 외곽선 두께 설정.
  //==============================================================================
  /**
   * @param { number } width
   */
  setStrokeWidth(width) {
    if (this.#text) {
      this.#text.setStrokeWidth(width);
    }
    if (this.#richText) {
      this.#richText.setStrokeWidth(width);
    }
  }
  //==============================================================================
  // 볼드 설정.
  //==============================================================================
  /**
   * @param { boolean } bold
   */
  setBold(bold) {
    if (this.#text) {
      this.#text.setBold(bold);
    }
    if (this.#richText) {
      this.#richText.setBold(bold);
    }
    this.invalidateIntrinsicContentSize();
  }
  //==============================================================================
  // 볼드 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isBold() {
    if (this.#text) {
      return this.#text.isBold();
    }
    return false;
  }
  //==============================================================================
  // 이탤릭 설정.
  //==============================================================================
  /**
   * @param { boolean } italic
   */
  setItalic(italic) {
    if (this.#text) {
      this.#text.setItalic(italic);
    }
    if (this.#richText) {
      this.#richText.setItalic(italic);
    }
    this.invalidateIntrinsicContentSize();
  }
  //==============================================================================
  // 이탤릭 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isItalic() {
    if (this.#text) {
      return this.#text.isItalic();
    }
    return false;
  }
  //==============================================================================
  // 밑줄 설정.
  //==============================================================================
  /**
   * @param { boolean } underline
   */
  setUnderline(underline) {
    if (this.#text) {
      this.#text.setUnderline(underline);
    }
    if (this.#richText) {
      this.#richText.setUnderline(underline);
    }
  }
  //==============================================================================
  // 밑줄 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isUnderline() {
    if (this.#text) {
      return this.#text.isUnderline();
    }
    return false;
  }
  //==============================================================================
  // 취소선 설정.
  //==============================================================================
  /**
   * @param { boolean } strikethrough
   */
  setStrikethrough(strikethrough) {
    if (this.#text) {
      this.#text.setStrikethrough(strikethrough);
    }
    if (this.#richText) {
      this.#richText.setStrikethrough(strikethrough);
    }
  }
  //==============================================================================
  // 취소선 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isStrikethrough() {
    if (this.#text) {
      return this.#text.isStrikethrough();
    }
    return false;
  }
  //==============================================================================
  // 가로 정렬 설정.
  //==============================================================================
  /**
   * @param { "left" | "center" | "right" | "start" | "end" } align
   */
  setTextAlign(align) {
    if (this.#text) {
      this.#text.setTextAlign(align);
    }
    if (this.#richText) {
      this.#richText.setTextAlign(align);
    }
  }
  //==============================================================================
  // 세로 정렬 설정.
  //==============================================================================
  /**
   * @param { "top" | "middle" | "bottom" | "alphabetic" | "hanging" | "ideographic" } baseline
   */
  setTextBaseline(baseline) {
    if (this.#text) {
      this.#text.setTextBaseline(baseline);
    }
    if (this.#richText) {
      this.#richText.setTextBaseline(baseline);
    }
  }
};

// src/ui/uicontrol.js
var UIControl = class extends UIView {
  static {
    __name(this, "UIControl");
  }
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.setComponentType("UIControl");
  }
};

// src/ui/uibutton.js
var ButtonState = {
  normal: Enum.begin(),
  hover: Enum.auto(),
  pressed: Enum.auto(),
  released: Enum.auto(),
  disabled: Enum.auto()
};
var UIButton = class extends UIControl {
  static {
    __name(this, "UIButton");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { ButtonState } */
  #buttonState;
  /** @private @type { function(UIButton): boolean } */
  #clickEvent;
  /** @private @type { function(UIButton): void } */
  #pressedEvent;
  /** @private @type { function(UIButton): void } */
  #releasedEvent;
  /** @private @type { function(UIButton): void } */
  #clickedEvent;
  /** @private @type { boolean } */
  #isPressTracking;
  /** @private @type { Color } */
  #pressedTintColor;
  /** @private @type { number } */
  #transitionDuration;
  /** @private @type { number } */
  #tintProgress;
  /** @private @type { Array } */
  #colorEntries;
  /** @private @type { boolean } */
  #isInteractable;
  /** @private @type { Color } */
  #disabledTintColor;
  /** @private @type { Set } */
  #tintExcludedNodes;
  // 이 Set 에 든 노드는 자신과 모든 자손 노드까지 트랜지션에서 제외.
  /** @private @type { Set } */
  #tintExcludedComponents;
  // 이 Set 에 든 컴포넌트만 개별 제외.
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @construct
   */
  constructor() {
    super();
    this.setComponentType("Button");
    this.#buttonState = ButtonState.normal;
    this.#clickEvent = null;
    this.#pressedEvent = null;
    this.#releasedEvent = null;
    this.#clickedEvent = null;
    this.#isPressTracking = false;
    this.#pressedTintColor = new Color(0, 0, 0, 0.3);
    this.#transitionDuration = 0.3;
    this.#tintProgress = 0;
    this.#colorEntries = [];
    this.#isInteractable = true;
    this.#disabledTintColor = new Color(0, 0, 0, 0.5);
    this.#tintExcludedNodes = /* @__PURE__ */ new Set();
    this.#tintExcludedComponents = /* @__PURE__ */ new Set();
  }
  //==============================================================================
  // 트랜지션 대상에서 노드를 제외. 해당 노드 자신과 모든 자손 노드의 컴포넌트가
  // 색상 수집에서 제외된다.
  //==============================================================================
  excludeNodeFromTint(node) {
    this.#tintExcludedNodes.add(node);
  }
  //==============================================================================
  // 트랜지션 대상에서 특정 컴포넌트만 제외.
  //==============================================================================
  excludeComponentFromTint(component) {
    this.#tintExcludedComponents.add(component);
  }
  //==============================================================================
  // 제외 목록 초기화.
  //==============================================================================
  clearTintExclusions() {
    this.#tintExcludedNodes.clear();
    this.#tintExcludedComponents.clear();
  }
  //==============================================================================
  // 노드에 붙음. (WorldNode 의 isInteractable 을 자동 활성화)
  //==============================================================================
  /**
   * @override
   * @param { ComponentNode } node
   */
  attach(node) {
    super.attach(node);
    if (node instanceof WorldNode) {
      node.setInteractable(true);
    }
  }
  //==============================================================================
  // 갱신.
  //==============================================================================
  /**
   * @override
   * @param { number } timeDelta
   */
  tick(timeDelta) {
    super.tick(timeDelta);
    this.updateTintTransition(timeDelta);
  }
  //==============================================================================
  // 출력.
  //==============================================================================
  /**
   * @override
   * @param { Graphic } graphic
   */
  draw(graphic) {
  }
  //==============================================================================
  // 터치 누름. (TouchRaycaster → WorldNode → Button)
  //==============================================================================
  /**
   * @param { Vector2 } viewInputPosition
   */
  touchPress(viewInputPosition) {
    if (!this.getInteractable()) {
      return;
    }
    this.#isPressTracking = true;
    this.setButtonState(ButtonState.pressed);
    this.collectColorTargets();
    const pressedEvent = this.getPressedEvent();
    if (pressedEvent) {
      pressedEvent(this);
    }
  }
  //==============================================================================
  // 터치 뗌. (TouchRaycaster → WorldNode → Button)
  //==============================================================================
  /**
   * @param { Vector2 } viewInputPosition
   */
  touchRelease(viewInputPosition) {
    if (!this.getInteractable()) {
      return;
    }
    if (!this.#isPressTracking) {
      return;
    }
    this.#isPressTracking = false;
    this.setButtonState(ButtonState.released);
    this.#tintProgress = 0;
    this.applyTintProgress(0);
    const releasedEvent = this.getReleasedEvent();
    if (releasedEvent) {
      releasedEvent(this);
    }
    const node = this.getNode();
    const isInsideBounds = node.contains(viewInputPosition);
    if (isInsideBounds) {
      const clickedEvent = this.getClickedEvent();
      if (clickedEvent) {
        clickedEvent(this);
      }
      const clickEvent = this.getClickEvent();
      if (clickEvent) {
        clickEvent(this);
      }
    }
    this.setButtonState(ButtonState.normal);
  }
  //==============================================================================
  // 터치 취소. (TouchRaycaster → WorldNode → Button)
  //==============================================================================
  /**
   * @param { Vector2 } viewInputPosition
   */
  touchCancel(viewInputPosition) {
    if (!this.#isPressTracking) {
      return;
    }
    this.#isPressTracking = false;
    this.#tintProgress = 0;
    this.applyTintProgress(0);
    this.setButtonState(ButtonState.normal);
  }
  //==============================================================================
  // 틴트 트랜지션 갱신.
  //==============================================================================
  /** @private */
  updateTintTransition(timeDelta) {
    if (!this.getInteractable()) {
      this.applyDisabledTint();
      return;
    }
    const buttonState = this.getButtonState();
    const isPressed = buttonState === ButtonState.pressed;
    const transitionDuration = this.getTransitionDuration();
    if (isPressed) {
      this.#tintProgress = min(this.#tintProgress + timeDelta / transitionDuration, 1);
    } else {
      this.#tintProgress = max(this.#tintProgress - timeDelta / transitionDuration, 0);
    }
    this.applyTintProgress(this.#tintProgress);
  }
  //==============================================================================
  // 틴트 적용.
  //==============================================================================
  applyTintProgress(progress) {
    const pressedTintColor = this.getPressedTintColor();
    for (const colorEntry of this.#colorEntries) {
      if (colorEntry.type === "sprite" || colorEntry.type === "imageview") {
        const overlayAlpha = lerp(0, pressedTintColor.alpha, progress);
        const overlayColor = new Color(pressedTintColor.red, pressedTintColor.green, pressedTintColor.blue, overlayAlpha);
        colorEntry.component.setColor(overlayColor);
      } else if (colorEntry.type === "text" || colorEntry.type === "richtext" || colorEntry.type === "uilabel") {
        const originalColor = colorEntry.originalColor;
        const tintedRed = lerp(originalColor.red, pressedTintColor.red, pressedTintColor.alpha * progress);
        const tintedGreen = lerp(originalColor.green, pressedTintColor.green, pressedTintColor.alpha * progress);
        const tintedBlue = lerp(originalColor.blue, pressedTintColor.blue, pressedTintColor.alpha * progress);
        const tintedColor = new Color(tintedRed, tintedGreen, tintedBlue, originalColor.alpha);
        colorEntry.component.setTextColor(tintedColor);
      } else if (colorEntry.type === "paint") {
        const originalColor = colorEntry.originalColor;
        const tintedRed = lerp(originalColor.red, pressedTintColor.red, pressedTintColor.alpha * progress);
        const tintedGreen = lerp(originalColor.green, pressedTintColor.green, pressedTintColor.alpha * progress);
        const tintedBlue = lerp(originalColor.blue, pressedTintColor.blue, pressedTintColor.alpha * progress);
        const tintedColor = new Color(tintedRed, tintedGreen, tintedBlue, originalColor.alpha);
        colorEntry.component.setColor(tintedColor);
      }
    }
  }
  //==============================================================================
  // 비활성화 틴트 적용.
  //==============================================================================
  /** @private */
  applyDisabledTint() {
    const disabledTintColor = this.#disabledTintColor;
    for (const colorEntry of this.#colorEntries) {
      if (colorEntry.type === "sprite" || colorEntry.type === "imageview") {
        const overlayColor = new Color(disabledTintColor.red, disabledTintColor.green, disabledTintColor.blue, disabledTintColor.alpha);
        colorEntry.component.setColor(overlayColor);
      }
    }
  }
  //==============================================================================
  // 색상 대상 수집.
  //==============================================================================
  collectColorTargets() {
    this.#colorEntries = [];
    const node = this.getNode();
    if (!node) {
      return;
    }
    this.collectFromNode(node);
  }
  //==============================================================================
  // 노드에서 색상 대상 재귀 수집.
  // - excludeNodeFromTint 로 등록된 노드는 자신과 자손까지 통째로 건너뛴다.
  // - excludeComponentFromTint 로 등록된 컴포넌트는 개별적으로 제외한다.
  //==============================================================================
  collectFromNode(node) {
    if (this.#tintExcludedNodes.has(node)) {
      return;
    }
    const imageViews = node.getComponents(UIImageView);
    if (imageViews.length > 0) {
      for (const imageView of imageViews) {
        if (this.#tintExcludedComponents.has(imageView)) continue;
        this.#colorEntries.push({ type: "imageview", component: imageView });
      }
    } else {
      const sprites = node.getComponents(Sprite);
      for (const sprite of sprites) {
        if (this.#tintExcludedComponents.has(sprite)) continue;
        this.#colorEntries.push({ type: "sprite", component: sprite });
      }
    }
    const paints = node.getComponents(Paint);
    for (const paint of paints) {
      if (this.#tintExcludedComponents.has(paint)) continue;
      const originalColor = paint.getColor();
      const copiedColor = new Color(originalColor.red, originalColor.green, originalColor.blue, originalColor.alpha);
      this.#colorEntries.push({ type: "paint", component: paint, originalColor: copiedColor });
    }
    const uiTexts = node.getComponents(UILabel);
    if (uiTexts.length > 0) {
      for (const uiText of uiTexts) {
        if (this.#tintExcludedComponents.has(uiText)) continue;
        const originalColor = uiText.getTextColor();
        const copiedColor = new Color(originalColor.red, originalColor.green, originalColor.blue, originalColor.alpha);
        this.#colorEntries.push({ type: "uilabel", component: uiText, originalColor: copiedColor });
      }
    } else {
      const labelComponents = node.getComponents(Text);
      for (const labelComponent of labelComponents) {
        if (this.#tintExcludedComponents.has(labelComponent)) continue;
        const originalColor = labelComponent.getTextColor();
        const copiedColor = new Color(originalColor.red, originalColor.green, originalColor.blue, originalColor.alpha);
        this.#colorEntries.push({ type: "text", component: labelComponent, originalColor: copiedColor });
      }
    }
    const children = node.getChildren();
    for (const child of children) {
      this.collectFromNode(child);
    }
  }
  //==============================================================================
  // 버튼 상태 변경.
  //==============================================================================
  /**
   * @param { ButtonState } buttonState
   */
  setButtonState(buttonState) {
    if (this.getButtonState() === buttonState) {
      return;
    }
    const previousButtonState = this.getButtonState();
    this.#buttonState = buttonState;
  }
  //==============================================================================
  // 버튼 상태 반환.
  //==============================================================================
  /**
   * @returns { ButtonState }
   */
  getButtonState() {
    return this.#buttonState;
  }
  //==============================================================================
  // 클릭 이벤트 설정.
  //==============================================================================
  /**
   * @param { function(UIButton): boolean } callback
   */
  setClickEvent(callback) {
    this.#clickEvent = callback;
  }
  //==============================================================================
  // 클릭 이벤트 설정.
  //==============================================================================
  /**
   * @param { function(UIButton): boolean } callback
   */
  setStateEvent(buttonState, callback) {
    switch (buttonState) {
      case ButtonState.normal: {
        break;
      }
    }
  }
  //==============================================================================
  // 클릭 이벤트 반환.
  //==============================================================================
  /**
   * @returns { function(UIButton): boolean }
   */
  getClickEvent() {
    return this.#clickEvent;
  }
  //==============================================================================
  // 누름 이벤트 설정.
  //==============================================================================
  /**
   * @param { function(UIButton): void } callback
   */
  setPressedEvent(callback) {
    this.#pressedEvent = callback;
  }
  //==============================================================================
  // 누름 이벤트 반환.
  //==============================================================================
  /**
   * @returns { function(UIButton): void }
   */
  getPressedEvent() {
    return this.#pressedEvent;
  }
  //==============================================================================
  // 뗌 이벤트 설정.
  //==============================================================================
  /**
   * @param { function(UIButton): void } callback
   */
  setReleasedEvent(callback) {
    this.#releasedEvent = callback;
  }
  //==============================================================================
  // 뗌 이벤트 반환.
  //==============================================================================
  /**
   * @returns { function(UIButton): void }
   */
  getReleasedEvent() {
    return this.#releasedEvent;
  }
  //==============================================================================
  // 클릭됨 이벤트 설정.
  //==============================================================================
  /**
   * @param { function(UIButton): void } callback
   */
  setClickedEvent(callback) {
    this.#clickedEvent = callback;
  }
  //==============================================================================
  // 클릭됨 이벤트 반환.
  //==============================================================================
  /**
   * @returns { function(UIButton): void }
   */
  getClickedEvent() {
    return this.#clickedEvent;
  }
  //==============================================================================
  // 눌림 틴트 색상 설정.
  //==============================================================================
  /**
   * @param { Color } color
   */
  setPressedTintColor(color) {
    this.#pressedTintColor = color;
  }
  //==============================================================================
  // 눌림 틴트 색상 반환.
  //==============================================================================
  /**
   * @returns { Color }
   */
  getPressedTintColor() {
    return this.#pressedTintColor;
  }
  //==============================================================================
  // 트랜지션 지속 시간 설정.
  //==============================================================================
  /**
   * @param { number } duration
   */
  setTransitionDuration(duration) {
    this.#transitionDuration = duration;
  }
  //==============================================================================
  // 트랜지션 지속 시간 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getTransitionDuration() {
    return this.#transitionDuration;
  }
  //==============================================================================
  // 활성화 여부 설정.
  //==============================================================================
  /**
   * @param { boolean } isInteractable
   */
  setInteractable(isInteractable) {
    if (this.getInteractable() === isInteractable) {
      return;
    }
    this.#isInteractable = isInteractable;
    if (!isInteractable) {
      this.collectColorTargets();
      this.setButtonState(ButtonState.disabled);
    } else {
      this.#tintProgress = 0;
      this.applyTintProgress(0);
      this.setButtonState(ButtonState.normal);
    }
  }
  //==============================================================================
  // 활성화 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  getInteractable() {
    return this.#isInteractable;
  }
};

// src/ui/uitogglebutton.js
var UIToggleButton = class extends UIButton {
  static {
    __name(this, "UIToggleButton");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { boolean } */
  #isOn;
  /** @private @type { Color } */
  #onTintColor;
  /** @private @type { function(UIToggleButton): void } */
  #toggledEvent;
  /** @private @type { function(UIToggleButton): void } */
  #externalClickedEvent;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @construct
   */
  constructor() {
    super();
    this.setComponentType("ToggleButton");
    this.#isOn = false;
    this.#onTintColor = new Color(0, 0, 0, 0.3);
    this.#toggledEvent = null;
    this.#externalClickedEvent = null;
    super.setClickedEvent(this.#onClicked.bind(this));
  }
  //==============================================================================
  // 틴트 트랜지션 갱신 (오버라이드: 켜짐 상태 고정).
  //==============================================================================
  /**
   * @override
   * @param { number } timeDelta
   */
  updateTintTransition(timeDelta) {
    const isOn = this.getIsOn();
    if (isOn) {
      super.applyTintProgress(1);
      return;
    }
    super.updateTintTransition(timeDelta);
  }
  //==============================================================================
  // 클릭 이벤트 설정 (오버라이드: 외부 콜백 별도 저장).
  //==============================================================================
  /**
   * @override
   * @param { function(UIToggleButton): void } callback
   */
  setClickedEvent(callback) {
    this.#externalClickedEvent = callback;
  }
  //==============================================================================
  // 클릭 처리.
  //==============================================================================
  /** @private */
  #onClicked() {
    this.#isOn = !this.getIsOn();
    super.collectColorTargets();
    const isOn = this.getIsOn();
    super.applyTintProgress(isOn ? 1 : 0);
    const toggledEvent = this.getToggledEvent();
    if (toggledEvent) {
      toggledEvent(this);
    }
    if (this.#externalClickedEvent) {
      this.#externalClickedEvent(this);
    }
  }
  //==============================================================================
  // 켜짐 여부 설정.
  //==============================================================================
  /**
   * @param { boolean } isOn
   */
  setIsOn(isOn) {
    if (this.getIsOn() === isOn) {
      return;
    }
    this.#isOn = isOn;
    super.collectColorTargets();
    const currentIsOn = this.getIsOn();
    super.applyTintProgress(currentIsOn ? 1 : 0);
  }
  //==============================================================================
  // 켜짐 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  getIsOn() {
    return this.#isOn;
  }
  //==============================================================================
  // 켜짐 틴트 색상 설정.
  //==============================================================================
  /**
   * @param { Color } color
   */
  setOnTintColor(color) {
    this.#onTintColor = color;
    super.setPressedTintColor(color);
  }
  //==============================================================================
  // 켜짐 틴트 색상 반환.
  //==============================================================================
  /**
   * @returns { Color }
   */
  getOnTintColor() {
    return this.#onTintColor;
  }
  //==============================================================================
  // 토글 이벤트 설정.
  //==============================================================================
  /**
   * @param { function(UIToggleButton): void } callback
   */
  setToggledEvent(callback) {
    this.#toggledEvent = callback;
  }
  //==============================================================================
  // 토글 이벤트 반환.
  //==============================================================================
  /**
   * @returns { function(UIToggleButton): void }
   */
  getToggledEvent() {
    return this.#toggledEvent;
  }
};

// src/ui/uiinputfield.js
var System30 = globalThis;
var UIInputField = class extends WorldNode {
  static {
    __name(this, "UIInputField");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { * } */
  #engine;
  /** @private @type { boolean } */
  #useDOMInput;
  /** @private @type { HTMLInputElement | null } */
  #domInput;
  /** @private @type { Function | null } */
  #canvasKeydownHandler;
  /** @private @type { Function | null } */
  #canvasFocusHandler;
  /** @private @type { Function | null } */
  #contextMenuHandler;
  /** @private @type { HTMLElement | null } */
  #contextMenuElement;
  /** @private @type { Function | null } */
  #contextMenuDismissHandler;
  /** @private @type { string } */
  #value;
  /** @private @type { string } */
  #composition;
  /** @private @type { boolean } */
  #isComposing;
  /** @private @type { number } */
  #cursorIndex;
  /** @private @type { number } */
  #selectionStart;
  /** @private @type { number } */
  #dragStartIndex;
  /** @private @type { boolean } */
  #focused;
  /** @private @type { number } */
  #blinkTimer;
  /** @private @type { boolean } */
  #cursorVisible;
  /** @private @type { number } */
  #fontSize;
  /** @private @type { FontFace | null } */
  #fontFace;
  /** @private @type { number } */
  #padding;
  /** @private @type { string } */
  #placeholder;
  /** @private @type { number } */
  #maxLength;
  /** @private @type { (value: string) => void | null } */
  #onChangeCallback;
  /** @private @type { (value: string) => void | null } */
  #onSubmitCallback;
  /** @private @type { Paint } */
  #bgPaint;
  /** @private @type { number } */
  #bgRoundSize;
  /** @private @type { Color } */
  #textColor;
  /** @private @type { Color } */
  #placeholderColor;
  /** @private @type { Color } */
  #cursorColor;
  /** @private @type { Color } */
  #compositionUnderlineColor;
  /** @private @type { Color } */
  #focusBorderColor;
  /** @private @type { number } */
  #focusBorderWidth;
  /** @private @type { Color } */
  #selectionColor;
  /** @private @type { WorldNode } */
  #textTextNode;
  /** @private @type { UILabel } */
  #textUILabel;
  /** @private @type { WorldNode } */
  #placeholderTextNode;
  /** @private @type { UILabel } */
  #placeholderUILabel;
  /** @private @type { WorldNode } */
  #overlayNode;
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.setPivot(Pivot.topLeft);
    this.setAnchor(Pivot.topLeft);
    this.setInteractable(true);
    this.#engine = null;
    this.#useDOMInput = false;
    this.#domInput = null;
    this.#canvasKeydownHandler = null;
    this.#canvasFocusHandler = null;
    this.#contextMenuHandler = null;
    this.#contextMenuElement = null;
    this.#contextMenuDismissHandler = null;
    this.#value = "";
    this.#composition = "";
    this.#isComposing = false;
    this.#cursorIndex = 0;
    this.#selectionStart = 0;
    this.#dragStartIndex = -1;
    this.#focused = false;
    this.#blinkTimer = 0;
    this.#cursorVisible = true;
    this.#fontSize = 28;
    this.#fontFace = null;
    this.#padding = 16;
    this.#placeholder = "";
    this.#maxLength = 0;
    this.#onChangeCallback = null;
    this.#onSubmitCallback = null;
    this.#textColor = Color.createFromHEX("#222222");
    this.#placeholderColor = Color.createFromHEX("#999999");
    this.#cursorColor = Color.createFromHEX("#5b8def");
    this.#compositionUnderlineColor = Color.createFromHEX("#5b8def");
    this.#focusBorderColor = Color.createFromHEX("#f97316");
    this.#focusBorderWidth = 3;
    this.#selectionColor = new Color(91 / 255, 141 / 255, 239 / 255, 0.35);
    this.#bgRoundSize = 8;
    this.#bgPaint = this.addComponent(Paint);
    this.#bgPaint.setRoundSize(this.#bgRoundSize);
    this.#bgPaint.setColor(Color.createFromHEX("#ffffff"));
    this.addComponent(BackgroundLayerRenderer);
    this.#placeholderTextNode = new WorldNode();
    this.#placeholderTextNode.setPivot(Pivot.topLeft);
    this.#placeholderTextNode.setAnchor(Pivot.topLeft);
    this.#placeholderUILabel = this.#placeholderTextNode.addComponent(UILabel);
    this.#placeholderUILabel.setBackgroundColor(Color.transparent());
    this.#placeholderUILabel.setText("");
    this.#placeholderUILabel.setFontSize(this.#fontSize);
    this.#placeholderUILabel.setTextAlign("left");
    this.#placeholderUILabel.setTextBaseline("middle");
    this.#placeholderUILabel.setTextColor(this.#placeholderColor);
    this.addChild(this.#placeholderTextNode);
    this.#textTextNode = new WorldNode();
    this.#textTextNode.setPivot(Pivot.topLeft);
    this.#textTextNode.setAnchor(Pivot.topLeft);
    this.#textUILabel = this.#textTextNode.addComponent(UILabel);
    this.#textUILabel.setBackgroundColor(Color.transparent());
    this.#textUILabel.setText("");
    this.#textUILabel.setFontSize(this.#fontSize);
    this.#textUILabel.setTextAlign("left");
    this.#textUILabel.setTextBaseline("middle");
    this.#textUILabel.setTextColor(this.#textColor);
    this.addChild(this.#textTextNode);
    this.#overlayNode = new WorldNode();
    this.#overlayNode.setPivot(Pivot.topLeft);
    this.#overlayNode.setAnchor(Pivot.topLeft);
    this.#overlayNode.addComponent(OverlayLayerRenderer);
    this.addChild(this.#overlayNode);
    this.refreshTexts();
  }
  //==============================================================================
  // 설정.
  //==============================================================================
  setEngine(engine) {
    this.#engine = engine;
  }
  setUseDOMInput(use) {
    this.#useDOMInput = !!use;
  }
  isUsingDOMInput() {
    return this.#useDOMInput;
  }
  setText(text) {
    this.#value = String(text || "");
    if (this.#maxLength > 0 && this.#value.length > this.#maxLength) {
      this.#value = this.#value.slice(0, this.#maxLength);
    }
    this.#cursorIndex = this.#value.length;
    this.#selectionStart = this.#cursorIndex;
    if (this.#domInput) this.#domInput.value = this.#value;
    this.refreshTexts();
  }
  getText() {
    return this.#value;
  }
  setPlaceholder(text) {
    this.#placeholder = String(text || "");
    this.refreshTexts();
  }
  setMaxLength(n) {
    this.#maxLength = n | 0;
    if (this.#domInput) {
      if (this.#maxLength > 0) this.#domInput.maxLength = this.#maxLength;
      else this.#domInput.removeAttribute("maxlength");
    }
  }
  setFontSize(size) {
    this.#fontSize = size;
    this.#textUILabel.setFontSize(size);
    this.#placeholderUILabel.setFontSize(size);
  }
  setFont(fontFace) {
    this.#fontFace = fontFace;
    this.#textUILabel.setFont(fontFace);
    this.#placeholderUILabel.setFont(fontFace);
  }
  setPadding(padding) {
    this.#padding = padding;
  }
  setBackgroundColor(color) {
    this.#bgPaint.setColor(color);
  }
  setRoundSize(roundSize) {
    this.#bgRoundSize = roundSize;
    this.#bgPaint.setRoundSize(roundSize);
  }
  setTextColor(color) {
    this.#textColor = color;
    this.#textUILabel.setTextColor(color);
  }
  setPlaceholderColor(color) {
    this.#placeholderColor = color;
    this.#placeholderUILabel.setTextColor(color);
  }
  setCursorColor(color) {
    this.#cursorColor = color;
    this.#compositionUnderlineColor = color;
  }
  setFocusBorderColor(color) {
    this.#focusBorderColor = color;
  }
  setFocusBorderWidth(width) {
    this.#focusBorderWidth = width;
  }
  setSelectionColor(color) {
    this.#selectionColor = color;
  }
  setOnChange(callback) {
    this.#onChangeCallback = callback;
  }
  setOnSubmit(callback) {
    this.#onSubmitCallback = callback;
  }
  //==============================================================================
  // 렌더 상태 스냅샷 (오버레이/배경 렌더러가 읽음).
  //==============================================================================
  getRenderState() {
    return {
      value: this.#value,
      composition: this.#composition,
      cursorIndex: this.#cursorIndex,
      selectionStart: this.#selectionStart,
      focused: this.#focused,
      cursorVisible: this.#cursorVisible,
      fontSize: this.#fontSize,
      fontFace: this.#fontFace,
      padding: this.#padding,
      cursorColor: this.#cursorColor,
      compositionUnderlineColor: this.#compositionUnderlineColor,
      focusBorderColor: this.#focusBorderColor,
      focusBorderWidth: this.#focusBorderWidth,
      selectionColor: this.#selectionColor,
      bgRoundSize: this.#bgRoundSize
    };
  }
  //==============================================================================
  // 입력 라이프사이클: 활성화(attach) / 비활성화(detach).
  //==============================================================================
  attach() {
    if (this.#useDOMInput) this.attachDOMInput();
    else this.attachCanvasKeyboard();
    this.attachContextMenuHandler();
  }
  detach() {
    this.detachDOMInput();
    this.detachCanvasKeyboard();
    this.detachContextMenuHandler();
    this.hideContextMenu();
  }
  //==============================================================================
  // 외부 API.
  //==============================================================================
  focus() {
    if (this.#useDOMInput) {
      if (this.#domInput) this.#domInput.focus();
    } else {
      this.handleFocus();
    }
  }
  blur() {
    if (this.#useDOMInput && this.#domInput) this.#domInput.blur();
    else this.handleBlur();
  }
  isFocused() {
    return this.#focused;
  }
  selectAll() {
    this.#selectionStart = 0;
    this.#cursorIndex = this.#value.length;
    if (this.#domInput) this.#domInput.setSelectionRange(0, this.#value.length);
  }
  //==============================================================================
  // 매 프레임: 라벨 위치 / 텍스트 동기, DOM 위치 동기, 커서 깜빡임, selection 폴링.
  //==============================================================================
  tick(timeDelta) {
    super.tick(timeDelta);
    this.refreshTextPositions();
    if (this.#domInput) {
      this.layoutDOMInput();
      if (this.#focused && !this.#isComposing && this.#dragStartIndex < 0) {
        const selEnd = this.#domInput.selectionEnd;
        const selStart = this.#domInput.selectionStart;
        if (typeof selEnd === "number" && typeof selStart === "number") {
          const ourMin = System30.Math.min(this.#cursorIndex, this.#selectionStart);
          const ourMax = System30.Math.max(this.#cursorIndex, this.#selectionStart);
          if (selStart !== ourMin || selEnd !== ourMax) {
            this.#cursorIndex = selEnd;
            this.#selectionStart = selStart;
            this.#blinkTimer = 0;
            this.#cursorVisible = true;
          }
        }
      }
    }
    if (this.#focused) {
      this.#blinkTimer += timeDelta;
      if (this.#blinkTimer >= 0.5) {
        this.#blinkTimer = 0;
        this.#cursorVisible = !this.#cursorVisible;
      }
    } else {
      this.#cursorVisible = true;
    }
  }
  //==============================================================================
  // 캔버스 측 터치 (포지션 기반 커서 / 드래그 선택). pointer-events: none 인 DOM input
  // 이 클릭을 가로채지 않으므로 항상 여기로 들어옴.
  //==============================================================================
  touchPress(viewInputPosition) {
    this.focus();
    this.hideContextMenu();
    const localX = viewInputPosition.x - this.getPosition().x;
    const index = this.measureIndexAtLocalX(localX);
    this.#dragStartIndex = index;
    this.#cursorIndex = index;
    this.#selectionStart = index;
    if (this.#domInput) this.#domInput.setSelectionRange(index, index);
    this.#blinkTimer = 0;
    this.#cursorVisible = true;
  }
  touchMove(viewInputPosition) {
    if (this.#dragStartIndex < 0) return;
    const localX = viewInputPosition.x - this.getPosition().x;
    const index = this.measureIndexAtLocalX(localX);
    this.#selectionStart = this.#dragStartIndex;
    this.#cursorIndex = index;
    if (this.#domInput) {
      const selStart = System30.Math.min(this.#dragStartIndex, index);
      const selEnd = System30.Math.max(this.#dragStartIndex, index);
      this.#domInput.setSelectionRange(selStart, selEnd);
    }
    this.#blinkTimer = 0;
    this.#cursorVisible = true;
  }
  touchRelease() {
    this.#dragStartIndex = -1;
  }
  touchCancel() {
    this.#dragStartIndex = -1;
  }
  //==============================================================================
  // localX(노드 로컬 X) → 문자 인덱스. 측정은 오프스크린 2D ctx 로.
  //   (메인 캔버스는 WebGL2 컨텍스트라 2D 측정 불가)
  //==============================================================================
  measureIndexAtLocalX(localX) {
    const value = this.#value;
    if (value.length === 0) return 0;
    const ctx = this.getMeasureContext();
    if (!ctx) return value.length;
    ctx.save();
    const fontFamily = this.#fontFace ? this.#fontFace.family : SYSTEM_FONT_STRING;
    ctx.font = `${this.#fontSize}px ${fontFamily}`;
    const targetX = localX - this.#padding;
    if (targetX <= 0) {
      ctx.restore();
      return 0;
    }
    let prevWidth = 0;
    let result = value.length;
    for (let i = 1; i <= value.length; ++i) {
      const width = ctx.measureText(value.slice(0, i)).width;
      if (width >= targetX) {
        result = targetX - prevWidth < width - targetX ? i - 1 : i;
        break;
      }
      prevWidth = width;
    }
    ctx.restore();
    return result;
  }
  getMeasureContext() {
    return getOffscreenMeasureContext();
  }
  //==============================================================================
  // 라벨(UILabel) 갱신.
  // - 값이 비어있으면 textText 숨김 + placeholder 표시.
  // - 조합 중이면 (value + composition) 을 textText 에 합성 표시.
  //==============================================================================
  refreshTexts() {
    const hasValue = this.#value.length > 0 || this.#composition.length > 0;
    this.#placeholderTextNode.setActive(!hasValue);
    this.#textTextNode.setActive(hasValue);
    if (hasValue) {
      const before = this.#value.slice(0, this.#cursorIndex);
      const after = this.#value.slice(this.#cursorIndex);
      this.#textUILabel.setText(before + this.#composition + after);
    }
    this.#placeholderUILabel.setText(this.#placeholder);
  }
  refreshTextPositions() {
    const size = this.getContentSize();
    if (size.x <= 0 || size.y <= 0) return;
    const inner = Vector2.create(System30.Math.max(0, size.x - this.#padding * 2), size.y);
    this.#textTextNode.setLocalPosition(Vector2.create(this.#padding, 0));
    this.#textTextNode.setContentSize(inner);
    this.#placeholderTextNode.setLocalPosition(Vector2.create(this.#padding, 0));
    this.#placeholderTextNode.setContentSize(inner);
    this.#overlayNode.setLocalPosition(Vector2.zero());
    this.#overlayNode.setContentSize(size);
  }
  //==============================================================================
  // DOM <input> (옵션).
  //==============================================================================
  attachDOMInput() {
    if (this.#domInput) return;
    const doc = System30.document;
    ensureGlobalHiddenInputStyle(doc);
    const input = doc.createElement("input");
    input.type = "text";
    input.value = this.#value;
    if (this.#maxLength > 0) input.maxLength = this.#maxLength;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.className = "uiinputfield-hidden";
    const style = input.style;
    style.position = "absolute";
    style.left = "-9999px";
    style.top = "-9999px";
    style.width = "1px";
    style.height = "1px";
    style.zIndex = "1000";
    style.pointerEvents = "none";
    style.boxSizing = "border-box";
    style.outline = "none";
    style.border = "none";
    style.background = "transparent";
    style.color = "transparent";
    style.caretColor = "transparent";
    style.textShadow = "none";
    style.boxShadow = "none";
    style.padding = "0";
    style.margin = "0";
    style.fontFamily = "inherit";
    style.webkitTapHighlightColor = "transparent";
    style.fontSize = "16px";
    input.addEventListener("focus", () => this.handleFocus());
    input.addEventListener("blur", () => this.handleBlur());
    input.addEventListener("input", () => this.handleDOMInputEvent());
    input.addEventListener("compositionstart", () => {
      this.#isComposing = true;
    });
    input.addEventListener("compositionupdate", (event) => {
      this.#composition = event && event.data ? event.data : "";
      this.refreshTexts();
    });
    input.addEventListener("compositionend", () => {
      this.#isComposing = false;
      this.#composition = "";
      this.handleDOMInputEvent();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (this.#onSubmitCallback) this.#onSubmitCallback(this.#value);
      }
    });
    doc.body.appendChild(input);
    this.#domInput = input;
    this.layoutDOMInput();
    this.attachCanvasFocusHandler();
  }
  detachDOMInput() {
    this.detachCanvasFocusHandler();
    if (!this.#domInput) return;
    try {
      if (this.#domInput.parentNode) this.#domInput.parentNode.removeChild(this.#domInput);
    } catch (error) {
    }
    this.#domInput = null;
    this.#focused = false;
    this.#composition = "";
    this.#isComposing = false;
  }
  //==============================================================================
  // 캔버스 touchstart 동기 focus 핸들러 등록.
  // - 엔진의 touchPress 가 rAF 에서 dispatch 되어 iOS 가 gesture 만료로 키보드
  //   호출을 막는 문제를 우회한다.
  // - hit-test 통과 시: 동기 focus → 키보드 표시.
  // - hit-test 실패 (필드 바깥 터치) 시: 현재 focus 상태면 blur → 키보드 숨김.
  //==============================================================================
  attachCanvasFocusHandler() {
    if (this.#canvasFocusHandler) return;
    const engine = this.#engine;
    if (!engine) return;
    const viewManager = engine.getViewManager();
    if (!viewManager) return;
    const canvas = viewManager.getCanvas();
    if (!canvas) return;
    this.#canvasFocusHandler = (pointerEvent) => {
      let clientX;
      let clientY;
      const changedTouches = pointerEvent.changedTouches;
      if (changedTouches && changedTouches.length > 0) {
        clientX = changedTouches[0].clientX;
        clientY = changedTouches[0].clientY;
      } else if (typeof pointerEvent.clientX === "number" && typeof pointerEvent.clientY === "number") {
        clientX = pointerEvent.clientX;
        clientY = pointerEvent.clientY;
      } else {
        return;
      }
      if (!this.#domInput) return;
      const canvasRect = canvas.getBoundingClientRect();
      const canvasPosition = Vector2.create(clientX - canvasRect.left, clientY - canvasRect.top);
      const viewInputPosition = viewManager.canvasPositionToViewPosition(canvasPosition);
      const isVisibleInHierarchy = typeof this.isVisibleInHierarchy === "function" ? this.isVisibleInHierarchy() : true;
      const isInside = isVisibleInHierarchy && this.contains(viewInputPosition);
      if (isInside) {
        this.#domInput.focus();
      } else if (this.#focused) {
        this.#domInput.blur();
      }
    };
    canvas.addEventListener("touchstart", this.#canvasFocusHandler, { passive: true });
    canvas.addEventListener("mousedown", this.#canvasFocusHandler, { passive: true });
  }
  //==============================================================================
  // 캔버스 touchstart 동기 focus 핸들러 해제.
  //==============================================================================
  detachCanvasFocusHandler() {
    if (!this.#canvasFocusHandler) return;
    const engine = this.#engine;
    if (engine) {
      const viewManager = engine.getViewManager();
      if (viewManager) {
        const canvas = viewManager.getCanvas();
        if (canvas) {
          canvas.removeEventListener("touchstart", this.#canvasFocusHandler);
          canvas.removeEventListener("mousedown", this.#canvasFocusHandler);
        }
      }
    }
    this.#canvasFocusHandler = null;
  }
  layoutDOMInput() {
    if (!this.#domInput || !this.#engine) return;
    const viewManager = this.#engine.getViewManager();
    const canvas = viewManager.getCanvas();
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const targetScale = viewManager.getTargetResolutionScale() || 1;
    const globalPos = this.getPosition();
    const contentSize = this.getContentSize();
    this.#domInput.style.left = `${canvasRect.left + globalPos.x * targetScale}px`;
    this.#domInput.style.top = `${canvasRect.top + globalPos.y * targetScale}px`;
    this.#domInput.style.width = `${contentSize.x * targetScale}px`;
    this.#domInput.style.height = `${contentSize.y * targetScale}px`;
  }
  handleDOMInputEvent() {
    if (!this.#domInput) return;
    if (this.#isComposing) return;
    const next = this.#domInput.value;
    if (next === this.#value) return;
    this.#value = next;
    const sel = this.#domInput.selectionEnd;
    this.#cursorIndex = typeof sel === "number" ? sel : this.#value.length;
    this.#selectionStart = this.#cursorIndex;
    this.#blinkTimer = 0;
    this.#cursorVisible = true;
    this.refreshTexts();
    if (this.#onChangeCallback) this.#onChangeCallback(this.#value);
  }
  //==============================================================================
  // 캔버스 모드 키보드 (DOM input 미사용 시).
  //==============================================================================
  attachCanvasKeyboard() {
    if (this.#canvasKeydownHandler) return;
    this.#canvasKeydownHandler = (event) => this.handleCanvasKeydown(event);
    System30.document.addEventListener("keydown", this.#canvasKeydownHandler);
  }
  detachCanvasKeyboard() {
    if (!this.#canvasKeydownHandler) return;
    System30.document.removeEventListener("keydown", this.#canvasKeydownHandler);
    this.#canvasKeydownHandler = null;
  }
  handleCanvasKeydown(event) {
    if (!this.#focused) return;
    const ctrl = event.ctrlKey || event.metaKey;
    if (ctrl) {
      const key = event.key.toLowerCase();
      if (key === "a") {
        event.preventDefault();
        this.selectAll();
        return;
      }
      if (key === "c") {
        event.preventDefault();
        this.copy();
        return;
      }
      if (key === "x") {
        event.preventDefault();
        this.cut();
        return;
      }
      if (key === "v") {
        event.preventDefault();
        this.paste();
        return;
      }
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      if (this.hasSelection()) this.replaceSelection("");
      else if (this.#cursorIndex > 0) this.deleteCharAt(this.#cursorIndex - 1);
    } else if (event.key === "Delete") {
      event.preventDefault();
      if (this.hasSelection()) this.replaceSelection("");
      else if (this.#cursorIndex < this.#value.length) this.deleteCharAt(this.#cursorIndex);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      this.moveCursor(this.#cursorIndex - 1, event.shiftKey);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      this.moveCursor(this.#cursorIndex + 1, event.shiftKey);
    } else if (event.key === "Home") {
      event.preventDefault();
      this.moveCursor(0, event.shiftKey);
    } else if (event.key === "End") {
      event.preventDefault();
      this.moveCursor(this.#value.length, event.shiftKey);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (this.#onSubmitCallback) this.#onSubmitCallback(this.#value);
    } else if (event.key.length === 1 && !event.altKey) {
      event.preventDefault();
      this.replaceSelection(event.key);
    }
    this.#blinkTimer = 0;
    this.#cursorVisible = true;
  }
  moveCursor(newIndex, extendSelection) {
    const clamped = System30.Math.max(0, System30.Math.min(this.#value.length, newIndex));
    this.#cursorIndex = clamped;
    if (!extendSelection) this.#selectionStart = clamped;
    this.refreshTexts();
  }
  deleteCharAt(index) {
    this.#value = this.#value.slice(0, index) + this.#value.slice(index + 1);
    if (this.#cursorIndex > index) this.#cursorIndex -= 1;
    this.#selectionStart = this.#cursorIndex;
    this.refreshTexts();
    if (this.#onChangeCallback) this.#onChangeCallback(this.#value);
  }
  //==============================================================================
  // 포커스 / 블러 핸들러 (DOM/캔버스 모드 공용).
  //==============================================================================
  handleFocus() {
    this.#focused = true;
    this.#blinkTimer = 0;
    this.#cursorVisible = true;
  }
  handleBlur() {
    this.#focused = false;
    this.hideContextMenu();
  }
  //==============================================================================
  // 선택 / 클립보드.
  //==============================================================================
  hasSelection() {
    return this.#cursorIndex !== this.#selectionStart;
  }
  getSelectionRange() {
    if (!this.hasSelection()) return null;
    return {
      start: System30.Math.min(this.#cursorIndex, this.#selectionStart),
      end: System30.Math.max(this.#cursorIndex, this.#selectionStart)
    };
  }
  getSelectionText() {
    const range = this.getSelectionRange();
    if (!range) return "";
    return this.#value.slice(range.start, range.end);
  }
  replaceSelection(text) {
    const range = this.getSelectionRange() || { start: this.#cursorIndex, end: this.#cursorIndex };
    let next = this.#value.slice(0, range.start) + text + this.#value.slice(range.end);
    if (this.#maxLength > 0 && next.length > this.#maxLength) next = next.slice(0, this.#maxLength);
    this.#value = next;
    this.#cursorIndex = range.start + text.length;
    this.#selectionStart = this.#cursorIndex;
    if (this.#domInput) {
      this.#domInput.value = this.#value;
      this.#domInput.setSelectionRange(this.#cursorIndex, this.#cursorIndex);
    }
    this.refreshTexts();
    if (this.#onChangeCallback) this.#onChangeCallback(this.#value);
  }
  cut() {
    if (!this.hasSelection()) return;
    const text = this.getSelectionText();
    this.writeClipboard(text);
    this.replaceSelection("");
  }
  copy() {
    if (!this.hasSelection()) return;
    this.writeClipboard(this.getSelectionText());
  }
  paste() {
    this.readClipboard().then((text) => {
      if (typeof text === "string" && text.length > 0) {
        this.replaceSelection(text);
      }
    }).catch(() => {
    });
  }
  writeClipboard(text) {
    try {
      if (System30.navigator && System30.navigator.clipboard) {
        System30.navigator.clipboard.writeText(text).catch(() => {
        });
      }
    } catch (error) {
    }
  }
  readClipboard() {
    try {
      if (System30.navigator && System30.navigator.clipboard) {
        return System30.navigator.clipboard.readText();
      }
    } catch (error) {
    }
    return System30.Promise.resolve("");
  }
  //==============================================================================
  // 컨텍스트 메뉴 (우클릭).
  //==============================================================================
  attachContextMenuHandler() {
    if (!this.#engine || this.#contextMenuHandler) return;
    const canvas = this.#engine.getViewManager().getCanvas();
    if (!canvas) return;
    this.#contextMenuHandler = (event) => this.handleContextMenuEvent(event);
    canvas.addEventListener("contextmenu", this.#contextMenuHandler);
  }
  detachContextMenuHandler() {
    if (!this.#contextMenuHandler || !this.#engine) return;
    const canvas = this.#engine.getViewManager().getCanvas();
    if (canvas) canvas.removeEventListener("contextmenu", this.#contextMenuHandler);
    this.#contextMenuHandler = null;
  }
  handleContextMenuEvent(event) {
    if (!this.#engine) return;
    const viewManager = this.#engine.getViewManager();
    const canvas = viewManager.getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const canvasNative = Vector2.create(event.clientX - rect.left, event.clientY - rect.top);
    const viewPos = viewManager.canvasPositionToViewPosition(canvasNative);
    if (!this.contains(viewPos)) return;
    event.preventDefault();
    event.stopPropagation();
    this.focus();
    this.showContextMenu(event.clientX, event.clientY);
  }
  showContextMenu(clientX, clientY) {
    this.hideContextMenu();
    const doc = System30.document;
    const menu = doc.createElement("div");
    menu.style.position = "absolute";
    menu.style.left = `${clientX}px`;
    menu.style.top = `${clientY}px`;
    menu.style.zIndex = "10000";
    menu.style.background = "#ffffff";
    menu.style.color = "#222222";
    menu.style.border = "1px solid #cccccc";
    menu.style.borderRadius = "8px";
    menu.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.18)";
    menu.style.padding = "4px 0";
    menu.style.fontFamily = "system-ui, -apple-system, sans-serif";
    menu.style.fontSize = "14px";
    menu.style.minWidth = "140px";
    menu.style.userSelect = "none";
    const hasSel = this.hasSelection();
    const items = [
      { text: "\uC798\uB77C\uB0B4\uAE30", enabled: hasSel, action: /* @__PURE__ */ __name(() => this.cut(), "action") },
      { text: "\uBCF5\uC0AC", enabled: hasSel, action: /* @__PURE__ */ __name(() => this.copy(), "action") },
      { text: "\uBD99\uC5EC\uB123\uAE30", enabled: true, action: /* @__PURE__ */ __name(() => this.paste(), "action") }
    ];
    for (const item of items) {
      const button = doc.createElement("div");
      button.textContent = item.text;
      button.style.padding = "8px 16px";
      button.style.cursor = item.enabled ? "pointer" : "default";
      button.style.color = item.enabled ? "#222222" : "#aaaaaa";
      if (item.enabled) {
        button.addEventListener("mouseenter", () => {
          button.style.background = "#eef2ff";
        });
        button.addEventListener("mouseleave", () => {
          button.style.background = "transparent";
        });
        button.addEventListener("mousedown", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          item.action();
          this.hideContextMenu();
        });
      }
      menu.appendChild(button);
    }
    doc.body.appendChild(menu);
    this.#contextMenuElement = menu;
    System30.setTimeout(() => {
      const dismissHandler = /* @__PURE__ */ __name((event) => {
        if (this.#contextMenuElement && !this.#contextMenuElement.contains(event.target)) {
          this.hideContextMenu();
        }
      }, "dismissHandler");
      this.#contextMenuDismissHandler = dismissHandler;
      doc.addEventListener("pointerdown", dismissHandler, true);
    }, 0);
  }
  hideContextMenu() {
    if (this.#contextMenuElement) {
      try {
        if (this.#contextMenuElement.parentNode) {
          this.#contextMenuElement.parentNode.removeChild(this.#contextMenuElement);
        }
      } catch (error) {
      }
      this.#contextMenuElement = null;
    }
    if (this.#contextMenuDismissHandler) {
      System30.document.removeEventListener("pointerdown", this.#contextMenuDismissHandler, true);
      this.#contextMenuDismissHandler = null;
    }
  }
};
var BackgroundLayerRenderer = class extends Component {
  static {
    __name(this, "BackgroundLayerRenderer");
  }
  constructor() {
    super();
    this.setComponentType("UIInputFieldBgLayer");
  }
  draw(graphic) {
    const node = this.getNode();
    if (!node || typeof node.getRenderState !== "function") return;
    const state = node.getRenderState();
    const contentSize = node.getContentSize();
    if (contentSize.x <= 0 || contentSize.y <= 0) return;
    if (state.composition.length === 0 && state.selectionStart !== state.cursorIndex) {
      graphic.pushState();
      const fontFamily = state.fontFace ? state.fontFace.family : SYSTEM_FONT_STRING;
      graphic.setFontString(`${state.fontSize}px ${fontFamily}`);
      const selStart = System30.Math.min(state.selectionStart, state.cursorIndex);
      const selEnd = System30.Math.max(state.selectionStart, state.cursorIndex);
      const startX = state.padding + graphic.measureText(state.value.slice(0, selStart)).width;
      const endX = state.padding + graphic.measureText(state.value.slice(0, selEnd)).width;
      const halfH = state.fontSize * 0.65;
      const drawY = contentSize.y * 0.5;
      graphic.setFillColor(state.selectionColor.toHEXString());
      graphic.drawRect(Rect.create(startX, drawY - halfH, endX - startX, halfH * 2));
      graphic.popState();
    }
  }
};
var OverlayLayerRenderer = class extends Component {
  static {
    __name(this, "OverlayLayerRenderer");
  }
  constructor() {
    super();
    this.setComponentType("UIInputFieldOverlayLayer");
  }
  draw(graphic) {
    const node = this.getNode();
    if (!node) return;
    const parent = typeof node.getParent === "function" ? node.getParent() : null;
    if (!parent || typeof parent.getRenderState !== "function") return;
    const state = parent.getRenderState();
    const contentSize = node.getContentSize();
    if (contentSize.x <= 0 || contentSize.y <= 0) return;
    graphic.pushState();
    const fontFamily = state.fontFace ? state.fontFace.family : SYSTEM_FONT_STRING;
    graphic.setFontString(`${state.fontSize}px ${fontFamily}`);
    const drawY = contentSize.y * 0.5;
    const padding = state.padding;
    const before = state.value.slice(0, state.cursorIndex);
    if (state.composition.length > 0) {
      const beforeWidth = graphic.measureText(before).width;
      const compWidth = graphic.measureText(state.composition).width;
      const underlineY = drawY + state.fontSize * 0.55;
      graphic.setStrokeColor(state.compositionUnderlineColor.toHEXString());
      graphic.drawLine([
        Vector2.create(padding + beforeWidth, underlineY),
        Vector2.create(padding + beforeWidth + compWidth, underlineY)
      ], 2);
    }
    if (state.focused && state.cursorVisible) {
      const cursorBeforeText = before + state.composition;
      const cursorX = padding + graphic.measureText(cursorBeforeText).width;
      const halfHeight = state.fontSize * 0.6;
      graphic.setStrokeColor(state.cursorColor.toHEXString());
      graphic.drawLine([
        Vector2.create(cursorX, drawY - halfHeight),
        Vector2.create(cursorX, drawY + halfHeight)
      ], 2);
    }
    if (state.focused && state.focusBorderWidth > 0) {
      const w = state.focusBorderWidth;
      const inset = w * 0.5;
      graphic.setStrokeColor(state.focusBorderColor.toHEXString());
      const x = inset;
      const y = inset;
      const rectW = contentSize.x - w;
      const rectH = contentSize.y - w;
      const radius = System30.Math.max(0, state.bgRoundSize - inset);
      graphic.drawStrokeRoundRect(Rect.create(x, y, rectW, rectH), radius, w);
    }
    graphic.popState();
  }
};
var offscreenMeasureCanvas = null;
function getOffscreenMeasureContext() {
  if (!offscreenMeasureCanvas) {
    try {
      offscreenMeasureCanvas = System30.document.createElement("canvas");
    } catch (error) {
      return null;
    }
  }
  return offscreenMeasureCanvas.getContext("2d");
}
__name(getOffscreenMeasureContext, "getOffscreenMeasureContext");
var GLOBAL_STYLE_ID = "uiinputfield-hidden-style";
function ensureGlobalHiddenInputStyle(doc) {
  if (doc.getElementById(GLOBAL_STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = GLOBAL_STYLE_ID;
  style.textContent = `
input.uiinputfield-hidden::selection { background: transparent; color: transparent; }
input.uiinputfield-hidden::-moz-selection { background: transparent; color: transparent; }
input.uiinputfield-hidden::placeholder { color: transparent; }
input.uiinputfield-hidden::-webkit-input-placeholder { color: transparent; }
input.uiinputfield-hidden:-ms-input-placeholder { color: transparent; }
input.uiinputfield-hidden::-ms-clear { display: none; }
input.uiinputfield-hidden::-ms-reveal { display: none; }
input.uiinputfield-hidden:-webkit-autofill,
input.uiinputfield-hidden:-webkit-autofill:hover,
input.uiinputfield-hidden:-webkit-autofill:focus { -webkit-text-fill-color: transparent !important; transition: background-color 9999s ease-in-out 0s; }
`;
  doc.head.appendChild(style);
}
__name(ensureGlobalHiddenInputStyle, "ensureGlobalHiddenInputStyle");

// src/ui/uiprogressview.js
var ProgressDirection = {
  horizontal: "horizontal",
  // 좌→우 채움
  vertical: "vertical"
  // 하→상 채움
};

// src/ui/uislider.js
var UISlider = class extends UIControl {
  static {
    __name(this, "UISlider");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { number } */
  #value;
  /** @private @type { number } */
  #minValue;
  /** @private @type { number } */
  #maxValue;
  /** @private @type { Color } */
  #trackColor;
  /** @private @type { Color } */
  #fillColor;
  /** @private @type { Color } */
  #thumbColor;
  /** @private @type { number } */
  #thumbRadius;
  /** @private @type { number } */
  #cornerRadius;
  /** @private @type { string } */
  #direction;
  /** @private @type { boolean } */
  #isDragging;
  /** @private @type { boolean } */
  #isInteractable;
  /** @private @type { (slider: UISlider) => void } */
  #valueChangedEvent;
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.setComponentType("UISlider");
    this.#value = 0;
    this.#minValue = 0;
    this.#maxValue = 1;
    this.#trackColor = new Color(0.7, 0.7, 0.7, 1);
    this.#fillColor = new Color(0.23, 0.51, 0.96, 1);
    this.#thumbColor = new Color(1, 1, 1, 1);
    this.#thumbRadius = 16;
    this.#cornerRadius = 0;
    this.#direction = ProgressDirection.horizontal;
    this.#isDragging = false;
    this.#isInteractable = true;
    this.#valueChangedEvent = null;
  }
  //==============================================================================
  // 노드에 붙음. (WorldNode 의 isInteractable 을 자동 활성화)
  //==============================================================================
  /**
   * @override
   * @param { ComponentNode } node
   */
  attach(node) {
    super.attach(node);
    if (node instanceof WorldNode) {
      node.setInteractable(true);
    }
  }
  //==============================================================================
  // 출력. (트랙 + 채움 + thumb)
  //==============================================================================
  /**
   * @override
   * @param { Graphic } graphic
   */
  draw(graphic) {
    const node = this.getNode();
    if (!node) {
      return;
    }
    const contentSize = node.getContentSize();
    if (contentSize.x <= 0 || contentSize.y <= 0) {
      return;
    }
    const trackRect = Rect.create(0, 0, contentSize.x, contentSize.y);
    graphic.setFillColor(this.#trackColor);
    if (this.#cornerRadius > 0) {
      graphic.drawRoundRect(trackRect, this.#cornerRadius);
    } else {
      graphic.drawRect(trackRect);
    }
    const ratio = this.getRatio();
    if (ratio > 0) {
      let fillRect;
      if (this.#direction === ProgressDirection.vertical) {
        const fillHeight = contentSize.y * ratio;
        fillRect = Rect.create(0, contentSize.y - fillHeight, contentSize.x, fillHeight);
      } else {
        const fillWidth = contentSize.x * ratio;
        fillRect = Rect.create(0, 0, fillWidth, contentSize.y);
      }
      graphic.setFillColor(this.#fillColor);
      if (this.#cornerRadius > 0) {
        graphic.drawRoundRect(fillRect, this.#cornerRadius);
      } else {
        graphic.drawRect(fillRect);
      }
    }
    let thumbX;
    let thumbY;
    if (this.#direction === ProgressDirection.vertical) {
      thumbX = contentSize.x * 0.5;
      thumbY = contentSize.y * (1 - ratio);
    } else {
      thumbX = contentSize.x * ratio;
      thumbY = contentSize.y * 0.5;
    }
    graphic.setFillColor(this.#thumbColor);
    graphic.drawCircle(Vector2.create(thumbX, thumbY), this.#thumbRadius);
  }
  //==============================================================================
  // 터치 누름.
  //==============================================================================
  /**
   * @param { Vector2 } viewInputPosition
   */
  touchPress(viewInputPosition) {
    if (!this.#isInteractable) {
      return;
    }
    this.#isDragging = true;
    this.updateValueFromInput(viewInputPosition);
  }
  //==============================================================================
  // 터치 이동.
  //==============================================================================
  /**
   * @param { Vector2 } viewInputPosition
   */
  touchMove(viewInputPosition) {
    if (!this.#isDragging) {
      return;
    }
    this.updateValueFromInput(viewInputPosition);
  }
  //==============================================================================
  // 터치 뗌.
  //==============================================================================
  /**
   * @param { Vector2 } viewInputPosition
   */
  touchRelease(viewInputPosition) {
    if (!this.#isDragging) {
      return;
    }
    this.updateValueFromInput(viewInputPosition);
    this.#isDragging = false;
  }
  //==============================================================================
  // 터치 취소.
  //==============================================================================
  /**
   * @param { Vector2 } viewInputPosition
   */
  touchCancel(viewInputPosition) {
    this.#isDragging = false;
  }
  //==============================================================================
  // 입력 좌표 → 값 갱신 + 콜백.
  //==============================================================================
  /**
   * @private
   * @param { Vector2 } viewInputPosition
   */
  updateValueFromInput(viewInputPosition) {
    const node = this.getNode();
    if (!node) {
      return;
    }
    const corners = node.getWorldCorners();
    if (!corners || corners.length < 1) {
      return;
    }
    const topLeft = corners[0];
    const localX = viewInputPosition.x - topLeft.x;
    const localY = viewInputPosition.y - topLeft.y;
    const contentSize = node.getContentSize();
    let ratio;
    if (this.#direction === ProgressDirection.vertical) {
      ratio = contentSize.y > 0 ? 1 - localY / contentSize.y : 0;
    } else {
      ratio = contentSize.x > 0 ? localX / contentSize.x : 0;
    }
    ratio = clamp(ratio, 0, 1);
    const previousValue = this.#value;
    const newValue = this.#minValue + (this.#maxValue - this.#minValue) * ratio;
    this.setValue(newValue);
    if (this.#value !== previousValue && this.#valueChangedEvent) {
      this.#valueChangedEvent(this);
    }
  }
  //==============================================================================
  // 값/범위/비율.
  //==============================================================================
  /**
   * @returns { number }
   */
  getRatio() {
    const range = this.#maxValue - this.#minValue;
    if (range <= 0) {
      return 0;
    }
    const r = (this.#value - this.#minValue) / range;
    return clamp(r, 0, 1);
  }
  /** @param { number } value */
  setValue(value) {
    this.#value = clamp(value, this.#minValue, this.#maxValue);
  }
  getValue() {
    return this.#value;
  }
  /**
   * @param { number } minValue
   * @param { number } maxValue
   */
  setRange(minValue, maxValue) {
    this.#minValue = minValue;
    this.#maxValue = maxValue;
    this.setValue(this.#value);
  }
  getMinValue() {
    return this.#minValue;
  }
  getMaxValue() {
    return this.#maxValue;
  }
  //==============================================================================
  // 외부 setValue 후 콜백을 강제 호출하고 싶을 때.
  //==============================================================================
  fireValueChanged() {
    if (this.#valueChangedEvent) {
      this.#valueChangedEvent(this);
    }
  }
  //==============================================================================
  // 색상.
  //==============================================================================
  /** @param { Color } color */
  setTrackColor(color) {
    this.#trackColor = color;
  }
  getTrackColor() {
    return this.#trackColor;
  }
  /** @param { Color } color */
  setFillColor(color) {
    this.#fillColor = color;
  }
  getFillColor() {
    return this.#fillColor;
  }
  /** @param { Color } color */
  setThumbColor(color) {
    this.#thumbColor = color;
  }
  getThumbColor() {
    return this.#thumbColor;
  }
  //==============================================================================
  // 모양.
  //==============================================================================
  /** @param { number } radius */
  setThumbRadius(radius) {
    this.#thumbRadius = radius;
  }
  getThumbRadius() {
    return this.#thumbRadius;
  }
  /** @param { number } radius */
  setCornerRadius(radius) {
    this.#cornerRadius = radius;
  }
  getCornerRadius() {
    return this.#cornerRadius;
  }
  /** @param { string } direction */
  setDirection(direction) {
    this.#direction = direction;
  }
  getDirection() {
    return this.#direction;
  }
  //==============================================================================
  // 콜백 / 인터랙션.
  //==============================================================================
  /** @param { (slider: UISlider) => void } callback */
  setValueChangedEvent(callback) {
    this.#valueChangedEvent = callback;
  }
  getValueChangedEvent() {
    return this.#valueChangedEvent;
  }
  /** @param { boolean } isInteractable */
  setInteractable(isInteractable) {
    this.#isInteractable = isInteractable;
  }
  getInteractable() {
    return this.#isInteractable;
  }
  /** @returns { boolean } */
  isDragging() {
    return this.#isDragging;
  }
};

// src/ui/uisnapscrollview.js
var System31 = globalThis;
var UISnapScrollView = class extends UIScrollView {
  static {
    __name(this, "UISnapScrollView");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Tween | null } */
  #snapTween;
  /** @private @type { number } */
  #snapCurrentIndex;
  /** @private @type { boolean } */
  #prevIsDragging;
  /** @private @type { boolean } */
  #isSnapToNearest;
  /** @private @type { number } */
  #velocityThreshold;
  /** @private @type { number } */
  #pageChangeThreshold;
  // 느린 스와이프 시 페이지 전환 임계값 (아이템 크기 대비 비율).
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.setComponentType("SnapScrollView");
    this.setScrollMode(ScrollMode.clamp);
    this.setHorizontal(true);
    this.setVertical(false);
    this.#snapTween = null;
    this.#snapCurrentIndex = 0;
    this.#prevIsDragging = false;
    this.#isSnapToNearest = false;
    this.#velocityThreshold = 200;
    this.#pageChangeThreshold = 0.35;
  }
  //==============================================================================
  // 스냅 모드 설정.
  // - false: 1회 스와이프 시 1칸만 이동. (기본값)
  // - true : 드래그 위치에서 가장 가까운 아이템으로 스냅.
  //==============================================================================
  /**
   * @param { boolean } isSnapToNearest
   */
  setSnapToNearest(isSnapToNearest) {
    this.#isSnapToNearest = isSnapToNearest;
  }
  //==============================================================================
  // 스냅 모드 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  getSnapToNearest() {
    return this.#isSnapToNearest;
  }
  //==============================================================================
  // 방향성 스냅 발동 최소 속도 설정. (px/s, 1칸 모드에서만 사용)
  //==============================================================================
  /**
   * @param { number } velocityThreshold
   */
  setVelocityThreshold(velocityThreshold) {
    this.#velocityThreshold = velocityThreshold;
  }
  //==============================================================================
  // 방향성 스냅 발동 최소 속도 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getVelocityThreshold() {
    return this.#velocityThreshold;
  }
  //==============================================================================
  // 느린 스와이프 시 페이지 전환 임계값 설정. (아이템 크기 대비 비율, 기본값: 0.35)
  //==============================================================================
  /**
   * @param { number } pageChangeThreshold
   */
  setPageChangeThreshold(pageChangeThreshold) {
    this.#pageChangeThreshold = pageChangeThreshold;
  }
  //==============================================================================
  // 느린 스와이프 시 페이지 전환 임계값 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getPageChangeThreshold() {
    return this.#pageChangeThreshold;
  }
  //==============================================================================
  // 갱신.
  //==============================================================================
  /**
   * @override
   * @param { number } timeDelta
   */
  tick(timeDelta) {
    const prevIsDragging = this.#prevIsDragging;
    super.tick(timeDelta);
    const currentIsDragging = this.isDragging();
    this.#prevIsDragging = currentIsDragging;
    if (!prevIsDragging && currentIsDragging) {
      this.#snapTween = null;
    }
    if (currentIsDragging) {
      this.clampScrollOffsetToAdjacentPages();
    }
    if (prevIsDragging && !currentIsDragging) {
      this.playSnapTween();
    }
    if (this.#snapTween !== null) {
      this.#snapTween.tick(timeDelta);
    }
  }
  //==============================================================================
  // 드래그 중 스크롤 오프셋을 현재 페이지의 인접 페이지 범위로 제한.
  //==============================================================================
  clampScrollOffsetToAdjacentPages() {
    const contentNode = this.getContent();
    if (!contentNode) {
      return;
    }
    const children = contentNode.getChildren();
    if (children.length === 0) {
      return;
    }
    const snapOffsets = this.computeSnapOffsets();
    const snapCurrentIndex = this.getSnapCurrentIndex();
    const maxIndex = children.length - 1;
    const prevIndex = System31.Math.max(0, snapCurrentIndex - 1);
    const nextIndex = System31.Math.min(maxIndex, snapCurrentIndex + 1);
    const isHorizontal = this.isHorizontal();
    const currentOffset = this.getScrollOffset();
    if (isHorizontal) {
      const maxOffset = snapOffsets[prevIndex];
      const minOffset = snapOffsets[nextIndex];
      const clampedX = clamp(currentOffset.x, minOffset, maxOffset);
      if (clampedX !== currentOffset.x) {
        this.setScrollOffset(Vector2.create(clampedX, currentOffset.y));
      }
    } else {
      const maxOffset = snapOffsets[prevIndex];
      const minOffset = snapOffsets[nextIndex];
      const clampedY = clamp(currentOffset.y, minOffset, maxOffset);
      if (clampedY !== currentOffset.y) {
        this.setScrollOffset(Vector2.create(currentOffset.x, clampedY));
      }
    }
  }
  //==============================================================================
  // 자식 노드별 스냅 오프셋 목록 계산.
  // - 각 아이템 중앙이 뷰포트 중앙에 오는 스크롤 오프셋 배열을 반환한다.
  // - 아이템 크기가 불균일해도 올바르게 계산된다.
  //==============================================================================
  /**
   * @returns { number[] }
   */
  computeSnapOffsets() {
    const node = this.getNode();
    const contentNode = this.getContent();
    if (!node || !contentNode) {
      return [];
    }
    const children = contentNode.getChildren();
    if (children.length === 0) {
      return [];
    }
    const viewportSize = node.getContentSize();
    const isHorizontal = this.isHorizontal();
    const snapOffsets = [];
    for (let snapOffsetIndex = 0; snapOffsetIndex < children.length; ++snapOffsetIndex) {
      const child = children[snapOffsetIndex];
      const childLocalPosition = child.getLocalPosition();
      const childContentSize = child.getContentSize();
      let snapOffset;
      if (isHorizontal) {
        snapOffset = viewportSize.x * 0.5 - childLocalPosition.x - childContentSize.x * 0.5;
      } else {
        snapOffset = viewportSize.y * 0.5 - childLocalPosition.y - childContentSize.y * 0.5;
      }
      snapOffsets.push(snapOffset);
    }
    return snapOffsets;
  }
  //==============================================================================
  // 현재 오프셋과 속도를 기반으로 스냅 인덱스를 결정하고 트윈을 시작한다.
  //==============================================================================
  playSnapTween() {
    const contentNode = this.getContent();
    if (!contentNode) {
      return;
    }
    const children = contentNode.getChildren();
    if (children.length === 0) {
      return;
    }
    const snapOffsets = this.computeSnapOffsets();
    const currentOffset = this.getScrollOffset();
    const isHorizontal = this.isHorizontal();
    const currentAxisOffset = isHorizontal ? currentOffset.x : currentOffset.y;
    const snapCurrentIndex = this.getSnapCurrentIndex();
    const currentSnapOffset = snapOffsets[snapCurrentIndex];
    const dragAmount = currentAxisOffset - currentSnapOffset;
    const direction = dragAmount < 0 ? 1 : -1;
    const candidateIndex = clamp(snapCurrentIndex + direction, 0, children.length - 1);
    let targetIndex;
    if (candidateIndex !== snapCurrentIndex) {
      const candidateChild = children[candidateIndex];
      const candidateChildContentSize = candidateChild.getContentSize();
      const targetItemSize = isHorizontal ? candidateChildContentSize.x : candidateChildContentSize.y;
      const pageChangeThreshold = this.getPageChangeThreshold();
      if (System31.Math.abs(dragAmount) >= targetItemSize * pageChangeThreshold) {
        targetIndex = candidateIndex;
      } else {
        targetIndex = snapCurrentIndex;
      }
    } else {
      targetIndex = snapCurrentIndex;
    }
    this.setSnapCurrentIndex(targetIndex);
  }
  //==============================================================================
  // 지정 인덱스로 이동.
  // - smooth: true이면 트윈으로 부드럽게, false이면 즉시 이동.
  //==============================================================================
  /**
   * @param { number } index
   * @param { boolean } smooth
   */
  pageTo(index, smooth) {
    const contentNode = this.getContent();
    if (!contentNode) {
      return;
    }
    const children = contentNode.getChildren();
    if (children.length === 0) {
      return;
    }
    const clampedIndex = clamp(index, 0, children.length - 1);
    if (smooth) {
      this.setSnapCurrentIndex(clampedIndex);
    } else {
      this.#snapCurrentIndex = clampedIndex;
      this.#snapTween = null;
      const snapOffsets = this.computeSnapOffsets();
      const isHorizontal = this.isHorizontal();
      const currentOffset = this.getScrollOffset();
      const snapCurrentIndex = this.getSnapCurrentIndex();
      const targetSnapOffset = snapOffsets[snapCurrentIndex];
      let targetOffsetX;
      let targetOffsetY;
      if (isHorizontal) {
        targetOffsetX = targetSnapOffset;
        targetOffsetY = currentOffset.y;
      } else {
        targetOffsetX = currentOffset.x;
        targetOffsetY = targetSnapOffset;
      }
      this.setScrollOffset(Vector2.create(targetOffsetX, targetOffsetY));
    }
  }
  //==============================================================================
  // 특정 인덱스로 스냅 트윈 이동.
  //==============================================================================
  /**
   * @param { number } index
   */
  setSnapCurrentIndex(index) {
    const contentNode = this.getContent();
    if (!contentNode) {
      return;
    }
    const children = contentNode.getChildren();
    if (children.length === 0) {
      return;
    }
    this.#snapCurrentIndex = clamp(index, 0, children.length - 1);
    const snapOffsets = this.computeSnapOffsets();
    const isHorizontal = this.isHorizontal();
    const currentOffset = this.getScrollOffset();
    const snapCurrentIndex = this.getSnapCurrentIndex();
    const targetSnapOffset = snapOffsets[snapCurrentIndex];
    let targetOffsetX;
    let targetOffsetY;
    if (isHorizontal) {
      targetOffsetX = targetSnapOffset;
      targetOffsetY = currentOffset.y;
    } else {
      targetOffsetX = currentOffset.x;
      targetOffsetY = targetSnapOffset;
    }
    const startOffsetX = currentOffset.x;
    const startOffsetY = currentOffset.y;
    this.#snapTween = new Tween({ x: startOffsetX, y: startOffsetY });
    this.#snapTween.to({ x: targetOffsetX, y: targetOffsetY }, 0.3);
    this.#snapTween.easing(Tween.easingFunction.cubic.out);
    this.#snapTween.setUpdate((values) => {
      this.setScrollOffset(Vector2.create(values.x, values.y));
    });
    this.#snapTween.setComplete(() => {
      this.#snapTween = null;
    });
    this.#snapTween.start();
  }
  //==============================================================================
  // 현재 스냅 인덱스 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getSnapCurrentIndex() {
    return this.#snapCurrentIndex;
  }
};

// src/resource/animationclip.js
var AnimationClip = class extends Object2 {
  static {
    __name(this, "AnimationClip");
  }
  /** @private @type { Frame[] } */
  #frames;
  // 프레임 목록.
  /** @private @type { boolean } */
  #isLoop;
  // 반복 재생 여부.
  /** @private @type { number } */
  #duration;
  // 총 애니메이션 재생 시간.
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.#frames = [];
    this.#duration = 0;
    this.#isLoop = false;
  }
  //==============================================================================
  // 프레임 목록 설정.
  //==============================================================================
  /**
   * @param { Frame[] } frames
   */
  setFrames(frames) {
    this.#frames = frames;
  }
  //==============================================================================
  // 반복 재생 여부 설정.
  //==============================================================================
  /**
   * @param { boolean } isLoop
   */
  setLoop(isLoop) {
    this.#isLoop = isLoop;
  }
  //==============================================================================
  // 애니메이션 지속 시간 설정.
  //==============================================================================
  /**
   * @param { number } duration
   */
  setDuration(duration) {
    this.#duration = duration;
  }
  //==============================================================================
  // 반복 재생 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isLoop() {
    return this.#isLoop;
  }
  //==============================================================================
  // 대상 인덱스에 대한 프레임 반환.
  //==============================================================================
  /**
   * @param { number } index
   * @returns { Frame }
   */
  getFrame(index) {
    return this.#frames[index];
  }
  //==============================================================================
  // 프레임 목록 반환.
  //==============================================================================
  /**
   * @returns { Frame[] }
   */
  getFrames() {
    return this.#frames;
  }
  //==============================================================================
  // 전체 프레임 수 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getFrameCount() {
    return this.#frames.length;
  }
  //==============================================================================
  // 애니메이션 지속 시간 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getDuration() {
    return this.#duration;
  }
};

// src/resource/blobasset.js
var System32 = globalThis;
var BlobAsset = class extends Asset {
  static {
    __name(this, "BlobAsset");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Blob } */
  #blob;
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.setAssetType(AssetType.blob);
    this.#blob = null;
  }
  //==============================================================================
  // 비동기 애셋 로드.
  //==============================================================================
  /**
   * @override
   * @param { string } assetPath 
   */
  async load(assetPath) {
    const isLoaded = this.isLoaded();
    if (isLoaded) {
      return Promise.resolve();
    }
    await super.load(assetPath);
    const response = await System32.fetch(assetPath);
    this.#blob = await response.blob();
    this.setLoaded(true);
  }
  //==============================================================================
  // 블롭 반환.
  //==============================================================================
  /**
   * @returns { Blob }
   */
  getBlob() {
    return this.#blob;
  }
};

// src/resource/textasset.js
var System33 = globalThis;
var TextAsset = class extends Asset {
  static {
    __name(this, "TextAsset");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @type { string } */
  text;
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.setAssetType(AssetType.text);
    this.text = "";
  }
  //==============================================================================
  // 비동기 애셋 로드.
  //==============================================================================
  /**
   * @override
   * @param { string } assetPath 
   */
  async load(assetPath) {
    const isLoaded = this.isLoaded();
    if (isLoaded) {
      return System33.Promise.resolve();
    }
    try {
      await super.load(assetPath);
      const response = await System33.fetch(assetPath);
      this.text = await response.text();
      this.setLoaded(true);
    } catch (error) {
      console.error(`Error loading text: ${assetPath}`, error);
      throw error;
    }
  }
  //==============================================================================
  // 애셋 언로드.
  //==============================================================================
  /**
   * @override
   */
  unload() {
    super.unload();
    this.text = "";
  }
};

// src/resource/jsonasset.js
var System34 = globalThis;
var JsonAsset = class extends TextAsset {
  static {
    __name(this, "JsonAsset");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @type { System.Object | null } */
  data;
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.setAssetType(AssetType.json);
    this.data = null;
  }
  //==============================================================================
  // 비동기 애셋 로드.
  //==============================================================================
  /**
   * @override
   * @param { string } assetPath 
   */
  async load(assetPath) {
    const isLoaded = this.isLoaded();
    if (isLoaded) {
      return System34.Promise.resolve();
    }
    try {
      await super.load(assetPath);
      this.setLoaded(false);
      this.data = JSON.parse(this.text);
      this.setLoaded(true);
    } catch (error) {
      console.error(`Error loading json: ${assetPath}`, error);
    }
  }
  //==============================================================================
  // 애셋 언로드.
  //==============================================================================
  /**
   * @override
   * @method
   */
  unload() {
    super.unload();
    this.data = null;
  }
};

// src/misc/imagescroller.js
var ImageScroller = class extends Object2 {
  static {
    __name(this, "ImageScroller");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { HTMLImageElement } */
  #image;
  /** @private @type { Rect } */
  #viewRect;
  /** @private @type { Vector2 } */
  #scrollPosition;
  /** @private @type { Vector2 } */
  #scrollSpeed;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.#image = null;
    this.#viewRect = Rect.zero();
    this.#scrollPosition = Vector2.zero();
    this.#scrollSpeed = Vector2.zero();
  }
  //==============================================================================
  // 갱신.
  //==============================================================================
  /**
   * @param { number } timeDelta 
   */
  tick(timeDelta) {
    const scrollPosition = this.getScrollPosition();
    const scrollSpeed = this.getScrollSpeed();
    scrollPosition.x += scrollSpeed.x * timeDelta;
    scrollPosition.y += scrollSpeed.y * timeDelta;
  }
  //==============================================================================
  // 출력.
  //==============================================================================
  /**
   * @param { Graphic } graphic 
   */
  draw(graphic) {
    const image = this.getImage();
    if (!image) {
      return;
    }
    const imgW = image.width;
    const imgH = image.height;
    if (imgW === 0 || imgH === 0) {
      return;
    }
    const scrollPosition = this.getScrollPosition();
    const modX = Math.floor(scrollPosition.x % imgW);
    const modY = Math.floor(scrollPosition.y % imgH);
    const viewRect = this.getViewRect();
    const startX = viewRect.position.x + (modX <= 0 ? modX : modX - imgW);
    const startY = viewRect.position.y + (modY <= 0 ? modY : modY - imgH);
    graphic.beginClipRect(viewRect);
    const overlap = 1.5;
    for (let x = startX; x < viewRect.position.x + viewRect.size.x; x += imgW) {
      for (let y = startY; y < viewRect.position.y + viewRect.size.y; y += imgH) {
        graphic.drawImage(
          image,
          Vector2.create(Math.floor(x), Math.floor(y)),
          Vector2.create(imgW + overlap, imgH + overlap)
        );
      }
    }
    graphic.endClipRect();
  }
  //==============================================================================
  // 이미지 설정.
  //==============================================================================
  /**
   * @param { HTMLImageElement | ImageAsset } image 
   */
  setImage(image) {
    if (image === null || image === void 0) {
      this.#image = null;
    } else if (image instanceof HTMLImageElement) {
      this.#image = image;
    } else if (image instanceof ImageAsset) {
      this.#image = image.image;
    }
  }
  //==============================================================================
  // 이미지 반환.
  //==============================================================================
  /**
   * @returns { HTMLImageElement }
   */
  getImage() {
    return this.#image;
  }
  //==============================================================================
  // 화면 가시 영역 설정.
  //==============================================================================
  /**
   * @param { Rect } rect 
   */
  setViewRect(rect) {
    this.#viewRect = rect;
  }
  //==============================================================================
  // 화면 가시 영역 반환.
  //==============================================================================
  /**
   * @returns { Rect }
   */
  getViewRect() {
    return this.#viewRect;
  }
  //==============================================================================
  // 수직 스크롤 설정.
  //==============================================================================
  /**
   * @param { number } speed 
   */
  setVerticalScrollSpeed(speed) {
    this.#scrollSpeed.y = speed;
  }
  //==============================================================================
  // 수평 스크롤 설정.
  //==============================================================================
  /**
   * @param { number } speed 
   */
  setHorizontalScrollSpeed(value) {
    this.#scrollSpeed.x = value;
  }
  //==============================================================================
  // 스크롤 속도 반환.
  //==============================================================================
  /**
   * @returns { Vector2 } 
   */
  getScrollSpeed(speed) {
    return this.#scrollSpeed;
  }
  //==============================================================================
  // 스크롤 위치 설정.
  //==============================================================================
  /**
   * @param { Vector2 } position 
   */
  setScrollPosition(position) {
    this.#scrollPosition = position;
  }
  //==============================================================================
  // 스크롤 위치 반환.
  //==============================================================================
  /**
   * @returns { HTMLImageElement }
   */
  getScrollPosition() {
    return this.#scrollPosition;
  }
};

// src/misc/toucheffect.js
var System35 = globalThis;
var PARTICLE_GRADIENT_CANVAS_SIZE = 64;
var particleGradientCanvas = null;
function getParticleGradientCanvas() {
  if (particleGradientCanvas === null) {
    const canvas = System35.document.createElement("canvas");
    canvas.width = PARTICLE_GRADIENT_CANVAS_SIZE;
    canvas.height = PARTICLE_GRADIENT_CANVAS_SIZE;
    const canvasRenderingContext = canvas.getContext("2d");
    const halfSize = PARTICLE_GRADIENT_CANVAS_SIZE * 0.5;
    const radialGradient = canvasRenderingContext.createRadialGradient(halfSize, halfSize, 0, halfSize, halfSize, halfSize);
    radialGradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    radialGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    canvasRenderingContext.fillStyle = radialGradient;
    canvasRenderingContext.fillRect(0, 0, PARTICLE_GRADIENT_CANVAS_SIZE, PARTICLE_GRADIENT_CANVAS_SIZE);
    particleGradientCanvas = canvas;
  }
  return particleGradientCanvas;
}
__name(getParticleGradientCanvas, "getParticleGradientCanvas");
var TouchParticle = class extends Object2 {
  static {
    __name(this, "TouchParticle");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @type { Vector2 } */
  position;
  /** @type { Vector2 } */
  velocity;
  /** @type { number } */
  life;
  /** @type { number } */
  maxLife;
  /** @type { number } */
  radius;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.position = Vector2.zero();
    this.velocity = Vector2.zero();
    this.life = 1;
    this.maxLife = 1;
    this.radius = 0;
  }
};
var TouchEffect = class extends WorldNode {
  static {
    __name(this, "TouchEffect");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { string } */
  #originalCompositeOperation;
  /** @private @type { TouchParticle[] } */
  #touchParticles;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.#originalCompositeOperation = "";
    this.#touchParticles = [];
  }
  //==============================================================================
  // 갱신.
  //==============================================================================
  /**
   * @override
   * @param { number } timeDelta 
   */
  tick(timeDelta) {
    super.tick(timeDelta);
    this.updateTouchParticles(timeDelta);
  }
  //==============================================================================
  // 출력 상태 시작.
  //==============================================================================
  /**
   * @override
   * @param { Graphic } graphic 
   */
  pushTransform(graphic) {
    super.pushTransform(graphic);
    if (graphic) {
      this.#originalCompositeOperation = graphic.getBlendMode();
      graphic.setBlendMode("lighter");
    }
  }
  //==============================================================================
  // 출력.
  //==============================================================================
  /**
   * @override
   * @param { Graphic } graphic 
   */
  draw(graphic) {
    super.draw(graphic);
    this.drawTouchParticles(graphic);
  }
  //==============================================================================
  // 출력 상태 종료.
  //==============================================================================
  /**
   * @override
   * @param { Graphic } graphic 
   */
  popTransform(graphic) {
    if (graphic) {
      graphic.setBlendMode(this.#originalCompositeOperation);
    }
    super.popTransform(graphic);
  }
  //==============================================================================
  // 터치 파티클 생성.
  //==============================================================================
  createTouchParticle(x, y) {
    const particle = new TouchParticle();
    particle.position = Vector2.create(x + (random() - 0.5) * 10, y + (random() - 0.5) * 10);
    particle.velocity = Vector2.create((random() - 0.5) * 120, (random() - 0.5) * 120);
    particle.life = 1;
    particle.maxLife = 1;
    particle.radius = random() * 25 + 10;
    this.#touchParticles.push(particle);
  }
  //==============================================================================
  // 터치 파티클 갱신.
  //==============================================================================
  /**
   * @param { number } timeDelta 
   */
  updateTouchParticles(timeDelta) {
    for (let i = this.#touchParticles.length - 1; i >= 0; --i) {
      const particle = this.#touchParticles[i];
      particle.life -= timeDelta * 2.5;
      particle.position.x += particle.velocity.x * timeDelta;
      particle.position.y += particle.velocity.y * timeDelta;
      if (particle.life <= 0) {
        this.#touchParticles.splice(i, 1);
      }
    }
  }
  //==============================================================================
  // 터치 파티클 출력.
  //==============================================================================
  /**
   * @param { Graphic } graphic 
   */
  drawTouchParticles(graphic) {
    if (this.#touchParticles.length === 0) {
      return;
    }
    const gradientCanvas = getParticleGradientCanvas();
    const particleColor = Color.createFromRGBA("rgb(100, 200, 255)");
    const originalAlpha = graphic.getGlobalAlpha();
    graphic.setImageTintColor(particleColor);
    for (let i = 0; i < this.#touchParticles.length; ++i) {
      const particle = this.#touchParticles[i];
      const opacity = max(0, particle.life / particle.maxLife);
      graphic.setGlobalAlpha(originalAlpha * opacity * 0.8);
      const drawPosition = Vector2.create(particle.position.x - particle.radius, particle.position.y - particle.radius);
      const drawSize = Vector2.create(particle.radius * 2, particle.radius * 2);
      graphic.drawImage(gradientCanvas, drawPosition, drawSize);
    }
    graphic.setImageTintColor(null);
    graphic.setGlobalAlpha(originalAlpha);
  }
};

// src/misc/virtualpad.js
var VirtualPadState = {
  none: "wait",
  pressed: "pressed",
  move: "move",
  released: "released"
};
var VirtualPad = class extends Object2 {
  static {
    __name(this, "VirtualPad");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { VirtualPadState } */
  #virtualPadState;
  /** @private @type { Vector2 } */
  #padPosition;
  /** @private @type { number } */
  #padRadius;
  /** @private @type { Color } */
  #padColor;
  /** @private @type { Vector2 } */
  #ballPosition;
  /** @private @type { number } */
  #ballRadius;
  /** @private @type { Color } */
  #ballColor;
  /** @private @type { number } */
  #ballReturnSpeed;
  /** @private @type { function(Vector2, number): void | null } */
  #ballMoveEvent;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.#virtualPadState = VirtualPadState.none;
    this.#padPosition = Vector2.zero();
    this.#padRadius = 200;
    this.#padColor = new Color(0, 0, 0, 1);
    this.#ballPosition = Vector2.zero();
    this.#ballRadius = 50;
    this.#ballColor = new Color(1, 1, 1, 1);
    this.#ballReturnSpeed = 1600;
    this.#ballMoveEvent = null;
  }
  //==============================================================================
  // 갱신.
  //==============================================================================
  /**
   * @param { number } timeDelta
   */
  tick(timeDelta) {
    const virtualPadState = this.getVirtualPadState();
    if (virtualPadState === VirtualPadState.none) {
      return;
    }
    const padPosition = this.getPadPosition();
    const padRadius = this.getPadRadius();
    const ballPosition = this.getBallPosition();
    const moveDelta = ballPosition.subtract(padPosition);
    const distance = moveDelta.length();
    const direction = moveDelta.normalize();
    if (virtualPadState === VirtualPadState.pressed || virtualPadState === VirtualPadState.move) {
      if (distance > padRadius) {
        this.#ballPosition = padPosition.add(direction.multiply(padRadius));
      }
      if (this.#ballMoveEvent !== null) {
        const clampedDistance = min(distance, padRadius);
        const pullStrength = clampedDistance / padRadius;
        const normalizedDirectionX = (direction.x + 1) / 2;
        const normalizedDirectionY = (direction.y + 1) / 2;
        const normalizedDirection = Vector2.create(normalizedDirectionX, normalizedDirectionY);
        this.#ballMoveEvent(normalizedDirection, pullStrength);
      }
    } else if (virtualPadState === VirtualPadState.released) {
      const returnSpeedDelta = this.#ballReturnSpeed * timeDelta;
      if (distance > returnSpeedDelta) {
        const returnMoveDelta = direction.multiply(returnSpeedDelta);
        const currentBallPosition = this.getBallPosition();
        this.#ballPosition = currentBallPosition.subtract(returnMoveDelta);
        if (this.#ballMoveEvent !== null) {
          const updatedBallPosition = this.getBallPosition();
          const returnedMoveDelta = updatedBallPosition.subtract(padPosition);
          const returnedDistance = returnedMoveDelta.length();
          const pullStrength = clamp01(returnedDistance / padRadius);
          const normalizedDirectionX = (direction.x + 1) / 2;
          const normalizedDirectionY = (direction.y + 1) / 2;
          const normalizedDirection = Vector2.create(normalizedDirectionX, normalizedDirectionY);
          this.#ballMoveEvent(normalizedDirection, pullStrength);
        }
      } else {
        this.#ballPosition = padPosition.clone();
        this.#virtualPadState = VirtualPadState.none;
        if (this.#ballMoveEvent !== null) {
          const neutralDirection = Vector2.create(0.5, 0.5);
          this.#ballMoveEvent(neutralDirection, 0);
        }
      }
    }
  }
  //==============================================================================
  // 출력.
  //==============================================================================
  /**
   * @param { Grpahic } graphic
   */
  draw(graphic) {
    const padPosition = this.getPadPosition();
    const padRadius = this.getPadRadius();
    const padColor = this.getPadColor();
    const padColorString = padColor.toRGBAString();
    graphic.setFillColor(padColorString);
    graphic.drawCircle(padPosition, padRadius);
    const ballPosition = this.getBallPosition();
    const ballRadius = this.getBallRadius();
    const ballColor = this.getBallColor();
    const ballColorString = ballColor.toRGBAString();
    graphic.setFillColor(ballColorString);
    graphic.drawCircle(ballPosition, ballRadius);
  }
  //==============================================================================
  // 터치 누름.
  //==============================================================================
  /**
   * @param { Vector2 } viewInputPosition
   */
  touchPress(viewInputPosition) {
    this.#virtualPadState = VirtualPadState.pressed;
    this.#ballPosition = viewInputPosition;
  }
  //==============================================================================
  // 터치 드래그.
  //==============================================================================
  /**
   * @param { Vector2 } viewInputPosition
   */
  touchMove(viewInputPosition) {
    this.#virtualPadState = VirtualPadState.move;
    this.#ballPosition = viewInputPosition;
  }
  //==============================================================================
  // 터치 뗌.
  //==============================================================================
  /**
   * @param { Vector2 } viewInputPosition
   */
  touchRelease(viewInputPosition) {
    this.#virtualPadState = VirtualPadState.released;
  }
  //==============================================================================
  // 터치 취소.
  //==============================================================================
  touchCancel() {
    this.#virtualPadState = VirtualPadState.released;
  }
  //==============================================================================
  // 가상 패드 상태 반환.
  //==============================================================================
  /**
   * @returns { VirtualPadState }
   */
  getVirtualPadState() {
    return this.#virtualPadState;
  }
  //==============================================================================
  // 구슬 이동 이벤트 함수 설정.
  //==============================================================================
  /**
   * @param { Function } callback
   */
  setBallMoveEvent(callback) {
    this.#ballMoveEvent = callback;
  }
  //==============================================================================
  // 패드 위치 설정.
  //==============================================================================
  /**
   * @param { Function } callback
   */
  setPadPosition(padPosition) {
    this.#padPosition = padPosition;
    this.#ballPosition = padPosition;
  }
  //==============================================================================
  // 패드 위치 반환.
  //==============================================================================
  /**
   * @returns { Color }
   */
  getPadPosition() {
    return this.#padPosition;
  }
  //==============================================================================
  // 패드 크기 설정.
  //==============================================================================
  /**
   * @param { Function } callback
   */
  setPadRadius(padRadius) {
    this.#padRadius = padRadius;
  }
  //==============================================================================
  // 패드 크기 반환.
  //==============================================================================
  /**
   * @returns { Color }
   */
  getPadRadius() {
    return this.#padRadius;
  }
  //==============================================================================
  // 구슬 위치 반환.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  getBallPosition() {
    return this.#ballPosition;
  }
  //==============================================================================
  // 구슬 크기 설정.
  //==============================================================================
  /**
   * @param { Function } callback
   */
  setBallRadius(ballRadius) {
    this.#ballRadius = ballRadius;
  }
  //==============================================================================
  // 구슬 크기 반환.
  //==============================================================================
  /**
   * @returns { Color }
   */
  getBallRadius() {
    return this.#ballRadius;
  }
  //==============================================================================
  // 패드 색상 설정.
  //==============================================================================
  /**
   * @param { Color } padColor
   */
  setPadColor(padColor) {
    this.#padColor = padColor;
  }
  //==============================================================================
  // 패드 색상 반환.
  //==============================================================================
  /**
   * @returns { Color }
   */
  getPadColor() {
    return this.#padColor;
  }
  //==============================================================================
  // 구슬 색상 설정.
  //==============================================================================
  /**
   * @param { Color } ballColor
   */
  setBallColor(ballColor) {
    this.#ballColor = ballColor;
  }
  //==============================================================================
  // 구슬 색상 반환.
  //==============================================================================
  /**
   * @returns { Color }
   */
  getBallColor() {
    return this.#ballColor;
  }
};

// src/misc/nodelayout.js
var NodeLayout = class _NodeLayout extends Object2 {
  static {
    __name(this, "NodeLayout");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { * } */
  #node;
  /** @private @type { NodeLayout[] } */
  #childLayouts;
  /** @private @type { * } */
  #parentNode;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @param { Function } [nodeClass]
   */
  constructor(nodeClass) {
    super();
    const NodeClass = nodeClass ?? WorldNode;
    this.#node = new NodeClass();
    this.#childLayouts = [];
    this.#parentNode = null;
  }
  //==============================================================================
  // 레이아웃 인스턴스 생성.
  //==============================================================================
  /**
   * @param { Function } [nodeClass]
   * @returns { NodeLayout }
   */
  static create(nodeClass) {
    const nodeLayout = new _NodeLayout(nodeClass);
    return nodeLayout;
  }
  //==============================================================================
  // 노드 직접 접근. (빌더에 없는 속성을 설정할 때 사용)
  //==============================================================================
  /**
   * @param { Function } callback
   * @returns { NodeLayout }
   */
  apply(callback) {
    callback(this.#node);
    return this;
  }
  //==============================================================================
  // 활성화 설정.
  //==============================================================================
  /**
   * @param { boolean } active
   * @returns { NodeLayout }
   */
  active(active) {
    this.#node.setActive(active);
    return this;
  }
  //==============================================================================
  // 이름 설정.
  //==============================================================================
  /**
   * @param { string } name
   * @returns { NodeLayout }
   */
  name(name) {
    this.#node.setName(name);
    return this;
  }
  //==============================================================================
  // 컴포넌트 추가 및 설정.
  // - callback이 없으면 컴포넌트만 추가한다.
  //==============================================================================
  /**
   * @param { Function } componentType
   * @param { Function } [callback]
   * @returns { NodeLayout }
   */
  component(componentType, callback) {
    const component = this.#node.addComponent(componentType);
    if (callback) {
      callback(component);
    }
    return this;
  }
  //==============================================================================
  // 자식 레이아웃 추가.
  // - 가변 인자로 여러 자식 레이아웃을 한번에 추가할 수 있다.
  //==============================================================================
  /**
   * @param { ...NodeLayout } layouts
   * @returns { NodeLayout }
   */
  children(...layouts) {
    for (const layout of layouts) {
      this.#childLayouts.push(layout);
    }
    return this;
  }
  //==============================================================================
  // 로컬 위치 설정.
  //==============================================================================
  /**
   * @param { number } x
   * @param { number } y
   * @returns { NodeLayout }
   */
  localPosition(x, y) {
    this.#node.setLocalPosition(Vector2.create(x, y));
    return this;
  }
  //==============================================================================
  // 피벗 설정.
  //==============================================================================
  /**
   * @param { Vector2 } pivot
   * @returns { NodeLayout }
   */
  pivot(pivot) {
    this.#node.setPivot(pivot);
    return this;
  }
  //==============================================================================
  // 콘텐츠 크기 설정.
  //==============================================================================
  /**
   * @param { number } x
   * @param { number } y
   * @returns { NodeLayout }
   */
  contentSize(x, y) {
    this.#node.setContentSize(Vector2.create(x, y));
    return this;
  }
  //==============================================================================
  // 로컬 스케일 설정.
  //==============================================================================
  /**
   * @param { number } x
   * @param { number } y
   * @returns { NodeLayout }
   */
  localScale(x, y) {
    this.#node.setLocalScale(Vector2.create(x, y));
    return this;
  }
  //==============================================================================
  // 부모 노드 설정. (build()에 인자 없이 호출 시 이 부모에 자식으로 추가된다.)
  //==============================================================================
  /**
   * @param { * } parentNode
   * @returns { NodeLayout }
   */
  parent(parentNode) {
    this.#parentNode = parentNode;
    return this;
  }
  //==============================================================================
  // 단일 앵커 설정. (WorldNode.setAnchor)
  //==============================================================================
  /**
   * @param { number } x
   * @param { number } y
   * @returns { NodeLayout }
   */
  anchor(x, y) {
    this.#node.setAnchor(Vector2.create(x, y));
    return this;
  }
  //==============================================================================
  // 앵커 기준 위치 오프셋 설정.
  //==============================================================================
  /**
   * @param { number } x
   * @param { number } y
   * @returns { NodeLayout }
   */
  anchoredPosition(x, y) {
    this.#node.setAnchoredPosition(Vector2.create(x, y));
    return this;
  }
  //==============================================================================
  // 마스크 활성화 설정.
  //==============================================================================
  /**
   * @param { boolean } enabled
   * @returns { NodeLayout }
   */
  maskEnabled(enabled) {
    if (enabled) {
      this.#node.getOrAddComponent(Mask);
    } else {
      const maskComponent = this.#node.getComponent(Mask);
      if (maskComponent) {
        this.#node.removeComponent(maskComponent);
      }
    }
    return this;
  }
  //==============================================================================
  // 빌드.
  // - 자식 레이아웃을 모두 재귀적으로 빌드한다.
  // - parent 인자가 제공되면 그 부모에 자식으로 추가한다.
  // - parent 인자가 없고 parent() 메서드로 지정된 부모가 있으면 그 부모에 자식으로 추가한다.
  // - 완성된 노드를 반환한다.
  //==============================================================================
  /**
   * @param { * } [parent]
   * @returns { * }
   */
  build(parent) {
    for (const childLayout of this.#childLayouts) {
      childLayout.build(this.#node);
    }
    const targetParent = parent ?? this.#parentNode;
    if (targetParent) {
      targetParent.addChild(this.#node);
    }
    return this.#node;
  }
};

// src/experimental/collection/list.js
var List = class extends Object2 {
  static {
    __name(this, "List");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { T[] } */
  #items;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.#items = [];
  }
  //==============================================================================
  // 전체 제거.
  //==============================================================================
  clear() {
    this.#items.length = 0;
  }
  //==============================================================================
  // 추가.
  //==============================================================================
  /**
   * @param { T } item 
   */
  add(item) {
    this.#items.push(item);
  }
  //==============================================================================
  // 범위 추가.
  //==============================================================================
  /**
   * @param { T[] } items
   */
  addRange(items) {
    for (const item of items) {
      this.#items.push(item);
    }
  }
  //==============================================================================
  // 제거.
  //==============================================================================
  /**
   * @param { T } item
   * @returns { boolean }
   */
  remove(item) {
    const index = this.#items.indexOf(item);
    if (index !== -1) {
      this.#items.splice(index, 1);
      return true;
    }
    return false;
  }
  //==============================================================================
  // 제거.
  //==============================================================================
  /**
   * @param { number } index
   * @returns { boolean }
   */
  removeAt(index) {
    if (index < 0 || index >= this.#items.length) {
      return false;
    }
    this.#items.splice(index, 1);
    return true;
  }
  //==============================================================================
  // 요소 검색.
  //==============================================================================
  /**
   * @param { function(number, T): boolean } predicate
   * @returns { T | undefined }
   */
  find(predicate) {
    let index = 0;
    const items = this.all();
    for (const item of items) {
      if (predicate.call(index, item)) {
        return item;
      }
      ++index;
    }
    return void 0;
  }
  //==============================================================================
  // 요소 검색.
  //==============================================================================
  /**
   * @param { function(number, T): boolean } predicate
   * @returns { T[] }
   */
  findAll(predicate) {
    let index = 0;
    const result = [];
    const allItems = this.all();
    for (const item of allItems) {
      if (predicate.call(index, item)) {
        result.push(item);
      }
      ++index;
    }
    return result;
  }
  //==============================================================================
  // 요소가 포함되어있는지 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean } 
   */
  contains(item) {
    return this.#items.includes(item);
  }
  //==============================================================================
  // 색인 반환.
  //==============================================================================
  /**
   * @returns { number } 
   */
  indexOf(item) {
    return this.#items.indexOf(item);
  }
  //==============================================================================
  // 요소 반환.
  //==============================================================================
  /**
   * @returns { T } 
   */
  getAt(index) {
    return this.#items[index];
  }
  //==============================================================================
  // 리스트가 비어있는지 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean } 
   */
  isEmpty() {
    return this.#items.length === 0;
  }
  //==============================================================================
  // 리스트 요소 수 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getCount() {
    return this.#items.length;
  }
  //==============================================================================
  // 전체 요소 반환.
  //==============================================================================
  /**
   * @returns { T[] } 
   */
  all() {
    return this.#items;
  }
};

// src/experimental/collection/dictionary.js
var Dictionary = class extends Object2 {
  static {
    __name(this, "Dictionary");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Map<K, V> } */
  #items;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.#items = /* @__PURE__ */ new Map();
  }
  //==============================================================================
  // 전체 제거.
  //==============================================================================
  clear() {
    this.#items.clear();
  }
  //==============================================================================
  // 추가.
  //==============================================================================
  /**
   * @param { K } key
   * @param { V } value 
   */
  add(key, value) {
    this.#items.set(key, value);
  }
  //==============================================================================
  // 제거.
  //==============================================================================
  /**
   * @param { K } key
   * @returns { boolean }
   */
  remove(key) {
    return this.#items.delete(key);
  }
  //==============================================================================
  // 요소 검색.
  //==============================================================================
  /**
   * @param { function(K, V): boolean } predicate
   * @returns { { key: K, value: V } | null }
   */
  find(predicate) {
    const items = this.getItems();
    for (const [key, value] of items) {
      if (predicate.call(key, value)) {
        return {
          key,
          value
        };
      }
    }
    return null;
  }
  //==============================================================================
  // 요소 검색.
  //==============================================================================
  /**
   * @param { function(K, V): boolean } predicate
   * @returns { { key: K, value: V }[] }
   */
  findAll(predicate) {
    const result = [];
    const allItems = this.getItems();
    for (const [key, value] of allItems) {
      if (predicate.call(key, value)) {
        result.push({
          key,
          value
        });
      }
    }
    return result;
  }
  //==============================================================================
  // 요소가 포함되어있는지 여부 반환.
  //==============================================================================
  /**
   * @param { K } key 
   * @returns { boolean } 
   */
  contains(key) {
    return this.#items.has(key);
  }
  //==============================================================================
  // 요소 반환.
  //==============================================================================
  /**
   * @param { K } key
   * @returns { V } 
   */
  get(key) {
    return this.#items.get(key);
  }
  //==============================================================================
  // 요소 수 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getCount() {
    return this.#items.size;
  }
  //==============================================================================
  // 전체 요소 반환.
  //==============================================================================
  /**
   * @returns { Map<K, V> } 
   */
  getItems() {
    return this.#items;
  }
  //==============================================================================
  // 전체 키 반환.
  //==============================================================================
  /**
   * @returns { K[] } 
   */
  getKeys() {
    const items = this.getItems();
    return Array.from(items.keys());
  }
  //==============================================================================
  // 전체 값 반환.
  //==============================================================================
  /**
   * @returns { V[] } 
   */
  getValues() {
    const items = this.getItems();
    return Array.from(items.values());
  }
};

// src/experimental/collection/queue.js
var Queue = class extends Object2 {
  static {
    __name(this, "Queue");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { T[] } */
  #items;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.#items = [];
  }
  //==============================================================================
  // 데이터 추가.
  //==============================================================================
  /**
   * @param { T } item 
   */
  enqueue(item) {
    this.#items.push(item);
  }
  //==============================================================================
  // 데이터 추출 및 제거.
  //==============================================================================
  /**
   * @returns { T | undefined }
   */
  dequeue() {
    return this.#items.shift();
  }
  //==============================================================================
  // 데이터 확인 (제거하지 않음).
  //==============================================================================
  /**
   * @returns { T | undefined }
   */
  peek() {
    return this.#items[0];
  }
  //==============================================================================
  // 전체 제거.
  //==============================================================================
  clear() {
    this.#items.length = 0;
  }
  //==============================================================================
  // 비어있는지 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isEmpty() {
    return this.#items.length === 0;
  }
  //==============================================================================
  // 요소 수 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getCount() {
    return this.#items.length;
  }
  //==============================================================================
  // 전체 요소 배열 반환.
  //==============================================================================
  /**
   * @returns { T[] }
   */
  toArray() {
    return [...this.#items];
  }
};

// src/experimental/collection/stack.js
var Stack = class extends Object2 {
  static {
    __name(this, "Stack");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { T[] } */
  #items;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.#items = [];
  }
  //==============================================================================
  // 데이터 추가.
  //==============================================================================
  /**
   * @param { T } item 
   */
  push(item) {
    this.#items.push(item);
  }
  //==============================================================================
  // 데이터 추출 및 제거.
  //==============================================================================
  /**
   * @returns { T | undefined }
   */
  pop() {
    return this.#items.pop();
  }
  //==============================================================================
  // 데이터 확인 (제거하지 않음).
  //==============================================================================
  /**
   * @returns { T | undefined }
   */
  peek() {
    return this.#items[this.#items.length - 1];
  }
  //==============================================================================
  // 전체 제거.
  //==============================================================================
  clear() {
    this.#items.length = 0;
  }
  //==============================================================================
  // 비어있는지 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isEmpty() {
    return this.#items.length === 0;
  }
  //==============================================================================
  // 요소 수 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getCount() {
    return this.#items.length;
  }
  //==============================================================================
  // 전체 요소 배열 반환.
  //==============================================================================
  /**
   * @returns { T[] }
   */
  toArray() {
    return [...this.#items];
  }
};

// src/experimental/collection/set.js
var System36 = globalThis;
var Set2 = class _Set extends Object2 {
  static {
    __name(this, "Set");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Set<T> } */
  #items;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.#items = new System36.Set();
  }
  //==============================================================================
  // 데이터 추가.
  //==============================================================================
  /**
   * @param { T } item 
   */
  add(item) {
    this.#items.add(item);
  }
  //==============================================================================
  // 데이터 제거.
  //==============================================================================
  /**
   * @param { T } item 
   * @returns { boolean }
   */
  remove(item) {
    return this.#items.delete(item);
  }
  //==============================================================================
  // 요소 포함 여부 반환.
  //==============================================================================
  /**
   * @param { T } item 
   * @returns { boolean }
   */
  contains(item) {
    return this.#items.has(item);
  }
  //==============================================================================
  // 합집합. (Union)
  //==============================================================================
  /**
   * @param { Set<T> } otherSet 
   * @returns { Set<T> }
   */
  union(otherSet) {
    const resultSet = new _Set();
    for (const item of this.#items) {
      resultSet.add(item);
    }
    for (const item of otherSet.toArray()) {
      resultSet.add(item);
    }
    return resultSet;
  }
  //==============================================================================
  // 교집합. (Intersection)
  //==============================================================================
  /**
   * @param { Set<T> } otherSet 
   * @returns { Set<T> }
   */
  intersection(otherSet) {
    const resultSet = new _Set();
    for (const item of this.#items) {
      if (otherSet.contains(item)) {
        resultSet.add(item);
      }
    }
    return resultSet;
  }
  //==============================================================================
  // 차집합. (Difference)
  //==============================================================================
  /**
   * @param { Set<T> } otherSet 
   * @returns { Set<T> }
   */
  difference(otherSet) {
    const resultSet = new _Set();
    for (const item of this.#items) {
      if (!otherSet.contains(item)) {
        resultSet.add(item);
      }
    }
    return resultSet;
  }
  //==============================================================================
  // 대칭 차집합 (여집합). (Symmetric Difference)
  //==============================================================================
  /**
   * @param { Set<T> } otherSet 
   * @returns { Set<T> }
   */
  symmetricDifference(otherSet) {
    const resultSet = new _Set();
    for (const item of this.#items) {
      if (!otherSet.contains(item)) {
        resultSet.add(item);
      }
    }
    for (const item of otherSet.toArray()) {
      if (!this.contains(item)) {
        resultSet.add(item);
      }
    }
    return resultSet;
  }
  //==============================================================================
  // 전체 제거.
  //==============================================================================
  clear() {
    this.#items.clear();
  }
  //==============================================================================
  // 요소 수 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getCount() {
    return this.#items.size;
  }
  //==============================================================================
  // 전체 요소 배열 반환.
  //==============================================================================
  /**
   * @returns { T[] }
   */
  toArray() {
    return Array.from(this.#items);
  }
};

// src/experimental/animation/animator.js
var AnimationState = class extends Object2 {
  static {
    __name(this, "AnimationState");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { AnimationClip } */
  #clip;
  // 클립.
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.#clip = null;
  }
};
var AnimationTransition = class extends Object2 {
  static {
    __name(this, "AnimationTransition");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { AnimationState } */
  #from;
  /** @private @type { AnimationState } */
  #to;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
  }
};
var Animator = class extends Object2 {
  static {
    __name(this, "Animator");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Animation } */
  #animation;
  // 처리기.
  /** @private @type { List<AnimationState> } */
  #states;
  // 상태 목록.
  /** @private @type { List<AnimationTransition> } */
  #transitions;
  // 전환 목록.
  /** @private @type { Dictionary<string, System.Object> } */
  #properties;
  // 애니메이터 프로퍼티 목록.
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.#animation = new Animation();
    this.#states = new List();
    this.#transitions = new List();
    this.#properties = new Dictionary();
  }
  //==============================================================================
  // 갱신.
  //==============================================================================
  /**
   * @param { number } timeDelta 
   */
  tick(timeDelta) {
    this.#animation.tick(timeDelta);
  }
  //==============================================================================
  // 프로퍼티 설정.
  //==============================================================================
  /**
   * @param { string } name
   * @param { System.Object } value
   */
  setProperty(name, value) {
    this.#properties.add(name, value);
  }
  //==============================================================================
  // 프로퍼티 반환.
  //==============================================================================
  /**
   * @returns { System.Object }
   */
  getProperty(name) {
    const value = this.#properties.get(name);
    return value;
  }
  //==============================================================================
  // 모든 프로퍼티 반환.
  //==============================================================================
  /**
   * @returns { Dictionary<string, System.Object> }
   */
  getProperties() {
    return this.#properties;
  }
};

// src/experimental/visual/visual.js
var Visual = class extends Component {
  static {
    __name(this, "Visual");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Vector2 } */
  #location;
  //==============================================================================
  // 생성.
  //==============================================================================
  /**
   * @constructor
   */
  constructor() {
    super();
    this.#location = Vector2.zero();
  }
  setLocation(location) {
    this.#location = location;
  }
  getLocation(location) {
    return this.#location;
  }
};

// src/experimental/visual/visualasset.js
var VisualAsset = class extends Asset {
  static {
    __name(this, "VisualAsset");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Visual } */
  #visual;
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.setAssetType(AssetType.visual);
    this.#visual = null;
  }
  //==============================================================================
  // 비동기 애셋 로드.
  //==============================================================================
  /**
   * @override
   * @param { string } assetPath 
   */
  async load(assetPath) {
    const isLoaded = this.isLoaded();
    if (isLoaded) {
      return Promise.resolve();
    }
    await super.load(assetPath);
    await new Promise((resolve, reject) => {
      resolve();
    });
  }
};

// src/experimental/camera.js
var Camera = class extends Object2 {
  static {
    __name(this, "Camera");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Vector2 } */
  #position;
  // 카메라가 바라보는 중심 위치.
  /** @private @type { number } */
  #zoom;
  // 확대/축소 비율.
  /** @private @type { number } */
  #rotation;
  // 회전 각도.
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.#position = Vector2.zero();
    this.#zoom = 1;
    this.#rotation = 0;
  }
  //==============================================================================
  // 시작.
  //==============================================================================
  /**
   * @param { CanvasRenderingContext2D } canvasRenderingContext 
   */
  begin(canvasRenderingContext) {
    if (canvasRenderingContext) {
      const position = this.getPosition();
      const zoom = this.getZoom();
      const rotation = this.getRotation();
      const radian = degreeToRadian(rotation);
      canvasRenderingContext.save();
      canvasRenderingContext.scale(zoom, zoom);
      canvasRenderingContext.rotate(radian);
      canvasRenderingContext.translate(-position.x, -position.y);
    }
  }
  //==============================================================================
  // 종료.
  //==============================================================================
  /**
   * @param { CanvasRenderingContext2D } canvasRenderingContext 
   */
  end(canvasRenderingContext) {
    if (canvasRenderingContext) {
      canvasRenderingContext.restore();
    }
  }
  //==============================================================================
  // 이동 설정.
  //==============================================================================
  /**
   * @param { Vector2 } position
   */
  setPosition(position) {
    this.#position = position;
  }
  //==============================================================================
  // 이동 반환.
  //==============================================================================
  /**
   * @returns { Vector2 }
   */
  getPosition() {
    return this.#position;
  }
  //==============================================================================
  // 줌 설정.
  //==============================================================================
  /**
   * @param { number } zoom 
   */
  setZoom(zoom) {
    this.#zoom = clamp(1e-3, zoom);
  }
  //==============================================================================
  // 줌 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getZoom() {
    return this.#zoom;
  }
  //==============================================================================
  // 회전 설정.
  //==============================================================================
  /**
   * @param { number } rotation 
   */
  setRotation(rotation) {
    this.#rotation = rotation;
  }
  //==============================================================================
  // 회전 반환.
  //==============================================================================
  /**
   * @returns { number }
   */
  getRotation() {
    return this.#rotation;
  }
};

// src/experimental/action.js
var Action = class extends Object2 {
  static {
    __name(this, "Action");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  /** @private @type { Array } */
  #steps;
  /** @private @type { number } */
  #currentStepIndex;
  /** @private @type { number } */
  #currentStepElapsed;
  /** @private @type { System.Object } */
  #currentStepState;
  /** @private @type { System.Object } */
  #target;
  /** @private @type { boolean } */
  #isRunning;
  /** @private @type { boolean } */
  #isDone;
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.#steps = [];
    this.#currentStepIndex = 0;
    this.#currentStepElapsed = 0;
    this.#currentStepState = null;
    this.#target = null;
    this.#isRunning = false;
    this.#isDone = false;
  }
  //==============================================================================
  // 현재 스텝 시작 처리.
  //==============================================================================
  /** @private */
  #startCurrentStep() {
    if (this.#currentStepIndex >= this.#steps.length) {
      this.#isRunning = false;
      this.#isDone = true;
      return;
    }
    const step = this.#steps[this.#currentStepIndex];
    this.#currentStepElapsed = 0;
    this.#currentStepState = {};
    const target = this.getTarget();
    if (step.type === "call") {
      step.fn(target);
      this.#advanceStep();
      return;
    }
    if (step.callbacks && step.callbacks.started) {
      step.callbacks.started(target);
    }
    if (step.type === "repeat") {
      this.#currentStepState.completedCount = 0;
      step.innerAction.start(target);
    } else if (step.type === "forever") {
      step.innerAction.start(target);
    } else if (step.type === "loop") {
      if (!step.conditionFn()) {
        this.#advanceStep();
        return;
      }
      step.innerAction.start(target);
    }
  }
  //==============================================================================
  // 다음 스텝으로 이동.
  //==============================================================================
  /** @private */
  #advanceStep() {
    this.#currentStepIndex++;
    this.#startCurrentStep();
  }
  //==============================================================================
  // 일정 시간 대기.
  // - callbacks.started(target)              : 스텝 시작 시 호출.
  // - callbacks.updated(progress, target)    : 매 프레임 호출. progress = 0~1.
  // - callbacks.completed(target)            : 스텝 완료 시 호출.
  //==============================================================================
  /**
   * @param { number } duration
   * @param { { started?: Function, updated?: Function, completed?: Function } } callbacks
   * @returns { Action }
   */
  wait(duration, callbacks = {}) {
    this.#steps.push({ type: "wait", duration, callbacks });
    return this;
  }
  //==============================================================================
  // 조건이 참이 될 때까지 대기.
  // - callbacks.started(target)              : 스텝 시작 시 호출.
  // - callbacks.updated(target)              : 조건 충족 전 매 프레임 호출.
  // - callbacks.completed(target)            : 조건 충족 시 호출.
  //==============================================================================
  /**
   * @param { Function } conditionFn
   * @param { { started?: Function, updated?: Function, completed?: Function } } callbacks
   * @returns { Action }
   */
  condition(conditionFn, callbacks = {}) {
    this.#steps.push({ type: "condition", conditionFn, callbacks });
    return this;
  }
  //==============================================================================
  // 즉시 콜백 호출.
  //==============================================================================
  /**
   * @param { Function } fn
   * @returns { Action }
   */
  call(fn) {
    this.#steps.push({ type: "call", fn });
    return this;
  }
  //==============================================================================
  // 내부 액션을 N회 반복.
  //==============================================================================
  /**
   * @param { number } times
   * @param { Action } innerAction
   * @returns { Action }
   */
  repeat(times, innerAction) {
    this.#steps.push({ type: "repeat", times, innerAction });
    return this;
  }
  //==============================================================================
  // 내부 액션을 무한 반복.
  //==============================================================================
  /**
   * @param { Action } innerAction
   * @returns { Action }
   */
  forever(innerAction) {
    this.#steps.push({ type: "forever", innerAction });
    return this;
  }
  //==============================================================================
  // 조건이 참인 동안 내부 액션을 반복.
  //==============================================================================
  /**
   * @param { Function } conditionFn
   * @param { Action } innerAction
   * @returns { Action }
   */
  loop(conditionFn, innerAction) {
    this.#steps.push({ type: "loop", conditionFn, innerAction });
    return this;
  }
  //==============================================================================
  // 실행 시작.
  //==============================================================================
  /**
   * @param { System.Object } target
   * @returns { Action }
   */
  start(target) {
    const currentTarget = this.getTarget();
    this.#target = target !== void 0 ? target : currentTarget;
    this.#currentStepIndex = 0;
    this.#currentStepElapsed = 0;
    this.#currentStepState = null;
    this.#isRunning = true;
    this.#isDone = false;
    this.#startCurrentStep();
    return this;
  }
  //==============================================================================
  // 실행 중단.
  //==============================================================================
  stop() {
    this.#isRunning = false;
    this.#isDone = true;
  }
  //==============================================================================
  // 갱신. (매 프레임 호출)
  //==============================================================================
  /**
   * @param { number } timeDelta
   */
  step(timeDelta) {
    if (!this.isRunning() || this.isDone()) {
      return;
    }
    if (this.#currentStepIndex >= this.#steps.length) {
      this.#isRunning = false;
      this.#isDone = true;
      return;
    }
    const step = this.#steps[this.#currentStepIndex];
    const target = this.getTarget();
    switch (step.type) {
      case "wait": {
        this.#currentStepElapsed += timeDelta;
        const progress = clamp(this.#currentStepElapsed / step.duration, 0, 1);
        if (step.callbacks && step.callbacks.updated) {
          step.callbacks.updated(progress, target);
        }
        if (this.#currentStepElapsed >= step.duration) {
          if (step.callbacks && step.callbacks.completed) {
            step.callbacks.completed(target);
          }
          this.#advanceStep();
        }
        break;
      }
      case "condition": {
        if (step.callbacks && step.callbacks.updated) {
          step.callbacks.updated(target);
        }
        if (step.conditionFn()) {
          if (step.callbacks && step.callbacks.completed) {
            step.callbacks.completed(target);
          }
          this.#advanceStep();
        }
        break;
      }
      case "repeat": {
        const repeatAction = step.innerAction;
        repeatAction.step(timeDelta);
        if (repeatAction.isDone()) {
          this.#currentStepState.completedCount++;
          if (this.#currentStepState.completedCount >= step.times) {
            this.#advanceStep();
          } else {
            repeatAction.start(target);
          }
        }
        break;
      }
      case "forever": {
        const foreverAction = step.innerAction;
        foreverAction.step(timeDelta);
        if (foreverAction.isDone()) {
          foreverAction.start(target);
        }
        break;
      }
      case "loop": {
        const loopAction = step.innerAction;
        loopAction.step(timeDelta);
        if (loopAction.isDone()) {
          if (step.conditionFn()) {
            loopAction.start(target);
          } else {
            this.#advanceStep();
          }
        }
        break;
      }
      default: {
        break;
      }
    }
  }
  //==============================================================================
  // 완료 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isDone() {
    return this.#isDone;
  }
  //==============================================================================
  // 실행 중 여부 반환.
  //==============================================================================
  /**
   * @returns { boolean }
   */
  isRunning() {
    return this.#isRunning;
  }
  //==============================================================================
  // 타겟 반환.
  //==============================================================================
  /**
   * @returns { System.Object }
   */
  getTarget() {
    return this.#target;
  }
};

// src/experimental/bunchasset.js
var BunchAsset = class extends BlobAsset {
  static {
    __name(this, "BunchAsset");
  }
  //==============================================================================
  // 멤버 변수 목록.
  //==============================================================================
  // /** @private @type { Blob } */ #blob;
  //==============================================================================
  // 생성.
  //==============================================================================
  constructor() {
    super();
    this.setAssetType(AssetType.bunch);
  }
  //==============================================================================
  // 비동기 애셋 로드.
  //==============================================================================
  /**
   * @override
   * @param { string } assetPath 
   */
  async load(assetPath) {
    await super.load(assetPath);
  }
};

// import.js
var System37 = globalThis;
export {
  Action,
  Animation,
  AnimationClip,
  AnimationState,
  AnimationTransition,
  Animator,
  Asset,
  AudioAsset,
  BlobAsset,
  BrowserType,
  BunchAsset,
  Camera,
  Color,
  Colors,
  Component,
  ComponentNode,
  Dictionary,
  Engine,
  EngineConfiguration,
  Enum,
  FontAsset,
  Frame,
  Graphic,
  Identifier,
  ImageAsset2 as ImageAsset,
  ImageScroller,
  InputManager,
  JsonAsset,
  LayoutConstraint,
  LayoutConstraintAxis,
  LayoutExpression,
  LayoutPriority,
  LayoutRelation,
  LayoutSolver,
  LayoutStrength,
  LayoutTerm,
  LayoutVariable,
  List,
  Mask,
  math_exports as Math,
  Node,
  NodeLayout,
  OBB,
  Object2 as Object,
  Paint,
  Pivot,
  Platform,
  PlatformType,
  Queue,
  Rect,
  reflection_exports as Reflection,
  RichText,
  Scene,
  SceneManager,
  ScrollBarAxis,
  Set2 as Set,
  Singleton,
  Sprite,
  Stack,
  System37 as System,
  Text,
  TextAlign,
  TextAsset,
  TextBaseline,
  TimeManager,
  TouchEffect,
  TouchParticle,
  TouchRaycaster,
  TouchRecognizer,
  TransformNode,
  Tween,
  UIButton,
  UIControl,
  UIImageView,
  UIInputField,
  UILabel,
  UINode,
  UIScene,
  UIScrollBar,
  UIScrollView,
  UISlider,
  UISnapScrollView,
  UIToggleButton,
  UIView,
  Vector2,
  Version,
  ViewManager,
  ViewScaleMode,
  VirtualPad,
  Visual,
  VisualAsset,
  wait_exports as Wait,
  WorldNode
};
