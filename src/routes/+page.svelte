<script lang="ts">
	import { onMount } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import type { StyleSpecification } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { earthquakes, fetchEarthquakes, requestedStartDate, requestedEndDate, isLoading, type Earthquake } from '../stores/earthquakesApi';

	const { Map, Marker, Popup } = maplibregl;

	let mapContainer: HTMLDivElement | undefined;
	let map: maplibregl.Map | undefined;
	let markers: maplibregl.Marker[] = [];
	let unsubscribeEarthquakes: (() => void) | undefined;

	// Local state for date inputs
	let startDateInput: string;
	let endDateInput: string;
	let sliderStartDate: number;
	let sliderEndDate: number;

	onMount(() => {
		// Initialize date inputs with store values
		const startDate = new Date($requestedStartDate);
		const endDate = new Date($requestedEndDate);
		
		startDateInput = startDate.toISOString().split('T')[0];
		endDateInput = endDate.toISOString().split('T')[0];
		sliderStartDate = $requestedStartDate;
		sliderEndDate = $requestedEndDate;

		let isUnmounting = false;

		const initialize = async () => {
			if (!mapContainer || isUnmounting) return;

			try {
				// Fetch map style from our API
				const styleResponse = await fetch('/api/maptiler');
				if (!styleResponse.ok) {
					throw new Error('Failed to load map style');
				}
				const style: StyleSpecification = await styleResponse.json();

				// Initialize map with MapTiler style
				map = new Map({
					container: mapContainer,
					style: style,
					center: [0, 15],
					zoom: 2
				});

				// Wait for map to load
				await new Promise<void>((resolve) => {
					if (map?.loaded()) {
						resolve();
					} else {
						map?.on('load', () => resolve());
					}
				});

				if (isUnmounting) return;

				// Fetch earthquakes data
				await fetchEarthquakes(sliderStartDate, sliderEndDate);

				// Subscribe to earthquakes store and update markers
				unsubscribeEarthquakes = earthquakes.subscribe((quakeData: Earthquake[]) => {
					// Clear existing markers
					markers.forEach((marker) => marker.remove());
					markers = [];

					// Add new markers for each earthquake
					quakeData.forEach((quake) => {
						const [lng, lat] = quake.geometry.coordinates;

						// Create popup with earthquake details
						const popupContent = `
							<div style="padding: 8px;">
								<h3 style="margin: 0 0 4px 0; font-weight: bold;">${quake.title}</h3>
								<p style="margin: 2px 0;">Magnitude: <strong>${quake.mag}</strong></p>
								<p style="margin: 2px 0;">Location: ${quake.place}</p>
								<p style="margin: 2px 0;">Depth: ${quake.geometry.coordinates[2]} km</p>
								<p style="margin: 2px 0;">Time: ${new Date(quake.time).toLocaleString()}</p>
								${quake.status ? `<p style="margin: 2px 0;">Status: ${quake.status}</p>` : ''}
							</div>
						`;

						// Create custom circle marker element
						const markerEl = document.createElement('div');
						markerEl.className = 'earthquake-marker-circle';
						markerEl.style.backgroundColor = getMagnitudeColor(quake.mag);
						markerEl.title = quake.title;

						// Create and add marker with custom element
						const marker = new Marker({ element: markerEl })
							.setLngLat([lng, lat])
							.setPopup(new Popup({ offset: 25 }).setHTML(popupContent))
							.addTo(map!);

						markers.push(marker);
					});
				});
			} catch (error) {
				console.error('Error initializing map:', error);
			}
		};

		initialize();

		// Return cleanup function
		return () => {
			isUnmounting = true;
			if (unsubscribeEarthquakes) {
				unsubscribeEarthquakes();
			}
			markers.forEach((marker) => marker.remove());
			map?.remove();
		};
	});

	// Helper function to get marker color based on magnitude
	function getMagnitudeColor(magnitude: number): string {
		if (magnitude >= 7) return '#8b0000'; // Dark red for major quakes
		if (magnitude >= 6) return '#ff0000'; // Red for strong quakes
		if (magnitude >= 5) return '#ff6600'; // Orange for moderate quakes
		if (magnitude >= 4.5) return '#ffff00'; // Yellow for minor quakes
		return '#00ff00'; // Green for very minor quakes
	}

	// Handle date input changes
	function handleStartDateChange(e: Event) {
		const input = e.target as HTMLInputElement;
		startDateInput = input.value;
		const date = new Date(input.value);
		sliderStartDate = date.getTime();
		updateDateRangeFilter();
	}

	function handleEndDateChange(e: Event) {
		const input = e.target as HTMLInputElement;
		endDateInput = input.value;
		const date = new Date(input.value);
		sliderEndDate = date.getTime();
		updateDateRangeFilter();
	}

	// Handle slider changes
	function handleSliderStartChange(e: Event) {
		const input = e.target as HTMLInputElement;
		sliderStartDate = parseInt(input.value);
		// Update calendar input to reflect slider
		const date = new Date(sliderStartDate);
		startDateInput = date.toISOString().split('T')[0];
		updateDateRangeFilter();
	}

	function handleSliderEndChange(e: Event) {
		const input = e.target as HTMLInputElement;
		sliderEndDate = parseInt(input.value);
		// Update calendar input to reflect slider
		const date = new Date(sliderEndDate);
		endDateInput = date.toISOString().split('T')[0];
		updateDateRangeFilter();
	}

	function updateDateRangeFilter() {
		// Ensure start is before end
		if (sliderStartDate >= sliderEndDate) {
			sliderEndDate = sliderStartDate + 24 * 60 * 60 * 1000;
		}
		fetchEarthquakes(sliderStartDate, sliderEndDate);
	}
