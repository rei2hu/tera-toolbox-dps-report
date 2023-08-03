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
 * @return string | null - text that details the fight or null if no damage done
 */
function completeFightAgainstTarget(gameId) {
	assert(isFightingTarget(gameId));

	const info = targetIdInfoMap.get(gameId);
	targetIdInfoMap.delete(gameId);
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

	return `${info.targetName}: ${info.totalDamage / elapsedSeconds} (${elapsedSeconds}s)`;
}

/**
 * @return (string | null)[] - text that details all ongoing fights
 */
function completeAllFights() {
	const targetIds = Array.from(targetIdInfoMap.keys());
	const text = targetIds.map(targetId =>
		completeFightAgainstTarget(targetId));
	return text;
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

module.exports = {
	isFightingTarget,
	completeFightAgainstTarget,
	completeAllFights,
	recordDamageAgainstTarget,
	startFightAgainstTarget,
}
