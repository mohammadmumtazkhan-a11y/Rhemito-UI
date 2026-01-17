import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, ChevronRight, User, AlertCircle, Building, CreditCard, Wallet } from 'lucide-react';

// Steps Constant
const STEPS = ['Amount', 'Recipient', 'Bank', 'Summary', 'Payment Method'];

// Mock Data
const RECIPIENTS = [
    { id: 1, name: 'Akshita Gupta', bank: 'UK Bank', account: '12345678', initials: 'AG' },
    { id: 2, name: 'ALAN COLAM PSYCH...', bank: 'UK Bank', account: '98745889', initials: 'AL' },
    { id: 3, name: 'Amen Raok', bank: 'Enugu Waste POS', account: '12345678', initials: 'AR' },
    { id: 4, name: 'Anktech Softwares...', bank: 'UK Bank', account: '64521311', initials: 'AN' },
];

const TestCheckout = () => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Transaction State
    const [transaction, setTransaction] = useState({
        amount: 500,
        source_currency: 'GBP',
        dest_currency: 'USD',
        exchange_rate: 1.4,
        fee: 15.00,
        delivery_method: 'Bank Deposit', // Bank Deposit, Mobile Money, Cash Pickup
        recipient: null, // { name, bank, account }
        bank_details: { sort_code: '', account_number: '' },
        payment_method: 'Bank Transfer'
    });

    // Promo State
    const [promoCode, setPromoCode] = useState('');
    const [promoStatus, setPromoStatus] = useState(null);

    // Derived State
    const amountSent = transaction.amount - transaction.fee;
    const amountReceived = amountSent * transaction.exchange_rate;

    // --- Handlers ---

    const handleNext = () => setStep(prev => Math.min(prev + 1, 5));
    const handleBack = () => setStep(prev => Math.max(prev - 1, 1));

    const checkPromo = async () => {
        if (!promoCode) return;
        setLoading(true);
        setPromoStatus(null);
        try {
            const res = await fetch('/api/promocodes/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: promoCode,
                    amount: transaction.amount,
                    currency: transaction.source_currency,
                    userId: 'user_123', // Mock user
                    source_currency: transaction.source_currency,
                    dest_currency: transaction.dest_currency,
                    payment_method: transaction.payment_method
                })
            });
            const data = await res.json();
            if (res.ok) {
                setPromoStatus({ valid: true, msg: 'Promo Applied!', data });
            } else {
                setPromoStatus({ valid: false, msg: data.error });
            }
        } catch (err) {
            setPromoStatus({ valid: false, msg: 'Network Error' });
        } finally {
            setLoading(false);
        }
    };

    const submitTransfer = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/promocodes/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: promoStatus?.valid ? promoCode : null,
                    discount_amount: promoStatus?.valid ? (promoStatus.data.type === 'Fixed' ? promoStatus.data.value : (transaction.amount * promoStatus.data.value / 100)) : 0
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('Transfer Submitted Successfully! ' + (promoStatus?.valid ? 'Promo Code Redeemed.' : ''));
                window.location.reload(); // Reset for demo
            } else {
                alert('Failed: ' + data.error);
            }
        } catch (err) {
            alert('Submission Error');
        } finally {
            setLoading(false);
        }
    };

    // --- Render Helpers ---

    const SidebarSummary = () => (
        <div style={styles.card}>
            <h3 style={styles.cardHeader}>Amount</h3>
            <div style={styles.summaryRow}>
                <span>You Send</span>
                <span style={{ fontWeight: 600 }}>{transaction.amount.toFixed(2)} {transaction.source_currency}</span>
            </div>
            <div style={styles.summaryRow}>
                <span>Amount Sent</span>
                <span>{amountSent.toFixed(2)} {transaction.source_currency}</span>
            </div>
            <div style={styles.summaryRow}>
                <span>Fee</span>
                <span>{transaction.fee.toFixed(2)} {transaction.source_currency}</span>
            </div>
            <div style={styles.summaryRow}>
                <span>Exchange Rate</span>
                <span>1 {transaction.source_currency} = {transaction.exchange_rate} {transaction.dest_currency}</span>
            </div>
            {promoStatus?.valid && (
                <div style={{ ...styles.summaryRow, color: '#16a34a' }}>
                    <span>Promo Applied</span>
                    <span>-{promoStatus.data.display_text}</span>
                </div>
            )}
            <div style={styles.separator}></div>
            <div style={{ ...styles.summaryRow, fontSize: '1.1rem', fontWeight: 700, marginTop: 12 }}>
                <span>They Receive</span>
                <span>{amountReceived.toFixed(2)} {transaction.dest_currency}</span>
            </div>
            <div style={{ ...styles.summaryRow, color: '#6b7280', fontSize: '0.9rem', marginTop: 8 }}>
                <span>Delivery Method</span>
                <span>{transaction.delivery_method}</span>
            </div>
        </div>
    );

    return (
        <div style={styles.pageContainer}>
            {/* Header / Breadcrumbs */}
            <div style={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    {step > 1 && (
                        <button onClick={handleBack} style={styles.backBtn}>
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Send Money</h1>
                </div>

                <div style={styles.stepper}>
                    {STEPS.map((s, i) => (
                        <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                color: step === i + 1 ? '#2563eb' : (step > i + 1 ? '#2563eb' : '#9ca3af'),
                                fontWeight: step === i + 1 ? 600 : 500
                            }}>
                                <div style={{
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: step >= i + 1 ? '#2563eb' : '#e5e7eb'
                                }}></div>
                                {s}
                            </div>
                            {i < STEPS.length - 1 && (
                                <div style={{ width: 40, height: 1, background: '#e5e7eb', margin: '0 12px' }}></div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div style={styles.mainGrid}>
                {/* LEFT CONTENT */}
                <div style={styles.contentArea}>

                    {/* STEP 1: AMOUNT */}
                    {step === 1 && (
                        <div>
                            <h3 style={styles.sectionTitle}>You Send</h3>
                            <div style={styles.amountInputGroup}>
                                <div style={styles.currencySelector}>
                                    <span style={{ fontSize: '1.2rem' }}>🇬🇧</span>
                                    {transaction.source_currency}
                                </div>
                                <input
                                    type="number"
                                    value={transaction.amount}
                                    onChange={e => setTransaction({ ...transaction, amount: parseFloat(e.target.value) })}
                                    style={styles.amountInput}
                                />
                            </div>

                            <h3 style={styles.sectionTitle}>They Receive</h3>
                            <div style={styles.amountInputGroup}>
                                <div style={styles.currencySelector}>
                                    <span style={{ fontSize: '1.2rem' }}>🇺🇸</span>
                                    {transaction.dest_currency}
                                </div>
                                <input
                                    type="number"
                                    readOnly
                                    value={amountReceived.toFixed(2)}
                                    style={{ ...styles.amountInput, background: '#f9fafb' }}
                                />
                            </div>

                            <h3 style={styles.sectionTitle}>How will they receive the money?</h3>
                            <div style={styles.methodToggle}>
                                {['Bank Deposit', 'Mobile Money', 'Cash Pickup'].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setTransaction({ ...transaction, delivery_method: m })}
                                        style={{
                                            ...styles.methodBtn,
                                            ...(transaction.delivery_method === m ? styles.methodBtnActive : {})
                                        }}
                                    >
                                        {m === 'Bank Deposit' && <Building size={16} />}
                                        {m === 'Mobile Money' && <Wallet size={16} />}
                                        {m === 'Cash Pickup' && <User size={16} />}
                                        {m}
                                    </button>
                                ))}
                            </div>

                            <div style={styles.breakdownBox}>
                                <div style={styles.summaryRow}><span>Amount Sent</span><span>{amountSent.toFixed(2)} GBP</span></div>
                                <div style={styles.summaryRow}><span>Fee</span><span>{transaction.fee.toFixed(2)} GBP</span></div>
                                <div style={styles.summaryRow}><span>Exchange Rate</span><span>1 GBP = {transaction.exchange_rate} USD</span></div>
                            </div>

                            <button style={styles.primaryBtn} onClick={handleNext}>Continue</button>
                        </div>
                    )}

                    {/* STEP 2: RECIPIENT */}
                    {step === 2 && (
                        <div>
                            <h3 style={styles.sectionTitle}>Who are you sending to?</h3>
                            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                                <input placeholder="Search recipient" style={styles.searchInput} />
                                <button style={styles.secondaryBtn}>+ New Recipient</button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {RECIPIENTS.map(r => (
                                    <div
                                        key={r.id}
                                        style={{
                                            ...styles.recipientCard,
                                            border: transaction.recipient?.id === r.id ? '2px solid #2563eb' : '1px solid #e5e7eb'
                                        }}
                                        onClick={() => setTransaction({ ...transaction, recipient: r })}
                                    >
                                        <div style={styles.avatar}>{r.initials}</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600 }}>{r.name}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{r.bank}</div>
                                        </div>
                                        <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>{r.account}</div>
                                    </div>
                                ))}
                            </div>

                            <button
                                style={{ ...styles.primaryBtn, marginTop: 24, opacity: transaction.recipient ? 1 : 0.5 }}
                                disabled={!transaction.recipient}
                                onClick={handleNext}
                            >
                                Continue
                            </button>
                        </div>
                    )}

                    {/* STEP 3: BANK DETAILS */}
                    {step === 3 && (
                        <div>
                            <h3 style={styles.sectionTitle}>Banking Details</h3>
                            <div style={styles.inputGroup}>
                                <label style={styles.label}>Routing/Sort Code*</label>
                                <input
                                    style={styles.input}
                                    defaultValue={transaction.recipient?.bank === 'UK Bank' ? '200000' : ''}
                                    placeholder="e.g. 200000"
                                />
                            </div>
                            <div style={styles.inputGroup}>
                                <label style={styles.label}>Bank Account Number*</label>
                                <input
                                    style={styles.input}
                                    defaultValue={transaction.recipient?.account}
                                />
                            </div>

                            <div style={styles.bankVerifyBox}>
                                <div style={{ fontWeight: 600, marginBottom: 8 }}>Bank Name</div>
                                <div style={{ color: '#2563eb' }}>BARCLAYS BANK PLC</div>
                                <div style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: 4 }}>Verified</div>
                            </div>

                            <button style={styles.primaryBtn} onClick={handleNext}>Continue</button>
                        </div>
                    )}

                    {/* STEP 4: SUMMARY */}
                    {step === 4 && (
                        <div>
                            <div style={styles.infoBox}>
                                Please check your transaction summary below. If you are ok with all the details, click "Save".
                            </div>

                            <div style={styles.summaryReview}>
                                <h3 style={styles.sectionTitle}>Amount</h3>
                                <div style={styles.summaryRow}><span>You Send</span><span>{transaction.amount.toFixed(2)} GBP</span></div>
                                <div style={styles.summaryRow}><span>They Receive</span><span>{amountReceived.toFixed(2)} USD</span></div>

                                <h3 style={{ ...styles.sectionTitle, marginTop: 24 }}>Recipient</h3>
                                <div style={styles.summaryRow}><span>Name</span><span>{transaction.recipient?.name}</span></div>
                                <div style={styles.summaryRow}><span>Bank</span><span>{transaction.recipient?.bank}</span></div>
                                <div style={styles.summaryRow}><span>Account</span><span>{transaction.recipient?.account}</span></div>
                            </div>

                            <button style={styles.primaryBtn} onClick={handleNext}>Save & Continue</button>
                        </div>
                    )}

                    {/* STEP 5: PAYMENT (PROMO CODE HERE) */}
                    {step === 5 && (
                        <div>
                            {/* PROMO CODE SECTION */}
                            <div style={{ background: '#f0f9ff', padding: 24, borderRadius: 12, border: '1px solid #bae6fd', marginBottom: 32 }}>
                                <h4 style={{ margin: '0 0 16px 0', color: '#0369a1', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <AlertCircle size={20} /> Have a Promo Code?
                                </h4>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <input
                                        style={{ ...styles.input, marginBottom: 0, background: 'white' }}
                                        placeholder="Enter Code (e.g. SAVE20)"
                                        value={promoCode}
                                        onChange={e => {
                                            setPromoCode(e.target.value.toUpperCase());
                                            setPromoStatus(null);
                                        }}
                                    />
                                    <button
                                        onClick={checkPromo}
                                        disabled={!promoCode || loading}
                                        style={{
                                            padding: '0 32px', borderRadius: 6, background: '#0284c7', color: 'white',
                                            border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '1rem'
                                        }}
                                    >
                                        Apply
                                    </button>
                                </div>
                                {promoStatus && (
                                    <div style={{ marginTop: 12, fontSize: '0.95rem', color: promoStatus.valid ? '#16a34a' : '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {promoStatus.valid ? <Check size={16} /> : <AlertCircle size={16} />}
                                        {promoStatus.msg}
                                    </div>
                                )}
                            </div>

                            <h3 style={styles.sectionTitle}>How would you like to pay us*</h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>

                                {/* Instant Pay By Bank */}
                                <div
                                    onClick={() => setTransaction({ ...transaction, payment_method: 'Instant Pay By Bank' })}
                                    style={{
                                        ...styles.paymentCard,
                                        border: transaction.payment_method === 'Instant Pay By Bank' ? '2px solid #2563eb' : '1px solid #e5e7eb'
                                    }}
                                >
                                    <div style={styles.paymentIcon}><Building size={24} /></div>
                                    <div style={{ flex: 1 }}>
                                        <div style={styles.paymentTitle}>Instant Pay By Bank</div>
                                        <div style={styles.paymentSub}>You pay GBP {transaction.amount.toFixed(2)} ({amountSent.toFixed(2)} + {transaction.fee.toFixed(2)} in fees)</div>
                                    </div>
                                    {transaction.payment_method === 'Instant Pay By Bank' && <Check size={20} color="#2563eb" />}
                                </div>

                                {/* Credit/Debit Card */}
                                <div
                                    onClick={() => setTransaction({ ...transaction, payment_method: 'Credit/Debit Card' })}
                                    style={{
                                        ...styles.paymentCard,
                                        border: transaction.payment_method === 'Credit/Debit Card' ? '2px solid #2563eb' : '1px solid #e5e7eb'
                                    }}
                                >
                                    <div style={styles.paymentIcon}><CreditCard size={24} /></div>
                                    <div style={{ flex: 1 }}>
                                        <div style={styles.paymentTitle}>Credit/Debit Card</div>
                                        <div style={styles.paymentSub}>You pay GBP {transaction.amount.toFixed(2)} ({amountSent.toFixed(2)} + {transaction.fee.toFixed(2)} in fees)</div>
                                    </div>
                                    {transaction.payment_method === 'Credit/Debit Card' && <Check size={20} color="#2563eb" />}
                                </div>

                                {/* Bank Transfer */}
                                <div
                                    onClick={() => setTransaction({ ...transaction, payment_method: 'Bank Transfer' })}
                                    style={{
                                        ...styles.paymentCard,
                                        border: transaction.payment_method === 'Bank Transfer' ? '2px solid #2563eb' : '1px solid #e5e7eb'
                                    }}
                                >
                                    <div style={styles.paymentIcon}><Building size={24} /></div>
                                    <div style={{ flex: 1 }}>
                                        <div style={styles.paymentTitle}>Bank Transfer <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 400 }}>(Pay within 3 hours)</span></div>
                                        <div style={styles.paymentSub}>You pay GBP {transaction.amount.toFixed(2)} ({amountSent.toFixed(2)} + {transaction.fee.toFixed(2)} in fees)</div>
                                    </div>
                                    {transaction.payment_method === 'Bank Transfer' && <Check size={20} color="#2563eb" />}
                                </div>

                                {/* Wallet */}
                                <div
                                    onClick={() => setTransaction({ ...transaction, payment_method: 'Wallet' })}
                                    style={{
                                        ...styles.paymentCard,
                                        border: transaction.payment_method === 'Wallet' ? '2px solid #2563eb' : '1px solid #e5e7eb'
                                    }}
                                >
                                    <div style={styles.paymentIcon}><Wallet size={24} /></div>
                                    <div style={{ flex: 1 }}>
                                        <div style={styles.paymentTitle}>Wallet</div>
                                        <div style={styles.paymentSub}>Available Balance: 25300.92 GBP</div>
                                        <div style={styles.paymentSub}>You pay GBP {transaction.amount.toFixed(2)} ({amountSent.toFixed(2)} + {transaction.fee.toFixed(2)} in fees)</div>
                                    </div>
                                    {transaction.payment_method === 'Wallet' && <Check size={20} color="#2563eb" />}
                                </div>

                            </div>


                            <div style={{ display: 'flex', gap: 16 }}>
                                <button style={{ ...styles.secondaryBtn, flex: 1 }} onClick={handleBack}>Back</button>
                                <button
                                    style={{ ...styles.primaryBtn, flex: 2, marginTop: 0 }}
                                    onClick={submitTransfer}
                                    disabled={loading}
                                >
                                    {loading ? 'Processing...' : 'Confirm & Pay'}
                                </button>
                            </div>
                        </div>
                    )}

                </div>

                {/* RIGHT SIDEBAR */}
                <div>
                    <SidebarSummary />
                </div>
            </div>
        </div>
    );
};

