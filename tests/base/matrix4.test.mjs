//==============================================================================
// 4x4 행렬과 쿼터니언 시험. (node tests/base/matrix4.test.mjs)
// - 러스트 판 짝: src/base/matrix4.rs 의 multiply_matches_hand_and_original, multiply_order_is_local_right_multiply,
//   rotation_is_right_handed, compose_matches_original, inverse_matches_hand_and_original,
//   perspective_matches_hand_and_original, orthographic_matches_hand_and_original, look_at_matches_hand_and_original,
//   write_to_array_and_slice,
//   src/base/quaternion.rs 의 create_from_euler_matches_original, quaternion_to_matrix, euler_order_round_trip,
//   slerp_matches_original, normalize_and_default.
// - 허용 오차 1e-5 는 러스트 판 시험과 같다. (원본 f64 셈 뒤 Float32Array, 러스트 판 f32 셈의 끝자리 차이)
//==============================================================================
import { Matrix4 } from "../../src/base/matrix4.js";
import { Quaternion } from "../../src/base/quaternion.js";
import { Vector3 } from "../../src/base/vector3.js";
import { checkEqual, checkJson, checkNear, finish } from "../testcheck.mjs";

const TOLERANCE = 1e-5;
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function getElementList(matrix) {
	return Array.from(matrix.getElements());
}

// 1 ~ 16 과 17 ~ 32 행렬의 곱.
const leftMatrix = Matrix4.createIdentity();
const rightMatrix = Matrix4.createIdentity();
for (let index = 0; index < 16; index++) {
	leftMatrix.getElements()[index] = index + 1;
	rightMatrix.getElements()[index] = index + 17;
}
leftMatrix.multiply(rightMatrix);
checkJson(getElementList(leftMatrix), [538, 612, 686, 760, 650, 740, 830, 920, 762, 868, 974, 1080, 874, 996, 1118, 1240], "multiply");

// 곱하는 순서: translate 뒤 scale 은 크기 먼저 적용.
const translateThenScale = Matrix4.createTranslation(1, 2, 3);
translateThenScale.scale(2, 3, 4);
checkJson(getElementList(translateThenScale), [2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 1, 2, 3, 1], "translate 뒤 scale");
const scaleThenTranslate = Matrix4.createScale(2, 3, 4);
scaleThenTranslate.translate(1, 2, 3);
checkJson(getElementList(scaleThenTranslate), [2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 2, 6, 12, 1], "scale 뒤 translate");
checkJson(translateThenScale.transformPoint(1, 1, 1), { x: 3, y: 5, z: 7, w: 1 }, "transformPoint");
checkJson(translateThenScale.transformDirection(1, 1, 1), { x: 2, y: 3, z: 4 }, "transformDirection");

// 회전 방향. (오른손, 반시계)
const quarterTurn = Math.PI / 2;
const rotatedByZ = Matrix4.createRotationZ(quarterTurn).transformDirection(1, 0, 0);
checkNear([rotatedByZ.x, rotatedByZ.y, rotatedByZ.z], [0, 1, 0], TOLERANCE, "Z 축 90 도");
const rotatedByX = Matrix4.createRotationX(quarterTurn).transformDirection(0, 1, 0);
checkNear([rotatedByX.x, rotatedByX.y, rotatedByX.z], [0, 0, 1], TOLERANCE, "X 축 90 도");
const rotatedByY = Matrix4.createRotationY(quarterTurn).transformDirection(0, 0, 1);
checkNear([rotatedByY.x, rotatedByY.y, rotatedByY.z], [1, 0, 0], TOLERANCE, "Y 축 90 도");

