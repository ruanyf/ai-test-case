<?php

declare(strict_types=1);

namespace App\Data\Mappers;

use App\Data\GeoPlaceDto;

final class NominatimMapper
{
    /**
     * @param array<string, mixed> $payload
     */
    public static function mapPlace(array $payload): ?GeoPlaceDto
    {
        $lat = filter_var($payload['lat'] ?? null, FILTER_VALIDATE_FLOAT);
        $lon = filter_var($payload['lon'] ?? null, FILTER_VALIDATE_FLOAT);

        if ($lat === false || $lon === false) {
            return null;
        }

        $address = is_array($payload['address'] ?? null) ? $payload['address'] : [];

        $name = self::firstString([
            $payload['name'] ?? null,
            $address['city'] ?? null,
            $address['town'] ?? null,
            $address['village'] ?? null,
            $address['municipality'] ?? null,
            $address['county'] ?? null,
            $address['state_district'] ?? null,
            $payload['display_name'] ?? null,
        ]);

        $country = self::firstString([
            $address['country'] ?? null,
            $payload['display_name'] ?? null,
        ]);

        $state = self::firstString([
            $address['state'] ?? null,
            $address['county'] ?? null,
            $address['region'] ?? null,
        ]);

        if ($name === null || $country === null) {
            return null;
        }

        $displayLabel = self::buildDisplayLabel($name, $state, $country);

        return new GeoPlaceDto(
            name: $name,
            state: $state,
            country: $country,
            lat: (float) $lat,
            lon: (float) $lon,
            displayLabel: $displayLabel,
        );
    }

    /**
     * @param array<int, mixed> $payload
     * @return array<int, GeoPlaceDto>
     */
    public static function mapCandidates(array $payload): array
    {
        $mapped = [];

        foreach ($payload as $item) {
            if (! is_array($item)) {
                continue;
            }

            $place = self::mapPlace($item);

            if ($place === null) {
                continue;
            }

            $mapped[] = $place;
        }

        return $mapped;
    }

    /**
     * @param array<int, mixed> $values
     */
    private static function firstString(array $values): ?string
    {
        foreach ($values as $value) {
            if (! is_string($value)) {
                continue;
            }

            $normalized = trim(preg_replace('/\s+/', ' ', $value) ?? '');

            if ($normalized !== '') {
                return $normalized;
            }
        }

        return null;
    }

    private static function buildDisplayLabel(string $name, ?string $state, string $country): string
    {
        $parts = [$name];

        if ($state !== null && mb_strtolower($state) !== mb_strtolower($name)) {
            $parts[] = $state;
        }

        if (mb_strtolower($country) !== mb_strtolower($name)) {
            $parts[] = $country;
        }

        return implode(', ', array_values(array_unique($parts)));
    }
}
