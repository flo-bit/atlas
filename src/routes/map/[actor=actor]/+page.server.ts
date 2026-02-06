import { listRecords, resolveHandle } from '$lib/atproto';
import { MAIN_COLLECTION } from '$lib/atproto/settings.js';
import { isDid, isHandle } from '@atcute/lexicons/syntax';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
	let did = params.actor;

	if (isHandle(params.actor)) {
		did = await resolveHandle({ handle: params.actor });
	}

	if (!isDid(did)) {
		throw error(404, 'Not found');
	}

	const records = await listRecords({
		collection: MAIN_COLLECTION,
		limit: 0,
		did
	});

	return { records, did };
}
