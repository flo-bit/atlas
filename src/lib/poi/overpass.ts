import type { POI } from './types';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

interface OverpassElement {
	type: string;
	id: number;
	lat?: number;
	lon?: number;
	center?: { lat: number; lon: number };
	tags: Record<string, string>;
}

interface OverpassResponse {
	elements: OverpassElement[];
}

function extractCategory(tags: Record<string, string>): string {
	for (const key of [
		'amenity',
		'shop',
		'tourism',
		'historic',
		'leisure',
		'man_made',
		'building',
		'office',
		'craft',
		'healthcare'
	]) {
		if (tags[key]) return tags[key];
	}
	return 'place';
}

function extractAddress(tags: Record<string, string>): string {
	const parts: string[] = [];
	if (tags['addr:street']) {
		if (tags['addr:housenumber']) {
			parts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`);
		} else {
			parts.push(tags['addr:street']);
		}
	}
	if (tags['addr:city']) parts.push(tags['addr:city']);
	return parts.join(', ');
}

export async function nearbyPOIs(
	latitude: number,
	longitude: number,
	options?: { radiusMeters?: number; signal?: AbortSignal }
): Promise<POI[]> {
	const radius = options?.radiusMeters ?? 100;
	const signal = options?.signal;

	const query = `
		[out:json][timeout:10];
		(
			nwr["name"]["amenity"](around:${radius},${latitude},${longitude});
			nwr["name"]["shop"](around:${radius},${latitude},${longitude});
			nwr["name"]["tourism"](around:${radius},${latitude},${longitude});
			nwr["name"]["historic"](around:${radius},${latitude},${longitude});
			nwr["name"]["leisure"](around:${radius},${latitude},${longitude});
			nwr["name"]["man_made"](around:${radius},${latitude},${longitude});
			nwr["name"]["building"]["wikidata"](around:${radius},${latitude},${longitude});
		);
		out body center;
	`;

	let lastError: Error | null = null;
	for (let attempt = 0; attempt < 3; attempt++) {
		signal?.throwIfAborted();

		if (attempt > 0) {
			await new Promise((r) => setTimeout(r, attempt === 1 ? 5000 : 15000));
			signal?.throwIfAborted();
		}

		const res = await fetch(OVERPASS_URL, {
			method: 'POST',
			body: `data=${encodeURIComponent(query)}`,
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			signal
		});

		if (res.status === 429) {
			lastError = new Error('Overpass rate limited (429)');
			continue;
		}
		if (!res.ok) throw new Error(`Overpass query failed: ${res.status}`);

		const data: OverpassResponse = await res.json();

		return data.elements
			.filter((el) => {
				if (!el.tags?.name) return false;
				return (el.lat != null && el.lon != null) || el.center != null;
			})
			.sort((a, b) => {
				const aLat = a.lat ?? a.center!.lat;
				const aLon = a.lon ?? a.center!.lon;
				const bLat = b.lat ?? b.center!.lat;
				const bLon = b.lon ?? b.center!.lon;
				const da = (aLat - latitude) ** 2 + (aLon - longitude) ** 2;
				const db = (bLat - latitude) ** 2 + (bLon - longitude) ** 2;
				return da - db;
			})
			.slice(0, 50)
			.map((el) => ({
				name: el.tags.name,
				category: extractCategory(el.tags),
				address: extractAddress(el.tags),
				latitude: String(el.lat ?? el.center!.lat),
				longitude: String(el.lon ?? el.center!.lon),
				osmType: el.type,
				osmId: el.id
			}));
	}

	throw lastError!;
}
