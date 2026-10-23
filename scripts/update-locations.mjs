// Refresh the bundled GeoNames country/admin1/admin2 snapshot. No runtime API key.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='https://download.geonames.org/export/dump/';
const files=['countryInfo.txt','admin1CodesASCII.txt','admin2Codes.txt'];
const sources=await Promise.all(files.map(async name=>{
  if(process.env.LOCATION_SOURCE_DIR)return readFile(process.env.LOCATION_SOURCE_DIR+'/'+name,'utf8');
  const response=await fetch(base+name,{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error(name+': '+response.status);
  return response.text();
}));
const lines=text=>text.split(/\r?\n/).filter(line=>line&&!line.startsWith('#')).map(line=>line.split('\t'));
const countries=lines(sources[0]).filter(row=>/^[A-Z]{2}$/.test(row[0])).map(row=>({code:row[0],name:row[4]})).sort((a,b)=>a.name.localeCompare(b.name,'en'));
const byCode=new Map(countries.map(c=>[c.code,c]));
const regions=Object.fromEntries(countries.map(c=>[c.name,{states:[],districts:{}}]));
const states=new Map();
for(const [code,name] of lines(sources[1])){
  const country=byCode.get(code.split('.')[0]);if(!country)continue;
  states.set(code,{country:country.name,name});
  regions[country.name].states.push(name);
  regions[country.name].districts[name]=[];
}
let unmatched=0;
for(const [code,name] of lines(sources[2])){
  const state=states.get(code.split('.').slice(0,2).join('.'));
  if(!state){unmatched++;continue;}
  regions[state.country].districts[state.name].push(name);
}
const sorted=items=>[...new Set(items)].sort((a,b)=>a.localeCompare(b,'en'));
let stateCount=0,districtCount=0;
await mkdir('public/locations',{recursive:true});await mkdir('data',{recursive:true});
for(const country of countries){
  const region=regions[country.name];region.states=sorted(region.states);stateCount+=region.states.length;
  for(const name of region.states){region.districts[name]=sorted(region.districts[name]);districtCount+=region.districts[name].length;}
  await writeFile('public/locations/'+country.code+'.json',JSON.stringify(region)+'\n');
}
const metadata={source:'GeoNames',url:'https://www.geonames.org/',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',retrievedAt:new Date().toISOString(),countries:countries.length,states:stateCount,districts:districtCount,unmatchedAdmin2:unmatched,files:files.map((name,i)=>({url:base+name,sha256:createHash('sha256').update(sources[i]).digest('hex')}))};
if(countries.length<240||stateCount<3000||districtCount<30000)throw new Error('Incomplete location snapshot');
await writeFile('public/locations/countries.json',JSON.stringify(countries)+'\n');
await writeFile('data/location-catalog.json',JSON.stringify(regions)+'\n');
await writeFile('public/locations/source.json',JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify(metadata));
