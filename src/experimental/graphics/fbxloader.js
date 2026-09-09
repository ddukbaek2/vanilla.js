//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// FBX 시간 단위. (1초 = 46186158000 ktime)
const FBX_TIME_UNIT = 46186158000;


//==============================================================================
// FBX 로더. (바이너리 FBX → GL 무관 중간 표현 데이터)
// - 저수준 노드/프로퍼티 파싱 후, 오브젝트/커넥션 그래프를 해석하여
//   노드 계층 / 스키닝 메시 / 머티리얼 / 임베디드 텍스처 / 골격 애니메이션을 추출한다.
// - 결과는 SkinnedModel 이 GL 리소스로 소비한다.
//==============================================================================
export class FbxLoader extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { DataView } */ #dataView;
	/** @private @type { Uint8Array } */ #fileBytes;
	/** @private @type { TextDecoder } */ #textDecoder;
	/** @private @type { number } */ #readCursor;
	/** @private @type { boolean } */ #useWideOffsets;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();

		this.#dataView = null;
		this.#fileBytes = null;
		this.#textDecoder = new System.TextDecoder();
		this.#readCursor = 0;
		this.#useWideOffsets = false;
	}

	//==============================================================================
	// URL 로부터 파싱. (정적)
	//==============================================================================
	/**
	 * @param { string } url
	 * @returns { Promise<object> }
	 */
	static async loadFromUrl(url) {
		const response = await System.fetch(url);
		if (!response.ok) {
			throw new Error(`FbxLoader load failed: ${url}`);
		}
		const arrayBuffer = await response.arrayBuffer();
		const fbxLoader = new FbxLoader();
		const sceneData = await fbxLoader.parse(arrayBuffer);
		return sceneData;
	}

	//==============================================================================
	// 파싱. (바이너리 → 중간 표현)
	//==============================================================================
	/**
	 * @param { ArrayBuffer } arrayBuffer
	 * @returns { Promise<object> }
	 */
	async parse(arrayBuffer) {
		this.#fileBytes = new System.Uint8Array(arrayBuffer);
		this.#dataView = new System.DataView(arrayBuffer);

		const magicText = this.#textDecoder.decode(this.#fileBytes.subarray(0, 20));
		if (!magicText.startsWith("Kaydara FBX Binary")) {
			throw new Error("FbxLoader: not a binary FBX file.");
		}
		const fbxVersion = this.#dataView.getUint32(23, true);
		this.#useWideOffsets = fbxVersion >= 7500;
		this.#readCursor = 27;

		// 최상위 노드 목록 파싱.
		const topNodeList = [];
		while (this.#readCursor < arrayBuffer.byteLength - 160) {
			const topNode = await this.readNodeRecord();
			if (topNode === null) {
				break;
			}
			topNodeList.push(topNode);
		}

		const sceneData = await this.interpret(topNodeList);
		return sceneData;
	}

	//==============================================================================
	// 오프셋 값 읽기. (버전에 따라 32/64비트)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	readOffsetValue() {
		const dataView = this.getDataView();
		if (this.#useWideOffsets) {
			const value = System.Number(dataView.getBigUint64(this.#readCursor, true));
			this.#readCursor += 8;
			return value;
		}
		const value = dataView.getUint32(this.#readCursor, true);
		this.#readCursor += 4;
		return value;
	}

	//==============================================================================
	// 노드 레코드 읽기. (재귀 — 프로퍼티 + 자식)
	//==============================================================================
	/**
	 * @returns { Promise<object | null> }
	 */
	async readNodeRecord() {
		const dataView = this.getDataView();
		const fileBytes = this.getFileBytes();
		const textDecoder = this.getTextDecoder();
		const endOffset = this.readOffsetValue();
		const propertyCount = this.readOffsetValue();
		this.readOffsetValue();
		const nameLength = dataView.getUint8(this.#readCursor);
		this.#readCursor += 1;
		if (endOffset === 0) {
			return null;
		}
		const nodeName = textDecoder.decode(fileBytes.subarray(this.#readCursor, this.#readCursor + nameLength));
		this.#readCursor += nameLength;

		const propertyList = [];
		for (let propertyIndex = 0; propertyIndex < propertyCount; ++propertyIndex) {
			const property = await this.readProperty();
			propertyList.push(property);
		}

		const childNodeList = [];
		while (this.#readCursor < endOffset) {
			const childNode = await this.readNodeRecord();
			if (childNode === null) {
				break;
			}
			childNodeList.push(childNode);
		}
		this.#readCursor = endOffset;
		return { name: nodeName, properties: propertyList, children: childNodeList };
	}

	//==============================================================================
	// 배열 프로퍼티 읽기. (raw / deflate 인코딩)
	//==============================================================================
	/**
	 * @param { number } elementByteSize
	 * @param { function(DataView, number): number } readElement
	 * @returns { Promise<number[]> }
	 */
	async readArrayProperty(elementByteSize, readElement) {
		const dataView = this.getDataView();
		const fileBytes = this.getFileBytes();
		const arrayLength = dataView.getUint32(this.#readCursor, true);
		const encoding = dataView.getUint32(this.#readCursor + 4, true);
		const compressedLength = dataView.getUint32(this.#readCursor + 8, true);
		this.#readCursor += 12;

		let sourceBytes = null;
		if (encoding === 1) {
			const compressedBytes = fileBytes.subarray(this.#readCursor, this.#readCursor + compressedLength);
			sourceBytes = await this.inflate(compressedBytes);
			this.#readCursor += compressedLength;
		}
		else {
			const rawByteLength = arrayLength * elementByteSize;
			sourceBytes = fileBytes.subarray(this.#readCursor, this.#readCursor + rawByteLength);
			this.#readCursor += rawByteLength;
		}

		const elementView = new System.DataView(sourceBytes.buffer, sourceBytes.byteOffset, sourceBytes.byteLength);
		const resultArray = new System.Array(arrayLength);
		for (let elementIndex = 0; elementIndex < arrayLength; ++elementIndex) {
			resultArray[elementIndex] = readElement(elementView, elementIndex * elementByteSize);
		}
		return resultArray;
	}

	//==============================================================================
	// deflate 압축 해제. (브라우저/Node 표준 DecompressionStream)
	//==============================================================================
	/**
	 * @param { Uint8Array } compressedBytes
	 * @returns { Promise<Uint8Array> }
	 */
	async inflate(compressedBytes) {
		const decompressionStream = new System.DecompressionStream("deflate");
		const sourceResponse = new System.Response(compressedBytes);
		const decompressedStream = sourceResponse.body.pipeThrough(decompressionStream);
		const decompressedResponse = new System.Response(decompressedStream);
		const decompressedArrayBuffer = await decompressedResponse.arrayBuffer();
		const decompressedBytes = new System.Uint8Array(decompressedArrayBuffer);
		return decompressedBytes;
	}

	//==============================================================================
	// 단일 프로퍼티 읽기.
	//==============================================================================
	/**
	 * @returns { Promise<object> }
	 */
	async readProperty() {
		const dataView = this.getDataView();
		const fileBytes = this.getFileBytes();
		const textDecoder = this.getTextDecoder();
		const typeCode = System.String.fromCharCode(dataView.getUint8(this.#readCursor));
		this.#readCursor += 1;
		switch (typeCode) {
			case "Y": {
				const value = dataView.getInt16(this.#readCursor, true);
				this.#readCursor += 2;
				return { type: typeCode, value: value };
			}
			case "C": {
				const value = dataView.getUint8(this.#readCursor);
				this.#readCursor += 1;
				return { type: typeCode, value: value !== 0 };
			}
			case "I": {
				const value = dataView.getInt32(this.#readCursor, true);
				this.#readCursor += 4;
				return { type: typeCode, value: value };
			}
			case "F": {
				const value = dataView.getFloat32(this.#readCursor, true);
				this.#readCursor += 4;
				return { type: typeCode, value: value };
			}
			case "D": {
				const value = dataView.getFloat64(this.#readCursor, true);
				this.#readCursor += 8;
				return { type: typeCode, value: value };
			}
			case "L": {
				const value = System.Number(dataView.getBigInt64(this.#readCursor, true));
				this.#readCursor += 8;
				return { type: typeCode, value: value };
			}
			case "f": {
				const value = await this.readArrayProperty(4, (view, offset) => view.getFloat32(offset, true));
				return { type: typeCode, value: value };
			}
			case "d": {
				const value = await this.readArrayProperty(8, (view, offset) => view.getFloat64(offset, true));
				return { type: typeCode, value: value };
			}
			case "l": {
				const value = await this.readArrayProperty(8, (view, offset) => System.Number(view.getBigInt64(offset, true)));
				return { type: typeCode, value: value };
			}
			case "i": {
				const value = await this.readArrayProperty(4, (view, offset) => view.getInt32(offset, true));
				return { type: typeCode, value: value };
			}
			case "b": {
				const value = await this.readArrayProperty(1, (view, offset) => view.getUint8(offset));
				return { type: typeCode, value: value };
			}
			case "S": {
				const stringLength = dataView.getUint32(this.#readCursor, true);
				this.#readCursor += 4;
				const value = textDecoder.decode(fileBytes.subarray(this.#readCursor, this.#readCursor + stringLength));
				this.#readCursor += stringLength;
				return { type: typeCode, value: value };
			}
			case "R": {
				const rawLength = dataView.getUint32(this.#readCursor, true);
				this.#readCursor += 4;
				const value = fileBytes.slice(this.#readCursor, this.#readCursor + rawLength);
				this.#readCursor += rawLength;
				return { type: typeCode, value: value };
			}
			default: {
				throw new Error("FbxLoader: unknown property type: " + typeCode);
			}
		}
	}

	//==============================================================================
	// 오브젝트/커넥션 그래프 해석. (중간 표현 구성)
	//==============================================================================
	/**
	 * @param { object[] } topNodeList
	 * @returns { Promise<object> }
	 */
	async interpret(topNodeList) {
		const objectsNode = topNodeList.find((node) => node.name === "Objects");
		const connectionsNode = topNodeList.find((node) => node.name === "Connections");

		// 커넥션 목록 구성. (OO: 오브젝트-오브젝트, OP: 오브젝트-프로퍼티)
		const objectConnectionList = [];
		const propertyConnectionList = [];
		for (const connection of connectionsNode.children) {
			const connectionType = connection.properties[0].value;
			const sourceId = connection.properties[1].value;
			const destinationId = connection.properties[2].value;
			if (connectionType === "OO") {
				objectConnectionList.push({ sourceId: sourceId, destinationId: destinationId });
			}
			else if (connectionType === "OP") {
				const propertyName = connection.properties[3].value;
				propertyConnectionList.push({ sourceId: sourceId, destinationId: destinationId, propertyName: propertyName });
			}
		}

		// 오브젝트 인덱싱. (id → 원시 노드)
		const objectById = new System.Map();
		for (const objectNode of objectsNode.children) {
			const objectId = objectNode.properties[0].value;
			objectById.set(objectId, objectNode);
		}

		const geometryById = this.interpretGeometries(objectsNode);
		const skinResult = this.interpretSkins(objectsNode, objectConnectionList);
		const videoById = this.interpretVideos(objectsNode);
		const textureById = this.interpretTextures(objectsNode, objectConnectionList);
		const materialById = this.interpretMaterials(objectsNode, propertyConnectionList, textureById);
		const nodeResult = this.interpretModels(objectsNode, objectConnectionList, geometryById, skinResult.skinDeformerById, materialById);
		const animationList = this.interpretAnimations(objectsNode, objectConnectionList, propertyConnectionList, nodeResult.nodeIdToIndex);

		const sceneData = {
			nodeList: nodeResult.nodeList,
			nodeIdToIndex: nodeResult.nodeIdToIndex,
			rootNodeIndices: nodeResult.rootNodeIndices,
			geometryById: geometryById,
			skinDeformerById: skinResult.skinDeformerById,
			clusterById: skinResult.clusterById,
			materialById: materialById,
			textureById: textureById,
			videoById: videoById,
			animationList: animationList,
		};
		return sceneData;
	}

	//==============================================================================
	// 지오메트리 해석. (삼각화 + 노멀/UV 레이어 펼침 + 원본 정점 매핑)
	//==============================================================================
	/**
	 * @param { object } objectsNode
	 * @returns { Map<number, object> }
	 */
	interpretGeometries(objectsNode) {
		const geometryById = new System.Map();
		for (const objectNode of objectsNode.children) {
			if (objectNode.name !== "Geometry") {
				continue;
			}
			const geometryId = objectNode.properties[0].value;
			const geometry = this.interpretSingleGeometry(objectNode);
			geometryById.set(geometryId, geometry);
		}
		return geometryById;
	}

	//==============================================================================
	// 단일 지오메트리 해석.
	//==============================================================================
	/**
	 * @param { object } geometryNode
	 * @returns { object }
	 */
	interpretSingleGeometry(geometryNode) {
		const verticesNode = geometryNode.children.find((child) => child.name === "Vertices");
		const polygonIndexNode = geometryNode.children.find((child) => child.name === "PolygonVertexIndex");
		const positions = verticesNode.properties[0].value;
		const polygonVertexIndices = polygonIndexNode.properties[0].value;

		// 폴리곤 → 팬 삼각화. (코너: 원본 정점 인덱스 + 폴리곤 정점 순번)
		const cornerVertexIndices = [];
		const cornerPolygonVertexPositions = [];
		let polygonStart = 0;
		for (let polygonVertexPosition = 0; polygonVertexPosition < polygonVertexIndices.length; ++polygonVertexPosition) {
			let vertexIndex = polygonVertexIndices[polygonVertexPosition];
			let isPolygonEnd = false;
			if (vertexIndex < 0) {
				vertexIndex = -vertexIndex - 1;
				isPolygonEnd = true;
			}
			if (isPolygonEnd) {
				const polygonEnd = polygonVertexPosition;
				for (let triangleCorner = polygonStart + 1; triangleCorner < polygonEnd; ++triangleCorner) {
					const firstVertexIndex = polygonVertexIndices[polygonStart] < 0 ? -polygonVertexIndices[polygonStart] - 1 : polygonVertexIndices[polygonStart];
					const secondVertexIndex = polygonVertexIndices[triangleCorner];
					const thirdRawIndex = polygonVertexIndices[triangleCorner + 1];
					const thirdVertexIndex = thirdRawIndex < 0 ? -thirdRawIndex - 1 : thirdRawIndex;
					cornerVertexIndices.push(firstVertexIndex);
					cornerPolygonVertexPositions.push(polygonStart);
					cornerVertexIndices.push(secondVertexIndex);
					cornerPolygonVertexPositions.push(triangleCorner);
					cornerVertexIndices.push(thirdVertexIndex);
					cornerPolygonVertexPositions.push(triangleCorner + 1);
				}
				polygonStart = polygonVertexPosition + 1;
			}
		}

		const normalReader = this.buildLayerReader(geometryNode, "LayerElementNormal", "Normals", 3);
		const uvReader = this.buildLayerReader(geometryNode, "LayerElementUV", "UV", 2);
		const materialLayer = this.buildMaterialLayer(geometryNode);

		const triangleCount = cornerVertexIndices.length / 3;
		const outputPositions = new System.Float32Array(cornerVertexIndices.length * 3);
		const outputNormals = new System.Float32Array(cornerVertexIndices.length * 3);
		const outputTextureCoordinates = new System.Float32Array(cornerVertexIndices.length * 2);
		const outputOriginalVertexIndices = new System.Int32Array(cornerVertexIndices.length);
		const materialIndexPerTriangle = new System.Int32Array(triangleCount);

		for (let cornerIndex = 0; cornerIndex < cornerVertexIndices.length; ++cornerIndex) {
			const originalVertexIndex = cornerVertexIndices[cornerIndex];
			const polygonVertexPosition = cornerPolygonVertexPositions[cornerIndex];
			outputOriginalVertexIndices[cornerIndex] = originalVertexIndex;
			outputPositions[cornerIndex * 3] = positions[originalVertexIndex * 3];
			outputPositions[cornerIndex * 3 + 1] = positions[originalVertexIndex * 3 + 1];
			outputPositions[cornerIndex * 3 + 2] = positions[originalVertexIndex * 3 + 2];

			const normal = normalReader(originalVertexIndex, polygonVertexPosition);
			outputNormals[cornerIndex * 3] = normal[0];
			outputNormals[cornerIndex * 3 + 1] = normal[1];
			outputNormals[cornerIndex * 3 + 2] = normal[2];

			const textureCoordinate = uvReader(originalVertexIndex, polygonVertexPosition);
			outputTextureCoordinates[cornerIndex * 2] = textureCoordinate[0];
			outputTextureCoordinates[cornerIndex * 2 + 1] = textureCoordinate[1];
		}

		for (let triangleIndex = 0; triangleIndex < triangleCount; ++triangleIndex) {
			const firstCornerPolygonVertexPosition = cornerPolygonVertexPositions[triangleIndex * 3];
			materialIndexPerTriangle[triangleIndex] = materialLayer(firstCornerPolygonVertexPosition);
		}

		const geometry = {
			positions: outputPositions,
			normals: outputNormals,
			textureCoordinates: outputTextureCoordinates,
			originalVertexIndices: outputOriginalVertexIndices,
			materialIndexPerTriangle: materialIndexPerTriangle,
			cornerCount: cornerVertexIndices.length,
			originalVertexCount: positions.length / 3,
		};
		return geometry;
	}

	//==============================================================================
	// 레이어 리더 구성. (노멀/UV — 매핑/참조 방식별 조회 함수 반환)
	//==============================================================================
	/**
	 * @param { object } geometryNode
	 * @param { string } layerElementName
	 * @param { string } dataArrayName
	 * @param { number } componentCount
	 * @returns { function(number, number): number[] }
	 */
	buildLayerReader(geometryNode, layerElementName, dataArrayName, componentCount) {
		const layerNode = geometryNode.children.find((child) => child.name === layerElementName);
		if (!layerNode) {
			return () => {
				const zeroVector = new System.Array(componentCount).fill(0);
				return zeroVector;
			};
		}
		const dataNode = layerNode.children.find((child) => child.name === dataArrayName);
		const mappingNode = layerNode.children.find((child) => child.name === "MappingInformationType");
		const referenceNode = layerNode.children.find((child) => child.name === "ReferenceInformationType");
		const indexNode = layerNode.children.find((child) => child.name === (dataArrayName === "UV" ? "UVIndex" : dataArrayName + "Index"));
		const dataArray = dataNode.properties[0].value;
		const mappingType = mappingNode.properties[0].value;
		const referenceType = referenceNode.properties[0].value;
		const indexArray = indexNode ? indexNode.properties[0].value : null;

		return (originalVertexIndex, polygonVertexPosition) => {
			let mappedIndex = 0;
			if (mappingType === "ByVertice" || mappingType === "ByVertex") {
				mappedIndex = originalVertexIndex;
			}
			else if (mappingType === "ByPolygonVertex") {
				mappedIndex = polygonVertexPosition;
			}
			else if (mappingType === "AllSame") {
				mappedIndex = 0;
			}
			let dataIndex = mappedIndex;
			if (referenceType === "IndexToDirect" && indexArray) {
				dataIndex = indexArray[mappedIndex];
			}
			const componentValues = new System.Array(componentCount);
			for (let componentIndex = 0; componentIndex < componentCount; ++componentIndex) {
				componentValues[componentIndex] = dataArray[dataIndex * componentCount + componentIndex];
			}
			return componentValues;
		};
	}

	//==============================================================================
	// 머티리얼 레이어 구성. (폴리곤 정점 순번 → 머티리얼 인덱스)
	//==============================================================================
	/**
	 * @param { object } geometryNode
	 * @returns { function(number): number }
	 */
	buildMaterialLayer(geometryNode) {
		const layerNode = geometryNode.children.find((child) => child.name === "LayerElementMaterial");
		if (!layerNode) {
			return () => {
				return 0;
			};
		}
		const mappingNode = layerNode.children.find((child) => child.name === "MappingInformationType");
		const materialsNode = layerNode.children.find((child) => child.name === "Materials");
		const mappingType = mappingNode.properties[0].value;
		const materialArray = materialsNode.properties[0].value;
		return (polygonVertexPosition) => {
			if (mappingType === "AllSame") {
				return materialArray[0];
			}
			return materialArray[polygonVertexPosition];
		};
	}

	//==============================================================================
	// 스킨/클러스터 해석. (본별 정점 가중치 + 바인드 역행렬용 링크 변환)
	//==============================================================================
	/**
	 * @param { object } objectsNode
	 * @param { object[] } objectConnectionList
	 * @returns { object }
	 */
	interpretSkins(objectsNode, objectConnectionList) {
		const skinDeformerById = new System.Map();
		const clusterById = new System.Map();
		for (const objectNode of objectsNode.children) {
			if (objectNode.name !== "Deformer") {
				continue;
			}
			const deformerId = objectNode.properties[0].value;
			const deformerSubType = objectNode.properties[2].value;
			if (deformerSubType === "Skin") {
				skinDeformerById.set(deformerId, { clusterIds: [] });
			}
			else if (deformerSubType === "Cluster") {
				const indexesNode = objectNode.children.find((child) => child.name === "Indexes");
				const weightsNode = objectNode.children.find((child) => child.name === "Weights");
				const transformNode = objectNode.children.find((child) => child.name === "Transform");
				const transformLinkNode = objectNode.children.find((child) => child.name === "TransformLink");
				const cluster = {
					vertexIndices: indexesNode ? indexesNode.properties[0].value : [],
					weights: weightsNode ? weightsNode.properties[0].value : [],
					transform: transformNode ? transformNode.properties[0].value : null,
					transformLink: transformLinkNode ? transformLinkNode.properties[0].value : null,
					boneNodeId: null,
				};
				clusterById.set(deformerId, cluster);
			}
		}

		// 커넥션으로 스킨↔클러스터, 클러스터↔본 연결.
		for (const connection of objectConnectionList) {
			if (skinDeformerById.has(connection.destinationId) && clusterById.has(connection.sourceId)) {
				const skinDeformer = skinDeformerById.get(connection.destinationId);
				skinDeformer.clusterIds.push(connection.sourceId);
			}
			else if (clusterById.has(connection.destinationId)) {
				const cluster = clusterById.get(connection.destinationId);
				cluster.boneNodeId = connection.sourceId;
			}
		}

		const skinResult = { skinDeformerById: skinDeformerById, clusterById: clusterById };
		return skinResult;
	}

	//==============================================================================
	// 비디오 해석. (임베디드 이미지 바이트)
	//==============================================================================
	/**
	 * @param { object } objectsNode
	 * @returns { Map<number, object> }
	 */
	interpretVideos(objectsNode) {
		const videoById = new System.Map();
		for (const objectNode of objectsNode.children) {
			if (objectNode.name !== "Video") {
				continue;
			}
			const videoId = objectNode.properties[0].value;
			const contentNode = objectNode.children.find((child) => child.name === "Content");
			const filenameNode = objectNode.children.find((child) => child.name === "RelativeFilename" || child.name === "Filename");
			const video = {
				contentBytes: contentNode && contentNode.properties.length > 0 ? contentNode.properties[0].value : null,
				filename: filenameNode ? filenameNode.properties[0].value : "",
			};
			videoById.set(videoId, video);
		}

		// 동일 이미지 중복 참조 보완. (같은 파일을 두 번 참조하면 두 번째 Content 는 비어 있다)
		const contentByFileName = new System.Map();
		for (const video of videoById.values()) {
			if (!video.contentBytes || video.contentBytes.length === 0) {
				continue;
			}
			const fileName = this.extractFileName(video.filename);
			if (!contentByFileName.has(fileName)) {
				contentByFileName.set(fileName, video.contentBytes);
			}
		}
		for (const video of videoById.values()) {
			if (video.contentBytes && video.contentBytes.length > 0) {
				continue;
			}
			const fileName = this.extractFileName(video.filename);
			const sharedContentBytes = contentByFileName.get(fileName);
			if (sharedContentBytes) {
				video.contentBytes = sharedContentBytes;
			}
		}
		return videoById;
	}

	//==============================================================================
	// 파일 경로에서 파일명 추출. (윈도우/유닉스 구분자 모두 대응)
	//==============================================================================
	/**
	 * @param { string } filePath
	 * @returns { string }
	 */
	extractFileName(filePath) {
		const normalizedPath = filePath.replace(/\\/g, "/");
		const lastSeparatorIndex = normalizedPath.lastIndexOf("/");
		const fileName = lastSeparatorIndex >= 0 ? normalizedPath.substring(lastSeparatorIndex + 1) : normalizedPath;
		return fileName;
	}

	//==============================================================================
	// 텍스처 해석. (비디오 연결)
	//==============================================================================
	/**
	 * @param { object } objectsNode
	 * @param { object[] } objectConnectionList
	 * @returns { Map<number, object> }
	 */
	interpretTextures(objectsNode, objectConnectionList) {
		const textureById = new System.Map();
		for (const objectNode of objectsNode.children) {
			if (objectNode.name !== "Texture") {
				continue;
			}
			const textureId = objectNode.properties[0].value;
			const filenameNode = objectNode.children.find((child) => child.name === "RelativeFilename" || child.name === "FileName");
			const texture = {
				videoId: null,
				filename: filenameNode ? filenameNode.properties[0].value : "",
			};
			textureById.set(textureId, texture);
		}
		for (const connection of objectConnectionList) {
			if (textureById.has(connection.destinationId)) {
				const texture = textureById.get(connection.destinationId);
				texture.videoId = connection.sourceId;
			}
		}
		return textureById;
	}

	//==============================================================================
	// 머티리얼 해석. (phong 색상/광택 + 슬롯별 텍스처 연결)
	//==============================================================================
	/**
	 * @param { object } objectsNode
	 * @param { object[] } propertyConnectionList
	 * @param { Map<number, object> } textureById
	 * @returns { Map<number, object> }
	 */
	interpretMaterials(objectsNode, propertyConnectionList, textureById) {
		const materialById = new System.Map();
		for (const objectNode of objectsNode.children) {
			if (objectNode.name !== "Material") {
				continue;
			}
			const materialId = objectNode.properties[0].value;
			const properties70Node = objectNode.children.find((child) => child.name === "Properties70");
			const material = {
				diffuseColor: [1, 1, 1],
				specularColor: [0.5, 0.5, 0.5],
				shininess: 20,
				diffuseTextureId: null,
				normalTextureId: null,
				specularTextureId: null,
				glossTextureId: null,
				opacityTextureId: null,
			};
			if (properties70Node) {
				for (const propertyRecord of properties70Node.children) {
					const propertyKey = propertyRecord.properties[0].value;
					if (propertyKey === "DiffuseColor" || propertyKey === "Diffuse") {
						material.diffuseColor = [propertyRecord.properties[4].value, propertyRecord.properties[5].value, propertyRecord.properties[6].value];
					}
					else if (propertyKey === "SpecularColor" || propertyKey === "Specular") {
						material.specularColor = [propertyRecord.properties[4].value, propertyRecord.properties[5].value, propertyRecord.properties[6].value];
					}
					else if (propertyKey === "Shininess" || propertyKey === "ShininessExponent") {
						material.shininess = propertyRecord.properties[4].value;
					}
				}
			}
			materialById.set(materialId, material);
		}

		// 텍스처 → 머티리얼 슬롯 연결. (OP 프로퍼티명으로 판별)
		for (const connection of propertyConnectionList) {
			if (!materialById.has(connection.destinationId) || !textureById.has(connection.sourceId)) {
				continue;
			}
			const material = materialById.get(connection.destinationId);
			const propertyName = connection.propertyName;
			if (propertyName === "DiffuseColor") {
				material.diffuseTextureId = connection.sourceId;
			}
			else if (propertyName === "NormalMap" || propertyName === "Bump") {
				material.normalTextureId = connection.sourceId;
			}
			else if (propertyName === "SpecularColor" || propertyName === "SpecularFactor") {
				material.specularTextureId = connection.sourceId;
			}
			else if (propertyName === "Shininess" || propertyName === "ShininessExponent") {
				material.glossTextureId = connection.sourceId;
			}
			else if (propertyName === "TransparentColor" || propertyName === "TransparencyFactor") {
				material.opacityTextureId = connection.sourceId;
			}
		}
		return materialById;
	}

	//==============================================================================
	// 모델(노드) 해석. (계층 + 로컬 변환 + 지오메트리/스킨/머티리얼 소속)
	//==============================================================================
	/**
	 * @param { object } objectsNode
	 * @param { object[] } objectConnectionList
	 * @param { Map<number, object> } geometryById
	 * @param { Map<number, object> } skinDeformerById
	 * @param { Map<number, object> } materialById
	 * @returns { object }
	 */
	interpretModels(objectsNode, objectConnectionList, geometryById, skinDeformerById, materialById) {
		const nodeList = [];
		const nodeIdToIndex = new System.Map();
		for (const objectNode of objectsNode.children) {
			if (objectNode.name !== "Model") {
				continue;
			}
			const modelId = objectNode.properties[0].value;
			const modelName = objectNode.properties[1].value;
			const modelSubType = objectNode.properties[2].value;
			const node = {
				id: modelId,
				name: modelName,
				isBone: modelSubType === "LimbNode",
				translation: [0, 0, 0],
				rotationEulerDegrees: [0, 0, 0],
				preRotationDegrees: [0, 0, 0],
				scale: [1, 1, 1],
				geometryId: null,
				skinId: null,
				materialIds: [],
				childIndices: [],
				parentId: null,
			};
			const properties70Node = objectNode.children.find((child) => child.name === "Properties70");
			if (properties70Node) {
				for (const propertyRecord of properties70Node.children) {
					const propertyKey = propertyRecord.properties[0].value;
					if (propertyKey === "Lcl Translation") {
						node.translation = [propertyRecord.properties[4].value, propertyRecord.properties[5].value, propertyRecord.properties[6].value];
					}
					else if (propertyKey === "Lcl Rotation") {
						node.rotationEulerDegrees = [propertyRecord.properties[4].value, propertyRecord.properties[5].value, propertyRecord.properties[6].value];
					}
					else if (propertyKey === "Lcl Scaling") {
						node.scale = [propertyRecord.properties[4].value, propertyRecord.properties[5].value, propertyRecord.properties[6].value];
					}
					else if (propertyKey === "PreRotation") {
						node.preRotationDegrees = [propertyRecord.properties[4].value, propertyRecord.properties[5].value, propertyRecord.properties[6].value];
					}
				}
			}
			nodeIdToIndex.set(modelId, nodeList.length);
			nodeList.push(node);
		}

		// 커넥션으로 계층/지오메트리/스킨/머티리얼 소속 구성.
		const rootNodeIndices = [];
		for (const connection of objectConnectionList) {
			const sourceIsNode = nodeIdToIndex.has(connection.sourceId);
			if (sourceIsNode && connection.destinationId === 0) {
				rootNodeIndices.push(nodeIdToIndex.get(connection.sourceId));
			}
			else if (sourceIsNode && nodeIdToIndex.has(connection.destinationId)) {
				const parentIndex = nodeIdToIndex.get(connection.destinationId);
				const childIndex = nodeIdToIndex.get(connection.sourceId);
				nodeList[parentIndex].childIndices.push(childIndex);
				nodeList[childIndex].parentId = connection.destinationId;
			}
			else if (geometryById.has(connection.sourceId) && nodeIdToIndex.has(connection.destinationId)) {
				const ownerNode = nodeList[nodeIdToIndex.get(connection.destinationId)];
				ownerNode.geometryId = connection.sourceId;
			}
			else if (skinDeformerById.has(connection.sourceId) && geometryById.has(connection.destinationId)) {
				// 스킨은 지오메트리에 붙는다 — 지오메트리를 소유한 노드에서 역참조하도록 지오메트리에 기록.
				const skinDeformer = skinDeformerById.get(connection.sourceId);
				skinDeformer.geometryId = connection.destinationId;
			}
			else if (materialById.has(connection.sourceId) && nodeIdToIndex.has(connection.destinationId)) {
				const ownerNode = nodeList[nodeIdToIndex.get(connection.destinationId)];
				ownerNode.materialIds.push(connection.sourceId);
			}
		}

		// 지오메트리 → 스킨 역참조를 노드에 반영.
		for (const [skinId, skinDeformer] of skinDeformerById) {
			if (skinDeformer.geometryId === undefined) {
				continue;
			}
			for (const node of nodeList) {
				if (node.geometryId === skinDeformer.geometryId) {
					node.skinId = skinId;
				}
			}
		}

		const nodeResult = { nodeList: nodeList, nodeIdToIndex: nodeIdToIndex, rootNodeIndices: rootNodeIndices };
		return nodeResult;
	}

	//==============================================================================
	// 애니메이션 해석. (스택 → 레이어 → 커브노드(T/R/S) → 커브(X/Y/Z))
	//==============================================================================
	/**
	 * @param { object } objectsNode
	 * @param { object[] } objectConnectionList
	 * @param { object[] } propertyConnectionList
	 * @param { Map<number, number> } nodeIdToIndex
	 * @returns { object[] }
	 */
	interpretAnimations(objectsNode, objectConnectionList, propertyConnectionList, nodeIdToIndex) {
		// 커브 / 커브노드 / 레이어 / 스택 수집.
		const curveById = new System.Map();
		const curveNodeById = new System.Map();
		const layerIds = [];
		const stackById = new System.Map();
		for (const objectNode of objectsNode.children) {
			const objectId = objectNode.properties[0].value;
			if (objectNode.name === "AnimationCurve") {
				const keyTimeNode = objectNode.children.find((child) => child.name === "KeyTime");
				const keyValueNode = objectNode.children.find((child) => child.name === "KeyValueFloat");
				curveById.set(objectId, {
					keyTimes: keyTimeNode ? keyTimeNode.properties[0].value : [],
					keyValues: keyValueNode ? keyValueNode.properties[0].value : [],
				});
			}
			else if (objectNode.name === "AnimationCurveNode") {
				curveNodeById.set(objectId, { targetNodeId: null, targetProperty: null, curveByChannel: {} });
			}
			else if (objectNode.name === "AnimationLayer") {
				layerIds.push(objectId);
			}
			else if (objectNode.name === "AnimationStack") {
				stackById.set(objectId, { name: objectNode.properties[1].value, layerIds: [] });
			}
		}

		// 커브 → 커브노드 채널(d|X/d|Y/d|Z) 연결.
		for (const connection of propertyConnectionList) {
			if (curveById.has(connection.sourceId) && curveNodeById.has(connection.destinationId)) {
				const curveNode = curveNodeById.get(connection.destinationId);
				const channelName = connection.propertyName.replace("d|", "");
				curveNode.curveByChannel[channelName] = connection.sourceId;
			}
			else if (curveNodeById.has(connection.sourceId) && nodeIdToIndex.has(connection.destinationId)) {
				const curveNode = curveNodeById.get(connection.sourceId);
				curveNode.targetNodeId = connection.destinationId;
				curveNode.targetProperty = connection.propertyName;
			}
		}

		// 레이어 → 스택 소속 + 커브노드 → 레이어 소속.
		const layerIdByCurveNodeId = new System.Map();
		for (const connection of objectConnectionList) {
			if (layerIds.includes(connection.sourceId) && stackById.has(connection.destinationId)) {
				const stack = stackById.get(connection.destinationId);
				stack.layerIds.push(connection.sourceId);
			}
			else if (curveNodeById.has(connection.sourceId) && layerIds.includes(connection.destinationId)) {
				layerIdByCurveNodeId.set(connection.sourceId, connection.destinationId);
			}
		}

		// 스택 → 애니메이션 클립. (스택 소속 레이어의 커브노드만 노드/프로퍼티별 채널로 변환)
		const animationList = [];
		for (const [stackId, stack] of stackById) {
			const channelList = [];
			let duration = 0;
			for (const [curveNodeId, curveNode] of curveNodeById) {
				if (curveNode.targetNodeId === null || !nodeIdToIndex.has(curveNode.targetNodeId)) {
					continue;
				}
				const owningLayerId = layerIdByCurveNodeId.get(curveNodeId);
				if (!stack.layerIds.includes(owningLayerId)) {
					continue;
				}
				const channelResult = this.buildAnimationChannel(curveNode, curveById, nodeIdToIndex);
				if (channelResult) {
					channelList.push(channelResult.channel);
					duration = System.Math.max(duration, channelResult.duration);
				}
			}
			animationList.push({ name: stack.name, duration: duration, channels: channelList });
		}
		return animationList;
	}

	//==============================================================================
	// 애니메이션 채널 구성. (커브노드 → 노드 인덱스 + 경로 + 키타임/값)
	//==============================================================================
	/**
	 * @param { object } curveNode
	 * @param { Map<number, object> } curveById
	 * @param { Map<number, number> } nodeIdToIndex
	 * @returns { object | null }
	 */
	buildAnimationChannel(curveNode, curveById, nodeIdToIndex) {
		let path = null;
		if (curveNode.targetProperty === "Lcl Translation") {
			path = "translation";
		}
		else if (curveNode.targetProperty === "Lcl Rotation") {
			path = "rotation";
		}
		else if (curveNode.targetProperty === "Lcl Scaling") {
			path = "scale";
		}
		if (path === null) {
			return null;
		}

		// 채널별 키타임 합집합 구성. (X/Y/Z 커브의 시간축이 동일하다고 가정 — 아니면 합집합 정렬)
		const channelNames = ["X", "Y", "Z"];
		const timeSet = new System.Set();
		for (const channelName of channelNames) {
			const curveId = curveNode.curveByChannel[channelName];
			if (curveId === undefined) {
				continue;
			}
			const curve = curveById.get(curveId);
			for (const keyTime of curve.keyTimes) {
				timeSet.add(keyTime);
			}
		}
		const sortedTimes = System.Array.from(timeSet).sort((left, right) => left - right);
		if (sortedTimes.length === 0) {
			return null;
		}

		const componentCount = path === "rotation" ? 3 : 3;
		const times = new System.Float32Array(sortedTimes.length);
		const values = new System.Float32Array(sortedTimes.length * componentCount);
		for (let timeIndex = 0; timeIndex < sortedTimes.length; ++timeIndex) {
			times[timeIndex] = sortedTimes[timeIndex] / FBX_TIME_UNIT;
			for (let channelIndex = 0; channelIndex < 3; ++channelIndex) {
				const curveId = curveNode.curveByChannel[channelNames[channelIndex]];
				const sampledValue = this.sampleCurveAtTime(curveId, curveById, sortedTimes[timeIndex]);
				values[timeIndex * componentCount + channelIndex] = sampledValue;
			}
		}

		const channel = {
			nodeIndex: nodeIdToIndex.get(curveNode.targetNodeId),
			path: path,
			times: times,
			values: values,
		};
		const duration = times.length > 0 ? times[times.length - 1] : 0;
		const channelResult = { channel: channel, duration: duration };
		return channelResult;
	}

	//==============================================================================
	// 커브 시간 샘플링. (선형 보간 — 키 사이)
	//==============================================================================
	/**
	 * @param { number | undefined } curveId
	 * @param { Map<number, object> } curveById
	 * @param { number } keyTime
	 * @returns { number }
	 */
	sampleCurveAtTime(curveId, curveById, keyTime) {
		if (curveId === undefined) {
			return 0;
		}
		const curve = curveById.get(curveId);
		const keyTimes = curve.keyTimes;
		const keyValues = curve.keyValues;
		if (keyTimes.length === 0) {
			return 0;
		}
		if (keyTime <= keyTimes[0]) {
			return keyValues[0];
		}
		if (keyTime >= keyTimes[keyTimes.length - 1]) {
			return keyValues[keyValues.length - 1];
		}
		let keyIndex = 0;
		while (keyIndex < keyTimes.length - 1 && keyTimes[keyIndex + 1] < keyTime) {
			keyIndex += 1;
		}
		const spanDuration = keyTimes[keyIndex + 1] - keyTimes[keyIndex];
		const factor = spanDuration > 0 ? (keyTime - keyTimes[keyIndex]) / spanDuration : 0;
		const interpolatedValue = keyValues[keyIndex] + (keyValues[keyIndex + 1] - keyValues[keyIndex]) * factor;
		return interpolatedValue;
	}

	//==============================================================================
	// 렌더링 데이터뷰 반환.
	//==============================================================================
	/**
	 * @returns { DataView }
	 */
	getDataView() {
		return this.#dataView;
	}

	//==============================================================================
	// 파일 바이트 반환.
	//==============================================================================
	/**
	 * @returns { Uint8Array }
	 */
	getFileBytes() {
		return this.#fileBytes;
	}

	//==============================================================================
	// 텍스트 디코더 반환.
	//==============================================================================
	/**
	 * @returns { TextDecoder }
	 */
	getTextDecoder() {
		return this.#textDecoder;
	}
}
