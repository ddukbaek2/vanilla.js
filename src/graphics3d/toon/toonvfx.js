//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { ShaderProgram } from "../../core/graphic/shaderprogram.js";
import { SeededRandom } from "../../base/seededrandom.js";
import { Vector2 } from "../../base/vector2.js";
import { Shaker } from "../../misc/shaker.js";


/**
 * @example <caption>툰 장면 위에 폭발 효과를 내고 한 프레임 그리기</caption>
 * import { ToonRenderer, ToonVfx, ToonVfxLook, ToonVfxShape, ToonVfxDecalMode, ToonMesh, Matrix4, Vector3 } from "./vanilla.js";
 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
 * const renderer = new ToonRenderer(webGL2RenderingContext);
 * const builder = new ToonMesh.MeshBuilder();
 * builder.addPart(ToonMesh.createBoxGeometry(8, 0.2, 8), Matrix4.createTranslation(0, -0.1, 0), "#708090", { hasOutline: false });
 * const floorMesh = renderer.createMesh(builder.readArrays());
 * const vfx = new ToonVfx(webGL2RenderingContext);
 * vfx.setRamps([["#ffffff", "#ffe080", "#ff8020", "#a02010", "#301008"]]);
 * vfx.prepare();
 * vfx.addFireball({ position: [0, 0.8, 0], radius: 0.9, life: 1.2, ramp: 0 });
 * vfx.addShockwave({ x: 0, z: 0, endRadius: 3, life: 0.6, ramp: 0 });
 * vfx.addDecal({ x: 0, z: 0, radius: 1.4, life: 8, heatSeconds: 1.5, mode: ToonVfxDecalMode.scorch, ramp: 0 });
 * vfx.emitParticles({ count: 40, position: [0, 0.6, 0], shape: ToonVfxShape.sphere, radius: 0.3, speed: [2, 5], gravity: 6, size: [0.05, 0.12], life: [0.4, 0.9], look: ToonVfxLook.streak, stretch: 0.05, ramp: 0, isGrounded: true });
 * const viewMatrix = Matrix4.createLookAt(Vector3.create(4, 3, 5), Vector3.create(0, 0.5, 0), Vector3.create(0, 1, 0));
 * const projectionMatrix = Matrix4.createPerspective(Math.PI / 4, 1, 0.1, 100);
 * vfx.update(1 / 60);
 * renderer.beginFrameWithMatrices(viewMatrix, projectionMatrix);
 * renderer.drawMesh(floorMesh, Matrix4.createIdentity());
 * renderer.endFrame();
 * vfx.draw(viewMatrix, projectionMatrix);
 */


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 아틀라스. (픽셀, 왼쪽 반은 연기 플립북 4 x 4 칸, 오른쪽 반은 128 픽셀 칸 열여섯)
const ATLAS_WIDTH = 1024;
const ATLAS_HEIGHT = 512;
const ATLAS_SLOT_SIZE = 128;
const SMOKE_FRAME_COUNT = 16;

/**
 * 아틀라스 오른쪽 반의 칸. (셰이더의 readSlot 번호와 같다, 6, 7, 11 ~ 15 는 비어 있다)
 * @example <caption>바닥 자국에 쓸 칸 고르기</caption>
 * import { ToonVfx, ToonVfxSlot, ToonVfxDecalMode } from "./vanilla.js";
 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
 * vfx.addDecal({ x: 0, z: 0, radius: 1.2, life: 8, slot: ToonVfxSlot.dent, mode: ToonVfxDecalMode.scorch });
 * vfx.queueDecal({ x: 2, z: 0, radius: 1, slot: ToonVfxSlot.glow, mode: ToonVfxDecalMode.glow, tint: [1, 0.6, 0.2], heat: 1 });
 */
export const ToonVfxSlot = System.Object.freeze({
	soft: 0, // 부드러운 알갱이.
	streak: 1, // 불꽃 줄기. (v 1 쪽이 머리)
	star: 2, // 빛살.
	shockBand: 3, // 충격 띠. (u 는 둘레로 이어지는 타일, v 는 안쪽 0 에서 바깥 1)
	beamGrain: 4, // 빔 결. (두 방향 타일)
	scorch: 5, // 그을음. (알파는 어둡게 덮는 몫, 빨간 채널은 열기)
	ramps: 8, // 색 램프 여덟 줄.
	dent: 9, // 패인 땅.
	glow: 10, // 넓은 둘레 빛.
});

// 색 램프 줄의 수 상한. (아틀라스의 램프 칸 하나에 여덟 줄)
export const TOON_VFX_MAXIMUM_RAMPS = 8;

/**
 * 파티클의 꼴.
 * @example <caption>덮는 연기와 바닥에 멈추는 흙 알갱이</caption>
 * import { ToonVfx, ToonVfxLook } from "./vanilla.js";
 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
 * vfx.emitParticles({ count: 8, position: [0, 0.5, 0], look: ToonVfxLook.smoke, color: [0.5, 0.48, 0.45], speed: 0.4, rise: 0.8, size: 0.6, sizeEnd: 2.5, life: [1.5, 2.5], spin: [-1, 1] });
 * vfx.emitParticles({ count: 20, position: [0, 0.2, 0], look: ToonVfxLook.grit, color: [0.35, 0.28, 0.2], speed: [2, 4], gravity: 9, isUpward: true, isGrounded: true, size: 0.06, life: 1.2 });
 */
export const ToonVfxLook = System.Object.freeze({
	soft: 0, // 부드러운 알갱이. (더하는 빛)
	streak: 1, // 속도 쪽으로 늘인 불꽃 줄기. (더하는 빛, stretch 가 속도에 곱하는 늘임)
	smoke: 2, // 연기 플립북. (덮기)
	star: 3, // 빛살. (더하는 빛)
	ember: 4, // 깜빡이는 불씨. (더하는 빛)
	glow: 5, // 넓은 둘레 빛. (더하는 빛)
	grit: 6, // 빛을 내지 않는 돌과 흙 알갱이. (덮기)
});

/**
 * 파티클을 내는 꼴.
 * @example <caption>바닥 고리로 퍼지는 먼지와 선을 따라 늘어선 빛</caption>
 * import { ToonVfx, ToonVfxLook, ToonVfxShape } from "./vanilla.js";
 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
 * vfx.emitParticles({ count: 32, position: [0, 0.1, 0], shape: ToonVfxShape.ring, radius: 0.5, speed: 3, drag: 4, look: ToonVfxLook.soft, size: 0.15, life: 0.5 });
 * vfx.emitParticles({ count: 40, position: [0, 1, 0], shape: ToonVfxShape.line, direction: [1, 0, 0], length: 5, radius: 0.05, speed: 0.5, look: ToonVfxLook.glow, size: 0.3, life: 0.4 });
 */
export const ToonVfxShape = System.Object.freeze({
	point: "point", // 한 점에서 모든 쪽으로.
	sphere: "sphere", // 반지름 radius 공 안에서 바깥쪽으로.
	ring: "ring", // 바닥과 나란한 고리 위에서 바깥쪽으로.
	disc: "disc", // 바닥과 나란한 원판 안에서 바깥쪽으로.
	cone: "cone", // direction 을 가운데로 spread 각 안의 원뿔.
	line: "line", // direction 쪽으로 length 까지의 선 위(둘레 radius 안)에서 direction 쪽으로.
});

/**
 * 바닥 자국의 꼴.
 * @example <caption>기름 윤 자국과 발밑 그늘</caption>
 * import { ToonVfx, ToonVfxSlot, ToonVfxDecalMode } from "./vanilla.js";
 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
 * vfx.addDecal({ x: 0, z: 0, radius: 1, life: 6, slot: ToonVfxSlot.soft, mode: ToonVfxDecalMode.sheen, tint: [0.05, 0.05, 0.08] });
 * vfx.queueDecal({ x: 2, z: 0, radius: 0.6, mode: ToonVfxDecalMode.shade, alpha: 0.5 });
 */
export const ToonVfxDecalMode = System.Object.freeze({
	scorch: 0, // 알파로 어둡게 덮고 빨간 채널의 금에서 열기가 식는다.
	glow: 1, // 칸의 알파만큼 더하는 빛.
	ring: 2, // 둘레로 흐르는 잡음 테. (ring 이 (테 반지름, 테 너비, 잡음 잘기, 흐르는 빠르기) 의 반지름 몫)
	stain: 3, // 칸의 알파만큼 tint 색으로 덮고, 칸의 가운데 짙기(테 둘레)는 테 색(setRimColor) 쪽으로 물든다. (밝은 바닥의 얼룩, 서리)
	sheen: 4, // 칸의 알파 몸을 tint 로 덮고 몸 가장자리에 흰 윤을 두른다. (기름 윤)
	shade: 5, // 가운데에서 바깥으로 둥글게 엷어지는 그늘. (알파만큼 어둡게 덮음, 칸은 보지 않음, 발밑 그늘 queueBlobShadow)
});

// 한꺼번에 떠 있는 파티클의 기본 상한. (넘으면 가장 오래 전에 낸 것부터 덮는다)
export const TOON_VFX_DEFAULT_PARTICLE_CAPACITY = 3000;

// 파티클 하나의 값. (vec4 일곱)
const PARTICLE_FLOAT_COUNT = 28;
// 바닥에 멈추지 않는 파티클의 바닥 높이.
const NO_FLOOR = -100000;
// 불덩이 구와 충격파 띠, 회전체(빔, 연기 기둥)의 나눔. (둘레, 가로질러나 윤곽을 따라)
const FIREBALL_SEGMENTS = [32, 20];
const BAND_SEGMENTS = [96, 8];
const LATHE_SEGMENTS = [40, 28];
// 리본 정점 하나의 값. (x, y, z, 길이 쪽 0 ~ 1, 가로 0 ~ 1)
const RIBBON_FLOAT_COUNT = 5;
// 번개가 다시 꺾이는 초와 번개 하나의 마디 수.
const LIGHTNING_KINK_SECONDS = 0.08;
const LIGHTNING_POINT_COUNT = 22;
// 프레임마다 넘기는 빛 점의 수 기본 상한. (setGlintCapacity)
const DEFAULT_GLINT_CAPACITY = 96;
// 파티클 꼴의 수. (꼴마다 밝기 배)
const LOOK_COUNT = 7;
// 발밑 그늘의 기본 짙기. (가운데)
const DEFAULT_BLOB_SHADOW_ALPHA = 0.45;
// 효과 테의 기본 색. (테를 두른 파티클과 번짐 리본의 가장자리, ToonRenderer 의 기본 바깥선 색과 같다)
const DEFAULT_RIM_COLOR = System.Object.freeze([0.05, 0.05, 0.08]);
// 카메라 흔들림을 Shaker 에 넣을 때 곱하는 몫. (Shaker 는 세기 0.05 아래에서 멈춘다. 그 문턱이 화면 픽셀 기준이라 장면 길이를 백 배로 넣는다)
const SHAKE_UNIT_SCALE = 100;
// 번개가 끝에 엷어지는 초.
const LIGHTNING_FADE_SECONDS = 0.1;
// 바닥 자국과 충격파 바닥 빛을 바닥 위로 띄우는 높이. (바닥과 겹쳐 깜빡이지 않게)
const DECAL_LIFT = 0.014;
const GROUND_GLOW_LIFT = 0.02;
// 아틀라스를 묶는 텍스처 유닛. (툰 렌더러의 그림자 유닛 3, 화면 공간 바깥선의 5, 6 과 겹치지 않게)
const VFX_TEXTURE_UNIT = 4;
// 어트리뷰트 자리.
const PARTICLE_ATTRIBUTE_LOCATIONS = System.Object.freeze({
	vertexCorner: 0,
	particleStart: 1,
	particleVelocity: 2,
	particleMotion: 3,
	particleColor: 4,
	particleLook: 5,
	particleExtra: 6,
	particleShape: 7,
});
const SPHERE_ATTRIBUTE_LOCATIONS = System.Object.freeze({ vertexPosition: 0 });
const GRID_ATTRIBUTE_LOCATIONS = System.Object.freeze({ vertexGrid: 0 });
const CORNER_ATTRIBUTE_LOCATIONS = System.Object.freeze({ vertexCorner: 0 });
const RIBBON_ATTRIBUTE_LOCATIONS = System.Object.freeze({ vertexPosition: 0, vertexRibbon: 1 });

