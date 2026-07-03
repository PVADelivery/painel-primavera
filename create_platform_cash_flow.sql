-- Cria a tabela platform_cash_flow para lançamentos globais da plataforma (Açaí Primavera)
CREATE TABLE IF NOT EXISTS public.platform_cash_flow (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Configura as políticas de RLS (Row Level Security)
ALTER TABLE public.platform_cash_flow ENABLE ROW LEVEL SECURITY;

-- Como essa tabela é global, apenas usuários que são superadmins ou admins da plataforma (ou auth.users p/ simplificar caso haja 1 admin) podem ler/escrever.
-- Se o projeto usar a tabela `user_roles`, podemos verificar se tem role de admin lá.
-- Se usou o `profiles` do painel-primavera, checamos o role lá.

CREATE POLICY "Platform admins can view cash flow"
    ON public.platform_cash_flow
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Platform admins can insert cash flow"
    ON public.platform_cash_flow
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Platform admins can update cash flow"
    ON public.platform_cash_flow
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Platform admins can delete cash flow"
    ON public.platform_cash_flow
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );
