import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hmxmuxrylzslkdybxyuv.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhteG11eHJ5bHpzbGtkeWJ4eXV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTg5NDYsImV4cCI6MjA5Nzk5NDk0Nn0.nI9zRkRa0uA0Tn9q92lCZ7wwgo3bJw9wl_Vz_AdasqI'
export const supabase = createClient(supabaseUrl, supabaseKey)
