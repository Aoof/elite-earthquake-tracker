# Elite Earthquake Tracker

This project was created as part of the ELITE club at College LaSalle. It's a web application built with SvelteKit that visualizes earthquake data on an interactive map.

## Major Components

- **Frontend**: Built with SvelteKit, featuring a responsive map interface using MapLibre GL.
- **Data Source**: Fetches real-time earthquake data from the USGS Earthquake API, filtering for earthquakes with magnitude 4.5+.
- **Map Styling**: Integrates with MapTiler for high-quality map tiles, with a fallback to OpenStreetMap.
- **UI Components**: Includes custom date pickers and sliders for filtering earthquakes by date range.
- **API Routes**: Server-side endpoints for handling map style requests.

## Features

- Interactive map displaying earthquake locations with color-coded markers based on magnitude.
- Date range filtering using calendar pickers and dual-range sliders.
- Popup details for each earthquake showing magnitude, location, and time.
- Responsive design with dark theme.

## Hosting on Vercel

1. **Connect Repository**: Sign up for Vercel and connect your GitHub repository.
2. **Configure Environment Variables**: Add your MapTiler API key as `MAPTILER_API` in Vercel's environment variables settings.
3. **Deploy**: Vercel will automatically detect SvelteKit and deploy the app. No additional configuration needed.
4. **Domain**: Once deployed, you can customize the domain or use the default Vercel URL.

For more details, check the [Vercel documentation for SvelteKit](https://vercel.com/docs/frameworks/sveltekit).
