//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Matrix4 } from "../../../base/matrix4.js";


//==============================================================================
// 3D 모형 짓기. (기본 도형을 코드로 지어 꼭짓점 배열 하나에 담음)
//
// 툰 3D(점토 같은 한 색 재질과 바깥선)를 그릴 꼭짓점 배열을 짓는다. 외계행성 광부 키우기의 판 3D 에서 왔다. (three.js 의 기본 도형과 같은 꼴)
//   - 도형은 가운데가 원점인 자기 좌표로 짓는다. 부품을 더할 때 자리, 돌림, 크기를 곱해 한 덩어리에 담는다.
//   - 꼭짓점 하나는 자리 3, 노멀 3, 색 3(sRGB), 재질 2(빛남의 세기, 빛을 받지 않음), 무늬 4(무늬 번호, 무늬 색) 이다. 무늬 번호와 색의 뜻은 그리는 셰이더가 정한다. (0 이면 무늬 없음)
//   - 바깥선은 부품을 조금 키운 사본이다. 뒷면만 그리므로 따로 담는다. (inverted hull)
//   - 삼각형의 감기는 꼭짓점 노멀을 보고 바깥이 앞면이 되게 맞춘다. (뒷면 가리기와 바깥선이 감기에 기댐)
//==============================================================================

// 꼭짓점 하나의 수 개수. (자리 3, 노멀 3, 색 3, 재질 2, 무늬 4)
export const VERTEX_FLOAT_COUNT = 15;
// 뼈대가 있는 모형의 꼭짓점마다 따로 담는 수 개수. (뼈대 번호 4, 무게 4)
export const SKIN_FLOAT_COUNT = 8;

// 바깥선의 기본 굵기. (칸 폭 1 에 대한, 판 위의 바깥선은 모두 이 굵기 하나)
const DEFAULT_OUTLINE_WIDTH = 0.02;

// 바깥선을 모서리에서 더 밀 때 쓰는 가장 작은 코사인. (뾰족한 끝이 굵기의 1.18 배보다 튀지 않게, readOutlineOffsets)
//   0.5(두 배)였을 때 면마다 꺾인 뾰족한 결정의 끝에서 선이 두 배로 뭉쳤다. 더 뾰족한 끝은 그 둘레의 면 쪽 선이 조금 가늘어진다.
const MINIMUM_OUTLINE_MITER_COSINE = 0.85;

// 감기를 맞출 때 넓이가 이보다 작은 삼각형은 그대로 둔다. (구의 극처럼 겹친 점)
const DEGENERATE_AREA = 1e-12;


//==============================================================================
// 색 글자를 sRGB 세 수로. ("#rrggbb" → [r, g, b], 0 ~ 1)
//==============================================================================
/**
 * @param { string } colorText
 * @returns { Array<number> }
 */