// 셰이더 공통: 3 차원 잇는 값 잡음과 네 겹 잡음.
const NOISE_SHADER_CHUNK = `
// 점 해시. 세 float 의 비트를 MurmurHash3 의 fmix32 마무리(Austin Appleby, 공개 도메인)로 섞어 [0, 1) 로 낸다.
highp uint hashMix32(highp uint value) {
	value ^= value >> 16u;
	value *= 0x85ebca6bu;
	value ^= value >> 13u;
	value *= 0xc2b2ae35u;
	value ^= value >> 16u;
	return value;
}
float hashPoint(vec3 point) {
	highp uvec3 bits = floatBitsToUint(point);
	highp uint value = hashMix32(bits.x ^ hashMix32(bits.y ^ hashMix32(bits.z + 0x9e3779b9u)));
	return float(value >> 8u) * (1.0 / 16777216.0);
}
float readValueNoise(vec3 point) {
	vec3 cell = floor(point);
	vec3 offset = fract(point);
	vec3 weight = offset * offset * (3.0 - 2.0 * offset);
	float bottomFront = mix(hashPoint(cell), hashPoint(cell + vec3(1.0, 0.0, 0.0)), weight.x);
	float bottomBack = mix(hashPoint(cell + vec3(0.0, 0.0, 1.0)), hashPoint(cell + vec3(1.0, 0.0, 1.0)), weight.x);
	float topFront = mix(hashPoint(cell + vec3(0.0, 1.0, 0.0)), hashPoint(cell + vec3(1.0, 1.0, 0.0)), weight.x);
	float topBack = mix(hashPoint(cell + vec3(0.0, 1.0, 1.0)), hashPoint(cell + vec3(1.0, 1.0, 1.0)), weight.x);
	return mix(mix(bottomFront, bottomBack, weight.z), mix(topFront, topBack, weight.z), weight.y);
}
float readFbm(vec3 point) {
	float sum = 0.0;
	float amplitude = 0.5;
	for (int octave = 0; octave < 4; ++octave) {
		sum += amplitude * readValueNoise(point);
		point = point * 2.07 + vec3(13.1, 7.7, 3.3);
		amplitude *= 0.5;
	}
	return sum / 0.9375;
}
`;
// 셰이더 공통: 아틀라스의 칸, 연기 플립북의 칸, 색 램프 읽기.
const ATLAS_SHADER_CHUNK = `
uniform sampler2D vfxAtlas;
vec4 readSlot(float slot, vec2 coordinate) {
	vec2 inset = clamp(coordinate, vec2(0.004), vec2(0.996));
	float column = mod(slot, 4.0);
	float row = floor(slot / 4.0);
	return texture(vfxAtlas, vec2(0.5 + (column + inset.x) * 0.125, (row + inset.y) * 0.25));
}
vec4 readSmokeFrame(float frame, vec2 coordinate) {
	vec2 inset = clamp(coordinate, vec2(0.004), vec2(0.996));
	return texture(vfxAtlas, vec2((mod(frame, 4.0) + inset.x) * 0.125, (floor(frame / 4.0) + inset.y) * 0.25));
}
vec3 readRamp(float ramp, float position) {
	float row = (ramp + 0.5) / 8.0;
	return texture(vfxAtlas, vec2(0.5 + clamp(position, 0.01, 0.99) * 0.125, (2.0 + row) * 0.25)).rgb;
}
`;
// 파티클. (네 귀퉁이를 인스턴스마다 펴고, 나이로 자리와 크기를 셈, 줄기는 화면에 비친 속도 쪽으로 늘임)
const PARTICLE_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 vertexCorner;
in vec4 particleStart;
in vec4 particleVelocity;
in vec4 particleMotion;
in vec4 particleColor;
in vec4 particleLook;
in vec4 particleExtra;
in vec4 particleShape;
uniform mat4 viewProjectionMatrix;
uniform vec3 viewDirection;
uniform vec3 cameraRight;
uniform vec3 cameraUp;
uniform float time;
out vec2 cornerCoordinate;
out float particleProgress;
out vec4 tintValue;
out vec4 lookValue;
out vec4 extraValue;
out float rimValue;
void main() {
	float age = time - particleStart.w;
	float life = particleVelocity.w;
	if (age < 0.0 || age >= life) {
		gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
		return;
	}
	float progress = age / life;
	float drag = particleMotion.y;
	float travel = drag > 0.001 ? (1.0 - exp(-drag * age)) / drag : age;
	vec3 position = particleStart.xyz + particleVelocity.xyz * travel;
	position.y -= 0.5 * particleMotion.x * age * age;
	vec3 velocity = particleVelocity.xyz * exp(-drag * age);
	velocity.y -= particleMotion.x * age;
	if (position.y < particleLook.w) {
		position.y = particleLook.w;
		velocity = vec3(0.0);
	}
	float size = mix(particleMotion.z, particleMotion.w, pow(progress, particleShape.x));
	vec3 right;
	vec3 up;
	if (abs(particleLook.x - 1.0) < 0.5) {
		vec3 along = velocity - dot(velocity, viewDirection) * viewDirection;
		float speed = length(along);
		along = speed > 0.0001 ? along / speed : cameraUp;
		right = normalize(cross(viewDirection, along)) * size * 0.5;
		up = along * (size * 0.5 + speed * particleLook.y);
	}
	else {
		float angle = particleLook.z * age + particleExtra.z * 6.2832;
		float cosine = cos(angle);
		float sine = sin(angle);
		right = (cameraRight * cosine + cameraUp * sine) * size * 0.5;
		up = (cameraUp * cosine - cameraRight * sine) * size * 0.5;
	}
	vec3 worldPosition = position + right * vertexCorner.x + up * vertexCorner.y;
	gl_Position = viewProjectionMatrix * vec4(worldPosition, 1.0);
	cornerCoordinate = vertexCorner * 0.5 + 0.5;
	particleProgress = progress;
	tintValue = particleColor;
	lookValue = particleLook;
	extraValue = particleExtra;
	rimValue = particleShape.y;
}
`;
// 파티클의 칠. (더하는 빛은 알파 0, 연기와 알갱이는 미리 곱한 알파, 색 램프가 있으면 나이로 흰 심에서 램프 색으로 식음)
//   빛의 꼴(soft, streak, star, ember, glow)은 테(rim)를 받는다. rim 이 0 이면 더하는 빛만, 0 보다 크면 꼴의 몸을 테 색(rimColor)으로 덮고 심은 색,
//   흰 심만 더하기로 겹친다(밝은 바탕에서도 보이게, 덮는 몫은 rim). 0 보다 작으면 테 없이 그 색으로 엷게 덮는다. (빛무리, 덮는 몫은 -rim)
//   밝기에는 꼴마다의 배(lookGains, setLookGain)를 곱한다. (HDR 판에서 불꽃 줄기, 빛살, 불씨만 더 밝게 할 때)
const PARTICLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 cornerCoordinate;
in float particleProgress;
in vec4 tintValue;
in vec4 lookValue;
in vec4 extraValue;
in float rimValue;
uniform vec3 rimColor;
uniform float lookGains[7];
out vec4 fragmentColor;
${ATLAS_SHADER_CHUNK}
vec4 shadeRimmed(vec3 color, float shapeAlpha, float fade, float brightness) {
	float glow = shapeAlpha * fade;
	if (rimValue < 0.0) {
		return vec4(min(color * brightness, vec3(1.0)) * glow * -rimValue + color * glow * brightness * 0.2, glow * -rimValue);
	}
	if (rimValue <= 0.0) {
		return vec4(color * glow * brightness, 0.0);
	}
	float body = smoothstep(0.03, 0.18, shapeAlpha) * fade;
	float core = smoothstep(0.3, 0.72, shapeAlpha);
	vec3 covered = mix(rimColor, min(color * brightness, vec3(1.0)), core);
	float cover = clamp(body * rimValue, 0.0, 1.0);
	return vec4(covered * cover + color * core * glow * brightness * 0.35, cover);
}
void main() {
	float look = lookValue.x;
	float progress = particleProgress;
	vec3 color = tintValue.rgb;
	if (tintValue.a >= 0.0) {
		color *= readRamp(tintValue.a, progress);
	}
	float fadeIn = extraValue.w > 0.0 ? clamp(progress / extraValue.w, 0.0, 1.0) : 1.0;
	float alpha = extraValue.y * fadeIn;
	float brightness = extraValue.x * lookGains[int(clamp(look, 0.0, 6.0) + 0.5)];
	if (look < 0.5) {
		fragmentColor = shadeRimmed(color, readSlot(0.0, cornerCoordinate).a, alpha * (1.0 - progress), brightness);
	}
	else if (look < 1.5) {
		fragmentColor = shadeRimmed(color, readSlot(1.0, cornerCoordinate).a, alpha * (1.0 - progress * progress), brightness);
	}
	else if (look < 2.5) {
		vec4 smoke = readSmokeFrame(floor(progress * 15.99), cornerCoordinate);
		float density = smoke.a * alpha * (1.0 - progress);
		fragmentColor = vec4(color * smoke.rgb * density * brightness, density);
	}
	else if (look < 3.5) {
		fragmentColor = shadeRimmed(color, readSlot(2.0, cornerCoordinate).a, alpha * (1.0 - progress), brightness);
	}
	else if (look < 4.5) {
		float flicker = 0.6 + 0.4 * sin(progress * 46.0 + extraValue.z * 60.0);
		fragmentColor = shadeRimmed(color, readSlot(0.0, cornerCoordinate).a, alpha * flicker * (1.0 - progress), brightness);
	}
	else if (look < 5.5) {
		fragmentColor = shadeRimmed(color, readSlot(10.0, cornerCoordinate).a, alpha * (1.0 - progress) * (1.0 - progress), brightness);
	}
	else {
		float body = smoothstep(0.05, 0.45, readSlot(0.0, cornerCoordinate).a);
		float density = body * alpha * (1.0 - progress * progress * progress * progress);
		fragmentColor = vec4(color * brightness * density, density);
	}
}
`;
// 불덩이 구. (단위 구의 점을 잡음으로 밀어 겉이 끓고 위로 흐름)
const FIREBALL_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec3 vertexPosition;
uniform mat4 viewProjectionMatrix;
uniform vec4 ballCenter;
uniform float ballTime;
uniform float ballSeed;
uniform float ballBoil;
out vec3 surfaceNormal;
out float surfaceNoise;
out vec3 noisePoint;
${NOISE_SHADER_CHUNK}
void main() {
	vec3 point = vertexPosition * 2.1 + vec3(ballSeed, ballSeed * 0.7, -ballSeed * 1.3) + vec3(0.0, -ballTime * 1.6, 0.0);
	float noiseValue = readFbm(point);
	vec3 displaced = vertexPosition * (1.0 + ballBoil * (noiseValue - 0.5) * 2.0);
	vec3 worldPosition = ballCenter.xyz + displaced * ballCenter.w;
	gl_Position = viewProjectionMatrix * vec4(worldPosition, 1.0);
	surfaceNormal = vertexPosition;
	surfaceNoise = noiseValue;
	noisePoint = vertexPosition * 4.3 + vec3(0.0, -ballTime * 2.4, ballSeed);
}
`;
// 불덩이 구의 칠. (뜨거운 곳은 색 램프로 더하는 빛, 식은 곳은 연기로 덮음, 가장자리는 0, 뒤쪽 반은 버림)
//   ballRim 이 0 보다 크면 불의 몸을 덮고 가장자리를 테 색으로 두르는 꼴과 그 몫만큼 섞는다. (밝은 바탕에서도 보이게, 1 이면 덮는 꼴만)
const FIREBALL_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 surfaceNormal;
in float surfaceNoise;
in vec3 noisePoint;
uniform vec3 viewDirection;
uniform float ballHeat;
uniform float ballAlpha;
uniform float ballRamp;
uniform vec3 smokeColor;
uniform float ballRim;
uniform vec3 rimColor;
out vec4 fragmentColor;
${NOISE_SHADER_CHUNK}
${ATLAS_SHADER_CHUNK}
void main() {
	vec3 normal = normalize(surfaceNormal);
	float facing = dot(normal, viewDirection);
	if (facing <= 0.0) {
		discard;
	}
	float detail = readFbm(noisePoint);
	float edge = smoothstep(0.0, 0.6, facing);
	float temperature = clamp(ballHeat * 1.4 - (1.0 - surfaceNoise) * 0.55 - detail * 0.3 + facing * 0.3, 0.0, 1.0);
	vec3 fireColor = readRamp(ballRamp, 1.0 - temperature);
	float cover = edge * smoothstep(0.0, 0.2, surfaceNoise + detail * 0.5 - (1.0 - ballAlpha) * 1.1);
	float hot = smoothstep(0.12, 0.55, temperature);
	vec3 emitted = fireColor * hot * (0.8 + temperature * 0.9);
	float smoke = (1.0 - hot) * cover * 0.8;
	fragmentColor = vec4(emitted * cover + smokeColor * smoke * (0.6 + detail * 0.4), smoke);
	if (ballRim > 0.0) {
		float fireCover = hot * cover * 0.9;
		float rimDark = 1.0 - smoothstep(0.06, 0.38, facing);
		vec3 fireBody = mix(min(fireColor * (0.85 + temperature * 0.4), vec3(1.0)), rimColor, rimDark * 0.85);
		vec4 covered = vec4(fireBody * fireCover + emitted * cover * 0.3 + smokeColor * smoke * (0.6 + detail * 0.4), max(fireCover, smoke));
		fragmentColor = mix(fragmentColor, covered, min(ballRim, 1.0));
	}
}
`;
// 충격파 띠. (둘레와 가로지름으로 지은 띠를 반지름과 너비로 펴고, 바깥 끝을 위로 말아 올림, 바닥 빛은 납작하게)
const BAND_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 vertexGrid;
uniform mat4 viewProjectionMatrix;
uniform vec4 bandShape;
uniform vec2 bandLift;
uniform float bandFlat;
out vec2 bandCoordinate;
void main() {
	float angle = vertexGrid.x * 6.2832;
	float radius = max(0.0, bandShape.z - bandShape.w * (1.0 - vertexGrid.y));
	float height = bandLift.y + (1.0 - bandFlat) * bandLift.x * sin(vertexGrid.y * 2.4);
	vec3 worldPosition = vec3(bandShape.x + cos(angle) * radius, height, bandShape.y + sin(angle) * radius);
	gl_Position = viewProjectionMatrix * vec4(worldPosition, 1.0);
	bandCoordinate = vertexGrid;
}
`;
// 충격파 띠의 칠. (충격 띠 칸, 잡음이 바깥으로 흐르며 나이만큼 찢어 먹음, 흰 앞머리에서 램프 색으로 식음)
//   bandRim 이 0 보다 크면 띠의 몸을 테 색으로 덮고 심은 색인 꼴과 그 몫만큼 섞는다. (바닥 빛은 그대로)
const BAND_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 bandCoordinate;
uniform float bandProgress;
uniform float bandRepeat;
uniform float bandRamp;
uniform vec3 bandColor;
uniform float bandAlpha;
uniform float bandFlat;
uniform float bandSeed;
uniform float bandRim;
uniform vec3 rimColor;
out vec4 fragmentColor;
${NOISE_SHADER_CHUNK}
${ATLAS_SHADER_CHUNK}
void main() {
	if (bandFlat > 0.5) {
		float glow = smoothstep(0.0, 0.8, bandCoordinate.y) * (1.0 - smoothstep(0.8, 1.0, bandCoordinate.y));
		vec3 glowColor = bandColor * readRamp(bandRamp, 0.2 + bandProgress * 0.5);
		fragmentColor = vec4(glowColor * glow * bandAlpha * 0.5, 0.0);
		return;
	}
	vec2 coordinate = vec2(fract(bandCoordinate.x * bandRepeat), bandCoordinate.y);
	float strength = readSlot(3.0, coordinate).a;
	float tear = readFbm(vec3(bandCoordinate.x * bandRepeat * 2.0, bandCoordinate.y * 2.5 - bandProgress * 4.0, bandSeed));
	float cut = smoothstep(bandProgress * 0.7, bandProgress * 0.7 + 0.22, tear);
	float alpha = strength * cut * bandAlpha;
	float rampPosition = clamp(0.12 + bandProgress * 0.65 + (1.0 - strength) * 0.3, 0.0, 0.95);
	vec3 color = bandColor * readRamp(bandRamp, rampPosition);
	fragmentColor = vec4(color * alpha * 1.5, alpha * 0.12);
	if (bandRim > 0.0) {
		float core = smoothstep(0.35, 0.8, strength);
		vec3 covered = mix(rimColor, min(color * 1.2, vec3(1.0)), core);
		fragmentColor = mix(fragmentColor, vec4(covered * alpha * 0.85 + color * core * alpha * 0.4, alpha * 0.85), min(bandRim, 1.0));
	}
}
`;
// 바닥 자국. (가운데, 반지름, 돎으로 편 바닥 네모)
const DECAL_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 vertexCorner;
uniform mat4 viewProjectionMatrix;
uniform vec4 decalShape;
uniform float decalHeight;
out vec2 decalCoordinate;
void main() {
	float cosine = cos(decalShape.w);
	float sine = sin(decalShape.w);
	vec2 offset = vec2(vertexCorner.x * cosine - vertexCorner.y * sine, vertexCorner.x * sine + vertexCorner.y * cosine) * decalShape.z;
	gl_Position = viewProjectionMatrix * vec4(decalShape.x + offset.x, decalHeight, decalShape.y + offset.y, 1.0);
	decalCoordinate = vertexCorner * 0.5 + 0.5;
}
`;
// 바닥 자국의 칠. (그을음은 알파로 어둡게 덮고 빨간 채널에서 열기가 식음, 빛은 더함, 테는 둘레로 흐르는 잡음 테, 물든 자국과 기름 윤은 tint 로 덮음, 그늘은 둥글게 어둡게)
const DECAL_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 decalCoordinate;
uniform float decalSlot;
uniform float decalAlpha;
uniform float decalHeat;
uniform float decalRamp;
uniform vec3 decalTint;
uniform float decalMode;
uniform vec4 decalRing;
uniform float decalTime;
uniform float decalSeed;
uniform vec3 rimColor;
out vec4 fragmentColor;
${NOISE_SHADER_CHUNK}
${ATLAS_SHADER_CHUNK}
void main() {
	if (decalMode < 0.5) {
		vec4 texel = readSlot(decalSlot, decalCoordinate);
		float darkness = texel.a * decalAlpha;
		vec3 glowColor = readRamp(decalRamp, 1.0 - decalHeat) * decalHeat;
		fragmentColor = vec4(glowColor * texel.r * decalAlpha * 1.8, darkness);
	}
	else if (decalMode < 1.5) {
		vec4 texel = readSlot(decalSlot, decalCoordinate);
		float alpha = texel.a * decalAlpha;
		fragmentColor = vec4(decalTint * readRamp(decalRamp, 1.0 - decalHeat) * alpha, 0.0);
	}
	else if (decalMode < 2.5) {
		vec2 centered = decalCoordinate * 2.0 - 1.0;
		float distance = length(centered);
		float offset = (distance - decalRing.x) / decalRing.y;
		float ring = exp(-offset * offset);
		vec2 around = centered / max(distance, 0.0001);
		float turn = decalTime * decalRing.w;
		vec2 forward = vec2(around.x * cos(turn) - around.y * sin(turn), around.x * sin(turn) + around.y * cos(turn));
		vec2 backward = vec2(around.x * cos(turn * 0.6) + around.y * sin(turn * 0.6), -around.x * sin(turn * 0.6) + around.y * cos(turn * 0.6));
		float flow = readFbm(vec3(forward * decalRing.z, decalSeed + decalTime * 0.4));
		float drift = readFbm(vec3(backward * decalRing.z * 2.1, decalSeed * 1.7 - decalTime * 0.3));
		float strength = clamp(0.2 + (flow * 0.7 + drift * 0.5 - 0.35) * 1.6, 0.0, 1.4);
		float alpha = ring * strength * decalAlpha;
		fragmentColor = vec4(decalTint * readRamp(decalRamp, 1.0 - decalHeat) * alpha, 0.0);
	}
	else if (decalMode < 3.5) {
		vec4 texel = readSlot(decalSlot, decalCoordinate);
		float alpha = texel.a * decalAlpha;
		float edge = smoothstep(0.15, 0.55, texel.a) * (1.0 - smoothstep(0.55, 0.95, texel.a));
		vec3 color = mix(decalTint, rimColor, edge * 0.35);
		fragmentColor = vec4(color * alpha, alpha);
	}
	else if (decalMode < 4.5) {
		vec4 texel = readSlot(decalSlot, decalCoordinate);
		float body = smoothstep(0.1, 0.28, texel.a) * decalAlpha;
		float sheen = (smoothstep(0.1, 0.15, texel.a) - smoothstep(0.17, 0.24, texel.a)) * 0.85;
		vec3 color = mix(decalTint, vec3(1.0), sheen);
		float alpha = max(body, sheen * decalAlpha);
		fragmentColor = vec4(color * alpha, alpha);
	}
	else {
		float alpha = decalAlpha * (1.0 - smoothstep(0.25, 1.0, length(decalCoordinate * 2.0 - 1.0)));
		fragmentColor = vec4(0.0, 0.0, 0.0, alpha);
	}
}
`;
// 회전체 빔. (단위 원기둥을 축과 두 옆 쪽으로 펴고, 겉을 잡음으로 일렁임)
//   beamShape 는 (반지름, 일렁임, 시각, 씨앗), beamFlow 는 (길이, 흐르는 빠르기, 결의 잘기, 비움) 이다.
const BEAM_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 vertexGrid;
uniform mat4 viewProjectionMatrix;
uniform vec3 beamStart;
uniform vec3 beamAxis;
uniform vec3 beamSideA;
uniform vec3 beamSideB;
uniform vec4 beamShape;
uniform vec4 beamFlow;
out vec2 beamCoordinate;
out vec3 beamNormal;
out vec3 worldPosition;
${NOISE_SHADER_CHUNK}
void main() {
	float angle = vertexGrid.x * 6.2832;
	vec3 around = beamSideA * cos(angle) + beamSideB * sin(angle);
	float along = vertexGrid.y;
	float wobble = beamShape.y * (readValueNoise(vec3(cos(angle) * 1.8 + beamShape.w, sin(angle) * 1.8, along * beamFlow.x * 1.3 + beamShape.z * beamFlow.y * 0.5)) - 0.5) * 2.0;
	float radius = beamShape.x * (1.0 + wobble);
	worldPosition = beamStart + beamAxis * along + around * radius;
	gl_Position = viewProjectionMatrix * vec4(worldPosition, 1.0);
	beamCoordinate = vertexGrid;
	beamNormal = around;
}
`;
// 회전체 빔의 칠. (심은 흰빛, 겉집은 색 램프로 가장자리가 0, 빔 결이 시작에서 끝 쪽으로 흐름, 둘 다 더하는 빛)
//   cameraPoint 의 w 가 1 이면 카메라 자리(원근), 0 이면 카메라 쪽(직교)이다. beamLook 은 (꼴 0 심 1 겉집, 알파, 램프, 밝기) 이다.
const BEAM_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 beamCoordinate;
in vec3 beamNormal;
in vec3 worldPosition;
uniform vec3 beamAxis;
uniform vec4 beamShape;
uniform vec4 beamFlow;
uniform vec4 beamLook;
uniform vec4 cameraPoint;
out vec4 fragmentColor;
${ATLAS_SHADER_CHUNK}
void main() {
	vec3 toward = cameraPoint.w > 0.5 ? normalize(cameraPoint.xyz - worldPosition) : cameraPoint.xyz;
	vec3 axisUnit = normalize(beamAxis);
	vec3 across = toward - axisUnit * dot(toward, axisUnit);
	float facing = dot(normalize(beamNormal), across / max(length(across), 0.0001));
	if (facing <= 0.0) {
		discard;
	}
	float along = beamCoordinate.y;
	float endFade = smoothstep(0.0, 0.04, along) * (1.0 - smoothstep(0.985, 1.0, along));
	vec2 grainCoordinate = vec2(fract(beamCoordinate.x * 3.0), fract(along * beamFlow.x * beamFlow.z - beamShape.z * beamFlow.y));
	float grain = readSlot(4.0, grainCoordinate).a;
	vec3 color;
	if (beamLook.x < 0.5) {
		float body = smoothstep(0.0, 0.45, facing);
		color = mix(readRamp(beamLook.z, 0.12), vec3(1.0), body) * (0.85 + 0.4 * grain) * body;
	}
	else {
		float body = pow(facing, 1.7);
		color = readRamp(beamLook.z, 0.22 + (1.0 - facing) * 0.45 + (1.0 - grain) * 0.25) * (0.3 + 0.95 * grain) * body;
	}
	fragmentColor = vec4(color * endFade * beamLook.y * beamLook.w, 0.0);
}
`;
// 연기 기둥. (윤곽 0 ~ .4 는 밑이 퍼진 기둥, .4 ~ 1 은 갓의 둥근 단면을 안쪽 아래에서 바깥을 돌아 위로, 잡음으로 흔듦)
//   plumeShape 는 (x, z, 높이, 갓 반지름), plumeMotion 은 (나아감 0 ~ 1, 시각, 씨앗, 기둥 반지름), plumeBase 는 밑의 높이다.
const PLUME_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 vertexGrid;
uniform mat4 viewProjectionMatrix;
uniform vec4 plumeShape;
uniform vec4 plumeMotion;
uniform float plumeBase;
out vec2 plumeCoordinate;
out vec3 plumeNormal;
out float plumeNoise;
${NOISE_SHADER_CHUNK}
void main() {
	float angle = vertexGrid.x * 6.2832;
	vec3 around = vec3(cos(angle), 0.0, sin(angle));
	float profile = vertexGrid.y;
	float progress = plumeMotion.x;
	float grow = 1.0 - pow(1.0 - min(1.0, progress * 1.8), 2.0);
	float height = plumeShape.z * (0.3 + 0.7 * grow);
	float capRadius = plumeShape.w * (0.4 + 0.6 * grow) * (1.0 + 0.2 * progress);
	float stemRadius = plumeMotion.w * (0.8 + 0.5 * progress);
	float capCenter = height - capRadius * 0.45;
	float radius;
	float rise;
	vec2 profileNormal;
	if (profile < 0.4) {
		float ratio = profile / 0.4;
		rise = ratio * capCenter;
		radius = mix(stemRadius * 2.2, stemRadius, smoothstep(0.0, 0.3, ratio));
		profileNormal = vec2(1.0, 0.0);
	}
	else {
		float ratio = (profile - 0.4) / 0.6;
		float turn = mix(-1.9, 2.6, ratio);
		float tube = capRadius * 0.5;
		radius = max(0.0, capRadius * 0.55 + cos(turn) * tube);
		rise = capCenter + sin(turn) * tube * 0.85;
		profileNormal = vec2(cos(turn), sin(turn));
	}
	float noiseValue = readFbm(vec3(around.xz * 1.7 + plumeMotion.z, profile * 4.0 - plumeMotion.y * 1.1));
	radius *= 1.0 + (noiseValue - 0.5) * 0.55;
	rise += (noiseValue - 0.5) * 0.25 * capRadius;
	vec3 worldPosition = vec3(plumeShape.x, plumeBase, plumeShape.y) + around * radius + vec3(0.0, rise, 0.0);
	gl_Position = viewProjectionMatrix * vec4(worldPosition, 1.0);
	plumeCoordinate = vertexGrid;
	plumeNormal = normalize(around * profileNormal.x + vec3(0.0, profileNormal.y, 0.0));
	plumeNoise = noiseValue;
}
`;
// 연기 기둥의 칠. (연기 플립북이 윤곽을 따라 말려 흐르고, 처음에는 갓 밑이 색 램프로 달아올랐다 식음, 미리 곱한 알파)
//   plumeLook 은 (알파, 열기, 램프, 시각) 이다.
const PLUME_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 plumeCoordinate;
in vec3 plumeNormal;
in float plumeNoise;
uniform vec4 cameraPoint;
uniform vec4 plumeLook;
uniform vec4 plumeMotion;
uniform vec3 smokeColor;
out vec4 fragmentColor;
${ATLAS_SHADER_CHUNK}
void main() {
	vec3 normal = normalize(plumeNormal);
	float facing = dot(normal, cameraPoint.xyz);
	if (facing <= 0.0) {
		discard;
	}
	float frame = floor(clamp(plumeMotion.x, 0.0, 1.0) * 10.0);
	vec2 smokeCoordinate = vec2(fract(plumeCoordinate.x * 5.0), fract(plumeCoordinate.y * 3.0 - plumeLook.w * 0.45));
	vec4 smoke = readSmokeFrame(frame, smokeCoordinate);
	float density = smoothstep(0.0, 0.55, facing) * clamp(0.35 + smoke.a * 0.9 + (plumeNoise - 0.5) * 0.6, 0.0, 1.0) * plumeLook.x;
	float shade = 0.55 + 0.45 * clamp(normal.y * 0.6 + 0.5, 0.0, 1.0);
	float underside = 1.0 - smoothstep(-0.2, 0.5, normal.y);
	float heat = plumeLook.y * clamp(smoke.a * 1.2 - 0.25 + underside * 0.5 + (plumeNoise - 0.5), 0.0, 1.0);
	vec3 glowColor = readRamp(plumeLook.z, 1.0 - heat) * heat * 1.6;
	fragmentColor = vec4((smokeColor * shade * smoke.rgb + glowColor) * density, density);
}
`;
// 리본. (정점은 미리 카메라 쪽으로 편 자리, 길이 쪽과 가로 값만 넘김)
const RIBBON_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec3 vertexPosition;
in vec2 vertexRibbon;
uniform mat4 viewProjectionMatrix;
out vec2 ribbonCoordinate;
void main() {
	gl_Position = viewProjectionMatrix * vec4(vertexPosition, 1.0);
	ribbonCoordinate = vertexRibbon;
}
`;
// 리본의 칠. (가로로 밝은 심과 엷은 둘레, 빔 결이 길이 쪽으로 흐름, 램프가 있으면 가장자리로 갈수록 램프 색, 더하는 빛)
//   ribbonLook 은 (램프, 알파, 밝기, 결의 자리), ribbonGrain 은 (결의 잘기, 덮는 꼴의 몫) 이다. 덮는 꼴은 몸을 테 색으로 덮고 심은 색인 꼴이다. (번짐 색이 없을 때)
//   ribbonGlow 의 a 가 1 이면 번짐 색: 가운데 흰 심, 그 둘레를 ribbonGlow.rgb 로, 가장자리를 테 색(rimColor)으로 겹쳐 덮는다. (밝은 바탕에서도 보이게)
const RIBBON_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 ribbonCoordinate;
uniform vec3 ribbonColor;
uniform vec4 ribbonLook;
uniform vec2 ribbonGrain;
uniform vec4 ribbonGlow;
uniform vec3 rimColor;
out vec4 fragmentColor;
${ATLAS_SHADER_CHUNK}
void main() {
	float across = abs(ribbonCoordinate.y * 2.0 - 1.0);
	float body = exp(-across * across * 7.0) * 0.75 + exp(-across * across * 50.0) * 0.9;
	float grain = readSlot(4.0, vec2(0.3 + ribbonCoordinate.y * 0.4, fract(ribbonCoordinate.x * ribbonGrain.x - ribbonLook.w))).a;
	if (ribbonGlow.a > 0.5) {
		float white = 1.0 - smoothstep(0.24, 0.36, across);
		float glowZone = 1.0 - smoothstep(0.58, 0.78, across);
		float edge = 1.0 - smoothstep(0.82, 1.0, across);
		float layered = clamp(edge * (0.7 + 0.3 * grain) * ribbonLook.y, 0.0, 1.0);
		vec3 layeredColor = mix(rimColor, ribbonGlow.rgb, glowZone);
		layeredColor = mix(layeredColor, vec3(1.0), white);
		fragmentColor = vec4(layeredColor * layered + vec3(white * layered * 0.35 * ribbonLook.z), layered);
		return;
	}
	vec3 color = ribbonColor;
	if (ribbonLook.x >= 0.0) {
		color *= readRamp(ribbonLook.x, across * 0.55 + (1.0 - grain) * 0.3);
	}
	float alpha = body * (0.45 + 0.75 * grain) * ribbonLook.y;
	fragmentColor = vec4(color * alpha * ribbonLook.z, 0.0);
	if (ribbonGrain.y > 0.0) {
		float coverBody = exp(-across * across * 7.0);
		float core = exp(-across * across * 50.0);
		float cover = clamp(coverBody * (0.55 + 0.6 * grain) * ribbonLook.y, 0.0, 1.0);
		vec3 covered = mix(rimColor, min(color * ribbonLook.z, vec3(1.0)), smoothstep(0.15, 0.6, core));
		fragmentColor = mix(fragmentColor, vec4(covered * cover + color * core * cover * 0.35 * ribbonLook.z, cover), min(ribbonGrain.y, 1.0));
	}
}
`;
// 화면 섬광. (네 귀퉁이가 곧 뷰포트, 그 색으로 덮음, 미리 곱한 알파)
const FLASH_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 vertexCorner;
void main() {
	gl_Position = vec4(vertexCorner, 0.0, 1.0);
}
`;
const FLASH_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec4 flashColor;
out vec4 fragmentColor;
void main() {
	fragmentColor = vec4(flashColor.rgb * flashColor.a, flashColor.a);
}
`;
// 기본 색 램프. (흰빛에서 어둠으로 식는 한 줄, 테마 색은 setRamps 로 준다)
const DEFAULT_RAMPS = [["#ffffff", "#d8d8d8", "#a0a0a0", "#686868", "#343434", "#101010"]];


