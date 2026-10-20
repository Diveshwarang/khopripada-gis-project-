import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dpxcndpvywfqpvyovgce.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_puA9tFloJ_Dikf4ckHuBng_3Wdh2_XR';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
