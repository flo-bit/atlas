import type { POI } from '$lib/poi';
import type { GpsCoords } from '$lib/image/exif';

const DB_NAME = 'atp-geo-img';
const DB_VERSION = 1;
const STORE_NAME = 'images';

export interface StoredImage {
	id: string;
	fileData: ArrayBuffer;
	fileType: string;
	filename: string;
	exifGps: GpsCoords | null;
	poi: POI | null;
	status: 'pending' | 'uploading' | 'done' | 'error';
	createdAt: number;
}

/** Reconstruct a Blob from stored ArrayBuffer + MIME type. */
export function storedImageToBlob(img: StoredImage): Blob {
	return new Blob([img.fileData], { type: img.fileType });
}

let db: IDBDatabase | null = null;

function getDB(): Promise<IDBDatabase> {
	if (db) return Promise.resolve(db);
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const store = req.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
			store.createIndex('status', 'status');
		};
		req.onsuccess = () => {
			db = req.result;
			resolve(db);
		};
		req.onerror = () => reject(req.error);
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

export async function saveImage(image: StoredImage): Promise<void> {
	const store = await tx('readwrite');
	await req(store.put(image));
}

export async function getImage(id: string): Promise<StoredImage | undefined> {
	const store = await tx('readonly');
	return req(store.get(id));
}

export async function getAllImages(): Promise<StoredImage[]> {
	const store = await tx('readonly');
	return req(store.getAll());
}

export async function updateImage(
	id: string,
	updates: Partial<Omit<StoredImage, 'id'>>
): Promise<void> {
	const store = await tx('readwrite');
	const existing = await req(store.get(id));
	if (!existing) return;
	await req(store.put({ ...existing, ...updates }));
}

export async function deleteImage(id: string): Promise<void> {
	const store = await tx('readwrite');
	await req(store.delete(id));
}

export async function clearImages(): Promise<void> {
	const store = await tx('readwrite');
	await req(store.clear());
}
