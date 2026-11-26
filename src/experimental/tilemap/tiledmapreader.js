//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../../base/vector2.js";
import { Rect } from "../../base/rect.js";
import { Color } from "../../base/color.js";
import { Tileset, TileAnimationFrame, TileCollisionShape, TileCollisionShapeKind, TileRenderSize, TileFillMode } from "./tileset.js";
import { TilemapOrientation, TilemapStaggerAxis, TilemapStaggerIndex, TilemapRenderOrder } from "./tilemap.js";
import { TilemapLayer } from "./tilemaplayer.js";


//==============================================================================
// Tiled JSON 지도 읽기.
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - Tiled 의 JSON 지도(.tmj)와 타일셋(.tsj)을 읽어 Tilemap 을 채운다. (원문: https://doc.mapeditor.org/en/stable/reference/json-map-format/)
// - 읽는 것: 배치 넷(orthogonal, isometric, staggered, hexagonal), 지도와 층과 타일셋과 타일의 속성, 타일 층(배열, base64, base64 + zlib, gzip),
//   끝없는 지도의 덩이(chunks), 묶음 층(group, 오프셋과 불투명도와 색과 보이기를 아래 층에 곱한다), 물체 층(TiledObjectLayer 로 돌려준다),
//   타일셋의 격자와 그림 모음, 타일 오프셋, 그리는 크기, 채우기, 타일 애니메이션, 타일 충돌 모양(타일의 objectgroup), 층 섞기(mode).
// - 범위 밖: zstd 압축(던진다), oblique 배치(던진다), 그림 층, 물체 템플릿, 왕 셋(wangsets), 시차(parallax), 투명색(transparentcolor), 타일셋 격자의 아이소 방향.
// - zlib 과 gzip 은 브라우저와 node 의 DecompressionStream 으로 풀어서 readMap 은 비동기다. (러스트 판은 flate2 로 그 자리에서 끝난다)
// - 그림은 읽지 않는다. 타일셋에 그림 경로만 적고, collectImagePaths 로 경로를 모아 읽은 뒤 attachImages 로 건다.
//==============================================================================
/**
 * @example <caption>지도 JSON 을 읽어 타일맵 채우기</caption>
 * import { WorldNode } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const mapData = {
 * 	type: "map", orientation: "orthogonal", renderorder: "right-down", infinite: false,
 * 	width: 3, height: 2, tilewidth: 16, tileheight: 16,
 * 	properties: [{ name: "music", type: "string", value: "field" }],
 * 	tilesets: [{ firstgid: 1, name: "terrain", image: "terrain.png", imagewidth: 64, imageheight: 32, tilewidth: 16, tileheight: 16, columns: 4, tilecount: 8, margin: 0, spacing: 0 }],
 * 	layers: [
 * 		{ type: "tilelayer", name: "ground", width: 3, height: 2, data: [1, 2, 3, 4, 2147483653, 6], opacity: 1, visible: true, x: 0, y: 0 },
 * 		{ type: "objectgroup", name: "spawn", objects: [{ id: 1, name: "player", type: "start", x: 8, y: 8, width: 0, height: 0, point: true, rotation: 0, visible: true }] },
 * 	],
 * };
 * const mapNode = new WorldNode();
 * const tilemap = mapNode.addComponent(Experimental.Tilemap);
 * const tiledMap = await Experimental.TiledMapReader.readMap(mapData, tilemap, "maps/field.tmj");
 * console.log(tilemap.getLayerCount(), tilemap.getLayer(0).getTile(1, 1) >>> 0);
 * console.log(tiledMap.properties.get("music"), tiledMap.objectLayers[0].objects[0].name);
 * console.log(Experimental.TiledMapReader.collectImagePaths(tilemap));
 */


//==============================================================================
// Tiled 층 섞기 이름 → Canvas2D globalCompositeOperation 이름. (같은 것은 그대로)
//==============================================================================
const BLEND_MODE_NAME_TABLE = {
	normal: "source-over",
	add: "lighter",
};


//==============================================================================
// 읽은 물체 하나. (Tiled 물체)
//==============================================================================
/**
 * @example <caption>물체 자료 만들기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const tiledObject = new Experimental.TiledObject();
 * tiledObject.name = "chest";
 * tiledObject.shape = Experimental.TileCollisionShape.createRectangle(32, 48, 16, 16);
 * console.log(tiledObject.name, tiledObject.shape.kind, tiledObject.tile);
 */
export class TiledObject {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { number } */ id; // 지도 안의 물체 번호.
	/** @type { string } */ name; // 이름.
	/** @type { string } */ type; // 종류. (Tiled 의 class)
	/** @type { number } */ tile; // 타일 물체면 타일 값. (뒤집기 비트를 포함한 gid, 아니면 0, Tiled 처럼 x, y 는 그림의 왼쪽 아래)
	/** @type { TileCollisionShape } */ shape; // 모양과 자리. (지도 픽셀 좌표, 글 물체는 사각형)
	/** @type { boolean } */ isVisible; // 보이는지.
	/** @type { Map<string, any> } */ properties; // 속성.

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		this.id = 0;
		this.name = "";
		this.type = "";
		this.tile = 0;
		this.shape = new TileCollisionShape();
		this.isVisible = true;
		this.properties = new System.Map();
	}
}


