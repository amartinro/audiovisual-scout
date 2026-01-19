-- Add user_id column to businesses table for ownership tracking
ALTER TABLE public.businesses 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Set default value for existing businesses (assign to first user who has a lead for each business)
UPDATE public.businesses b
SET user_id = (
  SELECT l.user_id 
  FROM public.leads l 
  WHERE l.business_id = b.id 
  ORDER BY l.created_at ASC 
  LIMIT 1
)
WHERE b.user_id IS NULL;

-- Make user_id NOT NULL after migration (only if there are no orphan businesses)
-- First delete any businesses without leads (orphaned data)
DELETE FROM public.businesses 
WHERE user_id IS NULL;

-- Now make it NOT NULL
ALTER TABLE public.businesses 
ALTER COLUMN user_id SET NOT NULL;

-- Drop existing permissive RLS policies on businesses
DROP POLICY IF EXISTS "Authenticated users can delete businesses" ON public.businesses;
DROP POLICY IF EXISTS "Authenticated users can insert businesses" ON public.businesses;
DROP POLICY IF EXISTS "Authenticated users can update businesses" ON public.businesses;
DROP POLICY IF EXISTS "Authenticated users can view businesses" ON public.businesses;

-- Create new secure RLS policies that check user ownership
CREATE POLICY "Users can view their own businesses"
ON public.businesses FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own businesses"
ON public.businesses FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own businesses"
ON public.businesses FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own businesses"
ON public.businesses FOR DELETE
USING (auth.uid() = user_id);