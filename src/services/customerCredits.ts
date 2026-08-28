// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface CustomerCredit {
  id: string;
  customer_id: string;
  customer_phone?: string;
  customer_name?: string;
  balance: number;
  total_recharged: number;
  total_bonus: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerCreditTransaction {
  id: string;
  customer_id: string;
  customer_phone?: string;
  customer_name?: string;
  amount: number;
  paid_amount?: number;
  bonus_amount?: number;
  type: "recharge" | "bonus" | "payment_order" | "payment_ride" | "payment_errand" | "refund" | "admin_adjustment";
  reference_id?: string;
  description: string;
  created_by: string;
  created_at: string;
}

export function useCustomerCreditsList() {
  return useQuery<CustomerCredit[]>({
    queryKey: ["admin-customer-credits"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("customer_credits")
          .select("*")
          .order("balance", { ascending: false });
        if (error) {
          console.warn("[CustomerCredits] Erro ao listar carteiras:", error.message);
          return [];
        }
        return (data || []) as CustomerCredit[];
      } catch (err) {
        console.warn("[CustomerCredits] Exceção:", err);
        return [];
      }
    },
    staleTime: 1000 * 20,
  });
}

export function useCustomerCreditTransactionsList(limit = 400) {
  return useQuery<CustomerCreditTransaction[]>({
    queryKey: ["admin-customer-credit-transactions", limit],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("customer_credit_transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) {
          console.warn("[CustomerCredits] Erro ao listar transações:", error.message);
          return [];
        }
        return (data || []) as CustomerCreditTransaction[];
      } catch (err) {
        console.warn("[CustomerCredits] Exceção:", err);
        return [];
      }
    },
    staleTime: 1000 * 20,
  });
}