//==============================================================================
// 읽은 물체 층 하나. (Tiled objectgroup)
//==============================================================================
/**
 * @example <caption>물체 층에서 이름으로 찾기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const objectLayer = new Experimental.TiledObjectLayer();
 * const door = new Experimental.TiledObject();
 * door.name = "door";
 * objectLayer.objects.push(door);
 * const found = objectLayer.objects.find((tiledObject) => tiledObject.name === "door");
 * console.log(found !== undefined, objectLayer.opacity);
 */
export class TiledObjectLayer {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { string } */ name; // 이름.
	/** @type { boolean } */ isVisible; // 보이는지. (묶음 층의 보이기를 곱한 것)
	/** @type { number } */ opacity; // 불투명도. (묶음 층의 불투명도를 곱한 것)
	/** @type { Vector2 } */ offset; // 자리 오프셋. (픽셀, 묶음 층의 오프셋을 더한 것)
	/** @type { Map<string, any> } */ properties; // 속성.
	/** @type { TiledObject[] } */ objects; // 물체 목록. (파일 차례)

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		this.name = "";
		this.isVisible = true;
		this.opacity = 1;
		this.offset = Vector2.zero();
		this.properties = new System.Map();
		this.objects = [];
	}
}


//==============================================================================
// 읽은 지도에서 Tilemap 에 담지 않는 것. (지도 속성, 배경색, 물체 층)
//==============================================================================
/**
 * @example <caption>빈 결과</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const tiledMap = new Experimental.TiledMap();
 * console.log(tiledMap.properties.size, tiledMap.backgroundColor, tiledMap.objectLayers.length);
 */
export class TiledMap {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { Map<string, any> } */ properties; // 지도 속성.
	/** @type { Color | null } */ backgroundColor; // 배경색. (없으면 null)
	/** @type { TiledObjectLayer[] } */ objectLayers; // 물체 층. (파일 차례)

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		this.properties = new System.Map();
		this.backgroundColor = null;
		this.objectLayers = [];
	}
}


//==============================================================================
// Tiled JSON 지도 읽기.
//==============================================================================
/**
 * @example <caption>저장소 예제 지도를 읽고 그림까지 걸기</caption>
 * import { JsonAsset, ImageAsset, WorldNode } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const mapPath = "examples/tilemapshowcase/assets/orthogonal.tmj";
 * const mapAsset = new JsonAsset();
 * await mapAsset.load(mapPath);
 * const readTileset = async (tilesetPath) => {
 * 	const tilesetAsset = new JsonAsset();
 * 	await tilesetAsset.load(tilesetPath);
 * 	return tilesetAsset.data;
 * };
 * const mapNode = new WorldNode();
 * const tilemap = mapNode.addComponent(Experimental.Tilemap);
 * await Experimental.TiledMapReader.readMap(mapAsset.data, tilemap, mapPath, readTileset);
 * const imageTable = new Map();
 * for (const imagePath of Experimental.TiledMapReader.collectImagePaths(tilemap)) {
 * 	const imageAsset = new ImageAsset();
 * 	await imageAsset.load(imagePath);
 * 	imageTable.set(imagePath, imageAsset.image);
 * }
 * Experimental.TiledMapReader.attachImages(tilemap, (imagePath) => imageTable.get(imagePath) || null);
 * console.log(tilemap.getLayerCount(), tilemap.getTilesets().length);
 */
