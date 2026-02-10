<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="description" content="City Pulse: a Laravel local-info dashboard demo using OpenWeather, Nominatim, DTO mapping, and caching.">

        <title>City Pulse</title>

        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
        <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
            integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
            crossorigin=""
        />

        @vite(['resources/css/app.css', 'resources/js/app.js'])
    </head>
    <body class="city-pulse-page">
        @php
            /** @var string $query */
            /** @var bool $searched */
            /** @var array<int, \App\Data\GeoPlaceDto> $candidates */
            /** @var \App\Data\CityDashboardDto|null $result */
            /** @var string|null $error */
            /** @var bool $showNoResults */

            $aqiBadgeClass = match ($result?->airQuality?->aqiIndex) {
                1 => 'aqi-good',
                2 => 'aqi-fair',
                3 => 'aqi-moderate',
                4 => 'aqi-poor',
                5 => 'aqi-very-poor',
                default => 'aqi-moderate',
            };

            $pollutantLabel = static fn (?float $value): string => $value === null
                ? 'n/a'
                : number_format($value, 1).' ug/m3';
        @endphp

        <div class="ambient-orb ambient-orb-one"></div>
        <div class="ambient-orb ambient-orb-two"></div>

        <div class="dashboard-shell">

            {{-- ── TOP BAR ── --}}
            <header class="top-bar fade-in fade-in-1">
                <div class="top-bar-left">
                    <h1 class="headline-font text-2xl leading-none text-[var(--cp-ink)] sm:text-3xl">City Pulse</h1>
                    <span class="tag-label hidden sm:inline-block">Laravel 12</span>
                    <span class="hidden text-xs text-[var(--cp-ink-muted)] tracking-wide font-medium lg:inline">{{ now()->format('l, F j, Y') }}</span>
                </div>
                <form method="GET" action="{{ route('city-pulse.index') }}" class="top-bar-search">
                    <input
                        id="city"
                        name="city"
                        type="text"
                        value="{{ $query }}"
                        class="search-input h-10 w-full rounded-none px-4 text-sm text-[var(--cp-ink)]"
                        placeholder="Search a city&hellip;"
                        autocomplete="off"
                    >
                    <button type="submit" class="pulse-button h-10 px-5 whitespace-nowrap text-xs">
                        Check pulse
                    </button>
                </form>
            </header>

            {{-- ── ERROR ── --}}
            @if ($error)
                <div class="dashboard-alert fade-in fade-in-2">
                    <span class="font-bold text-[var(--cp-bad)] uppercase text-[0.62rem] tracking-widest mr-2">Error</span>
                    <span class="text-sm text-[var(--cp-ink)]">{{ $error }}</span>
                </div>
            @endif

            {{-- ── NO RESULTS ── --}}
            @if ($showNoResults)
                <div class="dashboard-alert fade-in fade-in-2">
                    <span class="text-sm text-[var(--cp-ink-soft)]">No matching cities found. Try including a state or country (e.g. "Springfield, Illinois").</span>
                </div>
            @endif

            {{-- ── CANDIDATE DISAMBIGUATION ── --}}
            @if (count($candidates) > 1 && $result === null)
                <main class="dashboard-body dashboard-body--center fade-in fade-in-2">
                    <div class="w-full max-w-4xl">
                        <div class="mb-5 flex flex-wrap items-end justify-between gap-3 border-b-2 border-[var(--cp-ink)] pb-3">
                            <h2 class="headline-font text-3xl text-[var(--cp-ink)]">Choose your city</h2>
                            <p class="text-sm text-[var(--cp-ink-muted)]">{{ count($candidates) }} matches for &ldquo;{{ $query }}&rdquo;</p>
                        </div>
                        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            @foreach ($candidates as $index => $candidate)
                                <article class="glass-panel rounded-none p-5 fade-in" style="animation-delay: {{ 0.1 + $index * 0.06 }}s">
                                    <h3 class="headline-font text-xl text-[var(--cp-ink)]">{{ $candidate->name }}</h3>
                                    <p class="mt-1 text-sm text-[var(--cp-ink-soft)]">{{ $candidate->displayLabel }}</p>
                                    <p class="mt-1.5 font-mono text-[0.68rem] text-[var(--cp-ink-muted)] tracking-wider">
                                        {{ number_format($candidate->lat, 3) }}&deg;, {{ number_format($candidate->lon, 3) }}&deg;
                                    </p>
                                    <form method="GET" action="{{ route('city-pulse.index') }}" class="mt-4">
                                        <input type="hidden" name="city" value="{{ $query }}">
                                        <input type="hidden" name="place" value="{{ $candidate->toPayload() }}">
                                        <button type="submit" class="ghost-button h-10 w-full text-xs">
                                            Use this city
                                        </button>
                                    </form>
                                </article>
                            @endforeach
                        </div>
                    </div>
                </main>
            @endif

            {{-- ── DASHBOARD RESULTS ── --}}
            @if ($result)
                @php
                    $sunrise = $result->weather->sunriseLocal()->format('H:i');
                    $sunset = $result->weather->sunsetLocal()->format('H:i');
                @endphp

                <main class="dashboard-body">
                    <div class="dashboard-grid">

                        {{-- Weather card --}}
                        <article class="glass-panel card-weather p-5 xl:p-6 fade-in fade-in-2">
                            <div class="flex flex-wrap items-start justify-between gap-2">
                                <div class="min-w-0">
                                    <p class="section-label text-[var(--cp-accent)]">Current weather</p>
                                    <h2 class="headline-font mt-2 text-2xl leading-tight text-[var(--cp-ink)] xl:text-3xl truncate">
                                        {{ $result->place->displayLabel }}
                                    </h2>
                                    <p class="mt-1 text-sm text-[var(--cp-ink-soft)] italic">{{ $result->weather->description }}</p>
                                </div>
                                @if ($result->weather->iconUrl)
                                    <img
                                        src="{{ $result->weather->iconUrl }}"
                                        alt="{{ $result->weather->condition }} icon"
                                        class="h-16 w-16 border-2 border-[var(--cp-rule-dark)] bg-[var(--cp-card-alt)] p-0.5 shrink-0"
                                    >
                                @endif
                            </div>

                            <div class="mt-4 grid gap-2 grid-cols-3">
                                <div class="metric-card">
                                    <p class="text-[0.58rem] uppercase tracking-[0.2em] text-[var(--cp-ink-muted)] font-bold">Temp</p>
                                    <p class="headline-font mt-1 text-xl text-[var(--cp-ink)] xl:text-2xl">
                                        {{ number_format($result->weather->temperature, 1) }}{{ $result->weather->unitSymbol }}
                                    </p>
                                </div>
                                <div class="metric-card">
                                    <p class="text-[0.58rem] uppercase tracking-[0.2em] text-[var(--cp-ink-muted)] font-bold">Feels like</p>
                                    <p class="headline-font mt-1 text-xl text-[var(--cp-ink)] xl:text-2xl">
                                        {{ number_format($result->weather->feelsLike, 1) }}{{ $result->weather->unitSymbol }}
                                    </p>
                                </div>
                                <div class="metric-card">
                                    <p class="text-[0.58rem] uppercase tracking-[0.2em] text-[var(--cp-ink-muted)] font-bold">Wind</p>
                                    <p class="headline-font mt-1 text-xl text-[var(--cp-ink)] xl:text-2xl">
                                        {{ number_format($result->weather->windSpeed, 1) }} <span class="text-sm">{{ $result->weather->windUnit }}</span>
                                    </p>
                                </div>
                            </div>
                        </article>

                        {{-- Daylight card --}}
                        <article class="glass-panel card-daylight p-5 xl:p-6 fade-in fade-in-3">
                            <p class="section-label text-[var(--cp-warn)]">Daylight</p>
                            <h3 class="headline-font mt-2 text-xl text-[var(--cp-ink)] xl:text-2xl">Sunset {{ $sunset }}</h3>
                            <div class="mt-3 space-y-0 text-sm">
                                <div class="sun-row">
                                    <span class="text-[var(--cp-ink-soft)]">Sunrise</span>
                                    <span class="font-bold text-[var(--cp-ink)] font-mono text-xs">{{ $sunrise }}</span>
                                </div>
                                <div class="sun-row">
                                    <span class="text-[var(--cp-ink-soft)]">Sunset</span>
                                    <span class="font-bold text-[var(--cp-ink)] font-mono text-xs">{{ $sunset }}</span>
                                </div>
                            </div>
                            <p class="mt-3 text-[0.62rem] text-[var(--cp-ink-muted)]">
                                Adjusted via OpenWeather timezone offset.
                            </p>
                        </article>

                        {{-- Air Quality card --}}
                        <article class="glass-panel card-aqi p-5 xl:p-6 fade-in fade-in-3">
                            <div class="flex items-center justify-between gap-3">
                                <p class="section-label text-[var(--cp-sky)]">Air quality</p>
                                @if ($result->airQuality)
                                    <span class="aqi-badge {{ $aqiBadgeClass }}">AQI {{ $result->airQuality->aqiIndex }}</span>
                                @endif
                            </div>

                            @if ($result->airQuality)
                                <h3 class="headline-font mt-2 text-xl text-[var(--cp-ink)] xl:text-2xl">{{ $result->airQuality->aqiLabel }}</h3>

                                <div class="mt-3 space-y-0 text-sm">
                                    <div class="pollutant-row">
                                        <span class="text-[var(--cp-ink-soft)]">PM2.5</span>
                                        <span class="font-mono text-xs text-[var(--cp-ink)]">{{ $pollutantLabel($result->airQuality->pm25) }}</span>
                                    </div>
                                    <div class="pollutant-row">
                                        <span class="text-[var(--cp-ink-soft)]">PM10</span>
                                        <span class="font-mono text-xs text-[var(--cp-ink)]">{{ $pollutantLabel($result->airQuality->pm10) }}</span>
                                    </div>
                                    <div class="pollutant-row">
                                        <span class="text-[var(--cp-ink-soft)]">NO<sub>2</sub></span>
                                        <span class="font-mono text-xs text-[var(--cp-ink)]">{{ $pollutantLabel($result->airQuality->no2) }}</span>
                                    </div>
                                    <div class="pollutant-row">
                                        <span class="text-[var(--cp-ink-soft)]">O<sub>3</sub></span>
                                        <span class="font-mono text-xs text-[var(--cp-ink)]">{{ $pollutantLabel($result->airQuality->o3) }}</span>
                                    </div>
                                </div>
                            @else
                                <p class="mt-3 text-sm text-[var(--cp-ink-muted)]">
                                    AQI unavailable for this location.
                                </p>
                            @endif
                        </article>

                        {{-- Map card --}}
                        <article class="glass-panel card-map p-5 xl:p-6 flex flex-col fade-in fade-in-4">
                            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                                <p class="section-label text-[var(--cp-ink)]">Map</p>
                                <p class="font-mono text-[0.65rem] text-[var(--cp-ink-muted)] tracking-wider">
                                    {{ number_format($result->place->lat, 5) }}&deg;, {{ number_format($result->place->lon, 5) }}&deg;
                                </p>
                            </div>
                            <div class="map-wrap flex-1 min-h-0 overflow-hidden border-2 border-[var(--cp-rule-dark)]">
                                <div id="city-map"></div>
                            </div>
                        </article>
                    </div>
                </main>

            {{-- ── EMPTY STATE ── --}}
            @elseif (! $searched)
                <main class="dashboard-body dashboard-body--center fade-in fade-in-2">
                    <div class="text-center max-w-lg">
                        <p class="text-[0.62rem] font-bold uppercase tracking-[0.25em] text-[var(--cp-ink-muted)] mb-4">&mdash; Awaiting input &mdash;</p>
                        <h2 class="headline-font text-4xl text-[var(--cp-ink)] sm:text-5xl">Type a city to start</h2>
                        <p class="mx-auto mt-4 text-sm text-[var(--cp-ink-soft)] sm:text-base leading-relaxed">
                            Search any city and City Pulse will render weather, daylight, AQI &amp; map context through Laravel services and DTOs.
                        </p>
                    </div>
                </main>
            @endif

            {{-- ── STATUS BAR ── --}}
            <footer class="status-bar fade-in fade-in-5">
                <span>City Pulse</span>
                <span class="hidden sm:inline">&middot;</span>
                <span class="hidden sm:inline">Nominatim + OpenWeather</span>
                <span>&middot;</span>
                <span>Laravel 12</span>
            </footer>
        </div>

        <script
            src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
            integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
            crossorigin=""
        ></script>

        @if ($result)
            <script>
                document.addEventListener('DOMContentLoaded', function () {
                    const mapElement = document.getElementById('city-map');

                    if (!mapElement || typeof L === 'undefined') {
                        return;
                    }

                    const lat = {{ number_format($result->place->lat, 6, '.', '') }};
                    const lon = {{ number_format($result->place->lon, 6, '.', '') }};
                    const label = @json($result->place->displayLabel);

                    const map = L.map(mapElement, {
                        zoomControl: false,
                        scrollWheelZoom: false,
                    }).setView([lat, lon], 11);

                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        maxZoom: 19,
                        attribution: '&copy; OpenStreetMap contributors',
                    }).addTo(map);

                    L.control.zoom({ position: 'bottomright' }).addTo(map);

                    L.circleMarker([lat, lon], {
                        radius: 10,
                        color: '#c4501a',
                        weight: 2,
                        fillColor: '#c4501a',
                        fillOpacity: 0.3,
                    })
                        .addTo(map)
                        .bindPopup(label)
                        .openPopup();
                });
            </script>
        @endif
    </body>
</html>
