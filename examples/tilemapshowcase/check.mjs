//==============================================================================
// 타일맵 초안 값 검사. (node 로 돈다, 러스트 판 src/experimental/tilemap 의 시험과 같은 값을 본다)
// - 실행: node examples/tilemapshowcase/check.mjs
// - 맞지 않는 값이 있으면 그 이름을 찍고 끝 코드 1 로 끝난다. 다 맞으면 견준 값을 JSON 으로 찍는다.
//==============================================================================
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import * as Experimental from "../../src/experimental/experimental.js";
import { TransformMatrix } from "../../src/base/transformmatrix.js";

const System = globalThis;
const ASSET_DIRECTORY_PATH = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "assets");
const { Tileset, TileAnimationFrame, TileCollisionShape, TileCollisionShapeKind, TilemapLayer, Tilemap, TileFlag, TilemapOrientation, TilemapStaggerAxis, TilemapStaggerIndex, TilemapRenderMode, RuleTile, RuleTileNeighbor, RuleTileTransform, TiledMapReader } = Experimental;
const resultTable = {};
const failureList = [];

//==============================================================================
// 값 견주기. (수는 0.0001 안이면 같다)
//==============================================================================
function expectValue(name, actualValue, expectedValue) {
	resultTable[name] = actualValue;
	const actualText = JSON.stringify(actualValue, (key, value) => typeof value === "number" ? System.Math.round(value * 10000) / 10000 : value);
	const expectedText = JSON.stringify(expectedValue, (key, value) => typeof value === "number" ? System.Math.round(value * 10000) / 10000 : value);
	if (actualText !== expectedText) {
		failureList.push(name + ": " + actualText + " != " + expectedText);
	}
}

// 모양을 견줄 수 있는 값으로.
function describeShape(shape) {
	return { kind: shape.kind, x: shape.x, y: shape.y, width: shape.width, height: shape.height, rotation: shape.rotation, points: shape.points.map((point) => [point.x, point.y]) };
}

//==============================================================================
// 시험용 Graphic. (화면 사각형 [0, 320] x [0, 180] 에 걸치는지 보고, 그린 것을 센다)
//==============================================================================
class FakeGraphic {
	constructor() {
		this.vertexData = new System.Float32Array(4096 * 4);
		this.translateX = 0;
		this.translateY = 0;
		this.stateStack = [];
		this.drawCallCount = 0;
		this.vertexCount = 0;
		this.firstVertexList = null;
	}
	getVertexData() { return this.vertexData; }
	pushState() { this.stateStack.push([this.translateX, this.translateY]); }
	popState() { const state = this.stateStack.pop(); this.translateX = state[0]; this.translateY = state[1]; }
	translate(x, y) { this.translateX += x; this.translateY += y; }
	setBlendMode() {}
	isImageSmoothingEnabled() { return false; }
	isImageMipmapEnabled() { return false; }
	getImageTextureCache() { return { getTexture: (image) => image }; }
	isLocalRectVisible(rect) {
		const left = rect.position.x + this.translateX;
		const top = rect.position.y + this.translateY;
		return left + rect.size.x >= 0 && top + rect.size.y >= 0 && left <= 320 && top <= 180;
	}
	drawVertices(vertexCount) {
		if (this.firstVertexList === null) {
			this.firstVertexList = System.Array.from(this.vertexData.slice(0, 24));
		}
		this.drawCallCount += 1;
		this.vertexCount += vertexCount;
	}
}

// 1. 타일셋 격자.
const tileset = new Tileset();
tileset.setTileSize(16, 16);
tileset.setMargin(1);
tileset.setSpacing(2);
tileset.fitGridToImageSize(144, 54);
const imageRect = tileset.readTileImageRect(21);
expectValue("tilesetGrid", [tileset.getColumns(), tileset.getTileCount(), imageRect.position.x, imageRect.position.y, imageRect.width, imageRect.height], [8, 24, 91, 37, 16, 16]);

// 2. 애니메이션 시각.
tileset.setTileAnimation(3, [new TileAnimationFrame(3, 180), new TileAnimationFrame(4, 180), new TileAnimationFrame(5, 180), new TileAnimationFrame(6, 180)]);
expectValue("animation", [0, 179, 180, 719, 720, -1, 1000000].map((time) => tileset.readAnimatedTileId(3, time)), [3, 3, 4, 6, 3, 6, 6]);
expectValue("animationNone", tileset.readAnimatedTileId(9, 500), 9);

