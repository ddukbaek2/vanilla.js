//==============================================================================
// 타임라인 시험. (node tests/animation/timeline.test.mjs)
// - 러스트 판 짝: src/animation/timeline.rs 의 easing_curves_match_original, bezier_easing_matches_original,
//   parse_timeline_color_matches_original, compose_timeline_color_matches_original, sample_track_matches_original,
//   playback_matches_original_event_order, handlers_can_control_timeline.
// - 기대값과 허용 오차는 러스트 판 시험과 같다. (러스트 판이 원본 node 실행 값을 지킨다)
//==============================================================================
import { TIMELINE_EASING_NAMES, Timeline, composeTimelineColor, createBezierEasing, parseTimelineColor, resolveTimelineEasing } from "../../src/animation/timeline.js";
import { check, checkEqual, checkJson, checkNear, finish, knownDifference } from "../testcheck.mjs";

const PROGRESS_LIST = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];

// 감속 곡선. (TIMELINE_EASING_NAMES 차례도 같다)
const easingTable = [
	["linear", [0.0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0]],
	["step", [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]],
	["bezier", [0.0, 0.019722447263855636, 0.1291619005687877, 0.5, 0.8708380994312122, 0.9802775527361445, 1.0]],
	["quadratic.in", [0.0, 0.010000000000000002, 0.0625, 0.25, 0.5625, 0.81, 1.0]],
	["quadratic.out", [0.0, 0.19, 0.4375, 0.75, 0.9375, 0.9900000000000001, 1.0]],
	["quadratic.inOut", [0.0, 0.020000000000000004, 0.125, 0.5, 0.875, 0.98, 1.0]],
	["cubic.in", [0.0, 0.0010000000000000002, 0.015625, 0.125, 0.421875, 0.7290000000000001, 1.0]],
	["cubic.out", [0.0, 0.2709999999999999, 0.578125, 0.875, 0.984375, 0.999, 1.0]],
	["cubic.inOut", [0.0, 0.004000000000000001, 0.0625, 0.5, 0.9375, 0.996, 1.0]],
	["quartic.in", [0.0, 0.00010000000000000003, 0.00390625, 0.0625, 0.31640625, 0.6561000000000001, 1.0]],
	["quartic.out", [0.0, 0.3438999999999999, 0.68359375, 0.9375, 0.99609375, 0.9999, 1.0]],
	["quartic.inOut", [0.0, 0.0008000000000000003, 0.03125, 0.5, 0.96875, 0.9992, 1.0]],
	["quintic.in", [0.0, 0.000010000000000000004, 0.0009765625, 0.03125, 0.2373046875, 0.5904900000000002, 1.0]],
	["quintic.out", [0.0, 0.4095099999999998, 0.7626953125, 0.96875, 0.9990234375, 0.99999, 1.0]],
	["quintic.inOut", [0.0, 0.00016000000000000007, 0.015625, 0.5, 0.984375, 0.99984, 1.0]],
	["sinusoidal.in", [0.0, 0.01231165940486223, 0.07612046748871326, 0.29289321881345254, 0.6173165676349103, 0.8435655349597695, 1.0000000000000033]],
	["sinusoidal.out", [0.0, 0.15643446504023087, 0.3826834323650897, 0.7071067811865475, 0.923879532511287, 0.9876883405951378, 1.0]],
	["sinusoidal.inOut", [0.0, 0.024471741852423234, 0.14644660940672627, 0.5000000000000017, 0.8535533905989214, 0.9755282583629648, 1.00000000176454]],
	["exponential.in", [0.0, 0.0019531249999999998, 0.005524271728019903, 0.03125, 0.1767766952966369, 0.5000000000000001, 1.0]],
	["exponential.out", [0.0, 0.5, 0.8232233047033631, 0.96875, 0.99447572827198, 0.998046875, 1.0]],
	["exponential.inOut", [0.0, 0.0019531249999999993, 0.015625, 0.5, 0.984375, 0.998046875, 1.0]],
	["circular.in", [0.0, 0.005012562893380035, 0.031754163448145745, 0.1339745962155614, 0.3385621722338523, 0.5641101056459327, 1.0]],
	["circular.out", [0.0, 0.43588989435406733, 0.6614378277661477, 0.8660254037844386, 0.9682458365518543, 0.99498743710662, 1.0]],
	["circular.inOut", [0.0, 0.010102051443364402, 0.0669872981077807, 0.5, 0.9330127018922193, 0.9898979485566356, 1.0]],
	["elastic.in", [0.0, 0.0, 0.0039062499999999952, 0.0, -0.12500000000000003, 0.0, 1.0]],
	["elastic.out", [0.0, 1.0, 1.125, 1.0, 0.99609375, 1.0, 1.0]],
	["elastic.inOut", [0.0, 0.001953125, 0.0, 0.5, 1.0, 0.998046875, 1.0]],
	["back.in", [0.0, -0.014314220000000002, -0.06413656250000001, -0.08769750000000004, 0.1825903124999999, 0.5911720199999999, 0.9999999999999998]],
	["back.out", [0.0, 0.4088279800000001, 0.8174096875000001, 1.0876975, 1.0641365625, 1.01431422, 1.0]],
	["back.inOut", [0.0, -0.037518552000000004, -0.09968184375, 0.5, 1.09968184375, 1.0375185519999999, 1.0]],
	["bounce.in", [0.0, 0.01187500000000008, 0.02734375, 0.234375, 0.52734375, 0.9243750000000001, 1.0]],
	["bounce.out", [0.0, 0.07562500000000001, 0.47265625, 0.765625, 0.97265625, 0.9881249999999999, 1.0]],
	["bounce.inOut", [0.0, 0.030000000000000027, 0.1171875, 0.5, 0.8828125, 0.97, 1.0]],
];
checkEqual(TIMELINE_EASING_NAMES.length, easingTable.length, "TIMELINE_EASING_NAMES 길이");
for (let easingIndex = 0; easingIndex < easingTable.length; easingIndex++) {
	const [easingName, expectedValueList] = easingTable[easingIndex];
	checkEqual(TIMELINE_EASING_NAMES[easingIndex], easingName, "TIMELINE_EASING_NAMES[" + easingIndex + "]");
	const easingFunction = resolveTimelineEasing(easingName);
	checkNear(PROGRESS_LIST.map((progress) => easingFunction(progress)), expectedValueList, 0.0002, easingName);
}
checkNear(resolveTimelineEasing("unknown.out")(0.3), 0.3, 0.000001, "모르는 이름은 linear");
checkNear(resolveTimelineEasing("cubic")(0.3), 0.3, 0.000001, "방향 없는 이름은 linear");

