import { ConsoleRate, PlaystationType } from '../types';

export const DEFAULT_RATES: Record<PlaystationType, ConsoleRate[]> = {
  PS5: [
    { PlayersNumber: 1, HourlyAmount: 120, HalfHourAmount: 70 },
    { PlayersNumber: 2, HourlyAmount: 200, HalfHourAmount: 120 },
    { PlayersNumber: 3, HourlyAmount: 280, HalfHourAmount: 180 },
    { PlayersNumber: 4, HourlyAmount: 360, HalfHourAmount: 200 },
  ],
  PS4: [
    { PlayersNumber: 1, HourlyAmount: 100, HalfHourAmount: 60 },
    { PlayersNumber: 2, HourlyAmount: 160, HalfHourAmount: 100 },
    { PlayersNumber: 3, HourlyAmount: 220, HalfHourAmount: 150 },
    { PlayersNumber: 4, HourlyAmount: 280, HalfHourAmount: 180 },
  ],
  // PS3 rates are left at zero because no PS3 price card was supplied.
  // Enter the lounge's PS3 prices before reserving a PS3 console.
  PS3: [
    { PlayersNumber: 1, HourlyAmount: 0, HalfHourAmount: 0 },
    { PlayersNumber: 2, HourlyAmount: 0, HalfHourAmount: 0 },
    { PlayersNumber: 3, HourlyAmount: 0, HalfHourAmount: 0 },
    { PlayersNumber: 4, HourlyAmount: 0, HalfHourAmount: 0 },
  ],
};

export function calculateClientQuote(rate: ConsoleRate, durationMinutes: number, discountPercent: number) {
  const wholeHours = Math.floor(durationMinutes / 60);
  const remainingMinutes = durationMinutes % 60;
  const grossAmount = Math.round((wholeHours * rate.HourlyAmount + (remainingMinutes === 30 ? rate.HalfHourAmount : 0)) * 100) / 100;
  const discountAmount = Math.round(grossAmount * discountPercent) / 100;
  const totalAmount = Math.round((grossAmount - discountAmount) * 100) / 100;
  return {
    grossAmount,
    discountAmount,
    totalAmount,
    perPersonAmount: rate.PlayersNumber > 0 ? Math.round((totalAmount / rate.PlayersNumber) * 100) / 100 : 0,
  };
}

export const currency = (amount: number) => `₹${Number(amount || 0).toFixed(2)}`;
