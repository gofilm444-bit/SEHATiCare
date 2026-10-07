export function toPublicErrorResponse(message: string, correlationId: string) {
  return { message, correlation_id: correlationId };
}
