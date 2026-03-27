import { writable } from "svelte/store";
import type { Writable } from "svelte/store";

type Earthquake = {
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
    geometry: {
        type: string;
        coordinates: [number, number, number];
    };
    id: string;
}

const API_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson"; // Public API so no API key needed; can be static

export const earthquakes : Writable<Earthquake[]> = writable([]);
export const requestedStartDate : Writable<number> = writable(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default to one week ago
export const requestedEndDate : Writable<number> = writable(Date.now());
export const isLoading : Writable<boolean> = writable(false);

export async function fetchEarthquakes(startDate: number, endDate: number) {
    isLoading.set(true);
    try {
        const response = await fetch(`${API_URL}&starttime=${new Date(startDate).toISOString()}&endtime=${new Date(endDate).toISOString()}`);
        const data = await response.json();
        earthquakes.set(data.features.map((feature: any) => feature.properties));
    } catch (error) {
        console.error("Error fetching earthquake data:", error);
    } finally {
        isLoading.set(false);
    }
}