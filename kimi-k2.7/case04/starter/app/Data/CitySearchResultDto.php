<?php

declare(strict_types=1);

namespace App\Data;

final readonly class CitySearchResultDto
{
    /**
     * @param array<int, GeoPlaceDto> $candidates
     */
    public function __construct(
        public string $query,
        public array $candidates,
    ) {
    }
}