/** Hook para buscar todos os clientes cadastrados em auth.users/profiles/orders/customers/deliveries */
export function useAllCustomerProfiles() {
  return useQuery({
    queryKey: ["admin-all-profiles-customers"],
    queryFn: async () => {
      const customersList: any[] = [];
      const seenKeys = new Set<string>();

      // Obter IDs/nomes de motoristas e empresas para exclusão
      const excludedIds = new Set<string>();
      const excludedNames = new Set<string>();

      try {
        const { data: driversData } = await supabase.from("drivers").select("*");
        if (driversData) {
          driversData.forEach((d: any) => {
            if (d.user_id) excludedIds.add(String(d.user_id).toLowerCase());
            if (d.id) excludedIds.add(String(d.id).toLowerCase());
            if (d.name) excludedNames.add(String(d.name).trim().toLowerCase());
            if (d.full_name) excludedNames.add(String(d.full_name).trim().toLowerCase());
          });
        }
      } catch (err) {}

      try {
        const { data: companiesData } = await supabase.from("companies").select("*");
        if (companiesData) {
          companiesData.forEach((c: any) => {
            if (c.user_id) excludedIds.add(String(c.user_id).toLowerCase());
            if (c.id) excludedIds.add(String(c.id).toLowerCase());
            if (c.name) excludedNames.add(String(c.name).trim().toLowerCase());
          });
        }
      } catch (err) {}

      try {
        const { data: rolesData } = await supabase.from("user_roles").select("*");
        if (rolesData) {
          rolesData.forEach((r: any) => {
            if (r.role !== "customer" && r.user_id) {
              excludedIds.add(String(r.user_id).toLowerCase());
            }
          });
        }
      } catch (err) {}

      // Lista de termos lixo a serem ignorados completamente
      const isJunkName = (name: string) => {
        const n = (name || "").toUpperCase().trim();
        if (n.length < 2) return true;
        if (/^\d+$/.test(n)) return true;
        const junkWords = [
          "BALCÃO", "BALÇAO", "BALCOM", "CAIXA MT", "CACAU SHOW", "DRIVER", "MOTORISTA",
          "IFOOD", "IFOODS", "TESTE", "TEST", "TES TES", "CLIENTE TESTE", "UPVET",
          "SELECIONE", "ADMIN", "ADMINISTRADOR", "ENTREGADOR"
        ];
        return junkWords.some((word) => n.includes(word));
      };

      const addUniqueCustomer = (item: {
        id: string;
        name: string;
        phone?: string;
        email?: string;
        cpf?: string;
        address?: string;
        source?: string;
      }) => {
        const idKey = item.id ? String(item.id).trim().toLowerCase() : "";
        const nameKey = item.name ? String(item.name).trim().toLowerCase() : "";
        const phoneKey = item.phone ? String(item.phone).replace(/\D/g, "") : "";
        const emailKey = item.email ? String(item.email).trim().toLowerCase() : "";

        // Se for motorista, empresa, admin ou nome de teste/balcão, descarta
        if (idKey && excludedIds.has(idKey)) return;
        if (nameKey && excludedNames.has(nameKey)) return;
        if (isJunkName(item.name)) return;

        // Se não possui nenhum dado de contato (nem telefone, nem email, nem cpf) e não veio de pedidos/autenticação com ID válido, descarta
        const hasContact = phoneKey.length >= 8 || (emailKey.includes("@") && !emailKey.includes("exemplo")) || item.cpf;
        if (!hasContact && (!idKey || idKey.length < 10)) {
          return;
        }

        // Chave de unicidade inteligente
        const primaryKey = idKey || (phoneKey.length >= 8 ? phoneKey : "") || (emailKey ? emailKey : nameKey);
        if (!primaryKey || seenKeys.has(primaryKey)) {
          // Se já viu, mescla as informações para enriquecer o cadastro
          const existing = customersList.find((c) => c._key === primaryKey || (phoneKey && c.phone && c.phone.replace(/\D/g, "") === phoneKey) || (emailKey && c.email && c.email.toLowerCase() === emailKey));
          if (existing) {
            if (!existing.phone && item.phone) existing.phone = item.phone;
            if (!existing.email && item.email) existing.email = item.email;
            if (!existing.cpf && item.cpf) existing.cpf = item.cpf;
            if (!existing.address && item.address) existing.address = item.address;
          }
          return;
        }

        seenKeys.add(primaryKey);
        customersList.push({
          ...item,
          _key: primaryKey,
          id: item.id || primaryKey,
          name: item.name || "Cliente Marketplace",
          phone: item.phone || "",
          email: item.email || "",
          cpf: item.cpf || "",
          address: item.address || "",
        });
      };

      // 1. Busca da tabela profiles (Usuários registrados no App do Marketplace)
      try {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("*")
          .limit(1000);
        if (profiles) {
          profiles.forEach((p: any) => {
            const uid = p.user_id || p.id;
            const name = p.full_name || p.name || (p.email ? p.email.split("@")[0] : "");
            if (name) {
              addUniqueCustomer({
                id: uid,
                name,
                phone: p.phone || "",
                email: p.email || "",
                cpf: p.cpf || "",
                address: p.address || "",
                source: "app_marketplace",
              });
            }
          });
        }
      } catch (err) {}

      // 2. Busca da tabela customers (Clientes cadastrados com dados completos)
      try {
        const { data: customersData } = await supabase
          .from("customers")
          .select("*")
          .limit(1000);
        if (customersData) {
          customersData.forEach((c: any) => {
            addUniqueCustomer({
              id: c.user_id || c.id,
              name: c.name || "Cliente",
              phone: c.phone || "",
              email: c.email || "",
              cpf: c.cpf || "",
              address: c.address || "",
              source: "app_marketplace",
            });
          });
        }
      } catch (err) {}

      // 3. Busca da tabela customer_credits (Carteiras existentes)
      try {
        const { data: creditAccounts } = await supabase
          .from("customer_credits")
          .select("*")
          .limit(1000);
        if (creditAccounts) {
          creditAccounts.forEach((c: any) => {
            addUniqueCustomer({
              id: c.customer_id || c.id,
              name: c.customer_name || "Cliente",
              phone: c.customer_phone || "",
              email: c.customer_email || "",
              cpf: c.customer_cpf || "",
              source: "app_marketplace",
            });
          });
        }
      } catch (err) {}

      // 4. Busca da tabela orders (Pedidos reais do Marketplace no App com endereços e telefones)
      try {
        const { data: recentOrders } = await supabase
          .from("orders")
          .select("user_id, customer_name, customer_phone, customer_email, customer_cpf, delivery_address")
          .not("customer_name", "is", null)
          .order("created_at", { ascending: false })
          .limit(500);

        if (recentOrders) {
          recentOrders.forEach((o: any) => {
            addUniqueCustomer({
              id: o.user_id || "",
              name: o.customer_name,
              phone: o.customer_phone || "",
              email: o.customer_email || "",
              cpf: o.customer_cpf || "",
              address: typeof o.delivery_address === "string" ? o.delivery_address : "",
              source: "app_marketplace",
            });
          });
        }
      } catch (err) {}

      // 5. Busca da tabela ride_requests (Corridas do App de Passageiro)
      try {
        const { data: recentRides } = await supabase
          .from("ride_requests")
          .select("user_id, customer_name, customer_phone")
          .not("customer_name", "is", null)
          .order("created_at", { ascending: false })
          .limit(300);

        if (recentRides) {
          recentRides.forEach((r: any) => {
            addUniqueCustomer({
              id: r.user_id || "",
              name: r.customer_name,
              phone: r.customer_phone || "",
              source: "app_marketplace",
            });
          });
        }
      } catch (err) {}

      // Ordena alfabeticamente
      return customersList.sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "pt-BR")
      );
    },
    staleTime: 1000 * 15,
  });
}

