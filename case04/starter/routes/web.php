<?php

use App\Http\Controllers\CityPulseController;
use Illuminate\Support\Facades\Route;

Route::get('/', [CityPulseController::class, 'index'])->name('city-pulse.index');
