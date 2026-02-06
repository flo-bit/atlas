interface GeoLocation {
	$type?: string;
	latitude: string;
	longitude: string;
}

interface RecordValue {
	location?: GeoLocation[];
	name?: string;
	[key: string]: unknown;
}

/**
 * Extract location info from a record's `location` array.
 * Returns the first geo location entry, or undefined if none.
 */
export function getLocationFromRecord(
	value: RecordValue
): { latitude: string; longitude: string; name: string } | undefined {
	const loc = value.location?.[0];
	if (!loc || !loc.latitude || !loc.longitude) return undefined;
	return {
		latitude: loc.latitude,
		longitude: loc.longitude,
		name: value.name ?? ''
	};
}

/**
 * Get a human-readable label for a record's location.
 * Shows name if available, otherwise falls back to coordinates.
 */
export function getLocationLabel(value: RecordValue): string {
	const loc = getLocationFromRecord(value);
	if (!loc) return '';
	if (loc.name) return loc.name;
	return `${Number(loc.latitude).toFixed(5)}, ${Number(loc.longitude).toFixed(5)}`;
}

/**
 * Check whether a record has valid location data.
 */
export function hasLocation(value: RecordValue): boolean {
	const loc = getLocationFromRecord(value);
	if (!loc) return false;
	return !isNaN(Number(loc.latitude)) && !isNaN(Number(loc.longitude));
}
