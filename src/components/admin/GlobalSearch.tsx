import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2, Store, User, Truck, X, ArrowRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "company" | "driver" | "delivery" | "customer";
  title: string;
  subtitle?: string;
  url: string;
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleSearch = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const searchPromises = [
          // Search Companies by name, email, phone, or address
          supabase.from("companies").select("id, name, address").or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%,address.ilike.%${query}%`).limit(3),
          // Search Profiles (Drivers) by name or phone
          supabase.from("profiles").select("id, full_name, role").or(`full_name.ilike.%${query}%,phone.ilike.%${query}%`).eq("role", "driver").limit(3),
          // Search Profiles (Customers) by name or phone
          supabase.from("profiles").select("id, full_name, role").or(`full_name.ilike.%${query}%,phone.ilike.%${query}%`).eq("role", "customer").limit(3),
          // Search Deliveries by customer_name, customer_phone, or address
          supabase.from("deliveries").select("id, customer_name, status").or(`customer_name.ilike.%${query}%,customer_phone.ilike.%${query}%,address.ilike.%${query}%,dropoff_address.ilike.%${query}%`).limit(3)
        ];

        const resps = await Promise.all(searchPromises);
        
        const combined: SearchResult[] = [
          ...(resps[0].data || []).map(c => ({ 
            id: c.id, type: "company" as const, title: c.name, subtitle: c.address || undefined, url: `/admin/companies` 
          })),
          ...(resps[1].data || []).map(d => ({ 
            id: d.id, type: "driver" as const, title: d.full_name, subtitle: "Entregador", url: `/admin/drivers` 
          })),
          ...(resps[2].data || []).map(c => ({ 
            id: c.id, type: "customer" as const, title: c.full_name, subtitle: "Cliente", url: `/admin/customers` 
          })),
          ...(resps[3].data || []).map(del => ({ 
            id: del.id, type: "delivery" as const, title: `Pedido #${del.id.slice(0, 6)}`, subtitle: del.customer_name || undefined, url: `/admin/deliveries` 
          }))
        ];

        setResults(combined);
      } catch (err) {
        console.error("Global search error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(handleSearch, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (url: string) => {
    navigate({ to: url as any });
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <div className={cn(
        "flex items-center gap-2 bg-muted rounded-xl px-3 py-2 border transition-all duration-300 w-48 lg:w-64",
        isOpen ? "border-primary bg-background shadow-lg" : "border-transparent"
      )}>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Search className="h-4 w-4 text-muted-foreground" />}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Buscar no sistema..."
          className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground font-medium"
        />
        {query && (
          <button onClick={() => setQuery("")} className="p-1 hover:bg-muted rounded-full">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {isOpen && (query.length >= 2 || results.length > 0) && (
        <div className="absolute top-full right-0 mt-2 w-[320px] bg-background border border-border shadow-2xl rounded-2xl overflow-hidden py-2 animate-in fade-in slide-in-from-top-2 duration-200 z-[100]">
          {results.length === 0 ? (
            <div className="p-8 text-center">
              {isLoading ? (
                <p className="text-sm text-muted-foreground italic">Buscando...</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Nenhum resultado para "{query}"</p>
              )}
            </div>
          ) : (
            <div>
              <div className="px-3 py-1 flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resultados Encontrados</span>
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{results.length}</span>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
                {results.map((res) => (
                  <button
                    key={`${res.type}-${res.id}`}
                    onClick={() => handleSelect(res.url)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-primary/5 transition-colors group"
                  >
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                      {res.type === "company" && <Store className="h-4 w-4 text-primary" />}
                      {res.type === "driver" && <User className="h-4 w-4 text-success" />}
                      {res.type === "customer" && <User className="h-4 w-4 text-info" />}
                      {res.type === "delivery" && <Truck className="h-4 w-4 text-warning" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate">{res.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{res.subtitle}</p>
                    </div>
                    <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
