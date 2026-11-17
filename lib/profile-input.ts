import {z} from 'zod';
import {validBirthDate} from './security';
export const privateProfileSchema=z.object({
  birthDate:z.string().refine(validBirthDate),
  aadhaarLast4:z.string().regex(/^([0-9]{4})?$/).default(''),
  references:z.array(z.object({name:z.string().trim().min(2).max(80),relationship:z.string().trim().min(2).max(80),phone:z.string().regex(/^\+91[6-9]\d{9}$/),consent:z.literal(true)})).max(2).default([]),
  termsAccepted:z.literal(true),
});
