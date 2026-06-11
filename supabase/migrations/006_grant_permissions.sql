-- Grant full access to service_role on all BRCS tables
GRANT ALL ON TABLE public.assets TO service_role;
GRANT ALL ON TABLE public.zones TO service_role;
GRANT ALL ON TABLE public.alerts TO service_role;
GRANT ALL ON TABLE public.armory TO service_role;
GRANT ALL ON TABLE public.route_waypoints TO service_role;
GRANT ALL ON TABLE public.simulator_state TO service_role;
GRANT ALL ON TABLE public.operations TO service_role;
GRANT ALL ON TABLE public.pathfind_results TO service_role;
GRANT ALL ON TABLE public.asset_zone_states TO service_role;
GRANT ALL ON TABLE public.armory_movements TO service_role;

-- Also grant to anon and authenticated for direct client access
GRANT SELECT ON TABLE public.assets TO anon, authenticated;
GRANT SELECT ON TABLE public.zones TO anon, authenticated;
GRANT SELECT ON TABLE public.alerts TO anon, authenticated;
GRANT SELECT ON TABLE public.armory TO anon, authenticated;

-- Disable RLS on all tables (edge functions use service_role which bypasses RLS, but let's be explicit)
ALTER TABLE public.assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.armory DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_waypoints DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulator_state DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pathfind_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_zone_states DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.armory_movements DISABLE ROW LEVEL SECURITY;