// translate, rotateY, rotateX, scale 누적과 점, 방향 변환.
function createComposeMatrix() {
	const composeMatrix = Matrix4.createTranslation(1, 2, 3);
	composeMatrix.rotateY(0.5);
	composeMatrix.rotateX(-0.25);
	composeMatrix.scale(2, 3, 4);
	return composeMatrix;
}
const composeMatrix = createComposeMatrix();
checkNear(getElementList(composeMatrix), [1.7551651000976562, 0, -0.9588510990142822, 0, -0.35583534836769104, 2.9067373275756836, -0.6513521671295166, 0, 1.8580855131149292, 0.9896158576011658, 3.401202440261841, 0, 1, 2, 3, 1], TOLERANCE, "누적 행렬");
const composePoint = composeMatrix.transformPoint(1, -2, 0.5);
checkNear([composePoint.x, composePoint.y, composePoint.z], [4.395878553390503, -3.3186667263507843, 5.044454455375671], TOLERANCE, "누적 점");
checkEqual(composePoint.w, 1, "누적 점 w");
const composeDirection = composeMatrix.transformDirection(1, -2, 0.5);
checkNear([composeDirection.x, composeDirection.y, composeDirection.z], [3.395878553390503, -5.318666726350784, 2.0444544553756714], TOLERANCE, "누적 방향");

// 역행렬.
const translateScale = Matrix4.createTranslation(1, 2, 3);
translateScale.scale(2, 4, 8);
checkJson(getElementList(Matrix4.createInverse(translateScale)), [0.5, 0, 0, 0, 0, 0.25, 0, 0, 0, 0, 0.125, 0, -0.5, -0.5, -0.375, 1], "이동 크기 역행렬");
const composeInverse = Matrix4.createInverse(composeMatrix);
checkNear(getElementList(composeInverse), [0.43879127502441406, -0.03953726217150688, 0.11613034456968307, 0, 1.2300102048001804e-9, 0.32297080755233765, 0.06185098737478256, 0, -0.23971278965473175, -0.07237246632575989, 0.21257516741752625, 0, 0.28034707903862, -0.38928693532943726, -0.8775578141212463, 1], TOLERANCE, "누적 역행렬");
const productMatrix = createComposeMatrix();
productMatrix.multiply(composeInverse);
checkNear(getElementList(productMatrix), IDENTITY, TOLERANCE, "역행렬 곱은 단위 행렬");
const singularMatrix = Matrix4.createIdentity();
for (let index = 0; index < 16; index++) {
	singularMatrix.getElements()[index] = index + 1;
}
checkJson(getElementList(Matrix4.createInverse(singularMatrix)), IDENTITY, "행렬식 0 의 역은 단위 행렬");

// 원근 투영.
const handPerspective = Matrix4.createPerspective(Math.PI / 2, 2, 1, 3);
checkNear(getElementList(handPerspective), [0.5, 0, 0, 0, 0, 1, 0, 0, 0, 0, -2, -1, 0, 0, -3, 0], TOLERANCE, "손 계산 원근");
checkNear(getElementList(Matrix4.createPerspective(1, 1.5, 0.5, 100)), [1.2203251123428345, 0, 0, 0, 0, 1.8304877281188965, 0, 0, 0, 0, -1.0100502967834473, -1, 0, 0, -1.0050251483917236, 0], TOLERANCE, "원본 원근");
const nearPoint = handPerspective.transformPoint(0, 0, -1);
checkNear(nearPoint.z / nearPoint.w, -1, TOLERANCE, "가까운 면 깊이");
const farPoint = handPerspective.transformPoint(0, 0, -3);
checkNear(farPoint.z / farPoint.w, 1, TOLERANCE, "먼 면 깊이");

// 직교 투영.
checkJson(getElementList(Matrix4.createOrthographic(0, 4, 0, 2, 1, 5)), [0.5, 0, 0, 0, 0, 1, 0, 0, 0, 0, -0.5, 0, -1, -1, -1.5, 1], "손 계산 직교");
checkNear(getElementList(Matrix4.createOrthographic(-4, 6, -2, 3, 0.25, 50)), [0.20000000298023224, 0, 0, 0, 0, 0.4000000059604645, 0, 0, 0, 0, -0.04020100459456444, 0, -0.20000000298023224, -0.20000000298023224, -1.0100502967834473, 1], TOLERANCE, "원본 직교");

