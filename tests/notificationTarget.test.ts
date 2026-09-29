import {describe,it,expect} from 'vitest';
import {notificationTarget} from '../src/lib/notificationTarget';
describe('notificationTarget',()=>{
  it('opens software inquiries in their own workspace',()=>expect(notificationTarget({category:'inquiry',target_url:'/new-nexaro-field-sales-crm/hub/?nx=software'})).toBe('software'));
  it('keeps regular inquiries in customers',()=>expect(notificationTarget({category:'inquiry',target_url:'/new-nexaro-field-sales-crm/hub/?nx=inquiry'})).toBe('customers'));
  it('does not follow arbitrary URLs',()=>expect(notificationTarget({category:'inquiry',target_url:'https://example.com/?nx=software'})).toBe('customers'));
  it('preserves task navigation',()=>expect(notificationTarget({category:'task',target_url:''})).toBe('tasks'));
});
