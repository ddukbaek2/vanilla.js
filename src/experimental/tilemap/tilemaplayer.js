//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";
import { Vector2 } from "../../base/vector2.js";
import { Rect } from "../../base/rect.js";
import { Color } from "../../base/color.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
export const DEFAULT_CHUNK_SIZE = 16; // 덩이 한 변의 칸 수. (러스트 판 DEFAULT_CHUNK_SIZE 와 같이 공개) (16 x 16 칸이면 쿼드 256 개, 꼭짓점 1536 개로 Graphic 한 번에 그릴 수 있다)


//==============================================================================
// 타일맵 층.
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 칸마다 타일 값(32 비트, 위 4 비트는 뒤집기와 돌리기, 아래 28 비트는 지도 전체의 타일 번호 gid, 0 은 빈 칸)을 든다. (Tiled 의 전역 타일 번호와 같은 꼴)
// - 칸은 덩이(chunk, 기본 16 x 16)로 나눠 든다. 쓴 덩이만 만들어 큰 맵과 끝없는 맵(음수 칸)도 담고, Tilemap 이 덩이마다 화면 밖을 거른다.
// - 색(곱하기 틴트), 불투명도, 그리는 자리 오프셋, 섞는 방식, 속성을 층마다 둔다.
//==============================================================================
/**
 * @example <caption>칸 쓰고 읽기, 쓴 범위</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const layer = new Experimental.TilemapLayer("ground");
 * layer.setTile(0, 0, 1);
 * layer.setTile(-3, 40, 2);
 * layer.setTiles(4, 4, 2, 2, [5, 6, 7, 8]);
 * console.log(layer.getTile(5, 5), layer.getTile(9, 9), layer.getTileCount());
 * const cellBounds = layer.readCellBounds();
 * console.log(cellBounds.position.x, cellBounds.position.y, cellBounds.width, cellBounds.height);
 */