export class TiledMapReader {
	//==============================================================================
	// 지도 읽기. (정적, 비동기)
	// - tilemap 의 배치, 칸 크기, 지도 크기를 정하고 타일셋과 타일 층을 더한다. (이미 있던 층과 타일셋 뒤에 더한다)
	// - 바깥 타일셋(source)은 readTilesetHandler(지도 경로에서 푼 경로) 가 돌려준 JSON 으로 읽는다. (프로미스를 돌려줘도 된다)
	//==============================================================================
	/**
	 * @param { object } mapData 지도 JSON 을 푼 값.
	 * @param { Tilemap } tilemap 채울 타일맵.
	 * @param { string } mapPath 지도 파일 경로. (타일셋과 그림의 상대 경로를 푸는 기준, 기본 빈 글)
	 * @param { Function | null } readTilesetHandler (tilesetPath) => object | null | Promise, 바깥 타일셋 JSON. (기본 null)
	 * @returns { Promise<TiledMap> } 지도 속성, 배경색, 물체 층. (지원하지 않는 배치나 압축, 바깥 타일셋을 못 읽으면 거부된다)
	 */
	static async readMap(mapData, tilemap, mapPath = "", readTilesetHandler = null) {
		const tiledMap = new TiledMap();
		const orientation = TiledMapReader.readString(mapData, "orientation", TilemapOrientation.orthogonal);
		const orientationList = [TilemapOrientation.orthogonal, TilemapOrientation.isometric, TilemapOrientation.staggered, TilemapOrientation.hexagonal];
		if (!orientationList.includes(orientation)) {
			throw new Error("TiledMapReader: unsupported orientation " + orientation);
		}
		tilemap.setOrientation(orientation);
		const tileWidth = TiledMapReader.readNumber(mapData, "tilewidth", 32);
		const tileHeight = TiledMapReader.readNumber(mapData, "tileheight", 32);
		tilemap.setTileSize(tileWidth, tileHeight);
		const columnCount = TiledMapReader.readNumber(mapData, "width", 0);
		const rowCount = TiledMapReader.readNumber(mapData, "height", 0);
		tilemap.setMapSize(columnCount, rowCount);
		const hexSideLength = TiledMapReader.readNumber(mapData, "hexsidelength", 0);
		tilemap.setHexSideLength(hexSideLength);
		const staggerAxis = TiledMapReader.readString(mapData, "staggeraxis", TilemapStaggerAxis.y);
		tilemap.setStaggerAxis(staggerAxis === TilemapStaggerAxis.x ? TilemapStaggerAxis.x : TilemapStaggerAxis.y);
		const staggerIndex = TiledMapReader.readString(mapData, "staggerindex", TilemapStaggerIndex.odd);
		tilemap.setStaggerIndex(staggerIndex === TilemapStaggerIndex.even ? TilemapStaggerIndex.even : TilemapStaggerIndex.odd);
		const renderOrder = TiledMapReader.readString(mapData, "renderorder", TilemapRenderOrder.rightDown);
		const renderOrderList = [TilemapRenderOrder.rightDown, TilemapRenderOrder.rightUp, TilemapRenderOrder.leftDown, TilemapRenderOrder.leftUp];
		tilemap.setRenderOrder(renderOrderList.includes(renderOrder) ? renderOrder : TilemapRenderOrder.rightDown);
		const backgroundColorText = TiledMapReader.readString(mapData, "backgroundcolor", "");
		tiledMap.backgroundColor = TiledMapReader.parseColor(backgroundColorText);
		tiledMap.properties = TiledMapReader.readProperties(mapData);

		// 타일셋.
		const tilesetEntryList = System.Array.isArray(mapData.tilesets) ? mapData.tilesets : [];
		for (const tilesetEntry of tilesetEntryList) {
			const firstGid = TiledMapReader.readNumber(tilesetEntry, "firstgid", 0);
			const sourcePath = TiledMapReader.readString(tilesetEntry, "source", "");
			let tileset = null;
			if (sourcePath !== "") {
				const tilesetPath = TiledMapReader.resolvePath(mapPath, sourcePath);
				let tilesetData = null;
				if (readTilesetHandler !== null) {
					tilesetData = await readTilesetHandler(tilesetPath);
				}
				if (tilesetData === null || tilesetData === undefined) {
					throw new Error("TiledMapReader: cannot read tileset " + tilesetPath);
				}
				tileset = TiledMapReader.readTileset(tilesetData, tilesetPath);
			}
			else {
				tileset = TiledMapReader.readTileset(tilesetEntry, mapPath);
			}
			tilemap.addTileset(tileset, firstGid);
		}

		// 층. (묶음 층은 펼친다)
		const layerEntryList = System.Array.isArray(mapData.layers) ? mapData.layers : [];
		const groupState = { offsetX: 0, offsetY: 0, opacity: 1, isVisible: true, red: 1, green: 1, blue: 1, alpha: 1 };
		await TiledMapReader.readLayerList(layerEntryList, tilemap, tiledMap, groupState);
		return tiledMap;
	}

