<?php

declare(strict_types=1);

namespace App\Services\Clients;

use RuntimeException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

final class NominatimClient
{
    /**
     * @return array<int, mixed>
     */
    public function search(string $query, int $limit = 5): array
    {
        $email = trim((string) config('services.nominatim.email', ''));

        $params = [
            'q' => $query,
            'format' => 'jsonv2',
            'addressdetails' => 1,
            'limit' => $limit,
        ];

        if ($email !== '') {
            $params['email'] = $email;
        }

        try {
            $response = Http::baseUrl((string) config('services.nominatim.base_url', 'https://nominatim.openstreetmap.org'))
            ->acceptJson()
            ->timeout(8)
            ->withHeaders([
                'User-Agent' => (string) config('services.nominatim.user_agent', 'city-pulse-demo/1.0 (local@example.com)'),
                'Referer' => (string) config('app.url'),
            ])
            ->get('/search', $params);
        } catch (ConnectionException $exception) {
            throw new RuntimeException(
                'Nominatim is not reachable right now. Check your network and NOMINATIM_BASE_URL, then try again.',
                previous: $exception
            );
        }

        if ($response->status() === 403) {
            throw new RuntimeException(
                'Nominatim blocked this request. Set NOMINATIM_USER_AGENT in .env to a unique app identifier (ideally with contact email) and try again.'
            );
        }

        if ($response->status() === 429) {
            throw new RuntimeException('Nominatim rate limit reached. Wait briefly and retry your search.');
        }

        try {
            $response->throw();
        } catch (RequestException $exception) {
            throw new RuntimeException(
                sprintf('Nominatim request failed with HTTP %d. Please retry.', $response->status()),
                previous: $exception
            );
        }

        $data = $response->json();

        return is_array($data) ? $data : [];
    }
}
