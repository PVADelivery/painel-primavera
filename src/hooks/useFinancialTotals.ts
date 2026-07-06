// @ts-nocheck
import { useMemo } from "react";
import { getDeliveryValue } from "@/lib/delivery";
import type { DeliveryWithRelations } from "@/services/deliveries";

export function useFinancialTotals(validDeliveries: DeliveryWithRelations[], drivers: any[]) {
  return useMemo(() => {
    let totalValue = 0;
    let totalCommission = 0;
    
    const enrichedDeliveries = validDeliveries.map(d => {
      const value = getDeliveryValue(d);
      totalValue += value;
      
      let commission = 0;
      if (d.commission && Number(d.commission) > 0) {
        commission = Number(d.commission);
      } else if (d.driver_id) {
        const driver = drivers?.find(dr => dr.id === d.driver_id);
        const rate = (driver?.commission_rate !== undefined && driver?.commission_rate !== null)
          ? Number(driver.commission_rate) 
          : 1.0; // By default, driver gets 100% of the delivery fee
        
        // Se a taxa for <= 1, consideramos porcentagem (ex: 0.9 = 90%)
        // Se for > 1, consideramos valor fixo.
        if (rate <= 1 && rate > 0) {
          commission = value * rate;
        } else {
          commission = rate > 1 ? rate : value;
        }
      } else {
        commission = value; // If no driver assigned yet, estimate full value
      }
      totalCommission += commission;
      
      return {
        ...d,
        calculatedValue: value,
        calculatedCommission: commission
      };
    });

    return {
      totalValue,
      totalCommission,
      completedCount: enrichedDeliveries.length,
      enrichedDeliveries
    };
  }, [validDeliveries, drivers]);
}
