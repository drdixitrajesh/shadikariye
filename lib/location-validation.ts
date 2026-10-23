import catalog from '../data/location-catalog.json';
const regions=catalog as Record<string,{states:string[];districts:Record<string,string[]>}>;
const knownStates=new Set(Object.values(regions).flatMap(region=>region.states));
export function validLocation(value:{country?:string;state?:string;district?:string}){
  const {country='',state='',district=''}=value;
  // Old profiles have only a city. Do not infer a country or overwrite their data.
  if(!country)return !state&&!district;
  const region=Object.hasOwn(regions,country)?regions[country]:undefined;
  if(!region)return false;
  if(region.states.length&&!state)return false;
  if(state&&!region.states.includes(state)&&knownStates.has(state))return false;
  const districts=Object.hasOwn(region.districts,state)?region.districts[state]:[];
  if(districts.length&&!district)return false;
  if(district&&!districts.includes(district)&&Object.values(region.districts).some(list=>list.includes(district)))return false;
  return true;
}
