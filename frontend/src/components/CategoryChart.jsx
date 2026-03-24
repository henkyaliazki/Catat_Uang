import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function CategoryChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-gray-500 text-sm">
        Belum ada data pengeluaran bulan ini.
      </div>
    );
  }

  // format currency for tooltip
  const formatTooltip = (value) => {
    return `Rp ${value.toLocaleString('id-ID')}`;
  };

  return (
    <div className="w-full mt-4" style={{ height: 320 }}>
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="40%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={formatTooltip} />
          <Legend 
            verticalAlign="bottom" 
            wrapperStyle={{ paddingTop: '20px', fontSize: '11px' }} 
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
