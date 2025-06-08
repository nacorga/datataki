import { startTracking, sendCustomEvent } from './public-api';

describe('startTracking', () => {
  beforeEach(() => {
    jest.resetModules();
    (console.error as jest.Mock).mockClear();
  });

  it('should not persist instance when initialization fails', () => {
    startTracking('invalid-url', { debug: true });

    expect(console.error).toHaveBeenCalledWith(
      'Datataki error: Invalid API URL provided. Please provide a valid URL or use "demo" mode.',
    );

    (console.error as jest.Mock).mockClear();

    sendCustomEvent('test');

    expect(console.error).toHaveBeenCalledWith('Datataki error: Tracking not initialized. Call startTracking() first.');
  });
});
