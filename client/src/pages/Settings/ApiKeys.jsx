import React, { useState } from 'react';
import Table from '../../components/Table';

const ApiKeys = () => {
    const [keys] = useState([
        { ref: "KEY-001", service: "MITO_API_V1", account: "John Doe (Admin)", status: "Active", created: "2024-01-10" },
        { ref: "KEY-002", service: "MERCHANT_READ", account: "Global Tech Ltd", status: "Active", created: "2024-03-22" },
    ]);

    const columns = [
        { header: "Key Ref", accessor: "ref", render: (row) => <span style={{ fontFamily: 'monospace' }}>{row.ref}</span> },
        { header: "Service Scope", accessor: "service" },
        { header: "Account Context", accessor: "account" },
        { header: "Date Created", accessor: "created" },
        { header: "Status", accessor: "status", render: (row) => <span className="badge success">{row.status}</span> },
    ];

    const actions = {
        render: (row) => (
            <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Revoke</button>
                <button style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: 'none', borderRadius: 4, cursor: 'pointer' }}>View Secret</button>
            </div>
        )
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>API Key Management</h2>
                    <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Manage secret keys for programmatic access.</p>
                </div>
                <button className="btn-primary">Generate New Key</button>
            </div>

            <div className="glass-panel" style={{ padding: 24, marginBottom: 32 }}>
                <h3 style={{ marginTop: 0 }}>Developer Documentation</h3>
                <p style={{ color: 'var(--text-muted)' }}>Download the latest PDF guide for integrating with the Wholesale Biller API or view the interactive Swagger documentation.</p>
                <div style={{ display: 'flex', gap: 16 }}>
                    <button style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'white', cursor: 'pointer' }}>Download PDF Guide</button>
                    <button style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'white', cursor: 'pointer' }}>View Swagger Docs</button>
                </div>
            </div>

            <Table columns={columns} data={keys} actions={actions} />
        </div>
    );
};

export default ApiKeys;