// 3. 뒤집기와 돌리기 비트.
const rotatedList = [0, 1, 2, 3, 4, -1].map((turnCount) => Tilemap.rotateTile(5, turnCount) >>> 0);
expectValue("rotateTile", rotatedList, [5, (5 | TileFlag.diagonalFlip | TileFlag.horizontalFlip) >>> 0, (5 | TileFlag.horizontalFlip | TileFlag.verticalFlip) >>> 0, (5 | TileFlag.diagonalFlip | TileFlag.verticalFlip) >>> 0, 5, (5 | TileFlag.diagonalFlip | TileFlag.verticalFlip) >>> 0]);
expectValue("flipAfterRotate", [Tilemap.flipTileHorizontally(Tilemap.rotateTile(5, 1)) >>> 0, Tilemap.flipTileVertically(5) >>> 0, Tilemap.readTileId(0xE0000007), Tilemap.readTileFlags(0x90000007) >>> 0], [(5 | TileFlag.diagonalFlip) >>> 0, (5 | TileFlag.verticalFlip) >>> 0, 7, 0x90000000]);

// 4 ~ 7. 좌표 바꾸기.
const orthogonalMap = new Tilemap();
orthogonalMap.setTileSize(16, 16);
orthogonalMap.setMapSize(18, 12);
const orthogonalPosition = orthogonalMap.cellToMapPosition(3, 2);
const orthogonalCell = orthogonalMap.mapPositionToCell(-1, -1);
const orthogonalSize = orthogonalMap.readMapPixelSize();
expectValue("orthogonal", [orthogonalPosition.x, orthogonalPosition.y, orthogonalCell.column, orthogonalCell.row, orthogonalSize.x, orthogonalSize.y], [48, 32, -1, -1, 288, 192]);

const isometricMap = new Tilemap();
isometricMap.setOrientation(TilemapOrientation.isometric);
isometricMap.setTileSize(64, 32);
isometricMap.setMapSize(10, 10);
const isometricPosition = isometricMap.cellToMapPosition(2, 3);
const isometricCenter = isometricMap.cellToMapCenter(2, 3);
const isometricCell = isometricMap.mapPositionToCell(isometricCenter.x, isometricCenter.y);
const isometricEdgeCell = isometricMap.mapPositionToCell(320, 1);
const isometricSize = isometricMap.readMapPixelSize();
expectValue("isometric", [isometricPosition.x, isometricPosition.y, isometricCenter.x, isometricCenter.y, isometricCell.column, isometricCell.row, isometricEdgeCell.column, isometricEdgeCell.row, isometricSize.x, isometricSize.y], [256, 80, 288, 96, 2, 3, 0, 0, 640, 320]);

const hexagonalMap = new Tilemap();
hexagonalMap.setOrientation(TilemapOrientation.hexagonal);
hexagonalMap.setTileSize(32, 32);
hexagonalMap.setHexSideLength(16);
hexagonalMap.setMapSize(8, 6);
const hexagonalPosition = hexagonalMap.cellToMapPosition(1, 1);
const hexagonalCenter = hexagonalMap.cellToMapCenter(1, 1);
const hexagonalCell = hexagonalMap.mapPositionToCell(hexagonalCenter.x, hexagonalCenter.y);
const hexagonalCornerCell = hexagonalMap.mapPositionToCell(1, 1);
const hexagonalSize = hexagonalMap.readMapPixelSize();
expectValue("hexagonalY", [hexagonalPosition.x, hexagonalPosition.y, hexagonalCenter.x, hexagonalCenter.y, hexagonalCell.column, hexagonalCell.row, hexagonalCornerCell.column, hexagonalCornerCell.row, hexagonalSize.x, hexagonalSize.y], [48, 24, 64, 40, 1, 1, -1, -1, 272, 152]);
hexagonalMap.setStaggerAxis(TilemapStaggerAxis.x);
hexagonalMap.setStaggerIndex(TilemapStaggerIndex.even);
const hexagonalXPosition = hexagonalMap.cellToMapPosition(2, 1);
const hexagonalXCenter = hexagonalMap.cellToMapCenter(3, 2);
const hexagonalXCell = hexagonalMap.mapPositionToCell(hexagonalXCenter.x, hexagonalXCenter.y);
const hexagonalXSize = hexagonalMap.readMapPixelSize();
expectValue("hexagonalX", [hexagonalXPosition.x, hexagonalXPosition.y, hexagonalXCenter.x, hexagonalXCenter.y, hexagonalXCell.column, hexagonalXCell.row, hexagonalXSize.x, hexagonalXSize.y], [48, 48, 88, 80, 3, 2, 200, 208]);

