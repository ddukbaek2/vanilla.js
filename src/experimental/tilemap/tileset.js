//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";
import { Vector2 } from "../../base/vector2.js";
import { Rect } from "../../base/rect.js";
import { ImageAsset } from "../../resource/imageasset.js";


//==============================================================================
// 타일셋.
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 그림 한 장을 격자(타일 크기, 여백 margin, 간격 spacing)로 자르거나, 타일마다 그림을 따로 건다. (Tiled 의 그림 모음 타일셋)
// - 타일마다 속성, 종류(type), 애니메이션 프레임, 충돌 모양, 그림 영역을 둘 수 있다. 타일 번호는 타일셋 안의 번호(0 부터)다.
// - 모양과 정렬은 Tiled 를 따른다. (그리는 크기 tile / grid, 채우기 stretch / preserve-aspect-fit, 타일 오프셋은 아래가 +)
//==============================================================================
/**
 * @example <caption>격자 타일셋과 타일 속성, 애니메이션, 충돌 모양</caption>
 * import { Vector2 } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const tileset = new Experimental.Tileset();
 * tileset.setTileSize(16, 16);
 * tileset.setMargin(1);
 * tileset.setSpacing(2);
 * tileset.fitGridToImageSize(127, 37);
 * console.log(tileset.getColumns(), tileset.getTileCount());
 * const imageRect = tileset.readTileImageRect(8);
 * console.log(imageRect.position.x, imageRect.position.y, imageRect.width, imageRect.height);
 *
 * tileset.setTileProperty(3, "isWater", true);
 * tileset.setTileAnimation(3, [new Experimental.TileAnimationFrame(3, 200), new Experimental.TileAnimationFrame(4, 200)]);
 * console.log(tileset.getTileProperty(3, "isWater"), tileset.readAnimatedTileId(3, 250));
 *
 * const wallShape = Experimental.TileCollisionShape.createRectangle(0, 8, 16, 8);
 * tileset.setTileCollisionShapes(5, [wallShape]);
 * console.log(tileset.getTileCollisionShapes(5).length);
 */


//==============================================================================
// 타일을 그리는 크기.
//==============================================================================
export const TileRenderSize = {
	tile: "tile", // 타일 그림 크기 그대로 그린다. (그림이 격자보다 크면 위와 오른쪽으로 넘친다)
	grid: "grid", // 지도의 격자 크기로 늘이거나 줄여 그린다.
};


//==============================================================================
// 격자 크기로 그릴 때 채우는 방식.
//==============================================================================
export const TileFillMode = {
	stretch: "stretch", // 격자에 꽉 차게 늘인다. (가로세로 비가 바뀔 수 있다)
	preserveAspectFit: "preserve-aspect-fit", // 가로세로 비를 지켜 격자 안에 들어가게 줄이고 가운데 둔다.
};


//==============================================================================
// 충돌 모양 종류. (Tiled 물체 모양과 같다)
//==============================================================================
export const TileCollisionShapeKind = {
	rectangle: "rectangle", // 사각형. (x, y 는 왼쪽 위, rotation 은 그 점을 축으로 돈다)
	ellipse: "ellipse", // 타원. (x, y, width, height 는 감싸는 사각형)
	capsule: "capsule", // 캡슐. (감싸는 사각형의 짧은 쪽이 지름인 둥근 막대)
	polygon: "polygon", // 닫힌 다각형. (points 는 x, y 에서 잰 꼭짓점)
	polyline: "polyline", // 열린 꺾은선. (points 는 x, y 에서 잰 점)
	point: "point", // 점. (x, y 만 쓴다)
};


//==============================================================================
// 타일 애니메이션 프레임 하나.
//==============================================================================
/**
 * @example <caption>물결 타일 프레임 둘</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const firstFrame = new Experimental.TileAnimationFrame(10, 150);
 * const secondFrame = new Experimental.TileAnimationFrame(11, 150);
 * console.log(firstFrame.tileId, firstFrame.duration + secondFrame.duration);
 */
export class TileAnimationFrame {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { number } */ tileId; // 이 프레임에 보일 타일 번호. (타일셋 안의 번호)
	/** @type { number } */ duration; // 이 프레임을 보이는 시간. (밀리초)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { number } tileId 이 프레임에 보일 타일 번호. (타일셋 안의 번호)
	 * @param { number } duration 이 프레임을 보이는 시간. (밀리초)
	 */
	constructor(tileId, duration) {
		this.tileId = tileId;
		this.duration = duration;
	}
}


