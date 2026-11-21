/*
# Add reference integrity check column to scholar_documents

1. Modified Tables
- `public.scholar_documents`
- Adds `reference_check` (jsonb) column to store the output of the
  reference verification and AI hallucination check for each document.
  Stores an object with: hasReferences (bool), issues (array), and
  references (array of parsed entries). Defaults to an empty object.

2. Security
- No changes to RLS or existing policies. The new column is covered by
  the existing SELECT/INSERT/UPDATE grants, so authenticated owners can
  read and write their own reference check data.
- Adds the new column to the allowed INSERT and UPDATE column lists so
  the Data API can write to it.

3. Important Notes
- This is a non-destructive ALTER TABLE ADD COLUMN with a safe default.
- Existing rows get the default empty object, so no data is lost.
*/

ALTER TABLE public.scholar_documents
  ADD COLUMN IF NOT EXISTS reference_check jsonb NOT NULL DEFAULT '{}'::jsonb;

GRANT INSERT (file_name, storage_path, file_type, file_size, extracted_text, similarity_index, ai_detection, internet_sources, uitm_sources, highlights, suggestions, reference_check, status) ON public.scholar_documents TO authenticated;
GRANT UPDATE (file_name, storage_path, file_type, file_size, extracted_text, similarity_index, ai_detection, internet_sources, uitm_sources, highlights, suggestions, reference_check, status) ON public.scholar_documents TO authenticated;
