import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setPlaystations } from '../Redux/slices/playstationSlice';
import { RootState } from '../Redux/store';
import { ConsoleRate, PlaystationType } from '../types';
import { IPC } from '../../common/constants';

interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

export const usePlaystations = () => {
  const dispatch = useDispatch();
  const playstations = useSelector((state: RootState) => state.playstation.playstations);
  const hasLoaded = useSelector((state: RootState) => state.playstation.hasLoaded);

  const getAllPlaystations = useCallback(async (): Promise<ActionResult> => {
    try {
      const response = await window.ipcRenderer.invoke(IPC.getAllPlaystations);
      if (response.code !== 1) return { success: false, message: response.msg || 'Could not load consoles.' };
      dispatch(setPlaystations(response.msg || []));
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Could not load consoles:', error);
      return { success: false, message };
    }
  }, [dispatch]);

  const createPlaystation = useCallback(async (input: {
    PlayStationName: string;
    PlayStationType: PlaystationType;
    rates: ConsoleRate[];
  }): Promise<ActionResult> => {
    try {
      const response = await window.ipcRenderer.invoke(IPC.createPlaystation, input);
      if (response.code !== 1) return { success: false, message: response.msg || 'Could not add console.' };
      await getAllPlaystations();
      return { success: true, data: response.msg };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }, [getAllPlaystations]);

  const reserveSession = useCallback(async (
    PlayStationID: number,
    PlayersNumber: number,
    DurationMinutes: number,
    DiscountPercent: number,
  ): Promise<ActionResult> => {
    try {
      const response = await window.ipcRenderer.invoke(IPC.Reserve, {
        PlayStationID, PlayersNumber, DurationMinutes, DiscountPercent,
      });
      if (response.code !== 1) return { success: false, message: response.msg || 'Could not reserve console.' };
      await getAllPlaystations();
      return { success: true, data: response.msg };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }, [getAllPlaystations]);

  const endSession = useCallback(async (PlayStationID: number): Promise<ActionResult> => {
    try {
      const response = await window.ipcRenderer.invoke(IPC.End, { PlayStationID });
      if (response.code !== 1) return { success: false, message: response.msg || 'Could not end session.' };
      await getAllPlaystations();
      return { success: true, data: response.msg };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }, [getAllPlaystations]);

  const addPlayers = useCallback(async (PlayStationID: number, additionalPlayers: number): Promise<ActionResult> => {
    try {
      const response = await window.ipcRenderer.invoke(IPC.AddPlayers, { PlayStationID, additionalPlayers });
      if (response.code !== 1) return { success: false, message: response.msg || 'Could not add players.' };
      await getAllPlaystations();
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }, [getAllPlaystations]);

  const extendTime = useCallback(async (PlayStationID: number, additionalMinutes: number): Promise<ActionResult> => {
    try {
      const response = await window.ipcRenderer.invoke(IPC.ExtendTime, { PlayStationID, additionalMinutes });
      if (response.code !== 1) return { success: false, message: response.msg || 'Could not extend session.' };
      await getAllPlaystations();
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }, [getAllPlaystations]);

  const updateRates = useCallback(async (PlayStationID: number, rates: ConsoleRate[]): Promise<ActionResult> => {
    try {
      const response = await window.ipcRenderer.invoke(IPC.UpdateRates, { PlayStationID, rates });
      if (response.code !== 1) return { success: false, message: response.msg || 'Could not update rates.' };
      await getAllPlaystations();
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }, [getAllPlaystations]);

  return { playstations, hasLoaded, getAllPlaystations, createPlaystation, reserveSession, endSession, addPlayers, extendTime, updateRates };
};
