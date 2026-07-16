const MUTUALLY_EXCLUSIVE_GROUPS = {
    Monday: ['half_monthly'],
    half_monthly: ['Monday'],
    '18Monday': ['18half_monthly'],
    '18half_monthly': ['18Monday']
};

function normalizeScheduleEntry(item) {
    if (typeof item === 'string') {
        return { channelId: item, mentionUserId: null };
    }
    return item;
}

function normalizeScheduleList(list) {
    if (!Array.isArray(list)) return [];
    return list.map(normalizeScheduleEntry);
}

function getConflictingGroups(groupName) {
    return MUTUALLY_EXCLUSIVE_GROUPS[groupName] || [];
}

function getChannelIdsFromGroups(data, groupNames) {
    const channelIds = new Set();

    for (const groupName of groupNames) {
        const entries = normalizeScheduleList(data[groupName]);

        for (const entry of entries) {
            if (entry.channelId) {
                channelIds.add(entry.channelId);
            }
        }
    }

    return channelIds;
}

module.exports = {
    getChannelIdsFromGroups,
    getConflictingGroups,
    normalizeScheduleList
};
