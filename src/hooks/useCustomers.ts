import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { customerService, IncomingCallEvent } from '@/services/customer.service';

export function useCustomers() {
  const [period, setPeriod] = useState<'today' | '7days' | '30days' | 'all'>('all');
  const [sortBy, setSortBy] = useState<'orders' | 'total'>('total');
  const [incomingCall, setIncomingCall] = useState<IncomingCallEvent | null>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', period, sortBy],
    queryFn: () => customerService.getCustomers(period, sortBy),
  });

  const simulateIncomingCall = (phone = '01099887766') => {
    const existing = customers.find((c) => c.phone === phone);
    setIncomingCall({
      caller_number: phone,
      caller_name: existing?.name,
      timestamp: new Date().toISOString(),
    });
  };

  const dismissIncomingCall = () => {
    setIncomingCall(null);
  };

  return {
    customers,
    isLoading,
    period,
    setPeriod,
    sortBy,
    setSortBy,
    incomingCall,
    simulateIncomingCall,
    dismissIncomingCall,
  };
}

