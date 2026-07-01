import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'weatherIcon',
  standalone: true // Damit wir sie überall direkt importieren können!
})
export class WeatherIconPipe implements PipeTransform {

  transform(code: number | undefined | null): string {
    if (code === undefined || code === null) return '☁️';
    
    // Unsere bewährte WMO-Code-Logik:
    if (code === 0) return '☀️'; 
    if (code >= 1 && code <= 3) return '🌤️'; 
    if (code >= 45 && code <= 48) return '🌫️'; 
    if (code >= 51 && code <= 67) return '🌧️'; 
    if (code >= 71 && code <= 77) return '❄️'; 
    if (code >= 80 && code <= 82) return '🌦️'; 
    if (code >= 95 && code <= 99) return '⛈️'; 
    
    return '☁️';
  }
}