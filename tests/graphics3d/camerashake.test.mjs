//==============================================================================
// CameraShake 와 Camera3D 보기 덧붙임 시험. (node tests/graphics3d/camerashake.test.mjs)
// - 러스트 판 짝: src/graphics3d/camerashake.rs 의 시험. (옮길 때 같은 값을 본다)
// - 잦아듦, 겹쳐 더함, 같은 씨앗이면 같은 값, 나이로 이어 붙임, 늦은 시작과 오름, 보기 행렬에 거는 축을 본다.
//==============================================================================
import { CameraShake, createOffsetViewMatrix } from "../../src/graphics3d/camerashake.js";
import { Camera3D } from "../../src/graphics3d/camera3d.js";
import { Matrix4 } from "../../src/base/matrix4.js";
import { Vector3 } from "../../src/base/vector3.js";
import { check, checkEqual, checkNear, finish } from "../testcheck.mjs";

const FRAME_SECONDS = 1 / 240;

function readValues(shake) {
	return [shake.position.x, shake.position.y, shake.position.z, shake.rotation.x, shake.rotation.y, shake.rotation.z];
}

// 길이 동안 프레임마다 읽은 값들.
function recordShake(cameraShake, seconds) {
	const frames = [];
	for (let time = 0; time < seconds; time += FRAME_SECONDS) {
		frames.push(readValues(cameraShake.read()));
		cameraShake.update(FRAME_SECONDS);
	}
	return frames;
}

// 시간에 따라 잦아든다: 사분의 일마다 가장 큰 값이 줄고, 길이가 지나면 0 이고 흔들림이 끝난다.
{
	const cameraShake = new CameraShake({ seed: 3 });
	cameraShake.add({ amplitude: 1, rotationAmplitude: 0.1, duration: 1, frequency: 12 });
	const frames = recordShake(cameraShake, 1);
	const quarterPeaks = [0, 1, 2, 3].map((quarter) => {
		const quarterFrames = frames.slice(Math.floor(frames.length * quarter / 4), Math.floor(frames.length * (quarter + 1) / 4));
		return Math.max(...quarterFrames.map((values) => Math.hypot(values[0], values[1], values[2])));
	});
	check(quarterPeaks[0] > quarterPeaks[1] && quarterPeaks[1] > quarterPeaks[2] && quarterPeaks[2] > quarterPeaks[3], "사분의 일마다 잦아듦 " + quarterPeaks.map((peak) => peak.toFixed(3)).join(", "));
	check(quarterPeaks[0] <= Math.sqrt(3) + 1e-9, "자리 세기 안");
	const rotationPeak = Math.max(...frames.map((values) => Math.max(Math.abs(values[3]), Math.abs(values[4]), Math.abs(values[5]))));
	check(rotationPeak > 0.02 && rotationPeak <= 0.1 + 1e-12, "돌림 세기 " + rotationPeak);
	checkEqual(cameraShake.isShaking(), false, "길이 뒤 끝남");
	check(readValues(cameraShake.read()).every((value) => value === 0), "길이 뒤 0");
}

// 같은 씨앗이면 같은 값, 다른 씨앗이면 다른 값.
{
	const first = new CameraShake({ seed: 42 });
	const second = new CameraShake({ seed: 42 });
	const other = new CameraShake({ seed: 43 });
	for (const cameraShake of [first, second, other]) {
		cameraShake.add({ amplitude: 0.2, rotationAmplitude: 0.05, duration: 0.5 });
		cameraShake.add({ amplitude: 0.1, duration: 0.3, age: 0.05 });
	}
	const firstFrames = recordShake(first, 0.5);
	const secondFrames = recordShake(second, 0.5);
	const otherFrames = recordShake(other, 0.5);
	check(JSON.stringify(firstFrames) === JSON.stringify(secondFrames), "같은 씨앗이면 같은 값");
	check(JSON.stringify(firstFrames) !== JSON.stringify(otherFrames), "다른 씨앗이면 다른 값");
}

// 겹침은 더한다: 둘을 같이 넣은 값은 따로 넣은 값의 합.
{
	const both = new CameraShake();
	const onlyA = new CameraShake();
	const onlyB = new CameraShake();
	const shakeA = { amplitude: 0.3, rotationAmplitude: 0.02, duration: 0.4, seed: 11 };
	const shakeB = { amplitude: 0.1, rotationAmplitude: 0.05, duration: 0.8, frequency: 4, positionAxes: [1, 0.5, 0], seed: 22 };
	both.add(shakeA);
	both.add(shakeB);
	onlyA.add(shakeA);
	onlyB.add(shakeB);
	const bothFrames = recordShake(both, 0.8);
	const aFrames = recordShake(onlyA, 0.8);
	const bFrames = recordShake(onlyB, 0.8);
	let maximumError = 0;
	bothFrames.forEach((values, frameIndex) => {
		values.forEach((value, channelIndex) => {
			maximumError = Math.max(maximumError, Math.abs(value - aFrames[frameIndex][channelIndex] - bFrames[frameIndex][channelIndex]));
		});
	});
	checkNear(maximumError, 0, 1e-12, "겹쳐 더함");
	check(bFrames.every((values) => values[2] === 0), "축 몫 0 이면 그 축은 0");
}

