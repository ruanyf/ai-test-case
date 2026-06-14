<?php

declare(strict_types=1);

namespace App\Data;

use JsonException;

final readonly class GeoPlaceDto
{
    public function __construct(
        public string $name,
        public ?string $state,
        public string $country,
        public float $lat,
        public float $lon,
        public string $displayLabel,
    ) {
    }

    public function toPayload(): string
    {
        $json = json_encode([
            'name' => $this->name,
            'state' => $this->state,
            'country' => $this->country,
            'lat' => $this->lat,
            'lon' => $this->lon,
            'displayLabel' => $this->displayLabel,
        ], JSON_THROW_ON_ERROR);

        return rtrim(strtr(base64_encode($json), '+/', '-_'), '=');
    }

    public static function fromPayload(?string $payload): ?self
    {
        if (! is_string($payload) || $payload === '') {
            return null;
        }

        $decoded = base64_decode(strtr($payload, '-_', '+/'), true);

        if ($decoded === false) {
            return null;
        }

        try {
            $data = json_decode($decoded, true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return null;
        }

        if (! is_array($data)) {
            return null;
        }

        $name = self::sanitizeText($data['name'] ?? null, max: 80);
        $country = self::sanitizeText($data['country'] ?? null, max: 80);
        $displayLabel = self::sanitizeText($data['displayLabel'] ?? null, max: 140);
        $state = self::sanitizeText($data['state'] ?? null, max: 80, allowNull: true);

        if ($name === null || $country === null || $displayLabel === null) {
            return null;
        }

        $lat = filter_var($data['lat'] ?? null, FILTER_VALIDATE_FLOAT);
        $lon = filter_var($data['lon'] ?? null, FILTER_VALIDATE_FLOAT);

        if ($lat === false || $lon === false) {
            return null;
        }

        if ($lat < -90 || $lat > 90 || $lon < -180 || $lon > 180) {
            return null;
        }

        return new self(
            name: $name,
            state: $state,
            country: $country,
            lat: (float) $lat,
            lon: (float) $lon,
            displayLabel: $displayLabel,
        );
    }

    public function isSamePlace(self $other): bool
    {
        return abs($this->lat - $other->lat) < 0.0001
            && abs($this->lon - $other->lon) < 0.0001
            && mb_strtolower($this->displayLabel) === mb_strtolower($other->displayLabel);
    }

    private static function sanitizeText(
        mixed $value,
        int $max,
        bool $allowNull = false,
    ): ?string {
        if ($value === null && $allowNull) {
            return null;
        }

        if (! is_string($value)) {
            return null;
        }

        $trimmed = trim(preg_replace('/\s+/', ' ', $value) ?? '');

        if ($trimmed === '') {
            return null;
        }

        if (mb_strlen($trimmed) > $max) {
            return null;
        }

        return $trimmed;
    }
}
