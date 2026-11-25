//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Rect } from "../base/rect.js";


//==============================================================================
// 그리드 유틸.
// - 연결성 검사(플러드필)와 타일 충돌 판정처럼 격자 게임마다 재발명되던 것을 모았다.
// - 칸의 통과 여부는 isPassableHandler(column, row) 콜백으로 정한다.
//==============================================================================
/**
 * @example <caption>이어진 칸 세기와 좌표 바꾸기</caption>
 * import { Grid } from "./build/vanilla.js";
 *
 * const mapRows = [
 * 	"..#.",
 * 	"..#.",
 * 	"..#.",
 * ];
 * const isPassable = (column, row) => {
 * 	return mapRows[row][column] === ".";
 * };
 * const visitedList = Grid.floodFill(4, 3, { column: 0, row: 0 }, isPassable);
 * console.log(visitedList.length);
 * console.log(Grid.isAllConnected(4, 3, { column: 0, row: 0 }, isPassable, 9));
 *
 * const cell = Grid.toCell(70, 20, 32);
 * const center = Grid.toWorldCenter(cell.column, cell.row, 32);
 * console.log(cell.column, cell.row, center.x, center.y);
 */
export class Grid extends Object {
	//==============================================================================
	// 플러드필. (정적)
	// - 시작 칸에서 상하좌우로 이어지는 통과 가능한 칸들을 모두 방문해 배열로 반환한다.
	//==============================================================================
	/**
	 * @param { number } columnCount 격자의 열 수.
	 * @param { number } rowCount 격자의 행 수.
	 * @param { object } start { column, row }
	 * @param { Function } isPassableHandler (column, row) => boolean
	 * @returns { object[] } 방문한 칸들의 { column, row } 배열.
	 */
	static floodFill(columnCount, rowCount, start, isPassableHandler) {
		const visitedList = [];
		if (start.column < 0 || start.column >= columnCount || start.row < 0 || start.row >= rowCount) {
			return visitedList;
		}
		if (!isPassableHandler(start.column, start.row)) {
			return visitedList;
		}
		const isVisited = new System.Uint8Array(columnCount * rowCount);
		const pendingStack = [start.column, start.row];
		isVisited[start.row * columnCount + start.column] = 1;
		while (pendingStack.length > 0) {
			const row = pendingStack.pop();
			const column = pendingStack.pop();
			visitedList.push({ column: column, row: row });
			const neighborOffsets = [[1, 0], [-1, 0], [0, 1], [0, -1]];
			for (const offset of neighborOffsets) {
				const nextColumn = column + offset[0];
				const nextRow = row + offset[1];
				if (nextColumn < 0 || nextColumn >= columnCount || nextRow < 0 || nextRow >= rowCount) {
					continue;
				}
				const nextIndex = nextRow * columnCount + nextColumn;
				if (isVisited[nextIndex]) {
					continue;
				}
				if (!isPassableHandler(nextColumn, nextRow)) {
					continue;
				}
				isVisited[nextIndex] = 1;
				pendingStack.push(nextColumn);
				pendingStack.push(nextRow);
			}
		}
		return visitedList;
	}

	//==============================================================================
	// 연결성 검사. (정적)
	// - 시작 칸에서 도달할 수 있는 칸 수가 expectedCount 와 같은지 판정한다.
	//   (예: 조립형 게임에서 모든 부품이 코어와 붙어 있는지)
	//==============================================================================
	/**
	 * @param { number } columnCount 격자의 열 수.
	 * @param { number } rowCount 격자의 행 수.
	 * @param { object } start { column, row }
	 * @param { Function } isPassableHandler (column, row) => boolean
	 * @param { number } expectedCount 이어져 있어야 할 칸 수. (시작 칸 포함)
	 * @returns { boolean } 시작 칸에서 닿는 칸 수가 expectedCount 와 같으면 참.
	 */
	static isAllConnected(columnCount, rowCount, start, isPassableHandler, expectedCount) {
		const visitedList = Grid.floodFill(columnCount, rowCount, start, isPassableHandler);
		return visitedList.length === expectedCount;
	}

	//==============================================================================
	// 사각형-타일 충돌 검사. (정적)
	// - 월드 사각형이 걸치는 타일 범위를 순회하며 막힌 타일과 겹치는지 판정한다.
	// - 이동 판정에서 "이동 후 위치가 장애물과 겹치면 취소" 용도로 쓴다.
	//==============================================================================
	/**
	 * @param { Rect } worldRect 검사할 월드 사각형.
	 * @param { number } tileSize 타일 한 칸의 크기. (월드 단위)
	 * @param { Function } isBlockedHandler (column, row) => boolean
	 * @returns { boolean } 막힌 타일과 겹치면 참.
	 * @example <caption>이동할 자리가 벽과 겹치는지 보기</caption>
	 * import { Grid, Rect } from "./build/vanilla.js";
	 *
	 * const mapRows = [
	 * 	"....",
	 * 	".#..",
	 * ];
	 * const isBlocked = (column, row) => {
	 * 	if (row < 0 || row >= mapRows.length || column < 0 || column >= mapRows[row].length) {
	 * 		return true;
	 * 	}
	 * 	return mapRows[row][column] === "#";
	 * };
	 * const nextRect = Rect.create(20, 20, 16, 16);
	 * console.log(Grid.testRectOverlap(nextRect, 32, isBlocked));
	 * const freeRect = Rect.create(70, 4, 16, 16);
	 * console.log(Grid.testRectOverlap(freeRect, 32, isBlocked));
	 */
	static testRectOverlap(worldRect, tileSize, isBlockedHandler) {
		const startColumn = System.Math.floor(worldRect.position.x / tileSize);
		const endColumn = System.Math.floor((worldRect.position.x + worldRect.size.x - 0.000001) / tileSize);
		const startRow = System.Math.floor(worldRect.position.y / tileSize);
		const endRow = System.Math.floor((worldRect.position.y + worldRect.size.y - 0.000001) / tileSize);
		for (let row = startRow; row <= endRow; ++row) {
			for (let column = startColumn; column <= endColumn; ++column) {
				if (isBlockedHandler(column, row)) {
					return true;
				}
			}
		}
		return false;
	}

	//==============================================================================
	// 월드 좌표 → 타일 좌표. (정적)
	//==============================================================================
	/**
	 * @param { number } worldX 월드 X 좌표.
	 * @param { number } worldY 월드 Y 좌표.
	 * @param { number } tileSize 타일 한 칸의 크기. (월드 단위)
	 * @returns { object } { column, row }
	 */
	static toCell(worldX, worldY, tileSize) {
		return { column: System.Math.floor(worldX / tileSize), row: System.Math.floor(worldY / tileSize) };
	}

	//==============================================================================
	// 타일 좌표 → 타일 중심 월드 좌표. (정적)
	//==============================================================================
	/**
	 * @param { number } column 열 번호.
	 * @param { number } row 행 번호.
	 * @param { number } tileSize 타일 한 칸의 크기. (월드 단위)
	 * @returns { object } { x, y }
	 */
	static toWorldCenter(column, row, tileSize) {
		return { x: (column + 0.5) * tileSize, y: (row + 0.5) * tileSize };
	}
}
