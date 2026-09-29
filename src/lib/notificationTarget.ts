export function notificationTarget(item: {category:string;target_url:string}): string {
  if (item.category === 'inquiry') {
    return item.target_url === '/new-nexaro-field-sales-crm/hub/?nx=software' ? 'software' : 'customers';
  }
  return 'tasks';
}