// 시점 행렬.
checkNear(getElementList(Matrix4.createLookAt(Vector3.create(0, 0, 5), Vector3.zero(), Vector3.up())), getElementList(Matrix4.createTranslation(0, 0, -5)), TOLERANCE, "손 계산 시점");
const eyePosition = Vector3.create(3, 4, 5);
const targetPosition = Vector3.create(0, 1, 0);
const lookAtMatrix = Matrix4.createLookAt(eyePosition, targetPosition, Vector3.up());
checkNear(getElementList(lookAtMatrix), [0.8574929237365723, -0.23537960648536682, 0.45749571919441223, 0, 0, 0.8892118334770203, 0.45749571919441223, 0, -0.5144957304000854, -0.3922993242740631, 0.762492835521698, 0, 0, -0.8892118334770203, -7.014934062957764, 1], TOLERANCE, "원본 시점");
const targetInView = lookAtMatrix.transformPoint(targetPosition.x, targetPosition.y, targetPosition.z);
checkNear([targetInView.x, targetInView.y, targetInView.z], [0, 0, -eyePosition.distance(targetPosition)], TOLERANCE, "대상은 -Z 쪽");

// 유니폼 배열 기록.
const writeMatrix = Matrix4.createTranslation(7, 8, 9);
const writeArray = new Float32Array(16);
writeMatrix.writeToArray(writeArray);
checkJson(Array.from(writeArray), getElementList(writeMatrix), "writeToArray");
const jointMatrixArray = new Float32Array(32);
writeMatrix.writeToSlice(jointMatrixArray, 16);
checkJson(Array.from(jointMatrixArray.slice(16, 32)), getElementList(writeMatrix), "writeToSlice");

// 쿼터니언: 오일러 변환과 곱.
function getQuaternionList(quaternion) {
	return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}
checkNear(getQuaternionList(Quaternion.createFromEuler(0.3, -0.7, 1.1)), [-0.057539988180335344, -0.36242009435522565, 0.4417996722272437, 0.818629265655496], TOLERANCE, "createFromEuler");
checkNear(getQuaternionList(Quaternion.createFromEuler(0.3, 0, 0).multiply(Quaternion.createFromEuler(0, 0.4, 0))), [0.14645931909238652, 0.19643848836306488, 0.029688773773793673, 0.9690614866211726], TOLERANCE, "쿼터니언 곱");

// 쿼터니언 → 행렬.
const radian = 0.83;
checkNear(getElementList(Matrix4.createRotationFromQuaternion(Quaternion.createFromEuler(radian, 0, 0))), getElementList(Matrix4.createRotationX(radian)), TOLERANCE, "X 축 쿼터니언 행렬");
checkNear(getElementList(Matrix4.createRotationFromQuaternion(Quaternion.createFromEuler(0, radian, 0))), getElementList(Matrix4.createRotationY(radian)), TOLERANCE, "Y 축 쿼터니언 행렬");
checkNear(getElementList(Matrix4.createRotationFromQuaternion(Quaternion.createFromEuler(0, 0, radian))), getElementList(Matrix4.createRotationZ(radian)), TOLERANCE, "Z 축 쿼터니언 행렬");
checkJson(getElementList(Matrix4.createRotationFromQuaternion(Quaternion.identity())), IDENTITY, "단위 쿼터니언 행렬");
checkNear(getElementList(Matrix4.createRotationFromQuaternion(Quaternion.createFromEuler(0.3, -0.7, 1.1))), [0.3469294607639313, 0.765047550201416, 0.5425330996513367, 0, -0.6816329956054688, 0.6030043959617615, -0.4144420027732849, 0, -0.6442176699638367, -0.22602632641792297, 0.7306816577911377, 0, 0, 0, 0, 1], TOLERANCE, "원본 쿼터니언 행렬");

