//==============================================================================
// 공간 소리 초안 시험. (node tests/experimental/spatialaudio.test.mjs)
// - PannerNode 셈(spatialaudiomath.js)을 크롬 158 OfflineAudioContext 가 그린 값과 견준다. (chrome_spatial.json, 러스트 판 vanilla-engine 의
//   tests/assets/spatialaudio/chromespatial.cjs 가 찍은 것과 같은 파일) 자동화와 멈춤이 없고 표본율이 같은 경우는 식으로 다시 그릴 수 있다.
// - 거리 모델, 원뿔, 방위각, 등력 좌우의 모서리 값과 설정 받기, 2D 컴포넌트의 자리 따라가기를 본다. (러스트 판 시험과 같은 값)
//==============================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Vector2, Vector3, WorldNode, Experimental } from "../../import.js";

const { calculateDistanceGain, calculateConeGain, calculateAzimuthElevation, calculateDistanceConeGain, calculateEqualPowerGains, convertViewPositionToAudioPosition, DistanceModel, PannerSettings, SpatialAudioPlayer, SpatialAudioListener, AudioSource2D, AudioListener2D } = Experimental;
const fround = Math.fround;
let checkCount = 0;
function check(condition, message) {
	checkCount++;
	if (!condition) {
		throw new Error("시험 실패: " + message);
	}
}

//==============================================================================
// 크롬 견주기. (식으로 다시 그린 출력)
//==============================================================================
const json = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "chrome_spatial.json"), "utf8"));
function createChannel(multiplier, modulus, offset, divisor) {
	const channel = new Float32Array(json.bufferLength);
	for (let index = 0; index < json.bufferLength; index++) {
		channel[index] = (((index * multiplier) % modulus) - offset) / divisor;
	}
	return channel;
}
const stereoChannelList = [createChannel(37, 200, 100, 250), createChannel(53, 160, 80, 200)];
const monoChannelList = [createChannel(29, 180, 90, 225)];
let maximumDifference = 0;
let staticCaseCount = 0;
for (const testCase of json.cases) {
	if (!testCase.isStatic) {
		continue;
	}
	staticCaseCount++;
	const settings = new PannerSettings();
	settings.distanceModel = testCase.panner.distanceModel;
	settings.referenceDistance = testCase.panner.refDistance;
	settings.maximumDistance = testCase.panner.maxDistance;
	settings.rolloffFactor = testCase.panner.rolloffFactor;
	settings.coneInnerAngle = testCase.panner.coneInnerAngle;
	settings.coneOuterAngle = testCase.panner.coneOuterAngle;
	settings.coneOuterGain = testCase.panner.coneOuterGain;
	const position = Vector3.create(...testCase.panner.position);
	const orientation = Vector3.create(...testCase.panner.orientation);
	const listenerPosition = Vector3.create(...testCase.listener.position);
	const { azimuth } = calculateAzimuthElevation(position, listenerPosition, Vector3.create(...testCase.listener.forward), Vector3.create(...testCase.listener.up));
	const totalGain = calculateDistanceConeGain(settings, position, orientation, listenerPosition);
	const isStereo = testCase.player.channels === "stereo";
	const gains = calculateEqualPowerGains(azimuth, isStereo ? 2 : 1);
	let aliasedAzimuth = Math.max(-180, Math.min(180, azimuth));
	aliasedAzimuth = aliasedAzimuth < -90 ? -180 - aliasedAzimuth : (aliasedAzimuth > 90 ? 180 - aliasedAzimuth : aliasedAzimuth);
	const playerGain = fround(testCase.player.gain);
	const busGain = testCase.player.busGain !== null ? fround(testCase.player.busGain) : null;
	const output = [new Float32Array(json.renderLength), new Float32Array(json.renderLength)];
	for (let frame = 0; frame < json.bufferLength; frame++) {
		const inputLeft = fround((isStereo ? stereoChannelList[0] : monoChannelList[0])[frame] * playerGain);
		const inputRight = isStereo ? fround(stereoChannelList[1][frame] * playerGain) : inputLeft;
		let left;
		let right;
		if (!isStereo) {
			left = fround(inputLeft * gains.left);
			right = fround(inputLeft * gains.right);
		}
		else if (aliasedAzimuth <= 0) {
			left = fround(inputLeft + inputRight * gains.left);
			right = fround(inputRight * gains.right);
		}
		else {
			left = fround(inputLeft * gains.left);
			right = fround(inputRight + inputLeft * gains.right);
		}
		left = fround(left * totalGain);
		right = fround(right * totalGain);
		if (busGain !== null) {
			left = fround(left * busGain);
			right = fround(right * busGain);
		}
		output[0][frame] = left;
		output[1][frame] = right;
	}
	for (let channelIndex = 0; channelIndex < 2; channelIndex++) {
		json.index.forEach((frame, valueIndex) => {
			const difference = Math.abs(output[channelIndex][frame] - testCase.values[channelIndex][valueIndex]);
			maximumDifference = Math.max(maximumDifference, difference);
			check(difference < 1e-6, `${testCase.name} 채널 ${channelIndex} 자리 ${frame}: ${output[channelIndex][frame]} / ${testCase.values[channelIndex][valueIndex]}`);
		});
		let energy = 0;
		for (let frame = 0; frame < json.renderLength; frame++) {
			energy += output[channelIndex][frame] * output[channelIndex][frame];
		}
		const expectedEnergy = testCase.energy[channelIndex];
		check(Math.abs(energy - expectedEnergy) <= expectedEnergy * 1e-6 + 1e-9, `${testCase.name} 채널 ${channelIndex} 제곱합: ${energy} / ${expectedEnergy}`);
	}
}
check(staticCaseCount === 5, "식으로 다시 그린 경우 수");

