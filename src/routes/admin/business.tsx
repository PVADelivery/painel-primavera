import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  useProperties, useCreateProperty, useUpdateProperty, useDeleteProperty, Property, PropertyDeal, PropertyType,
  useVehicles, useCreateVehicle, useUpdateVehicle, useDeleteVehicle, Vehicle, VehicleType
} from "@/services/business";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Building2, Home, Car, Plus, Search, Trash2, Edit3, Phone,
  CheckCircle2, XCircle, MapPin, Tag, Fuel, Gauge, Sparkles, Filter
} from "lucide-react";
import { WhatsappIcon } from "@/components/icons/WhatsappIcon";

export const Route = createFileRoute("/admin/business")({
  component: BusinessAdminPage,
});

export function BusinessAdminPage() {
  const [activeTab, setActiveTab] = useState<"properties" | "vehicles">("properties");
  const [search, setSearch] = useState("");
  const [dealFilter, setDealFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Queries
  const { data: properties = [], isLoading: loadingProps } = useProperties();
  const { data: vehicles = [], isLoading: loadingVehicles } = useVehicles();

  // Mutations
  const createProp = useCreateProperty();
  const updateProp = useUpdateProperty();
  const deleteProp = useDeleteProperty();

  const createVeh = useCreateVehicle();
  const updateVeh = useUpdateVehicle();
  const deleteVeh = useDeleteVehicle();

  // Modal State Imóvel
  const [propModalOpen, setPropModalOpen] = useState(false);
  const [editingProp, setEditingProp] = useState<Property | null>(null);
  const [propForm, setPropForm] = useState<Partial<Property>>({
    deal_type: "locacao",
    property_type: "casa",
    city: "Primavera do Leste",
    state: "MT",
    is_active: true,
    images: [],
  });

  // Modal State Veículo
  const [vehModalOpen, setVehModalOpen] = useState(false);
  const [editingVeh, setEditingVeh] = useState<Vehicle | null>(null);
  const [vehForm, setVehForm] = useState<Partial<Vehicle>>({
    vehicle_type: "carro",
    city: "Primavera do Leste",
    state: "MT",
    is_active: true,
    images: [],
  });

  // Filtragem Imóveis
  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      const matchSearch =
        !search ||
        (p.neighborhood || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.description || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.agency_name || "").toLowerCase().includes(search.toLowerCase());
      const matchDeal = dealFilter === "all" || p.deal_type === dealFilter;
      const matchType = typeFilter === "all" || p.property_type === typeFilter;
      return matchSearch && matchDeal && matchType;
    });
  }, [properties, search, dealFilter, typeFilter]);

  // Filtragem Veículos
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const matchSearch =
        !search ||
        (v.model || "").toLowerCase().includes(search.toLowerCase()) ||
        (v.brand || "").toLowerCase().includes(search.toLowerCase()) ||
        (v.seller_name || "").toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || v.vehicle_type === typeFilter;
      return matchSearch && matchType;
    });
  }, [vehicles, search, typeFilter]);

  // Handlers Imóvel
  const openNewPropModal = () => {
    setEditingProp(null);
    setPropForm({
      deal_type: "locacao",
      property_type: "casa",
      city: "Primavera do Leste",
      state: "MT",
      is_active: true,
      images: [],
    });
    setPropModalOpen(true);
  };

  const openEditPropModal = (p: Property) => {
    setEditingProp(p);
    setPropForm(p);
    setPropModalOpen(true);
  };

  const handleSaveProp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProp) {
        await updateProp.mutateAsync({ id: editingProp.id, data: propForm });
        toast.success("Imóvel atualizado com sucesso!");
      } else {
        await createProp.mutateAsync(propForm);
        toast.success("Imóvel cadastrado com sucesso!");
      }
      setPropModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar imóvel");
    }
  };

  const handleDeleteProp = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este imóvel?")) return;
    try {
      await deleteProp.mutateAsync(id);
      toast.success("Imóvel excluído!");
    } catch (err: any) {
      toast.error("Erro ao excluir imóvel");
    }
  };

  // Handlers Veículo
  const openNewVehModal = () => {
    setEditingVeh(null);
    setVehForm({
      vehicle_type: "carro",
      city: "Primavera do Leste",
      state: "MT",
      is_active: true,
      images: [],
    });
    setVehModalOpen(true);
  };

  const openEditVehModal = (v: Vehicle) => {
    setEditingVeh(v);
    setVehForm(v);
    setVehModalOpen(true);
  };

  const handleSaveVeh = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehForm.model?.trim()) {
      toast.error("Informe o modelo do veículo");
      return;
    }
    try {
      if (editingVeh) {
        await updateVeh.mutateAsync({ id: editingVeh.id, data: vehForm });
        toast.success("Veículo atualizado com sucesso!");
      } else {
        await createVeh.mutateAsync(vehForm);
        toast.success("Veículo cadastrado com sucesso!");
      }
      setVehModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar veículo");
    }
  };

  const handleDeleteVeh = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este veículo?")) return;
    try {
      await deleteVeh.mutateAsync(id);
      toast.success("Veículo excluído!");
    } catch (err: any) {
      toast.error("Erro ao excluir veículo");
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
              <Building2 className="h-7 w-7 text-primary" />
              Central de Negócios
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gestão de imóveis (locação/venda) e veículos anunciados no app
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "properties" ? (
              <Button onClick={openNewPropModal} className="font-bold gap-1.5 shadow-md">
                <Plus className="h-4 w-4" /> Novo Imóvel
              </Button>
            ) : (
              <Button onClick={openNewVehModal} className="font-bold gap-1.5 shadow-md">
                <Plus className="h-4 w-4" /> Novo Veículo
              </Button>
            )}
          </div>
        </div>

        {/* Métricas Rápidas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="bg-card/70 border-border/80 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Imóveis</p>
                <p className="text-2xl font-black text-foreground mt-1">{properties.length}</p>
              </div>
              <Home className="h-8 w-8 text-primary/30" />
            </CardContent>
          </Card>
          <Card className="bg-card/70 border-border/80 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Para Locação</p>
                <p className="text-2xl font-black text-emerald-500 mt-1">
                  {properties.filter((p) => p.deal_type === "locacao").length}
                </p>
              </div>
              <Tag className="h-8 w-8 text-emerald-500/30" />
            </CardContent>
          </Card>
          <Card className="bg-card/70 border-border/80 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Para Venda</p>
                <p className="text-2xl font-black text-amber-500 mt-1">
                  {properties.filter((p) => p.deal_type === "venda").length}
                </p>
              </div>
              <Sparkles className="h-8 w-8 text-amber-500/30" />
            </CardContent>
          </Card>
          <Card className="bg-card/70 border-border/80 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Veículos</p>
                <p className="text-2xl font-black text-blue-500 mt-1">{vehicles.length}</p>
              </div>
              <Car className="h-8 w-8 text-blue-500/30" />
            </CardContent>
          </Card>
        </div>

        {/* Abas e Filtros */}
        <Tabs value={activeTab} onValueChange={(v: any) => { setActiveTab(v); setTypeFilter("all"); }} className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-3">
            <TabsList className="bg-muted/60 p-1">
              <TabsTrigger value="properties" className="gap-2 font-bold text-xs">
                <Home className="h-3.5 w-3.5" /> Imóveis ({properties.length})
              </TabsTrigger>
              <TabsTrigger value="vehicles" className="gap-2 font-bold text-xs">
                <Car className="h-3.5 w-3.5" /> Veículos ({vehicles.length})
              </TabsTrigger>
            </TabsList>

            {/* Barra de Busca e Filtros */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar anúncio..."
                  className="pl-8 h-9 text-xs"
                />
              </div>

              {activeTab === "properties" && (
                <select
                  value={dealFilter}
                  onChange={(e) => setDealFilter(e.target.value)}
                  className="h-9 px-2.5 rounded-lg border border-border bg-background text-xs font-semibold text-foreground focus:outline-none"
                >
                  <option value="all">Todas modalidades</option>
                  <option value="locacao">Locação</option>
                  <option value="venda">Venda</option>
                </select>
              )}
            </div>
          </div>

          {/* ══════════════ ABA: IMÓVEIS ══════════════ */}
          <TabsContent value="properties" className="space-y-4 mt-0">
            {loadingProps ? (
              <p className="text-center py-12 text-sm text-muted-foreground">Carregando imóveis...</p>
            ) : filteredProperties.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-2xl p-6 bg-card/40">
                <Home className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <h3 className="font-bold text-base text-foreground">Nenhum imóvel encontrado</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Cadastre o primeiro imóvel para locação ou venda na Central de Negócios.
                </p>
                <Button onClick={openNewPropModal} size="sm" className="mt-4 font-bold gap-1">
                  <Plus className="h-4 w-4" /> Adicionar Primeiro Imóvel
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProperties.map((p) => {
                  const cover = p.images?.[0] || null;
                  return (
                    <Card key={p.id} className="overflow-hidden border-border/80 bg-card hover:border-primary/40 transition-all flex flex-col shadow-sm">
                      {/* Foto ou Placeholder */}
                      <div className="relative aspect-[16/9] bg-muted overflow-hidden">
                        {cover ? (
                          <img src={cover} alt={p.property_type} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-1">
                            <Home className="h-10 w-10" />
                            <span className="text-[10px] uppercase font-bold tracking-wider">Sem fotos</span>
                          </div>
                        )}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                          <Badge className={p.deal_type === "locacao" ? "bg-emerald-600 text-white font-black uppercase text-[10px]" : "bg-amber-500 text-slate-950 font-black uppercase text-[10px]"}>
                            {p.deal_type === "locacao" ? "Locação" : "Venda"}
                          </Badge>
                          <Badge variant="outline" className="bg-background/80 backdrop-blur-md uppercase text-[10px] font-bold">
                            {p.property_type}
                          </Badge>
                        </div>
                        <div className="absolute top-2.5 right-2.5">
                          <Badge className={p.is_active ? "bg-emerald-500/90 text-white font-bold text-[10px]" : "bg-destructive/80 text-white font-bold text-[10px]"}>
                            {p.is_active ? "Ativo" : "Pausado"}
                          </Badge>
                        </div>
                      </div>

                      {/* Conteúdo */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-extrabold text-base text-foreground capitalize">
                              {p.property_type} em {p.neighborhood || "Primavera do Leste"}
                            </h3>
                          </div>

                          <p className="text-sm font-black text-primary mt-1">
                            {p.price ? `R$ ${Number(p.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Consulte valor"}
                            {p.deal_type === "locacao" && <span className="text-xs text-muted-foreground font-normal"> /mês</span>}
                          </p>

                          {p.description && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                              {p.description}
                            </p>
                          )}

                          {/* Especificações */}
                          <div className="flex items-center gap-3 mt-3 text-[11px] font-bold text-muted-foreground border-t border-border/50 pt-2 flex-wrap">
                            {p.bedrooms && <span>🛏️ {p.bedrooms} qtos</span>}
                            {p.bathrooms && <span>🚿 {p.bathrooms} banh</span>}
                            {p.parking && <span>🚗 {p.parking} vagas</span>}
                            {p.total_area && <span>📐 {p.total_area} m²</span>}
                          </div>

                          {p.contact_phone && (
                            <p className="text-[11px] font-semibold text-slate-300 mt-2 flex items-center gap-1.5">
                              <WhatsappIcon className="w-3 h-3 text-[#25D366]" />
                              {p.contact_phone}
                            </p>
                          )}
                        </div>

                        {/* Ações */}
                        <div className="border-t border-border pt-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={p.is_active}
                              onCheckedChange={(checked) => updateProp.mutate({ id: p.id, data: { is_active: checked } })}
                            />
                            <span className="text-[11px] text-muted-foreground font-medium">
                              {p.is_active ? "Ativo" : "Oculto"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-foreground" onClick={() => openEditPropModal(p)}>
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteProp(p.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ══════════════ ABA: VEÍCULOS ══════════════ */}
          <TabsContent value="vehicles" className="space-y-4 mt-0">
            {loadingVehicles ? (
              <p className="text-center py-12 text-sm text-muted-foreground">Carregando veículos...</p>
            ) : filteredVehicles.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-2xl p-6 bg-card/40">
                <Car className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <h3 className="font-bold text-base text-foreground">Nenhum veículo cadastrado</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Cadastre carros, motos e veículos para venda na Central de Negócios.
                </p>
                <Button onClick={openNewVehModal} size="sm" className="mt-4 font-bold gap-1">
                  <Plus className="h-4 w-4" /> Adicionar Primeiro Veículo
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVehicles.map((v) => {
                  const cover = v.images?.[0] || null;
                  return (
                    <Card key={v.id} className="overflow-hidden border-border/80 bg-card hover:border-primary/40 transition-all flex flex-col shadow-sm">
                      {/* Foto ou Placeholder */}
                      <div className="relative aspect-[16/9] bg-muted overflow-hidden">
                        {cover ? (
                          <img src={cover} alt={v.model} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-1">
                            <Car className="h-10 w-10" />
                            <span className="text-[10px] uppercase font-bold tracking-wider">Sem fotos</span>
                          </div>
                        )}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                          <Badge className="bg-blue-600 text-white font-black uppercase text-[10px]">
                            {v.vehicle_type}
                          </Badge>
                          {v.year && (
                            <Badge variant="outline" className="bg-background/80 backdrop-blur-md text-[10px] font-bold">
                              {v.year}
                            </Badge>
                          )}
                        </div>
                        <div className="absolute top-2.5 right-2.5">
                          <Badge className={v.is_active ? "bg-emerald-500/90 text-white font-bold text-[10px]" : "bg-destructive/80 text-white font-bold text-[10px]"}>
                            {v.is_active ? "Ativo" : "Pausado"}
                          </Badge>
                        </div>
                      </div>

                      {/* Conteúdo */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <h3 className="font-extrabold text-base text-foreground leading-snug">
                            {v.brand ? `${v.brand} ` : ""}{v.model}
                          </h3>

                          <p className="text-sm font-black text-primary mt-1">
                            {v.price ? `R$ ${Number(v.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Consulte valor"}
                          </p>

                          {v.description && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                              {v.description}
                            </p>
                          )}

                          {/* Especificações do Veículo */}
                          <div className="flex items-center gap-3 mt-3 text-[11px] font-bold text-muted-foreground border-t border-border/50 pt-2 flex-wrap">
                            {v.km != null && <span><Gauge className="inline h-3 w-3 mr-0.5" /> {v.km.toLocaleString()} km</span>}
                            {v.fuel && <span><Fuel className="inline h-3 w-3 mr-0.5" /> {v.fuel}</span>}
                            {v.transmission && <span>🕹️ {v.transmission}</span>}
                            {v.color && <span>🎨 {v.color}</span>}
                          </div>

                          {v.contact_phone && (
                            <p className="text-[11px] font-semibold text-slate-300 mt-2 flex items-center gap-1.5">
                              <WhatsappIcon className="w-3 h-3 text-[#25D366]" />
                              {v.contact_phone}
                            </p>
                          )}
                        </div>

                        {/* Ações */}
                        <div className="border-t border-border pt-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={v.is_active}
                              onCheckedChange={(checked) => updateVeh.mutate({ id: v.id, data: { is_active: checked } })}
                            />
                            <span className="text-[11px] text-muted-foreground font-medium">
                              {v.is_active ? "Ativo" : "Oculto"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-foreground" onClick={() => openEditVehModal(v)}>
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteVeh(v.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ══════════════ MODAL: CADASTRO / EDIÇÃO IMÓVEL ══════════════ */}
        <Dialog open={propModalOpen} onOpenChange={setPropModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Home className="h-5 w-5 text-primary" />
                {editingProp ? "Editar Imóvel" : "Cadastrar Novo Imóvel"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSaveProp} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Modalidade</label>
                  <select
                    value={propForm.deal_type}
                    onChange={(e) => setPropForm({ ...propForm, deal_type: e.target.value as PropertyDeal })}
                    className="w-full mt-1 h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold"
                  >
                    <option value="locacao">Locação (Aluguel)</option>
                    <option value="venda">Venda</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground">Tipo de Imóvel</label>
                  <select
                    value={propForm.property_type}
                    onChange={(e) => setPropForm({ ...propForm, property_type: e.target.value as PropertyType })}
                    className="w-full mt-1 h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold"
                  >
                    <option value="casa">Casa</option>
                    <option value="apartamento">Apartamento</option>
                    <option value="sala">Sala Comercial</option>
                    <option value="kitnet">Kitnet</option>
                    <option value="terreno">Terreno</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Bairro</label>
                  <Input
                    value={propForm.neighborhood || ""}
                    onChange={(e) => setPropForm({ ...propForm, neighborhood: e.target.value })}
                    placeholder="Ex: Centro, Primavera II..."
                    className="h-9 text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Preço (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={propForm.price || ""}
                    onChange={(e) => setPropForm({ ...propForm, price: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Ex: 1500.00"
                    className="h-9 text-xs mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground">Quartos</label>
                  <Input
                    type="number"
                    value={propForm.bedrooms || ""}
                    onChange={(e) => setPropForm({ ...propForm, bedrooms: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Ex: 2"
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground">Banheiros</label>
                  <Input
                    type="number"
                    value={propForm.bathrooms || ""}
                    onChange={(e) => setPropForm({ ...propForm, bathrooms: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Ex: 1"
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground">Vagas Garagem</label>
                  <Input
                    type="number"
                    value={propForm.parking || ""}
                    onChange={(e) => setPropForm({ ...propForm, parking: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Ex: 1"
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground">Área Total (m²)</label>
                  <Input
                    type="number"
                    value={propForm.total_area || ""}
                    onChange={(e) => setPropForm({ ...propForm, total_area: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Ex: 120"
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Imobiliária / Corretor</label>
                  <Input
                    value={propForm.agency_name || ""}
                    onChange={(e) => setPropForm({ ...propForm, agency_name: e.target.value })}
                    placeholder="Nome da imobiliária ou proprietário"
                    className="h-9 text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Telefone / WhatsApp Contato</label>
                  <Input
                    value={propForm.contact_phone || ""}
                    onChange={(e) => setPropForm({ ...propForm, contact_phone: e.target.value })}
                    placeholder="Ex: (66) 9719-6937"
                    className="h-9 text-xs mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">URL da Imagem de Capa</label>
                <Input
                  value={propForm.images?.[0] || ""}
                  onChange={(e) => setPropForm({ ...propForm, images: e.target.value ? [e.target.value] : [] })}
                  placeholder="https://exemplo.com/foto-imovel.jpg"
                  className="h-9 text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">Descrição Completa</label>
                <Textarea
                  value={propForm.description || ""}
                  onChange={(e) => setPropForm({ ...propForm, description: e.target.value })}
                  placeholder="Descreva detalhes como armários embutidos, portão eletrônico, sacada, etc..."
                  className="text-xs mt-1 min-h-20"
                />
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={propForm.is_active}
                    onCheckedChange={(checked) => setPropForm({ ...propForm, is_active: checked })}
                  />
                  <span className="text-xs font-semibold">Exibir anúncio publicamente</span>
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setPropModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" className="font-bold">
                    {editingProp ? "Salvar Alterações" : "Cadastrar Imóvel"}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ══════════════ MODAL: CADASTRO / EDIÇÃO VEÍCULO ══════════════ */}
        <Dialog open={vehModalOpen} onOpenChange={setVehModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Car className="h-5 w-5 text-blue-500" />
                {editingVeh ? "Editar Veículo" : "Cadastrar Novo Veículo"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSaveVeh} className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Tipo de Veículo</label>
                  <select
                    value={vehForm.vehicle_type}
                    onChange={(e) => setVehForm({ ...vehForm, vehicle_type: e.target.value as VehicleType })}
                    className="w-full mt-1 h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold"
                  >
                    <option value="carro">Carro</option>
                    <option value="moto">Moto</option>
                    <option value="caminhao">Caminhão</option>
                    <option value="utilitario">Utilitário</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Marca</label>
                  <Input
                    value={vehForm.brand || ""}
                    onChange={(e) => setVehForm({ ...vehForm, brand: e.target.value })}
                    placeholder="Ex: Toyota, Honda, Fiat..."
                    className="h-9 text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Modelo *</label>
                  <Input
                    required
                    value={vehForm.model || ""}
                    onChange={(e) => setVehForm({ ...vehForm, model: e.target.value })}
                    placeholder="Ex: Corolla XEi, Civic..."
                    className="h-9 text-xs mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground">Ano</label>
                  <Input
                    type="number"
                    value={vehForm.year || ""}
                    onChange={(e) => setVehForm({ ...vehForm, year: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Ex: 2022"
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground">Quilometragem (km)</label>
                  <Input
                    type="number"
                    value={vehForm.km != null ? vehForm.km : ""}
                    onChange={(e) => setVehForm({ ...vehForm, km: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Ex: 45000"
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground">Câmbio</label>
                  <Input
                    value={vehForm.transmission || ""}
                    onChange={(e) => setVehForm({ ...vehForm, transmission: e.target.value })}
                    placeholder="Ex: Automático"
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground">Combustível</label>
                  <Input
                    value={vehForm.fuel || ""}
                    onChange={(e) => setVehForm({ ...vehForm, fuel: e.target.value })}
                    placeholder="Ex: Flex, Diesel"
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Preço (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={vehForm.price || ""}
                    onChange={(e) => setVehForm({ ...vehForm, price: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Ex: 95000.00"
                    className="h-9 text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Vendedor / Loja</label>
                  <Input
                    value={vehForm.seller_name || ""}
                    onChange={(e) => setVehForm({ ...vehForm, seller_name: e.target.value })}
                    placeholder="Nome do vendedor ou loja"
                    className="h-9 text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">WhatsApp Contato</label>
                  <Input
                    value={vehForm.contact_phone || ""}
                    onChange={(e) => setVehForm({ ...vehForm, contact_phone: e.target.value })}
                    placeholder="Ex: (66) 9719-6937"
                    className="h-9 text-xs mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">URL da Imagem de Capa</label>
                <Input
                  value={vehForm.images?.[0] || ""}
                  onChange={(e) => setVehForm({ ...vehForm, images: e.target.value ? [e.target.value] : [] })}
                  placeholder="https://exemplo.com/foto-veiculo.jpg"
                  className="h-9 text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">Descrição Completa</label>
                <Textarea
                  value={vehForm.description || ""}
                  onChange={(e) => setVehForm({ ...vehForm, description: e.target.value })}
                  placeholder="Descreva opcionais, estado dos pneus, revisões, etc..."
                  className="text-xs mt-1 min-h-20"
                />
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={vehForm.is_active}
                    onCheckedChange={(checked) => setVehForm({ ...vehForm, is_active: checked })}
                  />
                  <span className="text-xs font-semibold">Exibir anúncio publicamente</span>
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setVehModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" className="font-bold">
                    {editingVeh ? "Salvar Alterações" : "Cadastrar Veículo"}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