//==============================================================================
// 값 잡음의 격자. (256 x 256 의 0 ~ 1, 아틀라스를 지을 때만 쓴다)
//==============================================================================
/**
 * @param { number } seed - 무작위 씨앗.
 * @returns { Float32Array } 256 x 256 칸의 0 ~ 1 값.
 */
function createNoiseGrid(seed) {
	const seededRandom = new SeededRandom(seed);
	const grid = new System.Float32Array(256 * 256);
	for (let valueIndex = 0; valueIndex < grid.length; ++valueIndex) {
		grid[valueIndex] = seededRandom.nextValue();
	}
	return grid;
}

//==============================================================================
// 잇는 값 잡음 하나. (주기마다 이어 붙어 타일이 된다, 주기는 256 이하)
//==============================================================================
/**
 * @param { Float32Array } grid - createNoiseGrid 가 지은 격자.
 * @param { number } x - 가로 자리. (격자 칸 단위)
 * @param { number } y - 세로 자리. (격자 칸 단위)
 * @param { number } periodX - 가로로 되풀이하는 주기. (칸)
 * @param { number } periodY - 세로로 되풀이하는 주기. (칸)
 * @returns { number } 0 ~ 1 의 잡음 값.
 */
function readGridNoise(grid, x, y, periodX, periodY) {
	const column = System.Math.floor(x);
	const row = System.Math.floor(y);
	const offsetX = x - column;
	const offsetY = y - row;
	const weightX = offsetX * offsetX * (3 - 2 * offsetX);
	const weightY = offsetY * offsetY * (3 - 2 * offsetY);
	const left = ((column % periodX) + periodX) % periodX;
	const right = (left + 1) % periodX;
	const top = ((row % periodY) + periodY) % periodY;
	const bottom = (top + 1) % periodY;
	const topLeft = grid[(top & 255) * 256 + (left & 255)];
	const topRight = grid[(top & 255) * 256 + (right & 255)];
	const bottomLeft = grid[(bottom & 255) * 256 + (left & 255)];
	const bottomRight = grid[(bottom & 255) * 256 + (right & 255)];
	const upper = topLeft + (topRight - topLeft) * weightX;
	const lower = bottomLeft + (bottomRight - bottomLeft) * weightX;
	return upper + (lower - upper) * weightY;
}

//==============================================================================
// 여러 겹 값 잡음. (겹마다 두 배로 잘게, 주기도 두 배라 타일이 그대로 이어진다, 0 ~ 1)
//==============================================================================
/**
 * @param { Float32Array } grid - createNoiseGrid 가 지은 격자.
 * @param { number } x - 가로 자리. (첫 겹의 칸 단위)
 * @param { number } y - 세로 자리. (첫 겹의 칸 단위)
 * @param { number } periodX - 첫 겹의 가로 주기. (칸)
 * @param { number } periodY - 첫 겹의 세로 주기. (칸)
 * @param { number } octaveCount - 겹의 수.
 * @returns { number } 0 ~ 1 의 잡음 값.
 */
function readGridFbm(grid, x, y, periodX, periodY, octaveCount) {
	let sum = 0;
	let total = 0;
	let amplitude = 0.5;
	let frequency = 1;
	for (let octaveIndex = 0; octaveIndex < octaveCount; ++octaveIndex) {
		sum += amplitude * readGridNoise(grid, x * frequency, y * frequency, periodX * frequency, periodY * frequency);
		total += amplitude;
		amplitude *= 0.5;
		frequency *= 2;
	}
	return sum / total;
}

//==============================================================================
// 0 ~ 1 로 가두기. (셰이더의 clamp)
//==============================================================================
/**
 * @param { number } value - 가둘 값.
 * @returns { number } 0 ~ 1 로 가둔 값.
 */
function clampUnit(value) {
	return System.Math.min(1, System.Math.max(0, value));
}

//==============================================================================
// 부드러운 계단. (셰이더의 smoothstep)
//==============================================================================
/**
 * @param { number } edgeStart - 0 이 되는 끝.
 * @param { number } edgeEnd - 1 이 되는 끝.
 * @param { number } value - 넣는 값.
 * @returns { number } 0 ~ 1 의 부드럽게 오르는 값.
 */
function smoothStep(edgeStart, edgeEnd, value) {
	const ratio = clampUnit((value - edgeStart) / (edgeEnd - edgeStart));
	return ratio * ratio * (3 - 2 * ratio);
}

//==============================================================================
// 색 하나를 0 ~ 1 의 [r, g, b] 로. ("#rrggbb" 나 [r, g, b])
//==============================================================================
/**
 * @param { string | Array<number> } color - "#rrggbb" 나 0 ~ 1 의 [r, g, b].
 * @returns { Array<number> } 0 ~ 1 의 [r, g, b].
 */