const staggeredMap = new Tilemap();
staggeredMap.setOrientation(TilemapOrientation.staggered);
staggeredMap.setTileSize(64, 32);
staggeredMap.setMapSize(6, 8);
const staggeredPosition = staggeredMap.cellToMapPosition(1, 1);
const staggeredCenter = staggeredMap.cellToMapCenter(1, 1);
const staggeredCell = staggeredMap.mapPositionToCell(staggeredCenter.x, staggeredCenter.y);
const staggeredCornerCell = staggeredMap.mapPositionToCell(1, 1);
const staggeredRightCell = staggeredMap.mapPositionToCell(63, 31);
const staggeredSize = staggeredMap.readMapPixelSize();
expectValue("staggered", [staggeredPosition.x, staggeredPosition.y, staggeredCenter.x, staggeredCenter.y, staggeredCell.column, staggeredCell.row, staggeredCornerCell.column, staggeredCornerCell.row, staggeredRightCell.column, staggeredRightCell.row, staggeredSize.x, staggeredSize.y], [96, 16, 128, 32, 1, 1, -1, -1, 0, 1, 416, 144]);

// 8. 덩이 거르기와 묶어 그리기.
const fakeImage = { width: 144, height: 54 };
const drawTileset = Tileset.createGrid(fakeImage, 16, 16, 1, 2);
const drawMap = new Tilemap();
drawMap.setTileSize(16, 16);
drawMap.addTileset(drawTileset);
const drawLayer = drawMap.createLayer("ground");
for (let row = 0; row < 4; ++row) {
	for (let column = 0; column < 4; ++column) {
		drawLayer.setTile(column, row, 1);
	}
}
drawLayer.setTile(100, 100, 2);
drawLayer.setTile(-40, 3, 2);
const firstGraphic = new FakeGraphic();
drawMap.draw(firstGraphic);
expectValue("culling", [drawLayer.getChunkList().length, drawMap.getLastDrawnChunkCount(), drawMap.getLastCulledChunkCount(), firstGraphic.drawCallCount, firstGraphic.vertexCount], [3, 1, 2, 1, 96]);
drawMap.setRenderMode(TilemapRenderMode.individual);
const individualGraphic = new FakeGraphic();
drawMap.draw(individualGraphic);
expectValue("cullingIndividual", [drawMap.getLastDrawnChunkCount(), individualGraphic.drawCallCount, individualGraphic.vertexCount], [1, 1, 96]);
// 대각 + 좌우 뒤집기(시계 방향 90 도) 칸 하나의 꼭짓점. (왼쪽 위, 오른쪽 위, 왼쪽 아래 와 UV)
const rotatedMap = new Tilemap();
rotatedMap.setTileSize(16, 16);
rotatedMap.addTileset(drawTileset);
const rotatedLayer = rotatedMap.createLayer("rotated");
rotatedLayer.setTile(2, 1, Tilemap.rotateTile(11, 1));
const rotatedGraphic = new FakeGraphic();
rotatedMap.draw(rotatedGraphic);
expectValue("rotatedQuad", rotatedGraphic.firstVertexList.slice(0, 12), [48, 16, 37 / 144, 19 / 54, 48, 32, 53 / 144, 19 / 54, 32, 16, 37 / 144, 35 / 54]);

