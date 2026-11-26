//==============================================================================
// 포함 모듈 목록.
//==============================================================================
// 옮긴 원문: libtiled 의 렌더러 셈에서 옮김, BSD-2-Clause, THIRD_PARTY_LICENSES.md
const System = globalThis;
import { Vector2 } from "../../base/vector2.js";
import { Rect } from "../../base/rect.js";
import { Color } from "../../base/color.js";
import { TransformMatrix } from "../../base/transformmatrix.js";
import { Component } from "../../core/component.js";
import { Tileset, TileRenderSize, TileFillMode, TileCollisionShape } from "./tileset.js";
import { TilemapLayer, DEFAULT_CHUNK_SIZE } from "./tilemaplayer.js";


//==============================================================================
// 타일맵.
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 노드에 붙는 컴포넌트다. 노드 내용 영역의 왼쪽 위가 지도의 (0, 0) 이고, 층(TilemapLayer)을 넣은 차례로 그린다.
// - 배치는 정사각(orthogonal), 아이소메트릭(isometric, 마름모), 엇갈림(staggered, 엇갈린 아이소), 육각(hexagonal) 넷이다.
//   좌표 바꾸기, 그리는 차례, 타일 그림 정렬(칸의 왼쪽 아래), 뒤집기와 돌리기는 Tiled 렌더러(libtiled)와 같은 셈을 쓴다.
// - 층의 덩이(chunk)마다 화면에 걸치는지 보고 걸치지 않으면 통째로 건너뛴다. 걸친 덩이는 같은 그림을 쓰는 타일을 꼭짓점 버퍼에 이어 적어
//   그림이 바뀌거나 버퍼가 찰 때만 Graphic.drawVertices 한 번으로 그린다. (유니티 TilemapRenderer 의 Chunk 모드)
//   Individual 모드는 덩이를 넘어 지도 전체의 칸 차례로 그린다. (큰 타일이 이웃 덩이와 겹칠 때의 차례가 정확하다)
// - 타일 애니메이션은 tick 이 흘리는 시계 하나로 모든 칸이 같이 돈다. (Tiled 와 같다)
// - 충돌 모양은 물리에 기대지 않는다. readCellCollisionShapes 가 칸마다 뒤집기, 돌리기, 오프셋을 건 지도 좌표 모양(TileCollisionShape)을 돌려준다.
//==============================================================================
/**
 * @example <caption>코드로 만든 작은 정사각 타일맵</caption>
 * import { Engine, EngineConfiguration, Scene, WorldNode, Vector2, ImageAsset } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * class MainScene extends Scene {
 * 	async load(engine) {
 * 		await super.load(engine);
 * 		const imageAsset = new ImageAsset();
 * 		await imageAsset.load("examples/tilemapshowcase/assets/terrain.png");
 * 		const mapNode = new WorldNode();
 * 		mapNode.setLocalPosition(Vector2.create(160, 100));
 * 		mapNode.setLocalScale(Vector2.create(2, 2));
 * 		const tilemap = mapNode.addComponent(Experimental.Tilemap);
 * 		tilemap.setTileSize(16, 16);
 * 		tilemap.addTileset(Experimental.Tileset.createGrid(imageAsset, 16, 16, 1, 2));
 * 		const layer = tilemap.createLayer("ground");
 * 		for (let row = 0; row < 6; ++row) {
 * 			for (let column = 0; column < 10; ++column) {
 * 				layer.setTile(column, row, 1);
 * 			}
 * 		}
 * 		const rotatedTile = Experimental.Tilemap.rotateTile(3, 1);
 * 		layer.setTile(4, 2, rotatedTile);
 * 		const root = this.getRoot();
 * 		root.addChild(mapNode);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const TILE_ID_MASK = 0x0FFFFFFF; // 타일 값에서 gid 만 남기는 비트.
const TILE_FLAG_BITS = 0xF0000000; // 타일 값에서 뒤집기와 돌리기 비트.
const FLOATS_PER_VERTEX = 4; // 꼭짓점 하나의 수 개수. (x, y, u, v, Graphic 과 같다)
const FLOATS_PER_QUAD = 24; // 쿼드 하나(삼각형 둘, 꼭짓점 여섯)의 수 개수.


//==============================================================================
// 타일 값의 뒤집기와 돌리기 비트. (Tiled 전역 타일 번호의 위 4 비트, 언리얼 PaperTileInfo 의 flip_h, flip_v, flip_d)
// - 정사각과 아이소: 대각 뒤집기(x, y 바꾸기)를 먼저 하고 좌우, 상하 뒤집기를 한다. 시계 방향 90 도는 대각 + 좌우다.
// - 육각: diagonalFlip 이 시계 방향 60 도, hexagonalRotation120 이 120 도 돌리기다.
//==============================================================================
export const TileFlag = {
	horizontalFlip: 0x80000000, // 좌우 뒤집기.
	verticalFlip: 0x40000000, // 상하 뒤집기.
	diagonalFlip: 0x20000000, // 대각 뒤집기. (육각은 60 도 돌리기)
	hexagonalRotation120: 0x10000000, // 육각 120 도 돌리기. (그 밖의 배치에서는 쓰지 않는다)
};


//==============================================================================
// 타일맵 배치.
//==============================================================================
export const TilemapOrientation = {
	orthogonal: "orthogonal", // 정사각 격자.
	isometric: "isometric", // 마름모 아이소메트릭. (지도 전체가 마름모)
	staggered: "staggered", // 엇갈린 아이소메트릭. (지도 전체가 네모, 한 줄씩 반 칸 엇갈린다)
	hexagonal: "hexagonal", // 엇갈린 육각.
};


//==============================================================================
// 엇갈리는 축. (엇갈림, 육각)
//==============================================================================
export const TilemapStaggerAxis = {
	x: "x", // 열이 위아래로 반 칸 엇갈린다. (꼭대기가 평평한 육각)
	y: "y", // 행이 좌우로 반 칸 엇갈린다. (꼭대기가 뾰족한 육각)
};


//==============================================================================
// 엇갈리는 줄. (엇갈림, 육각)
//==============================================================================
export const TilemapStaggerIndex = {
	odd: "odd", // 홀수 줄이 밀린다.
	even: "even", // 짝수 줄이 밀린다.
};


//==============================================================================
// 정사각 배치의 그리는 차례. (Tiled renderorder, 유니티 TilemapRenderer.sortOrder)
//==============================================================================
export const TilemapRenderOrder = {
	rightDown: "right-down", // 위 행부터, 행마다 왼쪽에서 오른쪽.
	rightUp: "right-up", // 아래 행부터, 행마다 왼쪽에서 오른쪽.
	leftDown: "left-down", // 위 행부터, 행마다 오른쪽에서 왼쪽.
	leftUp: "left-up", // 아래 행부터, 행마다 오른쪽에서 왼쪽.
};


//==============================================================================
// 그리는 방식. (유니티 TilemapRenderer.Mode)
//==============================================================================
export const TilemapRenderMode = {
	chunk: "chunk", // 덩이마다 묶어 그린다. (빠르다, 덩이 경계를 넘어 겹치는 큰 타일의 차례는 덩이 차례를 따른다)
	individual: "individual", // 지도 전체의 칸 차례로 그린다. (화면 밖 덩이는 그대로 거른다)
};


//==============================================================================
// 배치 셈에 쓰는 값 모으기. (Tiled HexagonalRenderer::RenderParams 를 함께 셈한다)
//==============================================================================
/**
 * @private
 * @param { Tilemap } tilemap
 * @returns { object }
 */
function createTilemapLayout(tilemap) {
	const orientation = tilemap.getOrientation();
	const tileWidth = tilemap.getTileWidth();
	const tileHeight = tilemap.getTileHeight();
	const hexSideLength = tilemap.getHexSideLength();
	const staggerAxis = tilemap.getStaggerAxis();
	const staggerIndex = tilemap.getStaggerIndex();
	const rowCount = tilemap.getRowCount();
	const isStaggerX = staggerAxis === TilemapStaggerAxis.x;
	let sideLengthX = 0;
	let sideLengthY = 0;
	if (orientation === TilemapOrientation.hexagonal) {
		if (isStaggerX) {
			sideLengthX = hexSideLength;
		}
		else {
			sideLengthY = hexSideLength;
		}
	}
	const sideOffsetX = System.Math.trunc((tileWidth - sideLengthX) / 2);
	const sideOffsetY = System.Math.trunc((tileHeight - sideLengthY) / 2);
	const columnWidth = sideOffsetX + sideLengthX;
	const rowHeight = sideOffsetY + sideLengthY;
	return {
		orientation: orientation,
		tileWidth: tileWidth,
		tileHeight: tileHeight,
		renderOrder: tilemap.getRenderOrder(),
		originX: System.Math.trunc(rowCount * tileWidth / 2),
		halfTileWidth: System.Math.trunc(tileWidth / 2),
		isStaggerX: isStaggerX,
		isStaggerEven: staggerIndex === TilemapStaggerIndex.even,
		sideLengthX: sideLengthX,
		sideLengthY: sideLengthY,
		sideOffsetX: sideOffsetX,
		sideOffsetY: sideOffsetY,
		columnWidth: columnWidth,
		rowHeight: rowHeight,
		hexagonTileWidth: columnWidth + sideOffsetX,
		hexagonTileHeight: rowHeight + sideOffsetY,
	};
}

