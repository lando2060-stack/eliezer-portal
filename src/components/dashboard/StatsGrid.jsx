import React from 'react';
import { motion } from 'framer-motion';
import { Receipt, TrendingUp, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';

const stats = [
  { key: 'monthTotal', label: 'הוצאות החודש', icon: Receipt, gradient: 'from-indigo-500 to-blue-600' },
  { key: 'yearTotal', label: 'הוצאות השנה', icon: TrendingUp, gradient: 'from-emerald-500 to-teal-600' },
  { key: 'monthReceipts', label: 'קבלות החודש', icon: Receipt, gradient: 'from-amber-500 to-orange-600', isCurrency: false },
  { key: 'pendingCount', label: 'ממתינות לאישור', icon: Clock, gradient: 'from-purple-500 to-violet-600', isCurrency: false },
];

export default function StatsGrid({ data }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.key}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="relative overflow-hidden rounded-2xl bg-card border border-border p-5 group hover:shadow-lg transition-shadow"
        >
          <div className={`absolute top-0 left-0 w-24 h-24 bg-gradient-to-br ${stat.gradient} rounded-full opacity-10 -translate-x-8 -translate-y-8 group-hover:scale-150 transition-transform duration-500`} />
          <div className="relative">
            <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${stat.gradient} mb-3`}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
            <p className="text-2xl font-bold mt-1">
              {stat.isCurrency === false ? data[stat.key] : formatCurrency(data[stat.key])}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}