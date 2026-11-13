import { useCallback, useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import * as XLSX from 'xlsx';
import AdminSidebar from '@/components/AdminSidebar';
import { authRedirect } from '@/lib/authRedirect';

const TYPES = [
  ['sale', 'Cash / UPI sale'],
  ['monthly_opening_balance', 'Manual opening balance saved'],
  ['sales_refund', 'Sales refund'],
  ['credit_sale', 'Customer credit sale'],
  ['customer_payment', 'Customer payment'],
  ['supplier_purchase', 'Supplier purchase'],
  ['supplier_payment', 'Supplier payment'],
  ['market_purchase', 'Market purchase'],
  ['expense', 'Expense'],
  ['owner_withdrawal', 'Owner withdrawal'],
  ['owner_reimbursement', 'Owner reimbursement'],
  ['owner_investment', 'Owner investment'],
  ['other_receipt', 'Other money received'],
  ['other_payment', 'Other money paid'],
  ['transfer', 'Account transfer'],
  ['adjustment', 'Adjustment']
];
const COMMON_TYPES = ['sale', 'credit_sale', 'customer_payment', 'supplier_purchase', 'supplier_payment', 'market_purchase', 'expense', 'owner_withdrawal', 'transfer'];
const ADVANCED_TYPES = TYPES.filter(([type]) => !COMMON_TYPES.includes(type));

const ACCOUNTS = ['cash', 'upi', 'bank', 'other'];
const today = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const formatDate = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const recentThreeMonthsStart = () => {
  const now = new Date();
  return formatDate(new Date(now.getFullYear(), now.getMonth() - 2, 1));
};
const money = (paise = 0) => `₹${(Number(paise || 0) / 100).toFixed(2)}`;
const labelForType = type => TYPES.find(([key]) => key === type)?.[1] || type;
const monthLabel = value => {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};
const monthOptionsFrom = (startMonth, count = 24) => {
  if (!startMonth) return [];
  const [year, month] = startMonth.split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 + index, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  });
};

const emptyForm = () => ({
  type: 'sale', date: today(), amount: '', paidAmount: '0', partyId: '',
  appliedAmount: '', advanceApplied: '0', linkedTransactionId: '',
  account: 'cash', transferTo: 'upi', category: '', reference: '', description: '', status: 'finalized',
  hasPaymentSplit: false, splitCash: '', splitUpi: '', ownerContribution: '0'
});