	//==============================================================================
	// 층 목록 읽기. (정적, 비동기, 묶음 층은 그 값을 곱하고 더해 아래로 내린다)
	//==============================================================================
	/**
	 * @private
	 * @param { object[] } layerEntryList
	 * @param { Tilemap } tilemap
	 * @param { TiledMap } tiledMap
	 * @param { object } groupState
	 * @returns { Promise<void> }
	 */
	static async readLayerList(layerEntryList, tilemap, tiledMap, groupState) {
		for (const layerEntry of layerEntryList) {
			const layerType = TiledMapReader.readString(layerEntry, "type", "");
			const offsetX = groupState.offsetX + TiledMapReader.readNumber(layerEntry, "offsetx", 0);
			const offsetY = groupState.offsetY + TiledMapReader.readNumber(layerEntry, "offsety", 0);
			const opacity = groupState.opacity * TiledMapReader.readNumber(layerEntry, "opacity", 1);
			const isVisible = groupState.isVisible && layerEntry.visible !== false;
			const tintColorText = TiledMapReader.readString(layerEntry, "tintcolor", "");
			const tintColor = TiledMapReader.parseColor(tintColorText);
			let red = groupState.red;
			let green = groupState.green;
			let blue = groupState.blue;
			let alpha = groupState.alpha;
			if (tintColor !== null) {
				red *= tintColor.red;
				green *= tintColor.green;
				blue *= tintColor.blue;
				alpha *= tintColor.alpha;
			}
			const name = TiledMapReader.readString(layerEntry, "name", "");
			const properties = TiledMapReader.readProperties(layerEntry);
			switch (layerType) {
				case "tilelayer": {
						const layer = new TilemapLayer(name);
						layer.setVisible(isVisible);
						layer.setOpacity(opacity);
						layer.setColor(new Color(red, green, blue, alpha));
						layer.setOffset(Vector2.create(offsetX, offsetY));
						const modeName = TiledMapReader.readString(layerEntry, "mode", "normal");
						const blendMode = BLEND_MODE_NAME_TABLE[modeName] !== undefined ? BLEND_MODE_NAME_TABLE[modeName] : modeName;
						layer.setBlendMode(blendMode);
						for (const [propertyName, propertyValue] of properties) {
							layer.setProperty(propertyName, propertyValue);
						}
						const encoding = TiledMapReader.readString(layerEntry, "encoding", "csv");
						const compression = TiledMapReader.readString(layerEntry, "compression", "");
						if (System.Array.isArray(layerEntry.chunks)) {
							for (const chunkEntry of layerEntry.chunks) {
								const chunkWidth = TiledMapReader.readNumber(chunkEntry, "width", 0);
								const chunkHeight = TiledMapReader.readNumber(chunkEntry, "height", 0);
								const chunkX = TiledMapReader.readNumber(chunkEntry, "x", 0);
								const chunkY = TiledMapReader.readNumber(chunkEntry, "y", 0);
								const chunkTileList = await TiledMapReader.readLayerData(chunkEntry.data, encoding, compression, chunkWidth * chunkHeight);
								layer.setTiles(chunkX, chunkY, chunkWidth, chunkHeight, chunkTileList);
							}
						}
						else {
							const layerWidth = TiledMapReader.readNumber(layerEntry, "width", 0);
							const layerHeight = TiledMapReader.readNumber(layerEntry, "height", 0);
							const tileList = await TiledMapReader.readLayerData(layerEntry.data, encoding, compression, layerWidth * layerHeight);
							layer.setTiles(0, 0, layerWidth, layerHeight, tileList);
						}
						tilemap.addLayer(layer);
						break;
					}
				case "objectgroup": {
						const objectLayer = new TiledObjectLayer();
						objectLayer.name = name;
						objectLayer.isVisible = isVisible;
						objectLayer.opacity = opacity;
						objectLayer.offset = Vector2.create(offsetX, offsetY);
						objectLayer.properties = properties;
						const objectEntryList = System.Array.isArray(layerEntry.objects) ? layerEntry.objects : [];
						for (const objectEntry of objectEntryList) {
							const tiledObject = TiledMapReader.readObject(objectEntry);
							objectLayer.objects.push(tiledObject);
						}
						tiledMap.objectLayers.push(objectLayer);
						break;
					}
				case "group": {
						const childState = { offsetX: offsetX, offsetY: offsetY, opacity: opacity, isVisible: isVisible, red: red, green: green, blue: blue, alpha: alpha };
						const childEntryList = System.Array.isArray(layerEntry.layers) ? layerEntry.layers : [];
						await TiledMapReader.readLayerList(childEntryList, tilemap, tiledMap, childState);
						break;
					}
				default: {
						break;
					}
			}
		}
	}

