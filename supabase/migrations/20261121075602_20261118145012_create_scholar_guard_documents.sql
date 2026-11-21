/*
# Create ScholarGuard document storage and private file access

1. New Tables
- `public.scholar_documents`
- `id`: unique document identifier.
- `user_id`: authenticated owner, filled from the current session.
- `file_name`, `storage_path`, `file_type`, `file_size`: uploaded file metadata.
- `extracted_text`: text extracted from the uploaded PDF or DOCX.
- `similarity_index`, `ai_detection`, `internet_sources`, `uitm_sources`: analysis summary values.
- `highlights`: JSON array containing highlighted sentence ranges and detection types.
- `suggestions`: JSON array containing paraphrase suggestions.
- `status`: analysis state.
- `created_at`: time of submission.

2. Storage
- Creates a private `scholar-documents` bucket for uploaded academic files.
- Limits uploads to PDF and DOCX MIME types and 20 MB per file.
- Requires every object path to begin with the authenticated user's ID.

3. Security
- Enables RLS on `scholar_documents`.
- Authenticated users can only read, create, update, and delete their own documents.
- The owner column is filled by the database session and is not client-writable.
- Adds separate storage policies for reading, uploading, updating, and deleting a user's own files.

4. Important Notes
- Files remain private and are accessed through the authenticated Supabase client.
- The application stores analysis output with the review record so previous reviews can be reopened.
*/

CREATE TABLE IF NOT EXISTS public.scholar_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  file_size bigint NOT NULL CHECK (file_size > 0 AND file_size <= 20971520),
  extracted_text text NOT NULL DEFAULT '',
  similarity_index numeric(5,2) NOT NULL DEFAULT 0 CHECK (similarity_index >= 0 AND similarity_index <= 100),
  ai_detection numeric(5,2) NOT NULL DEFAULT 0 CHECK (ai_detection >= 0 AND similarity_index <= 100),
  internet_sources integer NOT NULL DEFAULT 0 CHECK (internet_sources >= 0),
  uitm_sources integer NOT NULL DEFAULT 0 CHECK (uitm_sources >= 0),
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('analyzing', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scholar_documents ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.scholar_documents TO authenticated;
GRANT INSERT (file_name, storage_path, file_type, file_size, extracted_text, similarity_index, ai_detection, internet_sources, uitm_sources, highlights, suggestions, status) ON public.scholar_documents TO authenticated;
GRANT UPDATE (file_name, storage_path, file_type, file_size, extracted_text, similarity_index, ai_detection, internet_sources, uitm_sources, highlights, suggestions, status) ON public.scholar_documents TO authenticated;
GRANT DELETE ON public.scholar_documents TO authenticated;

DROP POLICY IF EXISTS "Users can view own scholar documents" ON public.scholar_documents;
CREATE POLICY "Users can view own scholar documents"
ON public.scholar_documents FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own scholar documents" ON public.scholar_documents;
CREATE POLICY "Users can create own scholar documents"
ON public.scholar_documents FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own scholar documents" ON public.scholar_documents;
CREATE POLICY "Users can update own scholar documents"
ON public.scholar_documents FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own scholar documents" ON public.scholar_documents;
CREATE POLICY "Users can delete own scholar documents"
ON public.scholar_documents FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scholar-documents',
  'scholar-documents',
  false,
  20971520,
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

DROP POLICY IF EXISTS "Users can read own scholar files" ON storage.objects;
CREATE POLICY "Users can read own scholar files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'scholar-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can upload own scholar files" ON storage.objects;
CREATE POLICY "Users can upload own scholar files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'scholar-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own scholar files" ON storage.objects;
CREATE POLICY "Users can update own scholar files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'scholar-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'scholar-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own scholar files" ON storage.objects;
CREATE POLICY "Users can delete own scholar files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'scholar-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
