import { FastifyInstance } from 'fastify';
import { authGuard } from '../../middlewares/auth';
import { sensitiveRateLimits } from '../../config/rateLimits';
import { changePassword, convertLegacyAccount, getAccountProfile, regenerateRecoveryCode, revokeAllSessions, updateAccountProfile } from './account.service';
import { conversionSchema, passwordChangeSchema, passwordConfirmSchema, profileSchema } from './account.validators';
import { isPrismaConnectionError } from '../../db/prismaErrors';

function safeError(error: unknown) {
  if (error instanceof Error && ['Invalid credentials', 'Account already anonymous', 'Recovery code is not enabled', 'Alias hanya dapat diubah sekali dalam 24 jam'].includes(error.message)) return error.message;
  return 'Unable to update account';
}

export default async function accountRoutes(fastify: FastifyInstance) {
  fastify.get('/profile', { preHandler: [authGuard] }, async (request, reply) => {
    const profile = await getAccountProfile(request.user!.userId);
    if (!profile) return reply.status(404).send({ message: 'Account not found' });
    return reply.send({ ...profile, login_id: profile.account_mode === 'ANONYMOUS' ? profile.login_id : null, display_alias: profile.display_alias ?? profile.full_name, full_name: undefined });
  });

  fastify.put('/profile', { preHandler: [authGuard], config: { rateLimit: sensitiveRateLimits.accountMutation } }, async (request, reply) => {
    const body = profileSchema.parse(request.body);
    try {
      const profile = await updateAccountProfile(request.user!.userId, body);
      if (!profile) return reply.status(404).send({ message: 'Account not found' });
      return reply.send({ ...profile, display_alias: profile.display_alias ?? profile.full_name, full_name: undefined });
    } catch (error) {
      if (isPrismaConnectionError(error)) throw error;
      return reply.status(400).send({ message: safeError(error) });
    }
  });

  fastify.post('/password', { preHandler: [authGuard], config: { rateLimit: sensitiveRateLimits.accountMutation } }, async (request, reply) => {
    const body = passwordChangeSchema.parse(request.body);
    try { await changePassword(request.user!.userId, body.current_password, body.new_password); return reply.status(204).send(); }
    catch (error) { if (isPrismaConnectionError(error)) throw error; return reply.status(400).send({ message: safeError(error) }); }
  });

  fastify.post('/recovery-code/regenerate', { preHandler: [authGuard], config: { rateLimit: sensitiveRateLimits.accountMutation } }, async (request, reply) => {
    const body = passwordConfirmSchema.parse(request.body);
    try { return reply.send(await regenerateRecoveryCode(request.user!.userId, body.password)); }
    catch (error) { if (isPrismaConnectionError(error)) throw error; return reply.status(400).send({ message: safeError(error) }); }
  });

  fastify.post('/logout-all', { preHandler: [authGuard], config: { rateLimit: sensitiveRateLimits.accountMutation } }, async (request, reply) => {
    await revokeAllSessions(request.user!.userId);
    return reply.status(204).send();
  });

  fastify.post('/convert-anonymous', { preHandler: [authGuard], config: { rateLimit: sensitiveRateLimits.accountMutation } }, async (request, reply) => {
    const body = conversionSchema.parse(request.body);
    try { return reply.send(await convertLegacyAccount(request.user!.userId, body.current_password, body.alias, body.password)); }
    catch (error) { if (isPrismaConnectionError(error)) throw error; return reply.status(400).send({ message: safeError(error) }); }
  });
}
