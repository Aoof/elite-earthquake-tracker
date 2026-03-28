<script lang="ts">
	import { onMount } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { earthquakes, fetchEarthquakes, isLoading, type Earthquake } from '../stores/earthquakesApi';
	import { type DateValue, CalendarDate } from "@internationalized/date";
	import { Calendar } from "$lib/components/ui/calendar/index.js";
	import * as Popover from "$lib/components/ui/popover/index.js";
	import type { PageData } from './$types';

	const { Map, Marker, Popup } = maplibregl;

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let mapContainer: HTMLDivElement | undefined;
	let map: maplibregl.Map | undefined;
	let markers: maplibregl.Marker[] = [];
	let unsubscribeEarthquakes: (() => void) | undefined;

	// Local state for date inputs (calendar pickers)
	let startDateValue = $state<DateValue>(new CalendarDate(2026, 3, 20));
	let endDateValue = $state<DateValue>(new CalendarDate(2026, 3, 27));
	
	// Slider date range (derived from calendar dates, will be set in onMount)
	let sliderStartDate = $state<number>(0);
	let sliderEndDate = $state<number>(0);
	let sliderMin = $state<number>(0);
	let sliderMax = $state<number>(0);
	
	// Debounce timer for fetch requests
	let fetchDebounceTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		let isUnmounting = false;

		// Initialize dates on client side only (SSR safe)
		const now = Date.now();
		const today = new Date();
		const sevenDaysAgo = new Date(today);
		sevenDaysAgo.setDate(today.getDate() - 7);
		
		// Set calendar dates
		startDateValue = new CalendarDate(sevenDaysAgo.getFullYear(), sevenDaysAgo.getMonth() + 1, sevenDaysAgo.getDate());
		endDateValue = new CalendarDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
		
		// Set slider range based on calendar dates
		sliderMin = sevenDaysAgo.getTime();
		sliderMax = now;
		sliderStartDate = sevenDaysAgo.getTime();
		sliderEndDate = now;

		const initialize = async () => {
			if (!mapContainer || isUnmounting) return;

			try {
				// Use map style from load function
				const style = data.mapStyle;
				if (!style) {
					throw new Error('Map style not available');
				}

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

                        let d = new Date(quake.time);

						// Create popup with earthquake details
						const popupContent = `
							<h3 style="margin: 0 0 14px 0; font-size: 15px; font-weight: 600; color: #1f2937; line-height: 1.4;">${quake.title}</h3>
							
							<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" style="flex-shrink: 0;">
									<path d="M12 2L15.09 8.26H22L17.55 12.5L18.64 18.74L12 14.5L5.36 18.74L6.45 12.5L2 8.26H8.91L12 2Z"/>
								</svg>
								<div>
									<div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px;">Magnitude</div>
									<div style="font-weight: 700; font-size: 16px; color: #f59e0b;">${quake.mag}</div>
								</div>
							</div>

							<div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px;">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="flex-shrink: 0; margin-top: 2px;">
									<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
									<circle cx="12" cy="10" r="3"/>
								</svg>
								<div style="flex: 1;">
									<div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px;">Location</div>
									<div style="font-size: 13px; line-height: 1.4; color: #1f2937;">${quake.place}</div>
								</div>
							</div>

							<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" style="flex-shrink: 0;">
									<path d="M12 2v20M2 12h20"/>
									<path d="M12 6v12M6 12h12"/>
								</svg>
								<div>
									<div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px;">Depth</div>
									<div style="font-weight: 500; color: #1f2937;">${quake.geometry.coordinates[2]} km</div>
								</div>
							</div>

							<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2" style="flex-shrink: 0;">
									<circle cx="12" cy="12" r="10"/>
									<polyline points="12 6 12 12 16 14"/>
								</svg>
								<div style="flex: 1;">
									<div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px;">Time</div>
									<div style="font-size: 12px; color: #1f2937;">${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}</div>
								</div>
							</div>

						${quake.status ? `
							<div style="border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 10px; display: flex; align-items: center; gap: 10px;">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" style="flex-shrink: 0;">
									<polyline points="20 6 9 17 4 12"/>
								</svg>
								<div>
									<div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px;">Status</div>
									<div style="font-size: 13px; color: #10b981; font-weight: 500;">${quake.status}</div>
								</div>
							</div>
						` : ''}
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
			if (fetchDebounceTimer) {
				clearTimeout(fetchDebounceTimer);
			}
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

	// Handle date input changes (only from calendar picker)
	function handleStartDateChange(value: DateValue | undefined) {
		if (value) {
			startDateValue = value;
			const date = new Date(value.year, value.month - 1, value.day);
			const newStart = date.getTime();
			// Update slider min and automatically set left thumb to the new start date
			sliderMin = newStart;
			sliderStartDate = newStart;
			// Ensure end date is not before start date
			if (sliderEndDate < newStart) {
				sliderEndDate = newStart + 24 * 60 * 60 * 1000;
			}
			debouncedFetchEarthquakes();
		}
	}

	function handleEndDateChange(value: DateValue | undefined) {
		if (value) {
			endDateValue = value;
			const date = new Date(value.year, value.month - 1, value.day);
			const newEnd = date.getTime();
			// Update slider max and automatically set right thumb to the new end date
			sliderMax = newEnd;
			sliderEndDate = newEnd;
			// Ensure start date is not after end date
			if (sliderStartDate > newEnd) {
				sliderStartDate = newEnd - 24 * 60 * 60 * 1000;
			}
			debouncedFetchEarthquakes();
		}
	}

	// Handle slider changes (only updates slider, not calendar dates)
	function handleSliderStartChange(e: Event) {
		const input = e.target as HTMLInputElement;
		let newValue = parseInt(input.value);
		// Clamp start slider: can't exceed end slider
		if (newValue > sliderEndDate) {
			newValue = sliderEndDate;
		}
		sliderStartDate = newValue;
		debouncedFetchEarthquakes();
	}

	function handleSliderEndChange(e: Event) {
		const input = e.target as HTMLInputElement;
		let newValue = parseInt(input.value);
		// Clamp end slider: can't go before start slider
		if (newValue < sliderStartDate) {
			newValue = sliderStartDate;
		}
		sliderEndDate = newValue;
		debouncedFetchEarthquakes();
	}

	function debouncedFetchEarthquakes() {
		// Clear existing timer
		if (fetchDebounceTimer) {
			clearTimeout(fetchDebounceTimer);
		}
		// Set new timer - fetch after 500ms of inactivity
		fetchDebounceTimer = setTimeout(() => {
			updateDateRangeFilter();
		}, 500);
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
<div class="fixed top-0 w-full left-0 right-0 m-auto z-10 bg-gray-900 border border-gray-800 rounded-b-lg px-3 py-2 max-w-1/2">
	<div class="flex items-center gap-2 justify-center">
		<!-- Start date calendar -->
		<div class="flex flex-col">
			<label for="start-date" class="hidden">Start</label>
			<Popover.Root>
			<Popover.Trigger id="start-date" class="bg-gray-800 hover:bg-gray-700 text-gray-100 border border-gray-700 px-2 py-1 rounded text-xs font-medium transition whitespace-nowrap">
				{startDateValue ? `${String(startDateValue.day).padStart(2, '0')}/${String(startDateValue.month).padStart(2, '0')}/${startDateValue.year}` : "DD/MM/YYYY"}
				</Popover.Trigger>
				<Popover.Content class="w-auto p-0 bg-gray-900 border border-gray-800">
					<Calendar
						type="single"
						bind:value={startDateValue}
						onValueChange={handleStartDateChange}
						class="rounded-md"
						captionLayout="dropdown"
					/>
				</Popover.Content>
			</Popover.Root>
		</div>

		<!-- Dual-range slider -->
		<div class="flex-1 min-w-24 flex flex-col">
			<label for="left-thumb" class="text-xs text-gray-400 mb-1">Range: {new Date(sliderStartDate).toLocaleDateString()} - {new Date(sliderEndDate).toLocaleDateString()}</label>
			<div class="relative h-5 flex items-center">
				<!-- Background track -->
				<div class="absolute top-1/2 left-0 right-0 h-1 bg-gray-700 rounded-full transform -translate-y-1/2"></div>
				<!-- Highlighted center section -->
				<div 
					class="absolute top-1/2 h-1 bg-blue-500 rounded-full transform -translate-y-1/2"
					style="left: 0%; width: 100%;"
				></div>
				<!-- Start slider (left thumb) -->
				<input
					type="range"
					min={sliderMin}
					max={sliderMax}
                    name="left-thumb"
					bind:value={sliderStartDate}
					oninput={handleSliderStartChange}
					class="absolute top-1/2 left-0 w-full h-1 bg-transparent appearance-none cursor-pointer z-20 transform -translate-y-1/2"
				/>
				<!-- End slider (right thumb) -->
				<input
					type="range"
					min={sliderMin}
					max={sliderMax}
					bind:value={sliderEndDate}
                    name="right-thumb"
					oninput={handleSliderEndChange}
					class="absolute top-1/2 left-0 w-full h-1 bg-transparent appearance-none cursor-pointer z-10 transform -translate-y-1/2"
				/>
			</div>
		</div>

		<!-- End date calendar -->
		<div class="flex flex-col">
			<label for="end-date" class="hidden">End</label>
			<Popover.Root>
			<Popover.Trigger id="end-date" class="bg-gray-800 hover:bg-gray-700 text-gray-100 border border-gray-700 px-2 py-1 rounded text-xs font-medium transition whitespace-nowrap">
				{endDateValue ? `${String(endDateValue.day).padStart(2, '0')}/${String(endDateValue.month).padStart(2, '0')}/${endDateValue.year}` : "DD/MM/YYYY"}
				</Popover.Trigger>
				<Popover.Content class="w-auto p-0 bg-gray-900 border border-gray-800">
					<Calendar
						type="single"
						bind:value={endDateValue}
						onValueChange={handleEndDateChange}
						class="rounded-md"
						captionLayout="dropdown"
					/>
				</Popover.Content>
			</Popover.Root>
		</div>
	</div>
</div>

<!-- Fullscreen map container with top padding for controls -->
<div bind:this={mapContainer} class="h-screen w-screen pt-16"></div>

<!-- Loading indicator -->
{#if $isLoading}
	<div class="absolute left-4 top-24 rounded bg-gray-900 border border-gray-800 px-3 py-2 text-sm text-gray-200">
		Loading...
	</div>
{/if}

<!-- Info panel -->
<div class="absolute bottom-4 left-4 rounded bg-white border w-fit border-gray-300 px-3 py-2 text-center">
	<div class="bg-white p-1 mb-2 rounded max-w-32 flex items-center justify-center m-auto">
		<img src="/logo.PNG" alt="Logo" class="w-full h-auto" />
	</div>
	<p class="text-xs text-gray-800">Earthquakes 4.5+ • Click for details</p>
</div>

<style lang="postcss">
	:global(html),
	:global(body) {
		margin: 0;
		padding: 0;
		height: 100%;
		width: 100%;
		overflow: hidden;
		background-color: #111827;
		color: #e5e7eb;
	}

	:global(div#__layout) {
		height: 100%;
		width: 100%;
	}

	:global(.earthquake-marker-circle) {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		cursor: pointer;
		box-shadow: 0 0 8px rgba(0, 0, 0, 0.6);
		transition: all 0.15s ease;
		border: 1.5px solid rgba(255, 255, 255, 0.3);
	}

	:global(.earthquake-marker-circle:hover) {
		transform: scale(1.3);
		box-shadow: 0 0 12px rgba(0, 0, 0, 0.8);
		border-color: rgba(255, 255, 255, 0.7);
	}

	/* Custom slider styling */
	:global(input[type='range']) {
		-webkit-appearance: none;
		appearance: none;
		pointer-events: none;
	}

	:global(input[type='range']::-webkit-slider-thumb) {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #3b82f6;
		cursor: pointer;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
		transition: all 0.15s ease;
		pointer-events: auto;
		border: 1.5px solid rgba(255, 255, 255, 0.3);
	}

	:global(input[type='range']::-webkit-slider-thumb:hover) {
		background: #2563eb;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
		border-color: rgba(255, 255, 255, 0.6);
		transform: scale(1.1);
	}

	:global(input[type='range']::-moz-range-thumb) {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #3b82f6;
		cursor: pointer;
		border: 1.5px solid rgba(255, 255, 255, 0.3);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
		transition: all 0.15s ease;
		pointer-events: auto;
	}

	:global(input[type='range']::-moz-range-thumb:hover) {
		background: #2563eb;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
		border-color: rgba(255, 255, 255, 0.6);
		transform: scale(1.1);
	}

	:global(input[type='range']::-moz-range-track) {
		background: transparent;
		border: none;
	}

	/* Calendar dark mode */
	:global(.calendar) {
		background-color: #1f2937;
		color: #e5e7eb;
	}

	:global(.calendar button) {
		color: #e5e7eb;
		background-color: #374151;
	}

	:global(.calendar button:hover) {
		background-color: #4b5563;
	}

	/* MapLibre popup dark mode styling */
	:global(.mapboxgl-popup) {
		filter: none;
	}

	:global(.mapboxgl-popup-wrap) {
		background: transparent;
	}

	:global(.mapboxgl-popup-content) {
		background-color: #ffffff !important;
		color: #1f2937 !important;
		padding: 14px !important;
		max-width: 300px;
		border-radius: 8px !important;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1) !important;
		border: 1px solid #e5e7eb !important;
		font-family: system-ui, -apple-system, sans-serif;
	}

	:global(.mapboxgl-popup-close-button) {
		color: #6b7280;
		font-size: 20px;
		padding: 8px;
		margin: 4px;
	}

	:global(.mapboxgl-popup-close-button:hover) {
		color: #1f2937;
	}

	:global(.mapboxgl-popup-anchor-top .mapboxgl-popup-tip) {
		border-bottom-color: #ffffff !important;
	}

	:global(.mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip) {
		border-top-color: #ffffff !important;
	}

	:global(.mapboxgl-popup-anchor-left .mapboxgl-popup-tip) {
		border-right-color: #ffffff !important;
	}

	:global(.mapboxgl-popup-anchor-right .mapboxgl-popup-tip) {
		border-left-color: #ffffff !important;
	}
</style>