//==============================================================================
// 거리 모델, 원뿔, 방위각, 등력 좌우. (러스트 판 pannermath 시험과 같은 값)
//==============================================================================
check(calculateDistanceGain(DistanceModel.Inverse, 0.5, 1, 10000, 1) === 1, "역수 기준 안");
check(calculateDistanceGain(DistanceModel.Inverse, 3, 1, 10000, 0.5) === 0.5, "역수");
check(calculateDistanceGain(DistanceModel.Inverse, 3, 0, 10000, 1) === 0, "역수 기준 0");
check(calculateDistanceGain(DistanceModel.Linear, 100, 2, 10, 1) === 0, "선형 최대 밖");
check(calculateDistanceGain(DistanceModel.Linear, 6, 2, 10, 3) === 0.5, "선형 rolloff 자르기");
check(calculateDistanceGain(DistanceModel.Linear, 6, 5, 5, 0.25) === 0.75, "선형 기준과 최대가 같음");
check(calculateDistanceGain(DistanceModel.Linear, 6, 10, 2, 1) === 0.5, "선형 기준이 최대보다 큼");
check(calculateDistanceGain(DistanceModel.Exponential, 4, 2, 10000, 1) === 0.5, "지수");
check(calculateDistanceGain(DistanceModel.Exponential, 4, 0, 10000, 1) === 0, "지수 기준 0");
check(calculateDistanceGain(DistanceModel.Exponential, 4, 2, 10000, -1) === 1, "지수 rolloff 음수");
const origin = Vector3.create(0, 0, 0);
const facingX = Vector3.create(1, 0, 0);
check(calculateConeGain(origin, facingX, Vector3.create(5, 0, 0), 60, 180, 0.2) === 1, "원뿔 안");
check(Math.abs(calculateConeGain(origin, facingX, Vector3.create(-5, 0, 0), 60, 180, 0.2) - 0.2) < 1e-12, "원뿔 바깥");
check(Math.abs(calculateConeGain(origin, facingX, Vector3.create(0, 5, 0), 60, 300, 0.2) - 0.6) < 1e-6, "원뿔 사이");
check(calculateConeGain(origin, origin, Vector3.create(-5, 0, 0), 60, 180, 0.2) === 1, "방향 0");
check(calculateConeGain(origin, facingX, Vector3.create(-5, 0, 0), 360, 360, 0.2) === 1, "원뿔 360");
const forward = Vector3.create(0, 0, -1);
const up = Vector3.create(0, 1, 0);
check(Math.abs(calculateAzimuthElevation(Vector3.create(0, 0, -4), origin, forward, up).azimuth) < 1e-4, "앞");
check(Math.abs(calculateAzimuthElevation(Vector3.create(3, 0, 0), origin, forward, up).azimuth - 90) < 1e-4, "오른쪽");
check(Math.abs(calculateAzimuthElevation(Vector3.create(-2, 0, 0), origin, forward, up).azimuth + 90) < 1e-4, "왼쪽");
const behind = calculateAzimuthElevation(Vector3.create(0, 0, 3), origin, forward, up).azimuth;
check(Math.abs(Math.abs(behind) - 180) < 1e-4, "뒤");
const same = calculateAzimuthElevation(origin, origin, forward, up);
check(same.azimuth === 0 && same.elevation === 0, "같은 자리");
const above = calculateAzimuthElevation(Vector3.create(0, 5, 0), origin, forward, up);
check(Math.abs(above.azimuth) < 1e-4 && Math.abs(above.elevation - 90) < 1e-4, "위");
check(Math.abs(calculateAzimuthElevation(Vector3.create(0, 0, -4), origin, facingX, up).azimuth + 90) < 1e-4, "돈 리스너");
const center = calculateEqualPowerGains(0, 1);
check(Math.abs(center.left - center.right) < 1e-12, "가운데");
const rightEdge = calculateEqualPowerGains(90, 1);
check(Math.abs(rightEdge.left) < 1e-12 && Math.abs(rightEdge.right - 1) < 1e-12, "오른쪽 끝");
check(calculateDistanceConeGain(new PannerSettings(), Vector3.create(0, 0, -2), facingX, origin) === 0.5, "거리 x 원뿔");

