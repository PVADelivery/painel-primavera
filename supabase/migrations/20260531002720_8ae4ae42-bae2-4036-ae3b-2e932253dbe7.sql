
-- 1) Friendships: prevent requester from self-accepting
DROP POLICY IF EXISTS "update own friendship" ON public.friendships;

CREATE POLICY "addressee updates friendship status"
ON public.friendships
FOR UPDATE
TO authenticated
USING (auth.uid() = addressee_id)
WITH CHECK (auth.uid() = addressee_id);

CREATE POLICY "requester updates own request non-status"
ON public.friendships
FOR UPDATE
TO authenticated
USING (auth.uid() = requester_id AND status = 'pending')
WITH CHECK (auth.uid() = requester_id AND status = 'pending');

-- 2) Notifications: remove user-side INSERT (server-side / service role only)
DROP POLICY IF EXISTS "owner inserts notifications" ON public.notifications;
REVOKE INSERT ON public.notifications FROM authenticated, anon;

-- 3) Lock down trigger-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_system_albums() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- 4) has_role: keep usable by signed-in users (used in RLS), revoke from anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
