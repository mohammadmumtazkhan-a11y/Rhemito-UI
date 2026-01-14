import React, { useState, useEffect } from 'react';

// Searchable Currency Selector Component
const CurrencySelector = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const currencies = [
        { code: 'GBP', name: 'United Kingdom', symbol: '£' },
        { code: 'USD', name: 'United States', symbol: '$' },
        { code: 'EUR', name: 'Eurozone', symbol: '€' },
        { code: 'NGN', name: 'Nigeria', symbol: '₦' },
        { code: 'CAD', name: 'Canada', symbol: 'C$' },
        { code: 'AUD', name: 'Australia', symbol: 'A$' },
        { code: 'JPY', name: 'Japan', symbol: '¥' },
        { code: 'INR', name: 'India', symbol: '₹' }
    ];

    const filteredCurrencies = searchTerm
        ? currencies.filter(c =>
            c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : currencies;

    const selectedCurrency = currencies.find(c => c.code === value);

    return (
        <div style={{ position: 'relative' }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'white',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxSizing: 'border-box'
                }}
            >
                <span>{selectedCurrency ? `${selectedCurrency.code} (${selectedCurrency.name})` : 'Select Currency'}</span>
                <span style={{ color: '#9ca3af' }}>▼</span>
            </div>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    background: 'white',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    maxHeight: 300,
                    overflowY: 'auto'
                }}>
                    <div style={{ padding: 8, borderBottom: '1px solid var(--border-subtle)' }}>
                        <input
                            type="text"
                            placeholder="Search currencies..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: '100%',
                                padding: 8,
                                border: '1px solid #d1d5db',
                                borderRadius: 6,
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    {filteredCurrencies.map(currency => (
                        <div
                            key={currency.code}
                            onClick={() => {
                                onChange(currency.code);
                                setIsOpen(false);
                                setSearchTerm('');
                            }}
                            style={{
                                padding: '10px 12px',
                                cursor: 'pointer',
                                background: value === currency.code ? '#f3f4f6' : 'white',
                                fontWeight: value === currency.code ? 600 : 400
                            }}
                            onMouseEnter={(e) => e.target.style.background = '#f9fafb'}
                            onMouseLeave={(e) => e.target.style.background = value === currency.code ? '#f3f4f6' : 'white'}
                        >
                            <span style={{ fontWeight: 600 }}>{currency.code}</span>
                            <span style={{ color: '#6b7280', marginLeft: 8 }}>({currency.name})</span>
                            <span style={{ color: '#9ca3af', marginLeft: 8 }}>{currency.symbol}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


const ReferralSettings = () => {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        is_enabled: true,
        reward_type: 'BOTH',
        base_currency: 'GBP',
        referrer_reward: 5,
        referee_reward: 10,
        min_transaction_threshold: 50
    });

    useEffect(() => {
        fetchRules();
    }, []);

    const fetchRules = async () => {
        try {
            const res = await fetch('/api/referral-rules');
            const data = await res.json();
            setRules(data.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingId) {
                await fetch(`/api/referral-rules/${editingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                alert('Rule updated successfully');
            } else {
                await fetch('/api/referral-rules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                alert('Rule created successfully');
            }
            resetForm();
            fetchRules();
        } catch (err) {
            alert('Error saving rule');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (rule) => {
        setFormData({
            name: rule.name,
            is_enabled: !!rule.is_enabled,
            reward_type: rule.reward_type,
            base_currency: rule.base_currency,
            referrer_reward: rule.referrer_reward,
            referee_reward: rule.referee_reward,
            min_transaction_threshold: rule.min_transaction_threshold
        });
        setEditingId(rule.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this rule?')) return;

        try {
            await fetch(`/api/referral-rules/${id}`, { method: 'DELETE' });
            alert('Rule deleted');
            fetchRules();
        } catch (err) {
            alert('Error deleting rule');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            is_enabled: true,
            reward_type: 'BOTH',
            base_currency: 'GBP',
            referrer_reward: 5,
            referee_reward: 10,
            min_transaction_threshold: 50
        });
        setEditingId(null);
    };

    const inputStyle = {
        width: '100%',
        padding: '10px 12px',
        background: 'white',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        color: 'var(--text-main)',
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
            <h2 style={{ fontSize: '1.75rem', fontWeight: 600, marginBottom: 8 }}>Referral Scheme Management</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>Create and manage referral reward programs.</p>

            {/* Form */}
            <div className="glass-panel" style={{ padding: 32, marginBottom: 32 }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 20 }}>{editingId ? 'Edit Rule' : 'Create New Rule'}</h3>

                <form onSubmit={handleSubmit}>
                    {/* Name & Status */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>
                        <div>
                            <label style={labelStyle}>Rule Name *</label>
                            <input
                                style={inputStyle}
                                placeholder="e.g. UK Standard Program"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Status</label>
                            <select
                                style={inputStyle}
                                value={formData.is_enabled ? '1' : '0'}
                                onChange={(e) => setFormData({ ...formData, is_enabled: e.target.value === '1' })}
                            >
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                            </select>
                        </div>
                    </div>

                    {/* Reward Type & Currency */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                        <div>
                            <label style={labelStyle}>Who gets a reward?</label>
                            <select
                                style={inputStyle}
                                value={formData.reward_type}
                                onChange={(e) => {
                                    const newType = e.target.value;
                                    const updates = { reward_type: newType };
                                    if (newType === 'REFEREE') updates.referrer_reward = 0;
                                    else if (newType === 'REFERRER') updates.referee_reward = 0;
                                    setFormData({ ...formData, ...updates });
                                }}
                            >
                                <option value="BOTH">Both Parties (Double-Sided)</option>
                                <option value="REFERRER">Referrer Only</option>
                                <option value="REFEREE">Referee (New User) Only</option>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Base Currency</label>
                            <CurrencySelector
                                value={formData.base_currency}
                                onChange={(currency) => {
                                    const currencyDefaults = {
                                        'GBP': { referrer: 5, referee: 10, threshold: 50 },
                                        'USD': { referrer: 10, referee: 20, threshold: 100 },
                                        'EUR': { referrer: 8, referee: 15, threshold: 75 },
                                        'NGN': { referrer: 2000, referee: 5000, threshold: 20000 }
                                    };
                                    const defaults = currencyDefaults[currency] || { referrer: 5, referee: 10, threshold: 50 };
                                    setFormData({
                                        ...formData,
                                        base_currency: currency,
                                        referrer_reward: formData.referrer_reward === 0 ? defaults.referrer : formData.referrer_reward,
                                        referee_reward: formData.referee_reward === 0 ? defaults.referee : formData.referee_reward,
                                        min_transaction_threshold: defaults.threshold
                                    });
                                }}
                            />
                        </div>
                    </div>

                    {/* Rewards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                        <div>
                            <label style={labelStyle}>Referrer Reward</label>
                            <input
                                type="number"
                                step="0.50"
                                style={{
                                    ...inputStyle,
                                    marginBottom: 0,
                                    background: formData.reward_type === 'REFEREE' ? '#f3f4f6' : 'white',
                                    opacity: formData.reward_type === 'REFEREE' ? 0.6 : 1
                                }}
                                value={formData.referrer_reward}
                                onChange={(e) => setFormData({ ...formData, referrer_reward: parseFloat(e.target.value) || 0 })}
                                disabled={formData.reward_type === 'REFEREE'}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Referee (New User) Reward</label>
                            <input
                                type="number"
                                step="0.50"
                                style={{
                                    ...inputStyle,
                                    marginBottom: 0,
                                    background: formData.reward_type === 'REFERRER' ? '#f3f4f6' : 'white',
                                    opacity: formData.reward_type === 'REFERRER' ? 0.6 : 1
                                }}
                                value={formData.referee_reward}
                                onChange={(e) => setFormData({ ...formData, referee_reward: parseFloat(e.target.value) || 0 })}
                                disabled={formData.reward_type === 'REFERRER'}
                            />
                        </div>
                    </div>

                    {/* Threshold */}
                    <div style={{ marginBottom: 24 }}>
                        <label style={labelStyle}>Minimum Transaction Amount (Floor)</label>
                        <input
                            type="number"
                            step="10"
                            style={{ ...inputStyle, marginBottom: 0 }}
                            value={formData.min_transaction_threshold}
                            onChange={(e) => setFormData({ ...formData, min_transaction_threshold: parseFloat(e.target.value) || 0 })}
                        />
                    </div>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                        {editingId && (
                            <button type="button" className="btn-secondary" onClick={resetForm}>
                                Cancel
                            </button>
                        )}
                        <button type="submit" className="btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : editingId ? 'Update Rule' : 'Create Rule'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Table */}
            <div className="glass-panel" style={{ padding: 24 }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 16 }}>Existing Rules</h3>
                <div className="table-wrapper">
                    <table className="data-table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>Rule Name</th>
                                <th>Status</th>
                                <th>Reward Type</th>
                                <th>Referrer</th>
                                <th>Referee</th>
                                <th>Min Threshold</th>
                                <th>Currency</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rules.length === 0 ? (
                                <tr><td colSpan="8" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No rules found</td></tr>
                            ) : (
                                rules.map(rule => (
                                    <tr key={rule.id}>
                                        <td style={{ fontWeight: 600 }}>{rule.name}</td>
                                        <td>
                                            <span className={`status-badge ${rule.is_enabled ? 'success' : 'pending'}`}>
                                                {rule.is_enabled ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>{rule.reward_type === 'BOTH' ? 'Both' : rule.reward_type === 'REFERRER' ? 'Referrer Only' : 'Referee Only'}</td>
                                        <td>{rule.base_currency} {rule.referrer_reward.toFixed(2)}</td>
                                        <td>{rule.base_currency} {rule.referee_reward.toFixed(2)}</td>
                                        <td>{rule.base_currency} {rule.min_transaction_threshold.toFixed(2)}</td>
                                        <td>{rule.base_currency}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button
                                                    className="btn-secondary"
                                                    style={{ padding: '4px 12px', fontSize: '0.85rem' }}
                                                    onClick={() => handleEdit(rule)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="btn-secondary"
                                                    style={{ padding: '4px 12px', fontSize: '0.85rem', background: '#fee2e2', color: '#dc2626' }}
                                                    onClick={() => handleDelete(rule.id)}
                                                >
                                                    Delete
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

export default ReferralSettings;
