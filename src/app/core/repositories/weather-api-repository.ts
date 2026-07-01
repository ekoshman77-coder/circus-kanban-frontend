import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { WeatherJSON } from "./dto/weather-data";

@Injectable({
  providedIn: 'root'
})
export class WeatherRepository {

  constructor(private http: HttpClient) {}

  public getWeather(lat: number, lon: number): Observable<WeatherJSON> {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`    
    return this.http.get<WeatherJSON>(weatherUrl, {withCredentials: false})
  }
}