function readRampColor(color) {
	if (typeof color !== "string") {
		return [color[0], color[1], color[2]];
	}
	const value = System.parseInt(color.slice(1), 16);
	return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

//==============================================================================
// 아틀라스 칸 하나 칠하기. (painter 가 (u, v, texel) 로 0 ~ 1 의 RGBA 를 채움, 첫 줄이 텍스처의 v 0)
//==============================================================================
/**
 * @param { Uint8Array } pixels - 아틀라스 픽셀. (RGBA8)
 * @param { number } originX - 칸의 왼쪽 끝. (픽셀)
 * @param { number } originY - 칸의 첫 줄. (픽셀)
 * @param { function } painter - (u, v, texel) 로 칸의 한 픽셀을 채우는 함수.
 */
function paintCell(pixels, originX, originY, painter) {
	const texel = [1, 1, 1, 0];
	for (let pixelY = 0; pixelY < ATLAS_SLOT_SIZE; ++pixelY) {
		const v = (pixelY + 0.5) / ATLAS_SLOT_SIZE;
		for (let pixelX = 0; pixelX < ATLAS_SLOT_SIZE; ++pixelX) {
			const u = (pixelX + 0.5) / ATLAS_SLOT_SIZE;
			texel[0] = 1;
			texel[1] = 1;
			texel[2] = 1;
			texel[3] = 0;
			painter(u, v, texel);
			const offset = ((originY + pixelY) * ATLAS_WIDTH + originX + pixelX) * 4;
			pixels[offset] = System.Math.round(clampUnit(texel[0]) * 255);
			pixels[offset + 1] = System.Math.round(clampUnit(texel[1]) * 255);
			pixels[offset + 2] = System.Math.round(clampUnit(texel[2]) * 255);
			pixels[offset + 3] = System.Math.round(clampUnit(texel[3]) * 255);
		}
	}
}

//==============================================================================
// 아틀라스 오른쪽 반의 칸 하나 칠하기.
//==============================================================================
/**
 * @param { Uint8Array } pixels - 아틀라스 픽셀. (RGBA8)
 * @param { number } slot - 오른쪽 반의 칸 번호. (ToonVfxSlot)
 * @param { function } painter - (u, v, texel) 로 칸의 한 픽셀을 채우는 함수.
 */
function paintSlot(pixels, slot, painter) {
	paintCell(pixels, ATLAS_WIDTH / 2 + (slot % 4) * ATLAS_SLOT_SIZE, System.Math.floor(slot / 4) * ATLAS_SLOT_SIZE, painter);
}

//==============================================================================
// 색 램프 칸 칠하기. (줄마다 색들을 고르게 나눠 잇는다, 여덟 줄보다 적으면 마지막 줄을 되풀이)
//==============================================================================
/**
 * @param { Uint8Array } pixels - 아틀라스 픽셀. (RGBA8)
 * @param { Array<Array<string | Array<number>>> } ramps - 줄마다의 색들. (setRamps 와 같은 꼴)
 */
function paintRamps(pixels, ramps) {
	const rampColors = ramps.map((stops) => {
		return stops.map(readRampColor);
	});
	paintSlot(pixels, ToonVfxSlot.ramps, (u, v, color) => {
		const rowIndex = System.Math.min(rampColors.length - 1, System.Math.floor(v * TOON_VFX_MAXIMUM_RAMPS));
		const stops = rampColors[rowIndex];
		if (stops.length === 1) {
			color[0] = stops[0][0];
			color[1] = stops[0][1];
			color[2] = stops[0][2];
			color[3] = 1;
			return;
		}
		const position = u * (stops.length - 1);
		const stopIndex = System.Math.min(stops.length - 2, System.Math.floor(position));
		const blend = position - stopIndex;
		for (let channel = 0; channel < 3; ++channel) {
			color[channel] = stops[stopIndex][channel] + (stops[stopIndex + 1][channel] - stops[stopIndex][channel]) * blend;
		}
		color[3] = 1;
	});
}

//==============================================================================
// 아틀라스의 픽셀 짓기. (RGBA8, 램프 칸은 비워 둔다)
//==============================================================================
/**
 * @returns { Uint8Array } 1024 x 512 의 RGBA8 픽셀.
 */
function createAtlasPixels() {
	const pixels = new System.Uint8Array(ATLAS_WIDTH * ATLAS_HEIGHT * 4);
	const grid = createNoiseGrid(4164);
	// 연기 플립북. (잡음 덩어리가 칸마다 말리며 퍼지고 엷어짐, 위쪽이 밝음)
	for (let frame = 0; frame < SMOKE_FRAME_COUNT; ++frame) {
		const progress = frame / (SMOKE_FRAME_COUNT - 1);
		const swirl = progress * 1.1;
		const swirlCosine = System.Math.cos(swirl);
		const swirlSine = System.Math.sin(swirl);
		paintCell(pixels, (frame % 4) * ATLAS_SLOT_SIZE, System.Math.floor(frame / 4) * ATLAS_SLOT_SIZE, (u, v, color) => {
			const centerX = u * 2 - 1;
			const centerY = v * 2 - 1;
			const turnedX = centerX * swirlCosine - centerY * swirlSine;
			const turnedY = centerX * swirlSine + centerY * swirlCosine;
			const warp = readGridFbm(grid, turnedX * 1.7 + 40, turnedY * 1.7 + 40, 256, 256, 3);
			const density = readGridFbm(grid, turnedX * 2.2 + warp * 1.4 + 90, turnedY * 2.2 - progress * 1.3 + 90, 256, 256, 4);
			const distance = System.Math.hypot(centerX, centerY);
			const radius = 0.55 + 0.33 * progress;
			const shape = 1 - smoothStep(radius * 0.45, radius, distance + (density - 0.5) * 0.55);
			const shade = 0.55 + 0.4 * v + (density - 0.5) * 0.35;
			color[0] = shade;
			color[1] = shade;
			color[2] = shade;
			color[3] = shape * clampUnit(0.45 + density * 0.75) * (1 - progress * 0.3);
		});
	}
	// 부드러운 알갱이.
	paintSlot(pixels, ToonVfxSlot.soft, (u, v, color) => {
		const distance = System.Math.hypot(u * 2 - 1, v * 2 - 1);
		color[3] = System.Math.pow(System.Math.max(0, 1 - distance), 2.2) + System.Math.exp(-distance * distance * 30) * 0.4;
	});
	// 불꽃 줄기. (v 1 쪽이 밝은 머리, 0 쪽이 엷은 꼬리)
	paintSlot(pixels, ToonVfxSlot.streak, (u, v, color) => {
		const across = u * 2 - 1;
		const width = 0.16 * (0.3 + 0.7 * v);
		const body = System.Math.exp(-(across / width) * (across / width)) * System.Math.pow(v, 1.6) * (1 - smoothStep(0.92, 1, v));
		const head = System.Math.exp(-(across * across * 40 + (v - 0.84) * (v - 0.84) * 60));
		color[3] = body + head * 0.8;
	});
	// 빛살. (긴 빛줄기 넷, 짧은 넷, 가운데 빛)
	paintSlot(pixels, ToonVfxSlot.star, (u, v, color) => {
		const centerX = u * 2 - 1;
		const centerY = v * 2 - 1;
		const distance = System.Math.hypot(centerX, centerY);
		const angle = System.Math.atan2(centerY, centerX);
		const longRays = System.Math.pow(System.Math.abs(System.Math.cos(angle * 2)), 60) * System.Math.pow(System.Math.max(0, 1 - distance), 1.4);
		const shortRays = System.Math.pow(System.Math.abs(System.Math.sin(angle * 2)), 90) * System.Math.pow(System.Math.max(0, 1 - distance * 1.5), 1.4) * 0.6;
		const glow = System.Math.exp(-distance * distance * 16) * 0.7 + System.Math.exp(-distance * distance * 140) * 0.6;
		color[3] = longRays + shortRays + glow;
	});
	// 충격 띠. (바깥 앞머리가 밝은 테이고 잡음으로 찢긴 가장자리)
	paintSlot(pixels, ToonVfxSlot.shockBand, (u, v, color) => {
		const torn = readGridFbm(grid, u * 12, v * 3 + 7, 12, 256, 4);
		const lead = System.Math.exp(-((v - 0.8) / 0.07) * ((v - 0.8) / 0.07));
		const trail = v < 0.8 ? (v / 0.8) * (v / 0.8) * 0.5 : 0;
		const outerCut = 1 - smoothStep(0.84 + (torn - 0.5) * 0.12, 0.96, v);
		color[3] = (lead + trail) * (0.45 + 0.75 * torn) * outerCut * smoothStep(0, 0.15, v);
	});
	// 빔 결. (위아래로 이어지는 잡음 결)
	paintSlot(pixels, ToonVfxSlot.beamGrain, (u, v, color) => {
		const coarse = readGridFbm(grid, u * 6 + 3, v * 2 + 3, 6, 2, 4);
		const fine = readGridFbm(grid, u * 14 + 9, v * 5 + 9, 14, 5, 3);
		const value = clampUnit(0.5 + (coarse * 0.65 + fine * 0.35 - 0.5) * 1.8);
		color[0] = value;
		color[1] = value;
		color[2] = value;
		color[3] = value;
	});
	// 그을음. (알파는 어둡게 덮는 몫, 빨간 채널은 열기가 남는 금과 가운데)
	paintSlot(pixels, ToonVfxSlot.scorch, (u, v, color) => {
		const centerX = u * 2 - 1;
		const centerY = v * 2 - 1;
		const distance = System.Math.hypot(centerX, centerY);
		const edgeNoise = readGridFbm(grid, centerX * 3 + 20, centerY * 3 + 20, 256, 256, 4);
		const threshold = 0.78 + (edgeNoise - 0.5) * 0.45;
		const grain = readGridFbm(grid, centerX * 9 + 50, centerY * 9 + 50, 256, 256, 3);
		const darkness = (1 - smoothStep(threshold - 0.32, threshold, distance)) * (0.7 + 0.3 * grain);
		const ridge = 1 - System.Math.abs(2 * readGridFbm(grid, centerX * 4.5 + 11, centerY * 4.5 + 3, 256, 256, 4) - 1);
		const crack = smoothStep(0.82, 0.95, ridge) * (1 - smoothStep(0.2, threshold, distance));
		color[0] = crack + System.Math.exp(-distance * distance * 7) * 0.8;
		color[1] = 0;
		color[2] = 0;
		color[3] = darkness * 0.9;
	});
	// 패인 땅. (가운데가 어둡고 가장자리 테가 밝음)
	paintSlot(pixels, ToonVfxSlot.dent, (u, v, color) => {
		const centerX = u * 2 - 1;
		const centerY = v * 2 - 1;
		const distance = System.Math.hypot(centerX, centerY) + (readGridFbm(grid, centerX * 4 + 70, centerY * 4 + 70, 256, 256, 3) - 0.5) * 0.12;
		const rim = System.Math.exp(-((distance - 0.72) / 0.07) * ((distance - 0.72) / 0.07));
		const inner = (1 - smoothStep(0.3, 0.76, distance)) * 0.55;
		color[0] = rim * 0.8 + System.Math.exp(-distance * distance * 10) * 0.5;
		color[1] = 0;
		color[2] = 0;
		color[3] = inner + rim * 0.3;
	});
	// 넓은 둘레 빛.
	paintSlot(pixels, ToonVfxSlot.glow, (u, v, color) => {
		const distance = System.Math.hypot(u * 2 - 1, v * 2 - 1);
		color[3] = System.Math.exp(-distance * distance * 4.5) * (1 - smoothStep(0.85, 1, distance));
	});
	return pixels;
}

//==============================================================================
// 불덩이의 단위 구. ({ positions, indices }, 노멀은 자리와 같음)
//==============================================================================
/**
 * @returns { object } 단위 구의 { positions, indices }.
 */
function createSphereArrays() {
	const aroundCount = FIREBALL_SEGMENTS[0];
	const downCount = FIREBALL_SEGMENTS[1];
	const positions = [];
	const indices = [];
	for (let downIndex = 0; downIndex <= downCount; ++downIndex) {
		const polar = downIndex / downCount * System.Math.PI;
		for (let aroundIndex = 0; aroundIndex <= aroundCount; ++aroundIndex) {
			const azimuth = aroundIndex / aroundCount * System.Math.PI * 2;
			positions.push(System.Math.sin(polar) * System.Math.cos(azimuth), System.Math.cos(polar), System.Math.sin(polar) * System.Math.sin(azimuth));
		}
	}
	for (let downIndex = 0; downIndex < downCount; ++downIndex) {
		for (let aroundIndex = 0; aroundIndex < aroundCount; ++aroundIndex) {
			const first = downIndex * (aroundCount + 1) + aroundIndex;
			const second = first + aroundCount + 1;
			indices.push(first, second, first + 1, second, second + 1, first + 1);
		}
	}
	return { positions: new System.Float32Array(positions), indices: new System.Uint16Array(indices) };
}

//==============================================================================
// 둘레로 도는 격자. ({ positions, indices }, (둘레 0 ~ 1, 가로질러 0 ~ 1))
//==============================================================================
/**
 * @param { Array<number> } segments [둘레 나눔, 가로지른 나눔]
 * @returns { object } 격자의 { positions, indices }. (정점마다 (둘레, 가로질러) 두 값)
 */
function createGridArrays(segments) {
	const aroundCount = segments[0];
	const acrossCount = segments[1];
	const positions = [];
	const indices = [];
	for (let acrossIndex = 0; acrossIndex <= acrossCount; ++acrossIndex) {
		for (let aroundIndex = 0; aroundIndex <= aroundCount; ++aroundIndex) {
			positions.push(aroundIndex / aroundCount, acrossIndex / acrossCount);
		}
	}
	for (let acrossIndex = 0; acrossIndex < acrossCount; ++acrossIndex) {
		for (let aroundIndex = 0; aroundIndex < aroundCount; ++aroundIndex) {
			const first = acrossIndex * (aroundCount + 1) + aroundIndex;
			const second = first + aroundCount + 1;
			indices.push(first, second, first + 1, second, second + 1, first + 1);
		}
	}
	return { positions: new System.Float32Array(positions), indices: new System.Uint16Array(indices) };
}

//==============================================================================
// 범위나 수 하나에서 값 읽기. ([최소, 최대] 면 그 사이 무작위)
//==============================================================================
/**
 * @param { number | Array<number> } range - 수 하나나 [최소, 최대].
 * @param { SeededRandom } seededRandom - 범위일 때 쓰는 무작위.
 * @returns { number } 읽은 값.
 */
function readRangeValue(range, seededRandom) {
	if (typeof range === "number") {
		return range;
	}
	return range[0] + (range[1] - range[0]) * seededRandom.nextValue();
}

//==============================================================================
// 축에 수직인 두 쪽. ([옆 A, 옆 B], 둘 다 길이 1, 축이 0 이면 x 와 z)
//==============================================================================
/**
 * @param { Array<number> } axis - 축. ([x, y, z], 길이는 상관없음)
 * @returns { Array<Array<number>> } [옆 A, 옆 B]. (둘 다 길이 1)
 */
function readAxisSides(axis) {
	const axisLength = System.Math.hypot(axis[0], axis[1], axis[2]);
	if (axisLength < 0.000001) {
		return [[1, 0, 0], [0, 0, 1]];
	}
	const axisX = axis[0] / axisLength;
	const axisY = axis[1] / axisLength;
	const axisZ = axis[2] / axisLength;
	const helper = System.Math.abs(axisY) < 0.9 ? [0, 1, 0] : [1, 0, 0];
	let sideX = axisY * helper[2] - axisZ * helper[1];
	let sideY = axisZ * helper[0] - axisX * helper[2];
	let sideZ = axisX * helper[1] - axisY * helper[0];
	const sideLength = System.Math.hypot(sideX, sideY, sideZ);
	sideX /= sideLength;
	sideY /= sideLength;
	sideZ /= sideLength;
	return [[sideX, sideY, sideZ], [axisY * sideZ - axisZ * sideY, axisZ * sideX - axisX * sideZ, axisX * sideY - axisY * sideX]];
}


//==============================================================================
// 툰 3D GPU 효과의 바탕. (외계행성 광부 키우기와 애버런트가 따로 쓰던 판 안 효과의 범용 부분)
// - 텍스처: 그림 파일 없이 처음 그릴 때 코드로 짓는 아틀라스 한 장. 왼쪽 반은 연기 플립북 16 칸, 오른쪽 반은 ToonVfxSlot 칸과 색 램프 여덟 줄.
//   램프 색은 게임이 정한다. (setRamps, 줄마다 흰 심에서 어둠으로 가는 색들, 효과의 ramp 는 줄 번호, -1 이면 램프 없이 color 만)
// - 파티클: 인스턴스로 그리는 GPU 파티클. 낼 때 한 번 버퍼에 쓰고 자리, 크기, 색은 정점 셰이더가 나이로 셈한다. (끌림, 중력, 바닥에서 멈춤, 속도 쪽으로 늘인 줄기, 색 램프)
//   상한(setParticleCapacity)을 넘으면 가장 오래 전에 낸 것부터 덮고, setCountRatio 로 내는 수에 몫을 곱한다. (폰과 가벼운 길)
// - 효과 메쉬: 잡음으로 끓다 연기로 식는 불덩이(addFireball), 바깥으로 흐르며 찢기고 말려 오르는 충격파 띠와 그 밑 바닥 빛(addShockwave),
//   바닥 자국(addDecal, queueDecal), 말려 오르는 연기 기둥(addPlume), 결이 흐르고 겉이 일렁이는 회전체 빔(queueBeam),
//   카메라 쪽으로 편 리본(queueRibbon)과 그것을 감아 내린 번개(queueLightning), 사는 동안 다시 꺾이는 번개(addLightning), 그 자리의 빛 점(queueGlint).
// - 테: 빛 파티클의 rim, 리본의 glow 와 rim, 불덩이와 충격파의 rim 은 가장자리를 테 색(setRimColor)으로 덮어 밝은 바탕에서도 보이게 한다. (기본은 더하는 빛만)
// - 밝기 배: setLookGain(꼴, 배) 로 파티클과 빛 점의 꼴마다 밝기를 곱한다. (기본 1, HDR 판에서 불꽃 줄기, 빛살, 불씨를 선형 몇 배로 할 때)
// - 나이와 열쇠: emitParticles, addFireball, addShockwave, addDecal, addPlume, addLightning, addFlash 는 options.age(이미 지난 초, 음수면 그만큼 늦게)와
//   options.key(사건 열쇠, 이미 낸 열쇠면 다시 내지 않음, clear 가 잊음)를 받는다. 장면이 매 프레임 상태에서 사건을 다시 내도 한 번만, 늦게 보인 효과는 그 나이부터 튼다.
//   흔들림(addShake)은 Shaker 의 지수 감쇠(초당 9)라 늦게 보인 사건은 세기 x exp(-9 x 나이) 로 넘기면 같다.
// - 발밑 그늘: queueBlobShadow 는 그 프레임의 둥근 그늘 자국(ToonVfxDecalMode.shade)이다.
// - 화면: 섬광(addFlash)은 draw 끝에 지금 뷰포트(가위가 걸려 있으면 그 안)를 그 색으로 덮고 걷힌다.
//   카메라 흔들림(addShake)은 엔진 Shaker 로 셈하고, readShake 가 준 오프셋을 게임이 카메라의 오른쪽과 위쪽으로 더한다.
// - 어느 사건에 어느 효과를 어떤 값으로 낼지(처방)는 게임 몫이다. 엔진은 매개변수만 받는다.
// - 바닥: setFloorHeightReader((x, z) => 높이) 로 게임이 바닥 높이를 알려 주면 자국, 충격파, 연기 기둥은 그 높이에, isGrounded 파티클은 그 높이에서 멈춘다. (없으면 0)
// - 시계: update(초) 가 이 바탕의 시계를 나아가게 한다. 판이 멈추면 효과도 멈춘다. queue 로 넘긴 것은 그 프레임에 한 번 그리고 비운다.
// - 그리기: draw(보기, 투영) 를 툰 모형을 그린 뒤 부른다. 깊이 시험은 켜고 깊이는 쓰지 않으며 미리 곱한 알파로 섞는다. 앞의 상태를 적어 두었다 돌린다.
//==============================================================================
/**
 * @example <caption>매 프레임 상태에서 사건을 다시 내도 열쇠로 한 번만 내기</caption>
 * import { ToonVfx, ToonVfxLook, ToonVfxShape, Matrix4, Vector3 } from "./vanilla.js";
 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
 * const vfx = new ToonVfx(webGL2RenderingContext, 2000);
 * vfx.setRamps([["#ffffff", "#ffd070", "#ff7020", "#802010", "#200808"]]);
 * const viewMatrix = Matrix4.createLookAt(Vector3.create(0, 3, 6), Vector3.create(0, 0.5, 0), Vector3.create(0, 1, 0));
 * const projectionMatrix = Matrix4.createPerspective(Math.PI / 4, 1, 0.1, 100);
 * for (let frameIndex = 0; frameIndex < 3; ++frameIndex) {
 * 	vfx.addFireball({ position: [0, 0.8, 0], radius: 0.7, life: 1, ramp: 0, key: "explosion-1" });
 * 	vfx.emitParticles({ count: 24, position: [0, 0.8, 0], shape: ToonVfxShape.sphere, radius: 0.2, speed: [2, 4], look: ToonVfxLook.ember, ramp: 0, life: 0.8, key: "explosion-1-sparks" });
 * 	vfx.queueBlobShadow({ x: 1, z: 0, radius: 0.4 });
 * 	vfx.update(1 / 60);
 * 	vfx.draw(viewMatrix, projectionMatrix);
 * }
 * const counts = vfx.getActiveCounts();
 * vfx.destroy();
 */
export class ToonVfx {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { WebGLTexture | null } */ #atlasTexture; // 효과 아틀라스. (처음 그릴 때 지음)
	/** @private @type { Uint8Array | null } */ #atlasPixels; // 아틀라스 픽셀. (램프를 바꿀 때 다시 칠함)
	/** @private @type { Array<Array<string | Array<number>>> } */ #ramps;
	/** @private @type { boolean } */ #isRampDirty; // 램프 칸을 다시 올릴지.
	/** @private @type { ShaderProgram } */ #particleProgram;
	/** @private @type { ShaderProgram } */ #fireballProgram;
	/** @private @type { ShaderProgram } */ #bandProgram;
	/** @private @type { ShaderProgram } */ #decalProgram;
	/** @private @type { ShaderProgram } */ #beamProgram;
	/** @private @type { ShaderProgram } */ #plumeProgram;
	/** @private @type { ShaderProgram } */ #ribbonProgram;
	/** @private @type { ShaderProgram } */ #flashProgram;
	/** @private @type { Array<number> } */ #rimColor; // 효과 테의 색. ([r, g, b] 0 ~ 1)
	/** @private @type { Array<WebGLBuffer> } */ #buffers; // 지울 버퍼.
	/** @private @type { WebGLVertexArrayObject } */ #particleVertexArray;
	/** @private @type { WebGLBuffer } */ #particleBuffer;
	/** @private @type { Float32Array } */ #particleData; // 파티클 값. (PARTICLE_FLOAT_COUNT 씩, 고리처럼 돌려 씀)
	/** @private @type { number } */ #particleCapacity;
	/** @private @type { number } */ #particleWriteIndex; // 다음에 쓸 칸.
	/** @private @type { number } */ #particleUsedCount; // 한 번이라도 쓴 칸의 수. (그리는 인스턴스 수)
	/** @private @type { boolean } */ #isParticleDirty; // 버퍼에 올릴 것이 있는지.
	/** @private @type { number } */ #particleLiveUntil; // 낸 파티클이 다 사라지는 시각.
	/** @private @type { number } */ #countRatio; // 내는 파티클 수에 곱하는 몫.
	/** @private @type { object } */ #sphereMesh; // 불덩이 구. ({ vertexArray, indexCount })
	/** @private @type { object } */ #bandMesh; // 충격파 띠.
	/** @private @type { object } */ #latheMesh; // 회전체 격자.
	/** @private @type { WebGLVertexArrayObject } */ #decalVertexArray; // 바닥 자국의 네 귀퉁이.
	/** @private @type { WebGLVertexArrayObject } */ #ribbonVertexArray;
	/** @private @type { WebGLBuffer } */ #ribbonBuffer;
	/** @private @type { Float32Array } */ #ribbonData;
	/** @private @type { WebGLVertexArrayObject } */ #glintVertexArray; // 네 귀퉁이와 빛 점 인스턴스 버퍼. (파티클과 같은 꼴)
	/** @private @type { WebGLBuffer } */ #glintBuffer;
	/** @private @type { Float32Array } */ #glintData;
	/** @private @type { number } */ #glintCapacity; // 프레임마다 넘기는 빛 점의 상한.
	/** @private @type { Float32Array } */ #lookGains; // 파티클 꼴마다의 밝기 배.
	/** @private @type { Set<number | string> } */ #usedEventKeys; // 이미 낸 사건 열쇠.
	/** @private @type { Array<object> } */ #fireballs;
	/** @private @type { Array<object> } */ #bands;
	/** @private @type { Array<object> } */ #decals;
	/** @private @type { Array<object> } */ #plumes;
	/** @private @type { Array<object> } */ #lightnings; // 사는 동안 다시 꺾이는 번개. (addLightning 의 값과 age)
	/** @private @type { Array<object> } */ #flashes; // 화면 섬광. ({ color, strength, life, age })
	/** @private @type { Shaker } */ #shaker; // 카메라 흔들림. (장면 길이에 SHAKE_UNIT_SCALE 을 곱해 넣음)
	/** @private @type { Array<object> } */ #queuedDecals; // 이번 프레임에만 그리는 바닥 자국.
	/** @private @type { Array<object> } */ #queuedBeams;
	/** @private @type { Array<object> } */ #queuedRibbons;
	/** @private @type { number } */ #queuedGlintCount;
	/** @private @type { number } */ #time; // 이 바탕의 시계. (초)
	/** @private @type { SeededRandom } */ #seededRandom;
	/** @private @type { function } */ #floorHeightReader; // (x, z) → 바닥 높이.

	//==============================================================================
	// 생성. (셰이더와 메쉬, 파티클 버퍼를 지음, 아틀라스는 처음 그릴 때)
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext - 효과를 그릴 WebGL2 컨텍스트.
	 * @param { number } [particleCapacity] - 한꺼번에 떠 있는 파티클의 상한.
	 */
	constructor(webGL2RenderingContext, particleCapacity = TOON_VFX_DEFAULT_PARTICLE_CAPACITY) {
		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#atlasTexture = null;
		this.#atlasPixels = null;
		this.#ramps = DEFAULT_RAMPS;
		this.#isRampDirty = true;
		this.#particleProgram = new ShaderProgram(webGL2RenderingContext, PARTICLE_VERTEX_SHADER, PARTICLE_FRAGMENT_SHADER, PARTICLE_ATTRIBUTE_LOCATIONS);
		this.#fireballProgram = new ShaderProgram(webGL2RenderingContext, FIREBALL_VERTEX_SHADER, FIREBALL_FRAGMENT_SHADER, SPHERE_ATTRIBUTE_LOCATIONS);
		this.#bandProgram = new ShaderProgram(webGL2RenderingContext, BAND_VERTEX_SHADER, BAND_FRAGMENT_SHADER, GRID_ATTRIBUTE_LOCATIONS);
		this.#decalProgram = new ShaderProgram(webGL2RenderingContext, DECAL_VERTEX_SHADER, DECAL_FRAGMENT_SHADER, CORNER_ATTRIBUTE_LOCATIONS);
		this.#beamProgram = new ShaderProgram(webGL2RenderingContext, BEAM_VERTEX_SHADER, BEAM_FRAGMENT_SHADER, GRID_ATTRIBUTE_LOCATIONS);
		this.#plumeProgram = new ShaderProgram(webGL2RenderingContext, PLUME_VERTEX_SHADER, PLUME_FRAGMENT_SHADER, GRID_ATTRIBUTE_LOCATIONS);
		this.#ribbonProgram = new ShaderProgram(webGL2RenderingContext, RIBBON_VERTEX_SHADER, RIBBON_FRAGMENT_SHADER, RIBBON_ATTRIBUTE_LOCATIONS);
		this.#flashProgram = new ShaderProgram(webGL2RenderingContext, FLASH_VERTEX_SHADER, FLASH_FRAGMENT_SHADER, CORNER_ATTRIBUTE_LOCATIONS);
		this.#rimColor = [DEFAULT_RIM_COLOR[0], DEFAULT_RIM_COLOR[1], DEFAULT_RIM_COLOR[2]];
		this.#buffers = [];
		this.#countRatio = 1;
		const cornerData = new System.Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
		// 파티클: 네 귀퉁이(정점마다)와 인스턴스 값 일곱(인스턴스마다).
		this.#particleCapacity = System.Math.max(1, System.Math.floor(particleCapacity));
		this.#particleData = new System.Float32Array(this.#particleCapacity * PARTICLE_FLOAT_COUNT);
		this.#particleWriteIndex = 0;
		this.#particleUsedCount = 0;
		this.#isParticleDirty = false;
		this.#particleLiveUntil = 0;
		this.#particleBuffer = this.createBuffer();
		this.#particleVertexArray = this.createParticleVertexArray(cornerData, this.#particleBuffer);
		// 빛 점: 파티클과 같은 꼴의 작은 인스턴스 버퍼. (프레임마다 다시 씀)
		this.#glintCapacity = DEFAULT_GLINT_CAPACITY;
		this.#glintData = new System.Float32Array(DEFAULT_GLINT_CAPACITY * PARTICLE_FLOAT_COUNT);
		this.#lookGains = new System.Float32Array(LOOK_COUNT).fill(1);
		this.#usedEventKeys = new System.Set();
		this.#glintBuffer = this.createBuffer();
		this.#glintVertexArray = this.createParticleVertexArray(cornerData, this.#glintBuffer);
		// 리본: 자리와 (길이 쪽, 가로). (프레임마다 다시 씀)
		this.#ribbonData = new System.Float32Array(RIBBON_FLOAT_COUNT * 256);
		this.#ribbonVertexArray = webGL2RenderingContext.createVertexArray();
		webGL2RenderingContext.bindVertexArray(this.#ribbonVertexArray);
		this.#ribbonBuffer = this.createBuffer();
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#ribbonBuffer);
		webGL2RenderingContext.enableVertexAttribArray(RIBBON_ATTRIBUTE_LOCATIONS.vertexPosition);
		webGL2RenderingContext.vertexAttribPointer(RIBBON_ATTRIBUTE_LOCATIONS.vertexPosition, 3, webGL2RenderingContext.FLOAT, false, RIBBON_FLOAT_COUNT * 4, 0);
		webGL2RenderingContext.enableVertexAttribArray(RIBBON_ATTRIBUTE_LOCATIONS.vertexRibbon);
		webGL2RenderingContext.vertexAttribPointer(RIBBON_ATTRIBUTE_LOCATIONS.vertexRibbon, 2, webGL2RenderingContext.FLOAT, false, RIBBON_FLOAT_COUNT * 4, 12);
		webGL2RenderingContext.bindVertexArray(null);
		// 바닥 자국: 네 귀퉁이만.
		this.#decalVertexArray = webGL2RenderingContext.createVertexArray();
		webGL2RenderingContext.bindVertexArray(this.#decalVertexArray);
		this.bindCornerBuffer(cornerData, CORNER_ATTRIBUTE_LOCATIONS.vertexCorner);
		webGL2RenderingContext.bindVertexArray(null);
		this.#sphereMesh = this.createIndexedMesh(createSphereArrays(), 3);
		this.#bandMesh = this.createIndexedMesh(createGridArrays(BAND_SEGMENTS), 2);
		this.#latheMesh = this.createIndexedMesh(createGridArrays(LATHE_SEGMENTS), 2);
		this.#fireballs = [];
		this.#bands = [];
		this.#decals = [];
		this.#plumes = [];
		this.#lightnings = [];
		this.#flashes = [];
		this.#shaker = new Shaker();
		this.#queuedDecals = [];
		this.#queuedBeams = [];
		this.#queuedRibbons = [];
		this.#queuedGlintCount = 0;
		this.#time = 0;
		this.#seededRandom = new SeededRandom(164);
		this.#floorHeightReader = () => {
			return 0;
		};
	}

	//==============================================================================
	// 셰이더 소스 반환. (ShaderWarmer 로 미리 링크할 때)
	//==============================================================================
	/**
	 * @static
	 * @returns { Array<object> } { vertexShader, fragmentShader, attributeLocationTable } 의 배열.
	 * @example <caption>켤 때 효과 셰이더를 미리 링크해 두기</caption>
	 * import { ToonVfx, ShaderWarmer } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const shaderWarmer = new ShaderWarmer(webGL2RenderingContext, ToonVfx.readProgramSources());
	 * shaderWarmer.update();
	 * if (shaderWarmer.isFinished()) {
	 * 	const vfx = new ToonVfx(webGL2RenderingContext);
	 * 	vfx.prepare();
	 * }
	 */
	static readProgramSources() {
		return [
			{ vertexShader: PARTICLE_VERTEX_SHADER, fragmentShader: PARTICLE_FRAGMENT_SHADER, attributeLocationTable: PARTICLE_ATTRIBUTE_LOCATIONS },
			{ vertexShader: FIREBALL_VERTEX_SHADER, fragmentShader: FIREBALL_FRAGMENT_SHADER, attributeLocationTable: SPHERE_ATTRIBUTE_LOCATIONS },
			{ vertexShader: BAND_VERTEX_SHADER, fragmentShader: BAND_FRAGMENT_SHADER, attributeLocationTable: GRID_ATTRIBUTE_LOCATIONS },
			{ vertexShader: DECAL_VERTEX_SHADER, fragmentShader: DECAL_FRAGMENT_SHADER, attributeLocationTable: CORNER_ATTRIBUTE_LOCATIONS },
			{ vertexShader: BEAM_VERTEX_SHADER, fragmentShader: BEAM_FRAGMENT_SHADER, attributeLocationTable: GRID_ATTRIBUTE_LOCATIONS },
			{ vertexShader: PLUME_VERTEX_SHADER, fragmentShader: PLUME_FRAGMENT_SHADER, attributeLocationTable: GRID_ATTRIBUTE_LOCATIONS },
			{ vertexShader: RIBBON_VERTEX_SHADER, fragmentShader: RIBBON_FRAGMENT_SHADER, attributeLocationTable: RIBBON_ATTRIBUTE_LOCATIONS },
			{ vertexShader: FLASH_VERTEX_SHADER, fragmentShader: FLASH_FRAGMENT_SHADER, attributeLocationTable: CORNER_ATTRIBUTE_LOCATIONS },
		];
	}

	//==============================================================================
	// 버퍼 하나 만들기. (지울 목록에 넣는다)
	//==============================================================================
	/**
	 * @returns { WebGLBuffer } 새 버퍼.
	 */
	createBuffer() {
		const buffer = this.#webGL2RenderingContext.createBuffer();
		this.#buffers.push(buffer);
		return buffer;
	}

	//==============================================================================
	// 파티클 꼴의 버텍스 어레이. (네 귀퉁이와 인스턴스 값 일곱)
	//==============================================================================
	/**
	 * @param { Float32Array } cornerData - 네 귀퉁이의 (x, y) 여덟 값.
	 * @param { WebGLBuffer } instanceBuffer - 인스턴스 값을 담을 버퍼.
	 * @returns { WebGLVertexArrayObject } 지은 버텍스 어레이.
	 * @private
	 */
	createParticleVertexArray(cornerData, instanceBuffer) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const vertexArray = webGL2RenderingContext.createVertexArray();
		webGL2RenderingContext.bindVertexArray(vertexArray);
		this.bindCornerBuffer(cornerData, PARTICLE_ATTRIBUTE_LOCATIONS.vertexCorner);
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, instanceBuffer);
		for (let attributeIndex = 0; attributeIndex < 7; ++attributeIndex) {
			const location = PARTICLE_ATTRIBUTE_LOCATIONS.particleStart + attributeIndex;
			webGL2RenderingContext.enableVertexAttribArray(location);
			webGL2RenderingContext.vertexAttribPointer(location, 4, webGL2RenderingContext.FLOAT, false, PARTICLE_FLOAT_COUNT * 4, attributeIndex * 16);
			webGL2RenderingContext.vertexAttribDivisor(location, 1);
		}
		webGL2RenderingContext.bindVertexArray(null);
		return vertexArray;
	}

	//==============================================================================
	// 네 귀퉁이 버퍼를 묶인 버텍스 어레이에 붙이기.
	//==============================================================================
	/**
	 * @param { Float32Array } cornerData - 네 귀퉁이의 (x, y) 여덟 값.
	 * @param { number } location - 붙일 어트리뷰트 자리.
	 * @private
	 */
	bindCornerBuffer(cornerData, location) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const cornerBuffer = this.createBuffer();
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, cornerBuffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, cornerData, webGL2RenderingContext.STATIC_DRAW);
		webGL2RenderingContext.enableVertexAttribArray(location);
		webGL2RenderingContext.vertexAttribPointer(location, 2, webGL2RenderingContext.FLOAT, false, 8, 0);
	}

	//==============================================================================
	// 번호로 그리는 메쉬 짓기. ({ vertexArray, indexCount }, 자리는 어트리뷰트 0)
	//==============================================================================
	/**
	 * @param { object } arrays { positions, indices }
	 * @param { number } componentCount - 정점 하나의 자리 값 수. (2 나 3)
	 * @returns { object } { vertexArray, indexCount }.
	 * @private
	 */
	createIndexedMesh(arrays, componentCount) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const vertexArray = webGL2RenderingContext.createVertexArray();
		webGL2RenderingContext.bindVertexArray(vertexArray);
		const vertexBuffer = this.createBuffer();
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, vertexBuffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, arrays.positions, webGL2RenderingContext.STATIC_DRAW);
		webGL2RenderingContext.enableVertexAttribArray(0);
		webGL2RenderingContext.vertexAttribPointer(0, componentCount, webGL2RenderingContext.FLOAT, false, componentCount * 4, 0);
		const indexBuffer = this.createBuffer();
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ELEMENT_ARRAY_BUFFER, indexBuffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ELEMENT_ARRAY_BUFFER, arrays.indices, webGL2RenderingContext.STATIC_DRAW);
		webGL2RenderingContext.bindVertexArray(null);
		return { vertexArray: vertexArray, indexCount: arrays.indices.length };
	}

	//==============================================================================
	// 색 램프 설정. (줄마다 흰 심에서 어둠으로 가는 "#rrggbb" 나 [r, g, b] 의 배열, 여덟 줄까지, 효과의 ramp 는 이 차례)
	//==============================================================================
	/**
	 * @param { Array<Array<string | Array<number>>> } ramps - 줄마다 흰 심에서 어둠으로 가는 색들. (여덟 줄까지, 빈 줄은 버림)
	 * @example <caption>불과 얼음 램프 두 줄을 주고 줄 번호로 고르기</caption>
	 * import { ToonVfx, ToonVfxLook } from "./vanilla.js";
	 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
	 * vfx.setRamps([
	 * 	["#ffffff", "#ffe080", "#ff8020", "#801808", "#200804"],
	 * 	["#ffffff", [0.7, 0.95, 1], [0.3, 0.6, 1], [0.05, 0.1, 0.3]],
	 * ]);
	 * vfx.emitParticles({ count: 20, position: [0, 1, 0], ramp: 0, look: ToonVfxLook.ember, speed: [1, 3], life: 0.8 });
	 * vfx.emitParticles({ count: 20, position: [2, 1, 0], ramp: 1, look: ToonVfxLook.star, speed: [0.5, 1], life: 0.6 });
	 */
	setRamps(ramps) {
		const validRamps = ramps.filter((stops) => {
			return stops.length > 0;
		}).slice(0, TOON_VFX_MAXIMUM_RAMPS);
		this.#ramps = validRamps.length > 0 ? validRamps : DEFAULT_RAMPS;
		this.#isRampDirty = true;
	}

	//==============================================================================
	// 아틀라스 텍스처 읽기. (처음 부를 때 픽셀을 지어 올리고, 램프가 바뀌었으면 다시 올림)
	//==============================================================================
	/**
	 * @returns { WebGLTexture } 효과 아틀라스 텍스처.
	 * @private
	 */
	readAtlasTexture() {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		if (this.#atlasTexture !== null && !this.#isRampDirty) {
			return this.#atlasTexture;
		}
		if (this.#atlasPixels === null) {
			this.#atlasPixels = createAtlasPixels();
		}
		paintRamps(this.#atlasPixels, this.#ramps);
		this.#isRampDirty = false;
		const isNew = this.#atlasTexture === null;
		if (isNew) {
			this.#atlasTexture = webGL2RenderingContext.createTexture();
		}
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + VFX_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, this.#atlasTexture);
		webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_ALIGNMENT, 1);
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA8, ATLAS_WIDTH, ATLAS_HEIGHT, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, this.#atlasPixels);
		if (isNew) {
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.LINEAR);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.LINEAR);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
		}
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		return this.#atlasTexture;
	}

	//==============================================================================
	// 아틀라스를 미리 지어 두기. (처음 터질 때 멈칫하지 않게, 판에 들어갈 때)
	//==============================================================================
	prepare() {
		this.readAtlasTexture();
	}

	//==============================================================================
	// 파티클 상한 설정. (떠 있던 파티클은 지운다)
	//==============================================================================
	/**
	 * @param { number } particleCapacity - 한꺼번에 떠 있는 파티클의 상한. (1 이상)
	 */
	setParticleCapacity(particleCapacity) {
		this.#particleCapacity = System.Math.max(1, System.Math.floor(particleCapacity));
		this.#particleData = new System.Float32Array(this.#particleCapacity * PARTICLE_FLOAT_COUNT);
		this.#particleWriteIndex = 0;
		this.#particleUsedCount = 0;
		this.#particleLiveUntil = this.#time;
		this.#isParticleDirty = false;
	}

	//==============================================================================
	// 파티클 상한 반환.
	//==============================================================================
	/**
	 * @returns { number } 한꺼번에 떠 있는 파티클의 상한.
	 */
	getParticleCapacity() {
		return this.#particleCapacity;
	}

	//==============================================================================
	// 내는 파티클 수의 몫 설정. (폰이나 가벼운 길에서 짜임은 그대로 두고 수만 줄임, 0 ~ 1, 내면 적어도 하나)
	//==============================================================================
	/**
	 * @param { number } countRatio - 내는 파티클 수에 곱하는 몫. (0 ~ 1)
	 */
	setCountRatio(countRatio) {
		this.#countRatio = System.Math.max(0, System.Math.min(1, countRatio));
	}

	//==============================================================================
	// 내는 파티클 수의 몫 반환.
	//==============================================================================
	/**
	 * @returns { number } 내는 파티클 수에 곱하는 몫. (0 ~ 1)
	 */
	getCountRatio() {
		return this.#countRatio;
	}

	//==============================================================================
	// 빛 점 상한 설정. (프레임마다 queueGlint 로 넘기는 수, 기본 96, 이번 프레임에 넘긴 빛 점은 지운다)
	//==============================================================================
	/**
	 * @param { number } glintCapacity - 프레임마다 넘기는 빛 점의 상한. (1 이상)
	 */
	setGlintCapacity(glintCapacity) {
		this.#glintCapacity = System.Math.max(1, System.Math.floor(glintCapacity));
		this.#glintData = new System.Float32Array(this.#glintCapacity * PARTICLE_FLOAT_COUNT);
		this.#queuedGlintCount = 0;
	}

	//==============================================================================
	// 빛 점 상한 반환.
	//==============================================================================
	/**
	 * @returns { number } 프레임마다 넘기는 빛 점의 상한.
	 */
	getGlintCapacity() {
		return this.#glintCapacity;
	}

	//==============================================================================
	// 꼴마다 밝기 배 설정. (ToonVfxLook 의 꼴, 파티클과 빛 점의 밝기에 곱함, 기본 1)
	//==============================================================================
	/**
	 * @param { number } look - 꼴. (ToonVfxLook)
	 * @param { number } gain - 밝기 배. (0 이상, 기본 1)
	 * @example <caption>HDR 판에서 불꽃 줄기와 빛살과 불씨만 더 밝게</caption>
	 * import { ToonVfx, ToonVfxLook } from "./vanilla.js";
	 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
	 * vfx.setLookGain(ToonVfxLook.streak, 3);
	 * vfx.setLookGain(ToonVfxLook.star, 4);
	 * vfx.setLookGain(ToonVfxLook.ember, 2.5);
	 * const streakGain = vfx.getLookGain(ToonVfxLook.streak);
	 */
	setLookGain(look, gain) {
		if (look < 0 || look >= LOOK_COUNT) {
			return;
		}
		this.#lookGains[look] = System.Math.max(0, gain);
	}

	//==============================================================================
	// 꼴마다 밝기 배 반환.
	//==============================================================================
	/**
	 * @param { number } look - 꼴. (ToonVfxLook)
	 * @returns { number } 그 꼴의 밝기 배. (꼴이 범위 밖이면 1)
	 */
	getLookGain(look) {
		if (look < 0 || look >= LOOK_COUNT) {
			return 1;
		}
		return this.#lookGains[look];
	}

	//==============================================================================
	// 사건 열쇠 적기. (열쇠가 없으면 늘 true, 처음 보는 열쇠면 적고 true, 이미 낸 열쇠면 false, clear 가 잊는다)
	//==============================================================================
	/**
	 * @param { number | string | undefined | null } key - 사건 열쇠. (없으면 늘 낸다)
	 * @returns { boolean } 내도 되면 true, 이미 낸 열쇠면 false.
	 * @example <caption>효과 밖의 일도 같은 사건 열쇠로 한 번만</caption>
	 * import { ToonVfx } from "./vanilla.js";
	 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
	 * let playCount = 0;
	 * for (let frameIndex = 0; frameIndex < 3; ++frameIndex) {
	 * 	if (vfx.registerEventKey("door-7-open")) {
	 * 		playCount += 1;
	 * 	}
	 * }
	 * vfx.clear();
	 * const isNewAfterClear = vfx.registerEventKey("door-7-open");
	 */
	registerEventKey(key) {
		if (key === undefined || key === null) {
			return true;
		}
		const usedEventKeys = this.#usedEventKeys;
		if (usedEventKeys.has(key)) {
			return false;
		}
		usedEventKeys.add(key);
		return true;
	}

	//==============================================================================
	// 효과 테의 색 설정. ([r, g, b] 0 ~ 1, 테를 두른 파티클과 번짐 리본의 가장자리, 기본은 ToonRenderer 의 기본 바깥선 색)
	//==============================================================================
	/**
	 * @param { Array<number> } rimColor - 테의 색. ([r, g, b] 0 ~ 1)
	 * @example <caption>밝은 바탕에서도 보이게 테를 두른 빛 알갱이와 불덩이</caption>
	 * import { ToonVfx, ToonVfxLook } from "./vanilla.js";
	 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
	 * vfx.setRimColor([0.12, 0.06, 0.03]);
	 * vfx.emitParticles({ count: 12, position: [0, 1, 0], look: ToonVfxLook.soft, color: [1, 0.8, 0.3], rim: 1, size: 0.3, speed: 1.5, life: 0.6 });
	 * vfx.addFireball({ position: [0, 1, 0], radius: 0.8, life: 1, rim: 0.7 });
	 */
	setRimColor(rimColor) {
		this.#rimColor = [rimColor[0], rimColor[1], rimColor[2]];
	}

	//==============================================================================
	// 효과 테의 색 반환.
	//==============================================================================
	/**
	 * @returns { Array<number> } 효과 테의 색. ([r, g, b] 0 ~ 1)
	 */
	getRimColor() {
		return this.#rimColor;
	}

	//==============================================================================
	// 바닥 높이를 읽는 함수 설정. ((x, z) → 높이, null 이면 0)
	//==============================================================================
	/**
	 * @param { function | null } floorHeightReader - (x, z) 로 바닥 높이를 돌려주는 함수. (null 이면 늘 0)
	 * @example <caption>울퉁불퉁한 바닥 높이를 알려 주기</caption>
	 * import { ToonVfx, ToonVfxLook } from "./vanilla.js";
	 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
	 * vfx.setFloorHeightReader((x, z) => {
	 * 	return Math.sin(x * 0.5) * 0.3 + Math.cos(z * 0.5) * 0.2;
	 * });
	 * vfx.addDecal({ x: 1, z: 2, radius: 1, life: 4 });
	 * vfx.emitParticles({ count: 16, position: [1, 1, 2], isGrounded: true, gravity: 9, speed: [1, 2], look: ToonVfxLook.grit, color: [0.4, 0.3, 0.2] });
	 * const floorHeight = vfx.readFloorHeight(1, 2);
	 * vfx.setFloorHeightReader(null);
	 */
	setFloorHeightReader(floorHeightReader) {
		this.#floorHeightReader = floorHeightReader !== null ? floorHeightReader : () => {
			return 0;
		};
	}

	//==============================================================================
	// 그 자리의 바닥 높이.
	//==============================================================================
	/**
	 * @param { number } x - 장면의 x.
	 * @param { number } z - 장면의 z.
	 * @returns { number } 그 자리의 바닥 높이.
	 */
	readFloorHeight(x, z) {
		const floorHeightReader = this.#floorHeightReader;
		return floorHeightReader(x, z);
	}

	//==============================================================================
	// 이 바탕의 시계. (초)
	//==============================================================================
	/**
	 * @returns { number } 이 바탕의 시계. (초, update 로 나아감)
	 */
	getTime() {
		return this.#time;
	}

	//==============================================================================
	// 떠 있는 효과의 수. ({ particleCount (아직 살아 있을 수 있는 칸), fireballCount, shockwaveCount, decalCount, plumeCount, lightningCount, flashCount })
	//==============================================================================
	/**
	 * @returns { object } { particleCount, fireballCount, shockwaveCount, decalCount, plumeCount, lightningCount, flashCount }.
	 * @example <caption>효과가 다 사라졌는지 보기</caption>
	 * import { ToonVfx } from "./vanilla.js";
	 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
	 * vfx.addFireball({ position: [0, 1, 0], radius: 1, life: 0.5 });
	 * vfx.emitParticles({ count: 10, position: [0, 1, 0], life: 0.3 });
	 * vfx.update(1);
	 * const counts = vfx.getActiveCounts();
	 * const isQuiet = counts.particleCount === 0 && counts.fireballCount === 0;
	 */
	getActiveCounts() {
		const isParticleLive = this.#time < this.#particleLiveUntil;
		return { particleCount: isParticleLive ? this.#particleUsedCount : 0, fireballCount: this.#fireballs.length, shockwaveCount: this.#bands.length, decalCount: this.#decals.length, plumeCount: this.#plumes.length, lightningCount: this.#lightnings.length, flashCount: this.#flashes.length };
	}

	//==============================================================================
	// 다 지우기. (판이 바뀔 때, 사건 열쇠도 잊는다)
	//==============================================================================
	clear() {
		this.#fireballs = [];
		this.#bands = [];
		this.#decals = [];
		this.#plumes = [];
		this.#lightnings = [];
		this.#flashes = [];
		this.#shaker.stop();
		this.#particleLiveUntil = this.#time;
		this.#usedEventKeys.clear();
		this.clearQueue();
	}

	//==============================================================================
	// 이번 프레임에 넘긴 것 비우기. (그린 뒤)
	//==============================================================================
	clearQueue() {
		this.#queuedDecals = [];
		this.#queuedBeams = [];
		this.#queuedRibbons = [];
		this.#queuedGlintCount = 0;
	}

	//==============================================================================
	// 한 프레임 나이 먹이기. (시계를 나아가게 하고 다 된 불덩이, 띠, 자국, 기둥, 번개, 섬광을 지움, 흔들림을 잦아들게 함)
	//==============================================================================
	/**
	 * @param { number } deltaTime 초.
	 */
	update(deltaTime) {
		this.#time += deltaTime;
		for (const effects of [this.#fireballs, this.#bands, this.#decals, this.#plumes, this.#lightnings, this.#flashes]) {
			for (let effectIndex = effects.length - 1; effectIndex >= 0; --effectIndex) {
				const effect = effects[effectIndex];
				effect.age += deltaTime;
				if (effect.age >= effect.life) {
					effects.splice(effectIndex, 1);
				}
			}
		}
		this.#shaker.tick(deltaTime);
	}

	//==============================================================================
	// 낼 파티클 수. (몫을 곱하고, 내면 하나 이상)
	//==============================================================================
	/**
	 * @param { number } count - 처방의 파티클 수.
	 * @returns { number } 몫을 곱한 수. (count 가 0 보다 크면 1 이상)
	 * @private
	 */
	readCount(count) {
		if (count <= 0) {
			return 0;
		}
		if (this.#countRatio >= 1) {
			return count;
		}
		return System.Math.max(1, System.Math.round(count * this.#countRatio));
	}

	//==============================================================================
	// 파티클 내기.
	//   options: { count, position([x, y, z], 기본 [0, 0, 0]), shape(ToonVfxShape), radius, direction, spread(라디안), length, isUpward, isInward,
	//              speed, rise, gravity, drag, size, sizeEnd(시작 크기에 곱함), sizeCurve, life, delay,
	//              color, ramp, look(ToonVfxLook), stretch, spin, floor, isGrounded, brightness, alpha, fadeIn, rim(빛의 꼴의 테, 0 이면 더하는 빛만, 1 이면 테로 덮음, 음수면 엷게 덮는 빛무리),
	//              age(이미 지난 초, 음수면 그만큼 늦게), key(사건 열쇠, 이미 낸 열쇠면 내지 않음) }
	//   범위가 되는 값(speed, rise, size, sizeEnd, life, delay, spin)은 수 하나나 [최소, 최대] 다. 색은 0 ~ 1 의 [r, g, b], 램프는 줄 번호(없으면 -1)다.
	//   floor 를 주면 그 높이에서, isGrounded 면 낸 자리의 바닥 높이에서 멈춘다. isInward 면 속도를 무시하고 나이가 다할 때 낸 자리로 빨려 든다.
	//==============================================================================
	/**
	 * @param { object } options - 내는 값. (꼴은 위 머리 주석의 options)
	 * @example <caption>원뿔로 튀는 불꽃 줄기, 같은 열쇠로 다시 내면 무시</caption>
	 * import { ToonVfx, ToonVfxLook, ToonVfxShape } from "./vanilla.js";
	 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
	 * const sparkOptions = {
	 * 	count: 30, position: [0, 1, 0],
	 * 	shape: ToonVfxShape.cone, direction: [0, 1, 0], spread: 0.4,
	 * 	speed: [3, 6], gravity: 9, drag: 1.5, size: [0.04, 0.08], sizeEnd: 0.3,
	 * 	life: [0.5, 1], look: ToonVfxLook.streak, stretch: 0.04, color: [1, 0.7, 0.3],
	 * 	isGrounded: true, age: 0.1, key: "spark-12",
	 * };
	 * vfx.emitParticles(sparkOptions);
	 * vfx.emitParticles(sparkOptions);
	 */
	emitParticles(options) {
		if (!this.registerEventKey(options.key)) {
			return;
		}
		const age = options.age !== undefined ? options.age : 0;
		const position = options.position !== undefined ? options.position : [0, 0, 0];
		const seededRandom = this.#seededRandom;
		const random = () => {
			return seededRandom.nextValue();
		};
		const count = this.readCount(options.count);
		const shape = options.shape !== undefined ? options.shape : ToonVfxShape.point;
		const radius = options.radius !== undefined ? options.radius : 0;
		const color = options.color !== undefined ? options.color : [1, 1, 1];
		const ramp = options.ramp !== undefined ? options.ramp : -1;
		const look = options.look !== undefined ? options.look : ToonVfxLook.soft;
		let floor = options.floor !== undefined ? options.floor : NO_FLOOR;
		if (options.floor === undefined && options.isGrounded === true) {
			floor = this.readFloorHeight(position[0], position[2]);
		}
		const direction = options.direction !== undefined ? options.direction : [0, 1, 0];
		const spread = options.spread !== undefined ? options.spread : System.Math.PI;
		const directionLength = System.Math.max(0.0001, System.Math.hypot(direction[0], direction[1], direction[2]));
		const axisX = direction[0] / directionLength;
		const axisY = direction[1] / directionLength;
		const axisZ = direction[2] / directionLength;
		const sides = readAxisSides(direction);
		for (let particleIndex = 0; particleIndex < count; ++particleIndex) {
			let offsetX = 0;
			let offsetY = 0;
			let offsetZ = 0;
			let headingX = 0;
			let headingY = 1;
			let headingZ = 0;
			switch (shape) {
				case ToonVfxShape.ring: {
					const angle = (particleIndex + random() * 0.8) / count * System.Math.PI * 2;
					offsetX = System.Math.cos(angle) * radius;
					offsetZ = System.Math.sin(angle) * radius;
					headingX = System.Math.cos(angle);
					headingY = 0;
					headingZ = System.Math.sin(angle);
					break;
				}
				case ToonVfxShape.disc: {
					const angle = random() * System.Math.PI * 2;
					const reach = System.Math.sqrt(random()) * radius;
					offsetX = System.Math.cos(angle) * reach;
					offsetZ = System.Math.sin(angle) * reach;
					headingX = System.Math.cos(angle);
					headingY = 0;
					headingZ = System.Math.sin(angle);
					break;
				}
				case ToonVfxShape.cone: {
					// 고른 쪽을 가운데로 spread 안의 원뿔. (쪽에 수직인 두 축으로 기울임)
					const tilt = random() * spread;
					const turn = random() * System.Math.PI * 2;
					const tiltSine = System.Math.sin(tilt);
					const tiltCosine = System.Math.cos(tilt);
					const turnCosine = System.Math.cos(turn);
					const turnSine = System.Math.sin(turn);
					headingX = axisX * tiltCosine + (sides[0][0] * turnCosine + sides[1][0] * turnSine) * tiltSine;
					headingY = axisY * tiltCosine + (sides[0][1] * turnCosine + sides[1][1] * turnSine) * tiltSine;
					headingZ = axisZ * tiltCosine + (sides[0][2] * turnCosine + sides[1][2] * turnSine) * tiltSine;
					const reach = System.Math.sqrt(random()) * radius;
					offsetX = (sides[0][0] * turnCosine + sides[1][0] * turnSine) * reach;
					offsetY = (sides[0][1] * turnCosine + sides[1][1] * turnSine) * reach;
					offsetZ = (sides[0][2] * turnCosine + sides[1][2] * turnSine) * reach;
					break;
				}
				case ToonVfxShape.line: {
					const along = random() * (options.length !== undefined ? options.length : 1);
					const turn = random() * System.Math.PI * 2;
					const reach = System.Math.sqrt(random()) * radius;
					headingX = axisX;
					headingY = axisY;
					headingZ = axisZ;
					offsetX = axisX * along + (sides[0][0] * System.Math.cos(turn) + sides[1][0] * System.Math.sin(turn)) * reach;
					offsetY = axisY * along + (sides[0][1] * System.Math.cos(turn) + sides[1][1] * System.Math.sin(turn)) * reach;
					offsetZ = axisZ * along + (sides[0][2] * System.Math.cos(turn) + sides[1][2] * System.Math.sin(turn)) * reach;
					break;
				}
				default: {
					// 공 안의 고른 쪽. (point 는 반지름 0)
					const heightRatio = random() * 2 - 1;
					const angle = random() * System.Math.PI * 2;
					const ringRatio = System.Math.sqrt(1 - heightRatio * heightRatio);
					headingX = System.Math.cos(angle) * ringRatio;
					headingY = heightRatio;
					headingZ = System.Math.sin(angle) * ringRatio;
					const reach = System.Math.cbrt(random()) * radius;
					offsetX = headingX * reach;
					offsetY = headingY * reach;
					offsetZ = headingZ * reach;
					break;
				}
			}
			if (options.isUpward === true && headingY < 0) {
				headingY = -headingY;
				offsetY = System.Math.abs(offsetY);
			}
			const speed = readRangeValue(options.speed !== undefined ? options.speed : 1, seededRandom);
			const rise = readRangeValue(options.rise !== undefined ? options.rise : 0, seededRandom);
			const size = readRangeValue(options.size !== undefined ? options.size : 0.2, seededRandom);
			const sizeEnd = size * readRangeValue(options.sizeEnd !== undefined ? options.sizeEnd : 1, seededRandom);
			const life = System.Math.max(0.001, readRangeValue(options.life !== undefined ? options.life : 1, seededRandom));
			const delay = readRangeValue(options.delay !== undefined ? options.delay : 0, seededRandom);
			const spin = readRangeValue(options.spin !== undefined ? options.spin : 0, seededRandom);
			let velocityX = headingX * speed;
			let velocityY = headingY * speed + rise;
			let velocityZ = headingZ * speed;
			if (options.isInward === true) {
				velocityX = -offsetX / life;
				velocityY = -offsetY / life;
				velocityZ = -offsetZ / life;
			}
			this.writeParticle(
				[position[0] + offsetX, position[1] + offsetY, position[2] + offsetZ, this.#time + delay - age],
				[velocityX, velocityY, velocityZ, life],
				[options.gravity !== undefined ? options.gravity : 0, options.drag !== undefined ? options.drag : 0, size, sizeEnd],
				[color[0], color[1], color[2], ramp],
				[look, options.stretch !== undefined ? options.stretch : 0, spin, floor],
				[options.brightness !== undefined ? options.brightness : 1, options.alpha !== undefined ? options.alpha : 1, random(), options.fadeIn !== undefined ? options.fadeIn : 0],
				[options.sizeCurve !== undefined ? options.sizeCurve : 1, options.rim !== undefined ? options.rim : 0, 0, 0],
			);
		}
	}

	//==============================================================================
	// 파티클 하나를 다음 칸에 쓰기. (가득 차면 가장 오래 전에 쓴 칸을 덮음)
	//==============================================================================
	/**
	 * @param { Array<number> } start [x, y, z, 낸 시각]
	 * @param { Array<number> } velocity [x, y, z, 초]
	 * @param { Array<number> } motion [중력, 끌림, 시작 크기, 끝 크기]
	 * @param { Array<number> } color [r, g, b, 램프]
	 * @param { Array<number> } look [꼴, 늘임, 돎, 바닥]
	 * @param { Array<number> } extra [밝기, 알파, 씨앗, 나타나는 몫]
	 * @param { Array<number> } shape [크기 곡선, 테, 비움, 비움]
	 * @private
	 */
	writeParticle(start, velocity, motion, color, look, extra, shape) {
		const particleData = this.#particleData;
		let offset = this.#particleWriteIndex * PARTICLE_FLOAT_COUNT;
		for (const values of [start, velocity, motion, color, look, extra, shape]) {
			particleData[offset] = values[0];
			particleData[offset + 1] = values[1];
			particleData[offset + 2] = values[2];
			particleData[offset + 3] = values[3];
			offset += 4;
		}
		this.#particleWriteIndex = (this.#particleWriteIndex + 1) % this.#particleCapacity;
		this.#particleUsedCount = System.Math.min(this.#particleCapacity, this.#particleUsedCount + 1);
		this.#particleLiveUntil = System.Math.max(this.#particleLiveUntil, start[3] + velocity[3]);
		this.#isParticleDirty = true;
	}

	//==============================================================================
	// 불덩이 더하기. (잡음으로 끓는 구가 부풀며 식어 연기가 되고 위로 떠오름)
	//   options: { position([x, y, z], 기본 [0, 0, 0]), radius, life, ramp, smokeColor, rise, growSeconds, boil, rim(덮는 꼴의 몫, 0 이면 더하는 빛만), age, key }
	//==============================================================================
	/**
	 * @param { object } options - 불덩이 값. (꼴은 위 머리 주석의 options)
	 * @example <caption>부풀어 식으며 떠오르는 불덩이</caption>
	 * import { ToonVfx } from "./vanilla.js";
	 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
	 * vfx.setRamps([["#ffffff", "#ffe080", "#ff8020", "#801808", "#200804"]]);
	 * vfx.addFireball({ position: [0, 1, 0], radius: 1.2, life: 1.5, ramp: 0, rise: 1, growSeconds: 0.25, boil: 0.4, smokeColor: [0.2, 0.18, 0.16], key: "barrel-3" });
	 */
	addFireball(options) {
		const age = options.age !== undefined ? options.age : 0;
		if (!this.registerEventKey(options.key) || (age > 0 && age >= options.life)) {
			return;
		}
		const position = options.position !== undefined ? options.position : [0, 0, 0];
		this.#fireballs.push({
			x: position[0],
			y: position[1],
			z: position[2],
			radius: options.radius,
			life: options.life,
			ramp: options.ramp !== undefined ? options.ramp : 0,
			smokeColor: options.smokeColor !== undefined ? options.smokeColor : [0.16, 0.14, 0.13],
			rise: options.rise !== undefined ? options.rise : 0.6,
			growSeconds: System.Math.max(0.001, options.growSeconds !== undefined ? options.growSeconds : 0.3),
			boil: options.boil !== undefined ? options.boil : 0.32,
			rim: options.rim !== undefined ? options.rim : 0,
			seed: this.#seededRandom.nextValue() * 40,
			age: age,
		});
	}

	//==============================================================================
	// 충격파 띠 더하기. (빠르게 퍼지다 천천히, 바깥 끝이 말려 오르고 잡음으로 찢기며 엷어짐, 밑의 바닥이 잠깐 밝아짐, 바닥 높이에 놓임)
	//   options: { x, z, startRadius, endRadius, width, life, ramp, color, lift(말려 오르는 높이), height(바닥 위 띄움), delay, rim(덮는 꼴의 몫, 0 이면 더하는 빛만), age, key }
	//==============================================================================
	/**
	 * @param { object } options - 충격파 값. (꼴은 위 머리 주석의 options)
	 * @example <caption>조금 늦게 퍼지며 말려 오르는 충격파 띠</caption>
	 * import { ToonVfx } from "./vanilla.js";
	 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
	 * vfx.addShockwave({ x: 0, z: 0, startRadius: 0.2, endRadius: 4, width: 0.8, life: 0.7, ramp: 0, color: [1, 0.9, 0.7], lift: 0.4, delay: 0.05, rim: 0.5 });
	 */
	addShockwave(options) {
		const delay = options.delay !== undefined ? options.delay : 0;
		const age = options.age !== undefined ? options.age : 0;
		if (!this.registerEventKey(options.key) || (age > 0 && age >= options.life + delay)) {
			return;
		}
		this.#bands.push({
			x: options.x,
			z: options.z,
			floorHeight: this.readFloorHeight(options.x, options.z),
			startRadius: options.startRadius !== undefined ? options.startRadius : 0.3,
			endRadius: options.endRadius,
			width: options.width !== undefined ? options.width : 0.6,
			life: options.life + delay,
			delay: delay,
			ramp: options.ramp !== undefined ? options.ramp : 0,
			color: options.color !== undefined ? options.color : [1, 1, 1],
			lift: options.lift !== undefined ? options.lift : 0.22,
			height: options.height !== undefined ? options.height : 0.03,
			rim: options.rim !== undefined ? options.rim : 0,
			seed: this.#seededRandom.nextValue() * 40,
			age: age,
		});
	}

	//==============================================================================
	// 바닥 자국 더하기. (그을음은 열기에서 식고 끝 1 초에 엷어짐, startRadius 에서 growSeconds 동안 radius 로 퍼질 수 있음, 바닥 높이에 놓임)
	//   options: { x, z, radius, startRadius, growSeconds, life, heatSeconds, slot(ToonVfxSlot), mode(ToonVfxDecalMode), ramp, tint, alpha, angle, ring, flicker(깜빡이는 반주기 초, 0 이면 없음), age, key }
	//==============================================================================
	/**
	 * @param { object } options - 자국 값. (꼴은 위 머리 주석의 options, life 를 주지 않으면 바로 사라짐)
	 * @example <caption>퍼지며 식는 그을음과 깜빡이는 얼룩</caption>
	 * import { ToonVfx, ToonVfxSlot, ToonVfxDecalMode } from "./vanilla.js";
	 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
	 * vfx.addDecal({ x: 0, z: 0, radius: 1.5, startRadius: 0.4, growSeconds: 0.3, life: 10, heatSeconds: 2, slot: ToonVfxSlot.scorch, mode: ToonVfxDecalMode.scorch, ramp: 0 });
	 * vfx.addDecal({ x: 3, z: 0, radius: 0.8, life: 6, mode: ToonVfxDecalMode.stain, tint: [0.2, 0.45, 0.1], alpha: 0.7, flicker: 0.25 });
	 */
	addDecal(options) {
		const age = options.age !== undefined ? options.age : 0;
		const life = options.life !== undefined ? options.life : 0;
		if (!this.registerEventKey(options.key) || (age > 0 && age >= life)) {
			return;
		}
		const seededRandom = this.#seededRandom;
		const decal = this.createDecal(options, seededRandom.nextValue() * System.Math.PI * 2, seededRandom.nextValue() * 40);
		decal.age = age;
		this.#decals.push(decal);
	}

	//==============================================================================
	// 이번 프레임에만 그리는 발밑 그늘 넘기기. (가운데 alpha 에서 바깥으로 둥글게 엷어지는 그늘, 바닥 높이에 놓임)
	//   options: { x, z, radius, alpha(기본 0.45) }
	//==============================================================================
	/**
	 * @param { object } options - 그늘 값. (꼴은 위 머리 주석의 options)
	 * @example <caption>캐릭터마다 발밑 그늘을 매 프레임 넘기기</caption>
	 * import { ToonVfx, Matrix4, Vector3 } from "./vanilla.js";
	 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
	 * const viewMatrix = Matrix4.createLookAt(Vector3.create(0, 4, 6), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
	 * const projectionMatrix = Matrix4.createPerspective(Math.PI / 4, 1, 0.1, 100);
	 * const characterPositions = [[0, 0], [1.5, -0.5], [-1, 1]];
	 * for (const position of characterPositions) {
	 * 	vfx.queueBlobShadow({ x: position[0], z: position[1], radius: 0.5 });
	 * }
	 * vfx.draw(viewMatrix, projectionMatrix);
	 */
	queueBlobShadow(options) {
		this.queueDecal({ x: options.x, z: options.z, radius: options.radius, mode: ToonVfxDecalMode.shade, alpha: options.alpha !== undefined ? options.alpha : DEFAULT_BLOB_SHADOW_ALPHA });
	}

	//==============================================================================
	// 이번 프레임에만 그리는 바닥 자국 넘기기. (꼴이 프레임마다 정해지는 것, addDecal 과 같고 나이 대신 heat(0 ~ 1)를 바로 준다, 돎과 씨앗은 주지 않으면 0)
	//==============================================================================
	/**
	 * @param { object } options - 자국 값. (addDecal 의 값에 heat(0 ~ 1)와 seed)
	 * @example <caption>고른 자리에 흐르는 테와 빛 자국을 매 프레임 넘기기</caption>
	 * import { ToonVfx, ToonVfxSlot, ToonVfxDecalMode } from "./vanilla.js";
	 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
	 * vfx.queueDecal({ x: 0, z: 0, radius: 1.2, mode: ToonVfxDecalMode.ring, tint: [0.4, 0.9, 1], heat: 1, alpha: 1, ring: [0.8, 0.06, 3, 0.6], seed: 4 });
	 * vfx.queueDecal({ x: 2, z: 0, radius: 0.9, slot: ToonVfxSlot.glow, mode: ToonVfxDecalMode.glow, tint: [1, 0.6, 0.2], heat: 0.8, alpha: 0.9, angle: 0.5 });
	 */
	queueDecal(options) {
		const decal = this.createDecal(options, 0, options.seed !== undefined ? options.seed : 0);
		decal.heat = options.heat !== undefined ? options.heat : 0;
		this.#queuedDecals.push(decal);
	}

	//==============================================================================
	// 바닥 자국 값 짓기. (addDecal, queueDecal 이 함께 씀)
	//==============================================================================
	/**
	 * @param { object } options - addDecal, queueDecal 이 받은 값.
	 * @param { number } defaultAngle - angle 을 주지 않았을 때의 돎. (라디안)
	 * @param { number } seed - 잡음 씨앗.
	 * @returns { object } 그릴 자국 값. (heat 와 age 는 0)
	 * @private
	 */
	createDecal(options, defaultAngle, seed) {
		return {
			x: options.x,
			z: options.z,
			floorHeight: this.readFloorHeight(options.x, options.z),
			radius: options.radius,
			startRadius: options.startRadius !== undefined ? options.startRadius : options.radius,
			growSeconds: options.growSeconds !== undefined ? options.growSeconds : 0,
			life: options.life !== undefined ? options.life : 0,
			heatSeconds: options.heatSeconds !== undefined ? options.heatSeconds : 0,
			slot: options.slot !== undefined ? options.slot : ToonVfxSlot.scorch,
			mode: options.mode !== undefined ? options.mode : ToonVfxDecalMode.scorch,
			ramp: options.ramp !== undefined ? options.ramp : 0,
			tint: options.tint !== undefined ? options.tint : [1, 1, 1],
			alpha: options.alpha !== undefined ? options.alpha : 0.85,
			angle: options.angle !== undefined ? options.angle : defaultAngle,
			ring: options.ring !== undefined ? options.ring : [0.9, 0.05, 3, 0.3],
			flicker: options.flicker !== undefined ? options.flicker : 0,
			seed: seed,
			heat: 0,
			age: 0,
		};
	}

	//==============================================================================
	// 연기 기둥 더하기. (기둥이 솟고 갓이 말려 오르며 커지고, 갓 밑이 달아올랐다 식으며 엷어짐, 바닥 높이에 섬)
	//   options: { x, z, height, capRadius, stemRadius, life, ramp, smokeColor, age, key }
	//==============================================================================
	/**
	 * @param { object } options - 연기 기둥 값. (꼴은 위 머리 주석의 options)
	 * @example <caption>큰 폭발 뒤에 솟는 연기 기둥</caption>
	 * import { ToonVfx } from "./vanilla.js";
	 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
	 * vfx.addPlume({ x: 0, z: 0, height: 4, capRadius: 1.6, stemRadius: 0.35, life: 5, ramp: 0, smokeColor: [0.3, 0.28, 0.26], key: "blast-9-plume" });
	 */
	addPlume(options) {
		const age = options.age !== undefined ? options.age : 0;
		if (!this.registerEventKey(options.key) || (age > 0 && age >= options.life)) {
			return;
		}
		this.#plumes.push({
			x: options.x,
			z: options.z,
			floorHeight: this.readFloorHeight(options.x, options.z),
			height: options.height,
			capRadius: options.capRadius !== undefined ? options.capRadius : options.height * 0.4,
			stemRadius: options.stemRadius !== undefined ? options.stemRadius : options.height * 0.1,
			life: options.life,
			ramp: options.ramp !== undefined ? options.ramp : 0,
			smokeColor: options.smokeColor !== undefined ? options.smokeColor : [0.34, 0.31, 0.29],
			seed: this.#seededRandom.nextValue() * 40,
			age: age,
		});
	}

	//==============================================================================
	// 이번 프레임에만 그리는 회전체 빔 넘기기.
	//   options: { start, end([x, y, z], 결은 start 에서 end 쪽으로 흐름), radius, isCore(심이면 흰빛, 아니면 램프의 겉집), alpha(기본 1), brightness, ramp, wobble, flowSpeed, grainRepeat(길이 한 칸마다의 결), time, seed }
	//==============================================================================
	/**
	 * @param { object } options - 빔 값. (꼴은 위 머리 주석의 options, radius 와 alpha 가 0 보다 커야 넘어감)
	 * @example <caption>흰 심과 램프 겉집 두 겹의 빔</caption>
	 * import { ToonVfx, Matrix4, Vector3 } from "./vanilla.js";
	 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
	 * const viewMatrix = Matrix4.createLookAt(Vector3.create(4, 3, 4), Vector3.create(0, 1, -4), Vector3.create(0, 1, 0));
	 * const projectionMatrix = Matrix4.createPerspective(Math.PI / 4, 1, 0.1, 100);
	 * const start = [0, 1, 0];
	 * const end = [0, 1, -8];
	 * vfx.queueBeam({ start: start, end: end, radius: 0.12, isCore: true, alpha: 1, brightness: 1.5 });
	 * vfx.queueBeam({ start: start, end: end, radius: 0.3, alpha: 0.8, ramp: 0, wobble: 0.15, flowSpeed: 6, grainRepeat: 0.6, seed: 2 });
	 * vfx.draw(viewMatrix, projectionMatrix);
	 */
	queueBeam(options) {
		const beam = options.alpha !== undefined ? options : System.Object.assign({}, options, { alpha: 1 });
		if (!(beam.radius > 0) || !(beam.alpha > 0)) {
			return;
		}
		this.#queuedBeams.push(beam);
	}

	//==============================================================================
	// 이번 프레임에만 그리는 리본 넘기기. (점열을 카메라 쪽으로 편 띠)
	//   options: { points([[x, y, z], ...], 둘 이상), width, taper(0 이면 고른 너비, 1 이면 두 끝이 0), color, ramp, alpha(기본 1), brightness, grainRepeat, flow,
	//              glow(번짐 색 [r, g, b], 주면 흰 심과 그 색 둘레와 테 색 가장자리로 덮는다, 없으면 더하는 빛), rim(glow 가 없을 때 몸을 테 색으로 덮고 심은 색인 꼴의 몫, 0 이면 더하는 빛만) }
	//==============================================================================
	/**
	 * @param { object } options - 리본 값. (꼴은 위 머리 주석의 options, 점이 둘 이상이고 width 와 alpha(주지 않으면 1) 가 0 보다 커야 넘어감)
	 * @example <caption>휘두른 자취를 번짐 리본과 더하는 빛 리본으로</caption>
	 * import { ToonVfx } from "./vanilla.js";
	 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
	 * const trailPoints = [[-1, 1, 0], [-0.5, 1.3, -0.4], [0, 1.4, -0.6], [0.5, 1.3, -0.4], [1, 1, 0]];
	 * vfx.queueRibbon({ points: trailPoints, width: 0.25, taper: 1, alpha: 1, brightness: 1.2, glow: [0.4, 0.8, 1] });
	 * vfx.queueRibbon({ points: trailPoints, width: 0.1, color: [1, 0.9, 0.6], alpha: 0.8, grainRepeat: 2, flow: vfx.getTime() * 4 });
	 */
	queueRibbon(options) {
		const ribbon = options.alpha !== undefined ? options : System.Object.assign({}, options, { alpha: 1 });
		if (ribbon.points.length < 2 || !(ribbon.width > 0) || !(ribbon.alpha > 0)) {
			return;
		}
		this.#queuedRibbons.push(ribbon);
	}

	//==============================================================================
	// 이번 프레임의 번개 넘기기. (축을 감아 내려가는 리본 여럿, 0.08 초마다 다시 꺾임, 같은 시각과 씨앗이면 같은 꼴)
	//   options: { start, end, radius(감는 반지름), count, width, turns(감는 바퀴), color, ramp, alpha, brightness, time(주지 않으면 이 바탕의 시계), seed, glow(리본의 번짐 색), rim(리본의 rim) }
	//==============================================================================
	/**
	 * @param { object } options - 번개 값. (꼴은 위 머리 주석의 options, radius 와 width 는 꼭 준다)
	 * @example <caption>하늘에서 내리치는 번개 셋을 이번 프레임에</caption>
	 * import { ToonVfx } from "./vanilla.js";
	 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
	 * vfx.queueLightning({ start: [0, 4, 0], end: [0, 0, 0], radius: 0.15, count: 3, width: 0.06, turns: 1.5, color: [0.8, 0.9, 1], alpha: 1, brightness: 1.5, seed: 7 });
	 */
	queueLightning(options) {
		const start = options.start;
		const time = options.time !== undefined ? options.time : this.#time;
		const seed = options.seed !== undefined ? options.seed : 0;
		const count = options.count !== undefined ? options.count : 1;
		const turns = options.turns !== undefined ? options.turns : 1;
		const axis = [options.end[0] - start[0], options.end[1] - start[1], options.end[2] - start[2]];
		const sides = readAxisSides(axis);
		const kinkStep = System.Math.floor(time / LIGHTNING_KINK_SECONDS);
		const seededRandom = new SeededRandom(1);
		for (let boltIndex = 0; boltIndex < count; ++boltIndex) {
			seededRandom.setSeed((System.Math.floor(seed * 7919) + kinkStep * 131 + boltIndex * 977) >>> 0);
			const random = () => {
				return seededRandom.nextValue();
			};
			const phase = boltIndex / count * System.Math.PI * 2 + random() * 0.8;
			const boltTurns = turns * (0.8 + random() * 0.4) * (random() < 0.5 ? -1 : 1);
			const points = [];
			for (let pointIndex = 0; pointIndex < LIGHTNING_POINT_COUNT; ++pointIndex) {
				const along = pointIndex / (LIGHTNING_POINT_COUNT - 1);
				const angle = phase + along * boltTurns * System.Math.PI * 2 + (random() - 0.5) * 0.5;
				const reach = options.radius * (0.75 + random() * 0.5);
				const cosine = System.Math.cos(angle) * reach;
				const sine = System.Math.sin(angle) * reach;
				points.push([
					start[0] + axis[0] * along + sides[0][0] * cosine + sides[1][0] * sine,
					start[1] + axis[1] * along + sides[0][1] * cosine + sides[1][1] * sine,
					start[2] + axis[2] * along + sides[0][2] * cosine + sides[1][2] * sine,
				]);
			}
			this.queueRibbon({ points: points, width: options.width * (0.7 + random() * 0.6), taper: 0.6, color: options.color, ramp: options.ramp, alpha: options.alpha, brightness: options.brightness, grainRepeat: 1.5, flow: time * 6 + boltIndex, glow: options.glow, rim: options.rim });
		}
	}

	//==============================================================================
	// 이번 프레임에만 그리는 빛 점 넘기기. (파티클과 같은 꼴, 나이 없이 그 자리에 그대로, setGlintCapacity 까지(기본 96))
	//   options: { position([x, y, z], 기본 [0, 0, 0]), size(기본 0.2), color, ramp, look, brightness, alpha(기본 1), angle, rim(파티클의 rim 과 같음) }
	//==============================================================================
	/**
	 * @param { object } options - 빛 점 값. (꼴은 위 머리 주석의 options, size 는 꼭 준다)
	 * @example <caption>보석 위에 반짝이는 빛살을 매 프레임</caption>
	 * import { ToonVfx, ToonVfxLook } from "./vanilla.js";
	 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
	 * vfx.setGlintCapacity(32);
	 * const twinkle = 0.5 + 0.5 * Math.sin(vfx.getTime() * 6);
	 * vfx.queueGlint({ position: [0.5, 1.2, 0], size: 0.4 * twinkle, look: ToonVfxLook.star, color: [1, 0.95, 0.7], angle: 0.3, brightness: 1.5 });
	 */
	queueGlint(options) {
		if (this.#queuedGlintCount >= this.#glintCapacity) {
			return;
		}
		const position = options.position !== undefined ? options.position : [0, 0, 0];
		const size = options.size !== undefined ? options.size : 0.2;
		const color = options.color !== undefined ? options.color : [1, 1, 1];
		const angle = options.angle !== undefined ? options.angle : 0;
		const values = [
			[position[0], position[1], position[2], this.#time],
			[0, 0, 0, 1000000],
			[0, 0, size, size],
			[color[0], color[1], color[2], options.ramp !== undefined ? options.ramp : -1],
			[options.look !== undefined ? options.look : ToonVfxLook.soft, 0, 0, NO_FLOOR],
			[options.brightness !== undefined ? options.brightness : 1, options.alpha !== undefined ? options.alpha : 1, angle / (System.Math.PI * 2), 0],
			[1, options.rim !== undefined ? options.rim : 0, 0, 0],
		];
		const glintData = this.#glintData;
		let offset = this.#queuedGlintCount * PARTICLE_FLOAT_COUNT;
		for (const value of values) {
			glintData[offset] = value[0];
			glintData[offset + 1] = value[1];
			glintData[offset + 2] = value[2];
			glintData[offset + 3] = value[3];
			offset += 4;
		}
		this.#queuedGlintCount += 1;
	}

	//==============================================================================
	// 사는 동안 다시 꺾이는 번개 더하기. (그릴 때마다 queueLightning 으로 넘긴다, 끝 0.1 초에 엷어짐, age 가 음수면 그만큼 늦게 나타남)
	//   options: { start, end, life(초), age, radius, count, width, turns, color, ramp, alpha, brightness, seed(주지 않으면 무작위), glow, rim, key }
	//==============================================================================
	/**
	 * @param { object } options - 번개 값. (꼴은 위 머리 주석의 options)
	 * @example <caption>0.4 초 동안 다시 꺾이며 사는 번개</caption>
	 * import { ToonVfx, Matrix4, Vector3 } from "./vanilla.js";
	 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
	 * const viewMatrix = Matrix4.createLookAt(Vector3.create(0, 2, 6), Vector3.create(0, 2, 0), Vector3.create(0, 1, 0));
	 * const projectionMatrix = Matrix4.createPerspective(Math.PI / 4, 1, 0.1, 100);
	 * vfx.addLightning({ start: [0, 4, 0], end: [0.5, 0, 0.2], life: 0.4, count: 2, width: 0.08, radius: 0.2, glow: [0.5, 0.7, 1], key: "strike-5" });
	 * for (let frameIndex = 0; frameIndex < 3; ++frameIndex) {
	 * 	vfx.update(1 / 60);
	 * 	vfx.draw(viewMatrix, projectionMatrix);
	 * }
	 */
	addLightning(options) {
		if (!this.registerEventKey(options.key)) {
			return;
		}
		const lightning = System.Object.assign({ radius: 0.05, count: 1, width: 0.05, turns: 1, color: [1, 1, 1], ramp: -1, alpha: 1, brightness: 1, glow: null, rim: 0 }, options);
		lightning.life = options.life !== undefined ? options.life : 0.5;
		lightning.age = options.age !== undefined ? options.age : 0;
		lightning.seed = options.seed !== undefined ? options.seed : this.#seededRandom.nextValue() * 1000;
		this.#lightnings.push(lightning);
	}

	//==============================================================================
	// 화면 섬광 더하기. (뷰포트를 그 색으로 잠깐 덮고 빠르게 걷힘)
	//   options: { color([r, g, b], 기본 흰), strength(처음 덮는 몫, 기본 0.8), life(초, 기본 0.08), age, key }
	//==============================================================================
	/**
	 * @param { object } options - 섬광 값. (꼴은 위 머리 주석의 options)
	 * @example <caption>터질 때 화면을 잠깐 밝게 덮기</caption>
	 * import { ToonVfx } from "./vanilla.js";
	 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
	 * vfx.addFlash({ color: [1, 0.9, 0.7], strength: 0.6, life: 0.12, key: "blast-9-flash" });
	 */
	addFlash(options) {
		if (!this.registerEventKey(options.key)) {
			return;
		}
		this.#flashes.push({
			color: options.color !== undefined ? options.color : [1, 1, 1],
			strength: options.strength !== undefined ? options.strength : 0.8,
			life: options.life !== undefined ? options.life : 0.08,
			age: options.age !== undefined ? options.age : 0,
		});
	}

	//==============================================================================
	// 카메라 흔들림 더하기. (장면 길이의 최대 오프셋, 엔진 Shaker 가 위상이 다른 두 사인파와 지수 감쇠로 셈, 흔들리는 중이면 센 쪽)
	//==============================================================================
	/**
	 * @param { number } strength - 흔들림의 최대 오프셋. (장면 길이)
	 * @example <caption>흔들림을 카메라 오른쪽과 위쪽에 더하기</caption>
	 * import { ToonVfx, Matrix4, Vector3 } from "./vanilla.js";
	 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
	 * vfx.addShake(0.2);
	 * vfx.update(1 / 60);
	 * const shake = vfx.readShake();
	 * const eye = Vector3.create(shake.x, 1.5 + shake.y, 6);
	 * const target = Vector3.create(shake.x, 1.5 + shake.y, 0);
	 * const viewMatrix = Matrix4.createLookAt(eye, target, Vector3.create(0, 1, 0));
	 * const isStill = !vfx.isShaking();
	 */
	addShake(strength) {
		this.#shaker.addShake(strength * SHAKE_UNIT_SCALE);
	}

	//==============================================================================
	// 지금의 카메라 흔들림. (장면 길이, x 는 카메라 오른쪽, y 는 카메라 위쪽으로 카메라 자리와 보는 곳에 같이 더한다)
	//==============================================================================
	/**
	 * @returns { Vector2 } 흔들림 오프셋. (장면 길이, x 는 카메라 오른쪽, y 는 카메라 위쪽)
	 */
	readShake() {
		const offset = this.#shaker.getOffset();
		return Vector2.create(offset.x / SHAKE_UNIT_SCALE, offset.y / SHAKE_UNIT_SCALE);
	}

	//==============================================================================
	// 카메라가 흔들리는 중인지.
	//==============================================================================
	/**
	 * @returns { boolean } 흔들리는 중이면 true.
	 */
	isShaking() {
		return this.#shaker.isShaking();
	}

	//==============================================================================
	// 그리기. (바닥 자국, 띠, 연기 기둥, 불덩이, 빔, 리본, 파티클, 섬광 차례, 사는 번개는 이번 프레임의 리본으로 넘김, 넘긴 것은 그린 뒤 비움)
	//   보기 행렬에서 카메라 쪽, 오른쪽, 위쪽, 자리를 읽는다. 투영이 원근이면 빔과 리본은 카메라 자리를 향하고, 직교면 카메라 쪽을 향한다.
	//==============================================================================
	/**
	 * @param { Matrix4 } viewMatrix - 카메라의 보기 행렬.
	 * @param { Matrix4 } projectionMatrix - 투영 행렬. (원근이나 직교)
	 * @example <caption>직교 투영 장면에 효과 그리기</caption>
	 * import { ToonVfx, ToonVfxLook, Matrix4, Vector3 } from "./vanilla.js";
	 * const vfx = new ToonVfx(document.createElement("canvas").getContext("webgl2"));
	 * const viewMatrix = Matrix4.createLookAt(Vector3.create(5, 5, 5), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
	 * const projectionMatrix = Matrix4.createOrthographic(-4, 4, -4, 4, 0.1, 50);
	 * vfx.emitParticles({ count: 20, position: [0, 0.5, 0], look: ToonVfxLook.glow, color: [0.4, 0.8, 1], speed: 1, size: 0.4, life: 1 });
	 * vfx.queueBeam({ start: [-2, 0.5, 0], end: [2, 0.5, 0], radius: 0.1, isCore: true, alpha: 1 });
	 * vfx.update(0.1);
	 * vfx.draw(viewMatrix, projectionMatrix);
	 */
	draw(viewMatrix, projectionMatrix) {
		const isParticleLive = this.#particleUsedCount > 0 && this.#time < this.#particleLiveUntil;
		for (const lightning of this.#lightnings) {
			if (lightning.age < 0) {
				continue;
			}
			const fade = System.Math.min(1, (lightning.life - lightning.age) / LIGHTNING_FADE_SECONDS);
			this.queueLightning({ start: lightning.start, end: lightning.end, radius: lightning.radius, count: lightning.count, width: lightning.width, turns: lightning.turns, color: lightning.color, ramp: lightning.ramp, alpha: lightning.alpha * fade, brightness: lightning.brightness, time: this.#time, seed: lightning.seed, glow: lightning.glow, rim: lightning.rim });
		}
		const isQueued = this.#queuedDecals.length > 0 || this.#queuedBeams.length > 0 || this.#queuedRibbons.length > 0 || this.#queuedGlintCount > 0;
		if (this.#decals.length === 0 && this.#bands.length === 0 && this.#fireballs.length === 0 && this.#plumes.length === 0 && this.#flashes.length === 0 && !isParticleLive && !isQueued) {
			return;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const frame = this.readFrame(viewMatrix, projectionMatrix);
		const atlasTexture = this.readAtlasTexture();
		const savedState = {
			isBlendEnabled: webGL2RenderingContext.isEnabled(webGL2RenderingContext.BLEND),
			isDepthTestEnabled: webGL2RenderingContext.isEnabled(webGL2RenderingContext.DEPTH_TEST),
			isCullFaceEnabled: webGL2RenderingContext.isEnabled(webGL2RenderingContext.CULL_FACE),
			depthMask: webGL2RenderingContext.getParameter(webGL2RenderingContext.DEPTH_WRITEMASK),
			depthFunction: webGL2RenderingContext.getParameter(webGL2RenderingContext.DEPTH_FUNC),
			blendSourceRGB: webGL2RenderingContext.getParameter(webGL2RenderingContext.BLEND_SRC_RGB),
			blendDestinationRGB: webGL2RenderingContext.getParameter(webGL2RenderingContext.BLEND_DST_RGB),
			blendSourceAlpha: webGL2RenderingContext.getParameter(webGL2RenderingContext.BLEND_SRC_ALPHA),
			blendDestinationAlpha: webGL2RenderingContext.getParameter(webGL2RenderingContext.BLEND_DST_ALPHA),
			program: webGL2RenderingContext.getParameter(webGL2RenderingContext.CURRENT_PROGRAM),
			vertexArray: webGL2RenderingContext.getParameter(webGL2RenderingContext.VERTEX_ARRAY_BINDING),
		};
		webGL2RenderingContext.enable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.depthFunc(webGL2RenderingContext.LEQUAL);
		webGL2RenderingContext.depthMask(false);
		webGL2RenderingContext.disable(webGL2RenderingContext.CULL_FACE);
		webGL2RenderingContext.enable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.blendFunc(webGL2RenderingContext.ONE, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + VFX_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, atlasTexture);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		this.drawDecals(frame);
		this.drawBands(frame);
		this.drawPlumes(frame);
		this.drawFireballs(frame);
		this.drawBeams(frame);
		this.drawRibbons(frame);
		this.drawParticles(frame, isParticleLive);
		this.drawFlashes();
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + VFX_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		webGL2RenderingContext.bindVertexArray(savedState.vertexArray);
		webGL2RenderingContext.useProgram(savedState.program);
		webGL2RenderingContext.depthMask(savedState.depthMask);
		webGL2RenderingContext.depthFunc(savedState.depthFunction);
		webGL2RenderingContext.blendFuncSeparate(savedState.blendSourceRGB, savedState.blendDestinationRGB, savedState.blendSourceAlpha, savedState.blendDestinationAlpha);
		const capabilities = [
			[webGL2RenderingContext.BLEND, savedState.isBlendEnabled],
			[webGL2RenderingContext.DEPTH_TEST, savedState.isDepthTestEnabled],
			[webGL2RenderingContext.CULL_FACE, savedState.isCullFaceEnabled],
		];
		for (const capability of capabilities) {
			if (capability[1]) {
				webGL2RenderingContext.enable(capability[0]);
			}
			else {
				webGL2RenderingContext.disable(capability[0]);
			}
		}
		this.clearQueue();
	}

	//==============================================================================
	// 그리는 프레임의 카메라. ({ viewProjectionElements, viewDirection(장면에서 카메라 쪽), cameraRight, cameraUp, cameraPoint([자리, 1] 원근, [카메라 쪽, 0] 직교) })
	//==============================================================================
	/**
	 * @param { Matrix4 } viewMatrix - 카메라의 보기 행렬.
	 * @param { Matrix4 } projectionMatrix - 투영 행렬. (원근이나 직교)
	 * @returns { object } { viewProjectionElements, viewDirection, cameraRight, cameraUp, cameraPoint }.
	 */
	readFrame(viewMatrix, projectionMatrix) {
		const viewElements = viewMatrix.getElements();
		const projectionElements = projectionMatrix.getElements();
		const viewProjectionMatrix = projectionMatrix.clone();
		viewProjectionMatrix.multiply(viewMatrix);
		const viewDirection = [viewElements[2], viewElements[6], viewElements[10]];
		const isPerspective = System.Math.abs(projectionElements[11]) > 0.5;
		let cameraPoint = [viewDirection[0], viewDirection[1], viewDirection[2], 0];
		if (isPerspective) {
			const translationX = viewElements[12];
			const translationY = viewElements[13];
			const translationZ = viewElements[14];
			cameraPoint = [
				-(viewElements[0] * translationX + viewElements[1] * translationY + viewElements[2] * translationZ),
				-(viewElements[4] * translationX + viewElements[5] * translationY + viewElements[6] * translationZ),
				-(viewElements[8] * translationX + viewElements[9] * translationY + viewElements[10] * translationZ),
				1,
			];
		}
		return {
			viewProjectionElements: viewProjectionMatrix.getElements(),
			viewDirection: viewDirection,
			cameraRight: [viewElements[0], viewElements[4], viewElements[8]],
			cameraUp: [viewElements[1], viewElements[5], viewElements[9]],
			cameraPoint: cameraPoint,
		};
	}

	//==============================================================================
	// 프로그램을 쓰고 보기와 투영과 아틀라스 유니폼 올리기.
	//==============================================================================
	/**
	 * @param { ShaderProgram } shaderProgram - 쓸 효과 셰이더.
	 * @param { object } frame - readFrame 이 돌려준 그리는 프레임의 카메라.
	 */
	useProgram(shaderProgram, frame) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		shaderProgram.useProgram();
		webGL2RenderingContext.uniformMatrix4fv(shaderProgram.getUniformLocation("viewProjectionMatrix"), false, frame.viewProjectionElements);
		webGL2RenderingContext.uniform1i(shaderProgram.getUniformLocation("vfxAtlas"), VFX_TEXTURE_UNIT);
	}

	//==============================================================================
	// 바닥 자국 그리기. (나이 먹는 자국, 이번 프레임에 넘긴 자국 차례, 아직 나타나지 않은 것은 건너뜀, 깜빡이면 걸러 엷게)
	//==============================================================================
	/**
	 * @param { object } frame - readFrame 이 돌려준 그리는 프레임의 카메라.
	 * @private
	 */
	drawDecals(frame) {
		if (this.#decals.length === 0 && this.#queuedDecals.length === 0) {
			return;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const decalProgram = this.#decalProgram;
		this.useProgram(decalProgram, frame);
		webGL2RenderingContext.uniform1f(decalProgram.getUniformLocation("decalTime"), this.#time);
		const rimColor = this.#rimColor;
		webGL2RenderingContext.uniform3f(decalProgram.getUniformLocation("rimColor"), rimColor[0], rimColor[1], rimColor[2]);
		webGL2RenderingContext.bindVertexArray(this.#decalVertexArray);
		for (const decal of this.#decals) {
			if (decal.age < 0) {
				continue;
			}
			const heat = decal.heatSeconds > 0 ? System.Math.max(0, 1 - decal.age / decal.heatSeconds) : 0;
			let fade = System.Math.min(1, decal.life - decal.age) * decal.alpha;
			if (decal.flicker > 0 && System.Math.floor(decal.age / decal.flicker) % 2 === 1) {
				fade *= 0.3;
			}
			this.drawDecal(decal, fade, heat * heat);
		}
		for (const decal of this.#queuedDecals) {
			this.drawDecal(decal, decal.alpha, decal.heat);
		}
	}

	//==============================================================================
	// 바닥 자국 하나 그리기. (자국 셰이더와 네 귀퉁이가 묶여 있음)
	//==============================================================================
	/**
	 * @param { object } decal - createDecal 이 지은 자국 값.
	 * @param { number } alpha - 덮는 몫. (0 ~ 1)
	 * @param { number } heat - 열기. (0 ~ 1, 1 이면 램프의 흰 심)
	 * @private
	 */
	drawDecal(decal, alpha, heat) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const decalProgram = this.#decalProgram;
		const grow = decal.growSeconds > 0 ? 1 - System.Math.pow(1 - System.Math.min(1, System.Math.max(0, decal.age) / decal.growSeconds), 2) : 1;
		const radius = decal.startRadius + (decal.radius - decal.startRadius) * grow;
		webGL2RenderingContext.uniform4f(decalProgram.getUniformLocation("decalShape"), decal.x, decal.z, radius, decal.angle);
		webGL2RenderingContext.uniform1f(decalProgram.getUniformLocation("decalHeight"), decal.floorHeight + DECAL_LIFT);
		webGL2RenderingContext.uniform1f(decalProgram.getUniformLocation("decalSlot"), decal.slot);
		webGL2RenderingContext.uniform1f(decalProgram.getUniformLocation("decalAlpha"), alpha);
		webGL2RenderingContext.uniform1f(decalProgram.getUniformLocation("decalHeat"), heat);
		webGL2RenderingContext.uniform1f(decalProgram.getUniformLocation("decalRamp"), decal.ramp);
		webGL2RenderingContext.uniform3f(decalProgram.getUniformLocation("decalTint"), decal.tint[0], decal.tint[1], decal.tint[2]);
		webGL2RenderingContext.uniform1f(decalProgram.getUniformLocation("decalMode"), decal.mode);
		webGL2RenderingContext.uniform4f(decalProgram.getUniformLocation("decalRing"), decal.ring[0], decal.ring[1], decal.ring[2], decal.ring[3]);
		webGL2RenderingContext.uniform1f(decalProgram.getUniformLocation("decalSeed"), decal.seed);
		webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLE_STRIP, 0, 4);
	}

	//==============================================================================
	// 충격파 띠 그리기. (바닥 빛을 먼저 납작하게, 그 위에 말려 오르는 띠)
	//==============================================================================
	/**
	 * @param { object } frame - readFrame 이 돌려준 그리는 프레임의 카메라.
	 * @private
	 */
	drawBands(frame) {
		if (this.#bands.length === 0) {
			return;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const bandProgram = this.#bandProgram;
		this.useProgram(bandProgram, frame);
		const rimColor = this.#rimColor;
		webGL2RenderingContext.uniform3f(bandProgram.getUniformLocation("rimColor"), rimColor[0], rimColor[1], rimColor[2]);
		webGL2RenderingContext.bindVertexArray(this.#bandMesh.vertexArray);
		for (const band of this.#bands) {
			const activeAge = band.age - band.delay;
			if (activeAge < 0) {
				continue;
			}
			const progress = System.Math.min(1, activeAge / System.Math.max(0.001, band.life - band.delay));
			const spread = 1 - System.Math.pow(1 - progress, 3);
			const radius = band.startRadius + (band.endRadius - band.startRadius) * spread;
			const width = System.Math.min(radius, band.width * (1 - 0.45 * progress));
			const alpha = System.Math.pow(1 - progress, 1.3);
			webGL2RenderingContext.uniform1f(bandProgram.getUniformLocation("bandProgress"), progress);
			webGL2RenderingContext.uniform1f(bandProgram.getUniformLocation("bandRepeat"), System.Math.max(6, System.Math.round(band.endRadius * 4)));
			webGL2RenderingContext.uniform1f(bandProgram.getUniformLocation("bandRamp"), band.ramp);
			webGL2RenderingContext.uniform3f(bandProgram.getUniformLocation("bandColor"), band.color[0], band.color[1], band.color[2]);
			webGL2RenderingContext.uniform1f(bandProgram.getUniformLocation("bandSeed"), band.seed);
			webGL2RenderingContext.uniform1f(bandProgram.getUniformLocation("bandAlpha"), alpha);
			webGL2RenderingContext.uniform1f(bandProgram.getUniformLocation("bandRim"), band.rim);
			// 바닥 빛. (띠보다 넓게, 납작하게)
			webGL2RenderingContext.uniform1f(bandProgram.getUniformLocation("bandFlat"), 1);
			webGL2RenderingContext.uniform4f(bandProgram.getUniformLocation("bandShape"), band.x, band.z, radius, System.Math.min(radius, width * 2.6));
			webGL2RenderingContext.uniform2f(bandProgram.getUniformLocation("bandLift"), 0, band.floorHeight + GROUND_GLOW_LIFT);
			webGL2RenderingContext.drawElements(webGL2RenderingContext.TRIANGLES, this.#bandMesh.indexCount, webGL2RenderingContext.UNSIGNED_SHORT, 0);
			// 말려 오르는 띠.
			webGL2RenderingContext.uniform1f(bandProgram.getUniformLocation("bandFlat"), 0);
			webGL2RenderingContext.uniform4f(bandProgram.getUniformLocation("bandShape"), band.x, band.z, radius, width);
			webGL2RenderingContext.uniform2f(bandProgram.getUniformLocation("bandLift"), band.lift * (1 - progress * 0.5), band.floorHeight + band.height);
			webGL2RenderingContext.drawElements(webGL2RenderingContext.TRIANGLES, this.#bandMesh.indexCount, webGL2RenderingContext.UNSIGNED_SHORT, 0);
		}
	}

	//==============================================================================
	// 연기 기둥 그리기. (빠르게 솟아 퍼지고, 열기는 앞 칠 할에 식고, 끝 사 할에 엷어짐)
	//==============================================================================
	/**
	 * @param { object } frame - readFrame 이 돌려준 그리는 프레임의 카메라.
	 * @private
	 */
	drawPlumes(frame) {
		if (this.#plumes.length === 0) {
			return;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const plumeProgram = this.#plumeProgram;
		this.useProgram(plumeProgram, frame);
		const viewDirection = frame.viewDirection;
		webGL2RenderingContext.uniform4f(plumeProgram.getUniformLocation("cameraPoint"), viewDirection[0], viewDirection[1], viewDirection[2], 0);
		webGL2RenderingContext.bindVertexArray(this.#latheMesh.vertexArray);
		for (const plume of this.#plumes) {
			if (plume.age < 0) {
				continue;
			}
			const progress = System.Math.min(1, plume.age / plume.life);
			const alpha = smoothStep(0, 0.08, progress) * (1 - smoothStep(0.6, 1, progress));
			const heat = System.Math.max(0, 1 - progress * 1.4);
			webGL2RenderingContext.uniform4f(plumeProgram.getUniformLocation("plumeShape"), plume.x, plume.z, plume.height, plume.capRadius);
			webGL2RenderingContext.uniform4f(plumeProgram.getUniformLocation("plumeMotion"), progress, plume.age, plume.seed, plume.stemRadius);
			webGL2RenderingContext.uniform1f(plumeProgram.getUniformLocation("plumeBase"), plume.floorHeight);
			webGL2RenderingContext.uniform4f(plumeProgram.getUniformLocation("plumeLook"), alpha, heat, plume.ramp, plume.age);
			webGL2RenderingContext.uniform3f(plumeProgram.getUniformLocation("smokeColor"), plume.smokeColor[0], plume.smokeColor[1], plume.smokeColor[2]);
			webGL2RenderingContext.drawElements(webGL2RenderingContext.TRIANGLES, this.#latheMesh.indexCount, webGL2RenderingContext.UNSIGNED_SHORT, 0);
		}
	}

	//==============================================================================
	// 불덩이 그리기. (부풀기는 빠르게 시작해 느려지고, 열기는 식고, 끝에 연기로 걷힘)
	//==============================================================================
	/**
	 * @param { object } frame - readFrame 이 돌려준 그리는 프레임의 카메라.
	 * @private
	 */
	drawFireballs(frame) {
		if (this.#fireballs.length === 0) {
			return;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const fireballProgram = this.#fireballProgram;
		this.useProgram(fireballProgram, frame);
		const viewDirection = frame.viewDirection;
		webGL2RenderingContext.uniform3f(fireballProgram.getUniformLocation("viewDirection"), viewDirection[0], viewDirection[1], viewDirection[2]);
		const rimColor = this.#rimColor;
		webGL2RenderingContext.uniform3f(fireballProgram.getUniformLocation("rimColor"), rimColor[0], rimColor[1], rimColor[2]);
		webGL2RenderingContext.bindVertexArray(this.#sphereMesh.vertexArray);
		for (const fireball of this.#fireballs) {
			if (fireball.age < 0) {
				continue;
			}
			const progress = System.Math.min(1, fireball.age / fireball.life);
			const grow = 1 - System.Math.pow(1 - System.Math.min(1, fireball.age / fireball.growSeconds), 3);
			const radius = fireball.radius * (0.25 + 0.75 * grow) * (1 + 0.25 * progress);
			const heat = System.Math.max(0, 1 - System.Math.pow(progress, 1.4) * 1.25);
			const alpha = 1 - smoothStep(0.55, 1, progress);
			webGL2RenderingContext.uniform4f(fireballProgram.getUniformLocation("ballCenter"), fireball.x, fireball.y + fireball.rise * progress, fireball.z, radius);
			webGL2RenderingContext.uniform1f(fireballProgram.getUniformLocation("ballTime"), fireball.age);
			webGL2RenderingContext.uniform1f(fireballProgram.getUniformLocation("ballSeed"), fireball.seed);
			webGL2RenderingContext.uniform1f(fireballProgram.getUniformLocation("ballBoil"), fireball.boil);
			webGL2RenderingContext.uniform1f(fireballProgram.getUniformLocation("ballHeat"), heat);
			webGL2RenderingContext.uniform1f(fireballProgram.getUniformLocation("ballAlpha"), alpha);
			webGL2RenderingContext.uniform1f(fireballProgram.getUniformLocation("ballRamp"), fireball.ramp);
			webGL2RenderingContext.uniform3f(fireballProgram.getUniformLocation("smokeColor"), fireball.smokeColor[0], fireball.smokeColor[1], fireball.smokeColor[2]);
			webGL2RenderingContext.uniform1f(fireballProgram.getUniformLocation("ballRim"), fireball.rim);
			webGL2RenderingContext.drawElements(webGL2RenderingContext.TRIANGLES, this.#sphereMesh.indexCount, webGL2RenderingContext.UNSIGNED_SHORT, 0);
		}
	}

	//==============================================================================
	// 회전체 빔 그리기. (넘긴 차례대로, 축과 두 옆 쪽은 여기서 셈)
	//==============================================================================
	/**
	 * @param { object } frame - readFrame 이 돌려준 그리는 프레임의 카메라.
	 * @private
	 */
	drawBeams(frame) {
		if (this.#queuedBeams.length === 0) {
			return;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const beamProgram = this.#beamProgram;
		this.useProgram(beamProgram, frame);
		const cameraPoint = frame.cameraPoint;
		webGL2RenderingContext.uniform4f(beamProgram.getUniformLocation("cameraPoint"), cameraPoint[0], cameraPoint[1], cameraPoint[2], cameraPoint[3]);
		webGL2RenderingContext.bindVertexArray(this.#latheMesh.vertexArray);
		for (const beam of this.#queuedBeams) {
			const start = beam.start;
			const axis = [beam.end[0] - start[0], beam.end[1] - start[1], beam.end[2] - start[2]];
			const beamLength = System.Math.hypot(axis[0], axis[1], axis[2]);
			const sides = readAxisSides(axis);
			webGL2RenderingContext.uniform3f(beamProgram.getUniformLocation("beamStart"), start[0], start[1], start[2]);
			webGL2RenderingContext.uniform3f(beamProgram.getUniformLocation("beamAxis"), axis[0], axis[1], axis[2]);
			webGL2RenderingContext.uniform3f(beamProgram.getUniformLocation("beamSideA"), sides[0][0], sides[0][1], sides[0][2]);
			webGL2RenderingContext.uniform3f(beamProgram.getUniformLocation("beamSideB"), sides[1][0], sides[1][1], sides[1][2]);
			webGL2RenderingContext.uniform4f(beamProgram.getUniformLocation("beamShape"), beam.radius, beam.wobble !== undefined ? beam.wobble : 0, beam.time !== undefined ? beam.time : this.#time, beam.seed !== undefined ? beam.seed : 0);
			webGL2RenderingContext.uniform4f(beamProgram.getUniformLocation("beamFlow"), beamLength, beam.flowSpeed !== undefined ? beam.flowSpeed : 4, beam.grainRepeat !== undefined ? beam.grainRepeat : 0.5, 0);
			webGL2RenderingContext.uniform4f(beamProgram.getUniformLocation("beamLook"), beam.isCore === true ? 0 : 1, beam.alpha, beam.ramp !== undefined ? beam.ramp : 0, beam.brightness !== undefined ? beam.brightness : 1);
			webGL2RenderingContext.drawElements(webGL2RenderingContext.TRIANGLES, this.#latheMesh.indexCount, webGL2RenderingContext.UNSIGNED_SHORT, 0);
		}
	}

	//==============================================================================
	// 리본 그리기. (점마다 앞뒤 점으로 잡은 쪽과 카메라 쪽에 수직으로 펴서 한 버퍼에 쓰고, 리본마다 띠로 그림)
	//==============================================================================
	/**
	 * @param { object } frame - readFrame 이 돌려준 그리는 프레임의 카메라.
	 * @private
	 */
	drawRibbons(frame) {
		const ribbons = this.#queuedRibbons;
		if (ribbons.length === 0) {
			return;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const cameraPoint = frame.cameraPoint;
		let vertexCount = 0;
		for (const ribbon of ribbons) {
			vertexCount += ribbon.points.length * 2;
		}
		if (this.#ribbonData.length < vertexCount * RIBBON_FLOAT_COUNT) {
			this.#ribbonData = new System.Float32Array(vertexCount * RIBBON_FLOAT_COUNT * 2);
		}
		const ribbonData = this.#ribbonData;
		const ribbonLengths = [];
		let offset = 0;
		for (const ribbon of ribbons) {
			const points = ribbon.points;
			const lastIndex = points.length - 1;
			const taper = ribbon.taper !== undefined ? ribbon.taper : 0;
			let ribbonLength = 0;
			for (let pointIndex = 0; pointIndex <= lastIndex; ++pointIndex) {
				const point = points[pointIndex];
				const previous = points[System.Math.max(0, pointIndex - 1)];
				const next = points[System.Math.min(lastIndex, pointIndex + 1)];
				if (pointIndex > 0) {
					ribbonLength += System.Math.hypot(point[0] - previous[0], point[1] - previous[1], point[2] - previous[2]);
				}
				const tangent = [next[0] - previous[0], next[1] - previous[1], next[2] - previous[2]];
				let towardX = cameraPoint[0];
				let towardY = cameraPoint[1];
				let towardZ = cameraPoint[2];
				if (cameraPoint[3] > 0.5) {
					towardX -= point[0];
					towardY -= point[1];
					towardZ -= point[2];
				}
				let sideX = tangent[1] * towardZ - tangent[2] * towardY;
				let sideY = tangent[2] * towardX - tangent[0] * towardZ;
				let sideZ = tangent[0] * towardY - tangent[1] * towardX;
				const sideLength = System.Math.max(0.000001, System.Math.hypot(sideX, sideY, sideZ));
				const along = pointIndex / lastIndex;
				const edge = 2 * along - 1;
				const halfWidth = ribbon.width * 0.5 * (1 - taper * edge * edge);
				sideX *= halfWidth / sideLength;
				sideY *= halfWidth / sideLength;
				sideZ *= halfWidth / sideLength;
				for (const across of [1, 0]) {
					const sign = across === 1 ? 1 : -1;
					ribbonData[offset] = point[0] + sideX * sign;
					ribbonData[offset + 1] = point[1] + sideY * sign;
					ribbonData[offset + 2] = point[2] + sideZ * sign;
					ribbonData[offset + 3] = along;
					ribbonData[offset + 4] = across;
					offset += RIBBON_FLOAT_COUNT;
				}
			}
			ribbonLengths.push(ribbonLength);
		}
		const ribbonProgram = this.#ribbonProgram;
		this.useProgram(ribbonProgram, frame);
		const rimColor = this.#rimColor;
		webGL2RenderingContext.uniform3f(ribbonProgram.getUniformLocation("rimColor"), rimColor[0], rimColor[1], rimColor[2]);
		webGL2RenderingContext.bindVertexArray(this.#ribbonVertexArray);
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#ribbonBuffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, ribbonData, webGL2RenderingContext.DYNAMIC_DRAW, 0, vertexCount * RIBBON_FLOAT_COUNT);
		let firstVertex = 0;
		ribbons.forEach((ribbon, ribbonIndex) => {
			const color = ribbon.color !== undefined ? ribbon.color : [1, 1, 1];
			const pointCount = ribbon.points.length * 2;
			webGL2RenderingContext.uniform3f(ribbonProgram.getUniformLocation("ribbonColor"), color[0], color[1], color[2]);
			webGL2RenderingContext.uniform4f(ribbonProgram.getUniformLocation("ribbonLook"), ribbon.ramp !== undefined ? ribbon.ramp : -1, ribbon.alpha, ribbon.brightness !== undefined ? ribbon.brightness : 1, ribbon.flow !== undefined ? ribbon.flow : this.#time);
			webGL2RenderingContext.uniform2f(ribbonProgram.getUniformLocation("ribbonGrain"), ribbonLengths[ribbonIndex] * (ribbon.grainRepeat !== undefined ? ribbon.grainRepeat : 1), ribbon.rim !== undefined ? ribbon.rim : 0);
			const glow = ribbon.glow !== undefined && ribbon.glow !== null ? ribbon.glow : null;
			webGL2RenderingContext.uniform4f(ribbonProgram.getUniformLocation("ribbonGlow"), glow !== null ? glow[0] : 0, glow !== null ? glow[1] : 0, glow !== null ? glow[2] : 0, glow !== null ? 1 : 0);
			webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLE_STRIP, firstVertex, pointCount);
			firstVertex += pointCount;
		});
	}

	//==============================================================================
	// 파티클 그리기. (새로 낸 것이 있으면 쓴 칸까지 버퍼를 다시 올림, 사라진 것은 정점 셰이더가 접음, 이번 프레임의 빛 점도 같은 셰이더로)
	//==============================================================================
	/**
	 * @param { object } frame - readFrame 이 돌려준 그리는 프레임의 카메라.
	 * @param { boolean } isParticleLive 낸 파티클이 아직 떠 있는지.
	 * @private
	 */
	drawParticles(frame, isParticleLive) {
		const glintCount = this.#queuedGlintCount;
		if (!isParticleLive && glintCount === 0) {
			return;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const particleProgram = this.#particleProgram;
		this.useProgram(particleProgram, frame);
		const viewDirection = frame.viewDirection;
		const cameraRight = frame.cameraRight;
		const cameraUp = frame.cameraUp;
		webGL2RenderingContext.uniform3f(particleProgram.getUniformLocation("viewDirection"), viewDirection[0], viewDirection[1], viewDirection[2]);
		webGL2RenderingContext.uniform3f(particleProgram.getUniformLocation("cameraRight"), cameraRight[0], cameraRight[1], cameraRight[2]);
		webGL2RenderingContext.uniform3f(particleProgram.getUniformLocation("cameraUp"), cameraUp[0], cameraUp[1], cameraUp[2]);
		webGL2RenderingContext.uniform1f(particleProgram.getUniformLocation("time"), this.#time);
		const rimColor = this.#rimColor;
		webGL2RenderingContext.uniform3f(particleProgram.getUniformLocation("rimColor"), rimColor[0], rimColor[1], rimColor[2]);
		webGL2RenderingContext.uniform1fv(particleProgram.getUniformLocation("lookGains"), this.#lookGains);
		if (isParticleLive) {
			webGL2RenderingContext.bindVertexArray(this.#particleVertexArray);
			const usedCount = this.#particleUsedCount;
			if (this.#isParticleDirty) {
				webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#particleBuffer);
				// 사파리가 앞 그리기를 기다리지 않게 bufferSubData 대신 bufferData 로 새 저장소를 잡으며 올린다.
				webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, this.#particleData, webGL2RenderingContext.DYNAMIC_DRAW, 0, usedCount * PARTICLE_FLOAT_COUNT);
				this.#isParticleDirty = false;
			}
			webGL2RenderingContext.drawArraysInstanced(webGL2RenderingContext.TRIANGLE_STRIP, 0, 4, usedCount);
		}
		if (glintCount > 0) {
			webGL2RenderingContext.bindVertexArray(this.#glintVertexArray);
			webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#glintBuffer);
			webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, this.#glintData, webGL2RenderingContext.DYNAMIC_DRAW, 0, glintCount * PARTICLE_FLOAT_COUNT);
			webGL2RenderingContext.drawArraysInstanced(webGL2RenderingContext.TRIANGLE_STRIP, 0, 4, glintCount);
		}
	}

	//==============================================================================
	// 섬광 그리기. (뷰포트 전체의 네 귀퉁이를 깊이 시험 없이, 섬광마다 처음이 세고 나이로 빠르게 걷힘)
	//==============================================================================
	/** @private */
	drawFlashes() {
		if (this.#flashes.length === 0) {
			return;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const flashProgram = this.#flashProgram;
		flashProgram.useProgram();
		webGL2RenderingContext.disable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.bindVertexArray(this.#decalVertexArray);
		for (const flash of this.#flashes) {
			if (flash.age < 0) {
				continue;
			}
			const fade = 1 - flash.age / flash.life;
			webGL2RenderingContext.uniform4f(flashProgram.getUniformLocation("flashColor"), flash.color[0], flash.color[1], flash.color[2], flash.strength * fade * fade);
			webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLE_STRIP, 0, 4);
		}
		webGL2RenderingContext.enable(webGL2RenderingContext.DEPTH_TEST);
	}

	//==============================================================================
	// 다 쓴 뒤 지우기.
	//==============================================================================
	destroy() {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		for (const buffer of this.#buffers) {
			webGL2RenderingContext.deleteBuffer(buffer);
		}
		for (const vertexArray of [this.#particleVertexArray, this.#glintVertexArray, this.#ribbonVertexArray, this.#decalVertexArray, this.#sphereMesh.vertexArray, this.#bandMesh.vertexArray, this.#latheMesh.vertexArray]) {
			webGL2RenderingContext.deleteVertexArray(vertexArray);
		}
		for (const shaderProgram of [this.#particleProgram, this.#fireballProgram, this.#bandProgram, this.#decalProgram, this.#beamProgram, this.#plumeProgram, this.#ribbonProgram, this.#flashProgram]) {
			webGL2RenderingContext.deleteProgram(shaderProgram.getProgram());
		}
		if (this.#atlasTexture !== null) {
			webGL2RenderingContext.deleteTexture(this.#atlasTexture);
			this.#atlasTexture = null;
		}
	}
}
