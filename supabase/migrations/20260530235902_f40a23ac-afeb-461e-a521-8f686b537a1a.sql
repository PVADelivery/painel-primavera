
-- Games catalog
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  cover_url TEXT,
  followers_count INT NOT NULL DEFAULT 0,
  trending BOOLEAN NOT NULL DEFAULT false,
  upcoming BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.games TO anon, authenticated;
GRANT ALL ON public.games TO service_role;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "games readable by all" ON public.games FOR SELECT USING (true);
CREATE POLICY "admins manage games" ON public.games FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Clips (videos)
CREATE TABLE public.clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  video_url TEXT,
  duration_seconds INT NOT NULL DEFAULT 30,
  liked BOOLEAN NOT NULL DEFAULT false,
  favorite BOOLEAN NOT NULL DEFAULT false,
  views INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clips TO authenticated;
GRANT ALL ON public.clips TO service_role;
ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads clips" ON public.clips FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owner writes clips" ON public.clips FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner updates clips" ON public.clips FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owner deletes clips" ON public.clips FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- Albums
CREATE TABLE public.albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cover_url TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  system_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.albums TO authenticated;
GRANT ALL ON public.albums TO service_role;
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads albums" ON public.albums FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owner writes albums" ON public.albums FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner updates albums" ON public.albums FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owner deletes albums" ON public.albums FOR DELETE TO authenticated USING (auth.uid() = owner_id AND is_system = false);
CREATE TRIGGER albums_touch BEFORE UPDATE ON public.albums FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Album <-> Clip
CREATE TABLE public.album_clips (
  album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  clip_id UUID NOT NULL REFERENCES public.clips(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (album_id, clip_id)
);
GRANT SELECT, INSERT, DELETE ON public.album_clips TO authenticated;
GRANT ALL ON public.album_clips TO service_role;
ALTER TABLE public.album_clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages album_clips" ON public.album_clips FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.albums a WHERE a.id = album_id AND a.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.albums a WHERE a.id = album_id AND a.owner_id = auth.uid()));

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  pinned BOOLEAN NOT NULL DEFAULT false,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner updates notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner deletes notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner inserts notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Friendships (simple)
CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see own friendships" ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() IN (requester_id, addressee_id));
CREATE POLICY "request friendship" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "update own friendship" ON public.friendships FOR UPDATE TO authenticated
  USING (auth.uid() IN (requester_id, addressee_id));
CREATE POLICY "delete own friendship" ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() IN (requester_id, addressee_id));

-- Auto-create system albums on signup
CREATE OR REPLACE FUNCTION public.create_system_albums()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.albums (owner_id, name, is_system, system_key) VALUES
    (NEW.id, 'Liked', true, 'liked'),
    (NEW.id, 'Favoritos', true, 'favorites'),
    (NEW.id, 'Clips You Are In', true, 'clips_in'),
    (NEW.id, 'Enviado por amigos', true, 'sent_by_friends'),
    (NEW.id, 'Watch History', true, 'history'),
    (NEW.id, 'Recentemente excluído', true, 'trash');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created_albums ON auth.users;
CREATE TRIGGER on_auth_user_created_albums
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_system_albums();

-- Backfill albums for existing users
INSERT INTO public.albums (owner_id, name, is_system, system_key)
SELECT u.id, x.name, true, x.key
FROM auth.users u
CROSS JOIN (VALUES
  ('Liked','liked'),('Favoritos','favorites'),('Clips You Are In','clips_in'),
  ('Enviado por amigos','sent_by_friends'),('Watch History','history'),('Recentemente excluído','trash')
) AS x(name, key)
ON CONFLICT DO NOTHING;

-- Seed games
INSERT INTO public.games (name, cover_url, followers_count, trending) VALUES
  ('Roblox','https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400', 13000000, true),
  ('Minecraft','https://images.unsplash.com/photo-1587573089734-09cb69c0f2b4?w=400', 5300000, true),
  ('Valorant','https://images.unsplash.com/photo-1542751110-97427bbecf20?w=400', 18000000, true),
  ('GTA V','https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=400', 12000000, true),
  ('Counter-Strike 2','https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400', 196000, true),
  ('Rocket League','https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=400', 3000000, true),
  ('Fortnite','https://images.unsplash.com/photo-1589241062272-c0a000072dfa?w=400', 10000000, true),
  ('League of Legends','https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400', 2100000, true),
  ('Forza Horizon 6','https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400', 2200, false),
  ('Overwatch','https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400', 573000, false),
  ('Rainbow Six Siege','https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=400', 1600000, false),
  ('Geometry Dash','https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400', 216000, false),
  ('Dead By Daylight','https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400', 759000, false),
  ('Marvel Rivals','https://images.unsplash.com/photo-1635805737707-575885ab0820?w=400', 34000, false),
  ('Apex Legends','https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400', 1700000, false),
  ('Roblox Studio','https://images.unsplash.com/photo-1556438064-2d7646166914?w=400', 380000, false),
  ('Subnautica 2','https://images.unsplash.com/photo-1500964757637-c85e8a162699?w=400', 50000, true),
  ('Gamble With Your Friends','https://images.unsplash.com/photo-1606167668584-78701c57f13d?w=400', 12000, true),
  ('007 First Light','https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400', 30000, true)
ON CONFLICT (name) DO NOTHING;