//==============================================================================
// 엇갈린 줄인지. (Tiled doStaggerX, doStaggerY)
//==============================================================================
/**
 * @private
 * @param { object } layout
 * @param { number } index 엇갈리는 축의 줄 번호.
 * @returns { boolean }
 */
function isStaggeredIndex(layout, index) {
	const isOdd = (index & 1) !== 0;
	return isOdd !== layout.isStaggerEven;
}

//==============================================================================
// 칸을 감싸는 사각형의 왼쪽 위 X. (지도 좌표)
//==============================================================================
/**
 * @private
 * @param { object } layout
 * @param { number } column
 * @param { number } row
 * @returns { number }
 */
function readCellLeft(layout, column, row) {
	switch (layout.orientation) {
		case TilemapOrientation.isometric: {
				return (column - row) * layout.tileWidth / 2 + layout.originX - layout.halfTileWidth;
			}
		case TilemapOrientation.staggered:
		case TilemapOrientation.hexagonal: {
				if (layout.isStaggerX) {
					return column * layout.columnWidth;
				}
				let left = column * (layout.hexagonTileWidth + layout.sideLengthX);
				if (isStaggeredIndex(layout, row)) {
					left += layout.columnWidth;
				}
				return left;
			}
		default: {
				return column * layout.tileWidth;
			}
	}
}

//==============================================================================
// 칸을 감싸는 사각형의 왼쪽 위 Y. (지도 좌표)
//==============================================================================
/**
 * @private
 * @param { object } layout
 * @param { number } column
 * @param { number } row
 * @returns { number }
 */
function readCellTop(layout, column, row) {
	switch (layout.orientation) {
		case TilemapOrientation.isometric: {
				return (column + row) * layout.tileHeight / 2;
			}
		case TilemapOrientation.staggered:
		case TilemapOrientation.hexagonal: {
				if (!layout.isStaggerX) {
					return row * layout.rowHeight;
				}
				let top = row * (layout.hexagonTileHeight + layout.sideLengthY);
				if (isStaggeredIndex(layout, column)) {
					top += layout.rowHeight;
				}
				return top;
			}
		default: {
				return row * layout.tileHeight;
			}
	}
}

//==============================================================================
// 칸을 감싸는 사각형의 너비.
//==============================================================================
/**
 * @private
 * @param { object } layout
 * @returns { number }
 */
function readCellWidth(layout) {
	if (layout.orientation === TilemapOrientation.staggered || layout.orientation === TilemapOrientation.hexagonal) {
		return layout.hexagonTileWidth;
	}
	return layout.tileWidth;
}

//==============================================================================
// 칸을 감싸는 사각형의 높이.
//==============================================================================
/**
 * @private
 * @param { object } layout
 * @returns { number }
 */
function readCellHeight(layout) {
	if (layout.orientation === TilemapOrientation.staggered || layout.orientation === TilemapOrientation.hexagonal) {
		return layout.hexagonTileHeight;
	}
	return layout.tileHeight;
}

//==============================================================================
// 칸 범위를 감싸는 사각형 셈하기. (Tiled MapRenderer::boundingRect, 지도 좌표)
//==============================================================================
/**
 * @private
 * @param { object } layout
 * @param { number } column
 * @param { number } row
 * @param { number } columnCount
 * @param { number } rowCount
 * @param { Rect } targetRect
 */
function writeCellRangeBounds(layout, column, row, columnCount, rowCount, targetRect) {
	switch (layout.orientation) {
		case TilemapOrientation.isometric: {
				const side = columnCount + rowCount;
				targetRect.position.set((column - (row + rowCount)) * layout.tileWidth / 2 + layout.originX, (column + row) * layout.tileHeight / 2);
				targetRect.size.set(side * layout.tileWidth / 2, side * layout.tileHeight / 2);
				break;
			}
		case TilemapOrientation.staggered:
		case TilemapOrientation.hexagonal: {
				let left = readCellLeft(layout, column, row);
				let top = readCellTop(layout, column, row);
				let width = 0;
				let height = 0;
				if (layout.isStaggerX) {
					width = columnCount * layout.columnWidth + layout.sideOffsetX;
					height = rowCount * (layout.hexagonTileHeight + layout.sideLengthY);
					if (columnCount > 1) {
						height += layout.rowHeight;
						if (isStaggeredIndex(layout, column)) {
							top -= layout.rowHeight;
						}
					}
				}
				else {
					width = columnCount * (layout.hexagonTileWidth + layout.sideLengthX);
					height = rowCount * layout.rowHeight + layout.sideOffsetY;
					if (rowCount > 1) {
						width += layout.columnWidth;
						if (isStaggeredIndex(layout, row)) {
							left -= layout.columnWidth;
						}
					}
				}
				targetRect.position.set(left, top);
				targetRect.size.set(width, height);
				break;
			}
		default: {
				targetRect.position.set(column * layout.tileWidth, row * layout.tileHeight);
				targetRect.size.set(columnCount * layout.tileWidth, rowCount * layout.tileHeight);
				break;
			}
	}
}

//==============================================================================
// 칸 범위를 그리는 차례로 돌기. (Tiled 렌더러의 drawTileLayer 차례)
// - 정사각: 그리는 차례(renderorder)대로. 아이소: 화면 줄(열 + 행)마다 왼쪽에서 오른쪽.
// - 엇갈림, 육각: 행마다. X 축으로 엇갈리면 그 행의 밀리지 않은 열을 먼저, 밀린 열을 나중에 그린다.
//==============================================================================
/**
 * @private
 * @param { object } layout
 * @param { number } column
 * @param { number } row
 * @param { number } columnCount
 * @param { number } rowCount
 * @param { Function } visitHandler (column, row) => void
 */
function visitCellsInDrawOrder(layout, column, row, columnCount, rowCount, visitHandler) {
	const lastColumn = column + columnCount - 1;
	const lastRow = row + rowCount - 1;
	switch (layout.orientation) {
		case TilemapOrientation.isometric: {
				for (let diagonal = column + row; diagonal <= lastColumn + lastRow; ++diagonal) {
					const firstDiagonalColumn = System.Math.max(column, diagonal - lastRow);
					const lastDiagonalColumn = System.Math.min(lastColumn, diagonal - row);
					for (let diagonalColumn = firstDiagonalColumn; diagonalColumn <= lastDiagonalColumn; ++diagonalColumn) {
						visitHandler(diagonalColumn, diagonal - diagonalColumn);
					}
				}
				break;
			}
		case TilemapOrientation.staggered:
		case TilemapOrientation.hexagonal: {
				for (let visitRow = row; visitRow <= lastRow; ++visitRow) {
					if (!layout.isStaggerX) {
						for (let visitColumn = column; visitColumn <= lastColumn; ++visitColumn) {
							visitHandler(visitColumn, visitRow);
						}
						continue;
					}
					for (let visitColumn = column; visitColumn <= lastColumn; ++visitColumn) {
						if (!isStaggeredIndex(layout, visitColumn)) {
							visitHandler(visitColumn, visitRow);
						}
					}
					for (let visitColumn = column; visitColumn <= lastColumn; ++visitColumn) {
						if (isStaggeredIndex(layout, visitColumn)) {
							visitHandler(visitColumn, visitRow);
						}
					}
				}
				break;
			}
		default: {
				const isUp = layout.renderOrder === TilemapRenderOrder.rightUp || layout.renderOrder === TilemapRenderOrder.leftUp;
				const isLeft = layout.renderOrder === TilemapRenderOrder.leftDown || layout.renderOrder === TilemapRenderOrder.leftUp;
				for (let rowStep = 0; rowStep < rowCount; ++rowStep) {
					const visitRow = isUp ? lastRow - rowStep : row + rowStep;
					for (let columnStep = 0; columnStep < columnCount; ++columnStep) {
						const visitColumn = isLeft ? lastColumn - columnStep : column + columnStep;
						visitHandler(visitColumn, visitRow);
					}
				}
				break;
			}
	}
}

//==============================================================================
// 덩이를 그리는 차례로 늘어놓기. (덩이 단위의 열, 행을 칸처럼 본다)
//==============================================================================
/**
 * @private
 * @param { object } layout
 * @param { object[] } chunkList 덩이 목록. (그 자리에서 다시 늘어놓는다)
 */
