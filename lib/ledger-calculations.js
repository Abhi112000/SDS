function chronological(transactions) {
  return [...transactions].sort((a, b) => {
    const dateDifference = new Date(a.date).getTime() - new Date(b.date).getTime();
    return dateDifference || new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  });
}

export function calculateAccountMovement(account, transactions) {
  return transactions.reduce((movement, item) => {
    if (item.status && item.status !== 'finalized') return movement;
    if (['sale', 'customer_payment', 'other_receipt'].includes(item.type)) {
      if (item.paidByAccountPaise) movement += item.paidByAccountPaise[account] || 0;
      else if (item.account === account) movement += item.amountPaise;
    }
    if (['sales_refund', 'supplier_payment', 'expense', 'owner_withdrawal', 'owner_reimbursement', 'other_payment'].includes(item.type) && item.account === account) movement -= item.amountPaise;
    if (['supplier_purchase', 'market_purchase'].includes(item.type)) {
      if (item.paidByAccountPaise) movement -= item.paidByAccountPaise[account] || 0;
      else if (item.account === account) movement -= item.paidAmountPaise || 0;
    }
    if (item.type === 'transfer' && item.account === account) movement -= item.amountPaise;
    if (item.type === 'transfer' && item.transferTo === account) movement += item.amountPaise;
    return movement;
  }, 0);
}

export function isAccountTransactionIncluded(transaction, openingBalanceDate) {
  const openingTime = new Date(openingBalanceDate || 0).getTime();
  return new Date(transaction.date).getTime() >= openingTime ||
    new Date(transaction.createdAt || 0).getTime() > openingTime;
}

export function calculateCustomerLedger(openingBalancePaise, transactions, throughDate) {
  let outstandingPaise = openingBalancePaise || 0;
  let advancePaise = 0;
  let error = null;
  for (const item of chronological(transactions)) {
    if ((item.status && item.status !== 'finalized') || (throughDate && new Date(item.date) > throughDate)) continue;
    if (item.type === 'credit_sale') {
      outstandingPaise += item.amountPaise;
      const applied = item.advanceAppliedPaise || 0;
      if (applied > advancePaise && !error) error = { transactionId: String(item._id), message: 'A credit sale applies more advance than the customer had available on that date' };
      advancePaise -= applied;
      outstandingPaise -= applied;
    }
    if (item.type === 'customer_payment') {
      const applied = Math.min(item.amountPaise, Math.max(0, outstandingPaise));
      outstandingPaise -= applied;
      advancePaise += item.amountPaise - applied;
    }
  }
  return { outstandingPaise, advancePaise, error };
}

export function calculateSupplierOutstanding(openingBalancePaise, transactions, throughDate) {
  let outstandingPaise = openingBalancePaise || 0;
  let error = null;
  for (const item of chronological(transactions)) {
    if ((item.status && item.status !== 'finalized') || (throughDate && new Date(item.date) > throughDate)) continue;
    if (item.type === 'supplier_purchase' || item.type === 'market_purchase') {
      outstandingPaise += item.amountPaise - (item.paidAmountPaise || 0) - (item.ownerContributionPaise || 0);
    }
    if (item.type === 'supplier_payment') {
      if (item.amountPaise > outstandingPaise && !error) error = { transactionId: String(item._id), message: 'A supplier payment exceeds the payable balance on that date' };
      outstandingPaise -= item.amountPaise;
    }
  }
  return { outstandingPaise, error };
}

export function validatePartyAllocations(parties, transactions) {
  const byParty = new Map();
  for (const item of transactions) {
    if (!item.partyId) continue;
    const key = String(item.partyId._id || item.partyId);
    if (!byParty.has(key)) byParty.set(key, []);
    byParty.get(key).push(item);
  }
  for (const party of parties) {
    const items = byParty.get(String(party._id)) || [];
    const result = party.type === 'customer'
      ? calculateCustomerLedger(party.openingBalancePaise, items)
      : calculateSupplierOutstanding(party.openingBalancePaise, items);
    if (result.error) return result.error;
  }
  return null;
}
