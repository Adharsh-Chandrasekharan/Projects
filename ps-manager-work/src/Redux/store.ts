import { configureStore } from '@reduxjs/toolkit';
import playstationReducer from './slices/playstationSlice';

const store = configureStore({
  reducer: {
    playstation: playstationReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export default store;