/** Mutation para Adicionar Créditos (Recarga + Bônus 10%) e Alimentar Fluxo de Caixa */
export function useAddCustomerCredits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      customer_id: string;
      customer_name?: string;
      customer_phone?: string;
      paid_amount: number;
      bonus_amount: number;
      description?: string;
      payment_method?: string;
      registerCashFlow?: boolean;
    }) => {
      const totalCredits = Number(input.paid_amount || 0) + Number(input.bonus_amount || 0);

      // 1. Tenta executar via RPC atômica
      let rpcSuccess = false;
      try {
        const { data, error } = await supabase.rpc("rpc_add_customer_credits", {
          p_customer_id: input.customer_id,
          p_customer_name: input.customer_name || "Cliente",
          p_customer_phone: input.customer_phone || "",
          p_paid_amount: input.paid_amount,
          p_bonus_amount: input.bonus_amount,
          p_description: input.description || `Recarga de créditos com bônus de 10% (Pago: R$ ${input.paid_amount.toFixed(2)})`,
          p_admin_identifier: "admin",
        });
        if (!error) {
          rpcSuccess = true;
        } else {
          console.warn("[CustomerCredits] RPC indisponível, usando fallback direto:", error.message);
        }
      } catch (e) {
        console.warn("[CustomerCredits] Falha ao invocar RPC:", e);
      }

      // Fallback direto se a RPC ainda não tiver sido criada
      if (!rpcSuccess) {
        // Upsert na tabela customer_credits
        const { data: existing } = await supabase
          .from("customer_credits")
          .select("balance, total_recharged, total_bonus")
          .eq("customer_id", input.customer_id)
          .maybeSingle();

        const newBal = (Number(existing?.balance) || 0) + totalCredits;
        const newRecharged = (Number(existing?.total_recharged) || 0) + input.paid_amount;
        const newBonus = (Number(existing?.total_bonus) || 0) + input.bonus_amount;

        await supabase.from("customer_credits").upsert({
          customer_id: input.customer_id,
          customer_name: input.customer_name || "Cliente",
          customer_phone: input.customer_phone || "",
          balance: newBal,
          total_recharged: newRecharged,
          total_bonus: newBonus,
          updated_at: new Date().toISOString(),
        });

        // Inserir registro no extrato
        await supabase.from("customer_credit_transactions").insert({
          customer_id: input.customer_id,
          customer_name: input.customer_name || "Cliente",
          customer_phone: input.customer_phone || "",
          amount: totalCredits,
          paid_amount: input.paid_amount,
          bonus_amount: input.bonus_amount,
          type: "recharge",
          description: input.description || `Recarga de R$ ${input.paid_amount.toFixed(2)} (+R$ ${input.bonus_amount.toFixed(2)} bônus 10%)`,
          created_by: "admin",
        });
      }

      // 2. Registrar no Fluxo de Caixa como Entrada ("Venda de Créditos Cliente")
      if (input.registerCashFlow !== false && input.paid_amount > 0) {
        try {
          const today = new Date().toISOString().split("T")[0];
          await supabase.from("platform_cash_flow").insert({
            type: "income",
            category: "Venda de Créditos Cliente",
            description: `Recarga de Créditos (+10% Bônus) - Cliente: ${input.customer_name || "Cliente"} (${input.customer_phone || ""})`,
            amount: input.paid_amount,
            origin: input.payment_method || "Pix",
            date: today,
          });
        } catch (cfErr) {
          console.warn("[CustomerCredits] Aviso ao salvar no fluxo de caixa:", cfErr);
        }
      }

      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-customer-credits"] });
      qc.invalidateQueries({ queryKey: ["admin-customer-credit-transactions"] });
      qc.invalidateQueries({ queryKey: ["platform-cash-flow"] });
    },
  });
}