	//==============================================================================
	// 타일셋 읽기. (정적, .tsj 나 지도 안의 타일셋)
	//==============================================================================
	/**
	 * @param { object } tilesetData 타일셋 JSON 을 푼 값.
	 * @param { string } tilesetPath 타일셋 파일 경로. (그림의 상대 경로를 푸는 기준, 지도 안이면 지도 경로)
	 * @returns { Tileset } 새 타일셋. (그림은 비어 있고 경로만 적혀 있다)
	 */
	static readTileset(tilesetData, tilesetPath = "") {
		const tileset = new Tileset();
		const name = TiledMapReader.readString(tilesetData, "name", "");
		tileset.setName(name);
		const tileWidth = TiledMapReader.readNumber(tilesetData, "tilewidth", 0);
		const tileHeight = TiledMapReader.readNumber(tilesetData, "tileheight", 0);
		tileset.setTileSize(tileWidth, tileHeight);
		const margin = TiledMapReader.readNumber(tilesetData, "margin", 0);
		tileset.setMargin(margin);
		const spacing = TiledMapReader.readNumber(tilesetData, "spacing", 0);
		tileset.setSpacing(spacing);
		const columns = TiledMapReader.readNumber(tilesetData, "columns", 0);
		tileset.setColumns(columns);
		const tileCount = TiledMapReader.readNumber(tilesetData, "tilecount", 0);
		tileset.setTileCount(tileCount);
		const imageName = TiledMapReader.readString(tilesetData, "image", "");
		if (imageName !== "") {
			const imagePath = TiledMapReader.resolvePath(tilesetPath, imageName);
			tileset.setImagePath(imagePath);
		}
		if (tilesetData.tileoffset !== null && typeof tilesetData.tileoffset === "object") {
			const offsetX = TiledMapReader.readNumber(tilesetData.tileoffset, "x", 0);
			const offsetY = TiledMapReader.readNumber(tilesetData.tileoffset, "y", 0);
			tileset.setTileOffset(Vector2.create(offsetX, offsetY));
		}
		const tileRenderSize = TiledMapReader.readString(tilesetData, "tilerendersize", TileRenderSize.tile);
		tileset.setTileRenderSize(tileRenderSize === TileRenderSize.grid ? TileRenderSize.grid : TileRenderSize.tile);
		const fillMode = TiledMapReader.readString(tilesetData, "fillmode", TileFillMode.stretch);
		tileset.setFillMode(fillMode === TileFillMode.preserveAspectFit ? TileFillMode.preserveAspectFit : TileFillMode.stretch);
		const properties = TiledMapReader.readProperties(tilesetData);
		for (const [propertyName, propertyValue] of properties) {
			tileset.setProperty(propertyName, propertyValue);
		}

		// 타일마다.
		const tileEntryList = System.Array.isArray(tilesetData.tiles) ? tilesetData.tiles : [];
		for (const tileEntry of tileEntryList) {
			const tileId = TiledMapReader.readNumber(tileEntry, "id", 0);
			const tileImageName = TiledMapReader.readString(tileEntry, "image", "");
			if (tileImageName !== "") {
				const tileImagePath = TiledMapReader.resolvePath(tilesetPath, tileImageName);
				tileset.setTileImagePath(tileId, tileImagePath);
			}
			const hasSubRectangle = tileEntry.x !== undefined || tileEntry.y !== undefined || tileEntry.width !== undefined || tileEntry.height !== undefined;
			if (tileImageName !== "" || hasSubRectangle) {
				const imageWidth = TiledMapReader.readNumber(tileEntry, "imagewidth", tileWidth);
				const imageHeight = TiledMapReader.readNumber(tileEntry, "imageheight", tileHeight);
				const rectX = TiledMapReader.readNumber(tileEntry, "x", 0);
				const rectY = TiledMapReader.readNumber(tileEntry, "y", 0);
				const rectWidth = TiledMapReader.readNumber(tileEntry, "width", imageWidth);
				const rectHeight = TiledMapReader.readNumber(tileEntry, "height", imageHeight);
				const imageRect = Rect.create(rectX, rectY, rectWidth, rectHeight);
				tileset.setTileImageRect(tileId, imageRect);
			}
			let tileType = TiledMapReader.readString(tileEntry, "type", "");
			if (tileType === "") {
				tileType = TiledMapReader.readString(tileEntry, "class", "");
			}
			if (tileType !== "") {
				tileset.setTileType(tileId, tileType);
			}
			const tileProperties = TiledMapReader.readProperties(tileEntry);
			for (const [propertyName, propertyValue] of tileProperties) {
				tileset.setTileProperty(tileId, propertyName, propertyValue);
			}
			if (System.Array.isArray(tileEntry.animation) && tileEntry.animation.length > 0) {
				const frameList = [];
				for (const frameEntry of tileEntry.animation) {
					const frameTileId = TiledMapReader.readNumber(frameEntry, "tileid", 0);
					const duration = TiledMapReader.readNumber(frameEntry, "duration", 0);
					frameList.push(new TileAnimationFrame(frameTileId, duration));
				}
				tileset.setTileAnimation(tileId, frameList);
			}
			if (tileEntry.objectgroup !== null && typeof tileEntry.objectgroup === "object" && System.Array.isArray(tileEntry.objectgroup.objects)) {
				const shapeList = [];
				for (const objectEntry of tileEntry.objectgroup.objects) {
					const tiledObject = TiledMapReader.readObject(objectEntry);
					shapeList.push(tiledObject.shape);
				}
				tileset.setTileCollisionShapes(tileId, shapeList);
			}
		}
		return tileset;
	}

