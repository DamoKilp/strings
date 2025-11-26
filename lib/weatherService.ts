'use server';

interface WeatherResponse {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
  };
}

const WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  80: 'Rain showers',
  95: 'Thunderstorm',
};

export interface WeatherSnapshot {
  temperature: number | null;
  feelsLike: number | null;
  description: string;
  fetchedAt: string;
}

export async function fetchCurrentWeather(params: {
  latitude: number;
  longitude: number;
  timezone?: string;
}): Promise<WeatherSnapshot | null> {
  const query = new URLSearchParams({
    latitude: params.latitude.toString(),
    longitude: params.longitude.toString(),
    current: 'temperature_2m,apparent_temperature,weather_code',
    timezone: params.timezone ?? 'Australia/Perth',
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query.toString()}`);
  if (!response.ok) return null;

  const data = (await response.json()) as WeatherResponse;
  const weatherCode = data.current?.weather_code ?? 0;
  return {
    temperature: data.current?.temperature_2m ?? null,
    feelsLike: data.current?.apparent_temperature ?? null,
    description: WEATHER_CODES[weatherCode] ?? 'Unspecified',
    fetchedAt: new Date().toISOString(),
  };
}


