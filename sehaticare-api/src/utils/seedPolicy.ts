export function assertDemoSeedAllowed(
  nodeEnv: string | undefined,
  password: string | undefined
): asserts password is string {
  if (nodeEnv !== 'development' && nodeEnv !== 'test') {
    throw new Error('Demo seed is disabled outside development and testing');
  }
  if (!password || password.length < 12) {
    throw new Error('SEED_DEMO_PASSWORD must be set to at least 12 characters');
  }
}
