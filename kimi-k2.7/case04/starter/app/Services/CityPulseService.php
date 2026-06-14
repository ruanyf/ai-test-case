<?php

declare(strict_types=1);

namespace App\Services;

use Throwable;
use App\Data\GeoPlaceDto;
use Carbon\CarbonImmutable;
use App\Data\CityDashboardDto;
use App\Data\CitySearchResultDto;
use Illuminate\Support\Facades\Cache;
use App\Data\Mappers\NominatimMapper;
use App\Services\Clients\NominatimClient;
use App\Data\Mappers\OpenWeatherMapper;
use App\Services\Clients\OpenWeatherClient;

final class CityPulseService
{
    public function __construct(
        private readonly NominatimClient $nominatimClient,
        private readonly OpenWeatherClient $openWeatherClient,
    ) {
    }

    public function search(string $query): CitySearchResultDto
    {
        $normalizedQuery = $this->normalizeQuery($query);

        if ($normalizedQuery === '') {
            return new CitySearchResultDto(query: '', candidates: []);
        }

        $cacheKey = sprintf('city-pulse:geo:%s', sha1(mb_strtolower($normalizedQuery)));

        $rawCandidates = Cache::remember($cacheKey, now()->addHours(6), function () use ($normalizedQuery): array {
            return $this->nominatimClient->search($normalizedQuery, limit: 5);
        });

        return new CitySearchResultDto(
            query: $normalizedQuery,
            candidates: NominatimMapper::mapCandidates($rawCandidates),
        );
    }

    public function buildDashboard(GeoPlaceDto $place): CityDashboardDto
    {
        $units = (string) config('services.openweather.units', 'metric');
        $lat = number_format($place->lat, 3, '.', '');
        $lon = number_format($place->lon, 3, '.', '');

        $weatherPayload = Cache::remember(
            sprintf('city-pulse:weather:%s:%s:%s', $lat, $lon, $units),
            now()->addMinutes(10),
            function () use ($place, $units): array {
                return $this->openWeatherClient->currentWeather($place->lat, $place->lon, $units);
            }
        );

        $weather = OpenWeatherMapper::mapWeather($weatherPayload, $units);

        $airQuality = null;

        try {
            $airPayload = Cache::remember(
                sprintf('city-pulse:aqi:%s:%s', $lat, $lon),
                now()->addMinutes(10),
                function () use ($place): array {
                    return $this->openWeatherClient->airPollution($place->lat, $place->lon);
                }
            );

            $airQuality = OpenWeatherMapper::mapAirQuality($airPayload);
        } catch (Throwable $exception) {
            report($exception);
        }

        return new CityDashboardDto(
            place: $place,
            weather: $weather,
            airQuality: $airQuality,
            fetchedAt: CarbonImmutable::now(),
        );
    }

    private function normalizeQuery(string $query): string
    {
        return trim(preg_replace('/\s+/', ' ', $query) ?? '');
    }
}
