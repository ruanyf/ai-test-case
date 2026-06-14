<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Throwable;
use RuntimeException;
use App\Data\GeoPlaceDto;
use App\Services\CityPulseService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;

final class CityPulseController extends Controller
{
    private const GENERIC_ERROR_MESSAGE = 'Weather data is temporarily unavailable. Please try again in a moment.';

    public function index(Request $request, CityPulseService $cityPulseService): View
    {
        $validated = $request->validate([
            'city' => ['nullable', 'string', 'max:120'],
            'place' => ['nullable', 'string', 'max:1200'],
        ]);

        $query = trim((string) ($validated['city'] ?? ''));
        $placeToken = (string) ($validated['place'] ?? '');

        $searched = $query !== '';
        $candidates = [];
        $result = null;
        $error = null;

        if ($searched) {
            try {
                $searchResult = $cityPulseService->search($query);
                $query = $searchResult->query;
                $candidates = $searchResult->candidates;

                $selected = $this->resolveSelectedPlace($placeToken, $candidates);

                if ($selected !== null) {
                    $result = $cityPulseService->buildDashboard($selected);
                } elseif (count($candidates) === 1) {
                    $result = $cityPulseService->buildDashboard($candidates[0]);
                }
            } catch (RuntimeException $exception) {
                report($exception);
                $error = $this->safeRuntimeMessage($exception->getMessage()) ?? self::GENERIC_ERROR_MESSAGE;
            } catch (Throwable $exception) {
                report($exception);
                $error = self::GENERIC_ERROR_MESSAGE;
            }
        }

        return view('city-pulse.index', [
            'query' => $query,
            'searched' => $searched,
            'candidates' => $candidates,
            'result' => $result,
            'error' => $error,
            'showNoResults' => $searched && $candidates === [] && $error === null,
        ]);
    }

    /**
     * @param array<int, GeoPlaceDto> $candidates
     */
    private function resolveSelectedPlace(string $placeToken, array $candidates): ?GeoPlaceDto
    {
        $candidate = GeoPlaceDto::fromPayload($placeToken);

        if ($candidate === null) {
            return null;
        }

        foreach ($candidates as $option) {
            if ($option->isSamePlace($candidate)) {
                return $option;
            }
        }

        return null;
    }

    private function safeRuntimeMessage(string $message): ?string
    {
        $safePrefixes = [
            'Set OPENWEATHER_API_KEY',
            'OpenWeather',
            'Nominatim',
        ];

        foreach ($safePrefixes as $prefix) {
            if (str_starts_with($message, $prefix)) {
                return $message;
            }
        }

        return null;
    }
}