//==============================================================================
// 타일 충돌 모양 하나.
// - 물리 엔진에 기대지 않는 자료다. 사각형, 타원, 캡슐은 x, y(왼쪽 위)와 너비, 높이, 그 점을 축으로 한 시계 방향 회전(도),
//   다각형과 꺾은선은 x, y 와 그 점에서 잰 꼭짓점 목록, 점은 x, y 만 쓴다. (Tiled 물체와 같은 꼴)
// - createTransformed 로 타일 안 좌표를 지도 좌표로 옮긴다. (Tilemap.readCellCollisionShapes 가 쓴다)
//==============================================================================
/**
 * @example <caption>모양을 만들고 옮기기</caption>
 * import { Vector2 } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const slope = Experimental.TileCollisionShape.createPolygon(0, 16, [Vector2.create(0, 0), Vector2.create(16, -16), Vector2.create(16, 0)]);
 * const moveRight = { a: 1, b: 0, c: 0, d: 1, e: 32, f: 0 };
 * const movedSlope = slope.createTransformed(moveRight);
 * console.log(movedSlope.kind, movedSlope.x, movedSlope.y, movedSlope.points.length);
 */
export class TileCollisionShape {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { string } */ kind; // 모양 종류. (TileCollisionShapeKind)
	/** @type { number } */ x; // 기준점 X. (픽셀)
	/** @type { number } */ y; // 기준점 Y. (픽셀)
	/** @type { number } */ width; // 너비. (사각형, 타원, 캡슐, 픽셀)
	/** @type { number } */ height; // 높이. (사각형, 타원, 캡슐, 픽셀)
	/** @type { number } */ rotation; // 기준점을 축으로 한 시계 방향 회전. (도)
	/** @type { Vector2[] } */ points; // 기준점에서 잰 꼭짓점. (다각형, 꺾은선)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { string } kind 모양 종류. (TileCollisionShapeKind, 기본 "rectangle")
	 */
	constructor(kind = TileCollisionShapeKind.rectangle) {
		this.kind = kind;
		this.x = 0;
		this.y = 0;
		this.width = 0;
		this.height = 0;
		this.rotation = 0;
		this.points = [];
	}

	//==============================================================================
	// 사각형 만들기. (정적)
	//==============================================================================
	/**
	 * @param { number } x 왼쪽. (픽셀)
	 * @param { number } y 위. (픽셀)
	 * @param { number } width 너비. (픽셀)
	 * @param { number } height 높이. (픽셀)
	 * @returns { TileCollisionShape } 새 사각형 모양.
	 */
	static createRectangle(x, y, width, height) {
		const shape = new TileCollisionShape(TileCollisionShapeKind.rectangle);
		shape.x = x;
		shape.y = y;
		shape.width = width;
		shape.height = height;
		return shape;
	}

	//==============================================================================
	// 타원 만들기. (정적, 감싸는 사각형으로)
	//==============================================================================
	/**
	 * @param { number } x 감싸는 사각형의 왼쪽. (픽셀)
	 * @param { number } y 감싸는 사각형의 위. (픽셀)
	 * @param { number } width 너비. (픽셀)
	 * @param { number } height 높이. (픽셀)
	 * @returns { TileCollisionShape } 새 타원 모양.
	 */
	static createEllipse(x, y, width, height) {
		const shape = TileCollisionShape.createRectangle(x, y, width, height);
		shape.kind = TileCollisionShapeKind.ellipse;
		return shape;
	}

	//==============================================================================
	// 다각형 만들기. (정적, 닫힌 모양)
	//==============================================================================
	/**
	 * @param { number } x 기준점 X. (픽셀)
	 * @param { number } y 기준점 Y. (픽셀)
	 * @param { Vector2[] } points 기준점에서 잰 꼭짓점. (복사해 둔다)
	 * @returns { TileCollisionShape } 새 다각형 모양.
	 */
	static createPolygon(x, y, points) {
		const shape = new TileCollisionShape(TileCollisionShapeKind.polygon);
		shape.x = x;
		shape.y = y;
		shape.points = points.map((point) => Vector2.create(point.x, point.y));
		return shape;
	}

	//==============================================================================
	// 꺾은선 만들기. (정적, 열린 모양)
	//==============================================================================
	/**
	 * @param { number } x 기준점 X. (픽셀)
	 * @param { number } y 기준점 Y. (픽셀)
	 * @param { Vector2[] } points 기준점에서 잰 점. (복사해 둔다)
	 * @returns { TileCollisionShape } 새 꺾은선 모양.
	 */
	static createPolyline(x, y, points) {
		const shape = TileCollisionShape.createPolygon(x, y, points);
		shape.kind = TileCollisionShapeKind.polyline;
		return shape;
	}

	//==============================================================================
	// 점 만들기. (정적)
	//==============================================================================
	/**
	 * @param { number } x X. (픽셀)
	 * @param { number } y Y. (픽셀)
	 * @returns { TileCollisionShape } 새 점 모양.
	 */
	static createPoint(x, y) {
		const shape = new TileCollisionShape(TileCollisionShapeKind.point);
		shape.x = x;
		shape.y = y;
		return shape;
	}

	//==============================================================================
	// 복제.
	//==============================================================================
	/**
	 * @returns { TileCollisionShape } 같은 값을 가진 새 모양. (꼭짓점도 새로 만든다)
	 */
	clone() {
		const shape = new TileCollisionShape(this.kind);
		shape.x = this.x;
		shape.y = this.y;
		shape.width = this.width;
		shape.height = this.height;
		shape.rotation = this.rotation;
		shape.points = this.points.map((point) => Vector2.create(point.x, point.y));
		return shape;
	}

