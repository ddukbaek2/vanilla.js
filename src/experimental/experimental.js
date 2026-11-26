//==============================================================================
// 실험 기능. (0.4.0 뒤 기능의 초안, API 가 바뀔 수 있음)
// - 다음 판에 넣을 기능의 초안을 모아 내보낸다. import.js 가 Experimental 이름 공간으로 다시 내보낸다. (Experimental.이름)
// - 초안 하나는 src/experimental/<이름>/ 폴더에 두고, 여기에 내보내기 한 줄을 더한다.
// - 다 자란 기능은 제자리(base, core, misc, graphics3d 같은)로 옮기고 import.js 에서 바로 내보낸다.
// - 지금은 비어 있다.
//==============================================================================

/**
 * @example <caption>초안 이름 공간 둘러보기</caption>
 * import { Experimental } from "./build/vanilla.js";
 *
 * console.log(Object.keys(Experimental));
 */


// 초안 내보내기 목록. (초안을 넣으면 아래에 한 줄씩 더한다. 예: export { 이름 } from "./<이름>/<파일>.js";)
export { PanningModel, DistanceModel, PannerSettings, calculateDistanceGain, calculateConeGain, calculateAzimuthElevation, calculateDistanceConeGain, calculateEqualPowerGains, convertViewPositionToAudioPosition } from "./spatialaudio/spatialaudiomath.js";
export { SpatialAudioPlayer } from "./spatialaudio/spatialaudioplayer.js";
export { SpatialAudioListener } from "./spatialaudio/spatialaudiolistener.js";
export { AudioSource2D } from "./spatialaudio/audiosource2d.js";
export { AudioListener2D } from "./spatialaudio/audiolistener2d.js";
export { SaveGameManager, SaveGameError, SaveSlotInfo, SaveSlotOptions, calculateCrc32 } from "./savegame/savegamemanager.js";
export { SaveStorage, LocalSaveStorage, MemorySaveStorage, SaveCloudProvider } from "./savegame/savestorage.js";
export {};