// 9 ~ 10. 충돌 모양.
const collisionTileset = new Tileset();
collisionTileset.setTileSize(16, 16);
collisionTileset.setColumns(8);
collisionTileset.setTileCount(24);
collisionTileset.setTileCollisionShapes(11, [TileCollisionShape.createRectangle(0, 5, 16, 7)]);
collisionTileset.setTileCollisionShapes(12, [TileCollisionShape.createPolygon(0, 16, [{ x: 0, y: 0 }, { x: 16, y: -16 }, { x: 16, y: 0 }])]);
const ellipseShape = TileCollisionShape.createEllipse(2, 3, 12, 6);
ellipseShape.rotation = 30;
collisionTileset.setTileCollisionShapes(9, [ellipseShape]);
const collisionMap = new Tilemap();
collisionMap.setTileSize(16, 16);
collisionMap.addTileset(collisionTileset);
const collisionLayer = collisionMap.createLayer("walls");
collisionLayer.setOffset({ x: 4, y: -2 });
collisionLayer.setTile(2, 3, Tilemap.rotateTile(12, 1));
collisionLayer.setTile(5, 0, (13 | TileFlag.horizontalFlip) >>> 0);
collisionLayer.setTile(7, 1, (10 | TileFlag.verticalFlip) >>> 0);
expectValue("collisionRotated", collisionMap.readCellCollisionShapes(0, 2, 3).map(describeShape), [{ kind: "rectangle", x: 40, y: 46, width: 7, height: 16, rotation: 0, points: [] }]);
expectValue("collisionFlippedPolygon", collisionMap.readCellCollisionShapes(0, 5, 0).map(describeShape), [{ kind: "polygon", x: 100, y: 14, width: 0, height: 0, rotation: 0, points: [[0, 0], [-16, -16], [-16, 0]] }]);
expectValue("collisionFlippedEllipse", collisionMap.readCellCollisionShapes(0, 7, 1).map(describeShape), [{ kind: "ellipse", x: 128.3923, y: 21, width: 12, height: 6, rotation: 150, points: [] }]);
expectValue("collisionLayer", collisionMap.readLayerCollisionShapes(0).length, 3);
const pointShape = TileCollisionShape.createPoint(3, 4);
const pointMatrix = new TransformMatrix();
pointMatrix.translate(10, 20);
pointMatrix.scale(2, 3);
expectValue("collisionPoint", describeShape(pointShape.createTransformed(pointMatrix)), { kind: "point", x: 16, y: 32, width: 0, height: 0, rotation: 0, points: [] });

// 11. 자동 타일.
const any = RuleTileNeighbor.any;
const same = RuleTileNeighbor.this;
const other = RuleTileNeighbor.notThis;
const roadTile = new RuleTile(17);
roadTile.addRule([any, same, any, same, same, any, same, any], 22, RuleTileTransform.fixed);
roadTile.addRule([any, other, any, same, same, any, same, any], 21, RuleTileTransform.rotated);
roadTile.addRule([any, other, any, same, same, any, other, any], 19, RuleTileTransform.rotated);
roadTile.addRule([any, other, any, other, same, any, same, any], 20, RuleTileTransform.rotated);
roadTile.addRule([any, other, any, other, same, any, other, any], 18, RuleTileTransform.rotated);
const roadLayer = new TilemapLayer("road");
for (const [column, row] of [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2], [3, 3]]) {
	roadTile.paint(roadLayer, column, row);
}
expectValue("ruleTile", [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2], [3, 3]].map(([column, row]) => roadLayer.getTile(column, row) >>> 0), [18, 21, (18 | TileFlag.horizontalFlip | TileFlag.verticalFlip) >>> 0, (19 | TileFlag.diagonalFlip | TileFlag.horizontalFlip) >>> 0, (18 | TileFlag.diagonalFlip | TileFlag.verticalFlip) >>> 0, 17]);
roadTile.erase(roadLayer, 1, 1);
expectValue("ruleTileErase", [roadLayer.getTile(1, 0) >>> 0, roadLayer.getTile(1, 2) >>> 0], [19, 17]);
const mirrorTile = new RuleTile(1);
mirrorTile.addRule([any, any, any, any, same, any, any, any], 2, RuleTileTransform.mirrorX);
const isWall = (column, row) => row === 0 && column >= 0 && column <= 1;
expectValue("ruleTileMirror", [mirrorTile.resolveTile(isWall, 0, 0) >>> 0, mirrorTile.resolveTile(isWall, 1, 0) >>> 0, mirrorTile.resolveTile(isWall, 5, 5) >>> 0], [2, (2 | TileFlag.horizontalFlip) >>> 0, 1]);

