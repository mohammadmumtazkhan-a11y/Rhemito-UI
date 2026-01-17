import React from 'react';

const Table = ({ columns, data, actions }) => {
    return (
        <div className="glass-panel" style={{ overflowX: 'auto' }}>
            <table className="table-container">
                <thead>
                    <tr>
                        {columns.map((col, index) => (
                            <th key={index}>{col.header}</th>
                        ))}
                        {actions && <th>Actions</th>}
                    </tr>
                </thead>
                <tbody>
                    {data.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length + (actions ? 1 : 0)} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                No data found
                            </td>
                        </tr>
                    ) : (
                        data.map((row, rowIndex) => (
                            <tr key={rowIndex} onClick={() => actions?.onRowClick && actions.onRowClick(row)} style={{ cursor: actions?.onRowClick ? 'pointer' : 'default' }}>
                                {columns.map((col, colIndex) => (
                                    <td key={colIndex}>
                                        {col.render ? col.render(row) : row[col.accessor]}
                                    </td>
                                ))}
                                {actions && actions.render && (
                                    <td>{actions.render(row)}</td>
                                )}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default Table;
