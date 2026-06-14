<?php

declare(strict_types=1);

namespace App\Data\Mappers;

use App\Data\AirQualityDto;
use App\Data\WeatherNowDto;
use Carbon\CarbonImmutable;
use InvalidArgumentException;

final class OpenWeatherMapper
{
    /**
     * @param array<string, mixed> $payload
     */
    public static function mapWeather(array $payload, string $units = 'metric'): WeatherNowDto
    {
        $temperature = filter_var(data_get($payload, 'main.temp'), FILTER_VALIDATE_FLOAT);

        if ($temperature === false) {
            throw new InvalidArgumentException('OpenWeather weather response did not contain a valid temperature.');
        }

        $feelsLike = filter_var(data_get($payload, 'main.feels_like', $temperature), FILTER_VALIDATE_FLOAT);
        $humidity = filter_var(data_get($payload, 'main.humidity', 0), FILTER_VALIDATE_INT);
        $windSpeed = filter_var(data_get($payload, 'wind.speed', 0), FILTER_VALIDATE_FLOAT);

        $firstWeather = data_get($payload, 'weather.0', []);
        $description = is_array($firstWeather) ? (string) ($firstWeather['description'] ?? '') : '';
        $condition = is_array($firstWeather) ? (string) ($firstWeather['main'] ?? '') : '';
        $icon = is_array($firstWeather) ? (string) ($firstWeather['icon'] ?? '') : '';

        $sunriseTimestamp = filter_var(data_get($payload, 'sys.sunrise', time()), FILTER_VALIDATE_INT);
        $sunsetTimestamp = filter_var(data_get($payload, 'sys.sunset', time()), FILTER_VALIDATE_INT);
        $timezoneOffset = filter_var(data_get($payload, 'timezone', 0), FILTER_VALIDATE_INT);

        return new WeatherNowDto(
            temperature: (float) $temperature,
            feelsLike: $feelsLike === false ? (float) $temperature : (float) $feelsLike,
            humidity: $humidity === false ? 0 : (int) $humidity,
            windSpeed: $windSpeed === false ? 0.0 : (float) $windSpeed,
            windUnit: self::windUnit($units),
            condition: $condition !== '' ? $condition : 'Weather',
            description: $description !== '' ? ucfirst($description) : 'Current conditions',
            iconUrl: $icon !== '' ? sprintf('https://openweathermap.org/img/wn/%s@2x.png', $icon) : null,
            sunriseUtc: CarbonImmutable::createFromTimestampUTC($sunriseTimestamp === false ? time() : $sunriseTimestamp),
            sunsetUtc: CarbonImmutable::createFromTimestampUTC($sunsetTimestamp === false ? time() : $sunsetTimestamp),
            timezoneOffset: $timezoneOffset === false ? 0 : $timezoneOffset,
            unitSymbol: self::temperatureUnit($units),
        );
    }

    /**
     * @param array<string, mixed> $payload
     */
    public static function mapAirQuality(array $payload): ?AirQualityDto
    {
        $first = data_get($payload, 'list.0');

        if (! is_array($first)) {
            return null;
        }

        $index = filter_var(data_get($first, 'main.aqi'), FILTER_VALIDATE_INT);

        if ($index === false || $index < 1 || $index > 5) {
            return null;
        }

        return new AirQualityDto(
            aqiIndex: $index,
            aqiLabel: self::aqiLabel($index),
            pm25: self::nullableFloat(data_get($first, 'components.pm2_5')),
            pm10: self::nullableFloat(data_get($first, 'components.pm10')),
            no2: self::nullableFloat(data_get($first, 'components.no2')),
            o3: self::nullableFloat(data_get($first, 'components.o3')),
        );
    }

    private static function nullableFloat(mixed $value): ?float
    {
        $float = filter_var($value, FILTER_VALIDATE_FLOAT);

        return $float === false ? null : (float) $float;
    }

    private static function windUnit(string $units): string
    {
        return match ($units) {
            'imperial' => 'mph',
            default => 'm/s',
        };
    }

    private static function temperatureUnit(string $units): string
    {
        return match ($units) {
            'imperial' => '°F',
            'standard' => 'K',
            default => '°C',
        };
    }

    private static function aqiLabel(int $index): string
    {
        return match ($index) {
            1 => 'Good',
            2 => 'Fair',
            3 => 'Moderate',
            4 => 'Poor',
            5 => 'Very Poor',
        };
    }
}