// 12. Tiled JSON 읽기.
const readJson = (fileName) => JSON.parse(fs.readFileSync(path.join(ASSET_DIRECTORY_PATH, fileName), "utf8"));
const readTileset = (tilesetPath) => readJson(path.basename(tilesetPath));
const orthogonalTilemap = new Tilemap();
const orthogonalTiledMap = await TiledMapReader.readMap(readJson("orthogonal.tmj"), orthogonalTilemap, "assets/orthogonal.tmj", readTileset);
const highlightLayer = orthogonalTilemap.getLayer(2);
const highlightColor = highlightLayer.getColor();
const propsTileset = orthogonalTilemap.getTileset(2);
expectValue("readOrthogonal", [
	orthogonalTilemap.getLayerCount(),
	orthogonalTilemap.getTilesets().length,
	[0, 1, 2].map((tilesetIndex) => orthogonalTilemap.getTilesetFirstGid(tilesetIndex)),
	orthogonalTilemap.getLayer(0).getTile(13, 7),
	orthogonalTilemap.getLayer(1).getTile(2, 2) >>> 0,
	orthogonalTilemap.getLayer(1).getProperty("isSolid"),
	[highlightLayer.getName(), highlightLayer.getOpacity(), highlightColor.red, highlightColor.green, highlightColor.blue, highlightColor.alpha],
	orthogonalTilemap.getTileset(0).readAnimatedTileId(3, 200),
	orthogonalTilemap.getTileset(0).getTileType(7),
	propsTileset.getTileImagePath(0),
	propsTileset.getTileProperty(0, "gold"),
	orthogonalTiledMap.properties.get("title"),
	orthogonalTiledMap.objectLayers[0].objects.map((tiledObject) => [tiledObject.name, tiledObject.shape.kind, tiledObject.shape.x, tiledObject.shape.y]),
	TiledMapReader.collectImagePaths(orthogonalTilemap),
], [
	3, 3, [1, 25, 27], 4, (11 | TileFlag.diagonalFlip | TileFlag.horizontalFlip) >>> 0, true,
	["highlight", 0.6, 1, 128 / 255, 192 / 255, 1],
	4, "wall", "assets/chest.png", 30, "meadow",
	[["player", "point", 40, 104], ["pond", "ellipse", 168, 80]],
	["assets/terrain.png", "assets/trees.png", "assets/chest.png", "assets/sign.png"],
]);
const isometricTilemap = new Tilemap();
await TiledMapReader.readMap(readJson("isometric.tmj"), isometricTilemap, "assets/isometric.tmj", readTileset);
expectValue("readIsometric", [isometricTilemap.getOrientation(), isometricTilemap.getLayer(0).getTile(3, 0), isometricTilemap.getLayer(0).getTile(6, 6), isometricTilemap.getLayer(1).getTile(0, 5), isometricTilemap.getTileset(0).readAnimatedTileId(1, 500)], ["isometric", 8, 2, 4, 2]);
const hexagonalTilemap = new Tilemap();
await TiledMapReader.readMap(readJson("hexagonal.tmj"), hexagonalTilemap, "assets/hexagonal.tmj", readTileset);
const hexagonalLayer = hexagonalTilemap.getLayer(0);
const hexagonalBounds = hexagonalLayer.readCellBounds();
expectValue("readHexagonal", [hexagonalTilemap.getOrientation(), hexagonalTilemap.getHexSideLength(), hexagonalTilemap.getStaggerAxis(), hexagonalLayer.getTileCount(), hexagonalBounds.width, hexagonalBounds.height, hexagonalLayer.getTile(4, 1) >>> 0], ["hexagonal", 16, "y", 48, 8, 6, (6 | TileFlag.diagonalFlip | TileFlag.hexagonalRotation120) >>> 0]);
expectValue("parseColor", [TiledMapReader.parseColor("#80ff0000").alpha, TiledMapReader.parseColor("00ff00").green, TiledMapReader.parseColor("nope")], [128 / 255, 1, null]);
expectValue("resolvePath", [TiledMapReader.resolvePath("maps/world/level.tmj", "../tiles/a.png"), TiledMapReader.resolvePath("", "./a.tsj"), TiledMapReader.resolvePath("a/b.tmj", "/abs/c.png"), TiledMapReader.resolvePath("a/b.tmj", "../../c.png")], ["maps/tiles/a.png", "a.tsj", "/abs/c.png", "../c.png"]);
let zstdMessage = "";
try {
	await TiledMapReader.readLayerData("AAAA", "base64", "zstd", 1);
}
catch (error) {
	zstdMessage = error.message;
}
expectValue("zstd", zstdMessage, "TiledMapReader: unsupported compression zstd");

if (failureList.length > 0) {
	console.log(failureList.join("\n"));
	System.process.exit(1);
}
console.log(JSON.stringify(resultTable));
console.log("tilemap check: " + System.Object.keys(resultTable).length + " groups passed");
