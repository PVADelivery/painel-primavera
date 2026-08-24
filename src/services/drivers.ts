// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type DriverWithProfile = {
  id: string;
  user_id: string;
  full_name: string;
  phone?: string | null;
  document?: string | null;
  avatar_url?: string | null;
  vehicle_type?: string | null;
  vehicle_plate?: string | null;
  is_online?: boolean | null;
  online?: boolean | null;
  rating: number;
  latitude: number | null;
  longitude: number | null;
  status?: string | null;
  commission_rate?: number | null;
  service_types?: string[] | null;
  created_at?: string;
};

export async function fetchDrivers(): Promise<DriverWithProfile[]> {
  // 1. Fetch delivery_drivers
  const { data: driversData } = await supabase
    .from("delivery_drivers")
    .select("*")
    .order("created_at", { ascending: false });

  // 2. Fetch all profiles and customers
  const [{ data: allProfiles }, { data: allCustomers }] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("customers").select("*"),
  ]);

  const resultDrivers: DriverWithProfile[] = [];
  const processedUserIds = new Set<string>();
  const processedDriverIds = new Set<string>();

  for (const driver of (driversData || [])) {
    const raw = driver as any;
    if (raw.status === "deleted") {
      if (driver.user_id) processedUserIds.add(driver.user_id);
      if (driver.id) processedDriverIds.add(driver.id);
      continue;
    }

    const dUserId = driver.user_id || driver.id;
    if (driver.user_id) processedUserIds.add(driver.user_id);
    if (driver.id) processedDriverIds.add(driver.id);
    if (dUserId) {
      processedUserIds.add(dUserId);
      processedDriverIds.add(dUserId);
    }

    const dName = (raw.full_name || raw.name || "").trim().toLowerCase();

    const profile = allProfiles?.find(p => 
      (p.user_id && (p.user_id === driver.user_id || p.user_id === driver.id)) ||
      (p.id && (p.id === driver.user_id || p.id === driver.id)) ||
      (dName && (p.full_name || "").trim().toLowerCase() === dName)
    );

    const customer = allCustomers?.find(c =>
      (c.user_id && (c.user_id === driver.user_id || c.user_id === driver.id)) ||
      (c.id && (c.id === driver.user_id || c.id === driver.id)) ||
      (dName && (c.name || "").trim().toLowerCase() === dName)
    );

    resultDrivers.push({
      id: driver.id || driver.user_id,
      user_id: driver.user_id || driver.id,
      full_name: raw.full_name || profile?.full_name || customer?.name || raw.name || "Entregador",
      phone: raw.phone || raw.whatsapp || raw.celular || raw.telephone || profile?.phone || profile?.whatsapp || profile?.celular || customer?.phone || null,
      document: raw.document || raw.cpf || raw.cnpj || profile?.document || profile?.cpf || profile?.cnpj || customer?.cpf || customer?.document || null,
      avatar_url: raw.avatar_url || profile?.avatar_url || null,
      vehicle_type: raw.vehicle || raw.vehicle_type || profile?.vehicle || profile?.vehicle_type || "moto",
      vehicle_plate: raw.license_plate || raw.vehicle_plate || raw.plate || profile?.license_plate || profile?.vehicle_plate || profile?.plate || null,
      is_online: raw.is_online ?? raw.online ?? false,
      latitude: (raw.latitude !== null && raw.latitude !== undefined && raw.latitude !== "" && !isNaN(Number(raw.latitude))) 
        ? Number(raw.latitude) 
        : ((raw.current_latitude !== null && raw.current_latitude !== undefined && raw.current_latitude !== "" && !isNaN(Number(raw.current_latitude))) 
          ? Number(raw.current_latitude) 
          : ((profile?.latitude !== null && profile?.latitude !== undefined && !isNaN(Number(profile?.latitude))) 
            ? Number(profile.latitude) 
            : null)),
      longitude: (raw.longitude !== null && raw.longitude !== undefined && raw.longitude !== "" && !isNaN(Number(raw.longitude))) 
        ? Number(raw.longitude) 
        : ((raw.current_longitude !== null && raw.current_longitude !== undefined && raw.current_longitude !== "" && !isNaN(Number(raw.current_longitude))) 
          ? Number(profile.longitude) 
          : null),
      status: raw.status || "active",
      commission_rate: raw.commission_rate !== null && raw.commission_rate !== undefined ? Number(raw.commission_rate) : 25.00,
      service_types: raw.service_types || [],
      created_at: driver.created_at || profile?.created_at,
    });
  }

  // 3. Adiciona perfis com role de motorista que ainda não estão em delivery_drivers
  for (const profile of (allProfiles || [])) {
    const pUserId = profile.user_id || profile.id;
    const pRole = String(profile.role || "").toLowerCase();
    const pStatus = String(profile.status || "").toLowerCase();
    if (!pUserId || pStatus === "deleted" || pRole === "customer") continue;
    if (processedUserIds.has(pUserId) || processedDriverIds.has(pUserId)) continue;

    if (["driver", "motoboy", "entregador", "taxi", "mototaxi"].some(k => pRole.includes(k))) {
      const name = profile.full_name || "Entregador Cadastrado";
      if (/^driver\s+(one|two|three|four|five|\d+)/i.test(name.trim())) continue;

      resultDrivers.push({
        id: pUserId,
        user_id: pUserId,
        full_name: name,
        phone: profile.phone || profile.whatsapp || profile.celular || null,
        document: profile.document || profile.cpf || profile.cnpj || null,
        avatar_url: profile.avatar_url || null,
        vehicle_type: profile.vehicle || profile.vehicle_type || "moto",
        is_online: profile.is_online ?? profile.online ?? false,
        rating: 5.0,
        latitude: (profile.latitude !== null && profile.latitude !== undefined && !isNaN(Number(profile.latitude))) ? Number(profile.latitude) : null,
        longitude: (profile.longitude !== null && profile.longitude !== undefined && !isNaN(Number(profile.longitude))) ? Number(profile.longitude) : null,
        status: "active",
        commission_rate: 25.00,
        service_types: [],
        created_at: profile.created_at || new Date().toISOString(),
      });
      processedUserIds.add(pUserId);
      processedDriverIds.add(pUserId);
    }
  }

  return resultDrivers;
}

