import React, { useState, useEffect } from 'react';
import CreatePromoModal from '../../components/Promo/CreatePromoModal';
import CreateDistributionModal from '../../components/Promo/CreateDistributionModal';

const PromoCodes = () => {
    const [promos, setPromos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDistributeModal, setShowDistributeModal] = useState(false);
    const [selectedPromo, setSelectedPromo] = useState(null);

    useEffect(() => {
        fetchPromos();
    }, []);

    const fetchPromos = async () => {
        try {
            const res = await fetch('/api/promocodes');
            const data = await res.json();
            setPromos(data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (id, currentStatus) => {
        const newStatus = currentStatus === 'Active' ? 'Disabled' : 'Active';
        try {
            await fetch(`/api/promocodes/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            fetchPromos();
        } catch (err) {
            alert('Error updating status');
        }
    };

    return (
        <div className="promo-codes-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 8 }}>Promo Codes</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Manage your marketing campaigns and discounts.</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <span title={!selectedPromo ? "Select the promo code" : ""} style={{ display: 'inline-block' }}>
                        <button
                            className="btn-secondary"
                            onClick={() => setShowDistributeModal(true)}
                            disabled={!selectedPromo}
                            style={{ opacity: selectedPromo ? 1 : 0.5, cursor: selectedPromo ? 'pointer' : 'not-allowed', pointerEvents: selectedPromo ? 'auto' : 'none' }}
                        >
                            Targeted Distribution
                        </button>
                    </span>
                    <button className="btn-primary" onClick={() => setShowCreateModal(true)}>+ Create New</button>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: 24 }}>
                {loading ? (
                    <div style={{ padding: 20, textAlign: 'center' }}>Loading...</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table-container" style={{ minWidth: 800 }}>
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }}></th>
                                    <th>Code</th>
                                    <th>Type</th>
                                    <th>Value</th>
                                    <th>Cost Incurred</th>
                                    <th>Usage</th>
                                    <th>Period</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {promos.map(promo => (
                                    <tr key={promo.id}
                                        onClick={() => setSelectedPromo(promo)}
                                        style={{ cursor: 'pointer', background: selectedPromo?.id === promo.id ? '#fff7ed' : 'transparent' }}
                                    >
                                        <td>
                                            <input
                                                type="radio"
                                                name="promoSelection"
                                                checked={selectedPromo?.id === promo.id}
                                                onChange={() => setSelectedPromo(promo)}
                                                style={{ cursor: 'pointer' }}
                                            />
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{promo.code}</td>
                                        <td>{promo.type === 'FX_BOOST' ? 'FX Boost' : promo.type}</td>
                                        <td>
                                            {promo.type === 'Percentage' ? `${promo.value}%` :
                                                promo.type === 'Fixed' ? `${promo.currency} ${promo.value}` :
                                                    promo.type === 'FX_BOOST' ? `+${promo.value} Rate` : 'Fee Waiver'}
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{promo.currency} {promo.total_discount_utilized || 0}</div>
                                            {promo.budget_limit !== -1 && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    / {promo.budget_limit.toLocaleString()} Cap
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            {promo.usage_count} / {promo.usage_limit_global === -1 ? '∞' : promo.usage_limit_global}
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Per User: {promo.usage_limit_per_user}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '0.75rem', color: '#374151' }}>
                                                {new Date(promo.start_date).toLocaleDateString()}
                                            </div>
                                            <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>
                                                to {new Date(promo.end_date).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge ${promo.status === 'Active' ? 'success' : 'danger'}`}>
                                                {promo.status}
                                            </span>
                                            <button
                                                className="btn-primary"
                                                style={{
                                                    padding: '4px 10px', fontSize: '0.7rem', marginLeft: 8,
                                                    background: promo.status === 'Active' ? '#ef4444' : '#22c55e',
                                                    boxShadow: 'none'
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleStatus(promo.id, promo.status);
                                                }}
                                            >
                                                {promo.status === 'Active' ? 'Disable' : 'Enable'}
                                            </button>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {promo.last_campaign_sent ? (
                                                <div style={{ fontSize: '0.75rem', color: '#374151' }}>
                                                    📧 {new Date(promo.last_campaign_sent).toLocaleDateString()}
                                                    <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>
                                                        {new Date(promo.last_campaign_sent).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showCreateModal && (
                <CreatePromoModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={fetchPromos}
                />
            )}


            {/* Pass to modal */}
            {showDistributeModal && (
                <CreateDistributionModal
                    onClose={() => setShowDistributeModal(false)}
                    onSuccess={() => {
                        fetchPromos();
                        setSelectedPromo(null);
                    }}
                    selectedPromo={selectedPromo}
                />
            )}
        </div>
    );
};

export default PromoCodes;
