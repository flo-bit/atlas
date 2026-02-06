import type { POI } from './types';

const BASE_URL = 'https://nominatim.openstreetmap.org/search';

interface NominatimResult {
	place_id: number;
	display_name: string;
	lat: string;
	lon: string;
	type: string;
	class: string;
	osm_type?: string;
	osm_id?: number;
	address?: {
		road?: string;
		house_number?: string;
		city?: string;
		town?: string;
		village?: string;
		suburb?: string;
	};
}

function extractCategory(result: NominatimResult): string {
	if (result.type && result.type !== 'yes') return result.type.replace(/_/g, ' ');
	if (result.class) return result.class.replace(/_/g, ' ');
	return 'place';
}

function extractAddress(result: NominatimResult): string {
	const addr = result.address;
	if (!addr) {
		// Fall back to display_name minus the first part (which is the name)
		const parts = result.display_name.split(', ');
		return parts.slice(1, 4).join(', ');
	}
	const parts: string[] = [];
	if (addr.road) {
		parts.push(addr.house_number ? `${addr.house_number} ${addr.road}` : addr.road);
	}
	const locality = addr.city || addr.town || addr.village || addr.suburb;
	if (locality) parts.push(locality);
	return parts.join(', ');
}

export async function searchNominatim(
	query: string,
	options?: { limit?: number; proximity?: { latitude: number; longitude: number } }
): Promise<POI[]> {
	const params = new URLSearchParams({
		q: query,
		format: 'json',
		addressdetails: '1',
		limit: String(options?.limit ?? 5)
	});

	if (options?.proximity) {
		const { latitude, longitude } = options.proximity;
		const delta = 0.5;
		params.set(
			'viewbox',
			`${longitude - delta},${latitude + delta},${longitude + delta},${latitude - delta}`
		);
		params.set('bounded', '0');
	}

	const res = await fetch(`${BASE_URL}?${params}`, {
		headers: { 'Accept-Language': navigator.language || 'en' }
	});
	if (!res.ok) throw new Error(`Nominatim search failed: ${res.status}`);

	const data: NominatimResult[] = await res.json();

	return data.map((r) => {
		const namePart = r.display_name.split(',')[0].trim();
		return {
			name: namePart,
			category: extractCategory(r),
			address: extractAddress(r),
			latitude: r.lat,
			longitude: r.lon,
			osmType: r.osm_type,
			osmId: r.osm_id
		};
	});
}
