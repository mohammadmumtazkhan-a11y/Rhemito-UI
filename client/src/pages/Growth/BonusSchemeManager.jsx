import React, { useState, useEffect } from 'react';

const BonusSchemeManager = () => {
    const [schemes, setSchemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [newTier, setNewTier] = useState({ min: '', max: '', value: '' });

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        bonus_type: 'LOYALTY_CREDIT',
        credit_amount: 10,
        currency: 'GBP',
        min_transaction_threshold: 50,
        min_transactions: 3,
        time_period_days: 30,
        commission_type: 'FIXED',
        commission_percentage: 0,
        is_tiered: false,
        tiers: [],
        eligibility_rules: {
            corridors: [],
            paymentMethods: [],
            affiliates: [],
            segments: []
        },
        start_date: '',
        end_date: '',
        status: 'ACTIVE'
    });

    useEffect(() => {
        fetchSchemes();
    }, []);

    const fetchSchemes = async () => {
        try {
            const res = await fetch('/api/bonus-schemes');
            const data = await res.json();
            setSchemes(data.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);

        // FRD Validation (Section 3.1)
        if (!formData.start_date || !formData.end_date) {
            alert('Please provide both start and end dates');
            setSaving(false);
            return;
        }

        if (new Date(formData.start_date) >= new Date(formData.end_date)) {
            alert('Start date must be before end date');
            setSaving(false);
            return;
        }

        // Tier Validation
        if (formData.is_tiered && formData.tiers.length === 0) {
            alert('Please add at least one tier for tiered commission');
            setSaving(false);
            return;
        }

        try {
            let response;
            if (editingId) {
                response = await fetch(`/api/bonus-schemes/${editingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
            } else {
                response = await fetch('/api/bonus-schemes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
            }

            const data = await response.json();

            if (!response.ok) {
                alert(`Error: ${data.error}`);
                setSaving(false);
                return;
            }

            alert(editingId ? 'Scheme updated successfully' : 'Scheme created successfully');
            resetForm();
            fetchSchemes();
        } catch (err) {
            alert('Network error');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (scheme) => {
        setFormData({
            name: scheme.name,
            bonus_type: scheme.bonus_type,
            credit_amount: scheme.credit_amount,
            currency: scheme.currency || 'GBP',
            min_transaction_threshold: scheme.min_transaction_threshold,
            min_transactions: scheme.min_transactions || 0,
            time_period_days: scheme.time_period_days || 0,
            commission_type: scheme.commission_type || 'FIXED',
            commission_percentage: scheme.commission_percentage || 0,
            is_tiered: !!scheme.is_tiered,
            tiers: scheme.tiers || [],
            eligibility_rules: scheme.eligibility_rules,
            start_date: scheme.start_date,
            end_date: scheme.end_date,
            status: scheme.status
        });
        setEditingId(scheme.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this bonus scheme?')) return;

        try {
            await fetch(`/api/bonus-schemes/${id}`, { method: 'DELETE' });
            alert('Scheme deleted');
            fetchSchemes();
        } catch (err) {
            alert('Error deleting scheme');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            bonus_type: 'LOYALTY_CREDIT',
            credit_amount: 10,
            currency: 'GBP',
            min_transaction_threshold: 50,
            min_transactions: 3,
            time_period_days: 30,
            commission_type: 'FIXED',
            commission_percentage: 0,
            is_tiered: false,
            tiers: [],
            eligibility_rules: { corridors: [], paymentMethods: [], affiliates: [], segments: [] },
            start_date: '',
            end_date: '',
            status: 'ACTIVE'
        });
        setEditingId(null);
    };

    const inputStyle = {
        width: '100%',
        padding: '10px 12px',
        background: 'white',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        fontSize: '0.9rem',
        outline: 'none',
        marginBottom: '16px',
        boxSizing: 'border-box'
    };

    const labelStyle = {
        display: 'block',
        marginBottom: '6px',
        fontSize: '0.875rem',
        color: 'var(--text-muted)',
        fontWeight: 500
    };

    if (loading) return <div className="p-8">Loading...</div>;

    return (
        <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 600, marginBottom: 8 }}>Bonus Scheme Manager</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>Configure and manage bonus credit earning rules</p>

            {/* Form */}
            <div className="glass-panel" style={{ padding: 32, marginBottom: 32 }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 20 }}>
                    {editingId ? 'Edit Bonus Scheme' : 'Create New Scheme'}
                </h3>

                <form onSubmit={handleSubmit}>
                    {/* Name & Type */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>
                        <div>
                            <label style={labelStyle}>Bonus Name *</label>
                            <input
                                style={inputStyle}
                                placeholder="e.g. Transaction Threshold Credit"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Bonus Type *</label>
                            <select
                                style={inputStyle}
                                value={formData.bonus_type}
                                onChange={(e) => setFormData({ ...formData, bonus_type: e.target.value })}
                                required
                            >
                                <option value="LOYALTY_CREDIT">Loyalty Credit</option>
                                <option value="TRANSACTION_THRESHOLD_CREDIT">Transaction Threshold Credit</option>
                                <option value="REQUEST_MONEY">Request Money Credit</option>
                            </select>
                        </div>
                    </div>

                    {/* Commission Type & Mode */}
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 16 }}>
                            <div>
                                <label style={labelStyle}>Commission Type *</label>
                                <select
                                    style={inputStyle}
                                    value={formData.commission_type || 'FIXED'}
                                    onChange={(e) => setFormData({ ...formData, commission_type: e.target.value })}
                                    required
                                >
                                    <option value="FIXED">Fixed Amount</option>
                                    <option value="PERCENTAGE">Percentage (%)</option>
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Structure</label>
                                <div style={{ display: 'flex', alignItems: 'center', height: '42px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.is_tiered}
                                            onChange={(e) => setFormData({ ...formData, is_tiered: e.target.checked })}
                                            style={{ width: 16, height: 16 }}
                                        />
                                        Enable Tiered Commission (Threshold Ranges)
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Tiered UI */}
                        {formData.is_tiered ? (
                            <div style={{ background: '#f9fafb', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb' }}>
                                <label style={{ ...labelStyle, marginBottom: 12 }}>Commission Tiers</label>

                                {/* Existing Tiers List */}
                                {formData.tiers.length > 0 && (
                                    <div style={{ marginBottom: 16 }}>
                                        {formData.tiers.map((tier, idx) => (
                                            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, fontSize: '0.9rem' }}>
                                                <span style={{ fontWeight: 500, width: 24 }}>{idx + 1}.</span>
                                                <span style={{ background: 'white', padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db' }}>
                                                    {tier.min} - {tier.max}
                                                </span>
                                                <span>→</span>
                                                <span style={{ fontWeight: 600, color: '#059669' }}>
                                                    {formData.commission_type === 'PERCENTAGE' ? `${tier.value}%` : `${formData.currency} ${tier.value}`}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newTiers = [...formData.tiers];
                                                        newTiers.splice(idx, 1);
                                                        setFormData({ ...formData, tiers: newTiers });
                                                    }}
                                                    style={{ marginLeft: 'auto', color: '#dc2626', cursor: 'pointer', background: 'none', border: 'none' }}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add New Tier */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Min Amount</label>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={newTier.min}
                                            onChange={(e) => setNewTier({ ...newTier, min: e.target.value })}
                                            style={{ ...inputStyle, marginBottom: 0, padding: '8px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Max Amount</label>
                                        <input
                                            type="number"
                                            placeholder="Inf"
                                            value={newTier.max}
                                            onChange={(e) => setNewTier({ ...newTier, max: e.target.value })}
                                            style={{ ...inputStyle, marginBottom: 0, padding: '8px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                            {formData.commission_type === 'PERCENTAGE' ? 'Percentage (%)' : 'Amount'}
                                        </label>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={newTier.value}
                                            onChange={(e) => setNewTier({ ...newTier, value: e.target.value })}
                                            style={{ ...inputStyle, marginBottom: 0, padding: '8px' }}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!newTier.min || !newTier.value) return;
                                            // Basic validation
                                            const min = parseFloat(newTier.min);
                                            const max = newTier.max ? parseFloat(newTier.max) : Infinity;
                                            const val = parseFloat(newTier.value);

                                            setFormData({
                                                ...formData,
                                                tiers: [...formData.tiers, { min, max, value: val }].sort((a, b) => a.min - b.min)
                                            });
                                            setNewTier({ min: '', max: '', value: '' });
                                        }}
                                        style={{ ...inputStyle, marginBottom: 0, width: 'auto', background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                                    >
                                        Add
                                    </button>
                                </div>
                                <div style={{ marginTop: 8 }}>
                                    <label style={labelStyle}>Currency For Tiers</label>
                                    <select
                                        style={{ ...inputStyle, marginBottom: 0 }}
                                        value={formData.currency}
                                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                        disabled={formData.commission_type === 'PERCENTAGE'} // Currency matters less for %, but usually base currency
                                    >
                                        <option value="GBP">GBP (£)</option>
                                        <option value="USD">USD ($)</option>
                                        <option value="EUR">EUR (€)</option>
                                        <option value="NGN">NGN (₦)</option>
                                    </select>
                                </div>
                            </div>
                        ) : (
                            /* Simple (Non-Tiered) UI */
                            <>
                                {formData.commission_type === 'PERCENTAGE' ? (
                                    <div>
                                        <label style={labelStyle}>Commission Percentage *</label>
                                        <div style={{ position: 'relative', marginBottom: 24 }}>
                                            <input
                                                type="number"
                                                step="0.01"
                                                style={{ ...inputStyle, marginBottom: 0, paddingRight: 30 }}
                                                value={formData.commission_percentage || ''}
                                                onChange={(e) => setFormData({ ...formData, commission_percentage: parseFloat(e.target.value) || 0 })}
                                                required
                                                min="0.01"
                                                max="100"
                                                placeholder="e.g. 5.0"
                                            />
                                            <span style={{ position: 'absolute', right: 10, top: 10, color: '#6b7280' }}>%</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                                        <div>
                                            <label style={labelStyle}>Credit Amount *</label>
                                            <input
                                                type="number"
                                                step="0.50"
                                                style={{ ...inputStyle, marginBottom: 0 }}
                                                value={formData.credit_amount}
                                                onChange={(e) => setFormData({ ...formData, credit_amount: parseFloat(e.target.value) || 0 })}
                                                required
                                                min="0.01"
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Currency *</label>
                                            <select
                                                style={{ ...inputStyle, marginBottom: 0 }}
                                                value={formData.currency}
                                                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                                required
                                            >
                                                <option value="GBP">GBP (£)</option>
                                                <option value="USD">USD ($)</option>
                                                <option value="EUR">EUR (€)</option>
                                                <option value="NGN">NGN (₦)</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {/* Conditional: Show for Transaction Threshold Credit OR Request Money (Simple Mode) */}
                                {(formData.bonus_type === 'TRANSACTION_THRESHOLD_CREDIT' || formData.bonus_type === 'REQUEST_MONEY') && (
                                    <div style={{ marginBottom: 24 }}>
                                        <label style={labelStyle}>
                                            {formData.bonus_type === 'REQUEST_MONEY'
                                                ? 'Minimum Requested Amount'
                                                : 'Minimum Transaction Threshold (Send Currency)'}
                                        </label>
                                        <input
                                            type="number"
                                            step="10"
                                            style={{ ...inputStyle, marginBottom: 0 }}
                                            value={formData.min_transaction_threshold}
                                            onChange={(e) => setFormData({ ...formData, min_transaction_threshold: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Conditional: Show for Loyalty Credit */}
                    {formData.bonus_type === 'LOYALTY_CREDIT' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label style={labelStyle}>Number of Transactions *</label>
                                <input
                                    type="number"
                                    step="1"
                                    style={{ ...inputStyle, marginBottom: 0 }}
                                    value={formData.min_transactions}
                                    onChange={(e) => setFormData({ ...formData, min_transactions: parseInt(e.target.value) || 0 })}
                                    required
                                    min="1"
                                    placeholder="e.g., 3"
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Time Period (Days) *</label>
                                <input
                                    type="number"
                                    step="1"
                                    style={{ ...inputStyle, marginBottom: 0 }}
                                    value={formData.time_period_days}
                                    onChange={(e) => setFormData({ ...formData, time_period_days: parseInt(e.target.value) || 0 })}
                                    required
                                    min="1"
                                    placeholder="e.g., 30"
                                />
                            </div>
                        </div>
                    )}

                    {/* Validity Period */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginBottom: 24 }}>
                        <div>
                            <label style={labelStyle}>Start Date *</label>
                            <input
                                type="date"
                                style={{ ...inputStyle, marginBottom: 0 }}
                                value={formData.start_date}
                                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>End Date *</label>
                            <input
                                type="date"
                                style={{ ...inputStyle, marginBottom: 0 }}
                                value={formData.end_date}
                                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Status</label>
                            <select
                                style={{ ...inputStyle, marginBottom: 0 }}
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            >
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                                <option value="EXPIRED">Expired</option>
                            </select>
                        </div>
                    </div>

                    {/* Eligibility Rules - Simplified for now */}
                    <div style={{ marginBottom: 24 }}>
                        <label style={labelStyle}>Eligibility Rules (User Segments)</label>
                        {formData.bonus_type === 'LOYALTY_CREDIT' && (
                            <div style={{ fontSize: '0.85rem', color: '#ea580c', background: '#fff7ed', padding: '8px 12px', borderRadius: 6, marginBottom: 8, fontWeight: 500 }}>
                                ⓘ Loyalty Credit is only for Existing Customers
                            </div>
                        )}
                        <select
                            style={{ ...inputStyle, marginBottom: 0 }}
                            value={formData.bonus_type === 'LOYALTY_CREDIT' ? 'existing_customers' : (formData.eligibility_rules.segments[0] || 'all')}
                            onChange={(e) => setFormData({
                                ...formData,
                                eligibility_rules: { ...formData.eligibility_rules, segments: [e.target.value] }
                            })}
                            disabled={formData.bonus_type === 'LOYALTY_CREDIT'}
                        >
                            <option value="all">All Users</option>
                            <option value="new_users">New Users Only</option>
                            <option value="existing_customers">Existing Customers</option>
                            <option value="churned_users">Churned Users</option>
                            <option value="high_value">High Value Users</option>
                        </select>
                    </div>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                        {editingId && (
                            <button type="button" className="btn-secondary" onClick={resetForm}>
                                Cancel
                            </button>
                        )}
                        <button type="submit" className="btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : editingId ? 'Update Scheme' : 'Create Scheme'}
                        </button>
                    </div>
                </form>
            </div >

            {/* Table */}
            < div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 24, borderBottom: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Existing Bonus Schemes</h3>
                </div>
                <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead>
                            <tr style={{ background: 'linear-gradient(to bottom, #f9fafb, #f3f4f6)', borderBottom: '2px solid var(--border-subtle)' }}>
                                <th style={tableHeaderStyle}>Scheme Name</th>
                                <th style={tableHeaderStyle}>Type</th>
                                <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Credit Amount</th>
                                <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Min Threshold</th>
                                <th style={tableHeaderStyle}>Validity Period</th>
                                <th style={tableHeaderStyle}>Status</th>
                                <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {schemes.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                                        No bonus schemes found. Create your first scheme above.
                                    </td>
                                </tr>
                            ) : (
                                schemes.map((scheme, index) => (
                                    <tr
                                        key={scheme.id}
                                        style={{ borderBottom: index < schemes.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.2s' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#fafbfc'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ ...tableCellStyle, fontWeight: 600 }}>{scheme.name}</td>
                                        <td style={tableCellStyle}>
                                            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                                {scheme.bonus_type.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                                            {scheme.is_tiered ? (
                                                <span style={{ fontSize: '0.8rem', color: '#7c3aed', background: '#f5f3ff', padding: '2px 6px', borderRadius: 4 }}>
                                                    Tiered ({scheme.tiers?.length})
                                                </span>
                                            ) : scheme.commission_type === 'PERCENTAGE' ? (
                                                `${scheme.commission_percentage}%`
                                            ) : (
                                                `${scheme.currency || 'GBP'} ${scheme.credit_amount.toFixed(2)}`
                                            )}
                                        </td>
                                        <td style={{ ...tableCellStyle, textAlign: 'right', color: '#6b7280' }}>
                                            {scheme.min_transaction_threshold.toFixed(2)}
                                        </td>
                                        <td style={tableCellStyle}>
                                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                {new Date(scheme.start_date).toLocaleDateString('en-GB')} -<br />
                                                {new Date(scheme.end_date).toLocaleDateString('en-GB')}
                                            </div>
                                        </td>
                                        <td style={tableCellStyle}>
                                            <span style={{
                                                padding: '4px 12px',
                                                borderRadius: 12,
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                background: scheme.status === 'ACTIVE' ? '#d1fae5' : scheme.status === 'EXPIRED' ? '#fee2e2' : '#f3f4f6',
                                                color: scheme.status === 'ACTIVE' ? '#065f46' : scheme.status === 'EXPIRED' ? '#991b1b' : '#6b7280'
                                            }}>
                                                {scheme.status}
                                            </span>
                                        </td>
                                        <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                                <button
                                                    onClick={() => handleEdit(scheme)}
                                                    style={editButtonStyle}
                                                    onMouseEnter={(e) => { e.target.style.background = '#f9fafb'; }}
                                                    onMouseLeave={(e) => { e.target.style.background = 'white'; }}
                                                >
                                                    ✏️ Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(scheme.id)}
                                                    style={deleteButtonStyle}
                                                    onMouseEnter={(e) => { e.target.style.background = '#fee2e2'; }}
                                                    onMouseLeave={(e) => { e.target.style.background = '#fef2f2'; }}
                                                >
                                                    🗑️ Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div >
        </div >
    );
};

const tableHeaderStyle = {
    padding: '14px 16px',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    textAlign: 'left',
    whiteSpace: 'nowrap'
};

const tableCellStyle = {
    padding: '16px',
    fontSize: '0.875rem',
    color: '#374151',
    verticalAlign: 'middle'
};

const editButtonStyle = {
    padding: '6px 14px',
    fontSize: '0.8rem',
    fontWeight: 600,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: 'white',
    color: '#374151',
    cursor: 'pointer',
    transition: 'all 0.2s'
};

const deleteButtonStyle = {
    padding: '6px 14px',
    fontSize: '0.8rem',
    fontWeight: 600,
    border: '1px solid #fecaca',
    borderRadius: 6,
    background: '#fef2f2',
    color: '#dc2626',
    cursor: 'pointer',
    transition: 'all 0.2s'
};

export default BonusSchemeManager;