export class TilemapLayer extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #name; // 이름.
	/** @private @type { boolean } */ #isVisible; // 보이는지.
	/** @private @type { number } */ #opacity; // 불투명도. (0 ~ 1)
	/** @private @type { Color } */ #color; // 곱하는 색.
	/** @private @type { Vector2 } */ #offset; // 그리는 자리 오프셋. (픽셀)
	/** @private @type { string } */ #blendMode; // 섞는 방식. (Canvas2D globalCompositeOperation 이름)
	/** @private @type { Map<string, any> } */ #properties; // 층 속성.
	/** @private @type { number } */ #chunkSize; // 덩이 한 변의 칸 수.
	/** @private @type { Map<string, object> } */ #chunkTable; // "덩이 열,덩이 행" → 덩이. ({ column, row, tiles: Uint32Array, tileCount })
	/** @private @type { object[] | null } */ #sortedChunkList; // 행, 열 차례로 늘어놓은 덩이. (덩이가 늘거나 줄면 다시 만든다)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { string } name 이름. (기본 빈 글)
	 * @param { number } chunkSize 덩이 한 변의 칸 수. (기본 16, 1 보다 작으면 1)
	 */
	constructor(name = "", chunkSize = DEFAULT_CHUNK_SIZE) {
		super();
		this.#name = name;
		this.#isVisible = true;
		this.#opacity = 1;
		this.#color = Color.white();
		this.#offset = Vector2.zero();
		this.#blendMode = "source-over";
		this.#properties = new System.Map();
		// 1 보다 작거나 수가 아니면 1. (러스트 판 i32 의 max(1) 과 같다)
		const flooredChunkSize = System.Math.floor(chunkSize);
		this.#chunkSize = System.Number.isFinite(flooredChunkSize) ? System.Math.max(1, flooredChunkSize) : 1;
		this.#chunkTable = new System.Map();
		this.#sortedChunkList = null;
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
	 * @returns { string } 이름.
	 */
	getName() {
		return this.#name;
	}

	//==============================================================================
	// 보이기 설정.
	//==============================================================================
	/**
	 * @param { boolean } isVisible 참이면 그린다.
	 */
	setVisible(isVisible) {
		this.#isVisible = isVisible;
	}

	//==============================================================================
	// 보이는지 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 그리면 참. (처음은 참)
	 */
	isVisible() {
		return this.#isVisible;
	}

	//==============================================================================
	// 불투명도 설정.
	//==============================================================================
	/**
	 * @param { number } opacity 불투명도. (0 ~ 1, 색의 알파에 곱한다)
	 */
	setOpacity(opacity) {
		this.#opacity = opacity;
	}

	//==============================================================================
	// 불투명도 반환.
	//==============================================================================
	/**
	 * @returns { number } 불투명도. (처음은 1)
	 */
	getOpacity() {
		return this.#opacity;
	}

	//==============================================================================
	// 곱하는 색 설정. (Tiled 의 tintcolor, 유니티 Tilemap.color, 언리얼 layer color)
	//==============================================================================
	/**
	 * @param { Color } color 색. (복사해 둔다)
	 */
	setColor(color) {
		this.#color = new Color(color.red, color.green, color.blue, color.alpha);
	}

	//==============================================================================
	// 곱하는 색 반환.
	//==============================================================================
	/**
	 * @returns { Color } 색. (처음은 흰색)
	 */
	getColor() {
		return this.#color;
	}

	//==============================================================================
	// 그리는 자리 오프셋 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } offset 오프셋. (픽셀, 복사해 둔다)
	 */
	setOffset(offset) {
		this.#offset = Vector2.create(offset.x, offset.y);
	}

	//==============================================================================
	// 그리는 자리 오프셋 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 오프셋. (픽셀, 처음은 0, 0)
	 */
	getOffset() {
		return this.#offset;
	}

	//==============================================================================
	// 섞는 방식 설정.
	//==============================================================================
	/**
	 * @param { string } blendMode Canvas2D globalCompositeOperation 이름. (SpriteBlendMode 값, 처음은 "source-over")
	 */
	setBlendMode(blendMode) {
		this.#blendMode = blendMode;
	}

	//==============================================================================
	// 섞는 방식 반환.
	//==============================================================================
	/**
	 * @returns { string } Canvas2D globalCompositeOperation 이름.
	 */
	getBlendMode() {
		return this.#blendMode;
	}

	//==============================================================================
	// 층 속성 설정.
	//==============================================================================
	/**
	 * @param { string } name 속성 이름.
	 * @param { any } value 값.
	 */
	setProperty(name, value) {
		const properties = this.getProperties();
		properties.set(name, value);
	}

	//==============================================================================
	// 층 속성 반환.
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
	// 층 속성 모두 반환.
	//==============================================================================
	/**
	 * @returns { Map<string, any> } 이름 → 값. (넣은 차례)
	 */
	getProperties() {
		return this.#properties;
	}

	//==============================================================================
	// 덩이 한 변의 칸 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 칸 수.
	 */
	getChunkSize() {
		return this.#chunkSize;
	}

	//==============================================================================
	// 덩이 표 반환.
	//==============================================================================
	/**
	 * @private
	 * @returns { Map<string, object> }
	 */
	getChunkTable() {
		return this.#chunkTable;
	}

	//==============================================================================
	// 칸에 타일 값 쓰기.
	//==============================================================================
	/**
	 * @param { number } column 열. (음수도 된다)
	 * @param { number } row 행. (음수도 된다)
	 * @param { number } tile 타일 값. (뒤집기 비트를 포함한 gid, 0 이면 비운다)
	 */
	setTile(column, row, tile) {
		const chunkSize = this.getChunkSize();
		const chunkColumn = System.Math.floor(column / chunkSize);
		const chunkRow = System.Math.floor(row / chunkSize);
		const chunkKey = chunkColumn + "," + chunkRow;
		const chunkTable = this.getChunkTable();
		let chunk = chunkTable.get(chunkKey);
		const tileValue = tile >>> 0;
		if (chunk === undefined) {
			if (tileValue === 0) {
				return;
			}
			chunk = { column: chunkColumn, row: chunkRow, tiles: new System.Uint32Array(chunkSize * chunkSize), tileCount: 0 };
			chunkTable.set(chunkKey, chunk);
			this.#sortedChunkList = null;
		}
		const tileIndex = (row - chunkRow * chunkSize) * chunkSize + (column - chunkColumn * chunkSize);
		const previousTile = chunk.tiles[tileIndex];
		if (previousTile === 0 && tileValue !== 0) {
			chunk.tileCount += 1;
		}
		else if (previousTile !== 0 && tileValue === 0) {
			chunk.tileCount -= 1;
		}
		chunk.tiles[tileIndex] = tileValue;
		if (chunk.tileCount === 0) {
			chunkTable.delete(chunkKey);
			this.#sortedChunkList = null;
		}
	}

	//==============================================================================
	// 칸의 타일 값 반환.
	//==============================================================================
	/**
	 * @param { number } column 열.
	 * @param { number } row 행.
	 * @returns { number } 타일 값. (뒤집기 비트를 포함한 gid, 빈 칸은 0)
	 */
	getTile(column, row) {
		const chunkSize = this.getChunkSize();
		const chunkColumn = System.Math.floor(column / chunkSize);
		const chunkRow = System.Math.floor(row / chunkSize);
		const chunkTable = this.getChunkTable();
		const chunk = chunkTable.get(chunkColumn + "," + chunkRow);
		if (chunk === undefined) {
			return 0;
		}
		return chunk.tiles[(row - chunkRow * chunkSize) * chunkSize + (column - chunkColumn * chunkSize)];
	}

	//==============================================================================
	// 사각형 범위에 타일 값 한꺼번에 쓰기. (행 차례의 배열)
	//==============================================================================
	/**
	 * @param { number } column 왼쪽 열.
	 * @param { number } row 위 행.
	 * @param { number } width 열 수.
	 * @param { number } height 행 수.
	 * @param { ArrayLike<number> } tileList 타일 값. (width x height 개, 행마다 왼쪽에서 오른쪽, 모자라면 남은 칸은 그대로 둔다)
	 */
	setTiles(column, row, width, height, tileList) {
		for (let rowOffset = 0; rowOffset < height; ++rowOffset) {
			for (let columnOffset = 0; columnOffset < width; ++columnOffset) {
				const tileIndex = rowOffset * width + columnOffset;
				if (tileIndex >= tileList.length) {
					return;
				}
				this.setTile(column + columnOffset, row + rowOffset, tileList[tileIndex]);
			}
		}
	}

	//==============================================================================
	// 모든 칸 비우기.
	//==============================================================================
	clear() {
		const chunkTable = this.getChunkTable();
		chunkTable.clear();
		this.#sortedChunkList = null;
	}

	//==============================================================================
	// 빈 칸이 아닌 칸 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 칸 수.
	 */
	getTileCount() {
		let tileCount = 0;
		const chunkTable = this.getChunkTable();
		for (const chunk of chunkTable.values()) {
			tileCount += chunk.tileCount;
		}
		return tileCount;
	}

	//==============================================================================
	// 빈 칸이 아닌 칸을 모두 감싸는 칸 범위 셈하기. (유니티 Tilemap.cellBounds 를 줄인 것)
	//==============================================================================
	/**
	 * @returns { Rect } 칸 범위. (position 은 왼쪽 위 열과 행, size 는 열 수와 행 수, 비었으면 0 크기)
	 */
	readCellBounds() {
		const chunkSize = this.getChunkSize();
		const chunkTable = this.getChunkTable();
		let minimumColumn = System.Infinity;
		let minimumRow = System.Infinity;
		let maximumColumn = -System.Infinity;
		let maximumRow = -System.Infinity;
		for (const chunk of chunkTable.values()) {
			const tiles = chunk.tiles;
			for (let tileIndex = 0; tileIndex < tiles.length; ++tileIndex) {
				if (tiles[tileIndex] === 0) {
					continue;
				}
				const column = chunk.column * chunkSize + tileIndex % chunkSize;
				const row = chunk.row * chunkSize + System.Math.floor(tileIndex / chunkSize);
				minimumColumn = System.Math.min(minimumColumn, column);
				minimumRow = System.Math.min(minimumRow, row);
				maximumColumn = System.Math.max(maximumColumn, column);
				maximumRow = System.Math.max(maximumRow, row);
			}
		}
		if (minimumColumn === System.Infinity) {
			return Rect.zero();
		}
		return Rect.create(minimumColumn, minimumRow, maximumColumn - minimumColumn + 1, maximumRow - minimumRow + 1);
	}

	//==============================================================================
	// 덩이 목록 반환. (행, 열 차례, 빈 덩이는 없다)
	//==============================================================================
	/**
	 * @private
	 * @returns { object[] } { column, row, tiles: Uint32Array, tileCount } 목록. (열과 행은 덩이 단위)
	 */
	getChunkList() {
		if (this.#sortedChunkList === null) {
			const chunkTable = this.getChunkTable();
			const chunkList = System.Array.from(chunkTable.values());
			chunkList.sort((first, second) => {
				if (first.row !== second.row) {
					return first.row - second.row;
				}
				return first.column - second.column;
			});
			this.#sortedChunkList = chunkList;
		}
		return this.#sortedChunkList;
	}
}
