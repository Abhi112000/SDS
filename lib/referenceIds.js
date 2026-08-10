function shortNumber(id) {
  const text = String(id || '');
  const hex = text.replace(/[^a-f0-9]/gi, '').slice(-8) || '0';
  return String(parseInt(hex, 16) % 10000).padStart(4, '0');
}

export function formatReferenceId(type, record, guest = false) {
  const prefix = type === 'invoice' ? 'SDS-I' : 'SDS-O';
  const audience = guest || record?.guest ? 'G' : 'U';
  const date = record?.createdAt ? new Date(record.createdAt) : new Date();
  const datePart = Number.isNaN(date.getTime())
    ? '000000'
    : `${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `${prefix}-${audience}-${datePart}-${shortNumber(record?._id || record?.invoiceId)}`;
}

export function customerKey(record) {
  const name = String(record?.name || record?.customerName || record?.userName || record?.payload?.name || '').trim().toLowerCase();
  const phone = String(record?.phone || record?.whatsapp || record?.payload?.phone || record?.payload?.whatsapp || '').replace(/\D/g, '');
  return `${name || 'unknown'}|${phone || 'no-phone'}`;
}