export function readColorValues(colorText) {
	const value = System.parseInt(colorText.slice(1), 16);
	return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

//==============================================================================
// 자리, 돌림, 크기로 변환 행렬 짓기. (부모 행렬 뒤에 곱함, 돌림은 three.js 의 기본 차례 XYZ)
//==============================================================================
/**
 * @param { Matrix4 | null } parentMatrix
 * @param { Array<number> } position [x, y, z]
 * @param { Array<number> | null } rotation [x, y, z] 라디안.
 * @param { Array<number> | null } scale [x, y, z]
 * @returns { Matrix4 }
 */
export function createPartMatrix(parentMatrix, position, rotation, scale) {
	const matrix = parentMatrix !== null ? parentMatrix.clone() : Matrix4.createIdentity();
	matrix.translate(position[0], position[1], position[2]);
	if (rotation !== null) {
		matrix.rotateX(rotation[0]);
		matrix.rotateY(rotation[1]);
		matrix.rotateZ(rotation[2]);
	}
	if (scale !== null) {
		matrix.scale(scale[0], scale[1], scale[2]);
	}
	return matrix;
}


//==============================================================================
// 기본 도형. ({ positions, normals, indices }, 가운데가 원점)
//==============================================================================

//==============================================================================
// 네모 상자. (면마다 꼭짓점을 따로 두어 모서리가 날카로움)
//==============================================================================
/**
 * @param { number } width
 * @param { number } height
 * @param { number } depth
 * @returns { object }
 */
export function createBoxGeometry(width, height, depth) {
	const geometry = { positions: [], normals: [], indices: [] };
	const halfSizes = [width * 0.5, height * 0.5, depth * 0.5];
	for (let axisIndex = 0; axisIndex < 3; ++axisIndex) {
		for (const sign of [-1, 1]) {
			const firstAxis = (axisIndex + 1) % 3;
			const secondAxis = (axisIndex + 2) % 3;
			const startIndex = geometry.positions.length / 3;
			for (const [firstSign, secondSign] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
				const point = [0, 0, 0];
				point[axisIndex] = halfSizes[axisIndex] * sign;
				point[firstAxis] = halfSizes[firstAxis] * firstSign;
				point[secondAxis] = halfSizes[secondAxis] * secondSign;
				const normal = [0, 0, 0];
				normal[axisIndex] = sign;
				geometry.positions.push(point[0], point[1], point[2]);
				geometry.normals.push(normal[0], normal[1], normal[2]);
			}
			geometry.indices.push(startIndex, startIndex + 1, startIndex + 2, startIndex, startIndex + 2, startIndex + 3);
		}
	}
	return geometry;
}

//==============================================================================
// 모서리가 둥근 상자. (면마다 격자를 깔고 안쪽 상자에서 반지름만큼 밀어냄)
//==============================================================================
/**
 * @param { number } width
 * @param { number } height
 * @param { number } depth
 * @param { number } segments 둥근 곳의 마디 수.
 * @param { number } radius
 * @returns { object }
 */
export function createRoundedBoxGeometry(width, height, depth, segments, radius) {
	const geometry = { positions: [], normals: [], indices: [] };
	const halfSizes = [width * 0.5, height * 0.5, depth * 0.5];
	const innerSizes = halfSizes.map((halfSize) => {
		return System.Math.max(0, halfSize - radius);
	});
	// 축마다 격자의 자리. (둥근 곳은 마디 수만큼, 가운데 평평한 곳은 한 칸)
	const axisSamples = halfSizes.map((halfSize, axisIndex) => {
		const innerSize = innerSizes[axisIndex];
		const samples = [];
		for (let segmentIndex = 0; segmentIndex <= segments; ++segmentIndex) {
			samples.push(-halfSize + (halfSize - innerSize) * segmentIndex / segments);
		}
		for (let segmentIndex = 0; segmentIndex <= segments; ++segmentIndex) {
			samples.push(innerSize + (halfSize - innerSize) * segmentIndex / segments);
		}
		return samples;
	});
	for (let axisIndex = 0; axisIndex < 3; ++axisIndex) {
		for (const sign of [-1, 1]) {
			const firstAxis = (axisIndex + 1) % 3;
			const secondAxis = (axisIndex + 2) % 3;
			const firstSamples = axisSamples[firstAxis];
			const secondSamples = axisSamples[secondAxis];
			const startIndex = geometry.positions.length / 3;
			for (const secondValue of secondSamples) {
				for (const firstValue of firstSamples) {
					const point = [0, 0, 0];
					point[axisIndex] = halfSizes[axisIndex] * sign;
					point[firstAxis] = firstValue;
					point[secondAxis] = secondValue;
					const inner = point.map((value, valueIndex) => {
						return System.Math.max(-innerSizes[valueIndex], System.Math.min(innerSizes[valueIndex], value));
					});
					const direction = [point[0] - inner[0], point[1] - inner[1], point[2] - inner[2]];
					const length = System.Math.hypot(direction[0], direction[1], direction[2]);
					const normal = length > 0 ? direction.map((value) => {
						return value / length;
					}) : [0, 0, 0];
					if (length <= 0) {
						normal[axisIndex] = sign;
					}
					geometry.positions.push(inner[0] + normal[0] * radius, inner[1] + normal[1] * radius, inner[2] + normal[2] * radius);
					geometry.normals.push(normal[0], normal[1], normal[2]);
				}
			}
			const rowLength = firstSamples.length;
			for (let secondIndex = 0; secondIndex < secondSamples.length - 1; ++secondIndex) {
				for (let firstIndex = 0; firstIndex < rowLength - 1; ++firstIndex) {
					const corner = startIndex + secondIndex * rowLength + firstIndex;
					geometry.indices.push(corner, corner + 1, corner + rowLength + 1, corner, corner + rowLength + 1, corner + rowLength);
				}
			}
		}
	}
	return geometry;
}

//==============================================================================
// 원기둥. (위와 아래 반지름이 다르면 깔때기, 위가 0 이면 원뿔, 위아래 뚜껑 포함)
//==============================================================================
/**
 * @param { number } radiusTop
 * @param { number } radiusBottom
 * @param { number } height
 * @param { number } radialSegments
 * @returns { object }
 */
export function createCylinderGeometry(radiusTop, radiusBottom, height, radialSegments) {
	const geometry = { positions: [], normals: [], indices: [] };
	const halfHeight = height * 0.5;
	const slope = (radiusBottom - radiusTop) / height;
	// 옆면.
	const sideStart = 0;
	for (let segmentIndex = 0; segmentIndex <= radialSegments; ++segmentIndex) {
		const angle = segmentIndex / radialSegments * System.Math.PI * 2;
		const sine = System.Math.sin(angle);
		const cosine = System.Math.cos(angle);
		const normalLength = System.Math.hypot(1, slope);
		geometry.positions.push(radiusTop * sine, halfHeight, radiusTop * cosine);
		geometry.normals.push(sine / normalLength, slope / normalLength, cosine / normalLength);
		geometry.positions.push(radiusBottom * sine, -halfHeight, radiusBottom * cosine);
		geometry.normals.push(sine / normalLength, slope / normalLength, cosine / normalLength);
	}
	for (let segmentIndex = 0; segmentIndex < radialSegments; ++segmentIndex) {
		const top = sideStart + segmentIndex * 2;
		geometry.indices.push(top, top + 1, top + 3, top, top + 3, top + 2);
	}
	// 뚜껑.
	for (const [radius, sign] of [[radiusTop, 1], [radiusBottom, -1]]) {
		if (radius <= 0) {
			continue;
		}
		const centerIndex = geometry.positions.length / 3;
		geometry.positions.push(0, halfHeight * sign, 0);
		geometry.normals.push(0, sign, 0);
		for (let segmentIndex = 0; segmentIndex <= radialSegments; ++segmentIndex) {
			const angle = segmentIndex / radialSegments * System.Math.PI * 2;
			geometry.positions.push(radius * System.Math.sin(angle), halfHeight * sign, radius * System.Math.cos(angle));
			geometry.normals.push(0, sign, 0);
		}
		for (let segmentIndex = 0; segmentIndex < radialSegments; ++segmentIndex) {
			geometry.indices.push(centerIndex, centerIndex + 1 + segmentIndex, centerIndex + 2 + segmentIndex);
		}
	}
	return geometry;
}

//==============================================================================
// 구. (위에서부터 thetaLength 까지, π/2 면 위쪽 반구)
//==============================================================================
/**
 * @param { number } radius
 * @param { number } widthSegments
 * @param { number } heightSegments
 * @param { number } [thetaLength]
 * @returns { object }
 */
export function createSphereGeometry(radius, widthSegments, heightSegments, thetaLength = System.Math.PI) {
	const geometry = { positions: [], normals: [], indices: [] };
	for (let heightIndex = 0; heightIndex <= heightSegments; ++heightIndex) {
		const theta = heightIndex / heightSegments * thetaLength;
		for (let widthIndex = 0; widthIndex <= widthSegments; ++widthIndex) {
			const phi = widthIndex / widthSegments * System.Math.PI * 2;
			const normalX = System.Math.sin(theta) * System.Math.sin(phi);
			const normalY = System.Math.cos(theta);
			const normalZ = System.Math.sin(theta) * System.Math.cos(phi);
			geometry.positions.push(normalX * radius, normalY * radius, normalZ * radius);
			geometry.normals.push(normalX, normalY, normalZ);
		}
	}
	const rowLength = widthSegments + 1;
	for (let heightIndex = 0; heightIndex < heightSegments; ++heightIndex) {
		for (let widthIndex = 0; widthIndex < widthSegments; ++widthIndex) {
			const corner = heightIndex * rowLength + widthIndex;
			geometry.indices.push(corner, corner + rowLength, corner + rowLength + 1, corner, corner + rowLength + 1, corner + 1);
		}
	}
	return geometry;
}

//==============================================================================
// 돌려 깎기. (옆모습의 점 [x, y] 들을 Y 축으로 돌림, 노멀은 옆모습의 기울기로)
//==============================================================================
/**
 * @param { Array<Array<number>> } points 아래에서 위로.
 * @param { number } segments
 * @returns { object }
 */
export function createLatheGeometry(points, segments) {
	const geometry = { positions: [], normals: [], indices: [] };
	const profileNormals = points.map((point, pointIndex) => {
		const previous = points[System.Math.max(0, pointIndex - 1)];
		const next = points[System.Math.min(points.length - 1, pointIndex + 1)];
		const tangentX = next[0] - previous[0];
		const tangentY = next[1] - previous[1];
		const length = System.Math.hypot(tangentX, tangentY);
		if (length <= 0) {
			return [1, 0];
		}
		return [tangentY / length, -tangentX / length];
	});
	for (let segmentIndex = 0; segmentIndex <= segments; ++segmentIndex) {
		const phi = segmentIndex / segments * System.Math.PI * 2;
		const sine = System.Math.sin(phi);
		const cosine = System.Math.cos(phi);
		for (let pointIndex = 0; pointIndex < points.length; ++pointIndex) {
			const point = points[pointIndex];
			const profileNormal = profileNormals[pointIndex];
			geometry.positions.push(point[0] * sine, point[1], point[0] * cosine);
			geometry.normals.push(profileNormal[0] * sine, profileNormal[1], profileNormal[0] * cosine);
		}
	}
	const rowLength = points.length;
	for (let segmentIndex = 0; segmentIndex < segments; ++segmentIndex) {
		for (let pointIndex = 0; pointIndex < rowLength - 1; ++pointIndex) {
			const corner = segmentIndex * rowLength + pointIndex;
			geometry.indices.push(corner, corner + rowLength, corner + rowLength + 1, corner, corner + rowLength + 1, corner + 1);
		}
	}
	return geometry;
}

//==============================================================================
// 캡슐. (가운데 길이 length 의 원기둥 위아래에 반구, 전체 높이는 length + 반지름 둘)
//==============================================================================
/**
 * @param { number } radius
 * @param { number } length
 * @param { number } capSegments
 * @param { number } radialSegments
 * @returns { object }
 */
export function createCapsuleGeometry(radius, length, capSegments, radialSegments) {
	const points = [];
	const halfLength = length * 0.5;
	for (let segmentIndex = 0; segmentIndex <= capSegments; ++segmentIndex) {
		const angle = -System.Math.PI * 0.5 + segmentIndex / capSegments * System.Math.PI * 0.5;
		points.push([System.Math.cos(angle) * radius, -halfLength + System.Math.sin(angle) * radius]);
	}
	for (let segmentIndex = 0; segmentIndex <= capSegments; ++segmentIndex) {
		const angle = segmentIndex / capSegments * System.Math.PI * 0.5;
		points.push([System.Math.cos(angle) * radius, halfLength + System.Math.sin(angle) * radius]);
	}
	return createLatheGeometry(points, radialSegments);
}

//==============================================================================
// 고리. (XY 평면에 누운 고리, arc 만큼만)
//==============================================================================
/**
 * @param { number } radius 고리의 반지름.
 * @param { number } tube 관의 반지름.
 * @param { number } radialSegments 관을 도는 마디.
 * @param { number } tubularSegments 고리를 도는 마디.
 * @param { number } [arc]
 * @returns { object }
 */
export function createTorusGeometry(radius, tube, radialSegments, tubularSegments, arc = System.Math.PI * 2) {
	const geometry = { positions: [], normals: [], indices: [] };
	for (let radialIndex = 0; radialIndex <= radialSegments; ++radialIndex) {
		const tubeAngle = radialIndex / radialSegments * System.Math.PI * 2;
		for (let tubularIndex = 0; tubularIndex <= tubularSegments; ++tubularIndex) {
			const ringAngle = tubularIndex / tubularSegments * arc;
			const centerX = radius * System.Math.cos(ringAngle);
			const centerY = radius * System.Math.sin(ringAngle);
			const normalX = System.Math.cos(tubeAngle) * System.Math.cos(ringAngle);
			const normalY = System.Math.cos(tubeAngle) * System.Math.sin(ringAngle);
			const normalZ = System.Math.sin(tubeAngle);
			geometry.positions.push(centerX + normalX * tube, centerY + normalY * tube, normalZ * tube);
			geometry.normals.push(normalX, normalY, normalZ);
		}
	}
	const rowLength = tubularSegments + 1;
	for (let radialIndex = 0; radialIndex < radialSegments; ++radialIndex) {
		for (let tubularIndex = 0; tubularIndex < tubularSegments; ++tubularIndex) {
			const corner = radialIndex * rowLength + tubularIndex;
			geometry.indices.push(corner, corner + rowLength, corner + rowLength + 1, corner, corner + rowLength + 1, corner + 1);
		}
	}
	return geometry;
}

//==============================================================================
// 팔면체. (면마다 꼭짓점을 따로 두어 각진 결정)
//==============================================================================
/**
 * @param { number } radius
 * @returns { object }
 */
export function createOctahedronGeometry(radius) {
	const geometry = { positions: [], normals: [], indices: [] };
	for (const signX of [-1, 1]) {
		for (const signY of [-1, 1]) {
			for (const signZ of [-1, 1]) {
				const corners = [[radius * signX, 0, 0], [0, radius * signY, 0], [0, 0, radius * signZ]];
				const normalLength = System.Math.sqrt(3);
				const startIndex = geometry.positions.length / 3;
				for (const corner of corners) {
					geometry.positions.push(corner[0], corner[1], corner[2]);
					geometry.normals.push(signX / normalLength, signY / normalLength, signZ / normalLength);
				}
				geometry.indices.push(startIndex, startIndex + 1, startIndex + 2);
			}
		}
	}
	return geometry;
}

//==============================================================================
// 각진 돌덩이. (이십면체의 꼭짓점 열둘을 저마다 늘이고 줄여, 면마다 꼭짓점을 따로 둔 깎은 돌)
//==============================================================================
/**
 * @param { number } radius
 * @param { Array<number> } vertexScales 꼭짓점 열둘의 반지름 배. (모자라면 처음부터 되풀이)
 * @param { Array<number> } axisScale [x, y, z] 배.
 * @returns { object } { positions, normals, indices }
 */
export function createFacetedChunkGeometry(radius, vertexScales, axisScale) {
	const geometry = { positions: [], normals: [], indices: [] };
	const golden = (1 + System.Math.sqrt(5)) / 2;
	const baseCorners = [[-1, golden, 0], [1, golden, 0], [-1, -golden, 0], [1, -golden, 0], [0, -1, golden], [0, 1, golden], [0, -1, -golden], [0, 1, -golden], [golden, 0, -1], [golden, 0, 1], [-golden, 0, -1], [-golden, 0, 1]];
	const faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
	const scaleCount = vertexScales.length;
	const corners = baseCorners.map((corner, cornerIndex) => {
		const length = System.Math.hypot(corner[0], corner[1], corner[2]);
		const vertexScale = scaleCount > 0 ? vertexScales[cornerIndex % scaleCount] : 1;
		const scale = radius * vertexScale / length;
		return [corner[0] * scale * axisScale[0], corner[1] * scale * axisScale[1], corner[2] * scale * axisScale[2]];
	});
	for (const face of faces) {
		const first = corners[face[0]];
		let second = corners[face[1]];
		let third = corners[face[2]];
		const edgeA = [second[0] - first[0], second[1] - first[1], second[2] - first[2]];
		const edgeB = [third[0] - first[0], third[1] - first[1], third[2] - first[2]];
		let normal = [edgeA[1] * edgeB[2] - edgeA[2] * edgeB[1], edgeA[2] * edgeB[0] - edgeA[0] * edgeB[2], edgeA[0] * edgeB[1] - edgeA[1] * edgeB[0]];
		const centroid = [first[0] + second[0] + third[0], first[1] + second[1] + third[1], first[2] + second[2] + third[2]];
		// 바깥을 보게 차례를 맞춘다.
		if (normal[0] * centroid[0] + normal[1] * centroid[1] + normal[2] * centroid[2] < 0) {
			const swapped = second;
			second = third;
			third = swapped;
			normal = [-normal[0], -normal[1], -normal[2]];
		}
		const normalLength = System.Math.max(0.000001, System.Math.hypot(normal[0], normal[1], normal[2]));
		const startIndex = geometry.positions.length / 3;
		for (const corner of [first, second, third]) {
			geometry.positions.push(corner[0], corner[1], corner[2]);
			geometry.normals.push(normal[0] / normalLength, normal[1] / normalLength, normal[2] / normalLength);
		}
		geometry.indices.push(startIndex, startIndex + 1, startIndex + 2);
	}
	return geometry;
}


//==============================================================================
// 모형 한 덩어리를 짓는 것.
//==============================================================================
export class MeshBuilder {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Array<number> } */ #vertices; // 꼭짓점의 수. (VERTEX_FLOAT_COUNT 씩)
	/** @private @type { Array<number> } */ #indices;
	/** @private @type { Array<number> } */ #outlinePositions; // 바깥선 사본의 자리. (3 씩)
	/** @private @type { Array<number> } */ #outlineBasePositions; // 바깥선 사본의 점마다 밀기 전 몸의 자리. (3 씩, 받은 껍데기는 그 자리 그대로)
	/** @private @type { Array<number> } */ #outlineIndices;
	/** @private @type { Array<number> } */ #skinValues; // 꼭짓점마다 뼈대 번호 넷과 무게 넷. (뼈대가 있는 모형만, SKIN_FLOAT_COUNT 씩)
	/** @private @type { Array<number> } */ #outlineSkinValues;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		this.#vertices = [];
		this.#indices = [];
		this.#outlinePositions = [];
		this.#outlineBasePositions = [];
		this.#outlineIndices = [];
		this.#skinValues = [];
		this.#outlineSkinValues = [];
	}

	//==============================================================================
	// 비었는지.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isEmpty() {
		return this.#indices.length === 0;
	}

	//==============================================================================
	// 지금까지 담은 몸의 꼭짓점 번호 수. (한 부위의 몸이 든 자리를 따로 그릴 때 그 앞뒤로 읽음)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getIndexCount() {
		return this.#indices.length;
	}

	//==============================================================================
	// 지금까지 담은 바깥선 껍데기의 꼭짓점 번호 수. (한 부위의 껍데기가 든 자리를 따로 그릴 때 그 앞뒤로 읽음)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getOutlineIndexCount() {
		return this.#outlineIndices.length;
	}

	//==============================================================================
	// 부품 하나 더하기. (도형에 행렬을 곱해 담고, 바깥선이면 조금 키운 사본도 담음)
	//==============================================================================
	/**
	 * @param { object } geometry { positions, normals, indices }
	 * @param { Matrix4 } matrix
	 * @param { string } colorText "#rrggbb"
	 * @param { object } [options] { glow 빛남(0 ~), isUnlit 빛을 받지 않음, hasOutline 바깥선(기본 있음), outlineWidth 바깥선 굵기 }
	 */
	addPart(geometry, matrix, colorText, options = {}) {
		const color = readColorValues(colorText);
		const glow = options.glow !== undefined ? options.glow : 0;
		const unlit = options.isUnlit === true ? 1 : 0;
		const hasOutline = options.hasOutline !== false;
		const outlineWidth = options.outlineWidth !== undefined ? options.outlineWidth : DEFAULT_OUTLINE_WIDTH;
		const elements = matrix.getElements();
		const normalMatrix = this.readNormalMatrix(elements);
		const positions = geometry.positions;
		const normals = geometry.normals;
		const startIndex = this.#vertices.length / VERTEX_FLOAT_COUNT;
		const worldPositions = [];
		const worldNormals = [];
		for (let pointIndex = 0; pointIndex < positions.length; pointIndex += 3) {
			const transformedPoint = matrix.transformPoint(positions[pointIndex], positions[pointIndex + 1], positions[pointIndex + 2]);
			const normalX = normalMatrix[0] * normals[pointIndex] + normalMatrix[1] * normals[pointIndex + 1] + normalMatrix[2] * normals[pointIndex + 2];
			const normalY = normalMatrix[3] * normals[pointIndex] + normalMatrix[4] * normals[pointIndex + 1] + normalMatrix[5] * normals[pointIndex + 2];
			const normalZ = normalMatrix[6] * normals[pointIndex] + normalMatrix[7] * normals[pointIndex + 1] + normalMatrix[8] * normals[pointIndex + 2];
			const normalLength = System.Math.hypot(normalX, normalY, normalZ);
			const unitX = normalLength > 0 ? normalX / normalLength : 0;
			const unitY = normalLength > 0 ? normalY / normalLength : 1;
			const unitZ = normalLength > 0 ? normalZ / normalLength : 0;
			worldPositions.push(transformedPoint.x, transformedPoint.y, transformedPoint.z);
			worldNormals.push(unitX, unitY, unitZ);
			this.#vertices.push(transformedPoint.x, transformedPoint.y, transformedPoint.z, unitX, unitY, unitZ, color[0], color[1], color[2], glow, unlit, 0, 0, 0, 0);
		}
		const flips = this.readTriangleFlips(geometry.indices, worldPositions, worldNormals);
		this.pushTriangles(this.#indices, geometry.indices, flips, startIndex);
		if (!hasOutline) {
			return;
		}
		// 바깥선 사본. (변환한 점마다 바깥으로 굵기만큼 밀어, 부품의 모양과 크기와 상관없이 어디서나 같은 굵기)
		const offsets = this.readOutlineOffsets(worldPositions, worldNormals, outlineWidth);
		const outlineStartIndex = this.#outlinePositions.length / 3;
		for (let pointIndex = 0; pointIndex < worldPositions.length; pointIndex += 3) {
			const pointX = worldPositions[pointIndex] + offsets[pointIndex];
			const pointY = worldPositions[pointIndex + 1] + offsets[pointIndex + 1];
			const pointZ = worldPositions[pointIndex + 2] + offsets[pointIndex + 2];
			this.#outlinePositions.push(pointX, pointY, pointZ);
			this.#outlineBasePositions.push(worldPositions[pointIndex], worldPositions[pointIndex + 1], worldPositions[pointIndex + 2]);
		}
		this.pushShellTriangles(this.#outlineIndices, geometry.indices, flips, outlineStartIndex, worldPositions, offsets);
	}

	//==============================================================================
	// 네모 면 하나 더하기. (블록 지형과 바닥 같은 면, 네 점은 둘레 차례, 바깥선 없음)
	//==============================================================================
	/**
	 * @param { Array<Array<number>> } corners 네 점 [x, y, z]
	 * @param { Array<number> } normal [x, y, z]
	 * @param { Array<number> } color [r, g, b] sRGB.
	 * @param { number } pattern 무늬 번호. (뜻은 셰이더가 정함, 0 이면 없음)
	 * @param { Array<number> | null } patternColor [r, g, b] 무늬 색. (없으면 null)
	 * @param { boolean } isUnlit 빛을 받지 않음.
	 */
	addQuad(corners, normal, color, pattern, patternColor, isUnlit) {
		const startIndex = this.#vertices.length / VERTEX_FLOAT_COUNT;
		const patternRed = patternColor !== null ? patternColor[0] : 0;
		const patternGreen = patternColor !== null ? patternColor[1] : 0;
		const patternBlue = patternColor !== null ? patternColor[2] : 0;
		const unlit = isUnlit ? 1 : 0;
		for (const corner of corners) {
			this.#vertices.push(corner[0], corner[1], corner[2], normal[0], normal[1], normal[2], color[0], color[1], color[2], 0, unlit, pattern, patternRed, patternGreen, patternBlue);
		}
		// 첫 삼각형의 면 노멀이 주어진 노멀과 반대면 감기를 뒤집는다.
		const firstEdge = [corners[1][0] - corners[0][0], corners[1][1] - corners[0][1], corners[1][2] - corners[0][2]];
		const secondEdge = [corners[2][0] - corners[0][0], corners[2][1] - corners[0][1], corners[2][2] - corners[0][2]];
		const faceNormalX = firstEdge[1] * secondEdge[2] - firstEdge[2] * secondEdge[1];
		const faceNormalY = firstEdge[2] * secondEdge[0] - firstEdge[0] * secondEdge[2];
		const faceNormalZ = firstEdge[0] * secondEdge[1] - firstEdge[1] * secondEdge[0];
		const isFlipped = faceNormalX * normal[0] + faceNormalY * normal[1] + faceNormalZ * normal[2] < 0;
		if (isFlipped) {
			this.#indices.push(startIndex, startIndex + 2, startIndex + 1, startIndex, startIndex + 3, startIndex + 2);
		}
		else {
			this.#indices.push(startIndex, startIndex + 1, startIndex + 2, startIndex, startIndex + 2, startIndex + 3);
		}
	}

	//==============================================================================
	// 네모 면들의 바깥선 껍데기 담기. (땅 덩어리처럼 면으로 지은 것)
	//   - 꼭짓점 자리를 1e-4 로 반올림한 것을 열쇠로 삼아 열쇠마다 서로 다른 면 법선을 한 번씩 더해 정규화하고, 꼭짓점을 그쪽으로 굵기만큼 민다.
	//   - 면의 감기는 addQuad 와 같다. (그리는 쪽이 앞면을 가려 뒷면만 보인다)
	//==============================================================================
	/**
	 * @param { Array<object> } quads { corners 네 점 [x, y, z], normal [x, y, z] }
	 * @param { number } outlineWidth
	 */
	addQuadShell(quads, outlineWidth) {
		const readPointKey = (corner) => {
			return System.Math.round(corner[0] * 10000) + "," + System.Math.round(corner[1] * 10000) + "," + System.Math.round(corner[2] * 10000);
		};
		const pointNormals = new System.Map();
		for (const quad of quads) {
			const normal = quad.normal;
			const normalKey = System.Math.round(normal[0] * 1000) + "," + System.Math.round(normal[1] * 1000) + "," + System.Math.round(normal[2] * 1000);
			for (const corner of quad.corners) {
				const pointKey = readPointKey(corner);
				let entry = pointNormals.get(pointKey);
				if (entry === undefined) {
					entry = { normalKeys: [], sum: [0, 0, 0] };
					pointNormals.set(pointKey, entry);
				}
				if (entry.normalKeys.includes(normalKey)) {
					continue;
				}
				entry.normalKeys.push(normalKey);
				entry.sum[0] += normal[0];
				entry.sum[1] += normal[1];
				entry.sum[2] += normal[2];
			}
		}
		for (const quad of quads) {
			const corners = quad.corners;
			const normal = quad.normal;
			const startIndex = this.#outlinePositions.length / 3;
			for (const corner of corners) {
				const entry = pointNormals.get(readPointKey(corner));
				const sumLength = System.Math.hypot(entry.sum[0], entry.sum[1], entry.sum[2]);
				const scale = sumLength > 0 ? outlineWidth / sumLength : 0;
				this.#outlinePositions.push(corner[0] + entry.sum[0] * scale, corner[1] + entry.sum[1] * scale, corner[2] + entry.sum[2] * scale);
				this.#outlineBasePositions.push(corner[0], corner[1], corner[2]);
			}
			const firstEdge = [corners[1][0] - corners[0][0], corners[1][1] - corners[0][1], corners[1][2] - corners[0][2]];
			const secondEdge = [corners[2][0] - corners[0][0], corners[2][1] - corners[0][1], corners[2][2] - corners[0][2]];
			const faceNormalX = firstEdge[1] * secondEdge[2] - firstEdge[2] * secondEdge[1];
			const faceNormalY = firstEdge[2] * secondEdge[0] - firstEdge[0] * secondEdge[2];
			const faceNormalZ = firstEdge[0] * secondEdge[1] - firstEdge[1] * secondEdge[0];
			const isFlipped = faceNormalX * normal[0] + faceNormalY * normal[1] + faceNormalZ * normal[2] < 0;
			if (isFlipped) {
				this.#outlineIndices.push(startIndex, startIndex + 2, startIndex + 1, startIndex, startIndex + 3, startIndex + 2);
			}
			else {
				this.#outlineIndices.push(startIndex, startIndex + 1, startIndex + 2, startIndex, startIndex + 2, startIndex + 3);
			}
		}
	}

	//==============================================================================
	// 받은 모형의 삼각형 담기. (GLB 의 프리미티브 하나, 감기는 그대로)
	//==============================================================================
	/**
	 * @param { Float32Array } positions
	 * @param { Float32Array } normals
	 * @param { ArrayLike<number> } indices
	 * @param { Matrix4 } matrix
	 * @param { Array<number> } color [r, g, b] sRGB.
	 * @param { number } glow
	 * @param { boolean } isUnlit
	 * @param { ArrayLike<number> | null } joints 꼭짓점마다 뼈대 번호 넷. (없으면 null)
	 * @param { ArrayLike<number> | null } weights 꼭짓점마다 무게 넷.
	 */
	addTriangles(positions, normals, indices, matrix, color, glow, isUnlit, joints, weights) {
		const elements = matrix.getElements();
		const normalMatrix = this.readNormalMatrix(elements);
		const unlit = isUnlit ? 1 : 0;
		const startIndex = this.#vertices.length / VERTEX_FLOAT_COUNT;
		for (let pointIndex = 0; pointIndex < positions.length; pointIndex += 3) {
			const transformedPoint = matrix.transformPoint(positions[pointIndex], positions[pointIndex + 1], positions[pointIndex + 2]);
			const normalX = normalMatrix[0] * normals[pointIndex] + normalMatrix[1] * normals[pointIndex + 1] + normalMatrix[2] * normals[pointIndex + 2];
			const normalY = normalMatrix[3] * normals[pointIndex] + normalMatrix[4] * normals[pointIndex + 1] + normalMatrix[5] * normals[pointIndex + 2];
			const normalZ = normalMatrix[6] * normals[pointIndex] + normalMatrix[7] * normals[pointIndex + 1] + normalMatrix[8] * normals[pointIndex + 2];
			const normalLength = System.Math.hypot(normalX, normalY, normalZ);
			const unitX = normalLength > 0 ? normalX / normalLength : 0;
			const unitY = normalLength > 0 ? normalY / normalLength : 1;
			const unitZ = normalLength > 0 ? normalZ / normalLength : 0;
			this.#vertices.push(transformedPoint.x, transformedPoint.y, transformedPoint.z, unitX, unitY, unitZ, color[0], color[1], color[2], glow, unlit, 0, 0, 0, 0);
		}
		for (const index of indices) {
			this.#indices.push(startIndex + index);
		}
		this.pushSkinValues(this.#skinValues, joints, weights, positions.length / 3);
	}

	//==============================================================================
	// 받은 모형의 바깥선 껍데기 담기. (이미 부풀린 것, 감기는 그대로)
	//==============================================================================
	/**
	 * @param { Float32Array } positions
	 * @param { ArrayLike<number> } indices
	 * @param { Matrix4 } matrix
	 * @param { ArrayLike<number> | null } joints
	 * @param { ArrayLike<number> | null } weights
	 */
	addOutlineTriangles(positions, indices, matrix, joints, weights) {
		const startIndex = this.#outlinePositions.length / 3;
		for (let pointIndex = 0; pointIndex < positions.length; pointIndex += 3) {
			const transformedPoint = matrix.transformPoint(positions[pointIndex], positions[pointIndex + 1], positions[pointIndex + 2]);
			this.#outlinePositions.push(transformedPoint.x, transformedPoint.y, transformedPoint.z);
			this.#outlineBasePositions.push(transformedPoint.x, transformedPoint.y, transformedPoint.z);
		}
		for (const index of indices) {
			this.#outlineIndices.push(startIndex + index);
		}
		this.pushSkinValues(this.#outlineSkinValues, joints, weights, positions.length / 3);
	}

	//==============================================================================
	// 받은 모형의 몸으로 바깥선 껍데기 짓기. (addPart 의 바깥선과 같은 셈, 감기는 그대로, 뼈대 번호와 무게는 몸의 것 그대로)
	//   - 여러 프리미티브를 이어 붙여 한 번에 넘기면 프리미티브 사이의 같은 자리 점도 함께 민다.
	//==============================================================================
	/**
	 * @param { ArrayLike<number> } positions
	 * @param { ArrayLike<number> } normals
	 * @param { ArrayLike<number> } indices
	 * @param { Matrix4 } matrix
	 * @param { number } outlineWidth
	 * @param { ArrayLike<number> | null } joints
	 * @param { ArrayLike<number> | null } weights
	 */
	addTriangleShell(positions, normals, indices, matrix, outlineWidth, joints, weights) {
		const elements = matrix.getElements();
		const normalMatrix = this.readNormalMatrix(elements);
		const worldPositions = [];
		const worldNormals = [];
		for (let pointIndex = 0; pointIndex < positions.length; pointIndex += 3) {
			const transformedPoint = matrix.transformPoint(positions[pointIndex], positions[pointIndex + 1], positions[pointIndex + 2]);
			const normalX = normalMatrix[0] * normals[pointIndex] + normalMatrix[1] * normals[pointIndex + 1] + normalMatrix[2] * normals[pointIndex + 2];
			const normalY = normalMatrix[3] * normals[pointIndex] + normalMatrix[4] * normals[pointIndex + 1] + normalMatrix[5] * normals[pointIndex + 2];
			const normalZ = normalMatrix[6] * normals[pointIndex] + normalMatrix[7] * normals[pointIndex + 1] + normalMatrix[8] * normals[pointIndex + 2];
			const normalLength = System.Math.hypot(normalX, normalY, normalZ);
			const unitX = normalLength > 0 ? normalX / normalLength : 0;
			const unitY = normalLength > 0 ? normalY / normalLength : 1;
			const unitZ = normalLength > 0 ? normalZ / normalLength : 0;
			worldPositions.push(transformedPoint.x, transformedPoint.y, transformedPoint.z);
			worldNormals.push(unitX, unitY, unitZ);
		}
		const offsets = this.readOutlineOffsets(worldPositions, worldNormals, outlineWidth);
		const startIndex = this.#outlinePositions.length / 3;
		for (let pointIndex = 0; pointIndex < worldPositions.length; pointIndex += 3) {
			const pointX = worldPositions[pointIndex] + offsets[pointIndex];
			const pointY = worldPositions[pointIndex + 1] + offsets[pointIndex + 1];
			const pointZ = worldPositions[pointIndex + 2] + offsets[pointIndex + 2];
			this.#outlinePositions.push(pointX, pointY, pointZ);
			this.#outlineBasePositions.push(worldPositions[pointIndex], worldPositions[pointIndex + 1], worldPositions[pointIndex + 2]);
		}
		this.pushShellTriangles(this.#outlineIndices, indices, null, startIndex, worldPositions, offsets);
		this.pushSkinValues(this.#outlineSkinValues, joints, weights, positions.length / 3);
	}

	//==============================================================================
	// 뼈대 번호와 무게 담기. (뼈대가 없으면 담지 않음)
	//==============================================================================
	/**
	 * @param { Array<number> } target
	 * @param { ArrayLike<number> | null } joints
	 * @param { ArrayLike<number> | null } weights
	 * @param { number } vertexCount
	 */
	pushSkinValues(target, joints, weights, vertexCount) {
		if (joints === null || weights === null) {
			return;
		}
		for (let vertexIndex = 0; vertexIndex < vertexCount; ++vertexIndex) {
			const offset = vertexIndex * 4;
			target.push(joints[offset], joints[offset + 1], joints[offset + 2], joints[offset + 3], weights[offset], weights[offset + 1], weights[offset + 2], weights[offset + 3]);
		}
	}

	//==============================================================================
	// 다 지은 배열. ({ vertexData, indexData, outlineVertexData, outlineIndexData, outlineBaseData })
	//==============================================================================
	/**
	 * @returns { object } { vertexData, indexData, outlineVertexData, outlineIndexData, outlineBaseData, skinData, outlineSkinData, skeleton }
	 */
	readArrays() {
		return {
			vertexData: new System.Float32Array(this.#vertices),
			indexData: new System.Uint32Array(this.#indices),
			outlineVertexData: new System.Float32Array(this.#outlinePositions),
			outlineIndexData: new System.Uint32Array(this.#outlineIndices),
			outlineBaseData: new System.Float32Array(this.#outlineBasePositions),
			skinData: new System.Float32Array(this.#skinValues),
			outlineSkinData: new System.Float32Array(this.#outlineSkinValues),
			skeleton: null,
		};
	}

	//==============================================================================
	// 노멀에 곱할 3x3. (행렬 왼쪽 위 3x3 의 역의 전치, 행 차례)
	//==============================================================================
	/**
	 * @param { Float32Array } elements Matrix4 의 수.
	 * @returns { Array<number> }
	 */
	readNormalMatrix(elements) {
		const m00 = elements[0];
		const m10 = elements[1];
		const m20 = elements[2];
		const m01 = elements[4];
		const m11 = elements[5];
		const m21 = elements[6];
		const m02 = elements[8];
		const m12 = elements[9];
		const m22 = elements[10];
		const cofactor00 = m11 * m22 - m12 * m21;
		const cofactor01 = m12 * m20 - m10 * m22;
		const cofactor02 = m10 * m21 - m11 * m20;
		const determinant = m00 * cofactor00 + m01 * cofactor01 + m02 * cofactor02;
		if (System.Math.abs(determinant) < 1e-20) {
			return [1, 0, 0, 0, 1, 0, 0, 0, 1];
		}
		const inverseDeterminant = 1 / determinant;
		// 역행렬의 전치는 여인수 행렬을 행렬식으로 나눈 것이다.
		return [
			cofactor00 * inverseDeterminant,
			cofactor01 * inverseDeterminant,
			cofactor02 * inverseDeterminant,
			(m02 * m21 - m01 * m22) * inverseDeterminant,
			(m00 * m22 - m02 * m20) * inverseDeterminant,
			(m01 * m20 - m00 * m21) * inverseDeterminant,
			(m01 * m12 - m02 * m11) * inverseDeterminant,
			(m02 * m10 - m00 * m12) * inverseDeterminant,
			(m00 * m11 - m01 * m10) * inverseDeterminant,
		];
	}

	//==============================================================================
	// 삼각형마다 감기를 뒤집을지. (면 노멀이 꼭짓점 노멀의 합과 반대면 뒤집음)
	//==============================================================================
	/**
	 * @param { Array<number> } indices
	 * @param { Array<number> } worldPositions
	 * @param { Array<number> } worldNormals
	 * @returns { Array<boolean> }
	 */
	readTriangleFlips(indices, worldPositions, worldNormals) {
		const flips = [];
		for (let triangleIndex = 0; triangleIndex < indices.length; triangleIndex += 3) {
			const first = indices[triangleIndex] * 3;
			const second = indices[triangleIndex + 1] * 3;
			const third = indices[triangleIndex + 2] * 3;
			const firstEdgeX = worldPositions[second] - worldPositions[first];
			const firstEdgeY = worldPositions[second + 1] - worldPositions[first + 1];
			const firstEdgeZ = worldPositions[second + 2] - worldPositions[first + 2];
			const secondEdgeX = worldPositions[third] - worldPositions[first];
			const secondEdgeY = worldPositions[third + 1] - worldPositions[first + 1];
			const secondEdgeZ = worldPositions[third + 2] - worldPositions[first + 2];
			const faceNormalX = firstEdgeY * secondEdgeZ - firstEdgeZ * secondEdgeY;
			const faceNormalY = firstEdgeZ * secondEdgeX - firstEdgeX * secondEdgeZ;
			const faceNormalZ = firstEdgeX * secondEdgeY - firstEdgeY * secondEdgeX;
			const area = faceNormalX * faceNormalX + faceNormalY * faceNormalY + faceNormalZ * faceNormalZ;
			if (area < DEGENERATE_AREA) {
				flips.push(false);
				continue;
			}
			const normalSumX = worldNormals[first] + worldNormals[second] + worldNormals[third];
			const normalSumY = worldNormals[first + 1] + worldNormals[second + 1] + worldNormals[third + 1];
			const normalSumZ = worldNormals[first + 2] + worldNormals[second + 2] + worldNormals[third + 2];
			flips.push(faceNormalX * normalSumX + faceNormalY * normalSumY + faceNormalZ * normalSumZ < 0);
		}
		return flips;
	}

	//==============================================================================
	// 삼각형 담기. (뒤집을 것은 둘째와 셋째를 바꿈)
	//==============================================================================
	/**
	 * @param { Array<number> } target
	 * @param { Array<number> } indices
	 * @param { Array<boolean> } flips
	 * @param { number } startIndex
	 */
	pushTriangles(target, indices, flips, startIndex) {
		for (let triangleIndex = 0; triangleIndex < indices.length; triangleIndex += 3) {
			const first = startIndex + indices[triangleIndex];
			const second = startIndex + indices[triangleIndex + 1];
			const third = startIndex + indices[triangleIndex + 2];
			if (flips[triangleIndex / 3]) {
				target.push(first, third, second);
			}
			else {
				target.push(first, second, third);
			}
		}
	}

	//==============================================================================
	// 바깥선 껍데기의 삼각형 담기. (뒤집을 것은 둘째와 셋째를 바꾸고, 밀고 나서 면이 뒤집힌 삼각형은 뺌)
	//   - 오목한 곳(몸과 바닥판이 이어진 곳)에서 굵기보다 좁게 굽은 면은 밀면 껍데기가 접혀 면이 뒤집힌다.
	//     뒤집힌 면은 카메라 쪽을 뒷면으로 보여, 깊이와 함께 나중에 그리는 껍데기(건물, 바위)에서는 몸 위에 짙은 줄로 비친다.
	//==============================================================================
	/**
	 * @param { Array<number> } target
	 * @param { ArrayLike<number> } indices
	 * @param { Array<boolean> | null } flips 없으면 감기 그대로.
	 * @param { number } startIndex
	 * @param { Array<number> } worldPositions 밀기 전의 점.
	 * @param { Array<number> } offsets 점마다 민 만큼.
	 */
	pushShellTriangles(target, indices, flips, startIndex, worldPositions, offsets) {
		const readFaceNormal = (first, second, third, isOffset) => {
			const pointValue = (pointIndex, axis) => {
				return worldPositions[pointIndex * 3 + axis] + (isOffset ? offsets[pointIndex * 3 + axis] : 0);
			};
			const firstEdgeX = pointValue(second, 0) - pointValue(first, 0);
			const firstEdgeY = pointValue(second, 1) - pointValue(first, 1);
			const firstEdgeZ = pointValue(second, 2) - pointValue(first, 2);
			const secondEdgeX = pointValue(third, 0) - pointValue(first, 0);
			const secondEdgeY = pointValue(third, 1) - pointValue(first, 1);
			const secondEdgeZ = pointValue(third, 2) - pointValue(first, 2);
			return [firstEdgeY * secondEdgeZ - firstEdgeZ * secondEdgeY, firstEdgeZ * secondEdgeX - firstEdgeX * secondEdgeZ, firstEdgeX * secondEdgeY - firstEdgeY * secondEdgeX];
		};
		for (let triangleIndex = 0; triangleIndex < indices.length; triangleIndex += 3) {
			const first = indices[triangleIndex];
			const second = indices[triangleIndex + 1];
			const third = indices[triangleIndex + 2];
			const bodyNormal = readFaceNormal(first, second, third, false);
			const shellNormal = readFaceNormal(first, second, third, true);
			const bodyArea = bodyNormal[0] * bodyNormal[0] + bodyNormal[1] * bodyNormal[1] + bodyNormal[2] * bodyNormal[2];
			const facing = bodyNormal[0] * shellNormal[0] + bodyNormal[1] * shellNormal[1] + bodyNormal[2] * shellNormal[2];
			if (bodyArea >= DEGENERATE_AREA && facing <= 0) {
				continue;
			}
			const isFlipped = flips !== null && flips[triangleIndex / 3];
			if (isFlipped) {
				target.push(startIndex + first, startIndex + third, startIndex + second);
			}
			else {
				target.push(startIndex + first, startIndex + second, startIndex + third);
			}
		}
	}

	//==============================================================================
	// 바깥선 껍데기의 점마다 밀어낼 만큼. (점마다 [x, y, z], 자리가 같은 점끼리 함께 밂)
	//   - 같은 자리의 점(날카로운 모서리, 이음매, 극)은 서로 다른 법선을 한 번씩 더한 쪽으로 함께 밀어 껍데기가 벌어지지 않게 한다.
	//   - 모서리에서는 맞닿은 면마다 굵기만큼 떨어지게 더 민다. (그 쪽과 면 법선의 가장 작은 코사인으로 나눔)
	//     뾰족한 끝(원뿔 꼭대기)이 너무 튀지 않게 그 코사인은 MINIMUM_OUTLINE_MITER_COSINE 밑으로 내리지 않는다.
	//==============================================================================
	/**
	 * @param { Array<number> } worldPositions
	 * @param { Array<number> } worldNormals 단위 법선.
	 * @param { number } outlineWidth
	 * @returns { Array<number> }
	 */
	readOutlineOffsets(worldPositions, worldNormals, outlineWidth) {
		const pointKeys = [];
		const pointNormals = new System.Map();
		for (let pointIndex = 0; pointIndex < worldPositions.length; pointIndex += 3) {
			const pointKey = System.Math.round(worldPositions[pointIndex] * 10000) + "," + System.Math.round(worldPositions[pointIndex + 1] * 10000) + "," + System.Math.round(worldPositions[pointIndex + 2] * 10000);
			const normalX = worldNormals[pointIndex];
			const normalY = worldNormals[pointIndex + 1];
			const normalZ = worldNormals[pointIndex + 2];
			const normalKey = System.Math.round(normalX * 1000) + "," + System.Math.round(normalY * 1000) + "," + System.Math.round(normalZ * 1000);
			pointKeys.push(pointKey);
			let entry = pointNormals.get(pointKey);
			if (entry === undefined) {
				entry = { normalKeys: [], normals: [] };
				pointNormals.set(pointKey, entry);
			}
			if (entry.normalKeys.includes(normalKey)) {
				continue;
			}
			entry.normalKeys.push(normalKey);
			entry.normals.push([normalX, normalY, normalZ]);
		}
		const pointOffsets = new System.Map();
		for (const [pointKey, entry] of pointNormals) {
			const sum = [0, 0, 0];
			for (const normal of entry.normals) {
				sum[0] += normal[0];
				sum[1] += normal[1];
				sum[2] += normal[2];
			}
			const sumLength = System.Math.hypot(sum[0], sum[1], sum[2]);
			if (sumLength <= 0) {
				pointOffsets.set(pointKey, null);
				continue;
			}
			const direction = [sum[0] / sumLength, sum[1] / sumLength, sum[2] / sumLength];
			let minimumCosine = 1;
			for (const normal of entry.normals) {
				const cosine = direction[0] * normal[0] + direction[1] * normal[1] + direction[2] * normal[2];
				minimumCosine = System.Math.min(minimumCosine, cosine);
			}
			const distance = outlineWidth / System.Math.max(minimumCosine, MINIMUM_OUTLINE_MITER_COSINE);
			pointOffsets.set(pointKey, [direction[0] * distance, direction[1] * distance, direction[2] * distance]);
		}
		const offsets = [];
		for (let pointIndex = 0; pointIndex < worldPositions.length; pointIndex += 3) {
			const pointKey = pointKeys[pointIndex / 3];
			const offset = pointOffsets.get(pointKey);
			if (offset === null) {
				// 맞선 법선이 서로 지워진 점은 제 법선 쪽으로 민다.
				offsets.push(worldNormals[pointIndex] * outlineWidth, worldNormals[pointIndex + 1] * outlineWidth, worldNormals[pointIndex + 2] * outlineWidth);
				continue;
			}
			offsets.push(offset[0], offset[1], offset[2]);
		}
		return offsets;
	}

	//==============================================================================
	// 도형의 둘레 반지름. (상자 가운데에서 가장 먼 점까지)
	//==============================================================================
	/**
	 * @param { Array<number> } positions
	 * @returns { number }
	 */
	readBoundingRadius(positions) {
		const minimum = [System.Infinity, System.Infinity, System.Infinity];
		const maximum = [-System.Infinity, -System.Infinity, -System.Infinity];
		for (let pointIndex = 0; pointIndex < positions.length; pointIndex += 3) {
			for (let axisIndex = 0; axisIndex < 3; ++axisIndex) {
				minimum[axisIndex] = System.Math.min(minimum[axisIndex], positions[pointIndex + axisIndex]);
				maximum[axisIndex] = System.Math.max(maximum[axisIndex], positions[pointIndex + axisIndex]);
			}
		}
		const center = [(minimum[0] + maximum[0]) * 0.5, (minimum[1] + maximum[1]) * 0.5, (minimum[2] + maximum[2]) * 0.5];
		let radius = 0;
		for (let pointIndex = 0; pointIndex < positions.length; pointIndex += 3) {
			const distance = System.Math.hypot(positions[pointIndex] - center[0], positions[pointIndex + 1] - center[1], positions[pointIndex + 2] - center[2]);
			radius = System.Math.max(radius, distance);
		}
		return radius;
	}

	//==============================================================================
	// 행렬의 가장 큰 크기. (세 축의 길이 가운데 큰 것)
	//==============================================================================
	/**
	 * @param { Float32Array } elements
	 * @returns { number }
	 */
	readMaximumScale(elements) {
		const scaleX = System.Math.hypot(elements[0], elements[1], elements[2]);
		const scaleY = System.Math.hypot(elements[4], elements[5], elements[6]);
		const scaleZ = System.Math.hypot(elements[8], elements[9], elements[10]);
		return System.Math.max(scaleX, scaleY, scaleZ);
	}

	//==============================================================================
	// 지어 둔 배열 여럿을 옮겨 한 배열로 잇기. (움직이지 않는 조각을 한 메시로, 돌리거나 키우지 않음)
	// - 조각마다 { arrays: readArrays 나 ToonGlb.readGlbArrays 의 결과, offset: [x, y, z] (없으면 옮기지 않음) }.
	//   자리에 옮김을 더하고 번호에 앞 조각의 꼭짓점 수를 더한다. 바깥선 껍데기와 안쪽 범위(innerOutlineRanges, innerBodyRanges)도 같이 옮겨 잇는다.
	// - 뼈대는 잇지 않는다. 뼈대가 있는 조각도 쉬는 자세 그대로 움직이지 않는 몸이 된다.
	//==============================================================================
	/**
	 * @static
	 * @param { Array<object> } pieces { arrays, offset }
	 * @returns { object } readArrays 의 꼴.
	 */
	static combine(pieces) {
		let vertexFloatCount = 0;
		let indexCount = 0;
		let outlineFloatCount = 0;
		let outlineIndexCount = 0;
		for (const piece of pieces) {
			const arrays = piece.arrays;
			vertexFloatCount += arrays.vertexData.length;
			indexCount += arrays.indexData.length;
			outlineFloatCount += arrays.outlineVertexData.length;
			outlineIndexCount += arrays.outlineIndexData.length;
		}
		const vertexData = new System.Float32Array(vertexFloatCount);
		const indexData = new System.Uint32Array(indexCount);
		const outlineVertexData = new System.Float32Array(outlineFloatCount);
		const outlineBaseData = new System.Float32Array(outlineFloatCount);
		const outlineIndexData = new System.Uint32Array(outlineIndexCount);
		const innerOutlineRanges = [];
		const innerBodyRanges = [];
		let vertexOffset = 0;
		let indexOffset = 0;
		let outlineOffset = 0;
		let outlineIndexOffset = 0;
		for (const piece of pieces) {
			const arrays = piece.arrays;
			const offset = piece.offset !== undefined && piece.offset !== null ? piece.offset : [0, 0, 0];
			const startVertex = vertexOffset / VERTEX_FLOAT_COUNT;
			vertexData.set(arrays.vertexData, vertexOffset);
			for (let floatIndex = vertexOffset; floatIndex < vertexOffset + arrays.vertexData.length; floatIndex += VERTEX_FLOAT_COUNT) {
				vertexData[floatIndex] += offset[0];
				vertexData[floatIndex + 1] += offset[1];
				vertexData[floatIndex + 2] += offset[2];
			}
			for (let index = 0; index < arrays.indexData.length; ++index) {
				indexData[indexOffset + index] = arrays.indexData[index] + startVertex;
			}
			const startOutlineVertex = outlineOffset / 3;
			const pieceOutlineBaseData = arrays.outlineBaseData !== undefined && arrays.outlineBaseData.length === arrays.outlineVertexData.length ? arrays.outlineBaseData : arrays.outlineVertexData;
			outlineVertexData.set(arrays.outlineVertexData, outlineOffset);
			outlineBaseData.set(pieceOutlineBaseData, outlineOffset);
			for (let floatIndex = outlineOffset; floatIndex < outlineOffset + arrays.outlineVertexData.length; floatIndex += 3) {
				for (let axis = 0; axis < 3; ++axis) {
					outlineVertexData[floatIndex + axis] += offset[axis];
					outlineBaseData[floatIndex + axis] += offset[axis];
				}
			}
			for (let index = 0; index < arrays.outlineIndexData.length; ++index) {
				outlineIndexData[outlineIndexOffset + index] = arrays.outlineIndexData[index] + startOutlineVertex;
			}
			const pieceInnerOutlineRanges = arrays.innerOutlineRanges !== undefined ? arrays.innerOutlineRanges : [];
			for (const range of pieceInnerOutlineRanges) {
				innerOutlineRanges.push({ start: range.start + outlineIndexOffset, count: range.count });
			}
			const pieceInnerBodyRanges = arrays.innerBodyRanges !== undefined ? arrays.innerBodyRanges : [];
			for (const range of pieceInnerBodyRanges) {
				innerBodyRanges.push({ start: range.start + indexOffset, count: range.count });
			}
			vertexOffset += arrays.vertexData.length;
			indexOffset += arrays.indexData.length;
			outlineOffset += arrays.outlineVertexData.length;
			outlineIndexOffset += arrays.outlineIndexData.length;
		}
		return {
			vertexData: vertexData,
			indexData: indexData,
			outlineVertexData: outlineVertexData,
			outlineIndexData: outlineIndexData,
			outlineBaseData: outlineBaseData,
			skinData: new System.Float32Array(0),
			outlineSkinData: new System.Float32Array(0),
			skeleton: null,
			innerOutlineRanges: innerOutlineRanges,
			innerBodyRanges: innerBodyRanges,
		};
	}
}
