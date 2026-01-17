import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Table from '../../components/Table';

const MerchantList = () => {
    const [data] = useState([
        {
            mitoId: "MITO-001",
            name: "Global Tech Ltd",
            regDate: "2024-01-15",
            country: "Nigeria",
            payoutCurr: "USD",
            contact: "Jane Doe",
            status: "Active"
        },
        {
            mitoId: "MITO-002",
            name: "Lagos Logistics",
            regDate: "2024-02-20",
            country: "Nigeria",
            payoutCurr: "GBP",
            contact: "Samuel K.",
            status: "Onboarding"
        }
    ]);

    const columns = [
        { header: "Merchant ID", accessor: "mitoId", render: (row) => <span style={{ fontFamily: 'monospace' }}>{row.mitoId}</span> },
        { header: "Name", accessor: "name", render: (row) => <b>{row.name}</b> },
        { header: "Registered", accessor: "regDate" },
        { header: "Country", accessor: "country" },
        { header: "Payout Currency", accessor: "payoutCurr" },
        { header: "Contact", accessor: "contact" },
        {
            header: "Status", accessor: "status", render: (row) => (
                <span className={`badge ${row.status === 'Active' ? 'success' : 'warning'}`}>{row.status}</span>
            )
        }
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Merchant Management</h2>
                    <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Manage onboarded merchants and their accounts.</p>
                </div>
                <Link to="/merchants/onboard" className="btn-primary" style={{ textDecoration: 'none' }}>+ Add Merchant</Link>
            </div>

            <Table columns={columns} data={data} />
        </div>
    );
};

export default MerchantList;
