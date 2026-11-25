import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { OrderStatus, ItemStatus } from '@/types/database';
import { Clock, CheckCircle2, Flame, AlertCircle, PackageCheck } from 'lucide-react';

interface StatusBadgeProps {
  status: OrderStatus | ItemStatus | 'open' | 'closed';
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="pending" size={size}>
          <Clock className="w-3 h-3" />
          <span>مستني</span>
        </Badge>
      );
    case 'preparing':
      return (
        <Badge variant="preparing" size={size}>
          <Flame className="w-3 h-3" />
          <span>قيد التجهيز</span>
        </Badge>
      );
    case 'ready':
      return (
        <Badge variant="ready" size={size}>
          <CheckCircle2 className="w-3 h-3" />
          <span>جاهز</span>
        </Badge>
      );
    case 'delivered':
      return (
        <Badge variant="delivered" size={size}>
          <PackageCheck className="w-3 h-3" />
          <span>تم التسليم</span>
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="cancelled" size={size}>
          <AlertCircle className="w-3 h-3" />
          <span>ملغي</span>
        </Badge>
      );
    case 'open':
      return (
        <Badge variant="ready" size={size}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>شفت مفتوح</span>
        </Badge>
      );
    case 'closed':
      return (
        <Badge variant="neutral" size={size}>
          <span>شفت مغلق</span>
        </Badge>
      );
    default:
      return <Badge size={size}>{status}</Badge>;
  }
};

