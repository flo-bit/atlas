const recentRecordsURL =
	'https://jetstream-worker.flobit-dev.workers.dev/records/pics.atmo.atlas.v0?limit=100';

export async function load() {
	const response = await fetch(recentRecordsURL);

	const records = await response.json();

	return { records: records.records };
}
