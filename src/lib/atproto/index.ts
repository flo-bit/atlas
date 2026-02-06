export { user, login, signup, logout, initClient } from './auth.svelte';
export { metadata } from './metadata';

export {
	createTID,
	parseUri,
	resolveHandle,
	getPDS,
	getDetailedProfile,
	getClient,
	listRecords,
	getRecord,
	putRecord,
	deleteRecord,
	uploadBlob,
	describeRepo,
	getBlobURL,
	getCDNImageBlobUrl,
	searchActorsTypeahead
} from './methods';

export { getCurrentPosition } from './geolocation';
export type { Coordinates } from './geolocation';
