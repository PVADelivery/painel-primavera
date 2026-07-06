-- =====================================================================
-- Criar / resetar usuário admin no Supabase externo
-- Rodar em: Supabase Dashboard → SQL Editor (projeto owlbzwsdcognrgolvnzg)
-- =====================================================================
-- Troque a senha abaixo se quiser outra:
--   Email: acaiprimaveradelivery01@gmail.com
--   Senha: PrimaveraAdmin@2026
-- =====================================================================

create extension if not exists pgcrypto;

do $$
declare
  v_email    text := 'acaiprimaveradelivery01@gmail.com';
  v_password text := 'PrimaveraAdmin@2026';
  v_user_id  uuid;
begin
  select id into v_user_id from auth.users where email = v_email;

  if v_user_id is null then
    v_user_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token,
      email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id, 'authenticated', 'authenticated', v_email,
      crypt(v_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email', v_user_id::text,
      now(), now(), now()
    );
  else
    update auth.users
       set encrypted_password = crypt(v_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at         = now()
     where id = v_user_id;
  end if;

  -- Garante role admin (tabela public.user_roles com enum app_role)
  insert into public.user_roles (user_id, role)
  values (v_user_id, 'admin')
  on conflict (user_id, role) do nothing;
end $$;

-- Conferir:
select id, email, email_confirmed_at from auth.users
 where email = 'acaiprimaveradelivery01@gmail.com';
