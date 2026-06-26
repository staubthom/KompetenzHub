// Beispiel-Plugin: ein einziger /ping-Handler gegen das gescopte SDK.
// Im Pilot dient es als Discovery-/Validierungs-Smoke; der HTTP-Dispatch
// (Aufruf dieses Handlers) folgt mit dem Dispatcher-Controller (P1).

import { definePlugin } from '@kompetenzhub/plugin-sdk';

export default definePlugin({
  routes: {
    'GET /ping': async (ctx) => {
      const at = new Date().toISOString();
      // Schreibt in den gescopten KV-Store – belegt Tenant-Isolation & Cleanup.
      await ctx.data.put('pings', 'last', { at, by: ctx.user.id });
      return { pong: true, plugin: ctx.pluginId, tenant: ctx.tenant.id, at };
    },
  },
});