//==============================================================================
// 설정 받기와 2D 컴포넌트. (AudioContext 없이)
//==============================================================================
const silentAudioManager = { ensureAudioContext: () => null };
const player = new SpatialAudioPlayer(silentAudioManager);
check(player.setMaximumDistance(50), "최대 거리 받기");
check(!player.setMaximumDistance(0), "최대 거리 0 거절");
check(!player.setRolloffFactor(-0.5), "rolloff 음수 거절");
check(!player.setCone(30, 60, 1.5), "바깥 이득 1 초과 거절");
check(!player.setReferenceDistance(NaN), "기준 거리 NaN 거절");
const settings = player.getSettings();
check(settings.maximumDistance === 50 && settings.rolloffFactor === 1 && settings.coneOuterGain === 0, "앞 값 유지");
player.setPosition(Vector3.create(1, NaN, 3));
check(player.getPosition().x === 1 && player.getPosition().y === 0 && player.getPosition().z === 3, "NaN 칸 유지");
const audioPosition = convertViewPositionToAudioPosition(Vector2.create(200, 100), 100, 0);
check(audioPosition.x === 2 && audioPosition.y === -1 && audioPosition.z === 0, "화면 자리 바꾸기");
const sourceNode = new WorldNode();
sourceNode.setLocalPosition(Vector2.create(300, 100));
const audioSource = sourceNode.addComponent(AudioSource2D);
audioSource.setPixelsPerUnit(100);
audioSource.setPlayer(new SpatialAudioPlayer(silentAudioManager));
audioSource.tick(0.016);
const sourcePosition = audioSource.getPlayer().getPosition();
check(sourcePosition.x === 3 && sourcePosition.y === -1 && sourcePosition.z === 0, "소리 노드 따라가기");
const listenerNode = new WorldNode();
listenerNode.setLocalPosition(Vector2.create(100, 100));
listenerNode.setLocalRotation(90);
const audioListener = listenerNode.addComponent(AudioListener2D);
audioListener.setPixelsPerUnit(100);
audioListener.setDepth(2);
audioListener.setListener(new SpatialAudioListener(silentAudioManager));
audioListener.tick(0.016);
const listener = audioListener.getListener();
const listenerAudioPosition = listener.getPosition();
check(listenerAudioPosition.x === 1 && listenerAudioPosition.y === -1 && listenerAudioPosition.z === 2, "리스너 노드 따라가기");
check(Math.abs(listener.getUp().x - 1) < 1e-6 && Math.abs(listener.getUp().y) < 1e-6, "돈 리스너의 위");
check(listener.getForward().z === -1, "리스너 앞");
console.log(`공간 소리 시험 ${checkCount} 개 통과, 크롬과 가장 큰 차이 ${maximumDifference.toExponential(2)} (${json.cases.length} 그래프 가운데 식으로 다시 그린 ${staticCaseCount} 개, ${json.chrome})`);
