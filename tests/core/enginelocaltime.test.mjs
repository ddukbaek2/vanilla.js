//==============================================================================
// Engine.readLocalTime 시험. (Date 의 현지 달력과 같은 값, 분 오프셋, 꼴)
//==============================================================================
import assert from "node:assert/strict";
import { Engine } from "../../src/core/engine.js";

const engineLike = { readLocalTime: Engine.prototype.readLocalTime };
const before = Date.now();
const now = engineLike.readLocalTime();
const date = new Date(before);
assert.deepEqual(Object.keys(now), ["year", "month", "day", "hour", "minute", "second", "weekday"]);
assert.equal(now.year, date.getFullYear());
assert.ok(now.month >= 1 && now.month <= 12);
assert.ok(now.hour >= 0 && now.hour < 24 && now.minute >= 0 && now.minute < 60 && now.second >= 0 && now.second < 60);
assert.ok(now.weekday >= 0 && now.weekday <= 6);

// 오프셋은 Date.now() 에 분을 더한 때의 현지 달력이다. (일광 절약 시간 포함)
const later = engineLike.readLocalTime(1440);
const tomorrow = new Date(Date.now() + 1440 * 60000);
assert.equal(later.day, tomorrow.getDate());
assert.equal(later.month, tomorrow.getMonth() + 1);
const earlier = engineLike.readLocalTime(-90);
const past = new Date(Date.now() - 90 * 60000);
assert.equal(earlier.hour, past.getHours());
console.log("enginelocaltime ok");
