export const IPC = {
  createPlaystation: 'Create Playstation',
  getAllPlaystations: 'Get All Playstations',
  getSession: 'Get Session',
  Reserve: 'Start Session',
  End: 'End Session',
  AddPlayers: 'Add Players',
  ExtendTime: 'Extend Time',
  UpdateRates: 'Update Console Rates',
  Delete: 'Delete Console',
  Reset: 'Reset DataBase',
  // Legacy local-password channels retained for source compatibility; no handlers are registered.
  getPass: 'get password from json',
  UpdataPassword: 'Update Admin Password',

  Login: 'API Login',
  AuthStatus: 'API Auth Status',
  Logout: 'API Logout',
  AuthExpired: 'API Auth Expired',
} as const;

export const lables = {
  Welcome: 'Welcome to your gaming hub',
  AllPlayStations: 'All PlayStations',
  AvailablePlayStations: 'Available PlayStations',
  BusyPlayStations: 'Busy PlayStations',
};

export const SESSION_DURATIONS = [
  { label: '30 mins', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '1.5 hours', minutes: 90 },
  { label: '2 hours', minutes: 120 },
  { label: '3 hours', minutes: 180 },
] as const;
