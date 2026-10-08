import { z } from 'zod';
export const COMMUNITIES = ['Kanyakubj','Saryupareen','Maithil','Gaur','Sanadhya','Saraswat','Deshastha','Chitpavan','Iyer','Iyengar','Jujhotiya','Paliwal','Pushkarna','Shrimali','Audichya','Nagar','Anavil','Modh','Khedaval','Utkal','Rarhi','Varendra','Kulin','Kashmiri Pandit','Goud Saraswat','Chandraseniya Saraswat','Karhade','Daivadnya','Havyaka','Shivalli','Kota','Sankethi','Smartha','Madhwa','Niyogi','Vaidiki','Dravida','Velanadu','Mulukanadu','Namboodiri','Embranthiri','Bhumihar','Kumaoni','Garhwali'];
export const GOTRAS = ['Shandilya','Bharadwaj','Kashyap','Vashishtha','Gautam','Atri','Kaushik','Vatsa','Agastya','Parashar','Jamadagni','Harita','Sankrit','Katyayan','Upmanyu','Dhananjay','Kavistha','Garg','Angirasa','Bhargava','Bhrigu','Vishwamitra','Kanva','Kaundinya','Mudgala','Shounaka','Galava','Badhula','Lohita','Mandavya','Devala','Markandeya','Chyavana','Aurva','Kutsa','Asita','Dalabhya','Shakti','Kapila'];
export const HINDI: Record<string,string> = {
  Kanyakubj:'कान्यकुब्ज', Saryupareen:'सरयूपारीण', Maithil:'मैथिल', Gaur:'गौड़', Sanadhya:'सनाढ्य', Saraswat:'सारस्वत', Deshastha:'देशस्थ', Chitpavan:'चितपावन', Iyer:'अय्यर', Iyengar:'अयंगार',
  Shandilya:'शाण्डिल्य', Bharadwaj:'भारद्वाज', Kashyap:'कश्यप', Vashishtha:'वशिष्ठ', Gautam:'गौतम', Atri:'अत्रि', Kaushik:'कौशिक', Vatsa:'वत्स', Agastya:'अगस्त्य', Parashar:'पराशर', Jamadagni:'जमदग्नि', Harita:'हरित',
  Sankrit:'सांकृत', Katyayan:'कात्यायन', Upmanyu:'उपमन्यु', Dhananjay:'धनंजय', Kavistha:'कविस्थ', Garg:'गर्ग', Unknown:'पता नहीं', Other:'अन्य', female:'वधू', male:'वर', Self:'स्वयं', Parent:'माता-पिता', Sibling:'भाई / बहन',
  'Never married':'अविवाहित', Divorced:'तलाकशुदा', Widowed:'विधवा / विधुर', Hindi:'हिंदी', English:'अंग्रेज़ी', Marathi:'मराठी', Tamil:'तमिल', Bengali:'बंगाली',
  Jujhotiya:'जुझौतिया',Paliwal:'पालीवाल',Pushkarna:'पुष्करणा',Shrimali:'श्रीमाली',Audichya:'औदीच्य',Nagar:'नागर',Anavil:'अनाविल',Modh:'मोढ़',Khedaval:'खेड़ावल',Utkal:'उत्कल',Rarhi:'राढ़ी',Varendra:'वारेंद्र',Kulin:'कुलीन','Kashmiri Pandit':'कश्मीरी पंडित','Goud Saraswat':'गौड़ सारस्वत','Chandraseniya Saraswat':'चांद्रसेनीय सारस्वत',Karhade:'करहाड़े',Daivadnya:'दैवज्ञ',Havyaka:'हव्यक',Shivalli:'शिवल्ली',Kota:'कोटा',Sankethi:'संकेती',Smartha:'स्मार्त',Madhwa:'माध्व',Niyogi:'नियोगी',Vaidiki:'वैदिकी',Dravida:'द्राविड़',Velanadu:'वेलनाडु',Mulukanadu:'मुलकनाडु',Namboodiri:'नम्बूदिरि',Embranthiri:'एम्ब्रान्तिरि',Bhumihar:'भूमिहार',Kumaoni:'कुमाऊँनी',Garhwali:'गढ़वाली',
  Angirasa:'अंगिरस',Bhargava:'भार्गव',Bhrigu:'भृगु',Vishwamitra:'विश्वामित्र',Kanva:'कण्व',Kaundinya:'कौण्डिन्य',Mudgala:'मुद्गल',Shounaka:'शौनक',Galava:'गालव',Badhula:'बाधुल',Lohita:'लोहित',Mandavya:'माण्डव्य',Devala:'देवल',Markandeya:'मार्कण्डेय',Chyavana:'च्यवन',Aurva:'और्व',Kutsa:'कुत्स',Asita:'असित',Dalabhya:'दालभ्य',Shakti:'शक्ति',Kapila:'कपिल',
};
const aliases: Record<string,string> = {
  saankrit:'Sankrit', sankriti:'Sankrit', upamanyu:'Upmanyu', dhananjaya:'Dhananjay', bhardwaj:'Bharadwaj', shandiyla:'Shandilya', sandilya:'Shandilya', shandilya:'Shandilya', 'शांडिल्य':'Shandilya', 'शाण्डिल्य':'Shandilya', 'शाण्डिल्य गोत्र':'Shandilya',
  bharadwaj:'Bharadwaj', bharadvaj:'Bharadwaj', bharadvaja:'Bharadwaj', vashistha:'Vashishtha', vasistha:'Vashishtha',
  kashyapa:'Kashyap', gautama:'Gautam', parasara:'Parashar', parashara:'Parashar', 'पता नहीं':'Unknown', unknown:'Unknown',
};
export function canonicalGotra(value: string) {
  const clean = value.normalize('NFKC').trim();
  return aliases[clean.toLowerCase()] ?? GOTRAS.find(g=>g.toLowerCase()===clean.toLowerCase()) ?? clean;
}
export type Reference={name:string;relationship:string;phone:string;consent:boolean};
export type Profile = {publishedAt?:number;expiresAt?:number;id:string;name:string;email?:string;age:number;gender:string;community:string;gotra:string;city:string;education:string;profession:string;height:number;maritalStatus:string;about:string;managedBy:string;language:string;demo:boolean;portrait:number|null;photoKey:string|null;photoKeys?:string[];photoSlots?:{slot:number;key:string}[];referenceCount?:number;phoneVerified?:boolean;};
export type Filters = {gender?:string;ageMin?:number;ageMax?:number;community?:string;gotra?:string;city?:string;excludeGotra?:string;query?:string;maritalStatus?:string;};
export function matchesFilters(p:Profile,f:Filters) {
  if (f.gender && f.gender !== 'all' && p.gender!==f.gender) return false;
  if (f.ageMin && p.age<f.ageMin || f.ageMax && p.age>f.ageMax) return false;
  if (f.community && f.community!=='all' && p.community!==f.community) return false;
  if (f.gotra && f.gotra!=='all' && canonicalGotra(p.gotra)!==canonicalGotra(f.gotra)) return false;
  if (f.excludeGotra && canonicalGotra(f.excludeGotra)!=='Unknown' && canonicalGotra(p.gotra)===canonicalGotra(f.excludeGotra)) return false;
  if (f.city && !p.city.toLowerCase().includes(f.city.toLowerCase().trim())) return false;
  if (f.maritalStatus && f.maritalStatus!=='all' && p.maritalStatus!==f.maritalStatus) return false;
  if (f.query && ![p.name,p.city,p.education,p.profession,p.community,p.gotra,HINDI[p.gotra],HINDI[p.community]].filter(Boolean).join(' ').toLowerCase().includes(f.query.toLowerCase().trim())) return false;
  return true;
}
const text=(min:number,max:number)=>z.string().trim().min(min).max(max);
export const profileSchema=z.object({name:text(2,80),email:z.string().trim().max(254).pipe(z.union([z.string().email(),z.literal('')])).optional().default(''),age:z.number().int().min(21).max(70),gender:z.enum(['female','male']),community:text(2,60),gotra:text(2,60).transform(canonicalGotra),city:text(2,80),education:text(2,100),profession:text(2,100),height:z.number().int().min(120).max(230),maritalStatus:z.enum(['Never married','Divorced','Widowed']),about:text(20,1500),managedBy:z.enum(['Self','Parent','Sibling']),language:text(2,60),consent:z.literal(true)});
export function validateProfile(value:unknown){return profileSchema.safeParse(value);}
export const DEMO_PROFILES:Profile[]=[
  {id:'demo-ananya',name:'Ananya Sharma',age:27,gender:'female',community:'Kanyakubj',gotra:'Shandilya',city:'Lucknow',education:'MBA, IIM Indore',profession:'Product Designer',height:165,maritalStatus:'Never married',about:'I find joy in small things: a good book, family dinners and exploring a new city. I value kindness, honest conversations and a partner who supports us both growing together.',managedBy:'Self',language:'Hindi',demo:true,portrait:0,photoKey:null},
  {id:'demo-ishita',name:'Ishita Mishra',age:28,gender:'female',community:'Saryupareen',gotra:'Bharadwaj',city:'Delhi',education:'MD, Internal Medicine',profession:'Doctor',height:163,maritalStatus:'Never married',about:'A doctor who loves classical music, meaningful conversations and weekends with family. Looking for a thoughtful partner with a positive outlook and shared respect for our traditions.',managedBy:'Parent',language:'Hindi',demo:true,portrait:1,photoKey:null},
  {id:'demo-meera',name:'Meera Jha',age:26,gender:'female',community:'Maithil',gotra:'Kashyap',city:'Bengaluru',education:'M.Tech, Computer Science',profession:'Software Engineer',height:160,maritalStatus:'Never married',about:'Curious by nature and happiest around books, music and people I love. I hope to build a partnership where we celebrate each other, our families and our individual ambitions.',managedBy:'Self',language:'Hindi',demo:true,portrait:2,photoKey:null},
  {id:'demo-aarav',name:'Aarav Tripathi',age:30,gender:'male',community:'Kanyakubj',gotra:'Bharadwaj',city:'Pune',education:'B.Tech, IIT Roorkee',profession:'Engineering Manager',height:178,maritalStatus:'Never married',about:'An engineer, amateur cook and avid reader. Family is at the centre of my life. Looking for companionship built on friendship, mutual respect and the little everyday moments.',managedBy:'Self',language:'Hindi',demo:true,portrait:3,photoKey:null},
  {id:'demo-rohan',name:'Rohan Shukla',age:29,gender:'male',community:'Gaur',gotra:'Shandilya',city:'Jaipur',education:'Chartered Accountant',profession:'Finance Consultant',height:175,maritalStatus:'Never married',about:'I enjoy hiking, live music and sharing long meals with family. I believe in balancing tradition with an open mind and making space for each other in a committed relationship.',managedBy:'Parent',language:'Hindi',demo:true,portrait:4,photoKey:null},
  {id:'demo-aditya',name:'Aditya Joshi',age:31,gender:'male',community:'Saraswat',gotra:'Vashishtha',city:'Mumbai',education:'M.Arch, Architecture',profession:'Architect',height:180,maritalStatus:'Never married',about:'An architect with a love for art, travel and thoughtful design. I hope to meet a warm, independent person to share a home, meaningful experiences and a life of learning.',managedBy:'Self',language:'Marathi',demo:true,portrait:5,photoKey:null},
];
