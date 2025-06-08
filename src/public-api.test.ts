import { startTracking, sendCustomEvent } from './public-api';

describe('startTracking', () => {
  beforeEach(() => {
    jest.resetModules();
    (console.error as jest.Mock).mockClear();
  });

  it('should not persist instance when initialization fails', () => {
    startTracking('invalid-url');

    expect(console.error).toHaveBeenCalledWith(
      'Datataki error: Tracking initialization failed. Provide a valid apiUrl and try again.',
    );

    (console.error as jest.Mock).mockClear();

    sendCustomEvent('test');

    expect(console.error).toHaveBeenCalledWith('Datataki error: Tracking not initialized. Call startTracking() first.');
  });
});
