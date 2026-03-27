import { MAPTILER_API } from "$env/static/private";
import { json } from "@sveltejs/kit";

const MAPTILER_URL = `https://api.maptiler.com/maps/outdoor-v4/style.json?key=${MAPTILER_API}`;

// Fallback to OpenStreetMap style if MapTiler API key is not available
const FALLBACK_STYLE = {
	version: 8,
	name: "OpenStreetMap",
	sources: {
		osm: {
			type: "raster",
			url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
			tileSize: 256
		}
	},
	layers: [
		{
			id: "osm",
			type: "raster",
			source: "osm"
		}
	]
};

export async function GET() {
	try {
		// Check if API key is available
		if (!MAPTILER_API || MAPTILER_API === "" || MAPTILER_API.includes("Your_") || MAPTILER_API.includes("placeholder")) {
			console.warn("MapTiler API key not configured, using OpenStreetMap fallback");
			return json(FALLBACK_STYLE);
		}

		const response = await fetch(MAPTILER_URL);
		if (!response.ok) {
			throw new Error(`Failed to load map style: ${response.statusText}`);
		}
		const style = await response.json();
		return json(style);
	} catch (error) {
		console.error("Error loading map style, using fallback:", error);
		return json(FALLBACK_STYLE);
	}
}