// 베지어 감속. (제어점 x 가 0 ~ 1 밖이면 자른다)
const bezierTable = [
	[[0.25, 0.1, 0.25, 1.0], [0.0, 0.09479499730150565, 0.4085105930156005, 0.8024033876954126, 0.9604590729525888, 0.994316477509521, 1.0]],
	[[0.68, -0.55, 0.265, 1.55], [0.0, -0.06629147620026413, -0.0828074555627528, 0.6066814989627444, 1.089166506168796, 1.0623731930901974, 1.0]],
	[[0.42, 0.0, 0.58, 1.0], [0.0, 0.019722447263855636, 0.1291619005687877, 0.5, 0.8708380994312122, 0.9802775527361445, 1.0]],
	[[1.5, 0.0, -0.5, 1.0], [0.0, 0.0037616480437726607, 0.029723406016020297, 0.5, 0.9702765939839797, 0.9962383519562273, 1.0]],
];
for (const [curve, expectedValueList] of bezierTable) {
	const bezierEasing = createBezierEasing(curve[0], curve[1], curve[2], curve[3]);
	const resolvedEasing = resolveTimelineEasing("bezier", curve);
	checkNear(PROGRESS_LIST.map((progress) => bezierEasing(progress)), expectedValueList, 0.0002, "베지어 " + curve.join(","));
	checkNear(PROGRESS_LIST.map((progress) => resolvedEasing(progress)), expectedValueList, 0.0002, "resolve 베지어 " + curve.join(","));
}

// 색 글 읽기. (못 읽는 채널은 1)
const parseColorTable = [
	["#ff8000", [1.0, 0.5019607843137255, 0.0, 1.0]],
	["#11223344", [0.06666666666666667, 0.13333333333333333, 0.2, 0.26666666666666666]],
	["abc", [1.0, 1.0, 1.0, 1.0]],
	["#zz", [1.0, 1.0, 1.0, 1.0]],
	["#1", [0.00392156862745098, 1.0, 1.0, 1.0]],
	["", [1.0, 1.0, 1.0, 1.0]],
	["#12345", [0.07058823529411765, 0.20392156862745098, 0.0196078431372549, 1.0]],
	["#ff00ff7f", [1.0, 0.0, 1.0, 0.4980392156862745]],
	["#1g2h3i", [0.00392156862745098, 0.00784313725490196, 0.011764705882352941, 1.0]],
];
for (const [hexText, expectedChannelList] of parseColorTable) {
	checkNear(parseTimelineColor(hexText), expectedChannelList, 0.000001, "parseTimelineColor(" + hexText + ")");
}