	//==============================================================================
	// 어파인 변환으로 옮긴 새 모양 만들기.
	// - 다각형, 꺾은선, 점은 꼭짓점을 그대로 옮긴다. (다각형과 꺾은선의 회전은 꼭짓점에 녹이고 0 이 된다)
	// - 사각형, 타원, 캡슐은 옮긴 두 축으로 다시 짓는다. 뒤집기(행렬식 < 0)는 반대쪽 모서리를 기준점으로 삼아 오른손 축으로 되돌린다.
	//   회전이 90 도의 배수가 되면 축에 맞춘 감싸는 사각형(회전 0)으로 고친다.
	//   두 축이 직각이 아니게 되면(기울임) 사각형은 다각형이 되고, 타원과 캡슐은 두 축 길이로 어림한다.
	//==============================================================================
	/**
	 * @param { { a: number, b: number, c: number, d: number, e: number, f: number } } transformMatrix 옮길 변환. (TransformMatrix 나 같은 이름의 수를 가진 객체, x' = a*x + c*y + e, y' = b*x + d*y + f)
	 * @returns { TileCollisionShape } 옮긴 새 모양.
	 */
	createTransformed(transformMatrix) {
		const matrixA = transformMatrix.a;
		const matrixB = transformMatrix.b;
		const matrixC = transformMatrix.c;
		const matrixD = transformMatrix.d;
		const matrixE = transformMatrix.e;
		const matrixF = transformMatrix.f;
		const shape = new TileCollisionShape(this.kind);
		const radian = this.rotation * System.Math.PI / 180;
		const cosRotation = System.Math.cos(radian);
		const sinRotation = System.Math.sin(radian);
		const originX = matrixA * this.x + matrixC * this.y + matrixE;
		const originY = matrixB * this.x + matrixD * this.y + matrixF;

		// 점, 다각형, 꺾은선.
		if (this.kind === TileCollisionShapeKind.point || this.kind === TileCollisionShapeKind.polygon || this.kind === TileCollisionShapeKind.polyline) {
			shape.x = originX;
			shape.y = originY;
			for (const point of this.points) {
				const rotatedX = point.x * cosRotation - point.y * sinRotation;
				const rotatedY = point.x * sinRotation + point.y * cosRotation;
				const transformedX = matrixA * rotatedX + matrixC * rotatedY;
				const transformedY = matrixB * rotatedX + matrixD * rotatedY;
				shape.points.push(Vector2.create(transformedX, transformedY));
			}
			return shape;
		}

		// 사각형, 타원, 캡슐. (두 축을 옮긴다)
		let axisXx = matrixA * cosRotation * this.width + matrixC * sinRotation * this.width;
		let axisXy = matrixB * cosRotation * this.width + matrixD * sinRotation * this.width;
		const axisYx = matrixA * -sinRotation * this.height + matrixC * cosRotation * this.height;
		const axisYy = matrixB * -sinRotation * this.height + matrixD * cosRotation * this.height;
		let cornerX = originX;
		let cornerY = originY;
		const determinant = matrixA * matrixD - matrixB * matrixC;
		if (determinant < 0) {
			cornerX = originX + axisXx;
			cornerY = originY + axisXy;
			axisXx = -axisXx;
			axisXy = -axisXy;
		}
		const axisXLength = System.Math.sqrt(axisXx * axisXx + axisXy * axisXy);
		const axisYLength = System.Math.sqrt(axisYx * axisYx + axisYy * axisYy);
		const axisDot = axisXx * axisYx + axisXy * axisYy;
		const isSheared = System.Math.abs(axisDot) > 0.0001 * System.Math.max(1, axisXLength * axisYLength);
		if (isSheared && this.kind === TileCollisionShapeKind.rectangle) {
			shape.kind = TileCollisionShapeKind.polygon;
			shape.x = cornerX;
			shape.y = cornerY;
			shape.points.push(Vector2.create(0, 0));
			shape.points.push(Vector2.create(axisXx, axisXy));
			shape.points.push(Vector2.create(axisXx + axisYx, axisXy + axisYy));
			shape.points.push(Vector2.create(axisYx, axisYy));
			return shape;
		}
		let rotation = axisXLength > 0 ? System.Math.atan2(axisXy, axisXx) * 180 / System.Math.PI : 0;
		const quarterTurnCount = System.Math.round(rotation / 90);
		if (System.Math.abs(rotation - quarterTurnCount * 90) < 0.0001) {
			// 축에 맞춘 감싸는 사각형으로 고친다.
			const minimumX = System.Math.min(cornerX, cornerX + axisXx, cornerX + axisYx, cornerX + axisXx + axisYx);
			const minimumY = System.Math.min(cornerY, cornerY + axisXy, cornerY + axisYy, cornerY + axisXy + axisYy);
			const maximumX = System.Math.max(cornerX, cornerX + axisXx, cornerX + axisYx, cornerX + axisXx + axisYx);
			const maximumY = System.Math.max(cornerY, cornerY + axisXy, cornerY + axisYy, cornerY + axisXy + axisYy);
			shape.x = minimumX;
			shape.y = minimumY;
			shape.width = maximumX - minimumX;
			shape.height = maximumY - minimumY;
			shape.rotation = 0;
			return shape;
		}
		shape.x = cornerX;
		shape.y = cornerY;
		shape.width = axisXLength;
		shape.height = axisYLength;
		shape.rotation = rotation;
		return shape;
	}
}