const styles = {
    pageContainer: { maxWidth: 1100, margin: '0 auto', padding: '40px 20px', fontFamily: "'Inter', sans-serif", color: '#1f2937' },
    header: { marginBottom: 40 },
    backBtn: { border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', padding: 0 },
    stepper: { display: 'flex', alignItems: 'center', fontSize: '0.9rem' },
    mainGrid: { display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: 60 },
    contentArea: { minHeight: 500 },

    // Form Elements
    sectionTitle: { marginBottom: 16, fontSize: '1rem', fontWeight: 600, color: '#374151' },
    input: { width: '100%', padding: '12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: '1rem', outline: 'none', marginBottom: 16, boxSizing: 'border-box' },
    label: { display: 'block', marginBottom: 6, fontSize: '0.9rem', color: '#6b7280' },

    // Amount Specific
    amountInputGroup: { display: 'flex', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden', marginBottom: 24 },
    currencySelector: { background: '#f9fafb', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8, borderRight: '1px solid #e5e7eb', fontWeight: 600 },
    amountInput: { border: 'none', padding: '16px', fontSize: '1.2rem', flex: 1, outline: 'none', fontWeight: 600 },

    methodToggle: { display: 'flex', gap: 12, marginBottom: 32 },
    methodBtn: { flex: 1, padding: '12px', border: '1px solid #e5e7eb', borderRadius: 20, background: 'white', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.9rem' },
    methodBtnActive: { background: '#eff6ff', borderColor: '#2563eb', color: '#2563eb', fontWeight: 500 },

    breakdownBox: { background: '#f9fafb', padding: 20, borderRadius: 8, marginBottom: 24 },

    // Recipient
    searchInput: { width: '100%', padding: '10px 16px', borderRadius: 20, border: '1px solid #e5e7eb', outline: 'none' },
    recipientCard: { display: 'flex', alignItems: 'center', gap: 16, padding: 16, borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s', background: 'white' },
    avatar: { width: 40, height: 40, borderRadius: '50%', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem' },

    // Bank
    bankVerifyBox: { padding: 16, background: '#f9fafb', borderRadius: 8, marginBottom: 32 },

    // Summary
    infoBox: { background: '#dbeafe', color: '#1e40af', padding: 16, borderRadius: 6, fontSize: '0.9rem', marginBottom: 24, lineHeight: 1.5 },
    summaryReview: { marginBottom: 32 },

    // Buttons
    primaryBtn: { width: '100%', background: '#2563eb', color: 'white', padding: '16px', border: 'none', borderRadius: 6, fontSize: '1rem', fontWeight: 600, cursor: 'pointer', marginTop: 12 },
    secondaryBtn: { padding: '10px 20px', border: '1px solid #e5e7eb', borderRadius: 6, background: 'white', color: '#374151', cursor: 'pointer', fontWeight: 500 },

    // Sidebar
    card: { border: '2px solid #2563eb', borderRadius: 8, padding: 24, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' },
    cardHeader: { marginTop: 0, marginBottom: 20, color: '#374151', fontSize: '1.1rem' },
    summaryRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: '0.95rem' },
    separator: { borderTop: '1px solid #e5e7eb', margin: '16px 0' },

    // Payment Method Cards
    paymentCard: { display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 8, cursor: 'pointer', background: 'white', transition: 'all 0.2s' },
    paymentIcon: { color: '#2563eb' },
    paymentTitle: { fontWeight: 600, fontSize: '1rem', color: '#1f2937', marginBottom: 4 },
    paymentSub: { fontSize: '0.85rem', color: '#6b7280' }
};

export default TestCheckout;