// 나이로 이어 붙이기: 0.3 초 늦게 나이 0.3 으로 넣은 흔들림은 처음부터 넣은 흔들림과 같은 값이 이어진다.
{
	const fromStart = new CameraShake();
	fromStart.add({ amplitude: 0.5, rotationAmplitude: 0.03, duration: 1, seed: 5 });
	fromStart.update(0.3);
	const late = new CameraShake();
	late.add({ amplitude: 0.5, rotationAmplitude: 0.03, duration: 1, seed: 5, age: 0.3 });
	const startFrames = recordShake(fromStart, 0.5);
	const lateFrames = recordShake(late, 0.5);
	check(JSON.stringify(startFrames) === JSON.stringify(lateFrames), "나이로 이어 붙임");
}

// 늦은 시작과 오름: 나이가 음수면 0, attack 동안 0 에서 오른다.
{
	const cameraShake = new CameraShake();
	cameraShake.add({ amplitude: 1, duration: 1, age: -0.2, seed: 9 });
	check(cameraShake.isShaking(), "기다리는 흔들림도 남음");
	cameraShake.update(0.1);
	check(readValues(cameraShake.read()).every((value) => value === 0), "시작 앞은 0");
	cameraShake.update(0.15);
	check(readValues(cameraShake.read()).some((value) => value !== 0), "시작 뒤 흔들림");
	const attackShake = new CameraShake();
	attackShake.add({ amplitude: 1, duration: 1, attack: 0.2, seed: 9 });
	check(readValues(attackShake.read()).every((value) => value === 0), "오름 처음은 0");
	attackShake.clear();
	checkEqual(attackShake.isShaking(), false, "clear 뒤 끝남");
}

// 보기 덧붙임의 축: 덧붙인 카메라의 자리는 카메라 지역 점, 고개를 든 pitch 는 앞이 위로.
{
	const viewMatrix = Matrix4.createLookAt(Vector3.create(3, 2, 6), Vector3.create(0, 1, 0), Vector3.create(0, 1, 0));
	const cameraMatrix = Matrix4.createInverse(viewMatrix);
	const position = Vector3.create(0.2, -0.1, 0.3);
	const pitch = 0.3;
	const shakenCameraMatrix = Matrix4.createInverse(createOffsetViewMatrix(viewMatrix, position, Vector3.create(pitch, 0, 0)));
	const shakenEye = shakenCameraMatrix.transformPoint(0, 0, 0);
	const expectedEye = cameraMatrix.transformPoint(position.x, position.y, position.z);
	for (const axis of ["x", "y", "z"]) {
		checkNear(shakenEye[axis], expectedEye[axis], 1e-5, "덧붙인 눈 " + axis);
	}
	const shakenForward = shakenCameraMatrix.transformDirection(0, 0, -1);
	const expectedForward = cameraMatrix.transformDirection(0, Math.sin(pitch), -Math.cos(pitch));
	for (const axis of ["x", "y", "z"]) {
		checkNear(shakenForward[axis], expectedForward[axis], 1e-5, "pitch 앞 " + axis);
	}
	// roll 은 앞은 그대로, yaw 는 위가 그대로.
	const rolled = Matrix4.createInverse(createOffsetViewMatrix(viewMatrix, Vector3.zero(), Vector3.create(0, 0, 0.4)));
	const rolledForward = rolled.transformDirection(0, 0, -1);
	const forward = cameraMatrix.transformDirection(0, 0, -1);
	checkNear(rolledForward.x, forward.x, 1e-5, "roll 앞 그대로");
	const yawed = Matrix4.createInverse(createOffsetViewMatrix(viewMatrix, Vector3.zero(), Vector3.create(0, 0.4, 0)));
	checkNear(yawed.transformDirection(0, 1, 0).y, cameraMatrix.transformDirection(0, 1, 0).y, 1e-5, "yaw 위 그대로");
}

// Camera3D: 덧붙임 없음은 지금과 같고, 덧붙이면 createOffsetViewMatrix 와 같고, 영으로 풀면 돌아온다. 원 행렬에도 건다.
{
	const camera = new Camera3D();
	camera.lookAt(Vector3.create(0, 4, 10), Vector3.create(0, 0, 0));
	const plainView = camera.getViewMatrix().clone();
	const plainElements = Array.from(plainView.getElements());
	check(JSON.stringify(plainElements) === JSON.stringify(Array.from(Matrix4.createLookAt(Vector3.create(0, 4, 10), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0)).getElements())), "덧붙임 없음은 그대로");
	const position = Vector3.create(0.1, 0.05, 0);
	const rotation = Vector3.create(0.01, -0.02, 0.03);
	camera.setViewOffset(position, rotation);
	const expected = Array.from(createOffsetViewMatrix(plainView, position, rotation).getElements());
	check(JSON.stringify(Array.from(camera.getViewMatrix().getElements())) === JSON.stringify(expected), "Camera3D 덧붙임");
	checkEqual(camera.getEyePosition().x, 0, "눈 자리는 덧붙이기 앞 값");
	camera.setViewOffset(Vector3.zero(), Vector3.zero());
	check(JSON.stringify(Array.from(camera.getViewMatrix().getElements())) === JSON.stringify(plainElements), "영으로 풀면 그대로");
	camera.setMatrices(plainView, Matrix4.createPerspective(0.8, 1, 0.1, 100));
	camera.setViewOffset(position);
	const rawExpected = Array.from(createOffsetViewMatrix(plainView, position, Vector3.zero()).getElements());
	check(JSON.stringify(Array.from(camera.getViewMatrix().getElements())) === JSON.stringify(rawExpected), "원 행렬에도 덧붙임");
}

finish("camerashake");