// 채널 → 색 글. (0 ~ 1 로 자르고 반올림, 알파가 없으면 ff)
checkEqual(composeTimelineColor([1.0, 0.5, 0.0, 1.0]), "#ff8000ff", "composeTimelineColor 1");
checkEqual(composeTimelineColor([0.2, 0.4, 0.6]), "#336699ff", "composeTimelineColor 알파 없음");
checkEqual(composeTimelineColor([1.2, -0.1, 0.5, 0.5]), "#ff008080", "composeTimelineColor 자르기");
checkEqual(composeTimelineColor([0.5, 0.25, 0.75, 0.1]), "#8040bf1a", "composeTimelineColor 반올림");

// 트랙 표본. (정렬, 구간 감속, 베지어, 계단, 색 보간, 문자열과 참거짓 계단, 같은 시간 키)
const timeList = [-1.0, 0.0, 0.3, 0.5, 0.99, 1.0, 1.4, 2.0, 2.5, 5.0];
const numberTrackTable = [
	[{ property: "x", keys: [{ time: 1, value: 50, easing: "cubic.out" }, { time: 0, value: 0, easing: "quadratic.in" }, { time: 2, value: 100 }] },
		[0.0, 0.0, 4.5, 12.5, 49.004999999999995, 50.0, 89.19999999999999, 100.0, 100.0, 100.0]],
	[{ property: "y", keys: [{ time: 0, value: 10, easing: "bezier", curve: [0.68, -0.55, 0.265, 1.55] }, { time: 1, value: 20, easing: "step" }, { time: 2, value: 40 }] },
		[10.0, 10.0, 9.50682322875037, 16.066814989627446, 20.073713280149843, 20.0, 20.0, 40.0, 40.0, 40.0]],
	[{ property: "opacity", keys: [{ time: 0, value: 0, easing: "elastic.out" }, { time: 1, value: 1, easing: "bounce.inOut" }, { time: 1, value: 0.5 }, { time: 3, value: 0 }] },
		[0.0, 0.0, 1.0, 1.0, 1.0010337677272523, 0.5, 0.4, 0.25, 0.125, 0.0]],
];
for (const [track, expectedValueList] of numberTrackTable) {
	for (let timeIndex = 0; timeIndex < timeList.length; timeIndex++) {
		const value = Timeline.sampleTrack(track, timeList[timeIndex]);
		checkNear(value, expectedValueList[timeIndex], 0.0005, track.property + " " + timeList[timeIndex] + " 초");
	}
}
const colorTrack = { property: "color", keys: [{ time: 0, value: "#ff000080", easing: "sinusoidal.inOut" }, { time: 2, value: "#0000ffff" }] };
const expectedColorList = ["#ff000080", "#ff000080", "#f1000e87", "#da002593", "#82007dbf", "#800080c0", "#3500cae5", "#0000ffff", "#0000ffff", "#0000ffff"];
for (let timeIndex = 0; timeIndex < timeList.length; timeIndex++) {
	const colorText = Timeline.sampleTrack(colorTrack, timeList[timeIndex]);
	if (timeList[timeIndex] === 1.0 && colorText !== expectedColorList[timeIndex]) {
		// 원본은 sinusoidal.inOut(0.5) 를 f64(0.49999999999999994)로 셈해 파랑이 7f, 러스트 판 감속 함수는 f32(0.5)라 80 이다.
		knownDifference("src/animation/timeline.rs::sample_track_matches_original", "색 트랙 1 초 (sinusoidal.inOut 0.5 의 f64 와 f32 셈)", colorText, expectedColorList[timeIndex]);
		continue;
	}
	checkEqual(colorText, expectedColorList[timeIndex], "색 트랙 " + timeList[timeIndex] + " 초");
}
const textTrack = { property: "text", keys: [{ time: 0, value: "A" }, { time: 1, value: "B" }] };
checkJson(timeList.map((time) => String(Timeline.sampleTrack(textTrack, time))), ["A", "A", "A", "A", "A", "B", "B", "B", "B", "B"], "글 트랙");
const visibleTrack = { property: "visible", keys: [{ time: 0, value: false }, { time: 0.5, value: true }] };
checkJson(timeList.map((time) => Timeline.sampleTrack(visibleTrack, time)), [false, false, false, true, true, true, true, true, true, true], "참거짓 트랙");
checkEqual(Timeline.sampleKeys([], "number", 1.0), 0, "빈 숫자 키");
const emptyStringValue = Timeline.sampleKeys([], "string", 1.0);
check(emptyStringValue === null || emptyStringValue === undefined, "빈 글 키는 값 없음: " + emptyStringValue);

