<?php

declare(strict_types=1);

namespace App\Services\Clients;

use RuntimeException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

final class OpenWeatherClient
{
    /**
     * @return array<string, mixed>
     */
    public function currentWeather(float $lat, float $lon, string $units = 'metric'): array
    {
        try {
            $response = Http::baseUrl((string) config('services.openweather.base_url', 'https://api.openweathermap.org/data/2.5'))
            ->acceptJson()
            ->timeout(8)
            ->get('/weather', [
                'lat' => $lat,
                'lon' => $lon,
                'units' => $units,
                'appid' => $this->apiKey(),
            ]);
        } catch (ConnectionException $exception) {
            throw new RuntimeException(
                'OpenWeather is not reachable right now. Check your network and OPENWEATHER_BASE_URL, then retry.',
                previous: $exception
            );
        }

        $this->handleErrorStatuses($response->status());

        try {
            $response->throw();
        } catch (RequestException $exception) {
            throw new RuntimeException(
                sprintf('OpenWeather request failed with HTTP %d. Please retry.', $response->status()),
                previous: $exception
            );
        }

        $data = $response->json();

        return is_array($data) ? $data : [];
    }

    /**
     * @return array<string, mixed>
     */
    public function airPollution(float $lat, float $lon): array
    {
        try {
            $response = Http::baseUrl((string) config('services.openweather.base_url', 'https://api.openweathermap.org/data/2.5'))
            ->acceptJson()
            ->timeout(8)
            ->get('/air_pollution', [
                'lat' => $lat,
                'lon' => $lon,
                'appid' => $this->apiKey(),
            ]);
        } catch (ConnectionException $exception) {
            throw new RuntimeException(
                'OpenWeather is not reachable right now. Check your network and OPENWEATHER_BASE_URL, then retry.',
                previous: $exception
            );
        }

        $this->handleErrorStatuses($response->status());

        try {
            $response->throw();
        } catch (RequestException $exception) {
            throw new RuntimeException(
                sprintf('OpenWeather request failed with HTTP %d. Please retry.', $response->status()),
                previous: $exception
            );
        }

        $data = $response->json();

        return is_array($data) ? $data : [];
    }

    private function apiKey(): string
    {
        $key = (string) config('services.openweather.key', '');

        if ($key === '') {
            throw new RuntimeException('Set OPENWEATHER_API_KEY in your .env file to enable weather and AQI data.');
        }

        return $key;
    }

    private function handleErrorStatuses(int $status): void
    {
        if ($status === 401) {
            throw new RuntimeException('OpenWeather rejected your key. Verify OPENWEATHER_API_KEY in .env.');
        }

        if ($status === 429) {
            throw new RuntimeException('OpenWeather rate limit reached. Wait briefly and retry.');
        }
    }
}