function sortChunksInDrawOrder(layout, chunkList) {
	if (layout.orientation === TilemapOrientation.isometric) {
		chunkList.sort((first, second) => {
			const firstDiagonal = first.column + first.row;
			const secondDiagonal = second.column + second.row;
			if (firstDiagonal !== secondDiagonal) {
				return firstDiagonal - secondDiagonal;
			}
			return first.column - second.column;
		});
		return;
	}
	if (layout.orientation === TilemapOrientation.orthogonal) {
		const rowSign = (layout.renderOrder === TilemapRenderOrder.rightUp || layout.renderOrder === TilemapRenderOrder.leftUp) ? -1 : 1;
		const columnSign = (layout.renderOrder === TilemapRenderOrder.leftDown || layout.renderOrder === TilemapRenderOrder.leftUp) ? -1 : 1;
		chunkList.sort((first, second) => {
			if (first.row !== second.row) {
				return (first.row - second.row) * rowSign;
			}
			return (first.column - second.column) * columnSign;
		});
		return;
	}
	chunkList.sort((first, second) => {
		if (first.row !== second.row) {
			return first.row - second.row;
		}
		return first.column - second.column;
	});
}


//==============================================================================
// 타일맵 컴포넌트.
//==============================================================================
/**
 * @example <caption>좌표 바꾸기와 칸의 충돌 모양</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const tilemap = new Experimental.Tilemap();
 * tilemap.setOrientation(Experimental.TilemapOrientation.isometric);
 * tilemap.setTileSize(64, 32);
 * tilemap.setMapSize(10, 10);
 * const center = tilemap.cellToMapCenter(2, 3);
 * const cell = tilemap.mapPositionToCell(center.x, center.y);
 * console.log(center.x, center.y, cell.column, cell.row);
 *
 * const tileset = new Experimental.Tileset();
 * tileset.setTileSize(64, 32);
 * tileset.setColumns(4);
 * tileset.setTileCount(16);
 * tileset.setTileCollisionShapes(0, [Experimental.TileCollisionShape.createRectangle(0, 0, 64, 32)]);
 * tilemap.addTileset(tileset);
 * const layer = tilemap.createLayer("walls");
 * layer.setTile(2, 3, 1);
 * const shapeList = tilemap.readCellCollisionShapes(0, 2, 3);
 * console.log(shapeList.length, shapeList[0].x, shapeList[0].y);
 */
