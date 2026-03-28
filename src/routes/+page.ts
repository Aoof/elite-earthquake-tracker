import type { PageLoad } from './$types';
import type { StyleSpecification } from 'maplibre-gl';

export const load: PageLoad = async ({ fetch }) => {
	try {
		// Fetch map style on server-side
		const styleResponse = await fetch('/api/maptiler');
		if (!styleResponse.ok) {
			throw new Error('Failed to load map style');
		}
		const mapStyle: StyleSpecification = await styleResponse.json();

		return {
			mapStyle
		};
	} catch (error) {
		console.error('Error loading map style:', error);
		return {
			mapStyle: null
		};
	}
};
