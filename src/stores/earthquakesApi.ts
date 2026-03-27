import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

export interface EarthquakeGeometry {
	type: 'Point';
	coordinates: [number, number, number]; // [longitude, latitude, depth]
}

export interface Earthquake {
	mag: number;
	place: string;
	time: number;
	updated: number;
	tz: number | null;
	url: string;
	detail: string;
	felt: number | null;
	cdi: number | null;
	mmi: number | null;
	alert: string | null;
	status: string;
	tsunami: number;
	sig: number;
	net: string;
	code: string;
	ids: string;
	sources: string;
	types: string;
	nst: number;
	dmin: number;
	rms: number;
	gap: number;
	magType: string;
	type: string;
	title: string;
	geometry: EarthquakeGeometry;
	id: string;
}

const API_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson';

export const earthquakes: Writable<Earthquake[]> = writable([]);
export const requestedStartDate: Writable<number> = writable(Date.now() - 7 * 24 * 60 * 60 * 1000);
export const requestedEndDate: Writable<number> = writable(Date.now());
export const isLoading: Writable<boolean> = writable(false);

export async function fetchEarthquakes(startDate: number, endDate: number): Promise<void> {
	isLoading.set(true);
	try {
		const startISO = new Date(startDate).toISOString();
		const endISO = new Date(endDate).toISOString();
		const response = await fetch(
			`${API_URL}&starttime=${startISO}&endtime=${endISO}&minmagnitude=4.5`
		);

		if (!response.ok) {
			throw new Error(`Failed to fetch earthquakes: ${response.statusText}`);
		}

		const data = await response.json();
		const earthquakeList: Earthquake[] = data.features.map((feature: any) => ({
			...feature.properties,
			geometry: feature.geometry
		}));
		earthquakes.set(earthquakeList);
	} catch (error) {
		console.error('Error fetching earthquake data:', error);
		earthquakes.set([]);
	} finally {
		isLoading.set(false);
	}
}
