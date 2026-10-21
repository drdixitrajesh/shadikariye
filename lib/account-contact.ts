import {z} from 'zod';

export function normalizeMobile(value:unknown){
  if(typeof value!=='string'||value.length>30||!/^[+\d\s()-]+$/.test(value))return '';
  const digits=value.replace(/\D/g,'');
  const national=digits.length===12&&digits.startsWith('91')?digits.slice(2):digits;
  return /^[6-9]\d{9}$/.test(national)?'+91'+national:'';
}

export function accountContact(body:Record<string,unknown>){
  const mobile=normalizeMobile(body.mobile);
  if(!mobile)throw new Error('भारत का 10 अंकों वाला मोबाइल नंबर दें। / Enter a valid Indian mobile number.');
  const email=body.email===undefined?'':typeof body.email==='string'?body.email.trim():null;
  if(email===null||email.length>254||(email!==''&&!z.string().email().safeParse(email).success))throw new Error('सही Email ID दें या खाली छोड़ें। / Enter a valid email or leave it blank.');
  return {mobile,email};
}
