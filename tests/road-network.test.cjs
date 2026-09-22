const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const network=require('../public/road-network.js');
const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
function geometry(){
  const names=[...new Set(network.roads.map(r=>r.avenue).filter(Boolean))];
  const context=vm.createContext({
    window:{MonitoraRoadNetwork:network},
    state:{locations:names.map(name=>({id:name,name,category:'avenue'}))},
    L:{latLng:(lat,lng)=>({lat,lng})},
    xyToLatLng:(x,y)=>[982-y,x],clamp:(n,a,b)=>Math.max(a,Math.min(b,n))
  });
  vm.runInContext(app.slice(app.indexOf('const avenueRoutes='),app.indexOf('const lakeZones=')),context);
  return code=>vm.runInContext(code,context);
}
test('image-space network has unique versioned IDs and finite in-bounds vertices',()=>{
  assert.equal(network.coordinateSystem,'image-pixels');
  assert.equal(new Set(network.roads.map(r=>r.id)).size,network.roads.length);
  for(const r of network.roads){
    assert.match(r.id,/-v\d+$/);assert.ok(r.points.length>=2);
    for(const [x,y] of r.points)assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=1601&&y>=0&&y<=982,r.id);
  }
});
test('Beira Rio uses one smooth closed active circuit and ignores the median',()=>{
  const run=geometry();
  assert.equal(run('nearestAvenueProjection({lat:382,lng:1142}).routeKey'),'beira-circuito-v2');
  assert.equal(run('nearestAvenueProjection({lat:382,lng:1171}).routeKey'),'beira-circuito-v2');
  assert.equal(run('nearestAvenueProjection({lat:382,lng:1156})'),null);
  assert.equal(run('nearestAvenueProjection({lat:482,lng:1200})'),null);
  assert.equal(run('routeIsClosed(avenuePointsByLocationId("Av. Beira Rio","beira-circuito-v2"))'),true);
});
test('internal roads snap without inventing a monitored avenue location',()=>{
  const run=geometry();
  assert.equal(run('nearestRoadProjection({lat:532,lng:250}).road.name'),'Blue · via interna');
  assert.equal(run('nearestRoadProjection({lat:532,lng:250}).loc'),null);
  assert.equal(run('nearestRoadProjection({lat:532,lng:280})'),null);
  assert.equal(run('nearestRoadProjection({lat:412,lng:502})'),null); // leisure island
  assert.equal(run('nearestRoadProjection({lat:432,lng:824})'),null); // Acqua lake
});
test('old segment keys keep their original geometry; unknown keys cannot jump lanes',()=>{
  const run=geometry();
  assert.equal(run('JSON.stringify(avenuePointsByLocationId("Av. Deltaville","main")[0])'),'[664,649]');
  assert.equal(run('JSON.stringify(avenuePointsByLocationId("Av. Deltaville","north-west")[0])'),'[694,614]');
  assert.equal(run('avenuePointsByLocationId("Av. Deltaville","missing")'),null);
  assert.equal(run('avenueRouteDefinitions("Av. Deltaville").some(r=>r.key==="main")'),false);
  assert.equal(run('avenueRouteDefinitions("Av. Deltaville").some(r=>r.key==="deltaville-oeste-v1")'),false);
  assert.equal(run('avenueRouteDefinitions("Av. Deltaville").some(r=>r.key==="deltaville-circuito-v2")'),true);
  assert.equal(run('routeIsClosed(avenuePointsByLocationId("Av. Deltaville","deltaville-circuito-v2"))'),true);
});
test('new lane selection round trips through stored ratios',()=>{
  const run=geometry();
  const error=run(`(()=>{const pts=avenuePointsByLocationId('Av. Beira Rio','beira-oeste-v1');
    const p={lat:482,lng:1131};const projection=projectPointOnRoute(p,pts);
    const q=pointAtRouteRatio(pts,projection.ratio);return Math.hypot(q[0]-p.lat,q[1]-p.lng)})()`);
  assert.ok(error<1e-8);
});
test('offline shell includes the road module before app startup',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
  const sw=fs.readFileSync(path.join(__dirname,'../public/service-worker.js'),'utf8');
  assert.ok(html.indexOf('road-network.js?v=757')<html.indexOf('app.js?v=757'));
  assert.ok(sw.includes('"./road-network.js?v=757"'));
});
