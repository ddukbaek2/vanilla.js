var Vanilla = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // libs/vanilla.js/index.js
  var index_exports = {};
  __export(index_exports, {
    UIButton: () => UIButton,
    UILabel: () => UILabel,
    UINode: () => UINode,
    UIPanel: () => UIPanel,
    VAnimatedSprite: () => VAnimatedSprite,
    VAsset: () => VAsset,
    VAudioAsset: () => VAudioAsset,
    VColors: () => VColors,
    VEngine: () => VEngine,
    VFontAsset: () => VFontAsset,
    VGameInstance: () => VGameInstance,
    VGlobalIdentifier: () => VGlobalIdentifier,
    VImageAsset: () => VImageAsset,
    VInput: () => VInput,
    VJsonAsset: () => VJsonAsset,
    VListener: () => VListener,
    VMath: () => math_exports,
    VNode: () => VNode,
    VObject: () => VObject,
    VPlatform: () => VPlatform,
    VRect: () => VRect,
    VReflection: () => reflection_exports,
    VRenderer: () => VRenderer,
    VScene: () => VScene,
    VSprite: () => VSprite,
    VTextAsset: () => VTextAsset,
    VTime: () => VTime,
    VTouchEffect: () => VTouchEffect,
    VVector2: () => VVector2,
    VView: () => VView,
    VWait: () => wait_exports
  });

  // libs/vanilla.js/src/base/reflection.js
  var reflection_exports = {};
  __export(reflection_exports, {
    clone: () => clone,
    structuredClone: () => structuredClone
  });
  function clone(target) {
    const obj = Object.create(Object.getPrototypeOf(target));
    Object.assign(obj, target);
    return obj;
  }
  __name(clone, "clone");
  function structuredClone(target) {
    if (target === null || typeof target !== "object")
      throw new Error();
    const obj = Object.create(Object.getPrototypeOf(target));
    const deepCopy = /* @__PURE__ */ __name((destination, source) => {
      for (const name in source) {
        if (!Object.prototype.hasOwnProperty.call(source, name))
          continue;
        const value = source[name];
        if (Array.isArray(value)) {
          target[name] = [];
          deepCopy(target[name], value);
        } else if (value !== null && typeof value === "object" && value.constructor === Object) {
          destination[name] = {};
          deepCopy(destination[name], value);
        } else {
          destination[name] = value;
        }
      }
    }, "deepCopy");
    deepCopy(obj, target);
    return obj;
  }
  __name(structuredClone, "structuredClone");

  // libs/vanilla.js/src/base/object.js
  var VObject = class {
    static {
      __name(this, "VObject");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    //==============================================================================
    // 생성.
    //==============================================================================
    constructor() {
    }
    //==============================================================================
    // 인스턴스 얕은 복제.
    //==============================================================================
    /**
     * @method
     * @public
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
     * @method
     * @public
     * @returns { this }
     */
    structuredClone() {
      const obj = structuredClone(this);
      return obj;
    }
  };

  // libs/vanilla.js/src/base/vector2.js
  var VVector2 = class _VVector2 extends VObject {
    static {
      __name(this, "VVector2");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @public @type { number } */
    x;
    /** @public @type { number } */
    y;
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
    // 길이.
    //==============================================================================
    /**
     * @returns { number }
     */
    length() {
      const length = Math.sqrt(this.x * this.x + this.y * this.y);
      return length;
    }
    //==============================================================================
    // 정규화.
    //==============================================================================
    /**
     * @returns { VVector2 }
     */
    normalize() {
      const origin = _VVector2.create(this.x, this.y);
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
     * @param { VVector2 | number } other
     * @returns { VVector2 }
     */
    add(other) {
      const obj = this.clone();
      if (typeof other === "number") {
        obj.x += other;
        obj.y += other;
        return obj;
      } else if (other instanceof _VVector2) {
        obj.x += other.x;
        obj.y += other.y;
        return obj;
      }
      throw new Error("Invalid type: 'other' must be a number or an instance of VVector2.");
    }
    //==============================================================================
    // 빼기.
    //==============================================================================
    /**
     * @param { VVector2 | number } other
     * @returns { VVector2 }
     */
    subtract(other) {
      const obj = this.clone();
      if (typeof other === "number") {
        obj.x -= other;
        obj.y -= other;
        return obj;
      } else if (other instanceof _VVector2) {
        obj.x -= other.x;
        obj.y -= other.y;
        return obj;
      }
      throw new Error("Invalid type: 'other' must be a number or an instance of VVector2.");
    }
    //==============================================================================
    // 곱하기.
    //==============================================================================
    /**
     * @param { VVector2 | number } other
     * @returns { VVector2 }
     */
    multiply(other) {
      const obj = this.clone();
      if (typeof other === "number") {
        obj.x *= other;
        obj.y *= other;
        return obj;
      } else if (other instanceof _VVector2) {
        obj.x *= other.x;
        obj.y *= other.y;
        return obj;
      }
      throw new Error("Invalid type: 'other' must be a number or an instance of VVector2.");
    }
    //==============================================================================
    // 나누기.
    //==============================================================================
    /**
     * @param { VVector2 | number } other
     * @returns { VVector2 }
     */
    divide(other) {
      const obj = this.clone();
      if (typeof other === "number") {
        obj.x /= other;
        obj.y /= other;
        return obj;
      } else if (other instanceof _VVector2) {
        obj.x /= other.x;
        obj.y /= other.y;
        return obj;
      }
      throw new Error("Invalid type: 'other' must be a number or an instance of VVector2.");
    }
    //==============================================================================
    // 나머지.
    //==============================================================================
    /**
     * @param { VVector2 | number } other
     * @returns { VVector2 }
     */
    modulo(other) {
      const obj = this.clone();
      if (typeof other === "number") {
        obj.x /= other;
        obj.y /= other;
        return obj;
      } else if (other instanceof _VVector2) {
        obj.x /= other.x;
        obj.y /= other.y;
        return obj;
      }
      throw new Error("Invalid type: 'other' must be a number or an instance of VVector2.");
    }
    // //==============================================================================
    // // 내적.
    // //==============================================================================
    // dot() {
    // }
    // //==============================================================================
    // // 외적.
    // //==============================================================================
    // cross() {
    // }
    //==============================================================================
    // 새로운 벡터 생성.
    //==============================================================================
    /**
     * @param { number } x
     * @param { number } y
     * @returns { VVector2 }
     */
    static create(x, y) {
      var obj = new _VVector2();
      obj.x = x;
      obj.y = y;
      return obj;
    }
    //==============================================================================
    // 0의 값을 가진 벡터 생성.
    //==============================================================================
    /**
     * @returns { VVector2 }
     */
    static zero() {
      return _VVector2.create(0, 0);
    }
    //==============================================================================
    // 1의 값을 가진 벡터 생성.
    //==============================================================================
    /**
     * @returns { VVector2 }
     */
    static one() {
      return _VVector2.create(1, 1);
    }
  };

  // libs/vanilla.js/src/base/rect.js
  var VRect = class _VRect extends VObject {
    static {
      __name(this, "VRect");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @public @type { VVector2 } */
    position;
    // left-top.
    /** @public @type { VVector2 } */
    size;
    //==============================================================================
    // 생성.
    //==============================================================================
    /**
     * @constructor
     * @param { VVector2 } position
     * @param { VVector2 } size
     */
    constructor() {
      super();
      this.position = VVector2.zero();
      this.size = VVector2.zero();
    }
    //==============================================================================
    // 겹치는지 여부.
    //==============================================================================
    /**
     * @constructor
     * @param { VVector2 | VRect } other
     * @returns { boolean }
     */
    overlaps(other) {
      if (typeof other === VVector2) {
        return false;
      } else if (other instanceof _VRect) {
        return false;
      }
      throw new Error("Invalid type: 'other' must be an instance of VVector2 or VRect.");
    }
    //==============================================================================
    // 중앙 위치 설정.
    //==============================================================================
    /**
     * @param { VVector2 } other
     */
    set center(value) {
      this.position.x = value.x - this.width / 2;
      this.position.y = value.y - this.height / 2;
    }
    //==============================================================================
    // 가운데 반환.
    //==============================================================================
    /**
     * @returns { VVector2 }
     */
    get center() {
      const origin = this.position.clone();
      origin.x += this.width / 2;
      origin.y += this.height / 2;
      return origin;
    }
    //==============================================================================
    // 왼쪽 설정.
    //==============================================================================
    set left(value) {
      this.position.x = value;
    }
    //==============================================================================
    // 왼쪽 반환.
    //==============================================================================
    get left() {
      return this.position.x;
    }
    //==============================================================================
    // 위쪽 설정.
    //==============================================================================
    set top(value) {
      this.position.y = value;
    }
    //==============================================================================
    // 위쪽 반환.
    //==============================================================================
    get top() {
      return this.position.y;
    }
    //==============================================================================
    // 오른쪽 설정.
    //==============================================================================
    set right(value) {
      this.position.x = value - this.width;
    }
    //==============================================================================
    // 오른쪽 반환.
    //==============================================================================
    get right() {
      return this.position.x + this.width;
    }
    //==============================================================================
    // 아래쪽 설정.
    //==============================================================================
    set bottom(value) {
      this.position.y = value - this.height;
    }
    //==============================================================================
    // 아래쪽 반환.
    //==============================================================================
    get bottom() {
      return this.position.y + this.height;
    }
    //==============================================================================
    // 새로운 사각 영역 생성.
    //==============================================================================
    /**
     * @param { VVector2 } position
     * @param { VVector2 } size
     * @returns { VRect }
     */
    static create(position, size) {
      var obj = new _VRect();
      obj.position = position;
      obj.size = size;
      return obj;
    }
    //==============================================================================
    // 크기가 없는 빈 사각 영역 생성.
    //==============================================================================
    /**
     * @returns { VRect }
     */
    static zero() {
      return _VRect.create(VVector2.zero(), VVector2.zero());
    }
  };

  // libs/vanilla.js/src/base/colors.js
  var VColors = {
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

  // libs/vanilla.js/src/base/wait.js
  var wait_exports = {};
  __export(wait_exports, {
    seconds: () => seconds
  });
  async function seconds(seconds2) {
    const promise = new Promise((resolve) => setTimeout(resolve, seconds2 * 1e3));
    await promise;
  }
  __name(seconds, "seconds");

  // libs/vanilla.js/src/base/math.js
  var math_exports = {};
  __export(math_exports, {
    clamp: () => clamp,
    lerp: () => lerp,
    max: () => max,
    min: () => min
  });
  function min(left, right) {
    return left < right ? left : right;
  }
  __name(min, "min");
  function max(left, right) {
    return left > right ? left : right;
  }
  __name(max, "max");
  function clamp(value, min2, max2) {
    return max2(min2, min2(max2, value));
  }
  __name(clamp, "clamp");
  function lerp(a, b, t) {
    return a * (1 - t) + b * t;
  }
  __name(lerp, "lerp");

  // libs/vanilla.js/src/base/platform.js
  var PlatformType = {
    //Object.freeze({
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
    //Object.freeze({
    chrome: "Chrome",
    edge: "Edge",
    firefox: "Firefox",
    internetExplorer: "Internet Explorer",
    safari: "Safari",
    unknown: "Unknown"
  };
  var VPlatform = class extends VObject {
    static {
      __name(this, "VPlatform");
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
    }
    //==============================================================================
    // 플랫폼 정보 탐지 및 적용.
    //==============================================================================
    /**
     * @returns { { platformName: string, browserName: string } }
    */
    getPlatformInfo() {
      const userAgent = navigator.userAgent;
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
  };

  // libs/vanilla.js/src/base/listener.js
  var VListener = class extends VObject {
    static {
      __name(this, "VListener");
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
    constructor(engine) {
      super();
    }
    //==============================================================================
    // 갱신.
    //==============================================================================
    /**
     * @method
     */
    update() {
    }
  };

  // libs/vanilla.js/src/core/time.js
  var VTime = class extends VObject {
    static {
      __name(this, "VTime");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @type { number } */
    timestamp;
    /** @type { number } */
    timeDelta;
    /** @type { number } */
    time;
    /** @type { number } */
    fps;
    /** @type { number } */
    framesThisSecond;
    /** @type { number } */
    previousCheckTime;
    //==============================================================================
    // 생성.
    //==============================================================================
    /**
     * @constructor
     * @param { VEngine } engine 
     */
    constructor(engine) {
      super();
      this.timestamp = 0;
      this.TimeDelta = 0;
      this.ElapsedTime = 0;
      this.FPS = 0;
      this.FramesThisSecond = 0;
      this.LastFPSTime = 0;
    }
    //==============================================================================
    // 갱신.
    //==============================================================================
    /**
     * @public
     * @method
     * @param { number } timestamp
     */
    update(timestamp) {
      timestamp = timestamp / 1e3;
      if (this.timestamp === 0) {
        this.timestamp = timestamp;
        this.previousCheckTime = timestamp;
      }
      let timeDelta = timestamp - this.timestamp;
      this.timestamp = timestamp;
      this.time += timeDelta;
      this.timeDelta = timeDelta;
      if (timestamp >= this.previousCheckTime + 1) {
        this.fps = this.framesThisSecond;
        this.framesThisSecond = 0;
        this.previousCheckTime = timestamp;
      }
      ++this.framesThisSecond;
    }
  };

  // libs/vanilla.js/src/core/view.js
  var VView = class extends VObject {
    static {
      __name(this, "VView");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @public @type { number } */
    devicePixelRatio;
    /** @public @type { number } */
    scale;
    /** @public @type { VVector2 } */
    resolution;
    // 원하는 영역.
    /** @public @type { VVector2 } */
    screen;
    // 전체 화면 영역.
    /** @public @type { VRect } */
    view;
    // 보여지는 실제 영역.
    //==============================================================================
    // 생성.
    //==============================================================================
    /**
     * @constructor
     * @param { VEngine } engine 
     */
    constructor(engine) {
      super();
      this.devicePixelRatio = 1;
      this.scale = 1;
      this.resolution = VVector2.zero();
      this.screen = VVector2.zero();
      this.view = VRect.zero();
    }
    //==============================================================================
    // 갱신.
    //==============================================================================
    update() {
    }
    //==============================================================================
    // 대상 좌표가 클라이언트 영역 안에 존재하는지 여부.
    //==============================================================================
    /**
     * @public
     * @method
     * @param { number } touchX
     * @param { number } touchY 
     */
    isInsideView(touchX, touchY) {
      return touchX >= this.view.position.x && touchX <= this.view.position.x + this.view.size.x && touchY >= this.view.position.y && touchY <= this.view.position.y + this.view.size.y;
    }
  };

  // libs/vanilla.js/src/core/input.js
  var VInput = class extends VObject {
    static {
      __name(this, "VInput");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @type { VVector2 } */
    position;
    /** @type { boolean } */
    isDown;
    /** @type { boolean } */
    justPressed;
    /** @type { boolean } */
    justReleased;
    //==============================================================================
    // 생성.
    //==============================================================================
    /**
     * @constructor
     * @param { VEngine } engine 
     */
    constructor(engine) {
      super();
      this.position = VVector2.zero();
      this.isDown = false;
      this.justPressed = false;
      this.justReleased = false;
    }
    //==============================================================================
    // 갱신.
    //==============================================================================
    update() {
    }
  };

  // libs/vanilla.js/src/core/renderer.js
  var VRenderer = class extends VObject {
    static {
      __name(this, "VRenderer");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @private @type { VEngine } */
    #engine;
    /** @private @type { CanvasRenderingContext2D } */
    #canvasContext;
    //==============================================================================
    // 생성.
    //==============================================================================
    /**
     * @param { VEngine } engine
     * @param { CanvasRenderingContext2D } canvasContext
     */
    constructor(engine, canvasContext) {
      super();
      this.#engine = engine;
      this.#canvasContext = canvasContext;
    }
    //==============================================================================
    // 노드 출력.
    //==============================================================================
    /**
     * @type { VNode } node
     */
    drawNode(node) {
      if (node === null) {
        return;
      }
      node.beginDrawState(this);
      node.preDraw(this);
      node.draw(this);
      node.postDraw(this);
      node.endDrawState(this);
    }
    //==============================================================================
    // 사각형 출력.
    //==============================================================================
    /**
     * @param { VRect } rect 
     * @param { string } color 
     * @param { number } opacity 
     */
    drawRect(rect, color = "#ffffff", opacity = 1) {
      const engine = this.#engine;
      const canvasContext = this.#canvasContext;
      canvasContext.globalAlpha = opacity;
      canvasContext.fillStyle = color;
      canvasContext.fillRect(rect.position.x, rect.position.y, rect.size.x, rect.size.y);
      canvasContext.globalAlpha = 1;
    }
    //==============================================================================
    // 이미지 출력.
    //==============================================================================
    /**
     * @param { VVector2 } position
     * @param { VVector2 } size
     * @param { number } rotation,
     * @param { HTMLImageElement } image,
     * @param { string } color 
     * @param { number } opacity 
     */
    drawImage(image, position = VVector2.zero(), size = VVector2.zero(), rotation = 0, color = "#ffffff", opacity = 1) {
      if (image === null) {
        throw new Error("image is null");
      }
      const engine = this.#engine;
      const canvasContext = this.#canvasContext;
      canvasContext.globalAlpha = opacity;
      canvasContext.fillStyle = color;
      canvasContext.rotate(rotation);
      if (size === VVector2.zero()) {
        canvasContext.drawImage(image, position.x, position.y, image.width, image.height);
      } else {
        canvasContext.drawImage(image, position.x, position.y, size.x, size.y);
      }
    }
    //==============================================================================
    // 이미지 나인패치 출력.
    //==============================================================================
    /**
     * @static
     * @param { HTMLImageElement } image
     * @param { VVector2 } position
     * @param { VVector2 } size
     * @param { VRect } patch
     */
    drawImageNinePatch(image, position, size, patch) {
      const canvasContext = this.getCanvasContext();
      const sw = image.width;
      const sh = image.height;
      const dx = position.x;
      const dy = position.y;
      const dw = size.x;
      const dh = size.y;
      const left = patch.position.x;
      const top = patch.position.y;
      const right = patch.size.x;
      const bottom = patch.size.y;
      const centerSrcW = sw - left - right;
      const centerSrcH = sh - top - bottom;
      const centerDstW = dw - left - right;
      const centerDstH = dh - top - bottom;
      canvasContext.drawImage(image, 0, 0, left, top, dx, dy, left, top);
      canvasContext.drawImage(image, left, 0, centerSrcW, top, dx + left, dy, centerDstW, top);
      canvasContext.drawImage(image, sw - right, 0, right, top, dx + dw - right, dy, right, top);
      canvasContext.drawImage(image, 0, top, left, centerSrcH, dx, dy + top, left, centerDstH);
      canvasContext.drawImage(image, left, top, centerSrcW, centerSrcH, dx + left, dy + top, centerDstW, centerDstH);
      canvasContext.drawImage(image, sw - right, top, right, centerSrcH, dx + dw - right, dy + top, right, centerDstH);
      canvasContext.drawImage(image, 0, sh - bottom, left, bottom, dx, dy + dh - bottom, left, bottom);
      canvasContext.drawImage(image, left, sh - bottom, centerSrcW, bottom, dx + left, dy + dh - bottom, centerDstW, bottom);
      canvasContext.drawImage(image, sw - right, sh - bottom, right, bottom, dx + dw - right, dy + dh - bottom, right, bottom);
    }
    //==============================================================================
    // 출력 영역 제한 시작.
    //==============================================================================
    /**
     * @type { VRect } rect
     */
    beginClip(rect) {
      const engine = this.#engine;
      const canvasContext = this.#canvasContext;
      canvasContext.save();
      canvasContext.beginPath();
      canvasContext.rect(rect.position.x, rect.position.y, rect.size.x, rect.size.y);
      canvasContext.clip();
    }
    //==============================================================================
    // 출력 영역 제한 종료.
    //==============================================================================
    endClip() {
      this.#canvasContext.restore();
    }
    //==============================================================================
    // 엔진 반환.
    //==============================================================================
    /**
     * @returns { VEngine }
     */
    getEngine() {
      return this.#engine;
    }
    //==============================================================================
    // 캔버스 렌더링 컨텍스트 반환.
    //==============================================================================
    /**
     * @returns { CanvasRenderingContext2D }
     */
    getCanvasContext() {
      return this.#canvasContext;
    }
  };

  // libs/vanilla.js/src/core/gameinstance.js
  var VGameInstance = class extends VObject {
    static {
      __name(this, "VGameInstance");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @type { VEngine } */
    #engine = null;
    //==============================================================================
    // 생성.
    //==============================================================================
    constructor(args) {
      super();
    }
    //==============================================================================
    // 초기화됨.
    //==============================================================================
    /**
     * @param { VEngine } engine 
     */
    initialize(engine) {
      this.#engine = engine;
    }
    //==============================================================================
    // 갱신됨.
    //==============================================================================
    /**
     * @param { number } timeDelta 
     */
    update(timeDelta) {
    }
    //==============================================================================
    // 갱신됨.
    //==============================================================================
    /**
     * @param { number } timeDelta 
     */
    lateUpdate(timeDelta) {
    }
    //==============================================================================
    // 이전 출력됨.
    //==============================================================================
    /**
     * @method
     * @param { VRenderer } renderer 
     */
    preDraw(renderer) {
      this.#engine.viewIdentity();
      this.#engine.gameViewIdentity();
    }
    //==============================================================================
    // 출력됨.
    //==============================================================================
    /**
     * @method
     * @param { VRenderer } renderer 
     */
    draw(renderer) {
    }
    //==============================================================================
    // 이후 출력됨.
    //==============================================================================
    /**
     * @method
     * @param { VRenderer } renderer 
     */
    postDraw(renderer) {
    }
    //==============================================================================
    // 사이즈 변경됨.
    //==============================================================================
    /**
     * @param { VEngine } engine 
     */
    resize(engine) {
    }
    //==============================================================================
    // 엔진 반환.
    //==============================================================================
    /**
     * @returns { VEngine }
     */
    getEngine() {
      return this.#engine;
    }
    //==============================================================================
    // 이미지 크기 맞추기.
    //==============================================================================
    /**
     * @param { VVector2 } targetSize 
     * @param { VVector2 } viewSize
     * @param { boolean } adjustWidth
     */
    static adjustSizeFit(targetSize, viewSize, adjustWidth = true) {
      let adjustSize = VVector2.create(viewSize.y, viewSize.y);
      if (adjustWidth) {
        if (targetSize.x <= viewSize.x)
          return targetSize;
        adjustSize.x = viewSize.x;
        adjustSize.y = targetSize.y * (viewSize.x / targetSize.x);
      } else {
        if (targetSize.y <= viewSize.y)
          return targetSize;
        adjustSize.y = viewSize.y;
        adjustSize.x = targetSize.x * (viewSize.y / targetSize.y);
      }
      return adjustSize;
    }
    //==============================================================================
    // 이미지 크기 맞추기.
    //==============================================================================
    /**
     * 
     * @param { VVector2 } targetSize 
     * @param { VVector2 } viewSize 
     */
    static adjustSizeFitByLong(targetSize, viewSize) {
      const adjustWidth = targetSize.x > targetSize.y;
      const adjustSize = Game.adjustSizeFit(targetSize, viewSize, adjustWidth);
      return adjustSize;
    }
  };

  // libs/vanilla.js/src/core/engine.js
  var VEngine = class extends VObject {
    static {
      __name(this, "VEngine");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @private @type { HTMLCanvasElement } */
    #canvas;
    /** @private @type { VPlatform } */
    #platform;
    /** @private @type { VTime } */
    #time;
    /** @private @type { VView } */
    #view;
    /** @private @type { VInput } */
    #input;
    /** @private @type { VRenderer } */
    #renderer;
    /** @private @type { () => void  } */
    #onResizeCallback;
    /** @private @type { FrameRequestCallback } */
    #onEngineUpdateCallback;
    /** @private @type { VGameInstance } */
    #gameInstance;
    /** @private @type { VScene } */
    #scene;
    /** @private @type { boolean } */
    #isDevelopment;
    //==============================================================================
    // 생성.
    //==============================================================================
    constructor(width, height, canvasId, isDevelopment = true) {
      super();
      this.#canvas = document.getElementById(canvasId);
      const canvasContext = this.#canvas.getContext("2d", { alpha: false });
      this.#platform = new VPlatform();
      this.#time = new VTime(this);
      this.#view = new VView(this);
      this.#view.resolution.x = width;
      this.#view.resolution.y = height;
      this.#input = new VInput(this);
      this.#renderer = new VRenderer(this, canvasContext);
      this.#onResizeCallback = this.#resize.bind(this);
      this.#onEngineUpdateCallback = this.#updateEngine.bind(this);
      this.#gameInstance = null;
      this.#scene = null;
      this.#isDevelopment = isDevelopment;
      if (this.terminalFont !== null) {
        this.terminalFont = new FontFace(`DOSGothic`, `url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_eight@1.0/DOSGothic.woff')`);
        this.terminalFont.load().then((loadedFont) => {
          document.fonts.add(loadedFont);
        });
      }
      this.#setupAllEvents();
      this.#resize();
    }
    //==============================================================================
    // 게임 인스턴스 설정.
    //==============================================================================
    /**
     * @method
     * @public
     * @param { VGameInstance } gameInstance
     */
    setGameInstance(gameInstance) {
      this.#gameInstance = gameInstance;
      if (this.#gameInstance && typeof this.#gameInstance.initialize === "function") {
        this.#gameInstance.initialize(this);
      }
    }
    //==============================================================================
    // 시작.
    //==============================================================================
    /**
     * @param { VGameInstance } gameInstance
     */
    run(gameInstance) {
      if (gameInstance != null)
        this.setGameInstance(gameInstance);
      window.addEventListener("resize", this.#onResizeCallback);
      window.requestAnimationFrame(this.#onEngineUpdateCallback);
    }
    //==============================================================================
    // 해상도 변경됨.
    //==============================================================================
    /**
     * @private
     * @method
     */
    #resize() {
      const devicePixelRatio = window.devicePixelRatio || 1;
      const clientWidth = window.innerWidth;
      const clientHeight = window.innerHeight;
      this.#canvas.width = Math.round(clientWidth * devicePixelRatio);
      this.#canvas.height = Math.round(clientHeight * devicePixelRatio);
      this.#canvas.style.width = `${clientWidth}px`;
      this.#canvas.style.height = `${clientHeight}px`;
      const scale = Math.min(clientWidth / this.#view.resolution.x, clientHeight / this.#view.resolution.y);
      const viewWidth = Math.round(this.#view.resolution.x * scale);
      const viewHeight = Math.round(this.#view.resolution.y * scale);
      const viewX = Math.floor((clientWidth - viewWidth) * 0.5);
      const viewY = Math.floor((clientHeight - viewHeight) * 0.5);
      this.#view.devicePixelRatio = devicePixelRatio;
      this.#view.scale = scale;
      this.#view.screen.x = clientWidth;
      this.#view.screen.y = clientHeight;
      this.#view.view.position.x = viewX;
      this.#view.view.position.y = viewY;
      this.#view.view.size.x = viewWidth;
      this.#view.view.size.y = viewHeight;
      if (this.#gameInstance && typeof this.#gameInstance.resize === "function") {
        this.#gameInstance.resize(this);
      }
    }
    //==============================================================================
    // 이벤트 설정.
    //==============================================================================
    /**
     * @private
     * @method
     */
    #setupAllEvents() {
      this.#canvas.addEventListener("mousedown", (touchEvent) => {
        this.#input.isDown = true;
        this.#input.justPressed = true;
        this.#updatePointer(touchEvent.clientX, touchEvent.clientY);
      });
      window.addEventListener("mousemove", (touchEvent) => {
        this.#updatePointer(touchEvent.clientX, touchEvent.clientY);
      });
      window.addEventListener("mouseup", (touchEvent) => {
        this.#input.isDown = false;
        this.#input.justReleased = true;
        this.#updatePointer(touchEvent.clientX, touchEvent.clientY);
      });
      this.#canvas.addEventListener("touchstart", (touchEvent) => {
        const touch = touchEvent.changedTouches[0];
        if (!touch) return;
        this.#input.isDown = true;
        this.#input.justPressed = true;
        this.#updatePointer(touch.clientX, touch.clientY);
        touchEvent.preventDefault();
      }, { passive: false });
      window.addEventListener("touchmove", (touchEvent) => {
        const touch = touchEvent.changedTouches[0];
        if (!touch) return;
        this.#updatePointer(touch.clientX, touch.clientY);
        touchEvent.preventDefault();
      }, { passive: false });
      window.addEventListener("touchend", (touchEvent) => {
        const touch = touchEvent.changedTouches[0];
        if (touch) {
          this.#updatePointer(touch.clientX, touch.clientY);
        }
        this.#input.isDown = false;
        this.#input.justReleased = true;
        touchEvent.preventDefault();
      }, { passive: false });
      document.addEventListener("pointerlockchange", () => {
        if (document.pointerLockElement === canvas) {
        } else {
        }
      });
    }
    //==============================================================================
    // 입력 좌표 갱신.
    //==============================================================================
    /**
     * @private
     * @method
     * @param { number } clientX
     * @param { number } clientY
     */
    #updatePointer(clientX, clientY) {
      this.#input.position.x = (clientX - this.#view.view.position.x) / this.#view.view.size.x * this.#view.resolution.x;
      this.#input.position.y = (clientY - this.#view.view.position.y) / this.#view.view.size.y * this.#view.resolution.y;
    }
    //==============================================================================
    // 개발모드 출력.
    //==============================================================================
    /**
     * @param { CanvasRenderingContext2D } canvasContext 
     */
    #drawDevelopment(canvasContext) {
      if (!this.#isDevelopment)
        return;
      const engine = this;
      const SYSTEM_FONT_STRING = '-apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      let textOffsetX = 16;
      let textOffsetY = 16;
      const drawOutlineText = /* @__PURE__ */ __name((text) => {
        canvasContext.fillText(text, textOffsetX, textOffsetY);
        textOffsetY += 16;
        const metrics = canvasContext.measureText(text);
        const width = metrics.width;
        const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
        return { width, height };
      }, "drawOutlineText");
      const formatSizeString = /* @__PURE__ */ __name((bytes) => {
        let killo = bytes / 1024;
        let mega = killo / 1024;
        let value = mega.toFixed(2);
        return `${value} MB`;
      }, "formatSizeString");
      canvasContext.setTransform(1, 0, 0, 1, 0, 0);
      canvasContext.font = `16px DOSGothic`;
      canvasContext.textBaseline = "top";
      canvasContext.fillStyle = VColors.white;
      canvasContext.textAlign = "left";
      canvasContext.imageSmoothingEnabled = false;
      canvasContext.scale(1.6, 1.6);
      drawOutlineText(`framePerSecond: ${engine.#time.fps}`);
      const memory = performance.memory;
      if (memory) {
        const usedJSHeapSize = formatSizeString(memory.usedJSHeapSize);
        const totalJSHeapSize = formatSizeString(memory.totalJSHeapSize);
        const jsHeapSizeLimit = formatSizeString(memory.jsHeapSizeLimit);
        drawOutlineText(`usedJSHeapSize: ${usedJSHeapSize}`);
        drawOutlineText(`totalJSHeapSize: ${totalJSHeapSize}`);
        drawOutlineText(`jsHeapSizeLimit: ${jsHeapSizeLimit}`);
      } else {
        drawOutlineText(`usedJSHeapSize: Not Supported`);
        drawOutlineText(`totalJSHeapSize: Not Supported`);
        drawOutlineText(`jsHeapSizeLimit: Not Supported`);
      }
      this.#platform.getPlatformInfo();
      drawOutlineText(`platformName: ${this.#platform.platformName}`);
      drawOutlineText(`browserName: ${this.#platform.browserName}`);
      var resourceUsage = this.#platform.getResouceUsage();
      const totalTransferSize = formatSizeString(resourceUsage.totalTransferSize);
      const totalDecodedSize = formatSizeString(resourceUsage.totalDecodedSize);
      const loadedFiles = resourceUsage.loadedFiles;
      drawOutlineText(`totalDecodedSize: ${totalDecodedSize}`);
    }
    //==============================================================================
    // 엔진 갱신.
    //==============================================================================
    /**
     * @private
     * @method
     * @param { number } timestamp
     */
    #updateEngine(timestamp) {
      this.#time.update(timestamp);
      if (this.#gameInstance) {
        try {
          if (typeof this.#gameInstance.update === "function") {
            this.#gameInstance.update(this.#time.timeDelta);
          }
          if (typeof this.#gameInstance.preDraw === "function") {
            this.#gameInstance.preDraw(this.#renderer);
          }
          if (typeof this.#gameInstance.draw === "function") {
            this.#gameInstance.draw(this.#renderer);
          }
          if (typeof this.#gameInstance.postDraw === "function") {
            this.#gameInstance.postDraw(this.#renderer);
          }
        } catch (e) {
          console.error(e);
        }
      }
      if (this.#isDevelopment) {
        const canvasContext = this.#renderer.getCanvasContext();
        this.#drawDevelopment(canvasContext);
      }
      this.#input.justPressed = false;
      this.#input.justReleased = false;
      window.requestAnimationFrame(this.#onEngineUpdateCallback);
    }
    //==============================================================================
    // 커서 보이기 설정.
    //==============================================================================
    /**
     * @public
     * @method
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
    // 화면 비우기.
    //==============================================================================
    /**
     * @public
     * @method
     * @param { string } color
     */
    viewIdentity(color = "#000000") {
      const renderer = this.getRenderer();
      const canvasContext = renderer.getCanvasContext();
      canvasContext.setTransform(1, 0, 0, 1, 0, 0);
      canvasContext.beginPath();
      canvasContext.fillStyle = color;
      canvasContext.fillRect(0, 0, this.#canvas.width, this.#canvas.height);
    }
    //==============================================================================
    // 게임 영역 좌표계 정리.
    //==============================================================================
    /**
     * @public
     * @method
     * @param { string } color
     */
    gameViewIdentity(color = "#000000") {
      const canvasContext = this.#renderer.getCanvasContext();
      const devicePixelRatio = this.#view.devicePixelRatio;
      const a = this.#view.scale * devicePixelRatio;
      const e = this.#view.view.position.x * devicePixelRatio;
      const f = this.#view.view.position.y * devicePixelRatio;
      canvasContext.setTransform(a, 0, 0, a, e, f);
      canvasContext.fillStyle = color;
      canvasContext.fillRect(0, 0, this.#view.resolution.x, this.#view.resolution.y);
      ;
    }
    //==============================================================================
    // 캔버스 정보 반환.
    //==============================================================================
    /**
     * @public
     * @method
     * @returns { HTMLCanvasElement }
     */
    getCanvas() {
      return this.#canvas;
    }
    //==============================================================================
    // 플랫폼 정보 반환.
    //==============================================================================
    /**
     * @public
     * @method
     * @returns { VPlatform }
     */
    getPlatform() {
      return this.#platform;
    }
    //==============================================================================
    // 시간 정보 반환.
    //==============================================================================
    /**
     * @public
     * @method
     * @returns { VTime }
     */
    getTime() {
      return this.#time;
    }
    //==============================================================================
    // 뷰 정보 반환.
    //==============================================================================
    /**
     * @public
     * @method
     * @returns { VView }
     */
    getView() {
      return this.#view;
    }
    //==============================================================================
    // 입력 정보 반환.
    //==============================================================================
    /**
     * @public
     * @method
     * @returns { VInput }
     */
    getInput() {
      return this.#input;
    }
    //==============================================================================
    // 렌더러 정보 반환.
    //==============================================================================
    /**
     * @public
     * @method
     * @returns { VRenderer }
     */
    getRenderer() {
      return this.#renderer;
    }
  };

  // libs/vanilla.js/src/core/asset.js
  var VAsset = class extends VObject {
    static {
      __name(this, "VAsset");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @public @readonly @type { string } */
    assetPath = "";
    /** @protected @type { boolean } */
    isLoaded = false;
    //==============================================================================
    // 생성.
    //==============================================================================
    constructor() {
      super();
      this.assetPath = "";
      this.isLoaded = false;
    }
    //==============================================================================
    // 비동기 애셋 로드.
    //==============================================================================
    /**
     * @virtual
     * @method
     * @param { string } assetPath 
     */
    async load(assetPath) {
      this.assetPath = assetPath;
      if (this.isLoaded) {
        return Promise.resolve();
      }
    }
    //==============================================================================
    // 애셋 언로드.
    //==============================================================================
    /**
     * @virtual
     * @method
     */
    unload() {
      if (!this.isLoaded) {
        return;
      }
      this.assetPath = "";
      this.isLoaded = false;
    }
  };

  // libs/vanilla.js/src/core/scene.js
  var VScene = class extends VObject {
    static {
      __name(this, "VScene");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @private @type { VNode[] } */
    #nodes;
    //==============================================================================
    // 생성.
    //==============================================================================
    constructor() {
      super();
      this.#nodes = [];
    }
    //==============================================================================
    // 갱신.
    //==============================================================================
    /**
     * @virtual
     * @param { VEngine } engine 
     */
    updateAllNodes(engine) {
      const time = engine.getTime();
      const timeDelta = time.timeDelta;
      for (let i = 0; i < this.#nodes.length; ++i) {
        const node = this.#nodes[i];
        node.update(timeDelta);
      }
    }
    //==============================================================================
    // 출력.
    //==============================================================================
    /**
     * @virtual
     * @param { VRenderer } renderer 
     */
    drawAllNodes(renderer) {
      for (let i = 0; i < this.#nodes.length; ++i) {
        const node = this.#nodes[i];
        renderer.drawNode(node);
      }
    }
  };

  // libs/vanilla.js/src/core/node.js
  var Pivot = {
    topLeft: VVector2.create(0, 0),
    topCenter: VVector2.create(0, 0.5),
    topRight: VVector2.create(0, 1),
    middleLeft: VVector2.create(0.5, 0),
    middle: VVector2.create(0.5, 0.5),
    middleRight: VVector2.create(0.5, 1),
    bottomLeft: VVector2.create(1, 0),
    bottomCenter: VVector2.create(1, 0.5),
    bottomRight: VVector2.create(1, 1)
  };
  var VNode = class _VNode extends VObject {
    static {
      __name(this, "VNode");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @private @type { VNode | null } */
    #parent;
    // 부모 노드.
    /** @private @type { VNode[] } */
    #children;
    // 자식 노드 목록.
    /** @private @type { VVector2 } */
    #position;
    // 위치.
    /** @private @type { VVector2 } */
    #size;
    // 크기.
    /** @private @type { VVector2 } */
    #scale;
    // 크기.
    /** @private @type { number } */
    #rotation;
    // 회전값.
    /** @private @type { boolean } */
    #isActive;
    // 활성화 여부.
    /** @private @type { boolean } */
    #isVisible;
    // 렌더링 여부.
    /** @private @type { string } */
    #color;
    // 컬러.
    /** @private @type { number } */
    #opacity;
    // 투명도.
    /** @private @type { VVector2 } */
    #pivot;
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
      this.#position = VVector2.zero();
      this.#size = VVector2.zero();
      this.#scale = VVector2.one();
      this.#rotation = 0;
      this.#isActive = true;
      this.#isVisible = true;
      this.#color = "#ffffff";
      this.#opacity = 1;
      this.#pivot = Pivot.middle;
    }
    //==============================================================================
    // 갱신.
    //==============================================================================
    /**
     * @virtual
     * @param { number } timeDelta 
     */
    update(timeDelta) {
    }
    //==============================================================================
    // 출력 상태 시작.
    //==============================================================================
    /**
     * @virtual
     * @param { VRenderer } renderer 
     */
    beginDrawState(renderer) {
      const canvasContext = renderer.getCanvasContext();
      canvasContext.save();
    }
    //==============================================================================
    // 출력 상태 시작.
    //==============================================================================
    /**
     * @virtual
     * @param { VRenderer } renderer 
     */
    preDraw(renderer) {
      const position = this.getPosition();
      const rotation = this.getRotation();
      const scale = this.getScale();
      const canvasContext = renderer.getCanvasContext();
      canvasContext.translate(position.x, position.y);
      canvasContext.rotate(rotation);
      canvasContext.scale(scale.x, scale.y);
      canvasContext.globalAlpha = this.#opacity;
      canvasContext.fillStyle = this.#color;
    }
    //==============================================================================
    // 출력.
    //==============================================================================
    /**
     * @virtual
     * @param { VRenderer } renderer 
     */
    draw(renderer) {
      const canvasContext = renderer.getCanvasContext();
      canvasContext.fillRect(0, 0, this.#size.x, this.#size.y);
    }
    //==============================================================================
    // 출력 상태 시작.
    //==============================================================================
    /**
     * @virtual
     * @param { VRenderer } renderer 
     */
    postDraw(renderer) {
      const canvasContext = renderer.getCanvasContext();
      canvasContext.globalAlpha = 1;
    }
    //==============================================================================
    // 출력 상태 종료.
    //==============================================================================
    /**
     * @virtual
     * @param { VRenderer } renderer 
     */
    endDrawState(renderer) {
      const canvasContext = renderer.getCanvasContext();
      canvasContext.restore();
    }
    //==============================================================================
    // 부모 설정.
    //==============================================================================
    /**
     * @param { VNode } parent 
     */
    setParent(parent) {
      if (this.#parent) {
        if (this.#parent === parent) {
          return;
        }
        const index = this.#parent.#children.indexOf(this);
        if (index !== -1) {
          this.#parent.#children.splice(index, 1);
        }
        this.#parent = null;
      }
      this.#parent = parent;
      if (this.#parent) {
        parent.#children.push(this);
      }
    }
    //==============================================================================
    // 자식 추가.
    //==============================================================================
    /**
     * @param { VNode } child 
     */
    addChild(child) {
      child.setParent(this);
    }
    //==============================================================================
    // 자식 제거.
    //==============================================================================
    /**
     * @param { VNode } child 
     */
    removeChild(child) {
      child.setParent(null);
    }
    //==============================================================================
    // 모든 자식 제거. (직계 자식 목록만 비우기 때문에 자식들이 소유한 계층 구조는 유지됨)
    //==============================================================================
    removeChildren() {
      for (let i = 0; i < this.#children.length; ++i) {
        const child = this.#children[i];
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
      return this.#parent === null;
    }
    //==============================================================================
    // 자식이 없는지 여부 반환.
    //==============================================================================
    /**
     * @returns { boolean } 
     */
    isLeaf() {
      return this.#children.length === 0;
    }
    //==============================================================================
    // 부모 반환.
    //==============================================================================
    /**
     * @returns { VNode } 
     */
    getParent() {
      return this.#parent;
    }
    //==============================================================================
    // 자식 목록 반환.
    //==============================================================================
    /**
     * @returns { VNode[] } 
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
    getChildCount(index) {
      return this.#children.length;
    }
    //==============================================================================
    // 자식 반환.
    //==============================================================================
    /**
     * @returns { VNode } 
     */
    getChild(index) {
      return this.#children[index];
    }
    //==============================================================================
    // 위치 설정.
    //==============================================================================
    /**
     * @param { VVector2 } position 
     */
    setPosition(position) {
      this.#position = position;
    }
    //==============================================================================
    // 위치 반환.
    //==============================================================================
    /**
     * @returns { VVector2 } 
     */
    getPosition() {
      return this.#position;
    }
    //==============================================================================
    // 크기 설정.
    //==============================================================================
    /**
     * @param { VVector2 } size 
     */
    setSize(size) {
      this.#size = size;
    }
    //==============================================================================
    // 크기 반환.
    //==============================================================================
    /**
     * @returns { VVector2 } 
     */
    getSize() {
      return this.#size;
    }
    //==============================================================================
    // 크기 설정.
    //==============================================================================
    /**
     * @param { VVector2 } scale 
     */
    setScale(scale) {
      this.#scale = scale;
    }
    //==============================================================================
    // 크기 반환.
    //==============================================================================
    /**
     * @returns { VVector2 } 
     */
    getScale() {
      return this.#scale;
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
    // 현재부터 루트까지 계층 전체의 활성화 상태 반환. (루트까지 하나라도 비활성화상태면 false 반환)
    //==============================================================================
    /**
     * @returns { boolean } 
     */
    isActiveInHierarchy() {
      if (this.isActive()) {
        let current = this;
        while (current !== null) {
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
    // 활성화 상태 반환.
    //==============================================================================
    /**
     * @returns { boolean } 
     */
    isActive() {
      return this.#isActive;
    }
    //==============================================================================
    // 가시 상태 설정.
    //==============================================================================
    /**
     * @param { boolean } visible 
     */
    setVisible(visible) {
      this.#isVisible = visible;
    }
    //==============================================================================
    // 현재부터 루트까지 계층 전체의 가시 상태 반환. (루트까지 하나라도 비활성화상태면 false 반환)
    //==============================================================================
    /**
     * @returns { boolean } 
     */
    isVisibleInHierarchy() {
      if (this.isVisible()) {
        let current = this;
        while (current !== null) {
          if (current.isVisible()) {
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
    // 가시 상태 반환.
    //==============================================================================
    /**
     * @returns { boolean } 
     */
    isVisible() {
      return this.#isVisible;
    }
    //==============================================================================
    // 색상 설정.
    //==============================================================================
    /**
     * @param { string } color 
     */
    setColor(color) {
      this.#color = color;
    }
    //==============================================================================
    // 색상 반환.
    //==============================================================================
    /**
     * @returns { string } 
     */
    getColor() {
      return this.#color;
    }
    //==============================================================================
    // 투명도 설정.
    //==============================================================================
    /**
     * @param { number } opacity 
     */
    setOpacity(opacity) {
      this.#opacity = opacity;
    }
    //==============================================================================
    // 투명도 반환.
    //==============================================================================
    /**
     * @returns { number } 
     */
    getOpacity() {
      return this.#opacity;
    }
    //==============================================================================
    // 피봇 설정.
    //==============================================================================
    /**
     * @param { VVector2 } pivot
     */
    setPivot(pivot) {
      this.#pivot = pivot;
      this.#pivot.x = VMath.clamp(this.#pivot.x, 0, 1);
      this.#pivot.y = VMath.clamp(this.#pivot.y, 0, 1);
    }
    //==============================================================================
    // 피봇 반환.
    //==============================================================================
    /**
     * @returns { VVector2 }
     */
    getPivot() {
      return this.#pivot;
    }
    //==============================================================================
    // 새로운 노드 생성.
    //==============================================================================
    /**
     * @returns { VNode }
     */
    static create() {
      var obj = new _VNode();
      return obj;
    }
  };

  // libs/vanilla.js/src/rendering/sprite.js
  var VSprite = class extends VNode {
    static {
      __name(this, "VSprite");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @private @type { HTMLImageElement } */
    #image;
    /** @private @type { VRect } */
    #slices;
    /** @private @type { boolean } */
    #isHorizontalFlip;
    /** @private @type { boolean } */
    #isVerticalFlip;
    //==============================================================================
    // 생성.
    //==============================================================================
    constructor() {
      super();
      this.#image = null;
      this.#slices = VRect.zero();
      this.#isHorizontalFlip = false;
      this.#isVerticalFlip = false;
    }
    //==============================================================================
    // 갱신.
    //==============================================================================
    /**
     * @override
     * @param { number } timeDelta 
     */
    update(timeDelta) {
      super.update(timeDelta);
    }
    //==============================================================================
    // 출력 상태 시작.
    //==============================================================================
    /**
     * @override
     * @param { VRenderer } renderer 
     */
    preDraw(renderer) {
      const position = super.getPosition();
      const rotation = super.getRotation();
      const scale = super.getScale();
      const opacity = super.getOpacity();
      const color = super.getColor();
      const canvasContext = renderer.getCanvasContext();
      canvasContext.translate(position.x, position.y);
      canvasContext.rotate(rotation);
      const flip = VVector2.create(this.isHorizontalFlip() ? -1 : 1, this.isVerticalFlip() ? -1 : 1);
      const finalScale = scale.multiply(flip);
      canvasContext.scale(finalScale.x, finalScale.y);
      canvasContext.globalAlpha = opacity;
      canvasContext.fillStyle = color;
    }
    //==============================================================================
    // 출력.
    //==============================================================================
    /**
     * @override
     * @param { VRenderer } renderer 
     */
    draw(renderer) {
      const size = super.getSize();
      const pivot = super.getPivot();
      const offset = size.multiply(pivot);
      renderer.drawImage(this.#image, offset, size);
    }
    //==============================================================================
    // 이미지 설정.
    //==============================================================================
    /**
     * @param { HTMLImageElement } image 
     */
    setImage(image) {
      this.#image = image;
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
    // 이미지 부분 설정.
    //==============================================================================
    /**
     * @param { VRect } slices
     */
    setSlice(slices) {
      this.#slices = slices;
    }
    //==============================================================================
    // 이미지 부분 반환.
    //==============================================================================
    /**
     * @returns { VRect }
     */
    getSlice(slices) {
      return this.#slices;
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
     * @returns { VVector2 }
     */
    isHorizontalFlip() {
      return this.#isHorizontalFlip;
    }
    //==============================================================================
    // 이미지 뒤집기 여부 반환.
    //==============================================================================
    /**
     * @returns { VVector2 }
     */
    isVerticalFlip() {
      return this.#isVerticalFlip;
    }
  };

  // libs/vanilla.js/src/resource/imageasset.js
  var VImageAsset = class extends VAsset {
    static {
      __name(this, "VImageAsset");
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
      this.image = new window.Image();
    }
    //==============================================================================
    // 비동기 애셋 로드.
    //==============================================================================
    /**
     * @override
     * @param { string } assetPath 
     */
    async load(assetPath) {
      if (super.isLoaded) {
        return Promise.resolve();
      }
      super.assetPath = assetPath;
      this.image = new window.Image();
      this.image.src = assetPath;
      await new Promise((resolve, reject) => {
        this.image.onload = () => {
          super.isLoaded = true;
          resolve();
        };
        this.image.onerror = () => {
          reject(new Error(`Load fail: ${assetPath}`));
        };
      });
    }
  };

  // libs/vanilla.js/src/rendering/animatedsprite.js
  var VAnimatedSprite = class extends VSprite {
    static {
      __name(this, "VAnimatedSprite");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @private @type { VAnimation } */
    #animation;
    /** @private @type { number } */
    #elapsedTime;
    /** @private @type { number } */
    #currentFrameIndex;
    /** @private @type { number } */
    #repeatNumber;
    /** @private @type { boolean } */
    #isPlaying;
    //==============================================================================
    // 생성.
    //==============================================================================
    constructor() {
      super();
      this.#animation = null;
      this.#elapsedTime = 0;
      this.#currentFrameIndex = 0;
      this.#repeatNumber = 0;
      this.#isPlaying = false;
    }
    //==============================================================================
    // 갱신.
    //==============================================================================
    /**
     * @override
     * @param { number } timeDelta 
     */
    update(timeDelta) {
      super.update(timeDelta);
      this.updateAnimation(timeDelta);
    }
    //==============================================================================
    // 애니메이션 갱신.
    //==============================================================================
    /**
     * @param { number } timeDelta 
     */
    updateAnimation(timeDelta) {
      if (this.#isPlaying) {
        this.#elapsedTime += timeDelta;
        if (this.#elapsedTime >= this.#animation.totalFrames) {
          this.#elapsedTime -= this.#animation.totalFrames;
          ++this.#currentFrameIndex;
          this.setImage(this.#animation.images[this.#currentFrameIndex]);
          if (this.#currentFrameIndex >= this.#animation.totalFrames) {
            this.#currentFrameIndex = 0;
            --this.#repeatNumber;
            if (this.#repeatNumber == 0) {
              this.stop();
            }
          }
        }
      }
    }
    //==============================================================================
    // 출력.
    //==============================================================================
    /**
     * @override
     * @param { VRenderer } renderer 
     */
    draw(renderer) {
      super.draw(renderer);
    }
    //==============================================================================
    // 애니메이션 설정.
    //==============================================================================
    /**
     * @override
     * @param { VAnimation } animation 
     */
    setAnimation(animation) {
      this.#animation = animation;
    }
    //==============================================================================
    // 재생.
    //==============================================================================
    play() {
      this.#isPlaying = true;
      this.#currentFrameIndex = 0;
      this.#elapsedTime = 0;
      this.#repeatNumber = 1;
      updateAnimation(0);
    }
    //==============================================================================
    // 정지.
    //==============================================================================
    stop() {
      this.#isPlaying = false;
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
  };

  // libs/vanilla.js/src/resource/fontasset.js
  var VFontAsset = class extends VAsset {
    static {
      __name(this, "VFontAsset");
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
      if (super.isLoaded) {
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
      await super.load(assetPath);
      if (this.fontFace)
        return Promise.resolve();
      this.family = family;
      this.AssetPath = assetPath;
      this.fontFace = new FontFace(this.family, `url(${this.AssetPath})`);
      await this.fontFace.load();
      document.fonts.add(this.fontFace);
      super.IsLoaded = true;
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
      if (this.fontFace == null)
        return;
      document.fonts.delete(this.fontFace);
      this.fontFace = null;
      super.IsLoaded = false;
    }
  };

  // libs/vanilla.js/src/resource/audioasset.js
  var VAudioAsset = class extends VAsset {
    static {
      __name(this, "VAudioAsset");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @private @type { AudioContext | webkitAudioContext | null } */
    #audioContext = null;
    /** @private @type { AudioBuffer | null } */
    #audioBuffer = null;
    /** @private @type { AudioBufferSourceNode | null } */
    #audioSource = null;
    /** @private @type { GainNode | null } */
    #gainNode = null;
    /** @private @type { boolean } */
    #isPlaying = false;
    /** @private @type { boolean } */
    #isMuted = false;
    //==============================================================================
    // 생성.
    //==============================================================================
    constructor() {
      super();
      const audioContextType = window.AudioContext || window.webkitAudioContext;
      if (audioContextType) {
        this.#audioContext = new audioContextType();
        this.#gainNode = this.#audioContext.createGain();
        this.#gainNode.connect(this.#audioContext.destination);
      }
      this.#audioBuffer = null;
      this.#audioSource = null;
      this.#isMuted = false;
      this.#isPlaying = false;
    }
    //==============================================================================
    // 비동기 애셋 로드.
    //==============================================================================
    /**
     * @override
     * @param { string } assetPath 
     */
    async load(assetPath) {
      if (super.isLoaded) {
        return Promise.resolve();
      }
      if (!this.#audioContext) {
        console.error(`AudioContext is not supported.`);
        return;
      }
      try {
        super.assetPath = assetPath;
        const response = await fetch(assetPath);
        const arrayBuffer = await response.arrayBuffer();
        this.#audioBuffer = await this.#audioContext.decodeAudioData(arrayBuffer);
        super.isLoaded = true;
      } catch (error) {
        console.error(`Error loading sound: ${super.assetPath}`, error);
        throw error;
      }
    }
    //==============================================================================
    // 재생.
    //==============================================================================
    /**
     * @param { boolean } loop 
     */
    play(loop = false) {
      if (!this.#audioContext || !this.#audioBuffer)
        return;
      if (this.#audioSource) {
        this.#audioSource.onended = null;
        this.#audioSource.stop();
      }
      this.#audioSource = this.#audioContext.createBufferSource();
      this.#audioSource.buffer = this.#audioBuffer;
      this.#audioSource.loop = loop;
      this.#audioSource.connect(this.#gainNode);
      this.#audioSource.onended = () => {
        this.#isPlaying = false;
        this.#audioSource = null;
      };
      this.#audioSource.start(0);
      this.#isPlaying = true;
    }
    //==============================================================================
    // 정지.
    //==============================================================================
    stop() {
      if (this.#audioSource) {
        this.#audioSource.stop();
      }
    }
    //==============================================================================
    // 컨텍스트 재개.
    //==============================================================================
    resume() {
      if (this.#audioContext && this.#audioContext.state === "suspended") {
        this.#audioContext.resume();
      }
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
    // 재생 시간 반환.
    //==============================================================================
    /**
     * @returns { number }
     */
    getDuration() {
      if (this.#audioBuffer !== null) {
        return this.#audioBuffer.duration;
      }
      return 0;
    }
  };

  // libs/vanilla.js/src/resource/textasset.js
  var VTextAsset = class extends VAsset {
    static {
      __name(this, "VTextAsset");
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
      await super.load(assetPath);
      if (super.isLoaded) {
        return Promise.resolve();
      } else {
        try {
          const response = await fetch(assetPath);
          this.text = await response.text();
          super.isLoaded = true;
        } catch (error) {
          console.error(`Error loading text: ${super.assetPath}`, error);
          throw error;
        }
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
      this.text = "";
    }
  };

  // libs/vanilla.js/src/resource/jsonasset.js
  var VJsonAsset = class extends VTextAsset {
    static {
      __name(this, "VJsonAsset");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @type { Object | null } */
    data;
    //==============================================================================
    // 생성.
    //==============================================================================
    constructor() {
      super();
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
      if (super.isLoaded) {
        return Promise.resolve();
      }
      await super.load(assetPath);
      if (super.isLoaded) {
        try {
          this.data = JSON.parse(this.text);
        } catch (error) {
          console.error(`Error loading json: ${assetPath}`, error);
          super.isLoaded = false;
        }
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

  // libs/vanilla.js/src/ui/uinode.js
  var UINode = class extends VNode {
    static {
      __name(this, "UINode");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @private @type { Vector2 } */
    #anchor;
    //==============================================================================
    // 생성.
    //==============================================================================
    constructor() {
      super();
      this.#anchor = VVector2.zero();
    }
    //==============================================================================
    // 갱신.
    //==============================================================================
    /**
     * @override
     * @param { number } timeDelta 
     */
    update(timeDelta) {
      super.update(timeDelta);
    }
    //==============================================================================
    // 출력.
    //==============================================================================
    /**
     * @override
     * @param { VRenderer } renderer 
     */
    draw(renderer) {
      super.draw(renderer);
    }
    //==============================================================================
    // 앵커 설정.
    //==============================================================================
    /**
     * @param { VVector2 } anchor 
     */
    setAnchor(anchor) {
      this.#anchor = anchor;
    }
    //==============================================================================
    // 앵커 반환.
    //==============================================================================
    /**
     * @returns { VVector2 }
     */
    getAnchor() {
      return this.#anchor;
    }
  };

  // libs/vanilla.js/src/ui/uipanel.js
  var UIPanel = class extends UINode {
    static {
      __name(this, "UIPanel");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    //==============================================================================
    // 생성.
    //==============================================================================
    constructor() {
      super();
    }
    //==============================================================================
    // 갱신.
    //==============================================================================
    /**
     * @override
     * @param { number } timeDelta 
     */
    update(timeDelta) {
      super.update(timeDelta);
    }
    //==============================================================================
    // 출력.
    //==============================================================================
    /**
     * @override
     * @param { VRenderer } renderer 
     */
    draw(renderer) {
      super.draw(renderer);
    }
  };

  // libs/vanilla.js/src/ui/uibutton.js
  var UIButton = class extends UINode {
    static {
      __name(this, "UIButton");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    // /** @type { VFontAsset } */ fontAsset = null;
    //==============================================================================
    // 생성.
    //==============================================================================
    constructor() {
      super();
      this.fontAsset = null;
    }
    //==============================================================================
    // 갱신.
    //==============================================================================
    /**
     * @override
     * @param { number } timeDelta 
     */
    update(timeDelta) {
      super.update(timeDelta);
    }
    //==============================================================================
    // 출력.
    //==============================================================================
    /**
     * @override
     * @param { VRenderer } renderer 
     */
    draw(renderer) {
    }
    //==============================================================================
    // 상태 변경.
    //==============================================================================
    setState() {
    }
    //==============================================================================
    // 영역에 충돌 되었는지 여부.
    //==============================================================================
    /**
     * @override
     * @param { Vector2 } position
     * @returns { boolean }
     */
    isHitTest(position) {
      return false;
    }
  };

  // libs/vanilla.js/src/ui/uilabel.js
  var UILabel = class extends UINode {
    static {
      __name(this, "UILabel");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @type { VFontAsset } */
    fontAsset = null;
    //==============================================================================
    // 생성.
    //==============================================================================
    constructor() {
      super();
      this.fontAsset = null;
    }
    //==============================================================================
    // 갱신.
    //==============================================================================
    /**
     * @override
     * @param { number } timeDelta 
     */
    update(timeDelta) {
      super.update(timeDelta);
    }
    //==============================================================================
    // 출력.
    //==============================================================================
    /**
     * @override
     * @param { VRenderer } renderer 
     */
    draw(renderer) {
      super.draw(renderer);
      const position = super.getPosition();
      const size = super.getSize();
      const canvasContext = renderer.getCanvasContext();
      const SYSTEM_FONT_STRING = '-apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      canvasContext.fillStyle = "#000000";
      canvasContext.font = `bold 64px ${SYSTEM_FONT_STRING}`;
      canvasContext.textAlign = "center";
      canvasContext.fillText(`${this.Score}`, position.x, position.y, size.x, size.y);
    }
  };

  // libs/vanilla.js/src/misc/identifier.js
  var VIdentifier = class extends VObject {
    static {
      __name(this, "VIdentifier");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @private @type { number } */
    #increaseNumber;
    //==============================================================================
    // 생성.
    //==============================================================================
    /**
     * @param { number} initialIncreaseNumber 
     */
    constructor(initialIncreaseNumber = 0) {
      super();
      this.#increaseNumber = initialIncreaseNumber ?? 0;
    }
    //==============================================================================
    // 아이디 자동 생성 후 반환.
    //==============================================================================
    /**
     * @description 아이디 자동 생성 후 반환.
     * @returns { number }
     */
    auto() {
      return ++this.#increaseNumber;
    }
  };
  var VGlobalIdentifier = class _VGlobalIdentifier extends VObject {
    static {
      __name(this, "VGlobalIdentifier");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @private @static @type { VIdentifier } */
    static #identifier = new VIdentifier(0);
    //==============================================================================
    // 아이디 자동 생성 후 반환.
    //==============================================================================
    /**
     * @static
     * @returns { number }
     */
    static auto() {
      return _VGlobalIdentifier.#identifier.auto();
    }
  };

  // libs/vanilla.js/src/misc/toucheffect.js
  var VParticle = class extends VObject {
    static {
      __name(this, "VParticle");
    }
    /** @type { VVector2 } */
    position;
    /** @type { VVector2 } */
    velocity;
    /** @type { number } */
    life;
    /** @type { number } */
    maxLife;
    /** @type { number } */
    radius;
    constructor() {
      super();
      this.position = VVector2.zero();
      this.velocity = VVector2.zero();
      this.life = 1;
      this.maxLife = 1;
      this.radius = 0;
    }
  };
  var VTouchEffect = class extends VNode {
    static {
      __name(this, "VTouchEffect");
    }
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @type { VParticle[] } */
    touchParticles;
    //==============================================================================
    // 생성.
    //==============================================================================
    constructor() {
      super();
      this.touchParticles = [];
    }
    //==============================================================================
    // 갱신.
    //==============================================================================
    /**
     * @override
     * @param { number } timeDelta 
     */
    update(timeDelta) {
      super.update(timeDelta);
      this.updateTouchParticles(timeDelta);
    }
    //==============================================================================
    // 출력 상태 시작.
    //==============================================================================
    /**
     * @override
     * @param { VRenderer } renderer 
     */
    beginDrawState(renderer) {
      super.beginDrawState(renderer);
      const canvasContext = renderer.getCanvasContext();
      canvasContext.globalCompositeOperation = "lighter";
    }
    //==============================================================================
    // 출력 상태 종료.
    //==============================================================================
    /**
     * @override
     * @param { VRenderer } renderer 
     */
    endDrawState(renderer) {
      super.endDrawState(renderer);
      const canvasContext = renderer.getCanvasContext();
      canvasContext.globalCompositeOperation = "source-over";
    }
    //==============================================================================
    // 출력.
    //==============================================================================
    /**
     * @override
     * @param { VRenderer } renderer 
     */
    draw(renderer) {
      this.drawTouchParticles(renderer);
    }
    //==============================================================================
    // 터치 파티클 생성.
    //==============================================================================
    createTouchParticle(x, y) {
      const particle = new VParticle();
      particle.position = VVector2.create(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10);
      particle.velocity = VVector2.create((Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120);
      particle.life = 1;
      particle.maxLife = 1;
      particle.radius = Math.random() * 25 + 10;
      this.touchParticles.push(particle);
    }
    //==============================================================================
    // 터치 파티클 갱신.
    //==============================================================================
    /**
     * @param { number } timeDelta 
     */
    updateTouchParticles(timeDelta) {
      for (let i = this.touchParticles.length - 1; i >= 0; --i) {
        const particle = this.touchParticles[i];
        particle.life -= timeDelta * 2.5;
        particle.position.x += particle.velocity.x * timeDelta;
        particle.position.y += particle.velocity.y * timeDelta;
        if (particle.life <= 0) {
          this.touchParticles.splice(i, 1);
        }
      }
    }
    //==============================================================================
    // 터치 파티클 출력.
    //==============================================================================
    /**
     * @param { VRenderer } renderer 
     */
    drawTouchParticles(renderer) {
      if (this.touchParticles.length === 0) {
        return;
      }
      const canvasContext = renderer.getCanvasContext();
      for (let i = 0; i < this.touchParticles.length; ++i) {
        const particle = this.touchParticles[i];
        const opacity = Math.max(0, particle.life / particle.maxLife);
        const radialGradient = canvasContext.createRadialGradient(
          particle.position.x,
          particle.position.y,
          0,
          particle.position.x,
          particle.position.y,
          particle.radius
        );
        radialGradient.addColorStop(0, `rgba(100, 200, 255, ${opacity * 0.8})`);
        radialGradient.addColorStop(1, `rgba(100, 200, 255, 0)`);
        canvasContext.beginPath();
        canvasContext.arc(particle.position.x, particle.position.y, particle.radius, 0, Math.PI * 2);
        canvasContext.fillStyle = radialGradient;
        canvasContext.fill();
      }
    }
  };
  return __toCommonJS(index_exports);
})();
//# sourceMappingURL=vanilla.js.map
