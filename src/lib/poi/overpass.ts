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
	// Check common OSM tag keys that indicate category
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

/** Maps UI category keys to Overpass filter clauses */
export const CATEGORY_FILTERS: Record<string, string> = {
	restaurant: '["amenity"~"restaurant|fast_food|food_court"]',
	cafe: '["amenity"="cafe"]',
	bar: '["amenity"~"bar|pub|nightclub|biergarten"]',
	shop: '["shop"]',
	hotel: '["tourism"~"hotel|hostel|motel|guest_house|apartment"]',
	museum: '["tourism"~"museum|gallery|artwork"]["name"]',
	park: '["leisure"~"park|garden|nature_reserve|playground"]',
	transport: '["public_transport"~"station|stop_position|platform"]'
};

export async function nearbyPOIs(
	latitude: number,
	longitude: number,
	options?: { radiusMeters?: number; category?: string }
): Promise<POI[]> {
	const radius = options?.radiusMeters ?? 1000;
	const cat = options?.category;

	let filters: string;
	if (cat && CATEGORY_FILTERS[cat]) {
		const filter = CATEGORY_FILTERS[cat];
		filters = `nwr["name"]${filter}(around:${radius},${latitude},${longitude});`;
	} else {
		filters = `
			nwr["name"]["amenity"](around:${radius},${latitude},${longitude});
			nwr["name"]["shop"](around:${radius},${latitude},${longitude});
			nwr["name"]["tourism"](around:${radius},${latitude},${longitude});
			nwr["name"]["historic"](around:${radius},${latitude},${longitude});
			nwr["name"]["leisure"](around:${radius},${latitude},${longitude});
			nwr["name"]["man_made"](around:${radius},${latitude},${longitude});
			nwr["name"]["building"]["wikidata"](around:${radius},${latitude},${longitude});
		`;
	}

	const query = `
		[out:json][timeout:10];
		(
			${filters}
		);
		out body center;
	`;

	const res = await fetch(OVERPASS_URL, {
		method: 'POST',
		body: `data=${encodeURIComponent(query)}`,
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
	});

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
