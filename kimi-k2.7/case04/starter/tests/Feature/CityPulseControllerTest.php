<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CityPulseControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        Config::set('services.openweather.key', 'test-key');
        Config::set('services.openweather.units', 'metric');
        Config::set('services.nominatim.user_agent', 'city-pulse-tests/1.0 (tests@example.com)');
    }

    public function test_home_page_renders_successfully(): void
    {
        $response = $this->get('/');

        $response->assertOk();
        $response->assertSee('City Pulse');
        $response->assertSee('Search a city');
    }

    public function test_city_search_with_single_result_renders_dashboard(): void
    {
        Http::preventStrayRequests();

        Http::fake([
            'https://nominatim.openstreetmap.org/search*' => Http::response([$this->nominatimParis()], 200),
            'https://api.openweathermap.org/data/2.5/weather*' => Http::response($this->weatherPayload(), 200),
            'https://api.openweathermap.org/data/2.5/air_pollution*' => Http::response($this->airPayload(), 200),
        ]);

        $response = $this->get('/?city=Paris');

        $response->assertOk();
        $response->assertSee('Current weather');
        $response->assertSee('Map + coordinates');
        $response->assertSee('Air quality');
        $response->assertSee('Paris, Ile-de-France, France');
    }

    public function test_city_search_with_multiple_results_renders_city_chooser(): void
    {
        Http::preventStrayRequests();

        Http::fake([
            'https://nominatim.openstreetmap.org/search*' => Http::response([
                $this->nominatimSpringfield('Illinois', 39.799, -89.644),
                $this->nominatimSpringfield('Massachusetts', 42.101, -72.589),
            ], 200),
        ]);

        $response = $this->get('/?city=Springfield');

        $response->assertOk();
        $response->assertSee('Choose your city');
        $response->assertSee('Use this city');
        $response->assertDontSee('Map + coordinates');
    }

    public function test_no_matching_cities_shows_empty_state_message(): void
    {
        Http::preventStrayRequests();

        Http::fake([
            'https://nominatim.openstreetmap.org/search*' => Http::response([], 200),
        ]);

        $response = $this->get('/?city=NotARealPlace123');

        $response->assertOk();
        $response->assertSee('No matching cities found');
    }

    public function test_weather_api_failure_shows_fallback_error_message(): void
    {
        Http::preventStrayRequests();

        Http::fake([
            'https://nominatim.openstreetmap.org/search*' => Http::response([$this->nominatimParis()], 200),
            'https://api.openweathermap.org/data/2.5/weather*' => Http::response(['message' => 'error'], 500),
        ]);

        $response = $this->get('/?city=Paris');

        $response->assertOk();
        $response->assertSee('OpenWeather request failed with HTTP 500');
    }

    public function test_nominatim_block_response_shows_actionable_message(): void
    {
        Http::preventStrayRequests();

        Http::fake([
            'https://nominatim.openstreetmap.org/search*' => Http::response('blocked', 403),
        ]);

        $response = $this->get('/?city=Lisbon');

        $response->assertOk();
        $response->assertSee('Nominatim blocked this request');
        $response->assertSee('NOMINATIM_USER_AGENT');
    }

    public function test_missing_api_key_shows_setup_instructions(): void
    {
        Config::set('services.openweather.key', '');

        Http::preventStrayRequests();

        Http::fake([
            'https://nominatim.openstreetmap.org/search*' => Http::response([$this->nominatimParis()], 200),
        ]);

        $response = $this->get('/?city=Paris');

        $response->assertOk();
        $response->assertSee('Set OPENWEATHER_API_KEY in your .env file');
    }

    public function test_api_calls_are_cached_between_requests(): void
    {
        Http::preventStrayRequests();

        Http::fake([
            'https://nominatim.openstreetmap.org/search*' => Http::response([$this->nominatimOslo()], 200),
            'https://api.openweathermap.org/data/2.5/weather*' => Http::response($this->weatherPayload(), 200),
            'https://api.openweathermap.org/data/2.5/air_pollution*' => Http::response($this->airPayload(), 200),
        ]);

        $this->get('/?city=Oslo')->assertOk();
        $this->get('/?city=Oslo')->assertOk();

        Http::assertSentCount(3);
    }

    /**
     * @return array<string, mixed>
     */
    private function nominatimParis(): array
    {
        return [
            'lat' => '48.8535',
            'lon' => '2.3484',
            'name' => 'Paris',
            'display_name' => 'Paris, Ile-de-France, France',
            'address' => [
                'city' => 'Paris',
                'state' => 'Ile-de-France',
                'country' => 'France',
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function nominatimOslo(): array
    {
        return [
            'lat' => '59.9133',
            'lon' => '10.7389',
            'name' => 'Oslo',
            'display_name' => 'Oslo, Norway',
            'address' => [
                'city' => 'Oslo',
                'country' => 'Norway',
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function nominatimSpringfield(string $state, float $lat, float $lon): array
    {
        return [
            'lat' => (string) $lat,
            'lon' => (string) $lon,
            'name' => 'Springfield',
            'display_name' => sprintf('Springfield, %s, United States', $state),
            'address' => [
                'city' => 'Springfield',
                'state' => $state,
                'country' => 'United States',
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function weatherPayload(): array
    {
        return [
            'main' => [
                'temp' => 21.4,
                'feels_like' => 20.9,
                'humidity' => 63,
            ],
            'wind' => [
                'speed' => 4.2,
            ],
            'weather' => [
                [
                    'main' => 'Clouds',
                    'description' => 'broken clouds',
                    'icon' => '04d',
                ],
            ],
            'sys' => [
                'sunrise' => 1707206400,
                'sunset' => 1707243600,
            ],
            'timezone' => 3600,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function airPayload(): array
    {
        return [
            'list' => [
                [
                    'main' => [
                        'aqi' => 2,
                    ],
                    'components' => [
                        'pm2_5' => 5.2,
                        'pm10' => 10.3,
                        'no2' => 18.4,
                        'o3' => 41.2,
                    ],
                ],
            ],
        ];
    }
}
