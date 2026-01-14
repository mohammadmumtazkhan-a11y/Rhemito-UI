import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

const UserCreditLedger = () => {
    const [userId, setUserId] = useState('');
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [bonusSchemes, setBonusSchemes] = useState([]);

    // Phase 2: FRD Filters (Section 3.2)
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        eventType: '',
        schemeId: ''
    });

    // Phase 3: FRD Adjustment Form
    const [adjAmount, setAdjAmount] = useState('');
    const [adjType, setAdjType] = useState('EARNED');
    const [adjReasonCode, setAdjReasonCode] = useState('GOODWILL');
    const [adjNotes, setAdjNotes] = useState('');
    const [adjSchemeId, setAdjSchemeId] = useState('');

    useEffect(() => {
        // Load bonus schemes for filter dropdown
        fetch('/api/bonus-schemes')
            .then(res => res.json())
            .then(data => setBonusSchemes(data.data || []))
            .catch(err => console.error(err));
    }, []);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!userId) return alert('Please enter a User ID');
        setLoading(true);
        try {
            // Build query params with filters
            const params = new URLSearchParams({ ...filters });
            const queryString = params.toString() ? `?${params.toString()}` : '';

            const res = await fetch(`/api/credits/${userId}${queryString}`);
            const data = await res.json();
            setUserData(data);
        } catch (err) {
            console.error(err);
            alert('Error fetching user data');
        } finally {
            setLoading(false);
        }
    };

    const handleAdjustment = async () => {
        // Phase 3: FRD Validations (Section 3.3)
        if (!adjAmount) return alert('Please enter an amount');
        if (!adjReasonCode) return alert('Please select a reason code');
        if (!adjNotes || adjNotes.trim().length === 0) {
            return alert('Notes are required for manual adjustments (FRD Section 3.3)');
        }

        if (!confirm(`Are you sure you want to apply this adjustment?\n\nAmount: ${adjAmount}\nReason: ${adjReasonCode}\nNotes: ${adjNotes}`)) {
            return;
        }

        try {
            const res = await fetch('/api/credits/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    amount: parseFloat(adjAmount),
                    type: adjType,
                    reason_code: adjReasonCode,
                    notes: adjNotes,
                    scheme_id: adjSchemeId || null,
                    admin_user: 'Admin' // Should come from auth context
                })
            });

            const data = await res.json();

            if (!res.ok) {
                alert(`Error: ${data.error}`);
                return;
            }

            alert('Adjustment applied successfully');
            setShowAdjustModal(false);
            setAdjAmount('');
            setAdjNotes('');
            handleSearch(); // Reload data
        } catch (err) {
            alert('Failed to apply adjustment');
        }
    };

    return (
        <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 600, marginBottom: 8 }}>User Credit Ledger</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>View balances and audit history for user bonus wallets (FRD Sec. 3.2)</p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    <div className="search-box" style={{ flex: 1, height: 48 }}>
                        <Search size={20} color="var(--text-muted)" />
                        <input
                            type="text"
                            placeholder="Search by User ID (e.g., user_123)..."
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            style={{ width: '100%', border: 'none', outline: 'none', fontSize: '1rem', background: 'transparent' }}
                        />
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Searching...' : 'Search User'}
                    </button>
                </div>

                {/* Phase 2: FRD Filters */}
                <div className="glass-panel" style={{ padding: 16 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 12, color: 'var(--text-muted)' }}>📊 Advanced Filters (FRD Section 3.2)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Start Date</label>
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-subtle)', fontSize: '0.9rem' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>End Date</label>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-subtle)', fontSize: '0.9rem' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Event Type</label>
                            <select
                                value={filters.eventType}
                                onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
                                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-subtle)', fontSize: '0.9rem' }}
                            >
                                <option value="">All Types</option>
                                <option value="EARNED">Earned</option>
                                <option value="APPLIED">Applied</option>
                                <option value="EXPIRED">Expired</option>
                                <option value="VOIDED">Voided</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Bonus Scheme</label>
                            <select
                                value={filters.schemeId}
                                onChange={(e) => setFilters({ ...filters, schemeId: e.target.value })}
                                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-subtle)', fontSize: '0.9rem' }}
                            >
                                <option value="">All Schemes</option>
                                {bonusSchemes.map(scheme => (
                                    <option key={scheme.id} value={scheme.id}>{scheme.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </form>

            {userData && (
                <div className="fade-in">
                    {/* Balance Card */}
                    <div className="glass-panel" style={{ padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                        <div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 4 }}>Current Balance</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                {userData.currency} {userData.balance.toFixed(2)}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>User ID: {userId}</div>
                        </div>
                        <button
                            className="btn-secondary"
                            onClick={() => setShowAdjustModal(true)}
                        >
                            🔧 Manual Adjustment
                        </button>
                    </div>

                    {/* History Table */}
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 16 }}>Ledger History ({userData.history.length} entries)</h3>
                    <div className="table-wrapper">
                        <table className="data-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Scheme</th>
                                    <th>Reference / Reason</th>
                                    <th>Notes</th>
                                    <th>Amount</th>
                                    <th>Admin</th>
                                </tr>
                            </thead>
                            <tbody>
                                {userData.history.length === 0 ? (
                                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No history found for these filters</td></tr>
                                ) : (
                                    userData.history.map(entry => (
                                        <tr key={entry.id}>
                                            <td style={{ fontSize: '0.8rem' }}>{new Date(entry.created_at).toLocaleString('en-GB')}</td>
                                            <td>
                                                <span className={`status-badge ${entry.amount >= 0 ? 'success' : 'failure'}`}>
                                                    {entry.type}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.85rem', color: '#6b7280' }}>{entry.scheme_name || '-'}</td>
                                            <td style={{ fontSize: '0.85rem' }}>
                                                {entry.reason_code && <span style={{ fontWeight: 600, color: '#ea580c' }}>[{entry.reason_code}]</span>}
                                                {' '}{entry.reference_id}
                                            </td>
                                            <td style={{ fontSize: '0.8rem', color: '#6b7280', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {entry.notes || '-'}
                                            </td>
                                            <td style={{ fontWeight: 600, color: entry.amount >= 0 ? '#16a34a' : '#ef4444' }}>
                                                {entry.amount >= 0 ? '+' : ''}{entry.amount.toFixed(2)}
                                            </td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{entry.admin_user || 'System'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Phase 3: Enhanced Adjustment Modal (FRD Section 3.3) */}
            {showAdjustModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: 500 }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 24 }}>Manual Credit Adjustment</h3>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', fontWeight: 600 }}>Event Type *</label>
                            <select
                                value={adjType}
                                onChange={(e) => setAdjType(e.target.value)}
                                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border-subtle)' }}
                            >
                                <option value="EARNED">Earned (Credit)</option>
                                <option value="VOIDED">Voided (Debit)</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', fontWeight: 600 }}>Reason Code * (FRD Required)</label>
                            <select
                                value={adjReasonCode}
                                onChange={(e) => setAdjReasonCode(e.target.value)}
                                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border-subtle)' }}
                                required
                            >
                                <option value="GOODWILL">Goodwill</option>
                                <option value="CORRECTION">Correction</option>
                                <option value="MANUAL_ADJUSTMENT">Manual Adjustment</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', fontWeight: 600 }}>Amount *</label>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={adjAmount}
                                onChange={(e) => setAdjAmount(e.target.value)}
                                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border-subtle)' }}
                                required
                            />
                            {adjType === 'VOIDED' && <div style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: 4 }}>Enter as negative number (e.g. -50) to remove credit.</div>}
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', fontWeight: 600 }}>Bonus Scheme (Optional)</label>
                            <select
                                value={adjSchemeId}
                                onChange={(e) => setAdjSchemeId(e.target.value)}
                                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border-subtle)' }}
                            >
                                <option value="">None</option>
                                {bonusSchemes.map(scheme => (
                                    <option key={scheme.id} value={scheme.id}>{scheme.name}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: 24 }}>
                            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', fontWeight: 600 }}>Notes * (FRD Required - Section 3.3)</label>
                            <textarea
                                placeholder="Provide detailed context for this adjustment (required for audit trail)..."
                                value={adjNotes}
                                onChange={(e) => setAdjNotes(e.target.value)}
                                rows={3}
                                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border-subtle)', fontFamily: 'inherit', resize: 'vertical' }}
                                required
                            />
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4 }}>
                                Example: "Customer complaint ticket #1234 - compensation for delayed payout"
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <button className="btn-secondary" onClick={() => setShowAdjustModal(false)}>Cancel</button>
                            <button className="btn-primary" onClick={handleAdjustment}>Confirm & Apply</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserCreditLedger;
