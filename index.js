const {
	completeAllFights,
	completeFightAgainstTarget,
	isFightingTarget,
	recordDamageAgainstTarget,
	startFightAgainstTarget,
	getAllDpsMessages,
	formatDpsInfo,
} = require("./dps_meter");

const reportName = "dps report";

exports.NetworkMod = class {
	constructor(mod) {
		mod.hook("S_EACH_SKILL_RESULT", 14, ({ type,
			target, source, owner, value }) => {
			const realSource = owner !== 0n ? owner : source;

			// only record damage from own skills (what about DOTs)
			if (realSource !== mod.game.me.gameId) return;
			if (type !== 1) return;

			if (!isFightingTarget(target)) {
				startFightAgainstTarget(target,
					gameIdNameMap.get(target) ?? target,
					value);
			} else {
				recordDamageAgainstTarget(target, value);
			}
		});

		let inCombat = false;
		let dpsInfoInterval = null;
		mod.hook("S_USER_STATUS", 3, ({ gameId, status }) => {
			if (gameId !== mod.game.me.gameId) return;

			if (!inCombat && status === 1) {
				inCombat = true;
				dpsInfoInterval = mod.setInterval(() => {
					const dpsInfo = getAllDpsMessages()
							.filter(maybeInfo => maybeInfo !== null)
							.sort((a, b) => b.dps - a.dps > 0n ? 1 : -1);
					mod.send("S_CUSTOM_STYLE_SYSTEM_MESSAGE", 1, {
						style: 49, // box on side of window
						message: dpsInfo.map(info => formatDpsInfo(info))
							.join("\n"),
					});
				}, 1000); // will make message flash unfortunately
			} else if (inCombat && status === 0) {
				// if leaving combat, complete all fights because mobs reset
				inCombat = false;
				mod.clearInterval(dpsInfoInterval);
				const dpsInfo = completeAllFights();
				for (const info of dpsInfo) {
					if (info === null) continue;

					mod.send("S_CHAT", 3, {
						name: reportName,
						message: formatDpsInfo(info),
					});
				}
			}
		});

		let huntingZoneIdTemplateIdNameMap = new Map();
		let gameIdNameMap = new Map();
		// v12 doesn't work for fetching npc names for some reason
		mod.hook("S_SPAWN_NPC", 11, async ({ gameId,
			templateId, huntingZoneId }) => {
			if (!huntingZoneIdTemplateIdNameMap.has(huntingZoneId)) {
				huntingZoneIdTemplateIdNameMap.set(huntingZoneId, new Map());
			}
			if (!huntingZoneIdTemplateIdNameMap.get(huntingZoneId)
					.has(templateId)) {
				const result = await mod.queryData(
					"/StrSheet_Creature/HuntingZone@id=?/String@templateId=?",
					[huntingZoneId, templateId]);
				if (!result) {
					mod.warn(`Could not get npc name of ${huntingZoneId}-${templateId}`);
				}

				huntingZoneIdTemplateIdNameMap.get(huntingZoneId)
					.set(templateId, result?.attributes?.name ?? `${huntingZoneId}-${templateId}`);
			}
			gameIdNameMap.set(gameId, huntingZoneIdTemplateIdNameMap
				.get(huntingZoneId).get(templateId));
		});

		mod.hook("S_NPC_STATUS", 2, ({ gameId, status, hpLevel }) => {
			// only care if a mob that we've hit goes out of combat or dies
			if (!isFightingTarget(gameId)) return;
			if (status !== 4 || hpLevel !== 0 || status !== 0) return;

			const info = completeFightAgainstTarget(gameId);
			if (info === null) return;

			mod.send("S_CHAT", 3, {
				name: reportName,
				message: formatDpsInfo(info),
			});
		});

		mod.hook("S_CREATURE_CHANGE_HP", 6, ({ curHp, target }) => {
			// only care if a mob that we've hit dies
			if (!isFightingTarget(target)) return;
			if (curHp > 0n) return;

			const info = completeFightAgainstTarget(target);
			if (info === null) return;

			mod.send("S_CHAT", 3, {
				name: reportName,
				message: formatDpsInfo(info),
			});
		});
	}
}
