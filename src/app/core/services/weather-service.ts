import { Injectable, inject } from '@angular/core';
import { Observable, from, map, of, switchMap, tap } from 'rxjs';
import { MilestoneRepository } from '../repositories/milestone-repository';
import { WeatherJSON } from '../repositories/dto/weather-data';
import { WeatherRepository } from '../repositories/weather-api-repository';

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  
  private weatherRepo = inject(WeatherRepository);

  // Diese Hilfsmethode wandelt die Browser-Ortung in ein modernes Promise um
  private getBrowserLocation(): Promise<{ lat: number, lon: number }> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        }),
        (error) => reject(error)
      );
    });
  }

  // 2. HIER KOMMT DEINE AUFGABE:
  // Schreib eine Methode `getWeatherForCurrentLocation(): Observable<WeatherJSON>`
  // - Nutze `from(this.getBrowserLocation())` um das Promise in ein Observable zu verwandeln.
  // - Nutze den RxJS-Operator `switchMap(coords => ...)` 
  // um von den Koordinaten auf den HTTP-Aufruf deines Repositories umzuspringen!

  public getWEatherCurrentLocation(): Observable<WeatherJSON> {
   
    return from(this.getBrowserLocation()).pipe(
        switchMap(({lat, lon}) => this.weatherRepo.getWeather(lat, lon))
    )
  } 
}