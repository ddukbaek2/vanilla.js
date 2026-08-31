//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";


//==============================================================================
// 그리드 길찾기. (A*)
// - 4방향 이동, 맨해튼 거리 휴리스틱, 이진 최소 힙으로 열린 목록을 관리한다.
// - isBlockedHandler(column, row) 가 참이면 막힌 칸이다.
// - 결과는 시작 칸을 제외하고 도착 칸까지의 { column, row } 배열. 길이 없으면 null.
//==============================================================================
export class PathFinder extends Object {
	//==============================================================================
	// 경로 탐색. (정적)
	//==============================================================================
	/**
	 * @param { number } columnCount
	 * @param { number } rowCount
	 * @param { object } start { column, row }
	 * @param { object } goal { column, row }
	 * @param { Function } isBlockedHandler (column, row) => boolean
	 * @returns { object[] | null }
	 */
	static findPath(columnCount, rowCount, start, goal, isBlockedHandler) {
		const isInside = (column, row) => {
			return column >= 0 && column < columnCount && row >= 0 && row < rowCount;
		};
		if (!isInside(start.column, start.row) || !isInside(goal.column, goal.row)) {
			return null;
		}
		if (isBlockedHandler(goal.column, goal.row)) {
			return null;
		}
		if (start.column === goal.column && start.row === goal.row) {
			return [];
		}

		const cellCount = columnCount * rowCount;
		const toIndex = (column, row) => {
			return row * columnCount + column;
		};
		const costFromStart = new System.Float64Array(cellCount).fill(System.Number.POSITIVE_INFINITY);
		const cameFrom = new System.Int32Array(cellCount).fill(-1);
		const isClosed = new System.Uint8Array(cellCount);
		const heuristic = (column, row) => {
			return System.Math.abs(column - goal.column) + System.Math.abs(row - goal.row);
		};

		// 열린 목록: [예상 총비용, 셀 번호] 쌍의 이진 최소 힙.
		const heapScores = [];
		const heapIndices = [];
		const heapPush = (score, index) => {
			heapScores.push(score);
			heapIndices.push(index);
			let childPosition = heapScores.length - 1;
			while (childPosition > 0) {
				const parentPosition = (childPosition - 1) >> 1;
				if (heapScores[parentPosition] <= heapScores[childPosition]) {
					break;
				}
				const scoreTemporary = heapScores[parentPosition];
				heapScores[parentPosition] = heapScores[childPosition];
				heapScores[childPosition] = scoreTemporary;
				const indexTemporary = heapIndices[parentPosition];
				heapIndices[parentPosition] = heapIndices[childPosition];
				heapIndices[childPosition] = indexTemporary;
				childPosition = parentPosition;
			}
		};
		const heapPop = () => {
			const topIndex = heapIndices[0];
			const lastScore = heapScores.pop();
			const lastIndex = heapIndices.pop();
			if (heapScores.length > 0) {
				heapScores[0] = lastScore;
				heapIndices[0] = lastIndex;
				let parentPosition = 0;
				while (true) {
					const leftPosition = parentPosition * 2 + 1;
					const rightPosition = leftPosition + 1;
					let smallestPosition = parentPosition;
					if (leftPosition < heapScores.length && heapScores[leftPosition] < heapScores[smallestPosition]) {
						smallestPosition = leftPosition;
					}
					if (rightPosition < heapScores.length && heapScores[rightPosition] < heapScores[smallestPosition]) {
						smallestPosition = rightPosition;
					}
					if (smallestPosition === parentPosition) {
						break;
					}
					const scoreTemporary = heapScores[parentPosition];
					heapScores[parentPosition] = heapScores[smallestPosition];
					heapScores[smallestPosition] = scoreTemporary;
					const indexTemporary = heapIndices[parentPosition];
					heapIndices[parentPosition] = heapIndices[smallestPosition];
					heapIndices[smallestPosition] = indexTemporary;
					parentPosition = smallestPosition;
				}
			}
			return topIndex;
		};

		const startIndex = toIndex(start.column, start.row);
		const goalIndex = toIndex(goal.column, goal.row);
		costFromStart[startIndex] = 0;
		heapPush(heuristic(start.column, start.row), startIndex);

		const neighborOffsets = [[1, 0], [-1, 0], [0, 1], [0, -1]];
		while (heapScores.length > 0) {
			const currentIndex = heapPop();
			if (currentIndex === goalIndex) {
				// 경로 역추적.
				const path = [];
				let traceIndex = goalIndex;
				while (traceIndex !== startIndex) {
					path.push({ column: traceIndex % columnCount, row: System.Math.floor(traceIndex / columnCount) });
					traceIndex = cameFrom[traceIndex];
				}
				path.reverse();
				return path;
			}
			if (isClosed[currentIndex]) {
				continue;
			}
			isClosed[currentIndex] = 1;

			const currentColumn = currentIndex % columnCount;
			const currentRow = System.Math.floor(currentIndex / columnCount);
			for (const offset of neighborOffsets) {
				const nextColumn = currentColumn + offset[0];
				const nextRow = currentRow + offset[1];
				if (!isInside(nextColumn, nextRow)) {
					continue;
				}
				if (isBlockedHandler(nextColumn, nextRow)) {
					continue;
				}
				const nextIndex = toIndex(nextColumn, nextRow);
				if (isClosed[nextIndex]) {
					continue;
				}
				const nextCost = costFromStart[currentIndex] + 1;
				if (nextCost < costFromStart[nextIndex]) {
					costFromStart[nextIndex] = nextCost;
					cameFrom[nextIndex] = currentIndex;
					heapPush(nextCost + heuristic(nextColumn, nextRow), nextIndex);
				}
			}
		}
		return null;
	}
}
