import type { POI } from '$lib/poi';

const DB_NAME = 'atp-geo-img-pois';
const DB_VERSION = 1;
const STORE_NAME = 'pois';

interface CachedPOI {
	key: string;
	name: string;
	category: string;
	address: string;
	latitude: string;
	longitude: string;
	osmType?: string;
	osmId?: number;
	cachedAt: number;
}

let db: IDBDatabase | null = null;

function getDB(): Promise<IDBDatabase> {
	if (db) return Promise.resolve(db);
	return new Promise((resolve, reject) => {
		const r = indexedDB.open(DB_NAME, DB_VERSION);
		r.onupgradeneeded = () => {
			r.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
		};
		r.onsuccess = () => {
			db = r.result;
			resolve(db);
		};
		r.onerror = () => reject(r.error);
	});
}

function tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
	return getDB().then((d) => d.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
}

function req<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function makeKey(poi: POI): string {
	const name = poi.name.toLowerCase().trim();
	const lat = parseFloat(poi.latitude).toFixed(6);
	const lng = parseFloat(poi.longitude).toFixed(6);
	return `${name}|${lat}|${lng}`;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toPOI(cached: CachedPOI): POI {
	return {
		name: cached.name,
		category: cached.category,
		address: cached.address,
		latitude: cached.latitude,
		longitude: cached.longitude,
		osmType: cached.osmType,
		osmId: cached.osmId
	};
}

export async function cachePOIs(pois: POI[]): Promise<void> {
	const store = await tx('readwrite');
	const now = Date.now();
	for (const poi of pois) {
		const entry: CachedPOI = {
			key: makeKey(poi),
			name: poi.name,
			category: poi.category,
			address: poi.address,
			latitude: poi.latitude,
			longitude: poi.longitude,
			osmType: poi.osmType,
			osmId: poi.osmId,
			cachedAt: now
		};
		store.put(entry); // fire-and-forget within transaction
	}
	// wait for the transaction to complete
	await new Promise<void>((resolve, reject) => {
		store.transaction.oncomplete = () => resolve();
		store.transaction.onerror = () => reject(store.transaction.error);
	});
}

export async function searchCachedPOIs(opts: {
	query?: string;
	lat?: number;
	lng?: number;
	radiusKm?: number;
}): Promise<POI[]> {
	const store = await tx('readonly');
	const all: CachedPOI[] = await req(store.getAll());

	const { query, lat, lng, radiusKm } = opts;
	const q = query?.toLowerCase().trim();

	return all
		.filter((p) => {
			if (q) {
				const haystack = `${p.name} ${p.category} ${p.address}`.toLowerCase();
				if (!haystack.includes(q)) return false;
			}
			if (lat != null && lng != null && radiusKm != null) {
				const dist = haversineKm(lat, lng, parseFloat(p.latitude), parseFloat(p.longitude));
				if (dist > radiusKm) return false;
			}
			return true;
		})
		.map(toPOI);
}

export function mergePOIs(cached: POI[], fresh: POI[]): POI[] {
	const seen = new Map<string, POI>();
	// add cached first
	for (const poi of cached) {
		seen.set(makeKey(poi), poi);
	}
	// fresh wins — overwrites cached entries with same key
	for (const poi of fresh) {
		seen.set(makeKey(poi), poi);
	}
	return Array.from(seen.values());
}

export async function clearPOICache(): Promise<void> {
	const store = await tx('readwrite');
	await req(store.clear());
}
