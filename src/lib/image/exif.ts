// Extract GPS coordinates from image files using EXIF data.
import exifr from 'exifr';

export interface GpsCoords {
	latitude: number;
	longitude: number;
}

export async function extractGps(file: File): Promise<GpsCoords | null> {
	try {
		const gps = await exifr.gps(file);
		if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
			return { latitude: gps.latitude, longitude: gps.longitude };
		}
		return null;
	} catch {
		return null;
	}
}

export async function extractGpsBatch(files: File[]): Promise<(GpsCoords | null)[]> {
	return Promise.all(files.map((f) => extractGps(f)));
}
