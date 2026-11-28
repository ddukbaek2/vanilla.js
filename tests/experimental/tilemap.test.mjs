//==============================================================================
// 타일맵 초안 시험. (node tests/experimental/tilemap.test.mjs)
// - examples/tilemapshowcase/check.mjs 의 값 검사(러스트 판 src/experimental/tilemap 시험과 같은 값)를 돌리고,
//   층 자료 수 읽기, 섞기 이름, 오류 글, 덩이 크기, 사본 게터를 러스트 판 시험(tiledmapreader.rs 의 layer_values_blend_and_errors_match_original)과 같은 값으로 본다.
//==============================================================================
import { spawnSync } from "node:child_process";
import path from "node:path";
import url from "node:url";
import * as Experimental from "../../src/experimental/experimental.js";

const { TiledMapReader, Tilemap, TilemapLayer, Tileset, DEFAULT_CHUNK_SIZE } = Experimental;
let checkCount = 0;
function check(condition, message) {
	checkCount++;
	if (!condition) {
		throw new Error("시험 실패: " + message);
	}
}

// 예제의 값 검사. (러스트 판 시험과 같은 값)
const repositoryPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const checkResult = spawnSync(process.execPath, [path.join(repositoryPath, "examples/tilemapshowcase/check.mjs")], { encoding: "utf8" });
check(checkResult.status === 0, "examples/tilemapshowcase/check.mjs: " + checkResult.stdout.slice(-300) + checkResult.stderr.slice(-300));

// 층 자료 수 읽기: 0 ~ 2^32 - 1 의 정수만, 아니면 0. (CSV 는 Number(text))
const arrayTiles = await TiledMapReader.readLayerData([1.5, -1, 4294967296, "5", 7, 4294967295], "csv", "", 7);
check(Array.from(arrayTiles).join(",") === "0,0,0,0,7,4294967295,0", "배열 타일 값");
const textTiles = await TiledMapReader.readLayerData(" 0x10 ,1e1,-3,2.5,abc,,\t9\n", "csv", "", 7);
check(Array.from(textTiles).join(",") === "16,10,0,0,0,0,9", "CSV 타일 값");

// 오류 글. (러스트 판과 같은 글)
let base64Message = "";
try {
	TiledMapReader.decodeBase64("@@@@");
}
catch (error) {
	base64Message = error.message;
}
check(base64Message === "TiledMapReader: invalid base64", "base64 오류 글: " + base64Message);
let decompressMessage = "";
try {
	await TiledMapReader.decompress(new Uint8Array([1, 2, 3, 4]), "zlib");
}
catch (error) {
	decompressMessage = error.message;
}
check(decompressMessage === "TiledMapReader: cannot decompress zlib", "압축 풀기 오류 글: " + decompressMessage);

// 모르는 섞기 이름은 source-over. (러스트 판 BlendMode::Normal)
const blendMap = { orientation: "orthogonal", width: 1, height: 1, tilewidth: 16, tileheight: 16, layers: [
	{ type: "tilelayer", name: "a", width: 1, height: 1, data: [0], mode: "unknown-mode" },
	{ type: "tilelayer", name: "b", width: 1, height: 1, data: [0], mode: "add" },
	{ type: "tilelayer", name: "c", width: 1, height: 1, data: [0], mode: "multiply" },
], tilesets: [] };
const blendTilemap = new Tilemap();
await TiledMapReader.readMap(blendMap, blendTilemap, "blend.tmj");
check([0, 1, 2].map((layerIndex) => blendTilemap.getLayer(layerIndex).getBlendMode()).join(",") === "source-over,lighter,multiply", "섞기 이름");

// 덩이 크기. (기본 DEFAULT_CHUNK_SIZE, 1 보다 작거나 수가 아니면 1)
const chunkTilemap = new Tilemap();
check(DEFAULT_CHUNK_SIZE === 16 && chunkTilemap.createLayer("a").getChunkSize() === 16, "기본 덩이 크기");
check(chunkTilemap.createLayer("b", 8).getChunkSize() === 8 && chunkTilemap.createLayer("c", 0).getChunkSize() === 1 && new TilemapLayer("d", NaN).getChunkSize() === 1, "덩이 크기 자르기");

// 게터는 사본이나 얼린 배열이다. (밖에서 고쳐도 지도와 첫 gid 표가 그대로, 러스트 판의 조각과 사본과 같다)
const copyTilemap = new Tilemap();
copyTilemap.addTileset(new Tileset());
const copyLayer = copyTilemap.createLayer("copy");
check(Object.isFrozen(copyTilemap.getTilesets()) && Object.isFrozen(copyTilemap.getLayers()), "얼린 목록");
copyLayer.getOffset().x = 99;
copyLayer.getColor().red = 0;
copyTilemap.getTileset(0).getTileOffset().x = 99;
check(copyLayer.getOffset().x === 0 && copyLayer.getColor().red === 1 && copyTilemap.getTileset(0).getTileOffset().x === 0, "사본 게터");

console.log(`타일맵 시험 ${checkCount} 개 통과`);
