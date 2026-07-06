// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface AdminCoupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_value: number | null;
  max_discount_value: number | null;
  expires_at: string | null;
  usage_limit: number | null;
  used_count: number | null;
  company_id: string | null;
  active: boolean;
  created_at: string;
  company_ids: string[]; // selected scope (empty + company_id null = global)
}

export interface CouponInput {
  code: string;
  description?: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_value?: number | null;
  max_discount_value?: number | null;
  expires_at?: string | null;
  usage_limit?: number | null;
  active: boolean;
  company_ids: string[]; // [] = global, [...] = restricted to those companies
}

async function loadCouponCompanyMap(couponIds: string[]) {
  if (couponIds.length === 0) return new Map<string, string[]>();
  const { data, error } = await supabase
    .from("coupon_companies")
    .select("coupon_id, company_id")
    .in("coupon_id", couponIds);
  if (error) throw error;
  const map = new Map<string, string[]>();
  (data ?? []).forEach((row: any) => {
    const list = map.get(row.coupon_id) ?? [];
    list.push(row.company_id);
    map.set(row.coupon_id, list);
  });
  return map;
}

export async function listAdminCoupons(): Promise<AdminCoupon[]> {
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const scopeMap = await loadCouponCompanyMap(rows.map((r) => r.id));
  return rows.map((r) => ({
    ...r,
    company_ids: scopeMap.get(r.id) ?? [],
  })) as AdminCoupon[];
}

export async function listCompanyOptions() {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .order("name");
  if (error) throw error;
  return (data ?? []) as { id: string; name: string }[];
}

async function setCouponCompanies(couponId: string, companyIds: string[]) {
  const { error: delErr } = await supabase
    .from("coupon_companies")
    .delete()
    .eq("coupon_id", couponId);
  if (delErr) throw delErr;
  if (companyIds.length === 0) return;
  const { error } = await supabase
    .from("coupon_companies")
    .insert(companyIds.map((cid) => ({ coupon_id: couponId, company_id: cid })));
  if (error) throw error;
}

export async function createAdminCoupon(input: CouponInput) {
  const { data, error } = await supabase
    .from("coupons")
    .insert({
      code: input.code.trim().toUpperCase(),
      description: input.description ?? null,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      min_order_value: input.min_order_value ?? null,
      max_discount_value: input.max_discount_value ?? null,
      expires_at: input.expires_at ?? null,
      usage_limit: input.usage_limit ?? null,
      active: input.active,
      company_id: null,
    })
    .select("id")
    .single();
  if (error) throw error;
  await setCouponCompanies(data!.id, input.company_ids);
  return data!.id as string;
}

export async function updateAdminCoupon(id: string, input: CouponInput) {
  const { error } = await supabase
    .from("coupons")
    .update({
      code: input.code.trim().toUpperCase(),
      description: input.description ?? null,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      min_order_value: input.min_order_value ?? null,
      max_discount_value: input.max_discount_value ?? null,
      expires_at: input.expires_at ?? null,
      usage_limit: input.usage_limit ?? null,
      active: input.active,
    })
    .eq("id", id);
  if (error) throw error;
  await setCouponCompanies(id, input.company_ids);
}

export async function deleteAdminCoupon(id: string) {
  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error) throw error;
}

export function useAdminCoupons() {
  return useQuery({ queryKey: ["admin-coupons"], queryFn: listAdminCoupons });
}

export function useCompanyOptions() {
  return useQuery({ queryKey: ["company-options"], queryFn: listCompanyOptions });
}

export function useCreateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CouponInput) => createAdminCoupon(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });
}

export function useUpdateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; input: CouponInput }) =>
      updateAdminCoupon(args.id, args.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });
}

export function useDeleteCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAdminCoupon(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });
}

export interface ValidateCouponResult {
  valid: boolean;
  reason?: string;
  discount?: number;
  coupon_id?: string;
  code?: string;
  description?: string | null;
}

export async function validateCoupon(
  code: string,
  companyId: string,
  subtotal: number,
): Promise<ValidateCouponResult> {
  const { data, error } = await supabase.rpc("validate_coupon" as any, {
    p_code: code,
    p_company_id: companyId,
    p_subtotal: subtotal,
  });
  if (error) return { valid: false, reason: error.message };
  return (data ?? { valid: false, reason: "Erro desconhecido" }) as ValidateCouponResult;
}
