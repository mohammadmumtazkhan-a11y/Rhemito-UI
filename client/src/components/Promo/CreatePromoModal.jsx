import React, { useState } from 'react';

const CreatePromoModal = ({ onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        code: '',
        type: 'Fixed',
        value: '',
        min_threshold: '',
        max_discount: '',
        currency: 'USD',
        usage_limit_global: '',
        budget_limit: '',
        usage_limit_per_user: 1,
        start_date: '',
        end_date: '',
        corridors: [], // 'GBP-NGN', 'USD-INR'
        payment_methods: [], // 'Bank Transfer', 'Card'
        affiliates: [], // 'Global Tech'
        user_segment: { type: 'all' },
        user_segment_criteria: { max_tx: 0, churn_days: 90 }
    });

    // UI States for toggling restrictions
    const [restrictCorridors, setRestrictCorridors] = useState(false);
    const [restrictAffiliates, setRestrictAffiliates] = useState(false);
    const [restrictPaymentMethods, setRestrictPaymentMethods] = useState(false); // Optional, but consistent

    const handleChange = (e) => {
        const { name, value } = e.target;
        // Clear value field when Fee Waiver is selected
        if (name === 'type' && value === 'Waiver') {
            setFormData(prev => ({ ...prev, [name]: value, value: '' }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                value: parseFloat(formData.value),
                min_threshold: parseFloat(formData.min_threshold) || 0,
                max_discount: parseFloat(formData.max_discount),
                usage_limit_global: formData.usage_limit_global ? parseInt(formData.usage_limit_global) : -1,
                budget_limit: formData.budget_limit ? parseFloat(formData.budget_limit) : -1,
                usage_limit_per_user: parseInt(formData.usage_limit_per_user),
                restrictions: {
                    corridors: formData.corridors,
                    payment_methods: formData.payment_methods,
                    affiliates: formData.affiliates,
                    user_segment: formData.user_segment // Add user_segment to restrictions
                },
                user_segment_criteria: formData.user_segment_criteria // Add user_segment_criteria to payload
            };

            const res = await fetch('/api/promocodes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                onSuccess();
                onClose();
            } else {
                alert(data.error || 'Failed to create promo code');
            }
        } catch (err) {
            console.error(err);
            alert(`Error creating promo code: ${err.message}`);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="glass-panel" style={{ width: '600px', maxHeight: '90vh', overflowY: 'auto', padding: 32, background: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                    <h2 style={{ margin: 0 }}>Create Promo Code</h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Promo Code</label>
                            <input name="code" value={formData.code} onChange={handleChange} required style={inputStyle} placeholder="e.g. SAVE20" />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Type</label>
                            <select name="type" value={formData.type} onChange={handleChange} style={inputStyle}>
                                <option value="Fixed">Fixed Amount</option>
                                <option value="Percentage">Percentage</option>
                                <option value="Waiver">Fee Waiver</option>
                                <option value="FX_BOOST">FX Rate Boost</option>
                                <option value="BONUS_CREDIT">Bonus Credit</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Value</label>
                            <input
                                name="value"
                                type="number"
                                step="0.01"
                                value={formData.type === 'Waiver' ? '' : formData.value}
                                onChange={handleChange}
                                required={formData.type !== 'Waiver'}
                                disabled={formData.type === 'Waiver'}
                                style={{
                                    ...inputStyle,
                                    background: formData.type === 'Waiver' ? '#f3f4f6' : 'white',
                                    cursor: formData.type === 'Waiver' ? 'not-allowed' : 'auto',
                                    opacity: formData.type === 'Waiver' ? 0.6 : 1
                                }}
                                placeholder={formData.type === 'Waiver' ? 'N/A for Fee Waiver' : '0.00'}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Currency (Base)</label>
                            <select name="currency" value={formData.currency} onChange={handleChange} style={inputStyle}>
                                <option value="USD">USD</option>
                                <option value="GBP">GBP</option>
                                <option value="NGN">NGN</option>
                            </select>
                        </div>
                    </div>

                    {formData.type === 'Percentage' && (
                        <div>
                            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Max Discount Cap (Optional)</label>
                            <input name="max_discount" type="number" step="0.01" value={formData.max_discount} onChange={handleChange} style={inputStyle} placeholder="Max amount" />
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Minimum Transaction Amount</label>
                        <input name="min_threshold" type="number" step="0.01" value={formData.min_threshold} onChange={handleChange} style={inputStyle} placeholder="Leave empty for none" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Global Usage Limit (Count)</label>
                            <input name="usage_limit_global" type="number" value={formData.usage_limit_global} onChange={handleChange} style={inputStyle} placeholder="Total Redemptions" />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Total Budget Cap (Amount)</label>
                            <input name="budget_limit" type="number" step="0.01" value={formData.budget_limit} onChange={handleChange} style={inputStyle} placeholder="Total Discount Value" />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Limit Per User</label>
                            <input name="usage_limit_per_user" type="number" value={formData.usage_limit_per_user} onChange={handleChange} style={inputStyle} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Start Date</label>
                            <input name="start_date" type="datetime-local" value={formData.start_date} onChange={handleChange} required style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem', color: 'var(--text-muted)' }}>End Date</label>
                            <input name="end_date" type="datetime-local" value={formData.end_date} onChange={handleChange} required style={inputStyle} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div style={{ padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 8, background: '#f8fafc' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <label style={{ display: 'block', margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Allowed Corridors</label>
                                <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={!restrictCorridors}
                                        onChange={(e) => {
                                            const isAll = e.target.checked;
                                            setRestrictCorridors(!isAll);
                                            if (isAll) setFormData(prev => ({ ...prev, corridors: [] }));
                                        }}
                                    />
                                    All Corridors
                                </label>
                            </div>

                            {!restrictCorridors ? (
                                <div style={{ padding: 12, border: '1px dashed var(--border-subtle)', borderRadius: 8, background: '#f8fafc', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                                    Valid for all corridors
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                        <select id="sendCurr" style={compactInputStyle}>
                                            <option value="USD">USD</option>
                                            <option value="GBP">GBP</option>
                                            <option value="EUR">EUR</option>
                                            <option value="CAD">CAD</option>
                                        </select>
                                        <span style={{ alignSelf: 'center', color: 'var(--text-muted)' }}>→</span>
                                        <select id="recvCurr" style={compactInputStyle}>
                                            <option value="NGN">NGN</option>
                                            <option value="GHS">GHS</option>
                                            <option value="KES">KES</option>
                                            <option value="INR">INR</option>
                                        </select>
                                        <button type="button" className="btn-secondary" style={{ padding: '6px 10px' }} onClick={() => {
                                            const send = document.getElementById('sendCurr').value;
                                            const recv = document.getElementById('recvCurr').value;
                                            const pair = `${send}-${recv}`;
                                            if (!formData.corridors.includes(pair)) {
                                                setFormData(prev => ({ ...prev, corridors: [...prev.corridors, pair] }));
                                            }
                                        }}>Add</button>
                                    </div>

                                    {formData.corridors.length === 0 && (
                                        <div style={{ padding: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>No allowed corridors (Promo will not apply to any)</div>
                                    )}

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {formData.corridors.map(c => (
                                            <div key={c} style={{
                                                display: 'flex', alignItems: 'center', gap: 6,
                                                background: 'white', border: '1px solid var(--border-subtle)',
                                                padding: '4px 8px', borderRadius: 4, fontSize: '0.85rem'
                                            }}>
                                                <span>{c}</span>
                                                <button type="button" onClick={() => setFormData(prev => ({ ...prev, corridors: prev.corridors.filter(x => x !== c) }))}
                                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                                                    &times;
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        <MultiSelectField
                            label="Allowed Affiliates/Users"
                            options={AVAILABLE_AFFILIATES}
                            selected={formData.affiliates}
                            onChange={(vals) => setFormData(prev => ({ ...prev, affiliates: vals }))}
                            allowAll={true}
                            isRestricted={restrictAffiliates}
                            onToggleRestriction={(val) => {
                                setRestrictAffiliates(val);
                                if (!val) setFormData(prev => ({ ...prev, affiliates: [] }));
                            }}
                        />

                        <MultiSelectField
                            label="Allowed Payment Methods"
                            options={AVAILABLE_PAYMENT_METHODS}
                            selected={formData.payment_methods}
                            onChange={(vals) => setFormData(prev => ({ ...prev, payment_methods: vals }))}
                        />
                    </div>

                    <div style={{ marginTop: 16 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem', color: 'var(--text-muted)' }}>User Segment</label>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                            <select
                                style={inputStyle}
                                value={formData.user_segment.type}
                                onChange={e => setFormData({
                                    ...formData,
                                    user_segment: { type: e.target.value }
                                })}
                            >
                                <option value="all">All Users</option>
                                <option value="new">New Users Only</option>
                                <option value="churned">Churned Users Only</option>
                            </select>

                            {formData.user_segment.type === 'new' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: '0.85rem' }}>Max Txs:</span>
                                    <input
                                        type="number" min="0" style={{ ...compactInputStyle, width: 60 }}
                                        value={formData.user_segment_criteria.max_tx}
                                        onChange={e => setFormData({
                                            ...formData,
                                            user_segment_criteria: { ...formData.user_segment_criteria, max_tx: parseInt(e.target.value) || 0 }
                                        })}
                                    />
                                </div>
                            )}

                            {formData.user_segment.type === 'churned' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: '0.85rem' }}>Inactive Days:</span>
                                    <input
                                        type="number" min="1" style={{ ...compactInputStyle, width: 60 }}
                                        value={formData.user_segment_criteria.churn_days}
                                        onChange={e => setFormData({
                                            ...formData,
                                            user_segment_criteria: { ...formData.user_segment_criteria, churn_days: parseInt(e.target.value) || 30 }
                                        })}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ marginTop: 16 }}>
                        <button type="submit" className="btn-primary" style={{ width: '100%' }}>Create Promo Code</button>
                    </div>
                </form>
            </div >
        </div >
    );
};

const MultiSelectField = ({ label, options, selected, onChange, allowAll = false, isRestricted = null, onToggleRestriction = null }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const toggle = (val) => {
        if (selected.includes(val)) {
            onChange(selected.filter(i => i !== val));
        } else {
            onChange([...selected, val]);
        }
    };

    // Use internal state if props not provided
    const [localRestricted, setLocalRestricted] = useState(selected.length > 0);
    const restricted = isRestricted !== null ? isRestricted : localRestricted;
    const isAll = allowAll && !restricted;

    const handleAllToggle = (e) => {
        const checked = e.target.checked;
        if (onToggleRestriction) {
            onToggleRestriction(!checked);
        } else {
            setLocalRestricted(!checked);
            if (checked) onChange([]);
        }
    };

    // Filter options based on search term
    const filteredOptions = searchTerm
        ? options.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()))
        : options;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>{label}</label>
                {allowAll && (
                    <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={isAll}
                            onChange={handleAllToggle}
                        />
                        Valid for All
                    </label>
                )}
            </div>

            {isAll ? (
                <div style={{ padding: 12, border: '1px dashed var(--border-subtle)', borderRadius: 8, background: '#f8fafc', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                    Valid for all
                </div>
            ) : (
                <div style={{
                    border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: 8,
                    maxHeight: '120px', overflowY: 'auto', background: 'white'
                }}>
                    {/* Search Input */}
                    <div style={{ marginBottom: 8 }}>
                        <input
                            type="text"
                            placeholder="Search affiliates..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '6px 10px',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '6px',
                                fontSize: '0.85rem',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{ padding: '4px', borderBottom: '1px solid #f3f4f6', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                            type="checkbox"
                            checked={filteredOptions.every(o => selected.includes(o))}
                            onChange={(e) => {
                                if (e.target.checked) onChange([...new Set([...selected, ...filteredOptions])]);
                                else onChange(selected.filter(s => !filteredOptions.includes(s)));
                            }}
                        />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Select All</span>
                    </div>
                    {filteredOptions.map(opt => (
                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <input
                                type="checkbox"
                                checked={selected.includes(opt)}
                                onChange={() => toggle(opt)}
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
const AVAILABLE_PAYMENT_METHODS = ['Bank Transfer', 'Card', 'Mobile Money', 'USSD'];

const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    background: 'white',
    border: '1px solid var(--border-subtle)',
    borderRadius: '8px',
    color: 'var(--text-main)',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box'
};

const compactInputStyle = {
    flex: 1,
    padding: '6px 8px',
    background: 'white',
    border: '1px solid var(--border-subtle)',
    borderRadius: '6px',
    color: 'var(--text-main)',
    fontSize: '0.85rem',
    outline: 'none'
};

export default CreatePromoModal;
