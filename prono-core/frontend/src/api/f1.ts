import apiClient from './axios';
import type {
  Driver,
  F1Prediction,
  F1PredictionRequest,
  F1Standing,
  F1StandingHistory,
  Race,
  RaceResultEntryRequest,
} from '../types';

export const getDrivers = async (): Promise<Driver[]> => {
  const response = await apiClient.get<Driver[]>('/f1/drivers');
  return response.data;
};

export const getRaces = async (): Promise<Race[]> => {
  const response = await apiClient.get<Race[]>('/f1/races');
  return response.data;
};

export const getRace = async (raceId: number): Promise<Race> => {
  const response = await apiClient.get<Race>(`/f1/races/${raceId}`);
  return response.data;
};

/** Returns null when the caller has no prediction yet (204). */
export const getMyPrediction = async (raceId: number): Promise<F1Prediction | null> => {
  const response = await apiClient.get<F1Prediction>(`/f1/races/${raceId}/my-prediction`);
  return response.status === 204 ? null : response.data;
};

export const predict = async (raceId: number, request: F1PredictionRequest): Promise<F1Prediction> => {
  const response = await apiClient.post<F1Prediction>(`/f1/races/${raceId}/predict`, request);
  return response.data;
};

export const getRacePredictions = async (raceId: number): Promise<F1Prediction[]> => {
  const response = await apiClient.get<F1Prediction[]>(`/f1/races/${raceId}/predictions`);
  return response.data;
};

export const getDriverStandings = async (): Promise<F1Standing[]> => {
  const response = await apiClient.get<F1Standing[]>('/f1/standings/drivers');
  return response.data;
};

export const getConstructorStandings = async (): Promise<F1Standing[]> => {
  const response = await apiClient.get<F1Standing[]>('/f1/standings/constructors');
  return response.data;
};

export const getDriverStandingsHistory = async (): Promise<F1StandingHistory> => {
  const response = await apiClient.get<F1StandingHistory>('/f1/standings/drivers/history');
  return response.data;
};

export const getConstructorStandingsHistory = async (): Promise<F1StandingHistory> => {
  const response = await apiClient.get<F1StandingHistory>('/f1/standings/constructors/history');
  return response.data;
};

// ── Group admin ────────────────────────────────────────────────────────────

export const openRaceForBetting = async (groupId: number, raceId: number): Promise<void> => {
  await apiClient.post(`/f1/groups/${groupId}/races/${raceId}/open`);
};

export const closeRaceForBetting = async (groupId: number, raceId: number): Promise<void> => {
  await apiClient.delete(`/f1/groups/${groupId}/races/${raceId}/open`);
};

export const openCompetitionRaces = async (groupId: number, competitionId: number): Promise<void> => {
  await apiClient.post(`/f1/groups/${groupId}/competitions/${competitionId}/open`);
};

// ── Platform admin ─────────────────────────────────────────────────────────

/** Imports calendar + results from jolpica-f1 and settles finished races. */
export const syncSeason = async (season: number): Promise<string> => {
  const response = await apiClient.post<string>(`/admin/f1/sync/${season}`);
  return response.data;
};

export const enterRaceResults = async (
  raceId: number,
  results: RaceResultEntryRequest[],
): Promise<Race> => {
  const response = await apiClient.post<Race>(`/admin/f1/races/${raceId}/results`, { results });
  return response.data;
};
