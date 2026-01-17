import React, { useState, useEffect } from 'react';

const CreateDistributionModal = ({ onClose, onSuccess, selectedPromo }) => {
    const [step, setStep] = useState(1);
    const [segments, setSegments] = useState({ new_users: 0, churned_users: 0 });
    const [selectedSegment, setSelectedSegment] = useState('');

    // Auto-fill config if existing promo selected, else default
    const [config, setConfig] = useState(selectedPromo ? { ...selectedPromo, prefix: selectedPromo.code } : {
        prefix: 'OFFER',
        value: 10,
        type: 'Fixed',
        min_threshold: 100,
        currency: 'USD',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
        corridors: [],
        affiliates: []
    });

    const [loading, setLoading] = useState(false);
    const [distributing, setDistributing] = useState(false);

    // Filter states
    const [criteria, setCriteria] = useState({ max_tx: 0, churn_days: 90 });

    useEffect(() => {
        setLoading(true);
        const query = `?max_tx=${criteria.max_tx}&churn_days=${criteria.churn_days}`;
        fetch('/api/segments' + query)
            .then(res => res.json())
            .then(data => {
                setSegments(data.data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [criteria]);

    const handleDistribute = async () => {
        setDistributing(true);
        try {
            const payload = {
                segment: selectedSegment,
                promo_config: config,
                criteria,
                existing_code_id: selectedPromo ? selectedPromo.code : null // Pass existing code identifier
            };
            const res = await fetch('/api/promocodes/distribute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                alert(`Successfully distributed ${selectedPromo ? selectedPromo.code : data.count + ' codes'} to ${data.segment}!`);
                onSuccess();
                onClose();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (err) {
            alert('Distribution failed');
        } finally {
            setDistributing(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div style={{ background: 'white', padding: 32, borderRadius: 12, width: 600, maxWidth: '90%' }}>
                <h2 style={{ marginTop: 0 }}>
                    {selectedPromo ? `Distribute: ${selectedPromo.code}` : 'Targeted Distribution'}
                </h2>

                {step === 1 && (
                    <>
                        <p style={{ color: 'var(--text-muted)' }}>Select a user segment to target.</p>

                        {/* Criteria Filters */}
                        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>NEW USER CRITERIA</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: '0.875rem' }}>Max Transactions:</span>
                                    <input
                                        type="number" min="0"
                                        value={criteria.max_tx}
                                        onChange={e => setCriteria({ ...criteria, max_tx: parseInt(e.target.value) || 0 })}
                                        style={{ width: 60, padding: 4 }}
                                    />
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>CHURN CRITERIA</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: '0.875rem' }}>Inactive Days:</span>
                                    <input
                                        type="number" min="1"
                                        value={criteria.churn_days}
                                        onChange={e => setCriteria({ ...criteria, churn_days: parseInt(e.target.value) || 30 })}
                                        style={{ width: 60, padding: 4 }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                            <div
                                onClick={() => setSelectedSegment('new_users')}
                                style={{
                                    padding: 16, border: selectedSegment === 'new_users' ? '2px solid var(--primary)' : '1px solid #e5e7eb',
                                    borderRadius: 8, cursor: 'pointer', background: selectedSegment === 'new_users' ? '#f0fdf4' : 'white'
                                }}
                            >
                                <div style={{ fontWeight: 600 }}>Create New Users</div>
                                <div style={{ fontSize: '2rem', fontWeight: 700, margin: '8px 0' }}>{loading ? '...' : segments.new_users}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>&le; {criteria.max_tx} Transactions</div>
                            </div>

                            <div
                                onClick={() => setSelectedSegment('churned_users')}
                                style={{
                                    padding: 16, border: selectedSegment === 'churned_users' ? '2px solid var(--primary)' : '1px solid #e5e7eb',
                                    borderRadius: 8, cursor: 'pointer', background: selectedSegment === 'churned_users' ? '#fff7ed' : 'white'
                                }}
                            >
                                <div style={{ fontWeight: 600 }}>Churned Users</div>
                                <div style={{ fontSize: '2rem', fontWeight: 700, margin: '8px 0' }}>{loading ? '...' : segments.churned_users}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Last tx &gt; {criteria.churn_days} days</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <button className="btn-secondary" onClick={onClose}>Cancel</button>
                            <button className="btn-primary"
                                disabled={!selectedSegment}
                                onClick={() => setStep(2)}
                                style={{ opacity: !selectedSegment ? 0.5 : 1, cursor: !selectedSegment ? 'not-allowed' : 'pointer' }}
                            >
                                {selectedPromo ? 'Next: Review & Send' : 'Next: Configure Offer'}
                            </button>
                        </div>
                    </>
                )}

                {step === 2 && (
                    <>
                        {selectedPromo ? (
                            <div style={{ marginBottom: 24 }}>
                                <p style={{ color: 'var(--text-muted)' }}>You are about to distribute the following promo code to <b>{selectedSegment.replace('_', ' ')}</b>.</p>

                                <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: 2 }}>{selectedPromo.code}</div>
                                    <div style={{ marginTop: 8, fontSize: '1.1rem', fontWeight: 500 }}>
                                        {selectedPromo.type === 'Fixed' ? `${selectedPromo.currency} ${selectedPromo.value} OFF` :
                                            selectedPromo.type === 'Percentage' ? `${selectedPromo.value}% OFF` :
                                                `${selectedPromo.value} Rate Boost`}
                                    </div>
                                    <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                        Min Transfer: {selectedPromo.min_threshold > 0 ? `${selectedPromo.currency} ${selectedPromo.min_threshold}` : 'None'}
                                    </div>
                                </div>

                                <div style={{ marginTop: 16, padding: 12, background: '#fff7ed', borderRadius: 6, fontSize: '0.9rem', color: '#9a3412' }}>
                                    <b>Note:</b> This will send the exact code <b>{selectedPromo.code}</b> to all users in the segment. It will NOT create unique codes.
                                </div>
                            </div>
                        ) : (
                            // Existing form for New Unique Codes
                            <>
                                <p style={{ color: 'var(--text-muted)' }}>Configure the unique code parameters for {selectedSegment.replace('_', ' ')}.</p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Code Prefix</label>
                                        <input
                                            type="text"
                                            value={config.prefix}
                                            onChange={e => setConfig({ ...config, prefix: e.target.value })}
                                            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Discount Type</label>
                                        <select
                                            value={config.type}
                                            onChange={e => setConfig({ ...config, type: e.target.value })}
                                            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}
                                        >
                                            <option value="Fixed">Fixed Amount</option>
                                            <option value="Percentage">Percentage</option>
                                            <option value="Waiver">Fee Waiver</option>
                                            <option value="FX_BOOST">FX Rate Boost</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Value</label>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            {config.type === 'Fixed' && (
                                                <select
                                                    value={config.currency}
                                                    onChange={e => setConfig({ ...config, currency: e.target.value })}
                                                    style={{ width: 80, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, background: '#f9fafb' }}
                                                >
                                                    <option value="USD">USD</option>
                                                    <option value="GBP">GBP</option>
                                                    <option value="NGN">NGN</option>
                                                    <option value="EUR">EUR</option>
                                                </select>
                                            )}
                                            <input
                                                type="number"
                                                value={config.value}
                                                onChange={e => setConfig({ ...config, value: parseFloat(e.target.value) })}
                                                style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Min Transfer Threshold</label>
                                        <input
                                            type="number"
                                            value={config.min_threshold}
                                            onChange={e => setConfig({ ...config, min_threshold: parseFloat(e.target.value) })}
                                            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}
                                        />
                                    </div>
                                </div>

                                <div style={{ background: '#f9fafb', padding: 16, borderRadius: 8, marginBottom: 24, border: '1px dashed #d1d5db' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>EMAIL PREVIEW</div>
                                    <div style={{ fontFamily: 'serif', lineHeight: 1.5 }}>
                                        <p>Hi [User Name],</p>
                                        <p>We miss you! Here is an exclusive offer just for you.</p>
                                        <div style={{ background: 'white', border: '1px solid #e5e7eb', padding: 12, textAlign: 'center', margin: '16px 0', fontSize: '1.25rem', fontWeight: 700, letterSpacing: 1 }}>
                                            {config.prefix}XB82A
                                        </div>
                                        <p>Use this code to get <b>
                                            {config.type === 'Fixed' && `${config.currency} ${config.value} off`}
                                            {config.type === 'Percentage' && `${config.value}% off`}
                                            {config.type === 'Waiver' && `Zero Fees`}
                                            {config.type === 'FX_BOOST' && `+${config.value} Rate Boost`}
                                        </b> your next transfer{config.min_threshold > 0 ? ` of ${config.currency} ${config.min_threshold}+` : ''}.</p>
                                    </div>
                                </div>
                            </>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <button className="btn-secondary" onClick={() => setStep(1)}>Back</button>
                            <button className="btn-primary" onClick={handleDistribute} disabled={distributing}>
                                {distributing ? 'Sending...' : 'Send Blast 🚀'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};


const MultiSelectField = ({ label, options, selected, onChange, allowAll = false }) => {
    const toggle = (val) => {
        if (selected.includes(val)) {
            onChange(selected.filter(i => i !== val));
        } else {
            onChange([...selected, val]);
        }
    };

    const isAll = allowAll && selected.length === 0;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</label>
                {allowAll && (
                    <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={isAll}
                            onChange={(e) => {
                                if (e.target.checked) onChange([]);
                            }}
                        />
                        Valid for All
                    </label>
                )}
            </div>

            {isAll ? (
                <div style={{ padding: 12, border: '1px dashed #d1d5db', borderRadius: 8, background: '#f9fafb', color: '#6b7280', fontSize: '0.85rem', textAlign: 'center' }}>
                    Valid for all affiliates
                </div>
            ) : (
                <div style={{
                    border: '1px solid #d1d5db', borderRadius: '8px', padding: 8,
                    maxHeight: '120px', overflowY: 'auto', background: 'white'
                }}>
                    {options.map(opt => (
                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <input
                                type="checkbox"
                                checked={selected.includes(opt)}
                                onChange={() => toggle(opt)}
                                style={{ accentColor: 'var(--primary)' }}
                            />
                            {opt}
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

const AVAILABLE_AFFILIATES = ['Global Tech Ltd', 'Lagos Logistics', 'Alpha Traders', 'John Doe Logistics', 'Test User'];

export default CreateDistributionModal;
