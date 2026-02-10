<?php

declare(strict_types=1);

namespace App\Data;

use Carbon\CarbonImmutable;

final readonly class WeatherNowDto
{
    public function __construct(
        public float $temperature,
        public float $feelsLike,
        public int $humidity,
        public float $windSpeed,
        public string $windUnit,
        public string $condition,
        public string $description,
        public ?string $iconUrl,
        public CarbonImmutable $sunriseUtc,
        public CarbonImmutable $sunsetUtc,
        public int $timezoneOffset,
        public string $unitSymbol,
    ) {
    }

    public function sunriseLocal(): CarbonImmutable
    {
        return $this->sunriseUtc->addSeconds($this->timezoneOffset);
    }

    public function sunsetLocal(): CarbonImmutable
    {
        return $this->sunsetUtc->addSeconds($this->timezoneOffset);
    }
}
