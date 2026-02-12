import { MAIN_COLLECTION } from '$lib/atproto/settings.js';

const recentRecordsURL = `https://jetstream-worker.flobit-dev.workers.dev/records/${MAIN_COLLECTION}?limit=100`;

const profilesURL = 'https://public.api.bsky.app/xrpc/app.bsky.actor.getProfiles';

function getImageUrl(record: Record<string, any>, did: string): string | undefined {
	const blob = record?.images?.[0]?.image;
	if (typeof blob === 'object' && blob?.$type === 'blob') {
		return `https://cdn.bsky.app/img/feed_thumbnail/plain/${did}/${blob.ref.$link}@webp`;
	}
}

export async function load({ fetch }) {
	const response = await fetch(recentRecordsURL);
	const data = await response.json();
	const records = data.records ?? [];

	const users: Record<string, { count: number; images: string[] }> = {};
	for (const record of records) {
		if (!users[record.did]) {
			users[record.did] = { count: 0, images: [] };
		}
		users[record.did].count++;
		if (users[record.did].images.length < 4) {
			const url = getImageUrl(record.record, record.did);
			if (url) users[record.did].images.push(url);
		}
	}

	const sorted = Object.entries(users)
		.map(([did, { count, images }]) => ({ did, count, images }))
		.sort((a, b) => b.count - a.count);

	const dids = sorted.map((e) => e.did);

	let profiles: Record<string, { handle: string; displayName?: string; avatar?: string }> = {};

	if (dids.length > 0) {
		const params = new URLSearchParams();
		for (const did of dids) {
			params.append('actors', did);
		}
		try {
			const res = await fetch(`${profilesURL}?${params.toString()}`);
			if (res.ok) {
				const json = await res.json();
				for (const profile of json.profiles) {
					profiles[profile.did] = {
						handle: profile.handle,
						displayName: profile.displayName,
						avatar: profile.avatar
					};
				}
			}
		} catch {
			// profiles will just be empty, DIDs shown as fallback
		}
	}

	return {
		leaderboard: sorted.map((entry) => ({
			...entry,
			profile: profiles[entry.did] || null
		}))
	};
}
