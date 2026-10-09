import { FastifyInstance } from 'fastify';
import { authGuard } from '../../middlewares/auth';
import { privacyPreferencesPatchSchema } from './privacyPreferences.validators';
import { getPrivacyPreferences, updatePrivacyPreferences } from './privacyPreferences.service';
import { standardErrorResponses } from '../../schemas/errorResponse';

export default async function privacyPreferencesRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/me/privacy-preferences',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Privacy'],
        security: [{ bearerAuth: [] }],
        response: {
          ...standardErrorResponses,
          200: {
            type: 'object',
            properties: {
              lock_on_background: { type: 'boolean' },
              auto_lock_minutes: { type: ['number', 'null'] },
              require_reauth_to_unlock: { type: 'boolean' },
              discreet_page_titles: { type: 'boolean' },
              created_at: { type: 'string' },
              updated_at: { type: 'string' }
            },
            required: ['lock_on_background', 'require_reauth_to_unlock', 'discreet_page_titles', 'created_at', 'updated_at']
          }
        }
      }
    },
    async (request, reply) => {
      const preferences = await getPrivacyPreferences(request.user!.userId);
      return reply.send(preferences);
    }
  );

  fastify.patch(
    '/me/privacy-preferences',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Privacy'],
        security: [{ bearerAuth: [] }],
        response: {
          ...standardErrorResponses,
          200: {
            type: 'object',
            properties: {
              lock_on_background: { type: 'boolean' },
              auto_lock_minutes: { type: ['number', 'null'] },
              require_reauth_to_unlock: { type: 'boolean' },
              discreet_page_titles: { type: 'boolean' },
              created_at: { type: 'string' },
              updated_at: { type: 'string' }
            },
            required: ['lock_on_background', 'require_reauth_to_unlock', 'discreet_page_titles', 'created_at', 'updated_at']
          }
        }
      }
    },
    async (request, reply) => {
      const patch = privacyPreferencesPatchSchema.parse(request.body);
      try {
        const preferences = await updatePrivacyPreferences(request.user!.userId, request.user!.role, patch);
        return reply.send(preferences);
      } catch (err: any) {
        if (err?.statusCode === 400) {
          return reply.status(400).send({ message: err.message });
        }
        throw err;
      }
    }
  );
}
