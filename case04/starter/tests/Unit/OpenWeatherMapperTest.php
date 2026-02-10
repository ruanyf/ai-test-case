<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Data\Mappers\OpenWeatherMapper;
use PHPUnit\Framework\TestCase;

class OpenWeatherMapperTest extends TestCase
{
    public function test_it_maps_weather_payload_to_dto(): void
    {
        $dto = OpenWeatherMapper::mapWeather([
            'main' => [
                'temp' => 17.8,
                'feels_like' => 16.9,
                'humidity' => 72,
            ],
            'wind' => [
                'speed' => 3.4,
            ],
            'weather' => [
                [
                    'main' => 'Rain',
                    'description' => 'light rain',
                    'icon' => '10d',
                ],
            ],
            'sys' => [
                'sunrise' => 1707206400,
                'sunset' => 1707243600,
            ],
            'timezone' => 7200,
        ], 'metric');

        $this->assertSame(17.8, $dto->temperature);
        $this->assertSame(16.9, $dto->feelsLike);
        $this->assertSame(72, $dto->humidity);
        $this->assertSame('m/s', $dto->windUnit);
        $this->assertSame('°C', $dto->unitSymbol);
        $this->assertSame('Rain', $dto->condition);
        $this->assertSame('Light rain', $dto->description);
        $this->assertNotNull($dto->iconUrl);
        $this->assertSame('2024-02-06 10:00', $dto->sunriseLocal()->format('Y-m-d H:i'));
    }

    public function test_it_maps_air_quality_payload_to_dto(): void
    {
        $dto = OpenWeatherMapper::mapAirQuality([
            'list' => [
                [
                    'main' => ['aqi' => 4],
                    'components' => [
                        'pm2_5' => 32.6,
                        'pm10' => 48.2,
                        'no2' => 22.7,
                        'o3' => 77.5,
                    ],
                ],
            ],
        ]);

        $this->assertNotNull($dto);
        $this->assertSame(4, $dto->aqiIndex);
        $this->assertSame('Poor', $dto->aqiLabel);
        $this->assertSame(32.6, $dto->pm25);
        $this->assertSame(48.2, $dto->pm10);
    }

    public function test_it_returns_null_for_invalid_air_quality_payload(): void
    {
        $dto = OpenWeatherMapper::mapAirQuality([
            'list' => [
                [
                    'main' => ['aqi' => 0],
                    'components' => [],
                ],
            ],
        ]);

        $this->assertNull($dto);
    }
}