	//==============================================================================
	// 물체 하나 읽기. (정적)
	//==============================================================================
	/**
	 * @private
	 * @param { object } objectEntry
	 * @returns { TiledObject }
	 */
	static readObject(objectEntry) {
		const tiledObject = new TiledObject();
		tiledObject.id = TiledMapReader.readNumber(objectEntry, "id", 0);
		tiledObject.name = TiledMapReader.readString(objectEntry, "name", "");
		tiledObject.type = TiledMapReader.readString(objectEntry, "type", "");
		if (tiledObject.type === "") {
			tiledObject.type = TiledMapReader.readString(objectEntry, "class", "");
		}
		tiledObject.tile = TiledMapReader.readNumber(objectEntry, "gid", 0) >>> 0;
		tiledObject.isVisible = objectEntry.visible !== false;
		tiledObject.properties = TiledMapReader.readProperties(objectEntry);
		let kind = TileCollisionShapeKind.rectangle;
		if (objectEntry.ellipse === true) {
			kind = TileCollisionShapeKind.ellipse;
		}
		else if (objectEntry.capsule === true) {
			kind = TileCollisionShapeKind.capsule;
		}
		else if (objectEntry.point === true) {
			kind = TileCollisionShapeKind.point;
		}
		else if (System.Array.isArray(objectEntry.polygon)) {
			kind = TileCollisionShapeKind.polygon;
		}
		else if (System.Array.isArray(objectEntry.polyline)) {
			kind = TileCollisionShapeKind.polyline;
		}
		const shape = new TileCollisionShape(kind);
		shape.x = TiledMapReader.readNumber(objectEntry, "x", 0);
		shape.y = TiledMapReader.readNumber(objectEntry, "y", 0);
		shape.width = TiledMapReader.readNumber(objectEntry, "width", 0);
		shape.height = TiledMapReader.readNumber(objectEntry, "height", 0);
		shape.rotation = TiledMapReader.readNumber(objectEntry, "rotation", 0);
		const pointEntryList = kind === TileCollisionShapeKind.polygon ? objectEntry.polygon : (kind === TileCollisionShapeKind.polyline ? objectEntry.polyline : []);
		for (const pointEntry of pointEntryList) {
			const pointX = TiledMapReader.readNumber(pointEntry, "x", 0);
			const pointY = TiledMapReader.readNumber(pointEntry, "y", 0);
			shape.points.push(Vector2.create(pointX, pointY));
		}
		tiledObject.shape = shape;
		return tiledObject;
	}

	//==============================================================================
	// 타일 층 자료 읽기. (정적, 비동기, 배열이나 base64 와 압축을 타일 값 배열로)
	//==============================================================================
	/**
	 * @param { number[] | string } data 층의 data. (gid 배열이나 base64 글)
	 * @param { string } encoding "csv" 나 "base64".
	 * @param { string } compression 압축. ("", "zlib", "gzip", "zstd" 는 범위 밖)
	 * @param { number } tileCount 있어야 할 칸 수. (모자라면 0 으로 채운다)
	 * @returns { Promise<Uint32Array> } 타일 값. (행 차례)
	 */
	static async readLayerData(data, encoding, compression, tileCount) {
		const tileList = new System.Uint32Array(System.Math.max(0, tileCount));
		if (System.Array.isArray(data)) {
			const copyCount = System.Math.min(data.length, tileList.length);
			for (let tileIndex = 0; tileIndex < copyCount; ++tileIndex) {
				tileList[tileIndex] = data[tileIndex] >>> 0;
			}
			return tileList;
		}
		if (typeof data !== "string") {
			return tileList;
		}
		if (encoding === "base64") {
			const encodedBytes = TiledMapReader.decodeBase64(data);
			const bytes = await TiledMapReader.decompress(encodedBytes, compression);
			const copyCount = System.Math.min(System.Math.floor(bytes.length / 4), tileList.length);
			for (let tileIndex = 0; tileIndex < copyCount; ++tileIndex) {
				const byteIndex = tileIndex * 4;
				tileList[tileIndex] = (bytes[byteIndex] | (bytes[byteIndex + 1] << 8) | (bytes[byteIndex + 2] << 16) | (bytes[byteIndex + 3] << 24)) >>> 0;
			}
			return tileList;
		}
		const valueTextList = data.split(",");
		const copyCount = System.Math.min(valueTextList.length, tileList.length);
		for (let tileIndex = 0; tileIndex < copyCount; ++tileIndex) {
			const value = System.Number(valueTextList[tileIndex].trim());
			tileList[tileIndex] = System.Number.isFinite(value) ? value >>> 0 : 0;
		}
		return tileList;
	}