export default function LedgerAdmin() {
  const [section, setSection] = useState('earnings');
  const [earningsRefreshCounter, setEarningsRefreshCounter] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [parties, setParties] = useState([]);
  const [partyDirectory, setPartyDirectory] = useState([]);
  const [partyDirectoryPage, setPartyDirectoryPage] = useState(1);
  const [partyDirectoryTotal, setPartyDirectoryTotal] = useState(0);
  const [partySearch, setPartySearch] = useState('');
  const [showArchivedParties, setShowArchivedParties] = useState(false);
  const [transactionPartySearch, setTransactionPartySearch] = useState('');
  const [transactionPartyOptions, setTransactionPartyOptions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountDrafts, setAccountDrafts] = useState({});
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [purchaseTransactions, setPurchaseTransactions] = useState([]);
  const [expenseTransactions, setExpenseTransactions] = useState([]);
  const [transactionType, setTransactionType] = useState('');
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionTotal, setTransactionTotal] = useState(0);
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [historyParty, setHistoryParty] = useState(null);
  const [historyTransactions, setHistoryTransactions] = useState([]);
  const [customerPaymentParty, setCustomerPaymentParty] = useState(null);
  const [customerPaymentAmount, setCustomerPaymentAmount] = useState('');
  const [customerPaymentAccount, setCustomerPaymentAccount] = useState('cash');
  const [customerPaymentNote, setCustomerPaymentNote] = useState('');
  const [customerPaymentSaving, setCustomerPaymentSaving] = useState(false);
  const [fromDate, setFromDate] = useState(recentThreeMonthsStart);
  const [toDate, setToDate] = useState(today);
  const [summary, setSummary] = useState(null);
  const [currentBalances, setCurrentBalances] = useState(null);
  const [reportType, setReportType] = useState('statement');
  const [reportGroup, setReportGroup] = useState('day');
  const [reportPartyId, setReportPartyId] = useState('');
  const [reportAccount, setReportAccount] = useState('shop');
  const [reportCategory, setReportCategory] = useState('');
  const [reportData, setReportData] = useState(null);
  const [reportPage, setReportPage] = useState(1);
  const [selectedReportsMonth, setSelectedReportsMonth] = useState('');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [partyForm, setPartyForm] = useState({ name: '', phone: '', address: '', notes: '' });
  const [editingId, setEditingId] = useState('');
  const [editingStatus, setEditingStatus] = useState('');
  const [editReturnSection, setEditReturnSection] = useState('');
  const [showAdvancedTypes, setShowAdvancedTypes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const loadParties = useCallback(async () => {
    const [customers, suppliers] = await Promise.all(['customer', 'supplier'].map(async type => {
      const response = await fetch(`/api/admin/ledger/parties?type=${type}&limit=100`, { credentials: 'include' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load accounts');
      return body.items || [];
    }));
    setParties([...customers, ...suppliers]);
  }, []);

  const loadPartyDirectory = useCallback(async () => {
    if (!['customer', 'supplier'].includes(section)) return;
    const params = new URLSearchParams({ type: section, q: partySearch, page: String(partyDirectoryPage), limit: '50', includeArchived: String(showArchivedParties) });
    const response = await fetch(`/api/admin/ledger/parties?${params}`, { credentials: 'include' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Unable to load ledger accounts');
    setPartyDirectory(body.items || []);
    setPartyDirectoryTotal(body.total || 0);
  }, [partyDirectoryPage, partySearch, section, showArchivedParties]);

  const loadTransactions = useCallback(async () => {
    const params = new URLSearchParams({ limit: '100' });
    if (transactionType) params.set('type', transactionType);
    if (query.trim()) params.set('q', query.trim());
    if (selectedPartyId) params.set('partyId', selectedPartyId);
    params.set('page', String(transactionPage));
    const response = await fetch(`/api/admin/ledger/transactions?${params}`, { credentials: 'include' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Unable to load transactions');
    setTransactions(body.items || []);
    setTransactionTotal(body.total || 0);
  }, [query, selectedPartyId, transactionPage, transactionType]);

  const loadSummary = useCallback(async () => {
    const params = new URLSearchParams({ from: fromDate, to: toDate });
    const response = await fetch(`/api/admin/ledger/summary?${params}`, { credentials: 'include' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Unable to load ledger summary');
    setSummary(body);
  }, [fromDate, toDate]);

  const loadCurrentBalances = useCallback(async () => {
    const businessDate = today();
    const params = new URLSearchParams({ to: businessDate });
    const response = await fetch(`/api/admin/ledger/summary?${params}`, { credentials: 'include' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Unable to load current ledger balances');
    setCurrentBalances(body);
  }, []);

  const loadAccounts = useCallback(async () => {
    const response = await fetch('/api/admin/ledger/accounts', { credentials: 'include' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Unable to load payment accounts');
    setAccounts(body.accounts || []);
    setAccountDrafts(Object.fromEntries((body.accounts || []).map(item => [item.account, {
      amount: (item.openingBalancePaise / 100).toFixed(2),
      asOfDate: formatDate(new Date(item.openingBalanceDate)),
      reconciledAmount: '',
      reconciliationDate: today(),
      note: ''
    }])));
  }, []);

  const loadExpenseCategories = useCallback(async () => {
    const response = await fetch('/api/admin/ledger/expense-categories', { credentials: 'include' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Unable to load expense categories');
    setExpenseCategories(body.categories || []);
  }, []);

  const loadPurchaseTransactions = useCallback(async () => {
    const params = new URLSearchParams({ type: 'market_purchase', limit: '100' });
    const response = await fetch(`/api/admin/ledger/transactions?${params}`, { credentials: 'include' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Unable to load purchase trips');
    const supplierParams = new URLSearchParams({ type: 'supplier_purchase', limit: '100' });
    const supplierResponse = await fetch(`/api/admin/ledger/transactions?${supplierParams}`, { credentials: 'include' });
    const supplierBody = await supplierResponse.json();
    if (!supplierResponse.ok) throw new Error(supplierBody.error || 'Unable to load supplier purchases');
    setPurchaseTransactions([...(body.items || []), ...(supplierBody.items || [])].filter(item => item.status === 'finalized'));
    const expenseResponse = await fetch('/api/admin/ledger/transactions?type=expense&limit=100', { credentials: 'include' });
    const expenseBody = await expenseResponse.json();
    if (!expenseResponse.ok) throw new Error(expenseBody.error || 'Unable to load operating expenses');
    setExpenseTransactions(expenseBody.items || []);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadParties(), loadTransactions(), loadSummary(), loadCurrentBalances(), loadAccounts(), loadExpenseCategories(), loadPurchaseTransactions()]);
    } catch (error) {
      setNotice(error.message || 'Unable to load ledger data');
    } finally {
      setLoading(false);
    }
  }, [loadAccounts, loadCurrentBalances, loadExpenseCategories, loadParties, loadPurchaseTransactions, loadSummary, loadTransactions]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (['customer', 'supplier'].includes(section)) {
      const timer = setTimeout(() => {
        loadPartyDirectory().catch(error => setNotice(error.message || 'Unable to search accounts'));
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [loadPartyDirectory, section]);
  useEffect(() => {
    const partyTypeForForm = ['credit_sale', 'customer_payment'].includes(form.type) ? 'customer' : 'supplier';
    if (!['credit_sale', 'customer_payment', 'supplier_purchase', 'supplier_payment', 'market_purchase'].includes(form.type)) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ type: partyTypeForForm, q: transactionPartySearch, limit: '100' });
        const response = await fetch(`/api/admin/ledger/parties?${params}`, { credentials: 'include' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to search accounts');
        if (active) setTransactionPartyOptions(body.items || []);
      } catch (error) {
        if (active) setNotice(error.message || 'Unable to search accounts');
      }
    }, 150);
    return () => { active = false; clearTimeout(timer); };
  }, [form.type, transactionPartySearch]);

  const filteredTransactions = transactions;

  function updateForm(key, value) {
    setForm(current => {
      if (key === 'type') {
        return {
          ...current,
          type: value,
          account: value === 'credit_sale' ? 'credit' : (current.account === 'credit' ? 'cash' : current.account),
          partyId: '',
          appliedAmount: '',
          advanceApplied: '0',
          hasPaymentSplit: false,
          paidAmount: ['market_purchase', 'supplier_purchase'].includes(value) ? current.paidAmount : '0'
        };
      }
      if (key === 'account' && value === 'credit') return { ...current, account: value, paidAmount: '0' };
      return { ...current, [key]: value };
    });
  }

  function selectDateRange(preset) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (preset === 'today') {
      setFromDate(formatDate(startOfDay));
      setToDate(formatDate(startOfDay));
    } else if (preset === 'yesterday') {
      const yesterday = new Date(startOfDay);
      yesterday.setDate(yesterday.getDate() - 1);
      setFromDate(formatDate(yesterday));
      setToDate(formatDate(yesterday));
    } else if (preset === 'month') {
      setFromDate(formatDate(new Date(now.getFullYear(), now.getMonth(), 1)));
      setToDate(today());
    } else if (preset === 'previous') {
      setFromDate(formatDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
      setToDate(formatDate(new Date(now.getFullYear(), now.getMonth(), 0)));
    }
  }

  async function saveTransaction(event) {
    event.preventDefault();
    setNotice('');
    setSaving(true);
    try {
      const isPurchase = ['supplier_purchase', 'market_purchase'].includes(form.type);
      const splitCashPaise = amountPaise(form.splitCash);
      const splitUpiPaise = amountPaise(form.splitUpi);
      const hasSplit = form.hasPaymentSplit && ['sale', 'market_purchase'].includes(form.type);
      if (hasSplit && (splitCashPaise === null || splitUpiPaise === null || (form.type === 'sale' && splitCashPaise + splitUpiPaise <= 0))) {
        setNotice('Enter valid cash and UPI amounts for this transaction.');
        return;
      }
      const splitTotalPaise = hasSplit ? splitCashPaise + splitUpiPaise : 0;
      const existing = editingId ? transactions.find(t => t._id === editingId) : null;
      let reason = '';
      if ((existing?.status || editingStatus) === 'finalized') {
        reason = window.prompt('Correction reason (required for finalized transactions):') || '';
        if (!reason.trim()) return;
      }
      const body = {
        ...form,
        amount: form.type === 'sale' && hasSplit ? (splitTotalPaise / 100).toFixed(2) : form.amount,
        paidAmount: isPurchase ? (form.type === 'market_purchase' && hasSplit ? (splitTotalPaise / 100).toFixed(2) : form.paidAmount) : '0',
        paidByAccount: hasSplit ? {
          cash: (splitCashPaise / 100).toFixed(2),
          upi: (splitUpiPaise / 100).toFixed(2),
          bank: '0',
          other: '0'
        } : editingId ? null : undefined,
        ownerContribution: form.type === 'market_purchase' ? form.ownerContribution : '0',
        partyId: form.partyId || null,
        idempotencyKey: editingId ? undefined : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)
      };
      const response = await fetch('/api/admin/ledger/transactions', {
        method: editingId ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, ...(editingId ? { id: editingId, reason } : {}) })
      });
      const result = await response.json();
      if (!response.ok) {
        setNotice(result.error || `Unable to save transaction (HTTP ${response.status})`);
        return;
      }
      setForm(emptyForm());
      setEditingId('');
      setEditingStatus('');
      const returnSection = editReturnSection;
      setEditReturnSection('');
      setShowAdvancedTypes(false);
      setNotice('Transaction saved.');
      await refresh();
      setEarningsRefreshCounter(value => value + 1);
      if (returnSection) setSection(returnSection);
    } catch (error) {
      console.error('ledger transaction form submission failed', error);
      setNotice(error.message || 'Unable to save transaction. Check the connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function createParty(event) {
    event.preventDefault();
    setNotice('');
    setSaving(true);
    try {
      const response = await fetch('/api/admin/ledger/parties', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...partyForm, type: section, openingBalance: '0' })
      });
      const result = await response.json();
      if (!response.ok) {
        setNotice(result.error || `Unable to create account (HTTP ${response.status})`);
        return;
      }
      setPartyForm({ name: '', phone: '', address: '', notes: '' });
      setPartySearch('');
      setPartyDirectoryPage(1);
      setNotice(result.duplicateMobileWarning
        ? `Account created. Duplicate mobile warning: ${result.duplicateMobileWarning.name} (${result.duplicateMobileWarning.phone})`
        : 'Account created.');
      await refresh();
      await loadPartyDirectory();
    } catch (error) {
      console.error('ledger account form submission failed', error);
      setNotice(error.message || 'Unable to create account. Check the connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  function updateAccountDraft(account, key, value) {
    setAccountDrafts(current => ({ ...current, [account]: { ...current[account], [key]: value } }));
  }

  async function saveOpeningBalance(account) {
    const draft = accountDrafts[account];
    const current = accounts.find(item => item.account === account);
    const existingOpening = current?.audit?.some(entry => entry.action === 'opening_balance_updated');
    const reason = existingOpening ? (window.prompt('Reason for correcting this opening balance (required):') || '') : '';
    if (existingOpening && !reason.trim()) return;
    const response = await fetch('/api/admin/ledger/accounts', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'opening-balance', account, amount: draft.amount, asOfDate: draft.asOfDate, reason })
    });
    const result = await response.json();
    if (!response.ok) setNotice(result.error || 'Unable to save opening balance');
    else {
      setNotice(`${account.toUpperCase()} opening balance saved.`);
      await refresh();
    }
  }

  async function reconcileAccount(account) {
    const draft = accountDrafts[account];
    const response = await fetch('/api/admin/ledger/accounts', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reconcile', account, amount: draft.reconciledAmount,
        asOfDate: draft.reconciliationDate, note: draft.note
      })
    });
    const result = await response.json();
    if (!response.ok) setNotice(result.error || 'Unable to save reconciliation');
    else {
      setNotice(`${account.toUpperCase()} statement reconciliation recorded; calculated balances were not changed.`);
      await refresh();
    }
  }

  async function addExpenseCategory(event) {
    event.preventDefault();
    const response = await fetch('/api/admin/ledger/expense-categories', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCategory })
    });
    const result = await response.json();
    if (!response.ok) setNotice(result.error || 'Unable to add category');
    else {
      setNewCategory('');
      setNotice('Expense category added.');
      await Promise.all([loadExpenseCategories(), refresh()]);
    }
  }

  async function toggleExpenseCategory(category) {
    const response = await fetch('/api/admin/ledger/expense-categories', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: category._id, active: !category.active })
    });
    const result = await response.json();
    if (!response.ok) setNotice(result.error || 'Unable to update category');
    else await loadExpenseCategories();
  }

  const generateReport = useCallback(async (event, requestedPage = reportPage, dateRange = {}) => {
    if (event) event.preventDefault();
    setNotice('');
    const reportFrom = dateRange.from || fromDate;
    const reportTo = dateRange.to || toDate;
    const params = new URLSearchParams({
      report: reportType, groupBy: reportGroup, from: reportFrom, to: reportTo, page: String(requestedPage), limit: '100'
    });
    if (reportPartyId) params.set('partyId', reportPartyId);
    if (reportAccount) params.set('account', reportAccount);
    if (reportCategory) params.set('category', reportCategory);
    const response = await fetch(`/api/admin/ledger/reports?${params}`, { credentials: 'include' });
    const body = await response.json();
    if (!response.ok) {
      setNotice(body.error || 'Unable to generate report');
      return;
    }
    setReportData(body);
  }, [reportType, reportGroup, fromDate, toDate, reportPartyId, reportAccount, reportCategory, reportPage]);

  const selectReportsMonth = useCallback((month) => {
    if (!month) return;
    const [year, monthNumber] = month.split('-').map(Number);
    const from = `${month}-01`;
    const toDateValue = new Date(Date.UTC(year, monthNumber, 0));
    const to = `${toDateValue.getUTCFullYear()}-${String(toDateValue.getUTCMonth() + 1).padStart(2, '0')}-${String(toDateValue.getUTCDate()).padStart(2, '0')}`;
    setSelectedReportsMonth(month);
    setFromDate(from);
    setToDate(to);
    setReportPage(1);
    generateReport(null, 1, { from, to });
  }, [generateReport]);

  async function saveMonthlyOpeningBalance(month, amount) {
    try {
      const response = await fetch('/api/admin/ledger/monthly-balances', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, amount })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save monthly opening balance');
      setReportData(current => current ? {
        ...current,
        balanceSummary: {
          ...current.balanceSummary,
          nextMonthOpeningBalancePaise: month === current.balanceSummary.nextMonth
            ? result.balance.openingBalancePaise
            : current.balanceSummary.nextMonthOpeningBalancePaise
        }
      } : current);
      setEarningsRefreshCounter(value => value + 1);
      setNotice(`${monthLabel(month)} opening balance saved.`);
      return result.balance;
    } catch (error) {
      setNotice(error.message || 'Unable to save monthly opening balance');
      throw error;
    }
  }

  async function exportReport(format = 'csv') {
    const collected = [];
    let page = 1;
    let total = reportData?.total || 0;
    while (collected.length < total) {
      const params = new URLSearchParams({
        report: reportType, groupBy: reportGroup, from: fromDate, to: toDate, page: String(page), limit: '100'
      });
      if (reportPartyId) params.set('partyId', reportPartyId);
      if (reportAccount) params.set('account', reportAccount);
      if (reportCategory) params.set('category', reportCategory);
      const response = await fetch(`/api/admin/ledger/reports?${params}`, { credentials: 'include' });
      const body = await response.json();
      if (!response.ok) {
        setNotice(body.error || 'Unable to export report');
        return;
      }
      total = body.total;
      if (!body.transactions.length) break;
      collected.push(...body.transactions);
      page += 1;
    }
    const rows = reportType === 'statement'
      ? [['Activity time', 'Business date', 'Activity', 'Account / party', 'Notes', 'Money in (₹)', 'Money out (₹)', 'Balance (₹)']]
      : [['Date', 'Type', 'Account', 'Party', 'Amount (₹)', 'Paid (₹)', 'Applied (₹)', 'Advance Used (₹)', 'Expense Category', 'Linked Purchase', 'Reference', 'Notes']];
    collected.forEach(item => rows.push(reportType === 'statement' ? [
      new Date(item.createdAt || item.date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      new Date(item.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
      labelForType(item.type), item.partyId?.name || item.account || '',
      [item.category, item.description].filter(Boolean).join(' · '),
      ((item.inflowPaise || 0) / 100).toFixed(2), ((item.outflowPaise || 0) / 100).toFixed(2),
      ((item.runningBalancePaise || 0) / 100).toFixed(2)
    ] : [
      new Date(item.date).toISOString().slice(0, 10), labelForType(item.type), item.account || '',
      item.partyId?.name || '', (item.amountPaise / 100).toFixed(2), ((item.paidAmountPaise || 0) / 100).toFixed(2),
      item.appliedAmountPaise == null ? '' : (item.appliedAmountPaise / 100).toFixed(2),
      ((item.advanceAppliedPaise || 0) / 100).toFixed(2), item.category || '',
      item.linkedTransactionId?._id || item.linkedTransactionId || '', item.reference || '', item.description || ''
    ]));
    const filename = `sds-ledger-${reportType}-${today()}`;
    if (format === 'xlsx') {
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Ledger report');
      XLSX.writeFile(workbook, `${filename}.xlsx`);
    } else {
      const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      link.download = `${filename}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  }

  function changeReportType(value) {
    setReportType(value);
    if (value === 'customer' || value === 'supplier') setReportGroup('party');
    else if (value === 'expenses') setReportGroup('category');
    else if (value === 'accounts') setReportGroup('account');
    else if (value === 'daily') setReportGroup('day');
    else if (value === 'monthly') setReportGroup('month');
    else if (value === 'yearly') setReportGroup('year');
    else setReportGroup('type');
    setReportPartyId('');
    setReportAccount(value === 'statement' ? 'shop' : '');
    setReportCategory('');
    setReportPage(1);
  }

  async function editParty(party) {
    const name = window.prompt('Account name:', party.name);
    if (name === null) return;
    const phone = window.prompt('Mobile number:', party.phone || '');
    if (phone === null) return;
    const response = await fetch('/api/admin/ledger/parties', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: party._id, name, phone })
    });
    const result = await response.json();
    if (!response.ok) setNotice(result.error || 'Unable to update account');
    else await refresh();
  }

  async function saveCustomerPayment(event) {
    event.preventDefault();
    if (!customerPaymentParty) return;
    const paymentPaise = amountPaise(customerPaymentAmount);
    if (!paymentPaise || paymentPaise <= 0) {
      setNotice('Enter a valid payment amount.');
      return;
    }
    setCustomerPaymentSaving(true);
    setNotice('');
    try {
      const response = await fetch('/api/admin/ledger/transactions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'customer_payment',
          date: today(),
          amount: customerPaymentAmount,
          partyId: customerPaymentParty._id,
          account: customerPaymentAccount,
          description: customerPaymentNote,
          status: 'finalized',
          idempotencyKey: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save customer payment');
      setCustomerPaymentParty(null);
      setCustomerPaymentAmount('');
      setCustomerPaymentNote('');
      setNotice(`Payment saved: ${money(result.allocation?.appliedAmountPaise || 0)} applied to the outstanding balance${(result.allocation?.advancePaise || 0) > 0 ? `; ${money(result.allocation.advancePaise)} added as advance` : ''}.`);
      await refresh();
      await loadPartyDirectory();
    } catch (error) {
      setNotice(error.message || 'Unable to save customer payment');
    } finally {
      setCustomerPaymentSaving(false);
    }
  }

  async function showPartyHistory(party) {
    setHistoryParty(party);
    try {
      const params = new URLSearchParams({ partyId: party._id, limit: '100' });
      const response = await fetch(`/api/admin/ledger/transactions?${params}`, { credentials: 'include' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Unable to load history (HTTP ${response.status})`);
      setHistoryTransactions(result.items || []);
    } catch (error) {
      setNotice(error.message || 'Unable to load account history');
    }
  }

  async function editTransaction(item, returnSection = '') {
    const partyId = typeof item.partyId === 'object' && item.partyId ? item.partyId._id : item.partyId || '';
    setSection('transactions');
    setEditingId(item._id);
    setEditingStatus(item.status || '');
    setEditReturnSection(returnSection);
    setShowAdvancedTypes(!COMMON_TYPES.includes(item.type));
    setForm({
      type: item.type, date: new Date(item.date).toISOString().slice(0, 10),
      amount: (item.amountPaise / 100).toFixed(2), paidAmount: (item.paidAmountPaise / 100).toFixed(2),
      appliedAmount: item.appliedAmountPaise == null ? '' : (item.appliedAmountPaise / 100).toFixed(2),
      advanceApplied: ((item.advanceAppliedPaise || 0) / 100).toFixed(2),
      linkedTransactionId: item.linkedTransactionId?._id || item.linkedTransactionId || '',
      partyId, account: item.account || 'cash', transferTo: item.transferTo || 'upi',
      category: item.category || '', reference: item.reference || '', description: item.description || '', status: item.status,
      hasPaymentSplit: !!item.paidByAccountPaise,
      splitCash: item.paidByAccountPaise ? ((item.paidByAccountPaise.cash || 0) / 100).toFixed(2) : '',
      splitUpi: item.paidByAccountPaise ? ((item.paidByAccountPaise.upi || 0) / 100).toFixed(2) : '',
      ownerContribution: ((item.ownerContributionPaise || 0) / 100).toFixed(2)
    });
  }

  async function deleteTransaction(item) {
    const businessDate = new Date(item.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    const description = `${labelForType(item.type)} · ${money(item.amountPaise)} · ${businessDate}`;
    if (!window.confirm(`Permanently delete this ledger entry from the database?\n\n${description}\n\nThis cannot be undone and will recalculate affected balances and reports.`)) return false;
    const confirmation = window.prompt('To confirm permanent deletion, type DELETE:');
    if (confirmation !== 'DELETE') {
      if (confirmation !== null) setNotice('Confirmation did not match. Nothing was deleted.');
      return false;
    }
    const response = await fetch('/api/admin/ledger/transactions', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item._id })
    });
    const result = await response.json();
    if (!response.ok) {
      setNotice(result.error || 'Unable to permanently delete transaction');
      return false;
    }
    setNotice('Transaction permanently deleted. Ledger balances and reports have been recalculated.');
    setEarningsRefreshCounter(value => value + 1);
    await refresh();
    if (historyParty) await showPartyHistory(historyParty);
    if (reportData) await generateReport(null, reportPage);
    return true;
  }

  async function archiveParty(party) {
    const action = party.isActive === false ? 'restore' : 'archive';
    const prompt = action === 'archive'
      ? `Delete ${party.name} from active ${party.type} accounts? Its balance and history will be preserved.`
      : `Restore ${party.name} to active ${party.type} accounts?`;
    if (!window.confirm(prompt)) return;
    const reason = window.prompt(`Reason to ${action} this account (required):`) || '';
    if (!reason.trim()) return;
    try {
      const response = await fetch('/api/admin/ledger/parties', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: party._id, action, reason })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Unable to ${action} account`);
      setNotice(action === 'archive' ? 'Account removed from active lists; its ledger history is preserved.' : 'Account restored.');
      if (historyParty?._id === party._id) setHistoryParty(null);
      await refresh();
      await loadPartyDirectory();
    } catch (error) {
      setNotice(error.message || `Unable to ${action} account`);
    }
  }

  async function deleteSettledCustomer(party) {
    if (party.outstandingPaise !== 0 || party.advancePaise !== 0) return;
    if (!window.confirm(`Permanently delete ${party.name} and all of their account entries? Related ledger totals will also be removed.`)) return;
    const confirmation = window.prompt(`Type the customer's name exactly to confirm deletion:\n${party.name}`);
    if (confirmation !== party.name) {
      if (confirmation !== null) setNotice('Customer name did not match. Nothing was deleted.');
      return;
    }
    try {
      const response = await fetch('/api/admin/ledger/parties', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: party._id, confirmation })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to delete customer');
      setHistoryParty(null);
      setHistoryTransactions([]);
      setNotice(`${party.name} and ${result.deletedTransactions} linked ledger entries permanently deleted.`);
      await refresh();
      await loadPartyDirectory();
    } catch (error) {
      setNotice(error.message || 'Unable to delete customer');
    }
  }

  async function finalizeTransaction(item) {
    const response = await fetch('/api/admin/ledger/transactions', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item._id, action: 'finalize' })
    });
    const result = await response.json();
    if (!response.ok) setNotice(result.error || 'Unable to finalize transaction');
    else {
      setNotice('Transaction finalized.');
      await refresh();
    }
  }

  function exportCsv() {
    const rows = [['Date', 'Type', 'Account', 'Party', 'Amount', 'Paid', 'Status', 'Reference', 'Description']];
    filteredTransactions.forEach(t => rows.push([
      new Date(t.date).toISOString().slice(0, 10), labelForType(t.type), t.account || '',
      t.partyId?.name || '', (t.amountPaise / 100).toFixed(2), (t.paidAmountPaise / 100).toFixed(2),
      t.status, t.reference || '', t.description || ''
    ]));
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `sds-ledger-${today()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const visibleParties = partyDirectory;
  const recentActiveTransactions = transactions.filter(item => item.status !== 'voided').slice(0, 10);
  const needsParty = ['credit_sale', 'customer_payment', 'supplier_purchase', 'supplier_payment'].includes(form.type);
  const partyOptions = transactionPartyOptions;
  const isPurchase = ['supplier_purchase', 'market_purchase'].includes(form.type);

  return (
    <div className="p-3 sm:p-4">
      <div className="grid min-w-0 gap-3 lg:grid-cols-4">
        <AdminSidebar />
        <main className="min-w-0 space-y-3 text-xs lg:col-span-3">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">Ledger Book</h1>
              <p className="mt-1 text-xs text-gray-600">Track sales, payments and balances.</p>
            </div>
            <button onClick={refresh} className="rounded border px-3 py-1.5 text-xs" disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
          </header>

          {notice && <div role="status" className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{notice}</div>}
          <section aria-label="Current ledger balances" className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border bg-white p-3">
              <div className="text-xs text-gray-500">Shop balance</div>
              <div className="text-lg font-semibold">{currentBalances && !currentBalances.error ? money((currentBalances.closingBalances?.cash || 0) + (currentBalances.closingBalances?.upi || 0)) : '—'}</div>
              <div className="text-xs text-gray-600">Cash {currentBalances && !currentBalances.error ? money(currentBalances.closingBalances?.cash) : '—'} · UPI {currentBalances && !currentBalances.error ? money(currentBalances.closingBalances?.upi) : '—'}</div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="text-xs text-gray-500">Customer outstanding</div>
              <div className="text-lg font-semibold">{currentBalances && !currentBalances.error ? money(currentBalances.customerOutstandingPaise) : '—'}</div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="text-xs text-gray-500">Supplier payable</div>
              <div className="text-lg font-semibold">{currentBalances && !currentBalances.error ? money(currentBalances.supplierOutstandingPaise) : '—'}</div>
            </div>
          </section>
          <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
            Ledger entries are separate from website orders and inventory. They are not imported automatically and do not change stock. Avoid recording the same sale or payment twice.
          </div>

          <nav aria-label="Ledger entry steps" className="grid grid-cols-2 gap-1.5 sm:gap-2 xl:grid-cols-3">
            {[
              ['earnings', '1. Today’s earnings', 'Cash and UPI sales'],
              ['supplier', '2. Supplier bills / payments', 'Bills and payments'],
              ['customer', '3. Customer balances', 'Credit and collections'],
              ['expenses', '4. Expenses / shop assets', 'Expenses, withdrawals and assets'],
              ['market', '5. Market purchases', 'Shop or personal funds'],
              ['history', '6. History', 'Monthly daily entries and corrections'],
              ['reports', '7. Reports', 'Earnings graph and summaries']
            ].map(([key, title, detail]) => (
              <button key={key} onClick={() => { setSection(key); setPartyDirectoryPage(1); }} aria-current={section === key ? 'step' : undefined} className={`rounded-lg border p-2 text-left text-xs ${section === key ? 'border-blue-700 bg-blue-50 ring-1 ring-blue-700' : 'bg-white hover:bg-gray-50'}`}>
                <span className="block font-medium">{title}</span><span className="mt-1 block text-xs text-gray-600">{detail}</span>
              </button>
            ))}
          </nav>
          <details className="rounded border bg-white px-3 py-1.5">
            <summary className="cursor-pointer text-xs font-medium">Other ledger tools</summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                ['overview', 'Overview'], ['transactions', 'All transactions'],
                ['accounts', 'Cash / UPI / Bank']
              ].map(([key, title]) => (
                <button key={key} onClick={() => setSection(key)} aria-current={section === key ? 'page' : undefined} className={`rounded px-2.5 py-1.5 text-xs ${section === key ? 'bg-blue-700 text-white' : 'border hover:bg-gray-50'}`}>{title}</button>
              ))}
            </div>
          </details>

          {section === 'earnings' && (
            <section className="space-y-3">
              <div><h2 className="text-base font-semibold">1. Daily earnings</h2><p className="text-[11px] text-gray-600">Enter earnings for today or an earlier date. Cash is calculated automatically. Website orders are not included.</p></div>
              <DailyEarningsForm
                parties={parties.filter(item => item.type === 'customer' && item.isActive !== false)}
                onSaved={async () => { await refresh(); setEarningsRefreshCounter(value => value + 1); }}
                onCustomerAdded={refresh}
              />
              <RecentEarningsHistory
                onEdit={editTransaction}
                onDelete={deleteTransaction}
                refreshKey={earningsRefreshCounter}
              />
            </section>
          )}

          {section === 'history' && (
            <section className="space-y-3">
              <div>
                <h2 className="text-base font-semibold">6. Earnings history</h2>
                <p className="text-[11px] text-gray-600">Choose a month to review sales and customer-credit entries. Corrections recalculate totals; permanent deletion removes an entry from the database.</p>
              </div>
              <MonthlyEarningsHistory
                refreshKey={earningsRefreshCounter}
                onEdit={item => editTransaction(item, 'history')}
                onDelete={deleteTransaction}
              />
            </section>
          )}

          {section === 'overview' && (
            <>
              <section className="flex flex-wrap items-end gap-2 rounded-lg border bg-white p-3">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => selectDateRange('today')} className="rounded border px-3 py-2 text-sm">Today</button>
                  <button onClick={() => selectDateRange('yesterday')} className="rounded border px-3 py-2 text-sm">Yesterday</button>
                  <button onClick={() => selectDateRange('month')} className="rounded border px-3 py-2 text-sm">This Month</button>
                  <button onClick={() => selectDateRange('previous')} className="rounded border px-3 py-2 text-sm">Previous Month</button>
                </div>
                <label className="text-sm">From<input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="mt-1 block rounded border p-2" /></label>
                <label className="text-sm">To<input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="mt-1 block rounded border p-2" /></label>
                <div className="text-[11px] text-gray-500">Sales and cash flow use this date range. Current account balances include opening balances; permanently deleted entries are excluded.</div>
              </section>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  ['Sales in period', money(summary?.salesPaise)],
                  ['Customer outstanding (incl. opening)', money(summary?.customerOutstandingPaise)],
                  ['Customer advances', money(summary?.customerAdvancePaise)],
                  ['Supplier outstanding (incl. opening)', money(summary?.supplierOutstandingPaise)],
                  ['Purchases recorded', money(summary?.purchasesPaise)],
                  ['Supplier payments', money(summary?.supplierPaymentsPaise)],
                  ['Operating expenses', money(summary?.expensesPaise)],
                  ['Owner withdrawals', money(summary?.ownerWithdrawalsPaise)],
                  ['Owner reimbursements paid', money(summary?.ownerReimbursementsPaise)],
                  ['Owner investments recorded', money(summary?.ownerInvestmentsPaise)],
                  ['Total cash inflow', money(summary?.inflowPaise)],
                  ['Total cash outflow', money(summary?.outflowPaise)],
                  ['Net cash flow', money(summary?.netFlowPaise)]
                ].map(([title, value]) => <div key={title} className="rounded-lg border bg-white p-3"><div className="text-xs text-gray-600">{title}</div><div className="mt-1 text-lg font-semibold">{value}</div></div>)}
              </div>
              <section className="rounded-lg border bg-white p-3">
                <h2 className="text-sm font-semibold">Payment account movement</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-4">{['cash', 'upi', 'bank', 'other'].map(account => <div key={account} className="rounded border p-3 capitalize"><span className="text-sm text-gray-500">{account}</span><div className="mt-1 text-xs text-gray-500">Opening {money(summary?.openingBalances?.[account])}</div><div className="text-xs text-gray-500">Movement {money(summary?.accounts?.[account])}</div><div className="font-semibold">Closing {money(summary?.closingBalances?.[account])}</div></div>)}</div>
                <p className="mt-2 text-[11px] text-gray-500">Opening, movement and closing balances for the selected period.</p>
                {summary?.incompleteOpeningHistory && <p className="mt-2 text-[11px] text-amber-800">Some account opening dates are after this report period; earlier balances cannot be reconstructed.</p>}
              </section>
              <section className="rounded-lg border bg-white p-3">
                <h2 className="text-sm font-semibold">Recent active transactions</h2>
                <TransactionTable items={recentActiveTransactions} onEdit={editTransaction} onDelete={deleteTransaction} onFinalize={finalizeTransaction} />
              </section>
            </>
          )}

          {section === 'transactions' && (
            <div className="space-y-3">
            <p className="text-[11px] text-gray-600">Search all transactions or record receipts, adjustments and transfers. Add customer, supplier and expense entries in their sections.</p>
            <form onSubmit={saveTransaction} className="grid gap-2 rounded-lg border bg-white p-3 sm:grid-cols-2 lg:grid-cols-3">
                <h2 className="text-lg font-semibold md:col-span-3">{editingId ? 'Edit transaction' : 'Record transaction'}</h2>
                <label className="text-sm">Transaction type
                  <select required value={form.type} onChange={e => { setShowAdvancedTypes(!COMMON_TYPES.includes(e.target.value)); updateForm('type', e.target.value); }} className="mt-1 w-full rounded border p-2">
                    {TYPES.filter(([key]) => COMMON_TYPES.includes(key)).map(([key, title]) => <option key={key} value={key}>{title}</option>)}
                    {showAdvancedTypes && <optgroup label="Less common / corrections">
                      {ADVANCED_TYPES.map(([key, title]) => <option key={key} value={key}>{title}</option>)}
                    </optgroup>}
                  </select>
                  <span className="mt-1 flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={showAdvancedTypes}
                      onChange={event => {
                        const show = event.target.checked;
                        setShowAdvancedTypes(show);
                        if (!show && !COMMON_TYPES.includes(form.type)) updateForm('type', 'sale');
                      }}
                    />
                    Show less common types
                  </span>
                </label>
                <label className="text-sm">Date
                  <input required type="date" value={form.date} onChange={e => updateForm('date', e.target.value)} className="mt-1 w-full rounded border p-2" />
                </label>
                {!(form.type === 'sale' && form.hasPaymentSplit) && <label className="text-sm">Amount (₹)
                  <input required min="0.01" step="0.01" type="number" value={form.amount} onChange={e => updateForm('amount', e.target.value)} className="mt-1 w-full rounded border p-2" />
                </label>}
                {form.type === 'sale' && <label className="flex items-center gap-2 self-end pb-2 text-sm">
                  <input type="checkbox" checked={form.hasPaymentSplit} onChange={event => {
                    const enabled = event.target.checked;
                    updateForm('hasPaymentSplit', enabled);
                    if (enabled && !form.splitCash && form.amount) updateForm('splitCash', form.amount);
                  }} />
                  Split sale into cash / UPI
                </label>}
                {form.type === 'sale' && form.hasPaymentSplit && <>
                  <label className="text-sm">Cash sales (₹)<input required min="0" step="0.01" type="number" value={form.splitCash} onChange={e => updateForm('splitCash', e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
                  <label className="text-sm">UPI sales (₹)<input required min="0" step="0.01" type="number" value={form.splitUpi} onChange={e => updateForm('splitUpi', e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
                  <p className="self-end pb-2 text-sm">Total sale: {money((amountPaise(form.splitCash) || 0) + (amountPaise(form.splitUpi) || 0))}</p>
                </>}
                <label className="text-sm">Status
                  <select disabled={!!editingId} value={form.status} onChange={e => updateForm('status', e.target.value)} className="mt-1 w-full rounded border p-2 disabled:bg-gray-100"><option value="draft">Draft</option><option value="finalized">Finalized</option></select>
                </label>
                {(needsParty || form.type === 'market_purchase') && <label className="text-sm">{needsParty ? 'Account' : 'Supplier (optional)'}
                  <input value={transactionPartySearch} onChange={e => setTransactionPartySearch(e.target.value)} placeholder="Search by name or mobile" className="mt-1 w-full rounded border p-2" />
                  <select required={needsParty} value={form.partyId} onChange={e => updateForm('partyId', e.target.value)} className="mt-1 w-full rounded border p-2">
                    <option value="">{needsParty ? `Select ${['credit_sale', 'customer_payment'].includes(form.type) ? 'customer' : 'supplier'}` : 'No supplier / market'}</option>
                    {partyOptions.map(p => <option key={p._id} value={p._id}>{p.name}{p.phone ? ` (${p.phone})` : ''}</option>)}
                  </select>
                </label>}
                {form.type === 'customer_payment' && <p className="self-end text-xs text-gray-600">Payment reduces outstanding first; any extra is added as an advance.</p>}
                {form.type === 'credit_sale' && <label className="text-sm">Use existing customer advance (₹)
                  <input min="0" step="0.01" type="number" value={form.advanceApplied} onChange={e => updateForm('advanceApplied', e.target.value)} className="mt-1 w-full rounded border p-2" />
                </label>}
                {['sale', 'sales_refund', 'customer_payment', 'supplier_payment', 'expense', 'owner_withdrawal', 'owner_reimbursement', 'other_receipt', 'other_payment'].includes(form.type) && <label className="text-sm">Payment account
                  <select value={form.account} onChange={e => updateForm('account', e.target.value)} className="mt-1 w-full rounded border p-2">
                    {ACCOUNTS.map(a => <option key={a} value={a}>{a.toUpperCase()}</option>)}
                  </select>
                </label>}
                {isPurchase && <>
                  {form.type === 'market_purchase' && <label className="flex items-center gap-2 self-end pb-2 text-sm">
                    <input type="checkbox" checked={form.hasPaymentSplit} onChange={event => updateForm('hasPaymentSplit', event.target.checked)} />
                    Track cash / UPI and personal funding split
                  </label>}
                  <label className="text-sm">Payment mode
                    <select value={form.account} onChange={e => updateForm('account', e.target.value)} className="mt-1 w-full rounded border p-2">
                      {[...ACCOUNTS, 'credit'].map(a => <option key={a} value={a}>{a === 'credit' ? 'Supplier credit' : a.toUpperCase()}</option>)}
                    </select>
                  </label>
                  <label className="text-sm">Amount paid (₹)
                    <input min="0" step="0.01" type="number" value={form.paidAmount} onChange={e => updateForm('paidAmount', e.target.value)} disabled={form.account === 'credit'} className="mt-1 w-full rounded border p-2 disabled:bg-gray-100" />
                  </label>
                  {form.type === 'market_purchase' && form.hasPaymentSplit && <>
                    <label className="text-sm">Shop cash paid (₹)<input min="0" step="0.01" type="number" value={form.splitCash} onChange={e => updateForm('splitCash', e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
                    <label className="text-sm">Shop UPI paid (₹)<input min="0" step="0.01" type="number" value={form.splitUpi} onChange={e => updateForm('splitUpi', e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
                    <label className="text-sm">Personal / borrowed funds (₹)<input min="0" step="0.01" type="number" value={form.ownerContribution} onChange={e => updateForm('ownerContribution', e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
                  </>}
                </>}
                {form.type === 'transfer' && <>
                  <label className="text-sm">From account
                    <select value={form.account} onChange={e => updateForm('account', e.target.value)} className="mt-1 w-full rounded border p-2">{ACCOUNTS.map(a => <option key={a} value={a}>{a.toUpperCase()}</option>)}</select>
                  </label>
                  <label className="text-sm">To account
                    <select value={form.transferTo} onChange={e => updateForm('transferTo', e.target.value)} className="mt-1 w-full rounded border p-2">{ACCOUNTS.map(a => <option key={a} value={a}>{a.toUpperCase()}</option>)}</select>
                  </label>
                </>}
                {['expense', 'owner_withdrawal'].includes(form.type) && <label className="text-sm">Category
                  {form.type === 'expense'
                    ? <select required value={form.category} onChange={e => updateForm('category', e.target.value)} className="mt-1 w-full rounded border p-2"><option value="">Select category</option>{expenseCategories.filter(item => item.active).map(item => <option key={item._id} value={item.name}>{item.name}</option>)}</select>
                    : <input value={form.category} onChange={e => updateForm('category', e.target.value)} placeholder="Personal withdrawal" className="mt-1 w-full rounded border p-2" />}
                </label>}
                {form.type === 'expense' && <label className="text-sm">Link purchase / market trip (optional)
                  <select value={form.linkedTransactionId} onChange={e => updateForm('linkedTransactionId', e.target.value)} className="mt-1 w-full rounded border p-2"><option value="">No linked purchase</option>{purchaseTransactions.map(item => <option key={item._id} value={item._id}>{new Date(item.date).toLocaleDateString('en-IN')} · {item.type === 'market_purchase' ? 'Market' : 'Supplier'} · {money(item.amountPaise)}{item.description ? ` · ${item.description}` : ''}</option>)}</select>
                </label>}
                <label className="text-sm">Reference
                  <input value={form.reference} onChange={e => updateForm('reference', e.target.value)} placeholder="Optional invoice / order reference" className="mt-1 w-full rounded border p-2" />
                </label>
                <label className="text-sm md:col-span-2">Notes
                  <input value={form.description} onChange={e => updateForm('description', e.target.value)} className="mt-1 w-full rounded border p-2" />
                </label>
                <div className="flex gap-2 md:col-span-3">
                  <button disabled={saving} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{saving ? 'Saving…' : editingId ? 'Save correction' : 'Save transaction'}</button>
                  {editingId && <button type="button" onClick={() => { const returnSection = editReturnSection; setEditingId(''); setEditingStatus(''); setEditReturnSection(''); setForm(emptyForm()); setShowAdvancedTypes(false); if (returnSection) setSection(returnSection); }} className="rounded border px-4 py-2">Cancel edit</button>}
                </div>
              </form>
              {selectedPartyId && <button onClick={() => { setSelectedPartyId(''); setTransactionPage(1); }} className="text-sm text-blue-700 underline">Clear account history filter</button>}
              <TransactionList transactions={filteredTransactions} query={query} setQuery={value => { setQuery(value); setTransactionPage(1); }} transactionType={transactionType} setTransactionType={value => { setTransactionType(value); setSelectedPartyId(''); setTransactionPage(1); }} page={transactionPage} total={transactionTotal} setPage={setTransactionPage} onEdit={editTransaction} onDelete={deleteTransaction} onFinalize={finalizeTransaction} onExport={exportCsv} />
            </div>
          )}

          {section === 'accounts' && (
            <section className="space-y-3">
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Opening balances are dated starting balances. Closing balances are calculated from finalized ledger entries; statement reconciliation records differences without changing calculated balances.
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {accounts.map(account => {
                  const draft = accountDrafts[account.account] || {};
                  const latestAudit = [...(account.audit || [])].reverse().find(entry => entry.action === 'reconciled');
                  const latestStatement = [...(account.reconciliations || [])].reverse()[0];
                  const difference = latestAudit?.changes?.differencePaise;
                  return <article key={account.account} className="space-y-3 rounded-lg border bg-white p-3">
                    <header className="flex items-start justify-between">
                      <div><h2 className="text-lg font-semibold uppercase">{account.account}</h2><p className="text-sm text-gray-500">Calculated balance</p></div>
                      <strong className="text-xl">{money(account.calculatedBalancePaise)}</strong>
                    </header>
                    <form onSubmit={event => { event.preventDefault(); saveOpeningBalance(account.account); }} className="grid gap-2 sm:grid-cols-3">
                      <label className="text-sm">Opening balance (₹)<input required step="0.01" type="number" value={draft.amount || ''} onChange={e => updateAccountDraft(account.account, 'amount', e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
                      <label className="text-sm">Opening date<input required type="date" value={draft.asOfDate || ''} onChange={e => updateAccountDraft(account.account, 'asOfDate', e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
                      <button className="self-end rounded border px-3 py-2 text-sm">Save opening balance</button>
                    </form>
                    <form onSubmit={event => { event.preventDefault(); reconcileAccount(account.account); }} className="grid gap-2 sm:grid-cols-2">
                      <label className="text-sm">Statement / counted balance (₹)<input required step="0.01" type="number" value={draft.reconciledAmount || ''} onChange={e => updateAccountDraft(account.account, 'reconciledAmount', e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
                      <label className="text-sm">As-of date<input required type="date" value={draft.reconciliationDate || ''} onChange={e => updateAccountDraft(account.account, 'reconciliationDate', e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
                      <label className="text-sm sm:col-span-2">Note (settlement delay, refund, bank charge, cash count…)<input value={draft.note || ''} onChange={e => updateAccountDraft(account.account, 'note', e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
                      <button className="w-fit rounded bg-blue-700 px-3 py-2 text-sm text-white">Record reconciliation</button>
                    </form>
                    {latestStatement && <div className="rounded bg-gray-50 p-3 text-sm">
                      Latest reconciliation · {new Date(latestStatement.asOfDate).toLocaleDateString('en-IN')} · Statement {money(latestStatement.statementBalancePaise)}
                      <span className={`ml-2 font-semibold ${difference === 0 ? 'text-green-700' : 'text-amber-800'}`}>Difference {difference == null ? '—' : money(difference)}</span>
                      {latestStatement.note ? <div className="mt-1 text-gray-600">{latestStatement.note}</div> : null}
                    </div>}
                  </article>;
                })}
              </div>
              <div className="rounded border bg-white p-3">
                <strong>Combined closing funds: {money(summary?.combinedClosingBalancePaise)}</strong>
                <div className="mt-1 text-sm text-gray-500">Period opening: {money(summary?.combinedOpeningBalancePaise)} · Inflow: {money(summary?.inflowPaise)} · Outflow: {money(summary?.outflowPaise)} · Net movement is calculated after internal transfers between accounts.</div>
              </div>
            </section>
          )}

          {section === 'expenses' && (
            <section className="space-y-4">
              <div><h2 className="text-base font-semibold">4. Expenses and shop assets</h2><p className="text-[11px] text-gray-600">Rent, bills, repairs, shop items and personal withdrawals are kept separate.</p></div>
              <QuickEntryForm kind="expense" parties={[]} categories={expenseCategories.filter(item => item.active)} onSaved={refresh} />
              <form onSubmit={addExpenseCategory} className="flex flex-wrap items-end gap-2 rounded-lg border bg-white p-3">
                <label className="min-w-0 flex-1 text-xs sm:min-w-64">Add an expense category<input required maxLength={80} value={newCategory} onChange={e => setNewCategory(e.target.value)} className="mt-1 w-full rounded border p-2" placeholder="e.g. Mobile / internet" /></label>
                <button className="rounded bg-blue-700 px-3 py-2 text-xs text-white">Add category</button>
              </form>
              <div className="overflow-x-auto rounded-lg border bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50"><tr><th className="p-3">Expense category</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead>
                  <tbody>{expenseCategories.map(category => <tr key={category._id} className="border-t">
                    <td className="p-3">{category.name}</td><td className="p-3">{category.active ? 'Active' : 'Inactive'}</td>
                    <td className="p-3"><button onClick={() => toggleExpenseCategory(category)} className="text-blue-700 underline">{category.active ? 'Deactivate' : 'Reactivate'}</button></td>
                  </tr>)}</tbody>
                </table>
              </div>
              <div className="rounded-lg border bg-white p-3">
                <h2 className="text-sm font-semibold">Recent expenses</h2>
                <TransactionTable items={expenseTransactions} onEdit={editTransaction} onDelete={deleteTransaction} onFinalize={finalizeTransaction} />
              </div>
            </section>
          )}

          {section === 'reports' && (
            <>
            <p className="text-[11px] text-gray-600">Select a month to filter the earnings chart and detailed report below to that month. The date fields can still be adjusted for a custom period.</p>
            <MonthlyEarningsReport
              refreshKey={earningsRefreshCounter}
              selectedMonth={selectedReportsMonth}
              onMonthChange={selectReportsMonth}
            />
            <ReportSection
              reportType={reportType}
              setReportType={changeReportType}
              reportGroup={reportGroup}
              setReportGroup={value => { setReportGroup(value); setReportPage(1); }}
              reportPartyId={reportPartyId}
              setReportPartyId={value => { setReportPartyId(value); setReportPage(1); }}
              reportAccount={reportAccount}
              setReportAccount={value => { setReportAccount(value); setReportPage(1); }}
              reportCategory={reportCategory}
              setReportCategory={value => { setReportCategory(value); setReportPage(1); }}
              parties={parties}
              categories={expenseCategories}
              fromDate={fromDate}
              toDate={toDate}
              setFromDate={setFromDate}
              setToDate={setToDate}
              data={reportData}
              page={reportPage}
              setPage={value => { setReportPage(value); generateReport(null, value); }}
              onGenerate={generateReport}
              onSaveMonthlyOpeningBalance={saveMonthlyOpeningBalance}
              onExport={exportReport}
              onEdit={editTransaction}
              onDelete={deleteTransaction}
              onFinalize={finalizeTransaction}
            />
            </>
          )}

          {['customer', 'supplier'].includes(section) && (
            <section className="space-y-3">
              <div><h2 className="text-lg font-semibold">{section === 'customer' ? '3. Customer balances' : '2. Supplier bills and payments'}</h2><p className="text-[11px] text-gray-600">{section === 'customer' ? 'Select a customer to record a payment. Add new credit sales in step 1.' : 'Record supplier bills and payments here. Use step 5 for market purchases.'}</p></div>
              {section === 'customer' && <p className="text-[11px] text-gray-600">Keep a customer account until its outstanding and advance are both zero; then you can delete the account and its history.</p>}
              {section === 'supplier' && <QuickEntryForm
                kind="supplier"
                parties={parties.filter(item => item.type === 'supplier')}
                categories={[]}
                onSaved={async () => { await refresh(); await loadPartyDirectory(); }}
              />}
              <form onSubmit={createParty} className="grid gap-2 rounded-lg border bg-white p-3 sm:grid-cols-2">
                <h2 className="text-base font-semibold sm:col-span-2">Add {section === 'customer' ? 'customer' : 'supplier'} account</h2>
                <label className="text-sm">Name<input required value={partyForm.name} onChange={e => setPartyForm({ ...partyForm, name: e.target.value })} className="mt-1 w-full rounded border p-2" /></label>
                <label className="text-sm">Mobile<input value={partyForm.phone} onChange={e => setPartyForm({ ...partyForm, phone: e.target.value })} className="mt-1 w-full rounded border p-2" /></label>
                <label className="text-xs sm:col-span-2">Address<input value={partyForm.address} onChange={e => setPartyForm({ ...partyForm, address: e.target.value })} className="mt-1 w-full rounded border p-2" /></label>
                <label className="text-sm">Notes<input value={partyForm.notes} onChange={e => setPartyForm({ ...partyForm, notes: e.target.value })} className="mt-1 w-full rounded border p-2" /></label>
                <p className="self-center text-xs text-gray-500">New account opening balance: ₹0.00</p>
                <button disabled={saving} className="w-fit rounded bg-blue-700 px-3 py-2 text-xs text-white disabled:opacity-50">{saving ? 'Saving…' : 'Add account'}</button>
              </form>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <label className="min-w-0 flex-1 text-xs sm:flex-none">Search by name or mobile
                  <input value={partySearch} onChange={event => { setPartySearch(event.target.value); setPartyDirectoryPage(1); }} className="mt-1 block w-full rounded border p-2 sm:w-72" placeholder="Name or phone number" />
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={showArchivedParties} onChange={event => { setShowArchivedParties(event.target.checked); setPartyDirectoryPage(1); }} />
                  Show archived accounts
                </label>
                <div className="flex w-full items-center justify-between gap-2 text-xs sm:w-auto">
                  <span>{partyDirectoryTotal} account{partyDirectoryTotal === 1 ? '' : 's'}</span>
                  <button disabled={partyDirectoryPage <= 1} onClick={() => setPartyDirectoryPage(page => page - 1)} className="rounded border px-3 py-2 disabled:opacity-50">Previous</button>
                  <span>{partyDirectoryPage} / {Math.max(1, Math.ceil(partyDirectoryTotal / 50))}</span>
                  <button disabled={partyDirectoryPage >= Math.ceil(partyDirectoryTotal / 50)} onClick={() => setPartyDirectoryPage(page => page + 1)} className="rounded border px-3 py-2 disabled:opacity-50">Next</button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border bg-white">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="bg-gray-50"><tr><th className="p-3">Name</th><th className="p-3">Mobile</th><th className="p-3">Opening</th><th className="p-3">Outstanding</th>{section === 'customer' && <th className="p-3">Advance</th>}<th className="p-3">Action</th></tr></thead>
                  <tbody>{visibleParties.map(p => <tr key={p._id} className={`border-t ${p.isActive === false ? 'bg-gray-50 text-gray-500' : ''}`}>
                    <td className="p-3">{section === 'customer' && p.isActive !== false
                      ? <button className="font-medium text-blue-700 underline" onClick={() => { setCustomerPaymentParty(p); setCustomerPaymentAmount(''); setCustomerPaymentAccount('cash'); setCustomerPaymentNote(''); }}>{p.name}</button>
                      : p.name}{p.isActive === false && <span className="ml-2 text-xs">(deleted)</span>}</td><td className="p-3">{p.phone || '—'}</td><td className="p-3">{money(p.openingBalancePaise)}</td>
                    <td className="p-3 font-medium">{money(p.outstandingPaise)}</td>{section === 'customer' && <td className="p-3">{money(p.advancePaise)}</td>}
                    <td className="p-3"><div className="flex flex-wrap gap-3">
                      {p.isActive !== false && <button className="text-blue-700 underline" onClick={() => editParty(p)}>Edit</button>}
                      <button className="text-blue-700 underline" onClick={() => showPartyHistory(p)}>History</button>
                      {section === 'customer' ? (
                        <>
                          {p.isActive === false && <button className="text-green-700 underline" onClick={() => archiveParty(p)}>Restore</button>}
                          {p.outstandingPaise === 0 && p.advancePaise === 0
                            ? <button className="text-red-700 underline" onClick={() => deleteSettledCustomer(p)}>Delete permanently</button>
                            : <span className="text-xs text-gray-500">Settle account to delete</span>}
                        </>
                      ) : <button className={p.isActive === false ? 'text-green-700 underline' : 'text-amber-700 underline'} onClick={() => archiveParty(p)}>{p.isActive === false ? 'Restore' : 'Archive'}</button>}
                    </div></td>
                  </tr>)}
                    {visibleParties.length === 0 && <tr><td colSpan={section === 'customer' ? 6 : 5} className="p-5 text-center text-gray-500">No accounts yet.</td></tr>}
                  </tbody>
                </table>
              </div>
              {historyParty && <section className="rounded-lg border bg-white p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-semibold">{historyParty.name} — transaction history</h2>
                  <button onClick={() => { setHistoryParty(null); setHistoryTransactions([]); }} className="text-sm text-blue-700 underline">Close history</button>
                </div>
                <TransactionTable items={historyTransactions} onEdit={editTransaction} onDelete={deleteTransaction} onFinalize={finalizeTransaction} />
              </section>}
            </section>
          )}

          {section === 'market' && (
            <section className="space-y-3">
              <div><h2 className="text-lg font-semibold">5. Market purchases and reimbursement</h2><p className="text-[11px] text-gray-600">Enter the bill total and amounts paid from shop cash, UPI or personal funds. Record reimbursement or investment later.</p></div>
              <MarketPurchaseForm parties={parties.filter(item => item.type === 'supplier')} onSaved={refresh} />
            </section>
          )}
          {customerPaymentParty && section === 'customer' && (
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:items-center sm:p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setCustomerPaymentParty(null); }}>
              <form role="dialog" aria-modal="true" aria-labelledby="customer-payment-title" onSubmit={saveCustomerPayment} className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md space-y-3 overflow-y-auto rounded-lg bg-white p-4 shadow-xl sm:max-h-[90dvh] sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div><h2 id="customer-payment-title" className="text-lg font-semibold">{customerPaymentParty.name}</h2><p className="text-sm text-gray-600">Outstanding: {money(customerPaymentParty.outstandingPaise)}</p></div>
                  <button type="button" aria-label="Close" onClick={() => setCustomerPaymentParty(null)} className="text-2xl leading-none text-gray-500">×</button>
                </div>
                <label className="block text-sm">Deposit amount (₹)<input required min="0.01" step="0.01" type="number" value={customerPaymentAmount} onChange={event => setCustomerPaymentAmount(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
                <label className="block text-sm">Received via<select value={customerPaymentAccount} onChange={event => setCustomerPaymentAccount(event.target.value)} className="mt-1 w-full rounded border p-2"><option value="cash">Cash</option><option value="upi">UPI</option></select></label>
                <label className="block text-sm">Note (optional)<input value={customerPaymentNote} onChange={event => setCustomerPaymentNote(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
                <p className="text-xs text-gray-500">Payment reduces outstanding first. Any extra amount is retained as customer advance.</p>
                <div className="flex justify-end gap-2"><button type="button" onClick={() => setCustomerPaymentParty(null)} className="rounded border px-3 py-2">Cancel</button><button disabled={customerPaymentSaving} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{customerPaymentSaving ? 'Saving…' : 'Save payment'}</button></div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ReportSection({
  reportType, setReportType, reportGroup, setReportGroup, reportPartyId, setReportPartyId,
  reportAccount, setReportAccount, reportCategory, setReportCategory, parties, categories,
  fromDate, toDate, setFromDate, setToDate, data, page, setPage, onGenerate, onSaveMonthlyOpeningBalance, onExport,
  onEdit, onDelete, onFinalize
}) {
  const totalAmount = (data?.rows || []).reduce((sum, row) => sum + (row.totalPaise || 0), 0);
  const netSales = (data?.rows || []).reduce((sum, row) => sum + (row.netSalesPaise || 0), 0);
  const [selectedOpeningMonth, setSelectedOpeningMonth] = useState('');
  const [openingAmount, setOpeningAmount] = useState('');
  const [openingBalances, setOpeningBalances] = useState([]);
  const [editingOpeningBalance, setEditingOpeningBalance] = useState(false);
  const [openingBalanceLoadError, setOpeningBalanceLoadError] = useState('');
  const [openingBalanceSaveError, setOpeningBalanceSaveError] = useState('');
  const [savingOpeningBalance, setSavingOpeningBalance] = useState(false);
  const balanceSummary = data?.balanceSummary;
  useEffect(() => {
    if (!balanceSummary) return;
    setSelectedOpeningMonth(current => current || balanceSummary.nextMonth || '');
  }, [balanceSummary?.nextMonth]);
  useEffect(() => {
    let active = true;
    fetch('/api/admin/ledger/monthly-balances', { credentials: 'include' })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load saved opening balances');
        if (active) setOpeningBalances(result.balances || []);
      })
      .catch(error => {
        if (active) setOpeningBalanceLoadError(error.message || 'Unable to load saved opening balances');
      });
    return () => { active = false; };
  }, []);
  const availableOpeningMonths = [...new Set([
    ...monthOptionsFrom(balanceSummary?.nextMonth),
    ...openingBalances.map(item => item.month),
    ...(selectedOpeningMonth ? [selectedOpeningMonth] : [])
  ])].sort();
  const selectedOpening = openingBalances.find(item => item.month === selectedOpeningMonth);
  useEffect(() => {
    if (selectedOpening) {
      setOpeningAmount((Number(selectedOpening.openingBalancePaise || 0) / 100).toFixed(2));
    } else if (selectedOpeningMonth && selectedOpeningMonth === balanceSummary?.nextMonth) {
      const value = balanceSummary.nextMonthOpeningBalancePaise ?? balanceSummary.closingBalancePaise;
      setOpeningAmount((Number(value || 0) / 100).toFixed(2));
    } else {
      setOpeningAmount('');
    }
    setEditingOpeningBalance(false);
  }, [selectedOpeningMonth, selectedOpening?.openingBalancePaise, balanceSummary?.nextMonth, balanceSummary?.nextMonthOpeningBalancePaise, balanceSummary?.closingBalancePaise]);
  const reportTitles = {
    statement: 'Bank-style account statement',
    transactions: 'Transaction history',
    daily: 'Daily transaction summary (not a cash closing)',
    monthly: 'Monthly summary',
    yearly: 'Yearly summary',
    customer: 'Customer account summary',
    supplier: 'Supplier account summary',
    purchases: 'Market and supplier purchases',
    expenses: 'Expense categories',
    accounts: 'Cash, UPI and bank transactions',
    cashflow: 'Cash-flow statement',
    sales: 'Sales and credit-sales summary',
    profit: 'Profit summary'
  };
  return (
    <section className="min-w-0 space-y-3">
      <form onSubmit={onGenerate} className="grid gap-2 rounded-lg border bg-white p-3 sm:grid-cols-2 xl:grid-cols-3">
        <h2 className="text-base font-semibold sm:col-span-2 xl:col-span-3">Detailed ledger report · selected period</h2>
        <label className="text-xs">Report
          <select value={reportType} onChange={e => setReportType(e.target.value)} className="mt-1 w-full rounded border p-2">
            {Object.entries(reportTitles).map(([value, title]) => <option key={value} value={value}>{title}</option>)}
          </select>
        </label>
        {!['statement', 'daily', 'monthly', 'yearly', 'expenses', 'accounts', 'customer', 'supplier'].includes(reportType) && <label className="text-xs">Group rows by
          <select value={reportGroup} onChange={e => setReportGroup(e.target.value)} className="mt-1 w-full rounded border p-2">
            {['type', 'day', 'month', 'year', 'account', 'category'].map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>}
        <label className="text-xs">From<input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
        <label className="text-xs">To<input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
        {['customer', 'supplier'].includes(reportType) && <label className="text-xs">Account
          <select value={reportPartyId} onChange={e => setReportPartyId(e.target.value)} className="mt-1 w-full rounded border p-2"><option value="">All {reportType} accounts</option>{parties.filter(p => p.type === reportType).map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
        </label>}
        {['accounts', 'statement'].includes(reportType) && <label className="text-xs">{reportType === 'statement' ? 'Statement account' : 'Payment account'}
          <select value={reportAccount} onChange={e => setReportAccount(e.target.value)} className="mt-1 w-full rounded border p-2">
            {reportType === 'statement' && <option value="shop">Shop balance (cash + UPI)</option>}
            <option value="">All accounts</option>{ACCOUNTS.map(item => <option key={item} value={item}>{item.toUpperCase()}</option>)}
          </select>
        </label>}
        {reportType === 'expenses' && <label className="text-xs">Expense category
          <select value={reportCategory} onChange={e => setReportCategory(e.target.value)} className="mt-1 w-full rounded border p-2"><option value="">All categories</option>{categories.map(item => <option key={item._id} value={item.name}>{item.name}{item.active ? '' : ' (inactive)'}</option>)}</select>
        </label>}
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-3">
          <button className="rounded bg-blue-700 px-3 py-2 text-xs text-white">Generate report</button>
          <button type="button" onClick={() => onExport('csv')} disabled={!data?.total} className="rounded border px-3 py-2 text-xs disabled:opacity-40">Export CSV</button>
          <button type="button" onClick={() => onExport('xlsx')} disabled={!data?.total} className="rounded border px-3 py-2 text-xs disabled:opacity-40">Export Excel</button>
          <button type="button" onClick={() => window.print()} disabled={!data} className="rounded border px-3 py-2 text-xs disabled:opacity-40">Print / Save PDF</button>
          <span className="text-sm text-gray-500">{data ? reportType === 'statement'
            ? `${data.total} account activities`
            : `${data.total} transactions · ${money(totalAmount)} recorded amount${reportType === 'sales' ? ` · Net sales ${money(netSales)}` : ''}` : ''}</span>
        </div>
      </form>
      {reportType === 'profit' && <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{data?.profitWarning || 'Profit is unavailable without reliable COGS, returns and discount records. This ledger is not connected to inventory.'}</div>}
      {reportType === 'daily' && <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This groups recorded transactions by business date. Physical cash closing and shortage/excess reports require the separate Daily Sales &amp; Cash Closing module, which is not included in this scope.</div>}
      {data && <>
        {balanceSummary && <section className="space-y-3 rounded-lg border bg-white p-3">
          <div>
            <h2 className="text-sm font-semibold">Shop balance · Cash + UPI</h2>
            <p className="text-[11px] text-gray-500">This is the selected period’s balance calculation: opening balance + cash/UPI received − cash/UPI paid. Customer credit sales are separate because they have not been received as cash.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Opening balance', money(balanceSummary.openingBalancePaise)],
              ['Cash / UPI received', money(balanceSummary.cashInflowPaise)],
              ['Customer credit sales (separate)', money(balanceSummary.creditSalesPaise)],
              ['Cash / UPI paid', money(balanceSummary.cashOutflowPaise)],
              ['Closing balance', money(balanceSummary.closingBalancePaise)]
            ].map(([label, amount]) => <div key={label} className="rounded border p-3">
              <div className="text-[11px] text-gray-500">{label}</div>
              <div className="mt-1 font-semibold">{amount}</div>
            </div>)}
          </div>
          {balanceSummary.manualOpeningBalanceApplied && <p className="text-[11px] text-blue-800">This report uses the manually saved opening balance for the report month.</p>}
          {balanceSummary.incompleteHistory && <p className="text-[11px] text-amber-800">An account opening date is after this report period; the earlier opening balance cannot be reconstructed fully.</p>}
          {balanceSummary.nextMonth && <form onSubmit={async event => {
            event.preventDefault();
            if (selectedOpening && !editingOpeningBalance) {
              setEditingOpeningBalance(true);
              return;
            }
            setSavingOpeningBalance(true);
            setOpeningBalanceSaveError('');
            try {
              const balance = await onSaveMonthlyOpeningBalance(selectedOpeningMonth, openingAmount);
              setOpeningBalances(current => [
                ...current.filter(item => item.month !== selectedOpeningMonth),
                balance
              ].sort((a, b) => b.month.localeCompare(a.month)));
              setEditingOpeningBalance(false);
            } catch (error) {
              setOpeningBalanceSaveError(error.message || 'Unable to save monthly opening balance');
            } finally {
              setSavingOpeningBalance(false);
            }
          }} className="flex flex-wrap items-end gap-2 border-t pt-3">
            <label className="text-xs">Opening balance month
              <select
                value={selectedOpeningMonth}
                onChange={event => { setSelectedOpeningMonth(event.target.value); setOpeningBalanceSaveError(''); }}
                className="mt-1 block w-56 rounded border p-2"
                required
              >
                {availableOpeningMonths.map(month => <option key={month} value={month}>{monthLabel(month)}</option>)}
              </select>
            </label>
            <label className="text-xs">Manual opening balance
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={openingAmount}
                disabled={Boolean(selectedOpening) && !editingOpeningBalance}
                onChange={event => setOpeningAmount(event.target.value)}
                className="mt-1 block w-52 rounded border p-2 disabled:bg-gray-100"
              />
            </label>
            <button disabled={savingOpeningBalance} className="rounded bg-blue-700 px-3 py-2 text-xs text-white disabled:opacity-50">
              {savingOpeningBalance ? 'Saving…' : selectedOpening && !editingOpeningBalance ? 'Edit' : selectedOpening ? 'Save changes' : 'Save opening balance'}
            </button>
            {selectedOpening && editingOpeningBalance && <button type="button" onClick={() => {
              setOpeningAmount((Number(selectedOpening.openingBalancePaise || 0) / 100).toFixed(2));
              setEditingOpeningBalance(false);
            }} className="rounded border px-3 py-2 text-xs">Cancel</button>}
            <span className="text-[11px] text-gray-500">
              {selectedOpening ? 'A saved amount is updated for this month; it is never added to the existing value.' : selectedOpeningMonth === balanceSummary.nextMonth ? 'Prefilled with this report’s closing balance; adjust before saving.' : 'Enter the opening balance to use for this month.'}
            </span>
            {openingBalanceLoadError && <p className="w-full text-xs text-red-700">{openingBalanceLoadError}</p>}
            {openingBalanceSaveError && <p className="w-full text-xs text-red-700">{openingBalanceSaveError}</p>}
          </form>}
        </section>}
        {reportType === 'statement' && <section className="space-y-3">
          <p className="text-[11px] text-gray-600">The statement below lists cash/UPI account activity in date-and-time order. A “Manual opening balance saved” row is an audit note showing when a future month’s opening amount was saved; it does not count as money received or change this statement’s running balance.</p>
          <div className="flex flex-wrap justify-between gap-3 rounded-lg border bg-white p-3 text-sm">
            <div><span className="text-gray-500">Opening balance for report period</span><div className="font-semibold">{money(balanceSummary?.openingBalancePaise)}</div></div>
            <div><span className="text-gray-500">Closing balance for report period</span><div className="font-semibold">{money(balanceSummary?.closingBalancePaise)}</div></div>
            <div className="self-center text-gray-500">{data.total} activities · date order</div>
          </div>
          {data.statement?.incompleteHistory && <p className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Opening balance date is later than this report range for one or more accounts; earlier opening history may be incomplete.</p>}
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-gray-50"><tr><th className="p-3">Date / time</th><th className="p-3">What happened</th><th className="p-3">Who / note</th><th className="p-3 text-right">Money in</th><th className="p-3 text-right">Money out</th><th className="p-3 text-right">Balance</th><th className="p-3">Action</th></tr></thead>
              <tbody>{(data.statement?.entries || []).map(item => {
                const time = new Date(item.createdAt || item.date);
                const party = item.partyId?.name || '';
                const details = [
                  party,
                  item.isOpeningBalanceSetting ? `Opening balance for ${monthLabel(item.openingBalanceMonth)}: ${money(item.amountPaise)}` : item.category,
                  item.description
                ].filter(Boolean).join(' · ');
                return <tr key={item._id} className="border-t align-top">
                  <td className="whitespace-nowrap p-3">{time.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}<div className="text-[11px] text-gray-500">{item.isOpeningBalanceSetting ? 'Saved at' : 'Entry time'} · business date {new Date(item.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</div></td>
                  <td className="p-3 font-medium">{item.isOpeningBalanceSetting ? `Manual opening balance saved for ${monthLabel(item.openingBalanceMonth)}` : labelForType(item.type)}{item.type === 'sale' && item.paidByAccountPaise && <div className="text-[11px] font-normal text-gray-500">Cash {money(item.paidByAccountPaise.cash)} · UPI {money(item.paidByAccountPaise.upi)}</div>}{item.type === 'transfer' && <div className="text-[11px] font-normal text-gray-500">{item.account?.toUpperCase()} → {item.transferTo?.toUpperCase()}</div>}</td>
                  <td className="max-w-64 p-3">{details || '—'}</td>
                  <td className="p-3 text-right font-medium text-green-700">{item.inflowPaise ? money(item.inflowPaise) : '—'}</td>
                  <td className="p-3 text-right font-medium text-red-700">{item.outflowPaise ? money(item.outflowPaise) : '—'}</td>
                  <td className="p-3 text-right font-semibold">{money(item.runningBalancePaise)}</td>
                  <td className="p-3">{!item.isOpeningBalanceSetting && <div className="flex gap-2"><button onClick={() => onEdit(item)} className="text-blue-700 underline">Edit</button><button onClick={() => onDelete(item)} className="text-red-700 underline">Delete permanently</button></div>}</td>
                </tr>;
              })}
                {(!data.statement?.entries || data.statement.entries.length === 0) && <tr><td colSpan={7} className="p-5 text-center text-gray-500">No account activity in this date range.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Showing {data.total === 0 ? 0 : ((page - 1) * data.limit) + 1}–{Math.min(page * data.limit, data.total)} of {data.total}</span>
            <div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button><button disabled={page * data.limit >= data.total} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Next</button></div>
          </div>
        </section>}
        {['customer', 'supplier'].includes(reportType) && <div className="overflow-x-auto rounded-lg border bg-white">
          <div className="border-b p-3 text-sm font-semibold">Current account balances (transaction details follow the selected date range)</div>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50"><tr><th className="p-3">Account</th><th className="p-3">Mobile</th><th className="p-3">Opening balance</th><th className="p-3">Outstanding</th>{reportType === 'customer' && <th className="p-3">Advance</th>}</tr></thead>
            <tbody>{(data.partyBalances || []).map(item => <tr key={item.partyId} className="border-t"><td className="p-3">{item.name}</td><td className="p-3">{item.phone || '—'}</td><td className="p-3">{money(item.openingBalancePaise)}</td><td className="p-3 font-medium">{money(item.outstandingPaise)}</td>{reportType === 'customer' && <td className="p-3">{money(item.advancePaise)}</td>}</tr>)}
              {(!data.partyBalances || data.partyBalances.length === 0) && <tr><td colSpan={reportType === 'customer' ? 5 : 4} className="p-4 text-center text-gray-500">No matching accounts.</td></tr>}
            </tbody>
          </table>
        </div>}
        {reportType !== 'statement' && <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50"><tr><th className="p-3">{data.groupBy === 'party' ? 'Customer / supplier ID' : `Grouped by ${data.groupBy}`}</th><th className="p-3">Entries</th><th className="p-3">Transaction amount</th><th className="p-3">Paid immediately</th><th className="p-3">Actual inflow</th><th className="p-3">Actual outflow</th></tr></thead>
            <tbody>{data.rows.map(row => {
              const party = parties.find(item => item._id === row._id);
              return <tr key={String(row._id)} className="border-t"><td className="p-3">{party?.name || (data.groupBy === 'type' ? labelForType(row._id) : row._id)}</td><td className="p-3">{row.count}</td><td className="p-3">{money(row.totalPaise)}</td><td className="p-3">{money(row.paidPaise)}</td><td className="p-3">{money(row.inflowPaise)}</td><td className="p-3">{money(row.outflowPaise)}</td></tr>;
            })}
              {data.rows.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-500">No finalized transactions in this period.</td></tr>}
            </tbody>
          </table>
        </div>}
        {reportType !== 'statement' && <div className="rounded-lg border bg-white p-4">
          <h3 className="font-semibold">{reportTitles[reportType]} — transaction details</h3>
          <TransactionTable items={data.transactions} onEdit={onEdit} onDelete={onDelete} onFinalize={onFinalize} />
          <div className="mt-3 flex items-center justify-between text-sm">
            <span>Showing {data.total === 0 ? 0 : ((page - 1) * data.limit) + 1}–{Math.min(page * data.limit, data.total)} of {data.total}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button>
              <button disabled={page * data.limit >= data.total} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>}
      </>}
    </section>
  );
}

function TransactionList({ transactions, query, setQuery, transactionType, setTransactionType, page, total, setPage, onEdit, onDelete, onFinalize, onExport }) {
  return (
    <section className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search transaction, party or reference" className="min-w-56 flex-1 rounded border p-2 text-sm" />
        <select value={transactionType} onChange={e => setTransactionType(e.target.value)} className="rounded border p-2 text-sm"><option value="">All transaction types</option>{TYPES.map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select>
        <button onClick={onExport} className="rounded border px-3 py-2 text-sm">Export CSV</button>
      </div>
      <TransactionTable items={transactions} onEdit={onEdit} onDelete={onDelete} onFinalize={onFinalize} />
      <div className="mt-3 flex items-center justify-between text-sm">
        <span>Showing {total === 0 ? 0 : ((page - 1) * 100) + 1}–{Math.min(page * 100, total)} of {total}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button>
          <button disabled={page * 100 >= total} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Next</button>
        </div>
      </div>
    </section>
  );
}

function TransactionTable({ items, onEdit, onDelete, onFinalize }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-gray-50"><tr><th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">Account / Party</th><th className="p-2">Amount</th><th className="p-2">Paid now</th><th className="p-2">Status</th><th className="p-2">Actions</th></tr></thead>
        <tbody>
          {items.map(item => <tr key={item._id} className={`border-t ${item.status === 'voided' ? 'text-gray-400 line-through' : ''}`}>
            <td className="p-2">{new Date(item.date).toLocaleDateString('en-IN')}</td>
            <td className="p-2">{labelForType(item.type)}{item.category ? <div className="text-xs text-gray-500">{item.category}</div> : null}{item.linkedTransactionId?.date ? <div className="text-xs text-gray-500">Linked purchase: {new Date(item.linkedTransactionId.date).toLocaleDateString('en-IN')}</div> : null}</td>
            <td className="p-2">{item.type === 'owner_investment' ? 'Capital (non-cash)' : item.partyId?.name || item.account || '—'}{item.description ? <div className="max-w-52 truncate text-xs text-gray-500">{item.description}</div> : null}</td>
            <td className="p-2">{money(item.amountPaise)}</td>
            <td className="p-2">{money(item.paidAmountPaise)}</td>
            <td className="p-2">{item.status}</td>
            <td className="p-2"><div className="flex items-start gap-2">{item.status !== 'voided' && <><button onClick={() => onEdit(item)} className="text-blue-700 underline">Edit</button>{item.status === 'draft' && <button onClick={() => onFinalize(item)} className="text-green-700 underline">Finalize</button>}</>}<button onClick={() => onDelete(item)} className="text-red-700 underline">Delete permanently</button><details><summary className="cursor-pointer text-blue-700">Audit</summary><ul className="min-w-48 space-y-1 pt-1 text-xs">{(item.audit || []).map((entry, index) => <li key={`${entry.at}-${index}`} className="border-t pt-1"><strong>{entry.action}</strong> · {entry.actorId || 'admin'} · {entry.at ? new Date(entry.at).toLocaleString('en-IN') : ''}{entry.reason ? <div>Reason: {entry.reason}</div> : null}</li>)}</ul></details></div></td>
          </tr>)}
          {items.length === 0 && <tr><td colSpan={7} className="p-5 text-center text-gray-500">No transactions found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function amountPaise(value) {
  const [rupees = '0', paise = ''] = String(value || '').trim().split('.');
  if (!/^\d{1,10}$/.test(rupees) || !/^\d{0,2}$/.test(paise)) return null;
  const result = Number(rupees) * 100 + Number(paise.padEnd(2, '0'));
  return Number.isSafeInteger(result) ? result : null;
}

function idempotencyKey() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function earningsDateKey(value) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(value));
}

function MonthlyEarningsHistory({ refreshKey, onEdit, onDelete }) {
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [items, setItems] = useState([]);
  const [days, setDays] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadMonths() {
      try {
        const response = await fetch('/api/admin/ledger/earnings-history', { credentials: 'include' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load earnings months');
        if (!active) return;
        const availableMonths = result.months || [];
        setMonths(availableMonths);
        if (!selectedMonth && availableMonths.length) setSelectedMonth(availableMonths[0]._id);
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load earnings months');
      }
    }
    loadMonths();
    return () => { active = false; };
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedMonth) {
      setItems([]);
      setDays([]);
      setTotal(0);
      setLoading(false);
      return undefined;
    }
    let active = true;
    async function loadMonth() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ month: selectedMonth, page: String(page), limit: '100' });
        const response = await fetch(`/api/admin/ledger/earnings-history?${params}`, { credentials: 'include' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load this month’s history');
        if (!active) return;
        setMonths(result.months || []);
        if (!(result.months || []).some(item => item._id === selectedMonth)) {
          setSelectedMonth(result.months?.[0]?._id || '');
          setPage(1);
          return;
        }
        setItems(result.items || []);
        setDays(result.days || []);
        setTotal(result.total || 0);
        const pageCountForResult = Math.max(1, Math.ceil((result.total || 0) / 100));
        if (page > pageCountForResult) {
          setPage(pageCountForResult);
          return;
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load this month’s history');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadMonth();
    return () => { active = false; };
  }, [selectedMonth, page, refreshKey]);

  const selectedSummary = months.find(item => item._id === selectedMonth);
  const groups = new Map();
  for (const item of items) {
    const date = earningsDateKey(item.date);
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(item);
  }
  const pageCount = Math.max(1, Math.ceil(total / 100));

  return (
    <section className="space-y-3 rounded-lg border bg-white p-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Monthly history</h3>
          <p className="text-[11px] text-gray-500">Select a month to view its day-by-day entries.</p>
        </div>
        {selectedSummary && <div className="text-right">
          <div className="text-[11px] text-gray-500">Month total</div>
          <div className="text-lg font-semibold">{money(selectedSummary.totalPaise)}</div>
        </div>}
      </div>

      {months.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Available earnings months">
          {months.map(item => (
            <button
              key={item._id}
              type="button"
              onClick={() => { setSelectedMonth(item._id); setPage(1); }}
              aria-pressed={selectedMonth === item._id}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${selectedMonth === item._id ? 'border-blue-700 bg-blue-700 text-white' : 'bg-white hover:bg-gray-50'}`}
            >
              {monthLabel(item._id)} · {money(item.totalPaise)}
            </button>
          ))}
        </div>
      )}

      {loading ? <p className="text-xs text-gray-500">Loading monthly entries…</p>
        : error ? <p role="alert" className="text-xs text-red-700">{error}</p>
          : !selectedMonth ? <p className="text-xs text-gray-500">No earnings recorded yet.</p>
            : groups.size === 0 ? <p className="text-xs text-gray-500">No entries in this month.</p>
              : <div className="space-y-2">
                {[...groups.entries()].map(([date, dayItems]) => {
                  const daySummary = days.find(item => item._id === date);
                  return (
                    <details key={date} className="rounded border px-3 py-2 text-xs">
                      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short' })}</span>
                        <span>Total {money(daySummary?.totalPaise)} · {dayItems.length} entr{dayItems.length === 1 ? 'y' : 'ies'}</span>
                      </summary>
                      <ul className="mt-2 space-y-1 border-t pt-2">
                        {dayItems.map(item => (
                          <li key={item._id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                            <span>
                              {item.type === 'sale' ? 'Cash / UPI sale' : `Customer credit · ${item.partyId?.name || 'Customer'}`}
                              {' · '}{money(item.amountPaise)}
                              {item.status === 'draft' && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">Draft</span>}
                              {item.description && <span className="ml-1 text-gray-500">· {item.description}</span>}
                            </span>
                            <span className="flex flex-wrap gap-3">
                              <button type="button" onClick={() => onEdit(item)} className="font-medium text-blue-700 underline">Edit</button>
                              <button type="button" onClick={() => onDelete(item)} className="font-medium text-red-700 underline">Delete permanently</button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  );
                })}
                {pageCount > 1 && <div className="flex items-center justify-between pt-1 text-xs">
                  <span>{total} entries · Page {page} of {pageCount}</span>
                  <span className="flex gap-2">
                    <button type="button" disabled={page === 1} onClick={() => setPage(current => current - 1)} className="rounded border px-2 py-1 disabled:opacity-40">Previous</button>
                    <button type="button" disabled={page === pageCount} onClick={() => setPage(current => current + 1)} className="rounded border px-2 py-1 disabled:opacity-40">Next</button>
                  </span>
                </div>}
              </div>}
    </section>
  );
}

function MonthlyEarningsReport({ refreshKey, selectedMonth, onMonthChange }) {
  const [months, setMonths] = useState([]);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (selectedMonth) params.set('month', selectedMonth);
        const response = await fetch(`/api/admin/ledger/earnings-history?${params}`, { credentials: 'include' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load earnings report');
        if (!active) return;
        const availableMonths = result.months || [];
        setMonths(availableMonths);
        if (!selectedMonth && availableMonths.length) {
          onMonthChange(availableMonths[0]._id);
        } else if (selectedMonth && !availableMonths.some(item => item._id === selectedMonth)) {
          onMonthChange(availableMonths[0]?._id || '');
        } else {
          setDays(result.days || []);
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load earnings report');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [selectedMonth, refreshKey, onMonthChange]);

  const monthSummary = months.find(item => item._id === selectedMonth);
  const maxPaise = Math.max(...days.map(item => item.totalPaise || 0), 0);

  return (
    <section className="space-y-3 rounded-lg border bg-white p-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Monthly earnings chart</h2>
          <p className="text-[11px] text-gray-500">Daily cash/UPI sales and customer-credit sales for the selected month.</p>
        </div>
        <label className="text-xs">Month
          <select value={selectedMonth} onChange={event => onMonthChange(event.target.value)} className="ml-2 rounded border p-2">
            {months.map(item => <option key={item._id} value={item._id}>{monthLabel(item._id)}</option>)}
          </select>
        </label>
      </div>
      {monthSummary && <div className="flex flex-wrap gap-x-6 gap-y-1 border-b pb-3 text-xs">
        <span className="text-gray-500">Total earnings <strong className="ml-1 text-base text-gray-900">{money(monthSummary.totalPaise)}</strong></span>
        <span className="text-gray-500">Cash / UPI <strong className="ml-1 text-gray-800">{money(monthSummary.salePaise)}</strong></span>
        <span className="text-gray-500">Customer credit <strong className="ml-1 text-gray-800">{money(monthSummary.creditPaise)}</strong></span>
        {monthSummary.openingBalancePaise !== undefined && <span className="text-gray-500">Saved opening balance <strong className="ml-1 text-gray-800">{money(monthSummary.openingBalancePaise)}</strong></span>}
      </div>}
      {loading ? <p className="text-xs text-gray-500">Loading earnings chart…</p>
        : error ? <p role="alert" className="text-xs text-red-700">{error}</p>
          : !selectedMonth ? <p className="text-xs text-gray-500">No earnings recorded yet.</p>
            : days.length === 0 && monthSummary?.openingBalancePaise !== undefined ? <p className="text-xs text-gray-500">No earnings recorded for this month; an opening balance has been assigned.</p>
            : days.length === 0 ? <p className="text-xs text-gray-500">No earnings recorded for this month.</p>
              : <div className="overflow-x-auto pb-2">
                <div className="flex min-w-max items-end gap-2 border-b border-l px-2 pt-3" style={{ height: 220 }} role="img" aria-label={`${monthLabel(selectedMonth)} daily earnings bar graph`}>
                  {days.map(day => {
                    const height = maxPaise ? Math.max(4, (day.totalPaise / maxPaise) * 100) : 0;
                    return (
                      <div key={day._id} className="flex h-full w-9 flex-col items-center justify-end gap-1">
                        <span className="whitespace-nowrap text-[9px] text-gray-500">{money(day.totalPaise)}</span>
                        <div
                          title={`${day._id}: ${money(day.totalPaise)} total · ${money(day.salePaise)} cash/UPI · ${money(day.creditPaise)} credit`}
                          className="w-5 rounded-t bg-gradient-to-t from-blue-700 to-sky-400 transition-[height] duration-500"
                          style={{ height: `${height}%` }}
                        />
                        <span className="pb-1 text-[10px] text-gray-600">{Number(day._id.slice(-2))}</span>
                      </div>
                    );
                  })}
                </div>
              </div>}
      <div className="flex flex-wrap gap-3 text-[10px] text-gray-500">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-700" />Daily total</span>
        <span>{days.length} earning day{days.length === 1 ? '' : 's'} recorded</span>
      </div>
    </section>
  );
}

function RecentEarningsHistory({ onEdit, onDelete, refreshKey }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const fetchType = async type => {
      const params = new URLSearchParams({ type, limit: '100' });
      const response = await fetch(`/api/admin/ledger/transactions?${params}`, { credentials: 'include' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load entries.');
      return result.items || [];
    };
    const [sales, creditSales] = await Promise.all([fetchType('sale'), fetchType('credit_sale')]);
    setItems([...sales, ...creditSales].sort((a, b) => new Date(b.date) - new Date(a.date)));
  }, []);

  useEffect(() => {
    load().catch(loadError => setError(loadError.message || 'Unable to load entries.')).finally(() => setLoading(false));
  }, [load, refreshKey]);

  const groups = new Map();
  for (const item of items) {
    const date = new Date(item.date).toISOString().slice(0, 10);
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(item);
  }

  return (
    <section className="rounded-lg border bg-white p-3">
      <h3 className="font-semibold">Earnings history</h3>
      {loading ? <p className="mt-2 text-xs text-gray-500">Loading…</p>
        : error ? <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>
          : groups.size === 0 ? <p className="mt-2 text-xs text-gray-500">No earnings recorded yet.</p>
            : <div className="mt-2 space-y-2">
              {[...groups.entries()].slice(0, 10).map(([date, dayItems]) => {
                const active = dayItems.filter(item => item.status !== 'voided');
                const cashPaise = active.filter(item => item.type === 'sale').reduce((sum, item) => sum + (item.paidByAccountPaise?.cash ?? (item.account === 'cash' ? item.amountPaise : 0)), 0);
                const upiPaise = active.filter(item => item.type === 'sale').reduce((sum, item) => sum + (item.paidByAccountPaise?.upi ?? (item.account === 'upi' ? item.amountPaise : 0)), 0);
                const creditPaise = active.filter(item => item.type === 'credit_sale').reduce((sum, item) => sum + item.amountPaise, 0);
                const totalPaise = cashPaise + upiPaise + creditPaise;
                return <details key={date} className="rounded border px-3 py-2 text-xs">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{new Date(`${date}T00:00:00`).toLocaleDateString('en-IN')}</span>
                    <span>Total {money(totalPaise)} · Cash {money(cashPaise)} · UPI {money(upiPaise)} · Credit {money(creditPaise)}</span>
                  </summary>
                  <ul className="mt-2 space-y-1 border-t pt-2">
                    {dayItems.map(item => <li key={item._id} className={`flex flex-wrap items-center justify-between gap-2 ${item.status === 'voided' ? 'text-gray-400 line-through' : ''}`}>
                      <span>{item.type === 'sale' ? 'Cash / UPI sales' : `Customer credit · ${item.partyId?.name || 'Customer'}`} · {money(item.amountPaise)}{item.status === 'voided' ? ' · deleted' : ''}</span>
                      <span className="flex flex-wrap gap-2">
                        {item.status !== 'voided' && <button onClick={() => onEdit(item)} className="text-blue-700 underline">Edit</button>}
                        <button onClick={() => onDelete(item)} className="text-red-700 underline">Delete permanently</button>
                      </span>
                    </li>)}
                  </ul>
                </details>;
              })}
            </div>}
    </section>
  );
}

function DailyEarningsForm({ parties, onSaved, onCustomerAdded }) {
  const [date, setDate] = useState(today());
  const [totalEarning, setTotalEarning] = useState('');
  const [upi, setUpi] = useState('');
  const [description, setDescription] = useState('');
  const [creditRows, setCreditRows] = useState([]);
  const [customers, setCustomers] = useState(parties);
  const [addingCustomerFor, setAddingCustomerFor] = useState(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [customerSaving, setCustomerSaving] = useState(false);
  const [saleIdempotencyKey, setSaleIdempotencyKey] = useState(idempotencyKey);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setCustomers(current => {
      const known = new Set(current.map(party => party._id));
      return [...current, ...parties.filter(party => !known.has(party._id))];
    });
  }, [parties]);

  function addCreditRow() {
    setCreditRows(current => [...current, { partyId: '', amount: '', description: '', idempotencyKey: idempotencyKey() }]);
  }

  function updateCreditRow(index, key, value) {
    setCreditRows(current => current.map((row, rowIndex) => rowIndex === index
      ? { ...row, [key]: value, ...(row.saved ? { saved: false, idempotencyKey: idempotencyKey() } : {}) }
      : row));
  }

  async function createCustomer(event) {
    event.preventDefault();
    setCustomerSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/ledger/parties', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'customer', name: newCustomerName, phone: newCustomerPhone, openingBalance: '0' })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to add customer');
      setCustomers(current => [...current, result.party]);
      if (addingCustomerFor !== null) updateCreditRow(addingCustomerFor, 'partyId', result.party._id);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setAddingCustomerFor(null);
      await onCustomerAdded();
      if (result.duplicateMobileWarning) {
        setMessage(`Customer added. Duplicate mobile warning: ${result.duplicateMobileWarning.name} (${result.duplicateMobileWarning.phone}).`);
      }
    } catch (error) {
      setMessage(error.message || 'Unable to add customer');
    } finally {
      setCustomerSaving(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    if (!date || date > today()) {
      setMessage('Choose today or a past business date.');
      setSaving(false);
      return;
    }
    const totalEarningPaise = amountPaise(totalEarning);
    const upiPaise = amountPaise(upi);
    const parsedCredits = creditRows.map(row => ({ ...row, amountPaise: amountPaise(row.amount) }));
    const creditTotalPaise = parsedCredits.reduce((sum, row) => sum + (row.amountPaise || 0), 0);
    const cashPaise = totalEarningPaise === null || upiPaise === null ? null : totalEarningPaise - upiPaise - creditTotalPaise;
    if (totalEarningPaise === null || upiPaise === null || parsedCredits.some(row => !row.partyId || row.amountPaise === null || row.amountPaise <= 0)) {
      setMessage('Enter a valid total, UPI amount and amount for each customer credit entry.');
      setSaving(false);
      return;
    }
    if (totalEarningPaise <= 0 || cashPaise < 0) {
      setMessage('UPI and customer credit cannot exceed total sales.');
      setSaving(false);
      return;
    }
    let savedAny = false;
    try {
      for (let index = 0; index < parsedCredits.length; index += 1) {
        const row = parsedCredits[index];
        if (row.saved) continue;
        const response = await fetch('/api/admin/ledger/transactions', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'credit_sale',
            date,
            amount: (row.amountPaise / 100).toFixed(2),
            partyId: row.partyId,
            account: 'credit',
            description: [row.description, description].filter(Boolean).join(' · '),
            status: 'finalized',
            idempotencyKey: row.idempotencyKey
          })
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(`Some customer credit entries have already been saved. Retry the remaining entries. ${result.error || 'Unable to save the next entry.'}`);
        }
        savedAny = true;
        setCreditRows(current => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, saved: true } : entry));
      }

      const paidSalesPaise = cashPaise + upiPaise;
      if (paidSalesPaise > 0) {
        const response = await fetch('/api/admin/ledger/transactions', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'sale',
            date,
            amount: (paidSalesPaise / 100).toFixed(2),
            account: 'cash',
            paidAmount: '0',
            paidByAccount: {
              cash: (cashPaise / 100).toFixed(2),
              upi: (upiPaise / 100).toFixed(2),
              bank: '0',
              other: '0'
            },
            description,
            status: 'finalized',
            idempotencyKey: saleIdempotencyKey
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(`Customer credit entries were saved. ${result.error || 'Unable to save cash / UPI sales.'}`);
        savedAny = true;
      }
      const savedCreditCount = parsedCredits.length;
      setTotalEarning('');
      setUpi('');
      setDescription('');
      setCreditRows([]);
      setSaleIdempotencyKey(idempotencyKey());
      setMessage(`Earnings for ${date} saved${savedCreditCount ? ` with ${savedCreditCount} customer credit entr${savedCreditCount === 1 ? 'y' : 'ies'}` : ''}. Balances updated.`);
      await onSaved();
    } catch (error) {
      console.error('daily earning submission failed', error);
      setMessage(error.message || 'Unable to save daily earning.');
      if (savedAny) {
        try {
          await onSaved();
        } catch (refreshError) {
          console.error('daily earning history refresh failed', refreshError);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="space-y-3 rounded-lg border bg-white p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs">Business date (past dates allowed)<input required max={today()} type="date" value={date} onChange={event => setDate(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
          <label className="text-xs">Total sales (₹)<input required min="0.01" step="0.01" type="number" value={totalEarning} onChange={event => setTotalEarning(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
          <label className="text-xs">Received via UPI (₹)<input required min="0" step="0.01" type="number" value={upi} onChange={event => setUpi(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
          <label className="text-xs">Notes (optional)<input value={description} onChange={event => setDescription(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded bg-blue-50 p-2 text-[11px]">
          <div>Cash: <strong>{money((amountPaise(totalEarning) || 0) - (amountPaise(upi) || 0) - creditRows.reduce((sum, row) => sum + (amountPaise(row.amount) || 0), 0))}</strong></div>
          <div>UPI: <strong>{money(amountPaise(upi) || 0)}</strong></div>
          <div>Customer credit: <strong>{money(creditRows.reduce((sum, row) => sum + (amountPaise(row.amount) || 0), 0))}</strong></div>
        </div>
        <section className="space-y-2 rounded border p-2 sm:p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h3 className="font-semibold">Customer credit</h3><p className="text-xs text-gray-600">Enter each customer’s amount separately.</p></div>
            <button type="button" onClick={addCreditRow} className="rounded border px-3 py-2 text-xs">+ Add customer credit</button>
          </div>
          {creditRows.map((row, index) => (
            <div key={index} className="grid gap-2 rounded bg-gray-50 p-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="text-xs lg:col-span-2">
                <label>Customer name
                  <select required disabled={row.saved} value={row.partyId} onChange={event => updateCreditRow(index, 'partyId', event.target.value)} className="mt-1 w-full rounded border bg-white p-2 disabled:bg-gray-100">
                    <option value="">Select a customer</option>
                    {customers.map(customer => <option key={customer._id} value={customer._id}>{customer.name}{customer.phone ? ` (${customer.phone})` : ''}</option>)}
                  </select>
                </label>
                <label className="mt-2 block">Credit amount (₹)<input required disabled={row.saved} min="0.01" step="0.01" type="number" value={row.amount} onChange={event => updateCreditRow(index, 'amount', event.target.value)} className="mt-1 w-full rounded border bg-white p-2 disabled:bg-gray-100" /></label>
                <button type="button" disabled={row.saved} onClick={() => { setAddingCustomerFor(index); setNewCustomerName(''); setNewCustomerPhone(''); }} className="mt-1 text-xs text-blue-700 underline disabled:text-gray-400">+ Add customer</button>
              </div>
              <div className="flex items-end justify-between gap-2">
                <label className="w-full text-xs">Note<input disabled={row.saved} value={row.description} onChange={event => updateCreditRow(index, 'description', event.target.value)} className="mt-1 w-full rounded border bg-white p-2 disabled:bg-gray-100" /></label>
                <button type="button" disabled={row.saved} aria-label="Remove customer credit entry" onClick={() => setCreditRows(current => current.filter((_, rowIndex) => rowIndex !== index))} className="mb-2 text-xs text-red-700 underline disabled:text-gray-400">Remove</button>
                {row.saved && <span className="text-xs text-green-700">Saved</span>}
              </div>
            </div>
          ))}
          {creditRows.length === 0 && <p className="text-xs text-gray-500">No customer credit entries added for this date.</p>}
        </section>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={saving} className="rounded bg-blue-700 px-3 py-2 text-xs text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save earnings'}</button>
          {message && <span role="status" className="text-xs">{message}</span>}
        </div>
      </form>
      {addingCustomerFor !== null && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:items-center sm:p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAddingCustomerFor(null); }}>
          <form role="dialog" aria-modal="true" aria-labelledby="daily-add-customer-title" onSubmit={createCustomer} className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md space-y-3 overflow-y-auto rounded-lg bg-white p-4 shadow-xl sm:max-h-[90dvh]">
            <div className="flex items-center justify-between"><h2 id="daily-add-customer-title" className="text-base font-semibold">Add customer</h2><button type="button" aria-label="Close" onClick={() => setAddingCustomerFor(null)} className="text-2xl leading-none text-gray-500">×</button></div>
            <label className="block text-xs">Customer name<input required autoFocus value={newCustomerName} onChange={event => setNewCustomerName(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
            <label className="block text-xs">Mobile number (optional)<input value={newCustomerPhone} onChange={event => setNewCustomerPhone(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
            <p className="text-[11px] text-gray-500">New customer accounts start at ₹0.00 and are selected after saving.</p>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setAddingCustomerFor(null)} className="rounded border px-3 py-2 text-xs">Cancel</button><button disabled={customerSaving} className="rounded bg-blue-700 px-3 py-2 text-xs text-white disabled:opacity-50">{customerSaving ? 'Saving…' : 'Save customer'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

function MarketPurchaseForm({ parties, onSaved }) {
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [cash, setCash] = useState('');
  const [upi, setUpi] = useState('');
  const [partyId, setPartyId] = useState('');
  const [description, setDescription] = useState('');
  const [purchases, setPurchases] = useState([]);
  const [fundingTransactions, setFundingTransactions] = useState([]);
  const [repaymentDrafts, setRepaymentDrafts] = useState({});
  const [investmentNotes, setInvestmentNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadHistory = useCallback(async () => {
    const fetchType = async type => {
      const params = new URLSearchParams({ type, limit: '100' });
      const response = await fetch(`/api/admin/ledger/transactions?${params}`, { credentials: 'include' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Unable to load ${type} history`);
      return result.items || [];
    };
    const [purchaseItems, reimbursementItems, investmentItems] = await Promise.all([
      fetchType('market_purchase'),
      fetchType('owner_reimbursement'),
      fetchType('owner_investment')
    ]);
    setPurchases(purchaseItems);
    setFundingTransactions([...reimbursementItems, ...investmentItems]);
  }, []);

  useEffect(() => {
    loadHistory()
      .catch(error => setMessage(error.message || 'Unable to load market-purchase history'))
      .finally(() => setLoading(false));
  }, [loadHistory]);

  const cashPaise = amountPaise(cash);
  const upiPaise = amountPaise(upi);
  const billPaise = amountPaise(amount);
  const personalPaise = billPaise !== null && cashPaise !== null && upiPaise !== null
    ? billPaise - cashPaise - upiPaise
    : null;

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    if (billPaise === null || billPaise <= 0 || cashPaise === null || upiPaise === null || personalPaise === null || personalPaise < 0) {
      setMessage('Enter a valid bill amount. Shop cash and UPI cannot exceed the bill total.');
      setSaving(false);
      return;
    }
    try {
      const response = await fetch('/api/admin/ledger/transactions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'market_purchase',
          date,
          amount: (billPaise / 100).toFixed(2),
          paidAmount: ((cashPaise + upiPaise) / 100).toFixed(2),
          paidByAccount: {
            cash: (cashPaise / 100).toFixed(2),
            upi: (upiPaise / 100).toFixed(2),
            bank: '0',
            other: '0'
          },
          ownerContribution: (personalPaise / 100).toFixed(2),
          partyId: partyId || null,
          account: 'cash',
          description,
          status: 'finalized',
          idempotencyKey: idempotencyKey()
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Unable to save market purchase (HTTP ${response.status})`);
      setAmount('');
      setCash('');
      setUpi('');
      setDescription('');
      setMessage('Market purchase saved.');
      await Promise.all([onSaved(), loadHistory()]);
    } catch (error) {
      console.error('market purchase submission failed', error);
      setMessage(error.message || 'Unable to save market purchase.');
    } finally {
      setSaving(false);
    }
  }

  function linkedTransactions(purchase) {
    return fundingTransactions.filter(item => String(item.linkedTransactionId?._id || item.linkedTransactionId) === String(purchase._id));
  }

  function remainingReimbursement(purchase) {
    const allocated = linkedTransactions(purchase)
      .filter(item => item.status === 'finalized')
      .reduce((total, item) => total + item.amountPaise, 0);
    return Math.max(0, (purchase.ownerContributionPaise || 0) - allocated);
  }

  function updateRepayment(purchaseId, key, value) {
    setRepaymentDrafts(current => ({
      ...current,
      [purchaseId]: { ...(current[purchaseId] || {}), [key]: value }
    }));
  }

  async function recordOwnerAction(purchase, type, amountPaiseValue, account, details = {}) {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/ledger/transactions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          date: details.date || today(),
          amount: (amountPaiseValue / 100).toFixed(2),
          account: type === 'owner_investment' ? '' : account,
          linkedTransactionId: purchase._id,
          category: type === 'owner_investment' ? 'Shop owner investment' : 'Market-purchase reimbursement',
          description: details.description || '',
          status: 'finalized',
          idempotencyKey: idempotencyKey()
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Unable to save ${type === 'owner_investment' ? 'investment' : 'reimbursement'}`);
      setMessage(type === 'owner_investment' ? 'Remaining amount recorded as owner investment.' : 'Reimbursement payment saved.');
      await Promise.all([onSaved(), loadHistory()]);
    } catch (error) {
      console.error('market purchase funding action failed', error);
      setMessage(error.message || 'Unable to save the funding entry.');
    } finally {
      setSaving(false);
    }
  }

  async function reimburse(purchase) {
    const draft = repaymentDrafts[purchase._id] || {};
    const amountValue = draft.amount || (remainingReimbursement(purchase) / 100).toFixed(2);
    const amountValuePaise = amountPaise(amountValue);
    if (amountValuePaise === null || amountValuePaise <= 0 || amountValuePaise > remainingReimbursement(purchase)) {
      setMessage('Enter a valid reimbursement amount within the remaining due.');
      return;
    }
    await recordOwnerAction(purchase, 'owner_reimbursement', amountValuePaise, draft.account || 'cash', { date: draft.date || today(), description: draft.note || '' });
  }

  async function investRemainder(purchase) {
    const duePaise = remainingReimbursement(purchase);
    if (!duePaise || !window.confirm(`Record ${money(duePaise)} as owner investment instead of reimbursement? It will not increase cash/UPI balances.`)) return;
    await recordOwnerAction(purchase, 'owner_investment', duePaise, '', { description: investmentNotes[purchase._id] || '' });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="grid gap-2 rounded-lg border bg-white p-3 sm:grid-cols-2 lg:grid-cols-3">
        <h3 className="text-base font-semibold sm:col-span-2 lg:col-span-3">Record a market bill</h3>
        <label className="text-sm">Purchase date<input required type="date" value={date} onChange={event => setDate(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
        <label className="text-sm">Total bill amount (₹)<input required min="0.01" step="0.01" type="number" value={amount} onChange={event => setAmount(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
        <label className="text-sm">Paid from shop cash (₹)<input required min="0" step="0.01" type="number" value={cash} onChange={event => setCash(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
        <label className="text-sm">Paid from shop UPI (₹)<input required min="0" step="0.01" type="number" value={upi} onChange={event => setUpi(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
        <label className="text-sm">Supplier (optional)<select value={partyId} onChange={event => setPartyId(event.target.value)} className="mt-1 w-full rounded border p-2"><option value="">No supplier / market purchase</option>{parties.map(party => <option key={party._id} value={party._id}>{party.name}{party.phone ? ` (${party.phone})` : ''}</option>)}</select></label>
        <label className="text-sm">Notes / who funded it (optional)<input value={description} onChange={event => setDescription(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
        <div className={`rounded p-2 text-xs sm:col-span-2 lg:col-span-3 ${personalPaise !== null && personalPaise >= 0 ? 'bg-blue-50 text-blue-900' : 'bg-red-50 text-red-800'}`}>
          Personal / borrowed amount used: <strong>{personalPaise === null || personalPaise < 0 ? 'Check the amounts' : money(personalPaise)}</strong>
          <span className="ml-2">This is the amount currently due back to you.</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-3">
          <button disabled={saving} className="rounded bg-blue-700 px-3 py-2 text-xs text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save market bill'}</button>
          {message && <span role="status" className="text-xs">{message}</span>}
        </div>
      </form>

      <section className="space-y-3">
        <h3 className="text-base font-semibold">Market purchase and reimbursement history</h3>
        <p className="text-xs text-gray-500">Latest 100 bills are shown here. Use Other ledger tools → All transactions to search older entries.</p>
        {loading ? <p className="text-sm text-gray-500">Loading purchases…</p> : purchases.length === 0 ? <p className="rounded border bg-white p-4 text-sm text-gray-500">No market purchases recorded yet.</p> : purchases.map(purchase => {
          const linked = linkedTransactions(purchase);
          const duePaise = remainingReimbursement(purchase);
          const cashUsed = purchase.paidByAccountPaise?.cash ?? (purchase.account === 'cash' ? purchase.paidAmountPaise : 0);
          const upiUsed = purchase.paidByAccountPaise?.upi ?? (purchase.account === 'upi' ? purchase.paidAmountPaise : 0);
          const draft = repaymentDrafts[purchase._id] || {};
          return <article key={purchase._id} className={`space-y-2 rounded-lg border bg-white p-3 ${purchase.status === 'voided' ? 'opacity-60' : ''}`}>
            <header className="flex flex-wrap justify-between gap-2">
              <div><strong>{new Date(purchase.date).toLocaleDateString('en-IN')} · Bill {money(purchase.amountPaise)}</strong><div className="text-xs text-gray-600">Shop cash {money(cashUsed)} · Shop UPI {money(upiUsed)} · Your funds {money(purchase.ownerContributionPaise || 0)}{purchase.description ? ` · ${purchase.description}` : ''}</div></div>
              <div className="text-right"><span className="text-sm text-gray-600">Reimbursement due</span><div className="font-semibold">{money(duePaise)}</div></div>
            </header>
            {purchase.status === 'finalized' && duePaise > 0 &&             <div className="grid gap-2 rounded bg-gray-50 p-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm">Reimburse now (₹)<input required min="0.01" max={(duePaise / 100).toFixed(2)} step="0.01" type="number" value={draft.amount ?? (duePaise / 100).toFixed(2)} onChange={event => updateRepayment(purchase._id, 'amount', event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
              <label className="text-sm">Payment date<input required type="date" value={draft.date || today()} onChange={event => updateRepayment(purchase._id, 'date', event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
              <label className="text-sm">Paid from<select value={draft.account || 'cash'} onChange={event => updateRepayment(purchase._id, 'account', event.target.value)} className="mt-1 w-full rounded border p-2"><option value="cash">Cash</option><option value="upi">UPI</option></select></label>
              <label className="text-sm">Note (optional)<input value={draft.note || ''} onChange={event => updateRepayment(purchase._id, 'note', event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
              <button disabled={saving} onClick={() => reimburse(purchase)} className="self-end rounded border border-blue-700 px-3 py-2 text-sm text-blue-800 disabled:opacity-50">Record reimbursement</button>
              <label className="text-sm sm:col-span-2">Investment note (optional)<input value={investmentNotes[purchase._id] || ''} onChange={event => setInvestmentNotes(current => ({ ...current, [purchase._id]: event.target.value }))} className="mt-1 w-full rounded border p-2" /></label>
              <button disabled={saving} onClick={() => investRemainder(purchase)} className="self-end rounded border border-green-700 px-3 py-2 text-sm text-green-800 disabled:opacity-50">Keep remaining as shop investment</button>
            </div>}
            {linked.length > 0 && <ul className="space-y-1 border-t pt-2 text-sm">{linked.map(item => <li key={item._id} className={item.status === 'voided' ? 'text-gray-400 line-through' : ''}>{item.type === 'owner_investment' ? 'Owner investment' : 'Reimbursement'} · {money(item.amountPaise)} · {new Date(item.date).toLocaleDateString('en-IN')}{item.account && item.account !== 'credit' ? ` · ${item.account.toUpperCase()}` : ''}{item.description ? ` · ${item.description}` : ''} · {item.status}</li>)}</ul>}
          </article>;
        })}
      </section>
    </div>
  );
}

function QuickEntryForm({ kind, parties, categories, initialPartyId = '', onSaved }) {
  const typeOptions = {
    customer: [['credit_sale', 'Add credit sale'], ['customer_payment', 'Record payment']],
    supplier: [['supplier_purchase', 'Supplier bill'], ['supplier_payment', 'Supplier payment']],
    expense: [
      ['expense', 'Operating expense'],
      ['owner_withdrawal', 'Owner withdrawal'],
      ['other_payment', 'Shop asset purchase'],
      ['other_receipt', 'Shop asset sale']
    ]
  }[kind];
  const [type, setType] = useState(typeOptions[0][0]);
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [partyId, setPartyId] = useState(initialPartyId);
  const [account, setAccount] = useState('cash');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const isPurchase = ['supplier_purchase', 'market_purchase'].includes(type);
  const needsParty = ['credit_sale', 'customer_payment', 'supplier_purchase', 'supplier_payment'].includes(type);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/ledger/transactions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          date,
          amount,
          paidAmount: isPurchase ? (account === 'credit' ? '0' : paidAmount || '0') : '0',
          partyId: partyId || null,
          account: type === 'credit_sale' ? 'credit' : account,
          category,
          description,
          status: 'finalized',
          idempotencyKey: typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Unable to save entry (HTTP ${response.status})`);
      setAmount('');
      setPaidAmount('');
      setDescription('');
      setMessage('Entry saved.');
      await onSaved();
    } catch (error) {
      console.error('ledger module entry submission failed', error);
      setMessage(error.message || 'Unable to save entry. Check the connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form id="ledger-quick-entry" onSubmit={submit} className="rounded-lg border bg-white p-3">
      <h2 className="text-sm font-semibold">
        {kind === 'customer' ? 'Customer account entry' : kind === 'supplier' ? 'Purchase or payment entry' : 'Expense entry'}
      </h2>
      <p className="mt-1 text-[11px] text-gray-600">
        {kind === 'customer' ? 'Add a credit sale or record a customer payment.' : kind === 'supplier' ? 'Record a supplier purchase or payment.' : 'Record a business expense or owner withdrawal.'}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm">Entry
          <select value={type} onChange={event => {
            const nextType = event.target.value;
            setType(nextType);
            setCategory(nextType === 'other_payment' ? 'Shop asset purchase' : nextType === 'other_receipt' ? 'Shop asset sale' : '');
            setAccount(nextType === 'credit_sale' ? 'credit' : 'cash');
          }} className="mt-1 w-full rounded border p-2">
            {typeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-sm">Date
          <input required type="date" value={date} onChange={event => setDate(event.target.value)} className="mt-1 w-full rounded border p-2" />
        </label>
        <label className="text-sm">Amount (₹)
          <input required min="0.01" step="0.01" type="number" value={amount} onChange={event => setAmount(event.target.value)} className="mt-1 w-full rounded border p-2" />
        </label>
        {kind !== 'expense' && <label className="text-sm">{needsParty ? (kind === 'customer' ? 'Customer' : 'Supplier') : 'Supplier (optional)'}
          <select required={needsParty} value={partyId} onChange={event => setPartyId(event.target.value)} className="mt-1 w-full rounded border p-2">
            <option value="">{needsParty ? `Select ${kind}` : 'No supplier / market purchase'}</option>
            {parties.map(party => <option key={party._id} value={party._id}>{party.name}{party.phone ? ` (${party.phone})` : ''}</option>)}
          </select>
        </label>}
        {type !== 'credit_sale' && <label className="text-sm">{isPurchase ? 'Payment mode' : kind === 'expense' ? 'Paid / received from shop account' : 'Payment account'}
          <select value={account} onChange={event => { setAccount(event.target.value); if (event.target.value === 'credit') setPaidAmount('0'); }} className="mt-1 w-full rounded border p-2">
            {(isPurchase ? [...ACCOUNTS, 'credit'] : ACCOUNTS).map(value => <option key={value} value={value}>{value === 'credit' ? 'Supplier credit' : value.toUpperCase()}</option>)}
          </select>
        </label>}
        {isPurchase && <label className="text-sm">Amount paid now (₹)
          <input min="0" step="0.01" type="number" value={account === 'credit' ? '0' : paidAmount} onChange={event => setPaidAmount(event.target.value)} disabled={account === 'credit'} className="mt-1 w-full rounded border p-2 disabled:bg-gray-100" />
        </label>}
        {kind === 'expense' && ['expense', 'other_payment', 'other_receipt'].includes(type) && <label className="text-sm">Category
          <select required value={category} onChange={event => setCategory(event.target.value)} className="mt-1 w-full rounded border p-2">
            <option value="">Select category</option>
            {categories.map(item => <option key={item._id} value={item.name}>{item.name}</option>)}
            {type === 'other_payment' && <option value="Shop asset purchase">Shop asset purchase</option>}
            {type === 'other_receipt' && <option value="Shop asset sale">Shop asset sale</option>}
          </select>
        </label>}
        {kind === 'expense' && ['other_payment', 'other_receipt'].includes(type) && <p className="self-end text-xs text-gray-600">{type === 'other_payment' ? 'Paid from the selected account; separate from operating expenses.' : 'Received into the selected account; separate from sales.'}</p>}
        {type === 'customer_payment' && <p className="self-end text-xs text-gray-600">Reduces outstanding first; any extra becomes an advance.</p>}
        <label className="text-sm sm:col-span-2">Notes (optional)
          <input value={description} onChange={event => setDescription(event.target.value)} className="mt-1 w-full rounded border p-2" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button disabled={saving} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save entry'}</button>
        {message && <span role="status" className={`text-sm ${message === 'Entry saved.' ? 'text-green-700' : 'text-red-700'}`}>{message}</span>}
      </div>
    </form>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  if (!session || session.user?.role !== 'admin') return authRedirect(ctx);
  return { props: {} };
}
