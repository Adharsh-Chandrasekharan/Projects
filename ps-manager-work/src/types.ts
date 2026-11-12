export type PlaystationType = 'PS3' | 'PS4' | 'PS5';

export interface ConsoleRate {
  PlayersNumber: number;
  HourlyAmount: number;
  HalfHourAmount: number;
}

export interface Playstation {
  PlayStationID: number;
  PlayStationName: string;
  PlayStationType: PlaystationType;
  IsAvailable: boolean;
  rates: ConsoleRate[];
  ActiveSessionID?: number | null;
  StartTime?: string | null;
  ActivePlayersNumber?: number | null;
  ActiveDurationMinutes?: number | null;
  ActiveGrossAmount?: number | null;
  ActiveDiscountPercent?: number | null;
  ActiveDiscountAmount?: number | null;
  ActiveTotalAmount?: number | null;
  ActivePerPersonAmount?: number | null;
}

export interface SessionRecord {
  SessionID: number;
  PlayStationID: number;
  PlayersNumber: number;
  DurationMinutes: number;
  StartTime: string;
  GrossAmount: number;
  DiscountPercent: number;
  DiscountAmount: number;
  TotalAmount: number;
  PerPersonAmount: number;
  HourlyRate: number;
  HalfHourRate: number;
}
