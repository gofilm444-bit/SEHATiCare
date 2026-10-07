const publicErrorSchema = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    correlation_id: { type: 'string' }
  },
  required: ['message']
} as const;

export const standardErrorResponses = {
  400: publicErrorSchema,
  401: publicErrorSchema,
  403: publicErrorSchema,
  404: publicErrorSchema,
  409: publicErrorSchema,
  429: publicErrorSchema,
  500: publicErrorSchema,
  503: publicErrorSchema
} as const;