</script>

<!-- Date range picker at top -->
<div class="fixed top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-black/40 backdrop-blur-sm p-6">
	<div class="max-w-6xl mx-auto flex items-center gap-4">
		<!-- Start date calendar -->
		<div class="flex flex-col">
			<label class="text-xs text-gray-300 mb-1">Start Date</label>
			<input
				type="date"
				bind:value={startDateInput}
				on:change={handleStartDateChange}
				class="px-3 py-2 bg-gray-900 text-white border border-gray-700 rounded-lg text-sm hover:border-gray-500 focus:outline-none focus:border-blue-500"
			/>
		</div>

		<!-- Start date slider -->
		<div class="flex-1 flex flex-col">
			<label class="text-xs text-gray-300 mb-2">Start: {new Date(sliderStartDate).toLocaleDateString()}</label>
			<input
				type="range"
				min={new Date().getTime() - 365 * 24 * 60 * 60 * 1000}
				max={new Date().getTime()}
				bind:value={sliderStartDate}
				on:input={handleSliderStartChange}
				class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
			/>
		</div>

		<!-- Middle spacer -->
		<div class="text-gray-400">→</div>

		<!-- End date slider -->
		<div class="flex-1 flex flex-col">
			<label class="text-xs text-gray-300 mb-2">End: {new Date(sliderEndDate).toLocaleDateString()}</label>
			<input
				type="range"
				min={new Date().getTime() - 365 * 24 * 60 * 60 * 1000}
				max={new Date().getTime()}
				bind:value={sliderEndDate}
				on:input={handleSliderEndChange}
				class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
			/>
		</div>

		<!-- End date calendar -->
		<div class="flex flex-col">
			<label class="text-xs text-gray-300 mb-1">End Date</label>
			<input
				type="date"
				bind:value={endDateInput}
				on:change={handleEndDateChange}
				class="px-3 py-2 bg-gray-900 text-white border border-gray-700 rounded-lg text-sm hover:border-gray-500 focus:outline-none focus:border-blue-500"
			/>
		</div>
	</div>
</div>

<!-- Fullscreen map container with top padding for controls -->
<div bind:this={mapContainer} class="h-screen w-screen pt-24"></div>

<!-- Loading indicator -->
{#if $isLoading}
	<div class="absolute left-4 top-28 rounded-lg bg-black/70 px-4 py-2 text-white">
		Loading earthquakes...
	</div>
{/if}

<!-- Info panel -->
<div class="absolute bottom-4 left-4 rounded-lg bg-black/70 px-4 py-3 text-white">
	<p class="text-sm"><strong>Earthquakes shown:</strong> Magnitude 4.5+</p>
	<p class="text-xs text-gray-300 mt-1">Click markers for details</p>
</div>

<style lang="postcss">
	:global(html),
	:global(body) {
		margin: 0;
		padding: 0;
		height: 100%;
		width: 100%;
		overflow: hidden;
	}

	:global(div#__layout) {
		height: 100%;
		width: 100%;
	}

	:global(.earthquake-marker-circle) {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		cursor: pointer;
		box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
		transition: transform 0.2s ease;
		border: 2px solid rgba(255, 255, 255, 0.3);
	}

	:global(.earthquake-marker-circle:hover) {
		transform: scale(1.3);
		box-shadow: 0 0 12px rgba(0, 0, 0, 0.7);
		border-color: rgba(255, 255, 255, 0.8);
	}

	/* Custom slider styling */
	:global(input[type='range']) {
		-webkit-appearance: none;
		appearance: none;
	}

	:global(input[type='range']::-webkit-slider-thumb) {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #3b82f6;
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
		transition: all 0.2s ease;
	}

	:global(input[type='range']::-webkit-slider-thumb:hover) {
		background: #2563eb;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
		transform: scale(1.1);
	}

	:global(input[type='range']::-moz-range-thumb) {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #3b82f6;
		cursor: pointer;
		border: none;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
		transition: all 0.2s ease;
	}

	:global(input[type='range']::-moz-range-thumb:hover) {
		background: #2563eb;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
		transform: scale(1.1);
	}
</style>
