export const sensitiveRateLimits = {
  login: { max: 5, timeWindow: '10 minutes' },
  anonymousRegister: { max: 3, timeWindow: '1 hour' },
  anonymousRecover: { max: 5, timeWindow: '30 minutes' },
  accountMutation: { max: 10, timeWindow: '10 minutes' },
  otpRequest: { max: 5, timeWindow: '10 minutes' },
  otpVerify: { max: 10, timeWindow: '10 minutes' },
  refresh: { max: 20, timeWindow: '10 minutes' },
  logout: { max: 30, timeWindow: '10 minutes' },
  reauth: { max: 5, timeWindow: '10 minutes' },
  verifyReauth: { max: 30, timeWindow: '10 minutes' },
  voiceUploadUrl: { max: 10, timeWindow: '1 minute' },
  voiceCommit: { max: 20, timeWindow: '1 minute' },
  voiceDownload: { max: 60, timeWindow: '1 minute' }
} as const;
