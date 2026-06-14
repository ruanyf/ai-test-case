<?php

declare(strict_types=1);

namespace App\Data;

use Carbon\CarbonImmutable;

final readonly class CityDashboardDto
{
    public function __construct(
        public GeoPlaceDto $place,
        public WeatherNowDto $weather,
        public ?AirQualityDto $airQuality,
        public CarbonImmutable $fetchedAt,
    ) {
    }
}
