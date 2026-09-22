/* Image-space survey of mapa-deltaville-clean.webp (1601 × 982).
 * This is NOT WGS84/GeoJSON: the marketing plan is not georeferenced.
 * Keep vertices on the image's carriageways; never spline across medians.
 * Versioned keys preserve the meaning of previously saved segment ratios.
 * Internal street labels identify areas, not unverified official street names.
 */
(function(root){
  const roads=[];
  const add=(id,name,points,width=7,avenue=null)=>roads.push({id,name,points,width,avenue});
  const egidio='Av. Egídio Abelino Richartz',wilson='Av. Wilson Castelo Branco',delta='Av. Deltaville',beira='Av. Beira Rio';
  add('egidio-oeste-v1',egidio,[[110,290],[106,302],[106,570],[105,594],[97,613],[81,625],[69,640],[61,658],[56,673],[39,683],[0,690]],10,egidio);
  add('egidio-leste-v1',egidio,[[600,302],[169,302],[153,304],[143,315],[143,577],[141,608],[132,628],[115,646],[103,669]],10,egidio);
  add('wilson-norte-v1',wilson,[[103,276],[352,276],[392,276],[701,276],[1104,276],[1117,273],[1126,263]],10,wilson);
  add('wilson-sul-v1',wilson,[[153,302],[592,302],[603,306],[612,318]],9,wilson);
  add('wilson-sul-leste-v1',wilson,[[678,321],[686,309],[698,302],[1105,302],[1119,306],[1131,320]],9,wilson);
  add('wilson-centro-v1',wilson,[[626,316],[627,307],[635,302],[657,302],[665,307],[668,316]],8,wilson);
  add('deltaville-oeste-v1',delta,[[617,318],[617,829],[619,846],[624,863],[637,873],[645,878]],10,delta);
  add('deltaville-leste-v1',delta,[[676,316],[676,828],[672,847],[659,864],[645,878]],10,delta);
  add('deltaville-saida-oeste-v1',delta,[[624,863],[633,885],[635,901],[631,911],[620,916],[602,916]],10,delta);
  add('deltaville-saida-leste-v1',delta,[[659,864],[652,884],[651,900],[656,913],[668,918],[694,918]],10,delta);
  add('beira-oeste-v1',beira,[[1235,0],[1208,53],[1185,101],[1166,148],[1148,195],[1137,231],[1132,261],[1131,320],[1131,826],[1128,842],[1117,853],[1103,858]],10,beira);
  add('beira-leste-v1',beira,[[1274,0],[1247,53],[1224,100],[1205,147],[1187,193],[1176,231],[1173,261],[1173,828],[1177,844],[1187,855],[1203,861]],10,beira);
  add('beira-acesso-v1',beira,[[1173,281],[1180,271],[1194,266],[1220,265]],8,beira);
  // Public perimeter shown on the plan; no invented monitored-location IDs.
  add('perimetral-jardins-v1','Via perimetral sul',[[101,676],[130,680],[166,689],[207,708],[248,731],[293,758],[338,786],[381,814],[428,843],[478,868],[528,890],[578,909],[615,919],[643,930],[679,927],[727,923],[782,916],[839,905],[897,890],[954,879],[1014,869],[1063,864],[1110,864],[1153,865],[1203,870],[1248,882],[1293,899],[1336,919],[1380,945],[1426,976]],14);
  add('acesso-sudoeste-v1','Acesso sudoeste',[[0,698],[46,696],[64,702],[73,720],[84,742],[99,761],[121,778],[150,799],[184,823],[216,849],[245,881],[267,915],[286,952],[294,982]],9);
  add('perimetral-saida-v1','Via perimetral sul',[[646,930],[646,953],[642,982]],13);
  // Brisas: the two short transverse green strips are not roads.
  add('brisas-contorno-v1','Brisas · via interna',[[226,43],[519,43],[523,49],[523,220],[228,220],[219,209],[215,192],[215,169]],6);
  add('brisas-oeste-v1','Brisas · via interna',[[224,47],[219,62],[219,150],[222,163],[229,172],[275,172]],6);
  [276,327,381,433,484].forEach((x,i)=>add('brisas-vertical-'+i+'-v1','Brisas · via interna',[[x,44],[x,220]],6));
  add('brisas-portaria-oeste-v1','Brisas · acesso',[[348,221],[351,256],[346,267],[333,273]],6);
  add('brisas-portaria-leste-v1','Brisas · acesso',[[391,221],[386,257],[391,267],[403,275]],6);
  add('brisas-eixo-v1','Acesso Brisas / Costa do Sol',[[526,0],[526,25],[545,27],[545,267]],7);
  // Costa do Sol.
  add('costa-contorno-v1','Costa do Sol · via interna',[[549,43],[708,43],[722,47],[896,100],[897,219],[741,219]],6);
  add('costa-base-oeste-v1','Costa do Sol · via interna',[[546,220],[695,220]],6);
  [603,652].forEach((x,i)=>add('costa-vertical-'+i+'-v1','Costa do Sol · via interna',[[x,44],[x,115]],6));
  [115,167].forEach((y,i)=>add('costa-oeste-'+i+'-v1','Costa do Sol · via interna',[[545,y],[702,y]],6));
  add('costa-leste-1-v1','Costa do Sol · via interna',[[739,115],[897,115]],6);
  add('costa-leste-2-v1','Costa do Sol · via interna',[[739,167],[897,167]],6);
  add('costa-alameda-oeste-v1','Costa do Sol · acesso',[[703,45],[703,228],[706,242],[710,252],[710,267]],6);
  add('costa-alameda-leste-v1','Costa do Sol · acesso',[[735,58],[735,229],[731,242],[727,252],[727,267]],6);
  // Blue: straight spines, with exact endpoints on the diagonal southern street.
  add('blue-contorno-v1','Blue · via interna',[[193,358],[193,617],[200,628],[252,653],[305,682],[357,712],[410,746],[462,778],[513,809],[568,836],[576,837],[576,381],[201,381],[193,387]],7);
  [[249,652],[302,680],[367,719],[433,761],[502,803]].forEach(([x,y],i)=>{
    if(x<400)add('blue-vertical-'+i+'-v1','Blue · via interna',[[x,382],[x,y]],7);
    else {
      add('blue-vertical-'+i+'-norte-v1','Blue · via interna',[[x,382],[x,545]],7);
      add('blue-vertical-'+i+'-sul-v1','Blue · via interna',[[x,596],[x,y]],7);
    }
  });
  add('blue-portaria-v1','Blue · acesso',[[559,569],[613,569]],7);
  // Acqua: cul-de-sacs terminate before the boundary wall.
  add('acqua-oeste-v1','Acqua · via interna',[[748,358],[748,496]],7);
  add('acqua-oeste-sul-v1','Acqua · via interna',[[748,508],[748,577],[752,586]],7);
  add('acqua-norte-v1','Acqua · via interna',[[740,358],[1087,358]],7);
  add('acqua-sul-v1','Acqua · via interna',[[740,586],[1087,586]],7);
  add('acqua-acesso-v1','Acqua · acesso',[[669,496],[802,496],[816,490],[824,482],[824,442],[829,433],[1086,433]],7);
  add('acqua-central-v1','Acqua · via interna',[[802,496],[815,500],[819,507],[828,510]],7);
  add('acqua-leste-v1','Acqua · via interna',[[828,510],[1086,510]],7);
  // Garden: short T turnarounds, not a through-road across the plots.
  add('garden-contorno-v1','Garden · via interna',[[737,721],[1068,721],[1068,749],[737,749]],7);
  add('garden-acesso-v1','Garden · acesso',[[669,735],[717,735]],7);
  [738,781,825,869,916,964,1013,1061].forEach((x,i)=>{
    add('garden-norte-'+i+'-v1','Garden · via interna',[[x,721],[x,640]],6);
    add('garden-retorno-norte-'+i+'-v1','Garden · retorno',[[x-12,640],[x+12,640]],6);
    add('garden-sul-'+i+'-v1','Garden · via interna',[[x,749],[x,794]],6);
    add('garden-retorno-sul-'+i+'-v1','Garden · retorno',[[x-12,794],[x+12,794]],6);
  });
  // Sunset: separate north/south access, without crossing the leisure island.
  add('sunset-norte-v1','Sunset · via interna',[[1188,267],[1434,250],[1446,253],[1500,283],[1510,280],[1517,262],[1538,183],[1565,93],[1601,0]],7);
  add('sunset-transversal-v1','Sunset · via interna',[[1244,435],[1437,401]],7);
  add('sunset-oeste-norte-v1','Sunset · via interna',[[1244,267],[1244,599]],7);
  add('sunset-eixo-norte-v1','Sunset · via interna',[[1372,257],[1347,413]],7);
  add('sunset-leste-norte-v1','Sunset · via interna',[[1480,273],[1437,401]],7);
  add('sunset-portaria-norte-v1','Sunset · acesso',[[1173,581],[1196,585],[1212,599],[1244,599]],6);
  add('sunset-transversal-sul-v1','Sunset · via interna',[[1173,606],[1449,605]],7);
  add('sunset-base-v1','Sunset · via interna',[[1190,834],[1457,834]],7);
  add('sunset-oeste-sul-v1','Sunset · via interna',[[1244,605],[1244,834]],7);
  add('sunset-centro-sul-v1','Sunset · via interna',[[1340,605],[1359,834]],7);
  add('sunset-leste-sul-v1','Sunset · via interna',[[1449,605],[1457,834]],7);
  const network={version:1,width:1601,height:982,coordinateSystem:'image-pixels',roads};
  if(typeof module==='object'&&module.exports)module.exports=network;
  else root.MonitoraRoadNetwork=network;
})(typeof window==='undefined'?globalThis:window);