// 오일러 순서 왕복: Rx x Ry x Rz, 쿼터니언 곱의 행렬은 행렬 곱.
for (const [xRadian, yRadian, zRadian] of [[0.3, -0.7, 1.1], [-1.2, 0.4, 2.5], [2.0, 1.0, -0.6]]) {
	const composedMatrix = Matrix4.createIdentity();
	composedMatrix.rotateX(xRadian);
	composedMatrix.rotateY(yRadian);
	composedMatrix.rotateZ(zRadian);
	const fromEuler = Quaternion.createFromEuler(xRadian, yRadian, zRadian);
	checkNear(getElementList(Matrix4.createRotationFromQuaternion(fromEuler)), getElementList(composedMatrix), TOLERANCE, "오일러 순서 " + xRadian);
	const quaternionX = Quaternion.createFromEuler(xRadian, 0, 0);
	const quaternionY = Quaternion.createFromEuler(0, yRadian, 0);
	const quaternionZ = Quaternion.createFromEuler(0, 0, zRadian);
	checkNear(getQuaternionList(quaternionX.multiply(quaternionY).multiply(quaternionZ)), getQuaternionList(fromEuler), TOLERANCE, "쿼터니언 곱 순서 " + xRadian);
	const matrixProduct = Matrix4.createRotationFromQuaternion(quaternionZ);
	matrixProduct.multiply(Matrix4.createRotationFromQuaternion(quaternionX));
	checkNear(getElementList(Matrix4.createRotationFromQuaternion(quaternionZ.multiply(quaternionX))), getElementList(matrixProduct), TOLERANCE, "쿼터니언 곱의 행렬 " + xRadian);
}

// 구면 선형 보간.
const fromQuaternion = Quaternion.createFromEuler(0.1, 0.2, 0.3);
const toQuaternion = Quaternion.createFromEuler(1.0, -0.5, 2.0);
checkNear(getQuaternionList(Quaternion.slerp(fromQuaternion, toQuaternion, 0.35)), [0.07247359830822624, -0.13756324880336232, 0.3675390346169097, 0.9169182014551747], TOLERANCE, "slerp 0.35");
checkNear(getQuaternionList(Quaternion.slerp(fromQuaternion, toQuaternion, 0)), getQuaternionList(fromQuaternion), TOLERANCE, "slerp 0");
checkNear(getQuaternionList(Quaternion.slerp(fromQuaternion, toQuaternion, 1)), getQuaternionList(toQuaternion), TOLERANCE, "slerp 1");
checkNear(getQuaternionList(Quaternion.slerp(Quaternion.identity(), Quaternion.create(0.01, 0, 0, 0.99995), 0.5)), [0.0050000624996093404, 0, 0, 0.9999874996093701], TOLERANCE, "slerp 거의 같은 방향");
checkNear(getQuaternionList(Quaternion.slerp(Quaternion.identity(), Quaternion.create(0, 0, -Math.SQRT1_2, -Math.SQRT1_2), 0.5)), [0, 0, 0.3826834323650898, 0.9238795325112867], TOLERANCE, "slerp 반대 부호 최단 경로");

// 정규화와 기본값.
checkNear(getQuaternionList(Quaternion.create(0, 3, 0, 4).normalize()), [0, 0.6, 0, 0.8], 1e-7, "normalize");
checkJson(getQuaternionList(Quaternion.create(0, 0, 0, 0).normalize()), [0, 0, 0, 1], "영 쿼터니언 normalize");
checkJson(getQuaternionList(new Quaternion()), [0, 0, 0, 1], "기본 쿼터니언");
const setQuaternion = new Quaternion();
setQuaternion.set(1, 2, 3, 4);
checkJson(getQuaternionList(setQuaternion), [1, 2, 3, 4], "set");

finish("tests/base/matrix4.test.mjs");
