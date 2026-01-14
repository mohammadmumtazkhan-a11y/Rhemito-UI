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
                            Campaign
                        </button>
                    </span>
                    <button className="btn-primary" onClick={() => setShowCreateModal(true)}>+ Create New</button>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: 24 }}>
                {loading ? (
                    <div style={{ padding: 20, textAlign: 'center' }}>Loading...</div>
                ) : (
                    <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                        <table className="table-container" style={{ minWidth: 1000, tableLayout: 'fixed' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }}></th>
                                    <th style={{ width: 100 }}>Code</th>
                                    <th style={{ width: 90 }}>Type</th>
                                    <th style={{ width: 90 }}>Value</th>
                                    <th style={{ width: 100 }}>Cost Incurred</th>
                                    <th style={{ width: 100, textAlign: 'center' }}>Usage</th>
                                    <th style={{ width: 110, textAlign: 'center' }}>Period</th>
                                    <th style={{ width: 80, textAlign: 'center' }}>Status</th>
                                    <th style={{ width: 110, textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {promos.map(promo => (
                                    <tr key={promo.id}
                                        onClick={() => setSelectedPromo(promo)}
                                        style={{ cursor: 'pointer', background: selectedPromo?.id === promo.id ? '#fff7ed' : 'transparent' }}
                                    >
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            <input
                                                type="radio"
                                                name="promoSelection"
                                                checked={selectedPromo?.id === promo.id}
                                                onChange={() => setSelectedPromo(promo)}
                                                style={{ cursor: 'pointer' }}
                                            />
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontWeight: 700, whiteSpace: 'nowrap' }}>{promo.code}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{promo.type === 'FX_BOOST' ? 'FX Boost' : promo.type}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            {promo.type === 'Percentage' ? `${promo.value}%` :
                                                promo.type === 'Fixed' ? `${promo.currency} ${promo.value}` :
                                                    promo.type === 'FX_BOOST' ? `+${promo.value}` : 'Fee Waiver'}
                                        </td>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            {promo.currency} {promo.total_discount_utilized || 0}
                                            {promo.budget_limit !== -1 && (
                                                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}> / {promo.budget_limit.toLocaleString()}</span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            {promo.usage_count}/{promo.usage_limit_global === -1 ? '∞' : promo.usage_limit_global}
                                            <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>({promo.usage_limit_per_user}/user)</div>
                                        </td>
                                        <td style={{ textAlign: 'center', fontSize: '0.8rem' }}>
                                            <div>{new Date(promo.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>to</div>
                                            <div>{new Date(promo.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</div>
                                        </td>
                                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            <span className={`badge ${promo.status === 'Active' ? 'success' : 'danger'}`}>
                                                {promo.status}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            <button
                                                className="btn-primary"
                                                style={{
                                                    padding: '4px 10px', fontSize: '0.7rem',
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
                                            {promo.last_campaign_sent ? (
                                                <div style={{ fontSize: '0.65rem', color: '#059669', marginTop: 2 }}>
                                                    ✉️ Mail sent - {new Date(promo.last_campaign_sent).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: 2 }}>No campaigns</div>
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
