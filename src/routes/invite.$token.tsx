import { useState, useEffect } from "react";
import { useNavigate, createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle, User, Mail, Lock, Phone, Truck, Eye, EyeOff, Bike, Car, ArrowRight, ArrowLeft, ShieldCheck, Store, MapPin, Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute('/invite/$token')({
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    document: "",
    vehicle: "motorcycle",
    licensePlate: "",
    companyName: "",
    address: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isCompany = invitation?.role === "company";

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("Token não fornecido");
        setValidating(false);
        return;
      }

      try {
        const { data, error: fetchError } = await (supabase as any).rpc("get_invitation_by_token", { _token: token });
        if (fetchError) throw fetchError;

        const inv = data as any;

        if (!inv || inv.status !== "pending") {
          setError("Este link de convite é inválido ou já foi utilizado.");
        } else {
          const expiresAt = new Date(inv.expires_at);
          if (expiresAt < new Date()) {
            setError("Este link de convite expirou.");
          } else {
            setInvitation(inv);
            // Pre-fill email
            setFormData(prev => ({ ...prev, email: inv.email || "" }));
          }
        }
      } catch (err: any) {
        console.error("Erro na validação:", err);
        setError("Erro ao validar convite: " + err.message);
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    
    if (step < 2) {
      nextStep();
      return;
    }

    if (loading) return;
    
    setLoading(true);
    setFormError(null);
    if (formData.password !== formData.confirmPassword) {
      setFormError("As senhas não coincidem.");
      toast.error("As senhas não coincidem.");
      setLoading(false);
      return;
    }

    try {
      // Admin app uses accept-invitation Edge Function to ensure correct creation
      const { data: result, error: invokeError } = await supabase.functions.invoke("accept-invitation", {
        body: {
          token,
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          phone: formData.phone,
          document: formData.document,
          companyName: formData.companyName,
          // vehicle and licensePlate aren't supported directly by this specific Edge Function yet,
          // but we can pass them in case the backend gets updated to use them
          vehicle: formData.vehicle,
          license_plate: formData.licensePlate.toUpperCase(),
        },
      });

      if (invokeError) throw invokeError;
      if (result?.error) throw new Error(result.error);

      // Log in the user locally
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      if (signInError) throw signInError;

      // Se for empresa, fazemos um update extra para salvar o endereço (já que a EF não suporta address nativamente)
      if (isCompany && formData.address && signInData.user) {
        try {
          await supabase.from("companies").update({ address: formData.address }).eq("user_id", signInData.user.id);
        } catch (addrErr) {
          console.error("Erro ao salvar endereço:", addrErr);
        }
      }

      // Se for motorista, tentamos salvar veículo e placa via update
      if (!isCompany && signInData.user) {
        try {
           await supabase.from("delivery_drivers").update({ 
             vehicle: formData.vehicle as any, 
             license_plate: formData.licensePlate.toUpperCase() 
           }).eq("user_id", signInData.user.id);
        } catch (drvErr) {
           console.error("Erro ao salvar dados do veiculo:", drvErr);
        }
      }

      toast.success("Bem-vindo à equipe! Cadastro finalizado com sucesso.");
      
      const redirectPath = isCompany ? "/business" : "/driver";
      setTimeout(() => {
        window.location.href = redirectPath;
      }, 2000);

    } catch (err: any) {
      console.error("Erro no cadastro:", err);
      const errorMessage = err.message || "Erro ao realizar cadastro. Tente novamente.";
      setFormError(errorMessage);
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  const steps = isCompany 
    ? ["Credenciais", "Dados da Empresa", "Localização"]
    : ["Credenciais", "Dados Pessoais", "Veículo"];

  const nextStep = () => {
    if (step === 0 && (!formData.email || formData.password.length < 6 || formData.password !== formData.confirmPassword)) {
      toast.error("Preencha o email e uma senha válida de pelo menos 6 caracteres.");
      return;
    }
    
    if (step === 1) {
      if (isCompany) {
        if (!formData.companyName || !formData.fullName || !formData.phone || !formData.document) {
          toast.error("Preencha todos os dados da empresa.");
          return;
        }
      } else {
        if (!formData.fullName || !formData.phone || !formData.document) {
          toast.error("Preencha todos os seus dados pessoais.");
          return;
        }
      }
    }

    setStep(s => Math.min(s + 1, 2));
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full blur-xl bg-primary/20 animate-pulse" />
            <div className="h-16 w-16 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-center relative z-10 shadow-2xl">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
          <p className="text-xs font-black text-white/50 tracking-[0.2em] uppercase">Validando Convite...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
        <Card className="w-full max-w-md border-white/10 bg-slate-900/50 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500/50 via-red-500 to-red-500/50" />
          <CardHeader className="text-center pt-10">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <CardTitle className="text-2xl font-black text-white">Link Inválido</CardTitle>
            <CardDescription className="text-white/60 mt-2">{error}</CardDescription>
          </CardHeader>
          <CardContent className="pb-8">
            <Button className="w-full h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all" onClick={() => navigate({ to: "/login" })}>
              Ir para o Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 py-12 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] opacity-50 pointer-events-none" />
      
      <div className="w-full max-w-xl relative z-10">
        {/* Progress Steps Header */}
        <div className="flex items-center justify-between mb-8 px-2 relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/5 -z-10" />
          <div 
            className="absolute top-1/2 left-0 h-0.5 bg-primary transition-all duration-500 -z-10" 
            style={{ width: `${(step / 2) * 100}%` }} 
          />
          
          {steps.map((title, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div 
                className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm transition-all duration-500 border ${
                  step > i ? 'bg-primary border-primary text-primary-foreground shadow-[0_0_20px_rgba(255,69,0,0.3)]' :
                  step === i ? 'bg-slate-900 border-primary text-primary shadow-[0_0_20px_rgba(255,69,0,0.2)]' :
                  'bg-slate-900/50 border-white/10 text-white/30 backdrop-blur-md'
                }`}
              >
                {step > i ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${
                step >= i ? 'text-white' : 'text-white/30'
              }`}>
                {title}
              </span>
            </div>
          ))}
        </div>

        <Card className="border-white/10 bg-slate-900/40 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden rounded-3xl relative">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
          
          <CardHeader className="text-center pb-6 pt-10">
            <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mb-6 shadow-inner relative overflow-hidden">
              <div className="absolute inset-0 bg-primary/20 animate-pulse mix-blend-overlay" />
              {isCompany ? (
                <Store className="h-10 w-10 text-primary relative z-10" />
              ) : (
                <Truck className="h-10 w-10 text-primary relative z-10" />
              )}
            </div>
            <CardTitle className="text-3xl font-black tracking-tight text-white mb-2">
              {isCompany ? "Cadastro de Loja" : "Seja bem-vindo!"}
            </CardTitle>
            <CardDescription className="text-white/60">
              {steps[step]}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8 pb-10">
            <div className="space-y-6">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-4 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p>{formError}</p>
                </div>
              )}

              {/* STEP 0: CREDENCIAIS */}
              <div className={`space-y-5 transition-all duration-500 ${step === 0 ? 'opacity-100 block' : 'opacity-0 hidden'}`}>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-white/50 ml-1">Email de Acesso</Label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30 group-focus-within:text-primary transition-colors" />
                    <Input 
                      type="email"
                      className="pl-12 h-14 rounded-2xl bg-black/20 border-white/10 text-white placeholder:text-white/20 focus:bg-black/40 focus:border-primary/50 transition-all text-base" 
                      placeholder="exemplo@email.com"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      onKeyDown={e => e.key === 'Enter' && nextStep()}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-white/50 ml-1">Criar Senha</Label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30 group-focus-within:text-primary transition-colors" />
                    <Input 
                      type={showPassword ? "text" : "password"}
                      className="pl-12 pr-12 h-14 rounded-2xl bg-black/20 border-white/10 text-white placeholder:text-white/20 focus:bg-black/40 focus:border-primary/50 transition-all text-base tracking-wider" 
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      onKeyDown={e => e.key === 'Enter' && nextStep()}
                    />
                    <button 
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-white/50 ml-1">Confirmar Senha</Label>
                  <div className="relative group">
                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30 group-focus-within:text-primary transition-colors" />
                    <Input 
                      type={showConfirmPassword ? "text" : "password"}
                      className="pl-12 pr-12 h-14 rounded-2xl bg-black/20 border-white/10 text-white placeholder:text-white/20 focus:bg-black/40 focus:border-primary/50 transition-all text-base tracking-wider" 
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                      onKeyDown={e => e.key === 'Enter' && nextStep()}
                    />
                    <button 
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* STEP 1: DADOS PESSOAIS / EMPRESA */}
              <div className={`space-y-5 transition-all duration-500 ${step === 1 ? 'opacity-100 block' : 'opacity-0 hidden'}`}>
                {isCompany && (
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/50 ml-1">Nome da Loja</Label>
                    <div className="relative group">
                      <Store className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30 group-focus-within:text-primary transition-colors" />
                      <Input 
                        className="pl-12 h-14 rounded-2xl bg-black/20 border-white/10 text-white placeholder:text-white/20 focus:bg-black/40 focus:border-primary/50 transition-all text-base" 
                        placeholder="Nome Fantasia (ex: Lanchonete do Zé)"
                        value={formData.companyName}
                        onChange={e => setFormData({...formData, companyName: e.target.value})}
                        onKeyDown={e => e.key === 'Enter' && nextStep()}
                      />
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-white/50 ml-1">
                    {isCompany ? "Nome do Responsável" : "Nome Completo"}
                  </Label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30 group-focus-within:text-primary transition-colors" />
                    <Input 
                      className="pl-12 h-14 rounded-2xl bg-black/20 border-white/10 text-white placeholder:text-white/20 focus:bg-black/40 focus:border-primary/50 transition-all text-base" 
                      placeholder="João da Silva"
                      value={formData.fullName}
                      onChange={e => setFormData({...formData, fullName: e.target.value})}
                      onKeyDown={e => e.key === 'Enter' && nextStep()}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/50 ml-1">Telefone / WhatsApp</Label>
                    <div className="relative group">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30 group-focus-within:text-primary transition-colors" />
                      <Input 
                        className="pl-12 h-14 rounded-2xl bg-black/20 border-white/10 text-white placeholder:text-white/20 focus:bg-black/40 focus:border-primary/50 transition-all text-base" 
                        placeholder="(00) 00000-0000"
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                        onKeyDown={e => e.key === 'Enter' && nextStep()}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/50 ml-1">
                      {isCompany ? "CNPJ" : "CPF"}
                    </Label>
                    <div className="relative group">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30 group-focus-within:text-primary transition-colors" />
                      <Input 
                        className="pl-12 h-14 rounded-2xl bg-black/20 border-white/10 text-white placeholder:text-white/20 focus:bg-black/40 focus:border-primary/50 transition-all text-base" 
                        placeholder={isCompany ? "00.000.000/0001-00" : "000.000.000-00"}
                        value={formData.document}
                        onChange={e => setFormData({...formData, document: e.target.value})}
                        onKeyDown={e => e.key === 'Enter' && nextStep()}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 2: VEÍCULO OU LOCALIZAÇÃO */}
              <div className={`space-y-5 transition-all duration-500 ${step === 2 ? 'opacity-100 block' : 'opacity-0 hidden'}`}>
                
                {isCompany ? (
                  // LOCALIZAÇÃO DA EMPRESA
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/50 ml-1">Endereço Completo</Label>
                    <div className="relative group">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30 group-focus-within:text-primary transition-colors" />
                      <Input 
                        className="pl-12 h-14 rounded-2xl bg-black/20 border-white/10 text-white placeholder:text-white/20 focus:bg-black/40 focus:border-primary/50 transition-all text-base" 
                        placeholder="Rua, Número, Bairro, Cidade"
                        value={formData.address}
                        onChange={e => setFormData({...formData, address: e.target.value})}
                      />
                    </div>
                  </div>
                ) : (
                  // VEÍCULO DO ENTREGADOR
                  <>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-white/50 ml-1">Tipo de Veículo</Label>
                      <Select 
                        value={formData.vehicle} 
                        onValueChange={(val) => setFormData({...formData, vehicle: val})}
                      >
                        <SelectTrigger className="h-14 rounded-2xl bg-black/20 border-white/10 text-white focus:ring-primary/50 focus:border-primary/50 transition-all text-base px-4">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-white/10 text-white rounded-2xl">
                          <SelectItem value="motorcycle" className="focus:bg-white/10 focus:text-white cursor-pointer py-3">
                            <div className="flex items-center gap-3">
                              <div className="bg-primary/20 p-2 rounded-lg"><Bike className="h-4 w-4 text-primary" /></div>
                              <span className="font-medium">Moto</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="bicycle" className="focus:bg-white/10 focus:text-white cursor-pointer py-3">
                            <div className="flex items-center gap-3">
                              <div className="bg-primary/20 p-2 rounded-lg"><Bike className="h-4 w-4 text-primary" /></div>
                              <span className="font-medium">Bicicleta</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="car" className="focus:bg-white/10 focus:text-white cursor-pointer py-3">
                            <div className="flex items-center gap-3">
                              <div className="bg-primary/20 p-2 rounded-lg"><Car className="h-4 w-4 text-primary" /></div>
                              <span className="font-medium">Carro</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="van" className="focus:bg-white/10 focus:text-white cursor-pointer py-3">
                            <div className="flex items-center gap-3">
                              <div className="bg-primary/20 p-2 rounded-lg"><Truck className="h-4 w-4 text-primary" /></div>
                              <span className="font-medium">Van / Utilitário</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-white/50 ml-1">Placa do Veículo (Se aplicável)</Label>
                      <div className="relative group">
                        <Truck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30 group-focus-within:text-primary transition-colors" />
                        <Input 
                          className="pl-12 h-14 rounded-2xl bg-black/20 border-white/10 text-white placeholder:text-white/20 focus:bg-black/40 focus:border-primary/50 transition-all text-base uppercase" 
                          placeholder="ABC1D23"
                          value={formData.licensePlate}
                          onChange={e => setFormData({...formData, licensePlate: e.target.value})}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* NAVIGATION BUTTONS */}
              <div className="flex gap-4 pt-4">
                {step > 0 && (
                  <Button 
                    key="btn-prev"
                    type="button" 
                    variant="outline"
                    onClick={() => setStep(s => s - 1)}
                    className="h-14 px-6 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white transition-all"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                )}
                
                {step < 2 ? (
                  <Button 
                    key="btn-next"
                    type="button" 
                    onClick={nextStep}
                    className="flex-1 h-14 rounded-2xl font-black text-sm uppercase tracking-widest shadow-[0_0_30px_rgba(255,69,0,0.3)] hover:shadow-[0_0_40px_rgba(255,69,0,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all bg-primary hover:bg-primary/90 text-primary-foreground group"
                  >
                    Próximo Passo
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                ) : (
                  <Button 
                    key="btn-submit"
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 h-14 rounded-2xl font-black text-sm uppercase tracking-widest shadow-[0_0_30px_rgba(255,69,0,0.3)] hover:shadow-[0_0_40px_rgba(255,69,0,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all bg-primary hover:bg-primary/90 text-primary-foreground relative overflow-hidden"
                  >
                    {loading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                        Finalizar Cadastro
                        <CheckCircle2 className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                )}
              </div>

            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