export function useDrivers() {
  return useQuery({
    queryKey: ["drivers"],
    queryFn: fetchDrivers,
    staleTime: 0,
    refetchInterval: 5000,
  });
}

export function useOnlineDrivers() {
  return useQuery({
    queryKey: ["drivers", "online"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_drivers")
        .select("*")
        .eq("is_online", true);

      if (error) throw error;
      if (!data) return [];

      const userIds = data.map(d => d.user_id);
      const { data: profiles } = userIds.length > 0
        ? await supabase
            .from("profiles")
            .select("user_id, full_name, phone, avatar_url, document")
            .in("user_id", userIds)
        : { data: [] };

      return data.map(driver => {
        const raw = driver as any;
        const profile = profiles?.find(p => p.user_id === driver.user_id);
        return {
          id: driver.id,
          user_id: driver.user_id,
          full_name: raw.full_name || profile?.full_name || "Entregador",
          phone: raw.phone || profile?.phone || null,
          document: raw.document || profile?.document || null,
          avatar_url: raw.avatar_url || profile?.avatar_url || null,
          vehicle_type: raw.vehicle_type || "motorcycle",
          vehicle_plate: raw.vehicle_plate || null,
          is_online: raw.is_online ?? raw.online ?? false,
          rating: Number(driver.rating) || 5.0,
          latitude: raw.latitude || raw.current_latitude || null,
          longitude: raw.longitude || raw.current_longitude || null,
          status: raw.status || "active",
          service_types: raw.service_types || [],
          created_at: driver.created_at,
        } as DriverWithProfile;
      });
    },
  });
}

export function useToggleDriverOnline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ driverId, isOnline }: { driverId: string; isOnline: boolean }) => {
      const { error } = await supabase
        .from("delivery_drivers")
        .update({ is_online: isOnline } as any)
        .eq("id", driverId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drivers"] });
    },
  });
}

export function useAvailableDeliveries() {
  return useQuery({
    queryKey: ["deliveries", "available"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("*, companies(name)")
        .in("status", ["pending", "broadcasted"])
        .is("driver_id", null);

      if (error) throw error;
      return data;
    },
  });
}

export function useAcceptDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ deliveryId, driverId }: { deliveryId: string; driverId: string }) => {
      const { data, error } = await supabase
        .from("deliveries")
        .update({
          driver_id: driverId,
          status: "accepted" as any,
          accepted_at: new Date().toISOString()
        })
        .eq("id", deliveryId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliveries"] });
    },
  });
}