	//==============================================================================
	// base64 풀기. (정적, 공백은 건너뛴다)
	//==============================================================================
	/**
	 * @param { string } text base64 글.
	 * @returns { Uint8Array } 바이트. (틀린 글자가 있으면 던진다)
	 */
	static decodeBase64(text) {
		const compactText = text.replace(/\s+/g, "");
		const binaryText = System.atob(compactText);
		const bytes = new System.Uint8Array(binaryText.length);
		for (let byteIndex = 0; byteIndex < binaryText.length; ++byteIndex) {
			bytes[byteIndex] = binaryText.charCodeAt(byteIndex);
		}
		return bytes;
	}

	//==============================================================================
	// 압축 풀기. (정적, 비동기, zlib 과 gzip 은 DecompressionStream)
	//==============================================================================
	/**
	 * @param { Uint8Array } bytes 압축된 바이트.
	 * @param { string } compression "", "zlib", "gzip". ("zstd" 와 그 밖은 범위 밖이라 던진다)
	 * @returns { Promise<Uint8Array> } 푼 바이트. (압축이 없으면 그대로)
	 */
	static async decompress(bytes, compression) {
		if (compression === "" || compression === undefined || compression === null) {
			return bytes;
		}
		let streamFormat = "";
		if (compression === "zlib") {
			streamFormat = "deflate";
		}
		else if (compression === "gzip") {
			streamFormat = "gzip";
		}
		else {
			throw new Error("TiledMapReader: unsupported compression " + compression);
		}
		const decompressionStream = new System.DecompressionStream(streamFormat);
		const blob = new System.Blob([bytes]);
		const blobStream = blob.stream();
		const decompressedStream = blobStream.pipeThrough(decompressionStream);
		const response = new System.Response(decompressedStream);
		const arrayBuffer = await response.arrayBuffer();
		return new System.Uint8Array(arrayBuffer);
	}