export class Tilemap extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #orientation; // 배치.
	/** @private @type { number } */ #tileWidth; // 격자 칸 너비. (픽셀)
	/** @private @type { number } */ #tileHeight; // 격자 칸 높이. (픽셀)
	/** @private @type { number } */ #hexSideLength; // 육각의 곧은 변 길이. (픽셀)
	/** @private @type { string } */ #staggerAxis; // 엇갈리는 축.
	/** @private @type { string } */ #staggerIndex; // 엇갈리는 줄.
	/** @private @type { string } */ #renderOrder; // 정사각의 그리는 차례.
	/** @private @type { string } */ #renderMode; // 그리는 방식.
	/** @private @type { number } */ #columnCount; // 지도 열 수. (아이소의 원점과 지도 크기에 쓴다)
	/** @private @type { number } */ #rowCount; // 지도 행 수.
	/** @private @type { Tileset[] } */ #tilesets; // 타일셋 목록.
	/** @private @type { number[] } */ #tilesetFirstGids; // 타일셋마다 첫 gid. (늘어나는 차례)
	/** @private @type { TilemapLayer[] } */ #layers; // 층 목록. (그리는 차례)
	/** @private @type { number } */ #animationTime; // 애니메이션 시계. (초)
	/** @private @type { number } */ #animationSpeed; // 애니메이션 빠르기 배율.
	/** @private @type { number } */ #lastDrawnChunkCount; // 지난 그리기에서 그린 덩이 수.
	/** @private @type { number } */ #lastCulledChunkCount; // 지난 그리기에서 화면 밖이라 건너뛴 덩이 수.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.setComponentType("Tilemap");
		this.#orientation = TilemapOrientation.orthogonal;
		this.#tileWidth = 32;
		this.#tileHeight = 32;
		this.#hexSideLength = 0;
		this.#staggerAxis = TilemapStaggerAxis.y;
		this.#staggerIndex = TilemapStaggerIndex.odd;
		this.#renderOrder = TilemapRenderOrder.rightDown;
		this.#renderMode = TilemapRenderMode.chunk;
		this.#columnCount = 0;
		this.#rowCount = 0;
		this.#tilesets = [];
		this.#tilesetFirstGids = [];
		this.#layers = [];
		this.#animationTime = 0;
		this.#animationSpeed = 1;
		this.#lastDrawnChunkCount = 0;
		this.#lastCulledChunkCount = 0;
	}

	//==============================================================================
	// 타일 값에서 gid 읽기. (정적, 뒤집기 비트를 지운다)
	//==============================================================================
	/**
	 * @param { number } tile 타일 값.
	 * @returns { number } gid. (0 은 빈 칸)
	 */
	static readTileId(tile) {
		return (tile & TILE_ID_MASK) >>> 0;
	}

	//==============================================================================
	// 타일 값에서 뒤집기와 돌리기 비트 읽기. (정적)
	//==============================================================================
	/**
	 * @param { number } tile 타일 값.
	 * @returns { number } TileFlag 비트를 합친 값.
	 */
	static readTileFlags(tile) {
		return (tile & TILE_FLAG_BITS) >>> 0;
	}

	//==============================================================================
	// gid 와 뒤집기 비트로 타일 값 짓기. (정적)
	//==============================================================================
	/**
	 * @param { number } tileId gid.
	 * @param { number } tileFlags TileFlag 비트를 합친 값. (기본 0)
	 * @returns { number } 타일 값.
	 */
	static composeTile(tileId, tileFlags = 0) {
		return ((tileId & TILE_ID_MASK) | (tileFlags & TILE_FLAG_BITS)) >>> 0;
	}

	//==============================================================================
	// 타일 값의 방향에 2 x 2 변환을 더 걸기. (정적, 정사각과 아이소의 대각, 좌우, 상하 비트로 다시 나눈다)
	// - 비트의 방향 T = 상하^v x 좌우^h x 대각^d (대각을 먼저 건다) 를 행렬로 만들어 앞에 곱하고 다시 비트로 나눈다.
	//==============================================================================
	/**
	 * @private
	 * @param { number } tile
	 * @param { number } matrixA
	 * @param { number } matrixB
	 * @param { number } matrixC
	 * @param { number } matrixD
	 * @returns { number }
	 */
	static transformTile(tile, matrixA, matrixB, matrixC, matrixD) {
		const tileFlags = Tilemap.readTileFlags(tile);
		const isDiagonal = (tileFlags & TileFlag.diagonalFlip) !== 0;
		const isHorizontal = (tileFlags & TileFlag.horizontalFlip) !== 0;
		const isVertical = (tileFlags & TileFlag.verticalFlip) !== 0;
		// T 의 행렬. (열 벡터 [x, y] 에 곱한다)
		let tileA = 1;
		let tileB = 0;
		let tileC = 0;
		let tileD = 1;
		if (isDiagonal) {
			tileA = 0;
			tileB = 1;
			tileC = 1;
			tileD = 0;
		}
		if (isHorizontal) {
			tileA = -tileA;
			tileC = -tileC;
		}
		if (isVertical) {
			tileB = -tileB;
			tileD = -tileD;
		}
		// 앞에 곱하기. (새 방향 = 건 변환 x T, 행렬 [a c; b d])
		const resultA = matrixA * tileA + matrixC * tileB;
		const resultB = matrixB * tileA + matrixD * tileB;
		const resultC = matrixA * tileC + matrixC * tileD;
		const resultD = matrixB * tileC + matrixD * tileD;
		const isResultDiagonal = resultA === 0;
		let resultFlags = (tileFlags & TileFlag.hexagonalRotation120) >>> 0;
		if (isResultDiagonal) {
			resultFlags = (resultFlags | TileFlag.diagonalFlip) >>> 0;
			if (resultC < 0) {
				resultFlags = (resultFlags | TileFlag.horizontalFlip) >>> 0;
			}
			if (resultB < 0) {
				resultFlags = (resultFlags | TileFlag.verticalFlip) >>> 0;
			}
		}
		else {
			if (resultA < 0) {
				resultFlags = (resultFlags | TileFlag.horizontalFlip) >>> 0;
			}
			if (resultD < 0) {
				resultFlags = (resultFlags | TileFlag.verticalFlip) >>> 0;
			}
		}
		const tileId = Tilemap.readTileId(tile);
		return Tilemap.composeTile(tileId, resultFlags);
	}

	//==============================================================================
	// 타일 값을 시계 방향으로 90 도씩 돌리기. (정적, 정사각과 아이소)
	//==============================================================================
	/**
	 * @param { number } tile 타일 값. (이미 건 뒤집기 위에 더 돌린다)
	 * @param { number } clockwiseQuarterTurnCount 시계 방향 90 도 횟수. (음수면 반시계)
	 * @returns { number } 돌린 타일 값.
	 */
	static rotateTile(tile, clockwiseQuarterTurnCount) {
		const turnCount = ((clockwiseQuarterTurnCount % 4) + 4) % 4;
		let rotatedTile = tile >>> 0;
		for (let turnIndex = 0; turnIndex < turnCount; ++turnIndex) {
			rotatedTile = Tilemap.transformTile(rotatedTile, 0, 1, -1, 0);
		}
		return rotatedTile;
	}

	//==============================================================================
	// 타일 값을 좌우로 뒤집기. (정적, 이미 건 방향 위에 화면 기준으로 뒤집는다)
	//==============================================================================
	/**
	 * @param { number } tile 타일 값.
	 * @returns { number } 뒤집은 타일 값.
	 */
	static flipTileHorizontally(tile) {
		return Tilemap.transformTile(tile, -1, 0, 0, 1);
	}

	//==============================================================================
	// 타일 값을 상하로 뒤집기. (정적, 이미 건 방향 위에 화면 기준으로 뒤집는다)
	//==============================================================================
	/**
	 * @param { number } tile 타일 값.
	 * @returns { number } 뒤집은 타일 값.
	 */
	static flipTileVertically(tile) {
		return Tilemap.transformTile(tile, 1, 0, 0, -1);
	}

	//==============================================================================
	// 배치 설정.
	//==============================================================================
	/**
	 * @param { string } orientation 배치. (TilemapOrientation)
	 */
	setOrientation(orientation) {
		this.#orientation = orientation;
	}

	//==============================================================================
	// 배치 반환.
	//==============================================================================
	/**
	 * @returns { string } 배치. (TilemapOrientation, 처음은 "orthogonal")
	 */
	getOrientation() {
		return this.#orientation;
	}

	//==============================================================================
	// 격자 칸 크기 설정.
	//==============================================================================
	/**
	 * @param { number } tileWidth 칸 너비. (픽셀, 아이소는 마름모 너비)
	 * @param { number } tileHeight 칸 높이. (픽셀, 아이소는 마름모 높이)
	 */
	setTileSize(tileWidth, tileHeight) {
		this.#tileWidth = tileWidth;
		this.#tileHeight = tileHeight;
	}

	//==============================================================================
	// 격자 칸 너비 반환.
	//==============================================================================
	/**
	 * @returns { number } 칸 너비. (픽셀, 처음은 32)
	 */
	getTileWidth() {
		return this.#tileWidth;
	}

	//==============================================================================
	// 격자 칸 높이 반환.
	//==============================================================================
	/**
	 * @returns { number } 칸 높이. (픽셀, 처음은 32)
	 */
	getTileHeight() {
		return this.#tileHeight;
	}

	//==============================================================================
	// 육각의 곧은 변 길이 설정. (육각 배치)
	//==============================================================================
	/**
	 * @param { number } hexSideLength 곧은 변 길이. (픽셀, Y 축으로 엇갈리면 세로 변, X 축이면 가로 변)
	 */
	setHexSideLength(hexSideLength) {
		this.#hexSideLength = hexSideLength;
	}

	//==============================================================================
	// 육각의 곧은 변 길이 반환.
	//==============================================================================
	/**
	 * @returns { number } 곧은 변 길이. (픽셀, 처음은 0)
	 */
	getHexSideLength() {
		return this.#hexSideLength;
	}

	//==============================================================================
	// 엇갈리는 축 설정. (엇갈림, 육각)
	//==============================================================================
	/**
	 * @param { string } staggerAxis 축. (TilemapStaggerAxis)
	 */
	setStaggerAxis(staggerAxis) {
		this.#staggerAxis = staggerAxis;
	}

	//==============================================================================
	// 엇갈리는 축 반환.
	//==============================================================================
	/**
	 * @returns { string } 축. (TilemapStaggerAxis, 처음은 "y")
	 */
	getStaggerAxis() {
		return this.#staggerAxis;
	}

	//==============================================================================
	// 엇갈리는 줄 설정. (엇갈림, 육각)
	//==============================================================================
	/**
	 * @param { string } staggerIndex 줄. (TilemapStaggerIndex)
	 */
	setStaggerIndex(staggerIndex) {
		this.#staggerIndex = staggerIndex;
	}

	//==============================================================================
	// 엇갈리는 줄 반환.
	//==============================================================================
	/**
	 * @returns { string } 줄. (TilemapStaggerIndex, 처음은 "odd")
	 */
	getStaggerIndex() {
		return this.#staggerIndex;
	}

	//==============================================================================
	// 정사각의 그리는 차례 설정.
	//==============================================================================
	/**
	 * @param { string } renderOrder 차례. (TilemapRenderOrder)
	 */
	setRenderOrder(renderOrder) {
		this.#renderOrder = renderOrder;
	}

	//==============================================================================
	// 정사각의 그리는 차례 반환.
	//==============================================================================
	/**
	 * @returns { string } 차례. (TilemapRenderOrder, 처음은 "right-down")
	 */
	getRenderOrder() {
		return this.#renderOrder;
	}

	//==============================================================================
	// 그리는 방식 설정.
	//==============================================================================
	/**
	 * @param { string } renderMode 방식. (TilemapRenderMode)
	 */
	setRenderMode(renderMode) {
		this.#renderMode = renderMode;
	}

	//==============================================================================
	// 그리는 방식 반환.
	//==============================================================================
	/**
	 * @returns { string } 방식. (TilemapRenderMode, 처음은 "chunk")
	 */
	getRenderMode() {
		return this.#renderMode;
	}

	//==============================================================================
	// 지도 크기 설정. (칸 수, 아이소의 원점과 readMapPixelSize 에 쓴다. 칸은 이 밖에도 쓸 수 있다)
	//==============================================================================
	/**
	 * @param { number } columnCount 열 수.
	 * @param { number } rowCount 행 수.
	 */
	setMapSize(columnCount, rowCount) {
		this.#columnCount = columnCount;
		this.#rowCount = rowCount;
	}

	//==============================================================================
	// 지도 열 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 열 수. (처음은 0)
	 */
	getColumnCount() {
		return this.#columnCount;
	}

	//==============================================================================
	// 지도 행 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 행 수. (처음은 0)
	 */
	getRowCount() {
		return this.#rowCount;
	}

	//==============================================================================
	// 타일셋 넣기.
	//==============================================================================
	/**
	 * @param { Tileset } tileset 넣을 타일셋.
	 * @param { number } firstGid 이 타일셋 0 번 타일의 gid. (0 이하면 앞 타일셋 다음 번호, 첫 타일셋은 1)
	 * @returns { number } 정한 첫 gid.
	 */
	addTileset(tileset, firstGid = 0) {
		const tilesets = this.getTilesets();
		const tilesetFirstGids = this.#tilesetFirstGids;
		let resolvedFirstGid = firstGid;
		if (resolvedFirstGid <= 0) {
			resolvedFirstGid = 1;
			if (tilesets.length > 0) {
				const lastTileset = tilesets[tilesets.length - 1];
				const lastTileCount = lastTileset.getTileCount();
				const lastDefinedTileIds = lastTileset.getDefinedTileIds();
				let lastIdCount = lastTileCount;
				if (lastDefinedTileIds.length > 0) {
					lastIdCount = System.Math.max(lastIdCount, lastDefinedTileIds[lastDefinedTileIds.length - 1] + 1);
				}
				resolvedFirstGid = tilesetFirstGids[tilesetFirstGids.length - 1] + System.Math.max(1, lastIdCount);
			}
		}
		// 첫 gid 차례를 지켜 끼운다.
		let insertIndex = tilesets.length;
		while (insertIndex > 0 && tilesetFirstGids[insertIndex - 1] > resolvedFirstGid) {
			insertIndex -= 1;
		}
		tilesets.splice(insertIndex, 0, tileset);
		tilesetFirstGids.splice(insertIndex, 0, resolvedFirstGid);
		return resolvedFirstGid;
	}

	//==============================================================================
	// 타일셋 목록 반환.
	//==============================================================================
	/**
	 * @returns { Tileset[] } 타일셋. (첫 gid 차례)
	 */
	getTilesets() {
		return this.#tilesets;
	}

	//==============================================================================
	// 타일셋 반환.
	//==============================================================================
	/**
	 * @param { number } tilesetIndex 타일셋 번호.
	 * @returns { Tileset | null } 타일셋. (없으면 null)
	 */
	getTileset(tilesetIndex) {
		const tilesets = this.getTilesets();
		if (tilesetIndex < 0 || tilesetIndex >= tilesets.length) {
			return null;
		}
		return tilesets[tilesetIndex];
	}

	//==============================================================================
	// 타일셋의 첫 gid 반환.
	//==============================================================================
	/**
	 * @param { number } tilesetIndex 타일셋 번호.
	 * @returns { number } 첫 gid. (없으면 0)
	 */
	getTilesetFirstGid(tilesetIndex) {
		const tilesetFirstGids = this.#tilesetFirstGids;
		if (tilesetIndex < 0 || tilesetIndex >= tilesetFirstGids.length) {
			return 0;
		}
		return tilesetFirstGids[tilesetIndex];
	}

	//==============================================================================
	// gid 가 든 타일셋 번호 찾기. (첫 gid 가 gid 이하인 것 가운데 가장 큰 것, Tiled 와 같다)
	//==============================================================================
	/**
	 * @param { number } tileId gid. (뒤집기 비트가 있으면 지우고 본다)
	 * @returns { number } 타일셋 번호. (없거나 빈 칸이면 -1, 타일셋 안의 번호는 gid - getTilesetFirstGid)
	 */
	findTilesetIndex(tileId) {
		const gid = Tilemap.readTileId(tileId);
		if (gid === 0) {
			return -1;
		}
		const tilesetFirstGids = this.#tilesetFirstGids;
		for (let tilesetIndex = tilesetFirstGids.length - 1; tilesetIndex >= 0; --tilesetIndex) {
			if (tilesetFirstGids[tilesetIndex] <= gid) {
				return tilesetIndex;
			}
		}
		return -1;
	}

	//==============================================================================
	// 층 넣기. (맨 위에 그린다)
	//==============================================================================
	/**
	 * @param { TilemapLayer } layer 넣을 층.
	 * @returns { number } 층 번호.
	 */
	addLayer(layer) {
		const layers = this.getLayers();
		layers.push(layer);
		return layers.length - 1;
	}

	//==============================================================================
	// 층 끼우기. (그 번호 앞에, 앞의 층일수록 먼저(아래에) 그린다)
	//==============================================================================
	/**
	 * @param { number } layerIndex 끼울 번호. (0 보다 작으면 0, 층 수보다 크면 맨 위)
	 * @param { TilemapLayer } layer 끼울 층.
	 * @returns { number } 끼운 층 번호.
	 */
	insertLayer(layerIndex, layer) {
		const layers = this.getLayers();
		const insertIndex = System.Math.max(0, System.Math.min(layers.length, layerIndex));
		layers.splice(insertIndex, 0, layer);
		return insertIndex;
	}

	//==============================================================================
	// 새 층 만들어 넣기.
	//==============================================================================
	/**
	 * @param { string } name 이름.
	 * @param { number } [chunkSize] 덩이 한 변의 칸 수. (기본 DEFAULT_CHUNK_SIZE 16, 러스트 판은 create_layer_with_chunk_size)
	 * @returns { TilemapLayer } 새 층.
	 */
	createLayer(name, chunkSize = DEFAULT_CHUNK_SIZE) {
		const layer = new TilemapLayer(name, chunkSize);
		this.addLayer(layer);
		return layer;
	}

	//==============================================================================
	// 층 빼기.
	//==============================================================================
	/**
	 * @param { number } layerIndex 층 번호. (없으면 아무것도 하지 않는다)
	 */
	removeLayer(layerIndex) {
		const layers = this.getLayers();
		if (layerIndex < 0 || layerIndex >= layers.length) {
			return;
		}
		layers.splice(layerIndex, 1);
	}

	//==============================================================================
	// 층 목록 반환.
	//==============================================================================
	/**
	 * @returns { TilemapLayer[] } 층. (그리는 차례)
	 */
	getLayers() {
		return this.#layers;
	}

	//==============================================================================
	// 층 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 층 수.
	 */
	getLayerCount() {
		const layers = this.getLayers();
		return layers.length;
	}

	//==============================================================================
	// 층 반환.
	//==============================================================================
	/**
	 * @param { number } layerIndex 층 번호.
	 * @returns { TilemapLayer | null } 층. (없으면 null)
	 */
	getLayer(layerIndex) {
		const layers = this.getLayers();
		if (layerIndex < 0 || layerIndex >= layers.length) {
			return null;
		}
		return layers[layerIndex];
	}

	//==============================================================================
	// 이름으로 층 번호 찾기.
	//==============================================================================
	/**
	 * @param { string } name 층 이름.
	 * @returns { number } 처음 맞는 층 번호. (없으면 -1)
	 */
	findLayerIndex(name) {
		const layers = this.getLayers();
		for (let layerIndex = 0; layerIndex < layers.length; ++layerIndex) {
			const layerName = layers[layerIndex].getName();
			if (layerName === name) {
				return layerIndex;
			}
		}
		return -1;
	}

	//==============================================================================
	// 애니메이션 시계 설정.
	//==============================================================================
	/**
	 * @param { number } animationTime 시각. (초)
	 */
	setAnimationTime(animationTime) {
		this.#animationTime = animationTime;
	}

	//==============================================================================
	// 애니메이션 시계 반환.
	//==============================================================================
	/**
	 * @returns { number } 시각. (초, 처음은 0)
	 */
	getAnimationTime() {
		return this.#animationTime;
	}

	//==============================================================================
	// 애니메이션 빠르기 배율 설정. (유니티 Tilemap.animationFrameRate 같은 배율)
	//==============================================================================
	/**
	 * @param { number } animationSpeed 배율. (0 이면 멈춘다)
	 */
	setAnimationSpeed(animationSpeed) {
		this.#animationSpeed = animationSpeed;
	}

	//==============================================================================
	// 애니메이션 빠르기 배율 반환.
	//==============================================================================
	/**
	 * @returns { number } 배율. (처음은 1)
	 */
	getAnimationSpeed() {
		return this.#animationSpeed;
	}

	//==============================================================================
	// 지난 그리기에서 그린 덩이 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 덩이 수. (모든 층의 합)
	 */
	getLastDrawnChunkCount() {
		return this.#lastDrawnChunkCount;
	}

	//==============================================================================
	// 지난 그리기에서 화면 밖이라 건너뛴 덩이 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 덩이 수. (모든 층의 합)
	 */
	getLastCulledChunkCount() {
		return this.#lastCulledChunkCount;
	}

	//==============================================================================
	// 칸을 감싸는 사각형의 왼쪽 위. (지도 좌표, Tiled tileToScreenCoords 의 칸 자리)
	//==============================================================================
	/**
	 * @param { number } column 열.
	 * @param { number } row 행.
	 * @returns { Vector2 } 왼쪽 위. (픽셀, 노드 내용 좌표)
	 */
	cellToMapPosition(column, row) {
		const layout = createTilemapLayout(this);
		const left = readCellLeft(layout, column, row);
		const top = readCellTop(layout, column, row);
		return Vector2.create(left, top);
	}

	//==============================================================================
	// 칸의 가운데. (지도 좌표)
	//==============================================================================
	/**
	 * @param { number } column 열.
	 * @param { number } row 행.
	 * @returns { Vector2 } 가운데. (픽셀, 노드 내용 좌표)
	 */
	cellToMapCenter(column, row) {
		const layout = createTilemapLayout(this);
		const left = readCellLeft(layout, column, row);
		const top = readCellTop(layout, column, row);
		const cellWidth = readCellWidth(layout);
		const cellHeight = readCellHeight(layout);
		return Vector2.create(left + cellWidth / 2, top + cellHeight / 2);
	}

	//==============================================================================
	// 지도 좌표가 든 칸 찾기. (Tiled screenToTileCoords)
	// - 정사각과 아이소는 격자 나눗셈, 육각은 가까운 칸 가운데, 엇갈림은 마름모 모서리 판정이다.
	//==============================================================================
	/**
	 * @param { number } x 지도 X. (픽셀, 노드 내용 좌표)
	 * @param { number } y 지도 Y. (픽셀, 노드 내용 좌표)
	 * @returns { object } { column, row }
	 */
	mapPositionToCell(x, y) {
		const layout = createTilemapLayout(this);
		switch (layout.orientation) {
			case TilemapOrientation.isometric: {
					const shiftedX = x - layout.originX;
					const tileY = y / layout.tileHeight;
					const tileX = shiftedX / layout.tileWidth;
					return { column: System.Math.floor(tileY + tileX), row: System.Math.floor(tileY - tileX) };
				}
			case TilemapOrientation.hexagonal: {
					return this.findHexagonalCell(layout, x, y);
				}
			case TilemapOrientation.staggered: {
					return this.findStaggeredCell(layout, x, y);
				}
			default: {
					return { column: System.Math.floor(x / layout.tileWidth), row: System.Math.floor(y / layout.tileHeight) };
				}
		}
	}

	//==============================================================================
	// 육각 배치에서 지도 좌표가 든 칸 찾기. (Tiled HexagonalRenderer::screenToTileCoords)
	//==============================================================================
	/**
	 * @private
	 * @param { object } layout
	 * @param { number } x
	 * @param { number } y
	 * @returns { object }
	 */
	findHexagonalCell(layout, x, y) {
		let shiftedX = x;
		let shiftedY = y;
		if (layout.isStaggerX) {
			shiftedX -= layout.isStaggerEven ? layout.hexagonTileWidth : layout.sideOffsetX;
		}
		else {
			shiftedY -= layout.isStaggerEven ? layout.hexagonTileHeight : layout.sideOffsetY;
		}
		let referenceColumn = System.Math.floor(shiftedX / (layout.columnWidth * 2));
		let referenceRow = System.Math.floor(shiftedY / (layout.rowHeight * 2));
		const relativeX = shiftedX - referenceColumn * (layout.columnWidth * 2);
		const relativeY = shiftedY - referenceRow * (layout.rowHeight * 2);
		const staggerAddition = layout.isStaggerEven ? 1 : 0;
		let centerList = null;
		let offsetList = null;
		if (layout.isStaggerX) {
			referenceColumn = referenceColumn * 2 + staggerAddition;
			const left = System.Math.trunc(layout.sideLengthX / 2);
			const centerX = left + layout.columnWidth;
			const centerY = System.Math.trunc(layout.hexagonTileHeight / 2);
			centerList = [left, centerY, centerX, centerY - layout.rowHeight, centerX, centerY + layout.rowHeight, centerX + layout.columnWidth, centerY];
			offsetList = [0, 0, 1, -1, 1, 0, 2, 0];
		}
		else {
			referenceRow = referenceRow * 2 + staggerAddition;
			const top = System.Math.trunc(layout.sideLengthY / 2);
			const centerX = System.Math.trunc(layout.hexagonTileWidth / 2);
			const centerY = top + layout.rowHeight;
			centerList = [centerX, top, centerX - layout.columnWidth, centerY, centerX + layout.columnWidth, centerY, centerX, centerY + layout.rowHeight];
			offsetList = [0, 0, -1, 1, 0, 1, 0, 2];
		}
		let nearestIndex = 0;
		let nearestDistance = System.Infinity;
		for (let centerIndex = 0; centerIndex < 4; ++centerIndex) {
			const differenceX = centerList[centerIndex * 2] - relativeX;
			const differenceY = centerList[centerIndex * 2 + 1] - relativeY;
			const distance = differenceX * differenceX + differenceY * differenceY;
			if (distance < nearestDistance) {
				nearestDistance = distance;
				nearestIndex = centerIndex;
			}
		}
		return { column: referenceColumn + offsetList[nearestIndex * 2], row: referenceRow + offsetList[nearestIndex * 2 + 1] };
	}

	//==============================================================================
	// 엇갈림 배치에서 지도 좌표가 든 칸 찾기. (Tiled StaggeredRenderer::screenToTileCoords)
	//==============================================================================
	/**
	 * @private
	 * @param { object } layout
	 * @param { number } x
	 * @param { number } y
	 * @returns { object }
	 */
	findStaggeredCell(layout, x, y) {
		let alignedX = x;
		let alignedY = y;
		if (layout.isStaggerX) {
			alignedX -= layout.isStaggerEven ? layout.sideOffsetX : 0;
		}
		else {
			alignedY -= layout.isStaggerEven ? layout.sideOffsetY : 0;
		}
		let column = System.Math.floor(alignedX / layout.hexagonTileWidth);
		let row = System.Math.floor(alignedY / layout.hexagonTileHeight);
		const relativeX = alignedX - column * layout.hexagonTileWidth;
		const relativeY = alignedY - row * layout.hexagonTileHeight;
		const staggerAddition = layout.isStaggerEven ? 1 : 0;
		if (layout.isStaggerX) {
			column = column * 2 + staggerAddition;
		}
		else {
			row = row * 2 + staggerAddition;
		}
		const slopeY = relativeX * (layout.hexagonTileHeight / layout.hexagonTileWidth);
		let cell = { column: column, row: row };
		if (layout.sideOffsetY - slopeY > relativeY) {
			cell = this.findStaggeredNeighbor(layout, cell, -1, -1);
		}
		if (-layout.sideOffsetY + slopeY > relativeY) {
			cell = this.findStaggeredNeighbor(layout, cell, 1, -1);
		}
		if (layout.sideOffsetY + slopeY < relativeY) {
			cell = this.findStaggeredNeighbor(layout, cell, -1, 1);
		}
		if (layout.sideOffsetY * 3 - slopeY < relativeY) {
			cell = this.findStaggeredNeighbor(layout, cell, 1, 1);
		}
		return cell;
	}

	//==============================================================================
	// 엇갈린 배치의 대각 이웃 칸. (Tiled HexagonalRenderer 의 topLeft, topRight, bottomLeft, bottomRight)
	//==============================================================================
	/**
	 * @private
	 * @param { object } layout
	 * @param { object } cell
	 * @param { number } horizontalSign 왼쪽 -1, 오른쪽 1.
	 * @param { number } verticalSign 위 -1, 아래 1.
	 * @returns { object }
	 */
	findStaggeredNeighbor(layout, cell, horizontalSign, verticalSign) {
		if (!layout.isStaggerX) {
			const isStaggered = isStaggeredIndex(layout, cell.row);
			let column = cell.column;
			if (horizontalSign < 0 && !isStaggered) {
				column -= 1;
			}
			else if (horizontalSign > 0 && isStaggered) {
				column += 1;
			}
			return { column: column, row: cell.row + verticalSign };
		}
		const isStaggered = isStaggeredIndex(layout, cell.column);
		let row = cell.row;
		if (verticalSign < 0 && !isStaggered) {
			row -= 1;
		}
		else if (verticalSign > 0 && isStaggered) {
			row += 1;
		}
		return { column: cell.column + horizontalSign, row: row };
	}

	//==============================================================================
	// 지도 크기 셈하기. (setMapSize 의 칸 수로, Tiled mapBoundingRect 의 크기)
	//==============================================================================
	/**
	 * @returns { Vector2 } 너비와 높이. (픽셀)
	 */
	readMapPixelSize() {
		const layout = createTilemapLayout(this);
		const columnCount = this.getColumnCount();
		const rowCount = this.getRowCount();
		const bounds = Rect.zero();
		writeCellRangeBounds(layout, 0, 0, columnCount, rowCount, bounds);
		return Vector2.create(bounds.width, bounds.height);
	}

	//==============================================================================
	// 칸 하나를 그리는 자리 셈하기. (Tiled CellRenderer::render)
	// - 그림 영역, 그리는 크기와 배율, 가운데, 뒤집기, 돌리기(도)를 placement 에 적는다. 그림 영역이 비면 거짓.
	//==============================================================================
	/**
	 * @private
	 * @param { object } layout
	 * @param { Tileset } tileset
	 * @param { number } tileId 타일셋 안의 번호.
	 * @param { number } tileFlags
	 * @param { number } column
	 * @param { number } row
	 * @param { object } placement
	 * @returns { boolean }
	 */
	writeTilePlacement(layout, tileset, tileId, tileFlags, column, row, placement) {
		const imageRect = tileset.getTileImageRect(tileId);
		let sourceX = 0;
		let sourceY = 0;
		let sourceWidth = 0;
		let sourceHeight = 0;
		if (imageRect !== null) {
			sourceX = imageRect.position.x;
			sourceY = imageRect.position.y;
			sourceWidth = imageRect.width;
			sourceHeight = imageRect.height;
		}
		else {
			// 타일에 따로 건 그림이 없을 때만 격자 한 칸. (readTileImageRect, 러스트 판 has_own_tile_image 와 같은 기준, 타일셋과 같은 그림을 걸어도 그 그림 전체)
			const tileData = tileset.findTileData(tileId);
			const tileImage = tileset.getTileImage(tileId);
			const columns = tileset.getColumns();
			if ((tileData === null || tileData.image === null) && columns > 0) {
				const tileWidth = tileset.getTileWidth();
				const tileHeight = tileset.getTileHeight();
				const margin = tileset.getMargin();
				const spacing = tileset.getSpacing();
				sourceX = margin + (tileId % columns) * (tileWidth + spacing);
				sourceY = margin + System.Math.floor(tileId / columns) * (tileHeight + spacing);
				sourceWidth = tileWidth;
				sourceHeight = tileHeight;
			}
			else if (tileImage !== null) {
				sourceWidth = tileImage.width;
				sourceHeight = tileImage.height;
			}
		}
		if (sourceWidth <= 0 || sourceHeight <= 0) {
			return false;
		}

		// 그리는 크기와 배율.
		let renderWidth = sourceWidth;
		let renderHeight = sourceHeight;
		const tileRenderSize = tileset.getTileRenderSize();
		if (tileRenderSize === TileRenderSize.grid) {
			renderWidth = layout.tileWidth;
			renderHeight = layout.tileHeight;
		}
		let scaleX = renderWidth / sourceWidth;
		let scaleY = renderHeight / sourceHeight;
		const fillMode = tileset.getFillMode();
		if (fillMode === TileFillMode.preserveAspectFit) {
			const minimumScale = System.Math.min(scaleX, scaleY);
			scaleX = minimumScale;
			scaleY = minimumScale;
		}

		// 칸의 왼쪽 아래에 맞춘 가운데. (오프셋도 배율을 곱한다)
		const cellLeft = readCellLeft(layout, column, row);
		const cellBottom = readCellTop(layout, column, row) + readCellHeight(layout);
		const tileOffset = tileset.getTileOffset();
		let centerX = cellLeft + renderWidth / 2 + tileOffset.x * scaleX;
		let centerY = cellBottom - renderHeight / 2 + tileOffset.y * scaleY;

		// 뒤집기와 돌리기.
		const isFlagHorizontal = (tileFlags & TileFlag.horizontalFlip) !== 0;
		const isFlagVertical = (tileFlags & TileFlag.verticalFlip) !== 0;
		const isFlagDiagonal = (tileFlags & TileFlag.diagonalFlip) !== 0;
		let isHorizontalFlip = isFlagHorizontal;
		let isVerticalFlip = isFlagVertical;
		let rotation = 0;
		if (layout.orientation === TilemapOrientation.hexagonal) {
			if (isFlagDiagonal) {
				rotation += 60;
			}
			if ((tileFlags & TileFlag.hexagonalRotation120) !== 0) {
				rotation += 120;
			}
		}
		else if (isFlagDiagonal) {
			rotation = 90;
			isHorizontalFlip = isFlagVertical;
			isVerticalFlip = !isFlagHorizontal;
			const halfDifference = renderHeight / 2 - renderWidth / 2;
			centerX += halfDifference;
			centerY += halfDifference;
		}
		placement.sourceX = sourceX;
		placement.sourceY = sourceY;
		placement.sourceWidth = sourceWidth;
		placement.sourceHeight = sourceHeight;
		placement.scaleX = scaleX;
		placement.scaleY = scaleY;
		placement.centerX = centerX;
		placement.centerY = centerY;
		placement.isHorizontalFlip = isHorizontalFlip;
		placement.isVerticalFlip = isVerticalFlip;
		placement.rotation = rotation;
		return true;
	}

	//==============================================================================
	// 칸 하나의 충돌 모양 셈하기. (지도 좌표, 층 오프셋과 뒤집기, 돌리기, 타일 오프셋을 건다)
	// - 애니메이션 타일은 지도에 놓인 번호(첫 프레임이 아닌 놓인 타일)의 모양을 쓴다.
	//==============================================================================
	/**
	 * @param { number } layerIndex 층 번호.
	 * @param { number } column 열.
	 * @param { number } row 행.
	 * @returns { TileCollisionShape[] } 모양 목록. (빈 칸이거나 모양이 없으면 빈 배열, 새로 만든 것)
	 */
	readCellCollisionShapes(layerIndex, column, row) {
		const shapeList = [];
		const layer = this.getLayer(layerIndex);
		if (layer === null) {
			return shapeList;
		}
		const layout = createTilemapLayout(this);
		const tile = layer.getTile(column, row);
		this.appendCellCollisionShapes(layout, layer, tile, column, row, shapeList);
		return shapeList;
	}

	//==============================================================================
	// 층 전체의 충돌 모양 셈하기. (정적 충돌 지형을 한 번에 지을 때)
	//==============================================================================
	/**
	 * @param { number } layerIndex 층 번호.
	 * @returns { TileCollisionShape[] } 모양 목록. (덩이의 행, 열 차례, 덩이 안은 행 차례)
	 */
	readLayerCollisionShapes(layerIndex) {
		const shapeList = [];
		const layer = this.getLayer(layerIndex);
		if (layer === null) {
			return shapeList;
		}
		const layout = createTilemapLayout(this);
		const chunkSize = layer.getChunkSize();
		const chunkList = layer.getChunkList();
		for (const chunk of chunkList) {
			const tiles = chunk.tiles;
			for (let tileIndex = 0; tileIndex < tiles.length; ++tileIndex) {
				const tile = tiles[tileIndex];
				if (tile === 0) {
					continue;
				}
				const column = chunk.column * chunkSize + tileIndex % chunkSize;
				const row = chunk.row * chunkSize + System.Math.floor(tileIndex / chunkSize);
				this.appendCellCollisionShapes(layout, layer, tile, column, row, shapeList);
			}
		}
		return shapeList;
	}

	//==============================================================================
	// 칸 하나의 충돌 모양을 목록에 더하기.
	//==============================================================================
	/**
	 * @private
	 * @param { object } layout
	 * @param { TilemapLayer } layer
	 * @param { number } tile
	 * @param { number } column
	 * @param { number } row
	 * @param { TileCollisionShape[] } shapeList
	 */
	appendCellCollisionShapes(layout, layer, tile, column, row, shapeList) {
		const tilesetIndex = this.findTilesetIndex(tile);
		if (tilesetIndex < 0) {
			return;
		}
		const tileset = this.getTileset(tilesetIndex);
		const firstGid = this.getTilesetFirstGid(tilesetIndex);
		const gid = Tilemap.readTileId(tile);
		const tileId = gid - firstGid;
		const collisionShapes = tileset.getTileCollisionShapes(tileId);
		if (collisionShapes.length === 0) {
			return;
		}
		const placement = {};
		const tileFlags = Tilemap.readTileFlags(tile);
		const isPlaced = this.writeTilePlacement(layout, tileset, tileId, tileFlags, column, row, placement);
		if (!isPlaced) {
			return;
		}
		const layerOffset = layer.getOffset();
		const transformMatrix = new TransformMatrix();
		transformMatrix.translate(layerOffset.x + placement.centerX, layerOffset.y + placement.centerY);
		transformMatrix.rotate(placement.rotation * System.Math.PI / 180);
		transformMatrix.scale(placement.scaleX * (placement.isHorizontalFlip ? -1 : 1), placement.scaleY * (placement.isVerticalFlip ? -1 : 1));
		transformMatrix.translate(-placement.sourceWidth / 2, -placement.sourceHeight / 2);
		for (const collisionShape of collisionShapes) {
			const transformedShape = collisionShape.createTransformed(transformMatrix);
			shapeList.push(transformedShape);
		}
	}

	//==============================================================================
	// 갱신. (애니메이션 시계를 흘린다)
	//==============================================================================
	/**
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	tick(timeDelta) {
		const animationTime = this.getAnimationTime();
		const animationSpeed = this.getAnimationSpeed();
		this.setAnimationTime(animationTime + timeDelta * animationSpeed);
	}

	//==============================================================================
	// 출력. (층을 넣은 차례로, 층마다 화면에 걸치는 덩이만)
	//==============================================================================
	/**
	 * @param { Graphic } graphic 그래픽.
	 */
	draw(graphic) {
		this.#lastDrawnChunkCount = 0;
		this.#lastCulledChunkCount = 0;
		const layers = this.getLayers();
		const tilesets = this.getTilesets();
		if (layers.length === 0 || tilesets.length === 0) {
			return;
		}
		const layout = createTilemapLayout(this);

		// 화면 밖 거르기의 여유. (격자보다 큰 타일, 오프셋)
		let drawMargin = System.Math.max(layout.tileWidth, layout.tileHeight);
		for (const tileset of tilesets) {
			const maximumTileExtent = tileset.readMaximumTileExtent();
			drawMargin = System.Math.max(drawMargin, maximumTileExtent);
		}
		const animationTime = this.getAnimationTime();
		const drawState = {
			graphic: graphic,
			layout: layout,
			vertexData: graphic.getVertexData(),
			floatCapacity: 0,
			floatOffset: 0,
			image: null,
			texture: null,
			color: null,
			timeMilliseconds: animationTime * 1000,
			placement: {},
			tilesetIndex: -1,
			tilesetFirstGid: 0,
			tilesetLastGid: -1,
			tileset: null,
		};
		drawState.floatCapacity = drawState.vertexData.length - drawState.vertexData.length % FLOATS_PER_QUAD;
		for (const layer of layers) {
			this.drawLayer(drawState, layer, drawMargin);
		}
	}

	//==============================================================================
	// 층 하나 그리기.
	//==============================================================================
	/**
	 * @private
	 * @param { object } drawState
	 * @param { TilemapLayer } layer
	 * @param { number } drawMargin
	 */
	drawLayer(drawState, layer, drawMargin) {
		const isVisible = layer.isVisible();
		const opacity = layer.getOpacity();
		if (!isVisible || opacity <= 0) {
			return;
		}
		const chunkList = layer.getChunkList();
		if (chunkList.length === 0) {
			return;
		}
		const graphic = drawState.graphic;
		const layout = drawState.layout;
		const layerColor = layer.getColor();
		const layerOffset = layer.getOffset();
		const blendMode = layer.getBlendMode();
		const chunkSize = layer.getChunkSize();
		drawState.color = new Color(layerColor.red, layerColor.green, layerColor.blue, layerColor.alpha * opacity);
		drawState.image = null;
		drawState.texture = null;
		drawState.floatOffset = 0;
		graphic.pushState();
		graphic.translate(layerOffset.x, layerOffset.y);
		graphic.setBlendMode(blendMode);

		// 화면에 걸치는 덩이 고르기.
		const chunkBounds = Rect.zero();
		const visibleChunkList = [];
		for (const chunk of chunkList) {
			writeCellRangeBounds(layout, chunk.column * chunkSize, chunk.row * chunkSize, chunkSize, chunkSize, chunkBounds);
			chunkBounds.position.set(chunkBounds.position.x - drawMargin, chunkBounds.position.y - drawMargin);
			chunkBounds.size.set(chunkBounds.size.x + drawMargin * 2, chunkBounds.size.y + drawMargin * 2);
			if (graphic.isLocalRectVisible(chunkBounds)) {
				visibleChunkList.push(chunk);
			}
		}
		this.#lastDrawnChunkCount += visibleChunkList.length;
		this.#lastCulledChunkCount += chunkList.length - visibleChunkList.length;

		const renderMode = this.getRenderMode();
		if (renderMode === TilemapRenderMode.individual) {
			this.drawVisibleChunksIndividually(drawState, visibleChunkList, chunkSize);
		}
		else {
			sortChunksInDrawOrder(layout, visibleChunkList);
			for (const chunk of visibleChunkList) {
				const chunkTiles = chunk.tiles;
				const chunkLeft = chunk.column * chunkSize;
				const chunkTop = chunk.row * chunkSize;
				visitCellsInDrawOrder(layout, chunkLeft, chunkTop, chunkSize, chunkSize, (column, row) => {
					const tile = chunkTiles[(row - chunkTop) * chunkSize + (column - chunkLeft)];
					if (tile !== 0) {
						this.drawCell(drawState, tile, column, row);
					}
				});
			}
		}
		this.flushVertices(drawState);
		graphic.setBlendMode("source-over");
		graphic.popState();
	}

	//==============================================================================
	// 화면에 걸친 덩이를 지도 전체의 칸 차례로 그리기. (Individual 모드)
	//==============================================================================
	/**
	 * @private
	 * @param { object } drawState
	 * @param { object[] } visibleChunkList
	 * @param { number } chunkSize
	 */
	drawVisibleChunksIndividually(drawState, visibleChunkList, chunkSize) {
		if (visibleChunkList.length === 0) {
			return;
		}
		let minimumChunkColumn = System.Infinity;
		let minimumChunkRow = System.Infinity;
		let maximumChunkColumn = -System.Infinity;
		let maximumChunkRow = -System.Infinity;
		for (const chunk of visibleChunkList) {
			minimumChunkColumn = System.Math.min(minimumChunkColumn, chunk.column);
			minimumChunkRow = System.Math.min(minimumChunkRow, chunk.row);
			maximumChunkColumn = System.Math.max(maximumChunkColumn, chunk.column);
			maximumChunkRow = System.Math.max(maximumChunkRow, chunk.row);
		}
		const chunkColumnSpan = maximumChunkColumn - minimumChunkColumn + 1;
		const chunkRowSpan = maximumChunkRow - minimumChunkRow + 1;
		const chunkGrid = new System.Array(chunkColumnSpan * chunkRowSpan).fill(null);
		for (const chunk of visibleChunkList) {
			chunkGrid[(chunk.row - minimumChunkRow) * chunkColumnSpan + (chunk.column - minimumChunkColumn)] = chunk;
		}
		const firstColumn = minimumChunkColumn * chunkSize;
		const firstRow = minimumChunkRow * chunkSize;
		visitCellsInDrawOrder(drawState.layout, firstColumn, firstRow, chunkColumnSpan * chunkSize, chunkRowSpan * chunkSize, (column, row) => {
			const gridColumn = System.Math.floor((column - firstColumn) / chunkSize);
			const gridRow = System.Math.floor((row - firstRow) / chunkSize);
			const chunk = chunkGrid[gridRow * chunkColumnSpan + gridColumn];
			if (chunk === null) {
				return;
			}
			const tile = chunk.tiles[(row - chunk.row * chunkSize) * chunkSize + (column - chunk.column * chunkSize)];
			if (tile !== 0) {
				this.drawCell(drawState, tile, column, row);
			}
		});
	}

	//==============================================================================
	// 칸 하나를 꼭짓점 버퍼에 적기. (그림이 바뀌거나 버퍼가 차면 먼저 그린다)
	//==============================================================================
	/**
	 * @private
	 * @param { object } drawState
	 * @param { number } tile
	 * @param { number } column
	 * @param { number } row
	 */
	drawCell(drawState, tile, column, row) {
		const gid = (tile & TILE_ID_MASK) >>> 0;

		// 타일셋 찾기. (이웃 칸은 거의 같은 타일셋이라 지난 범위부터 본다)
		if (gid < drawState.tilesetFirstGid || gid > drawState.tilesetLastGid) {
			const tilesetIndex = this.findTilesetIndex(gid);
			if (tilesetIndex < 0) {
				return;
			}
			const nextFirstGid = this.getTilesetFirstGid(tilesetIndex + 1);
			drawState.tilesetIndex = tilesetIndex;
			drawState.tileset = this.getTileset(tilesetIndex);
			drawState.tilesetFirstGid = this.getTilesetFirstGid(tilesetIndex);
			drawState.tilesetLastGid = nextFirstGid > 0 ? nextFirstGid - 1 : System.Infinity;
		}
		const tileset = drawState.tileset;
		const baseTileId = gid - drawState.tilesetFirstGid;
		const tileId = tileset.readAnimatedTileId(baseTileId, drawState.timeMilliseconds);
		const image = tileset.getTileImage(tileId);
		if (image === null || image.width <= 0 || image.height <= 0) {
			return;
		}
		const placement = drawState.placement;
		const tileFlags = (tile & TILE_FLAG_BITS) >>> 0;
		const isPlaced = this.writeTilePlacement(drawState.layout, tileset, tileId, tileFlags, column, row, placement);
		if (!isPlaced) {
			return;
		}

		// 그림이 바뀌면 쌓인 것을 그리고 텍스처를 바꾼다.
		const graphic = drawState.graphic;
		if (image !== drawState.image) {
			this.flushVertices(drawState);
			const imageTextureCache = graphic.getImageTextureCache();
			const isImageSmoothingEnabled = graphic.isImageSmoothingEnabled();
			const isImageMipmapEnabled = graphic.isImageMipmapEnabled();
			drawState.texture = imageTextureCache.getTexture(image, isImageSmoothingEnabled, isImageMipmapEnabled);
			drawState.image = image;
		}
		if (!drawState.texture) {
			return;
		}
		if (drawState.floatOffset + FLOATS_PER_QUAD > drawState.floatCapacity) {
			this.flushVertices(drawState);
		}

		// 그림 영역의 네 모서리를 가운데 기준으로 뒤집고 돌려 놓는다. (차례: 왼쪽 위, 오른쪽 위, 왼쪽 아래, 왼쪽 아래, 오른쪽 위, 오른쪽 아래)
		const halfWidth = placement.sourceWidth * placement.scaleX * 0.5 * (placement.isHorizontalFlip ? -1 : 1);
		const halfHeight = placement.sourceHeight * placement.scaleY * 0.5 * (placement.isVerticalFlip ? -1 : 1);
		let cosRotation = 1;
		let sinRotation = 0;
		if (placement.rotation !== 0) {
			const radian = placement.rotation * System.Math.PI / 180;
			cosRotation = System.Math.cos(radian);
			sinRotation = System.Math.sin(radian);
		}
		const centerX = placement.centerX;
		const centerY = placement.centerY;
		const leftTopX = -halfWidth * cosRotation + halfHeight * sinRotation + centerX;
		const leftTopY = -halfWidth * sinRotation - halfHeight * cosRotation + centerY;
		const rightTopX = halfWidth * cosRotation + halfHeight * sinRotation + centerX;
		const rightTopY = halfWidth * sinRotation - halfHeight * cosRotation + centerY;
		const leftBottomX = -halfWidth * cosRotation - halfHeight * sinRotation + centerX;
		const leftBottomY = -halfWidth * sinRotation + halfHeight * cosRotation + centerY;
		const rightBottomX = halfWidth * cosRotation - halfHeight * sinRotation + centerX;
		const rightBottomY = halfWidth * sinRotation + halfHeight * cosRotation + centerY;
		const imageWidth = image.width;
		const imageHeight = image.height;
		const leftU = placement.sourceX / imageWidth;
		const topV = placement.sourceY / imageHeight;
		const rightU = (placement.sourceX + placement.sourceWidth) / imageWidth;
		const bottomV = (placement.sourceY + placement.sourceHeight) / imageHeight;
		const vertexData = drawState.vertexData;
		let offset = drawState.floatOffset;
		vertexData[offset++] = leftTopX;
		vertexData[offset++] = leftTopY;
		vertexData[offset++] = leftU;
		vertexData[offset++] = topV;
		vertexData[offset++] = rightTopX;
		vertexData[offset++] = rightTopY;
		vertexData[offset++] = rightU;
		vertexData[offset++] = topV;
		vertexData[offset++] = leftBottomX;
		vertexData[offset++] = leftBottomY;
		vertexData[offset++] = leftU;
		vertexData[offset++] = bottomV;
		vertexData[offset++] = leftBottomX;
		vertexData[offset++] = leftBottomY;
		vertexData[offset++] = leftU;
		vertexData[offset++] = bottomV;
		vertexData[offset++] = rightTopX;
		vertexData[offset++] = rightTopY;
		vertexData[offset++] = rightU;
		vertexData[offset++] = topV;
		vertexData[offset++] = rightBottomX;
		vertexData[offset++] = rightBottomY;
		vertexData[offset++] = rightU;
		vertexData[offset++] = bottomV;
		drawState.floatOffset = offset;
	}

	//==============================================================================
	// 쌓인 꼭짓점 그리기. (쌓인 것이 없으면 아무것도 하지 않는다)
	//==============================================================================
	/**
	 * @private
	 * @param { object } drawState
	 */
	flushVertices(drawState) {
		if (drawState.floatOffset <= 0) {
			return;
		}
		if (drawState.texture) {
			drawState.graphic.drawVertices(drawState.floatOffset / FLOATS_PER_VERTEX, drawState.texture, drawState.color);
		}
		drawState.floatOffset = 0;
	}
}
