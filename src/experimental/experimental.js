//==============================================================================
// 실험 기능. (0.4.0 뒤 기능의 초안, API 가 바뀔 수 있음)
// - 다음 판에 넣을 기능의 초안을 모아 내보낸다. 진입점(import.js)과 묶음(build/vanilla.js, vanilla.min.js)에는 들지 않고, 쓰는 쪽이 이 파일을 직접 불러온다.
//   (import * as Experimental from "./src/experimental/experimental.js" 로 Experimental.이름, 엔진은 묶음이 아닌 소스 import.js 로 불러야 초안과 클래스가 하나다)
// - 초안 하나는 src/experimental/<이름>/ 폴더에 두고, 여기에 내보내기 한 줄을 더한다.
// - 다 자란 기능은 제자리(base, core, misc, graphics3d 같은)로 옮기고 import.js 에서 바로 내보낸다.
//==============================================================================

/**
 * @example <caption>초안 이름 공간 둘러보기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * console.log(Object.keys(Experimental));
 */


// 엔진 진입점을 먼저 읽는다. (엔진 모듈끼리 서로 부르는 차례를 import.js 가 맞춰 두어, 초안이 src 의 모듈을 먼저 부르면 덜 읽힌 클래스를 만난다)
import "../../import.js";


// 초안 내보내기 목록. (초안을 넣으면 아래에 한 줄씩 더한다. 예: export { 이름 } from "./<이름>/<파일>.js";)
export { Tileset, TileAnimationFrame, TileCollisionShape, TileCollisionShapeKind, TileRenderSize, TileFillMode } from "./tilemap/tileset.js";
export { TilemapLayer, DEFAULT_CHUNK_SIZE } from "./tilemap/tilemaplayer.js";
export { Tilemap, TileFlag, TilemapOrientation, TilemapStaggerAxis, TilemapStaggerIndex, TilemapRenderOrder, TilemapRenderMode } from "./tilemap/tilemap.js";
export { RuleTile, RuleTileRule, RuleTileNeighbor, RuleTileTransform } from "./tilemap/ruletile.js";
export { TiledMapReader, TiledMap, TiledObjectLayer, TiledObject } from "./tilemap/tiledmapreader.js";
export { PanningModel, DistanceModel, PannerSettings, calculateDistanceGain, calculateConeGain, calculateAzimuthElevation, calculateDistanceConeGain, calculateEqualPowerGains, convertViewPositionToAudioPosition } from "./spatialaudio/spatialaudiomath.js";
export { SpatialAudioPlayer } from "./spatialaudio/spatialaudioplayer.js";
export { SpatialAudioListener } from "./spatialaudio/spatialaudiolistener.js";
export { AudioSource2D } from "./spatialaudio/audiosource2d.js";
export { AudioListener2D } from "./spatialaudio/audiolistener2d.js";
export { SaveGameManager, SaveGameError, SaveSlotInfo, SaveSlotOptions, calculateCrc32 } from "./savegame/savegamemanager.js";
export { SaveStorage, LocalSaveStorage, MemorySaveStorage, SaveCloudProvider } from "./savegame/savestorage.js";
export * from "./skeleton2d/skeleton2dexports.js";
export { AABB2D } from "./spatial/aabb2d.js";
export { DynamicTree } from "./spatial/dynamictree.js";
export { PhysicsMath2D, Rotation2D } from "./physics2d/physicsmath2d.js";
export { ShapeType2D, Circle2D, Capsule2D, Segment2D, Polygon2D, PHYSICS2D_MAXIMUM_POLYGON_VERTICES } from "./physics2d/geometry2d.js";
export { BodyId2D, ShapeId2D, JointId2D } from "./physics2d/physicsid2d.js";
export { BodyType2D, BodyDefinition2D, Body2D } from "./physics2d/body2d.js";
export { CollisionFilter2D, QueryFilter2D, ShapeDefinition2D, ChainDefinition2D, Shape2D } from "./physics2d/shape2d.js";
export { JointType2D, DistanceJointDefinition2D, RevoluteJointDefinition2D, WeldJointDefinition2D, WheelJointDefinition2D, Joint2D } from "./physics2d/joint2d.js";
export { WorldDefinition2D, ContactEvent2D, SensorEvent2D, RayResult2D, PhysicsWorld2D } from "./physics2d/physicsworld2d.js";
export { PhysicsDebugDraw2D } from "./physics2d/physicsdebugdraw2d.js";
export { RigidBody2D } from "./physics2d/rigidbody2d.js";
export {};