//==============================================================================
// 타일 하나의 자료 만들기. (타일셋 안에서만 쓴다)
//==============================================================================
/**
 * @private
 * @returns { object }
 */
function createTileData() {
	return {
		image: null,
		imagePath: "",
		imageRect: null,
		type: "",
		properties: new System.Map(),
		animation: [],
		collisionShapes: [],
	};
}


//==============================================================================
// 타일셋.
//==============================================================================
/**
 * @example <caption>그림 한 장으로 격자 타일셋 만들기</caption>
 * import { ImageAsset } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const imageAsset = new ImageAsset();
 * await imageAsset.load("examples/tilemapshowcase/assets/terrain.png");
 * const tileset = Experimental.Tileset.createGrid(imageAsset, 16, 16, 1, 2);
 * tileset.setName("terrain");
 * console.log(tileset.getColumns(), tileset.getTileCount());
 */
export class Tileset extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #name; // 이름.
	/** @private @type { HTMLImageElement | null } */ #image; // 격자로 자를 그림.
	/** @private @type { string } */ #imagePath; // 그림 경로. (읽은 파일에서 온 것, 그리기에는 쓰지 않는다)
	/** @private @type { number } */ #tileWidth; // 타일 너비. (픽셀)
	/** @private @type { number } */ #tileHeight; // 타일 높이. (픽셀)
	/** @private @type { number } */ #margin; // 그림 가장자리와 첫 타일 사이. (픽셀)
	/** @private @type { number } */ #spacing; // 이웃 타일 사이. (픽셀)
	/** @private @type { number } */ #columns; // 격자의 열 수. (0 이면 격자 없음)
	/** @private @type { number } */ #tileCount; // 타일 수.
	/** @private @type { Vector2 } */ #tileOffset; // 그릴 때 더하는 자리. (픽셀, 아래가 +)
	/** @private @type { string } */ #tileRenderSize; // 그리는 크기. (TileRenderSize)
	/** @private @type { string } */ #fillMode; // 채우기. (TileFillMode)
	/** @private @type { Map<string, any> } */ #properties; // 타일셋 속성.
	/** @private @type { Map<number, object> } */ #tileDataTable; // 타일 번호 → 타일 자료.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#name = "";
		this.#image = null;
		this.#imagePath = "";
		this.#tileWidth = 32;
		this.#tileHeight = 32;
		this.#margin = 0;
		this.#spacing = 0;
		this.#columns = 0;
		this.#tileCount = 0;
		this.#tileOffset = Vector2.zero();
		this.#tileRenderSize = TileRenderSize.tile;
		this.#fillMode = TileFillMode.stretch;
		this.#properties = new System.Map();
		this.#tileDataTable = new System.Map();
	}

	//==============================================================================
	// 그림 한 장의 격자 타일셋 만들기. (정적, 그림 크기로 열 수와 타일 수를 셈한다)
	//==============================================================================
	/**
	 * @param { HTMLImageElement | ImageAsset } image 자를 그림. (읽힌 것이어야 크기를 안다)
	 * @param { number } tileWidth 타일 너비. (픽셀)
	 * @param { number } tileHeight 타일 높이. (픽셀)
	 * @param { number } margin 그림 가장자리와 첫 타일 사이. (픽셀, 기본 0)
	 * @param { number } spacing 이웃 타일 사이. (픽셀, 기본 0)
	 * @returns { Tileset } 새 타일셋.
	 */
	static createGrid(image, tileWidth, tileHeight, margin = 0, spacing = 0) {
		const tileset = new Tileset();
		tileset.setImage(image);
		tileset.setTileSize(tileWidth, tileHeight);
		tileset.setMargin(margin);
		tileset.setSpacing(spacing);
		const tilesetImage = tileset.getImage();
		if (tilesetImage !== null) {
			tileset.fitGridToImageSize(tilesetImage.width, tilesetImage.height);
		}
		return tileset;
	}

	//==============================================================================
	// 그림 크기로 열 수와 타일 수 셈하기. (타일 크기, 여백, 간격을 먼저 정한다)
	//==============================================================================
	/**
	 * @param { number } imageWidth 그림 너비. (픽셀)
	 * @param { number } imageHeight 그림 높이. (픽셀)
	 */
	fitGridToImageSize(imageWidth, imageHeight) {
		const tileWidth = this.getTileWidth();
		const tileHeight = this.getTileHeight();
		const margin = this.getMargin();
		const spacing = this.getSpacing();
		if (tileWidth <= 0 || tileHeight <= 0) {
			this.setColumns(0);
			this.setTileCount(0);
			return;
		}
		const columns = System.Math.max(0, System.Math.floor((imageWidth - margin * 2 + spacing) / (tileWidth + spacing)));
		const rows = System.Math.max(0, System.Math.floor((imageHeight - margin * 2 + spacing) / (tileHeight + spacing)));
		this.setColumns(columns);
		this.setTileCount(columns * rows);
	}

	//==============================================================================
	// 이름 설정.
	//==============================================================================
	/**
	 * @param { string } name 이름.
	 */
	setName(name) {
		this.#name = name;
	}

	//==============================================================================
	// 이름 반환.
	//==============================================================================
	/**
	 * @returns { string } 이름. (처음은 빈 글)
	 */
	getName() {
		return this.#name;
	}

	//==============================================================================
	// 격자로 자를 그림 설정.
	//==============================================================================
	/**
	 * @param { HTMLImageElement | ImageAsset | null } image 그림. (ImageAsset 이면 그 그림, null 이면 비운다)
	 */
	setImage(image) {
		if (image instanceof ImageAsset) {
			this.#image = image.image;
		}
		else if (image === undefined) {
			this.#image = null;
		}
		else {
			this.#image = image;
		}
	}

	//==============================================================================
	// 격자로 자를 그림 반환.
	//==============================================================================
	/**
	 * @returns { HTMLImageElement | null } 그림. (없으면 null)
	 */
	getImage() {
		return this.#image;
	}

	//==============================================================================
	// 그림 경로 설정. (읽은 파일에서 온 경로, 그림은 setImage 로 따로 건다)
	//==============================================================================
	/**
	 * @param { string } imagePath 그림 경로.
	 */
	setImagePath(imagePath) {
		this.#imagePath = imagePath;
	}

	//==============================================================================
	// 그림 경로 반환.
	//==============================================================================
	/**
	 * @returns { string } 그림 경로. (없으면 빈 글)
	 */
	getImagePath() {
		return this.#imagePath;
	}

	//==============================================================================
	// 타일 크기 설정.
	//==============================================================================
	/**
	 * @param { number } tileWidth 타일 너비. (픽셀)
	 * @param { number } tileHeight 타일 높이. (픽셀)
	 */
	setTileSize(tileWidth, tileHeight) {
		this.#tileWidth = tileWidth;
		this.#tileHeight = tileHeight;
	}

	//==============================================================================
	// 타일 너비 반환.
	//==============================================================================
	/**
	 * @returns { number } 타일 너비. (픽셀, 처음은 32)
	 */
	getTileWidth() {
		return this.#tileWidth;
	}

	//==============================================================================
	// 타일 높이 반환.
	//==============================================================================
	/**
	 * @returns { number } 타일 높이. (픽셀, 처음은 32)
	 */
	getTileHeight() {
		return this.#tileHeight;
	}

	//==============================================================================
	// 여백 설정. (그림 가장자리와 첫 타일 사이)
	//==============================================================================
	/**
	 * @param { number } margin 여백. (픽셀)
	 */
	setMargin(margin) {
		this.#margin = margin;
	}

	//==============================================================================
	// 여백 반환.
	//==============================================================================
	/**
	 * @returns { number } 여백. (픽셀, 처음은 0)
	 */
	getMargin() {
		return this.#margin;
	}

	//==============================================================================
	// 간격 설정. (이웃 타일 사이)
	//==============================================================================
	/**
	 * @param { number } spacing 간격. (픽셀)
	 */
	setSpacing(spacing) {
		this.#spacing = spacing;
	}

	//==============================================================================
	// 간격 반환.
	//==============================================================================
	/**
	 * @returns { number } 간격. (픽셀, 처음은 0)
	 */
	getSpacing() {
		return this.#spacing;
	}

	//==============================================================================
	// 격자의 열 수 설정.
	//==============================================================================
	/**
	 * @param { number } columns 열 수. (0 이면 격자 없이 타일마다 그림을 건다)
	 */
	setColumns(columns) {
		this.#columns = columns;
	}

	//==============================================================================
	// 격자의 열 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 열 수. (처음은 0)
	 */
	getColumns() {
		return this.#columns;
	}

	//==============================================================================
	// 타일 수 설정.
	//==============================================================================
	/**
	 * @param { number } tileCount 타일 수.
	 */
	setTileCount(tileCount) {
		this.#tileCount = tileCount;
	}

	//==============================================================================
	// 타일 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 타일 수. (처음은 0)
	 */
	getTileCount() {
		return this.#tileCount;
	}

	//==============================================================================
	// 타일 오프셋 설정. (그릴 때 더하는 자리)
	//==============================================================================
	/**
	 * @param { Vector2 } tileOffset 오프셋. (픽셀, 아래가 +, 복사해 둔다)
	 */
	setTileOffset(tileOffset) {
		this.#tileOffset = Vector2.create(tileOffset.x, tileOffset.y);
	}

	//==============================================================================
	// 타일 오프셋 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 오프셋. (픽셀, 처음은 0, 0)
	 */
	getTileOffset() {
		// 사본. (밖에서 고쳐도 타일셋은 그대로, 러스트 판과 같다)
		return Vector2.create(this.#tileOffset.x, this.#tileOffset.y);
	}

	//==============================================================================
	// 그리는 크기 설정.
	//==============================================================================
	/**
	 * @param { string } tileRenderSize 그리는 크기. (TileRenderSize)
	 */
	setTileRenderSize(tileRenderSize) {
		this.#tileRenderSize = tileRenderSize;
	}

	//==============================================================================
	// 그리는 크기 반환.
	//==============================================================================
	/**
	 * @returns { string } 그리는 크기. (TileRenderSize, 처음은 "tile")
	 */
	getTileRenderSize() {
		return this.#tileRenderSize;
	}

	//==============================================================================
	// 채우기 설정. (격자 크기로 그릴 때)
	//==============================================================================
	/**
	 * @param { string } fillMode 채우기. (TileFillMode)
	 */
	setFillMode(fillMode) {
		this.#fillMode = fillMode;
	}

	//==============================================================================
	// 채우기 반환.
	//==============================================================================
	/**
	 * @returns { string } 채우기. (TileFillMode, 처음은 "stretch")
	 */
	getFillMode() {
		return this.#fillMode;
	}

	//==============================================================================
	// 타일셋 속성 설정.
	//==============================================================================
	/**
	 * @param { string } name 속성 이름.
	 * @param { any } value 값. (Tiled 속성 값 그대로, 색은 "#AARRGGBB" 글)
	 */
	setProperty(name, value) {
		const properties = this.getProperties();
		properties.set(name, value);
	}

	//==============================================================================
	// 타일셋 속성 반환.
	//==============================================================================
	/**
	 * @param { string } name 속성 이름.
	 * @returns { any } 값. (없으면 null)
	 */
	getProperty(name) {
		const properties = this.getProperties();
		if (!properties.has(name)) {
			return null;
		}
		return properties.get(name);
	}

	//==============================================================================
	// 타일셋 속성 모두 반환.
	//==============================================================================
	/**
	 * @returns { Map<string, any> } 이름 → 값. (넣은 차례)
	 */
	getProperties() {
		return this.#properties;
	}

	//==============================================================================
	// 타일 자료 표 반환. (타일 번호 → 타일 자료)
	//==============================================================================
	/**
	 * @private
	 * @returns { Map<number, object> }
	 */
	getTileDataTable() {
		return this.#tileDataTable;
	}

	//==============================================================================
	// 타일 자료 반환. (없으면 만들지 않고 null)
	//==============================================================================
	/**
	 * @private
	 * @param { number } tileId
	 * @returns { object | null }
	 */
	findTileData(tileId) {
		const tileDataTable = this.getTileDataTable();
		const tileData = tileDataTable.get(tileId);
		if (tileData === undefined) {
			return null;
		}
		return tileData;
	}

	//==============================================================================
	// 타일 자료 반환. (없으면 만든다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } tileId
	 * @returns { object }
	 */
	ensureTileData(tileId) {
		const tileDataTable = this.getTileDataTable();
		let tileData = tileDataTable.get(tileId);
		if (tileData === undefined) {
			tileData = createTileData();
			tileDataTable.set(tileId, tileData);
		}
		return tileData;
	}

	//==============================================================================
	// 자료(그림, 속성, 애니메이션, 충돌 모양 등)를 가진 타일 번호 목록 반환.
	//==============================================================================
	/**
	 * @returns { number[] } 타일 번호. (작은 차례)
	 */
	getDefinedTileIds() {
		const tileDataTable = this.getTileDataTable();
		const tileIdList = System.Array.from(tileDataTable.keys());
		tileIdList.sort((first, second) => first - second);
		return tileIdList;
	}

	//==============================================================================
	// 타일 하나의 그림 설정. (그림 모음 타일셋, 그 타일만 이 그림으로 그린다)
	//==============================================================================
	/**
	 * @param { number } tileId 타일 번호.
	 * @param { HTMLImageElement | ImageAsset | null } image 그림. (null 이면 타일셋 그림을 쓴다)
	 */
	setTileImage(tileId, image) {
		const tileData = this.ensureTileData(tileId);
		if (image instanceof ImageAsset) {
			tileData.image = image.image;
		}
		else if (image === undefined) {
			tileData.image = null;
		}
		else {
			tileData.image = image;
		}
	}

	//==============================================================================
	// 타일 하나의 그림 반환.
	//==============================================================================
	/**
	 * @param { number } tileId 타일 번호.
	 * @returns { HTMLImageElement | null } 그 타일의 그림. (따로 건 것이 없으면 타일셋 그림, 그것도 없으면 null)
	 */
	getTileImage(tileId) {
		const tileData = this.findTileData(tileId);
		if (tileData !== null && tileData.image !== null) {
			return tileData.image;
		}
		return this.getImage();
	}

	//==============================================================================
	// 타일 하나의 그림 경로 설정. (읽은 파일에서 온 경로)
	//==============================================================================
	/**
	 * @param { number } tileId 타일 번호.
	 * @param { string } imagePath 그림 경로.
	 */
	setTileImagePath(tileId, imagePath) {
		const tileData = this.ensureTileData(tileId);
		tileData.imagePath = imagePath;
	}

	//==============================================================================
	// 타일 하나의 그림 경로 반환.
	//==============================================================================
	/**
	 * @param { number } tileId 타일 번호.
	 * @returns { string } 그림 경로. (없으면 빈 글)
	 */
	getTileImagePath(tileId) {
		const tileData = this.findTileData(tileId);
		if (tileData === null) {
			return "";
		}
		return tileData.imagePath;
	}

	//==============================================================================
	// 타일 하나의 그림 영역 설정. (격자 대신 그림 안의 이 영역을 쓴다)
	//==============================================================================
	/**
	 * @param { number } tileId 타일 번호.
	 * @param { Rect | null } imageRect 그림 안의 영역. (픽셀, null 이면 격자나 그림 전체, 복사해 둔다)
	 */
	setTileImageRect(tileId, imageRect) {
		const tileData = this.ensureTileData(tileId);
		if (imageRect === null || imageRect === undefined) {
			tileData.imageRect = null;
			return;
		}
		tileData.imageRect = Rect.create(imageRect.position.x, imageRect.position.y, imageRect.width, imageRect.height);
	}

	//==============================================================================
	// 타일 하나에 따로 건 그림 영역 반환.
	//==============================================================================
	/**
	 * @param { number } tileId 타일 번호.
	 * @returns { Rect | null } 따로 건 영역. (없으면 null)
	 */
	getTileImageRect(tileId) {
		const tileData = this.findTileData(tileId);
		if (tileData === null) {
			return null;
		}
		return tileData.imageRect;
	}

	//==============================================================================
	// 타일 하나를 그릴 그림 영역 셈하기.
	// - 따로 건 영역, 격자(열 수가 있으면), 그 타일 그림 전체의 차례로 고른다.
	//==============================================================================
	/**
	 * @param { number } tileId 타일 번호.
	 * @returns { Rect } 그림 안의 영역. (픽셀, 새 사각형, 알 수 없으면 0 크기)
	 */
	readTileImageRect(tileId) {
		const imageRect = this.getTileImageRect(tileId);
		if (imageRect !== null) {
			return Rect.create(imageRect.position.x, imageRect.position.y, imageRect.width, imageRect.height);
		}
		const tileData = this.findTileData(tileId);
		const columns = this.getColumns();
		if ((tileData === null || tileData.image === null) && columns > 0) {
			const tileWidth = this.getTileWidth();
			const tileHeight = this.getTileHeight();
			const margin = this.getMargin();
			const spacing = this.getSpacing();
			const column = tileId % columns;
			const row = System.Math.floor(tileId / columns);
			return Rect.create(margin + column * (tileWidth + spacing), margin + row * (tileHeight + spacing), tileWidth, tileHeight);
		}
		const image = this.getTileImage(tileId);
		if (image === null) {
			return Rect.zero();
		}
		return Rect.create(0, 0, image.width, image.height);
	}

	//==============================================================================
	// 타일 종류 설정. (Tiled 의 class, 언리얼의 user data name 같은 꼬리표)
	//==============================================================================
	/**
	 * @param { number } tileId 타일 번호.
	 * @param { string } type 종류 이름.
	 */
	setTileType(tileId, type) {
		const tileData = this.ensureTileData(tileId);
		tileData.type = type;
	}

	//==============================================================================
	// 타일 종류 반환.
	//==============================================================================
	/**
	 * @param { number } tileId 타일 번호.
	 * @returns { string } 종류 이름. (없으면 빈 글)
	 */
	getTileType(tileId) {
		const tileData = this.findTileData(tileId);
		if (tileData === null) {
			return "";
		}
		return tileData.type;
	}

	//==============================================================================
	// 타일 속성 설정.
	//==============================================================================
	/**
	 * @param { number } tileId 타일 번호.
	 * @param { string } name 속성 이름.
	 * @param { any } value 값.
	 */
	setTileProperty(tileId, name, value) {
		const tileData = this.ensureTileData(tileId);
		tileData.properties.set(name, value);
	}

	//==============================================================================
	// 타일 속성 반환.
	//==============================================================================
	/**
	 * @param { number } tileId 타일 번호.
	 * @param { string } name 속성 이름.
	 * @returns { any } 값. (없으면 null)
	 */
	getTileProperty(tileId, name) {
		const tileData = this.findTileData(tileId);
		if (tileData === null || !tileData.properties.has(name)) {
			return null;
		}
		return tileData.properties.get(name);
	}

	//==============================================================================
	// 타일 속성 모두 반환.
	//==============================================================================
	/**
	 * @param { number } tileId 타일 번호.
	 * @returns { Map<string, any> } 이름 → 값. (없으면 빈 표, 새로 만든 것은 타일셋에 남지 않는다)
	 */
	getTileProperties(tileId) {
		const tileData = this.findTileData(tileId);
		if (tileData === null) {
			return new System.Map();
		}
		return tileData.properties;
	}

	//==============================================================================
	// 타일 애니메이션 설정.
	//==============================================================================
	/**
	 * @param { number } tileId 타일 번호. (지도에 놓인 번호, 프레임마다 다른 타일로 바뀌어 보인다)
	 * @param { TileAnimationFrame[] } frameList 프레임 목록. (빈 배열이면 애니메이션을 끈다, 복사해 둔다)
	 */
	setTileAnimation(tileId, frameList) {
		const tileData = this.ensureTileData(tileId);
		tileData.animation = frameList.map((frame) => new TileAnimationFrame(frame.tileId, frame.duration));
	}

	//==============================================================================
	// 타일 애니메이션 반환.
	//==============================================================================
	/**
	 * @param { number } tileId 타일 번호.
	 * @returns { TileAnimationFrame[] } 프레임 목록. (없으면 빈 배열)
	 */
	getTileAnimation(tileId) {
		const tileData = this.findTileData(tileId);
		if (tileData === null) {
			return [];
		}
		// 사본. (고치려면 setTileAnimation, 러스트 판과 같다)
		return tileData.animation.map((frame) => new TileAnimationFrame(frame.tileId, frame.duration));
	}

	//==============================================================================
	// 시각에 보일 애니메이션 타일 번호 셈하기.
	// - 모든 칸이 같은 시계로 돈다. (Tiled 와 같다) 프레임 시간 합으로 나눈 나머지 시각이 든 프레임을 고른다.
	// - 애니메이션이 없으면 그 번호, 시간 합이 0 이하면 첫 프레임이다.
	//==============================================================================
	/**
	 * @param { number } tileId 타일 번호.
	 * @param { number } timeMilliseconds 시각. (밀리초, 음수도 된다)
	 * @returns { number } 보일 타일 번호.
	 */
	readAnimatedTileId(tileId, timeMilliseconds) {
		const frameList = this.getTileAnimation(tileId);
		if (frameList.length === 0) {
			return tileId;
		}
		let totalDuration = 0;
		for (const frame of frameList) {
			totalDuration += System.Math.max(0, frame.duration);
		}
		if (totalDuration <= 0) {
			return frameList[0].tileId;
		}
		let remainingTime = timeMilliseconds % totalDuration;
		if (remainingTime < 0) {
			remainingTime += totalDuration;
		}
		for (const frame of frameList) {
			const duration = System.Math.max(0, frame.duration);
			if (remainingTime < duration) {
				return frame.tileId;
			}
			remainingTime -= duration;
		}
		return frameList[frameList.length - 1].tileId;
	}

	//==============================================================================
	// 타일 충돌 모양 설정.
	//==============================================================================
	/**
	 * @param { number } tileId 타일 번호.
	 * @param { TileCollisionShape[] } shapeList 모양 목록. (타일 그림의 왼쪽 위가 원점인 픽셀 좌표, 복제해 둔다)
	 */
	setTileCollisionShapes(tileId, shapeList) {
		const tileData = this.ensureTileData(tileId);
		tileData.collisionShapes = shapeList.map((shape) => shape.clone());
	}

	//==============================================================================
	// 타일 충돌 모양 반환.
	//==============================================================================
	/**
	 * @param { number } tileId 타일 번호.
	 * @returns { TileCollisionShape[] } 모양 목록. (없으면 빈 배열)
	 */
	getTileCollisionShapes(tileId) {
		const tileData = this.findTileData(tileId);
		if (tileData === null) {
			return [];
		}
		// 사본. (고치려면 setTileCollisionShapes, 러스트 판과 같다)
		return tileData.collisionShapes.map((shape) => shape.clone());
	}

	//==============================================================================
	// 그릴 때 격자 밖으로 넘칠 수 있는 가장 큰 크기 셈하기. (화면 밖 거르기의 여유)
	// - 타일 크기, 따로 건 그림 영역과 그림 크기, 오프셋의 크기 중 가장 큰 것.
	//==============================================================================
	/**
	 * @returns { number } 가장 큰 크기. (픽셀)
	 */
	readMaximumTileExtent() {
		const tileWidth = this.getTileWidth();
		const tileHeight = this.getTileHeight();
		const tileOffset = this.getTileOffset();
		let maximumExtent = System.Math.max(tileWidth, tileHeight);
		const tileDataTable = this.getTileDataTable();
		for (const tileData of tileDataTable.values()) {
			if (tileData.imageRect !== null) {
				maximumExtent = System.Math.max(maximumExtent, tileData.imageRect.width, tileData.imageRect.height);
			}
			else if (tileData.image !== null) {
				maximumExtent = System.Math.max(maximumExtent, tileData.image.width, tileData.image.height);
			}
		}
		return maximumExtent + System.Math.abs(tileOffset.x) + System.Math.abs(tileOffset.y);
	}
}
