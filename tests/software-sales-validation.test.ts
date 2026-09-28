import {describe,it,expect} from 'vitest';
import {validateLead} from '../supabase/functions/nx-software-sales/validation';
const valid={company:' Muster GmbH ',contact:'Alex',email:'A@example.com',request_kind:'demo',message:'Individuelle Projektabläufe',status:'won',notes:'Untrusted public input'};
describe('software lead validation',()=>{
 it('normalizes fields and never accepts public status or internal notes',()=>{const value=validateLead(valid);expect(value.company).toBe('Muster GmbH');expect(value.email).toBe('a@example.com');expect(value).not.toHaveProperty('status');expect(value).not.toHaveProperty('notes')});
 it('rejects missing identity, invalid email, unsupported kind and oversized message',()=>{for(const patch of [{company:''},{email:'not-an-email'},{request_kind:'admin'},{message:'x'.repeat(3001)},{contact:{name:'injected'}}])expect(()=>validateLead({...valid,...patch})).toThrow()});
 it('keeps optional project information without requiring a phone number',()=>{expect(validateLead({...valid,users_count:'5–10',industry:'Handel'})).toMatchObject({phone:'',users_count:'5–10',industry:'Handel'})});
});
