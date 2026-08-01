import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { firstValueFrom, of } from 'rxjs';
import { WeatherService } from './weather-service';
import { WeatherRepository } from '../../repositories/weather-api-repository';
import { WeatherJSON } from '../../repositories/dto/weather-data';

describe('WeatherService', () => {
  let service: WeatherService;
  let mockWeatherRepo: any;

  beforeEach(() => {
    mockWeatherRepo = {
      getWeather: vi.fn()
    };

    // 🌐 Wir mocken die native Geolocation des Browsers global für den Test
    const mockGeolocation = {
      getCurrentPosition: vi.fn((success) => 
        success({
          coords: { latitude: 50.1109, longitude: 8.6821 } // Koordinaten für Frankfurt
        })
      )
    };
    vi.stubGlobal('navigator', { geolocation: mockGeolocation });

    TestBed.configureTestingModule({
      providers: [
        WeatherService,
        { provide: WeatherRepository, useValue: mockWeatherRepo }
      ]
    });

    service = TestBed.inject(WeatherService);
  });
it('sollte die Browser-Ortung abfragen und das Wetter vom Repo laden', async () => {
    // 🟢 HIER REPARIEREN: Das Mock-Objekt entspricht jetzt exakt der Open-Meteo Struktur!
    const mockWeatherData: WeatherJSON = { 
      latitude: 50.1109,
      longitude: 8.6821,
      generationtime_ms: 0.1,
      utc_offset_seconds: 0,
      timezone: 'GMT',
      timezone_abbreviation: 'GMT',
      elevation: 112,
      current_weather: {
        temperature: 22.5, 
        windspeed: 10,
        winddirection: 180,
        weathercode: 0, // 💡 Alles klein geschrieben laut DTO!
        is_day: 1,
        time: '2026-07-20T12:00'
      }
    };
    
    mockWeatherRepo.getWeather.mockReturnValue(of(mockWeatherData));

    // Aktionsaufruf
    const ergebnis = await firstValueFrom(service.getWeatherCurrentLocation());

    // Überprüfen, ob das Repo mit den Koordinaten der Geolocation aufgerufen wurde
    expect(mockWeatherRepo.getWeather).toHaveBeenCalledWith(50.1109, 8.6821);
    
    // Wenn dein Service die Daten noch transformiert, vergleicht das expect
    // hier das Endergebnis nach dem Mapping.
    expect(ergebnis).toBeDefined(); 
  });
});