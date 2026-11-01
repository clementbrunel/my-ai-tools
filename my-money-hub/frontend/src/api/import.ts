import apiClient from './axios'
import type { LinxoAccountChoice, LinxoImportReport } from '@/types'

/** dryRun=true previews the import (nothing written); dryRun=false applies it with the given account choices. */
export async function importLinxo(
  file: File,
  dryRun: boolean,
  choices: LinxoAccountChoice[] = [],
): Promise<LinxoImportReport> {
  const form = new FormData()
  form.append('file', file)
  form.append('dryRun', String(dryRun))
  if (choices.length > 0) form.append('choices', JSON.stringify(choices))
  const { data } = await apiClient.post<LinxoImportReport>('/import/linxo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
