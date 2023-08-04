const { strict: assert } = require("assert");
const targetIdInfoMap = new Map();

/**
 * @return boolean - true if fighting the target, false otherwise
 */
function isFightingTarget(gameId) {
	return targetIdInfoMap.has(gameId);
}

function recordDamageAgainstTarget(gameId, value) {
	assert(isFightingTarget(gameId));

	const info = targetIdInfoMap.get(gameId);
	info.totalDamage += value;
}

/**
 * @return object - object with dps info
 */
function getDpsInfo(gameId) {
	const info = targetIdInfoMap.get(gameId);
	const elapsedSeconds = BigInt(Math.ceil(
		(Date.now() - info.combatStart) / 1000));
	// the EACH_SKILL_RESULT event triggers after this on the same mob so it
	// thinks you go restart the fight if this is deleted immediately
	// it then gets printed out because you go out of combat or some other event
	// fires so return null if no damage is done or fight is less than 1 second
	// (who cares about those fights anyways)
	if (info.totalDamage === 0n || elapsedSeconds <= 1n) {
		return null;
	}

	return {
		name: info.targetName,
		dps: info.totalDamage / elapsedSeconds,
		totalDamage: info.totalDamage,
		duration: elapsedSeconds,
	};
}

/**
 * @return object | null - object with dps info or else null if short fight
 */
function completeFightAgainstTarget(gameId) {
	assert(isFightingTarget(gameId));

	const message = getDpsInfo(gameId);
	// see comment about EACH_SKILL_RESULT sending info after target dies
	// tldr: keep target info for a bit so it doesn't think there's a new fight
	// against the target starting
	setTimeout(() => targetIdInfoMap.delete(gameId), 3000);
	return message;
}

/**
 * @return (object | null)[] - list of dps info objects and nulls
 */
function completeAllFights() {
	const messages = getAllDpsMessages();
	targetIdInfoMap.clear();
	return messages;
}

/**
 * @return (string | null)[] - list of dps info objects and nulls
 */
function getAllDpsMessages() {
	const targetIds = Array.from(targetIdInfoMap.keys());
	return targetIds.map(targetId => getDpsInfo(targetId));
}

function startFightAgainstTarget(gameId, name, initialDamage) {
	const info = createTargetInfoObj(name, initialDamage);
	targetIdInfoMap.set(gameId, info);
}

function createTargetInfoObj(name, initialDamage) {
	return {
		targetName: name,
		totalDamage: initialDamage,
		combatStart: Date.now(),
	};
}

function formatDpsInfo(dpsInfo) {
	let dps = dpsInfo.dps;
	let suffix = "/s";

	assert.ok(dps <= BigInt(Number.MAX_SAFE_INTEGER));

	dps = Number(dps);
	if (dps > 1000) {
		dps /= 1000;
		suffix = "k/s";
		if (dps > 1000) {
			dps /= 1000;
			suffix = "m/s";
		}
	}

	return `${dpsInfo.name}: ${dps.toFixed(3)}${suffix} (${dpsInfo.duration}s)`;
}

module.exports = {
	isFightingTarget,
	completeFightAgainstTarget,
	completeAllFights,
	recordDamageAgainstTarget,
	startFightAgainstTarget,
	getAllDpsMessages,
	formatDpsInfo,
}