	//==============================================================================
	// Tiled 색 글 풀기. (정적, "#RRGGBB" 나 "#AARRGGBB", 알파가 앞이다)
	//==============================================================================
	/**
	 * @param { string } text 색 글. (# 은 없어도 된다)
	 * @returns { Color | null } 색. (비었거나 꼴이 틀리면 null)
	 */
	static parseColor(text) {
		if (typeof text !== "string") {
			return null;
		}
		const hexText = text.startsWith("#") ? text.substring(1) : text;
		if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hexText)) {
			return null;
		}
		let alpha = 255;
		let colorText = hexText;
		if (hexText.length === 8) {
			alpha = System.parseInt(hexText.substring(0, 2), 16);
			colorText = hexText.substring(2);
		}
		const red = System.parseInt(colorText.substring(0, 2), 16);
		const green = System.parseInt(colorText.substring(2, 4), 16);
		const blue = System.parseInt(colorText.substring(4, 6), 16);
		return new Color(red / 255, green / 255, blue / 255, alpha / 255);
	}

	//==============================================================================
	// 상대 경로 풀기. (정적, 기준 파일이 든 폴더에서, . 과 .. 을 줄인다)
	//==============================================================================
	/**
	 * @param { string } basePath 기준 파일 경로. (빈 글이면 상대 경로 그대로)
	 * @param { string } relativePath 풀 경로. (/ 로 시작하거나 "이름:" 꼴(주소, 드라이브)이면 그대로)
	 * @returns { string } 푼 경로.
	 */
	static resolvePath(basePath, relativePath) {
		const normalizedRelativePath = relativePath.replace(/\\/g, "/");
		if (normalizedRelativePath.startsWith("/") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalizedRelativePath)) {
			return normalizedRelativePath;
		}
		const normalizedBasePath = basePath.replace(/\\/g, "/");
		const slashIndex = normalizedBasePath.lastIndexOf("/");
		const directoryPath = slashIndex >= 0 ? normalizedBasePath.substring(0, slashIndex + 1) : "";
		const combinedPath = directoryPath + normalizedRelativePath;
		const isRooted = combinedPath.startsWith("/");
		const segmentList = [];
		for (const segment of combinedPath.split("/")) {
			if (segment === "" || segment === ".") {
				continue;
			}
			if (segment === ".." && segmentList.length > 0 && segmentList[segmentList.length - 1] !== "..") {
				segmentList.pop();
				continue;
			}
			segmentList.push(segment);
		}
		const joinedPath = segmentList.join("/");
		return isRooted ? "/" + joinedPath : joinedPath;
	}

	//==============================================================================
	// 타일맵이 쓰는 그림 경로 모으기. (정적, 타일셋 그림과 타일마다의 그림, 겹치지 않게 처음 나온 차례)
	//==============================================================================
	/**
	 * @param { Tilemap } tilemap 읽은 타일맵.
	 * @returns { string[] } 그림 경로.
	 */
	static collectImagePaths(tilemap) {
		const imagePathList = [];
		const tilesets = tilemap.getTilesets();
		for (const tileset of tilesets) {
			const imagePath = tileset.getImagePath();
			if (imagePath !== "" && !imagePathList.includes(imagePath)) {
				imagePathList.push(imagePath);
			}
			const tileIdList = tileset.getDefinedTileIds();
			for (const tileId of tileIdList) {
				const tileImagePath = tileset.getTileImagePath(tileId);
				if (tileImagePath !== "" && !imagePathList.includes(tileImagePath)) {
					imagePathList.push(tileImagePath);
				}
			}
		}
		return imagePathList;
	}

	//==============================================================================
	// 읽은 그림을 타일셋에 걸기. (정적, 그림 경로마다 readImageHandler 에 묻는다)
	//==============================================================================
	/**
	 * @param { Tilemap } tilemap 읽은 타일맵.
	 * @param { Function } readImageHandler (imagePath) => HTMLImageElement | ImageAsset | null
	 */
	static attachImages(tilemap, readImageHandler) {
		const tilesets = tilemap.getTilesets();
		for (const tileset of tilesets) {
			const imagePath = tileset.getImagePath();
			if (imagePath !== "") {
				const image = readImageHandler(imagePath);
				if (image !== null && image !== undefined) {
					tileset.setImage(image);
				}
			}
			const tileIdList = tileset.getDefinedTileIds();
			for (const tileId of tileIdList) {
				const tileImagePath = tileset.getTileImagePath(tileId);
				if (tileImagePath === "") {
					continue;
				}
				const tileImage = readImageHandler(tileImagePath);
				if (tileImage !== null && tileImage !== undefined) {
					tileset.setTileImage(tileId, tileImage);
				}
			}
		}
	}

	//==============================================================================
	// 속성 배열 읽기. (정적, [{ name, type, value }] → 이름 → 값)
	//==============================================================================
	/**
	 * @private
	 * @param { object } entry
	 * @returns { Map<string, any> }
	 */
	static readProperties(entry) {
		const properties = new System.Map();
		if (entry === null || entry === undefined || !System.Array.isArray(entry.properties)) {
			return properties;
		}
		for (const propertyEntry of entry.properties) {
			if (typeof propertyEntry.name !== "string") {
				continue;
			}
			properties.set(propertyEntry.name, propertyEntry.value);
		}
		return properties;
	}

	//==============================================================================
	// 수 읽기. (정적, 없거나 수가 아니면 기본값)
	//==============================================================================
	/**
	 * @private
	 * @param { object } entry
	 * @param { string } key
	 * @param { number } defaultValue
	 * @returns { number }
	 */
	static readNumber(entry, key, defaultValue) {
		if (entry === null || entry === undefined) {
			return defaultValue;
		}
		const value = entry[key];
		if (typeof value !== "number" || !System.Number.isFinite(value)) {
			return defaultValue;
		}
		return value;
	}

	//==============================================================================
	// 글 읽기. (정적, 없거나 글이 아니면 기본값)
	//==============================================================================
	/**
	 * @private
	 * @param { object } entry
	 * @param { string } key
	 * @param { string } defaultValue
	 * @returns { string }
	 */
	static readString(entry, key, defaultValue) {
		if (entry === null || entry === undefined) {
			return defaultValue;
		}
		const value = entry[key];
		if (typeof value !== "string") {
			return defaultValue;
		}
		return value;
	}
}