// 재생이 같은 차례로 값, 이벤트, 마커, 완료를 낸다.
const playbackDescription = {
	duration: 2, frameRate: 30, loop: true,
	tracks: [
		{ target: "screen", property: "vignette", keys: [{ time: 0, value: 0 }, { time: 2, value: 1 }] },
		{ target: "screen", property: "event", keys: [{ time: 0.5, value: "hit" }, { time: 1.5, value: "end" }] },
		{ target: "screen", property: "event", enabled: false, keys: [{ time: 1, value: "disabled" }] },
	],
	markers: [{ time: 1.0, name: "middle" }, { time: 0, name: "start" }],
};
const playbackLog = [];
const screenTarget = {
	setTimelineProperty(propertyName, value) {
		playbackLog.push("set " + propertyName + "=" + Number(value).toFixed(4));
	},
};
const playbackTimeline = new Timeline(playbackDescription);
playbackTimeline.setTargetResolver((targetName) => targetName === "screen" ? screenTarget : null);
playbackTimeline.setEventHandler((targetName, eventName) => playbackLog.push("event " + targetName + ":" + eventName));
playbackTimeline.setMarkerHandler((markerName) => playbackLog.push("marker " + markerName));
playbackTimeline.setCompleteHandler(() => playbackLog.push("complete"));
playbackTimeline.play();
for (const timeDelta of [0.25, 0.25, 0.6, 0.6, 0.6, 0.6]) {
	playbackTimeline.tick(timeDelta);
	playbackLog.push("time " + playbackTimeline.getTime().toFixed(4));
}
playbackTimeline.setLoop(false);
playbackTimeline.tick(0.7);
playbackLog.push("time " + playbackTimeline.getTime().toFixed(4) + " playing " + playbackTimeline.isPlaying());
playbackTimeline.tick(0.3);
playbackLog.push("time " + playbackTimeline.getTime().toFixed(4) + " playing " + playbackTimeline.isPlaying());
playbackTimeline.play();
playbackLog.push("replay time " + playbackTimeline.getTime().toFixed(4));
playbackTimeline.seek(1.25);
playbackLog.push("seek time " + playbackTimeline.getTime().toFixed(4));
playbackTimeline.tick(1.0);
playbackLog.push("time " + playbackTimeline.getTime().toFixed(4) + " playing " + playbackTimeline.isPlaying());
playbackTimeline.play();
playbackLog.push("replay time " + playbackTimeline.getTime().toFixed(4) + " playing " + playbackTimeline.isPlaying());
playbackTimeline.tick(0.1);
playbackLog.push("time " + playbackTimeline.getTime().toFixed(4));
checkEqual(playbackTimeline.getTarget("screen"), null, "대상 표에는 없음");
checkEqual(playbackTimeline.resolveTarget("screen"), screenTarget, "찾기 함수로 찾음");
const expectedPlaybackLog = [
	"set vignette=0.1250", "time 0.2500",
	"event screen:hit", "set vignette=0.2500", "time 0.5000",
	"marker middle", "set vignette=0.5500", "time 1.1000",
	"event screen:end", "set vignette=0.8500", "time 1.7000",
	"marker start", "set vignette=0.1500", "time 0.3000",
	"event screen:hit", "set vignette=0.4500", "time 0.9000",
	"event screen:end", "marker middle", "set vignette=0.8000", "time 1.6000 playing true",
	"set vignette=0.9500", "time 1.9000 playing true",
	"replay time 1.9000",
	"set vignette=0.6250", "seek time 1.2500",
	"event screen:end", "set vignette=1.0000", "complete", "time 2.0000 playing false",
	"replay time 0.0000 playing true",
	"set vignette=0.0500", "time 0.1000",
];
checkJson(playbackLog, expectedPlaybackLog, "재생 기록");

// 핸들러 안에서 타임라인을 멈추고 옮길 수 있다. (핸들러의 마지막 인자는 타임라인 자신)
const controlTimeline = new Timeline({
	duration: 2, loop: true,
	tracks: [{ target: "screen", property: "event", keys: [{ time: 0.5, value: "stop" }] }],
	markers: [{ time: 1.0, name: "jump" }],
});
controlTimeline.setEventHandler((targetName, eventName, key, timeline) => {
	if (eventName === "stop") {
		timeline.pause();
	}
});
controlTimeline.setMarkerHandler((markerName, marker, timeline) => timeline.setSpeed(2.0));
controlTimeline.play();
controlTimeline.tick(0.6);
checkEqual(controlTimeline.isPlaying(), false, "이벤트 핸들러에서 멈춤");
controlTimeline.play();
controlTimeline.tick(0.6);
checkEqual(controlTimeline.getSpeed(), 2.0, "마커 핸들러에서 속도");

finish("tests/animation/timeline.test.mjs");
