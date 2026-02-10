<?php

declare(strict_types=1);

namespace App\Data;

final readonly class AirQualityDto
{
    public function __construct(
        public int $aqiIndex,
        public string $aqiLabel,
        public ?float $pm25,
        public ?float $pm10,
        public ?float $no2,
        public ?float $o3,
    ) {
    }
}
