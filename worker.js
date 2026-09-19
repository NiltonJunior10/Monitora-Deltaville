const TILE_PATH=/^\/map-tiles\/(\d+)\/(\d+)\/(\d+)\.png$/;


export default {
  async fetch(request, env, ctx) {
    const url=new URL(request.url);

    const match=url.pathname.match(TILE_PATH);

    if(match){
      const z=Number(match[1]),x=Number(match[2]),y=Number(match[3]);
      if(!Number.isInteger(z)||!Number.isInteger(x)||!Number.isInteger(y)||z<0||z>20){
        return new Response("Invalid tile",{status:400});
      }

      const cache=caches.default;
      const cacheKey=new Request(url.origin+url.pathname,{method:"GET"});
      const cached=await cache.match(cacheKey);
      if(cached)return cached;

      const subdomains=["a","b","c","d"];
      const sub=subdomains[Math.abs((x+y)%subdomains.length)];
      const upstream=`https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`;

      try{
        const upstreamResponse=await fetch(upstream,{
          headers:{
            "Accept":"image/avif,image/webp,image/apng,image/png,image/*,*/*;q=0.8"
          },
          cf:{cacheTtl:86400,cacheEverything:true}
        });

        if(!upstreamResponse.ok){
          return new Response("Tile unavailable",{status:502});
        }

        const headers=new Headers(upstreamResponse.headers);
        headers.set("Content-Type","image/png");
        headers.set("Cache-Control","public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400");
        headers.set("Access-Control-Allow-Origin","*");
        headers.set("Cross-Origin-Resource-Policy","cross-origin");

        const response=new Response(upstreamResponse.body,{
          status:200,
          headers
        });

        ctx.waitUntil(cache.put(cacheKey,response.clone()));
        return response;
      }catch(_){
        return new Response("Tile fetch failed",{status:502});
      }
    }

    return env.ASSETS.fetch(request);
  }
};
