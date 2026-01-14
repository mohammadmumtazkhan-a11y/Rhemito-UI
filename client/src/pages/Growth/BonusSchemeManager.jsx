import React, { useState, useEffect } from 'react';

const BonusSchemeManager = () => {
    const [schemes, setSchemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        bonus_type: 'LOYALTY_CREDIT',
        credit_amount: 10,
        currency: 'GBP',
        min_transaction_threshold: 50,
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
                            </select>
                        </div>
                    </div>

                    {/* Credit Amount & Threshold */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                        <div>
                            <label style={labelStyle}>Minimum Transaction Threshold (Send Currency)</label>
                            <input
                                type="number"
                                step="10"
                                style={{ ...inputStyle, marginBottom: 0 }}
                                value={formData.min_transaction_threshold}
                                onChange={(e) => setFormData({ ...formData, min_transaction_threshold: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                    </div>

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
                        <select
                            style={{ ...inputStyle, marginBottom: 0 }}
                            value={formData.eligibility_rules.segments[0] || 'all'}
                            onChange={(e) => setFormData({
                                ...formData,
                                eligibility_rules: { ...formData.eligibility_rules, segments: [e.target.value] }
                            })}
                        >
                            <option value="all">All Users</option>
                            <option value="new_users">New Users Only</option>
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
            </div>

            {/* Table */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
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
                                            {scheme.currency || 'GBP'} {scheme.credit_amount.toFixed(2)}
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
            </div>
        </div>
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
