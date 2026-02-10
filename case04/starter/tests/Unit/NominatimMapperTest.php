<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Data\Mappers\NominatimMapper;
use PHPUnit\Framework\TestCase;

class NominatimMapperTest extends TestCase
{
    public function test_it_maps_a_valid_nominatim_place_payload(): void
    {
        $dto = NominatimMapper::mapPlace([
            'lat' => '40.7128',
            'lon' => '-74.0060',
            'name' => 'New York',
            'display_name' => 'New York, New York, United States',
            'address' => [
                'city' => 'New York',
                'state' => 'New York',
                'country' => 'United States',
            ],
        ]);

        $this->assertNotNull($dto);
        $this->assertSame('New York', $dto->name);
        $this->assertSame('New York, United States', $dto->displayLabel);
        $this->assertSame(40.7128, $dto->lat);
        $this->assertSame(-74.006, $dto->lon);
    }

    public function test_it_returns_null_when_coordinates_are_missing(): void
    {
        $dto = NominatimMapper::mapPlace([
            'name' => 'Nowhere',
            'address' => [
                'country' => 'Nowhere',
            ],
        ]);

        $this->assertNull($dto);
    }

    public function test_it_filters_invalid_candidates_when_mapping_a_list(): void
    {
        $mapped = NominatimMapper::mapCandidates([
            [
                'lat' => '35.6764',
                'lon' => '139.6500',
                'name' => 'Tokyo',
                'address' => [
                    'city' => 'Tokyo',
                    'country' => 'Japan',
                ],
            ],
            [
                'lat' => 'invalid',
                'name' => 'Broken',
                'address' => [
                    'country' => 'Japan',
                ],
            ],
        ]);

        $this->assertCount(1, $mapped);
        $this->assertSame('Tokyo', $mapped[0]->name);
    }
}
