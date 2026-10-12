// Relais du flux public d'incidents de la CHP (police routière de Californie).
// Le serveur de la CHP ne répond pas aux connexions venant d'Europe : cette fonction est appelée
// avec l'en-tête « x-region: us-west-1 », elle s'exécute donc en Californie et renvoie le flux tel quel.
// Elle ne relaie que cette adresse publique (pas de proxy ouvert).

const CHP_FEED = 'https://media.chp.ca.gov/sa_xml/sa.xml';

Deno.serve(async () => {
  try {
    const res = await fetch(CHP_FEED, {
      headers: { 'user-agent': 'StrangeCams-Relay/0.1' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return new Response(`CHP a répondu ${res.status}`, { status: 502 });
    return new Response(await res.text(), {
      headers: { 'content-type': 'text/xml; charset=utf-8', 'cache-control': 'public, max-age=30' },
    });
  } catch (e) {
    return new Response(`CHP injoignable : ${e instanceof Error ? e.message : e}`, { status: 504 });
  }
});
