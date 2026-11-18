import { Playstation } from '../../types';
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  playstations: [] as Playstation[],
  hasLoaded: false,
};

const playstationSlice = createSlice({
  name: 'playstations',
  initialState,
  reducers: {
    setPlaystations: (state, action) => {
      state.playstations = action.payload;
      state.hasLoaded = true;
    },
    addPlaystation: (state, action) => {
      state.playstations.push(action.payload);
    },
  },
});

export const { setPlaystations, addPlaystation } = playstationSlice.actions;
export default playstationSlice.reducer;
